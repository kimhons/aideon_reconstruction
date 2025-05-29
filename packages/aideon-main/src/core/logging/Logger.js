/**
 * @fileoverview Logger class for Aideon system.
 * Provides standardized logging capabilities with different log levels.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { ConfigurationService } = require('../ConfigurationService');

/**
 * Log levels enum
 * @enum {number}
 */
const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5
};

/**
 * Maps log levels to their string representations
 * @type {Object.<number, string>}
 */
const LogLevelNames = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL'
};

/**
 * Logger class for standardized logging across the Aideon system.
 * Supports multiple log levels, file and console output, and structured logging.
 */
class Logger extends EventEmitter {
  /**
   * Creates a new Logger instance.
   * 
   * @param {string|Object} options - Logger name or options object
   * @param {string} [options.name='default'] - Logger name
   * @param {number} [options.level=LogLevel.INFO] - Minimum log level
   * @param {boolean} [options.console=true] - Whether to log to console
   * @param {boolean} [options.file=false] - Whether to log to file
   * @param {string} [options.filePath] - Path to log file
   * @param {boolean} [options.json=false] - Whether to log in JSON format
   * @param {ConfigurationService} [options.configService] - Configuration service
   */
  constructor(options) {
    super();
    
    // Handle string argument (logger name)
    if (typeof options === 'string') {
      this.name = options;
      options = {};
    } else {
      this.name = (options && options.name) || 'default';
      options = options || {};
    }
    
    this.configService = options.configService || new ConfigurationService();
    
    // Load configuration
    const config = this.configService.getConfig('logging', {
      defaultLevel: LogLevel.INFO,
      console: true,
      file: false,
      filePath: './logs/aideon.log',
      json: false,
      maxFileSize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      includeTimestamp: true,
      includeLoggerName: true
    });
    
    // Initialize properties
    this.level = options.level !== undefined ? options.level : config.defaultLevel;
    this.console = options.console !== undefined ? options.console : config.console;
    this.file = options.file !== undefined ? options.file : config.file;
    this.filePath = options.filePath || config.filePath;
    this.json = options.json !== undefined ? options.json : config.json;
    this.maxFileSize = config.maxFileSize;
    this.maxFiles = config.maxFiles;
    this.includeTimestamp = config.includeTimestamp;
    this.includeLoggerName = config.includeLoggerName;
    
    // Initialize file logging if enabled
    if (this.file) {
      this._initializeFileLogging();
    }
  }
  
  /**
   * Initializes file logging.
   * 
   * @private
   */
  _initializeFileLogging() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Check if file exists and rotate if needed
      if (fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath);
        if (stats.size >= this.maxFileSize) {
          this._rotateLogFiles();
        }
      }
    } catch (error) {
      console.error(`Failed to initialize file logging: ${error.message}`);
      this.file = false;
    }
  }
  
  /**
   * Rotates log files.
   * 
   * @private
   */
  _rotateLogFiles() {
    try {
      // Remove oldest log file if max files reached
      const oldestLog = `${this.filePath}.${this.maxFiles - 1}`;
      if (fs.existsSync(oldestLog)) {
        fs.unlinkSync(oldestLog);
      }
      
      // Shift existing log files
      for (let i = this.maxFiles - 2; i >= 0; i--) {
        const oldPath = i === 0 ? this.filePath : `${this.filePath}.${i}`;
        const newPath = `${this.filePath}.${i + 1}`;
        
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
      
      // Create new log file
      fs.writeFileSync(this.filePath, '');
    } catch (error) {
      console.error(`Failed to rotate log files: ${error.message}`);
    }
  }
  
  /**
   * Formats a log message.
   * 
   * @private
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   * @returns {string} Formatted log message
   */
  _formatMessage(level, message, meta) {
    if (this.json) {
      const logObject = {
        level: LogLevelNames[level],
        message
      };
      
      if (this.includeTimestamp) {
        logObject.timestamp = new Date().toISOString();
      }
      
      if (this.includeLoggerName) {
        logObject.logger = this.name;
      }
      
      if (meta) {
        logObject.meta = meta;
      }
      
      return JSON.stringify(logObject);
    } else {
      let formattedMessage = '';
      
      if (this.includeTimestamp) {
        formattedMessage += `[${new Date().toISOString()}] `;
      }
      
      formattedMessage += `[${LogLevelNames[level]}]`;
      
      if (this.includeLoggerName) {
        formattedMessage += ` [${this.name}]`;
      }
      
      formattedMessage += `: ${message}`;
      
      if (meta) {
        if (meta instanceof Error) {
          formattedMessage += `\n${meta.stack || meta.toString()}`;
        } else if (typeof meta === 'object') {
          formattedMessage += `\n${JSON.stringify(meta, null, 2)}`;
        } else {
          formattedMessage += ` ${meta}`;
        }
      }
      
      return formattedMessage;
    }
  }
  
  /**
   * Writes a log message.
   * 
   * @private
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  _log(level, message, meta) {
    // Skip if level is below threshold
    if (level < this.level) {
      return;
    }
    
    const formattedMessage = this._formatMessage(level, message, meta);
    
    // Log to console if enabled
    if (this.console) {
      const consoleMethod = level <= LogLevel.INFO ? 'log' : 
                           level === LogLevel.WARN ? 'warn' : 'error';
      console[consoleMethod](formattedMessage);
    }
    
    // Log to file if enabled
    if (this.file) {
      try {
        fs.appendFileSync(this.filePath, formattedMessage + '\n');
        
        // Check file size and rotate if needed
        const stats = fs.statSync(this.filePath);
        if (stats.size >= this.maxFileSize) {
          this._rotateLogFiles();
        }
      } catch (error) {
        console.error(`Failed to write to log file: ${error.message}`);
      }
    }
    
    // Emit log event
    this.emit('log', {
      level,
      levelName: LogLevelNames[level],
      message,
      meta,
      timestamp: new Date(),
      logger: this.name
    });
  }
  
  /**
   * Logs a trace message.
   * 
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  trace(message, meta) {
    this._log(LogLevel.TRACE, message, meta);
  }
  
  /**
   * Logs a debug message.
   * 
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  debug(message, meta) {
    this._log(LogLevel.DEBUG, message, meta);
  }
  
  /**
   * Logs an info message.
   * 
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  info(message, meta) {
    this._log(LogLevel.INFO, message, meta);
  }
  
  /**
   * Logs a warning message.
   * 
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  warn(message, meta) {
    this._log(LogLevel.WARN, message, meta);
  }
  
  /**
   * Logs an error message.
   * 
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  error(message, meta) {
    this._log(LogLevel.ERROR, message, meta);
  }
  
  /**
   * Logs a fatal message.
   * 
   * @param {string} message - Log message
   * @param {Object} [meta] - Additional metadata
   */
  fatal(message, meta) {
    this._log(LogLevel.FATAL, message, meta);
  }
  
  /**
   * Sets the minimum log level.
   * 
   * @param {number} level - Minimum log level
   */
  setLevel(level) {
    this.level = level;
  }
  
  /**
   * Gets the current log level.
   * 
   * @returns {number} Current log level
   */
  getLevel() {
    return this.level;
  }
  
  /**
   * Enables or disables console logging.
   * 
   * @param {boolean} enabled - Whether console logging is enabled
   */
  setConsoleLogging(enabled) {
    this.console = enabled;
  }
  
  /**
   * Enables or disables file logging.
   * 
   * @param {boolean} enabled - Whether file logging is enabled
   * @param {string} [filePath] - Path to log file
   */
  setFileLogging(enabled, filePath) {
    this.file = enabled;
    
    if (enabled) {
      if (filePath) {
        this.filePath = filePath;
      }
      
      this._initializeFileLogging();
    }
  }
  
  /**
   * Creates a child logger with the same configuration but a different name.
   * 
   * @param {string} name - Child logger name
   * @returns {Logger} Child logger
   */
  child(name) {
    const childName = `${this.name}.${name}`;
    
    return new Logger({
      name: childName,
      level: this.level,
      console: this.console,
      file: this.file,
      filePath: this.filePath,
      json: this.json,
      configService: this.configService
    });
  }
}

// Export Logger class and LogLevel enum
module.exports = {
  Logger,
  LogLevel
};
