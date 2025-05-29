/**
 * @fileoverview Adapter for Llama Multilingual models, providing multilingual support
 * across all reasoning strategies. This adapter implements the standardized model
 * adapter interface for the Reasoning Engine.
 * 
 * The LlamaMultilingualAdapter provides specialized integration with Llama Multilingual
 * models, optimizing for multilingual reasoning tasks while supporting both local
 * and API-based deployment options.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * Adapter for Llama Multilingual models, providing multilingual support
 * across all reasoning strategies.
 */
class LlamaMultilingualAdapter extends EventEmitter {
  /**
   * Constructor for LlamaMultilingualAdapter.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.securityManager Security manager
   * @param {Object} options.credentialManager Credential manager for API keys
   * @param {Object} options.cacheManager Cache manager for response caching
   */
  constructor(options) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for LlamaMultilingualAdapter');
    if (!options.logger) throw new Error('Logger is required for LlamaMultilingualAdapter');
    if (!options.configService) throw new Error('ConfigService is required for LlamaMultilingualAdapter');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for LlamaMultilingualAdapter');
    if (!options.securityManager) throw new Error('SecurityManager is required for LlamaMultilingualAdapter');
    if (!options.credentialManager) throw new Error('CredentialManager is required for LlamaMultilingualAdapter');
    if (!options.cacheManager) throw new Error('CacheManager is required for LlamaMultilingualAdapter');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.credentialManager = options.credentialManager;
    this.cacheManager = options.cacheManager;
    
    // Initialize adapter state
    this.initialized = false;
    this.available = false;
    this.modelInstances = new Map();
    this.modelConfig = null;
    this.supportedLanguages = [];
    this.requestQueue = [];
    this.processingQueue = false;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
      requestsByType: {},
      requestsByLanguage: {}
    };
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.isAvailable = this.isAvailable.bind(this);
    this.generateCompletion = this.generateCompletion.bind(this);
    this.generateEmbeddings = this.generateEmbeddings.bind(this);
    this.processTask = this.processTask.bind(this);
    this.getCapabilities = this.getCapabilities.bind(this);
    this.getResourceRequirements = this.getResourceRequirements.bind(this);
    this.getAdapterInfo = this.getAdapterInfo.bind(this);
    this._processQueue = this._processQueue.bind(this);
    this._getCredentials = this._getCredentials.bind(this);
    this._detectLanguage = this._detectLanguage.bind(this);
    this._optimizePrompt = this._optimizePrompt.bind(this);
    this._recordMetrics = this._recordMetrics.bind(this);
    
    this.logger.info('LlamaMultilingualAdapter created');
  }
  
  /**
   * Initialize the adapter.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing LlamaMultilingualAdapter');
      this.performanceMonitor.startTimer('llamaMultilingual.initialize');
      
      // Load configuration
      this.modelConfig = await this.configService.getModelConfig('llama-multilingual');
      if (!this.modelConfig) {
        throw new Error('Failed to load configuration for Llama Multilingual model');
      }
      
      // Load supported languages
      this.supportedLanguages = this.modelConfig.supportedLanguages || [];
      
      // Initialize model instances based on deployment type
      const deploymentType = this.modelConfig.deploymentType || 'local';
      
      if (deploymentType === 'local') {
        await this._initializeLocalModel();
      } else if (deploymentType === 'api') {
        await this._initializeApiModel();
      } else {
        throw new Error(`Unsupported deployment type: ${deploymentType}`);
      }
      
      // Initialize cache
      await this.cacheManager.initializeCache('llama-multilingual', {
        maxSize: this.modelConfig.cacheSize || 1000,
        ttl: this.modelConfig.cacheTtl || 3600000 // 1 hour default
      });
      
      // Set up periodic health check
      this._setupHealthCheck();
      
      this.initialized = true;
      this.available = true;
      
      this.performanceMonitor.stopTimer('llamaMultilingual.initialize');
      this.logger.info('LlamaMultilingualAdapter initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('llamaMultilingual.initialize');
      this.logger.error(`Failed to initialize LlamaMultilingualAdapter: ${error.message}`, { error });
      this.initialized = false;
      this.available = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Initialize local model deployment.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeLocalModel() {
    this.logger.info('Initializing local Llama Multilingual model');
    
    try {
      // Check if model files exist
      const modelPath = this.modelConfig.modelPath;
      if (!modelPath) {
        throw new Error('Model path not specified in configuration');
      }
      
      await fs.access(modelPath);
      
      // Load model based on configuration
      const { LlamaModel } = require(this.modelConfig.modelModule || './llama_model');
      
      const model = new LlamaModel({
        modelPath,
        contextSize: this.modelConfig.contextSize || 4096,
        batchSize: this.modelConfig.batchSize || 512,
        threads: this.modelConfig.threads || 4,
        logger: this.logger
      });
      
      await model.load();
      
      this.modelInstances.set('default', model);
      this.logger.info('Local Llama Multilingual model initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize local Llama Multilingual model: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Initialize API-based model deployment.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeApiModel() {
    this.logger.info('Initializing API-based Llama Multilingual model');
    
    try {
      // Check for API configuration
      if (!this.modelConfig.apiEndpoint) {
        throw new Error('API endpoint not specified in configuration');
      }
      
      // Test API connectivity with credentials
      const credentials = await this._getCredentials();
      if (!credentials) {
        throw new Error('No valid credentials available for Llama Multilingual API');
      }
      
      // Create API client
      const { LlamaApiClient } = require(this.modelConfig.apiModule || './llama_api_client');
      
      const apiClient = new LlamaApiClient({
        apiEndpoint: this.modelConfig.apiEndpoint,
        apiVersion: this.modelConfig.apiVersion || 'v1',
        timeout: this.modelConfig.timeout || 30000,
        logger: this.logger
      });
      
      // Test connection
      await apiClient.testConnection(credentials);
      
      this.modelInstances.set('default', apiClient);
      this.logger.info('API-based Llama Multilingual model initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize API-based Llama Multilingual model: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up periodic health check for the model.
   * @private
   */
  _setupHealthCheck() {
    const healthCheckInterval = this.modelConfig.healthCheckInterval || 300000; // 5 minutes default
    
    setInterval(async () => {
      try {
        const isAvailable = await this.isAvailable();
        
        if (this.available !== isAvailable) {
          this.available = isAvailable;
          this.emit('availabilityChanged', { available: isAvailable });
          
          this.logger.info(`Llama Multilingual model availability changed to: ${isAvailable}`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for Llama Multilingual model: ${error.message}`, { error });
      }
    }, healthCheckInterval);
  }
  
  /**
   * Get adapter information.
   * @returns {Object} Adapter information
   */
  getAdapterInfo() {
    return {
      id: 'llama-multilingual',
      name: 'Llama Multilingual',
      version: '1.0.0',
      provider: 'Meta',
      description: 'Adapter for Llama Multilingual models, providing multilingual support across all reasoning strategies',
      supportedLanguages: this.supportedLanguages,
      capabilities: this.getCapabilities(),
      resourceRequirements: this.getResourceRequirements(),
      available: this.available,
      initialized: this.initialized,
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * Check if the model is available.
   * @returns {Promise<boolean>} True if available, false otherwise
   */
  async isAvailable() {
    if (!this.initialized) {
      return false;
    }
    
    try {
      this.performanceMonitor.startTimer('llamaMultilingual.isAvailable');
      
      const model = this.modelInstances.get('default');
      if (!model) {
        return false;
      }
      
      // For API-based models, check API connectivity
      if (this.modelConfig.deploymentType === 'api') {
        const credentials = await this._getCredentials();
        if (!credentials) {
          return false;
        }
        
        const isAvailable = await model.testConnection(credentials);
        this.performanceMonitor.stopTimer('llamaMultilingual.isAvailable');
        return isAvailable;
      }
      
      // For local models, check if model is loaded
      const isAvailable = model.isLoaded ? model.isLoaded() : true;
      this.performanceMonitor.stopTimer('llamaMultilingual.isAvailable');
      return isAvailable;
    } catch (error) {
      this.performanceMonitor.stopTimer('llamaMultilingual.isAvailable');
      this.logger.error(`Error checking Llama Multilingual model availability: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Generate a completion for the given prompt.
   * @param {Object} options Request options
   * @param {string} options.prompt The prompt to complete
   * @param {Object} options.parameters Model parameters
   * @param {Object} options.context Request context
   * @param {string} options.userId User ID for credential lookup
   * @param {string} options.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Completion result
   */
  async generateCompletion(options) {
    if (!this.initialized) {
      throw new Error('LlamaMultilingualAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('Llama Multilingual model is not available');
    }
    
    if (!options || !options.prompt) {
      throw new Error('Prompt is required for completion generation');
    }
    
    try {
      this.performanceMonitor.startTimer('llamaMultilingual.generateCompletion');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'completion',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'llama-multilingual',
        content: options.prompt
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('completion', options);
      const cachedResult = await this.cacheManager.get('llama-multilingual', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('llamaMultilingual.generateCompletion');
        this._recordMetrics('completion', 0, true, options);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for Llama Multilingual model');
      }
      
      // Detect language and optimize prompt
      const detectedLanguage = await this._detectLanguage(options.prompt);
      const optimizedPrompt = await this._optimizePrompt(options.prompt, detectedLanguage, 'completion');
      
      // Prepare parameters
      const parameters = {
        ...this.modelConfig.defaultParameters,
        ...options.parameters
      };
      
      // Get model instance
      const model = this.modelInstances.get('default');
      if (!model) {
        throw new Error('Model instance not found');
      }
      
      // Generate completion
      const startTime = Date.now();
      
      const result = await model.generateCompletion({
        prompt: optimizedPrompt,
        parameters,
        credentials,
        context: options.context
      });
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('llama-multilingual', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('completion', duration, false, options, detectedLanguage);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('llamaMultilingual.generateCompletion');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('llamaMultilingual.generateCompletion');
      this.logger.error(`Error generating completion with Llama Multilingual model: ${error.message}`, { error, options });
      
      // Emit error event
      this.emit('error', {
        type: 'completion',
        message: error.message,
        error,
        options
      });
      
      throw error;
    }
  }
  
  /**
   * Generate embeddings for the given text.
   * @param {Object} options Request options
   * @param {string|Array<string>} options.text Text to embed
   * @param {Object} options.parameters Model parameters
   * @param {string} options.userId User ID for credential lookup
   * @param {string} options.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Embedding result
   */
  async generateEmbeddings(options) {
    if (!this.initialized) {
      throw new Error('LlamaMultilingualAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('Llama Multilingual model is not available');
    }
    
    if (!options || !options.text) {
      throw new Error('Text is required for embedding generation');
    }
    
    try {
      this.performanceMonitor.startTimer('llamaMultilingual.generateEmbeddings');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'embedding',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'llama-multilingual',
        content: Array.isArray(options.text) ? options.text.join(' ') : options.text
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('embedding', options);
      const cachedResult = await this.cacheManager.get('llama-multilingual', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('llamaMultilingual.generateEmbeddings');
        this._recordMetrics('embedding', 0, true, options);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for Llama Multilingual model');
      }
      
      // Detect language for text optimization
      const textSample = Array.isArray(options.text) ? options.text[0] : options.text;
      const detectedLanguage = await this._detectLanguage(textSample);
      
      // Prepare parameters
      const parameters = {
        ...this.modelConfig.defaultEmbeddingParameters,
        ...options.parameters
      };
      
      // Get model instance
      const model = this.modelInstances.get('default');
      if (!model) {
        throw new Error('Model instance not found');
      }
      
      // Generate embeddings
      const startTime = Date.now();
      
      const result = await model.generateEmbeddings({
        text: options.text,
        parameters,
        credentials
      });
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('llama-multilingual', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('embedding', duration, false, options, detectedLanguage);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('llamaMultilingual.generateEmbeddings');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('llamaMultilingual.generateEmbeddings');
      this.logger.error(`Error generating embeddings with Llama Multilingual model: ${error.message}`, { error, options });
      
      // Emit error event
      this.emit('error', {
        type: 'embedding',
        message: error.message,
        error,
        options
      });
      
      throw error;
    }
  }
  
  /**
   * Process a reasoning task.
   * @param {Object} task Reasoning task
   * @param {string} task.type Task type (deductive, inductive, abductive, analogical)
   * @param {Object} task.data Task data
   * @param {Object} task.context Task context
   * @param {string} task.userId User ID for credential lookup
   * @param {string} task.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Task result
   */
  async processTask(task) {
    if (!this.initialized) {
      throw new Error('LlamaMultilingualAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('Llama Multilingual model is not available');
    }
    
    if (!task || !task.type || !task.data) {
      throw new Error('Task type and data are required for task processing');
    }
    
    try {
      this.performanceMonitor.startTimer(`llamaMultilingual.processTask.${task.type}`);
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'task',
        taskType: task.type,
        userId: task.userId,
        subscriptionTier: task.subscriptionTier,
        modelId: 'llama-multilingual',
        content: JSON.stringify(task.data)
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('task', task);
      const cachedResult = await this.cacheManager.get('llama-multilingual', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer(`llamaMultilingual.processTask.${task.type}`);
        this._recordMetrics(`task.${task.type}`, 0, true, task);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(task.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for Llama Multilingual model');
      }
      
      // Process task based on type
      let result;
      const startTime = Date.now();
      
      switch (task.type) {
        case 'deductive':
          result = await this._processDeductiveTask(task, credentials);
          break;
        case 'inductive':
          result = await this._processInductiveTask(task, credentials);
          break;
        case 'abductive':
          result = await this._processAbductiveTask(task, credentials);
          break;
        case 'analogical':
          result = await this._processAnalogicalTask(task, credentials);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('llama-multilingual', cacheKey, result);
      
      // Record metrics
      this._recordMetrics(`task.${task.type}`, duration, false, task);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer(`llamaMultilingual.processTask.${task.type}`);
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer(`llamaMultilingual.processTask.${task.type}`);
      this.logger.error(`Error processing ${task.type} task with Llama Multilingual model: ${error.message}`, { error, task });
      
      // Emit error event
      this.emit('error', {
        type: `task.${task.type}`,
        message: error.message,
        error,
        task
      });
      
      throw error;
    }
  }
  
  /**
   * Process a deductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processDeductiveTask(task, credentials) {
    // Get model instance
    const model = this.modelInstances.get('default');
    if (!model) {
      throw new Error('Model instance not found');
    }
    
    // Prepare prompt for deductive reasoning
    const prompt = this._prepareDeductivePrompt(task.data, task.context);
    
    // Detect language
    const detectedLanguage = await this._detectLanguage(prompt);
    
    // Optimize prompt for deductive reasoning
    const optimizedPrompt = await this._optimizePrompt(prompt, detectedLanguage, 'deductive');
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt: optimizedPrompt,
      parameters: this.modelConfig.deductiveParameters || this.modelConfig.defaultParameters,
      credentials,
      context: task.context
    });
    
    // Parse and structure the result
    return this._parseDeductiveResult(completion, task.data, task.context);
  }
  
  /**
   * Process an inductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processInductiveTask(task, credentials) {
    // Get model instance
    const model = this.modelInstances.get('default');
    if (!model) {
      throw new Error('Model instance not found');
    }
    
    // Prepare prompt for inductive reasoning
    const prompt = this._prepareInductivePrompt(task.data, task.context);
    
    // Detect language
    const detectedLanguage = await this._detectLanguage(prompt);
    
    // Optimize prompt for inductive reasoning
    const optimizedPrompt = await this._optimizePrompt(prompt, detectedLanguage, 'inductive');
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt: optimizedPrompt,
      parameters: this.modelConfig.inductiveParameters || this.modelConfig.defaultParameters,
      credentials,
      context: task.context
    });
    
    // Parse and structure the result
    return this._parseInductiveResult(completion, task.data, task.context);
  }
  
  /**
   * Process an abductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processAbductiveTask(task, credentials) {
    // Get model instance
    const model = this.modelInstances.get('default');
    if (!model) {
      throw new Error('Model instance not found');
    }
    
    // Prepare prompt for abductive reasoning
    const prompt = this._prepareAbductivePrompt(task.data, task.context);
    
    // Detect language
    const detectedLanguage = await this._detectLanguage(prompt);
    
    // Optimize prompt for abductive reasoning
    const optimizedPrompt = await this._optimizePrompt(prompt, detectedLanguage, 'abductive');
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt: optimizedPrompt,
      parameters: this.modelConfig.abductiveParameters || this.modelConfig.defaultParameters,
      credentials,
      context: task.context
    });
    
    // Parse and structure the result
    return this._parseAbductiveResult(completion, task.data, task.context);
  }
  
  /**
   * Process an analogical reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processAnalogicalTask(task, credentials) {
    // Get model instance
    const model = this.modelInstances.get('default');
    if (!model) {
      throw new Error('Model instance not found');
    }
    
    // Prepare prompt for analogical reasoning
    const prompt = this._prepareAnalogicalPrompt(task.data, task.context);
    
    // Detect language
    const detectedLanguage = await this._detectLanguage(prompt);
    
    // Optimize prompt for analogical reasoning
    const optimizedPrompt = await this._optimizePrompt(prompt, detectedLanguage, 'analogical');
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt: optimizedPrompt,
      parameters: this.modelConfig.analogicalParameters || this.modelConfig.defaultParameters,
      credentials,
      context: task.context
    });
    
    // Parse and structure the result
    return this._parseAnalogicalResult(completion, task.data, task.context);
  }
  
  /**
   * Prepare prompt for deductive reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Prepared prompt
   */
  _prepareDeductivePrompt(data, context) {
    // Extract premises and query
    const premises = data.premises || [];
    const query = data.query || '';
    
    // Build prompt
    let prompt = 'You are a logical reasoning assistant specializing in deductive reasoning.\n\n';
    
    // Add context if available
    if (context && context.background) {
      prompt += `Background Information:\n${context.background}\n\n`;
    }
    
    // Add premises
    prompt += 'Given the following premises:\n';
    premises.forEach((premise, index) => {
      prompt += `${index + 1}. ${premise}\n`;
    });
    
    // Add query
    prompt += `\nQuestion: ${query}\n\n`;
    
    // Add instructions
    prompt += 'Please apply deductive reasoning to determine what logically follows from the given premises. ';
    prompt += 'Provide a step-by-step logical derivation, clearly stating each inference rule used. ';
    prompt += 'Conclude with a definitive answer about whether the query follows from the premises, ';
    prompt += 'along with your confidence level (0-100%).\n\n';
    
    return prompt;
  }
  
  /**
   * Prepare prompt for inductive reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Prepared prompt
   */
  _prepareInductivePrompt(data, context) {
    // Extract observations and query
    const observations = data.observations || [];
    const query = data.query || '';
    
    // Build prompt
    let prompt = 'You are a pattern recognition assistant specializing in inductive reasoning.\n\n';
    
    // Add context if available
    if (context && context.background) {
      prompt += `Background Information:\n${context.background}\n\n`;
    }
    
    // Add observations
    prompt += 'Given the following observations:\n';
    observations.forEach((observation, index) => {
      prompt += `${index + 1}. ${observation}\n`;
    });
    
    // Add query
    prompt += `\nQuestion: ${query}\n\n`;
    
    // Add instructions
    prompt += 'Please apply inductive reasoning to identify patterns in the observations. ';
    prompt += 'Formulate a general rule or hypothesis that explains these observations. ';
    prompt += 'Evaluate how well your hypothesis explains the observations, considering potential exceptions. ';
    prompt += 'Provide your confidence level (0-100%) in the hypothesis and explain your reasoning.\n\n';
    
    return prompt;
  }
  
  /**
   * Prepare prompt for abductive reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Prepared prompt
   */
  _prepareAbductivePrompt(data, context) {
    // Extract observations and query
    const observations = data.observations || [];
    const query = data.query || '';
    
    // Build prompt
    let prompt = 'You are an explanatory reasoning assistant specializing in abductive reasoning.\n\n';
    
    // Add context if available
    if (context && context.background) {
      prompt += `Background Information:\n${context.background}\n\n`;
    }
    
    // Add observations
    prompt += 'Given the following observations:\n';
    observations.forEach((observation, index) => {
      prompt += `${index + 1}. ${observation}\n`;
    });
    
    // Add query
    prompt += `\nQuestion: ${query}\n\n`;
    
    // Add instructions
    prompt += 'Please apply abductive reasoning to generate the most plausible explanation for these observations. ';
    prompt += 'Consider multiple possible explanations and evaluate each based on simplicity, coherence, and explanatory power. ';
    prompt += 'Rank the explanations from most to least plausible, providing your confidence level (0-100%) for each. ';
    prompt += 'Explain why your top explanation is the best inference to the most likely cause.\n\n';
    
    return prompt;
  }
  
  /**
   * Prepare prompt for analogical reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Prepared prompt
   */
  _prepareAnalogicalPrompt(data, context) {
    // Extract source, target, and query
    const source = data.source || {};
    const target = data.target || {};
    const query = data.query || '';
    
    // Build prompt
    let prompt = 'You are a comparative reasoning assistant specializing in analogical reasoning.\n\n';
    
    // Add context if available
    if (context && context.background) {
      prompt += `Background Information:\n${context.background}\n\n`;
    }
    
    // Add source domain
    prompt += 'Source Domain:\n';
    if (source.description) {
      prompt += `Description: ${source.description}\n`;
    }
    if (source.properties) {
      prompt += 'Properties:\n';
      source.properties.forEach((property, index) => {
        prompt += `${index + 1}. ${property}\n`;
      });
    }
    if (source.relations) {
      prompt += 'Relations:\n';
      source.relations.forEach((relation, index) => {
        prompt += `${index + 1}. ${relation}\n`;
      });
    }
    
    // Add target domain
    prompt += '\nTarget Domain:\n';
    if (target.description) {
      prompt += `Description: ${target.description}\n`;
    }
    if (target.properties) {
      prompt += 'Properties:\n';
      target.properties.forEach((property, index) => {
        prompt += `${index + 1}. ${property}\n`;
      });
    }
    if (target.relations) {
      prompt += 'Relations:\n';
      target.relations.forEach((relation, index) => {
        prompt += `${index + 1}. ${relation}\n`;
      });
    }
    
    // Add query
    prompt += `\nQuestion: ${query}\n\n`;
    
    // Add instructions
    prompt += 'Please apply analogical reasoning to map concepts between the source and target domains. ';
    prompt += 'Identify structural similarities and differences between the domains. ';
    prompt += 'Transfer knowledge from the source domain to make inferences about the target domain. ';
    prompt += 'Evaluate the strength of the analogy and provide your confidence level (0-100%) in the inferences. ';
    prompt += 'Explain your reasoning process and any limitations of the analogy.\n\n';
    
    return prompt;
  }
  
  /**
   * Parse deductive reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} data Original task data
   * @param {Object} context Task context
   * @returns {Object} Structured result
   */
  _parseDeductiveResult(completion, data, context) {
    try {
      const text = completion.text || completion.choices?.[0]?.text || '';
      
      // Extract conclusion and confidence
      let conclusion = '';
      let confidence = 0;
      let reasoning = '';
      
      // Extract reasoning steps
      const reasoningMatch = text.match(/(?:step-by-step|reasoning|derivation):(.*?)(?:conclusion|therefore|thus|hence|confidence)/is);
      if (reasoningMatch && reasoningMatch[1]) {
        reasoning = reasoningMatch[1].trim();
      }
      
      // Extract conclusion
      const conclusionMatch = text.match(/(?:conclusion|therefore|thus|hence):(.*?)(?:confidence|\n\n|$)/is);
      if (conclusionMatch && conclusionMatch[1]) {
        conclusion = conclusionMatch[1].trim();
      }
      
      // Extract confidence
      const confidenceMatch = text.match(/confidence[^0-9]*([0-9]+)[^0-9]*%/i);
      if (confidenceMatch && confidenceMatch[1]) {
        confidence = parseInt(confidenceMatch[1], 10);
      }
      
      return {
        type: 'deductive',
        conclusion,
        confidence: Math.min(100, Math.max(0, confidence)),
        reasoning,
        rawOutput: text,
        premises: data.premises,
        query: data.query
      };
    } catch (error) {
      this.logger.error(`Error parsing deductive result: ${error.message}`, { error, completion });
      
      // Return a basic structure with the raw output
      return {
        type: 'deductive',
        conclusion: 'Unable to parse conclusion',
        confidence: 0,
        reasoning: 'Unable to parse reasoning',
        rawOutput: completion.text || completion.choices?.[0]?.text || '',
        premises: data.premises,
        query: data.query,
        error: error.message
      };
    }
  }
  
  /**
   * Parse inductive reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} data Original task data
   * @param {Object} context Task context
   * @returns {Object} Structured result
   */
  _parseInductiveResult(completion, data, context) {
    try {
      const text = completion.text || completion.choices?.[0]?.text || '';
      
      // Extract hypothesis, confidence, and reasoning
      let hypothesis = '';
      let confidence = 0;
      let reasoning = '';
      
      // Extract hypothesis
      const hypothesisMatch = text.match(/(?:hypothesis|pattern|rule|generalization):(.*?)(?:confidence|evaluation|\n\n|$)/is);
      if (hypothesisMatch && hypothesisMatch[1]) {
        hypothesis = hypothesisMatch[1].trim();
      }
      
      // Extract reasoning
      const reasoningMatch = text.match(/(?:reasoning|evaluation|analysis):(.*?)(?:confidence|\n\n|$)/is);
      if (reasoningMatch && reasoningMatch[1]) {
        reasoning = reasoningMatch[1].trim();
      }
      
      // Extract confidence
      const confidenceMatch = text.match(/confidence[^0-9]*([0-9]+)[^0-9]*%/i);
      if (confidenceMatch && confidenceMatch[1]) {
        confidence = parseInt(confidenceMatch[1], 10);
      }
      
      return {
        type: 'inductive',
        hypothesis,
        confidence: Math.min(100, Math.max(0, confidence)),
        reasoning,
        rawOutput: text,
        observations: data.observations,
        query: data.query
      };
    } catch (error) {
      this.logger.error(`Error parsing inductive result: ${error.message}`, { error, completion });
      
      // Return a basic structure with the raw output
      return {
        type: 'inductive',
        hypothesis: 'Unable to parse hypothesis',
        confidence: 0,
        reasoning: 'Unable to parse reasoning',
        rawOutput: completion.text || completion.choices?.[0]?.text || '',
        observations: data.observations,
        query: data.query,
        error: error.message
      };
    }
  }
  
  /**
   * Parse abductive reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} data Original task data
   * @param {Object} context Task context
   * @returns {Object} Structured result
   */
  _parseAbductiveResult(completion, data, context) {
    try {
      const text = completion.text || completion.choices?.[0]?.text || '';
      
      // Extract explanations, confidence, and reasoning
      let bestExplanation = '';
      let alternativeExplanations = [];
      let confidence = 0;
      let reasoning = '';
      
      // Extract best explanation
      const bestExplanationMatch = text.match(/(?:best explanation|most plausible explanation|top explanation):(.*?)(?:alternative|confidence|reasoning|\n\n|$)/is);
      if (bestExplanationMatch && bestExplanationMatch[1]) {
        bestExplanation = bestExplanationMatch[1].trim();
      }
      
      // Extract alternative explanations
      const alternativeMatch = text.match(/(?:alternative explanations|other explanations|other possibilities):(.*?)(?:confidence|reasoning|\n\n|$)/is);
      if (alternativeMatch && alternativeMatch[1]) {
        const alternatives = alternativeMatch[1].trim();
        alternativeExplanations = alternatives
          .split(/\d+\.\s+/)
          .filter(item => item.trim().length > 0)
          .map(item => item.trim());
      }
      
      // Extract reasoning
      const reasoningMatch = text.match(/(?:reasoning|justification|rationale):(.*?)(?:confidence|\n\n|$)/is);
      if (reasoningMatch && reasoningMatch[1]) {
        reasoning = reasoningMatch[1].trim();
      }
      
      // Extract confidence
      const confidenceMatch = text.match(/confidence[^0-9]*([0-9]+)[^0-9]*%/i);
      if (confidenceMatch && confidenceMatch[1]) {
        confidence = parseInt(confidenceMatch[1], 10);
      }
      
      return {
        type: 'abductive',
        bestExplanation,
        alternativeExplanations,
        confidence: Math.min(100, Math.max(0, confidence)),
        reasoning,
        rawOutput: text,
        observations: data.observations,
        query: data.query
      };
    } catch (error) {
      this.logger.error(`Error parsing abductive result: ${error.message}`, { error, completion });
      
      // Return a basic structure with the raw output
      return {
        type: 'abductive',
        bestExplanation: 'Unable to parse explanation',
        alternativeExplanations: [],
        confidence: 0,
        reasoning: 'Unable to parse reasoning',
        rawOutput: completion.text || completion.choices?.[0]?.text || '',
        observations: data.observations,
        query: data.query,
        error: error.message
      };
    }
  }
  
  /**
   * Parse analogical reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} data Original task data
   * @param {Object} context Task context
   * @returns {Object} Structured result
   */
  _parseAnalogicalResult(completion, data, context) {
    try {
      const text = completion.text || completion.choices?.[0]?.text || '';
      
      // Extract mappings, inferences, confidence, and reasoning
      let mappings = [];
      let inferences = [];
      let confidence = 0;
      let reasoning = '';
      let limitations = '';
      
      // Extract mappings
      const mappingsMatch = text.match(/(?:mappings|correspondences|analogies):(.*?)(?:inferences|confidence|reasoning|limitations|\n\n|$)/is);
      if (mappingsMatch && mappingsMatch[1]) {
        const mappingsText = mappingsMatch[1].trim();
        mappings = mappingsText
          .split(/\d+\.\s+/)
          .filter(item => item.trim().length > 0)
          .map(item => item.trim());
      }
      
      // Extract inferences
      const inferencesMatch = text.match(/(?:inferences|conclusions|predictions):(.*?)(?:confidence|reasoning|limitations|\n\n|$)/is);
      if (inferencesMatch && inferencesMatch[1]) {
        const inferencesText = inferencesMatch[1].trim();
        inferences = inferencesText
          .split(/\d+\.\s+/)
          .filter(item => item.trim().length > 0)
          .map(item => item.trim());
      }
      
      // Extract reasoning
      const reasoningMatch = text.match(/(?:reasoning|justification|rationale):(.*?)(?:confidence|limitations|\n\n|$)/is);
      if (reasoningMatch && reasoningMatch[1]) {
        reasoning = reasoningMatch[1].trim();
      }
      
      // Extract limitations
      const limitationsMatch = text.match(/(?:limitations|weaknesses|constraints):(.*?)(?:confidence|\n\n|$)/is);
      if (limitationsMatch && limitationsMatch[1]) {
        limitations = limitationsMatch[1].trim();
      }
      
      // Extract confidence
      const confidenceMatch = text.match(/confidence[^0-9]*([0-9]+)[^0-9]*%/i);
      if (confidenceMatch && confidenceMatch[1]) {
        confidence = parseInt(confidenceMatch[1], 10);
      }
      
      return {
        type: 'analogical',
        mappings,
        inferences,
        limitations,
        confidence: Math.min(100, Math.max(0, confidence)),
        reasoning,
        rawOutput: text,
        source: data.source,
        target: data.target,
        query: data.query
      };
    } catch (error) {
      this.logger.error(`Error parsing analogical result: ${error.message}`, { error, completion });
      
      // Return a basic structure with the raw output
      return {
        type: 'analogical',
        mappings: [],
        inferences: [],
        limitations: 'Unable to parse limitations',
        confidence: 0,
        reasoning: 'Unable to parse reasoning',
        rawOutput: completion.text || completion.choices?.[0]?.text || '',
        source: data.source,
        target: data.target,
        query: data.query,
        error: error.message
      };
    }
  }
  
  /**
   * Get the model's capabilities.
   * @returns {Object} Model capabilities
   */
  getCapabilities() {
    return {
      completion: true,
      embedding: true,
      reasoning: {
        deductive: true,
        inductive: true,
        abductive: true,
        analogical: true
      },
      multilingual: true,
      supportedLanguages: this.supportedLanguages,
      contextSize: this.modelConfig?.contextSize || 4096,
      maxTokens: this.modelConfig?.maxTokens || 2048
    };
  }
  
  /**
   * Get the model's resource requirements.
   * @returns {Object} Resource requirements
   */
  getResourceRequirements() {
    if (this.modelConfig.deploymentType === 'local') {
      return {
        cpu: {
          cores: this.modelConfig.cpuCores || 4,
          minCores: this.modelConfig.minCpuCores || 2
        },
        memory: {
          ram: this.modelConfig.ramRequired || 8192, // MB
          minRam: this.modelConfig.minRamRequired || 4096 // MB
        },
        gpu: {
          required: this.modelConfig.gpuRequired || false,
          vram: this.modelConfig.vramRequired || 0, // MB
          minVram: this.modelConfig.minVramRequired || 0 // MB
        },
        disk: {
          space: this.modelConfig.diskSpaceRequired || 10240, // MB
          minSpace: this.modelConfig.minDiskSpaceRequired || 5120 // MB
        }
      };
    } else {
      // API-based deployment has minimal local resource requirements
      return {
        cpu: {
          cores: 1,
          minCores: 1
        },
        memory: {
          ram: 512, // MB
          minRam: 256 // MB
        },
        gpu: {
          required: false,
          vram: 0,
          minVram: 0
        },
        disk: {
          space: 100, // MB
          minSpace: 50 // MB
        }
      };
    }
  }
  
  /**
   * Shutdown the adapter.
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down LlamaMultilingualAdapter');
      this.performanceMonitor.startTimer('llamaMultilingual.shutdown');
      
      // Set availability to false
      this.available = false;
      
      // Shutdown model instances
      for (const [key, model] of this.modelInstances.entries()) {
        if (model && typeof model.shutdown === 'function') {
          await model.shutdown();
          this.logger.info(`Shut down model instance: ${key}`);
        }
      }
      
      // Clear model instances
      this.modelInstances.clear();
      
      // Clear cache
      await this.cacheManager.clearCache('llama-multilingual');
      
      this.initialized = false;
      
      this.performanceMonitor.stopTimer('llamaMultilingual.shutdown');
      this.logger.info('LlamaMultilingualAdapter shut down successfully');
    } catch (error) {
      this.performanceMonitor.stopTimer('llamaMultilingual.shutdown');
      this.logger.error(`Error shutting down LlamaMultilingualAdapter: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'shutdown',
        message: error.message,
        error
      });
      
      throw error;
    }
  }
  
  /**
   * Generate a cache key for the request.
   * @private
   * @param {string} type Request type
   * @param {Object} options Request options
   * @returns {string} Cache key
   */
  _generateCacheKey(type, options) {
    try {
      let key = `${type}:`;
      
      switch (type) {
        case 'completion':
          key += crypto.createHash('md5').update(options.prompt).digest('hex');
          if (options.parameters) {
            key += `:${crypto.createHash('md5').update(JSON.stringify(options.parameters)).digest('hex')}`;
          }
          break;
        case 'embedding':
          const text = Array.isArray(options.text) ? options.text.join(' ') : options.text;
          key += crypto.createHash('md5').update(text).digest('hex');
          break;
        case 'task':
          key += `${options.type}:${crypto.createHash('md5').update(JSON.stringify(options.data)).digest('hex')}`;
          if (options.context) {
            key += `:${crypto.createHash('md5').update(JSON.stringify(options.context)).digest('hex')}`;
          }
          break;
        default:
          key += crypto.createHash('md5').update(JSON.stringify(options)).digest('hex');
      }
      
      return key;
    } catch (error) {
      this.logger.error(`Error generating cache key: ${error.message}`, { error, type, options });
      return `${type}:${Date.now()}:${Math.random()}`;
    }
  }
  
  /**
   * Get credentials for the model.
   * @private
   * @param {string} userId Optional user ID for personal credentials
   * @returns {Promise<Object|null>} Credentials or null if not available
   */
  async _getCredentials(userId) {
    try {
      // If deployment type is local, no credentials needed
      if (this.modelConfig.deploymentType === 'local') {
        return {};
      }
      
      // Try to get personal credentials first if userId is provided
      if (userId) {
        try {
          const personalCredentials = await this.credentialManager.getPersonalCredentials({
            userId,
            provider: 'llama-multilingual'
          });
          
          if (personalCredentials && personalCredentials.apiKey) {
            return personalCredentials;
          }
        } catch (error) {
          this.logger.debug(`No personal credentials found for user ${userId}: ${error.message}`);
        }
      }
      
      // Fall back to global credentials
      const globalCredentials = await this.credentialManager.getGlobalCredentials({
        provider: 'llama-multilingual'
      });
      
      if (globalCredentials && globalCredentials.apiKey) {
        return globalCredentials;
      }
      
      this.logger.warn('No credentials found for Llama Multilingual model');
      return null;
    } catch (error) {
      this.logger.error(`Error getting credentials: ${error.message}`, { error, userId });
      return null;
    }
  }
  
  /**
   * Detect language of the text.
   * @private
   * @param {string} text Text to detect language for
   * @returns {Promise<string>} Detected language code
   */
  async _detectLanguage(text) {
    try {
      // Use a simple language detection approach
      // In production, this would use a more sophisticated language detection library
      
      // For now, we'll use a simple heuristic based on character sets
      const sample = text.slice(0, 500); // Take a sample for efficiency
      
      // Check for common scripts
      const scripts = {
        latin: /[a-zA-Z]/,
        cyrillic: /[а-яА-Я]/,
        greek: /[α-ωΑ-Ω]/,
        han: /[\u4E00-\u9FFF]/,
        hiragana: /[\u3040-\u309F]/,
        katakana: /[\u30A0-\u30FF]/,
        hangul: /[\uAC00-\uD7AF]/,
        arabic: /[\u0600-\u06FF]/,
        devanagari: /[\u0900-\u097F]/
      };
      
      const scriptCounts = {};
      
      for (const [script, regex] of Object.entries(scripts)) {
        const matches = sample.match(new RegExp(regex, 'g'));
        scriptCounts[script] = matches ? matches.length : 0;
      }
      
      // Find the dominant script
      let dominantScript = 'latin'; // Default
      let maxCount = 0;
      
      for (const [script, count] of Object.entries(scriptCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantScript = script;
        }
      }
      
      // Map dominant script to language code
      const scriptToLanguage = {
        latin: 'en', // Default to English for Latin script
        cyrillic: 'ru',
        greek: 'el',
        han: 'zh',
        hiragana: 'ja',
        katakana: 'ja',
        hangul: 'ko',
        arabic: 'ar',
        devanagari: 'hi'
      };
      
      return scriptToLanguage[dominantScript] || 'en';
    } catch (error) {
      this.logger.error(`Error detecting language: ${error.message}`, { error });
      return 'en'; // Default to English on error
    }
  }
  
  /**
   * Optimize prompt for the target language and task.
   * @private
   * @param {string} prompt Original prompt
   * @param {string} language Target language code
   * @param {string} taskType Task type
   * @returns {Promise<string>} Optimized prompt
   */
  async _optimizePrompt(prompt, language, taskType) {
    try {
      // Check if language is supported
      if (!this.supportedLanguages.includes(language)) {
        this.logger.warn(`Language ${language} is not in the list of supported languages, using default optimization`);
        return prompt;
      }
      
      // Get language-specific optimization templates
      const languageTemplates = this.modelConfig.languageTemplates?.[language];
      if (!languageTemplates) {
        return prompt;
      }
      
      // Get task-specific template
      const taskTemplate = languageTemplates[taskType];
      if (!taskTemplate) {
        return prompt;
      }
      
      // Apply template
      let optimizedPrompt = taskTemplate.prefix ? `${taskTemplate.prefix}\n\n${prompt}` : prompt;
      optimizedPrompt = taskTemplate.suffix ? `${optimizedPrompt}\n\n${taskTemplate.suffix}` : optimizedPrompt;
      
      return optimizedPrompt;
    } catch (error) {
      this.logger.error(`Error optimizing prompt: ${error.message}`, { error, language, taskType });
      return prompt; // Return original prompt on error
    }
  }
  
  /**
   * Record metrics for the request.
   * @private
   * @param {string} operationType Operation type
   * @param {number} duration Duration in milliseconds
   * @param {boolean} fromCache Whether the result was from cache
   * @param {Object} options Request options
   * @param {string} language Detected language
   */
  _recordMetrics(operationType, duration, fromCache, options, language) {
    try {
      // Update total latency and average
      if (!fromCache) {
        this.metrics.totalLatency += duration;
        this.metrics.averageLatency = this.metrics.totalLatency / (this.metrics.totalRequests - this.metrics.cacheHits);
      }
      
      // Update operation type counts
      if (!this.metrics.requestsByType[operationType]) {
        this.metrics.requestsByType[operationType] = 0;
      }
      this.metrics.requestsByType[operationType]++;
      
      // Update language counts if available
      if (language) {
        if (!this.metrics.requestsByLanguage[language]) {
          this.metrics.requestsByLanguage[language] = 0;
        }
        this.metrics.requestsByLanguage[language]++;
      }
      
      // Emit metrics event
      this.emit('metrics', {
        type: operationType,
        duration,
        fromCache,
        language,
        timestamp: Date.now()
      });
      
      // Log metrics for performance monitoring
      this.performanceMonitor.recordMetric(`llamaMultilingual.${operationType}`, {
        duration,
        fromCache,
        language
      });
    } catch (error) {
      this.logger.error(`Error recording metrics: ${error.message}`, { error });
    }
  }
  
  /**
   * Process the request queue.
   * @private
   * @returns {Promise<void>}
   */
  async _processQueue() {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        
        try {
          let result;
          
          switch (request.type) {
            case 'completion':
              result = await this.generateCompletion(request.options);
              break;
            case 'embedding':
              result = await this.generateEmbeddings(request.options);
              break;
            case 'task':
              result = await this.processTask(request.options);
              break;
            default:
              throw new Error(`Unsupported request type: ${request.type}`);
          }
          
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }
}

module.exports = LlamaMultilingualAdapter;
