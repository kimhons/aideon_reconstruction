/**
 * @fileoverview Core Logger implementation for Aideon
 * This file provides a centralized logging system for the entire application
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

class Logger {
  /**
   * Create a new Logger instance
   * @param {string} name - Name of the logger, typically the component name
   */
  constructor(name) {
    this.name = name;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error|Object} [error] - Optional error object or additional data
   */
  error(message, error) {
    if (this._shouldLog('error')) {
      console.error(`[ERROR] [${this.name}] ${message}`, error || '');
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional additional data
   */
  warn(message, data) {
    if (this._shouldLog('warn')) {
      console.warn(`[WARN] [${this.name}] ${message}`, data || '');
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional additional data
   */
  info(message, data) {
    if (this._shouldLog('info')) {
      console.info(`[INFO] [${this.name}] ${message}`, data || '');
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional additional data
   */
  debug(message, data) {
    if (this._shouldLog('debug')) {
      console.debug(`[DEBUG] [${this.name}] ${message}`, data || '');
    }
  }

  /**
   * Log a trace message
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional additional data
   */
  trace(message, data) {
    if (this._shouldLog('trace')) {
      console.trace(`[TRACE] [${this.name}] ${message}`, data || '');
    }
  }

  /**
   * Check if the message should be logged based on the current log level
   * @param {string} level - Log level to check
   * @returns {boolean} - Whether the message should be logged
   * @private
   */
  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Set the log level
   * @param {string} level - New log level (error, warn, info, debug, trace)
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.logLevel = level;
    }
  }
}

module.exports = { Logger };
