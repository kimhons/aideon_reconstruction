/**
 * @fileoverview EnhancedAsyncOperation provides utilities for managing complex
 * asynchronous operations in the Aideon AI Desktop Agent. It includes support for
 * timeouts, cancellation, retries, and progress tracking.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EnhancedCancellationToken } = require('./EnhancedCancellationToken');

/**
 * @typedef {Object} AsyncOperationOptions
 * @property {number} timeout - Timeout in milliseconds
 * @property {EnhancedCancellationToken} cancellationToken - Token for cancellation
 * @property {number} retryCount - Number of retries on failure
 * @property {number} retryDelay - Delay between retries in milliseconds
 * @property {Function} progressCallback - Callback for progress updates
 */

/**
 * EnhancedAsyncOperation provides utilities for managing complex asynchronous operations.
 */
class EnhancedAsyncOperation {
  /**
   * Creates a new EnhancedAsyncOperation instance.
   * 
   * @param {AsyncOperationOptions} options - Operation options
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.cancellationToken = options.cancellationToken || new EnhancedCancellationToken();
    this.retryCount = options.retryCount || 0;
    this.retryDelay = options.retryDelay || 1000;
    this.progressCallback = options.progressCallback;
    
    this.currentRetry = 0;
    this.progress = 0;
    this.status = 'pending';
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Executes an asynchronous operation with timeout, cancellation, and retry support.
   * 
   * @param {Function} fn - Async function to execute
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the operation
   */
  async execute(fn, ...args) {
    if (typeof fn !== 'function') {
      throw new Error('First argument must be a function');
    }
    
    this.startTime = Date.now();
    this.status = 'running';
    this.updateProgress(0);
    
    try {
      // Check if already cancelled
      if (this.cancellationToken.isCancelled) {
        throw new Error(this.cancellationToken.cancellationReason || 'Operation cancelled');
      }
      
      // Execute with timeout and cancellation
      const result = await this.executeWithRetries(fn, args);
      
      this.status = 'completed';
      this.result = result;
      this.endTime = Date.now();
      this.updateProgress(1);
      
      return result;
    } catch (error) {
      this.status = 'failed';
      this.error = error;
      this.endTime = Date.now();
      
      throw error;
    }
  }

  /**
   * Executes an operation with retry support.
   * 
   * @private
   * @param {Function} fn - Function to execute
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetries(fn, args) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      this.currentRetry = attempt;
      
      try {
        // Execute with timeout and cancellation
        return await this.executeWithTimeoutAndCancellation(fn, args);
      } catch (error) {
        lastError = error;
        
        // Don't retry if cancelled or if this was the last attempt
        if (this.cancellationToken.isCancelled || attempt >= this.retryCount) {
          throw error;
        }
        
        // Wait before retrying
        await this.delay(this.retryDelay);
        
        // Check if cancelled during delay
        if (this.cancellationToken.isCancelled) {
          throw new Error(this.cancellationToken.cancellationReason || 'Operation cancelled');
        }
      }
    }
    
    // This should never be reached, but just in case
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Executes an operation with timeout and cancellation support.
   * 
   * @private
   * @param {Function} fn - Function to execute
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithTimeoutAndCancellation(fn, args) {
    return new Promise((resolve, reject) => {
      let timeoutId = null;
      let isSettled = false;
      
      // Set up cancellation handler
      const unregisterCancellation = this.cancellationToken.onCancelled(reason => {
        if (isSettled) return;
        isSettled = true;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        reject(new Error(reason || 'Operation cancelled'));
      });
      
      // Set up timeout
      if (this.timeout > 0) {
        timeoutId = setTimeout(() => {
          if (isSettled) return;
          isSettled = true;
          
          unregisterCancellation();
          reject(new Error(`Operation timed out after ${this.timeout}ms`));
        }, this.timeout);
      }
      
      // Execute function
      Promise.resolve().then(() => fn(...args)).then(
        result => {
          if (isSettled) return;
          isSettled = true;
          
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          unregisterCancellation();
          resolve(result);
        },
        error => {
          if (isSettled) return;
          isSettled = true;
          
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          unregisterCancellation();
          reject(error);
        }
      );
    });
  }

  /**
   * Updates the progress of the operation.
   * 
   * @param {number} progress - Progress value between 0 and 1
   */
  updateProgress(progress) {
    this.progress = Math.max(0, Math.min(1, progress));
    
    if (this.progressCallback) {
      try {
        this.progressCallback({
          progress: this.progress,
          status: this.status,
          currentRetry: this.currentRetry,
          maxRetries: this.retryCount,
          elapsedTime: this.startTime ? Date.now() - this.startTime : 0
        });
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }

  /**
   * Creates a delay promise.
   * 
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>} - Promise that resolves after the delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancels the operation.
   * 
   * @param {string} reason - Reason for cancellation
   */
  cancel(reason) {
    this.cancellationToken.cancel(reason);
  }

  /**
   * Gets the current status of the operation.
   * 
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      status: this.status,
      progress: this.progress,
      currentRetry: this.currentRetry,
      maxRetries: this.retryCount,
      startTime: this.startTime,
      endTime: this.endTime,
      elapsedTime: this.startTime ? (this.endTime || Date.now()) - this.startTime : 0,
      isCancelled: this.cancellationToken.isCancelled,
      cancellationReason: this.cancellationToken.cancellationReason
    };
  }
}

module.exports = { EnhancedAsyncOperation };
