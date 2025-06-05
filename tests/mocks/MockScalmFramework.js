/**
 * MockScalmFramework.js
 * 
 * Mock implementation of the Self-Correction and Adaptive Learning Module (SCALM) Framework
 * for testing the Error Recovery System.
 * 
 * @module tests/mocks/MockScalmFramework
 */

'use strict';

/**
 * Mock SCALM Framework for testing
 */
class MockScalmFramework {
  /**
   * Creates a new MockScalmFramework instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.isInitialized = false;
    this.learningSignals = [];
    this.recommendations = [];
    this.predictionResults = [];
    this.adaptationHistory = [];
    
    // Configure mock behavior
    this.mockBehavior = {
      shouldSucceed: options.shouldSucceed !== false,
      shouldDelay: options.shouldDelay === true,
      delayMs: options.delayMs || 100,
      predictionConfidence: options.predictionConfidence || 0.85,
      recommendationCount: options.recommendationCount || 3
    };
    
    // Pre-configured recommendations for testing
    this.mockRecommendations = [
      {
        id: 'rec_retry_with_backoff',
        type: 'retry',
        confidence: 0.92,
        parameters: {
          maxRetries: 3,
          backoffFactor: 1.5,
          initialDelayMs: 1000
        },
        description: 'Retry the operation with exponential backoff'
      },
      {
        id: 'rec_alternative_resource',
        type: 'resource_switch',
        confidence: 0.87,
        parameters: {
          resourceType: 'api_endpoint',
          alternativeResource: 'backup_endpoint'
        },
        description: 'Switch to alternative API endpoint'
      },
      {
        id: 'rec_reduce_concurrency',
        type: 'concurrency_adjustment',
        confidence: 0.79,
        parameters: {
          targetConcurrency: 5,
          gradualReduction: true
        },
        description: 'Reduce operation concurrency'
      },
      {
        id: 'rec_circuit_breaker',
        type: 'circuit_breaker',
        confidence: 0.75,
        parameters: {
          breakerThreshold: 5,
          resetTimeoutMs: 30000
        },
        description: 'Implement circuit breaker pattern'
      },
      {
        id: 'rec_timeout_extension',
        type: 'timeout_adjustment',
        confidence: 0.68,
        parameters: {
          timeoutMs: 15000,
          maxExtensions: 2
        },
        description: 'Extend operation timeout'
      }
    ];
  }
  
  /**
   * Initialize the mock framework
   * 
   * @returns {Promise<boolean>} Initialization result
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock SCALM initialization failure');
    }
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Process a learning signal
   * 
   * @param {Object} signal - Learning signal
   * @param {Object} context - Signal context
   * @returns {Promise<Object>} Processing result
   */
  async processLearningSignal(signal, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock SCALM signal processing failure');
    }
    
    // Store signal
    this.learningSignals.push({
      signal,
      context,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      signalId: `signal_${this.learningSignals.length}`,
      processingTime: this.mockBehavior.delayMs
    };
  }
  
  /**
   * Get recommendations for a specific context
   * 
   * @param {Object} context - Recommendation context
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Recommendations
   */
  async getRecommendations(context = {}, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock SCALM recommendation failure');
    }
    
    // Generate recommendations based on context
    const count = options.count || this.mockBehavior.recommendationCount;
    const recommendations = this.mockRecommendations
      .slice(0, count)
      .map(rec => ({
        ...rec,
        confidence: rec.confidence * (0.9 + Math.random() * 0.2) // Add some randomness
      }))
      .sort((a, b) => b.confidence - a.confidence);
    
    // Store recommendations
    this.recommendations.push({
      context,
      options,
      recommendations,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      recommendations,
      confidence: this.mockBehavior.predictionConfidence,
      processingTime: this.mockBehavior.delayMs
    };
  }
  
  /**
   * Predict outcome for a specific strategy
   * 
   * @param {Object} strategy - Strategy to predict
   * @param {Object} context - Prediction context
   * @returns {Promise<Object>} Prediction result
   */
  async predictOutcome(strategy, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock SCALM prediction failure');
    }
    
    // Generate prediction based on strategy
    const baseConfidence = this.mockBehavior.predictionConfidence;
    const successProbability = baseConfidence * (0.8 + Math.random() * 0.4); // Add some randomness
    
    const prediction = {
      success: successProbability > 0.7,
      confidence: baseConfidence,
      successProbability,
      estimatedDurationMs: 1000 + Math.random() * 5000,
      potentialIssues: successProbability < 0.8 ? ['resource_contention', 'timeout_risk'] : []
    };
    
    // Store prediction
    this.predictionResults.push({
      strategy,
      context,
      prediction,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      prediction,
      processingTime: this.mockBehavior.delayMs
    };
  }
  
  /**
   * Adapt system behavior based on learning
   * 
   * @param {Object} adaptationRequest - Adaptation request
   * @returns {Promise<Object>} Adaptation result
   */
  async adaptSystemBehavior(adaptationRequest) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock SCALM adaptation failure');
    }
    
    // Store adaptation
    this.adaptationHistory.push({
      request: adaptationRequest,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      adaptationId: `adapt_${this.adaptationHistory.length}`,
      changes: [
        {
          parameter: 'retry_limit',
          oldValue: 3,
          newValue: 5
        },
        {
          parameter: 'timeout_ms',
          oldValue: 5000,
          newValue: 8000
        }
      ],
      processingTime: this.mockBehavior.delayMs
    };
  }
  
  /**
   * Get learning statistics
   * 
   * @returns {Object} Learning statistics
   */
  getLearningStatistics() {
    return {
      signalsProcessed: this.learningSignals.length,
      recommendationsGenerated: this.recommendations.length,
      predictionsPerformed: this.predictionResults.length,
      adaptationsApplied: this.adaptationHistory.length,
      averageConfidence: this.mockBehavior.predictionConfidence,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Reset the mock framework
   */
  reset() {
    this.learningSignals = [];
    this.recommendations = [];
    this.predictionResults = [];
    this.adaptationHistory = [];
  }
}

module.exports = MockScalmFramework;
