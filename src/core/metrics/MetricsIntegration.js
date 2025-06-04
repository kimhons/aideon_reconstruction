/**
 * @fileoverview Integration utilities for the Standardized Metrics Collection system.
 * This module provides integration points between the metrics collection system
 * and other core Aideon components like caching, performance, and error handling.
 * 
 * @module core/metrics/MetricsIntegration
 */

/**
 * Integrates metrics collection with the caching system.
 * @param {Object} metricsCollector - MetricsCollector instance
 * @param {Object} cacheManager - CacheManager instance
 * @returns {Function} - Cleanup function to remove integration
 */
function integrateCachingMetrics(metricsCollector, cacheManager) {
  if (!metricsCollector || !cacheManager) {
    throw new Error('Both metricsCollector and cacheManager are required');
  }
  
  // Define cache-related metrics
  metricsCollector.defineMetric('cache.hit', 'counter', 'Cache hit count');
  metricsCollector.defineMetric('cache.miss', 'counter', 'Cache miss count');
  metricsCollector.defineMetric('cache.eviction', 'counter', 'Cache eviction count');
  metricsCollector.defineMetric('cache.size', 'gauge', 'Current cache size in items');
  metricsCollector.defineMetric('cache.memory_usage', 'gauge', 'Cache memory usage in bytes');
  metricsCollector.defineMetric('cache.operation_time', 'histogram', 'Cache operation time in ms');
  
  // Define cache-related dimensions
  metricsCollector.defineDimension('cache.level', 'Cache level (memory, persistent, distributed)');
  metricsCollector.defineDimension('cache.operation', 'Cache operation type');
  
  // Set up event listeners for cache events
  const cacheHitHandler = (event) => {
    metricsCollector.recordMetric('cache.hit', 1, {
      'cache.level': event.level,
      'cache.operation': 'get'
    });
    
    if (event.operationTime) {
      metricsCollector.recordMetric('cache.operation_time', event.operationTime, {
        'cache.level': event.level,
        'cache.operation': 'get'
      });
    }
  };
  
  const cacheMissHandler = (event) => {
    metricsCollector.recordMetric('cache.miss', 1, {
      'cache.level': event.level,
      'cache.operation': 'get'
    });
  };
  
  const cacheEvictionHandler = (event) => {
    metricsCollector.recordMetric('cache.eviction', 1, {
      'cache.level': event.level
    });
  };
  
  const cacheStatsHandler = (stats) => {
    metricsCollector.recordMetric('cache.size', stats.size, {
      'cache.level': stats.level
    });
    
    metricsCollector.recordMetric('cache.memory_usage', stats.memoryUsage, {
      'cache.level': stats.level
    });
  };
  
  // Register event handlers
  cacheManager.on('hit', cacheHitHandler);
  cacheManager.on('miss', cacheMissHandler);
  cacheManager.on('eviction', cacheEvictionHandler);
  cacheManager.on('stats', cacheStatsHandler);
  
  // Return cleanup function
  return () => {
    cacheManager.off('hit', cacheHitHandler);
    cacheManager.off('miss', cacheMissHandler);
    cacheManager.off('eviction', cacheEvictionHandler);
    cacheManager.off('stats', cacheStatsHandler);
  };
}

/**
 * Integrates metrics collection with the performance profiling system.
 * @param {Object} metricsCollector - MetricsCollector instance
 * @param {Object} performanceProfiler - PerformanceProfiler instance
 * @returns {Function} - Cleanup function to remove integration
 */
function integratePerformanceMetrics(metricsCollector, performanceProfiler) {
  if (!metricsCollector || !performanceProfiler) {
    throw new Error('Both metricsCollector and performanceProfiler are required');
  }
  
  // Define performance-related metrics
  metricsCollector.defineMetric('performance.operation_time', 'histogram', 'Operation execution time in ms');
  metricsCollector.defineMetric('performance.cpu_usage', 'gauge', 'CPU usage during operation');
  metricsCollector.defineMetric('performance.memory_usage', 'gauge', 'Memory usage during operation');
  metricsCollector.defineMetric('performance.throughput', 'gauge', 'Operations per second');
  
  // Define performance-related dimensions
  metricsCollector.defineDimension('performance.component', 'Component being measured');
  metricsCollector.defineDimension('performance.operation', 'Operation being measured');
  metricsCollector.defineDimension('performance.priority', 'Operation priority level');
  
  // Set up event listeners for performance events
  const operationCompleteHandler = (event) => {
    metricsCollector.recordMetric('performance.operation_time', event.duration, {
      'performance.component': event.component,
      'performance.operation': event.operation,
      'performance.priority': event.priority || 'normal'
    });
    
    if (event.cpuUsage !== undefined) {
      metricsCollector.recordMetric('performance.cpu_usage', event.cpuUsage, {
        'performance.component': event.component,
        'performance.operation': event.operation
      });
    }
    
    if (event.memoryUsage !== undefined) {
      metricsCollector.recordMetric('performance.memory_usage', event.memoryUsage, {
        'performance.component': event.component,
        'performance.operation': event.operation
      });
    }
  };
  
  const throughputUpdateHandler = (event) => {
    metricsCollector.recordMetric('performance.throughput', event.throughput, {
      'performance.component': event.component,
      'performance.operation': event.operation
    });
  };
  
  // Register event handlers
  performanceProfiler.on('operation-complete', operationCompleteHandler);
  performanceProfiler.on('throughput-update', throughputUpdateHandler);
  
  // Return cleanup function
  return () => {
    performanceProfiler.off('operation-complete', operationCompleteHandler);
    performanceProfiler.off('throughput-update', throughputUpdateHandler);
  };
}

/**
 * Integrates metrics collection with the error recovery system.
 * @param {Object} metricsCollector - MetricsCollector instance
 * @param {Object} errorRecoveryManager - ErrorRecoveryManager instance
 * @returns {Function} - Cleanup function to remove integration
 */
function integrateErrorMetrics(metricsCollector, errorRecoveryManager) {
  if (!metricsCollector || !errorRecoveryManager) {
    throw new Error('Both metricsCollector and errorRecoveryManager are required');
  }
  
  // Define error-related metrics
  metricsCollector.defineMetric('error.occurrence', 'counter', 'Error occurrence count');
  metricsCollector.defineMetric('error.recovery_attempt', 'counter', 'Recovery attempt count');
  metricsCollector.defineMetric('error.recovery_success', 'counter', 'Successful recovery count');
  metricsCollector.defineMetric('error.recovery_failure', 'counter', 'Failed recovery count');
  metricsCollector.defineMetric('error.recovery_time', 'histogram', 'Recovery time in ms');
  
  // Define error-related dimensions
  metricsCollector.defineDimension('error.type', 'Error type');
  metricsCollector.defineDimension('error.component', 'Component where error occurred');
  metricsCollector.defineDimension('error.severity', 'Error severity level');
  metricsCollector.defineDimension('error.recovery_strategy', 'Recovery strategy used');
  
  // Set up event listeners for error events
  const errorHandler = (event) => {
    metricsCollector.recordMetric('error.occurrence', 1, {
      'error.type': event.type,
      'error.component': event.component,
      'error.severity': event.severity
    });
  };
  
  const recoveryAttemptHandler = (event) => {
    metricsCollector.recordMetric('error.recovery_attempt', 1, {
      'error.type': event.errorType,
      'error.component': event.component,
      'error.recovery_strategy': event.strategy
    });
  };
  
  const recoverySuccessHandler = (event) => {
    metricsCollector.recordMetric('error.recovery_success', 1, {
      'error.type': event.errorType,
      'error.component': event.component,
      'error.recovery_strategy': event.strategy
    });
    
    if (event.duration) {
      metricsCollector.recordMetric('error.recovery_time', event.duration, {
        'error.type': event.errorType,
        'error.component': event.component,
        'error.recovery_strategy': event.strategy
      });
    }
  };
  
  const recoveryFailureHandler = (event) => {
    metricsCollector.recordMetric('error.recovery_failure', 1, {
      'error.type': event.errorType,
      'error.component': event.component,
      'error.recovery_strategy': event.strategy
    });
  };
  
  // Register event handlers
  errorRecoveryManager.events.on('error', errorHandler);
  errorRecoveryManager.events.on('recovery-attempt', recoveryAttemptHandler);
  errorRecoveryManager.events.on('recovery-success', recoverySuccessHandler);
  errorRecoveryManager.events.on('recovery-failure', recoveryFailureHandler);
  
  // Return cleanup function
  return () => {
    errorRecoveryManager.events.off('error', errorHandler);
    errorRecoveryManager.events.off('recovery-attempt', recoveryAttemptHandler);
    errorRecoveryManager.events.off('recovery-success', recoverySuccessHandler);
    errorRecoveryManager.events.off('recovery-failure', recoveryFailureHandler);
  };
}

/**
 * Integrates metrics collection with the configuration system.
 * @param {Object} metricsCollector - MetricsCollector instance
 * @param {Object} configManager - ConfigurationManager instance
 * @returns {Function} - Cleanup function to remove integration
 */
function integrateConfigMetrics(metricsCollector, configManager) {
  if (!metricsCollector || !configManager) {
    throw new Error('Both metricsCollector and configManager are required');
  }
  
  // Define config-related metrics
  metricsCollector.defineMetric('config.change', 'counter', 'Configuration change count');
  metricsCollector.defineMetric('config.load_time', 'histogram', 'Configuration load time in ms');
  metricsCollector.defineMetric('config.validation_failure', 'counter', 'Configuration validation failure count');
  
  // Define config-related dimensions
  metricsCollector.defineDimension('config.namespace', 'Configuration namespace');
  metricsCollector.defineDimension('config.source', 'Configuration source');
  
  // Set up event listeners for config events
  const configChangeHandler = (event) => {
    metricsCollector.recordMetric('config.change', 1, {
      'config.namespace': event.namespace,
      'config.source': event.source || 'unknown'
    });
  };
  
  const configLoadHandler = (event) => {
    if (event.loadTime) {
      metricsCollector.recordMetric('config.load_time', event.loadTime, {
        'config.namespace': event.namespace,
        'config.source': event.source || 'unknown'
      });
    }
  };
  
  const configValidationFailureHandler = (event) => {
    metricsCollector.recordMetric('config.validation_failure', 1, {
      'config.namespace': event.namespace,
      'config.source': event.source || 'unknown'
    });
  };
  
  // Register event handlers
  configManager.on('config-change', configChangeHandler);
  configManager.on('config-load', configLoadHandler);
  configManager.on('validation-failure', configValidationFailureHandler);
  
  // Return cleanup function
  return () => {
    configManager.off('config-change', configChangeHandler);
    configManager.off('config-load', configLoadHandler);
    configManager.off('validation-failure', configValidationFailureHandler);
  };
}

module.exports = {
  integrateCachingMetrics,
  integratePerformanceMetrics,
  integrateErrorMetrics,
  integrateConfigMetrics
};
