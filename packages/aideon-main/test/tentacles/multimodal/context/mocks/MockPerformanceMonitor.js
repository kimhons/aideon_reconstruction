/**
 * @fileoverview Mock PerformanceMonitor for testing.
 */
const EventEmitter = require('events');

class MockPerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.timers = new Map();
    this.metrics = new Map();
  }
  
  startTimer(name) {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timer = {
      id: timerId,
      name,
      startTime: Date.now()
    };
    
    this.timers.set(timerId, timer);
    return timerId;
  }
  
  endTimer(timerId) {
    const timer = this.timers.get(timerId);
    if (!timer) {
      return null;
    }
    
    const endTime = Date.now();
    const duration = endTime - timer.startTime;
    
    // Update metrics
    const metric = this.metrics.get(timer.name) || { count: 0, totalTime: 0, avgTime: 0 };
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    this.metrics.set(timer.name, metric);
    
    // Remove timer
    this.timers.delete(timerId);
    
    // Emit event
    this.emit('timerEnded', {
      name: timer.name,
      duration,
      startTime: timer.startTime,
      endTime
    });
    
    return {
      name: timer.name,
      duration,
      startTime: timer.startTime,
      endTime
    };
  }
  
  getMetrics(name) {
    if (name) {
      return this.metrics.get(name);
    }
    return Object.fromEntries(this.metrics.entries());
  }
}

module.exports = MockPerformanceMonitor;
