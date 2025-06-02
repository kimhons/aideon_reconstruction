/**
 * @fileoverview Logger utility for the Learning from Demonstration system.
 * Provides structured logging with support for different log levels,
 * formatting, and output destinations.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

class Logger {
  /**
   * Log levels
   * @enum {number}
   */
  static LEVELS = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5
  };

  /**
   * Creates a new Logger instance.
   * @param {string} name - Logger name, typically the module name
   * @param {Object} options - Logger options
   * @param {number} [options.level=Logger.LEVELS.INFO] - Minimum log level
   * @param {Function[]} [options.transports=[]] - Log transport functions
   * @param {Object} [options.context={}] - Default context data to include with logs
   */
  constructor(name, options = {}) {
    this.name = name;
    this.level = options.level !== undefined ? options.level : Logger.LEVELS.INFO;
    this.transports = options.transports || [Logger.consoleTransport];
    this.context = options.context || {};
    this.enabled = true;
  }

  /**
   * Default console transport function.
   * @param {Object} logEntry - Log entry to output
   */
  static consoleTransport(logEntry) {
    const { timestamp, level, name, message, context, error } = logEntry;
    const levelName = Object.keys(Logger.LEVELS).find(key => Logger.LEVELS[key] === level);
    
    let formattedMessage = `[${timestamp.toISOString()}] [${levelName}] [${name}] ${message}`;
    
    if (Object.keys(context).length > 0) {
      formattedMessage += ` ${JSON.stringify(context)}`;
    }
    
    switch (level) {
      case Logger.LEVELS.TRACE:
      case Logger.LEVELS.DEBUG:
        console.debug(formattedMessage);
        break;
      case Logger.LEVELS.INFO:
        console.info(formattedMessage);
        break;
      case Logger.LEVELS.WARN:
        console.warn(formattedMessage);
        break;
      case Logger.LEVELS.ERROR:
      case Logger.LEVELS.FATAL:
        console.error(formattedMessage);
        if (error) {
          console.error(error);
        }
        break;
    }
  }

  /**
   * Creates a log entry and sends it to all transports if level is sufficient.
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context data
   * @param {Error} [error=null] - Associated error object
   * @private
   */
  _log(level, message, context = {}, error = null) {
    if (!this.enabled || level < this.level) {
      return;
    }
    
    const logEntry = {
      timestamp: new Date(),
      level,
      name: this.name,
      message,
      context: { ...this.context, ...context },
      error
    };
    
    for (const transport of this.transports) {
      try {
        transport(logEntry);
      } catch (transportError) {
        console.error(`Error in log transport: ${transportError.message}`);
      }
    }
  }

  /**
   * Logs a message at TRACE level.
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context data
   */
  trace(message, context = {}) {
    this._log(Logger.LEVELS.TRACE, message, context);
  }

  /**
   * Logs a message at DEBUG level.
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context data
   */
  debug(message, context = {}) {
    this._log(Logger.LEVELS.DEBUG, message, context);
  }

  /**
   * Logs a message at INFO level.
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context data
   */
  info(message, context = {}) {
    this._log(Logger.LEVELS.INFO, message, context);
  }

  /**
   * Logs a message at WARN level.
   * @param {string} message - Log message
   * @param {Object} [context={}] - Additional context data
   */
  warn(message, context = {}) {
    this._log(Logger.LEVELS.WARN, message, context);
  }

  /**
   * Logs a message at ERROR level.
   * @param {string} message - Log message
   * @param {Error|Object} [errorOrContext={}] - Error object or context data
   * @param {Object} [context={}] - Additional context data if first param is Error
   */
  error(message, errorOrContext = {}, context = {}) {
    if (errorOrContext instanceof Error) {
      this._log(Logger.LEVELS.ERROR, message, context, errorOrContext);
    } else {
      this._log(Logger.LEVELS.ERROR, message, errorOrContext);
    }
  }

  /**
   * Logs a message at FATAL level.
   * @param {string} message - Log message
   * @param {Error|Object} [errorOrContext={}] - Error object or context data
   * @param {Object} [context={}] - Additional context data if first param is Error
   */
  fatal(message, errorOrContext = {}, context = {}) {
    if (errorOrContext instanceof Error) {
      this._log(Logger.LEVELS.FATAL, message, context, errorOrContext);
    } else {
      this._log(Logger.LEVELS.FATAL, message, errorOrContext);
    }
  }

  /**
   * Creates a child logger with inherited settings and additional context.
   * @param {string} childName - Name suffix for the child logger
   * @param {Object} [childContext={}] - Additional context for the child logger
   * @returns {Logger} A new Logger instance
   */
  child(childName, childContext = {}) {
    const name = `${this.name}:${childName}`;
    const context = { ...this.context, ...childContext };
    
    return new Logger(name, {
      level: this.level,
      transports: this.transports,
      context
    });
  }

  /**
   * Enables or disables the logger.
   * @param {boolean} enabled - Whether the logger should be enabled
   * @returns {Logger} This instance for chaining
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    return this;
  }

  /**
   * Sets the minimum log level.
   * @param {number} level - Minimum log level
   * @returns {Logger} This instance for chaining
   */
  setLevel(level) {
    this.level = level;
    return this;
  }

  /**
   * Adds a transport function.
   * @param {Function} transport - Transport function
   * @returns {Logger} This instance for chaining
   */
  addTransport(transport) {
    this.transports.push(transport);
    return this;
  }

  /**
   * Removes a transport function.
   * @param {Function} transport - Transport function to remove
   * @returns {Logger} This instance for chaining
   */
  removeTransport(transport) {
    const index = this.transports.indexOf(transport);
    if (index !== -1) {
      this.transports.splice(index, 1);
    }
    return this;
  }

  /**
   * Creates a logger factory function.
   * @param {Object} defaultOptions - Default options for all loggers
   * @returns {Function} Logger factory function
   */
  static createFactory(defaultOptions = {}) {
    return (name, options = {}) => {
      return new Logger(name, { ...defaultOptions, ...options });
    };
  }
}

module.exports = Logger;
