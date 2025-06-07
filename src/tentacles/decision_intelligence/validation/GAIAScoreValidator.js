/**
 * @fileoverview GAIA Score Impact Validator for Decision Intelligence Tentacle
 * 
 * This module validates the impact of the Decision Intelligence Tentacle on the
 * GAIA (General AI Aptitude) Score of the Aideon system.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * GAIA Score Impact Validator
 */
class GAIAScoreValidator {
  /**
   * Creates a new instance of the GAIA Score Validator
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} decisionIntelligenceTentacle Reference to the Decision Intelligence Tentacle
   * @param {Object} config Configuration options
   */
  constructor(aideon, decisionIntelligenceTentacle, config = {}) {
    this.aideon = aideon;
    this.decisionIntelligenceTentacle = decisionIntelligenceTentacle;
    this.logger = new Logger('GAIAScoreValidator');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      validationInterval: config.validationInterval || 86400000, // 24 hours in milliseconds
      autoValidate: config.autoValidate !== undefined ? config.autoValidate : true,
      detailedReporting: config.detailedReporting !== undefined ? config.detailedReporting : true,
      ...config
    };
    
    // Validation results
    this.validationResults = null;
    
    // Validation timer
    this.validationTimer = null;
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.validateGAIAScoreImpact = this.validateGAIAScoreImpact.bind(this);
    this.getValidationResults = this.getValidationResults.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the GAIA Score Validator
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing GAIA Score Validator');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Start validation timer if auto-validate is enabled
      if (this.config.autoValidate) {
        this._startValidationTimer();
      }
      
      this.initialized = true;
      this.logger.info('GAIA Score Validator initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'gaiaScoreValidator' });
      
      // Run initial validation
      if (this.config.autoValidate) {
        await this.validateGAIAScoreImpact();
      }
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('gaiaScoreValidator');
      
      if (config) {
        this.config.validationInterval = config.get('validationInterval') || this.config.validationInterval;
        this.config.autoValidate = config.get('autoValidate') !== undefined ? config.get('autoValidate') : this.config.autoValidate;
        this.config.detailedReporting = config.get('detailedReporting') !== undefined ? config.get('detailedReporting') : this.config.detailedReporting;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Starts the validation timer
   * @private
   */
  _startValidationTimer() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }
    
    this.validationTimer = setInterval(() => {
      this.validateGAIAScoreImpact().catch(error => {
        this.logger.error('Scheduled validation failed', error);
      });
    }, this.config.validationInterval);
    
    this.logger.info(`Validation timer started with interval ${this.config.validationInterval}ms`);
  }
  
  /**
   * Shuts down the GAIA Score Validator
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down GAIA Score Validator');
    
    try {
      // Stop validation timer
      if (this.validationTimer) {
        clearInterval(this.validationTimer);
        this.validationTimer = null;
      }
      
      // Clear validation results
      this.validationResults = null;
      
      this.initialized = false;
      this.logger.info('GAIA Score Validator shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'gaiaScoreValidator' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the GAIA Score Validator
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      lastValidation: this.validationResults ? this.validationResults.timestamp : null,
      hasValidationResults: !!this.validationResults
    };
  }
  
  /**
   * Validates the GAIA Score impact of the Decision Intelligence Tentacle
   * @param {Object} options Validation options
   * @returns {Promise<Object>} A promise that resolves with the validation results
   */
  async validateGAIAScoreImpact(options = {}) {
    if (!this.initialized) {
      throw new Error('GAIA Score Validator not initialized');
    }
    
    this.logger.info('Validating GAIA Score impact');
    
    try {
      // Get current GAIA Score
      const currentScore = await this._getCurrentGAIAScore();
      
      // Get baseline GAIA Score (without Decision Intelligence Tentacle)
      const baselineScore = await this._getBaselineGAIAScore();
      
      // Calculate impact
      const impact = this._calculateImpact(currentScore, baselineScore);
      
      // Run component-specific validations
      const componentImpacts = await this._validateComponentImpacts();
      
      // Create validation results
      this.validationResults = {
        timestamp: Date.now(),
        currentScore,
        baselineScore,
        impact,
        componentImpacts,
        options
      };
      
      // Emit validation complete event
      this.events.emit('validation:complete', {
        timestamp: this.validationResults.timestamp,
        impact: this.validationResults.impact
      });
      
      // Track metrics if available
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent('gaiaScore:validation', {
          timestamp: this.validationResults.timestamp,
          impact: this.validationResults.impact.total,
          componentCount: Object.keys(componentImpacts).length
        });
      }
      
      this.logger.info('GAIA Score validation complete', {
        impact: this.validationResults.impact.total
      });
      
      return this.validationResults;
    } catch (error) {
      this.logger.error('Validation failed', error);
      
      // Emit validation error event
      this.events.emit('validation:error', {
        timestamp: Date.now(),
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Gets the current GAIA Score
   * @private
   * @returns {Promise<Object>} A promise that resolves with the current GAIA Score
   */
  async _getCurrentGAIAScore() {
    this.logger.info('Getting current GAIA Score');
    
    if (!this.aideon || !this.aideon.gaia) {
      throw new Error('GAIA Score system not available');
    }
    
    try {
      const score = await this.aideon.gaia.getCurrentScore();
      
      this.logger.info('Current GAIA Score retrieved', {
        total: score.total
      });
      
      return score;
    } catch (error) {
      this.logger.error('Failed to get current GAIA Score', error);
      throw error;
    }
  }
  
  /**
   * Gets the baseline GAIA Score (without Decision Intelligence Tentacle)
   * @private
   * @returns {Promise<Object>} A promise that resolves with the baseline GAIA Score
   */
  async _getBaselineGAIAScore() {
    this.logger.info('Getting baseline GAIA Score');
    
    if (!this.aideon || !this.aideon.gaia) {
      throw new Error('GAIA Score system not available');
    }
    
    try {
      // Get baseline score by excluding the Decision Intelligence Tentacle
      const score = await this.aideon.gaia.getScoreWithout('decision-intelligence');
      
      this.logger.info('Baseline GAIA Score retrieved', {
        total: score.total
      });
      
      return score;
    } catch (error) {
      this.logger.error('Failed to get baseline GAIA Score', error);
      throw error;
    }
  }
  
  /**
   * Calculates the impact of the Decision Intelligence Tentacle on the GAIA Score
   * @private
   * @param {Object} currentScore The current GAIA Score
   * @param {Object} baselineScore The baseline GAIA Score
   * @returns {Object} The calculated impact
   */
  _calculateImpact(currentScore, baselineScore) {
    this.logger.info('Calculating GAIA Score impact');
    
    // Calculate total impact
    const totalImpact = currentScore.total - baselineScore.total;
    
    // Calculate dimension impacts
    const dimensionImpacts = {};
    
    for (const dimension of Object.keys(currentScore.dimensions)) {
      const currentDimensionScore = currentScore.dimensions[dimension];
      const baselineDimensionScore = baselineScore.dimensions[dimension] || 0;
      
      dimensionImpacts[dimension] = currentDimensionScore - baselineDimensionScore;
    }
    
    // Calculate percentage impact
    const percentageImpact = baselineScore.total > 0 ? 
      (totalImpact / baselineScore.total) * 100 : 0;
    
    return {
      total: totalImpact,
      percentage: percentageImpact,
      dimensions: dimensionImpacts
    };
  }
  
  /**
   * Validates the impact of individual components on the GAIA Score
   * @private
   * @returns {Promise<Object>} A promise that resolves with the component impacts
   */
  async _validateComponentImpacts() {
    this.logger.info('Validating component impacts');
    
    if (!this.aideon || !this.aideon.gaia) {
      throw new Error('GAIA Score system not available');
    }
    
    try {
      const componentImpacts = {};
      
      // Get tentacle status to identify components
      const tentacleStatus = this.decisionIntelligenceTentacle.getStatus();
      
      // Validate each component's impact
      for (const componentName of Object.keys(tentacleStatus.components)) {
        // Skip components that aren't initialized
        if (!tentacleStatus.components[componentName].initialized) {
          continue;
        }
        
        // Get score without this component
        const scoreWithoutComponent = await this.aideon.gaia.getScoreWithout(
          'decision-intelligence',
          componentName
        );
        
        // Get current score
        const currentScore = await this._getCurrentGAIAScore();
        
        // Calculate impact
        const impact = currentScore.total - scoreWithoutComponent.total;
        
        // Calculate percentage contribution to tentacle's impact
        const tentacleImpact = currentScore.total - (await this._getBaselineGAIAScore()).total;
        const percentageContribution = tentacleImpact !== 0 ? 
          (impact / tentacleImpact) * 100 : 0;
        
        componentImpacts[componentName] = {
          impact,
          percentageContribution
        };
      }
      
      return componentImpacts;
    } catch (error) {
      this.logger.error('Failed to validate component impacts', error);
      return {};
    }
  }
  
  /**
   * Gets the validation results
   * @returns {Object|null} The validation results or null if not available
   */
  getValidationResults() {
    return this.validationResults;
  }
  
  /**
   * Registers API endpoints for the GAIA Score Validator
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register validation endpoint
    api.register(`${namespace}/gaia/validate`, {
      post: async (req, res) => {
        try {
          const options = req.body || {};
          
          const results = await this.validateGAIAScoreImpact(options);
          
          return res.json(results);
        } catch (error) {
          this.logger.error('API error in validation endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register results endpoint
    api.register(`${namespace}/gaia/results`, {
      get: async (req, res) => {
        try {
          const results = this.getValidationResults();
          
          if (!results) {
            return res.status(404).json({
              error: 'No validation results available'
            });
          }
          
          return res.json(results);
        } catch (error) {
          this.logger.error('API error in results endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { GAIAScoreValidator };
