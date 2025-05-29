/**
 * @fileoverview Adapter for OpenAI models, providing integration with GPT-4 and other OpenAI models
 * across all reasoning strategies. This adapter implements the standardized model
 * adapter interface for the Reasoning Engine.
 * 
 * The OpenAIAdapter provides specialized integration with OpenAI's suite of models,
 * optimizing for advanced reasoning capabilities while supporting secure API key management
 * for both user-provided and global keys.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * Adapter for OpenAI models, providing integration with GPT-4 and other OpenAI models
 * across all reasoning strategies.
 */
class OpenAIAdapter extends EventEmitter {
  /**
   * Constructor for OpenAIAdapter.
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
    if (!options) throw new Error('Options are required for OpenAIAdapter');
    if (!options.logger) throw new Error('Logger is required for OpenAIAdapter');
    if (!options.configService) throw new Error('ConfigService is required for OpenAIAdapter');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for OpenAIAdapter');
    if (!options.securityManager) throw new Error('SecurityManager is required for OpenAIAdapter');
    if (!options.credentialManager) throw new Error('CredentialManager is required for OpenAIAdapter');
    if (!options.cacheManager) throw new Error('CacheManager is required for OpenAIAdapter');
    
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
    this.supportedModels = [];
    this.defaultModel = null;
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
      requestsByModel: {},
      requestsByLanguage: {},
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0
      },
      costEstimate: 0
    };
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.isAvailable = this.isAvailable.bind(this);
    this.generateCompletion = this.generateCompletion.bind(this);
    this.generateEmbeddings = this.generateEmbeddings.bind(this);
    this.generateImage = this.generateImage.bind(this);
    this.processTask = this.processTask.bind(this);
    this.getCapabilities = this.getCapabilities.bind(this);
    this.getResourceRequirements = this.getResourceRequirements.bind(this);
    this.getAdapterInfo = this.getAdapterInfo.bind(this);
    this._processQueue = this._processQueue.bind(this);
    this._getCredentials = this._getCredentials.bind(this);
    this._detectLanguage = this._detectLanguage.bind(this);
    this._optimizePrompt = this._optimizePrompt.bind(this);
    this._recordMetrics = this._recordMetrics.bind(this);
    this._estimateCost = this._estimateCost.bind(this);
    
    this.logger.info('OpenAIAdapter created');
  }
  
  /**
   * Initialize the adapter.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing OpenAIAdapter');
      this.performanceMonitor.startTimer('openai.initialize');
      
      // Load configuration
      this.modelConfig = await this.configService.getModelConfig('openai');
      if (!this.modelConfig) {
        throw new Error('Failed to load configuration for OpenAI models');
      }
      
      // Load supported models
      this.supportedModels = this.modelConfig.supportedModels || [];
      if (this.supportedModels.length === 0) {
        throw new Error('No supported models specified in configuration');
      }
      
      // Set default model
      this.defaultModel = this.modelConfig.defaultModel || this.supportedModels[0];
      
      // Load supported languages
      this.supportedLanguages = this.modelConfig.supportedLanguages || [];
      
      // Initialize API client
      await this._initializeApiClient();
      
      // Initialize cache
      await this.cacheManager.initializeCache('openai', {
        maxSize: this.modelConfig.cacheSize || 1000,
        ttl: this.modelConfig.cacheTtl || 3600000 // 1 hour default
      });
      
      // Set up periodic health check
      this._setupHealthCheck();
      
      this.initialized = true;
      this.available = true;
      
      this.performanceMonitor.stopTimer('openai.initialize');
      this.logger.info('OpenAIAdapter initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('openai.initialize');
      this.logger.error(`Failed to initialize OpenAIAdapter: ${error.message}`, { error });
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
   * Initialize API client.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeApiClient() {
    this.logger.info('Initializing OpenAI API client');
    
    try {
      // Check for API configuration
      if (!this.modelConfig.apiEndpoint) {
        throw new Error('API endpoint not specified in configuration');
      }
      
      // Test API connectivity with credentials
      const credentials = await this._getCredentials();
      if (!credentials) {
        throw new Error('No valid credentials available for OpenAI API');
      }
      
      // Create API client
      const { OpenAIClient } = require(this.modelConfig.apiModule || './openai_client');
      
      const apiClient = new OpenAIClient({
        apiEndpoint: this.modelConfig.apiEndpoint,
        apiVersion: this.modelConfig.apiVersion || 'v1',
        timeout: this.modelConfig.timeout || 60000,
        logger: this.logger,
        organizationId: this.modelConfig.organizationId
      });
      
      // Test connection
      await apiClient.testConnection(credentials);
      
      this.modelInstances.set('default', apiClient);
      this.logger.info('OpenAI API client initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize OpenAI API client: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up periodic health check for the API.
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
          
          this.logger.info(`OpenAI API availability changed to: ${isAvailable}`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for OpenAI API: ${error.message}`, { error });
      }
    }, healthCheckInterval);
  }
  
  /**
   * Get adapter information.
   * @returns {Object} Adapter information
   */
  getAdapterInfo() {
    return {
      id: 'openai',
      name: 'OpenAI',
      version: '1.0.0',
      provider: 'OpenAI',
      description: 'Adapter for OpenAI models, providing integration with GPT-4 and other OpenAI models across all reasoning strategies',
      supportedModels: this.supportedModels,
      defaultModel: this.defaultModel,
      supportedLanguages: this.supportedLanguages,
      capabilities: this.getCapabilities(),
      resourceRequirements: this.getResourceRequirements(),
      available: this.available,
      initialized: this.initialized,
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * Get model capabilities.
   * @returns {Object} Model capabilities
   */
  getCapabilities() {
    return {
      maxTokens: this.modelConfig?.contextSize || 128000, // GPT-4 Turbo default
      supportsStreaming: this.modelConfig?.supportsStreaming || true,
      strengths: [
        'reasoning',
        'instruction-following',
        'complex-tasks',
        'code-generation',
        'multilingual',
        'creative-writing'
      ],
      supportedTasks: [
        'completion',
        'embedding',
        'image-generation',
        'reasoning',
        'classification',
        'summarization'
      ],
      multimodal: true,
      supportsVision: true,
      supportsFunctionCalling: true
    };
  }
  
  /**
   * Get resource requirements for the model.
   * @returns {Object} Resource requirements
   */
  getResourceRequirements() {
    return {
      minRAM: this.modelConfig?.resourceRequirements?.minRAM || 4096, // 4GB
      minCPU: this.modelConfig?.resourceRequirements?.minCPU || 2,
      minGPU: this.modelConfig?.resourceRequirements?.minGPU || 0,
      recommendedRAM: this.modelConfig?.resourceRequirements?.recommendedRAM || 8192, // 8GB
      recommendedCPU: this.modelConfig?.resourceRequirements?.recommendedCPU || 4,
      recommendedGPU: this.modelConfig?.resourceRequirements?.recommendedGPU || 0,
      requiresInternet: true
    };
  }
  
  /**
   * Check if the API is available.
   * @returns {Promise<boolean>} True if available, false otherwise
   */
  async isAvailable() {
    if (!this.initialized) {
      return false;
    }
    
    try {
      this.performanceMonitor.startTimer('openai.isAvailable');
      
      const apiClient = this.modelInstances.get('default');
      if (!apiClient) {
        return false;
      }
      
      // Check API connectivity
      const credentials = await this._getCredentials();
      if (!credentials) {
        return false;
      }
      
      const isAvailable = await apiClient.testConnection(credentials);
      this.performanceMonitor.stopTimer('openai.isAvailable');
      return isAvailable;
    } catch (error) {
      this.performanceMonitor.stopTimer('openai.isAvailable');
      this.logger.error(`Error checking OpenAI API availability: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Generate a completion for the given prompt.
   * @param {Object} options Request options
   * @param {string} options.prompt The prompt to complete
   * @param {Object} options.parameters Model parameters
   * @param {string} [options.model] Model to use (defaults to configured default)
   * @param {Object} options.context Request context
   * @param {string} options.userId User ID for credential lookup
   * @param {string} options.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Completion result
   */
  async generateCompletion(options) {
    if (!this.initialized) {
      throw new Error('OpenAIAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenAI API is not available');
    }
    
    if (!options || !options.prompt) {
      throw new Error('Prompt is required for completion generation');
    }
    
    try {
      this.performanceMonitor.startTimer('openai.generateCompletion');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'completion',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'openai',
        content: options.prompt
      });
      
      // Determine model to use
      const model = options.model || this.defaultModel;
      if (!this.supportedModels.includes(model)) {
        throw new Error(`Unsupported model: ${model}`);
      }
      
      // Check cache first
      const cacheKey = this._generateCacheKey('completion', { ...options, model });
      const cachedResult = await this.cacheManager.get('openai', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('openai.generateCompletion');
        this._recordMetrics('completion', 0, true, options, model);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenAI API');
      }
      
      // Detect language and optimize prompt
      const detectedLanguage = await this._detectLanguage(options.prompt);
      const optimizedPrompt = await this._optimizePrompt(options.prompt, detectedLanguage, 'completion');
      
      // Prepare parameters
      const parameters = {
        ...this.modelConfig.defaultParameters,
        ...options.parameters,
        model
      };
      
      // Get API client
      const apiClient = this.modelInstances.get('default');
      if (!apiClient) {
        throw new Error('API client not found');
      }
      
      // Generate completion
      const startTime = Date.now();
      
      const result = await apiClient.generateCompletion({
        prompt: optimizedPrompt,
        parameters,
        credentials,
        context: options.context
      });
      
      const duration = Date.now() - startTime;
      
      // Update token usage metrics
      if (result.usage) {
        this.metrics.tokenUsage.prompt += result.usage.prompt_tokens || 0;
        this.metrics.tokenUsage.completion += result.usage.completion_tokens || 0;
        this.metrics.tokenUsage.total += result.usage.total_tokens || 0;
        
        // Estimate cost
        this._estimateCost(model, result.usage);
      }
      
      // Cache result
      await this.cacheManager.set('openai', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('completion', duration, false, options, model, detectedLanguage);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('openai.generateCompletion');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('openai.generateCompletion');
      this.logger.error(`Error generating completion with OpenAI API: ${error.message}`, { error, options });
      
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
   * @param {string} [options.model] Model to use (defaults to configured embedding model)
   * @param {string} options.userId User ID for credential lookup
   * @param {string} options.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Embedding result
   */
  async generateEmbeddings(options) {
    if (!this.initialized) {
      throw new Error('OpenAIAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenAI API is not available');
    }
    
    if (!options || !options.text) {
      throw new Error('Text is required for embedding generation');
    }
    
    try {
      this.performanceMonitor.startTimer('openai.generateEmbeddings');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'embedding',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'openai',
        content: Array.isArray(options.text) ? options.text.join(' ') : options.text
      });
      
      // Determine model to use
      const model = options.model || this.modelConfig.embeddingModel || 'text-embedding-3-large';
      
      // Check cache first
      const cacheKey = this._generateCacheKey('embedding', { ...options, model });
      const cachedResult = await this.cacheManager.get('openai', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('openai.generateEmbeddings');
        this._recordMetrics('embedding', 0, true, options, model);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenAI API');
      }
      
      // Prepare parameters
      const parameters = {
        ...this.modelConfig.defaultEmbeddingParameters,
        ...options.parameters,
        model
      };
      
      // Get API client
      const apiClient = this.modelInstances.get('default');
      if (!apiClient) {
        throw new Error('API client not found');
      }
      
      // Generate embeddings
      const startTime = Date.now();
      
      const result = await apiClient.generateEmbeddings({
        text: options.text,
        parameters,
        credentials
      });
      
      const duration = Date.now() - startTime;
      
      // Update token usage metrics
      if (result.usage) {
        this.metrics.tokenUsage.prompt += result.usage.prompt_tokens || 0;
        this.metrics.tokenUsage.total += result.usage.total_tokens || 0;
        
        // Estimate cost
        this._estimateCost(model, result.usage);
      }
      
      // Cache result
      await this.cacheManager.set('openai', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('embedding', duration, false, options, model);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('openai.generateEmbeddings');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('openai.generateEmbeddings');
      this.logger.error(`Error generating embeddings with OpenAI API: ${error.message}`, { error, options });
      
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
   * Generate an image based on the given prompt.
   * @param {Object} options Request options
   * @param {string} options.prompt The prompt to generate an image from
   * @param {Object} options.parameters Model parameters
   * @param {string} [options.model] Model to use (defaults to configured image model)
   * @param {string} options.userId User ID for credential lookup
   * @param {string} options.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Image generation result
   */
  async generateImage(options) {
    if (!this.initialized) {
      throw new Error('OpenAIAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenAI API is not available');
    }
    
    if (!options || !options.prompt) {
      throw new Error('Prompt is required for image generation');
    }
    
    try {
      this.performanceMonitor.startTimer('openai.generateImage');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'image',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'openai',
        content: options.prompt
      });
      
      // Determine model to use
      const model = options.model || this.modelConfig.imageModel || 'dall-e-3';
      
      // Check cache first
      const cacheKey = this._generateCacheKey('image', { ...options, model });
      const cachedResult = await this.cacheManager.get('openai', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('openai.generateImage');
        this._recordMetrics('image', 0, true, options, model);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenAI API');
      }
      
      // Prepare parameters
      const parameters = {
        ...this.modelConfig.defaultImageParameters,
        ...options.parameters,
        model
      };
      
      // Get API client
      const apiClient = this.modelInstances.get('default');
      if (!apiClient) {
        throw new Error('API client not found');
      }
      
      // Generate image
      const startTime = Date.now();
      
      const result = await apiClient.generateImage({
        prompt: options.prompt,
        parameters,
        credentials
      });
      
      const duration = Date.now() - startTime;
      
      // Estimate cost based on model and parameters
      this._estimateCost(model, null, parameters);
      
      // Cache result
      await this.cacheManager.set('openai', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('image', duration, false, options, model);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('openai.generateImage');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('openai.generateImage');
      this.logger.error(`Error generating image with OpenAI API: ${error.message}`, { error, options });
      
      // Emit error event
      this.emit('error', {
        type: 'image',
        message: error.message,
        error,
        options
      });
      
      throw error;
    }
  }
  
  /**
   * Process a reasoning task using OpenAI models.
   * @param {Object} task Reasoning task
   * @param {string} task.type Task type (e.g., 'deductive', 'inductive')
   * @param {Object} task.data Task data
   * @param {Object} task.context Task context
   * @param {string} [task.model] Model to use (defaults to configured default)
   * @param {string} task.userId User ID for credential lookup
   * @param {string} task.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Task result
   */
  async processTask(task) {
    if (!this.initialized) {
      throw new Error('OpenAIAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenAI API is not available');
    }
    
    if (!task || !task.type || !task.data) {
      throw new Error('Invalid task for processing');
    }
    
    try {
      this.performanceMonitor.startTimer(`openai.processTask.${task.type}`);
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'task',
        taskType: task.type,
        userId: task.userId,
        subscriptionTier: task.subscriptionTier,
        modelId: 'openai',
        content: JSON.stringify(task.data)
      });
      
      // Determine model to use
      const model = task.model || this.defaultModel;
      if (!this.supportedModels.includes(model)) {
        throw new Error(`Unsupported model: ${model}`);
      }
      
      // Check cache first
      const cacheKey = this._generateCacheKey('task', { ...task, model });
      const cachedResult = await this.cacheManager.get('openai', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer(`openai.processTask.${task.type}`);
        this._recordMetrics('task', 0, true, task, model);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(task.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenAI API');
      }
      
      // Process task based on type
      const startTime = Date.now();
      let result;
      
      switch (task.type) {
        case 'deductive':
          result = await this._processDeductiveTask(task, credentials, model);
          break;
        case 'inductive':
          result = await this._processInductiveTask(task, credentials, model);
          break;
        case 'abductive':
          result = await this._processAbductiveTask(task, credentials, model);
          break;
        case 'analogical':
          result = await this._processAnalogicalTask(task, credentials, model);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('openai', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('task', duration, false, task, model);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer(`openai.processTask.${task.type}`);
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer(`openai.processTask.${task.type}`);
      this.logger.error(`Error processing task with OpenAI API: ${error.message}`, { error, task });
      
      // Emit error event
      this.emit('error', {
        type: 'task',
        taskType: task.type,
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
   * @param {string} model Model to use
   * @returns {Promise<Object>} Task result
   */
  async _processDeductiveTask(task, credentials, model) {
    const apiClient = this.modelInstances.get('default');
    
    // Prepare prompt for deductive reasoning
    const prompt = this._prepareDeductivePrompt(task.data, task.context);
    
    // Prepare function calling schema for structured output
    const functions = [
      {
        name: 'submit_deductive_reasoning',
        description: 'Submit the results of deductive reasoning analysis',
        parameters: {
          type: 'object',
          properties: {
            conclusion: {
              type: 'string',
              description: 'The logical conclusion derived from the premises'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score between 0 and 1 for the conclusion'
            },
            reasoning: {
              type: 'string',
              description: 'Step-by-step reasoning process that led to the conclusion'
            },
            valid: {
              type: 'boolean',
              description: 'Whether the conclusion logically follows from the premises'
            }
          },
          required: ['conclusion', 'confidence', 'reasoning', 'valid']
        }
      }
    ];
    
    // Generate completion with function calling
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.1, // Lower temperature for logical reasoning
        max_tokens: 2048,
        top_p: 0.95,
        functions,
        function_call: { name: 'submit_deductive_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract function call result
    let result;
    if (completion.function_call && completion.function_call.arguments) {
      try {
        result = JSON.parse(completion.function_call.arguments);
      } catch (error) {
        this.logger.error(`Error parsing function call result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse deductive reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseDeductiveResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'openai',
      model,
      taskType: 'deductive',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.prompt_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.completion_tokens || 0;
      this.metrics.tokenUsage.total += completion.usage.total_tokens || 0;
      
      // Estimate cost
      this._estimateCost(model, completion.usage);
    }
    
    return result;
  }
  
  /**
   * Process an inductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @param {string} model Model to use
   * @returns {Promise<Object>} Task result
   */
  async _processInductiveTask(task, credentials, model) {
    const apiClient = this.modelInstances.get('default');
    
    // Prepare prompt for inductive reasoning
    const prompt = this._prepareInductivePrompt(task.data, task.context);
    
    // Prepare function calling schema for structured output
    const functions = [
      {
        name: 'submit_inductive_reasoning',
        description: 'Submit the results of inductive reasoning analysis',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The identified pattern from the examples'
            },
            generalization: {
              type: 'string',
              description: 'The generalization derived from the pattern'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score between 0 and 1 for the generalization'
            },
            analysis: {
              type: 'string',
              description: 'Detailed analysis of the examples and pattern identification process'
            }
          },
          required: ['pattern', 'generalization', 'confidence', 'analysis']
        }
      }
    ];
    
    // Generate completion with function calling
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.3, // Moderate temperature for pattern recognition
        max_tokens: 2048,
        top_p: 0.9,
        functions,
        function_call: { name: 'submit_inductive_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract function call result
    let result;
    if (completion.function_call && completion.function_call.arguments) {
      try {
        result = JSON.parse(completion.function_call.arguments);
      } catch (error) {
        this.logger.error(`Error parsing function call result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse inductive reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseInductiveResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'openai',
      model,
      taskType: 'inductive',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.prompt_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.completion_tokens || 0;
      this.metrics.tokenUsage.total += completion.usage.total_tokens || 0;
      
      // Estimate cost
      this._estimateCost(model, completion.usage);
    }
    
    return result;
  }
  
  /**
   * Process an abductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @param {string} model Model to use
   * @returns {Promise<Object>} Task result
   */
  async _processAbductiveTask(task, credentials, model) {
    const apiClient = this.modelInstances.get('default');
    
    // Prepare prompt for abductive reasoning
    const prompt = this._prepareAbductivePrompt(task.data, task.context);
    
    // Prepare function calling schema for structured output
    const functions = [
      {
        name: 'submit_abductive_reasoning',
        description: 'Submit the results of abductive reasoning analysis',
        parameters: {
          type: 'object',
          properties: {
            explanations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  explanation: {
                    type: 'string',
                    description: 'A possible explanation for the observations'
                  },
                  plausibility: {
                    type: 'number',
                    description: 'Plausibility score between 0 and 1'
                  }
                }
              },
              description: 'List of possible explanations for the observations'
            },
            bestExplanation: {
              type: 'string',
              description: 'The most plausible explanation for the observations'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score between 0 and 1 for the best explanation'
            },
            analysis: {
              type: 'string',
              description: 'Detailed analysis of the observations and explanation generation process'
            }
          },
          required: ['explanations', 'bestExplanation', 'confidence', 'analysis']
        }
      }
    ];
    
    // Generate completion with function calling
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.7, // Higher temperature for creative explanations
        max_tokens: 2048,
        top_p: 0.9,
        functions,
        function_call: { name: 'submit_abductive_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract function call result
    let result;
    if (completion.function_call && completion.function_call.arguments) {
      try {
        result = JSON.parse(completion.function_call.arguments);
      } catch (error) {
        this.logger.error(`Error parsing function call result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse abductive reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseAbductiveResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'openai',
      model,
      taskType: 'abductive',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.prompt_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.completion_tokens || 0;
      this.metrics.tokenUsage.total += completion.usage.total_tokens || 0;
      
      // Estimate cost
      this._estimateCost(model, completion.usage);
    }
    
    return result;
  }
  
  /**
   * Process an analogical reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @param {string} model Model to use
   * @returns {Promise<Object>} Task result
   */
  async _processAnalogicalTask(task, credentials, model) {
    const apiClient = this.modelInstances.get('default');
    
    // Prepare prompt for analogical reasoning
    const prompt = this._prepareAnalogicalPrompt(task.data, task.context);
    
    // Prepare function calling schema for structured output
    const functions = [
      {
        name: 'submit_analogical_reasoning',
        description: 'Submit the results of analogical reasoning analysis',
        parameters: {
          type: 'object',
          properties: {
            mappings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sourceElement: {
                    type: 'string',
                    description: 'Element from the source domain'
                  },
                  targetElement: {
                    type: 'string',
                    description: 'Corresponding element in the target domain'
                  },
                  relationship: {
                    type: 'string',
                    description: 'The relationship or mapping between the elements'
                  }
                }
              },
              description: 'List of mappings between source and target domains'
            },
            conclusion: {
              type: 'string',
              description: 'The conclusion derived from the analogical mapping'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score between 0 and 1 for the conclusion'
            },
            analysis: {
              type: 'string',
              description: 'Detailed analysis of the domains and mapping process'
            }
          },
          required: ['mappings', 'conclusion', 'confidence', 'analysis']
        }
      }
    ];
    
    // Generate completion with function calling
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.5, // Balanced temperature for analogical mapping
        max_tokens: 2048,
        top_p: 0.9,
        functions,
        function_call: { name: 'submit_analogical_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract function call result
    let result;
    if (completion.function_call && completion.function_call.arguments) {
      try {
        result = JSON.parse(completion.function_call.arguments);
      } catch (error) {
        this.logger.error(`Error parsing function call result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse analogical reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseAnalogicalResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'openai',
      model,
      taskType: 'analogical',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.prompt_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.completion_tokens || 0;
      this.metrics.tokenUsage.total += completion.usage.total_tokens || 0;
      
      // Estimate cost
      this._estimateCost(model, completion.usage);
    }
    
    return result;
  }
  
  /**
   * Prepare prompt for deductive reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Formatted prompt
   */
  _prepareDeductivePrompt(data, context) {
    // Extract premises and query
    const premises = data.premises || [];
    const query = data.query || '';
    
    // Format premises
    const premisesText = premises.map((premise, index) => `Premise ${index + 1}: ${premise}`).join('\n');
    
    // Construct prompt
    return `
You are performing deductive reasoning to draw logical conclusions from given premises.

${premisesText}

Query: ${query}

Based on the premises above, determine if the query logically follows. 
Provide your reasoning step by step, and conclude with a definitive answer.

Reasoning:
`;
  }
  
  /**
   * Prepare prompt for inductive reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Formatted prompt
   */
  _prepareInductivePrompt(data, context) {
    // Extract examples and query
    const examples = data.examples || [];
    const query = data.query || '';
    
    // Format examples
    const examplesText = examples.map((example, index) => `Example ${index + 1}: ${example}`).join('\n');
    
    // Construct prompt
    return `
You are performing inductive reasoning to identify patterns and make generalizations.

${examplesText}

Query: ${query}

Based on the examples above, identify patterns and make a generalization that addresses the query.
Provide your analysis step by step, and conclude with a well-supported answer.

Analysis:
`;
  }
  
  /**
   * Prepare prompt for abductive reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Formatted prompt
   */
  _prepareAbductivePrompt(data, context) {
    // Extract observations and query
    const observations = data.observations || [];
    const query = data.query || '';
    
    // Format observations
    const observationsText = observations.map((obs, index) => `Observation ${index + 1}: ${obs}`).join('\n');
    
    // Construct prompt
    return `
You are performing abductive reasoning to generate the most plausible explanation for a set of observations.

${observationsText}

Query: ${query}

Based on the observations above, generate multiple possible explanations that could account for them.
Rank these explanations by plausibility, considering simplicity, coherence, and explanatory power.
Provide your analysis step by step, and conclude with the most plausible explanation.

Analysis:
`;
  }
  
  /**
   * Prepare prompt for analogical reasoning.
   * @private
   * @param {Object} data Task data
   * @param {Object} context Task context
   * @returns {string} Formatted prompt
   */
  _prepareAnalogicalPrompt(data, context) {
    // Extract source domain, target domain, and query
    const sourceDomain = data.sourceDomain || {};
    const targetDomain = data.targetDomain || {};
    const query = data.query || '';
    
    // Format source domain
    const sourceText = Object.entries(sourceDomain)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    // Format target domain
    const targetText = Object.entries(targetDomain)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    // Construct prompt
    return `
You are performing analogical reasoning to map relationships from a source domain to a target domain.

Source Domain:
${sourceText}

Target Domain:
${targetText}

Query: ${query}

Based on the source and target domains above, identify structural similarities and map relationships from the source to the target.
Use these mappings to address the query.
Provide your analysis step by step, and conclude with a well-supported answer.

Analysis:
`;
  }
  
  /**
   * Parse and validate deductive reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} task Original task
   * @returns {Object} Parsed result
   */
  _parseDeductiveResult(completion, task) {
    try {
      // Extract conclusion from completion
      const text = completion.text || '';
      
      // Attempt to identify the conclusion
      let conclusion = '';
      let confidence = 0;
      let valid = false;
      
      if (text.includes('Conclusion:')) {
        const conclusionMatch = text.match(/Conclusion:(.+?)(?:\n|$)/s);
        if (conclusionMatch) {
          conclusion = conclusionMatch[1].trim();
        }
      } else if (text.includes('Therefore,')) {
        const conclusionMatch = text.match(/Therefore,(.+?)(?:\n|$)/s);
        if (conclusionMatch) {
          conclusion = conclusionMatch[1].trim();
        }
      } else {
        // Use the last paragraph as the conclusion
        const paragraphs = text.split('\n\n');
        conclusion = paragraphs[paragraphs.length - 1].trim();
      }
      
      // Determine if the conclusion is valid
      if (text.toLowerCase().includes('valid') || 
          text.toLowerCase().includes('follows') || 
          text.toLowerCase().includes('true')) {
        valid = true;
      } else if (text.toLowerCase().includes('invalid') || 
                text.toLowerCase().includes('does not follow') || 
                text.toLowerCase().includes('false')) {
        valid = false;
      } else {
        // Default to false if unclear
        valid = false;
      }
      
      // Estimate confidence based on language
      if (text.includes('certainly') || text.includes('definitely') || text.includes('must be')) {
        confidence = 0.95;
      } else if (text.includes('likely') || text.includes('probably')) {
        confidence = 0.8;
      } else if (text.includes('possibly') || text.includes('might')) {
        confidence = 0.6;
      } else if (text.includes('unlikely') || text.includes('doubtful')) {
        confidence = 0.3;
      } else {
        confidence = 0.7; // Default confidence
      }
      
      return {
        conclusion,
        confidence,
        reasoning: text,
        valid
      };
    } catch (error) {
      this.logger.error(`Error parsing deductive result: ${error.message}`, { error, completion, task });
      throw new Error(`Failed to parse deductive reasoning result: ${error.message}`);
    }
  }
  
  /**
   * Parse and validate inductive reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} task Original task
   * @returns {Object} Parsed result
   */
  _parseInductiveResult(completion, task) {
    try {
      // Extract pattern and generalization from completion
      const text = completion.text || '';
      
      // Attempt to identify the pattern and generalization
      let pattern = '';
      let generalization = '';
      let confidence = 0;
      
      if (text.includes('Pattern:')) {
        const patternMatch = text.match(/Pattern:(.+?)(?:\n|$)/s);
        if (patternMatch) {
          pattern = patternMatch[1].trim();
        }
      }
      
      if (text.includes('Generalization:')) {
        const genMatch = text.match(/Generalization:(.+?)(?:\n|$)/s);
        if (genMatch) {
          generalization = genMatch[1].trim();
        }
      } else if (text.includes('Conclusion:')) {
        const genMatch = text.match(/Conclusion:(.+?)(?:\n|$)/s);
        if (genMatch) {
          generalization = genMatch[1].trim();
        }
      } else {
        // Use the last paragraph as the generalization
        const paragraphs = text.split('\n\n');
        generalization = paragraphs[paragraphs.length - 1].trim();
      }
      
      // Estimate confidence based on language
      if (text.includes('strong evidence') || text.includes('clear pattern')) {
        confidence = 0.9;
      } else if (text.includes('suggests') || text.includes('indicates')) {
        confidence = 0.75;
      } else if (text.includes('possible') || text.includes('might indicate')) {
        confidence = 0.6;
      } else if (text.includes('weak evidence') || text.includes('limited pattern')) {
        confidence = 0.4;
      } else {
        confidence = 0.65; // Default confidence for inductive reasoning
      }
      
      return {
        pattern,
        generalization,
        confidence,
        analysis: text
      };
    } catch (error) {
      this.logger.error(`Error parsing inductive result: ${error.message}`, { error, completion, task });
      throw new Error(`Failed to parse inductive reasoning result: ${error.message}`);
    }
  }
  
  /**
   * Parse and validate abductive reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} task Original task
   * @returns {Object} Parsed result
   */
  _parseAbductiveResult(completion, task) {
    try {
      // Extract explanations and best explanation from completion
      const text = completion.text || '';
      
      // Attempt to identify explanations and the best explanation
      let explanations = [];
      let bestExplanation = '';
      let confidence = 0;
      
      // Extract explanations
      const explanationMatches = text.matchAll(/Explanation\s*\d+:(.+?)(?=Explanation\s*\d+:|$)/gs);
      for (const match of explanationMatches) {
        explanations.push({
          explanation: match[1].trim(),
          plausibility: 0.5 // Default plausibility
        });
      }
      
      // If no structured explanations found, try to extract from text
      if (explanations.length === 0) {
        const possibleExplanations = text.split('\n\n').filter(p => 
          p.includes('explanation') || p.includes('hypothesis') || p.includes('possibility')
        );
        
        if (possibleExplanations.length > 0) {
          explanations = possibleExplanations.map(exp => ({
            explanation: exp,
            plausibility: 0.5 // Default plausibility
          }));
        }
      }
      
      // Extract best explanation
      if (text.includes('Best Explanation:')) {
        const bestMatch = text.match(/Best Explanation:(.+?)(?:\n|$)/s);
        if (bestMatch) {
          bestExplanation = bestMatch[1].trim();
        }
      } else if (text.includes('Most Plausible Explanation:')) {
        const bestMatch = text.match(/Most Plausible Explanation:(.+?)(?:\n|$)/s);
        if (bestMatch) {
          bestExplanation = bestMatch[1].trim();
        }
      } else if (explanations.length > 0) {
        // Use the first explanation as the best if not explicitly stated
        bestExplanation = explanations[0].explanation;
      } else {
        // Use the last paragraph as the best explanation
        const paragraphs = text.split('\n\n');
        bestExplanation = paragraphs[paragraphs.length - 1].trim();
      }
      
      // Estimate confidence based on language
      if (text.includes('most likely') || text.includes('best explanation')) {
        confidence = 0.85;
      } else if (text.includes('plausible') || text.includes('reasonable')) {
        confidence = 0.7;
      } else if (text.includes('possible') || text.includes('might explain')) {
        confidence = 0.5;
      } else if (text.includes('speculative') || text.includes('tentative')) {
        confidence = 0.3;
      } else {
        confidence = 0.6; // Default confidence for abductive reasoning
      }
      
      return {
        explanations,
        bestExplanation,
        confidence,
        analysis: text
      };
    } catch (error) {
      this.logger.error(`Error parsing abductive result: ${error.message}`, { error, completion, task });
      throw new Error(`Failed to parse abductive reasoning result: ${error.message}`);
    }
  }
  
  /**
   * Parse and validate analogical reasoning result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} task Original task
   * @returns {Object} Parsed result
   */
  _parseAnalogicalResult(completion, task) {
    try {
      // Extract mappings and conclusion from completion
      const text = completion.text || '';
      
      // Attempt to identify mappings and conclusion
      let mappings = [];
      let conclusion = '';
      let confidence = 0;
      
      // Extract mappings
      const mappingMatches = text.matchAll(/Mapping\s*\d+:(.+?)(?=Mapping\s*\d+:|$)/gs);
      for (const match of mappingMatches) {
        const mappingText = match[1].trim();
        
        // Try to extract source and target elements
        const sourceTargetMatch = mappingText.match(/(.+?)\s*(?:maps to|corresponds to|is analogous to)\s*(.+)/i);
        if (sourceTargetMatch) {
          mappings.push({
            sourceElement: sourceTargetMatch[1].trim(),
            targetElement: sourceTargetMatch[2].trim(),
            relationship: 'maps to'
          });
        } else {
          // If structured format not found, use the whole text
          mappings.push({
            sourceElement: '',
            targetElement: '',
            relationship: mappingText
          });
        }
      }
      
      // If no structured mappings found, try to extract from text
      if (mappings.length === 0) {
        const possibleMappings = text.split('\n').filter(p => 
          p.includes('maps to') || p.includes('corresponds to') || p.includes('analogous to')
        );
        
        for (const mapping of possibleMappings) {
          const sourceTargetMatch = mapping.match(/(.+?)\s*(?:maps to|corresponds to|is analogous to)\s*(.+)/i);
          if (sourceTargetMatch) {
            mappings.push({
              sourceElement: sourceTargetMatch[1].trim(),
              targetElement: sourceTargetMatch[2].trim(),
              relationship: 'maps to'
            });
          }
        }
      }
      
      // Extract conclusion
      if (text.includes('Conclusion:')) {
        const conclusionMatch = text.match(/Conclusion:(.+?)(?:\n|$)/s);
        if (conclusionMatch) {
          conclusion = conclusionMatch[1].trim();
        }
      } else if (text.includes('Answer:')) {
        const conclusionMatch = text.match(/Answer:(.+?)(?:\n|$)/s);
        if (conclusionMatch) {
          conclusion = conclusionMatch[1].trim();
        }
      } else {
        // Use the last paragraph as the conclusion
        const paragraphs = text.split('\n\n');
        conclusion = paragraphs[paragraphs.length - 1].trim();
      }
      
      // Estimate confidence based on language
      if (text.includes('strong analogy') || text.includes('clear mapping')) {
        confidence = 0.9;
      } else if (text.includes('good analogy') || text.includes('valid mapping')) {
        confidence = 0.75;
      } else if (text.includes('partial analogy') || text.includes('some mapping')) {
        confidence = 0.6;
      } else if (text.includes('weak analogy') || text.includes('limited mapping')) {
        confidence = 0.4;
      } else {
        confidence = 0.65; // Default confidence for analogical reasoning
      }
      
      return {
        mappings,
        conclusion,
        confidence,
        analysis: text
      };
    } catch (error) {
      this.logger.error(`Error parsing analogical result: ${error.message}`, { error, completion, task });
      throw new Error(`Failed to parse analogical reasoning result: ${error.message}`);
    }
  }
  
  /**
   * Shutdown the adapter.
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down OpenAIAdapter');
      
      // Clean up model instances
      for (const [key, model] of this.modelInstances.entries()) {
        if (model && typeof model.close === 'function') {
          await model.close();
        }
        this.modelInstances.delete(key);
      }
      
      this.initialized = false;
      this.available = false;
      
      this.logger.info('OpenAIAdapter shut down successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down OpenAIAdapter: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Generate a cache key for the given request.
   * @private
   * @param {string} type Request type
   * @param {Object} options Request options
   * @returns {string} Cache key
   */
  _generateCacheKey(type, options) {
    let content;
    
    switch (type) {
      case 'completion':
        content = `${options.model}:${options.prompt}`;
        break;
      case 'embedding':
        content = `${options.model}:${Array.isArray(options.text) ? options.text.join('|') : options.text}`;
        break;
      case 'image':
        content = `${options.model}:${options.prompt}:${JSON.stringify(options.parameters || {})}`;
        break;
      case 'task':
        content = `${options.model}:${options.type}:${JSON.stringify(options.data)}`;
        break;
      default:
        content = JSON.stringify(options);
    }
    
    const hash = crypto.createHash('sha256').update(`${type}:${content}`).digest('hex');
    return `${type}:${hash}`;
  }
  
  /**
   * Get credentials for API access.
   * @private
   * @param {string} [userId] User ID for personal credentials
   * @returns {Promise<Object|null>} Credentials or null if not available
   */
  async _getCredentials(userId) {
    try {
      // First try to get user-provided credentials if userId is provided
      if (userId) {
        const userCredentials = await this.credentialManager.getUserCredentials(userId, 'openai');
        if (userCredentials && userCredentials.apiKey) {
          return userCredentials;
        }
      }
      
      // Fall back to global credentials if user credentials not available
      const globalCredentials = await this.credentialManager.getGlobalCredentials('openai');
      if (globalCredentials && globalCredentials.apiKey) {
        return globalCredentials;
      }
      
      this.logger.warn('No valid credentials found for OpenAI API');
      return null;
    } catch (error) {
      this.logger.error(`Error getting credentials for OpenAI API: ${error.message}`, { error });
      return null;
    }
  }
  
  /**
   * Detect language of the given text.
   * @private
   * @param {string} text Text to analyze
   * @returns {Promise<string>} Detected language code
   */
  async _detectLanguage(text) {
    try {
      // Use a simple heuristic for common languages
      // In production, this would use a more sophisticated language detection library
      
      // Default to English
      let detectedLanguage = 'en';
      
      // Check for common language patterns
      const langPatterns = {
        en: /\b(the|and|is|in|to|of|that|for)\b/i,
        es: /\b(el|la|los|las|y|es|en|de|que|para)\b/i,
        fr: /\b(le|la|les|et|est|en|de|que|pour)\b/i,
        de: /\b(der|die|das|und|ist|in|zu|von|für)\b/i,
        it: /\b(il|la|i|e|è|in|di|che|per)\b/i,
        pt: /\b(o|a|os|as|e|é|em|de|que|para)\b/i,
        ru: /\b(и|в|не|на|я|что|с|по|это)\b/i,
        zh: /[\u4e00-\u9fff]/,
        ja: /[\u3040-\u309f\u30a0-\u30ff]/,
        ko: /[\uac00-\ud7af\u1100-\u11ff]/
      };
      
      // Count matches for each language
      const matches = {};
      for (const [lang, pattern] of Object.entries(langPatterns)) {
        const match = text.match(pattern);
        matches[lang] = match ? match.length : 0;
      }
      
      // Find language with most matches
      let maxMatches = 0;
      for (const [lang, count] of Object.entries(matches)) {
        if (count > maxMatches) {
          maxMatches = count;
          detectedLanguage = lang;
        }
      }
      
      return detectedLanguage;
    } catch (error) {
      this.logger.error(`Error detecting language: ${error.message}`, { error });
      return 'en'; // Default to English on error
    }
  }
  
  /**
   * Optimize prompt for the given language and task.
   * @private
   * @param {string} prompt Original prompt
   * @param {string} language Detected language
   * @param {string} taskType Task type
   * @returns {Promise<string>} Optimized prompt
   */
  async _optimizePrompt(prompt, language, taskType) {
    try {
      // In a production implementation, this would include more sophisticated
      // prompt optimization based on language and task type
      
      // For now, just add language-specific instructions if not English
      if (language !== 'en') {
        const langNames = {
          es: 'Spanish',
          fr: 'French',
          de: 'German',
          it: 'Italian',
          pt: 'Portuguese',
          ru: 'Russian',
          zh: 'Chinese',
          ja: 'Japanese',
          ko: 'Korean'
        };
        
        const langName = langNames[language] || language;
        
        // Add language instruction based on task type
        if (taskType === 'completion') {
          return `[Respond in ${langName}]\n${prompt}`;
        } else if (taskType === 'embedding') {
          // No changes needed for embeddings
          return prompt;
        } else {
          return `[Process and respond in ${langName}]\n${prompt}`;
        }
      }
      
      return prompt;
    } catch (error) {
      this.logger.error(`Error optimizing prompt: ${error.message}`, { error });
      return prompt; // Return original prompt on error
    }
  }
  
  /**
   * Record metrics for a request.
   * @private
   * @param {string} requestType Request type
   * @param {number} duration Request duration in milliseconds
   * @param {boolean} cached Whether the result was cached
   * @param {Object} options Request options
   * @param {string} model Model used
   * @param {string} [language] Detected language
   */
  _recordMetrics(requestType, duration, cached, options, model, language = 'en') {
    // Update total latency and average
    if (!cached) {
      this.metrics.totalLatency += duration;
      this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.successfulRequests;
    }
    
    // Update request type metrics
    if (!this.metrics.requestsByType[requestType]) {
      this.metrics.requestsByType[requestType] = 0;
    }
    this.metrics.requestsByType[requestType]++;
    
    // Update model metrics
    if (!this.metrics.requestsByModel[model]) {
      this.metrics.requestsByModel[model] = 0;
    }
    this.metrics.requestsByModel[model]++;
    
    // Update language metrics
    if (!this.metrics.requestsByLanguage[language]) {
      this.metrics.requestsByLanguage[language] = 0;
    }
    this.metrics.requestsByLanguage[language]++;
    
    // Emit metrics event
    this.emit('metrics', {
      type: requestType,
      model,
      duration,
      cached,
      language,
      timestamp: Date.now()
    });
  }
  
  /**
   * Estimate cost for API usage.
   * @private
   * @param {string} model Model used
   * @param {Object} [usage] Token usage information
   * @param {Object} [parameters] Request parameters for non-token based pricing
   */
  _estimateCost(model, usage, parameters) {
    try {
      // Pricing information (as of May 2025)
      const pricing = {
        // Completion models
        'gpt-4o': {
          input: 0.000005, // $5 per million input tokens
          output: 0.000015 // $15 per million output tokens
        },
        'gpt-4-turbo': {
          input: 0.00001, // $10 per million input tokens
          output: 0.00003 // $30 per million output tokens
        },
        'gpt-4': {
          input: 0.00003, // $30 per million input tokens
          output: 0.00006 // $60 per million output tokens
        },
        'gpt-3.5-turbo': {
          input: 0.0000005, // $0.50 per million input tokens
          output: 0.0000015 // $1.50 per million output tokens
        },
        // Embedding models
        'text-embedding-3-large': {
          input: 0.000001, // $1 per million tokens
          output: 0
        },
        'text-embedding-3-small': {
          input: 0.0000001, // $0.10 per million tokens
          output: 0
        },
        // Image models
        'dall-e-3': {
          standard: 0.04, // $0.04 per image (1024x1024)
          hd: 0.08 // $0.08 per image (1024x1024 HD)
        },
        'dall-e-2': {
          standard: 0.02 // $0.02 per image (1024x1024)
        }
      };
      
      // Default to GPT-4 pricing if model not found
      const modelPricing = pricing[model] || pricing['gpt-4-turbo'];
      
      // Calculate cost based on usage
      if (usage) {
        const inputCost = (usage.prompt_tokens || 0) * modelPricing.input;
        const outputCost = (usage.completion_tokens || 0) * modelPricing.output;
        const totalCost = inputCost + outputCost;
        
        // Update metrics
        this.metrics.costEstimate += totalCost;
      } 
      // Calculate cost for image generation
      else if (parameters && model.includes('dall-e')) {
        let imageCost = 0;
        
        if (model === 'dall-e-3') {
          imageCost = parameters.quality === 'hd' ? modelPricing.hd : modelPricing.standard;
        } else {
          imageCost = modelPricing.standard;
        }
        
        // Adjust for size if needed
        if (parameters.size && parameters.size !== '1024x1024') {
          // Larger sizes cost more
          if (parameters.size === '1792x1024' || parameters.size === '1024x1792') {
            imageCost *= 2;
          }
        }
        
        // Update metrics
        this.metrics.costEstimate += imageCost;
      }
    } catch (error) {
      this.logger.error(`Error estimating cost: ${error.message}`, { error, model, usage });
      // Non-fatal error, continue without cost estimation
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
        const { request, resolve, reject } = this.requestQueue.shift();
        
        try {
          let result;
          
          if (request.type === 'completion') {
            result = await this.generateCompletion(request.options);
          } else if (request.type === 'embedding') {
            result = await this.generateEmbeddings(request.options);
          } else if (request.type === 'image') {
            result = await this.generateImage(request.options);
          } else if (request.type === 'task') {
            result = await this.processTask(request.options);
          } else {
            throw new Error(`Unsupported request type: ${request.type}`);
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }
}

module.exports = OpenAIAdapter;
