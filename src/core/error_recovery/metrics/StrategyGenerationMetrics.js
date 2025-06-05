/**
 * StrategyGenerationMetrics.js
 * 
 * Collects and analyzes metrics related to recovery strategy generation.
 * This component is responsible for tracking performance, success rates,
 * and other metrics related to the strategy generation process.
 * 
 * @module src/core/error_recovery/metrics/StrategyGenerationMetrics
 */

'use strict';

/**
 * Class responsible for collecting and analyzing strategy generation metrics
 */
class StrategyGenerationMetrics {
  /**
   * Creates a new StrategyGenerationMetrics instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.metricsCollector - Metrics collector for storing metrics
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.metricsCollector = options.metricsCollector;
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.detailedMetrics = this.config.detailedMetrics === true;
    this.metricsBuffer = [];
    this.flushInterval = this.config.flushIntervalMs || 5000;
    this.bufferSize = this.config.bufferSize || 100;
    
    this.metricCounts = {
      strategiesGenerated: 0,
      strategiesExecuted: 0,
      strategiesSucceeded: 0,
      strategiesFailed: 0
    };
    
    this.timingMetrics = {
      generationTime: [],
      executionTime: []
    };
    
    this.strategyTypeMetrics = new Map();
    this.errorTypeMetrics = new Map();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize metrics collection
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    if (!this.enabled) {
      this.isInitialized = true;
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('strategy:generation:started', this._handleGenerationStarted.bind(this));
      this.eventBus.on('strategy:generation:completed', this._handleGenerationCompleted.bind(this));
      this.eventBus.on('strategy:execution:started', this._handleExecutionStarted.bind(this));
      this.eventBus.on('strategy:execution:completed', this._handleExecutionCompleted.bind(this));
      this.eventBus.on('strategy:execution:failed', this._handleExecutionFailed.bind(this));
    }
    
    // Set up flush interval if metrics collector is available
    if (this.metricsCollector && this.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this._flushMetrics();
      }, this.flushInterval);
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'StrategyGenerationMetrics',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize metrics collection
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Record strategy generation start
   * 
   * @param {Object} data - Generation start data
   * @returns {string} Generation ID
   */
  async recordGenerationStart(data = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return null;
    }
    
    const generationId = data.generationId || `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const metric = {
      type: 'strategy_generation_start',
      generationId,
      timestamp: Date.now(),
      errorType: data.errorType || 'unknown',
      errorCode: data.errorCode || 'unknown',
      context: this._sanitizeContext(data.context)
    };
    
    this._addMetric(metric);
    
    return generationId;
  }
  
  /**
   * Record strategy generation completion
   * 
   * @param {Object} data - Generation completion data
   */
  async recordGenerationComplete(data = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return;
    }
    
    const generationId = data.generationId;
    if (!generationId) {
      console.warn('Generation ID is required for recordGenerationComplete');
      return;
    }
    
    const startMetric = this._findMetric('strategy_generation_start', generationId);
    const generationTime = startMetric ? Date.now() - startMetric.timestamp : null;
    
    const metric = {
      type: 'strategy_generation_complete',
      generationId,
      timestamp: Date.now(),
      generationTime,
      strategyCount: data.strategies ? data.strategies.length : 0,
      strategyTypes: data.strategies ? this._extractStrategyTypes(data.strategies) : [],
      highestConfidence: data.strategies ? this._findHighestConfidence(data.strategies) : null,
      errorType: data.errorType || startMetric?.errorType || 'unknown'
    };
    
    this._addMetric(metric);
    
    // Update summary metrics
    this.metricCounts.strategiesGenerated += metric.strategyCount;
    
    if (generationTime !== null) {
      this.timingMetrics.generationTime.push(generationTime);
      
      // Keep timing metrics array from growing too large
      if (this.timingMetrics.generationTime.length > 100) {
        this.timingMetrics.generationTime.shift();
      }
    }
    
    // Update strategy type metrics
    for (const strategyType of metric.strategyTypes) {
      const typeMetrics = this.strategyTypeMetrics.get(strategyType) || {
        generated: 0,
        executed: 0,
        succeeded: 0,
        failed: 0,
        averageConfidence: 0,
        totalConfidence: 0
      };
      
      typeMetrics.generated++;
      this.strategyTypeMetrics.set(strategyType, typeMetrics);
    }
    
    // Update error type metrics
    const errorType = metric.errorType;
    const errorMetrics = this.errorTypeMetrics.get(errorType) || {
      occurrences: 0,
      strategiesGenerated: 0,
      strategiesExecuted: 0,
      strategiesSucceeded: 0,
      strategiesFailed: 0
    };
    
    errorMetrics.occurrences++;
    errorMetrics.strategiesGenerated += metric.strategyCount;
    this.errorTypeMetrics.set(errorType, errorMetrics);
  }
  
  /**
   * Record strategy execution start
   * 
   * @param {Object} data - Execution start data
   * @returns {string} Execution ID
   */
  async recordExecutionStart(data = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return null;
    }
    
    const executionId = data.executionId || `exec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const strategyId = data.strategyId;
    
    if (!strategyId) {
      console.warn('Strategy ID is required for recordExecutionStart');
      return executionId;
    }
    
    const metric = {
      type: 'strategy_execution_start',
      executionId,
      strategyId,
      generationId: data.generationId,
      timestamp: Date.now(),
      strategyType: data.strategyType || 'unknown',
      errorType: data.errorType || 'unknown',
      confidence: data.confidence || null
    };
    
    this._addMetric(metric);
    
    return executionId;
  }
  
  /**
   * Record strategy execution completion
   * 
   * @param {Object} data - Execution completion data
   */
  async recordExecutionComplete(data = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return;
    }
    
    const executionId = data.executionId;
    const strategyId = data.strategyId;
    
    if (!executionId || !strategyId) {
      console.warn('Execution ID and Strategy ID are required for recordExecutionComplete');
      return;
    }
    
    const startMetric = this._findMetric('strategy_execution_start', executionId, 'executionId');
    const executionTime = startMetric ? Date.now() - startMetric.timestamp : null;
    
    const metric = {
      type: 'strategy_execution_complete',
      executionId,
      strategyId,
      generationId: data.generationId || startMetric?.generationId,
      timestamp: Date.now(),
      executionTime,
      success: data.success === true,
      strategyType: data.strategyType || startMetric?.strategyType || 'unknown',
      errorType: data.errorType || startMetric?.errorType || 'unknown',
      verificationResults: data.verificationResults || null
    };
    
    this._addMetric(metric);
    
    // Update summary metrics
    this.metricCounts.strategiesExecuted++;
    
    if (metric.success) {
      this.metricCounts.strategiesSucceeded++;
    } else {
      this.metricCounts.strategiesFailed++;
    }
    
    if (executionTime !== null) {
      this.timingMetrics.executionTime.push(executionTime);
      
      // Keep timing metrics array from growing too large
      if (this.timingMetrics.executionTime.length > 100) {
        this.timingMetrics.executionTime.shift();
      }
    }
    
    // Update strategy type metrics
    const strategyType = metric.strategyType;
    const typeMetrics = this.strategyTypeMetrics.get(strategyType) || {
      generated: 0,
      executed: 0,
      succeeded: 0,
      failed: 0,
      averageConfidence: 0,
      totalConfidence: 0
    };
    
    typeMetrics.executed++;
    
    if (metric.success) {
      typeMetrics.succeeded++;
    } else {
      typeMetrics.failed++;
    }
    
    if (startMetric && startMetric.confidence !== null) {
      typeMetrics.totalConfidence += startMetric.confidence;
      typeMetrics.averageConfidence = typeMetrics.totalConfidence / typeMetrics.executed;
    }
    
    this.strategyTypeMetrics.set(strategyType, typeMetrics);
    
    // Update error type metrics
    const errorType = metric.errorType;
    const errorMetrics = this.errorTypeMetrics.get(errorType) || {
      occurrences: 0,
      strategiesGenerated: 0,
      strategiesExecuted: 0,
      strategiesSucceeded: 0,
      strategiesFailed: 0
    };
    
    errorMetrics.strategiesExecuted++;
    
    if (metric.success) {
      errorMetrics.strategiesSucceeded++;
    } else {
      errorMetrics.strategiesFailed++;
    }
    
    this.errorTypeMetrics.set(errorType, errorMetrics);
  }
  
  /**
   * Record strategy execution failure
   * 
   * @param {Object} data - Execution failure data
   */
  async recordExecutionFailure(data = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return;
    }
    
    const executionId = data.executionId;
    const strategyId = data.strategyId;
    
    if (!executionId || !strategyId) {
      console.warn('Execution ID and Strategy ID are required for recordExecutionFailure');
      return;
    }
    
    const startMetric = this._findMetric('strategy_execution_start', executionId, 'executionId');
    const executionTime = startMetric ? Date.now() - startMetric.timestamp : null;
    
    const metric = {
      type: 'strategy_execution_failure',
      executionId,
      strategyId,
      generationId: data.generationId || startMetric?.generationId,
      timestamp: Date.now(),
      executionTime,
      failureReason: data.failureReason || 'unknown',
      failureType: data.failureType || 'unknown',
      strategyType: data.strategyType || startMetric?.strategyType || 'unknown',
      errorType: data.errorType || startMetric?.errorType || 'unknown',
      actionIndex: data.actionIndex !== undefined ? data.actionIndex : null,
      error: data.error ? {
        message: data.error.message,
        stack: this.detailedMetrics ? data.error.stack : undefined
      } : null
    };
    
    this._addMetric(metric);
    
    // Update summary metrics
    this.metricCounts.strategiesExecuted++;
    this.metricCounts.strategiesFailed++;
    
    if (executionTime !== null) {
      this.timingMetrics.executionTime.push(executionTime);
      
      // Keep timing metrics array from growing too large
      if (this.timingMetrics.executionTime.length > 100) {
        this.timingMetrics.executionTime.shift();
      }
    }
    
    // Update strategy type metrics
    const strategyType = metric.strategyType;
    const typeMetrics = this.strategyTypeMetrics.get(strategyType) || {
      generated: 0,
      executed: 0,
      succeeded: 0,
      failed: 0,
      averageConfidence: 0,
      totalConfidence: 0
    };
    
    typeMetrics.executed++;
    typeMetrics.failed++;
    
    if (startMetric && startMetric.confidence !== null) {
      typeMetrics.totalConfidence += startMetric.confidence;
      typeMetrics.averageConfidence = typeMetrics.totalConfidence / typeMetrics.executed;
    }
    
    this.strategyTypeMetrics.set(strategyType, typeMetrics);
    
    // Update error type metrics
    const errorType = metric.errorType;
    const errorMetrics = this.errorTypeMetrics.get(errorType) || {
      occurrences: 0,
      strategiesGenerated: 0,
      strategiesExecuted: 0,
      strategiesSucceeded: 0,
      strategiesFailed: 0
    };
    
    errorMetrics.strategiesExecuted++;
    errorMetrics.strategiesFailed++;
    
    this.errorTypeMetrics.set(errorType, errorMetrics);
  }
  
  /**
   * Get summary metrics
   * 
   * @returns {Object} Summary metrics
   */
  async getSummaryMetrics() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const averageGenerationTime = this._calculateAverage(this.timingMetrics.generationTime);
    const averageExecutionTime = this._calculateAverage(this.timingMetrics.executionTime);
    
    const successRate = this.metricCounts.strategiesExecuted > 0 ?
      this.metricCounts.strategiesSucceeded / this.metricCounts.strategiesExecuted : 0;
    
    return {
      counts: { ...this.metricCounts },
      timing: {
        averageGenerationTimeMs: averageGenerationTime,
        averageExecutionTimeMs: averageExecutionTime
      },
      rates: {
        successRate,
        failureRate: 1 - successRate
      },
      strategyTypes: this._getStrategyTypeMetrics(),
      errorTypes: this._getErrorTypeMetrics(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Get detailed metrics
   * 
   * @param {Object} options - Options for filtering metrics
   * @returns {Array} Detailed metrics
   */
  async getDetailedMetrics(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.detailedMetrics) {
      return {
        enabled: false,
        message: 'Detailed metrics are disabled'
      };
    }
    
    const { strategyType, errorType, startTime, endTime, limit } = options;
    
    // Filter metrics based on options
    let filteredMetrics = [...this.metricsBuffer];
    
    if (strategyType) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.strategyType === strategyType
      );
    }
    
    if (errorType) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.errorType === errorType
      );
    }
    
    if (startTime) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.timestamp >= startTime
      );
    }
    
    if (endTime) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.timestamp <= endTime
      );
    }
    
    // Sort by timestamp (newest first)
    filteredMetrics.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit if specified
    if (limit && limit > 0) {
      filteredMetrics = filteredMetrics.slice(0, limit);
    }
    
    return filteredMetrics;
  }
  
  /**
   * Handle strategy generation started event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleGenerationStarted(data) {
    this.recordGenerationStart(data);
  }
  
  /**
   * Handle strategy generation completed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleGenerationCompleted(data) {
    this.recordGenerationComplete(data);
  }
  
  /**
   * Handle strategy execution started event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleExecutionStarted(data) {
    this.recordExecutionStart(data);
  }
  
  /**
   * Handle strategy execution completed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleExecutionCompleted(data) {
    this.recordExecutionComplete(data);
  }
  
  /**
   * Handle strategy execution failed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleExecutionFailed(data) {
    this.recordExecutionFailure(data);
  }
  
  /**
   * Add a metric to the buffer
   * 
   * @param {Object} metric - The metric to add
   * @private
   */
  _addMetric(metric) {
    if (!metric) {
      return;
    }
    
    this.metricsBuffer.push(metric);
    
    // If buffer is full, flush oldest metrics
    if (this.metricsBuffer.length > this.bufferSize) {
      this._flushMetrics();
    }
  }
  
  /**
   * Flush metrics to the metrics collector
   * @private
   */
  _flushMetrics() {
    if (!this.metricsCollector || this.metricsBuffer.length === 0) {
      return;
    }
    
    try {
      // Clone metrics to avoid modification during flush
      const metricsToFlush = [...this.metricsBuffer];
      
      // Send metrics to collector
      this.metricsCollector.collectMetrics('error_recovery', metricsToFlush);
      
      // Clear buffer after successful flush
      this.metricsBuffer = [];
    } catch (error) {
      console.warn('Failed to flush metrics:', error.message);
      // Keep metrics in buffer for next flush attempt
    }
  }
  
  /**
   * Find a metric in the buffer
   * 
   * @param {string} type - Metric type to find
   * @param {string} id - ID to match
   * @param {string} idField - Field name for ID (default: 'generationId')
   * @returns {Object|null} Found metric or null
   * @private
   */
  _findMetric(type, id, idField = 'generationId') {
    if (!type || !id) {
      return null;
    }
    
    return this.metricsBuffer.find(m => 
      m.type === type && m[idField] === id
    ) || null;
  }
  
  /**
   * Extract strategy types from strategies
   * 
   * @param {Array} strategies - List of strategies
   * @returns {Array} List of strategy types
   * @private
   */
  _extractStrategyTypes(strategies) {
    if (!strategies || !Array.isArray(strategies)) {
      return [];
    }
    
    return [...new Set(strategies.map(s => s.type || 'unknown'))];
  }
  
  /**
   * Find highest confidence in strategies
   * 
   * @param {Array} strategies - List of strategies
   * @returns {number|null} Highest confidence or null
   * @private
   */
  _findHighestConfidence(strategies) {
    if (!strategies || !Array.isArray(strategies) || strategies.length === 0) {
      return null;
    }
    
    const confidences = strategies
      .map(s => s.confidence || 0)
      .filter(c => typeof c === 'number');
    
    if (confidences.length === 0) {
      return null;
    }
    
    return Math.max(...confidences);
  }
  
  /**
   * Calculate average of an array of numbers
   * 
   * @param {Array} values - Array of numbers
   * @returns {number} Average value
   * @private
   */
  _calculateAverage(values) {
    if (!values || values.length === 0) {
      return 0;
    }
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  
  /**
   * Get strategy type metrics
   * 
   * @returns {Object} Strategy type metrics
   * @private
   */
  _getStrategyTypeMetrics() {
    const metrics = {};
    
    for (const [type, data] of this.strategyTypeMetrics.entries()) {
      metrics[type] = { ...data };
    }
    
    return metrics;
  }
  
  /**
   * Get error type metrics
   * 
   * @returns {Object} Error type metrics
   * @private
   */
  _getErrorTypeMetrics() {
    const metrics = {};
    
    for (const [type, data] of this.errorTypeMetrics.entries()) {
      metrics[type] = { ...data };
    }
    
    return metrics;
  }
  
  /**
   * Sanitize context object for metrics
   * 
   * @param {Object} context - Context object
   * @returns {Object} Sanitized context
   * @private
   */
  _sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return null;
    }
    
    // Only include safe fields in metrics
    const safeContext = {};
    const safeFields = [
      'errorType',
      'errorCode',
      'component',
      'tentacleId',
      'severity',
      'priority',
      'timestamp'
    ];
    
    for (const field of safeFields) {
      if (context[field] !== undefined) {
        safeContext[field] = context[field];
      }
    }
    
    return safeContext;
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining metrics
    await this._flushMetrics();
    
    // Remove event listeners
    if (this.eventBus) {
      this.eventBus.off('strategy:generation:started', this._handleGenerationStarted);
      this.eventBus.off('strategy:generation:completed', this._handleGenerationCompleted);
      this.eventBus.off('strategy:execution:started', this._handleExecutionStarted);
      this.eventBus.off('strategy:execution:completed', this._handleExecutionCompleted);
      this.eventBus.off('strategy:execution:failed', this._handleExecutionFailed);
    }
  }
}

module.exports = StrategyGenerationMetrics;
