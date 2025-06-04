/**
 * @fileoverview Implementation of the ExecutionMonitor component for the Autonomous Error Recovery System.
 * This component monitors the execution of recovery strategies, tracking progress, resource usage,
 * and detecting anomalies during execution.
 * 
 * @module core/error_recovery/ExecutionMonitor
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

/**
 * ExecutionMonitor tracks and monitors the execution of recovery strategies.
 */
class ExecutionMonitor {
  /**
   * Creates a new ExecutionMonitor instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector
   * @param {EventEmitter} options.eventEmitter - Event emitter for monitoring events
   * @param {Object} options.anomalyDetector - Anomaly detector for execution monitoring
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    this.anomalyDetector = options.anomalyDetector;
    
    // Active monitoring sessions
    this.activeSessions = new Map();
    
    // Monitoring history
    this.monitoringHistory = new Map();
    this.historyMaxSize = options.historyMaxSize || 100;
    
    // Monitoring intervals
    this.monitoringIntervals = new Map();
    this.defaultMonitoringInterval = options.defaultMonitoringInterval || 1000; // 1 second
    
    this.logger.info('ExecutionMonitor initialized');
  }
  
  /**
   * Starts monitoring a strategy execution.
   * @param {string} executionId - Execution ID
   * @param {Object} strategy - Strategy being executed
   * @param {Object} [options] - Monitoring options
   * @param {number} [options.interval=1000] - Monitoring interval in milliseconds
   * @param {boolean} [options.collectResourceMetrics=true] - Whether to collect resource metrics
   * @param {boolean} [options.detectAnomalies=true] - Whether to detect anomalies
   * @returns {Promise<void>}
   */
  async startMonitoring(executionId, strategy, options = {}) {
    const {
      interval = this.defaultMonitoringInterval,
      collectResourceMetrics = true,
      detectAnomalies = true
    } = options;
    
    this.logger.debug(`Starting monitoring for execution ${executionId}`);
    
    // Create monitoring session
    const session = {
      executionId,
      strategy: {
        id: strategy.id,
        name: strategy.name
      },
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      status: 'active',
      metrics: {
        resourceUsage: {
          cpu: [],
          memory: [],
          disk: [],
          network: []
        },
        performance: {
          actionDurations: [],
          overheadDurations: []
        },
        reliability: {
          actionSuccessCount: 0,
          actionFailureCount: 0,
          checkpointSuccessCount: 0,
          checkpointFailureCount: 0
        }
      },
      anomalies: [],
      options: {
        interval,
        collectResourceMetrics,
        detectAnomalies
      }
    };
    
    // Store session
    this.activeSessions.set(executionId, session);
    
    // Start periodic monitoring
    if (interval > 0) {
      const monitoringInterval = setInterval(() => {
        this.performPeriodicMonitoring(executionId);
      }, interval);
      
      this.monitoringIntervals.set(executionId, monitoringInterval);
    }
    
    this.eventEmitter.emit('monitoring:started', { executionId, session });
    
    return session;
  }
  
  /**
   * Performs periodic monitoring for an execution.
   * @param {string} executionId - Execution ID
   * @private
   */
  async performPeriodicMonitoring(executionId) {
    const session = this.activeSessions.get(executionId);
    if (!session) {
      this.logger.warn(`Attempted to monitor non-existent session: ${executionId}`);
      return;
    }
    
    try {
      // Update last update time
      session.lastUpdateTime = Date.now();
      
      // Collect resource metrics if enabled
      if (session.options.collectResourceMetrics) {
        const resourceMetrics = await this.collectResourceMetrics(executionId);
        
        // Store resource metrics
        session.metrics.resourceUsage.cpu.push({
          timestamp: Date.now(),
          value: resourceMetrics.cpu
        });
        
        session.metrics.resourceUsage.memory.push({
          timestamp: Date.now(),
          value: resourceMetrics.memory
        });
        
        session.metrics.resourceUsage.disk.push({
          timestamp: Date.now(),
          value: resourceMetrics.disk
        });
        
        session.metrics.resourceUsage.network.push({
          timestamp: Date.now(),
          value: resourceMetrics.network
        });
      }
      
      // Detect anomalies if enabled
      if (session.options.detectAnomalies && this.anomalyDetector) {
        const anomalies = await this.detectAnomalies(executionId, session);
        
        // Add new anomalies
        for (const anomaly of anomalies) {
          session.anomalies.push(anomaly);
          
          this.logger.warn(`Detected anomaly in execution ${executionId}: ${anomaly.description}`);
          this.eventEmitter.emit('monitoring:anomaly', { executionId, anomaly });
        }
      }
      
      // Emit monitoring update event
      this.eventEmitter.emit('monitoring:update', { 
        executionId, 
        timestamp: Date.now(),
        metrics: this.getLatestMetrics(session)
      });
    } catch (error) {
      this.logger.error(`Error during periodic monitoring for ${executionId}: ${error.message}`, error);
    }
  }
  
  /**
   * Collects resource metrics for an execution.
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Resource metrics
   * @private
   */
  async collectResourceMetrics(executionId) {
    // In a real implementation, this would collect actual resource metrics
    // For now, return mock metrics
    return {
      cpu: Math.random() * 30, // 0-30% CPU usage
      memory: Math.random() * 200, // 0-200 MB memory usage
      disk: Math.random() * 10, // 0-10 MB disk usage
      network: Math.random() * 5 // 0-5 Mbps network usage
    };
  }
  
  /**
   * Detects anomalies in execution.
   * @param {string} executionId - Execution ID
   * @param {Object} session - Monitoring session
   * @returns {Promise<Array<Object>>} Detected anomalies
   * @private
   */
  async detectAnomalies(executionId, session) {
    // In a real implementation, this would use the anomaly detector
    // For now, return empty array (no anomalies)
    return [];
  }
  
  /**
   * Gets the latest metrics from a monitoring session.
   * @param {Object} session - Monitoring session
   * @returns {Object} Latest metrics
   * @private
   */
  getLatestMetrics(session) {
    const getLatestValue = (array) => {
      if (array.length === 0) return null;
      return array[array.length - 1].value;
    };
    
    return {
      resourceUsage: {
        cpu: getLatestValue(session.metrics.resourceUsage.cpu),
        memory: getLatestValue(session.metrics.resourceUsage.memory),
        disk: getLatestValue(session.metrics.resourceUsage.disk),
        network: getLatestValue(session.metrics.resourceUsage.network)
      },
      performance: {
        averageActionDuration: this.calculateAverageActionDuration(session),
        maxActionDuration: this.calculateMaxActionDuration(session),
        overheadDuration: this.calculateOverheadDuration(session)
      },
      reliability: {
        actionSuccessRate: this.calculateActionSuccessRate(session),
        checkpointSuccessRate: this.calculateCheckpointSuccessRate(session)
      }
    };
  }
  
  /**
   * Calculates the average action duration.
   * @param {Object} session - Monitoring session
   * @returns {number} Average action duration in milliseconds
   * @private
   */
  calculateAverageActionDuration(session) {
    const durations = session.metrics.performance.actionDurations;
    if (durations.length === 0) return 0;
    
    const sum = durations.reduce((total, duration) => total + duration, 0);
    return sum / durations.length;
  }
  
  /**
   * Calculates the maximum action duration.
   * @param {Object} session - Monitoring session
   * @returns {number} Maximum action duration in milliseconds
   * @private
   */
  calculateMaxActionDuration(session) {
    const durations = session.metrics.performance.actionDurations;
    if (durations.length === 0) return 0;
    
    return Math.max(...durations);
  }
  
  /**
   * Calculates the overhead duration.
   * @param {Object} session - Monitoring session
   * @returns {number} Overhead duration in milliseconds
   * @private
   */
  calculateOverheadDuration(session) {
    const durations = session.metrics.performance.overheadDurations;
    if (durations.length === 0) return 0;
    
    return durations.reduce((total, duration) => total + duration, 0);
  }
  
  /**
   * Calculates the action success rate.
   * @param {Object} session - Monitoring session
   * @returns {number} Action success rate (0-1)
   * @private
   */
  calculateActionSuccessRate(session) {
    const { actionSuccessCount, actionFailureCount } = session.metrics.reliability;
    const total = actionSuccessCount + actionFailureCount;
    
    if (total === 0) return 1; // No actions executed yet
    return actionSuccessCount / total;
  }
  
  /**
   * Calculates the checkpoint success rate.
   * @param {Object} session - Monitoring session
   * @returns {number} Checkpoint success rate (0-1)
   * @private
   */
  calculateCheckpointSuccessRate(session) {
    const { checkpointSuccessCount, checkpointFailureCount } = session.metrics.reliability;
    const total = checkpointSuccessCount + checkpointFailureCount;
    
    if (total === 0) return 1; // No checkpoints verified yet
    return checkpointSuccessCount / total;
  }
  
  /**
   * Records an action execution.
   * @param {string} executionId - Execution ID
   * @param {Object} actionResult - Action execution result
   * @returns {Promise<void>}
   */
  async recordActionExecution(executionId, actionResult) {
    const session = this.activeSessions.get(executionId);
    if (!session) {
      this.logger.warn(`Attempted to record action for non-existent session: ${executionId}`);
      return;
    }
    
    // Calculate duration
    const duration = actionResult.endTime - actionResult.startTime;
    
    // Add to action durations
    session.metrics.performance.actionDurations.push(duration);
    
    // Update success/failure counts
    if (actionResult.successful) {
      session.metrics.reliability.actionSuccessCount++;
    } else {
      session.metrics.reliability.actionFailureCount++;
    }
    
    this.eventEmitter.emit('monitoring:action', { 
      executionId, 
      actionResult,
      duration
    });
  }
  
  /**
   * Records a checkpoint verification.
   * @param {string} executionId - Execution ID
   * @param {Object} checkpointResult - Checkpoint verification result
   * @returns {Promise<void>}
   */
  async recordCheckpointVerification(executionId, checkpointResult) {
    const session = this.activeSessions.get(executionId);
    if (!session) {
      this.logger.warn(`Attempted to record checkpoint for non-existent session: ${executionId}`);
      return;
    }
    
    // Update success/failure counts
    if (checkpointResult.verified) {
      session.metrics.reliability.checkpointSuccessCount++;
    } else {
      session.metrics.reliability.checkpointFailureCount++;
    }
    
    this.eventEmitter.emit('monitoring:checkpoint', { 
      executionId, 
      checkpointResult
    });
  }
  
  /**
   * Records overhead duration.
   * @param {string} executionId - Execution ID
   * @param {number} duration - Overhead duration in milliseconds
   * @returns {Promise<void>}
   */
  async recordOverheadDuration(executionId, duration) {
    const session = this.activeSessions.get(executionId);
    if (!session) {
      this.logger.warn(`Attempted to record overhead for non-existent session: ${executionId}`);
      return;
    }
    
    // Add to overhead durations
    session.metrics.performance.overheadDurations.push(duration);
  }
  
  /**
   * Completes monitoring for an execution.
   * @param {string} executionId - Execution ID
   * @param {Object} executionResult - Execution result
   * @returns {Promise<Object>} Final monitoring report
   */
  async completeMonitoring(executionId, executionResult) {
    const session = this.activeSessions.get(executionId);
    if (!session) {
      this.logger.warn(`Attempted to complete monitoring for non-existent session: ${executionId}`);
      return null;
    }
    
    this.logger.debug(`Completing monitoring for execution ${executionId}`);
    
    // Stop periodic monitoring
    if (this.monitoringIntervals.has(executionId)) {
      clearInterval(this.monitoringIntervals.get(executionId));
      this.monitoringIntervals.delete(executionId);
    }
    
    // Update session status
    session.status = 'completed';
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.executionResult = {
      successful: executionResult.successful,
      error: executionResult.error
    };
    
    // Generate final report
    const finalReport = {
      executionId,
      strategy: session.strategy,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      status: executionResult.successful ? 'successful' : 'failed',
      metrics: this.getLatestMetrics(session),
      anomalies: session.anomalies,
      summary: this.generateMonitoringSummary(session, executionResult)
    };
    
    // Move from active sessions to history
    this.activeSessions.delete(executionId);
    this.monitoringHistory.set(executionId, finalReport);
    
    // Trim history if needed
    if (this.monitoringHistory.size > this.historyMaxSize) {
      const oldestKey = [...this.monitoringHistory.keys()][0];
      this.monitoringHistory.delete(oldestKey);
    }
    
    // Record metrics
    if (this.metrics) {
      this.metrics.recordMetric('execution_monitoring', {
        executionId,
        duration: session.duration,
        successful: executionResult.successful,
        anomalyCount: session.anomalies.length,
        resourceUsage: finalReport.metrics.resourceUsage
      });
    }
    
    this.eventEmitter.emit('monitoring:completed', { 
      executionId, 
      report: finalReport 
    });
    
    return finalReport;
  }
  
  /**
   * Generates a monitoring summary.
   * @param {Object} session - Monitoring session
   * @param {Object} executionResult - Execution result
   * @returns {Object} Monitoring summary
   * @private
   */
  generateMonitoringSummary(session, executionResult) {
    const metrics = this.getLatestMetrics(session);
    
    return {
      executionStatus: executionResult.successful ? 'successful' : 'failed',
      executionDuration: session.endTime - session.startTime,
      actionCount: session.metrics.reliability.actionSuccessCount + session.metrics.reliability.actionFailureCount,
      actionSuccessRate: metrics.reliability.actionSuccessRate,
      checkpointCount: session.metrics.reliability.checkpointSuccessCount + session.metrics.reliability.checkpointFailureCount,
      checkpointSuccessRate: metrics.reliability.checkpointSuccessRate,
      anomalyCount: session.anomalies.length,
      peakResourceUsage: {
        cpu: Math.max(...session.metrics.resourceUsage.cpu.map(m => m.value) || [0]),
        memory: Math.max(...session.metrics.resourceUsage.memory.map(m => m.value) || [0]),
        disk: Math.max(...session.metrics.resourceUsage.disk.map(m => m.value) || [0]),
        network: Math.max(...session.metrics.resourceUsage.network.map(m => m.value) || [0])
      },
      recommendations: this.generateRecommendations(session, executionResult)
    };
  }
  
  /**
   * Generates recommendations based on monitoring data.
   * @param {Object} session - Monitoring session
   * @param {Object} executionResult - Execution result
   * @returns {Array<Object>} Recommendations
   * @private
   */
  generateRecommendations(session, executionResult) {
    const recommendations = [];
    
    // Add recommendations based on monitoring data
    if (session.anomalies.length > 0) {
      recommendations.push({
        type: 'investigation',
        priority: 'high',
        description: `Investigate ${session.anomalies.length} anomalies detected during execution`
      });
    }
    
    // Add recommendations based on resource usage
    const peakCpu = Math.max(...session.metrics.resourceUsage.cpu.map(m => m.value) || [0]);
    if (peakCpu > 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Optimize CPU usage in recovery actions'
      });
    }
    
    // Add recommendations based on action success rate
    const actionSuccessRate = this.calculateActionSuccessRate(session);
    if (actionSuccessRate < 0.9) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        description: 'Improve reliability of recovery actions'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Gets monitoring data for an execution.
   * @param {string} executionId - Execution ID
   * @returns {Object|null} Monitoring data or null if not found
   */
  getMonitoringData(executionId) {
    // Check active sessions first
    if (this.activeSessions.has(executionId)) {
      const session = this.activeSessions.get(executionId);
      return {
        executionId,
        status: 'active',
        startTime: session.startTime,
        lastUpdateTime: session.lastUpdateTime,
        duration: Date.now() - session.startTime,
        metrics: this.getLatestMetrics(session),
        anomalies: session.anomalies
      };
    }
    
    // Check history
    if (this.monitoringHistory.has(executionId)) {
      return this.monitoringHistory.get(executionId);
    }
    
    return null;
  }
  
  /**
   * Gets all active monitoring sessions.
   * @returns {Array<Object>} Active monitoring sessions
   */
  getActiveMonitoringSessions() {
    return [...this.activeSessions.entries()].map(([executionId, session]) => ({
      executionId,
      strategy: session.strategy,
      startTime: session.startTime,
      lastUpdateTime: session.lastUpdateTime,
      duration: Date.now() - session.startTime,
      metrics: this.getLatestMetrics(session),
      anomalyCount: session.anomalies.length
    }));
  }
  
  /**
   * Gets monitoring history.
   * @param {number} [limit=10] - Maximum number of history entries to return
   * @returns {Array<Object>} Monitoring history
   */
  getMonitoringHistory(limit = 10) {
    return [...this.monitoringHistory.values()]
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, limit);
  }
}

module.exports = ExecutionMonitor;
