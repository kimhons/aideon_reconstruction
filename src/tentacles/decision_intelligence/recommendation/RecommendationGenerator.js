/**
 * @fileoverview Recommendation Generator for the Decision Intelligence Tentacle
 * 
 * This component is responsible for generating actionable recommendations
 * based on option evaluation results.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Recommendation Generator for the Decision Intelligence Tentacle
 */
class RecommendationGenerator {
  /**
   * Creates a new instance of the Recommendation Generator
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('RecommendationGenerator');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      recommendationThresholds: config.recommendationThresholds || {
        highly_recommended: 0.8,
        recommended: 0.6,
        acceptable: 0.4,
        not_recommended: 0.0
      },
      maxRecommendations: config.maxRecommendations || 5,
      confidenceThreshold: config.confidenceThreshold || 0.7
    };
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.generateRecommendations = this.generateRecommendations.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Recommendation Generator
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Recommendation Generator');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      this.initialized = true;
      this.logger.info('Recommendation Generator initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'recommendationGenerator' });
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('recommendationGenerator');
      
      if (config) {
        this.config.recommendationThresholds = config.get('recommendationThresholds') || this.config.recommendationThresholds;
        this.config.maxRecommendations = config.get('maxRecommendations') || this.config.maxRecommendations;
        this.config.confidenceThreshold = config.get('confidenceThreshold') || this.config.confidenceThreshold;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Shuts down the Recommendation Generator
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Recommendation Generator');
    
    try {
      this.initialized = false;
      this.logger.info('Recommendation Generator shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'recommendationGenerator' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Recommendation Generator
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config
    };
  }
  
  /**
   * Generates recommendations based on evaluation results
   * @param {Object} evaluationResults The evaluation results
   * @param {Object} context The context for recommendations
   * @param {Object} options Recommendation options
   * @returns {Promise<Object>} A promise that resolves with the recommendation results
   */
  async generateRecommendations(evaluationResults, context = {}, options = {}) {
    if (!this.initialized) {
      throw new Error('Recommendation Generator not initialized');
    }
    
    if (!evaluationResults || !evaluationResults.options) {
      throw new Error('Evaluation results are required');
    }
    
    this.logger.info('Generating recommendations', {
      optionCount: evaluationResults.options.length,
      contextType: typeof context,
      options
    });
    
    try {
      // Emit recommendation start event
      this.events.emit('recommendation:start', {
        timestamp: Date.now(),
        context
      });
      
      // Get recommendation thresholds
      const thresholds = options.recommendationThresholds || this.config.recommendationThresholds;
      
      // Get max recommendations
      const maxRecommendations = options.maxRecommendations || this.config.maxRecommendations;
      
      // Get confidence threshold
      const confidenceThreshold = options.confidenceThreshold || this.config.confidenceThreshold;
      
      // Normalize scores if needed
      const normalizedOptions = this._normalizeScores(evaluationResults.options);
      
      // Generate recommendations
      const recommendations = normalizedOptions
        .filter(option => option.confidence >= confidenceThreshold)
        .map((option, index) => {
          // Determine recommendation level
          let recommendationLevel = 'not_recommended';
          for (const [level, threshold] of Object.entries(thresholds)) {
            if (option.normalizedScore >= threshold) {
              recommendationLevel = level;
              break;
            }
          }
          
          return {
            optionId: option.id,
            rank: index + 1,
            score: option.score,
            normalizedScore: option.normalizedScore,
            confidence: option.confidence,
            recommendation: recommendationLevel
          };
        })
        .slice(0, maxRecommendations);
      
      // Group recommendations by level
      const recommendationsByLevel = {};
      for (const recommendation of recommendations) {
        if (!recommendationsByLevel[recommendation.recommendation]) {
          recommendationsByLevel[recommendation.recommendation] = [];
        }
        recommendationsByLevel[recommendation.recommendation].push(recommendation);
      }
      
      // Calculate recommendation metrics
      const recommendationMetrics = {
        totalRecommendations: recommendations.length,
        recommendationLevels: Object.keys(recommendationsByLevel).map(level => ({
          level,
          count: recommendationsByLevel[level].length
        })),
        confidenceRange: {
          min: Math.min(...recommendations.map(r => r.confidence)),
          max: Math.max(...recommendations.map(r => r.confidence))
        },
        averageConfidence: recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
      };
      
      // Prepare result
      const result = {
        recommendations,
        recommendationsByLevel,
        metadata: {
          thresholds,
          maxRecommendations,
          confidenceThreshold,
          metrics: recommendationMetrics
        }
      };
      
      // Emit recommendation complete event
      this.events.emit('recommendation:complete', {
        timestamp: Date.now(),
        context,
        recommendationCount: recommendations.length
      });
      
      return result;
    } catch (error) {
      this.logger.error('Recommendation generation failed', error);
      
      // Emit recommendation error event
      this.events.emit('recommendation:error', {
        timestamp: Date.now(),
        context,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Normalizes scores for options
   * @private
   * @param {Array} options The options to normalize
   * @returns {Array} The options with normalized scores
   */
  _normalizeScores(options) {
    // Find min and max scores
    const scores = options.map(option => option.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    // Normalize scores
    return options.map(option => ({
      ...option,
      normalizedScore: maxScore > minScore
        ? (option.score - minScore) / (maxScore - minScore)
        : 0.5 // Default to middle value if all scores are the same
    }));
  }
  
  /**
   * Registers API endpoints for the Recommendation Generator
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register generate endpoint
    api.register(`${namespace}/recommendations/generate`, {
      post: async (req, res) => {
        try {
          const { evaluationResults, context, options } = req.body;
          
          if (!evaluationResults) {
            return res.status(400).json({
              error: 'Evaluation results are required'
            });
          }
          
          const result = await this.generateRecommendations(evaluationResults, context || {}, options || {});
          
          return res.json(result);
        } catch (error) {
          this.logger.error('API error in generate endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { RecommendationGenerator };
