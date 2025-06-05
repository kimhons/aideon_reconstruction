/**
 * StrategyMLPredictor.js
 * 
 * Machine learning-based predictor for recovery strategy generation and ranking.
 * This component leverages ML models to predict the most effective recovery strategies
 * based on error patterns, historical outcomes, and system context.
 * 
 * @module src/core/error_recovery/strategy/StrategyMLPredictor
 */

'use strict';

/**
 * Class responsible for ML-enhanced strategy prediction and ranking
 */
class StrategyMLPredictor {
  /**
   * Creates a new StrategyMLPredictor instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.mlLayer - Machine learning layer for model access
   * @param {Object} options.knowledgeFramework - Knowledge framework for historical data
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.mlLayer = options.mlLayer;
    this.knowledgeFramework = options.knowledgeFramework;
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.models = {
      strategyRanker: null,
      successPredictor: null,
      strategyGenerator: null
    };
    
    this.featureExtractors = {
      error: this._extractErrorFeatures.bind(this),
      pattern: this._extractPatternFeatures.bind(this),
      strategy: this._extractStrategyFeatures.bind(this),
      context: this._extractContextFeatures.bind(this)
    };
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the predictor and load required models
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    if (this.mlLayer) {
      try {
        this.models.strategyRanker = await this.mlLayer.loadModel('recovery_strategy_ranker');
        this.models.successPredictor = await this.mlLayer.loadModel('recovery_success_predictor');
        this.models.strategyGenerator = await this.mlLayer.loadModel('recovery_strategy_generator');
        
        if (this.eventBus) {
          this.eventBus.emit('ml:models:loaded', {
            component: 'StrategyMLPredictor',
            models: Object.keys(this.models).filter(key => this.models[key] !== null)
          });
        }
      } catch (error) {
        console.warn('Failed to load ML models for StrategyMLPredictor:', error.message);
        // Continue without ML enhancement
        
        if (this.eventBus) {
          this.eventBus.emit('ml:models:failed', {
            component: 'StrategyMLPredictor',
            error: error.message
          });
        }
      }
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'StrategyMLPredictor',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the predictor and load required models
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Rank recovery strategies based on predicted effectiveness
   * 
   * @param {Array} strategies - List of candidate strategies
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Array} Ranked strategies with scores
   */
  async rankStrategies(strategies, error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategies || strategies.length === 0) {
      return [];
    }
    
    // Use ML model if available
    if (this.models.strategyRanker) {
      try {
        const features = await this._prepareRankingFeatures(strategies, error, context);
        const predictions = await this.models.strategyRanker.predict(features);
        
        if (predictions && predictions.scores) {
          // Combine strategies with predicted scores
          return strategies.map((strategy, index) => ({
            ...strategy,
            score: predictions.scores[index],
            confidence: predictions.confidences ? predictions.confidences[index] : 0.8
          })).sort((a, b) => b.score - a.score);
        }
      } catch (error) {
        console.warn('ML strategy ranking failed:', error.message);
        // Fall back to heuristic ranking
      }
    }
    
    // Heuristic-based ranking as fallback
    return this._heuristicRanking(strategies, error, context);
  }
  
  /**
   * Predict success probability for a given strategy
   * 
   * @param {Object} strategy - The strategy to evaluate
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Success prediction
   */
  async predictSuccess(strategy, error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const prediction = {
      probability: 0.5,
      confidence: 0.5,
      factors: []
    };
    
    // Use ML model if available
    if (this.models.successPredictor) {
      try {
        const features = await this._prepareSuccessPredictionFeatures(strategy, error, context);
        const result = await this.models.successPredictor.predict(features);
        
        if (result) {
          prediction.probability = result.probability;
          prediction.confidence = result.confidence || 0.7;
          prediction.factors = result.factors || [];
          return prediction;
        }
      } catch (error) {
        console.warn('ML success prediction failed:', error.message);
        // Fall back to heuristic prediction
      }
    }
    
    // Heuristic-based prediction as fallback
    return this._heuristicSuccessPrediction(strategy, error, context);
  }
  
  /**
   * Generate new recovery strategies using ML
   * 
   * @param {Object} error - The error object
   * @param {Array} patterns - Identified error patterns
   * @param {Object} context - Additional context information
   * @returns {Array} Generated strategies
   */
  async generateStrategies(error, patterns, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const generatedStrategies = [];
    
    // Use ML model if available
    if (this.models.strategyGenerator) {
      try {
        const features = await this._prepareGenerationFeatures(error, patterns, context);
        const result = await this.models.strategyGenerator.predict(features);
        
        if (result && result.strategies) {
          return result.strategies;
        }
      } catch (error) {
        console.warn('ML strategy generation failed:', error.message);
        // Fall back to template-based generation
      }
    }
    
    // Template-based generation as fallback
    return this._templateBasedGeneration(error, patterns, context);
  }
  
  /**
   * Enhance strategies with ML-based insights
   * 
   * @param {Array} strategies - Strategies to enhance
   * @returns {Promise<Array>} Enhanced strategies
   */
  async enhanceStrategies(strategies) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategies || strategies.length === 0) {
      return [];
    }
    
    // Use local LLM for strategy enhancement if available
    if (this.mlLayer && typeof this.mlLayer.enhanceStrategy === 'function') {
      try {
        const enhancedStrategies = await Promise.all(
          strategies.map(async (strategy) => {
            try {
              const enhancement = await this.mlLayer.enhanceStrategy({
                strategy,
                task: 'strategy_enhancement',
                model: 'local_llm'
              });

              return {
                ...strategy,
                enhancedDescription: enhancement.description,
                confidenceScore: enhancement.confidence,
                alternativeActions: enhancement.alternatives
              };
            } catch (error) {
              console.warn(`Strategy enhancement failed for ${strategy.id}:`, error.message);
              return strategy;
            }
          })
        );

        return enhancedStrategies;
      } catch (error) {
        console.warn('Batch strategy enhancement failed:', error.message);
        // Return original strategies
        return strategies;
      }
    }
    
    // If ML enhancement is not available, return original strategies
    return strategies;
  }
  
  /**
   * Prepare features for strategy ranking
   * 
   * @param {Array} strategies - List of candidate strategies
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Feature object for ML model
   * @private
   */
  async _prepareRankingFeatures(strategies, error, context) {
    const errorFeatures = this.featureExtractors.error(error);
    const contextFeatures = this.featureExtractors.context(context);
    
    const strategyFeatures = strategies.map(strategy => 
      this.featureExtractors.strategy(strategy)
    );
    
    return {
      error: errorFeatures,
      context: contextFeatures,
      strategies: strategyFeatures
    };
  }
  
  /**
   * Prepare features for success prediction
   * 
   * @param {Object} strategy - The strategy to evaluate
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Feature object for ML model
   * @private
   */
  async _prepareSuccessPredictionFeatures(strategy, error, context) {
    const errorFeatures = this.featureExtractors.error(error);
    const strategyFeatures = this.featureExtractors.strategy(strategy);
    const contextFeatures = this.featureExtractors.context(context);
    
    // Add historical success rate if available
    let historicalSuccess = null;
    if (this.knowledgeFramework) {
      const history = await this.knowledgeFramework.query({
        type: 'strategy_execution_history',
        strategyId: strategy.id,
        errorType: error.type,
        limit: 10
      });
      
      if (history && history.length > 0) {
        const successCount = history.filter(h => h.success).length;
        historicalSuccess = {
          rate: successCount / history.length,
          sampleSize: history.length,
          recentTrend: this._calculateRecentTrend(history)
        };
      }
    }
    
    return {
      error: errorFeatures,
      strategy: strategyFeatures,
      context: contextFeatures,
      historicalSuccess
    };
  }
  
  /**
   * Prepare features for strategy generation
   * 
   * @param {Object} error - The error object
   * @param {Array} patterns - Identified error patterns
   * @param {Object} context - Additional context information
   * @returns {Object} Feature object for ML model
   * @private
   */
  async _prepareGenerationFeatures(error, patterns, context) {
    const errorFeatures = this.featureExtractors.error(error);
    const patternFeatures = patterns.map(pattern => 
      this.featureExtractors.pattern(pattern)
    );
    const contextFeatures = this.featureExtractors.context(context);
    
    // Add similar errors if available
    let similarErrors = [];
    if (this.knowledgeFramework) {
      const similar = await this.knowledgeFramework.query({
        type: 'similar_errors',
        errorType: error.type,
        errorCode: error.code,
        limit: 5
      });
      
      if (similar && similar.length > 0) {
        similarErrors = similar.map(e => ({
          type: e.type,
          code: e.code,
          successfulStrategy: e.successfulStrategy
        }));
      }
    }
    
    return {
      error: errorFeatures,
      patterns: patternFeatures,
      context: contextFeatures,
      similarErrors
    };
  }
  
  /**
   * Extract features from error object
   * 
   * @param {Object} error - The error object
   * @returns {Object} Extracted features
   * @private
   */
  _extractErrorFeatures(error) {
    if (!error) {
      return {};
    }
    
    return {
      type: error.type || 'unknown',
      code: error.code,
      message: error.message,
      hasContext: !!error.context,
      contextKeys: error.context ? Object.keys(error.context) : [],
      timestamp: error.timestamp || Date.now()
    };
  }
  
  /**
   * Extract features from pattern object
   * 
   * @param {Object} pattern - The pattern object
   * @returns {Object} Extracted features
   * @private
   */
  _extractPatternFeatures(pattern) {
    if (!pattern) {
      return {};
    }
    
    return {
      id: pattern.id,
      errorType: pattern.errorType,
      confidence: pattern.confidence || 0.5,
      frequency: pattern.frequency || 0,
      patternCount: pattern.patterns ? pattern.patterns.length : 0
    };
  }
  
  /**
   * Extract features from strategy object
   * 
   * @param {Object} strategy - The strategy object
   * @returns {Object} Extracted features
   * @private
   */
  _extractStrategyFeatures(strategy) {
    if (!strategy) {
      return {};
    }
    
    return {
      id: strategy.id,
      type: strategy.type || 'unknown',
      confidence: strategy.confidence || 0.5,
      successRate: strategy.successRate || 0.5,
      actionCount: strategy.actions ? strategy.actions.length : 0,
      actionTypes: strategy.actions ? strategy.actions.map(a => a.type) : [],
      hasDistributedCapabilities: !!strategy.distributedCapabilities,
      hasSecurityContext: !!strategy.securityContext
    };
  }
  
  /**
   * Extract features from context object
   * 
   * @param {Object} context - The context object
   * @returns {Object} Extracted features
   * @private
   */
  _extractContextFeatures(context) {
    if (!context) {
      return {};
    }
    
    return {
      hasSystemState: !!context.systemState,
      hasTentacleStates: !!context.tentacleStates,
      tentacleCount: context.tentacleStates ? Object.keys(context.tentacleStates).length : 0,
      isDistributed: !!context.isDistributed,
      deviceCount: context.deviceCount || 1,
      userPresent: !!context.userPresent,
      priority: context.priority || 'normal'
    };
  }
  
  /**
   * Calculate recent trend from execution history
   * 
   * @param {Array} history - Execution history entries
   * @returns {string} Trend direction
   * @private
   */
  _calculateRecentTrend(history) {
    if (!history || history.length < 3) {
      return 'stable';
    }
    
    // Sort by timestamp descending
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    
    // Take most recent 3 entries
    const recent = sorted.slice(0, 3);
    const recentSuccessRate = recent.filter(h => h.success).length / recent.length;
    
    // Take older entries
    const older = sorted.slice(3);
    if (older.length === 0) {
      return 'stable';
    }
    
    const olderSuccessRate = older.filter(h => h.success).length / older.length;
    
    // Compare rates
    const diff = recentSuccessRate - olderSuccessRate;
    if (diff > 0.1) {
      return 'improving';
    } else if (diff < -0.1) {
      return 'declining';
    } else {
      return 'stable';
    }
  }
  
  /**
   * Heuristic-based strategy ranking
   * 
   * @param {Array} strategies - List of candidate strategies
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Array} Ranked strategies with scores
   * @private
   */
  _heuristicRanking(strategies, error, context) {
    return strategies.map(strategy => {
      // Base score from strategy confidence and success rate
      let score = (strategy.confidence || 0.5) * 0.4 + (strategy.successRate || 0.5) * 0.6;
      
      // Adjust based on strategy type and error type match
      if (strategy.type === 'retry' && error.type === 'NetworkError') {
        score += 0.1;
      } else if (strategy.type === 'fallback' && error.type === 'ResourceError') {
        score += 0.1;
      } else if (strategy.type === 'reconfigure' && error.type === 'ConfigurationError') {
        score += 0.1;
      }
      
      // Adjust for distributed environment if applicable
      if (context.isDistributed && strategy.distributedCapabilities) {
        score += 0.05;
      }
      
      // Adjust for security context if applicable
      if (context.securitySensitive && strategy.securityContext) {
        score += 0.05;
      }
      
      // Ensure score is between 0 and 1
      score = Math.max(0, Math.min(1, score));
      
      return {
        ...strategy,
        score,
        confidence: 0.6 // Lower confidence for heuristic ranking
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * Heuristic-based success prediction
   * 
   * @param {Object} strategy - The strategy to evaluate
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Success prediction
   * @private
   */
  _heuristicSuccessPrediction(strategy, error, context) {
    // Base probability from strategy success rate
    let probability = strategy.successRate || 0.5;
    
    // Adjust based on strategy type and error type match
    if (strategy.type === 'retry' && error.type === 'NetworkError') {
      probability += 0.1;
    } else if (strategy.type === 'fallback' && error.type === 'ResourceError') {
      probability += 0.1;
    } else if (strategy.type === 'reconfigure' && error.type === 'ConfigurationError') {
      probability += 0.1;
    }
    
    // Adjust for distributed environment if applicable
    if (context.isDistributed && strategy.distributedCapabilities) {
      probability += 0.05;
    }
    
    // Adjust for security context if applicable
    if (context.securitySensitive && strategy.securityContext) {
      probability += 0.05;
    }
    
    // Ensure probability is between 0 and 1
    probability = Math.max(0, Math.min(1, probability));
    
    return {
      probability,
      confidence: 0.5, // Lower confidence for heuristic prediction
      factors: [
        { name: 'strategy_type', weight: 0.3 },
        { name: 'error_type_match', weight: 0.4 },
        { name: 'context_compatibility', weight: 0.3 }
      ]
    };
  }
  
  /**
   * Template-based strategy generation
   * 
   * @param {Object} error - The error object
   * @param {Array} patterns - Identified error patterns
   * @param {Object} context - Additional context information
   * @returns {Array} Generated strategies
   * @private
   */
  _templateBasedGeneration(error, patterns, context) {
    const strategies = [];
    
    // Generate retry strategy for network errors
    if (error.type === 'NetworkError' || error.type === 'ConnectivityError') {
      strategies.push({
        id: `retry_${Date.now()}`,
        type: 'retry',
        name: 'Adaptive Retry Strategy',
        description: 'Retry the operation with exponential backoff',
        confidence: 0.8,
        successRate: 0.7,
        actions: [
          {
            type: 'retry',
            target: error.context ? error.context.target : 'operation',
            params: {
              retries: 3,
              backoffMs: 1000,
              maxBackoffMs: 10000
            }
          }
        ]
      });
    }
    
    // Generate fallback strategy for resource errors
    if (error.type === 'ResourceError') {
      strategies.push({
        id: `fallback_${Date.now()}`,
        type: 'fallback',
        name: 'Resource Fallback Strategy',
        description: 'Use alternative resource or allocation strategy',
        confidence: 0.7,
        successRate: 0.6,
        actions: [
          {
            type: 'allocate',
            target: error.context ? error.context.resource : 'resource',
            params: {
              alternative: true,
              priority: 'high',
              timeout: 5000
            }
          }
        ]
      });
    }
    
    // Generate reconfiguration strategy for configuration errors
    if (error.type === 'ConfigurationError') {
      strategies.push({
        id: `reconfigure_${Date.now()}`,
        type: 'reconfigure',
        name: 'Configuration Recovery Strategy',
        description: 'Reset configuration to default or safe values',
        confidence: 0.6,
        successRate: 0.5,
        actions: [
          {
            type: 'reconfigure',
            target: error.context ? error.context.component : 'component',
            params: {
              useDefaults: true,
              validateAfter: true
            }
          }
        ]
      });
    }
    
    // Generate generic restart strategy as fallback
    strategies.push({
      id: `restart_${Date.now()}`,
      type: 'restart',
      name: 'Component Restart Strategy',
      description: 'Restart the affected component',
      confidence: 0.5,
      successRate: 0.4,
      actions: [
        {
          type: 'restart',
          target: error.context ? error.context.component : 'component',
          params: {
            graceful: true,
            timeout: 3000
          }
        }
      ]
    });
    
    return strategies;
  }
}

module.exports = StrategyMLPredictor;
