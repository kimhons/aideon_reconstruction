/**
 * @fileoverview Decision Outcome Tracker for the Decision Intelligence Tentacle
 * 
 * This component is responsible for tracking, analyzing, and learning from decision outcomes
 * to improve future decision-making.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Decision Outcome Tracker for the Decision Intelligence Tentacle
 */
class DecisionOutcomeTracker {
  /**
   * Creates a new instance of the Decision Outcome Tracker
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('DecisionOutcomeTracker');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      storageEnabled: config.storageEnabled !== undefined ? config.storageEnabled : true,
      learningEnabled: config.learningEnabled !== undefined ? config.learningEnabled : true,
      maxOutcomesPerDecision: config.maxOutcomesPerDecision || 1000,
      cleanupInterval: config.cleanupInterval || 86400000, // 24 hours in milliseconds
      ...config
    };
    
    // Storage for decision outcomes
    this.outcomes = new Map();
    
    // Learning models
    this.learningModels = new Map();
    
    // Cleanup timer
    this.cleanupTimer = null;
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.trackOutcome = this.trackOutcome.bind(this);
    this.getOutcomes = this.getOutcomes.bind(this);
    this.analyzeOutcomes = this.analyzeOutcomes.bind(this);
    this.learnFromOutcomes = this.learnFromOutcomes.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Decision Outcome Tracker
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Decision Outcome Tracker');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Load saved outcomes if storage is enabled
      if (this.config.storageEnabled) {
        await this._loadSavedOutcomes();
      }
      
      // Initialize learning models if learning is enabled
      if (this.config.learningEnabled) {
        await this._initializeLearningModels();
      }
      
      // Start cleanup timer
      this._startCleanupTimer();
      
      this.initialized = true;
      this.logger.info('Decision Outcome Tracker initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'decisionOutcomeTracker' });
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('outcomeTracker');
      
      if (config) {
        this.config.storageEnabled = config.get('storageEnabled') !== undefined ? config.get('storageEnabled') : this.config.storageEnabled;
        this.config.learningEnabled = config.get('learningEnabled') !== undefined ? config.get('learningEnabled') : this.config.learningEnabled;
        this.config.maxOutcomesPerDecision = config.get('maxOutcomesPerDecision') || this.config.maxOutcomesPerDecision;
        this.config.cleanupInterval = config.get('cleanupInterval') || this.config.cleanupInterval;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Loads saved decision outcomes from storage
   * @private
   * @returns {Promise<void>} A promise that resolves when outcomes are loaded
   */
  async _loadSavedOutcomes() {
    if (!this.aideon || !this.aideon.storage) {
      this.logger.warn('Storage service not available, skipping outcome loading');
      return;
    }
    
    try {
      this.logger.info('Loading saved decision outcomes');
      
      const savedOutcomes = await this.aideon.storage.getNamespace('decisionOutcomes').getAll();
      
      if (savedOutcomes && Object.keys(savedOutcomes).length > 0) {
        for (const [decisionId, outcomesList] of Object.entries(savedOutcomes)) {
          this.outcomes.set(decisionId, outcomesList);
        }
        
        this.logger.info(`Loaded outcomes for ${this.outcomes.size} decisions`);
      } else {
        this.logger.info('No saved decision outcomes found');
      }
    } catch (error) {
      this.logger.error('Failed to load saved outcomes', error);
      // Continue initialization even if loading fails
    }
  }
  
  /**
   * Initializes learning models
   * @private
   * @returns {Promise<void>} A promise that resolves when learning models are initialized
   */
  async _initializeLearningModels() {
    this.logger.info('Initializing learning models');
    
    try {
      // Initialize default learning models
      this.learningModels.set('satisfaction', this._createSatisfactionModel());
      this.learningModels.set('effectiveness', this._createEffectivenessModel());
      this.learningModels.set('confidence', this._createConfidenceModel());
      
      // Load custom learning models if available
      if (this.aideon && this.aideon.models) {
        const customModels = await this.aideon.models.getNamespace('decisionOutcomes').getAll();
        
        if (customModels && Object.keys(customModels).length > 0) {
          for (const [modelId, model] of Object.entries(customModels)) {
            this.learningModels.set(modelId, model);
          }
          
          this.logger.info(`Loaded ${Object.keys(customModels).length} custom learning models`);
        }
      }
      
      this.logger.info(`Initialized ${this.learningModels.size} learning models`);
    } catch (error) {
      this.logger.error('Failed to initialize learning models', error);
      // Continue initialization even if model initialization fails
    }
  }
  
  /**
   * Creates a satisfaction learning model
   * @private
   * @returns {Object} The satisfaction learning model
   */
  _createSatisfactionModel() {
    return {
      id: 'satisfaction',
      name: 'User Satisfaction Model',
      description: 'Predicts user satisfaction with decision recommendations',
      version: '1.0.0',
      features: ['decisionType', 'userRole', 'confidenceScore', 'explanationProvided', 'optionCount'],
      weights: {
        decisionType: {
          binary: 0.2,
          'multi-option': 0.3,
          'resource-allocation': 0.4,
          sequencing: 0.3,
          portfolio: 0.5,
          parameter: 0.4,
          custom: 0.3
        },
        userRole: {
          admin: 0.4,
          manager: 0.3,
          user: 0.2,
          guest: 0.1
        },
        confidenceScore: 0.4,
        explanationProvided: 0.3,
        optionCount: -0.01 // Slight negative weight for more options
      },
      predict: function(features) {
        let score = 0;
        
        // Apply weights for decision type
        if (features.decisionType && this.weights.decisionType[features.decisionType]) {
          score += this.weights.decisionType[features.decisionType];
        }
        
        // Apply weights for user role
        if (features.userRole && this.weights.userRole[features.userRole]) {
          score += this.weights.userRole[features.userRole];
        }
        
        // Apply weight for confidence score
        if (features.confidenceScore !== undefined) {
          score += this.weights.confidenceScore * features.confidenceScore;
        }
        
        // Apply weight for explanation provided
        if (features.explanationProvided) {
          score += this.weights.explanationProvided;
        }
        
        // Apply weight for option count
        if (features.optionCount !== undefined) {
          score += this.weights.optionCount * features.optionCount;
        }
        
        // Normalize to 0-1 range
        return Math.max(0, Math.min(1, score));
      },
      update: function(features, actualSatisfaction) {
        const learningRate = 0.01;
        const prediction = this.predict(features);
        const error = actualSatisfaction - prediction;
        
        // Update weights based on error
        if (features.decisionType && this.weights.decisionType[features.decisionType]) {
          this.weights.decisionType[features.decisionType] += learningRate * error;
        }
        
        if (features.userRole && this.weights.userRole[features.userRole]) {
          this.weights.userRole[features.userRole] += learningRate * error;
        }
        
        this.weights.confidenceScore += learningRate * error * (features.confidenceScore || 0);
        this.weights.explanationProvided += learningRate * error * (features.explanationProvided ? 1 : 0);
        this.weights.optionCount += learningRate * error * (features.optionCount || 0);
        
        return {
          prediction,
          error,
          updatedWeights: { ...this.weights }
        };
      }
    };
  }
  
  /**
   * Creates an effectiveness learning model
   * @private
   * @returns {Object} The effectiveness learning model
   */
  _createEffectivenessModel() {
    return {
      id: 'effectiveness',
      name: 'Decision Effectiveness Model',
      description: 'Predicts the effectiveness of decision recommendations',
      version: '1.0.0',
      features: ['decisionType', 'dataQuality', 'analysisDepth', 'constraintCount', 'stakeholderCount'],
      weights: {
        decisionType: {
          binary: 0.3,
          'multi-option': 0.4,
          'resource-allocation': 0.5,
          sequencing: 0.4,
          portfolio: 0.6,
          parameter: 0.5,
          custom: 0.4
        },
        dataQuality: 0.5,
        analysisDepth: 0.3,
        constraintCount: -0.02, // Slight negative weight for more constraints
        stakeholderCount: -0.01 // Slight negative weight for more stakeholders
      },
      predict: function(features) {
        let score = 0;
        
        // Apply weights for decision type
        if (features.decisionType && this.weights.decisionType[features.decisionType]) {
          score += this.weights.decisionType[features.decisionType];
        }
        
        // Apply weight for data quality
        if (features.dataQuality !== undefined) {
          score += this.weights.dataQuality * features.dataQuality;
        }
        
        // Apply weight for analysis depth
        if (features.analysisDepth !== undefined) {
          score += this.weights.analysisDepth * features.analysisDepth;
        }
        
        // Apply weight for constraint count
        if (features.constraintCount !== undefined) {
          score += this.weights.constraintCount * features.constraintCount;
        }
        
        // Apply weight for stakeholder count
        if (features.stakeholderCount !== undefined) {
          score += this.weights.stakeholderCount * features.stakeholderCount;
        }
        
        // Normalize to 0-1 range
        return Math.max(0, Math.min(1, score));
      },
      update: function(features, actualEffectiveness) {
        const learningRate = 0.01;
        const prediction = this.predict(features);
        const error = actualEffectiveness - prediction;
        
        // Update weights based on error
        if (features.decisionType && this.weights.decisionType[features.decisionType]) {
          this.weights.decisionType[features.decisionType] += learningRate * error;
        }
        
        this.weights.dataQuality += learningRate * error * (features.dataQuality || 0);
        this.weights.analysisDepth += learningRate * error * (features.analysisDepth || 0);
        this.weights.constraintCount += learningRate * error * (features.constraintCount || 0);
        this.weights.stakeholderCount += learningRate * error * (features.stakeholderCount || 0);
        
        return {
          prediction,
          error,
          updatedWeights: { ...this.weights }
        };
      }
    };
  }
  
  /**
   * Creates a confidence learning model
   * @private
   * @returns {Object} The confidence learning model
   */
  _createConfidenceModel() {
    return {
      id: 'confidence',
      name: 'Recommendation Confidence Model',
      description: 'Predicts the appropriate confidence level for decision recommendations',
      version: '1.0.0',
      features: ['decisionType', 'dataCompleteness', 'dataVariance', 'historicalAccuracy', 'domainExpertise'],
      weights: {
        decisionType: {
          binary: 0.4,
          'multi-option': 0.3,
          'resource-allocation': 0.2,
          sequencing: 0.3,
          portfolio: 0.2,
          parameter: 0.3,
          custom: 0.2
        },
        dataCompleteness: 0.4,
        dataVariance: -0.3, // Negative weight for higher variance
        historicalAccuracy: 0.5,
        domainExpertise: 0.3
      },
      predict: function(features) {
        let score = 0;
        
        // Apply weights for decision type
        if (features.decisionType && this.weights.decisionType[features.decisionType]) {
          score += this.weights.decisionType[features.decisionType];
        }
        
        // Apply weight for data completeness
        if (features.dataCompleteness !== undefined) {
          score += this.weights.dataCompleteness * features.dataCompleteness;
        }
        
        // Apply weight for data variance
        if (features.dataVariance !== undefined) {
          score += this.weights.dataVariance * features.dataVariance;
        }
        
        // Apply weight for historical accuracy
        if (features.historicalAccuracy !== undefined) {
          score += this.weights.historicalAccuracy * features.historicalAccuracy;
        }
        
        // Apply weight for domain expertise
        if (features.domainExpertise !== undefined) {
          score += this.weights.domainExpertise * features.domainExpertise;
        }
        
        // Normalize to 0-1 range
        return Math.max(0, Math.min(1, score));
      },
      update: function(features, actualConfidence) {
        const learningRate = 0.01;
        const prediction = this.predict(features);
        const error = actualConfidence - prediction;
        
        // Update weights based on error
        if (features.decisionType && this.weights.decisionType[features.decisionType]) {
          this.weights.decisionType[features.decisionType] += learningRate * error;
        }
        
        this.weights.dataCompleteness += learningRate * error * (features.dataCompleteness || 0);
        this.weights.dataVariance += learningRate * error * (features.dataVariance || 0);
        this.weights.historicalAccuracy += learningRate * error * (features.historicalAccuracy || 0);
        this.weights.domainExpertise += learningRate * error * (features.domainExpertise || 0);
        
        return {
          prediction,
          error,
          updatedWeights: { ...this.weights }
        };
      }
    };
  }
  
  /**
   * Starts the cleanup timer
   * @private
   */
  _startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this._cleanupOutcomes();
    }, this.config.cleanupInterval);
    
    this.logger.info(`Cleanup timer started with interval ${this.config.cleanupInterval}ms`);
  }
  
  /**
   * Cleans up old outcomes
   * @private
   */
  _cleanupOutcomes() {
    this.logger.info('Running outcome cleanup');
    
    try {
      let totalRemoved = 0;
      
      // Check each decision's outcomes
      for (const [decisionId, outcomesList] of this.outcomes.entries()) {
        if (outcomesList.length > this.config.maxOutcomesPerDecision) {
          // Sort by timestamp (newest first)
          outcomesList.sort((a, b) => b.timestamp - a.timestamp);
          
          // Keep only the most recent outcomes
          const removed = outcomesList.splice(this.config.maxOutcomesPerDecision);
          totalRemoved += removed.length;
          
          // Update storage if enabled
          if (this.config.storageEnabled && this.aideon && this.aideon.storage) {
            this.aideon.storage.getNamespace('decisionOutcomes').set(decisionId, outcomesList);
          }
        }
      }
      
      this.logger.info(`Cleanup complete, removed ${totalRemoved} old outcomes`);
    } catch (error) {
      this.logger.error('Outcome cleanup failed', error);
    }
  }
  
  /**
   * Shuts down the Decision Outcome Tracker
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Decision Outcome Tracker');
    
    try {
      // Stop cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      
      // Save learning models if learning is enabled
      if (this.config.learningEnabled && this.aideon && this.aideon.models) {
        const modelsNamespace = this.aideon.models.getNamespace('decisionOutcomes');
        
        for (const [modelId, model] of this.learningModels.entries()) {
          await modelsNamespace.set(modelId, model);
        }
        
        this.logger.info(`Saved ${this.learningModels.size} learning models`);
      }
      
      // Clear outcomes and models
      this.outcomes.clear();
      this.learningModels.clear();
      
      this.initialized = false;
      this.logger.info('Decision Outcome Tracker shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'decisionOutcomeTracker' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Decision Outcome Tracker
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      outcomeCount: Array.from(this.outcomes.values()).reduce((total, list) => total + list.length, 0),
      decisionCount: this.outcomes.size,
      modelCount: this.learningModels.size
    };
  }
  
  /**
   * Tracks a decision outcome
   * @param {Object} outcome The outcome to track
   * @param {Object} context The context for outcome tracking
   * @returns {Promise<Object>} A promise that resolves with the tracked outcome
   */
  async trackOutcome(outcome, context = {}) {
    if (!this.initialized) {
      throw new Error('Decision Outcome Tracker not initialized');
    }
    
    if (!outcome) {
      throw new Error('Outcome is required');
    }
    
    if (!outcome.decisionId) {
      throw new Error('Decision ID is required');
    }
    
    this.logger.info(`Tracking outcome for decision: ${outcome.decisionId}`);
    
    try {
      // Normalize outcome
      const normalizedOutcome = this._normalizeOutcome(outcome, context);
      
      // Get or create outcomes list for this decision
      if (!this.outcomes.has(normalizedOutcome.decisionId)) {
        this.outcomes.set(normalizedOutcome.decisionId, []);
      }
      
      const outcomesList = this.outcomes.get(normalizedOutcome.decisionId);
      
      // Add outcome to list
      outcomesList.push(normalizedOutcome);
      
      // Save to storage if enabled
      if (this.config.storageEnabled && this.aideon && this.aideon.storage) {
        await this.aideon.storage.getNamespace('decisionOutcomes').set(normalizedOutcome.decisionId, outcomesList);
      }
      
      // Learn from outcome if learning is enabled
      if (this.config.learningEnabled) {
        await this._learnFromOutcome(normalizedOutcome);
      }
      
      // Emit outcome tracked event
      this.events.emit('outcome:tracked', {
        decisionId: normalizedOutcome.decisionId,
        outcomeId: normalizedOutcome.id,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      // Track metrics if available
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent('decisionOutcome:tracked', {
          decisionId: normalizedOutcome.decisionId,
          outcomeId: normalizedOutcome.id,
          userId: context.userId,
          satisfaction: normalizedOutcome.satisfaction,
          effectiveness: normalizedOutcome.effectiveness
        });
      }
      
      return normalizedOutcome;
    } catch (error) {
      this.logger.error('Outcome tracking failed', error);
      
      // Emit outcome tracking error event
      this.events.emit('outcome:error', {
        error: 'tracking_failed',
        decisionId: outcome.decisionId,
        message: error.message,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Normalizes an outcome object
   * @private
   * @param {Object} outcome The outcome to normalize
   * @param {Object} context The context for outcome tracking
   * @returns {Object} The normalized outcome
   */
  _normalizeOutcome(outcome, context) {
    return {
      id: outcome.id || `outcome-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      decisionId: outcome.decisionId,
      timestamp: outcome.timestamp || Date.now(),
      userId: context.userId || outcome.userId || 'anonymous',
      recommendation: outcome.recommendation || null,
      actualChoice: outcome.actualChoice || null,
      satisfaction: outcome.satisfaction !== undefined ? outcome.satisfaction : null,
      effectiveness: outcome.effectiveness !== undefined ? outcome.effectiveness : null,
      confidence: outcome.confidence !== undefined ? outcome.confidence : null,
      feedback: outcome.feedback || null,
      metadata: {
        ...outcome.metadata || {},
        source: outcome.metadata?.source || 'user',
        context: {
          ...outcome.metadata?.context || {},
          ...context
        }
      }
    };
  }
  
  /**
   * Learns from an outcome
   * @private
   * @param {Object} outcome The outcome to learn from
   * @returns {Promise<void>} A promise that resolves when learning is complete
   */
  async _learnFromOutcome(outcome) {
    if (!outcome) {
      return;
    }
    
    this.logger.info(`Learning from outcome: ${outcome.id}`);
    
    try {
      // Extract features from outcome
      const features = this._extractFeaturesFromOutcome(outcome);
      
      // Update satisfaction model if satisfaction is provided
      if (outcome.satisfaction !== null && this.learningModels.has('satisfaction')) {
        const satisfactionModel = this.learningModels.get('satisfaction');
        const updateResult = satisfactionModel.update(features, outcome.satisfaction);
        
        this.logger.info(`Updated satisfaction model, error: ${updateResult.error.toFixed(4)}`);
      }
      
      // Update effectiveness model if effectiveness is provided
      if (outcome.effectiveness !== null && this.learningModels.has('effectiveness')) {
        const effectivenessModel = this.learningModels.get('effectiveness');
        const updateResult = effectivenessModel.update(features, outcome.effectiveness);
        
        this.logger.info(`Updated effectiveness model, error: ${updateResult.error.toFixed(4)}`);
      }
      
      // Update confidence model if confidence is provided
      if (outcome.confidence !== null && this.learningModels.has('confidence')) {
        const confidenceModel = this.learningModels.get('confidence');
        const updateResult = confidenceModel.update(features, outcome.confidence);
        
        this.logger.info(`Updated confidence model, error: ${updateResult.error.toFixed(4)}`);
      }
    } catch (error) {
      this.logger.error(`Learning from outcome failed: ${outcome.id}`, error);
      // Continue operation even if learning fails
    }
  }
  
  /**
   * Extracts features from an outcome
   * @private
   * @param {Object} outcome The outcome to extract features from
   * @returns {Object} The extracted features
   */
  _extractFeaturesFromOutcome(outcome) {
    const features = {
      decisionType: outcome.metadata?.context?.decisionType || 'unknown',
      userRole: outcome.metadata?.context?.userRole || 'user'
    };
    
    // Add recommendation features
    if (outcome.recommendation) {
      features.confidenceScore = outcome.recommendation.confidence || 0;
      features.explanationProvided = !!outcome.recommendation.explanation;
      features.optionCount = Array.isArray(outcome.recommendation.alternatives) ? 
        outcome.recommendation.alternatives.length + 1 : 1;
    }
    
    // Add data quality features
    features.dataCompleteness = outcome.metadata?.dataQuality?.completeness || 0.5;
    features.dataVariance = outcome.metadata?.dataQuality?.variance || 0.5;
    
    // Add analysis features
    features.analysisDepth = outcome.metadata?.analysis?.depth || 0.5;
    features.constraintCount = outcome.metadata?.analysis?.constraintCount || 0;
    features.stakeholderCount = outcome.metadata?.context?.stakeholderCount || 1;
    
    // Add historical features
    features.historicalAccuracy = outcome.metadata?.historical?.accuracy || 0.5;
    features.domainExpertise = outcome.metadata?.context?.domainExpertise || 0.5;
    
    return features;
  }
  
  /**
   * Gets outcomes for a decision
   * @param {string} decisionId The decision ID
   * @param {Object} filters Optional filters for the outcomes
   * @returns {Promise<Array>} A promise that resolves with the outcomes
   */
  async getOutcomes(decisionId, filters = {}) {
    if (!this.initialized) {
      throw new Error('Decision Outcome Tracker not initialized');
    }
    
    if (!decisionId) {
      throw new Error('Decision ID is required');
    }
    
    this.logger.info(`Getting outcomes for decision: ${decisionId}`, { filters });
    
    try {
      // Get outcomes for this decision
      let outcomes = this.outcomes.get(decisionId) || [];
      
      // Apply filters if provided
      if (filters) {
        if (filters.userId) {
          outcomes = outcomes.filter(outcome => outcome.userId === filters.userId);
        }
        
        if (filters.afterTimestamp) {
          outcomes = outcomes.filter(outcome => outcome.timestamp >= filters.afterTimestamp);
        }
        
        if (filters.beforeTimestamp) {
          outcomes = outcomes.filter(outcome => outcome.timestamp <= filters.beforeTimestamp);
        }
        
        if (filters.minSatisfaction !== undefined) {
          outcomes = outcomes.filter(outcome => 
            outcome.satisfaction !== null && outcome.satisfaction >= filters.minSatisfaction
          );
        }
        
        if (filters.maxSatisfaction !== undefined) {
          outcomes = outcomes.filter(outcome => 
            outcome.satisfaction !== null && outcome.satisfaction <= filters.maxSatisfaction
          );
        }
        
        if (filters.minEffectiveness !== undefined) {
          outcomes = outcomes.filter(outcome => 
            outcome.effectiveness !== null && outcome.effectiveness >= filters.minEffectiveness
          );
        }
        
        if (filters.maxEffectiveness !== undefined) {
          outcomes = outcomes.filter(outcome => 
            outcome.effectiveness !== null && outcome.effectiveness <= filters.maxEffectiveness
          );
        }
      }
      
      // Sort by timestamp (newest first) by default
      outcomes.sort((a, b) => b.timestamp - a.timestamp);
      
      // Apply limit if provided
      if (filters.limit && filters.limit > 0) {
        outcomes = outcomes.slice(0, filters.limit);
      }
      
      return outcomes;
    } catch (error) {
      this.logger.error(`Getting outcomes failed: ${decisionId}`, error);
      throw error;
    }
  }
  
  /**
   * Analyzes outcomes for a decision
   * @param {string} decisionId The decision ID
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} A promise that resolves with the analysis results
   */
  async analyzeOutcomes(decisionId, options = {}) {
    if (!this.initialized) {
      throw new Error('Decision Outcome Tracker not initialized');
    }
    
    if (!decisionId) {
      throw new Error('Decision ID is required');
    }
    
    this.logger.info(`Analyzing outcomes for decision: ${decisionId}`, { options });
    
    try {
      // Get outcomes for this decision
      const outcomes = await this.getOutcomes(decisionId, options.filters || {});
      
      if (outcomes.length === 0) {
        return {
          decisionId,
          outcomeCount: 0,
          analysis: {
            satisfaction: null,
            effectiveness: null,
            confidence: null,
            agreement: null
          }
        };
      }
      
      // Calculate satisfaction metrics
      const satisfactionValues = outcomes
        .filter(outcome => outcome.satisfaction !== null)
        .map(outcome => outcome.satisfaction);
      
      const satisfactionMetrics = satisfactionValues.length > 0 ? 
        this._calculateMetrics(satisfactionValues) : null;
      
      // Calculate effectiveness metrics
      const effectivenessValues = outcomes
        .filter(outcome => outcome.effectiveness !== null)
        .map(outcome => outcome.effectiveness);
      
      const effectivenessMetrics = effectivenessValues.length > 0 ? 
        this._calculateMetrics(effectivenessValues) : null;
      
      // Calculate confidence metrics
      const confidenceValues = outcomes
        .filter(outcome => outcome.confidence !== null)
        .map(outcome => outcome.confidence);
      
      const confidenceMetrics = confidenceValues.length > 0 ? 
        this._calculateMetrics(confidenceValues) : null;
      
      // Calculate agreement metrics
      const agreementMetrics = this._calculateAgreementMetrics(outcomes);
      
      // Calculate trends if requested
      let trends = null;
      if (options.includeTrends) {
        trends = this._calculateTrends(outcomes);
      }
      
      // Calculate segments if requested
      let segments = null;
      if (options.includeSegments) {
        segments = this._calculateSegments(outcomes, options.segmentBy || 'userId');
      }
      
      return {
        decisionId,
        outcomeCount: outcomes.length,
        analysis: {
          satisfaction: satisfactionMetrics,
          effectiveness: effectivenessMetrics,
          confidence: confidenceMetrics,
          agreement: agreementMetrics
        },
        trends,
        segments
      };
    } catch (error) {
      this.logger.error(`Analyzing outcomes failed: ${decisionId}`, error);
      throw error;
    }
  }
  
  /**
   * Calculates metrics for a set of values
   * @private
   * @param {Array<number>} values The values to calculate metrics for
   * @returns {Object} The calculated metrics
   */
  _calculateMetrics(values) {
    if (!values || values.length === 0) {
      return null;
    }
    
    // Calculate mean
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    
    // Calculate median
    const sortedValues = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 === 0 ? 
      (sortedValues[middle - 1] + sortedValues[middle]) / 2 : 
      sortedValues[middle];
    
    // Calculate variance
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((total, value) => total + value, 0) / values.length;
    
    // Calculate standard deviation
    const stdDev = Math.sqrt(variance);
    
    // Calculate min and max
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      count: values.length,
      mean,
      median,
      stdDev,
      min,
      max,
      variance
    };
  }
  
  /**
   * Calculates agreement metrics for a set of outcomes
   * @private
   * @param {Array<Object>} outcomes The outcomes to calculate agreement metrics for
   * @returns {Object} The calculated agreement metrics
   */
  _calculateAgreementMetrics(outcomes) {
    if (!outcomes || outcomes.length === 0) {
      return null;
    }
    
    // Count outcomes where recommendation matches actual choice
    const matchingOutcomes = outcomes.filter(outcome => 
      outcome.recommendation && 
      outcome.actualChoice && 
      outcome.recommendation.id === outcome.actualChoice.id
    );
    
    // Calculate agreement rate
    const agreementRate = matchingOutcomes.length / outcomes.length;
    
    // Count outcomes by actual choice
    const choiceCounts = {};
    for (const outcome of outcomes) {
      if (outcome.actualChoice) {
        const choiceId = outcome.actualChoice.id;
        choiceCounts[choiceId] = (choiceCounts[choiceId] || 0) + 1;
      }
    }
    
    // Find most common choice
    let mostCommonChoice = null;
    let mostCommonCount = 0;
    
    for (const [choiceId, count] of Object.entries(choiceCounts)) {
      if (count > mostCommonCount) {
        mostCommonChoice = choiceId;
        mostCommonCount = count;
      }
    }
    
    // Calculate choice diversity (normalized entropy)
    const totalChoices = outcomes.filter(outcome => outcome.actualChoice).length;
    let entropy = 0;
    
    if (totalChoices > 0) {
      for (const count of Object.values(choiceCounts)) {
        const probability = count / totalChoices;
        entropy -= probability * Math.log2(probability);
      }
      
      // Normalize entropy (0-1 range)
      const maxEntropy = Math.log2(Object.keys(choiceCounts).length);
      entropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
    }
    
    return {
      agreementRate,
      mostCommonChoice,
      mostCommonChoiceRate: totalChoices > 0 ? mostCommonCount / totalChoices : 0,
      choiceDiversity: entropy
    };
  }
  
  /**
   * Calculates trends for a set of outcomes
   * @private
   * @param {Array<Object>} outcomes The outcomes to calculate trends for
   * @returns {Object} The calculated trends
   */
  _calculateTrends(outcomes) {
    if (!outcomes || outcomes.length < 2) {
      return null;
    }
    
    // Sort outcomes by timestamp (oldest first)
    const sortedOutcomes = [...outcomes].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate time periods (divide into 10 periods or fewer if not enough outcomes)
    const periodCount = Math.min(10, Math.floor(sortedOutcomes.length / 2));
    const periodSize = Math.ceil(sortedOutcomes.length / periodCount);
    
    // Initialize period data
    const periods = [];
    for (let i = 0; i < periodCount; i++) {
      const startIndex = i * periodSize;
      const endIndex = Math.min((i + 1) * periodSize, sortedOutcomes.length);
      const periodOutcomes = sortedOutcomes.slice(startIndex, endIndex);
      
      // Skip empty periods
      if (periodOutcomes.length === 0) {
        continue;
      }
      
      // Calculate period metrics
      const satisfactionValues = periodOutcomes
        .filter(outcome => outcome.satisfaction !== null)
        .map(outcome => outcome.satisfaction);
      
      const effectivenessValues = periodOutcomes
        .filter(outcome => outcome.effectiveness !== null)
        .map(outcome => outcome.effectiveness);
      
      const confidenceValues = periodOutcomes
        .filter(outcome => outcome.confidence !== null)
        .map(outcome => outcome.confidence);
      
      // Calculate agreement rate for period
      const matchingOutcomes = periodOutcomes.filter(outcome => 
        outcome.recommendation && 
        outcome.actualChoice && 
        outcome.recommendation.id === outcome.actualChoice.id
      );
      
      const agreementRate = periodOutcomes.length > 0 ? 
        matchingOutcomes.length / periodOutcomes.length : null;
      
      periods.push({
        periodIndex: i,
        startTimestamp: periodOutcomes[0].timestamp,
        endTimestamp: periodOutcomes[periodOutcomes.length - 1].timestamp,
        outcomeCount: periodOutcomes.length,
        satisfaction: satisfactionValues.length > 0 ? 
          satisfactionValues.reduce((sum, val) => sum + val, 0) / satisfactionValues.length : null,
        effectiveness: effectivenessValues.length > 0 ? 
          effectivenessValues.reduce((sum, val) => sum + val, 0) / effectivenessValues.length : null,
        confidence: confidenceValues.length > 0 ? 
          confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length : null,
        agreementRate
      });
    }
    
    // Calculate trend slopes
    const satisfactionSlope = this._calculateTrendSlope(periods, 'satisfaction');
    const effectivenessSlope = this._calculateTrendSlope(periods, 'effectiveness');
    const confidenceSlope = this._calculateTrendSlope(periods, 'confidence');
    const agreementSlope = this._calculateTrendSlope(periods, 'agreementRate');
    
    return {
      periods,
      trends: {
        satisfaction: {
          slope: satisfactionSlope,
          direction: satisfactionSlope > 0.01 ? 'increasing' : 
                     satisfactionSlope < -0.01 ? 'decreasing' : 'stable'
        },
        effectiveness: {
          slope: effectivenessSlope,
          direction: effectivenessSlope > 0.01 ? 'increasing' : 
                     effectivenessSlope < -0.01 ? 'decreasing' : 'stable'
        },
        confidence: {
          slope: confidenceSlope,
          direction: confidenceSlope > 0.01 ? 'increasing' : 
                     confidenceSlope < -0.01 ? 'decreasing' : 'stable'
        },
        agreement: {
          slope: agreementSlope,
          direction: agreementSlope > 0.01 ? 'increasing' : 
                     agreementSlope < -0.01 ? 'decreasing' : 'stable'
        }
      }
    };
  }
  
  /**
   * Calculates the trend slope for a metric across periods
   * @private
   * @param {Array<Object>} periods The periods to calculate the trend for
   * @param {string} metricName The name of the metric to calculate the trend for
   * @returns {number} The calculated trend slope
   */
  _calculateTrendSlope(periods, metricName) {
    // Filter periods with valid metric values
    const validPeriods = periods.filter(period => period[metricName] !== null);
    
    if (validPeriods.length < 2) {
      return 0;
    }
    
    // Simple linear regression
    const n = validPeriods.length;
    const x = validPeriods.map((_, i) => i);
    const y = validPeriods.map(period => period[metricName]);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    // Calculate slope
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }
  
  /**
   * Calculates segments for a set of outcomes
   * @private
   * @param {Array<Object>} outcomes The outcomes to calculate segments for
   * @param {string} segmentBy The field to segment by
   * @returns {Object} The calculated segments
   */
  _calculateSegments(outcomes, segmentBy = 'userId') {
    if (!outcomes || outcomes.length === 0) {
      return null;
    }
    
    // Group outcomes by segment
    const segments = {};
    
    for (const outcome of outcomes) {
      let segmentValue;
      
      // Extract segment value based on segmentBy
      if (segmentBy === 'userId') {
        segmentValue = outcome.userId || 'unknown';
      } else if (segmentBy === 'actualChoice') {
        segmentValue = outcome.actualChoice ? outcome.actualChoice.id : 'none';
      } else if (segmentBy === 'recommendation') {
        segmentValue = outcome.recommendation ? outcome.recommendation.id : 'none';
      } else if (segmentBy.startsWith('metadata.')) {
        const metadataPath = segmentBy.substring(9).split('.');
        let value = outcome.metadata;
        
        for (const key of metadataPath) {
          value = value && value[key];
        }
        
        segmentValue = value || 'unknown';
      } else {
        segmentValue = 'all';
      }
      
      // Create segment if it doesn't exist
      if (!segments[segmentValue]) {
        segments[segmentValue] = [];
      }
      
      // Add outcome to segment
      segments[segmentValue].push(outcome);
    }
    
    // Calculate metrics for each segment
    const segmentMetrics = {};
    
    for (const [segmentValue, segmentOutcomes] of Object.entries(segments)) {
      // Calculate satisfaction metrics
      const satisfactionValues = segmentOutcomes
        .filter(outcome => outcome.satisfaction !== null)
        .map(outcome => outcome.satisfaction);
      
      const satisfactionMetrics = satisfactionValues.length > 0 ? 
        this._calculateMetrics(satisfactionValues) : null;
      
      // Calculate effectiveness metrics
      const effectivenessValues = segmentOutcomes
        .filter(outcome => outcome.effectiveness !== null)
        .map(outcome => outcome.effectiveness);
      
      const effectivenessMetrics = effectivenessValues.length > 0 ? 
        this._calculateMetrics(effectivenessValues) : null;
      
      // Calculate confidence metrics
      const confidenceValues = segmentOutcomes
        .filter(outcome => outcome.confidence !== null)
        .map(outcome => outcome.confidence);
      
      const confidenceMetrics = confidenceValues.length > 0 ? 
        this._calculateMetrics(confidenceValues) : null;
      
      // Calculate agreement metrics
      const agreementMetrics = this._calculateAgreementMetrics(segmentOutcomes);
      
      segmentMetrics[segmentValue] = {
        outcomeCount: segmentOutcomes.length,
        satisfaction: satisfactionMetrics,
        effectiveness: effectivenessMetrics,
        confidence: confidenceMetrics,
        agreement: agreementMetrics
      };
    }
    
    return {
      segmentBy,
      segments: segmentMetrics
    };
  }
  
  /**
   * Learns from outcomes
   * @param {string} decisionId The decision ID
   * @param {Object} options Learning options
   * @returns {Promise<Object>} A promise that resolves with the learning results
   */
  async learnFromOutcomes(decisionId, options = {}) {
    if (!this.initialized) {
      throw new Error('Decision Outcome Tracker not initialized');
    }
    
    if (!this.config.learningEnabled) {
      throw new Error('Learning is not enabled');
    }
    
    if (!decisionId) {
      throw new Error('Decision ID is required');
    }
    
    this.logger.info(`Learning from outcomes for decision: ${decisionId}`, { options });
    
    try {
      // Get outcomes for this decision
      const outcomes = await this.getOutcomes(decisionId, options.filters || {});
      
      if (outcomes.length === 0) {
        return {
          decisionId,
          outcomeCount: 0,
          learningResults: {}
        };
      }
      
      // Initialize learning results
      const learningResults = {};
      
      // Learn from each outcome
      for (const outcome of outcomes) {
        // Extract features from outcome
        const features = this._extractFeaturesFromOutcome(outcome);
        
        // Update satisfaction model if satisfaction is provided
        if (outcome.satisfaction !== null && this.learningModels.has('satisfaction')) {
          const satisfactionModel = this.learningModels.get('satisfaction');
          const updateResult = satisfactionModel.update(features, outcome.satisfaction);
          
          if (!learningResults.satisfaction) {
            learningResults.satisfaction = {
              modelId: 'satisfaction',
              updateCount: 0,
              averageError: 0
            };
          }
          
          learningResults.satisfaction.updateCount++;
          learningResults.satisfaction.averageError = 
            (learningResults.satisfaction.averageError * (learningResults.satisfaction.updateCount - 1) + 
             Math.abs(updateResult.error)) / learningResults.satisfaction.updateCount;
        }
        
        // Update effectiveness model if effectiveness is provided
        if (outcome.effectiveness !== null && this.learningModels.has('effectiveness')) {
          const effectivenessModel = this.learningModels.get('effectiveness');
          const updateResult = effectivenessModel.update(features, outcome.effectiveness);
          
          if (!learningResults.effectiveness) {
            learningResults.effectiveness = {
              modelId: 'effectiveness',
              updateCount: 0,
              averageError: 0
            };
          }
          
          learningResults.effectiveness.updateCount++;
          learningResults.effectiveness.averageError = 
            (learningResults.effectiveness.averageError * (learningResults.effectiveness.updateCount - 1) + 
             Math.abs(updateResult.error)) / learningResults.effectiveness.updateCount;
        }
        
        // Update confidence model if confidence is provided
        if (outcome.confidence !== null && this.learningModels.has('confidence')) {
          const confidenceModel = this.learningModels.get('confidence');
          const updateResult = confidenceModel.update(features, outcome.confidence);
          
          if (!learningResults.confidence) {
            learningResults.confidence = {
              modelId: 'confidence',
              updateCount: 0,
              averageError: 0
            };
          }
          
          learningResults.confidence.updateCount++;
          learningResults.confidence.averageError = 
            (learningResults.confidence.averageError * (learningResults.confidence.updateCount - 1) + 
             Math.abs(updateResult.error)) / learningResults.confidence.updateCount;
        }
      }
      
      // Save updated models if storage is enabled
      if (this.config.storageEnabled && this.aideon && this.aideon.models) {
        const modelsNamespace = this.aideon.models.getNamespace('decisionOutcomes');
        
        for (const modelId of Object.keys(learningResults)) {
          if (this.learningModels.has(modelId)) {
            await modelsNamespace.set(modelId, this.learningModels.get(modelId));
          }
        }
      }
      
      return {
        decisionId,
        outcomeCount: outcomes.length,
        learningResults
      };
    } catch (error) {
      this.logger.error(`Learning from outcomes failed: ${decisionId}`, error);
      throw error;
    }
  }
  
  /**
   * Registers API endpoints for the Decision Outcome Tracker
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register outcome tracking endpoint
    api.register(`${namespace}/outcomes`, {
      post: async (req, res) => {
        try {
          const { outcome } = req.body;
          
          if (!outcome) {
            return res.status(400).json({
              error: 'Outcome is required'
            });
          }
          
          const context = {
            userId: req.userId || 'system'
          };
          
          const trackedOutcome = await this.trackOutcome(outcome, context);
          
          return res.status(201).json(trackedOutcome);
        } catch (error) {
          this.logger.error('API error in track outcome endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register outcomes retrieval endpoint
    api.register(`${namespace}/outcomes/:decisionId`, {
      get: async (req, res) => {
        try {
          const { decisionId } = req.params;
          const filters = req.query || {};
          
          if (!decisionId) {
            return res.status(400).json({
              error: 'Decision ID is required'
            });
          }
          
          const outcomes = await this.getOutcomes(decisionId, filters);
          
          return res.json(outcomes);
        } catch (error) {
          this.logger.error('API error in get outcomes endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register outcome analysis endpoint
    api.register(`${namespace}/outcomes/:decisionId/analyze`, {
      get: async (req, res) => {
        try {
          const { decisionId } = req.params;
          const options = req.query || {};
          
          if (!decisionId) {
            return res.status(400).json({
              error: 'Decision ID is required'
            });
          }
          
          const analysis = await this.analyzeOutcomes(decisionId, options);
          
          return res.json(analysis);
        } catch (error) {
          this.logger.error('API error in analyze outcomes endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register outcome learning endpoint
    api.register(`${namespace}/outcomes/:decisionId/learn`, {
      post: async (req, res) => {
        try {
          const { decisionId } = req.params;
          const options = req.body || {};
          
          if (!decisionId) {
            return res.status(400).json({
              error: 'Decision ID is required'
            });
          }
          
          if (!this.config.learningEnabled) {
            return res.status(400).json({
              error: 'Learning is not enabled'
            });
          }
          
          const learningResults = await this.learnFromOutcomes(decisionId, options);
          
          return res.json(learningResults);
        } catch (error) {
          this.logger.error('API error in learn from outcomes endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { DecisionOutcomeTracker };
