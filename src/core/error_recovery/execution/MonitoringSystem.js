/**
 * MonitoringSystem.js
 * 
 * Provides real-time monitoring capabilities for recovery strategy execution.
 * This component is responsible for tracking execution progress, detecting anomalies,
 * and collecting performance metrics during strategy execution.
 * 
 * @module src/core/error_recovery/execution/MonitoringSystem
 */

'use strict';

/**
 * Class responsible for monitoring strategy execution
 */
class MonitoringSystem {
  /**
   * Creates a new MonitoringSystem instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.metricsCollector - Collector for performance metrics
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.metricsCollector = options.metricsCollector;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.anomalyDetectionEnabled = this.config.anomalyDetection !== false;
    this.performanceMonitoringEnabled = this.config.performanceMonitoring !== false;
    this.healthCheckIntervalMs = this.config.healthCheckIntervalMs || 5000;
    
    this.activeMonitoring = new Map();
    this.anomalyThresholds = this.config.anomalyThresholds || {
      cpuUsage: 90, // percent
      memoryUsage: 90, // percent
      executionTime: 30000, // ms
      errorRate: 0.2 // 20%
    };
    
    this._initialize();
  }
  
  /**
   * Initialize the monitoring system
   * @private
   */
  _initialize() {
    if (!this.enabled) {
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('action:execution:started', this._handleActionStarted.bind(this));
      this.eventBus.on('action:execution:completed', this._handleActionCompleted.bind(this));
      this.eventBus.on('action:execution:failed', this._handleActionFailed.bind(this));
    }
  }
  
  /**
   * Start monitoring an execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Monitoring options
   * @returns {boolean} Whether monitoring was started successfully
   */
  startMonitoring(executionId, options = {}) {
    if (!this.enabled || !executionId) {
      return false;
    }
    
    const { strategy, executionContext } = options;
    
    // Create monitoring context
    const monitoringContext = {
      id: executionId,
      strategyId: strategy?.id,
      startTime: Date.now(),
      status: 'active',
      actions: {
        total: Array.isArray(strategy?.actions) ? strategy.actions.length : 0,
        completed: 0,
        failed: 0,
        inProgress: 0
      },
      performance: {
        cpuUsage: [],
        memoryUsage: [],
        executionTimes: []
      },
      anomalies: [],
      healthCheckTimer: null
    };
    
    // Start health check timer
    if (this.healthCheckIntervalMs > 0) {
      monitoringContext.healthCheckTimer = setInterval(() => {
        this._performHealthCheck(executionId);
      }, this.healthCheckIntervalMs);
    }
    
    // Register active monitoring
    this.activeMonitoring.set(executionId, monitoringContext);
    
    // Emit monitoring started event
    if (this.eventBus) {
      this.eventBus.emit('monitoring:started', {
        executionId,
        strategyId: strategy?.id,
        timestamp: monitoringContext.startTime
      });
    }
    
    // Start collecting metrics if enabled
    if (this.performanceMonitoringEnabled && this.metricsCollector) {
      this.metricsCollector.startCollection(executionId, {
        type: 'strategy_execution',
        strategyId: strategy?.id,
        strategyType: strategy?.type
      });
    }
    
    return true;
  }
  
  /**
   * Stop monitoring an execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Stop options
   * @returns {boolean} Whether monitoring was stopped successfully
   */
  stopMonitoring(executionId, options = {}) {
    if (!this.enabled || !executionId || !this.activeMonitoring.has(executionId)) {
      return false;
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    const { success, error, cancelled, executionContext } = options;
    
    // Update monitoring context
    monitoringContext.status = success ? 'completed' : (cancelled ? 'cancelled' : 'failed');
    monitoringContext.endTime = Date.now();
    monitoringContext.executionTime = monitoringContext.endTime - monitoringContext.startTime;
    monitoringContext.error = error;
    
    // Stop health check timer
    if (monitoringContext.healthCheckTimer) {
      clearInterval(monitoringContext.healthCheckTimer);
      monitoringContext.healthCheckTimer = null;
    }
    
    // Emit monitoring stopped event
    if (this.eventBus) {
      this.eventBus.emit('monitoring:stopped', {
        executionId,
        status: monitoringContext.status,
        executionTime: monitoringContext.executionTime,
        anomalyCount: monitoringContext.anomalies.length,
        timestamp: monitoringContext.endTime
      });
    }
    
    // Stop collecting metrics if enabled
    if (this.performanceMonitoringEnabled && this.metricsCollector) {
      this.metricsCollector.stopCollection(executionId, {
        success,
        executionTime: monitoringContext.executionTime,
        actionCount: monitoringContext.actions.total,
        completedActions: monitoringContext.actions.completed,
        failedActions: monitoringContext.actions.failed
      });
    }
    
    // Generate execution report
    const report = this._generateExecutionReport(executionId);
    
    // Clean up after timeout
    setTimeout(() => {
      this.activeMonitoring.delete(executionId);
    }, 60000); // Keep monitoring context for 1 minute for potential queries
    
    return true;
  }
  
  /**
   * Get monitoring status for an execution
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object} Monitoring status
   */
  getMonitoringStatus(executionId) {
    if (!this.enabled || !executionId || !this.activeMonitoring.has(executionId)) {
      return { found: false };
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    
    return {
      found: true,
      status: monitoringContext.status,
      startTime: monitoringContext.startTime,
      endTime: monitoringContext.endTime,
      executionTime: monitoringContext.endTime ? 
        monitoringContext.endTime - monitoringContext.startTime : 
        Date.now() - monitoringContext.startTime,
      actions: { ...monitoringContext.actions },
      anomalyCount: monitoringContext.anomalies.length,
      lastAnomalyTime: monitoringContext.anomalies.length > 0 ? 
        monitoringContext.anomalies[monitoringContext.anomalies.length - 1].timestamp : 
        null
    };
  }
  
  /**
   * Get detailed monitoring report for an execution
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object} Monitoring report
   */
  getMonitoringReport(executionId) {
    if (!this.enabled || !executionId || !this.activeMonitoring.has(executionId)) {
      return { found: false };
    }
    
    return this._generateExecutionReport(executionId);
  }
  
  /**
   * Handle action started event
   * 
   * @param {Object} data - Action start data
   * @private
   */
  _handleActionStarted(data) {
    if (!data || !data.executionId || !data.actionType) {
      return;
    }
    
    const executionId = data.executionId;
    if (!this.activeMonitoring.has(executionId)) {
      return;
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    monitoringContext.actions.inProgress++;
    
    // Record action start time for performance tracking
    if (!monitoringContext.actionStartTimes) {
      monitoringContext.actionStartTimes = new Map();
    }
    
    monitoringContext.actionStartTimes.set(data.actionType + '_' + data.timestamp, {
      type: data.actionType,
      startTime: data.timestamp
    });
  }
  
  /**
   * Handle action completed event
   * 
   * @param {Object} data - Action completion data
   * @private
   */
  _handleActionCompleted(data) {
    if (!data || !data.executionId || !data.actionType) {
      return;
    }
    
    const executionId = data.executionId;
    if (!this.activeMonitoring.has(executionId)) {
      return;
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    monitoringContext.actions.completed++;
    monitoringContext.actions.inProgress = Math.max(0, monitoringContext.actions.inProgress - 1);
    
    // Calculate action execution time for performance tracking
    if (monitoringContext.actionStartTimes) {
      // Find the matching action start event
      const actionKey = Array.from(monitoringContext.actionStartTimes.keys())
        .find(key => key.startsWith(data.actionType + '_'));
      
      if (actionKey) {
        const actionStart = monitoringContext.actionStartTimes.get(actionKey);
        const executionTime = data.timestamp - actionStart.startTime;
        
        // Record execution time
        monitoringContext.performance.executionTimes.push({
          actionType: data.actionType,
          executionTime,
          timestamp: data.timestamp
        });
        
        // Check for execution time anomaly
        if (this.anomalyDetectionEnabled && 
            executionTime > this.anomalyThresholds.executionTime) {
          this._recordAnomaly(executionId, {
            type: 'execution_time',
            actionType: data.actionType,
            value: executionTime,
            threshold: this.anomalyThresholds.executionTime,
            timestamp: data.timestamp
          });
        }
        
        // Remove from start times map
        monitoringContext.actionStartTimes.delete(actionKey);
      }
    }
    
    // Record metrics if enabled
    if (this.performanceMonitoringEnabled && this.metricsCollector) {
      this.metricsCollector.recordMetric(executionId, 'action_completed', {
        actionType: data.actionType,
        timestamp: data.timestamp
      });
    }
  }
  
  /**
   * Handle action failed event
   * 
   * @param {Object} data - Action failure data
   * @private
   */
  _handleActionFailed(data) {
    if (!data || !data.executionId || !data.actionType) {
      return;
    }
    
    const executionId = data.executionId;
    if (!this.activeMonitoring.has(executionId)) {
      return;
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    monitoringContext.actions.failed++;
    monitoringContext.actions.inProgress = Math.max(0, monitoringContext.actions.inProgress - 1);
    
    // Calculate error rate
    const totalActions = monitoringContext.actions.completed + monitoringContext.actions.failed;
    const errorRate = totalActions > 0 ? monitoringContext.actions.failed / totalActions : 0;
    
    // Check for error rate anomaly
    if (this.anomalyDetectionEnabled && 
        errorRate > this.anomalyThresholds.errorRate && 
        totalActions >= 5) { // Only check after a reasonable number of actions
      this._recordAnomaly(executionId, {
        type: 'error_rate',
        value: errorRate,
        threshold: this.anomalyThresholds.errorRate,
        timestamp: data.timestamp
      });
    }
    
    // Record metrics if enabled
    if (this.performanceMonitoringEnabled && this.metricsCollector) {
      this.metricsCollector.recordMetric(executionId, 'action_failed', {
        actionType: data.actionType,
        error: data.error,
        timestamp: data.timestamp
      });
    }
  }
  
  /**
   * Perform health check for an execution
   * 
   * @param {string} executionId - Execution ID
   * @private
   */
  _performHealthCheck(executionId) {
    if (!this.activeMonitoring.has(executionId)) {
      return;
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    const now = Date.now();
    
    // Check execution duration
    const currentDuration = now - monitoringContext.startTime;
    
    // In a real implementation, this would check system resources
    // For now, we'll simulate resource checks
    const simulatedCpuUsage = Math.min(
      50 + Math.floor(Math.random() * 30) + 
      (monitoringContext.actions.inProgress * 5),
      100
    );
    
    const simulatedMemoryUsage = Math.min(
      40 + Math.floor(Math.random() * 20) + 
      (monitoringContext.actions.completed * 2),
      100
    );
    
    // Record resource usage
    monitoringContext.performance.cpuUsage.push({
      value: simulatedCpuUsage,
      timestamp: now
    });
    
    monitoringContext.performance.memoryUsage.push({
      value: simulatedMemoryUsage,
      timestamp: now
    });
    
    // Check for resource usage anomalies
    if (this.anomalyDetectionEnabled) {
      // CPU usage anomaly
      if (simulatedCpuUsage > this.anomalyThresholds.cpuUsage) {
        this._recordAnomaly(executionId, {
          type: 'cpu_usage',
          value: simulatedCpuUsage,
          threshold: this.anomalyThresholds.cpuUsage,
          timestamp: now
        });
      }
      
      // Memory usage anomaly
      if (simulatedMemoryUsage > this.anomalyThresholds.memoryUsage) {
        this._recordAnomaly(executionId, {
          type: 'memory_usage',
          value: simulatedMemoryUsage,
          threshold: this.anomalyThresholds.memoryUsage,
          timestamp: now
        });
      }
    }
    
    // Record metrics if enabled
    if (this.performanceMonitoringEnabled && this.metricsCollector) {
      this.metricsCollector.recordMetric(executionId, 'health_check', {
        cpuUsage: simulatedCpuUsage,
        memoryUsage: simulatedMemoryUsage,
        duration: currentDuration,
        timestamp: now
      });
    }
  }
  
  /**
   * Record an anomaly
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} anomaly - Anomaly data
   * @private
   */
  _recordAnomaly(executionId, anomaly) {
    if (!this.activeMonitoring.has(executionId)) {
      return;
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    monitoringContext.anomalies.push(anomaly);
    
    // Emit anomaly detected event
    if (this.eventBus) {
      this.eventBus.emit('monitoring:anomaly:detected', {
        executionId,
        anomalyType: anomaly.type,
        value: anomaly.value,
        threshold: anomaly.threshold,
        timestamp: anomaly.timestamp
      });
    }
  }
  
  /**
   * Generate execution report
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object} Execution report
   * @private
   */
  _generateExecutionReport(executionId) {
    if (!this.activeMonitoring.has(executionId)) {
      return { found: false };
    }
    
    const monitoringContext = this.activeMonitoring.get(executionId);
    const now = Date.now();
    
    // Calculate average resource usage
    const avgCpuUsage = monitoringContext.performance.cpuUsage.length > 0 ?
      monitoringContext.performance.cpuUsage.reduce((sum, item) => sum + item.value, 0) / 
      monitoringContext.performance.cpuUsage.length : 0;
    
    const avgMemoryUsage = monitoringContext.performance.memoryUsage.length > 0 ?
      monitoringContext.performance.memoryUsage.reduce((sum, item) => sum + item.value, 0) / 
      monitoringContext.performance.memoryUsage.length : 0;
    
    // Calculate average execution time
    const avgExecutionTime = monitoringContext.performance.executionTimes.length > 0 ?
      monitoringContext.performance.executionTimes.reduce((sum, item) => sum + item.executionTime, 0) / 
      monitoringContext.performance.executionTimes.length : 0;
    
    // Calculate error rate
    const totalActions = monitoringContext.actions.completed + monitoringContext.actions.failed;
    const errorRate = totalActions > 0 ? monitoringContext.actions.failed / totalActions : 0;
    
    // Generate report
    return {
      found: true,
      executionId,
      strategyId: monitoringContext.strategyId,
      status: monitoringContext.status,
      startTime: monitoringContext.startTime,
      endTime: monitoringContext.endTime || now,
      executionTime: (monitoringContext.endTime || now) - monitoringContext.startTime,
      actions: {
        total: monitoringContext.actions.total,
        completed: monitoringContext.actions.completed,
        failed: monitoringContext.actions.failed,
        inProgress: monitoringContext.actions.inProgress,
        completionRate: monitoringContext.actions.total > 0 ? 
          monitoringContext.actions.completed / monitoringContext.actions.total : 0,
        errorRate
      },
      performance: {
        avgCpuUsage,
        avgMemoryUsage,
        avgExecutionTime,
        maxCpuUsage: monitoringContext.performance.cpuUsage.length > 0 ?
          Math.max(...monitoringContext.performance.cpuUsage.map(item => item.value)) : 0,
        maxMemoryUsage: monitoringContext.performance.memoryUsage.length > 0 ?
          Math.max(...monitoringContext.performance.memoryUsage.map(item => item.value)) : 0,
        maxExecutionTime: monitoringContext.performance.executionTimes.length > 0 ?
          Math.max(...monitoringContext.performance.executionTimes.map(item => item.executionTime)) : 0
      },
      anomalies: {
        count: monitoringContext.anomalies.length,
        byType: monitoringContext.anomalies.reduce((types, anomaly) => {
          types[anomaly.type] = (types[anomaly.type] || 0) + 1;
          return types;
        }, {}),
        items: monitoringContext.anomalies.slice(0, 10) // Include only the first 10 anomalies
      }
    };
  }
  
  /**
   * Dispose resources used by this system
   */
  dispose() {
    if (!this.enabled) {
      return;
    }
    
    // Stop all health check timers
    for (const [executionId, monitoringContext] of this.activeMonitoring.entries()) {
      if (monitoringContext.healthCheckTimer) {
        clearInterval(monitoringContext.healthCheckTimer);
        monitoringContext.healthCheckTimer = null;
      }
    }
    
    // Remove event listeners
    if (this.eventBus) {
      this.eventBus.removeAllListeners('action:execution:started');
      this.eventBus.removeAllListeners('action:execution:completed');
      this.eventBus.removeAllListeners('action:execution:failed');
    }
    
    this.activeMonitoring.clear();
  }
}

module.exports = MonitoringSystem;
