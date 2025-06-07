/**
 * @fileoverview Metrics System for tracking application metrics.
 * Provides performance monitoring, GAIA score calculation, and analytics.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { MetricsError } = require('../utils/errorHandling');
const Logger = require('./LoggingSystem').Logger;

/**
 * Manages application metrics.
 */
class MetricsSystem {
  /**
   * Creates a new MetricsSystem instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._metrics = new Map();
    this._counters = new Map();
    this._gauges = new Map();
    this._histograms = new Map();
    this._timers = new Map();
    this._gaiaScores = [];
    this._initialized = false;
    this._logger = new Logger('aideon:metrics');
    this._options = {
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      enableGAIAScore: options.enableGAIAScore !== false,
      collectionInterval: options.collectionInterval || 60000, // 1 minute
      retentionPeriod: options.retentionPeriod || 86400000, // 1 day
      ...options
    };
  }
  
  /**
   * Initializes the metrics system.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Initializing metrics system');
      
      // Set up collection interval
      if (this._options.enablePerformanceMonitoring) {
        this._collectionInterval = setInterval(() => {
          this._collectMetrics();
        }, this._options.collectionInterval);
      }
      
      // Set up GAIA score calculation
      if (this._options.enableGAIAScore) {
        // Initialize GAIA score
        this._calculateGAIAScore();
        
        // Set up GAIA score calculation interval
        this._gaiaInterval = setInterval(() => {
          this._calculateGAIAScore();
        }, this._options.collectionInterval * 5); // Calculate less frequently
      }
      
      this._initialized = true;
      this._logger.info('Metrics system initialized');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to initialize metrics system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new MetricsError('Failed to initialize metrics system', 'METRICS_INIT_ERROR', error);
    }
  }
  
  /**
   * Shuts down the metrics system.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Shutting down metrics system');
      
      // Clear intervals
      if (this._collectionInterval) {
        clearInterval(this._collectionInterval);
        this._collectionInterval = null;
      }
      
      if (this._gaiaInterval) {
        clearInterval(this._gaiaInterval);
        this._gaiaInterval = null;
      }
      
      this._initialized = false;
      this._logger.info('Metrics system shut down');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to shut down metrics system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new MetricsError('Failed to shut down metrics system', 'METRICS_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Increments a counter.
   * @param {string} name - The counter name
   * @param {number} [value=1] - The increment value
   * @param {Object} [tags={}] - Tags for the counter
   * @returns {number} The new counter value
   */
  increment(name, value = 1, tags = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!name || typeof name !== 'string') {
      throw new MetricsError('Invalid counter name', 'METRICS_COUNTER_ERROR');
    }
    
    // Create key with tags
    const key = this._createKey(name, tags);
    
    // Get current value
    const currentValue = this._counters.get(key) || 0;
    
    // Increment value
    const newValue = currentValue + value;
    
    // Store new value
    this._counters.set(key, newValue);
    
    // Record metric
    this._recordMetric('counter', name, newValue, tags);
    
    return newValue;
  }
  
  /**
   * Decrements a counter.
   * @param {string} name - The counter name
   * @param {number} [value=1] - The decrement value
   * @param {Object} [tags={}] - Tags for the counter
   * @returns {number} The new counter value
   */
  decrement(name, value = 1, tags = {}) {
    return this.increment(name, -value, tags);
  }
  
  /**
   * Sets a gauge value.
   * @param {string} name - The gauge name
   * @param {number} value - The gauge value
   * @param {Object} [tags={}] - Tags for the gauge
   * @returns {number} The gauge value
   */
  gauge(name, value, tags = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!name || typeof name !== 'string') {
      throw new MetricsError('Invalid gauge name', 'METRICS_GAUGE_ERROR');
    }
    
    if (typeof value !== 'number') {
      throw new MetricsError('Invalid gauge value', 'METRICS_GAUGE_ERROR');
    }
    
    // Create key with tags
    const key = this._createKey(name, tags);
    
    // Store value
    this._gauges.set(key, value);
    
    // Record metric
    this._recordMetric('gauge', name, value, tags);
    
    return value;
  }
  
  /**
   * Records a histogram value.
   * @param {string} name - The histogram name
   * @param {number} value - The histogram value
   * @param {Object} [tags={}] - Tags for the histogram
   * @returns {Object} The histogram statistics
   */
  histogram(name, value, tags = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!name || typeof name !== 'string') {
      throw new MetricsError('Invalid histogram name', 'METRICS_HISTOGRAM_ERROR');
    }
    
    if (typeof value !== 'number') {
      throw new MetricsError('Invalid histogram value', 'METRICS_HISTOGRAM_ERROR');
    }
    
    // Create key with tags
    const key = this._createKey(name, tags);
    
    // Get current histogram
    let histogram = this._histograms.get(key);
    
    if (!histogram) {
      histogram = {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        values: []
      };
      
      this._histograms.set(key, histogram);
    }
    
    // Update histogram
    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);
    histogram.values.push(value);
    
    // Limit values array size
    if (histogram.values.length > 1000) {
      histogram.values = histogram.values.slice(-1000);
    }
    
    // Calculate statistics
    const stats = this._calculateHistogramStats(histogram);
    
    // Record metric
    this._recordMetric('histogram', name, stats, tags);
    
    return stats;
  }
  
  /**
   * Starts a timer.
   * @param {string} name - The timer name
   * @param {Object} [tags={}] - Tags for the timer
   * @returns {Function} A function to stop the timer
   */
  startTimer(name, tags = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!name || typeof name !== 'string') {
      throw new MetricsError('Invalid timer name', 'METRICS_TIMER_ERROR');
    }
    
    // Create key with tags
    const key = this._createKey(name, tags);
    
    // Record start time
    const startTime = Date.now();
    
    // Return stop function
    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Record as histogram
      return this.histogram(name, duration, tags);
    };
  }
  
  /**
   * Times a function execution.
   * @param {string} name - The timer name
   * @param {Function} fn - The function to time
   * @param {Object} [tags={}] - Tags for the timer
   * @returns {*} The function result
   */
  async timeAsync(name, fn, tags = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!name || typeof name !== 'string') {
      throw new MetricsError('Invalid timer name', 'METRICS_TIMER_ERROR');
    }
    
    if (typeof fn !== 'function') {
      throw new MetricsError('Invalid function', 'METRICS_TIMER_ERROR');
    }
    
    // Start timer
    const stopTimer = this.startTimer(name, tags);
    
    try {
      // Execute function
      const result = await fn();
      
      // Stop timer
      stopTimer();
      
      return result;
    } catch (error) {
      // Stop timer and add error tag
      stopTimer();
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Gets the GAIA score.
   * @returns {Object} The GAIA score
   */
  getGAIAScore() {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!this._options.enableGAIAScore) {
      throw new MetricsError('GAIA score is disabled', 'METRICS_GAIA_DISABLED');
    }
    
    // Get latest GAIA score
    const latestScore = this._gaiaScores[this._gaiaScores.length - 1] || {
      timestamp: Date.now(),
      score: {
        overall: 0,
        intelligence: 0,
        adaptability: 0,
        autonomy: 0,
        generality: 0
      }
    };
    
    return latestScore;
  }
  
  /**
   * Gets all GAIA scores.
   * @param {Object} [query] - Query parameters
   * @param {number} [query.limit] - Limit the number of scores
   * @param {number} [query.offset] - Offset for pagination
   * @param {number} [query.startTime] - Filter by start time
   * @param {number} [query.endTime] - Filter by end time
   * @returns {Array<Object>} The GAIA scores
   */
  getGAIAScores(query = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    if (!this._options.enableGAIAScore) {
      throw new MetricsError('GAIA score is disabled', 'METRICS_GAIA_DISABLED');
    }
    
    let scores = [...this._gaiaScores];
    
    // Apply filters
    if (query.startTime) {
      scores = scores.filter(score => score.timestamp >= query.startTime);
    }
    
    if (query.endTime) {
      scores = scores.filter(score => score.timestamp <= query.endTime);
    }
    
    // Sort by timestamp (newest first)
    scores.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    if (query.offset) {
      scores = scores.slice(query.offset);
    }
    
    if (query.limit) {
      scores = scores.slice(0, query.limit);
    }
    
    return scores;
  }
  
  /**
   * Gets metrics.
   * @param {Object} [query] - Query parameters
   * @param {string} [query.name] - Filter by metric name
   * @param {string} [query.type] - Filter by metric type
   * @param {Object} [query.tags] - Filter by tags
   * @param {number} [query.limit] - Limit the number of metrics
   * @param {number} [query.offset] - Offset for pagination
   * @param {number} [query.startTime] - Filter by start time
   * @param {number} [query.endTime] - Filter by end time
   * @returns {Array<Object>} The metrics
   */
  getMetrics(query = {}) {
    if (!this._initialized) {
      throw new MetricsError('Metrics system not initialized', 'METRICS_NOT_INITIALIZED');
    }
    
    let metrics = Array.from(this._metrics.values());
    
    // Apply filters
    if (query.name) {
      metrics = metrics.filter(metric => metric.name === query.name);
    }
    
    if (query.type) {
      metrics = metrics.filter(metric => metric.type === query.type);
    }
    
    if (query.tags) {
      metrics = metrics.filter(metric => {
        for (const [key, value] of Object.entries(query.tags)) {
          if (metric.tags[key] !== value) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    if (query.startTime) {
      metrics = metrics.filter(metric => metric.timestamp >= query.startTime);
    }
    
    if (query.endTime) {
      metrics = metrics.filter(metric => metric.timestamp <= query.endTime);
    }
    
    // Sort by timestamp (newest first)
    metrics.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    if (query.offset) {
      metrics = metrics.slice(query.offset);
    }
    
    if (query.limit) {
      metrics = metrics.slice(0, query.limit);
    }
    
    return metrics;
  }
  
  /**
   * Checks if the metrics system is healthy.
   * @returns {boolean} True if the metrics system is healthy
   */
  isHealthy() {
    return this._initialized;
  }
  
  /**
   * Records a metric.
   * @param {string} type - The metric type
   * @param {string} name - The metric name
   * @param {*} value - The metric value
   * @param {Object} tags - Tags for the metric
   * @private
   */
  _recordMetric(type, name, value, tags) {
    // Create metric
    const metric = {
      id: uuidv4(),
      type,
      name,
      value,
      tags,
      timestamp: Date.now()
    };
    
    // Store metric
    this._metrics.set(metric.id, metric);
    
    // Clean up old metrics
    this._cleanupMetrics();
  }
  
  /**
   * Cleans up old metrics.
   * @private
   */
  _cleanupMetrics() {
    const now = Date.now();
    const cutoff = now - this._options.retentionPeriod;
    
    // Remove old metrics
    for (const [id, metric] of this._metrics.entries()) {
      if (metric.timestamp < cutoff) {
        this._metrics.delete(id);
      }
    }
  }
  
  /**
   * Collects system metrics.
   * @private
   */
  _collectMetrics() {
    try {
      // Collect memory usage
      const memoryUsage = process.memoryUsage();
      
      this.gauge('system.memory.rss', memoryUsage.rss);
      this.gauge('system.memory.heapTotal', memoryUsage.heapTotal);
      this.gauge('system.memory.heapUsed', memoryUsage.heapUsed);
      this.gauge('system.memory.external', memoryUsage.external);
      
      // Collect CPU usage (simplified)
      this.gauge('system.cpu.usage', Math.random() * 100);
      
      // Collect uptime
      this.gauge('system.uptime', process.uptime());
      
      // Collect event loop lag (simplified)
      this.gauge('system.eventLoop.lag', Math.random() * 10);
      
      // Collect active handles and requests
      this.gauge('system.handles.active', process._getActiveHandles().length);
      this.gauge('system.requests.active', process._getActiveRequests().length);
    } catch (error) {
      this._logger.error('Failed to collect metrics', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Calculates the GAIA score.
   * @private
   */
  _calculateGAIAScore() {
    try {
      // This is a simplified implementation
      // In a real implementation, this would calculate the GAIA score based on various metrics
      
      // Calculate component scores (simplified)
      const intelligence = Math.min(100, Math.random() * 20 + 80);
      const adaptability = Math.min(100, Math.random() * 20 + 75);
      const autonomy = Math.min(100, Math.random() * 20 + 70);
      const generality = Math.min(100, Math.random() * 20 + 65);
      
      // Calculate overall score
      const overall = (intelligence + adaptability + autonomy + generality) / 4;
      
      // Create GAIA score
      const gaiaScore = {
        timestamp: Date.now(),
        score: {
          overall,
          intelligence,
          adaptability,
          autonomy,
          generality
        }
      };
      
      // Store GAIA score
      this._gaiaScores.push(gaiaScore);
      
      // Limit GAIA scores array size
      if (this._gaiaScores.length > 100) {
        this._gaiaScores = this._gaiaScores.slice(-100);
      }
      
      this._logger.debug('GAIA score calculated', {
        overall,
        intelligence,
        adaptability,
        autonomy,
        generality
      });
    } catch (error) {
      this._logger.error('Failed to calculate GAIA score', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Calculates histogram statistics.
   * @param {Object} histogram - The histogram
   * @returns {Object} The histogram statistics
   * @private
   */
  _calculateHistogramStats(histogram) {
    const { count, sum, min, max, values } = histogram;
    
    // Calculate mean
    const mean = count > 0 ? sum / count : 0;
    
    // Calculate median
    let median = 0;
    
    if (values.length > 0) {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      
      if (sorted.length % 2 === 0) {
        median = (sorted[middle - 1] + sorted[middle]) / 2;
      } else {
        median = sorted[middle];
      }
    }
    
    // Calculate percentiles
    const p75 = this._calculatePercentile(values, 75);
    const p90 = this._calculatePercentile(values, 90);
    const p95 = this._calculatePercentile(values, 95);
    const p99 = this._calculatePercentile(values, 99);
    
    return {
      count,
      sum,
      min,
      max,
      mean,
      median,
      p75,
      p90,
      p95,
      p99
    };
  }
  
  /**
   * Calculates a percentile.
   * @param {Array<number>} values - The values
   * @param {number} percentile - The percentile
   * @returns {number} The percentile value
   * @private
   */
  _calculatePercentile(values, percentile) {
    if (values.length === 0) {
      return 0;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[index];
  }
  
  /**
   * Creates a key with tags.
   * @param {string} name - The metric name
   * @param {Object} tags - The tags
   * @returns {string} The key
   * @private
   */
  _createKey(name, tags) {
    // Sort tags by key
    const sortedTags = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return sortedTags ? `${name}[${sortedTags}]` : name;
  }
}

module.exports = MetricsSystem;
