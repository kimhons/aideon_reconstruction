/**
 * @fileoverview Mock EnhancedAsyncLockAdapter for testing.
 * 
 * This module provides a mock implementation of the EnhancedAsyncLockAdapter
 * for use in testing environments.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Mock implementation of EnhancedAsyncLockAdapter.
 * Provides thread-safe locking mechanisms for asynchronous operations.
 */
class EnhancedAsyncLockAdapter {
  /**
   * Constructor for EnhancedAsyncLockAdapter.
   */
  constructor() {
    this.locks = new Map();
    this.activeLocks = new Set();
  }

  /**
   * Acquire a lock, execute a function, and release the lock.
   * @param {string} name Lock name
   * @param {Function} fn Async function to execute while lock is held
   * @returns {Promise<*>} Result of the function execution
   */
  async withLock(name, fn) {
    console.log(`[MOCK_LOCK] Acquiring lock: ${name}`);
    
    // Simple mock implementation that just executes the function
    try {
      this.activeLocks.add(name);
      const result = await fn();
      return result;
    } finally {
      this.activeLocks.delete(name);
      console.log(`[MOCK_LOCK] Released lock: ${name}`);
    }
  }

  /**
   * Check if a lock is currently held.
   * @param {string} name Lock name
   * @returns {boolean} True if lock is held
   */
  isLocked(name) {
    return this.activeLocks.has(name);
  }
}

module.exports = EnhancedAsyncLockAdapter;
