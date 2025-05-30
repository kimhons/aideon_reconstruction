/**
 * @fileoverview AsyncOperation provides utilities for managing asynchronous operations
 * with timeout protection, cancellation support, and proper error handling.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const CancellationToken = require('./CancellationToken');

/**
 * Utilities for managing asynchronous operations.
 */
class AsyncOperation {
  /**
   * Executes an operation with timeout protection.
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Options for execution
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {string} options.operationName - Name of operation for logging
   * @param {Object} options.logger - Logger instance
   * @returns {Promise<any>} Result of the operation
   */
  static async withTimeout(operation, options = {}) {
    const timeout = options.timeout || 10000; // 10 seconds default
    const operationName = options.operationName || 'AsyncOperation';
    const logger = options.logger || console;
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeout}ms`));
      }, timeout);
    });
    
    try {
      // Race the operation against the timeout
      return await Promise.race([
        operation(),
        timeoutPromise
      ]);
    } catch (error) {
      logger.error(`${operationName} failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Executes an operation with cancellation support.
   * @param {Function} operation - Async function that takes a cancellation token
   * @param {Object} options - Options for execution
   * @param {CancellationToken} options.token - Cancellation token
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {string} options.operationName - Name of operation for logging
   * @param {Object} options.logger - Logger instance
   * @returns {Promise<any>} Result of the operation
   */
  static async withCancellation(operation, options = {}) {
    const timeout = options.timeout || 10000; // 10 seconds default
    const operationName = options.operationName || 'AsyncOperation';
    const logger = options.logger || console;
    
    // Create a cancellation token if not provided
    const token = options.token || CancellationToken.withTimeout(timeout, {
      name: operationName,
      logger
    });
    
    try {
      // Execute operation with cancellation token
      return await operation(token);
    } catch (error) {
      if (token.isCancelled()) {
        logger.warn(`${operationName} was cancelled: ${token.getReason()}`);
      } else {
        logger.error(`${operationName} failed: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Retries an operation with exponential backoff.
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Options for execution
   * @param {number} options.maxRetries - Maximum number of retries
   * @param {number} options.initialDelay - Initial delay in milliseconds
   * @param {number} options.maxDelay - Maximum delay in milliseconds
   * @param {Function} options.shouldRetry - Function to determine if retry should be attempted
   * @param {string} options.operationName - Name of operation for logging
   * @param {Object} options.logger - Logger instance
   * @returns {Promise<any>} Result of the operation
   */
  static async withRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const initialDelay = options.initialDelay || 100;
    const maxDelay = options.maxDelay || 5000;
    const operationName = options.operationName || 'AsyncOperation';
    const logger = options.logger || console;
    const shouldRetry = options.shouldRetry || (() => true);
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute operation
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
          logger.error(`${operationName} failed after ${attempt + 1} attempts: ${error.message}`);
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        
        logger.warn(`${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never happen, but just in case
    throw lastError || new Error(`${operationName} failed for unknown reason`);
  }
  
  /**
   * Combines timeout, cancellation, and retry functionality.
   * @param {Function} operation - Async function that takes a cancellation token
   * @param {Object} options - Combined options
   * @returns {Promise<any>} Result of the operation
   */
  static async execute(operation, options = {}) {
    const operationName = options.operationName || 'AsyncOperation';
    const logger = options.logger || console;
    
    // Create retry function
    const retryOperation = () => {
      // Create cancellation function
      return AsyncOperation.withCancellation(
        (token) => operation(token),
        {
          token: options.token,
          timeout: options.timeout,
          operationName,
          logger
        }
      );
    };
    
    // Execute with retry if enabled
    if (options.maxRetries) {
      return AsyncOperation.withRetry(retryOperation, {
        maxRetries: options.maxRetries,
        initialDelay: options.initialDelay,
        maxDelay: options.maxDelay,
        shouldRetry: options.shouldRetry,
        operationName,
        logger
      });
    }
    
    // Otherwise just execute once
    return retryOperation();
  }
}

module.exports = AsyncOperation;
