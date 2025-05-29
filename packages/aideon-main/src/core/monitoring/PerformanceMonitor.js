/**
 * @fileoverview Performance monitoring service for tracking execution times and resource usage.
 * This service provides detailed metrics for system performance analysis and optimization.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const os = require('os');
const { EventEmitter } = require('events');

/**
 * Performance monitoring service for tracking execution times and resource usage
 */
class PerformanceMonitor extends EventEmitter {
  /**
   * Creates a new PerformanceMonitor instance
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   */
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.timers = new Map();
    this.metrics = {
      cpu: [],
      memory: [],
      timers: {}
    };
    
    // Track system resources if enabled
    this.trackSystemResources = options.trackSystemResources !== false;
    this.resourceTrackingInterval = options.resourceTrackingInterval || 60000; // 1 minute
    this.resourceTracker = null;
    
    if (this.trackSystemResources) {
      this._startResourceTracking();
    }
    
    this.logger.info('PerformanceMonitor initialized');
  }
  
  /**
   * Starts tracking system resources
   * @private
   */
  _startResourceTracking() {
    this.resourceTracker = setInterval(() => {
      this._captureSystemMetrics();
    }, this.resourceTrackingInterval);
  }
  
  /**
   * Captures current system metrics
   * @private
   */
  _captureSystemMetrics() {
    try {
      // Capture CPU usage
      const cpuUsage = process.cpuUsage();
      const cpuMetric = {
        user: cpuUsage.user,
        system: cpuUsage.system,
        timestamp: Date.now()
      };
      this.metrics.cpu.push(cpuMetric);
      
      // Limit array size to prevent memory issues
      if (this.metrics.cpu.length > 100) {
        this.metrics.cpu.shift();
      }
      
      // Capture memory usage
      const memoryUsage = process.memoryUsage();
      const memoryMetric = {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        timestamp: Date.now()
      };
      this.metrics.memory.push(memoryMetric);
      
      // Limit array size to prevent memory issues
      if (this.metrics.memory.length > 100) {
        this.metrics.memory.shift();
      }
      
      // Emit metrics event
      this.emit('metrics', {
        cpu: cpuMetric,
        memory: memoryMetric
      });
    } catch (error) {
      this.logger.error('Error capturing system metrics', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Starts a timer for performance tracking
   * @param {string} name - Name of the timer
   * @returns {string} Timer ID
   */
  startTimer(name) {
    const timerId = `${name}_${Date.now()}`;
    this.timers.set(timerId, {
      name,
      startTime: process.hrtime(),
      startTimestamp: Date.now()
    });
    
    return timerId;
  }
  
  /**
   * Ends a timer and records the elapsed time
   * @param {string} timerId - ID of the timer to end
   * @returns {number} Elapsed time in milliseconds
   */
  endTimer(timerId) {
    const timer = this.timers.get(timerId);
    if (!timer) {
      this.logger.warn(`Timer ${timerId} not found`);
      return 0;
    }
    
    const elapsed = process.hrtime(timer.startTime);
    const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
    
    // Record metric
    if (!this.metrics.timers[timer.name]) {
      this.metrics.timers[timer.name] = {
        count: 0,
        totalTime: 0,
        min: Number.MAX_VALUE,
        max: 0,
        avg: 0
      };
    }
    
    const metric = this.metrics.timers[timer.name];
    metric.count++;
    metric.totalTime += elapsedMs;
    metric.min = Math.min(metric.min, elapsedMs);
    metric.max = Math.max(metric.max, elapsedMs);
    metric.avg = metric.totalTime / metric.count;
    
    // Remove timer from active timers
    this.timers.delete(timerId);
    
    // Emit event
    this.emit('timerEnd', {
      name: timer.name,
      timerId,
      elapsed: elapsedMs,
      startTimestamp: timer.startTimestamp,
      endTimestamp: Date.now()
    });
    
    return elapsedMs;
  }
  
  /**
   * Gets the elapsed time for a timer without ending it
   * @param {string} timerId - ID of the timer
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsedTime(timerId) {
    const timer = this.timers.get(timerId);
    if (!timer) {
      this.logger.warn(`Timer ${timerId} not found`);
      return 0;
    }
    
    const elapsed = process.hrtime(timer.startTime);
    return (elapsed[0] * 1000) + (elapsed[1] / 1000000);
  }
  
  /**
   * Gets performance metrics for a specific timer
   * @param {string} name - Name of the timer
   * @returns {Object|null} Timer metrics or null if not found
   */
  getTimerMetrics(name) {
    return this.metrics.timers[name] || null;
  }
  
  /**
   * Gets all performance metrics
   * @returns {Object} All metrics
   */
  getAllMetrics() {
    return {
      ...this.metrics,
      activeTimers: this.timers.size,
      timestamp: Date.now()
    };
  }
  
  /**
   * Resets all metrics
   */
  resetMetrics() {
    this.metrics = {
      cpu: [],
      memory: [],
      timers: {}
    };
  }
  
  /**
   * Disposes resources
   */
  dispose() {
    if (this.resourceTracker) {
      clearInterval(this.resourceTracker);
      this.resourceTracker = null;
    }
    
    this.timers.clear();
    this.removeAllListeners();
  }
}

module.exports = { PerformanceMonitor };
