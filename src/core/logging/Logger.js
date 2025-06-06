/**
 * @fileoverview Logger - Core logging system for Aideon
 * 
 * This module provides a simple logging implementation for the Aideon system.
 */

/**
 * Logger class - Manages logging for Aideon components
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {string} namespace - Logger namespace
   */
  constructor(namespace) {
    this.namespace = namespace;
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  info(message, data) {
    this._log('INFO', message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  warn(message, data) {
    this._log('WARN', message, data);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Error|Object} [error] - Error object or additional data
   */
  error(message, error) {
    this._log('ERROR', message, error);
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  debug(message, data) {
    this._log('DEBUG', message, data);
  }

  /**
   * Internal logging method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   * @private
   */
  _log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      namespace: this.namespace,
      message
    };
    
    if (data) {
      if (data instanceof Error) {
        logEntry.error = {
          name: data.name,
          message: data.message,
          stack: data.stack
        };
      } else {
        logEntry.data = data;
      }
    }
    
    // In a real implementation, this would use a configurable logging backend
    console.log(JSON.stringify(logEntry));
  }
}

module.exports = { Logger };
