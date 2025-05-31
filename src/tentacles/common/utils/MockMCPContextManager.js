/**
 * @fileoverview Mock implementation of MCPContextManager for testing the Emotional Intelligence module.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');

/**
 * Mock implementation of MCPContextManager for testing
 */
class MockMCPContextManager {
  /**
   * Creates a singleton instance of MockMCPContextManager
   * 
   * @returns {MockMCPContextManager} Singleton instance
   */
  static getInstance() {
    if (!MockMCPContextManager.instance) {
      MockMCPContextManager.instance = new MockMCPContextManager();
    }
    return MockMCPContextManager.instance;
  }
  
  /**
   * Creates a new MockMCPContextManager instance
   */
  constructor() {
    this.contextProviders = new Map();
    this.contextData = new Map();
    this.events = new EventEmitter();
    this.subscriptions = new Map();
    
    console.log('MockMCPContextManager initialized');
  }
  
  /**
   * Registers a context provider
   * 
   * @param {string} contextType - Type of context provided
   * @param {Object} provider - Context provider instance
   */
  registerContextProvider(contextType, provider) {
    this.contextProviders.set(contextType, provider);
    console.log(`Registered context provider for type: ${contextType}`);
  }
  
  /**
   * Publishes context data
   * 
   * @param {string} contextType - Type of context being published
   * @param {Object} contextData - Context data to publish
   * @param {Object} [options] - Publication options
   */
  publishContext(contextType, contextData, options = {}) {
    this.contextData.set(contextType, {
      data: contextData,
      timestamp: Date.now(),
      source: options.source || 'unknown'
    });
    
    // Notify subscribers
    this.events.emit('context_updated', contextType, contextData);
    console.log(`Published context for type: ${contextType}`);
  }
  
  /**
   * Gets context data
   * 
   * @param {string} contextType - Type of context to retrieve
   * @param {Object} [options] - Retrieval options
   * @returns {Object|null} Context data or null if not found
   */
  getContext(contextType, options = {}) {
    const contextEntry = this.contextData.get(contextType);
    if (!contextEntry) {
      return null;
    }
    
    return contextEntry.data;
  }
  
  /**
   * Subscribes to context updates
   * 
   * @param {string} contextType - Type of context to subscribe to
   * @param {Function} callback - Callback function for updates
   * @param {Object} [options] - Subscription options
   * @returns {string} Subscription ID
   */
  subscribeToContext(contextType, callback, options = {}) {
    const subscriptionId = `sub_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    const listener = (type, data) => {
      if (type === contextType) {
        callback(data);
      }
    };
    
    this.events.on('context_updated', listener);
    this.subscriptions.set(subscriptionId, { contextType, listener });
    
    console.log(`Subscribed to context type: ${contextType}, ID: ${subscriptionId}`);
    return subscriptionId;
  }
  
  /**
   * Unsubscribes from context updates
   * 
   * @param {string} subscriptionId - ID of subscription to cancel
   * @returns {boolean} Whether unsubscription was successful
   */
  unsubscribeFromContext(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }
    
    this.events.off('context_updated', subscription.listener);
    this.subscriptions.delete(subscriptionId);
    
    console.log(`Unsubscribed from context, ID: ${subscriptionId}`);
    return true;
  }
  
  /**
   * Registers an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    this.events.on(event, listener);
  }
  
  /**
   * Removes an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
  
  /**
   * Resets the mock for testing
   */
  reset() {
    this.contextProviders.clear();
    this.contextData.clear();
    this.subscriptions.clear();
    this.events.removeAllListeners();
    
    console.log('MockMCPContextManager reset');
  }
}

module.exports = { MCPContextManager: MockMCPContextManager };
