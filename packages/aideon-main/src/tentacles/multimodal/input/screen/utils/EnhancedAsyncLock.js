/**
 * @fileoverview Enhanced AsyncLock with automatic release, timeout detection, and deadlock prevention.
 * 
 * This implementation addresses the critical issues identified in the architectural review:
 * - Automatic lock release through try-finally blocks
 * - Timeout detection to prevent indefinite waits
 * - Deadlock recovery with force release capability
 * - Detailed logging for debugging lock acquisition and release
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Enhanced asynchronous lock with automatic release and timeout detection.
 */
class EnhancedAsyncLock {
  /**
   * Creates a new EnhancedAsyncLock instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {string} options.name - Name of the lock for debugging
   * @param {number} options.defaultTimeout - Default timeout in milliseconds
   * @param {boolean} options.throwOnTimeout - Whether to throw on timeout (default: true)
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.name = options.name || 'AsyncLock';
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds default
    this.throwOnTimeout = options.throwOnTimeout !== false; // Default to true
    
    // Queue of pending lock requests
    this.queue = [];
    
    // Current lock holder
    this.currentLock = null;
    
    // Lock acquisition statistics
    this.stats = {
      acquired: 0,
      released: 0,
      timeouts: 0,
      errors: 0,
      maxWaitTime: 0,
      totalWaitTime: 0
    };
    
    // Bind methods to preserve context
    this.acquire = this.acquire.bind(this);
    this.release = this.release.bind(this);
    this.withLock = this.withLock.bind(this);
    this.isLocked = this.isLocked.bind(this);
    this.forceRelease = this.forceRelease.bind(this);
  }
  
  /**
   * Acquires the lock.
   * @param {Object} options - Acquisition options
   * @param {string} options.owner - Owner identifier for debugging
   * @param {number} options.timeout - Timeout in milliseconds
   * @returns {Promise<Function>} Release function
   */
  acquire(options = {}) {
    const owner = options.owner || 'unknown';
    const timeout = options.timeout || this.defaultTimeout;
    const startTime = Date.now();
    
    this.logger.debug(`[${this.name}] Lock acquisition requested by ${owner}`);
    
    // Create a promise that resolves when the lock is acquired
    return new Promise((resolve, reject) => {
      // Create timeout handler
      const timeoutId = setTimeout(() => {
        // Remove from queue if still pending
        const index = this.queue.findIndex(item => item.owner === owner && item.startTime === startTime);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        
        this.stats.timeouts++;
        const timeoutError = new Error(`[${this.name}] Lock acquisition timed out after ${timeout}ms for ${owner}`);
        timeoutError.code = 'LOCK_TIMEOUT';
        timeoutError.owner = owner;
        timeoutError.timeout = timeout;
        
        this.logger.warn(`[${this.name}] Lock acquisition timed out after ${timeout}ms for ${owner}`);
        
        // If current lock holder is causing problems, log detailed info
        if (this.currentLock) {
          this.logger.warn(`[${this.name}] Current lock holder: ${this.currentLock.owner}, held for ${Date.now() - this.currentLock.acquiredAt}ms`);
        }
        
        if (this.throwOnTimeout) {
          reject(timeoutError);
        } else {
          // Auto-release if configured to not throw
          this.forceRelease();
          resolve(this.createReleaseFunction(owner, startTime));
        }
      }, timeout);
      
      // Create queue item
      const queueItem = {
        owner,
        startTime,
        timeoutId,
        resolve: () => {
          // Clear timeout
          clearTimeout(timeoutId);
          
          // Update stats
          const waitTime = Date.now() - startTime;
          this.stats.acquired++;
          this.stats.totalWaitTime += waitTime;
          if (waitTime > this.stats.maxWaitTime) {
            this.stats.maxWaitTime = waitTime;
          }
          
          // Set current lock holder
          this.currentLock = {
            owner,
            acquiredAt: Date.now()
          };
          
          this.logger.debug(`[${this.name}] Lock acquired by ${owner} after ${waitTime}ms`);
          
          // Resolve with release function
          resolve(this.createReleaseFunction(owner, startTime));
        },
        reject
      };
      
      // Add to queue
      this.queue.push(queueItem);
      
      // Try to acquire immediately
      this.tryAcquireNext();
    });
  }
  
  /**
   * Creates a release function for the given owner.
   * @param {string} owner - Owner identifier
   * @param {number} startTime - Acquisition start time
   * @returns {Function} Release function
   * @private
   */
  createReleaseFunction(owner, startTime) {
    return () => {
      return this.release(owner, startTime);
    };
  }
  
  /**
   * Releases the lock.
   * @param {string} owner - Owner identifier
   * @param {number} startTime - Acquisition start time
   * @returns {boolean} True if released successfully
   */
  release(owner, startTime) {
    // Verify current lock holder
    if (!this.currentLock) {
      this.logger.warn(`[${this.name}] Attempted to release lock by ${owner} but no lock is held`);
      return false;
    }
    
    if (this.currentLock.owner !== owner) {
      this.logger.warn(`[${this.name}] Attempted to release lock by ${owner} but lock is held by ${this.currentLock.owner}`);
      return false;
    }
    
    // Release lock
    const heldTime = Date.now() - this.currentLock.acquiredAt;
    this.currentLock = null;
    this.stats.released++;
    
    this.logger.debug(`[${this.name}] Lock released by ${owner} after holding for ${heldTime}ms`);
    
    // Try to acquire next in queue
    this.tryAcquireNext();
    
    return true;
  }
  
  /**
   * Forces release of the current lock.
   * @returns {boolean} True if a lock was force-released
   */
  forceRelease() {
    if (!this.currentLock) {
      return false;
    }
    
    const owner = this.currentLock.owner;
    const heldTime = Date.now() - this.currentLock.acquiredAt;
    
    this.logger.warn(`[${this.name}] Force releasing lock held by ${owner} for ${heldTime}ms`);
    
    this.currentLock = null;
    this.stats.released++;
    
    // Try to acquire next in queue
    this.tryAcquireNext();
    
    return true;
  }
  
  /**
   * Tries to acquire the lock for the next item in the queue.
   * @private
   */
  tryAcquireNext() {
    // If lock is held or queue is empty, do nothing
    if (this.currentLock || this.queue.length === 0) {
      return;
    }
    
    // Get next item from queue
    const nextItem = this.queue.shift();
    
    // Resolve promise to acquire lock
    nextItem.resolve();
  }
  
  /**
   * Executes a function with the lock acquired.
   * @param {Function} fn - Function to execute with lock
   * @param {Object} options - Lock options
   * @returns {Promise<*>} Result of the function
   */
  async withLock(fn, options = {}) {
    let release = null;
    
    try {
      // Acquire lock
      release = await this.acquire(options);
      
      // Execute function
      return await fn();
    } catch (error) {
      this.stats.errors++;
      this.logger.error(`[${this.name}] Error in locked function: ${error.message}`);
      throw error;
    } finally {
      // Release lock if acquired
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
    return !!this.currentLock;
  }
  
  /**
   * Gets the current lock holder.
   * @returns {Object|null} Current lock holder or null
   */
  getCurrentLockHolder() {
    return this.currentLock;
  }
  
  /**
   * Gets the current queue length.
   * @returns {number} Queue length
   */
  getQueueLength() {
    return this.queue.length;
  }
  
  /**
   * Gets lock statistics.
   * @returns {Object} Lock statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = EnhancedAsyncLock;
