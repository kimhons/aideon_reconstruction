/**
 * @fileoverview EnhancedAsyncLock provides a robust mutex implementation for
 * asynchronous operations in the Aideon AI Desktop Agent. It ensures thread safety
 * by allowing only one async operation to execute at a time within a critical section.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * EnhancedAsyncLock provides mutex functionality for asynchronous operations.
 */
class EnhancedAsyncLock {
  /**
   * Creates a new EnhancedAsyncLock instance.
   */
  constructor() {
    this.locked = false;
    this.waitQueue = [];
  }

  /**
   * Acquires the lock and executes the provided function.
   * If the lock is already acquired, waits until it's released.
   * 
   * @param {Function} fn - Async function to execute with the lock
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<any>} - Result of the function execution
   * @throws {Error} - If timeout occurs before lock acquisition
   */
  async acquire(fn, timeout = 30000) {
    // If lock is free, acquire it immediately
    if (!this.locked) {
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.release();
      }
    }

    // Otherwise, wait for lock to be released
    return new Promise((resolve, reject) => {
      // Create timeout if specified
      const timeoutId = timeout > 0 ? setTimeout(() => {
        // Remove from wait queue
        this.waitQueue = this.waitQueue.filter(waiter => waiter !== waiter);
        reject(new Error(`Lock acquisition timed out after ${timeout}ms`));
      }, timeout) : null;

      // Add to wait queue
      const waiter = {
        fn,
        resolve,
        reject,
        timeoutId
      };
      this.waitQueue.push(waiter);
    });
  }

  /**
   * Releases the lock and processes the next waiter in the queue.
   * 
   * @private
   */
  release() {
    if (this.waitQueue.length > 0) {
      // Get next waiter
      const waiter = this.waitQueue.shift();
      
      // Clear timeout if it exists
      if (waiter.timeoutId) {
        clearTimeout(waiter.timeoutId);
      }

      // Execute waiter's function
      Promise.resolve()
        .then(() => waiter.fn())
        .then(
          result => {
            this.release();
            waiter.resolve(result);
          },
          error => {
            this.release();
            waiter.reject(error);
          }
        );
    } else {
      // No waiters, release lock
      this.locked = false;
    }
  }

  /**
   * Checks if the lock is currently acquired.
   * 
   * @returns {boolean} - True if the lock is acquired
   */
  isLocked() {
    return this.locked;
  }

  /**
   * Gets the number of waiters in the queue.
   * 
   * @returns {number} - Number of waiters
   */
  getWaiterCount() {
    return this.waitQueue.length;
  }
}

module.exports = { EnhancedAsyncLock };
