/**
 * @fileoverview Mock Logger for testing.
 * Provides mock implementations of logging functionality.
 * 
 * @module test/mocks/Logger
 */

/**
 * Mock Logger
 */
class MockLogger {
  /**
   * Create a new Mock Logger
   */
  constructor() {
    this.logs = [];
    this.errorLogs = [];
    this.warnLogs = [];
    this.infoLogs = [];
    this.debugLogs = [];
    this.traceLogs = [];
  }
  
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} [context] - Error context
   */
  error(message, context = {}) {
    this.logs.push({ level: 'error', message, context, timestamp: new Date() });
    this.errorLogs.push({ message, context, timestamp: new Date() });
  }
  
  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} [context] - Warning context
   */
  warn(message, context = {}) {
    this.logs.push({ level: 'warn', message, context, timestamp: new Date() });
    this.warnLogs.push({ message, context, timestamp: new Date() });
  }
  
  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} [context] - Info context
   */
  info(message, context = {}) {
    this.logs.push({ level: 'info', message, context, timestamp: new Date() });
    this.infoLogs.push({ message, context, timestamp: new Date() });
  }
  
  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} [context] - Debug context
   */
  debug(message, context = {}) {
    this.logs.push({ level: 'debug', message, context, timestamp: new Date() });
    this.debugLogs.push({ message, context, timestamp: new Date() });
  }
  
  /**
   * Log trace message
   * @param {string} message - Trace message
   * @param {Object} [context] - Trace context
   */
  trace(message, context = {}) {
    this.logs.push({ level: 'trace', message, context, timestamp: new Date() });
    this.traceLogs.push({ message, context, timestamp: new Date() });
  }
  
  /**
   * Get all logs
   * @returns {Array<Object>} All logs
   */
  getAllLogs() {
    return [...this.logs];
  }
  
  /**
   * Get logs by level
   * @param {string} level - Log level
   * @returns {Array<Object>} Logs of specified level
   */
  getLogsByLevel(level) {
    switch (level) {
      case 'error':
        return [...this.errorLogs];
      case 'warn':
        return [...this.warnLogs];
      case 'info':
        return [...this.infoLogs];
      case 'debug':
        return [...this.debugLogs];
      case 'trace':
        return [...this.traceLogs];
      default:
        return [];
    }
  }
  
  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.errorLogs = [];
    this.warnLogs = [];
    this.infoLogs = [];
    this.debugLogs = [];
    this.traceLogs = [];
  }
}

module.exports = MockLogger;
