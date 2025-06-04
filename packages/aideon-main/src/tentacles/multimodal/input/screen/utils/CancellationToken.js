/**
 * @fileoverview CancellationToken provides a mechanism to cancel asynchronous operations.
 * Implements the cancellation token pattern for cooperative cancellation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * A token that can be used to cancel asynchronous operations.
 */
class CancellationToken {
  /**
   * Creates a new CancellationToken instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {string} options.name - Name of the token for debugging
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.name = options.name || 'CancellationToken';
    this.cancelled = false;
    this.cancelReason = null;
    this.callbacks = [];
  }

  /**
   * Cancels the operation with an optional reason.
   * @param {string} reason - Reason for cancellation
   * @returns {boolean} True if cancellation was successful
   */
  cancel(reason = 'Operation cancelled') {
    if (this.cancelled) {
      return false;
    }
    
    this.cancelled = true;
    this.cancelReason = reason;
    this.logger.debug(`[${this.name}] Cancelled: ${reason}`);
    
    // Notify all callbacks
    for (const callback of this.callbacks) {
      try {
        callback(reason);
      } catch (error) {
        this.logger.error(`[${this.name}] Error in cancellation callback: ${error.message}`);
      }
    }
    
    // Clear callbacks
    this.callbacks = [];
    
    return true;
  }
  
  /**
   * Checks if the token has been cancelled.
   * @returns {boolean} True if cancelled
   */
  isCancelled() {
    return this.cancelled;
  }
  
  /**
   * Gets the cancellation reason.
   * @returns {string|null} Reason or null if not cancelled
   */
  getReason() {
    return this.cancelReason;
  }
  
  /**
   * Registers a callback to be called when the token is cancelled.
   * @param {Function} callback - Function to call on cancellation
   * @returns {Function} Function to unregister the callback
   */
  onCancel(callback) {
    if (this.cancelled) {
      // If already cancelled, call callback immediately
      try {
        callback(this.cancelReason);
      } catch (error) {
        this.logger.error(`[${this.name}] Error in cancellation callback: ${error.message}`);
      }
      return () => {};
    }
    
    // Add to callbacks
    this.callbacks.push(callback);
    
    // Return function to unregister
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Throws an error if the token has been cancelled.
   * @throws {Error} If the token has been cancelled
   */
  throwIfCancelled() {
    if (this.cancelled) {
      throw new Error(`Operation cancelled: ${this.cancelReason}`);
    }
  }
  
  /**
   * Creates a promise that rejects when the token is cancelled.
   * @returns {Promise<never>} Promise that rejects when cancelled
   */
  asPromise() {
    return new Promise((_, reject) => {
      if (this.cancelled) {
        reject(new Error(`Operation cancelled: ${this.cancelReason}`));
        return;
      }
      
      this.onCancel((reason) => {
        reject(new Error(`Operation cancelled: ${reason}`));
      });
    });
  }
  
  /**
   * Creates a timeout that can be cancelled.
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise<void>} Promise that resolves after timeout or rejects if cancelled
   */
  async timeout(ms) {
    if (this.cancelled) {
      throw new Error(`Operation cancelled: ${this.cancelReason}`);
    }
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unregister();
        resolve();
      }, ms);
      
      const unregister = this.onCancel((reason) => {
        clearTimeout(timeoutId);
        reject(new Error(`Operation cancelled: ${reason}`));
      });
    });
  }
  
  /**
   * Wraps a promise to make it cancellable.
   * @param {Promise<any>} promise - Promise to wrap
   * @returns {Promise<any>} Cancellable promise
   */
  wrap(promise) {
    if (this.cancelled) {
      return Promise.reject(new Error(`Operation cancelled: ${this.cancelReason}`));
    }
    
    return Promise.race([
      promise,
      this.asPromise()
    ]);
  }
}

/**
 * Creates a new CancellationToken with timeout.
 * @param {number} timeout - Timeout in milliseconds
 * @param {Object} options - Configuration options
 * @returns {CancellationToken} New token that will auto-cancel after timeout
 */
CancellationToken.withTimeout = function(timeout, options = {}) {
  const token = new CancellationToken(options);
  const timeoutId = setTimeout(() => {
    token.cancel(`Timeout after ${timeout}ms`);
  }, timeout);
  
  // Register callback to clear timeout if cancelled externally
  token.onCancel(() => {
    clearTimeout(timeoutId);
  });
  
  return token;
};

/**
 * Creates a linked token that is cancelled when any of the source tokens are cancelled.
 * @param {CancellationToken[]} tokens - Source tokens
 * @param {Object} options - Configuration options
 * @returns {CancellationToken} New token linked to source tokens
 */
CancellationToken.fromMultiple = function(tokens, options = {}) {
  const linkedToken = new CancellationToken(options);
  
  // Register callbacks for all source tokens
  const unregisters = tokens.map(token => {
    return token.onCancel((reason) => {
      linkedToken.cancel(`Linked token cancelled: ${reason}`);
    });
  });
  
  // Register callback to unregister all source callbacks when cancelled
  linkedToken.onCancel(() => {
    for (const unregister of unregisters) {
      unregister();
    }
  });
  
  return linkedToken;
};

module.exports = CancellationToken;
