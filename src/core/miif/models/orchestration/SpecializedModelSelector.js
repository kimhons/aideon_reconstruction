/**
 * @fileoverview Specialized Model Selector for Aideon Core
 * Enables intelligent selection of models based on specialized capabilities
 * 
 * @module src/core/miif/models/orchestration/SpecializedModelSelector
 */

const { ModelType, ModelTier, ModelSelectionStrategy } = require('../ModelEnums');

/**
 * Specialized Model Selector
 * Manages intelligent selection of models based on specialized capabilities
 */
class SpecializedModelSelector {
  /**
   * Create a new Specialized Model Selector
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.modelRegistry = dependencies.modelRegistry;
    this.resourceMonitor = dependencies.resourceMonitor;
    
    // Initialize state
    this.initialized = false;
    this.modelCapabilityProfiles = new Map();
    this.taskCharacteristicsCache = new Map();
    this.modelPerformanceHistory = new Map();
    
    this.logger.info(`[SpecializedModelSelector] Initialized`);
  }
  
  /**
   * Initialize the specialized model selector
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info(`[SpecializedModelSelector] Already initialized`);
      return true;
    }
    
    this.logger.info(`[SpecializedModelSelector] Initializing`);
    
    try {
      // Build model capability profiles
      await this._buildModelCapabilityProfiles();
      
      this.initialized = true;
      this.logger.info(`[SpecializedModelSelector] Initialization complete`);
      return true;
      
    } catch (error) {
      this.logger.error(`[SpecializedModelSelector] Initialization failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Select best model for task
   * @param {Object} params - Selection parameters
   * @param {string} params.modelType - Model type (from ModelType enum)
   * @param {string} [params.taskType] - Specific task type
   * @param {Object} [params.taskInput] - Task input for analysis
   * @param {string} [params.selectionStrategy=ModelSelectionStrategy.SPECIALIZED] - Model selection strategy
   * @param {boolean} [params.offlineOnly=false] - Whether to only consider models that work offline
   * @param {ModelTier} [params.maxTier=ModelTier.ENTERPRISE] - Maximum model tier to consider
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async selectBestModelForTask(params) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const {
      modelType,
      taskType,
      taskInput,
      selectionStrategy = ModelSelectionStrategy.SPECIALIZED,
      offlineOnly = false,
      maxTier = ModelTier.ENTERPRISE
    } = params;
    
    if (!modelType) {
      throw new Error('Model type is required');
    }
    
    this.logger.debug(`[SpecializedModelSelector] Selecting best model for task: ${modelType}/${taskType || 'general'}`);
    
    try {
      // Get all available models of the specified type
      const allModels = await this.modelRegistry.getModelsByType(modelType);
      
      // Filter models based on parameters
      let eligibleModels = allModels.filter(model => {
        // Filter by offline capability if required
        if (offlineOnly && !model.offlineCapable) {
          return false;
        }
        
        // Filter by task type if specified
        if (taskType && !model.supportedTasks.includes(taskType)) {
          return false;
        }
        
        // Filter by tier
        if (!this._isTierEligible(model.modelTier, maxTier)) {
          return false;
        }
        
        return true;
      });
      
      if (eligibleModels.length === 0) {
        this.logger.warn(`[SpecializedModelSelector] No eligible models found for task: ${modelType}/${taskType || 'general'}`);
        return null;
      }
      
      // Select model based on strategy
      let selectedModel;
      switch (selectionStrategy) {
        case ModelSelectionStrategy.HIGHEST_ACCURACY:
          selectedModel = await this._selectHighestAccuracyModel(eligibleModels);
          break;
        case ModelSelectionStrategy.LOWEST_LATENCY:
          selectedModel = await this._selectLowestLatencyModel(eligibleModels);
          break;
        case ModelSelectionStrategy.LOWEST_RESOURCE_USAGE:
          selectedModel = await this._selectLowestResourceUsageModel(eligibleModels);
          break;
        case ModelSelectionStrategy.BALANCED:
          selectedModel = await this._selectBalancedModel(eligibleModels);
          break;
        case ModelSelectionStrategy.SPECIALIZED:
          selectedModel = await this._selectSpecializedModel(eligibleModels, taskType, taskInput);
          break;
        default:
          // Default to highest accuracy
          selectedModel = await this._selectHighestAccuracyModel(eligibleModels);
      }
      
      if (!selectedModel) {
        this.logger.warn(`[SpecializedModelSelector] Failed to select model using strategy: ${selectionStrategy}`);
        // Fall back to highest accuracy
        selectedModel = await this._selectHighestAccuracyModel(eligibleModels);
      }
      
      this.logger.debug(`[SpecializedModelSelector] Selected model: ${selectedModel?.modelId}`);
      return selectedModel;
      
    } catch (error) {
      this.logger.error(`[SpecializedModelSelector] Failed to select best model: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Record model performance
   * @param {string} modelId - Model ID
   * @param {Object} performance - Performance metrics
   * @returns {Promise<boolean>} Success status
   */
  async recordModelPerformance(modelId, performance) {
    if (!modelId || !performance) {
      throw new Error('Model ID and performance metrics are required');
    }
    
    this.logger.debug(`[SpecializedModelSelector] Recording performance for model: ${modelId}`);
    
    try {
      // Get existing history
      let history = this.modelPerformanceHistory.get(modelId) || [];
      
      // Add new performance record
      history.push({
        ...performance,
        timestamp: Date.now()
      });
      
      // Keep only the last 100 records
      if (history.length > 100) {
        history = history.slice(-100);
      }
      
      // Update history
      this.modelPerformanceHistory.set(modelId, history);
      
      this.logger.debug(`[SpecializedModelSelector] Performance recorded for model: ${modelId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[SpecializedModelSelector] Failed to record model performance: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get model capability profile
   * @param {string} modelId - Model ID
   * @returns {Object|null} Capability profile or null if not found
   */
  getModelCapabilityProfile(modelId) {
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    return this.modelCapabilityProfiles.get(modelId) || null;
  }
  
  /**
   * Select highest accuracy model
   * @private
   * @param {Array<Object>} models - Eligible models
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async _selectHighestAccuracyModel(models) {
    if (models.length === 0) {
      return null;
    }
    
    // Sort by accuracy (highest first)
    models.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
    
    return models[0];
  }
  
  /**
   * Select lowest latency model
   * @private
   * @param {Array<Object>} models - Eligible models
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async _selectLowestLatencyModel(models) {
    if (models.length === 0) {
      return null;
    }
    
    // Calculate average latency for each model
    const modelLatencies = models.map(model => {
      const history = this.modelPerformanceHistory.get(model.modelId) || [];
      const latencies = history.map(record => record.latency).filter(latency => latency !== undefined);
      
      const avgLatency = latencies.length > 0
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : Infinity;
      
      return {
        model,
        avgLatency
      };
    });
    
    // Sort by average latency (lowest first)
    modelLatencies.sort((a, b) => a.avgLatency - b.avgLatency);
    
    // If no latency data, fall back to highest accuracy
    if (modelLatencies[0].avgLatency === Infinity) {
      return this._selectHighestAccuracyModel(models);
    }
    
    return modelLatencies[0].model;
  }
  
  /**
   * Select lowest resource usage model
   * @private
   * @param {Array<Object>} models - Eligible models
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async _selectLowestResourceUsageModel(models) {
    if (models.length === 0) {
      return null;
    }
    
    // Get available resources
    const availableMemory = await this.resourceMonitor.getAvailableMemory();
    
    // Filter models that fit in available memory
    const eligibleModels = models.filter(model => {
      const memoryUsage = model.memoryUsage || 0;
      return memoryUsage <= availableMemory;
    });
    
    if (eligibleModels.length === 0) {
      // If no models fit, select the smallest one
      models.sort((a, b) => (a.memoryUsage || 0) - (b.memoryUsage || 0));
      return models[0];
    }
    
    // Sort by memory usage (lowest first)
    eligibleModels.sort((a, b) => (a.memoryUsage || 0) - (b.memoryUsage || 0));
    
    return eligibleModels[0];
  }
  
  /**
   * Select balanced model
   * @private
   * @param {Array<Object>} models - Eligible models
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async _selectBalancedModel(models) {
    if (models.length === 0) {
      return null;
    }
    
    // Calculate scores for each model
    const modelScores = models.map(model => {
      const history = this.modelPerformanceHistory.get(model.modelId) || [];
      
      // Calculate average latency
      const latencies = history.map(record => record.latency).filter(latency => latency !== undefined);
      const avgLatency = latencies.length > 0
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : 1000; // Default to 1000ms if no data
      
      // Calculate normalized scores (higher is better)
      const accuracyScore = model.accuracy || 0;
      const latencyScore = 1 - Math.min(avgLatency / 5000, 1); // Normalize to 0-1 (5000ms = 0)
      const memoryScore = 1 - Math.min((model.memoryUsage || 0) / 8192, 1); // Normalize to 0-1 (8GB = 0)
      
      // Calculate balanced score (weighted average)
      const balancedScore = (accuracyScore * 0.5) + (latencyScore * 0.3) + (memoryScore * 0.2);
      
      return {
        model,
        balancedScore
      };
    });
    
    // Sort by balanced score (highest first)
    modelScores.sort((a, b) => b.balancedScore - a.balancedScore);
    
    return modelScores[0].model;
  }
  
  /**
   * Select specialized model
   * @private
   * @param {Array<Object>} models - Eligible models
   * @param {string} taskType - Task type
   * @param {Object} taskInput - Task input
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async _selectSpecializedModel(models, taskType, taskInput) {
    if (models.length === 0) {
      return null;
    }
    
    // If no task input, fall back to task type based selection
    if (!taskInput) {
      return this._selectModelByTaskType(models, taskType);
    }
    
    // Get task characteristics
    const taskCharacteristics = await this._analyzeTaskCharacteristics(taskInput, taskType);
    
    if (!taskCharacteristics || taskCharacteristics.length === 0) {
      return this._selectModelByTaskType(models, taskType);
    }
    
    // Calculate specialization scores for each model
    const modelScores = models.map(model => {
      const profile = this.getModelCapabilityProfile(model.modelId);
      
      if (!profile) {
        return {
          model,
          specializationScore: 0
        };
      }
      
      // Calculate score based on task characteristics
      let specializationScore = 0;
      
      // Add score for each characteristic
      for (const characteristic of taskCharacteristics) {
        const characteristicScore = profile.specializations.find(s => s.name === characteristic)?.score || 0;
        specializationScore += characteristicScore;
      }
      
      // Add base accuracy score
      specializationScore += (model.accuracy || 0) * 10;
      
      return {
        model,
        specializationScore
      };
    });
    
    // Sort by specialization score (highest first)
    modelScores.sort((a, b) => b.specializationScore - a.specializationScore);
    
    return modelScores[0].model;
  }
  
  /**
   * Select model by task type
   * @private
   * @param {Array<Object>} models - Eligible models
   * @param {string} taskType - Task type
   * @returns {Promise<Object|null>} Selected model or null if none found
   */
  async _selectModelByTaskType(models, taskType) {
    if (models.length === 0) {
      return null;
    }
    
    // If no task type, fall back to highest accuracy
    if (!taskType) {
      return this._selectHighestAccuracyModel(models);
    }
    
    // Filter models that explicitly support this task type
    const supportingModels = models.filter(model => model.supportedTasks.includes(taskType));
    
    if (supportingModels.length === 0) {
      return this._selectHighestAccuracyModel(models);
    }
    
    // Sort by task-specific accuracy if available, otherwise by general accuracy
    supportingModels.sort((a, b) => {
      const taskAccuracyA = a.taskAccuracy?.[taskType] || a.accuracy || 0;
      const taskAccuracyB = b.taskAccuracy?.[taskType] || b.accuracy || 0;
      return taskAccuracyB - taskAccuracyA;
    });
    
    return supportingModels[0];
  }
  
  /**
   * Analyze task characteristics
   * @private
   * @param {Object} taskInput - Task input
   * @param {string} taskType - Task type
   * @returns {Promise<Array<string>>} Task characteristics
   */
  async _analyzeTaskCharacteristics(taskInput, taskType) {
    // Generate cache key
    const inputStr = JSON.stringify(taskInput);
    const cacheKey = `${taskType || 'general'}_${this._hashString(inputStr)}`;
    
    // Check cache
    if (this.taskCharacteristicsCache.has(cacheKey)) {
      return this.taskCharacteristicsCache.get(cacheKey);
    }
    
    try {
      // Get a model for analysis
      const analysisModel = await this.modelRegistry.getModelForAnalysis();
      
      if (!analysisModel) {
        this.logger.warn(`[SpecializedModelSelector] No model available for task analysis`);
        return [];
      }
      
      // Analyze task
      const analysisResult = await analysisModel.execute({
        ...taskInput,
        operation: 'analyze_task_characteristics',
        taskType
      });
      
      const characteristics = analysisResult.characteristics || [];
      
      // Cache result
      this.taskCharacteristicsCache.set(cacheKey, characteristics);
      
      // Limit cache size
      if (this.taskCharacteristicsCache.size > 1000) {
        // Remove oldest entry
        const oldestKey = this.taskCharacteristicsCache.keys().next().value;
        this.taskCharacteristicsCache.delete(oldestKey);
      }
      
      return characteristics;
      
    } catch (error) {
      this.logger.error(`[SpecializedModelSelector] Failed to analyze task characteristics: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Build model capability profiles
   * @private
   * @returns {Promise<void>}
   */
  async _buildModelCapabilityProfiles() {
    this.logger.debug(`[SpecializedModelSelector] Building model capability profiles`);
    
    try {
      // Get all models
      const allModels = await this.modelRegistry.getAllModels();
      
      // Build profiles
      for (const model of allModels) {
        try {
          // Get model metadata
          const metadata = model.metadata || {};
          
          // Create capability profile
          const profile = {
            modelId: model.modelId,
            modelType: model.modelType,
            modelTier: model.modelTier,
            accuracy: model.accuracy || 0,
            offlineCapable: model.offlineCapable || false,
            hybridCapable: model.hybridCapable || false,
            capabilities: {
              reasoning: metadata.reasoningScore || 0,
              planning: metadata.planningScore || 0,
              creativity: metadata.creativityScore || 0,
              factuality: metadata.factualityScore || 0,
              mathematics: metadata.mathematicsScore || 0,
              coding: metadata.codingScore || 0,
              summarization: metadata.summarizationScore || 0,
              translation: metadata.translationScore || 0
            },
            specializations: metadata.specializations || []
          };
          
          // Store profile
          this.modelCapabilityProfiles.set(model.modelId, profile);
          
        } catch (error) {
          this.logger.error(`[SpecializedModelSelector] Failed to build capability profile for model ${model.modelId}: ${error.message}`);
        }
      }
      
      this.logger.debug(`[SpecializedModelSelector] Built ${this.modelCapabilityProfiles.size} model capability profiles`);
      
    } catch (error) {
      this.logger.error(`[SpecializedModelSelector] Failed to build model capability profiles: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if model tier is eligible
   * @private
   * @param {string} modelTier - Model tier
   * @param {string} maxTier - Maximum allowed tier
   * @returns {boolean} Whether the tier is eligible
   */
  _isTierEligible(modelTier, maxTier) {
    const tierValues = {
      [ModelTier.STANDARD]: 1,
      [ModelTier.PRO]: 2,
      [ModelTier.ENTERPRISE]: 3
    };
    
    return tierValues[modelTier] <= tierValues[maxTier];
  }
  
  /**
   * Generate hash for string
   * @private
   * @param {string} str - String to hash
   * @returns {string} Hash
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

module.exports = { SpecializedModelSelector };
