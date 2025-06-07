/**
 * @fileoverview Explanation Engine for the Decision Intelligence Tentacle
 * 
 * This component is responsible for generating transparent explanations
 * for recommendations to help users understand the decision-making process.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Explanation Engine for the Decision Intelligence Tentacle
 */
class ExplanationEngine {
  /**
   * Creates a new instance of the Explanation Engine
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('ExplanationEngine');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      explanationTypes: config.explanationTypes || ['factor_based', 'comparative', 'counterfactual'],
      defaultExplanationType: config.defaultExplanationType || 'factor_based',
      detailLevel: config.detailLevel || 'medium'
    };
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.generateExplanations = this.generateExplanations.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Explanation Engine
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Explanation Engine');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      this.initialized = true;
      this.logger.info('Explanation Engine initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'explanationEngine' });
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('explanationEngine');
      
      if (config) {
        this.config.explanationTypes = config.get('explanationTypes') || this.config.explanationTypes;
        this.config.defaultExplanationType = config.get('defaultExplanationType') || this.config.defaultExplanationType;
        this.config.detailLevel = config.get('detailLevel') || this.config.detailLevel;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Shuts down the Explanation Engine
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Explanation Engine');
    
    try {
      this.initialized = false;
      this.logger.info('Explanation Engine shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'explanationEngine' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Explanation Engine
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config
    };
  }
  
  /**
   * Generates explanations for recommendations
   * @param {Object} recommendationResults The recommendation results
   * @param {Object} evaluationResults The evaluation results
   * @param {Object} analysisResults The analysis results
   * @param {Object} context The context for explanations
   * @param {Object} options Explanation options
   * @returns {Promise<Object>} A promise that resolves with the explanation results
   */
  async generateExplanations(recommendationResults, evaluationResults, analysisResults, context = {}, options = {}) {
    if (!this.initialized) {
      throw new Error('Explanation Engine not initialized');
    }
    
    if (!recommendationResults || !recommendationResults.recommendations) {
      throw new Error('Recommendation results are required');
    }
    
    if (!evaluationResults || !evaluationResults.options) {
      throw new Error('Evaluation results are required');
    }
    
    this.logger.info('Generating explanations', {
      recommendationCount: recommendationResults.recommendations.length,
      contextType: typeof context,
      options
    });
    
    try {
      // Emit explanation start event
      this.events.emit('explanation:start', {
        timestamp: Date.now(),
        context
      });
      
      // Determine explanation type
      const explanationType = options.explanationType || this.config.defaultExplanationType;
      
      // Determine detail level
      const detailLevel = options.detailLevel || this.config.detailLevel;
      
      // Generate explanations based on type
      let explanations;
      switch (explanationType) {
        case 'factor_based':
          explanations = await this._generateFactorBasedExplanations(
            recommendationResults,
            evaluationResults,
            analysisResults,
            context,
            detailLevel
          );
          break;
        case 'comparative':
          explanations = await this._generateComparativeExplanations(
            recommendationResults,
            evaluationResults,
            analysisResults,
            context,
            detailLevel
          );
          break;
        case 'counterfactual':
          explanations = await this._generateCounterfactualExplanations(
            recommendationResults,
            evaluationResults,
            analysisResults,
            context,
            detailLevel
          );
          break;
        default:
          throw new Error(`Unsupported explanation type: ${explanationType}`);
      }
      
      // Prepare result
      const result = {
        explanations,
        metadata: {
          explanationType,
          detailLevel,
          generatedAt: Date.now()
        }
      };
      
      // Emit explanation complete event
      this.events.emit('explanation:complete', {
        timestamp: Date.now(),
        context,
        explanationCount: explanations.length
      });
      
      return result;
    } catch (error) {
      this.logger.error('Explanation generation failed', error);
      
      // Emit explanation error event
      this.events.emit('explanation:error', {
        timestamp: Date.now(),
        context,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Generates factor-based explanations
   * @private
   * @param {Object} recommendationResults The recommendation results
   * @param {Object} evaluationResults The evaluation results
   * @param {Object} analysisResults The analysis results
   * @param {Object} context The context for explanations
   * @param {string} detailLevel The detail level for explanations
   * @returns {Promise<Array>} A promise that resolves with the explanations
   */
  async _generateFactorBasedExplanations(recommendationResults, evaluationResults, analysisResults, context, detailLevel) {
    this.logger.info('Generating factor-based explanations');
    
    // Get recommendations
    const { recommendations } = recommendationResults;
    
    // Get evaluation options
    const evaluationOptions = evaluationResults.options;
    
    // Get evaluation metrics
    const { evaluationMetrics } = evaluationResults;
    
    // Get weights
    const weights = evaluationMetrics.weights || {};
    
    // Generate explanations for each recommendation
    const explanations = recommendations.map(recommendation => {
      // Find corresponding option in evaluation results
      const option = evaluationOptions.find(o => o.id === recommendation.optionId);
      
      if (!option) {
        return {
          optionId: recommendation.optionId,
          explanation: 'No explanation available due to missing evaluation data.',
          factors: []
        };
      }
      
      // Determine key factors
      const factors = [];
      
      // Add factors based on weights
      for (const [attribute, weight] of Object.entries(weights)) {
        const value = option.attributes[attribute];
        const normalizedValue = option.attributes[`${attribute}_normalized`];
        
        if (typeof value === 'number' || typeof normalizedValue === 'number') {
          const impact = Math.abs(weight) > 0.5 ? 'high' : Math.abs(weight) > 0.3 ? 'medium' : 'low';
          const direction = weight > 0 ? 'positive' : 'negative';
          
          factors.push({
            name: attribute,
            value,
            normalizedValue,
            weight,
            impact,
            direction,
            description: this._generateFactorDescription(attribute, value, weight, impact, direction)
          });
        }
      }
      
      // Sort factors by absolute weight (descending)
      factors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
      
      // Generate explanation text
      const explanationText = this._generateFactorBasedExplanationText(
        recommendation,
        option,
        factors,
        detailLevel
      );
      
      return {
        optionId: recommendation.optionId,
        explanation: explanationText,
        factors: detailLevel === 'low' ? factors.slice(0, 2) : factors
      };
    });
    
    return explanations;
  }
  
  /**
   * Generates comparative explanations
   * @private
   * @param {Object} recommendationResults The recommendation results
   * @param {Object} evaluationResults The evaluation results
   * @param {Object} analysisResults The analysis results
   * @param {Object} context The context for explanations
   * @param {string} detailLevel The detail level for explanations
   * @returns {Promise<Array>} A promise that resolves with the explanations
   */
  async _generateComparativeExplanations(recommendationResults, evaluationResults, analysisResults, context, detailLevel) {
    this.logger.info('Generating comparative explanations');
    
    // Get recommendations
    const { recommendations } = recommendationResults;
    
    // Get evaluation options
    const evaluationOptions = evaluationResults.options;
    
    // Generate explanations for each recommendation
    const explanations = recommendations.map(recommendation => {
      // Find corresponding option in evaluation results
      const option = evaluationOptions.find(o => o.id === recommendation.optionId);
      
      if (!option) {
        return {
          optionId: recommendation.optionId,
          explanation: 'No explanation available due to missing evaluation data.',
          comparisons: []
        };
      }
      
      // Find options to compare with
      const otherOptions = evaluationOptions.filter(o => o.id !== recommendation.optionId);
      
      // Generate comparisons
      const comparisons = [];
      
      // Compare with top alternative if this is not the top recommendation
      if (recommendation.rank > 1) {
        const topOption = evaluationOptions[0];
        comparisons.push(this._generateComparison(option, topOption, 'top'));
      }
      
      // Compare with next best alternative if this is the top recommendation
      if (recommendation.rank === 1 && otherOptions.length > 0) {
        const nextBestOption = otherOptions[0];
        comparisons.push(this._generateComparison(option, nextBestOption, 'next'));
      }
      
      // Compare with average if detail level is medium or high
      if (detailLevel !== 'low') {
        const averageOption = this._calculateAverageOption(evaluationOptions);
        comparisons.push(this._generateComparison(option, averageOption, 'average'));
      }
      
      // Generate explanation text
      const explanationText = this._generateComparativeExplanationText(
        recommendation,
        option,
        comparisons,
        detailLevel
      );
      
      return {
        optionId: recommendation.optionId,
        explanation: explanationText,
        comparisons
      };
    });
    
    return explanations;
  }
  
  /**
   * Generates counterfactual explanations
   * @private
   * @param {Object} recommendationResults The recommendation results
   * @param {Object} evaluationResults The evaluation results
   * @param {Object} analysisResults The analysis results
   * @param {Object} context The context for explanations
   * @param {string} detailLevel The detail level for explanations
   * @returns {Promise<Array>} A promise that resolves with the explanations
   */
  async _generateCounterfactualExplanations(recommendationResults, evaluationResults, analysisResults, context, detailLevel) {
    this.logger.info('Generating counterfactual explanations');
    
    // Get recommendations
    const { recommendations } = recommendationResults;
    
    // Get evaluation options
    const evaluationOptions = evaluationResults.options;
    
    // Get evaluation metrics
    const { evaluationMetrics } = evaluationResults;
    
    // Get weights
    const weights = evaluationMetrics.weights || {};
    
    // Generate explanations for each recommendation
    const explanations = recommendations.map(recommendation => {
      // Find corresponding option in evaluation results
      const option = evaluationOptions.find(o => o.id === recommendation.optionId);
      
      if (!option) {
        return {
          optionId: recommendation.optionId,
          explanation: 'No explanation available due to missing evaluation data.',
          counterfactuals: []
        };
      }
      
      // Generate counterfactuals
      const counterfactuals = [];
      
      // Generate counterfactuals for key attributes
      for (const [attribute, weight] of Object.entries(weights)) {
        if (Math.abs(weight) > 0.2) { // Only consider significant attributes
          const value = option.attributes[attribute];
          
          if (typeof value === 'number') {
            // Calculate threshold for change in recommendation
            const threshold = this._calculateCounterfactualThreshold(
              option,
              attribute,
              value,
              weight,
              evaluationOptions,
              recommendation.rank
            );
            
            if (threshold) {
              counterfactuals.push({
                attribute,
                currentValue: value,
                thresholdValue: threshold.value,
                changeDirection: threshold.direction,
                impact: threshold.impact,
                description: this._generateCounterfactualDescription(attribute, value, threshold)
              });
            }
          }
        }
      }
      
      // Sort counterfactuals by impact (descending)
      counterfactuals.sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.impact] - impactOrder[a.impact];
      });
      
      // Generate explanation text
      const explanationText = this._generateCounterfactualExplanationText(
        recommendation,
        option,
        counterfactuals,
        detailLevel
      );
      
      return {
        optionId: recommendation.optionId,
        explanation: explanationText,
        counterfactuals: detailLevel === 'low' ? counterfactuals.slice(0, 2) : counterfactuals
      };
    });
    
    return explanations;
  }
  
  /**
   * Generates a factor description
   * @private
   * @param {string} attribute The attribute name
   * @param {number} value The attribute value
   * @param {number} weight The attribute weight
   * @param {string} impact The impact level
   * @param {string} direction The impact direction
   * @returns {string} The factor description
   */
  _generateFactorDescription(attribute, value, weight, impact, direction) {
    const formattedAttribute = attribute.replace(/_/g, ' ');
    
    if (direction === 'positive') {
      return `The ${formattedAttribute} of ${value} had a ${impact} positive impact on the overall score.`;
    } else {
      return `The ${formattedAttribute} of ${value} had a ${impact} negative impact on the overall score.`;
    }
  }
  
  /**
   * Generates factor-based explanation text
   * @private
   * @param {Object} recommendation The recommendation
   * @param {Object} option The option
   * @param {Array} factors The factors
   * @param {string} detailLevel The detail level
   * @returns {string} The explanation text
   */
  _generateFactorBasedExplanationText(recommendation, option, factors, detailLevel) {
    const topFactors = factors.slice(0, detailLevel === 'low' ? 2 : detailLevel === 'medium' ? 3 : 5);
    
    let explanation = `Option ${recommendation.optionId} was ranked #${recommendation.rank} with a score of ${recommendation.score.toFixed(2)}.`;
    
    if (topFactors.length > 0) {
      explanation += ' The key factors influencing this recommendation were:';
      
      for (const factor of topFactors) {
        explanation += ` ${factor.description}`;
      }
    }
    
    if (detailLevel === 'high' && recommendation.confidence) {
      explanation += ` The confidence level for this recommendation is ${(recommendation.confidence * 100).toFixed(0)}%.`;
    }
    
    return explanation;
  }
  
  /**
   * Generates a comparison between two options
   * @private
   * @param {Object} option The option
   * @param {Object} compareOption The option to compare with
   * @param {string} compareType The comparison type
   * @returns {Object} The comparison
   */
  _generateComparison(option, compareOption, compareType) {
    const differences = {};
    const significantDifferences = [];
    
    // Compare attributes
    for (const [key, value] of Object.entries(option.attributes)) {
      if (typeof value === 'number' && typeof compareOption.attributes[key] === 'number') {
        const diff = value - compareOption.attributes[key];
        const percentDiff = compareOption.attributes[key] !== 0
          ? (diff / Math.abs(compareOption.attributes[key])) * 100
          : 0;
        
        differences[key] = {
          attribute: key,
          optionValue: value,
          compareValue: compareOption.attributes[key],
          difference: diff,
          percentDifference: percentDiff
        };
        
        // Consider significant differences
        if (Math.abs(percentDiff) >= 10) {
          significantDifferences.push({
            ...differences[key],
            significance: Math.abs(percentDiff) >= 50 ? 'high' : Math.abs(percentDiff) >= 25 ? 'medium' : 'low'
          });
        }
      }
    }
    
    // Sort significant differences by absolute percent difference (descending)
    significantDifferences.sort((a, b) => Math.abs(b.percentDifference) - Math.abs(a.percentDifference));
    
    // Generate comparison description
    let description;
    if (compareType === 'top') {
      description = `Compared to the top-ranked option, this option`;
    } else if (compareType === 'next') {
      description = `Compared to the next best option, this option`;
    } else {
      description = `Compared to the average of all options, this option`;
    }
    
    if (significantDifferences.length > 0) {
      const top = significantDifferences[0];
      const formattedAttribute = top.attribute.replace(/_/g, ' ');
      
      if (top.difference > 0) {
        description += ` has a ${top.significance} higher ${formattedAttribute} (${top.percentDifference.toFixed(0)}% higher)`;
      } else {
        description += ` has a ${top.significance} lower ${formattedAttribute} (${Math.abs(top.percentDifference).toFixed(0)}% lower)`;
      }
      
      if (significantDifferences.length > 1) {
        const second = significantDifferences[1];
        const formattedAttribute2 = second.attribute.replace(/_/g, ' ');
        
        description += ` and ${second.difference > 0 ? 'higher' : 'lower'} ${formattedAttribute2}`;
      }
      
      description += '.';
    } else {
      description += ' is similar across all measured attributes.';
    }
    
    return {
      compareType,
      compareOptionId: compareOption.id,
      description,
      differences: Object.values(differences),
      significantDifferences
    };
  }
  
  /**
   * Calculates an average option from a list of options
   * @private
   * @param {Array} options The options
   * @returns {Object} The average option
   */
  _calculateAverageOption(options) {
    const attributes = {};
    const counts = {};
    
    // Sum all numeric attributes
    for (const option of options) {
      for (const [key, value] of Object.entries(option.attributes)) {
        if (typeof value === 'number') {
          attributes[key] = (attributes[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    
    // Calculate averages
    const averageAttributes = {};
    for (const [key, sum] of Object.entries(attributes)) {
      averageAttributes[key] = sum / counts[key];
    }
    
    return {
      id: 'average',
      attributes: averageAttributes
    };
  }
  
  /**
   * Generates comparative explanation text
   * @private
   * @param {Object} recommendation The recommendation
   * @param {Object} option The option
   * @param {Array} comparisons The comparisons
   * @param {string} detailLevel The detail level
   * @returns {string} The explanation text
   */
  _generateComparativeExplanationText(recommendation, option, comparisons, detailLevel) {
    let explanation = `Option ${recommendation.optionId} was ranked #${recommendation.rank} with a score of ${recommendation.score.toFixed(2)}.`;
    
    if (comparisons.length > 0) {
      for (const comparison of comparisons) {
        explanation += ` ${comparison.description}`;
      }
    }
    
    if (detailLevel === 'high' && recommendation.confidence) {
      explanation += ` The confidence level for this recommendation is ${(recommendation.confidence * 100).toFixed(0)}%.`;
    }
    
    return explanation;
  }
  
  /**
   * Calculates a counterfactual threshold
   * @private
   * @param {Object} option The option
   * @param {string} attribute The attribute
   * @param {number} value The current value
   * @param {number} weight The attribute weight
   * @param {Array} allOptions All options
   * @param {number} currentRank The current rank
   * @returns {Object|null} The threshold or null if not applicable
   */
  _calculateCounterfactualThreshold(option, attribute, value, weight, allOptions, currentRank) {
    // For simplicity, we'll use a heuristic approach
    // In a real implementation, this would involve more sophisticated calculations
    
    // If this is already the top option, look for threshold to lose top position
    if (currentRank === 1 && allOptions.length > 1) {
      const nextBestOption = allOptions[1];
      const scoreDifference = option.score - nextBestOption.score;
      
      // Estimate value change needed to lose top position
      const valueChange = scoreDifference / Math.abs(weight);
      
      // Direction of change depends on weight sign
      const direction = weight > 0 ? 'decrease' : 'increase';
      
      // Calculate new value
      const newValue = direction === 'decrease'
        ? value - valueChange
        : value + valueChange;
      
      return {
        value: newValue,
        direction,
        impact: scoreDifference < 0.1 ? 'low' : scoreDifference < 0.3 ? 'medium' : 'high'
      };
    }
    
    // If not top option, look for threshold to improve rank
    else if (currentRank > 1) {
      const betterOption = allOptions[currentRank - 2]; // -2 because ranks start at 1 and arrays at 0
      const scoreDifference = betterOption.score - option.score;
      
      // Estimate value change needed to improve rank
      const valueChange = scoreDifference / Math.abs(weight);
      
      // Direction of change depends on weight sign
      const direction = weight > 0 ? 'increase' : 'decrease';
      
      // Calculate new value
      const newValue = direction === 'increase'
        ? value + valueChange
        : value - valueChange;
      
      return {
        value: newValue,
        direction,
        impact: scoreDifference < 0.1 ? 'low' : scoreDifference < 0.3 ? 'medium' : 'high'
      };
    }
    
    return null;
  }
  
  /**
   * Generates a counterfactual description
   * @private
   * @param {string} attribute The attribute
   * @param {number} value The current value
   * @param {Object} threshold The threshold
   * @returns {string} The counterfactual description
   */
  _generateCounterfactualDescription(attribute, value, threshold) {
    const formattedAttribute = attribute.replace(/_/g, ' ');
    const formattedValue = threshold.value.toFixed(2);
    
    if (threshold.direction === 'increase') {
      return `If the ${formattedAttribute} were increased from ${value} to ${formattedValue}, this would have a ${threshold.impact} impact on the recommendation.`;
    } else {
      return `If the ${formattedAttribute} were decreased from ${value} to ${formattedValue}, this would have a ${threshold.impact} impact on the recommendation.`;
    }
  }
  
  /**
   * Generates counterfactual explanation text
   * @private
   * @param {Object} recommendation The recommendation
   * @param {Object} option The option
   * @param {Array} counterfactuals The counterfactuals
   * @param {string} detailLevel The detail level
   * @returns {string} The explanation text
   */
  _generateCounterfactualExplanationText(recommendation, option, counterfactuals, detailLevel) {
    let explanation = `Option ${recommendation.optionId} was ranked #${recommendation.rank} with a score of ${recommendation.score.toFixed(2)}.`;
    
    if (counterfactuals.length > 0) {
      explanation += ' The recommendation could change under these conditions:';
      
      const topCounterfactuals = counterfactuals.slice(0, detailLevel === 'low' ? 1 : detailLevel === 'medium' ? 2 : 3);
      
      for (const counterfactual of topCounterfactuals) {
        explanation += ` ${counterfactual.description}`;
      }
    } else {
      explanation += ' This recommendation is stable and unlikely to change with small variations in the input values.';
    }
    
    if (detailLevel === 'high' && recommendation.confidence) {
      explanation += ` The confidence level for this recommendation is ${(recommendation.confidence * 100).toFixed(0)}%.`;
    }
    
    return explanation;
  }
  
  /**
   * Registers API endpoints for the Explanation Engine
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register explain endpoint
    api.register(`${namespace}/explanations/generate`, {
      post: async (req, res) => {
        try {
          const { recommendationResults, evaluationResults, analysisResults, context, options } = req.body;
          
          if (!recommendationResults) {
            return res.status(400).json({
              error: 'Recommendation results are required'
            });
          }
          
          if (!evaluationResults) {
            return res.status(400).json({
              error: 'Evaluation results are required'
            });
          }
          
          const result = await this.generateExplanations(
            recommendationResults,
            evaluationResults,
            analysisResults,
            context || {},
            options || {}
          );
          
          return res.json(result);
        } catch (error) {
          this.logger.error('API error in explain endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { ExplanationEngine };
