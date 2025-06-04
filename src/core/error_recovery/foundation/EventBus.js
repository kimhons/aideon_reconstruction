/**
 * @fileoverview Enhanced EventBus implementation with improved debugging, instance tracking,
 * and robust event handling for the Autonomous Error Recovery System.
 * 
 * @module core/error_recovery/foundation/EventBus
 */

const EventEmitter = require('events');

/**
 * Enhanced EventBus with debugging capabilities and instance tracking.
 * Provides a robust event system for component communication.
 */
class EventBus {
  /**
   * Creates a new EventBus instance.
   * @param {Object} options - Configuration options
   * @param {number} [options.maxHistorySize=1000] - Maximum number of events to keep in history
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    // Create unique instance ID for tracking
    this.instanceId = Math.random().toString(36).substr(2, 9);
    
    // Create internal event emitter
    this.emitter = new EventEmitter();
    
    // Configure options
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.debug = options.debug || false;
    
    // Event history tracking
    this.eventHistory = [];
    this.historyEnabled = true;
    
    // Debug output
    console.log(`Created EventBus with ID: ${this.instanceId}`);
    console.log(`Event history tracking enabled with max size ${this.maxHistorySize}`);
  }
  
  /**
   * Registers an event listener.
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {EventBus} This EventBus instance for chaining
   */
  on(event, listener) {
    // Generate unique ID for this listener for tracking
    const listenerId = require('crypto').randomUUID();
    
    // Debug output
    if (this.debug) {
      console.log(`[${this.instanceId}] Registering listener for event '${event}' with ID ${listenerId}`);
    }
    
    // Wrap listener to add debugging
    const wrappedListener = (...args) => {
      if (this.debug) {
        console.log(`[${this.instanceId}] Listener ${listenerId} called for event '${event}'`);
      }
      return listener(...args);
    };
    
    // Store original listener for removal
    wrappedListener.originalListener = listener;
    wrappedListener.listenerId = listenerId;
    
    // Register with emitter
    this.emitter.on(event, wrappedListener);
    
    // Debug output
    console.log(`Registered listener for event '${event}' with ID ${listenerId}`);
    
    return this;
  }
  
  /**
   * Registers a one-time event listener.
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @returns {EventBus} This EventBus instance for chaining
   */
  once(event, listener) {
    // Generate unique ID for this listener for tracking
    const listenerId = require('crypto').randomUUID();
    
    // Debug output
    if (this.debug) {
      console.log(`[${this.instanceId}] Registering one-time listener for event '${event}' with ID ${listenerId}`);
    }
    
    // Wrap listener to add debugging
    const wrappedListener = (...args) => {
      if (this.debug) {
        console.log(`[${this.instanceId}] One-time listener ${listenerId} called for event '${event}'`);
      }
      return listener(...args);
    };
    
    // Store original listener for removal
    wrappedListener.originalListener = listener;
    wrappedListener.listenerId = listenerId;
    
    // Register with emitter
    this.emitter.once(event, wrappedListener);
    
    return this;
  }
  
  /**
   * Removes an event listener.
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function to remove
   * @returns {EventBus} This EventBus instance for chaining
   */
  off(event, listener) {
    // Find wrapped listener
    const listeners = this.emitter.listeners(event);
    const wrappedListener = listeners.find(l => l.originalListener === listener);
    
    if (wrappedListener) {
      // Debug output
      if (this.debug) {
        console.log(`[${this.instanceId}] Removing listener ${wrappedListener.listenerId} for event '${event}'`);
      }
      
      // Remove from emitter
      this.emitter.off(event, wrappedListener);
    } else {
      // Direct removal attempt
      this.emitter.off(event, listener);
    }
    
    return this;
  }
  
  /**
   * Emits an event.
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   * @returns {boolean} True if the event had listeners, false otherwise
   */
  emit(event, ...args) {
    // Track in history if enabled
    if (this.historyEnabled) {
      const eventData = args[0] || {};
      this.eventHistory.push({
        event,
        args,
        data: eventData,
        timestamp: Date.now()
      });
      
      // Trim history if needed
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }
    }
    
    // Get listener count for debugging
    const listenerCount = this.emitter.listenerCount(event);
    
    // Debug output
    const listenerText = listenerCount > 0 ? `with ${listenerCount} listeners` : 'with no listeners';
    console.log(`Emitted event '${event}' ${listenerText}`);
    
    // Emit event
    return this.emitter.emit(event, ...args);
  }
  
  /**
   * Gets the number of listeners for an event.
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.emitter.listenerCount(event);
  }
  
  /**
   * Gets all listeners for an event.
   * @param {string} event - Event name
   * @returns {Function[]} Array of listener functions
   */
  listeners(event) {
    return this.emitter.listeners(event);
  }
  
  /**
   * Removes all listeners for an event or all events.
   * @param {string} [event] - Event name, or all events if not specified
   * @returns {EventBus} This EventBus instance for chaining
   */
  removeAllListeners(event) {
    // Debug output
    if (this.debug) {
      if (event) {
        console.log(`[${this.instanceId}] Removing all listeners for event '${event}'`);
      } else {
        console.log(`[${this.instanceId}] Removing all listeners for all events`);
      }
    }
    
    // Remove listeners
    this.emitter.removeAllListeners(event);
    console.log('Removed all event listeners');
    
    return this;
  }
  
  /**
   * Gets the event history.
   * @returns {Array} Event history
   */
  getEventHistory() {
    return [...this.eventHistory];
  }
  
  /**
   * Alias for getEventHistory for backward compatibility.
   * @returns {Array} Event history
   */
  getHistory() {
    return this.getEventHistory();
  }
  
  /**
   * Clears the event history.
   * @returns {EventBus} This EventBus instance for chaining
   */
  clearEventHistory() {
    this.eventHistory = [];
    console.log('Event history cleared');
    return this;
  }
  
  /**
   * Enables or disables event history tracking.
   * @param {boolean} enabled - Whether to enable history tracking
   * @returns {EventBus} This EventBus instance for chaining
   */
  setHistoryTracking(enabled) {
    this.historyEnabled = enabled;
    console.log(`Event history tracking ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }
  
  /**
   * Gets the current state of the EventBus for debugging.
   * @returns {Object} EventBus state
   */
  getDebugState() {
    const events = {};
    const eventNames = this.emitter.eventNames();
    
    for (const event of eventNames) {
      events[event] = this.emitter.listenerCount(event);
    }
    
    return {
      instanceId: this.instanceId,
      events,
      historySize: this.eventHistory.length,
      historyEnabled: this.historyEnabled
    };
  }
  
  /**
   * Prints the current state of the EventBus for debugging.
   */
  printDebugState() {
    const state = this.getDebugState();
    console.log('EventBus Debug State:');
    console.log(`- Instance ID: ${state.instanceId}`);
    console.log('- Event Listeners:');
    
    const eventNames = this.emitter.eventNames();
    for (const event of eventNames) {
      console.log(`  - ${event}: ${this.emitter.listenerCount(event)} listeners`);
    }
    
    console.log(`- History Size: ${state.historySize}`);
    console.log(`- History Enabled: ${state.historyEnabled}`);
  }
}

module.exports = EventBus;
