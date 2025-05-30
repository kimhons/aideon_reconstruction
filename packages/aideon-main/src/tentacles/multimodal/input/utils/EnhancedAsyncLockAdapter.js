/**
 * @fileoverview EnhancedAsyncLockAdapter for thread-safe operations.
 * 
 * This module provides an adapter for the EnhancedAsyncLock to ensure
 * backward compatibility with both old and new lock signatures.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * EnhancedAsyncLockAdapter provides thread-safe locking mechanisms for asynchronous operations.
 * It adapts between different lock signature patterns for backward compatibility.
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
   * @param {string|Function} nameOrFn Lock name or async function to execute
   * @param {Function|Object} fnOrOptions Async function to execute or options
   * @returns {Promise<*>} Result of the function execution
   */
  async withLock(nameOrFn, fnOrOptions) {
    // Handle different signature patterns
    let name;
    let fn;
    
    if (typeof nameOrFn === 'string') {
      // Old signature: withLock(name, fn)
      name = nameOrFn;
      fn = fnOrOptions;
    } else if (typeof nameOrFn === 'function') {
      // New signature: withLock(fn, options)
      name = 'default';
      fn = nameOrFn;
    } else {
      throw new Error('Invalid arguments for withLock');
    }
    
    console.log(`[LOCK] Acquiring lock: ${name}`);
    
    try {
      this.activeLocks.add(name);
      const result = await fn();
      return result;
    } finally {
      this.activeLocks.delete(name);
      console.log(`[LOCK] Released lock: ${name}`);
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

// Export as a named export to match the destructuring import in MCPUIContextProvider.js
exports.EnhancedAsyncLockAdapter = EnhancedAsyncLockAdapter;
