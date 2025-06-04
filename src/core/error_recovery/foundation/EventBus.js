/**
 * EventBus.js
 * 
 * A centralized event bus for the Autonomous Error Recovery System.
 * Provides robust event registration, propagation, and tracking.
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class EventBus {
  static instance;
  
  /**
   * Creates a new EventBus instance
   */
  constructor() {
    this.emitter = new EventEmitter();
    this.eventRegistry = new Map();
    this.handlerRegistry = new Map();
    this.logger = console;
  }
  
  /**
   * Gets the singleton instance of EventBus
   * 
   * @returns {EventBus} - The singleton EventBus instance
   */
  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * Registers an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   * @param {Object} metadata - Optional metadata about the listener
   * @returns {string} - Unique handler ID for later removal
   */
  on(event, listener, metadata = {}) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }
    
    if (!listener || typeof listener !== 'function') {
      throw new Error(`Invalid listener for event '${event}': must be a function`);
    }
    
    this.emitter.on(event, listener);
    
    // Register the listener for tracking
    if (!this.handlerRegistry.has(event)) {
      this.handlerRegistry.set(event, new Map());
    }
    
    const handlerId = uuidv4();
    this.handlerRegistry.get(event).set(handlerId, {
      listener,
      metadata: {
        ...metadata,
        registeredAt: Date.now()
      }
    });
    
    // Register event metadata
    if (!this.eventRegistry.has(event)) {
      this.eventRegistry.set(event, {
        subscribers: 0,
        lastEmitted: null,
        emitCount: 0
      });
    }
    
    const eventMeta = this.eventRegistry.get(event);
    eventMeta.subscribers++;
    
    this.logger.debug(`Registered listener for event '${event}' with ID ${handlerId}`);
    
    return handlerId;
  }
  
  /**
   * Removes an event listener
   * 
   * @param {string} event - Event name
   * @param {Function|string} listenerOrId - Listener function or handler ID
   * @returns {boolean} - Whether the listener was successfully removed
   */
  off(event, listenerOrId) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }
    
    if (!listenerOrId) {
      throw new Error(`Invalid listener or ID for event '${event}'`);
    }
    
    if (typeof listenerOrId === 'string') {
      // Remove by ID
      if (this.handlerRegistry.has(event)) {
        const handler = this.handlerRegistry.get(event).get(listenerOrId);
        if (handler) {
          this.emitter.off(event, handler.listener);
          this.handlerRegistry.get(event).delete(listenerOrId);
          
          // Update event metadata
          const eventMeta = this.eventRegistry.get(event);
          if (eventMeta) {
            eventMeta.subscribers--;
          }
          
          this.logger.debug(`Removed listener for event '${event}' with ID ${listenerOrId}`);
          return true;
        }
      }
      
      this.logger.warn(`Failed to remove listener: no handler found for event '${event}' with ID ${listenerOrId}`);
      return false;
    } else {
      // Remove by listener function
      this.emitter.off(event, listenerOrId);
      
      // Update handler registry
      if (this.handlerRegistry.has(event)) {
        const handlers = this.handlerRegistry.get(event);
        for (const [id, handler] of handlers.entries()) {
          if (handler.listener === listenerOrId) {
            handlers.delete(id);
            
            // Update event metadata
            const eventMeta = this.eventRegistry.get(event);
            if (eventMeta) {
              eventMeta.subscribers--;
            }
            
            this.logger.debug(`Removed listener for event '${event}' with ID ${id}`);
            return true;
          }
        }
      }
      
      this.logger.warn(`Failed to remove listener: no matching handler found for event '${event}'`);
      return false;
    }
  }
  
  /**
   * Registers a one-time event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   * @param {Object} metadata - Optional metadata about the listener
   * @returns {string} - Unique handler ID for later removal
   */
  once(event, listener, metadata = {}) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }
    
    if (!listener || typeof listener !== 'function') {
      throw new Error(`Invalid listener for event '${event}': must be a function`);
    }
    
    const handlerId = uuidv4();
    
    const onceListener = (...args) => {
      // Remove from registry
      if (this.handlerRegistry.has(event)) {
        this.handlerRegistry.get(event).delete(handlerId);
        
        // Update event metadata
        const eventMeta = this.eventRegistry.get(event);
        if (eventMeta) {
          eventMeta.subscribers--;
        }
      }
      
      // Call original listener
      listener(...args);
    };
    
    this.emitter.once(event, onceListener);
    
    // Register the listener for tracking
    if (!this.handlerRegistry.has(event)) {
      this.handlerRegistry.set(event, new Map());
    }
    
    this.handlerRegistry.get(event).set(handlerId, {
      listener: onceListener,
      metadata: {
        ...metadata,
        once: true,
        registeredAt: Date.now()
      }
    });
    
    // Register event metadata
    if (!this.eventRegistry.has(event)) {
      this.eventRegistry.set(event, {
        subscribers: 0,
        lastEmitted: null,
        emitCount: 0
      });
    }
    
    const eventMeta = this.eventRegistry.get(event);
    eventMeta.subscribers++;
    
    this.logger.debug(`Registered one-time listener for event '${event}' with ID ${handlerId}`);
    
    return handlerId;
  }
  
  /**
   * Emits an event
   * 
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   * @returns {boolean} - Whether any listeners were called
   */
  emit(event, ...args) {
    if (!event || typeof event !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }
    
    // Update event metadata
    if (this.eventRegistry.has(event)) {
      const eventMeta = this.eventRegistry.get(event);
      eventMeta.lastEmitted = Date.now();
      eventMeta.emitCount++;
    } else {
      // Create metadata if this is the first emission
      this.eventRegistry.set(event, {
        subscribers: 0,
        lastEmitted: Date.now(),
        emitCount: 1
      });
    }
    
    const result = this.emitter.emit(event, ...args);
    this.logger.debug(`Emitted event '${event}' with ${result ? 'listeners' : 'no listeners'}`);
    
    return result;
  }
  
  /**
   * Gets metadata for a specific event
   * 
   * @param {string} event - Event name
   * @returns {Object|null} - Event metadata or null if not found
   */
  getEventMetadata(event) {
    return this.eventRegistry.get(event) || null;
  }
  
  /**
   * Gets all registered event names
   * 
   * @returns {Array<string>} - Array of event names
   */
  getRegisteredEvents() {
    return Array.from(this.eventRegistry.keys());
  }
  
  /**
   * Gets all subscribers for a specific event
   * 
   * @param {string} event - Event name
   * @returns {Array<Object>} - Array of subscriber objects with id and metadata
   */
  getEventSubscribers(event) {
    if (!this.handlerRegistry.has(event)) {
      return [];
    }
    
    return Array.from(this.handlerRegistry.get(event).entries())
      .map(([id, handler]) => ({
        id,
        metadata: handler.metadata
      }));
  }
  
  /**
   * Removes all event listeners
   */
  removeAllListeners() {
    this.emitter.removeAllListeners();
    this.handlerRegistry.clear();
    
    // Update event metadata
    for (const [event, metadata] of this.eventRegistry.entries()) {
      metadata.subscribers = 0;
    }
    
    this.logger.info('Removed all event listeners');
  }
  
  /**
   * Resets the event bus to its initial state
   */
  reset() {
    this.emitter.removeAllListeners();
    this.eventRegistry.clear();
    this.handlerRegistry.clear();
    this.logger.info('Event bus reset to initial state');
  }
  
  /**
   * Sets the logger instance
   * 
   * @param {Object} logger - Logger instance with debug, info, warn, error methods
   * @returns {EventBus} - This EventBus instance for chaining
   */
  setLogger(logger) {
    if (!logger || typeof logger !== 'object') {
      throw new Error('Invalid logger: must be an object');
    }
    
    if (!logger.debug || !logger.info || !logger.warn || !logger.error) {
      throw new Error('Invalid logger: must have debug, info, warn, error methods');
    }
    
    this.logger = logger;
    return this;
  }
}

module.exports = EventBus;
