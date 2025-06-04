/**
 * @fileoverview ModelStrategyManager for the Reasoning Engine.
 * 
 * The ModelStrategyManager serves as an abstraction layer for interacting with multiple LLMs,
 * selecting the appropriate model based on task requirements, context, and feature flags.
 * It provides strategic model selection, caching, performance monitoring, and fallback
 * mechanisms for offline operation.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI
 * @license Proprietary
 */

const Logger = require('../../../../common/logging/Logger');
const ConfigurationService = require('../../../../common/config/ConfigurationService');
const PerformanceMonitor = require('../../../../common/performance/PerformanceMonitor');
const SecurityManager = require('../../../../common/security/SecurityManager');
const LRUCache = require('../../../../common/utils/LRUCache');

/**
 * @typedef {Object} ModelRequest
 * @property {string} prompt - The prompt to send to the model
 * @property {Object} parameters - Model-specific parameters
 * @property {string} [context] - Optional context information
 * @property {string} [purpose] - Purpose of the request (e.g., 'classification', 'generation')
 * @property {string} [language] - Language of the request
 * @property {number} [maxTokens] - Maximum tokens to generate
 * @property {number} [temperature] - Temperature for generation
 * @property {boolean} [stream] - Whether to stream the response
 */

/**
 * @typedef {Object} ModelResponse
 * @property {string} text - The generated text
 * @property {Object} metadata - Response metadata
 * @property {number} metadata.tokenCount - Number of tokens in the response
 * @property {number} metadata.latency - Latency in milliseconds
 * @property {number} metadata.confidence - Confidence score (0-1)
 * @property {string} metadata.modelId - ID of the model that generated the response
 * @property {boolean} metadata.cached - Whether the response was retrieved from cache
 */

/**
 * @typedef {Object} ModelCapabilities
 * @property {string} id - Model identifier
 * @property {string} name - Human-readable name
 * @property {string[]} strengths - List of model strengths (e.g., 'reasoning', 'classification')
 * @property {string[]} languages - Supported languages
 * @property {number} maxTokens - Maximum context window size
 * @property {boolean} supportsStreaming - Whether the model supports streaming
 * @property {string} tier - Minimum tier required ('core', 'pro', 'enterprise')
 * @property {boolean} requiresInternet - Whether the model requires internet connectivity
 * @property {Object} resourceRequirements - Resource requirements
 * @property {number} resourceRequirements.minRAM - Minimum RAM in MB
 * @property {number} resourceRequirements.minCPU - Minimum CPU cores
 * @property {number} resourceRequirements.minGPU - Minimum GPU memory in MB (0 if not required)
 */

/**
 * ModelStrategyManager class for managing multiple LLMs and selecting the appropriate model
 * based on task requirements, context, and feature flags.
 */
class ModelStrategyManager {
  /**
   * Creates a new ModelStrategyManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Logger} options.logger - Logger instance
   * @param {ConfigurationService} options.configService - Configuration service
   * @param {PerformanceMonitor} options.performanceMonitor - Performance monitor
   * @param {SecurityManager} options.securityManager - Security manager
   * @param {Object} [options.cacheOptions] - Cache configuration options
   * @param {number} [options.cacheOptions.maxSize=1000] - Maximum number of cached responses
   * @param {number} [options.cacheOptions.ttl=3600000] - Time-to-live in milliseconds (1 hour default)
   */
  constructor(options) {
    if (!options) {
      throw new Error('ModelStrategyManager requires options parameter');
    }
    
    if (!options.logger) {
      throw new Error('ModelStrategyManager requires logger instance');
    }
    
    if (!options.configService) {
      throw new Error('ModelStrategyManager requires configService instance');
    }
    
    if (!options.performanceMonitor) {
      throw new Error('ModelStrategyManager requires performanceMonitor instance');
    }
    
    if (!options.securityManager) {
      throw new Error('ModelStrategyManager requires securityManager instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    
    // Initialize cache
    const cacheOptions = options.cacheOptions || {};
    this.responseCache = new LRUCache({
      maxSize: cacheOptions.maxSize || 1000,
      ttl: cacheOptions.ttl || 3600000 // 1 hour default
    });
    
    // Initialize model registry
    this.modelRegistry = new Map();
    this.modelAdapters = new Map();
    this.isInitialized = false;
    
    this.logger.info('ModelStrategyManager created');
  }
  
  /**
   * Initializes the ModelStrategyManager, loading available models and configurations.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    try {
      this.logger.info('Initializing ModelStrategyManager');
      
      // Load system tier information
      this.systemTier = await this.configService.getSystemTier();
      this.logger.debug(`System tier: ${this.systemTier}`);
      
      // Load model configurations
      const modelConfigs = await this.configService.getModelConfigurations();
      
      // Register available models
      for (const config of modelConfigs) {
        // Skip models that require higher tier than current system
        if (!this.isModelTierAvailable(config.tier)) {
          this.logger.debug(`Skipping model ${config.id} due to tier restrictions (requires ${config.tier}, system is ${this.systemTier})`);
          continue;
        }
        
        // Skip models that require internet if offline mode is enforced
        const offlineModeEnforced = await this.configService.isOfflineModeEnforced();
        if (offlineModeEnforced && config.requiresInternet) {
          this.logger.debug(`Skipping model ${config.id} due to offline mode restrictions`);
          continue;
        }
        
        // Check if system meets resource requirements
        const systemResources = await this.performanceMonitor.getSystemResources();
        if (!this.meetsResourceRequirements(config.resourceRequirements, systemResources)) {
          this.logger.debug(`Skipping model ${config.id} due to insufficient resources`);
          continue;
        }
        
        // Register the model
        await this.registerModel(config);
      }
      
      // Log available models
      this.logger.info(`Registered ${this.modelRegistry.size} models`);
      this.modelRegistry.forEach((capabilities, id) => {
        this.logger.debug(`Registered model: ${id} (${capabilities.name})`);
      });
      
      this.isInitialized = true;
      this.logger.info('ModelStrategyManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ModelStrategyManager', error);
      throw new Error(`ModelStrategyManager initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Registers a model with the ModelStrategyManager.
   * 
   * @async
   * @param {ModelCapabilities} modelConfig - Model configuration
   * @returns {Promise<void>}
   * @throws {Error} If model registration fails
   * @private
   */
  async registerModel(modelConfig) {
    try {
      // Validate model configuration
      this.validateModelConfig(modelConfig);
      
      // Register model capabilities
      this.modelRegistry.set(modelConfig.id, modelConfig);
      
      // Load model adapter
      const adapterModule = await this.loadModelAdapter(modelConfig.id);
      this.modelAdapters.set(modelConfig.id, adapterModule);
      
      this.logger.debug(`Registered model ${modelConfig.id} (${modelConfig.name})`);
    } catch (error) {
      this.logger.error(`Failed to register model ${modelConfig.id}`, error);
      throw new Error(`Model registration failed for ${modelConfig.id}: ${error.message}`);
    }
  }
  
  /**
   * Loads the adapter module for a specific model.
   * 
   * @async
   * @param {string} modelId - Model identifier
   * @returns {Promise<Object>} Model adapter module
   * @throws {Error} If adapter loading fails
   * @private
   */
  async loadModelAdapter(modelId) {
    try {
      // Dynamic import of model adapter based on model ID
      const adapterPath = `../models/adapters/${modelId}Adapter`;
      const adapter = require(adapterPath);
      
      // Initialize adapter if it has an initialize method
      if (typeof adapter.initialize === 'function') {
        await adapter.initialize({
          logger: this.logger,
          configService: this.configService
        });
      }
      
      return adapter;
    } catch (error) {
      this.logger.error(`Failed to load adapter for model ${modelId}`, error);
      throw new Error(`Model adapter loading failed for ${modelId}: ${error.message}`);
    }
  }
  
  /**
   * Validates a model configuration.
   * 
   * @param {ModelCapabilities} config - Model configuration to validate
   * @throws {Error} If configuration is invalid
   * @private
   */
  validateModelConfig(config) {
    // Required fields
    const requiredFields = ['id', 'name', 'strengths', 'languages', 'maxTokens', 'tier', 'requiresInternet', 'resourceRequirements'];
    for (const field of requiredFields) {
      if (config[field] === undefined) {
        throw new Error(`Missing required field in model configuration: ${field}`);
      }
    }
    
    // Resource requirements
    const resourceFields = ['minRAM', 'minCPU', 'minGPU'];
    for (const field of resourceFields) {
      if (config.resourceRequirements[field] === undefined) {
        throw new Error(`Missing required resource requirement in model configuration: ${field}`);
      }
    }
    
    // Validate tier
    const validTiers = ['core', 'pro', 'enterprise'];
    if (!validTiers.includes(config.tier)) {
      throw new Error(`Invalid tier in model configuration: ${config.tier}`);
    }
  }
  
  /**
   * Checks if a model tier is available on the current system.
   * 
   * @param {string} modelTier - Model tier ('core', 'pro', 'enterprise')
   * @returns {boolean} True if the model tier is available
   * @private
   */
  isModelTierAvailable(modelTier) {
    const tierLevels = {
      'core': 0,
      'pro': 1,
      'enterprise': 2
    };
    
    const modelTierLevel = tierLevels[modelTier];
    const systemTierLevel = tierLevels[this.systemTier];
    
    return systemTierLevel >= modelTierLevel;
  }
  
  /**
   * Checks if the system meets the resource requirements for a model.
   * 
   * @param {Object} requirements - Resource requirements
   * @param {Object} systemResources - Available system resources
   * @returns {boolean} True if the system meets the requirements
   * @private
   */
  meetsResourceRequirements(requirements, systemResources) {
    // Check RAM
    if (systemResources.availableRAM < requirements.minRAM) {
      return false;
    }
    
    // Check CPU
    if (systemResources.availableCPU < requirements.minCPU) {
      return false;
    }
    
    // Check GPU if required
    if (requirements.minGPU > 0) {
      if (!systemResources.gpuAvailable || systemResources.availableGPU < requirements.minGPU) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Selects the most appropriate model for a given task context.
   * 
   * @async
   * @param {Object} taskContext - Task context information
   * @param {string} taskContext.taskType - Type of task (e.g., 'reasoning', 'classification')
   * @param {string} [taskContext.language='en'] - Language of the task
   * @param {number} [taskContext.complexity=0.5] - Task complexity (0-1)
   * @param {boolean} [taskContext.requiresMultilingual=false] - Whether multilingual support is required
   * @param {string[]} [taskContext.preferredModels] - Preferred models (if any)
   * @param {boolean} [taskContext.offlineOnly=false] - Whether to only consider offline models
   * @returns {Promise<string>} Selected model ID
   * @throws {Error} If no suitable model is found or if manager is not initialized
   */
  async selectModel(taskContext) {
    this.ensureInitialized();
    
    try {
      this.logger.debug('Selecting model for task', { taskContext });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer('modelSelection');
      
      // Default values
      const context = {
        taskType: taskContext.taskType,
        language: taskContext.language || 'en',
        complexity: taskContext.complexity || 0.5,
        requiresMultilingual: taskContext.requiresMultilingual || false,
        preferredModels: taskContext.preferredModels || [],
        offlineOnly: taskContext.offlineOnly || false
      };
      
      // Check if offline mode is enforced
      const offlineModeEnforced = await this.configService.isOfflineModeEnforced();
      if (offlineModeEnforced) {
        context.offlineOnly = true;
      }
      
      // Filter available models based on task requirements
      const candidates = this.filterModelCandidates(context);
      
      if (candidates.length === 0) {
        throw new Error('No suitable model found for the given task context');
      }
      
      // Rank candidates based on suitability
      const rankedCandidates = this.rankModelCandidates(candidates, context);
      
      // Select the highest-ranked model
      const selectedModelId = rankedCandidates[0];
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker);
      
      this.logger.debug(`Selected model: ${selectedModelId}`, { taskContext });
      return selectedModelId;
    } catch (error) {
      this.logger.error('Model selection failed', error, { taskContext });
      throw new Error(`Model selection failed: ${error.message}`);
    }
  }
  
  /**
   * Filters model candidates based on task requirements.
   * 
   * @param {Object} context - Task context
   * @returns {string[]} Array of model IDs that meet the requirements
   * @private
   */
  filterModelCandidates(context) {
    const candidates = [];
    
    this.modelRegistry.forEach((capabilities, modelId) => {
      // Skip if offline only and model requires internet
      if (context.offlineOnly && capabilities.requiresInternet) {
        return;
      }
      
      // Skip if model doesn't support the required language
      if (!capabilities.languages.includes(context.language) && !capabilities.languages.includes('*')) {
        return;
      }
      
      // Skip if multilingual support is required but not provided
      if (context.requiresMultilingual && !capabilities.strengths.includes('multilingual')) {
        return;
      }
      
      // Skip if model doesn't support the task type
      if (!capabilities.strengths.includes(context.taskType) && !capabilities.strengths.includes('general')) {
        return;
      }
      
      // Add to candidates
      candidates.push(modelId);
    });
    
    return candidates;
  }
  
  /**
   * Ranks model candidates based on suitability for the task.
   * 
   * @param {string[]} candidates - Array of model IDs
   * @param {Object} context - Task context
   * @returns {string[]} Ranked array of model IDs
   * @private
   */
  rankModelCandidates(candidates, context) {
    // Calculate scores for each candidate
    const scores = new Map();
    
    for (const modelId of candidates) {
      const capabilities = this.modelRegistry.get(modelId);
      let score = 0;
      
      // Preferred models get a boost
      if (context.preferredModels.includes(modelId)) {
        score += 100;
      }
      
      // Task type match
      if (capabilities.strengths.includes(context.taskType)) {
        score += 50;
      }
      
      // Multilingual support
      if (context.requiresMultilingual && capabilities.strengths.includes('multilingual')) {
        score += 30;
      }
      
      // Specific language support
      if (capabilities.languages.includes(context.language)) {
        score += 20;
      }
      
      // Complexity handling
      if (context.complexity > 0.7 && capabilities.tier === 'enterprise') {
        score += 40;
      } else if (context.complexity > 0.4 && capabilities.tier === 'pro') {
        score += 30;
      }
      
      // Offline preference
      if (context.offlineOnly && !capabilities.requiresInternet) {
        score += 25;
      }
      
      // Resource efficiency (inverse score based on requirements)
      const resourceScore = 10 - Math.min(9, Math.floor(
        (capabilities.resourceRequirements.minRAM / 1000) + 
        (capabilities.resourceRequirements.minCPU * 2) + 
        (capabilities.resourceRequirements.minGPU / 1000)
      ));
      score += resourceScore;
      
      scores.set(modelId, score);
    }
    
    // Sort candidates by score (descending)
    return candidates.sort((a, b) => scores.get(b) - scores.get(a));
  }
  
  /**
   * Calls a model with the given request.
   * 
   * @async
   * @param {Object} options - Call options
   * @param {string} options.modelId - Model ID to call
   * @param {ModelRequest} options.request - Model request
   * @param {boolean} [options.bypassCache=false] - Whether to bypass the cache
   * @param {boolean} [options.bypassSecurity=false] - Whether to bypass security checks (requires elevated permissions)
   * @returns {Promise<ModelResponse>} Model response
   * @throws {Error} If the call fails or if manager is not initialized
   */
  async callModel(options) {
    this.ensureInitialized();
    
    if (!options || !options.modelId || !options.request) {
      throw new Error('ModelStrategyManager.callModel requires modelId and request');
    }
    
    const { modelId, request, bypassCache = false, bypassSecurity = false } = options;
    
    try {
      this.logger.debug(`Calling model ${modelId}`, { request });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer(`modelCall.${modelId}`);
      
      // Check if model is available
      if (!this.modelRegistry.has(modelId)) {
        throw new Error(`Model ${modelId} is not available`);
      }
      
      // Check if adapter is available
      if (!this.modelAdapters.has(modelId)) {
        throw new Error(`Adapter for model ${modelId} is not available`);
      }
      
      // Apply security policies unless bypassed (requires elevated permissions)
      if (!bypassSecurity) {
        await this.securityManager.enforceModelPolicy(modelId, request);
      }
      
      // Check cache unless bypassed
      if (!bypassCache) {
        const cacheKey = this.generateCacheKey(modelId, request);
        const cachedResponse = this.responseCache.get(cacheKey);
        
        if (cachedResponse) {
          this.logger.debug(`Cache hit for model ${modelId}`, { request });
          this.performanceMonitor.endTimer(perfMarker, { cached: true });
          
          // Mark as cached in metadata
          cachedResponse.metadata.cached = true;
          return cachedResponse;
        }
      }
      
      // Get model adapter
      const adapter = this.modelAdapters.get(modelId);
      
      // Call model
      const startTime = Date.now();
      const rawResponse = await adapter.callModel(request);
      const endTime = Date.now();
      
      // Process response
      const response = this.processModelResponse(modelId, rawResponse, endTime - startTime);
      
      // Cache response unless bypassed
      if (!bypassCache && !request.stream) {
        const cacheKey = this.generateCacheKey(modelId, request);
        this.responseCache.set(cacheKey, response);
      }
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker, { cached: false });
      
      return response;
    } catch (error) {
      this.logger.error(`Model call failed for ${modelId}`, error, { request });
      
      // Try fallback if available
      try {
        return await this.handleModelError(modelId, error, request);
      } catch (fallbackError) {
        throw new Error(`Model call failed and fallback failed: ${error.message}, fallback: ${fallbackError.message}`);
      }
    }
  }
  
  /**
   * Processes a raw model response into a standardized format.
   * 
   * @param {string} modelId - Model ID
   * @param {Object} rawResponse - Raw response from the model
   * @param {number} latency - Latency in milliseconds
   * @returns {ModelResponse} Standardized model response
   * @private
   */
  processModelResponse(modelId, rawResponse, latency) {
    // Extract text from raw response (adapter-specific)
    const text = rawResponse.text || rawResponse.content || rawResponse.generated_text || '';
    
    // Extract or calculate token count
    const tokenCount = rawResponse.tokenCount || rawResponse.usage?.total_tokens || this.estimateTokenCount(text);
    
    // Extract or default confidence
    const confidence = rawResponse.confidence || rawResponse.score || 1.0;
    
    // Construct standardized response
    return {
      text,
      metadata: {
        tokenCount,
        latency,
        confidence,
        modelId,
        cached: false
      }
    };
  }
  
  /**
   * Estimates the token count for a text string.
   * This is a simple approximation, not a precise count.
   * 
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   * @private
   */
  estimateTokenCount(text) {
    // Simple approximation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Generates a cache key for a model request.
   * 
   * @param {string} modelId - Model ID
   * @param {ModelRequest} request - Model request
   * @returns {string} Cache key
   * @private
   */
  generateCacheKey(modelId, request) {
    // Create a deterministic string representation of the request
    const requestStr = JSON.stringify({
      modelId,
      prompt: request.prompt,
      parameters: request.parameters,
      context: request.context,
      purpose: request.purpose,
      language: request.language,
      maxTokens: request.maxTokens,
      temperature: request.temperature
    });
    
    // Use a simple hash function for the key
    return this.hashString(requestStr);
  }
  
  /**
   * Simple string hashing function.
   * 
   * @param {string} str - String to hash
   * @returns {string} Hashed string
   * @private
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
  
  /**
   * Handles errors during model calls, attempting fallbacks if possible.
   * 
   * @async
   * @param {string} modelId - Model ID that failed
   * @param {Error} error - Error that occurred
   * @param {ModelRequest} request - Original request
   * @returns {Promise<ModelResponse>} Response from fallback model
   * @throws {Error} If all fallbacks fail
   * @private
   */
  async handleModelError(modelId, error, request) {
    this.logger.warn(`Attempting fallback for failed model call to ${modelId}`, { error: error.message, request });
    
    // Get fallback models for the failed model
    const fallbacks = await this.getFallbackModels(modelId);
    
    if (fallbacks.length === 0) {
      throw new Error(`No fallback models available for ${modelId}`);
    }
    
    // Try each fallback in order
    for (const fallbackId of fallbacks) {
      try {
        this.logger.debug(`Trying fallback model ${fallbackId}`, { request });
        
        // Call fallback model
        const response = await this.callModel({
          modelId: fallbackId,
          request,
          bypassCache: false, // Still use cache for fallbacks
          bypassSecurity: false // Still enforce security for fallbacks
        });
        
        // Mark as fallback in metadata
        response.metadata.fallback = true;
        response.metadata.originalModelId = modelId;
        
        this.logger.debug(`Fallback to ${fallbackId} successful`, { request });
        return response;
      } catch (fallbackError) {
        this.logger.debug(`Fallback to ${fallbackId} failed`, { error: fallbackError.message });
        // Continue to next fallback
      }
    }
    
    // If all fallbacks fail, throw error
    throw new Error(`All fallbacks failed for ${modelId}`);
  }
  
  /**
   * Gets fallback models for a given model.
   * 
   * @async
   * @param {string} modelId - Model ID to get fallbacks for
   * @returns {Promise<string[]>} Array of fallback model IDs
   * @private
   */
  async getFallbackModels(modelId) {
    // Get model capabilities
    const capabilities = this.modelRegistry.get(modelId);
    
    if (!capabilities) {
      return [];
    }
    
    // Create task context based on model capabilities
    const taskContext = {
      taskType: capabilities.strengths[0], // Primary strength
      language: 'en', // Default to English
      complexity: 0.3, // Lower complexity for fallbacks
      requiresMultilingual: capabilities.strengths.includes('multilingual'),
      offlineOnly: capabilities.requiresInternet ? false : true // Prefer offline if original was offline
    };
    
    // Find candidates excluding the failed model
    const candidates = this.filterModelCandidates(taskContext)
      .filter(id => id !== modelId);
    
    // Rank candidates
    return this.rankModelCandidates(candidates, taskContext);
  }
  
  /**
   * Gets the capabilities of a specified model.
   * 
   * @async
   * @param {string} modelId - Model ID
   * @returns {Promise<ModelCapabilities>} Model capabilities
   * @throws {Error} If model is not found or if manager is not initialized
   */
  async getModelCapabilities(modelId) {
    this.ensureInitialized();
    
    if (!modelId) {
      throw new Error('ModelStrategyManager.getModelCapabilities requires modelId');
    }
    
    const capabilities = this.modelRegistry.get(modelId);
    
    if (!capabilities) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    return { ...capabilities }; // Return a copy to prevent modification
  }
  
  /**
   * Gets a list of all available models.
   * 
   * @async
   * @returns {Promise<string[]>} Array of available model IDs
   * @throws {Error} If manager is not initialized
   */
  async getAvailableModels() {
    this.ensureInitialized();
    return Array.from(this.modelRegistry.keys());
  }
  
  /**
   * Gets a cached response for a model request if available.
   * 
   * @async
   * @param {string} modelId - Model ID
   * @param {ModelRequest} request - Model request
   * @returns {Promise<ModelResponse|null>} Cached response or null if not found
   * @throws {Error} If manager is not initialized
   */
  async getCachedResponse(modelId, request) {
    this.ensureInitialized();
    
    if (!modelId || !request) {
      throw new Error('ModelStrategyManager.getCachedResponse requires modelId and request');
    }
    
    const cacheKey = this.generateCacheKey(modelId, request);
    const cachedResponse = this.responseCache.get(cacheKey);
    
    if (cachedResponse) {
      // Mark as cached in metadata
      cachedResponse.metadata.cached = true;
      return cachedResponse;
    }
    
    return null;
  }
  
  /**
   * Clears the response cache.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If manager is not initialized
   */
  async clearCache() {
    this.ensureInitialized();
    this.responseCache.clear();
    this.logger.debug('Model response cache cleared');
  }
  
  /**
   * Ensures that the manager is initialized.
   * 
   * @throws {Error} If manager is not initialized
   * @private
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('ModelStrategyManager is not initialized. Call initialize() first.');
    }
  }
}

module.exports = ModelStrategyManager;
