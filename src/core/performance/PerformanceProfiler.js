/**
 * @fileoverview Performance Profiler for Aideon system
 * Provides comprehensive profiling capabilities for measuring and analyzing performance
 * across all components and tentacles of the Aideon system.
 */

const fs = require('fs');
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');
const os = require('os');

/**
 * Class representing the Performance Profiler for the Aideon system
 */
class PerformanceProfiler {
  /**
   * Create a new PerformanceProfiler instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.enableDetailedProfiling - Whether to enable detailed profiling (default: false)
   * @param {boolean} options.enableMemoryProfiling - Whether to enable memory profiling (default: true)
   * @param {boolean} options.enableCPUProfiling - Whether to enable CPU profiling (default: true)
   * @param {boolean} options.enableIOProfiling - Whether to enable I/O profiling (default: true)
   * @param {boolean} options.enableNetworkProfiling - Whether to enable network profiling (default: true)
   * @param {boolean} options.enableModelProfiling - Whether to enable model profiling (default: true)
   * @param {string} options.outputDirectory - Directory to store profiling data (default: './performance_data')
   * @param {number} options.samplingInterval - Sampling interval in milliseconds (default: 1000)
   * @param {number} options.retentionPeriod - Data retention period in days (default: 7)
   */
  constructor(options = {}) {
    this.options = {
      enableDetailedProfiling: options.enableDetailedProfiling || false,
      enableMemoryProfiling: options.enableMemoryProfiling !== false,
      enableCPUProfiling: options.enableCPUProfiling !== false,
      enableIOProfiling: options.enableIOProfiling !== false,
      enableNetworkProfiling: options.enableNetworkProfiling !== false,
      enableModelProfiling: options.enableModelProfiling !== false,
      outputDirectory: options.outputDirectory || './performance_data',
      samplingInterval: options.samplingInterval || 1000,
      retentionPeriod: options.retentionPeriod || 7
    };

    this.metrics = {
      marks: new Map(),
      measures: new Map(),
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      traces: new Map()
    };

    this.activeMeasurements = new Map();
    this.activeTraces = new Map();
    this.observers = new Map();
    this.samplingTimers = new Map();
    
    this.isRunning = false;
    this.startTime = null;
    
    this._setupOutputDirectory();
    this._setupPerformanceObservers();
  }

  /**
   * Initialize and start the profiler
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      console.warn('Performance Profiler is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = performance.now();
    
    console.log('Starting Performance Profiler...');
    
    // Start sampling timers for continuous metrics
    if (this.options.enableMemoryProfiling) {
      this._startMemorySampling();
    }
    
    if (this.options.enableCPUProfiling) {
      this._startCPUSampling();
    }
    
    if (this.options.enableIOProfiling) {
      this._startIOSampling();
    }
    
    // Enable observers
    this.observers.forEach(observer => observer.observe({ entryTypes: ['mark', 'measure'] }));
    
    // Create initial system snapshot
    await this._createSystemSnapshot();
    
    console.log('Performance Profiler started successfully');
  }

  /**
   * Stop the profiler and save collected data
   * @returns {Promise<Object>} Summary of collected metrics
   */
  async stop() {
    if (!this.isRunning) {
      console.warn('Performance Profiler is not running');
      return null;
    }

    console.log('Stopping Performance Profiler...');
    
    // Stop all sampling timers
    this.samplingTimers.forEach(timer => clearInterval(timer));
    this.samplingTimers.clear();
    
    // Disable observers
    this.observers.forEach(observer => observer.disconnect());
    
    // Create final system snapshot
    const finalSnapshot = await this._createSystemSnapshot('final');
    
    // Calculate runtime
    const runtime = performance.now() - this.startTime;
    
    // Save all collected metrics
    await this._saveMetrics();
    
    this.isRunning = false;
    
    // Generate summary
    const summary = this._generateSummary(runtime, finalSnapshot);
    console.log('Performance Profiler stopped successfully');
    
    return summary;
  }

  /**
   * Mark a specific point in code execution
   * @param {string} name - Name of the mark
   * @param {Object} [tags] - Additional tags for the mark
   * @returns {number} Timestamp of the mark
   */
  mark(name, tags = {}) {
    const timestamp = performance.now();
    const markData = {
      name,
      timestamp,
      tags,
      relativeTime: timestamp - this.startTime
    };
    
    this.metrics.marks.set(`${name}_${timestamp}`, markData);
    performance.mark(name);
    
    return timestamp;
  }

  /**
   * Start measuring a specific operation
   * @param {string} name - Name of the measurement
   * @param {Object} [tags] - Additional tags for the measurement
   * @returns {string} Unique ID for the measurement
   */
  startMeasure(name, tags = {}) {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    this.activeMeasurements.set(id, {
      name,
      startTime,
      tags
    });
    
    performance.mark(`${name}_start_${id}`);
    return id;
  }

  /**
   * End a specific measurement
   * @param {string} id - ID of the measurement to end
   * @returns {Object|null} Measurement data or null if measurement not found
   */
  endMeasure(id) {
    if (!this.activeMeasurements.has(id)) {
      console.warn(`No active measurement found with ID: ${id}`);
      return null;
    }
    
    const measurement = this.activeMeasurements.get(id);
    const endTime = performance.now();
    const duration = endTime - measurement.startTime;
    
    const measureData = {
      name: measurement.name,
      startTime: measurement.startTime,
      endTime,
      duration,
      tags: measurement.tags,
      relativeStartTime: measurement.startTime - this.startTime,
      relativeEndTime: endTime - this.startTime
    };
    
    this.metrics.measures.set(id, measureData);
    this.activeMeasurements.delete(id);
    
    performance.mark(`${measurement.name}_end_${id}`);
    performance.measure(
      measurement.name,
      `${measurement.name}_start_${id}`,
      `${measurement.name}_end_${id}`
    );
    
    return measureData;
  }

  /**
   * Measure the execution time of an async function
   * @param {string} name - Name of the measurement
   * @param {Function} fn - Async function to measure
   * @param {Object} [tags] - Additional tags for the measurement
   * @returns {Promise<any>} Result of the function execution
   */
  async measureAsync(name, fn, tags = {}) {
    const id = this.startMeasure(name, tags);
    try {
      const result = await fn();
      this.endMeasure(id);
      return result;
    } catch (error) {
      this.endMeasure(id);
      throw error;
    }
  }

  /**
   * Measure the execution time of a synchronous function
   * @param {string} name - Name of the measurement
   * @param {Function} fn - Function to measure
   * @param {Object} [tags] - Additional tags for the measurement
   * @returns {any} Result of the function execution
   */
  measureSync(name, fn, tags = {}) {
    const id = this.startMeasure(name, tags);
    try {
      const result = fn();
      this.endMeasure(id);
      return result;
    } catch (error) {
      this.endMeasure(id);
      throw error;
    }
  }

  /**
   * Increment a counter
   * @param {string} name - Name of the counter
   * @param {number} [value=1] - Value to increment by
   * @param {Object} [tags] - Additional tags for the counter
   * @returns {number} New counter value
   */
  incrementCounter(name, value = 1, tags = {}) {
    const currentValue = this.metrics.counters.has(name) 
      ? this.metrics.counters.get(name).value 
      : 0;
    
    const newValue = currentValue + value;
    
    this.metrics.counters.set(name, {
      name,
      value: newValue,
      timestamp: performance.now(),
      tags
    });
    
    return newValue;
  }

  /**
   * Set a gauge value
   * @param {string} name - Name of the gauge
   * @param {number} value - Value to set
   * @param {Object} [tags] - Additional tags for the gauge
   * @returns {number} Set value
   */
  setGauge(name, value, tags = {}) {
    this.metrics.gauges.set(name, {
      name,
      value,
      timestamp: performance.now(),
      tags
    });
    
    return value;
  }

  /**
   * Record a value in a histogram
   * @param {string} name - Name of the histogram
   * @param {number} value - Value to record
   * @param {Object} [tags] - Additional tags for the histogram
   */
  recordHistogram(name, value, tags = {}) {
    if (!this.metrics.histograms.has(name)) {
      this.metrics.histograms.set(name, {
        name,
        values: [],
        min: value,
        max: value,
        sum: 0,
        count: 0,
        tags
      });
    }
    
    const histogram = this.metrics.histograms.get(name);
    histogram.values.push(value);
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);
    histogram.sum += value;
    histogram.count += 1;
  }

  /**
   * Start a trace for detailed operation tracking
   * @param {string} name - Name of the trace
   * @param {Object} [tags] - Additional tags for the trace
   * @returns {string} Unique ID for the trace
   */
  startTrace(name, tags = {}) {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    this.activeTraces.set(id, {
      name,
      startTime,
      tags,
      events: [],
      currentSpans: new Map()
    });
    
    return id;
  }

  /**
   * Add an event to an active trace
   * @param {string} traceId - ID of the trace
   * @param {string} name - Name of the event
   * @param {Object} [data] - Additional data for the event
   * @returns {boolean} Whether the event was added successfully
   */
  addTraceEvent(traceId, name, data = {}) {
    if (!this.activeTraces.has(traceId)) {
      console.warn(`No active trace found with ID: ${traceId}`);
      return false;
    }
    
    const trace = this.activeTraces.get(traceId);
    trace.events.push({
      name,
      timestamp: performance.now(),
      relativeTime: performance.now() - trace.startTime,
      data
    });
    
    return true;
  }

  /**
   * Start a span within a trace
   * @param {string} traceId - ID of the trace
   * @param {string} name - Name of the span
   * @param {Object} [tags] - Additional tags for the span
   * @returns {string} Unique ID for the span
   */
  startTraceSpan(traceId, name, tags = {}) {
    if (!this.activeTraces.has(traceId)) {
      console.warn(`No active trace found with ID: ${traceId}`);
      return null;
    }
    
    const trace = this.activeTraces.get(traceId);
    const spanId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    trace.currentSpans.set(spanId, {
      name,
      startTime,
      tags
    });
    
    return spanId;
  }

  /**
   * End a span within a trace
   * @param {string} traceId - ID of the trace
   * @param {string} spanId - ID of the span
   * @returns {boolean} Whether the span was ended successfully
   */
  endTraceSpan(traceId, spanId) {
    if (!this.activeTraces.has(traceId)) {
      console.warn(`No active trace found with ID: ${traceId}`);
      return false;
    }
    
    const trace = this.activeTraces.get(traceId);
    
    if (!trace.currentSpans.has(spanId)) {
      console.warn(`No active span found with ID: ${spanId} in trace: ${traceId}`);
      return false;
    }
    
    const span = trace.currentSpans.get(spanId);
    const endTime = performance.now();
    const duration = endTime - span.startTime;
    
    trace.events.push({
      type: 'span',
      name: span.name,
      startTime: span.startTime,
      endTime,
      duration,
      relativeStartTime: span.startTime - trace.startTime,
      relativeEndTime: endTime - trace.startTime,
      tags: span.tags
    });
    
    trace.currentSpans.delete(spanId);
    return true;
  }

  /**
   * End a trace and save its data
   * @param {string} traceId - ID of the trace to end
   * @returns {Object|null} Trace data or null if trace not found
   */
  endTrace(traceId) {
    if (!this.activeTraces.has(traceId)) {
      console.warn(`No active trace found with ID: ${traceId}`);
      return null;
    }
    
    const trace = this.activeTraces.get(traceId);
    const endTime = performance.now();
    const duration = endTime - trace.startTime;
    
    // End any remaining spans
    trace.currentSpans.forEach((span, spanId) => {
      this.endTraceSpan(traceId, spanId);
    });
    
    const traceData = {
      name: trace.name,
      startTime: trace.startTime,
      endTime,
      duration,
      events: trace.events,
      tags: trace.tags,
      relativeStartTime: trace.startTime - this.startTime,
      relativeEndTime: endTime - this.startTime
    };
    
    this.metrics.traces.set(traceId, traceData);
    this.activeTraces.delete(traceId);
    
    return traceData;
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return {
      rss: memoryUsage.rss, // Resident Set Size - total memory allocated
      heapTotal: memoryUsage.heapTotal, // V8 heap total
      heapUsed: memoryUsage.heapUsed, // V8 heap used
      external: memoryUsage.external, // Memory used by C++ objects bound to JS
      arrayBuffers: memoryUsage.arrayBuffers || 0, // Memory used by ArrayBuffers and SharedArrayBuffers
      timestamp: performance.now()
    };
  }

  /**
   * Get current CPU usage statistics
   * @returns {Object} CPU usage statistics
   */
  getCPUUsage() {
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();
    
    return {
      system: cpuUsage.system,
      user: cpuUsage.user,
      cores: cpus.length,
      load: os.loadavg(),
      timestamp: performance.now()
    };
  }

  /**
   * Get a summary of all collected metrics
   * @returns {Object} Summary of collected metrics
   */
  getSummary() {
    if (!this.isRunning && !this.startTime) {
      console.warn('Performance Profiler has not been started yet');
      return null;
    }
    
    const runtime = this.isRunning ? performance.now() - this.startTime : 0;
    return this._generateSummary(runtime);
  }

  /**
   * Export all collected metrics to a file
   * @param {string} [format='json'] - Export format ('json' or 'csv')
   * @returns {Promise<string>} Path to the exported file
   */
  async exportMetrics(format = 'json') {
    const exportPath = path.join(
      this.options.outputDirectory,
      `metrics_export_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`
    );
    
    if (format === 'json') {
      const metricsData = {
        marks: Array.from(this.metrics.marks.values()),
        measures: Array.from(this.metrics.measures.values()),
        counters: Array.from(this.metrics.counters.values()),
        gauges: Array.from(this.metrics.gauges.values()),
        histograms: Array.from(this.metrics.histograms.values()),
        traces: Array.from(this.metrics.traces.values())
      };
      
      await fs.promises.writeFile(exportPath, JSON.stringify(metricsData, null, 2));
    } else if (format === 'csv') {
      // Implement CSV export if needed
      throw new Error('CSV export not implemented yet');
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
    
    return exportPath;
  }

  /**
   * Setup the output directory for storing profiling data
   * @private
   */
  _setupOutputDirectory() {
    if (!fs.existsSync(this.options.outputDirectory)) {
      fs.mkdirSync(this.options.outputDirectory, { recursive: true });
    }
  }

  /**
   * Setup performance observers
   * @private
   */
  _setupPerformanceObservers() {
    const markObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        // Process mark entries if needed
      });
    });
    
    const measureObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        // Process measure entries if needed
      });
    });
    
    this.observers.set('mark', markObserver);
    this.observers.set('measure', measureObserver);
  }

  /**
   * Start memory usage sampling
   * @private
   */
  _startMemorySampling() {
    const timer = setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      this.setGauge('memory.rss', memoryUsage.rss, { type: 'memory' });
      this.setGauge('memory.heapTotal', memoryUsage.heapTotal, { type: 'memory' });
      this.setGauge('memory.heapUsed', memoryUsage.heapUsed, { type: 'memory' });
      this.setGauge('memory.external', memoryUsage.external, { type: 'memory' });
      this.setGauge('memory.arrayBuffers', memoryUsage.arrayBuffers, { type: 'memory' });
    }, this.options.samplingInterval);
    
    this.samplingTimers.set('memory', timer);
  }

  /**
   * Start CPU usage sampling
   * @private
   */
  _startCPUSampling() {
    const timer = setInterval(() => {
      const cpuUsage = this.getCPUUsage();
      this.setGauge('cpu.system', cpuUsage.system, { type: 'cpu' });
      this.setGauge('cpu.user', cpuUsage.user, { type: 'cpu' });
      this.setGauge('cpu.load.1m', cpuUsage.load[0], { type: 'cpu' });
      this.setGauge('cpu.load.5m', cpuUsage.load[1], { type: 'cpu' });
      this.setGauge('cpu.load.15m', cpuUsage.load[2], { type: 'cpu' });
    }, this.options.samplingInterval);
    
    this.samplingTimers.set('cpu', timer);
  }

  /**
   * Start I/O usage sampling
   * @private
   */
  _startIOSampling() {
    // This would require additional libraries or native modules to track I/O
    // For now, we'll just set up the timer structure
    const timer = setInterval(() => {
      // Sample I/O metrics when implemented
    }, this.options.samplingInterval);
    
    this.samplingTimers.set('io', timer);
  }

  /**
   * Create a system snapshot with current metrics
   * @param {string} [label='initial'] - Label for the snapshot
   * @returns {Promise<Object>} System snapshot data
   * @private
   */
  async _createSystemSnapshot(label = 'initial') {
    const snapshot = {
      label,
      timestamp: performance.now(),
      memory: this.getMemoryUsage(),
      cpu: this.getCPUUsage(),
      counters: {},
      gauges: {}
    };
    
    // Add current counter values
    this.metrics.counters.forEach((counter, name) => {
      snapshot.counters[name] = counter.value;
    });
    
    // Add current gauge values
    this.metrics.gauges.forEach((gauge, name) => {
      snapshot.gauges[name] = gauge.value;
    });
    
    // Save snapshot to file
    const snapshotPath = path.join(
      this.options.outputDirectory,
      `snapshot_${label}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    
    return snapshot;
  }

  /**
   * Save all collected metrics to files
   * @returns {Promise<void>}
   * @private
   */
  async _saveMetrics() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save marks
    if (this.metrics.marks.size > 0) {
      const marksPath = path.join(this.options.outputDirectory, `marks_${timestamp}.json`);
      await fs.promises.writeFile(
        marksPath,
        JSON.stringify(Array.from(this.metrics.marks.values()), null, 2)
      );
    }
    
    // Save measures
    if (this.metrics.measures.size > 0) {
      const measuresPath = path.join(this.options.outputDirectory, `measures_${timestamp}.json`);
      await fs.promises.writeFile(
        measuresPath,
        JSON.stringify(Array.from(this.metrics.measures.values()), null, 2)
      );
    }
    
    // Save counters
    if (this.metrics.counters.size > 0) {
      const countersPath = path.join(this.options.outputDirectory, `counters_${timestamp}.json`);
      await fs.promises.writeFile(
        countersPath,
        JSON.stringify(Array.from(this.metrics.counters.values()), null, 2)
      );
    }
    
    // Save gauges
    if (this.metrics.gauges.size > 0) {
      const gaugesPath = path.join(this.options.outputDirectory, `gauges_${timestamp}.json`);
      await fs.promises.writeFile(
        gaugesPath,
        JSON.stringify(Array.from(this.metrics.gauges.values()), null, 2)
      );
    }
    
    // Save histograms
    if (this.metrics.histograms.size > 0) {
      const histogramsPath = path.join(this.options.outputDirectory, `histograms_${timestamp}.json`);
      await fs.promises.writeFile(
        histogramsPath,
        JSON.stringify(Array.from(this.metrics.histograms.values()), null, 2)
      );
    }
    
    // Save traces
    if (this.metrics.traces.size > 0) {
      const tracesPath = path.join(this.options.outputDirectory, `traces_${timestamp}.json`);
      await fs.promises.writeFile(
        tracesPath,
        JSON.stringify(Array.from(this.metrics.traces.values()), null, 2)
      );
    }
  }

  /**
   * Generate a summary of collected metrics
   * @param {number} runtime - Total runtime in milliseconds
   * @param {Object} [finalSnapshot] - Final system snapshot
   * @returns {Object} Summary of collected metrics
   * @private
   */
  _generateSummary(runtime, finalSnapshot = null) {
    return {
      runtime,
      marks: this.metrics.marks.size,
      measures: this.metrics.measures.size,
      counters: this.metrics.counters.size,
      gauges: this.metrics.gauges.size,
      histograms: this.metrics.histograms.size,
      traces: this.metrics.traces.size,
      memory: finalSnapshot ? finalSnapshot.memory : this.getMemoryUsage(),
      cpu: finalSnapshot ? finalSnapshot.cpu : this.getCPUUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean up old profiling data based on retention period
   * @returns {Promise<void>}
   */
  async cleanupOldData() {
    const files = await fs.promises.readdir(this.options.outputDirectory);
    const now = Date.now();
    const retentionMs = this.options.retentionPeriod * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(this.options.outputDirectory, file);
      const stats = await fs.promises.stat(filePath);
      
      if (now - stats.mtime.getTime() > retentionMs) {
        await fs.promises.unlink(filePath);
      }
    }
  }
}

module.exports = PerformanceProfiler;
