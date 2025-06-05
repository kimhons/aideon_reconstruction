/**
 * @fileoverview Circuit Breaker implementation for the Autonomous Error Recovery System.
 * 
 * Implements the Circuit Breaker pattern to prevent cascading failures and
 * provide resilience to the system when interacting with potentially unstable
 * external dependencies or services.
 */

/**
 * Circuit states
 * @enum {string}
 */
const CircuitState = {
  CLOSED: 'CLOSED',     // Normal operation, requests pass through
  OPEN: 'OPEN',         // Circuit is open, fast-fail all requests
  HALF_OPEN: 'HALF_OPEN' // Testing if the circuit can be closed again
};

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  /**
   * Creates a new CircuitBreaker
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Time in ms before attempting to close circuit again
   * @param {number} [options.halfOpenSuccessThreshold=1] - Number of successes in half-open state before closing
   * @param {Function} [options.onStateChange] - Callback when circuit state changes
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 1;
    this.onStateChange = options.onStateChange || (() => {});
    
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.resetTimer = null;
  }
  
  /**
   * Execute a function with circuit breaker protection
   * 
   * @param {Function} fn - Async function to execute
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the function
   * @throws {Error} - If circuit is open or function fails
   */
  async execute(fn, ...args) {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if it's time to try half-open state
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this._transitionToState(CircuitState.HALF_OPEN);
      } else {
        throw new Error(`Circuit breaker is open. Try again after ${this.resetTimeout}ms`);
      }
    }
    
    try {
      // Execute the function
      const result = await fn(...args);
      
      // Handle success
      this._handleSuccess();
      
      return result;
    } catch (error) {
      // Handle failure
      this._handleFailure();
      
      // Re-throw the original error
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   * @private
   */
  _handleSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this._transitionToState(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success when closed
      this.failureCount = 0;
    }
  }
  
  /**
   * Handle failed execution
   * @private
   */
  _handleFailure() {
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit again
      this._transitionToState(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      
      if (this.failureCount >= this.failureThreshold) {
        this._transitionToState(CircuitState.OPEN);
      }
    }
  }
  
  /**
   * Transition to a new circuit state
   * 
   * @param {CircuitState} newState - New state to transition to
   * @private
   */
  _transitionToState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    // Reset counters
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
    
    // Clear any existing reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    // Set up reset timer if transitioning to open state
    if (newState === CircuitState.OPEN) {
      this.resetTimer = setTimeout(() => {
        this._transitionToState(CircuitState.HALF_OPEN);
      }, this.resetTimeout);
    }
    
    // Notify of state change
    this.onStateChange({
      oldState,
      newState,
      failureCount: this.failureCount,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get current circuit state
   * @returns {CircuitState} - Current circuit state
   */
  getState() {
    return this.state;
  }
  
  /**
   * Force circuit to open state
   * @returns {CircuitBreaker} - This instance for chaining
   */
  forceOpen() {
    this._transitionToState(CircuitState.OPEN);
    return this;
  }
  
  /**
   * Force circuit to closed state
   * @returns {CircuitBreaker} - This instance for chaining
   */
  forceClosed() {
    this._transitionToState(CircuitState.CLOSED);
    return this;
  }
  
  /**
   * Force circuit to half-open state
   * @returns {CircuitBreaker} - This instance for chaining
   */
  forceHalfOpen() {
    this._transitionToState(CircuitState.HALF_OPEN);
    return this;
  }
  
  /**
   * Reset circuit breaker to initial state
   * @returns {CircuitBreaker} - This instance for chaining
   */
  reset() {
    this._transitionToState(CircuitState.CLOSED);
    return this;
  }
}

// Export CircuitBreaker class and CircuitState enum
module.exports = {
  CircuitBreaker,
  CircuitState
};
