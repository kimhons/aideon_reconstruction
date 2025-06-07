/**
 * @fileoverview Logging System for managing application logs.
 * Provides structured logging with levels, contexts, and transports.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { LoggingError } = require('../utils/errorHandling');

// Log levels
const LOG_LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

/**
 * Manages application logs.
 */
class LoggingSystem {
  /**
   * Creates a new LoggingSystem instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._transports = [];
    this._initialized = false;
    this._options = {
      level: options.level || 'info',
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile === true,
      enableRemote: options.enableRemote === true,
      filePath: options.filePath || './logs',
      remoteUrl: options.remoteUrl,
      ...options
    };
  }
  
  /**
   * Initializes the logging system.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      return true;
    }
    
    try {
      // Set up console transport
      if (this._options.enableConsole) {
        this._transports.push(new ConsoleTransport({
          level: this._options.level
        }));
      }
      
      // Set up file transport
      if (this._options.enableFile) {
        this._transports.push(new FileTransport({
          level: this._options.level,
          filePath: this._options.filePath
        }));
      }
      
      // Set up remote transport
      if (this._options.enableRemote && this._options.remoteUrl) {
        this._transports.push(new RemoteTransport({
          level: this._options.level,
          url: this._options.remoteUrl
        }));
      }
      
      this._initialized = true;
      
      // Log initialization
      const logger = this.getLogger('aideon:logging');
      logger.info('Logging system initialized');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize logging system:', error);
      
      throw new LoggingError('Failed to initialize logging system', 'LOGGING_INIT_ERROR', error);
    }
  }
  
  /**
   * Shuts down the logging system.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this._initialized) {
      return true;
    }
    
    try {
      // Log shutdown
      const logger = this.getLogger('aideon:logging');
      logger.info('Shutting down logging system');
      
      // Shut down transports
      for (const transport of this._transports) {
        if (typeof transport.shutdown === 'function') {
          await transport.shutdown();
        }
      }
      
      this._transports = [];
      this._initialized = false;
      
      return true;
    } catch (error) {
      console.error('Failed to shut down logging system:', error);
      
      throw new LoggingError('Failed to shut down logging system', 'LOGGING_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Gets a logger instance.
   * @param {string} context - The logger context
   * @returns {Logger} The logger instance
   */
  getLogger(context) {
    return new Logger(context, this);
  }
  
  /**
   * Logs a message.
   * @param {string} level - The log level
   * @param {string} context - The log context
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  log(level, context, message, metadata = {}) {
    if (!this._initialized) {
      // Fall back to console if not initialized
      console.log(`[${level.toUpperCase()}] [${context}] ${message}`, metadata);
      return true;
    }
    
    try {
      // Create log entry
      const entry = {
        id: uuidv4(),
        timestamp: Date.now(),
        level,
        context,
        message,
        metadata
      };
      
      // Send to transports
      for (const transport of this._transports) {
        if (LOG_LEVELS[level] >= LOG_LEVELS[transport.level]) {
          transport.log(entry);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to log message:', error);
      return false;
    }
  }
  
  /**
   * Sets the global log level.
   * @param {string} level - The log level
   * @returns {boolean} True if set was successful
   */
  setLevel(level) {
    if (!LOG_LEVELS.hasOwnProperty(level)) {
      throw new LoggingError(`Invalid log level: ${level}`, 'LOGGING_LEVEL_ERROR');
    }
    
    this._options.level = level;
    
    // Update transport levels
    for (const transport of this._transports) {
      transport.level = level;
    }
    
    return true;
  }
  
  /**
   * Gets the global log level.
   * @returns {string} The log level
   */
  getLevel() {
    return this._options.level;
  }
  
  /**
   * Adds a transport.
   * @param {Object} transport - The transport object
   * @returns {boolean} True if addition was successful
   */
  addTransport(transport) {
    if (!transport || typeof transport.log !== 'function') {
      throw new LoggingError('Invalid transport object', 'LOGGING_TRANSPORT_ERROR');
    }
    
    this._transports.push(transport);
    
    return true;
  }
  
  /**
   * Removes a transport.
   * @param {Object} transport - The transport object
   * @returns {boolean} True if removal was successful
   */
  removeTransport(transport) {
    const index = this._transports.indexOf(transport);
    
    if (index === -1) {
      return false;
    }
    
    this._transports.splice(index, 1);
    
    return true;
  }
  
  /**
   * Gets all transports.
   * @returns {Array<Object>} The transports
   */
  getTransports() {
    return [...this._transports];
  }
  
  /**
   * Checks if the logging system is healthy.
   * @returns {boolean} True if the logging system is healthy
   */
  isHealthy() {
    return this._initialized && this._transports.length > 0;
  }
}

/**
 * Logger class for a specific context.
 */
class Logger {
  /**
   * Creates a new Logger instance.
   * @param {string} context - The logger context
   * @param {LoggingSystem} system - The logging system
   */
  constructor(context, system) {
    this.context = context;
    this._system = system;
  }
  
  /**
   * Logs a trace message.
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  trace(message, metadata) {
    return this._system.log('trace', this.context, message, metadata);
  }
  
  /**
   * Logs a debug message.
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  debug(message, metadata) {
    return this._system.log('debug', this.context, message, metadata);
  }
  
  /**
   * Logs an info message.
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  info(message, metadata) {
    return this._system.log('info', this.context, message, metadata);
  }
  
  /**
   * Logs a warning message.
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  warn(message, metadata) {
    return this._system.log('warn', this.context, message, metadata);
  }
  
  /**
   * Logs an error message.
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  error(message, metadata) {
    return this._system.log('error', this.context, message, metadata);
  }
  
  /**
   * Logs a fatal message.
   * @param {string} message - The log message
   * @param {Object} [metadata] - Additional metadata
   * @returns {boolean} True if logging was successful
   */
  fatal(message, metadata) {
    return this._system.log('fatal', this.context, message, metadata);
  }
  
  /**
   * Creates a child logger with a sub-context.
   * @param {string} subContext - The sub-context
   * @returns {Logger} The child logger
   */
  child(subContext) {
    return new Logger(`${this.context}:${subContext}`, this._system);
  }
}

/**
 * Console transport for logging to the console.
 */
class ConsoleTransport {
  /**
   * Creates a new ConsoleTransport instance.
   * @param {Object} options - Transport options
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.colorize = options.colorize !== false;
  }
  
  /**
   * Logs an entry to the console.
   * @param {Object} entry - The log entry
   */
  log(entry) {
    const { level, context, message, metadata } = entry;
    
    // Format timestamp
    const timestamp = new Date(entry.timestamp).toISOString();
    
    // Format message
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
    
    // Add colors if enabled
    if (this.colorize) {
      formattedMessage = this._colorize(formattedMessage, level);
    }
    
    // Log to console
    switch (level) {
      case 'trace':
      case 'debug':
        console.debug(formattedMessage, metadata);
        break;
      case 'info':
        console.info(formattedMessage, metadata);
        break;
      case 'warn':
        console.warn(formattedMessage, metadata);
        break;
      case 'error':
      case 'fatal':
        console.error(formattedMessage, metadata);
        break;
      default:
        console.log(formattedMessage, metadata);
    }
  }
  
  /**
   * Adds colors to a message.
   * @param {string} message - The message
   * @param {string} level - The log level
   * @returns {string} The colorized message
   * @private
   */
  _colorize(message, level) {
    // ANSI color codes
    const colors = {
      reset: '\x1b[0m',
      trace: '\x1b[90m', // Gray
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m'  // Magenta
    };
    
    return `${colors[level]}${message}${colors.reset}`;
  }
}

/**
 * File transport for logging to a file.
 */
class FileTransport {
  /**
   * Creates a new FileTransport instance.
   * @param {Object} options - Transport options
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.filePath = options.filePath || './logs';
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10 MB
    this.maxFiles = options.maxFiles || 5;
    
    // This is a simplified implementation
    // In a real implementation, this would create a write stream to a file
    console.log(`File transport initialized with path: ${this.filePath}`);
  }
  
  /**
   * Logs an entry to a file.
   * @param {Object} entry - The log entry
   */
  log(entry) {
    // This is a simplified implementation
    // In a real implementation, this would write to a file
    console.log(`[FILE] Would write to ${this.filePath}:`, JSON.stringify(entry));
  }
  
  /**
   * Shuts down the transport.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    // This is a simplified implementation
    // In a real implementation, this would close the file stream
    console.log('File transport shut down');
    return true;
  }
}

/**
 * Remote transport for logging to a remote endpoint.
 */
class RemoteTransport {
  /**
   * Creates a new RemoteTransport instance.
   * @param {Object} options - Transport options
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.url = options.url;
    this.batchSize = options.batchSize || 10;
    this.batchInterval = options.batchInterval || 5000; // 5 seconds
    this.retryLimit = options.retryLimit || 3;
    
    this._batch = [];
    this._timer = null;
    
    // Start batch timer
    this._startTimer();
    
    console.log(`Remote transport initialized with URL: ${this.url}`);
  }
  
  /**
   * Logs an entry to the remote endpoint.
   * @param {Object} entry - The log entry
   */
  log(entry) {
    // Add to batch
    this._batch.push(entry);
    
    // Send batch if full
    if (this._batch.length >= this.batchSize) {
      this._sendBatch();
    }
  }
  
  /**
   * Shuts down the transport.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    // Clear timer
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    
    // Send remaining batch
    if (this._batch.length > 0) {
      await this._sendBatch();
    }
    
    console.log('Remote transport shut down');
    return true;
  }
  
  /**
   * Starts the batch timer.
   * @private
   */
  _startTimer() {
    this._timer = setInterval(() => {
      if (this._batch.length > 0) {
        this._sendBatch();
      }
    }, this.batchInterval);
  }
  
  /**
   * Sends the current batch to the remote endpoint.
   * @returns {Promise<boolean>} Promise resolving to true if send was successful
   * @private
   */
  async _sendBatch() {
    // This is a simplified implementation
    // In a real implementation, this would send the batch to the remote endpoint
    console.log(`[REMOTE] Would send ${this._batch.length} logs to ${this.url}`);
    
    // Clear batch
    this._batch = [];
    
    return true;
  }
}

// Export the LoggingSystem class and Logger class
module.exports = LoggingSystem;
module.exports.Logger = Logger;
module.exports.LOG_LEVELS = LOG_LEVELS;
