/**
 * @fileoverview LockAdapter provides thread safety for concurrent operations.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

/**
 * Adapter for thread safety and locking operations
 */
class LockAdapter {
  /**
   * Creates a new LockAdapter instance
   */
  constructor() {
    this.locks = new Map();
  }
  
  /**
   * Acquires a lock for a specific key
   * 
   * @param {string} key - Lock key
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  async acquireLock(key, timeout = 5000) {
    const startTime = Date.now();
    
    while (this.locks.has(key)) {
      // Check for timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Lock acquisition timeout for key: ${key}`);
      }
      
      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Acquire the lock
    this.locks.set(key, Date.now());
  }
  
  /**
   * Releases a lock for a specific key
   * 
   * @param {string} key - Lock key
   * @returns {Promise<boolean>} Whether the lock was released
   */
  async releaseLock(key) {
    if (!this.locks.has(key)) {
      return false;
    }
    
    this.locks.delete(key);
    return true;
  }
  
  /**
   * Checks if a lock is held for a specific key
   * 
   * @param {string} key - Lock key
   * @returns {boolean} Whether the lock is held
   */
  isLocked(key) {
    return this.locks.has(key);
  }
  
  /**
   * Gets the timestamp when a lock was acquired
   * 
   * @param {string} key - Lock key
   * @returns {number|null} Timestamp or null if not locked
   */
  getLockTimestamp(key) {
    return this.locks.get(key) || null;
  }
}

module.exports = { LockAdapter };
