/**
 * @fileoverview Stub implementation of MCPContextManager for testing purposes.
 * This file exists to satisfy import requirements during testing.
 * The actual implementation is mocked in tests.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');

/**
 * Model Context Protocol (MCP) Context Manager
 * Stub implementation for testing purposes
 */
class MCPContextManager {
  /**
   * Creates a singleton instance of MCPContextManager
   * 
   * @returns {MCPContextManager} Singleton instance
   */
  static getInstance() {
    if (!MCPContextManager.instance) {
      MCPContextManager.instance = new MCPContextManager();
    }
    return MCPContextManager.instance;
  }
  
  /**
   * Creates a new MCPContextManager instance
   */
  constructor() {
    this.contextProviders = new Map();
    this.contextData = new Map();
    this.events = new EventEmitter();
    this.subscriptions = new Map();
    
    console.log('Stub MCPContextManager initialized');
  }
  
  /**
   * Registers a context provider
   * 
   * @param {string} contextType - Type of context provided
   * @param {Object} provider - Context provider instance
   */
  registerContextProvider(contextType, provider) {
    this.contextProviders.set(contextType, provider);
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
    
    this.events.emit('context_updated', contextType, contextData);
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
}

module.exports = { MCPContextManager };
