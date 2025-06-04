/**
 * @fileoverview Quantization Manager for the Model Orchestration System
 * Provides dynamic quantization management for optimal model performance
 * 
 * @module src/core/miif/models/orchestration/QuantizationManager
 */

const EventEmitter = require('events');
const { QuantizationLevel } = require('../ModelEnums');

/**
 * Quantization Manager
 * Manages dynamic quantization for optimal model performance
 * @extends EventEmitter
 */
class QuantizationManager extends EventEmitter {
  /**
   * Create a new Quantization Manager
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      enableDynamicQuantization: true,
      defaultQuantizationLevel: QuantizationLevel.INT8,
      lowMemoryQuantizationLevel: QuantizationLevel.INT4,
      highPerformanceQuantizationLevel: QuantizationLevel.FP16,
      memoryThresholdForLowMemory: 4, // GB
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.resourceMonitor = dependencies.resourceMonitor;
    
    if (!this.resourceMonitor) {
      this.logger.warn('[QuantizationManager] Resource monitor not provided, dynamic quantization will be limited');
    }
    
    this.logger.info('[QuantizationManager] Quantization Manager initialized');
  }
  
  /**
   * Get optimal quantization level for model
   * @param {Object} modelInfo - Model information
   * @param {Object} [constraints] - Constraints
   * @param {string} [constraints.priority='balanced'] - Priority ('speed', 'balanced', 'accuracy')
   * @param {Object} [constraints.memory] - Memory constraints
   * @param {number} [constraints.memory.ram] - Available RAM in GB
   * @param {number} [constraints.memory.vram] - Available VRAM in GB
   * @returns {string} Optimal quantization level
   */
  getOptimalQuantizationLevel(modelInfo, constraints = {}) {
    const {
      priority = 'balanced',
      memory = this._getAvailableMemory()
    } = constraints;
    
    // Get supported quantization levels for the model
    const supportedLevels = modelInfo.quantizationLevels || [
      QuantizationLevel.INT8,
      QuantizationLevel.FP16
    ];
    
    // If no supported levels, return default
    if (!supportedLevels.length) {
      return this.options.defaultQuantizationLevel;
    }
    
    // If dynamic quantization is disabled, return default
    if (!this.options.enableDynamicQuantization) {
      return supportedLevels.includes(this.options.defaultQuantizationLevel)
        ? this.options.defaultQuantizationLevel
        : supportedLevels[0];
    }
    
    // Determine optimal level based on priority and memory constraints
    let optimalLevel;
    
    if (priority === 'speed') {
      // For speed priority, use lowest precision that fits in memory
      optimalLevel = this._findLowestPrecisionLevel(supportedLevels, memory, modelInfo);
    } else if (priority === 'accuracy') {
      // For accuracy priority, use highest precision that fits in memory
      optimalLevel = this._findHighestPrecisionLevel(supportedLevels, memory, modelInfo);
    } else {
      // For balanced priority, use default level if it fits, otherwise adjust
      if (this._levelFitsInMemory(this.options.defaultQuantizationLevel, memory, modelInfo)) {
        optimalLevel = this.options.defaultQuantizationLevel;
      } else {
        optimalLevel = this._findLowestPrecisionLevel(supportedLevels, memory, modelInfo);
      }
    }
    
    // If no suitable level found, use lowest precision
    if (!optimalLevel && supportedLevels.length > 0) {
      optimalLevel = this._getLowestPrecisionLevel(supportedLevels);
    }
    
    this.logger.debug(`[QuantizationManager] Selected quantization level ${optimalLevel} for model ${modelInfo.name} (priority: ${priority})`);
    
    return optimalLevel || this.options.defaultQuantizationLevel;
  }
  
  /**
   * Find lowest precision level that fits in memory
   * @param {Array<string>} levels - Supported quantization levels
   * @param {Object} memory - Available memory
   * @param {Object} modelInfo - Model information
   * @returns {string|null} Lowest precision level or null if none fit
   * @private
   */
  _findLowestPrecisionLevel(levels, memory, modelInfo) {
    // Sort levels by precision (ascending)
    const sortedLevels = this._sortLevelsByPrecision(levels, 'asc');
    
    // Find first level that fits in memory
    for (const level of sortedLevels) {
      if (this._levelFitsInMemory(level, memory, modelInfo)) {
        return level;
      }
    }
    
    return null;
  }
  
  /**
   * Find highest precision level that fits in memory
   * @param {Array<string>} levels - Supported quantization levels
   * @param {Object} memory - Available memory
   * @param {Object} modelInfo - Model information
   * @returns {string|null} Highest precision level or null if none fit
   * @private
   */
  _findHighestPrecisionLevel(levels, memory, modelInfo) {
    // Sort levels by precision (descending)
    const sortedLevels = this._sortLevelsByPrecision(levels, 'desc');
    
    // Find first level that fits in memory
    for (const level of sortedLevels) {
      if (this._levelFitsInMemory(level, memory, modelInfo)) {
        return level;
      }
    }
    
    return null;
  }
  
  /**
   * Check if quantization level fits in memory
   * @param {string} level - Quantization level
   * @param {Object} memory - Available memory
   * @param {Object} modelInfo - Model information
   * @returns {boolean} Whether the level fits in memory
   * @private
   */
  _levelFitsInMemory(level, memory, modelInfo) {
    // If model doesn't have memory requirements, assume it fits
    if (!modelInfo.memoryRequirements || !modelInfo.memoryRequirements[level]) {
      return true;
    }
    
    const requirements = modelInfo.memoryRequirements[level];
    
    // Check RAM requirements
    if (requirements.ram && memory.ram && requirements.ram > memory.ram) {
      return false;
    }
    
    // Check VRAM requirements
    if (requirements.vram && memory.vram && requirements.vram > memory.vram) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Sort quantization levels by precision
   * @param {Array<string>} levels - Quantization levels
   * @param {string} order - Sort order ('asc' or 'desc')
   * @returns {Array<string>} Sorted levels
   * @private
   */
  _sortLevelsByPrecision(levels, order = 'asc') {
    // Precision ranking (lower index = lower precision)
    const precisionRanking = [
      QuantizationLevel.INT4,
      QuantizationLevel.INT5,
      QuantizationLevel.INT8,
      QuantizationLevel.FP16,
      QuantizationLevel.FP32
    ];
    
    // Sort levels by precision ranking
    const sortedLevels = [...levels].sort((a, b) => {
      const rankA = precisionRanking.indexOf(a);
      const rankB = precisionRanking.indexOf(b);
      
      if (rankA === -1 && rankB === -1) return 0;
      if (rankA === -1) return 1;
      if (rankB === -1) return -1;
      
      return order === 'asc' ? rankA - rankB : rankB - rankA;
    });
    
    return sortedLevels;
  }
  
  /**
   * Get lowest precision level
   * @param {Array<string>} levels - Quantization levels
   * @returns {string} Lowest precision level
   * @private
   */
  _getLowestPrecisionLevel(levels) {
    return this._sortLevelsByPrecision(levels, 'asc')[0];
  }
  
  /**
   * Get highest precision level
   * @param {Array<string>} levels - Quantization levels
   * @returns {string} Highest precision level
   * @private
   */
  _getHighestPrecisionLevel(levels) {
    return this._sortLevelsByPrecision(levels, 'desc')[0];
  }
  
  /**
   * Get available memory
   * @returns {Object} Available memory
   * @private
   */
  _getAvailableMemory() {
    if (this.resourceMonitor) {
      return this.resourceMonitor.getAvailableMemory();
    }
    
    // Default values if resource monitor is not available
    return {
      ram: 8, // GB
      vram: 4  // GB
    };
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      enableDynamicQuantization: this.options.enableDynamicQuantization,
      defaultQuantizationLevel: this.options.defaultQuantizationLevel,
      lowMemoryQuantizationLevel: this.options.lowMemoryQuantizationLevel,
      highPerformanceQuantizationLevel: this.options.highPerformanceQuantizationLevel,
      memoryThresholdForLowMemory: this.options.memoryThresholdForLowMemory,
      availableMemory: this._getAvailableMemory()
    };
  }
}

module.exports = QuantizationManager;
