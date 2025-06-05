/**
 * AdaptivePerformanceOptimizer.js
 * 
 * Provides adaptive performance optimization for the error recovery system.
 * This component dynamically adjusts execution parameters based on system load,
 * historical performance data, and current execution context to ensure optimal
 * performance under varying conditions.
 * 
 * @module src/core/error_recovery/performance/AdaptivePerformanceOptimizer
 */

'use strict';

/**
 * Class responsible for adaptive performance optimization
 */
class AdaptivePerformanceOptimizer {
  /**
   * Creates a new AdaptivePerformanceOptimizer instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.metricsCollector - Metrics collector for performance data
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.metricsCollector = options.metricsCollector;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.adaptationInterval = this.config.adaptationIntervalMs || 30000;
    this.optimizationThreshold = this.config.optimizationThreshold || 0.1;
    this.maxParallelism = this.config.maxParallelism || 4;
    this.minParallelism = this.config.minParallelism || 1;
    
    this.currentParallelism = this.config.initialParallelism || 2;
    this.currentBatchSize = this.config.initialBatchSize || 5;
    this.currentTimeout = this.config.initialTimeoutMs || 5000;
    
    this.performanceHistory = [];
    this.systemLoadHistory = [];
    this.optimizationHistory = [];
    
    this.adaptationTimer = null;
    this.isOptimizing = false;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the optimizer
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
      this.eventBus.on('system:load:updated', this._handleSystemLoadUpdate.bind(this));
      this.eventBus.on('strategy:execution:completed', this._handleExecutionCompleted.bind(this));
      this.eventBus.on('strategy:execution:failed', this._handleExecutionFailed.bind(this));
    }
    
    // Start adaptation timer
    if (this.adaptationInterval > 0) {
      this.adaptationTimer = setInterval(() => {
        this._adaptParameters();
      }, this.adaptationInterval);
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'AdaptivePerformanceOptimizer',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the optimizer
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Get optimized execution parameters for the current context
   * 
   * @param {Object} context - Execution context
   * @returns {Object} Optimized parameters
   */
  async getOptimizedParameters(context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return this._getDefaultParameters();
    }
    
    const { errorType, priority, environment, tentacles } = context;
    
    // Start with current parameters
    let params = {
      parallelism: this.currentParallelism,
      batchSize: this.currentBatchSize,
      timeoutMs: this.currentTimeout
    };
    
    // Adjust based on priority
    if (priority === 'high') {
      params.parallelism = Math.min(params.parallelism + 1, this.maxParallelism);
      params.timeoutMs = Math.max(params.timeoutMs - 1000, 1000);
    } else if (priority === 'low') {
      params.parallelism = Math.max(params.parallelism - 1, this.minParallelism);
      params.timeoutMs = params.timeoutMs + 2000;
    }
    
    // Adjust based on error type
    if (errorType === 'critical') {
      params.parallelism = this.maxParallelism;
      params.batchSize = Math.max(1, params.batchSize - 2);
    } else if (errorType === 'network') {
      params.timeoutMs = params.timeoutMs + 3000;
    }
    
    // Adjust based on environment
    if (environment === 'resource_constrained') {
      params.parallelism = this.minParallelism;
      params.batchSize = Math.max(1, params.batchSize - 1);
    } else if (environment === 'high_performance') {
      params.parallelism = this.maxParallelism;
      params.batchSize = params.batchSize + 2;
    }
    
    // Adjust based on affected tentacles
    if (tentacles && Array.isArray(tentacles)) {
      if (tentacles.length > 3) {
        // Complex multi-tentacle scenario
        params.parallelism = Math.max(1, params.parallelism - 1);
        params.batchSize = Math.max(1, params.batchSize - 1);
      } else if (tentacles.includes('core')) {
        // Core tentacle affected
        params.parallelism = this.minParallelism;
      }
    }
    
    // Apply system load adjustments
    const currentLoad = this._getCurrentSystemLoad();
    if (currentLoad > 0.8) {
      // High system load
      params.parallelism = this.minParallelism;
      params.batchSize = Math.max(1, params.batchSize - 2);
    } else if (currentLoad < 0.3) {
      // Low system load
      params.parallelism = Math.min(params.parallelism + 1, this.maxParallelism);
    }
    
    // Apply historical performance adjustments
    const historicalPerformance = this._getHistoricalPerformance(errorType);
    if (historicalPerformance) {
      if (historicalPerformance.successRate < 0.5) {
        // Poor historical performance
        params.timeoutMs = params.timeoutMs + 2000;
        params.batchSize = Math.max(1, params.batchSize - 1);
      } else if (historicalPerformance.successRate > 0.9) {
        // Excellent historical performance
        params.timeoutMs = Math.max(1000, params.timeoutMs - 1000);
      }
      
      // Use historically optimal parameters if available
      if (historicalPerformance.optimalParameters) {
        params = {
          ...params,
          ...historicalPerformance.optimalParameters
        };
      }
    }
    
    // Ensure parameters are within valid ranges
    params.parallelism = Math.max(this.minParallelism, Math.min(params.parallelism, this.maxParallelism));
    params.batchSize = Math.max(1, params.batchSize);
    params.timeoutMs = Math.max(1000, params.timeoutMs);
    
    return params;
  }
  
  /**
   * Record execution result for performance optimization
   * 
   * @param {Object} data - Execution result data
   */
  async recordExecutionResult(data = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return;
    }
    
    const {
      errorType,
      strategyType,
      executionTime,
      success,
      parameters,
      systemLoad
    } = data;
    
    if (executionTime === undefined) {
      return;
    }
    
    // Add to performance history
    this.performanceHistory.push({
      timestamp: Date.now(),
      errorType: errorType || 'unknown',
      strategyType: strategyType || 'unknown',
      executionTime,
      success: success === true,
      parameters: parameters || {
        parallelism: this.currentParallelism,
        batchSize: this.currentBatchSize,
        timeoutMs: this.currentTimeout
      },
      systemLoad: systemLoad || this._getCurrentSystemLoad()
    });
    
    // Limit history size
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
  }
  
  /**
   * Get current optimization status
   * 
   * @returns {Object} Optimization status
   */
  async getOptimizationStatus() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return {
      enabled: this.enabled,
      currentParameters: {
        parallelism: this.currentParallelism,
        batchSize: this.currentBatchSize,
        timeoutMs: this.currentTimeout
      },
      systemLoad: this._getCurrentSystemLoad(),
      optimizationHistory: this.optimizationHistory.slice(-5),
      timestamp: Date.now()
    };
  }
  
  /**
   * Handle system load update event
   * 
   * @param {Object} data - System load data
   * @private
   */
  _handleSystemLoadUpdate(data) {
    if (!data || data.load === undefined) {
      return;
    }
    
    // Add to system load history
    this.systemLoadHistory.push({
      timestamp: Date.now(),
      load: data.load,
      memory: data.memory,
      cpu: data.cpu
    });
    
    // Limit history size
    if (this.systemLoadHistory.length > 20) {
      this.systemLoadHistory.shift();
    }
  }
  
  /**
   * Handle execution completed event
   * 
   * @param {Object} data - Execution data
   * @private
   */
  _handleExecutionCompleted(data) {
    this.recordExecutionResult({
      ...data,
      success: true
    });
  }
  
  /**
   * Handle execution failed event
   * 
   * @param {Object} data - Execution data
   * @private
   */
  _handleExecutionFailed(data) {
    this.recordExecutionResult({
      ...data,
      success: false
    });
  }
  
  /**
   * Adapt parameters based on performance history
   * @private
   */
  _adaptParameters() {
    if (!this.enabled || this.isOptimizing || this.performanceHistory.length < 5) {
      return;
    }
    
    this.isOptimizing = true;
    
    try {
      // Calculate performance metrics
      const recentHistory = this.performanceHistory.slice(-20);
      const successRate = recentHistory.filter(h => h.success).length / recentHistory.length;
      const avgExecutionTime = recentHistory.reduce((sum, h) => sum + h.executionTime, 0) / recentHistory.length;
      
      // Get current system load
      const currentLoad = this._getCurrentSystemLoad();
      
      // Previous parameters
      const previousParams = {
        parallelism: this.currentParallelism,
        batchSize: this.currentBatchSize,
        timeoutMs: this.currentTimeout
      };
      
      // Determine if optimization is needed
      let optimizationNeeded = false;
      let optimizationReason = '';
      
      if (successRate < 0.7) {
        optimizationNeeded = true;
        optimizationReason = 'low_success_rate';
      } else if (avgExecutionTime > this.currentTimeout * 0.8) {
        optimizationNeeded = true;
        optimizationReason = 'high_execution_time';
      } else if (currentLoad > 0.85) {
        optimizationNeeded = true;
        optimizationReason = 'high_system_load';
      }
      
      // Perform optimization if needed
      if (optimizationNeeded) {
        // Adjust parameters based on reason
        if (optimizationReason === 'low_success_rate') {
          // Reduce parallelism and increase timeout for better success rate
          this.currentParallelism = Math.max(this.minParallelism, this.currentParallelism - 1);
          this.currentTimeout = this.currentTimeout + 2000;
        } else if (optimizationReason === 'high_execution_time') {
          // Increase timeout and reduce batch size
          this.currentTimeout = this.currentTimeout + 3000;
          this.currentBatchSize = Math.max(1, this.currentBatchSize - 1);
        } else if (optimizationReason === 'high_system_load') {
          // Reduce parallelism and batch size to lower system load
          this.currentParallelism = Math.max(this.minParallelism, this.currentParallelism - 1);
          this.currentBatchSize = Math.max(1, this.currentBatchSize - 1);
        }
        
        // Record optimization
        this.optimizationHistory.push({
          timestamp: Date.now(),
          reason: optimizationReason,
          previousParams,
          newParams: {
            parallelism: this.currentParallelism,
            batchSize: this.currentBatchSize,
            timeoutMs: this.currentTimeout
          },
          metrics: {
            successRate,
            avgExecutionTime,
            systemLoad: currentLoad
          }
        });
        
        // Limit history size
        if (this.optimizationHistory.length > 20) {
          this.optimizationHistory.shift();
        }
        
        // Emit optimization event if event bus is available
        if (this.eventBus) {
          this.eventBus.emit('performance:parameters:updated', {
            previousParams,
            newParams: {
              parallelism: this.currentParallelism,
              batchSize: this.currentBatchSize,
              timeoutMs: this.currentTimeout
            },
            reason: optimizationReason
          });
        }
      }
    } catch (error) {
      console.warn('Error during parameter adaptation:', error.message);
    } finally {
      this.isOptimizing = false;
    }
  }
  
  /**
   * Get current system load
   * 
   * @returns {number} System load (0-1)
   * @private
   */
  _getCurrentSystemLoad() {
    if (this.systemLoadHistory.length === 0) {
      return 0.5; // Default to medium load if no history
    }
    
    // Calculate average load from recent history
    const recentHistory = this.systemLoadHistory.slice(-5);
    return recentHistory.reduce((sum, h) => sum + h.load, 0) / recentHistory.length;
  }
  
  /**
   * Get historical performance for a specific error type
   * 
   * @param {string} errorType - Error type
   * @returns {Object} Historical performance data
   * @private
   */
  _getHistoricalPerformance(errorType) {
    if (!errorType || this.performanceHistory.length === 0) {
      return null;
    }
    
    // Filter history by error type
    const typeHistory = this.performanceHistory.filter(h => h.errorType === errorType);
    if (typeHistory.length === 0) {
      return null;
    }
    
    // Calculate success rate
    const successRate = typeHistory.filter(h => h.success).length / typeHistory.length;
    
    // Calculate average execution time
    const avgExecutionTime = typeHistory.reduce((sum, h) => sum + h.executionTime, 0) / typeHistory.length;
    
    // Find optimal parameters (from most successful executions)
    const successfulExecutions = typeHistory.filter(h => h.success);
    let optimalParameters = null;
    
    if (successfulExecutions.length > 0) {
      // Group by parameter combinations
      const paramGroups = {};
      
      for (const execution of successfulExecutions) {
        const params = execution.parameters;
        if (!params) continue;
        
        const key = `${params.parallelism}_${params.batchSize}_${params.timeoutMs}`;
        
        if (!paramGroups[key]) {
          paramGroups[key] = {
            count: 0,
            totalTime: 0,
            params
          };
        }
        
        paramGroups[key].count++;
        paramGroups[key].totalTime += execution.executionTime;
      }
      
      // Find parameter group with best combination of success count and speed
      let bestScore = -1;
      let bestGroup = null;
      
      for (const key in paramGroups) {
        const group = paramGroups[key];
        const avgTime = group.totalTime / group.count;
        const score = group.count / avgTime; // Higher count and lower time is better
        
        if (score > bestScore) {
          bestScore = score;
          bestGroup = group;
        }
      }
      
      if (bestGroup) {
        optimalParameters = bestGroup.params;
      }
    }
    
    return {
      errorType,
      executionCount: typeHistory.length,
      successCount: successfulExecutions.length,
      successRate,
      avgExecutionTime,
      optimalParameters
    };
  }
  
  /**
   * Get default parameters
   * 
   * @returns {Object} Default parameters
   * @private
   */
  _getDefaultParameters() {
    return {
      parallelism: this.config.initialParallelism || 2,
      batchSize: this.config.initialBatchSize || 5,
      timeoutMs: this.config.initialTimeoutMs || 5000
    };
  }
  
  /**
   * Dispose resources used by this optimizer
   */
  async dispose() {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
    
    if (this.eventBus) {
      this.eventBus.removeAllListeners('system:load:updated');
      this.eventBus.removeAllListeners('strategy:execution:completed');
      this.eventBus.removeAllListeners('strategy:execution:failed');
    }
    
    this.performanceHistory = [];
    this.systemLoadHistory = [];
    this.optimizationHistory = [];
    this.isOptimizing = false;
  }
}

module.exports = AdaptivePerformanceOptimizer;
