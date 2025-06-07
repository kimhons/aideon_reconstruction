/**
 * @fileoverview EventEmitter utility for Aideon components
 * 
 * This module provides a standardized event handling interface for all Aideon components.
 */

/**
 * EventEmitter class for standardized event handling across Aideon components
 */
class EventEmitter {
  /**
   * Creates a new EventEmitter instance
   */
  constructor() {
    this.events = {};
    
    // Bind methods to ensure correct 'this' context
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.removeAllListeners = this.removeAllListeners.bind(this);
  }
  
  /**
   * Registers an event listener
   * @param {string} event The event name
   * @param {Function} listener The event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push({
      listener,
      once: false
    });
    
    return this;
  }
  
  /**
   * Registers a one-time event listener
   * @param {string} event The event name
   * @param {Function} listener The event listener function
   * @returns {EventEmitter} This instance for chaining
   */
  once(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push({
      listener,
      once: true
    });
    
    return this;
  }
  
  /**
   * Removes an event listener
   * @param {string} event The event name
   * @param {Function} listener The event listener function to remove
   * @returns {EventEmitter} This instance for chaining
   */
  off(event, listener) {
    if (!this.events[event]) {
      return this;
    }
    
    this.events[event] = this.events[event].filter(item => item.listener !== listener);
    
    return this;
  }
  
  /**
   * Emits an event
   * @param {string} event The event name
   * @param {...*} args Arguments to pass to the listeners
   * @returns {boolean} Whether any listeners were called
   */
  emit(event, ...args) {
    if (!this.events[event]) {
      return false;
    }
    
    const listeners = [...this.events[event]];
    
    // Remove one-time listeners
    this.events[event] = this.events[event].filter(item => !item.once);
    
    // Call listeners
    listeners.forEach(item => {
      try {
        item.listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    
    return true;
  }
  
  /**
   * Removes all listeners for an event
   * @param {string} [event] The event name (if omitted, removes all listeners for all events)
   * @returns {EventEmitter} This instance for chaining
   */
  removeAllListeners(event) {
    if (event) {
      this.events[event] = [];
    } else {
      this.events = {};
    }
    
    return this;
  }
  
  /**
   * Gets the number of listeners for an event
   * @param {string} event The event name
   * @returns {number} The number of listeners
   */
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
  
  /**
   * Gets the event names with registered listeners
   * @returns {string[]} The event names
   */
  eventNames() {
    return Object.keys(this.events);
  }
}

module.exports = { EventEmitter };
