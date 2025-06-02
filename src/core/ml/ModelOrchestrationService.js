/**
 * @fileoverview ModelOrchestrationService manages the dynamic loading, unloading, and selection
 * of ML models based on tasks, resource constraints, and performance requirements within Aideon Core.
 * 
 * @module core/ml/ModelOrchestrationService
 * @requires core/utils/Logger
 */

const { EventEmitter } = require('events');
const logger = require('../utils/Logger').getLogger('ModelOrchestrationService');

/**
 * @class ModelOrchestrationService
 * @extends EventEmitter
 * @description Service for orchestrating ML models based on tasks and resources
 */
class ModelOrchestrationService extends EventEmitter {
  /**
   * Creates an instance of ModelOrchestrationService
   * @param {Object} options - Configuration options
   * @param {Object} options.modelLoaderService - ModelLoaderService instance
   * @param {Object} options.modelRegistry - ModelRegistry instance
   * @param {Object} options.hardwareProfiler - HardwareProfiler instance
   * @param {number} options.maxConcurrentModels - Maximum number of models to load concurrently
   * @param {boolean} options.enableAutoUnload - Whether to automatically unload unused models
   * @param {number} options.autoUnloadTimeout - Time in milliseconds before unloading unused models
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      maxConcurrentModels: 2,
      enableAutoUnload: true,
      autoUnloadTimeout: 300000, // 5 minutes
      ...options
    };
    
    this.modelLoaderService = options.modelLoaderService;
    this.modelRegistry = options.modelRegistry || (options.modelLoaderService ? options.modelLoaderService.modelRegistry : null);
    this.hardwareProfiler = options.hardwareProfiler;
    
    this.taskModelMap = new Map(); // Maps task types to preferred models
    this.modelUsageStats = new Map(); // Tracks model usage statistics
    this.modelUnloadTimers = new Map(); // Timers for auto-unloading models
    this.modelLoadLocks = new Map(); // Locks for concurrent model loading
    this.activeModelTasks = new Map(); // Tracks active tasks per model
    
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.registerTaskModel = this.registerTaskModel.bind(this);
    this.selectModelForTask = this.selectModelForTask.bind(this);
    this.ensureModelLoaded = this.ensureModelLoaded.bind(this);
    this.recordModelUsage = this.recordModelUsage.bind(this);
    this.unloadUnusedModels = this.unloadUnusedModels.bind(this);
    this.getModelUsageStats = this.getModelUsageStats.bind(this);
    this.beginModelTask = this.beginModelTask.bind(this);
    this.endModelTask = this.endModelTask.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelOrchestrationService
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelOrchestrationService already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelOrchestrationService');
      
      // Validate dependencies
      if (!this.modelLoaderService) {
        throw new Error('ModelLoaderService is required');
      }
      
      if (!this.modelRegistry) {
        throw new Error('ModelRegistry is required');
      }
      
      // Set up default task-model mappings
      this.setupDefaultTaskModels();
      
      // Set up periodic check for unused models if auto-unload is enabled
      if (this.options.enableAutoUnload) {
        this.startAutoUnloadChecker();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelOrchestrationService initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelOrchestrationService: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Sets up default task-model mappings
   * @private
   */
  setupDefaultTaskModels() {
    logger.debug('Setting up default task-model mappings');
    
    // Text generation tasks
    this.registerTaskModel('text-generation', [
      { modelId: 'deepseek-v3', priority: 1, minAccuracy: 95.0 },
      { modelId: 'llama3-70b', priority: 2, minAccuracy: 94.0 },
      { modelId: 'mixtral-8x22b', priority: 3, minAccuracy: 93.8 }
    ]);
    
    // Reasoning tasks
    this.registerTaskModel('reasoning', [
      { modelId: 'deepseek-v3', priority: 1, minAccuracy: 95.0 },
      { modelId: 'llama3-70b', priority: 2, minAccuracy: 94.0 }
    ]);
    
    // Code generation tasks
    this.registerTaskModel('code-generation', [
      { modelId: 'deepseek-v3', priority: 1, minAccuracy: 95.0 },
      { modelId: 'llama3-70b', priority: 2, minAccuracy: 94.0 }
    ]);
    
    // Conversation tasks
    this.registerTaskModel('conversation', [
      { modelId: 'llama3-70b', priority: 1, minAccuracy: 94.0 },
      { modelId: 'mixtral-8x22b', priority: 2, minAccuracy: 93.8 }
    ]);
    
    // Summarization tasks
    this.registerTaskModel('summarization', [
      { modelId: 'llama3-70b', priority: 1, minAccuracy: 94.0 },
      { modelId: 'mixtral-8x22b', priority: 2, minAccuracy: 93.8 }
    ]);
    
    // Classification tasks
    this.registerTaskModel('classification', [
      { modelId: 'roberta-xl', priority: 1, minAccuracy: 93.9 },
      { modelId: 'llama3-70b', priority: 2, minAccuracy: 94.0 }
    ]);
    
    logger.debug('Default task-model mappings set up successfully');
  }
  
  /**
   * Starts the auto-unload checker
   * @private
   */
  startAutoUnloadChecker() {
    // Check for unused models every minute
    const checkInterval = Math.min(60000, this.options.autoUnloadTimeout / 2);
    
    this.autoUnloadCheckerId = setInterval(() => {
      this.checkAndUnloadUnusedModels()
        .catch(error => {
          logger.error(`Error in auto-unload checker: ${error.message}`, error);
        });
    }, checkInterval);
    
    logger.debug(`Auto-unload checker started with interval ${checkInterval}ms`);
  }
  
  /**
   * Checks and unloads unused models
   * @async
   * @private
   */
  async checkAndUnloadUnusedModels() {
    try {
      const now = Date.now();
      const unloadThreshold = this.options.autoUnloadTimeout;
      
      // Get loaded models
      const loadedModels = await this.modelRegistry.getLoadedModels();
      
      for (const model of loadedModels) {
        // Skip models with active tasks
        const activeTasks = this.activeModelTasks.get(model.id) || 0;
        if (activeTasks > 0) {
          continue;
        }
        
        // Check last usage time
        const stats = this.modelUsageStats.get(model.id);
        if (stats && (now - stats.lastUsed) > unloadThreshold) {
          logger.info(`Auto-unloading unused model: ${model.id}`);
          
          try {
            await this.modelLoaderService.unloadModel(model.id);
            
            // Clear any unload timer
            if (this.modelUnloadTimers.has(model.id)) {
              clearTimeout(this.modelUnloadTimers.get(model.id));
              this.modelUnloadTimers.delete(model.id);
            }
          } catch (error) {
            logger.error(`Failed to auto-unload model ${model.id}: ${error.message}`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking for unused models: ${error.message}`, error);
    }
  }
  
  /**
   * Registers a model for a specific task type
   * @param {string} taskType - Type of task
   * @param {Array<Object>|Object} modelConfig - Model configuration(s)
   * @param {string} modelConfig.modelId - Model ID
   * @param {number} modelConfig.priority - Priority (lower is higher priority)
   * @param {number} modelConfig.minAccuracy - Minimum accuracy required
   * @param {Object} modelConfig.requirements - Hardware requirements
   */
  registerTaskModel(taskType, modelConfig) {
    if (!taskType) {
      throw new Error('Task type is required');
    }
    
    if (!modelConfig) {
      throw new Error('Model configuration is required');
    }
    
    logger.debug(`Registering model(s) for task type: ${taskType}`);
    
    // Convert single model config to array
    const modelConfigs = Array.isArray(modelConfig) ? modelConfig : [modelConfig];
    
    // Validate model configs
    for (const config of modelConfigs) {
      if (!config.modelId) {
        throw new Error('Model ID is required in model configuration');
      }
    }
    
    // Sort by priority
    const sortedConfigs = [...modelConfigs].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    
    // Store in task-model map
    this.taskModelMap.set(taskType, sortedConfigs);
    
    logger.debug(`Registered ${sortedConfigs.length} model(s) for task type: ${taskType}`);
    
    this.emit('taskModelRegistered', taskType, sortedConfigs);
  }
  
  /**
   * Selects the best model for a specific task
   * @async
   * @param {string} taskType - Type of task
   * @param {Object} options - Selection options
   * @param {number} options.minAccuracy - Minimum accuracy required
   * @param {boolean} options.offlineOnly - Whether to only consider models that work offline
   * @param {Object} options.hardwareConstraints - Hardware constraints
   * @returns {Promise<Object>} Selected model
   */
  async selectModelForTask(taskType, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ModelOrchestrationService not initialized');
    }
    
    if (!taskType) {
      throw new Error('Task type is required');
    }
    
    try {
      logger.debug(`Selecting model for task type: ${taskType}`);
      
      // Get models for task type
      const taskModels = this.taskModelMap.get(taskType) || [];
      
      if (taskModels.length === 0) {
        logger.warn(`No models registered for task type: ${taskType}`);
        return null;
      }
      
      // Get hardware profile if available
      const hwProfile = this.hardwareProfiler ? this.hardwareProfiler.getProfile() : null;
      
      // Filter models based on options
      let candidateModels = [...taskModels];
      
      // Filter by minimum accuracy
      if (options.minAccuracy) {
        candidateModels = candidateModels.filter(model => {
          // Get model metadata
          const metadata = this.modelRegistry.getModelMetadata(model.modelId);
          return metadata && metadata.accuracy >= options.minAccuracy;
        });
      }
      
      // Filter by offline capability if required
      if (options.offlineOnly) {
        candidateModels = candidateModels.filter(model => {
          // Get model metadata
          const metadata = this.modelRegistry.getModelMetadata(model.modelId);
          return metadata && metadata.offlineCapable !== false;
        });
      }
      
      // Filter by hardware constraints
      if (options.hardwareConstraints || hwProfile) {
        candidateModels = candidateModels.filter(model => {
          // Get model metadata
          const metadata = this.modelRegistry.getModelMetadata(model.modelId);
          
          if (!metadata) {
            return false;
          }
          
          // Check hardware requirements
          const requirements = model.requirements || metadata.requirements || {};
          
          // Check memory requirements
          if (hwProfile && hwProfile.memory && requirements.memory) {
            if (hwProfile.memory.available < requirements.memory) {
              return false;
            }
          }
          
          // Check GPU requirements
          if (hwProfile && hwProfile.gpu && requirements.gpu) {
            if (requirements.gpu.required && !hwProfile.gpu.available) {
              return false;
            }
          }
          
          return true;
        });
      }
      
      // Prioritize models that are already loaded
      const loadedModels = await this.modelRegistry.getLoadedModels();
      const loadedModelIds = new Set(loadedModels.map(m => m.id));
      
      candidateModels.sort((a, b) => {
        // First sort by loaded status
        const aLoaded = loadedModelIds.has(a.modelId) ? 0 : 1;
        const bLoaded = loadedModelIds.has(b.modelId) ? 0 : 1;
        
        if (aLoaded !== bLoaded) {
          return aLoaded - bLoaded;
        }
        
        // Then by priority
        return (a.priority || 0) - (b.priority || 0);
      });
      
      if (candidateModels.length === 0) {
        logger.warn(`No suitable models found for task type: ${taskType}`);
        return null;
      }
      
      // Select highest priority model
      const selectedModel = candidateModels[0];
      
      logger.debug(`Selected model ${selectedModel.modelId} for task type: ${taskType}`);
      
      // Get full model metadata
      const modelMetadata = this.modelRegistry.getModelMetadata(selectedModel.modelId);
      
      return {
        ...selectedModel,
        metadata: modelMetadata
      };
    } catch (error) {
      logger.error(`Failed to select model for task: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Ensures a model is loaded for a specific task
   * @async
   * @param {string} taskType - Type of task
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Loaded model instance
   */
  async ensureModelLoaded(taskType, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ModelOrchestrationService not initialized');
    }
    
    try {
      logger.debug(`Ensuring model is loaded for task type: ${taskType}`);
      
      // Select model for task
      const selectedModel = await this.selectModelForTask(taskType, options);
      
      if (!selectedModel) {
        throw new Error(`No suitable model found for task type: ${taskType}`);
      }
      
      const modelId = selectedModel.modelId;
      
      // Check if model is already loaded
      const modelInfo = await this.modelRegistry.getModel(modelId);
      
      if (modelInfo && modelInfo.status === 'loaded') {
        logger.debug(`Model ${modelId} already loaded for task type: ${taskType}`);
        
        // Record model usage
        this.recordModelUsage(modelId);
        
        return modelInfo.instance;
      }
      
      // Check if model is currently being loaded by another request
      if (this.modelLoadLocks.has(modelId)) {
        logger.debug(`Model ${modelId} is already being loaded, waiting for completion`);
        
        // Wait for the existing load operation to complete
        return await this.modelLoadLocks.get(modelId);
      }
      
      // Create a promise for this load operation
      let resolveLoadPromise, rejectLoadPromise;
      const loadPromise = new Promise((resolve, reject) => {
        resolveLoadPromise = resolve;
        rejectLoadPromise = reject;
      });
      
      // Set the load lock
      this.modelLoadLocks.set(modelId, loadPromise);
      
      try {
        // Check if we need to unload other models
        await this.manageLoadedModels(modelId);
        
        // Load the model
        logger.info(`Loading model ${modelId} for task type: ${taskType}`);
        
        const modelInstance = await this.modelLoaderService.loadModel(modelId, options);
        
        // Record model usage
        this.recordModelUsage(modelId);
        
        logger.debug(`Model ${modelId} loaded successfully for task type: ${taskType}`);
        
        // Resolve the load promise
        resolveLoadPromise(modelInstance);
        
        return modelInstance;
      } catch (error) {
        // Reject the load promise
        rejectLoadPromise(error);
        throw error;
      } finally {
        // Remove the load lock
        this.modelLoadLocks.delete(modelId);
      }
    } catch (error) {
      logger.error(`Failed to ensure model loaded: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Begins a task using a specific model
   * @param {string} modelId - Model ID
   * @param {string} taskId - Task ID
   * @returns {boolean} Success status
   */
  beginModelTask(modelId, taskId) {
    if (!modelId || !taskId) {
      return false;
    }
    
    logger.debug(`Beginning task ${taskId} with model ${modelId}`);
    
    // Record model usage
    this.recordModelUsage(modelId);
    
    // Increment active task count
    const activeTasks = this.activeModelTasks.get(modelId) || 0;
    this.activeModelTasks.set(modelId, activeTasks + 1);
    
    return true;
  }
  
  /**
   * Ends a task using a specific model
   * @param {string} modelId - Model ID
   * @param {string} taskId - Task ID
   * @returns {boolean} Success status
   */
  endModelTask(modelId, taskId) {
    if (!modelId || !taskId) {
      return false;
    }
    
    logger.debug(`Ending task ${taskId} with model ${modelId}`);
    
    // Decrement active task count
    const activeTasks = this.activeModelTasks.get(modelId) || 0;
    
    if (activeTasks > 0) {
      this.activeModelTasks.set(modelId, activeTasks - 1);
    }
    
    return true;
  }
  
  /**
   * Manages loaded models to ensure resource constraints are met
   * @async
   * @private
   * @param {string} modelIdToLoad - ID of model to load
   * @returns {Promise<boolean>} Management success status
   */
  async manageLoadedModels(modelIdToLoad) {
    try {
      // Get currently loaded models
      const loadedModels = await this.modelRegistry.getLoadedModels();
      
      // If we're under the limit, no need to unload
      if (loadedModels.length < this.options.maxConcurrentModels) {
        return true;
      }
      
      // Get usage stats for loaded models
      const usageStats = this.getModelUsageStats();
      
      // Filter out models with active tasks
      const unloadableModels = loadedModels.filter(model => {
        const activeTasks = this.activeModelTasks.get(model.id) || 0;
        return activeTasks === 0;
      });
      
      // If no unloadable models, we can't free up space
      if (unloadableModels.length === 0) {
        logger.warn(`Cannot unload any models to make room for ${modelIdToLoad}, all models have active tasks`);
        return false;
      }
      
      // Sort unloadable models by last used time (oldest first)
      const sortedModels = unloadableModels.sort((a, b) => {
        const aStats = usageStats.get(a.id) || { lastUsed: 0 };
        const bStats = usageStats.get(b.id) || { lastUsed: 0 };
        return aStats.lastUsed - bStats.lastUsed;
      });
      
      // Unload oldest model
      const oldestModel = sortedModels[0];
      
      logger.info(`Unloading model ${oldestModel.id} to make room for ${modelIdToLoad}`);
      
      await this.modelLoaderService.unloadModel(oldestModel.id);
      
      // Clear any unload timer
      if (this.modelUnloadTimers.has(oldestModel.id)) {
        clearTimeout(this.modelUnloadTimers.get(oldestModel.id));
        this.modelUnloadTimers.delete(oldestModel.id);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to manage loaded models: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Records usage of a model
   * @param {string} modelId - Model ID
   */
  recordModelUsage(modelId) {
    if (!modelId) {
      return;
    }
    
    // Get current stats or initialize
    const stats = this.modelUsageStats.get(modelId) || {
      usageCount: 0,
      lastUsed: 0
    };
    
    // Update stats
    stats.usageCount += 1;
    stats.lastUsed = Date.now();
    
    // Store updated stats
    this.modelUsageStats.set(modelId, stats);
    
    // Clear any existing unload timer
    if (this.modelUnloadTimers.has(modelId)) {
      clearTimeout(this.modelUnloadTimers.get(modelId));
      this.modelUnloadTimers.delete(modelId);
    }
  }
  
  /**
   * Unloads models that haven't been used recently
   * @async
   * @param {number} unusedThreshold - Time threshold in milliseconds
   * @returns {Promise<Array<string>>} IDs of unloaded models
   */
  async unloadUnusedModels(unusedThreshold = 600000) { // Default: 10 minutes
    if (!this.isInitialized) {
      throw new Error('ModelOrchestrationService not initialized');
    }
    
    try {
      logger.debug(`Unloading models unused for ${unusedThreshold}ms`);
      
      // Get currently loaded models
      const loadedModels = await this.modelRegistry.getLoadedModels();
      
      if (loadedModels.length === 0) {
        return [];
      }
      
      const now = Date.now();
      const unloadedModels = [];
      
      // Check each loaded model
      for (const model of loadedModels) {
        // Skip models with active tasks
        const activeTasks = this.activeModelTasks.get(model.id) || 0;
        if (activeTasks > 0) {
          logger.debug(`Skipping unload of model ${model.id} with ${activeTasks} active tasks`);
          continue;
        }
        
        const stats = this.modelUsageStats.get(model.id);
        
        // If no stats or last used time exceeds threshold, unload
        if (!stats || (now - stats.lastUsed) > unusedThreshold) {
          logger.info(`Unloading unused model: ${model.id}`);
          
          try {
            await this.modelLoaderService.unloadModel(model.id);
            unloadedModels.push(model.id);
            
            // Clear any unload timer
            if (this.modelUnloadTimers.has(model.id)) {
              clearTimeout(this.modelUnloadTimers.get(model.id));
              this.modelUnloadTimers.delete(model.id);
            }
          } catch (error) {
            logger.error(`Failed to unload model ${model.id}: ${error.message}`, error);
          }
        }
      }
      
      return unloadedModels;
    } catch (error) {
      logger.error(`Failed to unload unused models: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets model usage statistics
   * @returns {Map<string, Object>} Model usage statistics
   */
  getModelUsageStats() {
    return new Map(this.modelUsageStats);
  }
  
  /**
   * Shuts down the ModelOrchestrationService
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelOrchestrationService not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ModelOrchestrationService');
      
      // Clear all unload timers
      for (const [modelId, timer] of this.modelUnloadTimers.entries()) {
        clearTimeout(timer);
      }
      this.modelUnloadTimers.clear();
      
      // Clear auto-unload checker
      if (this.autoUnloadCheckerId) {
        clearInterval(this.autoUnloadCheckerId);
        this.autoUnloadCheckerId = null;
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelOrchestrationService shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelOrchestrationService shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelOrchestrationService;
