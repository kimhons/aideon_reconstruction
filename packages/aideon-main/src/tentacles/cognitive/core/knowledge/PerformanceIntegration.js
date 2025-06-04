/**
 * @fileoverview PerformanceIntegration for the Knowledge Graph Manager.
 * Provides performance monitoring, optimization, and adaptive behavior
 * for knowledge graph operations.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');

/**
 * Performance optimization strategies.
 * @enum {string}
 */
const OptimizationStrategy = {
  /**
   * Prioritize response time over resource usage.
   */
  RESPONSE_TIME: 'response_time',
  
  /**
   * Prioritize memory efficiency over response time.
   */
  MEMORY_EFFICIENCY: 'memory_efficiency',
  
  /**
   * Prioritize CPU efficiency over response time.
   */
  CPU_EFFICIENCY: 'cpu_efficiency',
  
  /**
   * Prioritize storage efficiency over response time.
   */
  STORAGE_EFFICIENCY: 'storage_efficiency',
  
  /**
   * Balanced optimization across all resources.
   */
  BALANCED: 'balanced'
};

/**
 * Resource usage levels.
 * @enum {string}
 */
const ResourceUsageLevel = {
  /**
   * Low resource usage.
   */
  LOW: 'low',
  
  /**
   * Medium resource usage.
   */
  MEDIUM: 'medium',
  
  /**
   * High resource usage.
   */
  HIGH: 'high',
  
  /**
   * Critical resource usage.
   */
  CRITICAL: 'critical'
};

/**
 * Provides performance monitoring and optimization for knowledge graph operations.
 */
class PerformanceIntegration extends EventEmitter {
  /**
   * Creates a new PerformanceIntegration instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} options.performanceMonitor - Performance monitor
   */
  constructor(options = {}) {
    super();
    
    if (!options.performanceMonitor) {
      throw new Error('PerformanceIntegration requires a performanceMonitor instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    
    this.initialized = false;
    this.metrics = new Map();
    this.thresholds = new Map();
    this.optimizationStrategies = new Map();
  }
  
  /**
   * Initializes the performance integration.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing PerformanceIntegration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('performanceIntegration_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.performance', {
          enableAdaptiveOptimization: true,
          defaultStrategy: OptimizationStrategy.BALANCED,
          metricCollectionInterval: 60000, // 1 minute
          thresholds: {
            responseTime: {
              [ResourceUsageLevel.LOW]: 100, // ms
              [ResourceUsageLevel.MEDIUM]: 500, // ms
              [ResourceUsageLevel.HIGH]: 2000, // ms
              [ResourceUsageLevel.CRITICAL]: 5000 // ms
            },
            memoryUsage: {
              [ResourceUsageLevel.LOW]: 100 * 1024 * 1024, // 100 MB
              [ResourceUsageLevel.MEDIUM]: 500 * 1024 * 1024, // 500 MB
              [ResourceUsageLevel.HIGH]: 1024 * 1024 * 1024, // 1 GB
              [ResourceUsageLevel.CRITICAL]: 2 * 1024 * 1024 * 1024 // 2 GB
            },
            cpuUsage: {
              [ResourceUsageLevel.LOW]: 20, // percent
              [ResourceUsageLevel.MEDIUM]: 50, // percent
              [ResourceUsageLevel.HIGH]: 80, // percent
              [ResourceUsageLevel.CRITICAL]: 95 // percent
            },
            storageUsage: {
              [ResourceUsageLevel.LOW]: 1024 * 1024 * 1024, // 1 GB
              [ResourceUsageLevel.MEDIUM]: 10 * 1024 * 1024 * 1024, // 10 GB
              [ResourceUsageLevel.HIGH]: 50 * 1024 * 1024 * 1024, // 50 GB
              [ResourceUsageLevel.CRITICAL]: 100 * 1024 * 1024 * 1024 // 100 GB
            }
          }
        });
        
        this.config = config;
      } else {
        this.config = {
          enableAdaptiveOptimization: true,
          defaultStrategy: OptimizationStrategy.BALANCED,
          metricCollectionInterval: 60000, // 1 minute
          thresholds: {
            responseTime: {
              [ResourceUsageLevel.LOW]: 100, // ms
              [ResourceUsageLevel.MEDIUM]: 500, // ms
              [ResourceUsageLevel.HIGH]: 2000, // ms
              [ResourceUsageLevel.CRITICAL]: 5000 // ms
            },
            memoryUsage: {
              [ResourceUsageLevel.LOW]: 100 * 1024 * 1024, // 100 MB
              [ResourceUsageLevel.MEDIUM]: 500 * 1024 * 1024, // 500 MB
              [ResourceUsageLevel.HIGH]: 1024 * 1024 * 1024, // 1 GB
              [ResourceUsageLevel.CRITICAL]: 2 * 1024 * 1024 * 1024 // 2 GB
            },
            cpuUsage: {
              [ResourceUsageLevel.LOW]: 20, // percent
              [ResourceUsageLevel.MEDIUM]: 50, // percent
              [ResourceUsageLevel.HIGH]: 80, // percent
              [ResourceUsageLevel.CRITICAL]: 95 // percent
            },
            storageUsage: {
              [ResourceUsageLevel.LOW]: 1024 * 1024 * 1024, // 1 GB
              [ResourceUsageLevel.MEDIUM]: 10 * 1024 * 1024 * 1024, // 10 GB
              [ResourceUsageLevel.HIGH]: 50 * 1024 * 1024 * 1024, // 50 GB
              [ResourceUsageLevel.CRITICAL]: 100 * 1024 * 1024 * 1024 // 100 GB
            }
          }
        };
      }
      
      // Initialize thresholds
      for (const [metricName, levels] of Object.entries(this.config.thresholds)) {
        this.thresholds.set(metricName, new Map(Object.entries(levels)));
      }
      
      // Set up metric collection
      if (this.config.enableAdaptiveOptimization) {
        this.startMetricCollection();
      }
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('PerformanceIntegration initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('PerformanceIntegration initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`PerformanceIntegration initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Starts periodic metric collection.
   * 
   * @private
   */
  startMetricCollection() {
    this.metricCollectionInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        if (this.logger) {
          this.logger.error('Failed to collect metrics', { error: error.message });
        }
      });
    }, this.config.metricCollectionInterval);
  }
  
  /**
   * Collects performance metrics.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async collectMetrics() {
    try {
      // Collect metrics from performance monitor
      const metrics = await this.performanceMonitor.getMetrics();
      
      // Update metrics map
      for (const [key, value] of Object.entries(metrics)) {
        this.metrics.set(key, value);
      }
      
      // Analyze metrics and adjust optimization strategies
      this.analyzeMetricsAndAdjust();
      
      // Emit metrics event
      this.emit('metricsCollected', metrics);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to collect metrics', { error: error.message, stack: error.stack });
      }
      throw error;
    }
  }
  
  /**
   * Analyzes metrics and adjusts optimization strategies.
   * 
   * @private
   */
  analyzeMetricsAndAdjust() {
    if (!this.config.enableAdaptiveOptimization) {
      return;
    }
    
    try {
      // Determine resource usage levels
      const responseTimeLevel = this.getResourceUsageLevel('responseTime', this.metrics.get('averageResponseTime'));
      const memoryUsageLevel = this.getResourceUsageLevel('memoryUsage', this.metrics.get('memoryUsage'));
      const cpuUsageLevel = this.getResourceUsageLevel('cpuUsage', this.metrics.get('cpuUsage'));
      const storageUsageLevel = this.getResourceUsageLevel('storageUsage', this.metrics.get('storageUsage'));
      
      // Determine critical resources
      const criticalResources = [];
      
      if (responseTimeLevel === ResourceUsageLevel.CRITICAL) {
        criticalResources.push('responseTime');
      }
      
      if (memoryUsageLevel === ResourceUsageLevel.CRITICAL) {
        criticalResources.push('memoryUsage');
      }
      
      if (cpuUsageLevel === ResourceUsageLevel.CRITICAL) {
        criticalResources.push('cpuUsage');
      }
      
      if (storageUsageLevel === ResourceUsageLevel.CRITICAL) {
        criticalResources.push('storageUsage');
      }
      
      // Determine high usage resources
      const highResources = [];
      
      if (responseTimeLevel === ResourceUsageLevel.HIGH) {
        highResources.push('responseTime');
      }
      
      if (memoryUsageLevel === ResourceUsageLevel.HIGH) {
        highResources.push('memoryUsage');
      }
      
      if (cpuUsageLevel === ResourceUsageLevel.HIGH) {
        highResources.push('cpuUsage');
      }
      
      if (storageUsageLevel === ResourceUsageLevel.HIGH) {
        highResources.push('storageUsage');
      }
      
      // Adjust optimization strategy based on resource usage
      let globalStrategy = this.config.defaultStrategy;
      
      if (criticalResources.length > 0) {
        // Prioritize the most critical resource
        if (criticalResources.includes('memoryUsage')) {
          globalStrategy = OptimizationStrategy.MEMORY_EFFICIENCY;
        } else if (criticalResources.includes('cpuUsage')) {
          globalStrategy = OptimizationStrategy.CPU_EFFICIENCY;
        } else if (criticalResources.includes('storageUsage')) {
          globalStrategy = OptimizationStrategy.STORAGE_EFFICIENCY;
        }
      } else if (highResources.length > 0) {
        // Consider high usage resources
        if (highResources.includes('memoryUsage')) {
          globalStrategy = OptimizationStrategy.MEMORY_EFFICIENCY;
        } else if (highResources.includes('cpuUsage')) {
          globalStrategy = OptimizationStrategy.CPU_EFFICIENCY;
        } else if (highResources.includes('storageUsage')) {
          globalStrategy = OptimizationStrategy.STORAGE_EFFICIENCY;
        }
      } else if (responseTimeLevel === ResourceUsageLevel.LOW && 
                 memoryUsageLevel === ResourceUsageLevel.LOW && 
                 cpuUsageLevel === ResourceUsageLevel.LOW && 
                 storageUsageLevel === ResourceUsageLevel.LOW) {
        // All resources are low, prioritize response time
        globalStrategy = OptimizationStrategy.RESPONSE_TIME;
      }
      
      // Set global optimization strategy
      this.setGlobalOptimizationStrategy(globalStrategy);
      
      if (this.logger) {
        this.logger.debug('Adjusted optimization strategy', {
          strategy: globalStrategy,
          responseTimeLevel,
          memoryUsageLevel,
          cpuUsageLevel,
          storageUsageLevel
        });
      }
      
      // Emit strategy change event
      this.emit('optimizationStrategyChanged', globalStrategy);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to analyze metrics and adjust strategies', { error: error.message, stack: error.stack });
      }
    }
  }
  
  /**
   * Gets the resource usage level for a metric.
   * 
   * @private
   * @param {string} metricName - Name of the metric
   * @param {number} value - Metric value
   * @returns {ResourceUsageLevel} - Resource usage level
   */
  getResourceUsageLevel(metricName, value) {
    if (value === undefined || value === null) {
      return ResourceUsageLevel.LOW;
    }
    
    const thresholds = this.thresholds.get(metricName);
    
    if (!thresholds) {
      return ResourceUsageLevel.LOW;
    }
    
    if (value >= thresholds.get(ResourceUsageLevel.CRITICAL)) {
      return ResourceUsageLevel.CRITICAL;
    } else if (value >= thresholds.get(ResourceUsageLevel.HIGH)) {
      return ResourceUsageLevel.HIGH;
    } else if (value >= thresholds.get(ResourceUsageLevel.MEDIUM)) {
      return ResourceUsageLevel.MEDIUM;
    } else {
      return ResourceUsageLevel.LOW;
    }
  }
  
  /**
   * Sets the global optimization strategy.
   * 
   * @private
   * @param {OptimizationStrategy} strategy - Optimization strategy
   */
  setGlobalOptimizationStrategy(strategy) {
    this.globalStrategy = strategy;
  }
  
  /**
   * Gets the optimization strategy for an operation.
   * 
   * @param {string} operationName - Name of the operation
   * @returns {OptimizationStrategy} - Optimization strategy
   */
  getOptimizationStrategy(operationName) {
    this.ensureInitialized();
    
    // Check for operation-specific strategy
    if (this.optimizationStrategies.has(operationName)) {
      return this.optimizationStrategies.get(operationName);
    }
    
    // Return global strategy
    return this.globalStrategy || this.config.defaultStrategy;
  }
  
  /**
   * Sets the optimization strategy for an operation.
   * 
   * @param {string} operationName - Name of the operation
   * @param {OptimizationStrategy} strategy - Optimization strategy
   */
  setOptimizationStrategy(operationName, strategy) {
    this.ensureInitialized();
    
    if (!Object.values(OptimizationStrategy).includes(strategy)) {
      throw new Error(`Invalid optimization strategy: ${strategy}`);
    }
    
    this.optimizationStrategies.set(operationName, strategy);
    
    if (this.logger) {
      this.logger.debug(`Set optimization strategy for ${operationName}`, { strategy });
    }
  }
  
  /**
   * Gets optimization parameters for an operation.
   * 
   * @param {string} operationName - Name of the operation
   * @returns {Object} - Optimization parameters
   */
  getOptimizationParameters(operationName) {
    this.ensureInitialized();
    
    const strategy = this.getOptimizationStrategy(operationName);
    
    // Define parameters based on strategy
    switch (strategy) {
      case OptimizationStrategy.RESPONSE_TIME:
        return {
          cacheAggressively: true,
          parallelizationFactor: 1.0,
          batchSize: 1000,
          indexingPriority: 'high',
          compressionLevel: 'low'
        };
      
      case OptimizationStrategy.MEMORY_EFFICIENCY:
        return {
          cacheAggressively: false,
          parallelizationFactor: 0.5,
          batchSize: 100,
          indexingPriority: 'low',
          compressionLevel: 'high'
        };
      
      case OptimizationStrategy.CPU_EFFICIENCY:
        return {
          cacheAggressively: true,
          parallelizationFactor: 0.3,
          batchSize: 500,
          indexingPriority: 'medium',
          compressionLevel: 'medium'
        };
      
      case OptimizationStrategy.STORAGE_EFFICIENCY:
        return {
          cacheAggressively: false,
          parallelizationFactor: 0.7,
          batchSize: 200,
          indexingPriority: 'low',
          compressionLevel: 'high'
        };
      
      case OptimizationStrategy.BALANCED:
      default:
        return {
          cacheAggressively: true,
          parallelizationFactor: 0.7,
          batchSize: 500,
          indexingPriority: 'medium',
          compressionLevel: 'medium'
        };
    }
  }
  
  /**
   * Records an operation's performance metrics.
   * 
   * @param {string} operationName - Name of the operation
   * @param {number} duration - Duration in milliseconds
   * @param {Object} [details={}] - Additional details
   */
  recordOperationMetrics(operationName, duration, details = {}) {
    this.ensureInitialized();
    
    try {
      this.performanceMonitor.recordMetric(`knowledge_${operationName}_duration`, duration);
      
      if (details.nodeCount) {
        this.performanceMonitor.recordMetric(`knowledge_${operationName}_node_count`, details.nodeCount);
      }
      
      if (details.edgeCount) {
        this.performanceMonitor.recordMetric(`knowledge_${operationName}_edge_count`, details.edgeCount);
      }
      
      if (details.resultCount) {
        this.performanceMonitor.recordMetric(`knowledge_${operationName}_result_count`, details.resultCount);
      }
      
      if (details.cacheHit !== undefined) {
        this.performanceMonitor.recordMetric(`knowledge_${operationName}_cache_hit`, details.cacheHit ? 1 : 0);
      }
      
      if (details.errorCount) {
        this.performanceMonitor.recordMetric(`knowledge_${operationName}_error_count`, details.errorCount);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to record metrics for ${operationName}`, { error: error.message });
      }
    }
  }
  
  /**
   * Gets performance metrics for knowledge graph operations.
   * 
   * @returns {Promise<Object>} - Performance metrics
   */
  async getKnowledgeGraphMetrics() {
    this.ensureInitialized();
    
    try {
      const metrics = {};
      
      // Get all metrics from performance monitor
      const allMetrics = await this.performanceMonitor.getMetrics();
      
      // Filter knowledge graph metrics
      for (const [key, value] of Object.entries(allMetrics)) {
        if (key.startsWith('knowledge_')) {
          metrics[key] = value;
        }
      }
      
      return metrics;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to get knowledge graph metrics', { error: error.message, stack: error.stack });
      }
      throw error;
    }
  }
  
  /**
   * Optimizes a query based on current performance strategy.
   * 
   * @param {Object} query - Query to optimize
   * @param {string} [operationName='query'] - Name of the operation
   * @returns {Object} - Optimized query
   */
  optimizeQuery(query, operationName = 'query') {
    this.ensureInitialized();
    
    try {
      const strategy = this.getOptimizationStrategy(operationName);
      const params = this.getOptimizationParameters(operationName);
      
      // Clone the query
      const optimizedQuery = JSON.parse(JSON.stringify(query));
      
      // Apply optimizations based on strategy
      switch (strategy) {
        case OptimizationStrategy.RESPONSE_TIME:
          // Prioritize speed
          optimizedQuery.useCache = true;
          optimizedQuery.useIndexes = true;
          optimizedQuery.limit = optimizedQuery.limit || params.batchSize;
          optimizedQuery.timeout = optimizedQuery.timeout || 5000;
          break;
        
        case OptimizationStrategy.MEMORY_EFFICIENCY:
          // Prioritize memory efficiency
          optimizedQuery.useCache = params.cacheAggressively;
          optimizedQuery.useIndexes = true;
          optimizedQuery.limit = Math.min(optimizedQuery.limit || Infinity, params.batchSize);
          optimizedQuery.streamResults = true;
          break;
        
        case OptimizationStrategy.CPU_EFFICIENCY:
          // Prioritize CPU efficiency
          optimizedQuery.useCache = params.cacheAggressively;
          optimizedQuery.useIndexes = true;
          optimizedQuery.parallelism = Math.max(1, Math.floor(params.parallelizationFactor * 4));
          break;
        
        case OptimizationStrategy.STORAGE_EFFICIENCY:
          // Prioritize storage efficiency
          optimizedQuery.useCache = params.cacheAggressively;
          optimizedQuery.useIndexes = false;
          optimizedQuery.compressionLevel = params.compressionLevel;
          break;
        
        case OptimizationStrategy.BALANCED:
        default:
          // Balanced approach
          optimizedQuery.useCache = params.cacheAggressively;
          optimizedQuery.useIndexes = true;
          optimizedQuery.limit = optimizedQuery.limit || params.batchSize;
          optimizedQuery.parallelism = Math.max(1, Math.floor(params.parallelizationFactor * 4));
          break;
      }
      
      return optimizedQuery;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to optimize query for ${operationName}`, { error: error.message, stack: error.stack });
      }
      
      // Return original query on error
      return query;
    }
  }
  
  /**
   * Ensures the integration is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the integration is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('PerformanceIntegration is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Shuts down the performance integration.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down PerformanceIntegration');
    }
    
    // Stop metric collection
    if (this.metricCollectionInterval) {
      clearInterval(this.metricCollectionInterval);
      this.metricCollectionInterval = null;
    }
    
    this.initialized = false;
    
    this.emit('shutdown');
  }
}

module.exports = { PerformanceIntegration, OptimizationStrategy, ResourceUsageLevel };
