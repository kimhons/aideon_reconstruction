/**
 * @fileoverview Integration Manager for Decision Intelligence Tentacle
 * 
 * This module provides integration between advanced ML models, domain-specific frameworks,
 * and collaborative decision-making features for the Decision Intelligence Tentacle.
 */

const { Logger } = require('../../../../core/logging/Logger');
const { EventEmitter } = require('../../../../core/events/EventEmitter');
const { AdvancedMLModelsManager } = require('../advanced_ml/AdvancedMLModelsManager');
const { DomainFrameworkRegistry } = require('../domain_frameworks/DomainFrameworkRegistry');
const { CollaborationManager } = require('../collaboration/CollaborationManager');

/**
 * Integration Manager for Decision Intelligence components
 */
class IntegrationManager {
  /**
   * Creates a new instance of the Integration Manager
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('IntegrationManager');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      enableCaching: config.enableCaching !== false,
      cacheTTL: config.cacheTTL || 300, // 5 minutes in seconds
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      defaultTimeout: config.defaultTimeout || 30000, // 30 seconds
      ...config
    };
    
    // State
    this.cache = new Map();
    this.activeRequests = new Map();
    
    // Component managers
    this.mlManager = null;
    this.domainRegistry = null;
    this.collaborationManager = null;
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.processDecision = this.processDecision.bind(this);
    this.getRecommendation = this.getRecommendation.bind(this);
    this.evaluateOptions = this.evaluateOptions.bind(this);
    this.analyzeData = this.analyzeData.bind(this);
    this.explainDecision = this.explainDecision.bind(this);
    this.createCollaborativeSession = this.createCollaborativeSession.bind(this);
  }
  
  /**
   * Initializes the Integration Manager
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Integration Manager');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Initialize component managers
      this.mlManager = new AdvancedMLModelsManager(this.aideon);
      this.domainRegistry = new DomainFrameworkRegistry(this.aideon);
      this.collaborationManager = new CollaborationManager(this.aideon);
      
      await this.mlManager.initialize();
      await this.domainRegistry.initialize();
      await this.collaborationManager.initialize();
      
      // Initialize integration components
      this.pipelineManager = this._createPipelineManager();
      this.modelSelector = this._createModelSelector();
      this.frameworkSelector = this._createFrameworkSelector();
      
      this.initialized = true;
      this.logger.info('Integration Manager initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'integrationManager' });
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('integration');
      
      if (config) {
        this.config.enableCaching = config.get('enableCaching') !== false;
        this.config.cacheTTL = config.get('cacheTTL') || this.config.cacheTTL;
        this.config.maxConcurrentRequests = config.get('maxConcurrentRequests') || this.config.maxConcurrentRequests;
        this.config.defaultTimeout = config.get('defaultTimeout') || this.config.defaultTimeout;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Creates a pipeline manager
   * @private
   * @returns {Object} Pipeline manager
   */
  _createPipelineManager() {
    this.logger.info('Creating pipeline manager');
    
    return {
      /**
       * Creates a decision pipeline
       * @param {string} domain Domain name
       * @param {string} decisionType Decision type
       * @param {Object} options Pipeline options
       * @returns {Object} Decision pipeline
       */
      createPipeline: (domain, decisionType, options = {}) => {
        try {
          // Get domain framework
          const framework = this.domainRegistry.getFramework(domain);
          
          if (!framework) {
            throw new Error(`Domain framework not found: ${domain}`);
          }
          
          // Create pipeline stages
          const stages = [];
          
          // 1. Data Analysis Stage
          stages.push({
            name: 'dataAnalysis',
            execute: async (context) => {
              this.logger.info('Executing data analysis stage', { domain, decisionType });
              
              // Select appropriate ML models for data analysis
              const modelIds = this.modelSelector.selectModelsForTask('dataAnalysis', {
                domain,
                decisionType,
                dataTypes: context.dataTypes || []
              });
              
              // Analyze data using domain framework and ML models
              const analysisResults = await this.analyzeData(
                context.data,
                {
                  domain,
                  decisionType,
                  modelIds,
                  ...options.dataAnalysis
                }
              );
              
              return {
                ...context,
                analysisResults
              };
            }
          });
          
          // 2. Option Evaluation Stage
          stages.push({
            name: 'optionEvaluation',
            execute: async (context) => {
              this.logger.info('Executing option evaluation stage', { domain, decisionType });
              
              // Select appropriate ML models for option evaluation
              const modelIds = this.modelSelector.selectModelsForTask('optionEvaluation', {
                domain,
                decisionType,
                optionTypes: context.options.map(option => option.type)
              });
              
              // Evaluate options using domain framework and ML models
              const evaluationResults = await this.evaluateOptions(
                context.options,
                context.criteria,
                {
                  domain,
                  decisionType,
                  analysisResults: context.analysisResults,
                  modelIds,
                  ...options.optionEvaluation
                }
              );
              
              return {
                ...context,
                evaluationResults
              };
            }
          });
          
          // 3. Recommendation Generation Stage
          stages.push({
            name: 'recommendationGeneration',
            execute: async (context) => {
              this.logger.info('Executing recommendation generation stage', { domain, decisionType });
              
              // Select appropriate ML models for recommendation generation
              const modelIds = this.modelSelector.selectModelsForTask('recommendationGeneration', {
                domain,
                decisionType
              });
              
              // Generate recommendations using domain framework and ML models
              const recommendations = await this.getRecommendation(
                context.options,
                context.evaluationResults,
                {
                  domain,
                  decisionType,
                  analysisResults: context.analysisResults,
                  modelIds,
                  ...options.recommendationGeneration
                }
              );
              
              return {
                ...context,
                recommendations
              };
            }
          });
          
          // 4. Explanation Generation Stage
          stages.push({
            name: 'explanationGeneration',
            execute: async (context) => {
              this.logger.info('Executing explanation generation stage', { domain, decisionType });
              
              // Select appropriate ML models for explanation generation
              const modelIds = this.modelSelector.selectModelsForTask('explanationGeneration', {
                domain,
                decisionType,
                explanationTypes: options.explanationTypes || ['factor', 'comparative', 'counterfactual']
              });
              
              // Generate explanations using domain framework and ML models
              const explanations = await this.explainDecision(
                context.recommendations,
                context.evaluationResults,
                {
                  domain,
                  decisionType,
                  analysisResults: context.analysisResults,
                  options: context.options,
                  modelIds,
                  ...options.explanationGeneration
                }
              );
              
              return {
                ...context,
                explanations
              };
            }
          });
          
          // Create pipeline
          const pipeline = {
            domain,
            decisionType,
            stages,
            options,
            
            /**
             * Executes the pipeline
             * @param {Object} context Initial context
             * @returns {Promise<Object>} Final context
             */
            execute: async (context) => {
              this.logger.info('Executing decision pipeline', { domain, decisionType });
              
              let currentContext = { ...context };
              
              // Execute each stage
              for (const stage of stages) {
                try {
                  this.logger.info(`Executing pipeline stage: ${stage.name}`);
                  currentContext = await stage.execute(currentContext);
                } catch (error) {
                  this.logger.error(`Error in pipeline stage: ${stage.name}`, error);
                  
                  // Add error to context
                  currentContext.errors = currentContext.errors || {};
                  currentContext.errors[stage.name] = error.message;
                  
                  // If stage is critical and should stop pipeline on error
                  if (options.criticalStages && options.criticalStages.includes(stage.name)) {
                    throw new Error(`Critical pipeline stage failed: ${stage.name} - ${error.message}`);
                  }
                }
              }
              
              return currentContext;
            }
          };
          
          this.logger.info('Decision pipeline created', { domain, decisionType, stagesCount: stages.length });
          
          return pipeline;
        } catch (error) {
          this.logger.error('Error creating decision pipeline', error);
          throw error;
        }
      }
    };
  }
  
  /**
   * Creates a model selector
   * @private
   * @returns {Object} Model selector
   */
  _createModelSelector() {
    this.logger.info('Creating model selector');
    
    return {
      /**
       * Selects models for a specific task
       * @param {string} task Task name
       * @param {Object} context Task context
       * @returns {Array<string>} Selected model IDs
       */
      selectModelsForTask: (task, context) => {
        try {
          const { domain, decisionType } = context;
          
          // Get all available models
          const allModels = this.mlManager.modelRegistry.listModels();
          
          // Filter models by task
          let models = allModels.filter(model => model.tasks && model.tasks.includes(task));
          
          // Filter models by domain if specified
          if (domain) {
            models = models.filter(model => !model.domains || model.domains.includes(domain));
          }
          
          // Filter models by decision type if specified
          if (decisionType) {
            models = models.filter(model => !model.decisionTypes || model.decisionTypes.includes(decisionType));
          }
          
          // Additional task-specific filtering
          switch (task) {
            case 'dataAnalysis':
              if (context.dataTypes && context.dataTypes.length > 0) {
                models = models.filter(model => {
                  if (!model.dataTypes) return true;
                  return context.dataTypes.some(type => model.dataTypes.includes(type));
                });
              }
              break;
              
            case 'optionEvaluation':
              if (context.optionTypes && context.optionTypes.length > 0) {
                models = models.filter(model => {
                  if (!model.optionTypes) return true;
                  return context.optionTypes.some(type => model.optionTypes.includes(type));
                });
              }
              break;
              
            case 'explanationGeneration':
              if (context.explanationTypes && context.explanationTypes.length > 0) {
                models = models.filter(model => {
                  if (!model.explanationTypes) return true;
                  return context.explanationTypes.some(type => model.explanationTypes.includes(type));
                });
              }
              break;
          }
          
          // Sort models by accuracy (descending)
          models.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
          
          // Select top models (limit to 3 per task to avoid overloading)
          const selectedModels = models.slice(0, 3);
          
          this.logger.info('Models selected for task', { 
            task, 
            domain, 
            decisionType, 
            selectedCount: selectedModels.length,
            totalAvailable: models.length
          });
          
          return selectedModels.map(model => model.id);
        } catch (error) {
          this.logger.error('Error selecting models for task', error);
          return [];
        }
      }
    };
  }
  
  /**
   * Creates a framework selector
   * @private
   * @returns {Object} Framework selector
   */
  _createFrameworkSelector() {
    this.logger.info('Creating framework selector');
    
    return {
      /**
       * Selects the most appropriate domain framework for a decision
       * @param {Object} context Decision context
       * @returns {string} Selected domain name
       */
      selectFramework: (context) => {
        try {
          const { domain, decisionType, data, options } = context;
          
          // If domain is explicitly specified, use it
          if (domain && this.domainRegistry.hasFramework(domain)) {
            return domain;
          }
          
          // Get all available frameworks
          const frameworks = this.domainRegistry.listFrameworks();
          
          // Calculate match score for each framework
          const scores = frameworks.map(framework => {
            let score = 0;
            
            // Check if framework supports the decision type
            if (framework.supportedDecisionTypes.includes(decisionType)) {
              score += 10;
            }
            
            // Check data compatibility
            if (data && framework.dataCompatibility) {
              const dataTypes = Object.keys(data);
              const compatibleTypes = dataTypes.filter(type => framework.dataCompatibility.includes(type));
              score += (compatibleTypes.length / dataTypes.length) * 5;
            }
            
            // Check option compatibility
            if (options && framework.optionCompatibility) {
              const optionTypes = options.map(option => option.type);
              const uniqueTypes = [...new Set(optionTypes)];
              const compatibleTypes = uniqueTypes.filter(type => framework.optionCompatibility.includes(type));
              score += (compatibleTypes.length / uniqueTypes.length) * 5;
            }
            
            return {
              domain: framework.domain,
              score
            };
          });
          
          // Sort by score (descending)
          scores.sort((a, b) => b.score - a.score);
          
          // Select framework with highest score
          const selectedDomain = scores.length > 0 ? scores[0].domain : 'general';
          
          this.logger.info('Framework selected', { 
            selectedDomain, 
            decisionType,
            scores: scores.map(s => `${s.domain}: ${s.score}`).join(', ')
          });
          
          return selectedDomain;
        } catch (error) {
          this.logger.error('Error selecting framework', error);
          return 'general';
        }
      }
    };
  }
  
  /**
   * Processes a decision request
   * @param {Object} request Decision request
   * @param {Object} options Processing options
   * @returns {Promise<Object>} Decision result
   */
  async processDecision(request, options = {}) {
    if (!this.initialized) {
      throw new Error('Integration Manager not initialized');
    }
    
    this.logger.info('Processing decision request', { 
      decisionType: request.decisionType,
      domain: request.domain,
      options
    });
    
    try {
      // Generate request ID
      const requestId = options.requestId || this._generateId();
      
      // Check cache if enabled
      if (this.config.enableCaching && !options.skipCache) {
        const cacheKey = this._generateCacheKey(request);
        
        if (this.cache.has(cacheKey)) {
          const cachedResult = this.cache.get(cacheKey);
          
          // Check if cache is still valid
          if (cachedResult.expiresAt > Date.now()) {
            this.logger.info('Decision result found in cache', { requestId, cacheKey });
            return cachedResult.result;
          }
          
          // Cache expired, remove from cache
          this.cache.delete(cacheKey);
        }
      }
      
      // Check if maximum concurrent requests is reached
      if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
        throw new Error('Maximum concurrent requests reached');
      }
      
      // Add to active requests
      this.activeRequests.set(requestId, {
        request,
        startedAt: Date.now()
      });
      
      // Select domain framework if not specified
      const domain = request.domain || this.frameworkSelector.selectFramework({
        decisionType: request.decisionType,
        data: request.data,
        options: request.options
      });
      
      // Create decision pipeline
      const pipeline = this.pipelineManager.createPipeline(domain, request.decisionType, options);
      
      // Prepare initial context
      const initialContext = {
        data: request.data || {},
        options: request.options || [],
        criteria: request.criteria || [],
        constraints: request.constraints || [],
        preferences: request.preferences || {}
      };
      
      // Execute pipeline
      const result = await pipeline.execute(initialContext);
      
      // Add to cache if enabled
      if (this.config.enableCaching && !options.skipCache) {
        const cacheKey = this._generateCacheKey(request);
        
        this.cache.set(cacheKey, {
          result,
          createdAt: Date.now(),
          expiresAt: Date.now() + (options.cacheTTL || this.config.cacheTTL) * 1000
        });
      }
      
      // Remove from active requests
      this.activeRequests.delete(requestId);
      
      this.logger.info('Decision request processed successfully', { 
        requestId,
        domain,
        decisionType: request.decisionType,
        processingTime: Date.now() - this.activeRequests.get(requestId).startedAt
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error processing decision request', error);
      throw error;
    }
  }
  
  /**
   * Generates a recommendation based on options and evaluation results
   * @param {Array<Object>} options Decision options
   * @param {Object} evaluationResults Evaluation results
   * @param {Object} context Additional context
   * @returns {Promise<Object>} Recommendation
   */
  async getRecommendation(options, evaluationResults, context = {}) {
    if (!this.initialized) {
      throw new Error('Integration Manager not initialized');
    }
    
    this.logger.info('Generating recommendation', { 
      optionsCount: options.length,
      domain: context.domain,
      decisionType: context.decisionType
    });
    
    try {
      // Get domain framework
      const framework = this.domainRegistry.getFramework(context.domain);
      
      if (!framework) {
        throw new Error(`Domain framework not found: ${context.domain}`);
      }
      
      // Get recommendation generator from framework
      const recommendationGenerator = framework.getRecommendationGenerator();
      
      // Load ML models if specified
      const models = [];
      
      if (context.modelIds && context.modelIds.length > 0) {
        for (const modelId of context.modelIds) {
          try {
            const model = await this.mlManager.loadModel(modelId);
            models.push({ id: modelId, model });
          } catch (error) {
            this.logger.error(`Error loading model: ${modelId}`, error);
          }
        }
      }
      
      // Generate recommendation
      const recommendation = await recommendationGenerator.generateRecommendation(
        options,
        evaluationResults,
        {
          ...context,
          models
        }
      );
      
      this.logger.info('Recommendation generated', { 
        domain: context.domain,
        decisionType: context.decisionType,
        topOptionId: recommendation.topOption?.id
      });
      
      return recommendation;
    } catch (error) {
      this.logger.error('Error generating recommendation', error);
      throw error;
    }
  }
  
  /**
   * Evaluates options based on criteria
   * @param {Array<Object>} options Decision options
   * @param {Array<Object>} criteria Evaluation criteria
   * @param {Object} context Additional context
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateOptions(options, criteria, context = {}) {
    if (!this.initialized) {
      throw new Error('Integration Manager not initialized');
    }
    
    this.logger.info('Evaluating options', { 
      optionsCount: options.length,
      criteriaCount: criteria.length,
      domain: context.domain,
      decisionType: context.decisionType
    });
    
    try {
      // Get domain framework
      const framework = this.domainRegistry.getFramework(context.domain);
      
      if (!framework) {
        throw new Error(`Domain framework not found: ${context.domain}`);
      }
      
      // Get option evaluator from framework
      const optionEvaluator = framework.getOptionEvaluator();
      
      // Load ML models if specified
      const models = [];
      
      if (context.modelIds && context.modelIds.length > 0) {
        for (const modelId of context.modelIds) {
          try {
            const model = await this.mlManager.loadModel(modelId);
            models.push({ id: modelId, model });
          } catch (error) {
            this.logger.error(`Error loading model: ${modelId}`, error);
          }
        }
      }
      
      // Evaluate options
      const evaluationResults = await optionEvaluator.evaluateOptions(
        options,
        criteria,
        {
          ...context,
          models
        }
      );
      
      this.logger.info('Options evaluated', { 
        domain: context.domain,
        decisionType: context.decisionType,
        optionsCount: options.length,
        criteriaCount: criteria.length
      });
      
      return evaluationResults;
    } catch (error) {
      this.logger.error('Error evaluating options', error);
      throw error;
    }
  }
  
  /**
   * Analyzes data for decision-making
   * @param {Object} data Input data
   * @param {Object} context Additional context
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeData(data, context = {}) {
    if (!this.initialized) {
      throw new Error('Integration Manager not initialized');
    }
    
    this.logger.info('Analyzing data', { 
      dataKeys: Object.keys(data),
      domain: context.domain,
      decisionType: context.decisionType
    });
    
    try {
      // Get domain framework
      const framework = this.domainRegistry.getFramework(context.domain);
      
      if (!framework) {
        throw new Error(`Domain framework not found: ${context.domain}`);
      }
      
      // Get data analyzer from framework
      const dataAnalyzer = framework.getDataAnalyzer();
      
      // Load ML models if specified
      const models = [];
      
      if (context.modelIds && context.modelIds.length > 0) {
        for (const modelId of context.modelIds) {
          try {
            const model = await this.mlManager.loadModel(modelId);
            models.push({ id: modelId, model });
          } catch (error) {
            this.logger.error(`Error loading model: ${modelId}`, error);
          }
        }
      }
      
      // Analyze data
      const analysisResults = await dataAnalyzer.analyzeData(
        data,
        {
          ...context,
          models
        }
      );
      
      this.logger.info('Data analyzed', { 
        domain: context.domain,
        decisionType: context.decisionType,
        dataKeys: Object.keys(data),
        resultKeys: Object.keys(analysisResults)
      });
      
      return analysisResults;
    } catch (error) {
      this.logger.error('Error analyzing data', error);
      throw error;
    }
  }
  
  /**
   * Explains a decision
   * @param {Object} recommendation Recommendation
   * @param {Object} evaluationResults Evaluation results
   * @param {Object} context Additional context
   * @returns {Promise<Object>} Explanation
   */
  async explainDecision(recommendation, evaluationResults, context = {}) {
    if (!this.initialized) {
      throw new Error('Integration Manager not initialized');
    }
    
    this.logger.info('Explaining decision', { 
      domain: context.domain,
      decisionType: context.decisionType,
      explanationTypes: context.explanationTypes
    });
    
    try {
      // Get domain framework
      const framework = this.domainRegistry.getFramework(context.domain);
      
      if (!framework) {
        throw new Error(`Domain framework not found: ${context.domain}`);
      }
      
      // Get explanation engine from framework
      const explanationEngine = framework.getExplanationEngine();
      
      // Load ML models if specified
      const models = [];
      
      if (context.modelIds && context.modelIds.length > 0) {
        for (const modelId of context.modelIds) {
          try {
            const model = await this.mlManager.loadModel(modelId);
            models.push({ id: modelId, model });
          } catch (error) {
            this.logger.error(`Error loading model: ${modelId}`, error);
          }
        }
      }
      
      // Generate explanation
      const explanation = await explanationEngine.explainDecision(
        recommendation,
        evaluationResults,
        {
          ...context,
          models
        }
      );
      
      this.logger.info('Decision explained', { 
        domain: context.domain,
        decisionType: context.decisionType,
        explanationTypes: Object.keys(explanation)
      });
      
      return explanation;
    } catch (error) {
      this.logger.error('Error explaining decision', error);
      throw error;
    }
  }
  
  /**
   * Creates a collaborative decision session
   * @param {string} ownerId Owner ID
   * @param {string} name Session name
   * @param {Object} decisionRequest Decision request
   * @param {Object} options Session options
   * @returns {Promise<Object>} Session information
   */
  async createCollaborativeSession(ownerId, name, decisionRequest, options = {}) {
    if (!this.initialized) {
      throw new Error('Integration Manager not initialized');
    }
    
    this.logger.info('Creating collaborative decision session', { 
      ownerId,
      name,
      decisionType: decisionRequest.decisionType,
      domain: decisionRequest.domain
    });
    
    try {
      // Create session
      const session = this.collaborationManager.createSession(ownerId, name, options);
      
      // Process initial decision
      const initialResult = await this.processDecision(decisionRequest, {
        requestId: session.id,
        skipCache: true
      });
      
      // Add decision to session
      const decisionId = this._generateId();
      
      this.collaborationManager.submitInput(session.id, ownerId, 'decision', {
        decision: {
          id: decisionId,
          title: name,
          description: options.description || `Collaborative decision: ${name}`,
          options: initialResult.recommendations.options.map(option => ({
            id: option.id,
            title: option.name || option.id
          }))
        }
      });
      
      // Store decision context
      const sessionState = this.collaborationManager.getSessionState(session.id);
      sessionState.decisionContext = {
        request: decisionRequest,
        result: initialResult
      };
      
      this.logger.info('Collaborative decision session created', { 
        sessionId: session.id,
        ownerId,
        name,
        decisionId
      });
      
      return {
        session,
        decisionId,
        initialResult
      };
    } catch (error) {
      this.logger.error('Error creating collaborative decision session', error);
      throw error;
    }
  }
  
  /**
   * Generates a unique ID
   * @private
   * @returns {string} Unique ID
   */
  _generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Generates a cache key for a request
   * @private
   * @param {Object} request Request object
   * @returns {string} Cache key
   */
  _generateCacheKey(request) {
    return JSON.stringify({
      domain: request.domain,
      decisionType: request.decisionType,
      data: request.data,
      options: request.options,
      criteria: request.criteria,
      constraints: request.constraints,
      preferences: request.preferences
    });
  }
  
  /**
   * Shuts down the Integration Manager
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Integration Manager');
    
    try {
      // Shutdown component managers
      await this.mlManager.shutdown();
      await this.domainRegistry.shutdown();
      await this.collaborationManager.shutdown();
      
      // Clear cache and active requests
      this.cache.clear();
      this.activeRequests.clear();
      
      this.initialized = false;
      this.logger.info('Integration Manager shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'integrationManager' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
}

module.exports = { IntegrationManager };
