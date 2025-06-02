/**
 * @fileoverview Event bus implementation for the Learning from Demonstration system.
 * Provides a centralized event handling mechanism with support for
 * synchronous and asynchronous event listeners.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const { LearningError } = require('../utils/ErrorHandler');

/**
 * Event bus for the Learning from Demonstration system.
 */
class EventBus {
  /**
   * Creates a new EventBus instance.
   * @param {Object} options - EventBus options
   * @param {Function} [options.logger] - Logger function
   * @param {boolean} [options.captureRejections=true] - Whether to capture promise rejections
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.captureRejections = options.captureRejections !== false;
    this._events = new Map();
    this._onceEvents = new Set();
  }

  /**
   * Adds an event listener.
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} listener - Event listener function
   * @param {Object} [options={}] - Listener options
   * @param {boolean} [options.once=false] - Whether the listener should be invoked only once
   * @param {number} [options.priority=0] - Priority of the listener (higher executes first)
   * @returns {EventBus} This instance for chaining
   */
  on(eventName, listener, options = {}) {
    if (typeof listener !== 'function') {
      throw new LearningError('Event listener must be a function', {
        code: 'INVALID_LISTENER',
        context: { eventName, listenerType: typeof listener }
      });
    }

    if (!this._events.has(eventName)) {
      this._events.set(eventName, []);
    }

    const listeners = this._events.get(eventName);
    const listenerInfo = {
      fn: listener,
      priority: options.priority || 0
    };

    listeners.push(listenerInfo);
    
    // Sort by priority (descending)
    listeners.sort((a, b) => b.priority - a.priority);

    if (options.once) {
      this._onceEvents.add(listener);
    }

    return this;
  }

  /**
   * Adds a one-time event listener.
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} listener - Event listener function
   * @param {Object} [options={}] - Listener options
   * @param {number} [options.priority=0] - Priority of the listener (higher executes first)
   * @returns {EventBus} This instance for chaining
   */
  once(eventName, listener, options = {}) {
    return this.on(eventName, listener, { ...options, once: true });
  }

  /**
   * Removes an event listener.
   * @param {string} eventName - Name of the event to remove listener from
   * @param {Function} listener - Event listener function to remove
   * @returns {EventBus} This instance for chaining
   */
  off(eventName, listener) {
    if (!this._events.has(eventName)) {
      return this;
    }

    const listeners = this._events.get(eventName);
    const index = listeners.findIndex(info => info.fn === listener);

    if (index !== -1) {
      listeners.splice(index, 1);
      this._onceEvents.delete(listener);
      
      // Remove empty listener arrays
      if (listeners.length === 0) {
        this._events.delete(eventName);
      }
    }

    return this;
  }

  /**
   * Emits an event with the given arguments.
   * @param {string} eventName - Name of the event to emit
   * @param {...*} args - Arguments to pass to listeners
   * @returns {boolean} True if the event had listeners, false otherwise
   */
  emit(eventName, ...args) {
    if (!this._events.has(eventName)) {
      return false;
    }

    const listeners = this._events.get(eventName);
    const onceListeners = [];

    // Execute all listeners
    for (const { fn } of listeners) {
      try {
        const result = fn(...args);

        // Handle promise rejections if enabled
        if (this.captureRejections && result instanceof Promise) {
          result.catch(error => {
            this._handleListenerError(error, eventName, fn);
          });
        }

        // Track once listeners for later removal
        if (this._onceEvents.has(fn)) {
          onceListeners.push(fn);
        }
      } catch (error) {
        this._handleListenerError(error, eventName, fn);
      }
    }

    // Remove once listeners
    for (const listener of onceListeners) {
      this.off(eventName, listener);
    }

    return true;
  }

  /**
   * Emits an event and waits for all async listeners to complete.
   * @param {string} eventName - Name of the event to emit
   * @param {...*} args - Arguments to pass to listeners
   * @returns {Promise<Array>} Promise resolving to array of listener results
   */
  async emitAsync(eventName, ...args) {
    if (!this._events.has(eventName)) {
      return [];
    }

    const listeners = this._events.get(eventName);
    const onceListeners = [];
    const results = [];

    // Execute all listeners and collect promises
    for (const { fn } of listeners) {
      try {
        const result = fn(...args);
        results.push(result);

        // Track once listeners for later removal
        if (this._onceEvents.has(fn)) {
          onceListeners.push(fn);
        }
      } catch (error) {
        this._handleListenerError(error, eventName, fn);
        results.push(Promise.reject(error));
      }
    }

    // Remove once listeners
    for (const listener of onceListeners) {
      this.off(eventName, listener);
    }

    // Wait for all promises to settle
    return Promise.all(results.map(result => 
      result instanceof Promise ? result : Promise.resolve(result)
    ));
  }

  /**
   * Returns the number of listeners for a given event.
   * @param {string} eventName - Name of the event
   * @returns {number} Number of listeners
   */
  listenerCount(eventName) {
    if (!this._events.has(eventName)) {
      return 0;
    }
    return this._events.get(eventName).length;
  }

  /**
   * Returns an array of event names with registered listeners.
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return Array.from(this._events.keys());
  }

  /**
   * Returns an array of listeners for a given event.
   * @param {string} eventName - Name of the event
   * @returns {Function[]} Array of listener functions
   */
  listeners(eventName) {
    if (!this._events.has(eventName)) {
      return [];
    }
    return this._events.get(eventName).map(info => info.fn);
  }

  /**
   * Removes all listeners, or those for the specified event.
   * @param {string} [eventName] - Optional event name
   * @returns {EventBus} This instance for chaining
   */
  removeAllListeners(eventName) {
    if (eventName) {
      if (this._events.has(eventName)) {
        // Remove all listeners for this event
        const listeners = this._events.get(eventName);
        for (const { fn } of listeners) {
          this._onceEvents.delete(fn);
        }
        this._events.delete(eventName);
      }
    } else {
      // Remove all listeners for all events
      this._events.clear();
      this._onceEvents.clear();
    }
    return this;
  }

  /**
   * Handles errors from event listeners.
   * @param {Error} error - The error that occurred
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Listener function that threw the error
   * @private
   */
  _handleListenerError(error, eventName, listener) {
    if (this.logger) {
      this.logger.error(`Error in event listener for '${eventName}'`, error, {
        eventName,
        listener: listener.name || 'anonymous'
      });
    } else {
      console.error(`Error in event listener for '${eventName}':`, error);
    }
    
    // Emit error event
    if (eventName !== 'error') {
      this.emit('error', error, { eventName, listener });
    }
  }
}

module.exports = EventBus;
