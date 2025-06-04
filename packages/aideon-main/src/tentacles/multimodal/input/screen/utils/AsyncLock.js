/**
 * @fileoverview AsyncLock provides a robust locking mechanism for asynchronous operations.
 * Implements automatic release, timeout detection, and deadlock prevention.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * A robust asynchronous locking mechanism with timeout and automatic release.
 */
class AsyncLock {
  /**
   * Creates a new AsyncLock instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {number} options.defaultTimeout - Default timeout in milliseconds
   * @param {string} options.name - Name of the lock for debugging
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.defaultTimeout = options.defaultTimeout || 10000; // 10 seconds default
    this.name = options.name || 'AsyncLock';
    this.locked = false;
    this.owner = null;
    this.queue = [];
    this.lockTime = null;
    this.lockTimeout = null;
  }

  /**
   * Acquires the lock with timeout protection.
   * @param {Object} options - Acquisition options
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {string} options.owner - Owner identifier for debugging
   * @returns {Promise<Function>} Release function to be called when done
   */
  async acquire(options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const owner = options.owner || 'unknown';
    
    // Create a unique release token
    const releaseToken = Symbol(`${this.name}-release-${Date.now()}`);
    
    // Function to release the lock
    const release = () => {
      if (this.locked && this.owner === releaseToken) {
        this.logger.debug(`[${this.name}] Released by ${owner}`);
        this.locked = false;
        this.owner = null;
        this.lockTime = null;
        
        // Clear timeout if it exists
        if (this.lockTimeout) {
          clearTimeout(this.lockTimeout);
          this.lockTimeout = null;
        }
        
        // Process next in queue if any
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next.resolve();
        }
        
        return true;
      }
      return false;
    };
    
    // If lock is already acquired, wait in queue
    if (this.locked) {
      this.logger.debug(`[${this.name}] ${owner} waiting for lock (${this.queue.length} others waiting)`);
      
      // Create a promise that resolves when lock is available
      const waitPromise = new Promise((resolve, reject) => {
        // Add to queue
        this.queue.push({ resolve, reject, owner });
        
        // Create a timeout for waiting
        setTimeout(() => {
          // Remove from queue if still waiting
          const index = this.queue.findIndex(item => item.resolve === resolve);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(new Error(`[${this.name}] Timeout waiting for lock (${timeout}ms) - owner: ${owner}`));
          }
        }, timeout);
      });
      
      // Wait for lock to be available
      try {
        await waitPromise;
      } catch (error) {
        this.logger.warn(`[${this.name}] ${error.message}`);
        throw error;
      }
    }
    
    // Acquire lock
    this.locked = true;
    this.owner = releaseToken;
    this.lockTime = Date.now();
    this.logger.debug(`[${this.name}] Acquired by ${owner}`);
    
    // Set timeout for lock
    this.lockTimeout = setTimeout(() => {
      this.logger.warn(`[${this.name}] Lock timeout (${timeout}ms) - owner: ${owner}`);
      release();
    }, timeout);
    
    // Return release function
    return release;
  }
  
  /**
   * Executes a function with the lock and automatically releases it.
   * @param {Function} fn - Function to execute with lock
   * @param {Object} options - Acquisition options
   * @returns {Promise<*>} Result of the function
   */
  async withLock(fn, options = {}) {
    let release = null;
    try {
      release = await this.acquire(options);
      return await fn();
    } finally {
      if (release) {
        release();
      }
    }
  }
  
  /**
   * Checks if the lock is currently held.
   * @returns {boolean} True if locked
   */
  isLocked() {
    return this.locked;
  }
  
  /**
   * Gets the time the lock has been held.
   * @returns {number} Time in milliseconds or 0 if not locked
   */
  getLockTime() {
    if (!this.lockTime) {
      return 0;
    }
    return Date.now() - this.lockTime;
  }
  
  /**
   * Gets the number of waiters in the queue.
   * @returns {number} Number of waiters
   */
  getWaiterCount() {
    return this.queue.length;
  }
  
  /**
   * Forces release of the lock regardless of owner.
   * Use with caution as it can lead to inconsistent state.
   * @returns {boolean} True if lock was released
   */
  forceRelease() {
    if (!this.locked) {
      return false;
    }
    
    this.logger.warn(`[${this.name}] Force releasing lock`);
    this.locked = false;
    this.owner = null;
    this.lockTime = null;
    
    // Clear timeout if it exists
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
    
    // Process next in queue if any
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next.resolve();
    }
    
    return true;
  }
}

module.exports = AsyncLock;
