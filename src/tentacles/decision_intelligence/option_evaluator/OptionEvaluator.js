/**
 * @fileoverview Option Evaluator for the Decision Intelligence Tentacle
 * 
 * This component is responsible for evaluating options based on analysis results
 * and user preferences to provide decision support.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Option Evaluator for the Decision Intelligence Tentacle
 */
class OptionEvaluator {
  /**
   * Creates a new instance of the Option Evaluator
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('OptionEvaluator');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      defaultWeights: config.defaultWeights || {
        value: 0.4,
        risk: -0.3,
        score: 0.3
      },
      evaluationMethods: config.evaluationMethods || ['weighted_sum', 'multi_criteria', 'utility']
    };
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.evaluateOptions = this.evaluateOptions.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Option Evaluator
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Option Evaluator');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      this.initialized = true;
      this.logger.info('Option Evaluator initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'optionEvaluator' });
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('optionEvaluator');
      
      if (config) {
        this.config.defaultWeights = config.get('defaultWeights') || this.config.defaultWeights;
        this.config.evaluationMethods = config.get('evaluationMethods') || this.config.evaluationMethods;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Shuts down the Option Evaluator
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Option Evaluator');
    
    try {
      this.initialized = false;
      this.logger.info('Option Evaluator shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'optionEvaluator' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Option Evaluator
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config
    };
  }
  
  /**
   * Evaluates options based on analysis results and context
   * @param {Object} data The options data
   * @param {Object} analysisResults The analysis results
   * @param {Object} context The context for evaluation
   * @param {Object} options Evaluation options
   * @returns {Promise<Object>} A promise that resolves with the evaluation results
   */
  async evaluateOptions(data, analysisResults, context = {}, options = {}) {
    if (!this.initialized) {
      throw new Error('Option Evaluator not initialized');
    }
    
    if (!data) {
      throw new Error('Data is required');
    }
    
    if (!analysisResults) {
      throw new Error('Analysis results are required');
    }
    
    this.logger.info('Evaluating options', {
      dataType: typeof data,
      contextType: typeof context,
      options
    });
    
    try {
      // Emit evaluation start event
      this.events.emit('evaluation:start', {
        timestamp: Date.now(),
        context
      });
      
      // Prepare options for evaluation
      const preparedOptions = await this._prepareOptions(data, analysisResults);
      
      // Determine evaluation method
      const evaluationMethod = options.evaluationMethod || this.config.evaluationMethods[0];
      
      // Get weights for evaluation
      const weights = this._determineWeights(context, options);
      
      // Evaluate options using selected method
      let evaluationResults;
      switch (evaluationMethod) {
        case 'weighted_sum':
          evaluationResults = await this._evaluateWeightedSum(preparedOptions, weights, context);
          break;
        case 'multi_criteria':
          evaluationResults = await this._evaluateMultiCriteria(preparedOptions, weights, context);
          break;
        case 'utility':
          evaluationResults = await this._evaluateUtility(preparedOptions, weights, context);
          break;
        default:
          throw new Error(`Unsupported evaluation method: ${evaluationMethod}`);
      }
      
      // Calculate confidence levels
      evaluationResults = await this._calculateConfidence(evaluationResults, analysisResults);
      
      // Emit evaluation complete event
      this.events.emit('evaluation:complete', {
        timestamp: Date.now(),
        context,
        evaluationMethod,
        optionCount: evaluationResults.options.length
      });
      
      return evaluationResults;
    } catch (error) {
      this.logger.error('Option evaluation failed', error);
      
      // Emit evaluation error event
      this.events.emit('evaluation:error', {
        timestamp: Date.now(),
        context,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Prepares options for evaluation
   * @private
   * @param {Object} data The options data
   * @param {Object} analysisResults The analysis results
   * @returns {Promise<Array>} A promise that resolves with the prepared options
   */
  async _prepareOptions(data, analysisResults) {
    // Extract options from data
    let options = [];
    
    if (data.options) {
      // Handle object with named options
      options = Object.entries(data.options).map(([id, attributes]) => ({
        id,
        attributes: { ...attributes }
      }));
    } else if (Array.isArray(data)) {
      // Handle array of options
      options = data.map((item, index) => ({
        id: `option-${index}`,
        attributes: typeof item === 'object' ? { ...item } : { value: item }
      }));
    } else if (typeof data === 'object') {
      // Handle single object as options
      options = Object.entries(data).map(([key, value]) => ({
        id: key,
        attributes: { value: value }
      }));
    }
    
    // Enrich options with analysis results if available
    if (analysisResults && analysisResults.statistics && analysisResults.statistics.attributeStats) {
      const { attributeStats } = analysisResults.statistics;
      
      // Normalize attributes based on statistics
      options = options.map(option => {
        const normalizedAttributes = {};
        
        for (const [key, value] of Object.entries(option.attributes)) {
          if (typeof value === 'number' && attributeStats[key]) {
            const { min, max } = attributeStats[key];
            if (min !== max) {
              normalizedAttributes[`${key}_normalized`] = (value - min) / (max - min);
            }
          }
        }
        
        return {
          ...option,
          attributes: {
            ...option.attributes,
            ...normalizedAttributes
          }
        };
      });
    }
    
    return options;
  }
  
  /**
   * Determines weights for evaluation based on context and options
   * @private
   * @param {Object} context The context for evaluation
   * @param {Object} options Evaluation options
   * @returns {Object} The weights for evaluation
   */
  _determineWeights(context, options) {
    // Start with default weights
    const weights = { ...this.config.defaultWeights };
    
    // Apply context-specific weights if available
    if (context.preferences && context.preferences.weights) {
      Object.assign(weights, context.preferences.weights);
    }
    
    // Apply option-specific weights if available
    if (options.weights) {
      Object.assign(weights, options.weights);
    }
    
    // Adjust weights based on decision type
    if (context.decisionType) {
      switch (context.decisionType) {
        case 'investment':
          // For investment decisions, increase value weight and decrease risk weight
          weights.value = (weights.value || 0.4) * 1.2;
          weights.risk = (weights.risk || -0.3) * 1.1;
          break;
        case 'safety':
          // For safety decisions, increase risk weight
          weights.risk = (weights.risk || -0.3) * 1.5;
          break;
        case 'speed':
          // For speed decisions, decrease risk weight
          weights.risk = (weights.risk || -0.3) * 0.8;
          break;
      }
    }
    
    // Adjust weights based on risk tolerance
    if (context.preferences && context.preferences.riskTolerance) {
      switch (context.preferences.riskTolerance) {
        case 'low':
          weights.risk = (weights.risk || -0.3) * 1.5;
          break;
        case 'medium':
          // No adjustment for medium risk tolerance
          break;
        case 'high':
          weights.risk = (weights.risk || -0.3) * 0.7;
          break;
      }
    }
    
    return weights;
  }
  
  /**
   * Evaluates options using weighted sum method
   * @private
   * @param {Array} options The options to evaluate
   * @param {Object} weights The weights for evaluation
   * @param {Object} context The context for evaluation
   * @returns {Promise<Object>} A promise that resolves with the evaluation results
   */
  async _evaluateWeightedSum(options, weights, context) {
    this.logger.info('Evaluating options using weighted sum method');
    
    // Calculate scores for each option
    const evaluatedOptions = options.map(option => {
      let score = 0;
      
      // Calculate weighted sum of attributes
      for (const [attribute, weight] of Object.entries(weights)) {
        const value = option.attributes[attribute];
        if (typeof value === 'number') {
          score += value * weight;
        }
        
        // Also check for normalized attributes
        const normalizedValue = option.attributes[`${attribute}_normalized`];
        if (typeof normalizedValue === 'number') {
          score += normalizedValue * weight;
        }
      }
      
      return {
        id: option.id,
        score,
        attributes: option.attributes
      };
    });
    
    // Sort options by score (descending)
    evaluatedOptions.sort((a, b) => b.score - a.score);
    
    // Calculate evaluation metrics
    const evaluationMetrics = {
      method: 'weighted_sum',
      weights,
      scoreRange: {
        min: Math.min(...evaluatedOptions.map(o => o.score)),
        max: Math.max(...evaluatedOptions.map(o => o.score))
      }
    };
    
    return {
      options: evaluatedOptions,
      evaluationMetrics
    };
  }
  
  /**
   * Evaluates options using multi-criteria method
   * @private
   * @param {Array} options The options to evaluate
   * @param {Object} weights The weights for evaluation
   * @param {Object} context The context for evaluation
   * @returns {Promise<Object>} A promise that resolves with the evaluation results
   */
  async _evaluateMultiCriteria(options, weights, context) {
    this.logger.info('Evaluating options using multi-criteria method');
    
    // Determine criteria from weights
    const criteria = Object.keys(weights);
    
    // Calculate scores for each option
    const evaluatedOptions = options.map(option => {
      // Calculate score for each criterion
      const criteriaScores = {};
      let totalScore = 0;
      let totalWeight = 0;
      
      for (const criterion of criteria) {
        const weight = weights[criterion];
        const value = option.attributes[criterion];
        const normalizedValue = option.attributes[`${criterion}_normalized`];
        
        if (typeof value === 'number' || typeof normalizedValue === 'number') {
          const score = typeof normalizedValue === 'number' ? normalizedValue : value;
          criteriaScores[criterion] = score;
          totalScore += score * Math.abs(weight);
          totalWeight += Math.abs(weight);
        }
      }
      
      // Calculate final score
      const score = totalWeight > 0 ? totalScore / totalWeight : 0;
      
      return {
        id: option.id,
        score,
        criteriaScores,
        attributes: option.attributes
      };
    });
    
    // Sort options by score (descending)
    evaluatedOptions.sort((a, b) => b.score - a.score);
    
    // Calculate evaluation metrics
    const evaluationMetrics = {
      method: 'multi_criteria',
      criteria,
      weights,
      scoreRange: {
        min: Math.min(...evaluatedOptions.map(o => o.score)),
        max: Math.max(...evaluatedOptions.map(o => o.score))
      }
    };
    
    return {
      options: evaluatedOptions,
      evaluationMetrics
    };
  }
  
  /**
   * Evaluates options using utility method
   * @private
   * @param {Array} options The options to evaluate
   * @param {Object} weights The weights for evaluation
   * @param {Object} context The context for evaluation
   * @returns {Promise<Object>} A promise that resolves with the evaluation results
   */
  async _evaluateUtility(options, weights, context) {
    this.logger.info('Evaluating options using utility method');
    
    // Define utility functions for each attribute
    const utilityFunctions = {};
    
    for (const attribute of Object.keys(weights)) {
      // Default linear utility function
      utilityFunctions[attribute] = value => value;
      
      // Customize utility functions based on context
      if (attribute === 'risk' && context.preferences && context.preferences.riskTolerance) {
        switch (context.preferences.riskTolerance) {
          case 'low':
            // Risk-averse utility function (exponential)
            utilityFunctions[attribute] = value => Math.exp(-value);
            break;
          case 'medium':
            // Linear utility function
            break;
          case 'high':
            // Risk-seeking utility function (logarithmic)
            utilityFunctions[attribute] = value => value > 0 ? Math.log(1 + value) : -Math.log(1 - value);
            break;
        }
      }
    }
    
    // Calculate utility scores for each option
    const evaluatedOptions = options.map(option => {
      let utilityScore = 0;
      const utilityScores = {};
      
      // Calculate utility for each attribute
      for (const [attribute, weight] of Object.entries(weights)) {
        const value = option.attributes[attribute];
        const normalizedValue = option.attributes[`${attribute}_normalized`];
        
        if (typeof value === 'number' || typeof normalizedValue === 'number') {
          const inputValue = typeof normalizedValue === 'number' ? normalizedValue : value;
          const utility = utilityFunctions[attribute](inputValue);
          utilityScores[attribute] = utility;
          utilityScore += utility * weight;
        }
      }
      
      return {
        id: option.id,
        score: utilityScore,
        utilityScores,
        attributes: option.attributes
      };
    });
    
    // Sort options by score (descending)
    evaluatedOptions.sort((a, b) => b.score - a.score);
    
    // Calculate evaluation metrics
    const evaluationMetrics = {
      method: 'utility',
      weights,
      utilityFunctions: Object.keys(utilityFunctions),
      scoreRange: {
        min: Math.min(...evaluatedOptions.map(o => o.score)),
        max: Math.max(...evaluatedOptions.map(o => o.score))
      }
    };
    
    return {
      options: evaluatedOptions,
      evaluationMetrics
    };
  }
  
  /**
   * Calculates confidence levels for evaluation results
   * @private
   * @param {Object} evaluationResults The evaluation results
   * @param {Object} analysisResults The analysis results
   * @returns {Promise<Object>} A promise that resolves with the updated evaluation results
   */
  async _calculateConfidence(evaluationResults, analysisResults) {
    // Start with base confidence level
    let baseConfidence = 0.8;
    
    // Adjust confidence based on analysis results
    if (analysisResults && analysisResults.uncertainty) {
      const { uncertainties, summary } = analysisResults.uncertainty;
      
      if (summary && typeof summary.averageUncertainty === 'number') {
        // Reduce confidence based on uncertainty
        baseConfidence *= (1 - summary.averageUncertainty);
      }
    }
    
    // Calculate confidence for each option
    const optionsWithConfidence = evaluationResults.options.map(option => {
      // Start with base confidence
      let confidence = baseConfidence;
      
      // Adjust confidence based on score distance from mean
      const scores = evaluationResults.options.map(o => o.score);
      const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const stdDev = Math.sqrt(
        scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length
      );
      
      if (stdDev > 0) {
        const zScore = Math.abs((option.score - meanScore) / stdDev);
        
        // Higher confidence for scores further from mean (in positive direction)
        if (option.score > meanScore) {
          confidence += Math.min(0.1, zScore * 0.02);
        } else {
          confidence -= Math.min(0.1, zScore * 0.02);
        }
      }
      
      // Ensure confidence is within valid range
      confidence = Math.max(0.5, Math.min(0.99, confidence));
      
      return {
        ...option,
        confidence
      };
    });
    
    // Update evaluation metrics with confidence information
    const updatedMetrics = {
      ...evaluationResults.evaluationMetrics,
      confidenceLevel: baseConfidence,
      confidenceRange: {
        min: Math.min(...optionsWithConfidence.map(o => o.confidence)),
        max: Math.max(...optionsWithConfidence.map(o => o.confidence))
      }
    };
    
    return {
      options: optionsWithConfidence,
      evaluationMetrics: updatedMetrics
    };
  }
  
  /**
   * Registers API endpoints for the Option Evaluator
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register evaluate endpoint
    api.register(`${namespace}/options/evaluate`, {
      post: async (req, res) => {
        try {
          const { data, analysisResults, context, options } = req.body;
          
          if (!data) {
            return res.status(400).json({
              error: 'Data is required'
            });
          }
          
          if (!analysisResults) {
            return res.status(400).json({
              error: 'Analysis results are required'
            });
          }
          
          const result = await this.evaluateOptions(data, analysisResults, context || {}, options || {});
          
          return res.json(result);
        } catch (error) {
          this.logger.error('API error in evaluate endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { OptionEvaluator };
