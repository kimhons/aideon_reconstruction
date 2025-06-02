/**
 * @fileoverview Core integration module for Aideon AI Desktop Agent.
 * Provides utilities and interfaces for component integration across tentacles.
 * 
 * @module core/integration
 */

/**
 * Integration utilities for cross-tentacle communication and data sharing
 */
class Integration {
  /**
   * Create a new Integration instance
   */
  constructor() {
    this.registeredComponents = new Map();
    this.eventListeners = new Map();
  }

  /**
   * Register a component for integration
   * @param {String} componentId - Unique identifier for the component
   * @param {Object} component - The component instance
   * @param {Object} metadata - Additional metadata about the component
   * @returns {Boolean} Success status
   */
  registerComponent(componentId, component, metadata = {}) {
    if (this.registeredComponents.has(componentId)) {
      return false;
    }
    
    this.registeredComponents.set(componentId, {
      component,
      metadata,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Get a registered component
   * @param {String} componentId - Unique identifier for the component
   * @returns {Object|null} The component or null if not found
   */
  getComponent(componentId) {
    const entry = this.registeredComponents.get(componentId);
    return entry ? entry.component : null;
  }

  /**
   * Publish an event to all subscribers
   * @param {String} eventType - Type of event
   * @param {Object} eventData - Event data
   * @returns {Promise<Array>} Array of results from event handlers
   */
  async publishEvent(eventType, eventData) {
    if (!this.eventListeners.has(eventType)) {
      return [];
    }
    
    const listeners = this.eventListeners.get(eventType);
    const results = [];
    
    for (const listener of listeners) {
      try {
        const result = await listener(eventData);
        results.push(result);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
        results.push({ error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Subscribe to an event
   * @param {String} eventType - Type of event
   * @param {Function} callback - Event handler function
   * @returns {Function} Unsubscribe function
   */
  subscribeToEvent(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType);
    listeners.push(callback);
    
    return () => {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Execute a request across tentacles
   * @param {String} targetTentacle - Target tentacle ID
   * @param {Object} request - Request object
   * @returns {Promise<Object>} Response from the target tentacle
   */
  async executeRequest(targetTentacle, request) {
    const tentacle = this.getComponent(targetTentacle);
    
    if (!tentacle) {
      throw new Error(`Target tentacle not found: ${targetTentacle}`);
    }
    
    if (!tentacle.handleRequest) {
      throw new Error(`Target tentacle does not support request handling: ${targetTentacle}`);
    }
    
    return await tentacle.handleRequest(request);
  }
}

// Export singleton instance
module.exports = new Integration();
