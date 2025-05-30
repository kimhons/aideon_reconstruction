/**
 * @fileoverview EnhancedAsyncLockAdapter provides a compatibility layer for
 * code using the older EnhancedAsyncLock API signature with the new implementation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EnhancedAsyncLock } = require('./EnhancedAsyncLock');

/**
 * EnhancedAsyncLockAdapter wraps EnhancedAsyncLock to provide backward compatibility
 * with code using the older signature (lockName, asyncFn) instead of (asyncFn, timeout).
 */
class EnhancedAsyncLockAdapter {
  /**
   * Creates a new EnhancedAsyncLockAdapter instance.
   */
  constructor() {
    this.lock = new EnhancedAsyncLock();
    this.lockMap = new Map();
  }

  /**
   * Acquires the lock and executes the provided function.
   * Supports both new signature (asyncFn, timeout) and old signature (lockName, asyncFn, timeout).
   * 
   * @param {string|Function} lockNameOrFn - Lock name (old API) or async function (new API)
   * @param {Function|number} asyncFnOrTimeout - Async function (old API) or timeout (new API)
   * @param {number} [timeout] - Optional timeout in milliseconds (old API only)
   * @returns {Promise<any>} - Result of the function execution
   * @throws {Error} - If timeout occurs before lock acquisition
   */
  async acquire(lockNameOrFn, asyncFnOrTimeout, timeout) {
    // Detect which signature is being used
    if (typeof lockNameOrFn === 'string') {
      // Old signature: (lockName, asyncFn, timeout)
      const lockName = lockNameOrFn;
      const asyncFn = asyncFnOrTimeout;
      
      // Create a specific lock for this name if it doesn't exist
      if (!this.lockMap.has(lockName)) {
        this.lockMap.set(lockName, new EnhancedAsyncLock());
      }
      
      // Use the named lock
      return this.lockMap.get(lockName).acquire(asyncFn, timeout);
    } else {
      // New signature: (asyncFn, timeout)
      const asyncFn = lockNameOrFn;
      const newTimeout = asyncFnOrTimeout;
      
      // Use the default lock
      return this.lock.acquire(asyncFn, newTimeout);
    }
  }

  /**
   * Checks if the lock is currently acquired.
   * 
   * @param {string} [lockName] - Optional lock name for checking specific locks
   * @returns {boolean} - True if the lock is acquired
   */
  isLocked(lockName) {
    if (lockName && this.lockMap.has(lockName)) {
      return this.lockMap.get(lockName).isLocked();
    }
    return this.lock.isLocked();
  }

  /**
   * Gets the number of waiters in the queue.
   * 
   * @param {string} [lockName] - Optional lock name for checking specific locks
   * @returns {number} - Number of waiters
   */
  getWaiterCount(lockName) {
    if (lockName && this.lockMap.has(lockName)) {
      return this.lockMap.get(lockName).getWaiterCount();
    }
    return this.lock.getWaiterCount();
  }
}

module.exports = { EnhancedAsyncLockAdapter };
