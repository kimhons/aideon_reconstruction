/**
 * @fileoverview EnhancedAsyncLockAdapter provides a compatibility layer for
 * different EnhancedAsyncLock usage patterns across the codebase.
 * 
 * This adapter supports both the original signature (async function first)
 * and the newer signature (lock name first, then async function).
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EnhancedAsyncLock } = require('./EnhancedAsyncLock');

/**
 * Adapter for EnhancedAsyncLock that supports multiple calling signatures
 */
class EnhancedAsyncLockAdapter {
  /**
   * Creates a new instance of EnhancedAsyncLockAdapter
   */
  constructor() {
    this.locks = new Map();
  }

  /**
   * Acquires a lock and executes the provided function
   * Supports both (asyncFn, lockName) and (lockName, asyncFn) signatures
   * 
   * @param {Function|string} firstParam - Either the async function or lock name
   * @param {string|Function} secondParam - Either the lock name or async function
   * @param {...any} args - Arguments to pass to the async function
   * @returns {Promise<any>} - Result of the async function
   */
  async withLock(firstParam, secondParam, ...args) {
    let asyncFn;
    let lockName;
    let fnArgs = args;

    // Determine which signature is being used
    if (typeof firstParam === 'function') {
      // Original signature: (asyncFn, lockName, ...args)
      asyncFn = firstParam;
      lockName = secondParam || 'default';
    } else if (typeof firstParam === 'string' && typeof secondParam === 'function') {
      // New signature: (lockName, asyncFn, ...args)
      lockName = firstParam;
      asyncFn = secondParam;
    } else {
      throw new Error('Invalid parameters for EnhancedAsyncLockAdapter.withLock');
    }

    // Get or create lock
    if (!this.locks.has(lockName)) {
      this.locks.set(lockName, new EnhancedAsyncLock());
    }
    const lock = this.locks.get(lockName);

    // Execute with lock
    return lock.withLock(asyncFn, ...fnArgs);
  }

  /**
   * Clears all locks
   */
  clearLocks() {
    this.locks.clear();
  }
}

// Export singleton instance
const lockAdapter = new EnhancedAsyncLockAdapter();

module.exports = {
  EnhancedAsyncLockAdapter: lockAdapter
};
