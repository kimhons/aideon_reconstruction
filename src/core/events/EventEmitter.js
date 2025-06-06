/**
 * @fileoverview Event Emitter - Core event system for Aideon
 * 
 * This module provides a simple event emitter implementation for the Aideon system.
 */

/**
 * EventEmitter class - Manages event subscriptions and emissions
 */
class EventEmitter {
  /**
   * Create a new EventEmitter instance
   */
  constructor() {
    this.events = new Map();
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {EventEmitter} - This instance for chaining
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event).push(listener);
    return this;
  }

  /**
   * Register a one-time event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {EventEmitter} - This instance for chaining
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    
    return this.on(event, onceWrapper);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function to remove
   * @returns {EventEmitter} - This instance for chaining
   */
  off(event, listener) {
    if (!this.events.has(event)) {
      return this;
    }
    
    const listeners = this.events.get(event);
    const index = listeners.indexOf(listener);
    
    if (index !== -1) {
      listeners.splice(index, 1);
      
      if (listeners.length === 0) {
        this.events.delete(event);
      }
    }
    
    return this;
  }

  /**
   * Remove all listeners for an event
   * @param {string} [event] - Event name (if omitted, removes all listeners for all events)
   * @returns {EventEmitter} - This instance for chaining
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    
    return this;
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   * @returns {boolean} - Whether the event had listeners
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false;
    }
    
    const listeners = this.events.get(event).slice();
    
    for (const listener of listeners) {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
    
    return true;
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} - Number of listeners
   */
  listenerCount(event) {
    if (!this.events.has(event)) {
      return 0;
    }
    
    return this.events.get(event).length;
  }

  /**
   * Get all listeners for an event
   * @param {string} event - Event name
   * @returns {Function[]} - Array of listener functions
   */
  listeners(event) {
    if (!this.events.has(event)) {
      return [];
    }
    
    return this.events.get(event).slice();
  }
}

module.exports = { EventEmitter };
