/**
 * @fileoverview Abstraction Layer Manager for Aideon Cognitive Tentacle.
 * Manages different abstraction layers for data processing and understanding.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const path = require('path');
const { Logger } = require('../../../core/logging/Logger');
const { PerformanceMonitor } = require('../../../core/monitoring/PerformanceMonitor');
const { ConfigurationService } = require('../../../core/ConfigurationService');
const { SecurityManager } = require('../../../core/SecurityManager');

/**
 * Manages different abstraction layers for data processing and understanding.
 * Provides capabilities for processing data at different levels of abstraction,
 * from raw data to high-level abstract concepts.
 */
class AbstractionLayerManager extends EventEmitter {
  /**
   * Creates a new AbstractionLayerManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {ConfigurationService} [options.configService] - Configuration service
   * @param {Logger} [options.logger] - Logger instance
   * @param {PerformanceMonitor} [options.performanceMonitor] - Performance monitor
   * @param {SecurityManager} [options.securityManager] - Security manager
   */
  constructor(options = {}) {
    super();
    
    this.configService = options.configService || new ConfigurationService();
    this.logger = options.logger || new Logger('AbstractionLayerManager');
    this.performanceMonitor = options.performanceMonitor || new PerformanceMonitor({
      configService: this.configService,
      logger: this.logger
    });
    this.securityManager = options.securityManager || new SecurityManager({
      configService: this.configService,
      logger: this.logger
    });
    
    // Load configuration
    this.config = this.configService.getConfig('cognitive.abstraction', {
      maxLayers: 5,
      defaultLayer: 'semantic',
      enabledLayers: ['raw', 'syntactic', 'semantic', 'conceptual', 'abstract'],
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      securityEnabled: false
    });
    
    // Validate configuration
    this._validateConfiguration();
    
    // Initialize layers
    this.layers = this.config.enabledLayers.slice(0, this.config.maxLayers);
    this.currentLayer = this.config.defaultLayer;
    
    // Initialize cache
    this.cacheEnabled = this.config.cacheEnabled;
    this.cache = new Map();
    this.cacheTTL = this.config.cacheTTL;
    
    // Initialize security
    this.securityEnabled = this.config.securityEnabled;
    
    this.logger.info('AbstractionLayerManager initialized', {
      layers: this.layers,
      currentLayer: this.currentLayer,
      cacheEnabled: this.cacheEnabled
    });
  }
  
  /**
   * Validates the configuration.
   * 
   * @private
   * @throws {Error} If configuration is invalid
   */
  _validateConfiguration() {
    if (this.config.maxLayers <= 0) {
      throw new Error('maxLayers must be greater than 0');
    }
    
    if (!this.config.enabledLayers || this.config.enabledLayers.length === 0) {
      throw new Error('enabledLayers must not be empty');
    }
    
    if (!this.config.enabledLayers.includes(this.config.defaultLayer)) {
      throw new Error(`defaultLayer '${this.config.defaultLayer}' must be in enabledLayers`);
    }
  }
  
  /**
   * Gets available abstraction layers.
   * 
   * @returns {string[]} Array of available layer names
   */
  getAvailableLayers() {
    return [...this.layers];
  }
  
  /**
   * Gets the current abstraction layer.
   * 
   * @returns {string} Current layer name
   */
  getCurrentLayer() {
    return this.currentLayer;
  }
  
  /**
   * Sets the current abstraction layer.
   * 
   * @param {string} layerName - Layer name
   * @throws {Error} If layer is not available
   */
  setCurrentLayer(layerName) {
    if (!this.hasLayer(layerName)) {
      throw new Error(`Layer '${layerName}' is not available`);
    }
    
    const previousLayer = this.currentLayer;
    this.currentLayer = layerName;
    
    this.logger.info(`Current layer changed from '${previousLayer}' to '${layerName}'`);
    
    // Emit event
    this.emit('layerChanged', {
      previousLayer,
      newLayer: layerName
    });
  }
  
  /**
   * Checks if a layer is available.
   * 
   * @param {string} layerName - Layer name
   * @returns {boolean} Whether the layer is available
   */
  hasLayer(layerName) {
    return this.layers.includes(layerName);
  }
  
  /**
   * Processes data at the current abstraction layer.
   * 
   * @param {Object} data - Data to process
   * @returns {Object} Processed data
   * @throws {Error} If processing fails
   */
  processData(data) {
    return this.processDataAtLayer(data, this.currentLayer);
  }
  
  /**
   * Processes data at a specific abstraction layer.
   * 
   * @param {Object} data - Data to process
   * @param {string} layerName - Layer name
   * @returns {Object} Processed data
   * @throws {Error} If layer is not available or processing fails
   */
  processDataAtLayer(data, layerName) {
    if (!this.hasLayer(layerName)) {
      throw new Error(`Layer '${layerName}' is not available`);
    }
    
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    // Start performance monitoring
    const timerId = this.performanceMonitor.startTimer(`processDataAtLayer_${layerName}`);
    
    try {
      // Check cache if enabled
      if (this.cacheEnabled) {
        const cacheKey = this._generateCacheKey(data, layerName);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult && cachedResult.timestamp > Date.now() - this.cacheTTL) {
          this.logger.debug(`Cache hit for layer '${layerName}'`, { dataId: data.id });
          
          // End performance monitoring
          this.performanceMonitor.endTimer(timerId);
          
          // Return cached result with cache flag
          return {
            ...cachedResult.result,
            fromCache: true
          };
        }
      }
      
      // Process data at the specified layer
      const result = this._processAtLayer(data, layerName);
      
      // Cache result if enabled
      if (this.cacheEnabled) {
        const cacheKey = this._generateCacheKey(data, layerName);
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      // Emit event
      this.emit('dataProcessed', {
        layer: layerName,
        dataId: data.id,
        ...result
      });
      
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      return result;
    } catch (error) {
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      this.logger.error(`Error processing data at layer '${layerName}'`, error);
      throw error;
    }
  }
  
  /**
   * Processes data through multiple abstraction layers.
   * 
   * @param {Object} data - Data to process
   * @param {string[]} layerNames - Layer names
   * @returns {Object[]} Array of processed data for each layer
   * @throws {Error} If any layer is not available or processing fails
   */
  processDataThroughLayers(data, layerNames) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    // Validate all layers
    for (const layerName of layerNames) {
      if (!this.hasLayer(layerName)) {
        throw new Error(`Layer '${layerName}' is not available`);
      }
    }
    
    // Start performance monitoring
    const timerId = this.performanceMonitor.startTimer('processDataThroughLayers');
    
    try {
      // Process data through each layer
      const results = [];
      
      for (const layerName of layerNames) {
        const result = this.processDataAtLayer(data, layerName);
        results.push(result);
      }
      
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      return results;
    } catch (error) {
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      this.logger.error('Error processing data through layers', error);
      throw error;
    }
  }
  
  /**
   * Processes data at a specific layer.
   * 
   * @private
   * @param {Object} data - Data to process
   * @param {string} layerName - Layer name
   * @returns {Object} Processed data
   */
  _processAtLayer(data, layerName) {
    this.logger.debug(`Processing data at layer '${layerName}'`, { dataId: data.id });
    
    // Apply security if enabled and data is sensitive
    let processedData = { ...data };
    if (this.securityEnabled && data.sensitive) {
      const encryptedData = this.securityManager.encrypt(JSON.stringify(data));
      processedData = {
        ...data,
        _encrypted: true,
        _encryptedData: encryptedData
      };
    }
    
    // In a real implementation, this would apply layer-specific processing
    // For now, we'll just add layer information
    return {
      layer: layerName,
      processed: true,
      timestamp: Date.now(),
      data: processedData
    };
  }
  
  /**
   * Generates a cache key for data and layer.
   * 
   * @private
   * @param {Object} data - Data to process
   * @param {string} layerName - Layer name
   * @returns {string} Cache key
   */
  _generateCacheKey(data, layerName) {
    // Use data ID if available, otherwise stringify the data
    const dataKey = data.id || JSON.stringify(data);
    return `${layerName}_${dataKey}`;
  }
  
  /**
   * Enables or disables caching.
   * 
   * @param {boolean} enabled - Whether caching is enabled
   */
  setCacheEnabled(enabled) {
    this.cacheEnabled = enabled;
    this.logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
    
    // Clear cache if disabled
    if (!enabled) {
      this.clearCache();
    }
  }
  
  /**
   * Clears the cache.
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }
  
  /**
   * Enables or disables security features.
   * 
   * @param {boolean} enabled - Whether security is enabled
   */
  setSecurityEnabled(enabled) {
    this.securityEnabled = enabled;
    this.logger.info(`Security ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Disposes of the abstraction layer manager.
   */
  dispose() {
    this.logger.info('Disposing AbstractionLayerManager');
    
    // Clear cache
    this.cache.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    // Clean up references
    this.layers = null;
    this.currentLayer = null;
    
    this.logger.info('AbstractionLayerManager disposed');
  }
}

module.exports = { AbstractionLayerManager };
