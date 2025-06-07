/**
 * @fileoverview Decision Intelligence Pipeline
 * 
 * This module implements the end-to-end pipeline for the Decision Intelligence Tentacle,
 * integrating all functional components to provide comprehensive decision support.
 */

const { Logger } = require('../../core/logging/Logger');
const { EventEmitter } = require('../../core/events/EventEmitter');
const { DataAnalyzer } = require('./data_analyzer/DataAnalyzer');
const { OptionEvaluator } = require('./option_evaluator/OptionEvaluator');
const { RecommendationGenerator } = require('./recommendation/RecommendationGenerator');
const { ExplanationEngine } = require('./explanation/ExplanationEngine');

/**
 * Decision Intelligence Pipeline
 * 
 * Coordinates the flow of data through the Decision Intelligence components
 * to provide comprehensive decision support.
 */
class DecisionIntelligencePipeline {
  /**
   * Creates a new instance of the Decision Intelligence Pipeline
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('DecisionIntelligencePipeline');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      enabledComponents: config.enabledComponents || ['dataAnalyzer', 'optionEvaluator', 'recommendationGenerator', 'explanationEngine'],
      pipelineTimeout: config.pipelineTimeout || 60000, // 1 minute default timeout
      cacheResults: config.cacheResults !== undefined ? config.cacheResults : true
    };
    
    // Component instances
    this.dataAnalyzer = null;
    this.optionEvaluator = null;
    this.recommendationGenerator = null;
    this.explanationEngine = null;
    
    // Results cache
    this.resultsCache = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.processPipeline = this.processPipeline.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Decision Intelligence Pipeline
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Decision Intelligence Pipeline');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Initialize components
      await this._initializeComponents();
      
      this.initialized = true;
      this.logger.info('Decision Intelligence Pipeline initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'decisionIntelligencePipeline' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('pipeline');
      
      if (config) {
        this.config.enabledComponents = config.get('enabledComponents') || this.config.enabledComponents;
        this.config.pipelineTimeout = config.get('pipelineTimeout') || this.config.pipelineTimeout;
        this.config.cacheResults = config.get('cacheResults') !== undefined ? config.get('cacheResults') : this.config.cacheResults;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Initializes all enabled components
   * @private
   * @returns {Promise<void>} A promise that resolves when all components are initialized
   */
  async _initializeComponents() {
    // Initialize Data Analyzer if enabled
    if (this.config.enabledComponents.includes('dataAnalyzer')) {
      this.logger.info('Initializing Data Analyzer');
      this.dataAnalyzer = new DataAnalyzer(this.aideon);
      await this.dataAnalyzer.initialize();
    }
    
    // Initialize Option Evaluator if enabled
    if (this.config.enabledComponents.includes('optionEvaluator')) {
      this.logger.info('Initializing Option Evaluator');
      this.optionEvaluator = new OptionEvaluator(this.aideon);
      await this.optionEvaluator.initialize();
    }
    
    // Initialize Recommendation Generator if enabled
    if (this.config.enabledComponents.includes('recommendationGenerator')) {
      this.logger.info('Initializing Recommendation Generator');
      this.recommendationGenerator = new RecommendationGenerator(this.aideon);
      await this.recommendationGenerator.initialize();
    }
    
    // Initialize Explanation Engine if enabled
    if (this.config.enabledComponents.includes('explanationEngine')) {
      this.logger.info('Initializing Explanation Engine');
      this.explanationEngine = new ExplanationEngine(this.aideon);
      await this.explanationEngine.initialize();
    }
    
    this.logger.info('All components initialized successfully');
  }
  
  /**
   * Shuts down the Decision Intelligence Pipeline
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Decision Intelligence Pipeline');
    
    try {
      // Shutdown components in reverse order
      if (this.explanationEngine) {
        await this.explanationEngine.shutdown();
      }
      
      if (this.recommendationGenerator) {
        await this.recommendationGenerator.shutdown();
      }
      
      if (this.optionEvaluator) {
        await this.optionEvaluator.shutdown();
      }
      
      if (this.dataAnalyzer) {
        await this.dataAnalyzer.shutdown();
      }
      
      // Clear cache
      this.resultsCache.clear();
      
      this.initialized = false;
      this.logger.info('Decision Intelligence Pipeline shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'decisionIntelligencePipeline' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Decision Intelligence Pipeline
   * @returns {Object} Status information
   */
  getStatus() {
    const status = {
      initialized: this.initialized,
      config: this.config,
      components: {
        dataAnalyzer: this.dataAnalyzer ? this.dataAnalyzer.getStatus() : null,
        optionEvaluator: this.optionEvaluator ? this.optionEvaluator.getStatus() : null,
        recommendationGenerator: this.recommendationGenerator ? this.recommendationGenerator.getStatus() : null,
        explanationEngine: this.explanationEngine ? this.explanationEngine.getStatus() : null
      },
      cacheSize: this.resultsCache.size
    };
    
    return status;
  }
  
  /**
   * Processes data through the complete decision intelligence pipeline
   * @param {Object} data The input data for the pipeline
   * @param {Object} context The context for the decision
   * @param {Object} options Processing options
   * @returns {Promise<Object>} A promise that resolves with the pipeline results
   */
  async processPipeline(data, context = {}, options = {}) {
    if (!this.initialized) {
      throw new Error('Decision Intelligence Pipeline not initialized');
    }
    
    if (!data) {
      throw new Error('Data is required');
    }
    
    // Generate cache key if caching is enabled
    let cacheKey = null;
    if (this.config.cacheResults && !options.skipCache) {
      cacheKey = this._generateCacheKey(data, context, options);
      const cachedResult = this._getFromCache(cacheKey);
      if (cachedResult) {
        this.logger.info('Returning cached pipeline result');
        return cachedResult;
      }
    }
    
    this.logger.info('Processing data through decision intelligence pipeline', {
      dataType: typeof data,
      contextType: typeof context,
      options
    });
    
    // Set up timeout if configured
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      if (this.config.pipelineTimeout > 0) {
        timeoutId = setTimeout(() => {
          reject(new Error(`Pipeline processing timed out after ${this.config.pipelineTimeout}ms`));
        }, this.config.pipelineTimeout);
      }
    });
    
    try {
      // Emit pipeline start event
      this.events.emit('pipeline:start', {
        timestamp: Date.now(),
        context
      });
      
      // Create pipeline result object
      const result = {
        timestamp: Date.now(),
        context,
        steps: {},
        recommendations: [],
        explanations: [],
        metadata: {
          processingTime: 0,
          componentsUsed: []
        }
      };
      
      // Process through Data Analyzer if available
      if (this.dataAnalyzer) {
        this.logger.info('Running data analysis step');
        const startTime = Date.now();
        
        const analysisResult = await Promise.race([
          this.dataAnalyzer.analyzeData(data, options),
          timeoutPromise
        ]);
        
        result.steps.analysis = analysisResult;
        result.metadata.componentsUsed.push('dataAnalyzer');
        result.metadata.analysisTime = Date.now() - startTime;
      }
      
      // Process through Option Evaluator if available
      if (this.optionEvaluator && result.steps.analysis) {
        this.logger.info('Running option evaluation step');
        const startTime = Date.now();
        
        const evaluationResult = await Promise.race([
          this.optionEvaluator.evaluateOptions(data, result.steps.analysis, context, options),
          timeoutPromise
        ]);
        
        result.steps.evaluation = evaluationResult;
        result.metadata.componentsUsed.push('optionEvaluator');
        result.metadata.evaluationTime = Date.now() - startTime;
      }
      
      // Process through Recommendation Generator if available
      if (this.recommendationGenerator && result.steps.evaluation) {
        this.logger.info('Running recommendation generation step');
        const startTime = Date.now();
        
        const recommendationResult = await Promise.race([
          this.recommendationGenerator.generateRecommendations(
            result.steps.evaluation,
            context,
            options
          ),
          timeoutPromise
        ]);
        
        result.steps.recommendations = recommendationResult;
        result.recommendations = recommendationResult.recommendations;
        result.metadata.componentsUsed.push('recommendationGenerator');
        result.metadata.recommendationTime = Date.now() - startTime;
      }
      
      // Process through Explanation Engine if available
      if (this.explanationEngine && result.steps.recommendations) {
        this.logger.info('Running explanation generation step');
        const startTime = Date.now();
        
        const explanationResult = await Promise.race([
          this.explanationEngine.generateExplanations(
            result.steps.recommendations,
            result.steps.evaluation,
            result.steps.analysis,
            context,
            options
          ),
          timeoutPromise
        ]);
        
        result.steps.explanations = explanationResult;
        result.explanations = explanationResult.explanations;
        result.metadata.componentsUsed.push('explanationEngine');
        result.metadata.explanationTime = Date.now() - startTime;
      }
      
      // Calculate total processing time
      result.metadata.processingTime = Date.now() - result.timestamp;
      
      // Clear timeout if set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Cache result if enabled
      if (this.config.cacheResults && cacheKey && !options.skipCache) {
        this._addToCache(cacheKey, result);
      }
      
      // Emit pipeline complete event
      this.events.emit('pipeline:complete', {
        timestamp: Date.now(),
        context,
        metadata: result.metadata
      });
      
      return result;
    } catch (error) {
      // Clear timeout if set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      this.logger.error('Pipeline processing failed', error);
      
      // Emit pipeline error event
      this.events.emit('pipeline:error', {
        timestamp: Date.now(),
        context,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Generates a cache key for the given data, context, and options
   * @private
   * @param {Object} data The input data
   * @param {Object} context The context
   * @param {Object} options The options
   * @returns {string} The cache key
   */
  _generateCacheKey(data, context, options) {
    // Create a simplified version of the inputs for the cache key
    const keyData = {
      data: this._simplifyForCacheKey(data),
      context: this._simplifyForCacheKey(context),
      options: this._simplifyForCacheKey(options)
    };
    
    // Generate a string key
    return JSON.stringify(keyData);
  }
  
  /**
   * Simplifies an object for use in cache key generation
   * @private
   * @param {*} obj The object to simplify
   * @returns {*} The simplified object
   */
  _simplifyForCacheKey(obj) {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      // For arrays, simplify each element
      return obj.map(item => this._simplifyForCacheKey(item));
    }
    
    // For objects, create a new object with simplified properties
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions and complex objects that can't be serialized
      if (typeof value !== 'function' && !(value instanceof Error)) {
        result[key] = this._simplifyForCacheKey(value);
      }
    }
    
    return result;
  }
  
  /**
   * Adds a result to the cache
   * @private
   * @param {string} key The cache key
   * @param {Object} result The result to cache
   */
  _addToCache(key, result) {
    // Add to cache with expiry time
    this.resultsCache.set(key, {
      result,
      timestamp: Date.now(),
      expiry: Date.now() + 3600000 // 1 hour expiry
    });
    
    // Limit cache size to 100 entries
    if (this.resultsCache.size > 100) {
      // Remove oldest entry
      let oldestKey = null;
      let oldestTimestamp = Infinity;
      
      for (const [entryKey, entry] of this.resultsCache.entries()) {
        if (entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
          oldestKey = entryKey;
        }
      }
      
      if (oldestKey) {
        this.resultsCache.delete(oldestKey);
      }
    }
  }
  
  /**
   * Gets a result from the cache
   * @private
   * @param {string} key The cache key
   * @returns {Object|null} The cached result or null if not found
   */
  _getFromCache(key) {
    const entry = this.resultsCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.expiry < Date.now()) {
      this.resultsCache.delete(key);
      return null;
    }
    
    return entry.result;
  }
  
  /**
   * Registers API endpoints for the Decision Intelligence Pipeline
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register process endpoint
    api.register(`${namespace}/process`, {
      post: async (req, res) => {
        try {
          const { data, context, options } = req.body;
          
          if (!data) {
            return res.status(400).json({
              error: 'Data is required'
            });
          }
          
          const result = await this.processPipeline(data, context || {}, options || {});
          
          return res.json(result);
        } catch (error) {
          this.logger.error('API error in process endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register status endpoint
    api.register(`${namespace}/status`, {
      get: async (req, res) => {
        try {
          const status = this.getStatus();
          
          return res.json(status);
        } catch (error) {
          this.logger.error('API error in status endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { DecisionIntelligencePipeline };
