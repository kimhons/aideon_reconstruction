/**
 * @fileoverview Logger utility for consistent logging across components.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

/**
 * Logger utility for consistent logging
 */
class Logger {
  /**
   * Creates a new Logger instance
   * 
   * @param {string} component - Component name for log identification
   */
  constructor(component) {
    this.component = component;
  }
  
  /**
   * Logs debug information
   * 
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  debug(message, data = {}) {
    this._log('DEBUG', message, data);
  }
  
  /**
   * Logs informational message
   * 
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  info(message, data = {}) {
    this._log('INFO', message, data);
  }
  
  /**
   * Logs warning message
   * 
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  warn(message, data = {}) {
    this._log('WARN', message, data);
  }
  
  /**
   * Logs error message
   * 
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data to log
   */
  error(message, data = {}) {
    this._log('ERROR', message, data);
  }
  
  /**
   * Internal logging implementation
   * 
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  _log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logData = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    
    console.log(`${timestamp} [${level}] [${this.component}] ${message}${logData}`);
  }
}

module.exports = { Logger };
