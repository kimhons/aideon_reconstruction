/**
 * @fileoverview Model Orchestration System for the Model Integration and Intelligence Framework (MIIF)
 * Provides dynamic model loading, unloading, and task-based selection
 * 
 * @module src/core/miif/models/orchestration/ModelOrchestrationSystem
 */

const EventEmitter = require('events');
const { ModelTier, ModelModality, ModelTaskType } = require('../ModelEnums');

/**
 * Model Orchestration System
 * Manages dynamic model loading, unloading, and task-based selection
 * @extends EventEmitter
 */
class ModelOrchestrationSystem extends EventEmitter {
  /**
   * Create a new Model Orchestration System
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      enableDynamicLoading: true,
      enableTaskBasedSelection: true,
      maxConcurrentModels: 3,
      memoryThreshold: 0.8, // 80% of available memory
      prioritizeAccuracy: true,
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.modelRegistry = dependencies.modelRegistry;
    
    if (!this.modelRegistry) {
      throw new Error('Model registry is required');
    }
    
    // Active model instances by ID
    this.activeModels = new Map();
    
    // Model usage statistics
    this.modelUsageStats = new Map();
    
    // Resource monitor
    this.resourceMonitor = {
      getAvailableMemory: () => {
        // Implementation would get actual system memory
        // This is a placeholder for the actual implementation
        return {
          ram: 16, // GB
          vram: 8   // GB
        };
      }
    };
    
    this.logger.info('[ModelOrchestrationSystem] Model Orchestration System initialized');
  }
  
  /**
   * Get model for task
   * @param {string} task - Task type
   * @param {Object} [options] - Options
   * @param {string} [options.tier] - Maximum tier
   * @param {string} [options.modality] - Preferred modality
   * @param {boolean} [options.offlineMode=false] - Whether to use offline mode
   * @param {string} [options.priority='balanced'] - Priority ('speed', 'balanced', 'accuracy')
   * @returns {Promise<Object>} Model adapter
   */
  async getModelForTask(task, options = {}) {
    if (!Object.values(ModelTaskType).includes(task)) {
      throw new Error(`Invalid task type: ${task}`);
    }
    
    const {
      tier = ModelTier.ENTERPRISE,
      modality,
      offlineMode = false,
      priority = 'balanced'
    } = options;
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting model for task: ${task}, tier: ${tier}, priority: ${priority}`);
    
    // Get available memory
    const availableMemory = this.resourceMonitor.getAvailableMemory();
    
    // Find best model for task
    const modelId = this.modelRegistry.findBestModelForTask(task, {
      tier,
      memory: {
        ram: availableMemory.ram * this.options.memoryThreshold,
        vram: availableMemory.vram * this.options.memoryThreshold
      }
    });
    
    if (!modelId) {
      throw new Error(`No suitable model found for task: ${task}`);
    }
    
    // Check if model is already active
    if (this.activeModels.has(modelId)) {
      const adapter = this.activeModels.get(modelId);
      this._updateModelUsageStats(modelId);
      return adapter;
    }
    
    // Check if we need to unload models
    if (this.activeModels.size >= this.options.maxConcurrentModels) {
      await this._unloadLeastUsedModel();
    }
    
    // Get model adapter
    const adapter = await this.modelRegistry.getModelAdapter(modelId, {
      offlineMode,
      priority
    });
    
    // Store active model
    this.activeModels.set(modelId, adapter);
    
    // Initialize usage stats
    this._updateModelUsageStats(modelId);
    
    this.logger.info(`[ModelOrchestrationSystem] Activated model for task: ${task}, model: ${modelId}`);
    this.emit('modelActivated', modelId, task);
    
    return adapter;
  }
  
  /**
   * Get specific model by ID
   * @param {string} modelId - Model ID
   * @param {Object} [options] - Options
   * @param {boolean} [options.offlineMode=false] - Whether to use offline mode
   * @param {string} [options.priority='balanced'] - Priority ('speed', 'balanced', 'accuracy')
   * @returns {Promise<Object>} Model adapter
   */
  async getModel(modelId, options = {}) {
    const {
      offlineMode = false,
      priority = 'balanced'
    } = options;
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting specific model: ${modelId}`);
    
    // Check if model is already active
    if (this.activeModels.has(modelId)) {
      const adapter = this.activeModels.get(modelId);
      this._updateModelUsageStats(modelId);
      return adapter;
    }
    
    // Check if we need to unload models
    if (this.activeModels.size >= this.options.maxConcurrentModels) {
      await this._unloadLeastUsedModel();
    }
    
    // Get model adapter
    const adapter = await this.modelRegistry.getModelAdapter(modelId, {
      offlineMode,
      priority
    });
    
    // Store active model
    this.activeModels.set(modelId, adapter);
    
    // Initialize usage stats
    this._updateModelUsageStats(modelId);
    
    this.logger.info(`[ModelOrchestrationSystem] Activated specific model: ${modelId}`);
    this.emit('modelActivated', modelId);
    
    return adapter;
  }
  
  /**
   * Unload model
   * @param {string} modelId - Model ID
   * @returns {Promise<boolean>} Success status
   */
  async unloadModel(modelId) {
    if (!this.activeModels.has(modelId)) {
      this.logger.warn(`[ModelOrchestrationSystem] Model not active: ${modelId}`);
      return false;
    }
    
    const adapter = this.activeModels.get(modelId);
    
    try {
      await adapter.unload();
      this.activeModels.delete(modelId);
      this.logger.info(`[ModelOrchestrationSystem] Unloaded model: ${modelId}`);
      this.emit('modelUnloaded', modelId);
      return true;
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to unload model ${modelId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Unload all models
   * @returns {Promise<boolean>} Success status
   */
  async unloadAllModels() {
    this.logger.info(`[ModelOrchestrationSystem] Unloading all models`);
    
    const promises = Array.from(this.activeModels.keys()).map(modelId => this.unloadModel(modelId));
    const results = await Promise.all(promises);
    
    return results.every(result => result);
  }
  
  /**
   * Update model usage statistics
   * @param {string} modelId - Model ID
   * @private
   */
  _updateModelUsageStats(modelId) {
    const now = Date.now();
    
    if (!this.modelUsageStats.has(modelId)) {
      this.modelUsageStats.set(modelId, {
        activationCount: 1,
        lastUsed: now,
        firstUsed: now
      });
    } else {
      const stats = this.modelUsageStats.get(modelId);
      stats.activationCount++;
      stats.lastUsed = now;
    }
  }
  
  /**
   * Unload least used model
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _unloadLeastUsedModel() {
    if (this.activeModels.size === 0) {
      return false;
    }
    
    // Find least recently used model
    let leastRecentlyUsed = null;
    let oldestTime = Date.now();
    
    for (const [modelId, _] of this.activeModels) {
      const stats = this.modelUsageStats.get(modelId);
      if (stats && stats.lastUsed < oldestTime) {
        oldestTime = stats.lastUsed;
        leastRecentlyUsed = modelId;
      }
    }
    
    if (leastRecentlyUsed) {
      this.logger.info(`[ModelOrchestrationSystem] Unloading least recently used model: ${leastRecentlyUsed}`);
      return this.unloadModel(leastRecentlyUsed);
    }
    
    return false;
  }
  
  /**
   * Get active models
   * @returns {Array<string>} Active model IDs
   */
  getActiveModels() {
    return Array.from(this.activeModels.keys());
  }
  
  /**
   * Get model usage statistics
   * @returns {Object} Model usage statistics
   */
  getModelUsageStatistics() {
    const stats = {};
    
    for (const [modelId, modelStats] of this.modelUsageStats) {
      stats[modelId] = {
        ...modelStats,
        isActive: this.activeModels.has(modelId)
      };
    }
    
    return stats;
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      activeModels: this.activeModels.size,
      maxConcurrentModels: this.options.maxConcurrentModels,
      enableDynamicLoading: this.options.enableDynamicLoading,
      enableTaskBasedSelection: this.options.enableTaskBasedSelection,
      memoryThreshold: this.options.memoryThreshold,
      prioritizeAccuracy: this.options.prioritizeAccuracy,
      availableMemory: this.resourceMonitor.getAvailableMemory()
    };
  }
}

module.exports = ModelOrchestrationSystem;
