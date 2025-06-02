/**
 * @fileoverview ModelRegistry is responsible for registering, tracking, and managing
 * machine learning models within Aideon Core. It provides a centralized registry
 * for model metadata, status tracking, and lifecycle management.
 * 
 * @module core/ml/ModelRegistry
 * @requires core/utils/Logger
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const logger = require('../utils/Logger').getLogger('ModelRegistry');

/**
 * @class ModelRegistry
 * @extends EventEmitter
 * @description Registry for managing ML models and their metadata
 */
class ModelRegistry extends EventEmitter {
  /**
   * Creates an instance of ModelRegistry
   * @param {Object} options - Configuration options
   * @param {string} options.registryPath - Path to store registry data
   * @param {boolean} options.persistRegistry - Whether to persist registry to disk
   * @param {number} options.persistInterval - Interval for persisting registry in milliseconds
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      registryPath: path.join(process.cwd(), 'data', 'model-registry.json'),
      persistRegistry: true,
      persistInterval: 300000, // 5 minutes
      ...options
    };
    
    this.models = new Map();
    this.persistTimer = null;
    this.isInitialized = false;
    this.isDirty = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.registerModel = this.registerModel.bind(this);
    this.updateModel = this.updateModel.bind(this);
    this.unregisterModel = this.unregisterModel.bind(this);
    this.getModel = this.getModel.bind(this);
    this.getAllModels = this.getAllModels.bind(this);
    this.getModelsByStatus = this.getModelsByStatus.bind(this);
    this.getModelsByType = this.getModelsByType.bind(this);
    this.getModelsByAccuracy = this.getModelsByAccuracy.bind(this);
    this.persistRegistry = this.persistRegistry.bind(this);
    this.loadRegistry = this.loadRegistry.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelRegistry
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelRegistry already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelRegistry');
      
      // Ensure directory exists
      const registryDir = path.dirname(this.options.registryPath);
      if (!fs.existsSync(registryDir)) {
        fs.mkdirSync(registryDir, { recursive: true });
      }
      
      // Load existing registry if available
      await this.loadRegistry();
      
      // Set up persistence timer if enabled
      if (this.options.persistRegistry && this.options.persistInterval > 0) {
        this.persistTimer = setInterval(
          async () => {
            if (this.isDirty) {
              await this.persistRegistry();
            }
          },
          this.options.persistInterval
        );
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelRegistry initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelRegistry: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Registers a model with the registry
   * @async
   * @param {Object} modelInfo - Model information
   * @param {string} modelInfo.id - Unique model identifier
   * @param {string} modelInfo.name - Human-readable model name
   * @param {string} modelInfo.version - Model version
   * @param {string} modelInfo.type - Model type (e.g., 'text-generation', 'embedding')
   * @param {number} modelInfo.accuracy - Model accuracy (0-100)
   * @param {string} modelInfo.format - Model format (e.g., 'ggml', 'gguf', 'onnx')
   * @param {string} modelInfo.path - Path to model files
   * @param {Array<string>} modelInfo.files - List of model files
   * @param {string} modelInfo.status - Model status (e.g., 'available', 'loaded')
   * @returns {Promise<Object>} Registered model information
   */
  async registerModel(modelInfo) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!modelInfo || !modelInfo.id) {
      throw new Error('Model ID is required');
    }
    
    // Check if model already exists
    if (this.models.has(modelInfo.id)) {
      logger.warn(`Model ${modelInfo.id} already registered, updating instead`);
      return this.updateModel(modelInfo.id, modelInfo);
    }
    
    // Validate required fields
    const requiredFields = ['id', 'name', 'version', 'type', 'accuracy', 'format'];
    for (const field of requiredFields) {
      if (!modelInfo[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate accuracy threshold
    if (typeof modelInfo.accuracy !== 'number' || modelInfo.accuracy < 93.8) {
      logger.warn(`Model ${modelInfo.id} accuracy ${modelInfo.accuracy} below threshold (93.8%)`);
    }
    
    // Set default values
    const now = Date.now();
    const model = {
      ...modelInfo,
      registeredAt: now,
      updatedAt: now,
      status: modelInfo.status || 'available',
      loadedAt: null,
      lastUsed: null,
      error: null,
      instance: null
    };
    
    // Add to registry
    this.models.set(model.id, model);
    this.isDirty = true;
    
    this.emit('modelRegistered', model.id, model);
    logger.info(`Model ${model.id} registered successfully`);
    
    // Persist registry if enabled
    if (this.options.persistRegistry && !this.persistTimer) {
      await this.persistRegistry();
    }
    
    return model;
  }
  
  /**
   * Updates a registered model
   * @async
   * @param {string} modelId - ID of the model to update
   * @param {Object} updates - Model information updates
   * @returns {Promise<Object>} Updated model information
   */
  async updateModel(modelId, updates) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    // Check if model exists
    if (!this.models.has(modelId)) {
      throw new Error(`Model ${modelId} not found in registry`);
    }
    
    // Get current model info
    const currentModel = this.models.get(modelId);
    
    // Create updated model info
    const updatedModel = {
      ...currentModel,
      ...updates,
      id: modelId, // Ensure ID doesn't change
      updatedAt: Date.now()
    };
    
    // Update registry
    this.models.set(modelId, updatedModel);
    this.isDirty = true;
    
    this.emit('modelUpdated', modelId, updatedModel);
    logger.info(`Model ${modelId} updated successfully`);
    
    // Persist registry if enabled
    if (this.options.persistRegistry && !this.persistTimer) {
      await this.persistRegistry();
    }
    
    return updatedModel;
  }
  
  /**
   * Unregisters a model from the registry
   * @async
   * @param {string} modelId - ID of the model to unregister
   * @returns {Promise<boolean>} Unregister success status
   */
  async unregisterModel(modelId) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    // Check if model exists
    if (!this.models.has(modelId)) {
      logger.warn(`Model ${modelId} not found in registry`);
      return false;
    }
    
    // Remove from registry
    this.models.delete(modelId);
    this.isDirty = true;
    
    this.emit('modelUnregistered', modelId);
    logger.info(`Model ${modelId} unregistered successfully`);
    
    // Persist registry if enabled
    if (this.options.persistRegistry && !this.persistTimer) {
      await this.persistRegistry();
    }
    
    return true;
  }
  
  /**
   * Gets a model by ID
   * @async
   * @param {string} modelId - ID of the model to get
   * @returns {Promise<Object>} Model information
   */
  async getModel(modelId) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    // Check if model exists
    if (!this.models.has(modelId)) {
      return null;
    }
    
    return this.models.get(modelId);
  }
  
  /**
   * Gets all registered models
   * @async
   * @returns {Promise<Array<Object>>} Array of model information
   */
  async getAllModels() {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    return Array.from(this.models.values());
  }
  
  /**
   * Gets models by status
   * @async
   * @param {string} status - Status to filter by (e.g., 'available', 'loaded')
   * @returns {Promise<Array<Object>>} Array of model information
   */
  async getModelsByStatus(status) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!status) {
      throw new Error('Status is required');
    }
    
    const models = await this.getAllModels();
    return models.filter(model => model.status === status);
  }
  
  /**
   * Gets models by type
   * @async
   * @param {string} type - Type to filter by (e.g., 'text-generation', 'embedding')
   * @returns {Promise<Array<Object>>} Array of model information
   */
  async getModelsByType(type) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!type) {
      throw new Error('Type is required');
    }
    
    const models = await this.getAllModels();
    return models.filter(model => model.type === type);
  }
  
  /**
   * Gets models by minimum accuracy
   * @async
   * @param {number} minAccuracy - Minimum accuracy to filter by (0-100)
   * @returns {Promise<Array<Object>>} Array of model information
   */
  async getModelsByAccuracy(minAccuracy) {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (typeof minAccuracy !== 'number') {
      throw new Error('Minimum accuracy must be a number');
    }
    
    const models = await this.getAllModels();
    return models.filter(model => model.accuracy >= minAccuracy);
  }
  
  /**
   * Persists the registry to disk
   * @async
   * @returns {Promise<boolean>} Persistence success status
   */
  async persistRegistry() {
    if (!this.isInitialized) {
      throw new Error('ModelRegistry not initialized');
    }
    
    if (!this.options.persistRegistry) {
      logger.debug('Registry persistence disabled');
      return false;
    }
    
    try {
      logger.debug('Persisting model registry to disk');
      
      // Convert models to array and remove instance references
      const modelsArray = Array.from(this.models.entries()).map(([id, model]) => {
        const { instance, ...modelWithoutInstance } = model;
        return modelWithoutInstance;
      });
      
      // Write to file
      const registryData = JSON.stringify({
        version: '1.0',
        timestamp: Date.now(),
        models: modelsArray
      }, null, 2);
      
      fs.writeFileSync(this.options.registryPath, registryData);
      
      this.isDirty = false;
      logger.debug('Model registry persisted successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to persist model registry: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Loads the registry from disk
   * @async
   * @returns {Promise<boolean>} Load success status
   */
  async loadRegistry() {
    if (!this.options.persistRegistry) {
      logger.debug('Registry persistence disabled, skipping load');
      return false;
    }
    
    try {
      // Check if registry file exists
      if (!fs.existsSync(this.options.registryPath)) {
        logger.info('Registry file not found, starting with empty registry');
        return false;
      }
      
      logger.debug('Loading model registry from disk');
      
      // Read and parse registry file
      const registryData = fs.readFileSync(this.options.registryPath, 'utf8');
      const registry = JSON.parse(registryData);
      
      // Validate registry format
      if (!registry.models || !Array.isArray(registry.models)) {
        logger.warn('Invalid registry format, starting with empty registry');
        return false;
      }
      
      // Clear current registry
      this.models.clear();
      
      // Load models into registry
      for (const model of registry.models) {
        if (model && model.id) {
          this.models.set(model.id, model);
        }
      }
      
      logger.info(`Loaded ${this.models.size} models from registry`);
      return true;
    } catch (error) {
      logger.error(`Failed to load model registry: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Shuts down the ModelRegistry
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelRegistry not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ModelRegistry');
      
      // Clear persistence timer
      if (this.persistTimer) {
        clearInterval(this.persistTimer);
        this.persistTimer = null;
      }
      
      // Persist registry if dirty
      if (this.isDirty && this.options.persistRegistry) {
        await this.persistRegistry();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelRegistry shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelRegistry shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelRegistry;
