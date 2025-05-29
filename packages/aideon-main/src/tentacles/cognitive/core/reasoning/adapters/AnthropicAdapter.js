/**
 * @fileoverview Adapter for Anthropic models, providing integration with Claude models
 * across all reasoning strategies. This adapter implements the standardized model
 * adapter interface for the Reasoning Engine.
 * 
 * The AnthropicAdapter provides specialized integration with Anthropic's Claude models,
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
 * Adapter for Anthropic models, providing integration with Claude models
 * across all reasoning strategies.
 */
class AnthropicAdapter extends EventEmitter {
  /**
   * Constructor for AnthropicAdapter.
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
    if (!options) throw new Error('Options are required for AnthropicAdapter');
    if (!options.logger) throw new Error('Logger is required for AnthropicAdapter');
    if (!options.configService) throw new Error('ConfigService is required for AnthropicAdapter');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for AnthropicAdapter');
    if (!options.securityManager) throw new Error('SecurityManager is required for AnthropicAdapter');
    if (!options.credentialManager) throw new Error('CredentialManager is required for AnthropicAdapter');
    if (!options.cacheManager) throw new Error('CacheManager is required for AnthropicAdapter');
    
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
    
    this.logger.info('AnthropicAdapter created');
  }
  
  /**
   * Initialize the adapter.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing AnthropicAdapter');
      this.performanceMonitor.startTimer('anthropic.initialize');
      
      // Load configuration
      this.modelConfig = await this.configService.getModelConfig('anthropic');
      if (!this.modelConfig) {
        throw new Error('Failed to load configuration for Anthropic models');
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
      await this.cacheManager.initializeCache('anthropic', {
        maxSize: this.modelConfig.cacheSize || 1000,
        ttl: this.modelConfig.cacheTtl || 3600000 // 1 hour default
      });
      
      // Set up periodic health check
      this._setupHealthCheck();
      
      this.initialized = true;
      this.available = true;
      
      this.performanceMonitor.stopTimer('anthropic.initialize');
      this.logger.info('AnthropicAdapter initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('anthropic.initialize');
      this.logger.error(`Failed to initialize AnthropicAdapter: ${error.message}`, { error });
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
    this.logger.info('Initializing Anthropic API client');
    
    try {
      // Check for API configuration
      if (!this.modelConfig.apiEndpoint) {
        throw new Error('API endpoint not specified in configuration');
      }
      
      // Test API connectivity with credentials
      const credentials = await this._getCredentials();
      if (!credentials) {
        throw new Error('No valid credentials available for Anthropic API');
      }
      
      // Create API client
      const { AnthropicClient } = require(this.modelConfig.apiModule || './anthropic_client');
      
      const apiClient = new AnthropicClient({
        apiEndpoint: this.modelConfig.apiEndpoint,
        apiVersion: this.modelConfig.apiVersion || 'v1',
        timeout: this.modelConfig.timeout || 60000,
        logger: this.logger
      });
      
      // Test connection
      await apiClient.testConnection(credentials);
      
      this.modelInstances.set('default', apiClient);
      this.logger.info('Anthropic API client initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Anthropic API client: ${error.message}`, { error });
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
          
          this.logger.info(`Anthropic API availability changed to: ${isAvailable}`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for Anthropic API: ${error.message}`, { error });
      }
    }, healthCheckInterval);
  }
  
  /**
   * Get adapter information.
   * @returns {Object} Adapter information
   */
  getAdapterInfo() {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      version: '1.0.0',
      provider: 'Anthropic',
      description: 'Adapter for Anthropic models, providing integration with Claude models across all reasoning strategies',
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
      maxTokens: this.modelConfig?.contextSize || 200000, // Claude 3 Opus default
      supportsStreaming: this.modelConfig?.supportsStreaming || true,
      strengths: [
        'reasoning',
        'instruction-following',
        'complex-tasks',
        'safety',
        'multilingual',
        'creative-writing'
      ],
      supportedTasks: [
        'completion',
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
      this.performanceMonitor.startTimer('anthropic.isAvailable');
      
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
      this.performanceMonitor.stopTimer('anthropic.isAvailable');
      return isAvailable;
    } catch (error) {
      this.performanceMonitor.stopTimer('anthropic.isAvailable');
      this.logger.error(`Error checking Anthropic API availability: ${error.message}`, { error });
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
      throw new Error('AnthropicAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('Anthropic API is not available');
    }
    
    if (!options || !options.prompt) {
      throw new Error('Prompt is required for completion generation');
    }
    
    try {
      this.performanceMonitor.startTimer('anthropic.generateCompletion');
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'completion',
        userId: options.userId,
        subscriptionTier: options.subscriptionTier,
        modelId: 'anthropic',
        content: options.prompt
      });
      
      // Determine model to use
      const model = options.model || this.defaultModel;
      if (!this.supportedModels.includes(model)) {
        throw new Error(`Unsupported model: ${model}`);
      }
      
      // Check cache first
      const cacheKey = this._generateCacheKey('completion', { ...options, model });
      const cachedResult = await this.cacheManager.get('anthropic', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer('anthropic.generateCompletion');
        this._recordMetrics('completion', 0, true, options, model);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(options.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for Anthropic API');
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
        this.metrics.tokenUsage.prompt += result.usage.input_tokens || 0;
        this.metrics.tokenUsage.completion += result.usage.output_tokens || 0;
        this.metrics.tokenUsage.total += (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0);
        
        // Estimate cost
        this._estimateCost(model, result.usage);
      }
      
      // Cache result
      await this.cacheManager.set('anthropic', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('completion', duration, false, options, model, detectedLanguage);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer('anthropic.generateCompletion');
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer('anthropic.generateCompletion');
      this.logger.error(`Error generating completion with Anthropic API: ${error.message}`, { error, options });
      
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
   * Process a reasoning task using Anthropic models.
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
      throw new Error('AnthropicAdapter is not initialized');
    }
    
    if (!this.available) {
      throw new Error('Anthropic API is not available');
    }
    
    if (!task || !task.type || !task.data) {
      throw new Error('Invalid task for processing');
    }
    
    try {
      this.performanceMonitor.startTimer(`anthropic.processTask.${task.type}`);
      this.metrics.totalRequests++;
      
      // Apply security policies
      await this.securityManager.validateRequest({
        type: 'task',
        taskType: task.type,
        userId: task.userId,
        subscriptionTier: task.subscriptionTier,
        modelId: 'anthropic',
        content: JSON.stringify(task.data)
      });
      
      // Determine model to use
      const model = task.model || this.defaultModel;
      if (!this.supportedModels.includes(model)) {
        throw new Error(`Unsupported model: ${model}`);
      }
      
      // Check cache first
      const cacheKey = this._generateCacheKey('task', { ...task, model });
      const cachedResult = await this.cacheManager.get('anthropic', cacheKey);
      
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.performanceMonitor.stopTimer(`anthropic.processTask.${task.type}`);
        this._recordMetrics('task', 0, true, task, model);
        return cachedResult;
      }
      
      this.metrics.cacheMisses++;
      
      // Get credentials
      const credentials = await this._getCredentials(task.userId);
      if (!credentials) {
        throw new Error('No valid credentials available for Anthropic API');
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
      await this.cacheManager.set('anthropic', cacheKey, result);
      
      // Record metrics
      this._recordMetrics('task', duration, false, task, model);
      
      this.metrics.successfulRequests++;
      this.performanceMonitor.stopTimer(`anthropic.processTask.${task.type}`);
      
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.performanceMonitor.stopTimer(`anthropic.processTask.${task.type}`);
      this.logger.error(`Error processing task with Anthropic API: ${error.message}`, { error, task });
      
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
    
    // Prepare tool for structured output
    const tools = [
      {
        name: 'submit_deductive_reasoning',
        description: 'Submit the results of deductive reasoning analysis',
        input_schema: {
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
    
    // Generate completion with tool use
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.1, // Lower temperature for logical reasoning
        max_tokens: 2048,
        top_p: 0.95,
        tools,
        tool_choice: { name: 'submit_deductive_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract tool use result
    let result;
    if (completion.tool_use && completion.tool_use.name === 'submit_deductive_reasoning') {
      try {
        result = completion.tool_use.input;
      } catch (error) {
        this.logger.error(`Error parsing tool use result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse deductive reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseDeductiveResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'anthropic',
      model,
      taskType: 'deductive',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.input_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.output_tokens || 0;
      this.metrics.tokenUsage.total += (completion.usage.input_tokens || 0) + (completion.usage.output_tokens || 0);
      
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
    
    // Prepare tool for structured output
    const tools = [
      {
        name: 'submit_inductive_reasoning',
        description: 'Submit the results of inductive reasoning analysis',
        input_schema: {
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
    
    // Generate completion with tool use
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.3, // Moderate temperature for pattern recognition
        max_tokens: 2048,
        top_p: 0.9,
        tools,
        tool_choice: { name: 'submit_inductive_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract tool use result
    let result;
    if (completion.tool_use && completion.tool_use.name === 'submit_inductive_reasoning') {
      try {
        result = completion.tool_use.input;
      } catch (error) {
        this.logger.error(`Error parsing tool use result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse inductive reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseInductiveResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'anthropic',
      model,
      taskType: 'inductive',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.input_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.output_tokens || 0;
      this.metrics.tokenUsage.total += (completion.usage.input_tokens || 0) + (completion.usage.output_tokens || 0);
      
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
    
    // Prepare tool for structured output
    const tools = [
      {
        name: 'submit_abductive_reasoning',
        description: 'Submit the results of abductive reasoning analysis',
        input_schema: {
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
    
    // Generate completion with tool use
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.7, // Higher temperature for creative explanations
        max_tokens: 2048,
        top_p: 0.9,
        tools,
        tool_choice: { name: 'submit_abductive_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract tool use result
    let result;
    if (completion.tool_use && completion.tool_use.name === 'submit_abductive_reasoning') {
      try {
        result = completion.tool_use.input;
      } catch (error) {
        this.logger.error(`Error parsing tool use result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse abductive reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseAbductiveResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'anthropic',
      model,
      taskType: 'abductive',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.input_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.output_tokens || 0;
      this.metrics.tokenUsage.total += (completion.usage.input_tokens || 0) + (completion.usage.output_tokens || 0);
      
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
    
    // Prepare tool for structured output
    const tools = [
      {
        name: 'submit_analogical_reasoning',
        description: 'Submit the results of analogical reasoning analysis',
        input_schema: {
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
    
    // Generate completion with tool use
    const completion = await apiClient.generateCompletion({
      prompt,
      parameters: {
        model,
        temperature: 0.5, // Balanced temperature for analogical mapping
        max_tokens: 2048,
        top_p: 0.9,
        tools,
        tool_choice: { name: 'submit_analogical_reasoning' }
      },
      credentials,
      context: task.context
    });
    
    // Extract tool use result
    let result;
    if (completion.tool_use && completion.tool_use.name === 'submit_analogical_reasoning') {
      try {
        result = completion.tool_use.input;
      } catch (error) {
        this.logger.error(`Error parsing tool use result: ${error.message}`, { error, completion });
        throw new Error(`Failed to parse analogical reasoning result: ${error.message}`);
      }
    } else {
      // Fallback to parsing from text
      result = this._parseAnalogicalResult(completion, task);
    }
    
    // Add metadata
    result.metadata = {
      modelId: 'anthropic',
      model,
      taskType: 'analogical',
      timestamp: Date.now()
    };
    
    // Update token usage metrics
    if (completion.usage) {
      this.metrics.tokenUsage.prompt += completion.usage.input_tokens || 0;
      this.metrics.tokenUsage.completion += completion.usage.output_tokens || 0;
      this.metrics.tokenUsage.total += (completion.usage.input_tokens || 0) + (completion.usage.output_tokens || 0);
      
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
Human: You are performing deductive reasoning to draw logical conclusions from given premises.

${premisesText}

Query: ${query}

Based on the premises above, determine if the query logically follows. 
Provide your reasoning step by step, and conclude with a definitive answer.

Use the submit_deductive_reasoning tool to provide your structured analysis.
