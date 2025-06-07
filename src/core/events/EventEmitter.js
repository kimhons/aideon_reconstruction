/**
 * @fileoverview EventEmitter utility for event-driven architecture across the Aideon system.
 * 
 * This module provides a consistent event handling interface with support for
 * event subscription, emission, and management.
 */

/**
 * EventEmitter class for standardized event handling
 */
class EventEmitter {
  /**
   * Creates a new EventEmitter instance
   */
  constructor() {
    this.events = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.removeAllListeners = this.removeAllListeners.bind(this);
  }
  
  /**
   * Registers an event listener
   * @param {string} event Event name
   * @param {Function} listener Event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event).push({
      listener,
      once: false
    });
    
    return this;
  }
  
  /**
   * Registers a one-time event listener
   * @param {string} event Event name
   * @param {Function} listener Event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  once(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event).push({
      listener,
      once: true
    });
    
    return this;
  }
  
  /**
   * Removes an event listener
   * @param {string} event Event name
   * @param {Function} listener Event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  off(event, listener) {
    if (!this.events.has(event)) {
      return this;
    }
    
    const listeners = this.events.get(event);
    const filteredListeners = listeners.filter(item => item.listener !== listener);
    
    if (filteredListeners.length > 0) {
      this.events.set(event, filteredListeners);
    } else {
      this.events.delete(event);
    }
    
    return this;
  }
  
  /**
   * Emits an event
   * @param {string} event Event name
   * @param {...any} args Arguments to pass to listeners
   * @returns {boolean} True if the event had listeners, false otherwise
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false;
    }
    
    const listeners = this.events.get(event);
    const remainingListeners = [];
    
    // Call all listeners
    for (const item of listeners) {
      item.listener(...args);
      
      // Keep non-once listeners
      if (!item.once) {
        remainingListeners.push(item);
      }
    }
    
    // Update listeners list
    if (remainingListeners.length > 0) {
      this.events.set(event, remainingListeners);
    } else {
      this.events.delete(event);
    }
    
    return true;
  }
  
  /**
   * Removes all listeners for an event or all events
   * @param {string} [event] Event name (if omitted, removes all listeners for all events)
   * @returns {EventEmitter} This instance for chaining
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
   * Gets the number of listeners for an event
   * @param {string} event Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    if (!this.events.has(event)) {
      return 0;
    }
    
    return this.events.get(event).length;
  }
  
  /**
   * Gets all event names with registered listeners
   * @returns {Array<string>} Array of event names
   */
  eventNames() {
    return Array.from(this.events.keys());
  }
}

module.exports = { EventEmitter };
