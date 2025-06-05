/**
 * EnhancedStrategyFactory.js
 * 
 * Factory for creating and enhancing recovery strategies based on error context
 * and system state. This component is responsible for generating optimized
 * recovery strategies tailored to specific error scenarios.
 * 
 * @module src/core/error_recovery/strategy/EnhancedStrategyFactory
 */

'use strict';

/**
 * Class responsible for creating and enhancing recovery strategies
 */
class EnhancedStrategyFactory {
  /**
   * Creates a new EnhancedStrategyFactory instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.knowledgeFramework - Knowledge framework for strategy templates
   * @param {Object} options.mlLayer - ML layer for strategy optimization
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.knowledgeFramework = options.knowledgeFramework;
    this.mlLayer = options.mlLayer;
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.strategyTemplates = new Map();
    this.strategyEnhancers = [];
    this.optimizationModels = new Map();
    this.isInitialized = false;
  }
  
  /**
   * Initialize the factory and load strategy templates
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    // Load strategy templates
    if (this.knowledgeFramework) {
      try {
        const templates = await this.knowledgeFramework.query({
          type: 'recovery_strategy_template',
          active: true
        });
        
        if (templates && templates.length > 0) {
          for (const template of templates) {
            this.strategyTemplates.set(template.id, template);
          }
        }
      } catch (error) {
        console.warn('Failed to load strategy templates:', error.message);
        // Continue with default templates
      }
    }
    
    // Set up default templates if none were loaded
    if (this.strategyTemplates.size === 0) {
      this._loadDefaultTemplates();
    }
    
    // Initialize strategy enhancers
    this._initializeEnhancers();
    
    // Load optimization models if ML layer is available
    if (this.mlLayer) {
      await this._loadOptimizationModels();
    }
    
    // Subscribe to template updates if event bus is available
    if (this.eventBus) {
      this.eventBus.on('knowledge:template:updated', this._handleTemplateUpdate.bind(this));
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'EnhancedStrategyFactory',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the factory and load strategy templates
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Create a recovery strategy for an error
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Created strategy
   */
  async createStrategy(error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!error) {
      throw new Error('Error object is required to create a strategy');
    }
    
    // Find matching template
    const template = await this._findMatchingTemplate(error, context);
    
    if (!template) {
      // No matching template, create a generic strategy
      return this._createGenericStrategy(error, context);
    }
    
    // Create strategy from template
    const strategy = await this._createFromTemplate(template, error, context);
    
    // Enhance strategy
    const enhancedStrategy = await this.enhanceStrategy(strategy, error, context);
    
    return enhancedStrategy;
  }
  
  /**
   * Create multiple strategies for an error
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @param {number} maxStrategies - Maximum number of strategies to create
   * @returns {Array} Created strategies
   */
  async createStrategiesForError(error, context = {}, maxStrategies = 3) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!error) {
      throw new Error('Error object is required to create strategies');
    }
    
    // Find matching templates
    const templates = await this._findMatchingTemplates(error, context, maxStrategies);
    
    if (templates.length === 0) {
      // No matching templates, create a generic strategy
      const genericStrategy = await this._createGenericStrategy(error, context);
      return [genericStrategy];
    }
    
    // Create strategies from templates
    const strategies = [];
    
    for (const template of templates) {
      const strategy = await this._createFromTemplate(template, error, context);
      const enhancedStrategy = await this.enhanceStrategy(strategy, error, context);
      strategies.push(enhancedStrategy);
      
      if (strategies.length >= maxStrategies) {
        break;
      }
    }
    
    // If we have fewer strategies than requested, add a generic one
    if (strategies.length < maxStrategies) {
      const genericStrategy = await this._createGenericStrategy(error, context);
      const enhancedGenericStrategy = await this.enhanceStrategy(genericStrategy, error, context);
      strategies.push(enhancedGenericStrategy);
    }
    
    // Rank strategies
    const rankedStrategies = await this._rankStrategies(strategies, error, context);
    
    return rankedStrategies.slice(0, maxStrategies);
  }
  
  /**
   * Enhance a recovery strategy
   * 
   * @param {Object} strategy - The strategy to enhance
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Enhanced strategy
   */
  async enhanceStrategy(strategy, error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategy) {
      throw new Error('Strategy object is required for enhancement');
    }
    
    let enhancedStrategy = { ...strategy };
    
    // Apply each enhancer in sequence
    for (const enhancer of this.strategyEnhancers) {
      try {
        enhancedStrategy = await enhancer(enhancedStrategy, error, context);
      } catch (enhancerError) {
        console.warn(`Strategy enhancer failed: ${enhancerError.message}`);
        // Continue with next enhancer
      }
    }
    
    // Apply ML-based optimization if available
    if (this.mlLayer && this.optimizationModels.size > 0) {
      try {
        enhancedStrategy = await this._applyMlOptimization(enhancedStrategy, error, context);
      } catch (mlError) {
        console.warn(`ML optimization failed: ${mlError.message}`);
        // Continue without ML optimization
      }
    }
    
    // Ensure strategy has required properties
    this._ensureRequiredProperties(enhancedStrategy);
    
    return enhancedStrategy;
  }
  
  /**
   * Register a strategy enhancer
   * 
   * @param {Function} enhancer - The enhancer function
   * @returns {boolean} Whether the enhancer was registered
   */
  registerEnhancer(enhancer) {
    if (typeof enhancer !== 'function') {
      return false;
    }
    
    this.strategyEnhancers.push(enhancer);
    return true;
  }
  
  /**
   * Add a strategy template
   * 
   * @param {Object} template - The template to add
   * @returns {boolean} Whether the template was added
   */
  addTemplate(template) {
    if (!template || !template.id) {
      return false;
    }
    
    this.strategyTemplates.set(template.id, template);
    return true;
  }
  
  /**
   * Find a matching template for an error
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Matching template or null
   * @private
   */
  async _findMatchingTemplate(error, context) {
    const templates = Array.from(this.strategyTemplates.values());
    
    // Sort templates by specificity (more specific first)
    const sortedTemplates = templates.sort((a, b) => {
      const specificityA = this._calculateTemplateSpecificity(a);
      const specificityB = this._calculateTemplateSpecificity(b);
      return specificityB - specificityA;
    });
    
    // Find first matching template
    for (const template of sortedTemplates) {
      if (await this._matchesTemplate(error, context, template)) {
        return template;
      }
    }
    
    return null;
  }
  
  /**
   * Find matching templates for an error
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @param {number} maxTemplates - Maximum number of templates to return
   * @returns {Array} Matching templates
   * @private
   */
  async _findMatchingTemplates(error, context, maxTemplates = 3) {
    const templates = Array.from(this.strategyTemplates.values());
    const matchingTemplates = [];
    
    // Sort templates by specificity (more specific first)
    const sortedTemplates = templates.sort((a, b) => {
      const specificityA = this._calculateTemplateSpecificity(a);
      const specificityB = this._calculateTemplateSpecificity(b);
      return specificityB - specificityA;
    });
    
    // Find matching templates
    for (const template of sortedTemplates) {
      if (await this._matchesTemplate(error, context, template)) {
        matchingTemplates.push(template);
        
        if (matchingTemplates.length >= maxTemplates) {
          break;
        }
      }
    }
    
    return matchingTemplates;
  }
  
  /**
   * Check if an error matches a template
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @param {Object} template - The template to match against
   * @returns {boolean} Whether the error matches the template
   * @private
   */
  async _matchesTemplate(error, context, template) {
    // Check error type
    if (template.errorType && error.type !== template.errorType) {
      return false;
    }
    
    // Check error code
    if (template.errorCode && error.code !== template.errorCode) {
      return false;
    }
    
    // Check error message pattern
    if (template.messagePattern && error.message) {
      const regex = new RegExp(template.messagePattern, 'i');
      if (!regex.test(error.message)) {
        return false;
      }
    }
    
    // Check context properties
    if (template.contextProperties && error.context) {
      for (const [key, value] of Object.entries(template.contextProperties)) {
        if (error.context[key] !== value) {
          return false;
        }
      }
    }
    
    // Check custom matcher if available
    if (template.matcher && typeof template.matcher === 'function') {
      try {
        const matches = await template.matcher(error, context);
        if (!matches) {
          return false;
        }
      } catch (matcherError) {
        console.warn(`Template matcher failed: ${matcherError.message}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculate template specificity
   * 
   * @param {Object} template - The template
   * @returns {number} Specificity score
   * @private
   */
  _calculateTemplateSpecificity(template) {
    let specificity = 0;
    
    // Error type is most specific
    if (template.errorType) {
      specificity += 100;
    }
    
    // Error code is also very specific
    if (template.errorCode) {
      specificity += 75;
    }
    
    // Message pattern is somewhat specific
    if (template.messagePattern) {
      specificity += 50;
    }
    
    // Context properties add specificity
    if (template.contextProperties) {
      specificity += Object.keys(template.contextProperties).length * 25;
    }
    
    // Custom matcher is least specific
    if (template.matcher) {
      specificity += 10;
    }
    
    return specificity;
  }
  
  /**
   * Create a strategy from a template
   * 
   * @param {Object} template - The template
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Created strategy
   * @private
   */
  async _createFromTemplate(template, error, context) {
    // Start with base strategy from template
    const strategy = {
      id: `strategy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: template.strategyType || 'generic',
      name: template.name || 'Recovery Strategy',
      description: template.description || `Recovery strategy for ${error.type || 'unknown'} error`,
      errorType: error.type,
      errorCode: error.code,
      confidence: template.baseConfidence || 0.7,
      actions: [],
      metadata: {
        generatedFrom: template.id,
        generatedAt: new Date().toISOString()
      }
    };
    
    // Add actions from template
    if (template.actions) {
      strategy.actions = this._processTemplateActions(template.actions, error, context);
    }
    
    // Add verification steps
    if (template.verificationSteps) {
      strategy.verificationSteps = this._processTemplateVerification(template.verificationSteps, error, context);
    }
    
    // Add rollback steps
    if (template.rollbackSteps) {
      strategy.rollbackSteps = this._processTemplateRollback(template.rollbackSteps, error, context);
    }
    
    // Add template-specific properties
    if (template.additionalProperties) {
      for (const [key, value] of Object.entries(template.additionalProperties)) {
        if (key !== 'id' && key !== 'actions' && key !== 'verificationSteps' && key !== 'rollbackSteps') {
          strategy[key] = value;
        }
      }
    }
    
    return strategy;
  }
  
  /**
   * Create a generic strategy for an error
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Generic strategy
   * @private
   */
  async _createGenericStrategy(error, context) {
    const strategy = {
      id: `strategy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: 'generic',
      name: `Generic Recovery for ${error.type || 'Unknown'} Error`,
      description: `Generic recovery strategy for ${error.type || 'unknown'} error: ${error.message || 'No message'}`,
      errorType: error.type,
      errorCode: error.code,
      confidence: 0.5,
      actions: [],
      metadata: {
        generatedFrom: 'generic',
        generatedAt: new Date().toISOString()
      }
    };
    
    // Add generic actions based on error type
    if (error.type === 'NetworkError' || error.type === 'ConnectivityError') {
      strategy.actions.push({
        type: 'retry',
        target: error.context ? error.context.target : 'operation',
        params: {
          retries: 3,
          backoffMs: 1000
        }
      });
    } else if (error.type === 'ResourceError') {
      strategy.actions.push({
        type: 'allocate_resource',
        target: error.context ? error.context.resource : 'unknown',
        params: {
          priority: 'medium',
          timeout: 5000
        }
      });
    } else if (error.type === 'ValidationError' || error.type === 'DataError') {
      strategy.actions.push({
        type: 'validate',
        target: error.context ? error.context.data : 'input',
        params: {
          strict: false,
          repair: true
        }
      });
    } else {
      // Truly generic fallback
      strategy.actions.push({
        type: 'restart',
        target: error.context ? error.context.component : 'operation',
        params: {
          graceful: true,
          timeout: 3000
        }
      });
    }
    
    // Add verification step
    strategy.verificationSteps = [
      {
        type: 'verify',
        target: error.context ? error.context.component : 'operation',
        params: {
          timeout: 2000,
          criteria: 'operational'
        }
      }
    ];
    
    return strategy;
  }
  
  /**
   * Process template actions
   * 
   * @param {Array} templateActions - Actions from template
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Array} Processed actions
   * @private
   */
  _processTemplateActions(templateActions, error, context) {
    const processedActions = [];
    
    for (const templateAction of templateActions) {
      const action = { ...templateAction };
      
      // Process target placeholders
      if (action.target && typeof action.target === 'string') {
        action.target = this._processPlaceholders(action.target, error, context);
      }
      
      // Process params placeholders
      if (action.params && typeof action.params === 'object') {
        for (const [key, value] of Object.entries(action.params)) {
          if (typeof value === 'string') {
            action.params[key] = this._processPlaceholders(value, error, context);
          }
        }
      }
      
      processedActions.push(action);
    }
    
    return processedActions;
  }
  
  /**
   * Process template verification steps
   * 
   * @param {Array} templateVerification - Verification steps from template
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Array} Processed verification steps
   * @private
   */
  _processTemplateVerification(templateVerification, error, context) {
    return this._processTemplateActions(templateVerification, error, context);
  }
  
  /**
   * Process template rollback steps
   * 
   * @param {Array} templateRollback - Rollback steps from template
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Array} Processed rollback steps
   * @private
   */
  _processTemplateRollback(templateRollback, error, context) {
    return this._processTemplateActions(templateRollback, error, context);
  }
  
  /**
   * Process placeholders in a string
   * 
   * @param {string} str - String with placeholders
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {string} Processed string
   * @private
   */
  _processPlaceholders(str, error, context) {
    if (typeof str !== 'string') {
      return str;
    }
    
    // Replace error placeholders
    str = str.replace(/\${error\.([^}]+)}/g, (match, key) => {
      if (key === 'type') {
        return error.type || 'unknown';
      } else if (key === 'code') {
        return error.code || 'unknown';
      } else if (key === 'message') {
        return error.message || '';
      } else if (key.startsWith('context.')) {
        const contextKey = key.substring(8);
        return error.context && error.context[contextKey] !== undefined ? 
          error.context[contextKey] : '';
      }
      return match;
    });
    
    // Replace context placeholders
    str = str.replace(/\${context\.([^}]+)}/g, (match, key) => {
      return context && context[key] !== undefined ? context[key] : '';
    });
    
    return str;
  }
  
  /**
   * Rank strategies
   * 
   * @param {Array} strategies - Strategies to rank
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Array} Ranked strategies
   * @private
   */
  async _rankStrategies(strategies, error, context) {
    if (!strategies || strategies.length === 0) {
      return [];
    }
    
    // Use ML for ranking if available
    if (this.mlLayer && this.optimizationModels.has('strategy_ranking')) {
      try {
        const rankingModel = this.optimizationModels.get('strategy_ranking');
        const rankings = await this.mlLayer.rankItems({
          model: rankingModel,
          items: strategies,
          context: {
            error,
            systemContext: context
          }
        });
        
        // Combine strategies with rankings
        const rankedStrategies = strategies.map((strategy, index) => ({
          ...strategy,
          ranking: rankings[index] || 0
        }));
        
        // Sort by ranking
        return rankedStrategies.sort((a, b) => b.ranking - a.ranking);
      } catch (error) {
        console.warn('ML ranking failed:', error.message);
        // Fall back to confidence-based ranking
      }
    }
    
    // Rank by confidence
    return strategies.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Apply ML-based optimization to a strategy
   * 
   * @param {Object} strategy - The strategy to optimize
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Optimized strategy
   * @private
   */
  async _applyMlOptimization(strategy, error, context) {
    if (!this.mlLayer) {
      return strategy;
    }
    
    let optimizedStrategy = { ...strategy };
    
    // Apply parameter optimization if available
    if (this.optimizationModels.has('parameter_optimization')) {
      try {
        const paramModel = this.optimizationModels.get('parameter_optimization');
        const optimizedParams = await this.mlLayer.optimizeParameters({
          model: paramModel,
          strategy,
          error,
          context
        });
        
        // Update strategy with optimized parameters
        if (optimizedParams && optimizedParams.actions) {
          optimizedStrategy.actions = optimizedParams.actions;
        }
        
        if (optimizedParams && optimizedParams.confidence) {
          optimizedStrategy.confidence = optimizedParams.confidence;
        }
      } catch (error) {
        console.warn('Parameter optimization failed:', error.message);
        // Continue without parameter optimization
      }
    }
    
    // Apply success prediction if available
    if (this.optimizationModels.has('success_prediction')) {
      try {
        const predictionModel = this.optimizationModels.get('success_prediction');
        const prediction = await this.mlLayer.predictSuccess({
          model: predictionModel,
          strategy: optimizedStrategy,
          error,
          context
        });
        
        // Add prediction to strategy
        if (prediction) {
          optimizedStrategy.prediction = {
            successProbability: prediction.probability || 0.5,
            confidence: prediction.confidence || 0.5,
            estimatedExecutionTime: prediction.executionTime || 1000
          };
          
          // Update confidence based on prediction
          optimizedStrategy.confidence = prediction.probability || optimizedStrategy.confidence;
        }
      } catch (error) {
        console.warn('Success prediction failed:', error.message);
        // Continue without success prediction
      }
    }
    
    return optimizedStrategy;
  }
  
  /**
   * Ensure strategy has required properties
   * 
   * @param {Object} strategy - The strategy to check
   * @private
   */
  _ensureRequiredProperties(strategy) {
    if (!strategy.id) {
      strategy.id = `strategy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    if (!strategy.type) {
      strategy.type = 'generic';
    }
    
    if (!strategy.name) {
      strategy.name = `Recovery Strategy for ${strategy.errorType || 'Unknown'} Error`;
    }
    
    if (!strategy.description) {
      strategy.description = `Recovery strategy for ${strategy.errorType || 'unknown'} error`;
    }
    
    if (!strategy.actions) {
      strategy.actions = [];
    }
    
    if (!strategy.metadata) {
      strategy.metadata = {
        generatedAt: new Date().toISOString()
      };
    }
    
    if (strategy.confidence === undefined) {
      strategy.confidence = 0.5;
    }
  }
  
  /**
   * Load default templates
   * 
   * @private
   */
  _loadDefaultTemplates() {
    // Network error template
    this.strategyTemplates.set('network_error', {
      id: 'network_error',
      name: 'Network Error Recovery',
      description: 'Recovery strategy for network errors',
      errorType: 'NetworkError',
      strategyType: 'retry',
      baseConfidence: 0.8,
      actions: [
        {
          type: 'retry',
          target: '${error.context.target}',
          params: {
            retries: 3,
            backoffMs: 1000,
            timeout: 5000
          }
        }
      ],
      verificationSteps: [
        {
          type: 'verify',
          target: '${error.context.target}',
          params: {
            timeout: 2000,
            criteria: 'connected'
          }
        }
      ],
      rollbackSteps: [
        {
          type: 'notify',
          target: 'user',
          params: {
            message: 'Network connection could not be established'
          }
        }
      ]
    });
    
    // Resource error template
    this.strategyTemplates.set('resource_error', {
      id: 'resource_error',
      name: 'Resource Error Recovery',
      description: 'Recovery strategy for resource errors',
      errorType: 'ResourceError',
      strategyType: 'allocate',
      baseConfidence: 0.7,
      actions: [
        {
          type: 'release',
          target: '${error.context.resource}',
          params: {
            force: true
          }
        },
        {
          type: 'allocate',
          target: '${error.context.resource}',
          params: {
            priority: 'high',
            timeout: 5000
          }
        }
      ],
      verificationSteps: [
        {
          type: 'verify',
          target: '${error.context.resource}',
          params: {
            timeout: 2000,
            criteria: 'available'
          }
        }
      ]
    });
    
    // Validation error template
    this.strategyTemplates.set('validation_error', {
      id: 'validation_error',
      name: 'Validation Error Recovery',
      description: 'Recovery strategy for validation errors',
      errorType: 'ValidationError',
      strategyType: 'validate',
      baseConfidence: 0.6,
      actions: [
        {
          type: 'validate',
          target: '${error.context.data}',
          params: {
            strict: false,
            repair: true,
            schema: '${error.context.schema}'
          }
        }
      ],
      verificationSteps: [
        {
          type: 'verify',
          target: '${error.context.data}',
          params: {
            timeout: 1000,
            criteria: 'valid'
          }
        }
      ]
    });
    
    // Generic error template
    this.strategyTemplates.set('generic_error', {
      id: 'generic_error',
      name: 'Generic Error Recovery',
      description: 'Generic recovery strategy for unknown errors',
      strategyType: 'restart',
      baseConfidence: 0.5,
      actions: [
        {
          type: 'restart',
          target: '${error.context.component}',
          params: {
            graceful: true,
            timeout: 3000
          }
        }
      ],
      verificationSteps: [
        {
          type: 'verify',
          target: '${error.context.component}',
          params: {
            timeout: 2000,
            criteria: 'operational'
          }
        }
      ]
    });
  }
  
  /**
   * Initialize strategy enhancers
   * 
   * @private
   */
  _initializeEnhancers() {
    // Add default enhancers
    
    // Add context-aware parameters
    this.registerEnhancer(async (strategy, error, context) => {
      if (!strategy.actions) {
        return strategy;
      }
      
      const enhancedStrategy = { ...strategy };
      
      // Enhance retry parameters based on network conditions
      if (context.networkCondition && enhancedStrategy.type === 'retry') {
        for (const action of enhancedStrategy.actions) {
          if (action.type === 'retry' && action.params) {
            if (context.networkCondition === 'poor') {
              action.params.retries = Math.min(action.params.retries + 2, 10);
              action.params.backoffMs = Math.min(action.params.backoffMs * 2, 10000);
            } else if (context.networkCondition === 'excellent') {
              action.params.retries = Math.max(action.params.retries - 1, 1);
              action.params.backoffMs = Math.max(action.params.backoffMs / 2, 500);
            }
          }
        }
      }
      
      // Enhance resource allocation based on system load
      if (context.systemLoad && enhancedStrategy.type === 'allocate') {
        for (const action of enhancedStrategy.actions) {
          if (action.type === 'allocate' && action.params) {
            if (context.systemLoad === 'high') {
              action.params.priority = 'critical';
              action.params.timeout = action.params.timeout * 1.5;
            } else if (context.systemLoad === 'low') {
              action.params.priority = 'normal';
              action.params.timeout = action.params.timeout * 0.8;
            }
          }
        }
      }
      
      return enhancedStrategy;
    });
    
    // Add user preference enhancer
    this.registerEnhancer(async (strategy, error, context) => {
      if (!context.userPreferences) {
        return strategy;
      }
      
      const enhancedStrategy = { ...strategy };
      
      // Adjust strategy based on user preferences
      if (context.userPreferences.interactionMode === 'silent' && 
          enhancedStrategy.actions.some(a => a.type === 'notify' && a.target === 'user')) {
        // Remove user notifications for silent mode
        enhancedStrategy.actions = enhancedStrategy.actions.filter(
          a => !(a.type === 'notify' && a.target === 'user')
        );
      }
      
      if (context.userPreferences.recoverySpeed === 'fast') {
        // Optimize for speed
        enhancedStrategy.actions = enhancedStrategy.actions.map(a => {
          if (a.params && a.params.timeout) {
            return {
              ...a,
              params: {
                ...a.params,
                timeout: a.params.timeout * 0.7
              }
            };
          }
          return a;
        });
      }
      
      if (context.userPreferences.recoveryThoroughness === 'thorough') {
        // Add verification steps if not present
        if (!enhancedStrategy.verificationSteps || enhancedStrategy.verificationSteps.length === 0) {
          enhancedStrategy.verificationSteps = [
            {
              type: 'verify',
              target: error.context ? error.context.component : 'operation',
              params: {
                timeout: 3000,
                criteria: 'operational'
              }
            }
          ];
        }
      }
      
      return enhancedStrategy;
    });
  }
  
  /**
   * Load optimization models
   * 
   * @private
   */
  async _loadOptimizationModels() {
    if (!this.mlLayer) {
      return;
    }
    
    try {
      // Load strategy ranking model
      const rankingModel = await this.mlLayer.loadModel('strategy_ranking');
      if (rankingModel) {
        this.optimizationModels.set('strategy_ranking', rankingModel);
      }
      
      // Load parameter optimization model
      const paramModel = await this.mlLayer.loadModel('parameter_optimization');
      if (paramModel) {
        this.optimizationModels.set('parameter_optimization', paramModel);
      }
      
      // Load success prediction model
      const predictionModel = await this.mlLayer.loadModel('success_prediction');
      if (predictionModel) {
        this.optimizationModels.set('success_prediction', predictionModel);
      }
    } catch (error) {
      console.warn('Failed to load optimization models:', error.message);
    }
  }
  
  /**
   * Handle template update event
   * 
   * @param {Object} event - The template update event
   * @private
   */
  _handleTemplateUpdate(event) {
    if (!event || !event.template || !event.template.id) {
      return;
    }
    
    // Update template
    this.strategyTemplates.set(event.template.id, event.template);
  }
}

module.exports = EnhancedStrategyFactory;
