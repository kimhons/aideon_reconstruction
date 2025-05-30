/**
 * @fileoverview Enhanced AsyncOperation utility for timeout protection, cancellation, and retry logic.
 * 
 * This implementation addresses the critical issues identified in the architectural review:
 * - Timeout protection for all asynchronous operations
 * - Cancellation support for long-running tasks
 * - Retry logic with configurable strategies
 * - Detailed logging for operation tracking
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EnhancedCancellationToken = require('./EnhancedCancellationToken');

/**
 * Enhanced asynchronous operation utility with timeout protection, cancellation, and retry logic.
 */
class EnhancedAsyncOperation {
  /**
   * Executes an asynchronous operation with timeout protection, cancellation, and retry logic.
   * @param {Function} operation - Asynchronous operation function that takes a cancellation token
   * @param {Object} options - Execution options
   * @param {EnhancedCancellationToken} options.token - Cancellation token
   * @param {string} options.operationName - Operation name for debugging
   * @param {Object} options.logger - Logger instance
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {number} options.retries - Maximum number of retry attempts
   * @param {number} options.retryDelay - Delay between retries in milliseconds
   * @param {Function} options.retryStrategy - Function to calculate retry delay
   * @returns {Promise<*>} Operation result
   * @static
   */
  static async execute(operation, options = {}) {
    const operationName = options.operationName || 'AsyncOperation';
    const logger = options.logger || console;
    const timeout = options.timeout || 30000; // 30 seconds default
    const retries = options.retries || 0;
    const retryDelay = options.retryDelay || 1000; // 1 second default
    const retryStrategy = options.retryStrategy || ((attempt) => attempt * retryDelay);
    
    // Create cancellation token with timeout if not provided
    const token = options.token || EnhancedCancellationToken.withTimeout(timeout, {
      name: `${operationName}-Token`,
      logger
    });
    
    logger.debug(`[${operationName}] Starting operation with ${retries} retries and ${timeout}ms timeout`);
    
    let attempt = 0;
    let lastError = null;
    
    while (attempt <= retries) {
      try {
        // Check if already cancelled
        token.throwIfCancelled();
        
        // Execute operation with cancellation token
        const startTime = Date.now();
        const result = await Promise.race([
          operation(token),
          token.whenCancelled().then(reason => {
            throw new Error(`Operation cancelled: ${reason}`);
          })
        ]);
        
        const duration = Date.now() - startTime;
        logger.debug(`[${operationName}] Operation completed successfully in ${duration}ms`);
        
        return result;
      } catch (error) {
        // If cancelled, don't retry
        if (error.code === 'OPERATION_CANCELLED') {
          logger.warn(`[${operationName}] Operation cancelled: ${error.message}`);
          throw error;
        }
        
        lastError = error;
        attempt++;
        
        // If max retries reached, throw last error
        if (attempt > retries) {
          logger.error(`[${operationName}] Operation failed after ${attempt} attempts: ${error.message}`);
          throw error;
        }
        
        // Calculate retry delay
        const delay = retryStrategy(attempt);
        
        logger.warn(`[${operationName}] Attempt ${attempt}/${retries} failed: ${error.message}. Retrying in ${delay}ms...`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached due to the throw in the loop
    throw lastError || new Error(`Operation failed for unknown reason`);
  }
  
  /**
   * Creates a retry strategy with exponential backoff.
   * @param {number} baseDelay - Base delay in milliseconds
   * @param {number} maxDelay - Maximum delay in milliseconds
   * @returns {Function} Retry strategy function
   * @static
   */
  static exponentialBackoff(baseDelay = 1000, maxDelay = 30000) {
    return (attempt) => {
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      return delay;
    };
  }
  
  /**
   * Creates a retry strategy with linear backoff.
   * @param {number} baseDelay - Base delay in milliseconds
   * @param {number} increment - Increment per attempt in milliseconds
   * @param {number} maxDelay - Maximum delay in milliseconds
   * @returns {Function} Retry strategy function
   * @static
   */
  static linearBackoff(baseDelay = 1000, increment = 1000, maxDelay = 30000) {
    return (attempt) => {
      const delay = Math.min(baseDelay + (attempt - 1) * increment, maxDelay);
      return delay;
    };
  }
}

module.exports = EnhancedAsyncOperation;
