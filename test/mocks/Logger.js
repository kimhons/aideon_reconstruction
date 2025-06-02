/**
 * @fileoverview Mock Logger for testing purposes
 * 
 * This file provides a mock implementation of the Logger utility for testing.
 * It simulates the core functionality of the Logger without requiring the actual implementation.
 * 
 * @module test/mocks/Logger
 */

/**
 * @class Logger
 * @description Mock implementation of the Logger class for testing
 */
class Logger {
  /**
   * Creates an instance of Logger
   * @param {string} name - Logger name
   */
  constructor(name) {
    this.name = name;
  }
  
  /**
   * Logs an info message
   * @param {string} message - Message to log
   */
  info(message) {
    console.log(`[INFO] ${this.name}: ${message}`);
  }
  
  /**
   * Logs a warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    console.warn(`[WARN] ${this.name}: ${message}`);
  }
  
  /**
   * Logs an error message
   * @param {string} message - Message to log
   */
  error(message) {
    console.error(`[ERROR] ${this.name}: ${message}`);
  }
  
  /**
   * Logs a debug message
   * @param {string} message - Message to log
   */
  debug(message) {
    console.debug(`[DEBUG] ${this.name}: ${message}`);
  }
}

/**
 * Gets a logger instance
 * @param {string} name - Logger name
 * @returns {Logger} Logger instance
 */
function getLogger(name) {
  return new Logger(name);
}

module.exports = {
  getLogger
};
