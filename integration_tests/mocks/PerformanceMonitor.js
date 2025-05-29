/**
 * @fileoverview Mock PerformanceMonitor for integration tests
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.timers = new Map();
  }

  startTimer(operationName, metadata = {}) {
    // Mock implementation
    const timerId = `${operationName}_${Date.now()}`;
    this.timers.set(timerId, {
      start: Date.now(),
      operationName,
      metadata
    });
    return timerId;
  }

  stopTimer(timerId) {
    // Mock implementation
    if (!this.timers.has(timerId)) {
      return false;
    }
    
    const timer = this.timers.get(timerId);
    timer.end = Date.now();
    timer.duration = timer.end - timer.start;
    return timer.duration;
  }

  recordMetric(metricName, value, metadata = {}) {
    // Mock implementation
    return true;
  }

  getMetrics(filter = {}) {
    // Mock implementation
    return [];
  }
}

module.exports = PerformanceMonitor;
