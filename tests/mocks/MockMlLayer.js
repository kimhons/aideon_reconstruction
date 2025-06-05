/**
 * MockMlLayer.js
 * 
 * Mock implementation of the Machine Learning Layer for testing the Error Recovery System.
 * This mock simulates the ML capabilities that would be provided by the actual ML Layer.
 * 
 * @module tests/mocks/MockMlLayer
 */

'use strict';

/**
 * Mock ML Layer for testing
 */
class MockMlLayer {
  /**
   * Creates a new MockMlLayer instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.isInitialized = false;
    this.predictionHistory = [];
    this.classificationHistory = [];
    this.rankingHistory = [];
    this.learningHistory = [];
    
    // Configure mock behavior
    this.mockBehavior = {
      shouldSucceed: options.shouldSucceed !== false,
      shouldDelay: options.shouldDelay === true,
      delayMs: options.delayMs || 100,
      predictionConfidence: options.predictionConfidence || 0.85,
      learningRate: options.learningRate || 0.01
    };
    
    // Pre-configured models for testing
    this.mockModels = {
      'strategy_success_predictor': {
        id: 'strategy_success_predictor',
        type: 'regression',
        version: '1.0.0',
        accuracy: 0.87,
        features: ['error_type', 'strategy_type', 'system_load', 'previous_attempts']
      },
      'error_classifier': {
        id: 'error_classifier',
        type: 'classification',
        version: '1.2.1',
        accuracy: 0.92,
        features: ['error_message', 'stack_trace', 'context']
      },
      'strategy_ranker': {
        id: 'strategy_ranker',
        type: 'ranking',
        version: '0.9.5',
        accuracy: 0.83,
        features: ['strategy_type', 'previous_success_rate', 'execution_time', 'resource_requirements']
      },
      'context_analyzer': {
        id: 'context_analyzer',
        type: 'clustering',
        version: '1.1.0',
        accuracy: 0.79,
        features: ['system_state', 'error_frequency', 'user_activity', 'resource_availability']
      },
      'anomaly_detector': {
        id: 'anomaly_detector',
        type: 'anomaly_detection',
        version: '0.8.7',
        accuracy: 0.81,
        features: ['metric_values', 'temporal_patterns', 'correlation_matrix']
      }
    };
  }
  
  /**
   * Initialize the mock ML layer
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
      throw new Error('Mock ML Layer initialization failure');
    }
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Get available models
   * 
   * @returns {Promise<Object>} Available models
   */
  async getAvailableModels() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return {
      success: true,
      models: Object.values(this.mockModels).map(model => ({
        id: model.id,
        type: model.type,
        version: model.version,
        accuracy: model.accuracy
      }))
    };
  }
  
  /**
   * Make a prediction using a model
   * 
   * @param {Object} request - Prediction request
   * @returns {Promise<Object>} Prediction result
   */
  async predict(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 2));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock ML Layer prediction failure');
    }
    
    const { modelId, features } = request;
    
    if (!modelId || !this.mockModels[modelId]) {
      return {
        success: false,
        reason: 'invalid_model',
        message: `Model ${modelId} not found`
      };
    }
    
    if (!features) {
      return {
        success: false,
        reason: 'missing_features',
        message: 'Features are required for prediction'
      };
    }
    
    // Store prediction request
    this.predictionHistory.push({
      modelId,
      features,
      timestamp: Date.now()
    });
    
    // Generate prediction based on model and features
    let prediction;
    const model = this.mockModels[modelId];
    
    switch (modelId) {
      case 'strategy_success_predictor':
        prediction = this._predictStrategySuccess(features);
        break;
      case 'error_classifier':
        prediction = this._classifyError(features);
        break;
      case 'strategy_ranker':
        prediction = this._rankStrategies(features);
        break;
      case 'context_analyzer':
        prediction = this._analyzeContext(features);
        break;
      case 'anomaly_detector':
        prediction = this._detectAnomalies(features);
        break;
      default:
        // Generic prediction
        prediction = {
          value: Math.random(),
          confidence: this.mockBehavior.predictionConfidence * (0.9 + Math.random() * 0.2)
        };
    }
    
    return {
      success: true,
      prediction,
      modelId,
      modelVersion: model.version,
      processingTime: this.mockBehavior.delayMs * 2
    };
  }
  
  /**
   * Classify data using a model
   * 
   * @param {Object} request - Classification request
   * @returns {Promise<Object>} Classification result
   */
  async classify(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 1.5));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock ML Layer classification failure');
    }
    
    const { modelId, data } = request;
    
    if (!modelId || !this.mockModels[modelId]) {
      return {
        success: false,
        reason: 'invalid_model',
        message: `Model ${modelId} not found`
      };
    }
    
    if (!data) {
      return {
        success: false,
        reason: 'missing_data',
        message: 'Data is required for classification'
      };
    }
    
    // Store classification request
    this.classificationHistory.push({
      modelId,
      data,
      timestamp: Date.now()
    });
    
    // Generate classification based on model and data
    let classification;
    const model = this.mockModels[modelId];
    
    if (modelId === 'error_classifier') {
      classification = this._classifyError(data);
    } else {
      // Generic classification
      const classes = ['class_a', 'class_b', 'class_c', 'class_d'];
      const probabilities = {};
      
      // Generate random probabilities
      let totalProb = 0;
      for (const cls of classes) {
        probabilities[cls] = Math.random();
        totalProb += probabilities[cls];
      }
      
      // Normalize probabilities
      for (const cls of classes) {
        probabilities[cls] /= totalProb;
      }
      
      // Find highest probability class
      let highestProb = 0;
      let highestClass = null;
      
      for (const cls of classes) {
        if (probabilities[cls] > highestProb) {
          highestProb = probabilities[cls];
          highestClass = cls;
        }
      }
      
      classification = {
        class: highestClass,
        probabilities,
        confidence: highestProb
      };
    }
    
    return {
      success: true,
      classification,
      modelId,
      modelVersion: model.version,
      processingTime: this.mockBehavior.delayMs * 1.5
    };
  }
  
  /**
   * Rank items using a model
   * 
   * @param {Object} request - Ranking request
   * @returns {Promise<Object>} Ranking result
   */
  async rank(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 1.8));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock ML Layer ranking failure');
    }
    
    const { modelId, items } = request;
    
    if (!modelId || !this.mockModels[modelId]) {
      return {
        success: false,
        reason: 'invalid_model',
        message: `Model ${modelId} not found`
      };
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        reason: 'missing_items',
        message: 'Items array is required for ranking'
      };
    }
    
    // Store ranking request
    this.rankingHistory.push({
      modelId,
      items,
      timestamp: Date.now()
    });
    
    // Generate ranking based on model and items
    let ranking;
    const model = this.mockModels[modelId];
    
    if (modelId === 'strategy_ranker') {
      ranking = this._rankStrategies({ strategies: items });
    } else {
      // Generic ranking
      ranking = {
        rankedItems: [...items].map((item, index) => ({
          item,
          score: Math.random(),
          confidence: this.mockBehavior.predictionConfidence * (0.9 + Math.random() * 0.2)
        }))
      };
      
      // Sort by score
      ranking.rankedItems.sort((a, b) => b.score - a.score);
    }
    
    return {
      success: true,
      ranking,
      modelId,
      modelVersion: model.version,
      processingTime: this.mockBehavior.delayMs * 1.8
    };
  }
  
  /**
   * Submit learning signal to improve models
   * 
   * @param {Object} request - Learning request
   * @returns {Promise<Object>} Learning result
   */
  async submitLearningSignal(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock ML Layer learning signal failure');
    }
    
    const { modelId, signal, context } = request;
    
    if (!modelId || !this.mockModels[modelId]) {
      return {
        success: false,
        reason: 'invalid_model',
        message: `Model ${modelId} not found`
      };
    }
    
    if (!signal) {
      return {
        success: false,
        reason: 'missing_signal',
        message: 'Learning signal is required'
      };
    }
    
    // Store learning signal
    this.learningHistory.push({
      modelId,
      signal,
      context,
      timestamp: Date.now()
    });
    
    // Simulate model improvement
    const model = this.mockModels[modelId];
    const oldAccuracy = model.accuracy;
    
    // Apply learning rate to improve accuracy
    model.accuracy = Math.min(0.99, model.accuracy + (this.mockBehavior.learningRate * Math.random()));
    
    return {
      success: true,
      modelId,
      accuracyBefore: oldAccuracy,
      accuracyAfter: model.accuracy,
      improvement: model.accuracy - oldAccuracy,
      signalProcessed: true
    };
  }
  
  /**
   * Get ML statistics
   * 
   * @returns {Object} ML statistics
   */
  getMlStatistics() {
    const predictionCount = this.predictionHistory.length;
    const classificationCount = this.classificationHistory.length;
    const rankingCount = this.rankingHistory.length;
    const learningCount = this.learningHistory.length;
    
    // Calculate average model accuracy
    let totalAccuracy = 0;
    let modelCount = 0;
    
    for (const model of Object.values(this.mockModels)) {
      totalAccuracy += model.accuracy;
      modelCount++;
    }
    
    const averageAccuracy = modelCount > 0 ? totalAccuracy / modelCount : 0;
    
    return {
      predictions: predictionCount,
      classifications: classificationCount,
      rankings: rankingCount,
      learningSignals: learningCount,
      modelCount,
      averageAccuracy,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Reset the mock ML layer
   */
  reset() {
    this.predictionHistory = [];
    this.classificationHistory = [];
    this.rankingHistory = [];
    this.learningHistory = [];
    
    // Reset model accuracies to initial values
    this.mockModels['strategy_success_predictor'].accuracy = 0.87;
    this.mockModels['error_classifier'].accuracy = 0.92;
    this.mockModels['strategy_ranker'].accuracy = 0.83;
    this.mockModels['context_analyzer'].accuracy = 0.79;
    this.mockModels['anomaly_detector'].accuracy = 0.81;
  }
  
  /**
   * Predict strategy success
   * 
   * @param {Object} features - Strategy features
   * @returns {Object} Success prediction
   * @private
   */
  _predictStrategySuccess(features) {
    const { error_type, strategy_type, system_load, previous_attempts } = features;
    
    // Base success probability
    let successProbability = 0.7;
    
    // Adjust based on error type
    if (error_type === 'NetworkError') {
      successProbability += 0.1;
    } else if (error_type === 'DatabaseError') {
      successProbability += 0.05;
    } else if (error_type === 'PermissionError') {
      successProbability -= 0.1;
    } else if (error_type === 'ResourceError') {
      successProbability -= 0.05;
    }
    
    // Adjust based on strategy type
    if (strategy_type === 'retry') {
      successProbability += 0.1;
    } else if (strategy_type === 'resource_switch') {
      successProbability += 0.05;
    } else if (strategy_type === 'permission_request') {
      successProbability -= 0.1;
    }
    
    // Adjust based on system load
    if (system_load !== undefined) {
      successProbability -= system_load * 0.2;
    }
    
    // Adjust based on previous attempts
    if (previous_attempts !== undefined) {
      successProbability -= previous_attempts * 0.05;
    }
    
    // Ensure probability is within bounds
    successProbability = Math.max(0.1, Math.min(0.95, successProbability));
    
    // Add some randomness
    successProbability *= (0.9 + Math.random() * 0.2);
    successProbability = Math.max(0.1, Math.min(0.95, successProbability));
    
    return {
      successProbability,
      confidence: this.mockBehavior.predictionConfidence * (0.9 + Math.random() * 0.2),
      estimatedExecutionTimeMs: 1000 + Math.random() * 5000
    };
  }
  
  /**
   * Classify error
   * 
   * @param {Object} data - Error data
   * @returns {Object} Error classification
   * @private
   */
  _classifyError(data) {
    const { error_message, stack_trace, context } = data;
    
    // Define error classes
    const errorClasses = [
      'network_timeout',
      'database_connection',
      'permission_denied',
      'resource_exhausted',
      'validation_error',
      'unknown_error'
    ];
    
    // Generate probabilities for each class
    const probabilities = {};
    let totalProb = 0;
    
    for (const cls of errorClasses) {
      probabilities[cls] = Math.random();
      totalProb += probabilities[cls];
    }
    
    // Normalize probabilities
    for (const cls of errorClasses) {
      probabilities[cls] /= totalProb;
    }
    
    // Adjust probabilities based on error message if available
    if (error_message) {
      if (error_message.includes('timeout') || error_message.includes('timed out')) {
        probabilities.network_timeout *= 3;
      } else if (error_message.includes('connection') || error_message.includes('connect')) {
        probabilities.database_connection *= 3;
      } else if (error_message.includes('permission') || error_message.includes('access denied')) {
        probabilities.permission_denied *= 3;
      } else if (error_message.includes('resource') || error_message.includes('memory') || error_message.includes('limit')) {
        probabilities.resource_exhausted *= 3;
      } else if (error_message.includes('validation') || error_message.includes('invalid')) {
        probabilities.validation_error *= 3;
      }
      
      // Re-normalize
      totalProb = 0;
      for (const cls of errorClasses) {
        totalProb += probabilities[cls];
      }
      
      for (const cls of errorClasses) {
        probabilities[cls] /= totalProb;
      }
    }
    
    // Find highest probability class
    let highestProb = 0;
    let highestClass = null;
    
    for (const cls of errorClasses) {
      if (probabilities[cls] > highestProb) {
        highestProb = probabilities[cls];
        highestClass = cls;
      }
    }
    
    return {
      class: highestClass,
      probabilities,
      confidence: highestProb,
      suggestedActions: this._getSuggestedActions(highestClass)
    };
  }
  
  /**
   * Rank strategies
   * 
   * @param {Object} data - Strategy data
   * @returns {Object} Strategy ranking
   * @private
   */
  _rankStrategies(data) {
    const { strategies } = data;
    
    if (!strategies || !Array.isArray(strategies)) {
      return {
        rankedStrategies: [],
        confidence: 0
      };
    }
    
    // Clone strategies to avoid modifying the original
    const rankedStrategies = JSON.parse(JSON.stringify(strategies));
    
    // Assign scores to strategies
    for (const strategy of rankedStrategies) {
      // Base score
      let score = Math.random();
      
      // Adjust based on strategy type
      if (strategy.type === 'retry') {
        score += 0.2;
      } else if (strategy.type === 'resource_switch') {
        score += 0.15;
      } else if (strategy.type === 'concurrency_adjustment') {
        score += 0.1;
      } else if (strategy.type === 'circuit_breaker') {
        score += 0.05;
      }
      
      // Adjust based on previous success rate if available
      if (strategy.previousSuccessRate !== undefined) {
        score += strategy.previousSuccessRate * 0.3;
      }
      
      // Adjust based on execution time if available
      if (strategy.executionTime !== undefined) {
        score -= (strategy.executionTime / 10000) * 0.2; // Penalize long execution times
      }
      
      // Store score
      strategy.score = Math.max(0, Math.min(1, score));
      strategy.confidence = this.mockBehavior.predictionConfidence * (0.9 + Math.random() * 0.2);
    }
    
    // Sort by score
    rankedStrategies.sort((a, b) => b.score - a.score);
    
    return {
      rankedStrategies,
      confidence: this.mockBehavior.predictionConfidence
    };
  }
  
  /**
   * Analyze context
   * 
   * @param {Object} features - Context features
   * @returns {Object} Context analysis
   * @private
   */
  _analyzeContext(features) {
    const { system_state, error_frequency, user_activity, resource_availability } = features;
    
    // Define context clusters
    const clusters = [
      'normal_operation',
      'high_load',
      'resource_constrained',
      'error_prone',
      'user_intensive'
    ];
    
    // Generate probabilities for each cluster
    const probabilities = {};
    let totalProb = 0;
    
    for (const cluster of clusters) {
      probabilities[cluster] = Math.random();
      totalProb += probabilities[cluster];
    }
    
    // Normalize probabilities
    for (const cluster of clusters) {
      probabilities[cluster] /= totalProb;
    }
    
    // Adjust probabilities based on features
    if (system_state && system_state.load > 0.7) {
      probabilities.high_load *= 3;
    }
    
    if (error_frequency && error_frequency > 0.5) {
      probabilities.error_prone *= 3;
    }
    
    if (user_activity && user_activity > 0.7) {
      probabilities.user_intensive *= 3;
    }
    
    if (resource_availability && resource_availability < 0.3) {
      probabilities.resource_constrained *= 3;
    }
    
    // Re-normalize
    totalProb = 0;
    for (const cluster of clusters) {
      totalProb += probabilities[cluster];
    }
    
    for (const cluster of clusters) {
      probabilities[cluster] /= totalProb;
    }
    
    // Find highest probability cluster
    let highestProb = 0;
    let highestCluster = null;
    
    for (const cluster of clusters) {
      if (probabilities[cluster] > highestProb) {
        highestProb = probabilities[cluster];
        highestCluster = cluster;
      }
    }
    
    // Generate recommendations based on cluster
    const recommendations = this._getContextRecommendations(highestCluster);
    
    return {
      cluster: highestCluster,
      probabilities,
      confidence: highestProb,
      recommendations
    };
  }
  
  /**
   * Detect anomalies
   * 
   * @param {Object} features - Anomaly features
   * @returns {Object} Anomaly detection
   * @private
   */
  _detectAnomalies(features) {
    const { metric_values, temporal_patterns } = features;
    
    // Default anomaly score
    let anomalyScore = 0.3;
    const anomalies = [];
    
    // Check for anomalies in metric values
    if (metric_values && Array.isArray(metric_values)) {
      for (let i = 0; i < metric_values.length; i++) {
        const value = metric_values[i];
        
        // Simple anomaly detection: values outside of [0.1, 0.9] range
        if (value < 0.1 || value > 0.9) {
          anomalyScore += 0.1;
          anomalies.push({
            type: 'metric_anomaly',
            index: i,
            value,
            severity: value < 0.05 || value > 0.95 ? 'high' : 'medium'
          });
        }
      }
    }
    
    // Check for anomalies in temporal patterns
    if (temporal_patterns && Array.isArray(temporal_patterns)) {
      // Look for sudden changes
      for (let i = 1; i < temporal_patterns.length; i++) {
        const diff = Math.abs(temporal_patterns[i] - temporal_patterns[i - 1]);
        
        if (diff > 0.5) {
          anomalyScore += 0.15;
          anomalies.push({
            type: 'temporal_anomaly',
            index: i,
            difference: diff,
            severity: diff > 0.7 ? 'high' : 'medium'
          });
        }
      }
    }
    
    // Ensure score is within bounds
    anomalyScore = Math.max(0, Math.min(1, anomalyScore));
    
    return {
      anomalyDetected: anomalyScore > 0.5,
      anomalyScore,
      confidence: this.mockBehavior.predictionConfidence * (0.9 + Math.random() * 0.2),
      anomalies
    };
  }
  
  /**
   * Get suggested actions for an error class
   * 
   * @param {string} errorClass - Error class
   * @returns {Array<Object>} Suggested actions
   * @private
   */
  _getSuggestedActions(errorClass) {
    switch (errorClass) {
      case 'network_timeout':
        return [
          { action: 'retry', confidence: 0.9 },
          { action: 'increase_timeout', confidence: 0.7 },
          { action: 'switch_endpoint', confidence: 0.6 }
        ];
      case 'database_connection':
        return [
          { action: 'reconnect', confidence: 0.85 },
          { action: 'switch_database', confidence: 0.75 },
          { action: 'check_credentials', confidence: 0.6 }
        ];
      case 'permission_denied':
        return [
          { action: 'request_permission', confidence: 0.8 },
          { action: 'check_credentials', confidence: 0.7 },
          { action: 'notify_user', confidence: 0.9 }
        ];
      case 'resource_exhausted':
        return [
          { action: 'reduce_concurrency', confidence: 0.85 },
          { action: 'free_resources', confidence: 0.8 },
          { action: 'scale_resources', confidence: 0.7 }
        ];
      case 'validation_error':
        return [
          { action: 'validate_input', confidence: 0.95 },
          { action: 'sanitize_input', confidence: 0.9 },
          { action: 'provide_defaults', confidence: 0.7 }
        ];
      default:
        return [
          { action: 'log_error', confidence: 0.9 },
          { action: 'notify_admin', confidence: 0.8 },
          { action: 'retry', confidence: 0.5 }
        ];
    }
  }
  
  /**
   * Get recommendations for a context cluster
   * 
   * @param {string} cluster - Context cluster
   * @returns {Array<Object>} Recommendations
   * @private
   */
  _getContextRecommendations(cluster) {
    switch (cluster) {
      case 'normal_operation':
        return [
          { action: 'continue_monitoring', priority: 'low' },
          { action: 'optimize_resources', priority: 'low' }
        ];
      case 'high_load':
        return [
          { action: 'reduce_concurrency', priority: 'high' },
          { action: 'scale_resources', priority: 'medium' },
          { action: 'defer_non_critical', priority: 'medium' }
        ];
      case 'resource_constrained':
        return [
          { action: 'free_resources', priority: 'high' },
          { action: 'scale_resources', priority: 'high' },
          { action: 'prioritize_critical', priority: 'medium' }
        ];
      case 'error_prone':
        return [
          { action: 'increase_retry_limits', priority: 'high' },
          { action: 'implement_circuit_breaker', priority: 'medium' },
          { action: 'notify_admin', priority: 'medium' }
        ];
      case 'user_intensive':
        return [
          { action: 'optimize_user_flows', priority: 'medium' },
          { action: 'cache_responses', priority: 'medium' },
          { action: 'scale_user_services', priority: 'medium' }
        ];
      default:
        return [
          { action: 'continue_monitoring', priority: 'medium' },
          { action: 'analyze_metrics', priority: 'medium' }
        ];
    }
  }
}

module.exports = MockMlLayer;
