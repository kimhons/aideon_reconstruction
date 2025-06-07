/**
 * @fileoverview Logger utility for standardized logging across the Aideon system.
 * 
 * This module provides a consistent logging interface with support for different
 * log levels, contextual information, and integration with monitoring systems.
 */

/**
 * Logger class for standardized logging
 */
class Logger {
  /**
   * Creates a new Logger instance
   * @param {string} context The context or component name for this logger
   * @param {Object} options Configuration options
   */
  constructor(context, options = {}) {
    this.context = context;
    this.options = {
      minLevel: options.minLevel || 'info',
      includeTimestamp: options.includeTimestamp !== false,
      includeContext: options.includeContext !== false,
      ...options
    };
    
    // Log levels and their numeric values (higher = more severe)
    this.levels = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
      fatal: 5
    };
    
    // Bind methods to ensure correct 'this' context
    this.log = this.log.bind(this);
    this.trace = this.trace.bind(this);
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    this.fatal = this.fatal.bind(this);
  }
  
  /**
   * Logs a message at the specified level
   * @param {string} level Log level
   * @param {string} message Log message
   * @param {Object|Error} [data] Additional data or error object
   */
  log(level, message, data) {
    // Check if this log level should be processed
    if (this.levels[level] < this.levels[this.options.minLevel]) {
      return;
    }
    
    // Create log entry
    const entry = {
      level,
      message
    };
    
    // Add timestamp if enabled
    if (this.options.includeTimestamp) {
      entry.timestamp = new Date().toISOString();
    }
    
    // Add context if enabled
    if (this.options.includeContext && this.context) {
      entry.context = this.context;
    }
    
    // Add data if provided
    if (data !== undefined) {
      if (data instanceof Error) {
        // Format error objects
        entry.error = {
          name: data.name,
          message: data.message,
          stack: data.stack
        };
        
        // Add additional properties from the error
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key) && 
              !['name', 'message', 'stack'].includes(key)) {
            entry.error[key] = data[key];
          }
        }
      } else {
        // Add data as-is
        entry.data = data;
      }
    }
    
    // Output log entry
    this._output(entry);
  }
  
  /**
   * Outputs a log entry
   * @private
   * @param {Object} entry Log entry
   */
  _output(entry) {
    // Default implementation uses console
    // This can be overridden in derived classes to use other logging systems
    const { level } = entry;
    
    // Format the log message
    let formattedMessage = '';
    
    if (entry.timestamp) {
      formattedMessage += `[${entry.timestamp}] `;
    }
    
    if (entry.context) {
      formattedMessage += `[${entry.context}] `;
    }
    
    formattedMessage += `${entry.message}`;
    
    // Output to console based on level
    switch (level) {
      case 'trace':
      case 'debug':
        console.debug(formattedMessage, entry.data || entry.error || '');
        break;
      case 'info':
        console.info(formattedMessage, entry.data || entry.error || '');
        break;
      case 'warn':
        console.warn(formattedMessage, entry.data || entry.error || '');
        break;
      case 'error':
      case 'fatal':
        console.error(formattedMessage, entry.data || entry.error || '');
        break;
      default:
        console.log(formattedMessage, entry.data || entry.error || '');
    }
  }
  
  /**
   * Logs a message at TRACE level
   * @param {string} message Log message
   * @param {Object} [data] Additional data
   */
  trace(message, data) {
    this.log('trace', message, data);
  }
  
  /**
   * Logs a message at DEBUG level
   * @param {string} message Log message
   * @param {Object} [data] Additional data
   */
  debug(message, data) {
    this.log('debug', message, data);
  }
  
  /**
   * Logs a message at INFO level
   * @param {string} message Log message
   * @param {Object} [data] Additional data
   */
  info(message, data) {
    this.log('info', message, data);
  }
  
  /**
   * Logs a message at WARN level
   * @param {string} message Log message
   * @param {Object} [data] Additional data
   */
  warn(message, data) {
    this.log('warn', message, data);
  }
  
  /**
   * Logs a message at ERROR level
   * @param {string} message Log message
   * @param {Error|Object} [error] Error object or additional data
   */
  error(message, error) {
    this.log('error', message, error);
  }
  
  /**
   * Logs a message at FATAL level
   * @param {string} message Log message
   * @param {Error|Object} [error] Error object or additional data
   */
  fatal(message, error) {
    this.log('fatal', message, error);
  }
}

module.exports = { Logger };
