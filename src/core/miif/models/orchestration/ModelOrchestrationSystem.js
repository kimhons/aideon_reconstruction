/**
 * @fileoverview Enhanced Model Orchestration System for Aideon Core
 * Provides centralized management and orchestration of all ML models
 * with support for collaborative and specialized multi-LLM strategies
 * 
 * @module src/core/miif/models/orchestration/ModelOrchestrationSystem
 */

const { ModelRegistry } = require('../ModelRegistry');
const { ModelType, ModelTier, ModelSelectionStrategy, CollaborationStrategy } = require('../ModelEnums');
const { ResourceMonitor } = require('./ResourceMonitor');
const { QuantizationManager } = require('./QuantizationManager');
const { ApiServiceIntegration } = require('./ApiServiceIntegration');
const { CollaborativeModelOrchestrator } = require('./CollaborativeModelOrchestrator');
const { SpecializedModelSelector } = require('./SpecializedModelSelector');
const path = require('path');
const os = require('os');

/**
 * Enhanced Model Orchestration System
 * Manages dynamic loading, unloading, and selection of models based on tasks and resources
 * Supports collaborative and specialized multi-LLM strategies in both online and offline modes
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
    
    // Initialize enhanced orchestration components
    this.collaborativeOrchestrator = new CollaborativeModelOrchestrator(options, {
      ...dependencies,
      modelOrchestrationSystem: this,
      modelRegistry: this.modelRegistry
    });
    
    this.specializedSelector = new SpecializedModelSelector(options, {
      ...dependencies,
      modelRegistry: this.modelRegistry,
      resourceMonitor: this.resourceMonitor
    });
    
    // Initialize state
    this.initialized = false;
    this.activeModels = new Map();
    this.modelUsageStats = new Map();
    this.collaborationSessions = new Map();
    this.userTier = ModelTier.STANDARD; // Default to standard tier
    
    this.logger.info(`[ModelOrchestrationSystem] Initialized with collaborative and specialized capabilities`);
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
    
    this.logger.info(`[ModelOrchestrationSystem] Initializing enhanced orchestration system`);
    
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
      
      // Initialize enhanced orchestration components
      await this.collaborativeOrchestrator.initialize();
      await this.specializedSelector.initialize();
      
      // Get user tier from admin panel
      await this._updateUserTier();
      
      this.initialized = true;
      this.logger.info(`[ModelOrchestrationSystem] Enhanced initialization complete`);
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
    
    this.logger.info(`[ModelOrchestrationSystem] Shutting down enhanced orchestration system`);
    
    try {
      // Unload all active models
      await this.unloadAllModels();
      
      // Close all collaboration sessions
      for (const sessionId of this.collaborationSessions.keys()) {
        await this.closeCollaborationSession(sessionId);
      }
      
      // Shutdown components
      await this.resourceMonitor.shutdown();
      await this.quantizationManager.shutdown();
      await this.apiServiceIntegration.shutdown();
      
      this.initialized = false;
      this.logger.info(`[ModelOrchestrationSystem] Enhanced shutdown complete`);
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
   * @param {Object} [params.taskInput] - Task input for analysis
   * @param {number} [params.minAccuracy] - Minimum accuracy threshold
   * @param {boolean} [params.offlineOnly] - Whether to only consider models that work offline
   * @param {boolean} [params.preferApi] - Whether to prefer API-based models when online
   * @param {string} [params.selectionStrategy] - Model selection strategy
   * @param {boolean} [params.autoLoad=true] - Whether to automatically load the model if not loaded
   * @returns {Promise<Object|null>} Model adapter or null if none found
   */
  async getModelForTask(params) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const {
      modelType,
      taskType,
      taskInput,
      minAccuracy,
      offlineOnly,
      preferApi,
      selectionStrategy = ModelSelectionStrategy.SPECIALIZED,
      autoLoad = true
    } = params;
    
    if (!modelType) {
      throw new Error('Model type is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting model for task: ${modelType}/${taskType || 'general'} using strategy: ${selectionStrategy}`);
    
    try {
      // Check if we have a cached model for this task
      const taskKey = this._getTaskKey(modelType, taskType, selectionStrategy);
      if (this.activeModels.has(taskKey)) {
        const modelId = this.activeModels.get(taskKey);
        const model = this.modelRegistry.getModel(modelId);
        
        if (model && this.modelRegistry.isModelLoaded(modelId)) {
          this.logger.debug(`[ModelOrchestrationSystem] Using cached model for task: ${modelId}`);
          return model;
        }
      }
      
      // Select model based on strategy
      let model;
      
      if (selectionStrategy === ModelSelectionStrategy.SPECIALIZED) {
        // Use specialized selector
        model = await this.specializedSelector.selectBestModelForTask({
          modelType,
          taskType,
          taskInput,
          selectionStrategy,
          offlineOnly: offlineOnly || false,
          maxTier: this.userTier
        });
      } else {
        // Use standard selection
        model = this.modelRegistry.getBestModelForTask({
          modelType,
          taskType,
          tier: this.userTier,
          minAccuracy,
          offlineOnly,
          preferApi
        });
      }
      
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
   * Get model by ID
   * @param {string} modelId - Model ID
   * @param {Object} [options] - Options
   * @param {boolean} [options.autoLoad=false] - Whether to automatically load the model if not loaded
   * @returns {Promise<Object|null>} Model adapter or null if not found
   */
  async getModelById(modelId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Getting model by ID: ${modelId}`);
    
    try {
      // Get model
      const model = this.modelRegistry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }
      
      // Load model if not loaded and autoLoad is true
      if (options.autoLoad && !model.isLoaded) {
        const loadOptions = await this._getOptimalLoadOptions(model);
        await model.load(loadOptions);
        
        // Track model load status
        this.modelRegistry.trackModelLoadStatus(modelId, true);
      }
      
      // Track model usage
      this._trackModelUsage(modelId);
      
      return model;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get model by ID: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Create a collaboration session
   * @param {Object} params - Session parameters
   * @param {string} [params.sessionId] - Optional session ID (generated if not provided)
   * @param {string} params.modelType - Model type (from ModelType enum)
   * @param {string} [params.taskType] - Specific task type
   * @param {string} [params.collaborationStrategy] - Collaboration strategy to use
   * @param {boolean} [params.offlineOnly] - Whether to only use models that work offline
   * @returns {Promise<string>} Session ID
   */
  async createCollaborationSession(params) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const {
      sessionId = `collab_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      modelType,
      taskType,
      collaborationStrategy = CollaborationStrategy.ENSEMBLE,
      offlineOnly = false
    } = params;
    
    if (!modelType) {
      throw new Error('Model type is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Creating collaboration session: ${sessionId}`);
    
    try {
      // Create session using collaborative orchestrator
      const createdSessionId = await this.collaborativeOrchestrator.createCollaborationSession({
        sessionId,
        modelType,
        taskType,
        collaborationStrategy,
        offlineOnly
      });
      
      // Track session
      this.collaborationSessions.set(createdSessionId, {
        created: Date.now(),
        lastUsed: Date.now()
      });
      
      this.logger.debug(`[ModelOrchestrationSystem] Collaboration session created: ${createdSessionId}`);
      return createdSessionId;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to create collaboration session: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute a task using collaborative models
   * @param {Object} params - Task parameters
   * @param {string} params.sessionId - Collaboration session ID
   * @param {Object} params.input - Task input
   * @param {Object} [params.options] - Execution options
   * @returns {Promise<Object>} Task result
   */
  async executeCollaborativeTask(params) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const { sessionId, input, options = {} } = params;
    
    if (!sessionId || !input) {
      throw new Error('Session ID and input are required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Executing collaborative task for session: ${sessionId}`);
    
    try {
      // Check if session exists
      if (!this.collaborationSessions.has(sessionId)) {
        throw new Error(`Collaboration session not found: ${sessionId}`);
      }
      
      // Update last used timestamp
      this.collaborationSessions.get(sessionId).lastUsed = Date.now();
      
      // Execute task using collaborative orchestrator
      const result = await this.collaborativeOrchestrator.executeCollaborativeTask({
        sessionId,
        input,
        options
      });
      
      this.logger.debug(`[ModelOrchestrationSystem] Collaborative task executed for session: ${sessionId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to execute collaborative task: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Close a collaboration session
   * @param {string} sessionId - Collaboration session ID
   * @returns {Promise<boolean>} Success status
   */
  async closeCollaborationSession(sessionId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Closing collaboration session: ${sessionId}`);
    
    try {
      // Check if session exists
      if (!this.collaborationSessions.has(sessionId)) {
        this.logger.warn(`[ModelOrchestrationSystem] Collaboration session not found: ${sessionId}`);
        return false;
      }
      
      // Close session using collaborative orchestrator
      const success = await this.collaborativeOrchestrator.closeCollaborationSession(sessionId);
      
      if (success) {
        // Remove from tracked sessions
        this.collaborationSessions.delete(sessionId);
      }
      
      this.logger.debug(`[ModelOrchestrationSystem] Collaboration session closed: ${sessionId}`);
      return success;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to close collaboration session: ${error.message}`);
      return false;
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
      const quantization = await this.quantizationManager.getOptimalQuantization({
        model,
        availableMemory,
        availableCpu,
        hasGpu
      });
      
      this.logger.debug(`[ModelOrchestrationSystem] Optimal quantization for model ${modelId}: ${JSON.stringify(quantization)}`);
      return quantization;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to get optimal quantization for model ${modelId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Record model performance
   * @param {string} modelId - Model ID
   * @param {Object} performance - Performance metrics
   * @returns {Promise<boolean>} Success status
   */
  async recordModelPerformance(modelId, performance) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!modelId || !performance) {
      throw new Error('Model ID and performance metrics are required');
    }
    
    this.logger.debug(`[ModelOrchestrationSystem] Recording performance for model: ${modelId}`);
    
    try {
      // Record in specialized selector
      await this.specializedSelector.recordModelPerformance(modelId, performance);
      
      this.logger.debug(`[ModelOrchestrationSystem] Performance recorded for model: ${modelId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to record model performance: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get task key
   * @private
   * @param {string} modelType - Model type
   * @param {string} taskType - Task type
   * @param {string} strategy - Selection strategy
   * @returns {string} Task key
   */
  _getTaskKey(modelType, taskType, strategy) {
    return `${modelType}_${taskType || 'general'}_${strategy || 'default'}`;
  }
  
  /**
   * Track model usage
   * @private
   * @param {string} modelId - Model ID
   */
  _trackModelUsage(modelId) {
    const count = this.modelUsageStats.get(modelId) || 0;
    this.modelUsageStats.set(modelId, count + 1);
  }
  
  /**
   * Check if model is in use
   * @private
   * @param {string} modelId - Model ID
   * @returns {boolean} Whether the model is in use
   */
  _isModelInUse(modelId) {
    // Check if model is in active models
    for (const activeModelId of this.activeModels.values()) {
      if (activeModelId === modelId) {
        return true;
      }
    }
    
    // Check if model is in collaboration sessions
    for (const sessionId of this.collaborationSessions.keys()) {
      const session = this.collaborativeOrchestrator.getSession(sessionId);
      if (session && session.models.includes(modelId)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get optimal load options for model
   * @private
   * @param {Object} model - Model
   * @param {Object} [options] - User-provided options
   * @returns {Promise<Object>} Load options
   */
  async _getOptimalLoadOptions(model, options = {}) {
    // Get available resources
    const availableMemory = await this.resourceMonitor.getAvailableMemory();
    const availableCpu = await this.resourceMonitor.getAvailableCpu();
    const hasGpu = await this.resourceMonitor.hasGpu();
    
    // Get optimal quantization
    const quantization = await this.quantizationManager.getOptimalQuantization({
      model,
      availableMemory,
      availableCpu,
      hasGpu
    });
    
    // Merge with user options
    return {
      ...quantization,
      ...options
    };
  }
  
  /**
   * Update user tier
   * @private
   * @returns {Promise<void>}
   */
  async _updateUserTier() {
    try {
      // Get user tier from admin panel
      const adminPanel = this.dependencies.adminPanel;
      if (adminPanel) {
        const userSettings = await adminPanel.getUserSettings();
        this.userTier = userSettings.tier || ModelTier.STANDARD;
      }
    } catch (error) {
      this.logger.error(`[ModelOrchestrationSystem] Failed to update user tier: ${error.message}`);
      // Default to standard tier
      this.userTier = ModelTier.STANDARD;
    }
  }
  
  /**
   * Check if user has access to tier
   * @private
   * @param {string} tier - Model tier
   * @returns {boolean} Whether user has access
   */
  _hasAccessToTier(tier) {
    const tierValues = {
      [ModelTier.STANDARD]: 1,
      [ModelTier.PRO]: 2,
      [ModelTier.ENTERPRISE]: 3
    };
    
    const userTierValue = tierValues[this.userTier] || 1;
    const modelTierValue = tierValues[tier] || 3;
    
    return userTierValue >= modelTierValue;
  }
}

module.exports = { ModelOrchestrationSystem };
