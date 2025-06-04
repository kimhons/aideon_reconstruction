/**
 * @fileoverview Enhanced CancellationToken with timeout support and cooperative cancellation.
 * 
 * This implementation addresses the critical issues identified in the architectural review:
 * - Cooperative cancellation for asynchronous operations
 * - Timeout-based auto-cancellation
 * - Promise integration for cancellable promises
 * - Callback registration for cleanup when operations are cancelled
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Enhanced cancellation token with timeout support and cooperative cancellation.
 */
class EnhancedCancellationToken {
  /**
   * Creates a new EnhancedCancellationToken instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {string} options.name - Name of the token for debugging
   * @param {EnhancedCancellationToken} options.parent - Parent token
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.name = options.name || 'CancellationToken';
    this.parent = options.parent || null;
    
    // Cancellation state
    this.isCancelled = false;
    this.cancelReason = null;
    this.cancelTime = null;
    
    // Registered callbacks
    this.callbacks = [];
    
    // Timeout ID if created with timeout
    this.timeoutId = null;
    
    // Bind methods to preserve context
    this.cancel = this.cancel.bind(this);
    this.throwIfCancelled = this.throwIfCancelled.bind(this);
    this.register = this.register.bind(this);
    this.unregister = this.unregister.bind(this);
    this.wrap = this.wrap.bind(this);
    
    // Register with parent if provided
    if (this.parent) {
      this.parent.register(() => {
        this.cancel(`Parent token ${this.parent.name} was cancelled`);
      });
    }
  }
  
  /**
   * Creates a cancellation token with a timeout.
   * @param {number} timeout - Timeout in milliseconds
   * @param {Object} options - Token options
   * @returns {EnhancedCancellationToken} Cancellation token
   * @static
   */
  static withTimeout(timeout, options = {}) {
    const token = new EnhancedCancellationToken(options);
    
    // Set timeout to auto-cancel
    token.timeoutId = setTimeout(() => {
      token.cancel(`Operation timed out after ${timeout}ms`);
    }, timeout);
    
    return token;
  }
  
  /**
   * Creates a linked token that will be cancelled if any of the source tokens are cancelled.
   * @param {EnhancedCancellationToken[]} tokens - Source tokens
   * @param {Object} options - Token options
   * @returns {EnhancedCancellationToken} Linked token
   * @static
   */
  static any(tokens, options = {}) {
    const linkedToken = new EnhancedCancellationToken(options);
    
    // Register with all source tokens
    tokens.forEach((token, index) => {
      token.register(() => {
        linkedToken.cancel(`Source token ${index} (${token.name}) was cancelled`);
      });
    });
    
    return linkedToken;
  }
  
  /**
   * Cancels the token.
   * @param {string} reason - Cancellation reason
   * @returns {boolean} True if newly cancelled, false if already cancelled
   */
  cancel(reason = 'Operation cancelled') {
    // If already cancelled, do nothing
    if (this.isCancelled) {
      return false;
    }
    
    this.logger.debug(`[${this.name}] Cancellation requested: ${reason}`);
    
    // Update state
    this.isCancelled = true;
    this.cancelReason = reason;
    this.cancelTime = Date.now();
    
    // Clear timeout if set
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // Execute callbacks
    const callbacks = [...this.callbacks]; // Copy to avoid modification during iteration
    callbacks.forEach(callback => {
      try {
        callback(reason);
      } catch (error) {
        this.logger.error(`[${this.name}] Error in cancellation callback: ${error.message}`);
      }
    });
    
    return true;
  }
  
  /**
   * Throws if the token is cancelled.
   * @throws {Error} If token is cancelled
   */
  throwIfCancelled() {
    if (this.isCancelled) {
      const error = new Error(`Operation cancelled: ${this.cancelReason}`);
      error.code = 'OPERATION_CANCELLED';
      error.reason = this.cancelReason;
      error.cancelTime = this.cancelTime;
      throw error;
    }
  }
  
  /**
   * Registers a callback to be executed when the token is cancelled.
   * @param {Function} callback - Callback function
   * @returns {Function} Unregister function
   */
  register(callback) {
    // If already cancelled, execute callback immediately
    if (this.isCancelled) {
      try {
        callback(this.cancelReason);
      } catch (error) {
        this.logger.error(`[${this.name}] Error in immediate cancellation callback: ${error.message}`);
      }
      return () => {}; // No-op unregister function
    }
    
    // Add to callbacks
    this.callbacks.push(callback);
    
    // Return unregister function
    return () => {
      this.unregister(callback);
    };
  }
  
  /**
   * Unregisters a callback.
   * @param {Function} callback - Callback function
   * @returns {boolean} True if callback was found and removed
   */
  unregister(callback) {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Wraps a promise to make it cancellable.
   * @param {Promise} promise - Promise to wrap
   * @returns {Promise} Cancellable promise
   */
  wrap(promise) {
    return new Promise((resolve, reject) => {
      // Register cancellation callback
      const unregister = this.register(reason => {
        const error = new Error(`Operation cancelled: ${reason}`);
        error.code = 'OPERATION_CANCELLED';
        error.reason = reason;
        reject(error);
      });
      
      // Handle promise resolution
      promise.then(
        result => {
          unregister();
          resolve(result);
        },
        error => {
          unregister();
          reject(error);
        }
      );
    });
  }
  
  /**
   * Creates a promise that resolves when cancelled.
   * @returns {Promise} Promise that resolves when cancelled
   */
  whenCancelled() {
    return new Promise(resolve => {
      if (this.isCancelled) {
        resolve(this.cancelReason);
      } else {
        this.register(reason => {
          resolve(reason);
        });
      }
    });
  }
  
  /**
   * Checks if the token is cancelled.
   * @returns {boolean} True if cancelled
   */
  get cancelled() {
    return this.isCancelled;
  }
}

module.exports = EnhancedCancellationToken;
