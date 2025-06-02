/**
 * @fileoverview Model Orchestration System for Aideon Core
 * Provides centralized management and orchestration of all ML models
 * 
 * @module src/core/miif/models/orchestration/ModelOrchestrationSystem
 */

const { ModelRegistry } = require('../ModelRegistry');
const { ModelType, ModelTier } = require('../ModelEnums');
const { ResourceMonitor } = require('./ResourceMonitor');
const { QuantizationManager } = require('./QuantizationManager');
const { ApiServiceIntegration } = require('./ApiServiceIntegration');
const path = require('path');
const os = require('os');

/**
 * Model Orchestration System
 * Manages dynamic loading, unloading, and selection of models based on tasks and resources
 */
class ModelOrchestrationSystem {
  /**
   * Create a new Model Orchestration System
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Initialize components
    this.modelRegistry = new ModelRegistry(options, dependencies);
    this.resourceMonitor = new ResourceMonitor(options, dependencies);
    this.quantizationManager = new QuantizationManager(options, dependencies);
    this.apiServiceIntegration = new ApiServiceIntegration(options, dependencies);
    
    // Initialize state
    this.initialized = false;
    this.activeModels = new Map();
    this.modelUsageStats = new Map();
    this.userTier = ModelTier.STANDARD; // Default to standard tier
    
    this.logger.info(`[ModelOrchestrationSystem] Initialized`);
  }
  
  /**
   * Initialize the orchestration system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info(`[ModelOrchestrationSystem] Already initialized`);
      return true;
    }
    
    this.logger.info(`[ModelOrchestrationSystem] Initializing`);
    
    try {
      // Initialize components
      await this.resourceMonitor.initialize();
      await this.quantizationManager.initialize();
      await this.apiServiceIntegration.initialize();
      
      // Register built-in models
      await this.modelRegistry.registerBuiltInModels();
      
      // Discover and register additional models
      const modelsDir = this.options.modelsDir || path.join(os.homedir(), '.aideon', 'models');
      await this.modelRegistry.discoverAndRegisterModels(modelsDir);
      
      // Get user tier from admin panel
      await this._updateUserTier();
      
      this.initialized = true;
      this.logger.info(`[ModelOrchestrationSystem] Initialization complete`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Initialization failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Shutdown the orchestration system
   * @returns {Promise<boolean>} Success status
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info(`[ModelOrchestrationSystem] Not initialized, nothing to shut down`);
      return true;
    }
    
    this.logger.info(`[ModelOrchestrationSystem] Shutting down`);
    
    try {
      // Unload all active models
      await this.unloadAllModels();
      
      // Shutdown components
      await this.resourceMonitor.shutdown();
      await this.quantizationManager.shutdown();
      await this.apiServiceIntegration.shutdown();
      
      this.initialized = false;
      this.logger.info(`[ModelOrchestrationSystem] Shutdown complete`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Shutdown failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get model for task
   * @param {Object} params - Task parameters
   * @param {string} params.modelType - Model type (from ModelType enum)
   * @param {string} [params.taskType] - Specific task type
   * @param {number} [params.minAccuracy] - Minimum accuracy threshold
   * @param {boolean} [params.offlineOnly] - Whether to only consider models that work offline
   * @param {boolean} [params.preferApi] - Whether to prefer API-based models when online
   * @param {boolean} [params.autoLoad=true] - Whether to automatically load the model if not loaded
   * @returns {Promise<Object|null>} Model adapter or null if none found
   */
  async getModelForTask(params) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const { modelType, taskType, minAccuracy, offlineOnly, preferApi, autoLoad = true } = params;
    
    if (!modelType) {
      throw new Error('Model type is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting model for task: ${modelType}/${taskType || 'general'}`);
    
    try {
      // Check if we have a cached model for this task
      const taskKey = this._getTaskKey(modelType, taskType);
      if (this.activeModels.has(taskKey)) {
        const modelId = this.activeModels.get(taskKey);
        const model = this.modelRegistry.getModel(modelId);
        
        if (model && this.modelRegistry.isModelLoaded(modelId)) {
          this.logger.debug(`[ModelOrchestrationSystem] Using cached model for task: ${modelId}`);
          return model;
        }
      }
      
      // Get best model for task
      const model = this.modelRegistry.getBestModelForTask({
        modelType,
        tier: this.userTier,
        minAccuracy,
        offlineOnly,
        preferApi
      });
      
      if (!model) {
        this.logger.warn(`[ModelOrchestrationSystem] No suitable model found for task: ${modelType}/${taskType || 'general'}`);
        return null;
      }
      
      // Load model if not loaded and autoLoad is true
      if (autoLoad && !model.isLoaded) {
        const loadOptions = await this._getOptimalLoadOptions(model);
        await model.load(loadOptions);
        
        // Track model load status
        this.modelRegistry.trackModelLoadStatus(model.modelId, true);
      }
      
      // Cache model for this task
      this.activeModels.set(taskKey, model.modelId);
      
      // Track model usage
      this._trackModelUsage(model.modelId);
      
      this.logger.debug(`[ModelOrchestrationSystem] Selected model for task: ${model.modelId}`);
      return model;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get model for task: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Load a specific model
   * @param {string} modelId - Unique identifier for the model
   * @param {Object} [options] - Load options
   * @returns {Promise<boolean>} Success status
   */
  async loadModel(modelId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Loading model: ${modelId}`);
    
    try {
      // Get model
      const model = this.modelRegistry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }
      
      // Check if model is already loaded
      if (model.isLoaded) {
        this.logger.debug(`[ModelOrchestrationSystem] Model already loaded: ${modelId}`);
        return true;
      }
      
      // Check if user has access to this model tier
      if (!this._hasAccessToTier(model.modelTier)) {
        throw new Error(`User does not have access to ${model.modelTier} tier models`);
      }
      
      // Get optimal load options
      const loadOptions = await this._getOptimalLoadOptions(model, options);
      
      // Load model
      await model.load(loadOptions);
      
      // Track model load status
      this.modelRegistry.trackModelLoadStatus(modelId, true);
      
      this.logger.debug(`[ModelOrchestrationSystem] Model loaded: ${modelId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to load model ${modelId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Unload a specific model
   * @param {string} modelId - Unique identifier for the model
   * @returns {Promise<boolean>} Success status
   */
  async unloadModel(modelId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Unloading model: ${modelId}`);
    
    try {
      // Get model
      const model = this.modelRegistry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }
      
      // Check if model is loaded
      if (!model.isLoaded) {
        this.logger.debug(`[ModelOrchestrationSystem] Model not loaded: ${modelId}`);
        return true;
      }
      
      // Check if model is in use
      if (this._isModelInUse(modelId)) {
        this.logger.warn(`[ModelOrchestrationSystem] Cannot unload model ${modelId} while it is in use`);
        return false;
      }
      
      // Unload model
      await model.unload();
      
      // Track model load status
      this.modelRegistry.trackModelLoadStatus(modelId, false);
      
      // Remove from active models
      this.activeModels.forEach((id, taskKey) => {
        if (id === modelId) {
          this.activeModels.delete(taskKey);
        }
      });
      
      this.logger.debug(`[ModelOrchestrationSystem] Model unloaded: ${modelId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to unload model ${modelId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Unload all models
   * @returns {Promise<boolean>} Success status
   */
  async unloadAllModels() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Unloading all models`);
    
    try {
      // Get all loaded models
      const loadedModels = this.modelRegistry.getLoadedModels();
      
      // Unload each model
      let success = true;
      for (const model of loadedModels) {
        try {
          await model.unload();
          this.modelRegistry.trackModelLoadStatus(model.modelId, false);
        } catch (error) {
          this.logger.error(`[ModelOrchestrationSystem] Failed to unload model ${model.modelId}: ${error.message}`);
          success = false;
        }
      }
      
      // Clear active models
      this.activeModels.clear();
      
      this.logger.debug(`[ModelOrchestrationSystem] All models unloaded`);
      return success;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to unload all models: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Optimize memory usage by unloading least used models
   * @param {number} [targetMemory] - Target memory usage in MB
   * @returns {Promise<boolean>} Success status
   */
  async optimizeMemoryUsage(targetMemory) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Optimizing memory usage`);
    
    try {
      // Get current memory usage
      const currentMemory = await this.resourceMonitor.getMemoryUsage();
      const availableMemory = await this.resourceMonitor.getAvailableMemory();
      
      // If no target specified, aim to free up 20% of current usage
      if (!targetMemory) {
        targetMemory = currentMemory * 0.8;
      }
      
      // If we're already below target, nothing to do
      if (currentMemory <= targetMemory) {
        this.logger.debug(`[ModelOrchestrationSystem] Memory usage already optimized`);
        return true;
      }
      
      // Get all loaded models
      const loadedModels = this.modelRegistry.getLoadedModels();
      
      // Sort by usage frequency (least used first)
      loadedModels.sort((a, b) => {
        const usageA = this.modelUsageStats.get(a.modelId) || 0;
        const usageB = this.modelUsageStats.get(b.modelId) || 0;
        return usageA - usageB;
      });
      
      // Unload models until we reach target memory
      let currentUsage = currentMemory;
      for (const model of loadedModels) {
        // Skip models that are in use
        if (this._isModelInUse(model.modelId)) {
          continue;
        }
        
        // Unload model
        await this.unloadModel(model.modelId);
        
        // Update current usage
        currentUsage -= model.memoryUsage || 0;
        
        // Check if we've reached target
        if (currentUsage <= targetMemory) {
          break;
        }
      }
      
      this.logger.debug(`[ModelOrchestrationSystem] Memory usage optimized`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to optimize memory usage: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get API service for model
   * @param {string} modelId - Unique identifier for the model
   * @returns {Promise<Object|null>} API service or null if not available
   */
  async getApiServiceForModel(modelId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting API service for model: ${modelId}`);
    
    try {
      // Get model
      const model = this.modelRegistry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }
      
      // Check if model supports API
      if (!model.hybridCapable) {
        this.logger.debug(`[ModelOrchestrationSystem] Model ${modelId} does not support API`);
        return null;
      }
      
      // Get API service
      const apiService = await this.apiServiceIntegration.getApiServiceForModel(model);
      
      if (!apiService) {
        this.logger.debug(`[ModelOrchestrationSystem] No API service available for model: ${modelId}`);
        return null;
      }
      
      this.logger.debug(`[ModelOrchestrationSystem] API service found for model: ${modelId}`);
      return apiService;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get API service for model ${modelId}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Track API usage for billing
   * @param {string} modelId - Unique identifier for the model
   * @param {Object} usage - Usage information
   * @returns {Promise<boolean>} Success status
   */
  async trackApiUsage(modelId, usage) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId || !usage) {
      throw new Error('Model ID and usage information are required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Tracking API usage for model: ${modelId}`);
    
    try {
      // Track usage
      await this.apiServiceIntegration.trackUsage(modelId, usage);
      
      this.logger.debug(`[ModelOrchestrationSystem] API usage tracked for model: ${modelId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to track API usage for model ${modelId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get optimal quantization for model
   * @param {string} modelId - Unique identifier for the model
   * @returns {Promise<Object>} Optimal quantization options
   */
  async getOptimalQuantization(modelId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting optimal quantization for model: ${modelId}`);
    
    try {
      // Get model
      const model = this.modelRegistry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }
      
      // Get available resources
      const availableMemory = await this.resourceMonitor.getAvailableMemory();
      const availableCpu = await this.resourceMonitor.getAvailableCpu();
      const hasGpu = await this.resourceMonitor.hasGpu();
      
      // Get optimal quantization
      const quantization = await this.quantizationManager.getOptimalQuantization(
        model,
        availableMemory,
        availableCpu,
        hasGpu
      );
      
      this.logger.debug(`[ModelOrchestrationSystem] Optimal quantization for model ${modelId}: ${JSON.stringify(quantization)}`);
      return quantization;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get optimal quantization for model ${modelId}: ${error.message}`);
      return { precision: '8bit' }; // Default to 8-bit precision
    }
  }
  
  /**
   * Update user tier
   * @param {string} [tier] - New user tier (from ModelTier enum)
   * @returns {Promise<boolean>} Success status
   */
  async updateUserTier(tier) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (tier) {
      // Validate tier
      if (!Object.values(ModelTier).includes(tier)) {
        throw new Error(`Invalid tier: ${tier}`);
      }
      
      this.userTier = tier;
      this.logger.info(`[ModelOrchestrationSystem] User tier updated to: ${tier}`);
      return true;
    } else {
      // Get tier from admin panel
      return await this._updateUserTier();
    }
  }
  
  /**
   * Get system status
   * @returns {Promise<Object>} System status
   */
  async getStatus() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Get resource usage
      const memoryUsage = await this.resourceMonitor.getMemoryUsage();
      const cpuUsage = await this.resourceMonitor.getCpuUsage();
      const availableMemory = await this.resourceMonitor.getAvailableMemory();
      const availableCpu = await this.resourceMonitor.getAvailableCpu();
      const hasGpu = await this.resourceMonitor.hasGpu();
      const gpuUsage = hasGpu ? await this.resourceMonitor.getGpuUsage() : null;
      
      // Get loaded models
      const loadedModels = this.modelRegistry.getLoadedModels().map(model => ({
        id: model.modelId,
        name: model.modelName,
        type: model.modelType,
        tier: model.modelTier,
        memoryUsage: model.memoryUsage || 0,
        useApi: model.useApi || false
      }));
      
      // Get API status
      const apiStatus = await this.apiServiceIntegration.getStatus();
      
      return {
        initialized: this.initialized,
        userTier: this.userTier,
        resources: {
          memoryUsage,
          cpuUsage,
          availableMemory,
          availableCpu,
          hasGpu,
          gpuUsage
        },
        models: {
          total: this.modelRegistry.getAllModels().length,
          loaded: loadedModels.length,
          active: this.activeModels.size,
          loadedModels
        },
        api: apiStatus,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get status: ${error.message}`);
      return {
        initialized: this.initialized,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // ====================================================================
  // PRIVATE METHODS
  // ====================================================================
  
  /**
   * Update user tier from admin panel
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _updateUserTier() {
    try {
      // In a real implementation, this would retrieve the user tier
      // from the admin panel configuration
      
      // For simulation, check if the admin panel dependency is available
      if (!this.dependencies.adminPanel) {
        this.userTier = ModelTier.STANDARD;
        return true;
      }
      
      // Get user tier from admin panel
      const tier = await this.dependencies.adminPanel.getUserTier();
      
      // Validate tier
      if (!tier || !Object.values(ModelTier).includes(tier)) {
        this.userTier = ModelTier.STANDARD;
      } else {
        this.userTier = tier;
      }
      
      this.logger.info(`[ModelOrchestrationSystem] User tier set to: ${this.userTier}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to update user tier: ${error.message}`);
      this.userTier = ModelTier.STANDARD;
      return false;
    }
  }
  
  /**
   * Check if user has access to tier
   * @param {string} tier - Model tier (from ModelTier enum)
   * @returns {boolean} Whether user has access
   * @private
   */
  _hasAccessToTier(tier) {
    // Tier hierarchy: STANDARD < PRO < ENTERPRISE
    switch (this.userTier) {
      case ModelTier.ENTERPRISE:
        return true; // Enterprise has access to all tiers
      case ModelTier.PRO:
        return tier !== ModelTier.ENTERPRISE; // Pro has access to Pro and Standard
      case ModelTier.STANDARD:
        return tier === ModelTier.STANDARD; // Standard only has access to Standard
      default:
        return false;
    }
  }
  
  /**
   * Get optimal load options for model
   * @param {Object} model - Model adapter
   * @param {Object} [userOptions={}] - User-provided options
   * @returns {Promise<Object>} Optimal load options
   * @private
   */
  async _getOptimalLoadOptions(model, userOptions = {}) {
    try {
      // Start with user options
      const options = { ...userOptions };
      
      // Get optimal quantization if not specified
      if (!options.quantization) {
        const quantization = await this.getOptimalQuantization(model.modelId);
        options.quantization = quantization;
      }
      
      // Check if we should use API
      if (!options.useApi && model.hybridCapable) {
        // Check available resources
        const availableMemory = await this.resourceMonitor.getAvailableMemory();
        const requiredMemory = model.getRequiredMemory ? await model.getRequiredMemory(options) : 0;
        
        // If not enough memory, try to use API
        if (requiredMemory > availableMemory) {
          const isOnline = await this.apiServiceIntegration.isOnline();
          const apiAvailable = await this.apiServiceIntegration.isApiAvailableForModel(model.modelId);
          
          if (isOnline && apiAvailable) {
            options.useApi = true;
          }
        }
      }
      
      return options;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get optimal load options: ${error.message}`);
      return userOptions;
    }
  }
  
  /**
   * Get task key
   * @param {string} modelType - Model type (from ModelType enum)
   * @param {string} [taskType] - Specific task type
   * @returns {string} Task key
   * @private
   */
  _getTaskKey(modelType, taskType) {
    return taskType ? `${modelType}:${taskType}` : modelType;
  }
  
  /**
   * Track model usage
   * @param {string} modelId - Unique identifier for the model
   * @private
   */
  _trackModelUsage(modelId) {
    if (!modelId) {
      return;
    }
    
    // Increment usage count
    const currentCount = this.modelUsageStats.get(modelId) || 0;
    this.modelUsageStats.set(modelId, currentCount + 1);
  }
  
  /**
   * Check if model is in use
   * @param {string} modelId - Unique identifier for the model
   * @returns {boolean} Whether model is in use
   * @private
   */
  _isModelInUse(modelId) {
    if (!modelId) {
      return false;
    }
    
    // Check if model is in active models
    return Array.from(this.activeModels.values()).includes(modelId);
  }
}

module.exports = ModelOrchestrationSystem;
