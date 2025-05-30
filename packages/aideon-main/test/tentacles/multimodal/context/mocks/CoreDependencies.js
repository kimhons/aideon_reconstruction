/**
 * @fileoverview Mock core dependencies for integration tests.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

// Mock Logger
class Logger {
  constructor(name) {
    this.name = name;
  }
  
  debug(...args) {
    // console.log(`[DEBUG][${this.name}]`, ...args);
  }
  
  info(...args) {
    // console.log(`[INFO][${this.name}]`, ...args);
  }
  
  warn(...args) {
    // console.log(`[WARN][${this.name}]`, ...args);
  }
  
  error(...args) {
    // console.log(`[ERROR][${this.name}]`, ...args);
  }
}

// Mock ConfigurationService
class ConfigurationService {
  constructor() {
    this.configs = new Map();
  }
  
  getConfig(key, defaultValue) {
    return this.configs.get(key) || defaultValue;
  }
  
  setConfig(key, value) {
    this.configs.set(key, value);
  }
}

// Mock PerformanceMonitor
class PerformanceMonitor {
  constructor(options = {}) {
    this.timers = new Map();
  }
  
  startTimer(name) {
    const timerId = `${name}_${Date.now()}`;
    this.timers.set(timerId, {
      name,
      startTime: Date.now()
    });
    return timerId;
  }
  
  endTimer(timerId) {
    const timer = this.timers.get(timerId);
    if (timer) {
      timer.endTime = Date.now();
      timer.duration = timer.endTime - timer.startTime;
      return timer.duration;
    }
    return 0;
  }
}

// Mock EnhancedAsyncLock
class EnhancedAsyncLock {
  constructor() {}
  
  async withLock(fn, ...args) {
    return fn(...args);
  }
}

// Mock EnhancedAsyncLockAdapter
const EnhancedAsyncLockAdapter = {
  withLock: async (lockName, fn, ...args) => fn(...args),
  acquire: async (fn, ...args) => fn(...args)
};

module.exports = {
  Logger,
  ConfigurationService,
  PerformanceMonitor,
  EnhancedAsyncLock,
  EnhancedAsyncLockAdapter
};
