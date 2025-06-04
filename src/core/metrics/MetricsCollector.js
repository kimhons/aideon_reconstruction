/**
 * @fileoverview Standardized Metrics Collection system for Aideon.
 * This module provides a centralized system for collecting, processing,
 * and analyzing metrics across all components of the Aideon system.
 * 
 * @module core/metrics/MetricsCollector
 */

const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * MetricsCollector class provides a standardized interface for collecting
 * and processing metrics across the Aideon system.
 */
class MetricsCollector {
  /**
   * Creates a new MetricsCollector instance.
   * @param {Object} options - Configuration options
   * @param {string} options.storageDir - Directory for metrics storage
   * @param {number} options.flushInterval - Interval in ms for flushing metrics to storage
   * @param {number} options.retentionPeriod - Retention period in days for metrics data
   * @param {boolean} options.enableRealTimeAnalysis - Whether to enable real-time analysis
   */
  constructor(options = {}) {
    this.options = {
      storageDir: options.storageDir || path.join(os.homedir(), '.aideon', 'metrics'),
      flushInterval: options.flushInterval || 60000, // Default: 1 minute
      retentionPeriod: options.retentionPeriod || 30, // Default: 30 days
      enableRealTimeAnalysis: options.enableRealTimeAnalysis !== undefined ? 
        options.enableRealTimeAnalysis : true
    };
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.options.storageDir)) {
      fs.mkdirSync(this.options.storageDir, { recursive: true });
    }
    
    // Initialize metrics storage
    this.metricsBuffer = {};
    this.metricDefinitions = {};
    this.dimensionDefinitions = {};
    
    // Set up event emitter for real-time analysis
    this.events = new EventEmitter();
    
    // Set up flush interval
    this.flushIntervalId = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
    
    // Initialize system metrics collection
    this.initializeSystemMetrics();
  }
  
  /**
   * Initializes collection of system-level metrics.
   * @private
   */
  initializeSystemMetrics() {
    // Define system metrics
    this.defineMetric('system.cpu.usage', 'gauge', 'CPU usage percentage', {
      unit: 'percent',
      min: 0,
      max: 100
    });
    
    this.defineMetric('system.memory.usage', 'gauge', 'Memory usage percentage', {
      unit: 'percent',
      min: 0,
      max: 100
    });
    
    this.defineMetric('system.disk.usage', 'gauge', 'Disk usage percentage', {
      unit: 'percent',
      min: 0,
      max: 100
    });
    
    this.defineMetric('system.network.bytesIn', 'counter', 'Network bytes received', {
      unit: 'bytes'
    });
    
    this.defineMetric('system.network.bytesOut', 'counter', 'Network bytes sent', {
      unit: 'bytes'
    });
    
    // Set up system metrics collection interval
    this.systemMetricsIntervalId = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // Collect every 5 seconds
  }
  
  /**
   * Collects current system metrics.
   * @private
   */
  collectSystemMetrics() {
    // CPU usage
    const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
    this.recordMetric('system.cpu.usage', cpuUsage);
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem) * 100;
    this.recordMetric('system.memory.usage', memUsage);
    
    // Disk usage would require additional libraries or shell commands
    // Network metrics would require tracking over time
    
    // For demonstration, we'll use random values for disk and network
    this.recordMetric('system.disk.usage', Math.random() * 80);
    this.recordMetric('system.network.bytesIn', Math.floor(Math.random() * 1000000));
    this.recordMetric('system.network.bytesOut', Math.floor(Math.random() * 1000000));
  }
  
  /**
   * Defines a new metric.
   * @param {string} name - Metric name
   * @param {string} type - Metric type (counter, gauge, histogram, summary)
   * @param {string} description - Metric description
   * @param {Object} options - Additional metric options
   * @param {string} options.unit - Unit of measurement
   * @param {number} options.min - Minimum value (for gauges)
   * @param {number} options.max - Maximum value (for gauges)
   * @param {Array<number>} options.buckets - Histogram buckets (for histograms)
   * @returns {boolean} - Success status
   */
  defineMetric(name, type, description, options = {}) {
    if (!name || !type) {
      throw new Error('Metric name and type are required');
    }
    
    if (!['counter', 'gauge', 'histogram', 'summary'].includes(type)) {
      throw new Error(`Invalid metric type: ${type}`);
    }
    
    this.metricDefinitions[name] = {
      name,
      type,
      description: description || '',
      options,
      createdAt: new Date()
    };
    
    return true;
  }
  
  /**
   * Defines a new dimension for metrics segmentation.
   * @param {string} name - Dimension name
   * @param {string} description - Dimension description
   * @param {Array<string>} allowedValues - List of allowed values (optional)
   * @returns {boolean} - Success status
   */
  defineDimension(name, description, allowedValues = null) {
    if (!name) {
      throw new Error('Dimension name is required');
    }
    
    this.dimensionDefinitions[name] = {
      name,
      description: description || '',
      allowedValues,
      createdAt: new Date()
    };
    
    return true;
  }
  
  /**
   * Records a metric value.
   * @param {string} name - Metric name
   * @param {number|boolean} value - Metric value
   * @param {Object} dimensions - Metric dimensions
   * @returns {boolean} - Success status
   */
  recordMetric(name, value, dimensions = {}) {
    // Validate metric exists
    if (!this.metricDefinitions[name]) {
      throw new Error(`Metric not defined: ${name}`);
    }
    
    const metricDef = this.metricDefinitions[name];
    const timestamp = Date.now();
    
    // Validate value type
    if (typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error(`Invalid value type for metric ${name}: ${typeof value}`);
    }
    
    // Validate dimensions
    for (const dimName in dimensions) {
      const dimDef = this.dimensionDefinitions[dimName];
      if (!dimDef) {
        throw new Error(`Dimension not defined: ${dimName}`);
      }
      
      if (dimDef.allowedValues && !dimDef.allowedValues.includes(dimensions[dimName])) {
        throw new Error(`Invalid value for dimension ${dimName}: ${dimensions[dimName]}`);
      }
    }
    
    // Initialize metric in buffer if needed
    if (!this.metricsBuffer[name]) {
      this.metricsBuffer[name] = [];
    }
    
    // Add metric to buffer
    this.metricsBuffer[name].push({
      timestamp,
      value,
      dimensions
    });
    
    // Emit event for real-time analysis
    if (this.options.enableRealTimeAnalysis) {
      this.events.emit('metric', {
        name,
        value,
        dimensions,
        timestamp,
        definition: metricDef
      });
    }
    
    return true;
  }
  
  /**
   * Flushes metrics from buffer to storage.
   * @returns {Promise<boolean>} - Success status
   */
  async flush() {
    const timestamp = Date.now();
    const filename = path.join(
      this.options.storageDir,
      `metrics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    
    // Clone and clear buffer
    const metricsToFlush = JSON.parse(JSON.stringify(this.metricsBuffer));
    this.metricsBuffer = {};
    
    // Skip if no metrics to flush
    if (Object.keys(metricsToFlush).length === 0) {
      return true;
    }
    
    try {
      // Write metrics to file
      await fs.promises.writeFile(
        filename,
        JSON.stringify({
          timestamp,
          metrics: metricsToFlush
        }, null, 2)
      );
      
      // Clean up old metrics files
      await this.cleanupOldMetricsFiles();
      
      return true;
    } catch (error) {
      // Restore metrics to buffer on error
      for (const metricName in metricsToFlush) {
        if (!this.metricsBuffer[metricName]) {
          this.metricsBuffer[metricName] = [];
        }
        this.metricsBuffer[metricName].push(...metricsToFlush[metricName]);
      }
      
      console.error('Error flushing metrics:', error);
      return false;
    }
  }
  
  /**
   * Cleans up metrics files older than the retention period.
   * @private
   * @returns {Promise<void>}
   */
  async cleanupOldMetricsFiles() {
    try {
      const files = await fs.promises.readdir(this.options.storageDir);
      const now = Date.now();
      const retentionMs = this.options.retentionPeriod * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (!file.startsWith('metrics-')) continue;
        
        const filePath = path.join(this.options.storageDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (now - stats.mtime.getTime() > retentionMs) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old metrics files:', error);
    }
  }
  
  /**
   * Retrieves metrics for a specific time range.
   * @param {Object} options - Query options
   * @param {string} options.metricName - Metric name to retrieve
   * @param {number} options.startTime - Start timestamp
   * @param {number} options.endTime - End timestamp
   * @param {Object} options.dimensions - Dimensions to filter by
   * @returns {Promise<Array>} - Array of metric values
   */
  async queryMetrics(options) {
    const { metricName, startTime, endTime, dimensions } = options;
    
    if (!metricName) {
      throw new Error('Metric name is required for querying');
    }
    
    try {
      const files = await fs.promises.readdir(this.options.storageDir);
      let results = [];
      
      // Filter files by time range if provided
      const metricsFiles = files.filter(file => {
        if (!file.startsWith('metrics-')) return false;
        
        if (startTime || endTime) {
          const fileTimestamp = new Date(
            file.replace('metrics-', '').replace(/[-]/g, ':').replace('.json', '')
          ).getTime();
          
          if (startTime && fileTimestamp < startTime) return false;
          if (endTime && fileTimestamp > endTime) return false;
        }
        
        return true;
      });
      
      // Read and process each file
      for (const file of metricsFiles) {
        const filePath = path.join(this.options.storageDir, file);
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        if (data.metrics[metricName]) {
          let metrics = data.metrics[metricName];
          
          // Filter by time range
          if (startTime || endTime) {
            metrics = metrics.filter(metric => {
              if (startTime && metric.timestamp < startTime) return false;
              if (endTime && metric.timestamp > endTime) return false;
              return true;
            });
          }
          
          // Filter by dimensions
          if (dimensions) {
            metrics = metrics.filter(metric => {
              for (const dimName in dimensions) {
                if (metric.dimensions[dimName] !== dimensions[dimName]) {
                  return false;
                }
              }
              return true;
            });
          }
          
          results.push(...metrics);
        }
      }
      
      // Sort by timestamp
      results.sort((a, b) => a.timestamp - b.timestamp);
      
      return results;
    } catch (error) {
      console.error('Error querying metrics:', error);
      throw error;
    }
  }
  
  /**
   * Calculates statistics for a metric.
   * @param {Array} metricValues - Array of metric values
   * @returns {Object} - Statistics object
   */
  calculateStatistics(metricValues) {
    if (!Array.isArray(metricValues) || metricValues.length === 0) {
      return {
        count: 0,
        min: null,
        max: null,
        sum: null,
        avg: null,
        median: null,
        p95: null,
        p99: null
      };
    }
    
    // Extract numeric values
    const values = metricValues
      .map(m => m.value)
      .filter(v => typeof v === 'number');
    
    if (values.length === 0) {
      return {
        count: metricValues.length,
        min: null,
        max: null,
        sum: null,
        avg: null,
        median: null,
        p95: null,
        p99: null
      };
    }
    
    // Sort values for percentiles
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate statistics
    const count = values.length;
    const min = sortedValues[0];
    const max = sortedValues[count - 1];
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;
    const median = count % 2 === 0
      ? (sortedValues[count / 2 - 1] + sortedValues[count / 2]) / 2
      : sortedValues[Math.floor(count / 2)];
    const p95 = sortedValues[Math.floor(count * 0.95)];
    const p99 = sortedValues[Math.floor(count * 0.99)];
    
    return {
      count,
      min,
      max,
      sum,
      avg,
      median,
      p95,
      p99
    };
  }
  
  /**
   * Subscribes to real-time metric events.
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribeToMetrics(callback) {
    if (!this.options.enableRealTimeAnalysis) {
      throw new Error('Real-time analysis is disabled');
    }
    
    this.events.on('metric', callback);
    
    return () => {
      this.events.off('metric', callback);
    };
  }
  
  /**
   * Stops the metrics collector and flushes any remaining metrics.
   * @returns {Promise<void>}
   */
  async stop() {
    // Clear intervals
    clearInterval(this.flushIntervalId);
    clearInterval(this.systemMetricsIntervalId);
    
    // Flush remaining metrics
    await this.flush();
  }
}

module.exports = MetricsCollector;
