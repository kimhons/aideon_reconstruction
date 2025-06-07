/**
 * @fileoverview Logger utility for Aideon components
 * 
 * This module provides a standardized logging interface for all Aideon components.
 */

/**
 * Logger class for standardized logging across Aideon components
 */
class Logger {
  /**
   * Creates a new Logger instance
   * @param {string} componentName The name of the component using this logger
   * @param {Object} options Configuration options
   */
  constructor(componentName, options = {}) {
    this.componentName = componentName;
    this.options = {
      logLevel: options.logLevel || 'info',
      includeTimestamp: options.includeTimestamp !== undefined ? options.includeTimestamp : true,
      ...options
    };
    
    // Log levels and their numeric values (higher = more verbose)
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    // Bind methods to ensure correct 'this' context
    this.log = this.log.bind(this);
    this.error = this.error.bind(this);
    this.warn = this.warn.bind(this);
    this.info = this.info.bind(this);
    this.debug = this.debug.bind(this);
    this.trace = this.trace.bind(this);
  }
  
  /**
   * Logs a message at the specified level
   * @param {string} level The log level
   * @param {string} message The message to log
   * @param {*} data Additional data to log
   */
  log(level, message, data) {
    // Check if this level should be logged
    if (!this._shouldLog(level)) {
      return;
    }
    
    // Format the log message
    const formattedMessage = this._formatMessage(level, message);
    
    // Log to console
    switch (level) {
      case 'error':
        console.error(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'info':
        console.info(formattedMessage, data || '');
        break;
      case 'debug':
      case 'trace':
      default:
        console.log(formattedMessage, data || '');
        break;
    }
  }
  
  /**
   * Logs an error message
   * @param {string} message The message to log
   * @param {*} data Additional data to log
   */
  error(message, data) {
    this.log('error', message, data);
  }
  
  /**
   * Logs a warning message
   * @param {string} message The message to log
   * @param {*} data Additional data to log
   */
  warn(message, data) {
    this.log('warn', message, data);
  }
  
  /**
   * Logs an info message
   * @param {string} message The message to log
   * @param {*} data Additional data to log
   */
  info(message, data) {
    this.log('info', message, data);
  }
  
  /**
   * Logs a debug message
   * @param {string} message The message to log
   * @param {*} data Additional data to log
   */
  debug(message, data) {
    this.log('debug', message, data);
  }
  
  /**
   * Logs a trace message
   * @param {string} message The message to log
   * @param {*} data Additional data to log
   */
  trace(message, data) {
    this.log('trace', message, data);
  }
  
  /**
   * Checks if a message at the given level should be logged
   * @private
   * @param {string} level The log level to check
   * @returns {boolean} Whether the message should be logged
   */
  _shouldLog(level) {
    const configuredLevel = this.options.logLevel;
    return this.logLevels[level] <= this.logLevels[configuredLevel];
  }
  
  /**
   * Formats a log message
   * @private
   * @param {string} level The log level
   * @param {string} message The message to format
   * @returns {string} The formatted message
   */
  _formatMessage(level, message) {
    let formattedMessage = '';
    
    // Add timestamp if configured
    if (this.options.includeTimestamp) {
      formattedMessage += `[${new Date().toISOString()}] `;
    }
    
    // Add log level
    formattedMessage += `[${level.toUpperCase()}] `;
    
    // Add component name
    formattedMessage += `[${this.componentName}] `;
    
    // Add message
    formattedMessage += message;
    
    return formattedMessage;
  }
}

module.exports = { Logger };
