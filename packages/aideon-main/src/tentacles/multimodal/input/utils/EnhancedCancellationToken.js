/**
 * @fileoverview EnhancedCancellationToken provides a mechanism for cancelling
 * asynchronous operations in the Aideon AI Desktop Agent. It allows operations
 * to check if they've been cancelled and react accordingly.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * EnhancedCancellationToken provides cancellation functionality for asynchronous operations.
 */
class EnhancedCancellationToken {
  /**
   * Creates a new EnhancedCancellationToken instance.
   * 
   * @param {boolean} cancelled - Initial cancellation state
   */
  constructor(cancelled = false) {
    this.cancelled = cancelled;
    this.callbacks = [];
  }

  /**
   * Cancels the operation.
   * 
   * @param {string} reason - Optional reason for cancellation
   */
  cancel(reason = 'Operation cancelled') {
    if (!this.cancelled) {
      this.cancelled = true;
      this.reason = reason;
      
      // Notify all registered callbacks
      this.callbacks.forEach(callback => {
        try {
          callback(reason);
        } catch (error) {
          console.error('Error in cancellation callback:', error);
        }
      });
      
      // Clear callbacks after notification
      this.callbacks = [];
    }
  }

  /**
   * Checks if the operation has been cancelled.
   * 
   * @returns {boolean} - True if cancelled
   */
  get isCancelled() {
    return this.cancelled;
  }

  /**
   * Gets the cancellation reason.
   * 
   * @returns {string|undefined} - Reason for cancellation, if any
   */
  get cancellationReason() {
    return this.reason;
  }

  /**
   * Registers a callback to be called when cancellation occurs.
   * 
   * @param {Function} callback - Function to call on cancellation
   * @returns {Function} - Function to unregister the callback
   */
  onCancelled(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // If already cancelled, call immediately
    if (this.cancelled) {
      callback(this.reason);
      return () => {}; // No-op unregister function
    }
    
    // Otherwise, add to callbacks
    this.callbacks.push(callback);
    
    // Return unregister function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Throws an error if the operation has been cancelled.
   * 
   * @throws {Error} - If the operation has been cancelled
   */
  throwIfCancelled() {
    if (this.cancelled) {
      throw new Error(this.reason || 'Operation cancelled');
    }
  }

  /**
   * Creates a linked token that is cancelled when either this token or the other token is cancelled.
   * 
   * @param {EnhancedCancellationToken} other - Another cancellation token
   * @returns {EnhancedCancellationToken} - A new token linked to both
   */
  link(other) {
    if (!(other instanceof EnhancedCancellationToken)) {
      throw new Error('Can only link with another EnhancedCancellationToken');
    }
    
    const linked = new EnhancedCancellationToken(this.cancelled || other.isCancelled);
    
    if (linked.isCancelled) {
      return linked;
    }
    
    // Set up cancellation propagation
    const unregister1 = this.onCancelled(reason => linked.cancel(reason));
    const unregister2 = other.onCancelled(reason => linked.cancel(reason));
    
    // Add cleanup to linked token
    linked.onCancelled(() => {
      unregister1();
      unregister2();
    });
    
    return linked;
  }
}

module.exports = { EnhancedCancellationToken };
