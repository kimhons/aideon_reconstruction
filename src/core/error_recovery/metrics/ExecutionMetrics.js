/**
 * ExecutionMetrics.js
 * 
 * Provides metrics collection and analysis capabilities for recovery strategy execution.
 * This component is responsible for collecting, analyzing, and reporting metrics
 * related to strategy execution performance and outcomes.
 * 
 * @module src/core/error_recovery/metrics/ExecutionMetrics
 */

'use strict';

/**
 * Class responsible for collecting and analyzing execution metrics
 */
class ExecutionMetrics {
  /**
   * Creates a new ExecutionMetrics instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.detailedMetrics = this.config.detailedMetrics === true;
    this.samplingRate = this.config.samplingRate || 1.0; // 1.0 = 100%
    this.retentionPeriodMs = this.config.retentionPeriodMs || 7 * 24 * 60 * 60 * 1000; // 7 days
    
    this.executionMetrics = new Map();
    this.aggregateMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTimeMs: 0,
      totalExecutionTimeMs: 0,
      strategyTypeMetrics: new Map(),
      errorTypeMetrics: new Map(),
      hourlyMetrics: Array(24).fill(0).map(() => ({
        executions: 0,
        successful: 0,
        failed: 0,
        averageTimeMs: 0
      })),
      dailyMetrics: Array(7).fill(0).map(() => ({
        executions: 0,
        successful: 0,
        failed: 0,
        averageTimeMs: 0
      }))
    };
    
    this.isInitialized = false;
    this.cleanupTimer = null;
  }
  
  /**
   * Initialize the metrics collector
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
      this.eventBus.on('execution:started', this._handleExecutionStarted.bind(this));
      this.eventBus.on('execution:completed', this._handleExecutionCompleted.bind(this));
      this.eventBus.on('execution:failed', this._handleExecutionFailed.bind(this));
      this.eventBus.on('execution:action:started', this._handleActionStarted.bind(this));
      this.eventBus.on('execution:action:completed', this._handleActionCompleted.bind(this));
      this.eventBus.on('execution:action:failed', this._handleActionFailed.bind(this));
    }
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this._cleanupOldMetrics();
    }, 3600000); // Run every hour
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'ExecutionMetrics',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the metrics collector
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Start tracking metrics for a strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} strategy - Strategy being executed
   * @param {Object} options - Tracking options
   * @returns {Promise<Object>} Tracking result
   */
  async startTracking(executionId, strategy, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId) {
      return {
        success: true,
        reason: 'metrics_disabled'
      };
    }
    
    try {
      // Check if we should sample this execution
      if (Math.random() > this.samplingRate) {
        return {
          success: true,
          reason: 'not_sampled'
        };
      }
      
      // Check if already tracking
      if (this.executionMetrics.has(executionId)) {
        return {
          success: false,
          reason: 'already_tracking',
          executionId
        };
      }
      
      // Create metrics record
      const metrics = {
        id: executionId,
        strategyId: strategy?.id,
        strategyType: strategy?.type || 'unknown',
        startTime: Date.now(),
        endTime: null,
        duration: null,
        status: 'running',
        actions: [],
        actionCount: 0,
        successfulActions: 0,
        failedActions: 0,
        errorType: null,
        errorMessage: null,
        context: options.context || {}
      };
      
      // Store metrics
      this.executionMetrics.set(executionId, metrics);
      
      // Update aggregate metrics
      this.aggregateMetrics.totalExecutions++;
      this._updateTimeBasedMetrics(metrics, 'start');
      
      // Update strategy type metrics
      this._updateStrategyTypeMetrics(metrics.strategyType, 'start');
      
      // Emit metrics event
      if (this.eventBus) {
        this.eventBus.emit('metrics:execution:started', {
          executionId,
          strategyType: metrics.strategyType,
          timestamp: metrics.startTime
        });
      }
      
      return {
        success: true,
        trackingId: executionId
      };
    } catch (error) {
      return {
        success: false,
        reason: 'tracking_error',
        error: error.message
      };
    }
  }
  
  /**
   * Record action metrics for a strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} action - Action being executed
   * @param {Object} options - Recording options
   * @returns {Promise<Object>} Recording result
   */
  async recordAction(executionId, action, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId || !action) {
      return {
        success: true,
        reason: 'metrics_disabled'
      };
    }
    
    try {
      // Check if tracking this execution
      if (!this.executionMetrics.has(executionId)) {
        return {
          success: false,
          reason: 'not_tracking',
          executionId
        };
      }
      
      const metrics = this.executionMetrics.get(executionId);
      const { status = 'started', result } = options;
      
      // Create action record
      const actionRecord = {
        type: action.type || 'unknown',
        status,
        startTime: Date.now(),
        endTime: null,
        duration: null,
        success: null,
        error: null
      };
      
      // Update action record based on status
      if (status === 'completed') {
        actionRecord.endTime = Date.now();
        actionRecord.duration = actionRecord.endTime - actionRecord.startTime;
        actionRecord.success = true;
        
        // Update metrics
        metrics.actionCount++;
        metrics.successfulActions++;
      } else if (status === 'failed') {
        actionRecord.endTime = Date.now();
        actionRecord.duration = actionRecord.endTime - actionRecord.startTime;
        actionRecord.success = false;
        actionRecord.error = result?.error || 'Unknown error';
        
        // Update metrics
        metrics.actionCount++;
        metrics.failedActions++;
      }
      
      // Add action record if detailed metrics are enabled
      if (this.detailedMetrics) {
        metrics.actions.push(actionRecord);
      }
      
      // Emit metrics event
      if (this.eventBus) {
        this.eventBus.emit(`metrics:action:${status}`, {
          executionId,
          actionType: actionRecord.type,
          success: actionRecord.success,
          duration: actionRecord.duration,
          timestamp: actionRecord.endTime || actionRecord.startTime
        });
      }
      
      return {
        success: true,
        actionId: metrics.actions.length - 1
      };
    } catch (error) {
      return {
        success: false,
        reason: 'recording_error',
        error: error.message
      };
    }
  }
  
  /**
   * Complete tracking for a strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} result - Execution result
   * @param {Object} options - Completion options
   * @returns {Promise<Object>} Completion result
   */
  async completeTracking(executionId, result = {}, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId) {
      return {
        success: true,
        reason: 'metrics_disabled'
      };
    }
    
    try {
      // Check if tracking this execution
      if (!this.executionMetrics.has(executionId)) {
        return {
          success: false,
          reason: 'not_tracking',
          executionId
        };
      }
      
      const metrics = this.executionMetrics.get(executionId);
      const success = result.success === true;
      
      // Update metrics
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.status = success ? 'completed' : 'failed';
      
      if (!success) {
        metrics.errorType = result.errorType || 'unknown';
        metrics.errorMessage = result.error || 'Unknown error';
      }
      
      // Update aggregate metrics
      if (success) {
        this.aggregateMetrics.successfulExecutions++;
      } else {
        this.aggregateMetrics.failedExecutions++;
        this._updateErrorTypeMetrics(metrics.errorType);
      }
      
      this.aggregateMetrics.totalExecutionTimeMs += metrics.duration;
      this.aggregateMetrics.averageExecutionTimeMs = 
        this.aggregateMetrics.totalExecutionTimeMs / this.aggregateMetrics.totalExecutions;
      
      // Update time-based metrics
      this._updateTimeBasedMetrics(metrics, 'end');
      
      // Update strategy type metrics
      this._updateStrategyTypeMetrics(metrics.strategyType, 'end', {
        success,
        duration: metrics.duration
      });
      
      // Emit metrics event
      if (this.eventBus) {
        this.eventBus.emit(`metrics:execution:${metrics.status}`, {
          executionId,
          strategyType: metrics.strategyType,
          duration: metrics.duration,
          actionCount: metrics.actionCount,
          successfulActions: metrics.successfulActions,
          failedActions: metrics.failedActions,
          errorType: metrics.errorType,
          timestamp: metrics.endTime
        });
      }
      
      return {
        success: true,
        metrics: this._getMetricsSummary(metrics)
      };
    } catch (error) {
      return {
        success: false,
        reason: 'completion_error',
        error: error.message
      };
    }
  }
  
  /**
   * Get metrics for a specific execution
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object} Execution metrics
   */
  async getExecutionMetrics(executionId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId || !this.executionMetrics.has(executionId)) {
      return null;
    }
    
    const metrics = this.executionMetrics.get(executionId);
    return this._getMetricsSummary(metrics);
  }
  
  /**
   * Get aggregate metrics
   * 
   * @param {Object} options - Filter options
   * @returns {Object} Aggregate metrics
   */
  async getAggregateMetrics(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return {
        enabled: false
      };
    }
    
    const { 
      strategyType, 
      timeRange = 'all', 
      includeHourly = false, 
      includeDaily = false 
    } = options;
    
    // Create base metrics object
    const metrics = {
      totalExecutions: this.aggregateMetrics.totalExecutions,
      successfulExecutions: this.aggregateMetrics.successfulExecutions,
      failedExecutions: this.aggregateMetrics.failedExecutions,
      successRate: this.aggregateMetrics.totalExecutions > 0 ? 
        (this.aggregateMetrics.successfulExecutions / this.aggregateMetrics.totalExecutions) * 100 : 0,
      averageExecutionTimeMs: this.aggregateMetrics.averageExecutionTimeMs,
      timestamp: Date.now()
    };
    
    // Add strategy type metrics if requested
    if (strategyType) {
      if (this.aggregateMetrics.strategyTypeMetrics.has(strategyType)) {
        const typeMetrics = this.aggregateMetrics.strategyTypeMetrics.get(strategyType);
        metrics.strategyTypeMetrics = {
          type: strategyType,
          executions: typeMetrics.executions,
          successful: typeMetrics.successful,
          failed: typeMetrics.failed,
          successRate: typeMetrics.executions > 0 ? 
            (typeMetrics.successful / typeMetrics.executions) * 100 : 0,
          averageTimeMs: typeMetrics.averageTimeMs
        };
      } else {
        metrics.strategyTypeMetrics = {
          type: strategyType,
          executions: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
          averageTimeMs: 0
        };
      }
    } else {
      // Add all strategy type metrics
      metrics.strategyTypeMetrics = Array.from(this.aggregateMetrics.strategyTypeMetrics.entries())
        .map(([type, typeMetrics]) => ({
          type,
          executions: typeMetrics.executions,
          successful: typeMetrics.successful,
          failed: typeMetrics.failed,
          successRate: typeMetrics.executions > 0 ? 
            (typeMetrics.successful / typeMetrics.executions) * 100 : 0,
          averageTimeMs: typeMetrics.averageTimeMs
        }))
        .sort((a, b) => b.executions - a.executions);
    }
    
    // Add error type metrics
    metrics.errorTypeMetrics = Array.from(this.aggregateMetrics.errorTypeMetrics.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: this.aggregateMetrics.failedExecutions > 0 ? 
          (count / this.aggregateMetrics.failedExecutions) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
    
    // Add hourly metrics if requested
    if (includeHourly) {
      metrics.hourlyMetrics = this.aggregateMetrics.hourlyMetrics.map((hourMetrics, hour) => ({
        hour,
        executions: hourMetrics.executions,
        successful: hourMetrics.successful,
        failed: hourMetrics.failed,
        successRate: hourMetrics.executions > 0 ? 
          (hourMetrics.successful / hourMetrics.executions) * 100 : 0,
        averageTimeMs: hourMetrics.averageTimeMs
      }));
    }
    
    // Add daily metrics if requested
    if (includeDaily) {
      metrics.dailyMetrics = this.aggregateMetrics.dailyMetrics.map((dayMetrics, day) => ({
        day,
        executions: dayMetrics.executions,
        successful: dayMetrics.successful,
        failed: dayMetrics.failed,
        successRate: dayMetrics.executions > 0 ? 
          (dayMetrics.successful / dayMetrics.executions) * 100 : 0,
        averageTimeMs: dayMetrics.averageTimeMs
      }));
    }
    
    return metrics;
  }
  
  /**
   * Handle execution started event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleExecutionStarted(data) {
    if (!data || !data.executionId || !data.strategy) {
      return;
    }
    
    this.startTracking(data.executionId, data.strategy, {
      context: data.context
    });
  }
  
  /**
   * Handle execution completed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleExecutionCompleted(data) {
    if (!data || !data.executionId) {
      return;
    }
    
    this.completeTracking(data.executionId, {
      success: true
    });
  }
  
  /**
   * Handle execution failed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleExecutionFailed(data) {
    if (!data || !data.executionId) {
      return;
    }
    
    this.completeTracking(data.executionId, {
      success: false,
      errorType: data.errorType,
      error: data.error
    });
  }
  
  /**
   * Handle action started event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleActionStarted(data) {
    if (!data || !data.executionId || !data.action) {
      return;
    }
    
    this.recordAction(data.executionId, data.action, {
      status: 'started'
    });
  }
  
  /**
   * Handle action completed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleActionCompleted(data) {
    if (!data || !data.executionId || !data.action) {
      return;
    }
    
    this.recordAction(data.executionId, data.action, {
      status: 'completed',
      result: data.result
    });
  }
  
  /**
   * Handle action failed event
   * 
   * @param {Object} data - Event data
   * @private
   */
  _handleActionFailed(data) {
    if (!data || !data.executionId || !data.action) {
      return;
    }
    
    this.recordAction(data.executionId, data.action, {
      status: 'failed',
      result: data.result
    });
  }
  
  /**
   * Update time-based metrics
   * 
   * @param {Object} metrics - Execution metrics
   * @param {string} phase - Execution phase ('start' or 'end')
   * @private
   */
  _updateTimeBasedMetrics(metrics, phase) {
    const timestamp = phase === 'start' ? metrics.startTime : metrics.endTime;
    if (!timestamp) {
      return;
    }
    
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    // Update hourly metrics
    const hourMetrics = this.aggregateMetrics.hourlyMetrics[hour];
    if (phase === 'start') {
      hourMetrics.executions++;
    } else if (phase === 'end') {
      if (metrics.status === 'completed') {
        hourMetrics.successful++;
      } else if (metrics.status === 'failed') {
        hourMetrics.failed++;
      }
      
      // Update average time
      const totalTime = hourMetrics.averageTimeMs * (hourMetrics.successful + hourMetrics.failed - 1);
      hourMetrics.averageTimeMs = (totalTime + metrics.duration) / (hourMetrics.successful + hourMetrics.failed);
    }
    
    // Update daily metrics
    const dayMetrics = this.aggregateMetrics.dailyMetrics[day];
    if (phase === 'start') {
      dayMetrics.executions++;
    } else if (phase === 'end') {
      if (metrics.status === 'completed') {
        dayMetrics.successful++;
      } else if (metrics.status === 'failed') {
        dayMetrics.failed++;
      }
      
      // Update average time
      const totalTime = dayMetrics.averageTimeMs * (dayMetrics.successful + dayMetrics.failed - 1);
      dayMetrics.averageTimeMs = (totalTime + metrics.duration) / (dayMetrics.successful + dayMetrics.failed);
    }
  }
  
  /**
   * Update strategy type metrics
   * 
   * @param {string} strategyType - Strategy type
   * @param {string} phase - Execution phase ('start' or 'end')
   * @param {Object} data - Additional data
   * @private
   */
  _updateStrategyTypeMetrics(strategyType, phase, data = {}) {
    if (!strategyType) {
      return;
    }
    
    // Get or create metrics for this strategy type
    const typeMetrics = this.aggregateMetrics.strategyTypeMetrics.get(strategyType) || {
      executions: 0,
      successful: 0,
      failed: 0,
      totalTime: 0,
      averageTimeMs: 0
    };
    
    // Update metrics based on phase
    if (phase === 'start') {
      typeMetrics.executions++;
    } else if (phase === 'end') {
      if (data.success) {
        typeMetrics.successful++;
      } else {
        typeMetrics.failed++;
      }
      
      // Update average time
      typeMetrics.totalTime = typeMetrics.totalTime || 0;
      typeMetrics.totalTime += data.duration || 0;
      typeMetrics.averageTimeMs = typeMetrics.totalTime / (typeMetrics.successful + typeMetrics.failed);
    }
    
    // Store updated metrics
    this.aggregateMetrics.strategyTypeMetrics.set(strategyType, typeMetrics);
  }
  
  /**
   * Update error type metrics
   * 
   * @param {string} errorType - Error type
   * @private
   */
  _updateErrorTypeMetrics(errorType) {
    if (!errorType) {
      return;
    }
    
    // Get or create count for this error type
    const count = this.aggregateMetrics.errorTypeMetrics.get(errorType) || 0;
    
    // Increment count
    this.aggregateMetrics.errorTypeMetrics.set(errorType, count + 1);
  }
  
  /**
   * Get metrics summary for an execution
   * 
   * @param {Object} metrics - Execution metrics
   * @returns {Object} Metrics summary
   * @private
   */
  _getMetricsSummary(metrics) {
    if (!metrics) {
      return null;
    }
    
    const summary = {
      id: metrics.id,
      strategyId: metrics.strategyId,
      strategyType: metrics.strategyType,
      startTime: metrics.startTime,
      endTime: metrics.endTime,
      duration: metrics.duration,
      status: metrics.status,
      actionCount: metrics.actionCount,
      successfulActions: metrics.successfulActions,
      failedActions: metrics.failedActions
    };
    
    if (metrics.status === 'failed') {
      summary.errorType = metrics.errorType;
      summary.errorMessage = metrics.errorMessage;
    }
    
    if (this.detailedMetrics) {
      summary.actions = metrics.actions;
    }
    
    return summary;
  }
  
  /**
   * Clean up old metrics
   * @private
   */
  _cleanupOldMetrics() {
    if (!this.enabled || this.retentionPeriodMs <= 0) {
      return;
    }
    
    const now = Date.now();
    const cutoff = now - this.retentionPeriodMs;
    
    // Remove old metrics
    for (const [executionId, metrics] of this.executionMetrics.entries()) {
      if (metrics.endTime && metrics.endTime < cutoff) {
        this.executionMetrics.delete(executionId);
      }
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Remove event listeners
    if (this.eventBus) {
      this.eventBus.off('execution:started', this._handleExecutionStarted);
      this.eventBus.off('execution:completed', this._handleExecutionCompleted);
      this.eventBus.off('execution:failed', this._handleExecutionFailed);
      this.eventBus.off('execution:action:started', this._handleActionStarted);
      this.eventBus.off('execution:action:completed', this._handleActionCompleted);
      this.eventBus.off('execution:action:failed', this._handleActionFailed);
    }
  }
}

module.exports = ExecutionMetrics;
