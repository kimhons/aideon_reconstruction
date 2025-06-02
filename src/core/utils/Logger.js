/**
 * @fileoverview Core utilities for logging in Aideon AI Desktop Agent.
 * Provides standardized logging functionality across the application.
 * 
 * @module core/utils/Logger
 */

/**
 * Logger class for standardized logging across Aideon
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {String} name - Name of the logger (typically module or component name)
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Log an informational message
   * @param {String} message - The message to log
   * @param {Object} [data] - Optional data to include with the log
   */
  info(message, data) {
    this._log('INFO', message, data);
  }

  /**
   * Log a debug message
   * @param {String} message - The message to log
   * @param {Object} [data] - Optional data to include with the log
   */
  debug(message, data) {
    this._log('DEBUG', message, data);
  }

  /**
   * Log a warning message
   * @param {String} message - The message to log
   * @param {Object} [data] - Optional data to include with the log
   */
  warn(message, data) {
    this._log('WARN', message, data);
  }

  /**
   * Log an error message
   * @param {String} message - The message to log
   * @param {Error|Object} [error] - Optional error or data to include with the log
   */
  error(message, error) {
    this._log('ERROR', message, error);
  }

  /**
   * Internal method to handle logging
   * @private
   * @param {String} level - Log level
   * @param {String} message - The message to log
   * @param {Object} [data] - Optional data to include with the log
   */
  _log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      name: this.name,
      message
    };

    if (data) {
      if (data instanceof Error) {
        logEntry.error = {
          message: data.message,
          stack: data.stack
        };
      } else {
        logEntry.data = data;
      }
    }

    // In a production environment, this would use a proper logging system
    // For now, we'll just console.log for simplicity
    console.log(`[${timestamp}] [${level}] [${this.name}] ${message}`);
    if (data) {
      console.log(data instanceof Error ? data.stack : data);
    }
  }
}

module.exports = Logger;
