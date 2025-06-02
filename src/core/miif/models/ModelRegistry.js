/**
 * @fileoverview Model Registry for the Model Integration and Intelligence Framework (MIIF)
 * Manages registration, discovery, and lifecycle of all embedded models
 * 
 * @module src/core/miif/models/ModelRegistry
 */

const EventEmitter = require('events');
const { ModelTier, ModelModality, ModelTaskType } = require('./ModelEnums');

/**
 * Model Registry
 * Manages registration, discovery, and lifecycle of all embedded models
 * @extends EventEmitter
 */
class ModelRegistry extends EventEmitter {
  /**
   * Create a new Model Registry
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      enableModelCaching: true,
      maxCachedModels: 5,
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Registry of all available models
    this.availableModels = new Map();
    
    // Registry of initialized models
    this.initializedModels = new Map();
    
    // Model adapter classes by modality
    this.adapterClasses = {
      [ModelModality.TEXT]: {},
      [ModelModality.IMAGE]: {},
      [ModelModality.VIDEO]: {},
      [ModelModality.AUDIO]: {},
      [ModelModality.MULTIMODAL]: {}
    };
    
    this.logger.info('[ModelRegistry] Model Registry initialized');
  }
  
  /**
   * Register a model adapter class
   * @param {string} modelId - Unique identifier for the model
   * @param {Function} adapterClass - Model adapter class
   * @param {string} modality - Model modality
   * @returns {boolean} Success status
   */
  registerModelAdapterClass(modelId, adapterClass, modality) {
    if (!Object.values(ModelModality).includes(modality)) {
      this.logger.error(`[ModelRegistry] Invalid modality: ${modality}`);
      return false;
    }
    
    if (this.adapterClasses[modality][modelId]) {
      this.logger.warn(`[ModelRegistry] Model adapter class already registered for ${modelId}`);
      return false;
    }
    
    this.adapterClasses[modality][modelId] = adapterClass;
    this.logger.info(`[ModelRegistry] Registered model adapter class for ${modelId} (${modality})`);
    return true;
  }
  
  /**
   * Register a model
   * @param {string} modelId - Unique identifier for the model
   * @param {Object} modelInfo - Model information
   * @returns {boolean} Success status
   */
  registerModel(modelId, modelInfo) {
    if (this.availableModels.has(modelId)) {
      this.logger.warn(`[ModelRegistry] Model already registered: ${modelId}`);
      return false;
    }
    
    this.availableModels.set(modelId, {
      ...modelInfo,
      registeredAt: new Date()
    });
    
    this.logger.info(`[ModelRegistry] Registered model: ${modelId}`);
    this.emit('modelRegistered', modelId, modelInfo);
    return true;
  }
  
  /**
   * Get model by ID
   * @param {string} modelId - Model ID
   * @returns {Object|null} Model information or null if not found
   */
  getModel(modelId) {
    return this.availableModels.get(modelId) || null;
  }
  
  /**
   * Get all available models
   * @param {Object} [filter] - Filter criteria
   * @param {string} [filter.modality] - Filter by modality
   * @param {string} [filter.tier] - Filter by tier
   * @param {string} [filter.task] - Filter by supported task
   * @returns {Array<Object>} List of models
   */
  getAllModels(filter = {}) {
    let models = Array.from(this.availableModels.entries()).map(([id, info]) => ({
      id,
      ...info
    }));
    
    if (filter.modality) {
      models = models.filter(model => model.modality === filter.modality);
    }
    
    if (filter.tier) {
      models = models.filter(model => model.tier === filter.tier);
    }
    
    if (filter.task) {
      models = models.filter(model => model.supportedTasks.includes(filter.task));
    }
    
    return models;
  }
  
  /**
   * Get model adapter instance
   * @param {string} modelId - Model ID
   * @param {Object} [options] - Adapter options
   * @returns {Promise<Object>} Model adapter instance
   */
  async getModelAdapter(modelId, options = {}) {
    // Check if model is already initialized
    if (this.initializedModels.has(modelId)) {
      return this.initializedModels.get(modelId);
    }
    
    // Get model information
    const modelInfo = this.getModel(modelId);
    if (!modelInfo) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    // Get adapter class
    const adapterClass = this.adapterClasses[modelInfo.modality][modelId];
    if (!adapterClass) {
      throw new Error(`Model adapter class not found for ${modelId}`);
    }
    
    // Create adapter instance
    const adapter = new adapterClass(options, this.dependencies);
    
    // Initialize adapter
    await adapter.initialize();
    
    // Store initialized adapter
    this.initializedModels.set(modelId, adapter);
    
    // Manage cache size
    if (this.options.enableModelCaching && this.initializedModels.size > this.options.maxCachedModels) {
      await this._pruneModelCache();
    }
    
    return adapter;
  }
  
  /**
   * Prune model cache by unloading least recently used models
   * @returns {Promise<void>}
   * @private
   */
  async _pruneModelCache() {
    // Implementation would unload least recently used models
    // This is a placeholder for the actual implementation
    this.logger.info(`[ModelRegistry] Pruning model cache`);
    
    // Get models to unload
    const modelsToUnload = Array.from(this.initializedModels.entries())
      .slice(0, this.initializedModels.size - this.options.maxCachedModels);
    
    // Unload models
    for (const [modelId, adapter] of modelsToUnload) {
      try {
        await adapter.unload();
        this.initializedModels.delete(modelId);
        this.logger.info(`[ModelRegistry] Unloaded model from cache: ${modelId}`);
      } catch (error) {
        this.logger.error(`[ModelRegistry] Failed to unload model ${modelId}: ${error.message}`);
      }
    }
  }
  
  /**
   * Find best model for task
   * @param {string} task - Task type
   * @param {Object} [constraints] - Constraints
   * @param {string} [constraints.tier] - Maximum tier
   * @param {Object} [constraints.memory] - Memory constraints
   * @param {number} [constraints.memory.ram] - Available RAM in GB
   * @param {number} [constraints.memory.vram] - Available VRAM in GB
   * @returns {string|null} Best model ID or null if not found
   */
  findBestModelForTask(task, constraints = {}) {
    if (!Object.values(ModelTaskType).includes(task)) {
      this.logger.error(`[ModelRegistry] Invalid task type: ${task}`);
      return null;
    }
    
    // Get all models that support the task
    let candidates = this.getAllModels({ task });
    
    // Filter by tier
    if (constraints.tier) {
      const tierIndex = Object.values(ModelTier).indexOf(constraints.tier);
      if (tierIndex >= 0) {
        const allowedTiers = Object.values(ModelTier).slice(0, tierIndex + 1);
        candidates = candidates.filter(model => allowedTiers.includes(model.tier));
      }
    }
    
    // Filter by memory constraints
    if (constraints.memory) {
      candidates = candidates.filter(model => {
        const memReq = model.memoryRequirements;
        return (!constraints.memory.ram || memReq.ram <= constraints.memory.ram) &&
               (!constraints.memory.vram || memReq.vram <= constraints.memory.vram);
      });
    }
    
    // Sort by accuracy (descending)
    candidates.sort((a, b) => b.accuracy - a.accuracy);
    
    return candidates.length > 0 ? candidates[0].id : null;
  }
  
  /**
   * Unload all models
   * @returns {Promise<boolean>} Success status
   */
  async unloadAllModels() {
    this.logger.info(`[ModelRegistry] Unloading all models`);
    
    const promises = Array.from(this.initializedModels.entries()).map(async ([modelId, adapter]) => {
      try {
        await adapter.unload();
        this.logger.info(`[ModelRegistry] Unloaded model: ${modelId}`);
        return true;
      } catch (error) {
        this.logger.error(`[ModelRegistry] Failed to unload model ${modelId}: ${error.message}`);
        return false;
      }
    });
    
    const results = await Promise.all(promises);
    this.initializedModels.clear();
    
    return results.every(result => result);
  }
  
  /**
   * Get registry status
   * @returns {Object} Registry status
   */
  getStatus() {
    return {
      availableModels: this.availableModels.size,
      initializedModels: this.initializedModels.size,
      registeredAdapters: {
        [ModelModality.TEXT]: Object.keys(this.adapterClasses[ModelModality.TEXT]).length,
        [ModelModality.IMAGE]: Object.keys(this.adapterClasses[ModelModality.IMAGE]).length,
        [ModelModality.VIDEO]: Object.keys(this.adapterClasses[ModelModality.VIDEO]).length,
        [ModelModality.AUDIO]: Object.keys(this.adapterClasses[ModelModality.AUDIO]).length,
        [ModelModality.MULTIMODAL]: Object.keys(this.adapterClasses[ModelModality.MULTIMODAL]).length
      },
      enableModelCaching: this.options.enableModelCaching,
      maxCachedModels: this.options.maxCachedModels
    };
  }
}

module.exports = ModelRegistry;
