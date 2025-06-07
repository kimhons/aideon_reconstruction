/**
 * @fileoverview Event System for managing event emission and subscription.
 * Provides a centralized event bus for tentacles to communicate.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { EventError } = require('../utils/errorHandling');
const Logger = require('./LoggingSystem').Logger;

/**
 * Manages event emission and subscription.
 */
class EventSystem {
  /**
   * Creates a new EventSystem instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._emitter = new EventEmitter();
    this._subscriptions = new Map();
    this._eventHistory = [];
    this._maxHistorySize = options.maxHistorySize || 1000;
    this._initialized = false;
    this._logger = new Logger('aideon:events');
    
    // Set up maximum listeners to avoid memory leaks
    this._emitter.setMaxListeners(options.maxListeners || 100);
  }
  
  /**
   * Initializes the event system.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Initializing event system');
      
      // Set up system events
      this._emitter.on('error', (error) => {
        this._logger.error('Event system error', {
          error: error.message,
          stack: error.stack
        });
      });
      
      this._initialized = true;
      this._logger.info('Event system initialized');
      
      // Emit system:initialized event
      this.emit('system:initialized', { timestamp: Date.now() });
      
      return true;
    } catch (error) {
      this._logger.error('Failed to initialize event system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new EventError('Failed to initialize event system', 'EVENT_INIT_ERROR', error);
    }
  }
  
  /**
   * Shuts down the event system.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Shutting down event system');
      
      // Emit system:shutdown event
      this.emit('system:shutdown', { timestamp: Date.now() });
      
      // Remove all listeners
      this._emitter.removeAllListeners();
      this._subscriptions.clear();
      
      this._initialized = false;
      this._logger.info('Event system shut down');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to shut down event system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new EventError('Failed to shut down event system', 'EVENT_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Subscribes to an event.
   * @param {string} eventName - The event name
   * @param {Function} listener - The event listener
   * @param {Object} [options] - Subscription options
   * @param {boolean} [options.once=false] - Whether to listen only once
   * @param {string} [options.tentacleId] - The ID of the tentacle subscribing
   * @returns {string} The subscription ID
   */
  on(eventName, listener, options = {}) {
    if (!this._initialized) {
      throw new EventError('Event system not initialized', 'EVENT_NOT_INITIALIZED');
    }
    
    if (!eventName || typeof eventName !== 'string') {
      throw new EventError('Invalid event name', 'EVENT_SUBSCRIPTION_ERROR');
    }
    
    if (typeof listener !== 'function') {
      throw new EventError('Invalid event listener', 'EVENT_SUBSCRIPTION_ERROR');
    }
    
    // Generate subscription ID
    const subscriptionId = uuidv4();
    
    // Create wrapper function to track subscription
    const wrappedListener = (data) => {
      try {
        listener(data);
      } catch (error) {
        this._logger.error(`Error in event listener for ${eventName}`, {
          error: error.message,
          stack: error.stack,
          subscriptionId
        });
        
        this._emitter.emit('error', error);
      }
    };
    
    // Store subscription
    this._subscriptions.set(subscriptionId, {
      eventName,
      listener: wrappedListener,
      originalListener: listener,
      tentacleId: options.tentacleId,
      createdAt: Date.now(),
      once: options.once === true
    });
    
    // Register with event emitter
    if (options.once) {
      this._emitter.once(eventName, wrappedListener);
    } else {
      this._emitter.on(eventName, wrappedListener);
    }
    
    this._logger.debug(`Subscribed to event: ${eventName}`, {
      subscriptionId,
      tentacleId: options.tentacleId
    });
    
    return subscriptionId;
  }
  
  /**
   * Subscribes to an event once.
   * @param {string} eventName - The event name
   * @param {Function} listener - The event listener
   * @param {Object} [options] - Subscription options
   * @param {string} [options.tentacleId] - The ID of the tentacle subscribing
   * @returns {string} The subscription ID
   */
  once(eventName, listener, options = {}) {
    return this.on(eventName, listener, { ...options, once: true });
  }
  
  /**
   * Unsubscribes from an event.
   * @param {string} subscriptionId - The subscription ID
   * @returns {boolean} True if unsubscription was successful
   */
  off(subscriptionId) {
    if (!this._initialized) {
      throw new EventError('Event system not initialized', 'EVENT_NOT_INITIALIZED');
    }
    
    // Check if subscription exists
    if (!this._subscriptions.has(subscriptionId)) {
      this._logger.warn(`Subscription not found: ${subscriptionId}`);
      return false;
    }
    
    const subscription = this._subscriptions.get(subscriptionId);
    
    // Remove from event emitter
    this._emitter.removeListener(subscription.eventName, subscription.listener);
    
    // Remove subscription
    this._subscriptions.delete(subscriptionId);
    
    this._logger.debug(`Unsubscribed from event: ${subscription.eventName}`, {
      subscriptionId,
      tentacleId: subscription.tentacleId
    });
    
    return true;
  }
  
  /**
   * Unsubscribes all listeners for a tentacle.
   * @param {string} tentacleId - The tentacle ID
   * @returns {number} The number of unsubscribed listeners
   */
  offAll(tentacleId) {
    if (!this._initialized) {
      throw new EventError('Event system not initialized', 'EVENT_NOT_INITIALIZED');
    }
    
    if (!tentacleId) {
      throw new EventError('Tentacle ID is required', 'EVENT_UNSUBSCRIPTION_ERROR');
    }
    
    let count = 0;
    
    // Find all subscriptions for the tentacle
    for (const [subscriptionId, subscription] of this._subscriptions.entries()) {
      if (subscription.tentacleId === tentacleId) {
        // Remove from event emitter
        this._emitter.removeListener(subscription.eventName, subscription.listener);
        
        // Remove subscription
        this._subscriptions.delete(subscriptionId);
        
        count++;
      }
    }
    
    if (count > 0) {
      this._logger.debug(`Unsubscribed ${count} listeners for tentacle: ${tentacleId}`);
    }
    
    return count;
  }
  
  /**
   * Emits an event.
   * @param {string} eventName - The event name
   * @param {*} data - The event data
   * @returns {boolean} True if emission was successful
   */
  emit(eventName, data) {
    if (!this._initialized) {
      throw new EventError('Event system not initialized', 'EVENT_NOT_INITIALIZED');
    }
    
    if (!eventName || typeof eventName !== 'string') {
      throw new EventError('Invalid event name', 'EVENT_EMISSION_ERROR');
    }
    
    try {
      // Add event to history
      this._addToHistory(eventName, data);
      
      // Emit event
      this._emitter.emit(eventName, data);
      
      this._logger.debug(`Emitted event: ${eventName}`);
      
      return true;
    } catch (error) {
      this._logger.error(`Failed to emit event: ${eventName}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new EventError(`Failed to emit event: ${eventName}`, 'EVENT_EMISSION_ERROR', error);
    }
  }
  
  /**
   * Gets all event subscriptions.
   * @param {Object} [query] - Query parameters
   * @param {string} [query.eventName] - Filter by event name
   * @param {string} [query.tentacleId] - Filter by tentacle ID
   * @returns {Array<Object>} The subscriptions
   */
  getSubscriptions(query = {}) {
    const subscriptions = [];
    
    for (const [id, subscription] of this._subscriptions.entries()) {
      // Apply filters
      if (query.eventName && subscription.eventName !== query.eventName) {
        continue;
      }
      
      if (query.tentacleId && subscription.tentacleId !== query.tentacleId) {
        continue;
      }
      
      subscriptions.push({
        id,
        eventName: subscription.eventName,
        tentacleId: subscription.tentacleId,
        createdAt: subscription.createdAt,
        once: subscription.once
      });
    }
    
    return subscriptions;
  }
  
  /**
   * Gets event history.
   * @param {Object} [query] - Query parameters
   * @param {string} [query.eventName] - Filter by event name
   * @param {number} [query.limit] - Limit the number of events
   * @param {number} [query.offset] - Offset for pagination
   * @param {number} [query.startTime] - Filter by start time
   * @param {number} [query.endTime] - Filter by end time
   * @returns {Array<Object>} The events
   */
  getEvents(query = {}) {
    let events = [...this._eventHistory];
    
    // Apply filters
    if (query.eventName) {
      events = events.filter(event => event.eventName === query.eventName);
    }
    
    if (query.startTime) {
      events = events.filter(event => event.timestamp >= query.startTime);
    }
    
    if (query.endTime) {
      events = events.filter(event => event.timestamp <= query.endTime);
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    if (query.offset) {
      events = events.slice(query.offset);
    }
    
    if (query.limit) {
      events = events.slice(0, query.limit);
    }
    
    return events;
  }
  
  /**
   * Clears event history.
   * @returns {boolean} True if clearing was successful
   */
  clearHistory() {
    this._eventHistory = [];
    return true;
  }
  
  /**
   * Checks if the event system is healthy.
   * @returns {boolean} True if the event system is healthy
   */
  isHealthy() {
    return this._initialized;
  }
  
  /**
   * Adds an event to the history.
   * @param {string} eventName - The event name
   * @param {*} data - The event data
   * @private
   */
  _addToHistory(eventName, data) {
    // Add to history
    this._eventHistory.push({
      id: uuidv4(),
      eventName,
      data,
      timestamp: Date.now()
    });
    
    // Trim history if needed
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory = this._eventHistory.slice(-this._maxHistorySize);
    }
  }
}

module.exports = EventSystem;
