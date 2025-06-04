/**
 * MetricsCollector.js
 * 
 * A comprehensive metrics collection system for the Autonomous Error Recovery System.
 * Tracks performance, success rates, and resource usage across all components.
 */

const { v4: uuidv4 } = require('uuid');

class MetricsCollector {
  /**
   * Creates a new MetricsCollector instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus instance
   * @param {Object} options.logger - Logger instance
   * @param {number} options.flushInterval - Interval in ms to flush metrics to storage
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.logger = options.logger || console;
    this.flushInterval = options.flushInterval || 60000; // Default: 1 minute
    
    // Metrics storage
    this.counters = new Map();
    this.gauges = new Map();
    this.timings = new Map();
    this.successRates = new Map();
    
    // Metrics metadata
    this.metricsMetadata = new Map();
    
    // Start flush interval
    this.flushIntervalId = setInterval(() => this.flush(), this.flushInterval);
    
    // Register event listeners if event bus is provided
    if (this.eventBus) {
      this.registerEventListeners();
    }
    
    this.logger.info('MetricsCollector initialized');
  }
  
  /**
   * Registers event listeners with the event bus
   * 
   * @private
   */
  registerEventListeners() {
    // Register for system events to automatically collect metrics
    this.eventBus.on('error:detected', this.handleErrorDetected.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('analysis:started', this.handleAnalysisStarted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('analysis:completed', this.handleAnalysisCompleted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('strategy:generation:started', this.handleStrategyGenerationStarted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('strategy:generation:completed', this.handleStrategyGenerationCompleted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('validation:started', this.handleValidationStarted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('validation:completed', this.handleValidationCompleted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('execution:started', this.handleExecutionStarted.bind(this), { component: 'MetricsCollector' });
    this.eventBus.on('execution:completed', this.handleExecutionCompleted.bind(this), { component: 'MetricsCollector' });
    
    this.logger.debug('Metrics event listeners registered');
  }
  
  /**
   * Handles error detection events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleErrorDetected(data) {
    this.incrementCounter('errors_detected');
    
    // Track error types if available
    if (data.error && data.error.name) {
      this.incrementCounter(`error_type.${data.error.name}`);
    }
  }
  
  /**
   * Handles analysis started events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleAnalysisStarted(data) {
    this.incrementCounter('analysis_started');
    
    // Store start time for duration calculation
    if (data.analysisId) {
      this.setGauge(`analysis_start_time.${data.analysisId}`, Date.now());
    }
  }
  
  /**
   * Handles analysis completed events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleAnalysisCompleted(data) {
    this.incrementCounter('analysis_completed');
    
    // Calculate and record duration if we have start time
    if (data.analysisId) {
      const startTime = this.getGauge(`analysis_start_time.${data.analysisId}`);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.recordTiming('analysis_duration', duration);
        
        // Clean up start time
        this.removeGauge(`analysis_start_time.${data.analysisId}`);
      }
    }
    
    // Record success
    this.recordSuccess('analysis', data.success === true);
  }
  
  /**
   * Handles strategy generation started events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleStrategyGenerationStarted(data) {
    this.incrementCounter('strategy_generation_started');
    
    // Store start time for duration calculation
    if (data.generationId) {
      this.setGauge(`strategy_generation_start_time.${data.generationId}`, Date.now());
    }
  }
  
  /**
   * Handles strategy generation completed events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleStrategyGenerationCompleted(data) {
    this.incrementCounter('strategy_generation_completed');
    
    // Calculate and record duration if we have start time
    if (data.generationId) {
      const startTime = this.getGauge(`strategy_generation_start_time.${data.generationId}`);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.recordTiming('strategy_generation_duration', duration);
        
        // Clean up start time
        this.removeGauge(`strategy_generation_start_time.${data.generationId}`);
      }
    }
    
    // Record success
    this.recordSuccess('strategy_generation', data.success === true);
    
    // Track strategy complexity if available
    if (data.strategy && data.strategy.actions) {
      this.setGauge('strategy_action_count', data.strategy.actions.length);
    }
  }
  
  /**
   * Handles validation started events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleValidationStarted(data) {
    this.incrementCounter('validation_started');
    
    // Store start time for duration calculation
    if (data.validationId) {
      this.setGauge(`validation_start_time.${data.validationId}`, Date.now());
    }
  }
  
  /**
   * Handles validation completed events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleValidationCompleted(data) {
    this.incrementCounter('validation_completed');
    
    // Calculate and record duration if we have start time
    if (data.validationId) {
      const startTime = this.getGauge(`validation_start_time.${data.validationId}`);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.recordTiming('validation_duration', duration);
        
        // Clean up start time
        this.removeGauge(`validation_start_time.${data.validationId}`);
      }
    }
    
    // Record success
    this.recordSuccess('validation', data.isValid === true);
  }
  
  /**
   * Handles execution started events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleExecutionStarted(data) {
    this.incrementCounter('execution_started');
    
    // Store start time for duration calculation
    if (data.executionId) {
      this.setGauge(`execution_start_time.${data.executionId}`, Date.now());
    }
  }
  
  /**
   * Handles execution completed events
   * 
   * @param {Object} data - Event data
   * @private
   */
  handleExecutionCompleted(data) {
    this.incrementCounter('execution_completed');
    
    // Calculate and record duration if we have start time
    if (data.executionId) {
      const startTime = this.getGauge(`execution_start_time.${data.executionId}`);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.recordTiming('execution_duration', duration);
        
        // Clean up start time
        this.removeGauge(`execution_start_time.${data.executionId}`);
      }
    }
    
    // Record success
    this.recordSuccess('execution', data.success === true);
  }
  
  /**
   * Increments a counter metric
   * 
   * @param {string} name - Metric name
   * @param {number} value - Value to increment by (default: 1)
   * @param {Object} tags - Optional tags for the metric
   * @returns {number} - New counter value
   */
  incrementCounter(name, value = 1, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    const metricKey = this.getMetricKey(name, tags);
    const currentValue = this.counters.get(metricKey) || 0;
    const newValue = currentValue + value;
    
    this.counters.set(metricKey, newValue);
    
    // Register metadata if not already registered
    if (!this.metricsMetadata.has(metricKey)) {
      this.metricsMetadata.set(metricKey, {
        name,
        type: 'counter',
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      const metadata = this.metricsMetadata.get(metricKey);
      metadata.updatedAt = Date.now();
    }
    
    this.logger.debug(`Incremented counter ${name} by ${value} to ${newValue}`);
    
    return newValue;
  }
  
  /**
   * Sets a gauge metric
   * 
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   * @param {Object} tags - Optional tags for the metric
   * @returns {number} - Gauge value
   */
  setGauge(name, value, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    if (typeof value !== 'number') {
      throw new Error(`Invalid gauge value for ${name}: ${value}`);
    }
    
    const metricKey = this.getMetricKey(name, tags);
    
    this.gauges.set(metricKey, value);
    
    // Register metadata if not already registered
    if (!this.metricsMetadata.has(metricKey)) {
      this.metricsMetadata.set(metricKey, {
        name,
        type: 'gauge',
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      const metadata = this.metricsMetadata.get(metricKey);
      metadata.updatedAt = Date.now();
    }
    
    this.logger.debug(`Set gauge ${name} to ${value}`);
    
    return value;
  }
  
  /**
   * Gets a gauge metric value
   * 
   * @param {string} name - Metric name
   * @param {Object} tags - Optional tags for the metric
   * @returns {number|null} - Gauge value or null if not found
   */
  getGauge(name, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    const metricKey = this.getMetricKey(name, tags);
    return this.gauges.get(metricKey) || null;
  }
  
  /**
   * Removes a gauge metric
   * 
   * @param {string} name - Metric name
   * @param {Object} tags - Optional tags for the metric
   * @returns {boolean} - Whether the gauge was removed
   */
  removeGauge(name, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    const metricKey = this.getMetricKey(name, tags);
    const result = this.gauges.delete(metricKey);
    
    if (result) {
      this.logger.debug(`Removed gauge ${name}`);
    }
    
    return result;
  }
  
  /**
   * Records a timing metric
   * 
   * @param {string} name - Metric name
   * @param {number} value - Timing value in milliseconds
   * @param {Object} tags - Optional tags for the metric
   */
  recordTiming(name, value, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    if (typeof value !== 'number' || value < 0) {
      throw new Error(`Invalid timing value for ${name}: ${value}`);
    }
    
    const metricKey = this.getMetricKey(name, tags);
    
    if (!this.timings.has(metricKey)) {
      this.timings.set(metricKey, {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        values: []
      });
    }
    
    const timing = this.timings.get(metricKey);
    timing.count++;
    timing.sum += value;
    timing.min = Math.min(timing.min, value);
    timing.max = Math.max(timing.max, value);
    timing.values.push(value);
    
    // Keep only the last 100 values to avoid memory issues
    if (timing.values.length > 100) {
      timing.values.shift();
    }
    
    // Register metadata if not already registered
    if (!this.metricsMetadata.has(metricKey)) {
      this.metricsMetadata.set(metricKey, {
        name,
        type: 'timing',
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      const metadata = this.metricsMetadata.get(metricKey);
      metadata.updatedAt = Date.now();
    }
    
    this.logger.debug(`Recorded timing ${name}: ${value}ms`);
  }
  
  /**
   * Records a success/failure metric
   * 
   * @param {string} name - Metric name
   * @param {boolean} success - Whether the operation was successful
   * @param {Object} tags - Optional tags for the metric
   */
  recordSuccess(name, success, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    if (typeof success !== 'boolean') {
      throw new Error(`Invalid success value for ${name}: ${success}`);
    }
    
    const metricKey = this.getMetricKey(name, tags);
    
    if (!this.successRates.has(metricKey)) {
      this.successRates.set(metricKey, {
        total: 0,
        successes: 0,
        failures: 0
      });
    }
    
    const rate = this.successRates.get(metricKey);
    rate.total++;
    
    if (success) {
      rate.successes++;
    } else {
      rate.failures++;
    }
    
    // Register metadata if not already registered
    if (!this.metricsMetadata.has(metricKey)) {
      this.metricsMetadata.set(metricKey, {
        name,
        type: 'success_rate',
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      const metadata = this.metricsMetadata.get(metricKey);
      metadata.updatedAt = Date.now();
    }
    
    this.logger.debug(`Recorded ${success ? 'success' : 'failure'} for ${name}`);
  }
  
  /**
   * Gets a unique key for a metric based on name and tags
   * 
   * @param {string} name - Metric name
   * @param {Object} tags - Metric tags
   * @returns {string} - Unique metric key
   * @private
   */
  getMetricKey(name, tags = {}) {
    if (Object.keys(tags).length === 0) {
      return name;
    }
    
    const tagString = Object.entries(tags)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${name}[${tagString}]`;
  }
  
  /**
   * Gets all metrics
   * 
   * @returns {Object} - All metrics
   */
  getAllMetrics() {
    const metrics = {
      counters: {},
      gauges: {},
      timings: {},
      successRates: {}
    };
    
    // Convert counters
    for (const [key, value] of this.counters.entries()) {
      metrics.counters[key] = value;
    }
    
    // Convert gauges
    for (const [key, value] of this.gauges.entries()) {
      metrics.gauges[key] = value;
    }
    
    // Convert timings
    for (const [key, timing] of this.timings.entries()) {
      metrics.timings[key] = {
        count: timing.count,
        sum: timing.sum,
        min: timing.min === Infinity ? 0 : timing.min,
        max: timing.max === -Infinity ? 0 : timing.max,
        avg: timing.count > 0 ? timing.sum / timing.count : 0
      };
    }
    
    // Convert success rates
    for (const [key, rate] of this.successRates.entries()) {
      metrics.successRates[key] = {
        total: rate.total,
        successes: rate.successes,
        failures: rate.failures,
        rate: rate.total > 0 ? rate.successes / rate.total : 0
      };
    }
    
    return metrics;
  }
  
  /**
   * Gets metrics by type
   * 
   * @param {string} type - Metric type (counter, gauge, timing, success_rate)
   * @returns {Object} - Metrics of the specified type
   */
  getMetricsByType(type) {
    switch (type) {
      case 'counter':
        return Object.fromEntries(this.counters.entries());
      case 'gauge':
        return Object.fromEntries(this.gauges.entries());
      case 'timing':
        return Object.fromEntries(Array.from(this.timings.entries()).map(([key, timing]) => [
          key,
          {
            count: timing.count,
            sum: timing.sum,
            min: timing.min === Infinity ? 0 : timing.min,
            max: timing.max === -Infinity ? 0 : timing.max,
            avg: timing.count > 0 ? timing.sum / timing.count : 0
          }
        ]));
      case 'success_rate':
        return Object.fromEntries(Array.from(this.successRates.entries()).map(([key, rate]) => [
          key,
          {
            total: rate.total,
            successes: rate.successes,
            failures: rate.failures,
            rate: rate.total > 0 ? rate.successes / rate.total : 0
          }
        ]));
      default:
        throw new Error(`Unknown metric type: ${type}`);
    }
  }
  
  /**
   * Gets a specific metric
   * 
   * @param {string} name - Metric name
   * @param {Object} tags - Optional tags for the metric
   * @returns {Object|null} - Metric value or null if not found
   */
  getMetric(name, tags = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Metric name must be a non-empty string');
    }
    
    const metricKey = this.getMetricKey(name, tags);
    const metadata = this.metricsMetadata.get(metricKey);
    
    if (!metadata) {
      return null;
    }
    
    switch (metadata.type) {
      case 'counter':
        return {
          type: 'counter',
          value: this.counters.get(metricKey) || 0
        };
      case 'gauge':
        return {
          type: 'gauge',
          value: this.gauges.get(metricKey) || 0
        };
      case 'timing': {
        const timing = this.timings.get(metricKey) || { count: 0, sum: 0, min: 0, max: 0, values: [] };
        return {
          type: 'timing',
          count: timing.count,
          sum: timing.sum,
          min: timing.min === Infinity ? 0 : timing.min,
          max: timing.max === -Infinity ? 0 : timing.max,
          avg: timing.count > 0 ? timing.sum / timing.count : 0,
          values: [...timing.values]
        };
      }
      case 'success_rate': {
        const rate = this.successRates.get(metricKey) || { total: 0, successes: 0, failures: 0 };
        return {
          type: 'success_rate',
          total: rate.total,
          successes: rate.successes,
          failures: rate.failures,
          rate: rate.total > 0 ? rate.successes / rate.total : 0
        };
      }
      default:
        return null;
    }
  }
  
  /**
   * Flushes metrics to storage
   * 
   * @returns {Promise<void>}
   */
  async flush() {
    try {
      this.logger.debug('Flushing metrics to storage');
      
      // In a real implementation, this would persist metrics to a database or file
      // For now, we'll just log the metrics
      const metrics = this.getAllMetrics();
      
      // Calculate overall success rate
      const validationRate = metrics.successRates['validation'] || { rate: 0 };
      this.logger.info(`Current validation success rate: ${(validationRate.rate * 100).toFixed(2)}%`);
      
      // Emit metrics event if event bus is available
      if (this.eventBus) {
        this.eventBus.emit('metrics:flushed', { 
          timestamp: Date.now(),
          metrics
        });
      }
      
      this.logger.debug('Metrics flushed successfully');
    } catch (error) {
      this.logger.error(`Error flushing metrics: ${error.message}`, error);
    }
  }
  
  /**
   * Resets all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.timings.clear();
    this.successRates.clear();
    this.metricsMetadata.clear();
    
    this.logger.info('All metrics reset');
    
    if (this.eventBus) {
      this.eventBus.emit('metrics:reset', { timestamp: Date.now() });
    }
  }
  
  /**
   * Sets the logger instance
   * 
   * @param {Object} logger - Logger instance with debug, info, warn, error methods
   * @returns {MetricsCollector} - This instance for chaining
   */
  setLogger(logger) {
    if (!logger || typeof logger !== 'object') {
      throw new Error('Invalid logger: must be an object');
    }
    
    if (!logger.debug || !logger.info || !logger.warn || !logger.error) {
      throw new Error('Invalid logger: must have debug, info, warn, error methods');
    }
    
    this.logger = logger;
    return this;
  }
  
  /**
   * Sets the event bus instance
   * 
   * @param {Object} eventBus - Event bus instance
   * @returns {MetricsCollector} - This instance for chaining
   */
  setEventBus(eventBus) {
    if (!eventBus || typeof eventBus !== 'object') {
      throw new Error('Invalid event bus: must be an object');
    }
    
    if (!eventBus.on || !eventBus.emit) {
      throw new Error('Invalid event bus: must have on and emit methods');
    }
    
    this.eventBus = eventBus;
    
    // Register event listeners
    this.registerEventListeners();
    
    return this;
  }
  
  /**
   * Disposes of the metrics collector
   */
  dispose() {
    // Clear flush interval
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    
    // Flush metrics one last time
    this.flush().catch(error => {
      this.logger.error(`Error flushing metrics during disposal: ${error.message}`, error);
    });
    
    this.logger.info('MetricsCollector disposed');
  }
}

module.exports = MetricsCollector;
