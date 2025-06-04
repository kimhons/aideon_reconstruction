/**
 * @fileoverview Adapter for OpenHermes models, providing efficient routing and coordination
 * capabilities across all reasoning strategies. This adapter implements the standardized model
 * adapter interface for the Reasoning Engine.
 * 
 * The OpenHermesAdapter provides specialized integration with OpenHermes
 * models, optimizing for high-efficiency routing and coordination tasks while supporting 
 * both local and API-based deployment options.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * Adapter for OpenHermes models, providing efficient routing and coordination
 * capabilities across all reasoning strategies.
 */
class OpenHermesAdapter extends EventEmitter {
  /**
   * Constructor for OpenHermesAdapter.
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
    if (!options) throw new Error('Options are required for OpenHermesAdapter');
    if (!options.logger) throw new Error('Logger is required for OpenHermesAdapter');
    if (!options.configService) throw new Error('ConfigService is required for OpenHermesAdapter');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for OpenHermesAdapter');
    if (!options.securityManager) throw new Error('SecurityManager is required for OpenHermesAdapter');
    if (!options.credentialManager) throw new Error('CredentialManager is required for OpenHermesAdapter');
    if (!options.cacheManager) throw new Error('CacheManager is required for OpenHermesAdapter');
    
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
      requestsByLanguage: {},
      routingDecisions: 0,
      routingAccuracy: 1.0
    };
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.isAvailable = this.isAvailable.bind(this);
    this.generateCompletion = this.generateCompletion.bind(this);
    this.generateEmbeddings = this.generateEmbeddings.bind(this);
    this.processTask = this.processTask.bind(this);
    this.routeRequest = this.routeRequest.bind(this);
    this.getCapabilities = this.getCapabilities.bind(this);
    this.getResourceRequirements = this.getResourceRequirements.bind(this);
    this.getAdapterInfo = this.getAdapterInfo.bind(this);
    this._processQueue = this._processQueue.bind(this);
    this._getCredentials = this._getCredentials.bind(this);
    this._detectLanguage = this._detectLanguage.bind(this);
    this._optimizePrompt = this._optimizePrompt.bind(this);
    this._recordMetrics = this._recordMetrics.bind(this);
    
    this.logger.info('OpenHermesAdapter created');
  }
  
  /**
   * Initialize the adapter.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing OpenHermesAdapter');
      this.performanceMonitor.startTimer('openHermes.initialize');
      
      // Load configuration
      this.modelConfig = await this.configService.getModelConfig('openhermes');
      if (!this.modelConfig) {
        throw new Error('Failed to load configuration for OpenHermes model');
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
      await this.cacheManager.initializeCache('openhermes', {
        maxSize: this.modelConfig.cacheSize || 1000,
        ttl: this.modelConfig.cacheTtl || 3600000 // 1 hour default
      });
      
      // Set up periodic health check
      this._setupHealthCheck();
      
      // Initialize routing model
      await this._initializeRoutingModel();
      
      this.initialized = true;
      this.available = true;
      
      this.performanceMonitor.stopTimer('openHermes.initialize');
      this.logger.info('OpenHermesAdapter initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('openHermes.initialize');
      this.logger.error(`Failed to initialize OpenHermesAdapter: ${error.message}`, { error });
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
    this.logger.info('Initializing local OpenHermes model');
    
    try {
      // Check if model files exist
      const modelPath = this.modelConfig.modelPath;
      if (!modelPath) {
        throw new Error('Model path not specified in configuration');
      }
      
      await fs.access(modelPath);
      
      // Load model based on configuration
      const { OpenHermesModel } = require(this.modelConfig.modelModule || './openhermes_model');
      
      const model = new OpenHermesModel({
        modelPath,
        contextSize: this.modelConfig.contextSize || 4096,
        batchSize: this.modelConfig.batchSize || 512,
        threads: this.modelConfig.threads || 4,
        logger: this.logger
      });
      
      await model.load();
      
      this.modelInstances.set('default', model);
      this.logger.info('Local OpenHermes model initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize local OpenHermes model: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Initialize API-based model deployment.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeApiModel() {
    this.logger.info('Initializing API-based OpenHermes model');
    
    try {
      // Check for API configuration
      if (!this.modelConfig.apiEndpoint) {
        throw new Error('API endpoint not specified in configuration');
      }
      
      // Test API connectivity with credentials
      const credentials = await this._getCredentials();
      if (!credentials) {
        throw new Error('No valid credentials available for OpenHermes API');
      }
      
      // Create API client
      const { OpenHermesApiClient } = require(this.modelConfig.apiModule || './openhermes_api_client');
      
      const apiClient = new OpenHermesApiClient({
        apiEndpoint: this.modelConfig.apiEndpoint,
        apiVersion: this.modelConfig.apiVersion || 'v1',
        timeout: this.modelConfig.timeout || 30000,
        logger: this.logger
      });
      
      // Test connection
      await apiClient.testConnection(credentials);
      
      this.modelInstances.set('default', apiClient);
      this.logger.info('API-based OpenHermes model initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize API-based OpenHermes model: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Initialize the routing model for request classification and routing.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeRoutingModel() {
    this.logger.info('Initializing OpenHermes routing model');
    
    try {
      // Load routing model configuration
      const routingConfig = this.modelConfig.routingModel || {};
      
      // Create routing model
      const { RoutingModel } = require(routingConfig.modelModule || './routing_model');
      
      const routingModel = new RoutingModel({
        modelPath: routingConfig.modelPath,
        configPath: routingConfig.configPath,
        logger: this.logger
      });
      
      await routingModel.load();
      
      this.modelInstances.set('routing', routingModel);
      this.logger.info('OpenHermes routing model initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize OpenHermes routing model: ${error.message}`, { error });
      // Non-fatal error, continue without routing model
      this.logger.warn('Continuing without specialized routing model, will use default routing logic');
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
          
          this.logger.info(`OpenHermes model availability changed to: ${isAvailable}`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for OpenHermes model: ${error.message}`, { error });
      }
    }, healthCheckInterval);
  }
  
  /**
   * Get adapter information.
   * @returns {Object} Adapter information
   */
  getAdapterInfo() {
    return {
      id: 'openhermes',
      name: 'OpenHermes 2.5',
      version: '1.0.0',
      provider: 'Technology Innovation Institute',
      description: 'Adapter for OpenHermes models, providing efficient routing and coordination capabilities across all reasoning strategies',
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
      maxTokens: this.modelConfig?.contextSize || 4096,
      supportsStreaming: this.modelConfig?.supportsStreaming || true,
      strengths: [
        'routing',
        'coordination',
        'classification',
        'instruction-following',
        'efficiency'
      ],
      supportedTasks: [
        'completion',
        'embedding',
        'classification',
        'routing',
        'coordination'
      ]
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
      recommendedGPU: this.modelConfig?.resourceRequirements?.recommendedGPU || 4096 // 4GB
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
      this.performanceMonitor.startTimer('openHermes.isAvailable');
      
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
        this.performanceMonitor.stopTimer('openHermes.isAvailable');
        return isAvailable;
      }
      
      // For local models, check if model is loaded
      const isAvailable = model.isLoaded ? model.isLoaded() : true;
      this.performanceMonitor.stopTimer('openHermes.isAvailable');
      return isAvailable;
    } catch (error) {
      this.performanceMonitor.stopTimer('openHermes.isAvailable');
      this.logger.error(`Error checking OpenHermes model availability: ${error.message}`, { error });
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
      throw new Error('OpenHermesAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenHermes model is not available');
    }
    
    if (!options || !options.prompt) {
      throw new Error('Prompt is required for completion generation');
    }
    
    try {
      this.performanceMonitor.startTimer('openHermes.generateCompletion');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'completion',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'openhermes',
        content: options.prompt
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('completion', options);
      const cachedResult = await this.cacheManager.get('openhermes', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('openHermes.generateCompletion');
        this._recordMetrics('completion', 0, true, options);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenHermes model');
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
      await this.cacheManager.set('openhermes', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('completion', duration, false, options, detectedLanguage);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('openHermes.generateCompletion');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('openHermes.generateCompletion');
      this.logger.error(`Error generating completion with OpenHermes model: ${error.message}`, { error, options });
      
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
      throw new Error('OpenHermesAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenHermes model is not available');
    }
    
    if (!options || !options.text) {
      throw new Error('Text is required for embedding generation');
    }
    
    try {
      this.performanceMonitor.startTimer('openHermes.generateEmbeddings');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'embedding',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'openhermes',
        content: Array.isArray(options.text) ? options.text.join(' ') : options.text
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('embedding', options);
      const cachedResult = await this.cacheManager.get('openhermes', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('openHermes.generateEmbeddings');
        this._recordMetrics('embedding', 0, true, options);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenHermes model');
      }
      
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
      
      // Generate embeddings
      const startTime = Date.now();
      
      const result = await model.generateEmbeddings({
        text: options.text,
        parameters,
        credentials
      });
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('openhermes', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('embedding', duration, false, options);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('openHermes.generateEmbeddings');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('openHermes.generateEmbeddings');
      this.logger.error(`Error generating embeddings with OpenHermes model: ${error.message}`, { error, options });
      
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
   * Process a reasoning task using the OpenHermes model.
   * @param {Object} task Reasoning task
   * @param {string} task.type Task type (e.g., 'deductive', 'inductive')
   * @param {Object} task.data Task data
   * @param {Object} task.context Task context
   * @param {string} task.userId User ID for credential lookup
   * @param {string} task.subscriptionTier User subscription tier
   * @returns {Promise<Object>} Task result
   */
  async processTask(task) {
    if (!this.initialized) {
      throw new Error('OpenHermesAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenHermes model is not available');
    }
    
    if (!task || !task.type || !task.data) {
      throw new Error('Invalid task for processing');
    }
    
    try {
      this.performanceMonitor.startTimer(`openHermes.processTask.${task.type}`);
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'task',
        taskType: task.type,
        userId: task.userId,
        subscriptionTier: task.subscriptionTier,
        modelId: 'openhermes',
        content: JSON.stringify(task.data)
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('task', task);
      const cachedResult = await this.cacheManager.get('openhermes', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer(`openHermes.processTask.${task.type}`);
        this._recordMetrics('task', 0, true, task);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(task.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenHermes model');
      }
      
      // Process task based on type
      const startTime = Date.now();
      let result;
      
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
        case 'routing':
          result = await this._processRoutingTask(task, credentials);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('openhermes', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('task', duration, false, task);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer(`openHermes.processTask.${task.type}`);
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer(`openHermes.processTask.${task.type}`);
      this.logger.error(`Error processing task with OpenHermes model: ${error.message}`, { error, task });
      
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
   * Route a request to the appropriate model or service.
   * @param {Object} request Request to route
   * @param {string} request.type Request type (e.g., 'completion', 'embedding', 'task')
   * @param {Object} request.data Request data
   * @param {Object} request.context Request context
   * @param {string} request.userId User ID for credential lookup
   * @param {string} request.subscriptionTier User subscription tier
   * @param {Array<string>} [request.availableModels] List of available models to route to
   * @returns {Promise<Object>} Routing decision
   */
  async routeRequest(request) {
    if (!this.initialized) {
      throw new Error('OpenHermesAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('OpenHermes model is not available');
    }
    
    if (!request || !request.type || !request.data) {
      throw new Error('Invalid request for routing');
    }
    
    try {
      this.performanceMonitor.startTimer('openHermes.routeRequest');
      this.metrics.totalRequests++;
      this.metrics.routingDecisions++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'routing',
        userId: request.userId,
        subscriptionTier: request.subscriptionTier,
        modelId: 'openhermes',
        content: JSON.stringify(request.data)
      });
      
      // Check cache first
      const cacheKey = this._generateCacheKey('routing', request);
      const cachedResult = await this.cacheManager.get('openhermes', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('openHermes.routeRequest');
        this._recordMetrics('routing', 0, true, request);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(request.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for OpenHermes model');
      }
      
      // Get routing model instance
      const routingModel = this.modelInstances.get('routing') || this.modelInstances.get('default');
      if (!routingModel) {
        throw new Error('Routing model instance not found');
      }
      
      // Prepare routing prompt
      const routingPrompt = this._prepareRoutingPrompt(request);
      
      // Generate routing decision
      const startTime = Date.now();
      
      const completion = await routingModel.generateCompletion({
        prompt: routingPrompt,
        parameters: {
          temperature: 0.2, // Lower temperature for deterministic routing
          max_tokens: 256,
          top_p: 0.95
        },
        credentials,
        context: request.context
      });
      
      // Parse routing decision
      const routingDecision = this._parseRoutingDecision(completion, request);
      
      const duration = Date.now() - startTime;
      
      // Cache result
      await this.cacheManager.set('openhermes', cacheKey, routingDecision);
      
      // Record metrics
      this._recordMetrics('routing', duration, false, request);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('openHermes.routeRequest');
      
      return routingDecision;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('openHermes.routeRequest');
      this.logger.error(`Error routing request with OpenHermes model: ${error.message}`, { error, request });
      
      // Emit error event
      this.emit('error', {
        type: 'routing',
        message: error.message,
        error,
        request
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
    const model = this.modelInstances.get('default');
    
    // Prepare prompt for deductive reasoning
    const prompt = this._prepareDeductivePrompt(task.data, task.context);
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt,
      parameters: {
        temperature: 0.2, // Lower temperature for logical reasoning
        max_tokens: 1024,
        top_p: 0.95
      },
      credentials,
      context: task.context
    });
    
    // Parse and validate result
    return this._parseDeductiveResult(completion, task);
  }
  
  /**
   * Process an inductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processInductiveTask(task, credentials) {
    const model = this.modelInstances.get('default');
    
    // Prepare prompt for inductive reasoning
    const prompt = this._prepareInductivePrompt(task.data, task.context);
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt,
      parameters: {
        temperature: 0.4, // Moderate temperature for pattern recognition
        max_tokens: 1024,
        top_p: 0.9
      },
      credentials,
      context: task.context
    });
    
    // Parse and validate result
    return this._parseInductiveResult(completion, task);
  }
  
  /**
   * Process an abductive reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processAbductiveTask(task, credentials) {
    const model = this.modelInstances.get('default');
    
    // Prepare prompt for abductive reasoning
    const prompt = this._prepareAbductivePrompt(task.data, task.context);
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt,
      parameters: {
        temperature: 0.7, // Higher temperature for creative explanations
        max_tokens: 1536,
        top_p: 0.85
      },
      credentials,
      context: task.context
    });
    
    // Parse and validate result
    return this._parseAbductiveResult(completion, task);
  }
  
  /**
   * Process an analogical reasoning task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processAnalogicalTask(task, credentials) {
    const model = this.modelInstances.get('default');
    
    // Prepare prompt for analogical reasoning
    const prompt = this._prepareAnalogicalPrompt(task.data, task.context);
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt,
      parameters: {
        temperature: 0.5, // Balanced temperature for analogical mapping
        max_tokens: 1280,
        top_p: 0.9
      },
      credentials,
      context: task.context
    });
    
    // Parse and validate result
    return this._parseAnalogicalResult(completion, task);
  }
  
  /**
   * Process a routing task.
   * @private
   * @param {Object} task Task data
   * @param {Object} credentials API credentials
   * @returns {Promise<Object>} Task result
   */
  async _processRoutingTask(task, credentials) {
    const model = this.modelInstances.get('routing') || this.modelInstances.get('default');
    
    // Prepare prompt for routing
    const prompt = this._prepareRoutingPrompt(task.data);
    
    // Generate completion
    const completion = await model.generateCompletion({
      prompt,
      parameters: {
        temperature: 0.2, // Lower temperature for deterministic routing
        max_tokens: 512,
        top_p: 0.95
      },
      credentials,
      context: task.context
    });
    
    // Parse and validate result
    return this._parseRoutingResult(completion, task);
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
   * Prepare prompt for request routing.
   * @private
   * @param {Object} request Request data
   * @returns {string} Formatted prompt
   */
  _prepareRoutingPrompt(request) {
    // Extract request details
    const requestType = request.type || '';
    const requestData = request.data || {};
    const availableModels = request.availableModels || [];
    
    // Format available models
    const modelsText = availableModels.length > 0 
      ? availableModels.map((model, index) => `Model ${index + 1}: ${model}`).join('\n')
      : 'No specific models provided. Choose the most appropriate model type.';
    
    // Format request data
    let dataText = '';
    if (typeof requestData === 'string') {
      dataText = requestData;
    } else if (requestData.prompt) {
      dataText = requestData.prompt;
    } else if (requestData.text) {
      dataText = Array.isArray(requestData.text) ? requestData.text.join('\n') : requestData.text;
    } else {
      dataText = JSON.stringify(requestData, null, 2);
    }
    
    // Truncate data if too long
    if (dataText.length > 2000) {
      dataText = dataText.substring(0, 2000) + '... [truncated]';
    }
    
    // Construct prompt
    return `
You are a routing system that determines the most appropriate model or service to handle a given request.

Request Type: ${requestType}
Request Data:
${dataText}

Available Models:
${modelsText}

Based on the request type and data, determine the most appropriate model or service to handle this request.
Consider the following factors:
1. Task complexity and nature
2. Language and domain requirements
3. Efficiency and resource constraints
4. Specialized capabilities needed

Provide your analysis and conclude with a specific routing decision in the format:
ROUTE TO: [model_name]
CONFIDENCE: [confidence_score between 0 and 1]
REASONING: [brief explanation]

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
        metadata: {
          modelId: 'openhermes',
          taskType: 'deductive',
          timestamp: Date.now()
        }
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
        analysis: text,
        metadata: {
          modelId: 'openhermes',
          taskType: 'inductive',
          timestamp: Date.now()
        }
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
        explanations.push(match[1].trim());
      }
      
      // If no structured explanations found, try to extract from text
      if (explanations.length === 0) {
        const possibleExplanations = text.split('\n\n').filter(p => 
          p.includes('explanation') || p.includes('hypothesis') || p.includes('possibility')
        );
        
        if (possibleExplanations.length > 0) {
          explanations = possibleExplanations;
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
        bestExplanation = explanations[0];
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
        analysis: text,
        metadata: {
          modelId: 'openhermes',
          taskType: 'abductive',
          timestamp: Date.now()
        }
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
        mappings.push(match[1].trim());
      }
      
      // If no structured mappings found, try to extract from text
      if (mappings.length === 0) {
        const possibleMappings = text.split('\n').filter(p => 
          p.includes('maps to') || p.includes('corresponds to') || p.includes('analogous to')
        );
        
        if (possibleMappings.length > 0) {
          mappings = possibleMappings;
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
        analysis: text,
        metadata: {
          modelId: 'openhermes',
          taskType: 'analogical',
          timestamp: Date.now()
        }
      };
    } catch (error) {
      this.logger.error(`Error parsing analogical result: ${error.message}`, { error, completion, task });
      throw new Error(`Failed to parse analogical reasoning result: ${error.message}`);
    }
  }
  
  /**
   * Parse and validate routing result.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} task Original task
   * @returns {Object} Parsed result
   */
  _parseRoutingResult(completion, task) {
    try {
      // Extract routing decision from completion
      const text = completion.text || '';
      
      // Attempt to identify the routing decision
      let targetModel = '';
      let confidence = 0;
      let reasoning = '';
      
      // Extract target model
      const routeMatch = text.match(/ROUTE TO:\s*([^\n]+)/i);
      if (routeMatch) {
        targetModel = routeMatch[1].trim();
      } else if (text.includes('Route to')) {
        const altRouteMatch = text.match(/Route to\s*([^\n]+)/i);
        if (altRouteMatch) {
          targetModel = altRouteMatch[1].trim();
        }
      }
      
      // Extract confidence
      const confidenceMatch = text.match(/CONFIDENCE:\s*(0\.\d+|1\.0|1)/i);
      if (confidenceMatch) {
        confidence = parseFloat(confidenceMatch[1]);
      } else {
        // Estimate confidence based on language
        if (text.includes('definitely') || text.includes('certainly')) {
          confidence = 0.95;
        } else if (text.includes('strongly recommend') || text.includes('best choice')) {
          confidence = 0.85;
        } else if (text.includes('recommend') || text.includes('good choice')) {
          confidence = 0.75;
        } else if (text.includes('suggest') || text.includes('consider')) {
          confidence = 0.6;
        } else {
          confidence = 0.7; // Default confidence
        }
      }
      
      // Extract reasoning
      const reasoningMatch = text.match(/REASONING:\s*([^\n]+(?:\n[^\n]+)*)/i);
      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim();
      } else {
        // Use the text excluding the routing decision as reasoning
        reasoning = text.replace(/ROUTE TO:\s*[^\n]+/i, '')
                       .replace(/CONFIDENCE:\s*(0\.\d+|1\.0|1)/i, '')
                       .trim();
      }
      
      // If no target model found, use a default or extract from text
      if (!targetModel) {
        // Try to find model name in text
        const modelNames = ['llama', 'mistral', 'openhermes', 'openai', 'anthropic', 'google', 'deepseek', 'grok'];
        for (const name of modelNames) {
          if (text.toLowerCase().includes(name)) {
            targetModel = name;
            break;
          }
        }
        
        // If still no target, use default
        if (!targetModel) {
          targetModel = 'default';
        }
      }
      
      return {
        targetModel,
        confidence,
        reasoning,
        analysis: text,
        metadata: {
          modelId: 'openhermes',
          taskType: 'routing',
          timestamp: Date.now()
        }
      };
    } catch (error) {
      this.logger.error(`Error parsing routing result: ${error.message}`, { error, completion, task });
      throw new Error(`Failed to parse routing result: ${error.message}`);
    }
  }
  
  /**
   * Parse routing decision from completion.
   * @private
   * @param {Object} completion Model completion
   * @param {Object} request Original request
   * @returns {Object} Parsed routing decision
   */
  _parseRoutingDecision(completion, request) {
    try {
      // Extract routing decision from completion
      const text = completion.text || '';
      
      // Attempt to identify the routing decision
      let targetModel = '';
      let confidence = 0;
      let reasoning = '';
      
      // Extract target model
      const routeMatch = text.match(/ROUTE TO:\s*([^\n]+)/i);
      if (routeMatch) {
        targetModel = routeMatch[1].trim();
      } else if (text.includes('Route to')) {
        const altRouteMatch = text.match(/Route to\s*([^\n]+)/i);
        if (altRouteMatch) {
          targetModel = altRouteMatch[1].trim();
        }
      }
      
      // Extract confidence
      const confidenceMatch = text.match(/CONFIDENCE:\s*(0\.\d+|1\.0|1)/i);
      if (confidenceMatch) {
        confidence = parseFloat(confidenceMatch[1]);
      } else {
        // Estimate confidence based on language
        if (text.includes('definitely') || text.includes('certainly')) {
          confidence = 0.95;
        } else if (text.includes('strongly recommend') || text.includes('best choice')) {
          confidence = 0.85;
        } else if (text.includes('recommend') || text.includes('good choice')) {
          confidence = 0.75;
        } else if (text.includes('suggest') || text.includes('consider')) {
          confidence = 0.6;
        } else {
          confidence = 0.7; // Default confidence
        }
      }
      
      // Extract reasoning
      const reasoningMatch = text.match(/REASONING:\s*([^\n]+(?:\n[^\n]+)*)/i);
      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim();
      } else {
        // Use the text excluding the routing decision as reasoning
        reasoning = text.replace(/ROUTE TO:\s*[^\n]+/i, '')
                       .replace(/CONFIDENCE:\s*(0\.\d+|1\.0|1)/i, '')
                       .trim();
      }
      
      // If no target model found, use a default or extract from text
      if (!targetModel) {
        // Try to find model name in text
        const modelNames = ['llama', 'mistral', 'openhermes', 'openai', 'anthropic', 'google', 'deepseek', 'grok'];
        for (const name of modelNames) {
          if (text.toLowerCase().includes(name)) {
            targetModel = name;
            break;
          }
        }
        
        // If still no target, use default
        if (!targetModel) {
          targetModel = 'default';
        }
      }
      
      // Check if target model is in available models
      if (request.availableModels && request.availableModels.length > 0) {
        const normalizedTarget = targetModel.toLowerCase();
        const availableNormalized = request.availableModels.map(m => m.toLowerCase());
        
        // If target not in available models, find closest match
        if (!availableNormalized.includes(normalizedTarget)) {
          for (const name of availableNormalized) {
            if (name.includes(normalizedTarget) || normalizedTarget.includes(name)) {
              targetModel = request.availableModels[availableNormalized.indexOf(name)];
              break;
            }
          }
          
          // If still no match, use first available
          if (!availableNormalized.includes(targetModel.toLowerCase())) {
            targetModel = request.availableModels[0];
            confidence = Math.max(0.5, confidence - 0.2); // Reduce confidence for fallback
          }
        } else {
          // Use the correctly cased version from available models
          targetModel = request.availableModels[availableNormalized.indexOf(normalizedTarget)];
        }
      }
      
      return {
        targetModel,
        confidence,
        reasoning,
        requestType: request.type,
        metadata: {
          modelId: 'openhermes',
          timestamp: Date.now()
        }
      };
    } catch (error) {
      this.logger.error(`Error parsing routing decision: ${error.message}`, { error, completion, request });
      
      // Provide a fallback routing decision
      return {
        targetModel: request.availableModels ? request.availableModels[0] : 'default',
        confidence: 0.5,
        reasoning: 'Fallback routing due to parsing error',
        requestType: request.type,
        metadata: {
          modelId: 'openhermes',
          timestamp: Date.now(),
          error: error.message
        }
      };
    }
  }
  
  /**
   * Shutdown the adapter.
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down OpenHermesAdapter');
      
      // Clean up model instances
      for (const [key, model] of this.modelInstances.entries()) {
        if (model && typeof model.unload === 'function') {
          await model.unload();
        }
        this.modelInstances.delete(key);
      }
      
      this.initialized = false;
      this.available = false;
      
      this.logger.info('OpenHermesAdapter shut down successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down OpenHermesAdapter: ${error.message}`, { error });
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
    const content = type === 'completion' ? options.prompt :
                   type === 'embedding' ? (Array.isArray(options.text) ? options.text.join('|') : options.text) :
                   type === 'routing' ? `${options.type}:${JSON.stringify(options.data)}` :
                   JSON.stringify(options);
    
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
        const userCredentials = await this.credentialManager.getUserCredentials(userId, 'openhermes');
        if (userCredentials && userCredentials.apiKey) {
          return userCredentials;
        }
      }
      
      // Fall back to global credentials if user credentials not available
      const globalCredentials = await this.credentialManager.getGlobalCredentials('openhermes');
      if (globalCredentials && globalCredentials.apiKey) {
        return globalCredentials;
      }
      
      this.logger.warn('No valid credentials found for OpenHermes model');
      return null;
    } catch (error) {
      this.logger.error(`Error getting credentials for OpenHermes model: ${error.message}`, { error });
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
        } else if (taskType === 'routing') {
          // For routing, always use English for consistency
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
   * @param {string} [language] Detected language
   */
  _recordMetrics(requestType, duration, cached, options, language = 'en') {
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
    
    // Update language metrics
    if (!this.metrics.requestsByLanguage[language]) {
      this.metrics.requestsByLanguage[language] = 0;
    }
    this.metrics.requestsByLanguage[language]++;
    
    // Emit metrics event
    this.emit('metrics', {
      type: requestType,
      duration,
      cached,
      language,
      timestamp: Date.now()
    });
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
          } else if (request.type === 'task') {
            result = await this.processTask(request.options);
          } else if (request.type === 'routing') {
            result = await this.routeRequest(request.options);
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

module.exports = OpenHermesAdapter;
