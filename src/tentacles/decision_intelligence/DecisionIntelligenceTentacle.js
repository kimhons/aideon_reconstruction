/**
 * @fileoverview Decision Intelligence Tentacle main class
 * 
 * This file contains the main DecisionIntelligenceTentacle class that serves as the
 * entry point for all decision-related functionality in the Aideon AI Desktop Agent.
 * It orchestrates the various components that handle data analysis, option evaluation,
 * recommendation generation, and explanation.
 */

const { EventEmitter } = require('../../core/events/EventEmitter');
const { Logger } = require('../../core/logging/Logger');
const { DataAnalyzer } = require('./data_analyzer/DataAnalyzer');
const { OptionEvaluator } = require('./option_evaluator/OptionEvaluator');
const { RecommendationGenerator } = require('./recommendation_generator/RecommendationGenerator');
const { ExplanationEngine } = require('./explanation_engine/ExplanationEngine');
const { DecisionModelRepository } = require('./model_repository/DecisionModelRepository');
const { AccessControlService } = require('../../core/security/AccessControlService');

/**
 * Main class for the Decision Intelligence Tentacle
 */
class DecisionIntelligenceTentacle {
  /**
   * Creates a new instance of the Decision Intelligence Tentacle
   */
  constructor() {
    this.name = 'decision-intelligence';
    this.displayName = 'Decision Intelligence';
    this.description = 'Enhances decision-making through advanced analytics and recommendations';
    this.version = '1.0.0';
    this.initialized = false;
    this.logger = new Logger('DecisionIntelligenceTentacle');
    this.events = new EventEmitter();
    
    // Component instances will be initialized later
    this.dataAnalyzer = null;
    this.optionEvaluator = null;
    this.recommendationGenerator = null;
    this.explanationEngine = null;
    this.decisionModelRepository = null;
    this.accessControlService = null;
    
    // Aideon core services (will be injected)
    this.aideon = null;
    this.api = null;
    
    // Initialization lock to prevent concurrent initialization
    this.initializationLock = null;
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.executeTask = this.executeTask.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this._registerApiEndpoints = this._registerApiEndpoints.bind(this);
    this._initializeComponents = this._initializeComponents.bind(this);
  }
  
  /**
   * Initializes the Decision Intelligence Tentacle and all its components
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    // Prevent concurrent initialization
    if (this.initializationLock) {
      this.logger.info('Initialization already in progress, waiting for completion');
      return this.initializationLock;
    }
    
    // Return immediately if already initialized
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Decision Intelligence Tentacle');
    
    // Create initialization lock
    this.initializationLock = (async () => {
      try {
        // Initialize access control
        await this._initializeAccessControl();
        
        // Initialize components
        await this._initializeComponents();
        
        // Register API endpoints
        this._registerApiEndpoints();
        
        // Register with metrics system
        this._registerMetrics();
        
        // Mark as initialized
        this.initialized = true;
        this.logger.info('Decision Intelligence Tentacle initialized successfully');
        
        // Emit initialized event
        this.events.emit('initialized', { tentacle: this.name, version: this.version });
      } catch (error) {
        this.logger.error('Initialization failed', error);
        throw error;
      } finally {
        // Clear initialization lock
        this.initializationLock = null;
      }
    })();
    
    return this.initializationLock;
  }
  
  /**
   * Initializes the access control service
   * @private
   * @returns {Promise<void>} A promise that resolves when access control is initialized
   */
  async _initializeAccessControl() {
    this.logger.info('Initializing access control');
    
    // Create access control service
    this.accessControlService = new AccessControlService(this.aideon);
    
    // Initialize access control
    await this.accessControlService.initialize();
    
    this.logger.info('Access control initialized');
  }
  
  /**
   * Initializes all components of the Decision Intelligence Tentacle
   * @private
   * @returns {Promise<void>} A promise that resolves when all components are initialized
   */
  async _initializeComponents() {
    this.logger.info('Initializing components');
    
    // Create component instances
    this.dataAnalyzer = new DataAnalyzer(this.aideon);
    this.optionEvaluator = new OptionEvaluator(this.aideon);
    this.recommendationGenerator = new RecommendationGenerator(this.aideon);
    this.explanationEngine = new ExplanationEngine(this.aideon);
    this.decisionModelRepository = new DecisionModelRepository(this.aideon);
    
    // Initialize components in parallel
    await Promise.all([
      this.dataAnalyzer.initialize(),
      this.optionEvaluator.initialize(),
      this.recommendationGenerator.initialize(),
      this.explanationEngine.initialize(),
      this.decisionModelRepository.initialize()
    ]);
    
    this.logger.info('All components initialized successfully');
  }
  
  /**
   * Registers API endpoints for the Decision Intelligence Tentacle
   * @private
   */
  _registerApiEndpoints() {
    this.logger.info('Registering API endpoints');
    
    // Register core endpoints
    this.api.register(`${this.name}/status`, this.getStatus);
    this.api.register(`${this.name}/task/execute`, this.executeTask);
    
    // Register component-specific endpoints
    this.dataAnalyzer.registerApiEndpoints(this.api, this.name);
    this.optionEvaluator.registerApiEndpoints(this.api, this.name);
    this.recommendationGenerator.registerApiEndpoints(this.api, this.name);
    this.explanationEngine.registerApiEndpoints(this.api, this.name);
    this.decisionModelRepository.registerApiEndpoints(this.api, this.name);
    
    this.logger.info('API endpoints registered successfully');
  }
  
  /**
   * Registers metrics for the Decision Intelligence Tentacle
   * @private
   */
  _registerMetrics() {
    this.logger.info('Registering with metrics system');
    
    if (this.aideon && this.aideon.metrics) {
      this.aideon.metrics.registerTentacle(this.name, {
        version: this.version,
        components: [
          'dataAnalyzer',
          'optionEvaluator',
          'recommendationGenerator',
          'explanationEngine',
          'decisionModelRepository'
        ]
      });
      
      this.logger.info('Metrics registration complete');
    } else {
      this.logger.warn('Metrics system not available, skipping registration');
    }
  }
  
  /**
   * Shuts down the Decision Intelligence Tentacle and all its components
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Decision Intelligence Tentacle');
    
    try {
      // Shut down components in parallel
      await Promise.all([
        this.dataAnalyzer.shutdown(),
        this.optionEvaluator.shutdown(),
        this.recommendationGenerator.shutdown(),
        this.explanationEngine.shutdown(),
        this.decisionModelRepository.shutdown()
      ]);
      
      // Reset state
      this.initialized = false;
      
      // Emit shutdown event
      this.events.emit('shutdown', { tentacle: this.name });
      
      this.logger.info('Decision Intelligence Tentacle shutdown complete');
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Decision Intelligence Tentacle
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: this.name,
      displayName: this.displayName,
      version: this.version,
      initialized: this.initialized,
      components: {
        dataAnalyzer: this.dataAnalyzer ? this.dataAnalyzer.getStatus() : { initialized: false },
        optionEvaluator: this.optionEvaluator ? this.optionEvaluator.getStatus() : { initialized: false },
        recommendationGenerator: this.recommendationGenerator ? this.recommendationGenerator.getStatus() : { initialized: false },
        explanationEngine: this.explanationEngine ? this.explanationEngine.getStatus() : { initialized: false },
        decisionModelRepository: this.decisionModelRepository ? this.decisionModelRepository.getStatus() : { initialized: false }
      }
    };
  }
  
  /**
   * Executes a decision task
   * @param {Object} task The task to execute
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the task result
   */
  async executeTask(task, context) {
    if (!this.initialized) {
      throw new Error('Decision Intelligence Tentacle not initialized');
    }
    
    if (!task) {
      throw new Error('Task is required');
    }
    
    if (!context || !context.userId) {
      throw new Error('Valid context with userId is required');
    }
    
    // Check access
    const hasAccess = await this.accessControlService.hasAccess(context.userId, 'execute');
    if (!hasAccess) {
      throw new Error('Access denied');
    }
    
    this.logger.info(`Executing task: ${task.id || 'unknown'}, type: ${task.type || 'unknown'}`);
    
    // Track task start
    this.events.emit('decision:task:start', { taskId: task.id, type: task.type, userId: context.userId });
    if (this.aideon && this.aideon.metrics) {
      this.aideon.metrics.trackEvent(`${this.name}:task:start`, { taskId: task.id, type: task.type });
    }
    
    try {
      // Normalize task data
      const normalizedTask = this._normalizeTask(task);
      
      // Process based on task type
      let result;
      switch (normalizedTask.type) {
        case 'binary':
          result = await this._processBinaryDecision(normalizedTask, context);
          break;
        case 'multi-option':
          result = await this._processMultiOptionDecision(normalizedTask, context);
          break;
        case 'resource-allocation':
          result = await this._processResourceAllocation(normalizedTask, context);
          break;
        case 'sequencing':
          result = await this._processSequencing(normalizedTask, context);
          break;
        case 'portfolio':
          result = await this._processPortfolioOptimization(normalizedTask, context);
          break;
        case 'parameter':
          result = await this._processParameterOptimization(normalizedTask, context);
          break;
        case 'custom':
          result = await this._processCustomDecision(normalizedTask, context);
          break;
        default:
          throw new Error(`Unsupported decision type: ${normalizedTask.type}`);
      }
      
      // Track task completion
      this.events.emit('decision:task:complete', { 
        taskId: task.id, 
        type: task.type, 
        userId: context.userId,
        success: true
      });
      
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent(`${this.name}:task:complete`, { 
          taskId: task.id, 
          type: task.type,
          success: true
        });
      }
      
      return {
        success: true,
        taskId: task.id,
        type: task.type,
        result
      };
    } catch (error) {
      // Track task error
      this.logger.error(`Task execution failed: ${error.message}`, error);
      
      this.events.emit('decision:task:error', { 
        taskId: task.id, 
        type: task.type, 
        userId: context.userId,
        error: error.message
      });
      
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent(`${this.name}:task:error`, { 
          taskId: task.id, 
          type: task.type,
          error: error.message
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Normalizes a task object to ensure it has all required fields
   * @private
   * @param {Object} task The task to normalize
   * @returns {Object} The normalized task
   */
  _normalizeTask(task) {
    return {
      id: task.id || `decision-${Date.now()}`,
      type: task.type || 'multi-option',
      data: task.data || {},
      options: {
        framework: task.options?.framework || this._getDefaultFramework(task.type),
        explanationLevel: task.options?.explanationLevel || 'detailed',
        timeout: task.options?.timeout || 30000
      }
    };
  }
  
  /**
   * Gets the default decision framework for a given decision type
   * @private
   * @param {string} type The decision type
   * @returns {string} The default framework
   */
  _getDefaultFramework(type) {
    const config = this.aideon?.config?.getNamespace('tentacles')?.getNamespace('decisionIntelligence');
    const defaultFramework = config?.get('defaultDecisionFramework') || 'maut';
    
    // Type-specific defaults
    switch (type) {
      case 'binary':
        return 'expected-utility';
      case 'multi-option':
        return 'maut';
      case 'resource-allocation':
        return 'constraint';
      case 'sequencing':
        return 'optimization';
      case 'portfolio':
        return 'portfolio';
      case 'parameter':
        return 'optimization';
      default:
        return defaultFramework;
    }
  }
  
  /**
   * Processes a binary decision task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processBinaryDecision(task, context) {
    this.logger.info(`Processing binary decision: ${task.id}`);
    
    // Analyze data
    const analysisResult = await this.dataAnalyzer.analyzeData(task.data, {
      decisionType: 'binary',
      framework: task.options.framework
    });
    
    // Evaluate options
    const evaluationResult = await this.optionEvaluator.evaluateOptions(
      task.data.options,
      task.data.preferences,
      {
        analysisResult,
        framework: task.options.framework
      }
    );
    
    // Generate recommendation
    const recommendation = await this.recommendationGenerator.generateRecommendation(
      evaluationResult,
      {
        userId: context.userId,
        decisionType: 'binary',
        framework: task.options.framework
      }
    );
    
    // Generate explanation
    const explanation = await this.explanationEngine.explainRecommendation(
      recommendation,
      evaluationResult,
      {
        level: task.options.explanationLevel,
        userId: context.userId
      }
    );
    
    return {
      recommendation: recommendation.choice,
      confidence: recommendation.confidence,
      explanation: explanation,
      factors: recommendation.factors,
      alternatives: recommendation.alternatives
    };
  }
  
  /**
   * Processes a multi-option decision task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processMultiOptionDecision(task, context) {
    this.logger.info(`Processing multi-option decision: ${task.id}`);
    
    // Analyze data
    const analysisResult = await this.dataAnalyzer.analyzeData(task.data, {
      decisionType: 'multi-option',
      framework: task.options.framework
    });
    
    // Evaluate options
    const evaluationResult = await this.optionEvaluator.evaluateOptions(
      task.data.options,
      task.data.preferences,
      {
        analysisResult,
        constraints: task.data.constraints,
        framework: task.options.framework
      }
    );
    
    // Generate recommendations
    const recommendations = await this.recommendationGenerator.generateRecommendations(
      evaluationResult,
      {
        userId: context.userId,
        decisionType: 'multi-option',
        framework: task.options.framework,
        maxRecommendations: task.data.maxRecommendations || 3
      }
    );
    
    // Generate explanation
    const explanation = await this.explanationEngine.explainRecommendations(
      recommendations,
      evaluationResult,
      {
        level: task.options.explanationLevel,
        userId: context.userId
      }
    );
    
    return {
      recommendations: recommendations.choices,
      topChoice: recommendations.choices[0],
      confidence: recommendations.confidence,
      explanation: explanation,
      factors: recommendations.factors,
      tradeoffs: recommendations.tradeoffs
    };
  }
  
  /**
   * Processes a resource allocation task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processResourceAllocation(task, context) {
    this.logger.info(`Processing resource allocation: ${task.id}`);
    
    // Analyze data
    const analysisResult = await this.dataAnalyzer.analyzeData(task.data, {
      decisionType: 'resource-allocation',
      framework: task.options.framework
    });
    
    // Evaluate allocation options
    const evaluationResult = await this.optionEvaluator.evaluateResourceAllocation(
      task.data.totalResource,
      task.data.categories,
      task.data.preferences,
      {
        analysisResult,
        framework: task.options.framework
      }
    );
    
    // Generate allocation recommendation
    const recommendation = await this.recommendationGenerator.generateAllocation(
      evaluationResult,
      {
        userId: context.userId,
        framework: task.options.framework
      }
    );
    
    // Generate explanation
    const explanation = await this.explanationEngine.explainAllocation(
      recommendation,
      evaluationResult,
      {
        level: task.options.explanationLevel,
        userId: context.userId
      }
    );
    
    // Generate visualization if requested
    let visualization = null;
    if (task.data.generateVisualization) {
      visualization = await this.explanationEngine.generateAllocationVisualization(
        recommendation,
        {
          type: task.data.visualizationType || 'pie',
          colorScheme: task.data.colorScheme || 'default'
        }
      );
    }
    
    return {
      allocation: recommendation.allocation,
      totalAllocated: recommendation.totalAllocated,
      unallocated: recommendation.unallocated,
      confidence: recommendation.confidence,
      explanation: explanation,
      visualization: visualization,
      constraints: recommendation.constraints
    };
  }
  
  /**
   * Processes a sequencing task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processSequencing(task, context) {
    this.logger.info(`Processing sequencing decision: ${task.id}`);
    
    // Analyze data
    const analysisResult = await this.dataAnalyzer.analyzeData(task.data, {
      decisionType: 'sequencing',
      framework: task.options.framework
    });
    
    // Evaluate sequence options
    const evaluationResult = await this.optionEvaluator.evaluateSequence(
      task.data.items,
      task.data.constraints,
      task.data.preferences,
      {
        analysisResult,
        framework: task.options.framework
      }
    );
    
    // Generate sequence recommendation
    const recommendation = await this.recommendationGenerator.generateSequence(
      evaluationResult,
      {
        userId: context.userId,
        framework: task.options.framework
      }
    );
    
    // Generate explanation
    const explanation = await this.explanationEngine.explainSequence(
      recommendation,
      evaluationResult,
      {
        level: task.options.explanationLevel,
        userId: context.userId
      }
    );
    
    return {
      sequence: recommendation.sequence,
      confidence: recommendation.confidence,
      explanation: explanation,
      alternatives: recommendation.alternatives,
      metrics: recommendation.metrics
    };
  }
  
  /**
   * Processes a portfolio optimization task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processPortfolioOptimization(task, context) {
    this.logger.info(`Processing portfolio optimization: ${task.id}`);
    
    // Analyze data
    const analysisResult = await this.dataAnalyzer.analyzeData(task.data, {
      decisionType: 'portfolio',
      framework: task.options.framework
    });
    
    // Evaluate portfolio options
    const evaluationResult = await this.optionEvaluator.evaluatePortfolio(
      task.data.items,
      task.data.constraints,
      task.data.preferences,
      {
        analysisResult,
        framework: task.options.framework
      }
    );
    
    // Generate portfolio recommendation
    const recommendation = await this.recommendationGenerator.generatePortfolio(
      evaluationResult,
      {
        userId: context.userId,
        framework: task.options.framework
      }
    );
    
    // Generate explanation
    const explanation = await this.explanationEngine.explainPortfolio(
      recommendation,
      evaluationResult,
      {
        level: task.options.explanationLevel,
        userId: context.userId
      }
    );
    
    // Generate visualization if requested
    let visualization = null;
    if (task.data.generateVisualization) {
      visualization = await this.explanationEngine.generatePortfolioVisualization(
        recommendation,
        {
          type: task.data.visualizationType || 'bubble',
          dimensions: task.data.visualizationDimensions || ['risk', 'return', 'size']
        }
      );
    }
    
    return {
      portfolio: recommendation.portfolio,
      metrics: recommendation.metrics,
      confidence: recommendation.confidence,
      explanation: explanation,
      visualization: visualization,
      alternatives: recommendation.alternatives
    };
  }
  
  /**
   * Processes a parameter optimization task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processParameterOptimization(task, context) {
    this.logger.info(`Processing parameter optimization: ${task.id}`);
    
    // Analyze data
    const analysisResult = await this.dataAnalyzer.analyzeData(task.data, {
      decisionType: 'parameter',
      framework: task.options.framework
    });
    
    // Evaluate parameter options
    const evaluationResult = await this.optionEvaluator.evaluateParameters(
      task.data.parameters,
      task.data.constraints,
      task.data.objectives,
      {
        analysisResult,
        framework: task.options.framework
      }
    );
    
    // Generate parameter recommendation
    const recommendation = await this.recommendationGenerator.generateParameterValues(
      evaluationResult,
      {
        userId: context.userId,
        framework: task.options.framework
      }
    );
    
    // Generate explanation
    const explanation = await this.explanationEngine.explainParameterValues(
      recommendation,
      evaluationResult,
      {
        level: task.options.explanationLevel,
        userId: context.userId
      }
    );
    
    return {
      parameters: recommendation.parameters,
      objectiveValues: recommendation.objectiveValues,
      confidence: recommendation.confidence,
      explanation: explanation,
      sensitivityAnalysis: recommendation.sensitivityAnalysis
    };
  }
  
  /**
   * Processes a custom decision task
   * @private
   * @param {Object} task The normalized task
   * @param {Object} context The execution context
   * @returns {Promise<Object>} A promise that resolves with the decision result
   */
  async _processCustomDecision(task, context) {
    this.logger.info(`Processing custom decision: ${task.id}`);
    
    // Get custom model
    const customModel = await this.decisionModelRepository.getCustomModel(
      task.data.modelId,
      {
        userId: context.userId
      }
    );
    
    if (!customModel) {
      throw new Error(`Custom model not found: ${task.data.modelId}`);
    }
    
    // Execute custom model
    const result = await this.decisionModelRepository.executeCustomModel(
      customModel,
      task.data,
      {
        userId: context.userId
      }
    );
    
    // Generate explanation if possible
    let explanation = null;
    if (customModel.supportsExplanation) {
      explanation = await this.explanationEngine.explainCustomDecision(
        result,
        customModel,
        {
          level: task.options.explanationLevel,
          userId: context.userId
        }
      );
    }
    
    return {
      ...result,
      explanation: explanation
    };
  }
}

module.exports = {
  DecisionIntelligenceTentacle
};
