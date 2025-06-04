/**
 * @fileoverview Mock MCPContextManager for testing.
 * 
 * This module provides a mock implementation of the MCPContextManager for use in tests.
 * It supports all the core functionality of the real MCPContextManager including
 * context registration, updates, requests, and publishing.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */
const EventEmitter = require('events');

/**
 * MockMCPContextManager provides a mock implementation of the MCPContextManager for testing.
 */
class MockMCPContextManager extends EventEmitter {
  /**
   * Constructor for MockMCPContextManager.
   */
  constructor() {
    super();
    this.contextData = new Map();
    this.registeredProviders = new Map();
    this.pendingRequests = new Map();
    this.publishedContexts = new Map();
  }
  
  /**
   * Register a context provider for a specific context type.
   * @param {string} contextType Type of context to register
   * @param {Object} provider Provider instance
   * @returns {Promise<boolean>} True if registration was successful
   */
  async registerContextProvider(contextType, provider) {
    this.registeredProviders.set(contextType, provider);
    return true;
  }
  
  /**
   * Update context data for a specific context type.
   * @param {string} contextType Type of context to update
   * @param {Object} contextData Context data to update
   * @param {string} source Source of the update
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateContext(contextType, contextData, source) {
    this.contextData.set(contextType, {
      data: contextData,
      source,
      timestamp: Date.now()
    });
    
    this.emit('contextUpdated', {
      contextType,
      contextData,
      source,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Get context data for a specific context type.
   * @param {string} contextType Type of context to get
   * @returns {Promise<Object|null>} Context data or null if not found
   */
  async getContext(contextType) {
    const context = this.contextData.get(contextType);
    if (!context) {
      return null;
    }
    
    this.emit('contextAccessed', {
      contextType,
      source: 'test',
      granted: true,
      timestamp: Date.now()
    });
    
    return context.data;
  }
  
  /**
   * Request context data for a specific context type.
   * @param {string} contextType Type of context to request
   * @param {string} source Source of the request
   * @returns {Promise<string>} Request ID
   */
  async requestContext(contextType, source) {
    const requestId = `${contextType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.pendingRequests.set(requestId, {
      contextType,
      source,
      timestamp: Date.now()
    });
    
    this.emit('contextRequested', {
      contextType,
      requestId,
      source,
      timestamp: Date.now()
    });
    
    return requestId;
  }
  
  /**
   * Respond to a context request.
   * @param {string} requestId Request ID to respond to
   * @param {Object} response Response data
   * @returns {Promise<boolean>} True if response was successful
   */
  async respondToContextRequest(requestId, response) {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return false;
    }
    
    this.pendingRequests.delete(requestId);
    
    if (response.contextData) {
      this.contextData.set(request.contextType, {
        data: response.contextData,
        source: response.source,
        timestamp: response.timestamp
      });
    }
    
    return true;
  }
  
  /**
   * Delete context data for a specific context type.
   * @param {string} contextType Type of context to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteContext(contextType) {
    const deleted = this.contextData.delete(contextType);
    
    if (deleted) {
      this.emit('contextDeleted', {
        contextType,
        source: 'test',
        timestamp: Date.now()
      });
    }
    
    return deleted;
  }
  
  /**
   * Publish context data to subscribers.
   * @param {string} contextType Type of context to publish
   * @param {Object} contextData Context data to publish
   * @param {Object} options Publication options
   * @param {string} options.source Source of the publication
   * @param {Array<string>} options.targets Target subscribers (optional)
   * @param {Object} options.metadata Additional metadata (optional)
   * @returns {Promise<boolean>} True if publication was successful
   */
  async publishContext(contextType, contextData, options = {}) {
    const source = options.source || 'unknown';
    const timestamp = Date.now();
    
    // Store published context
    this.publishedContexts.set(contextType, {
      data: contextData,
      source,
      timestamp,
      targets: options.targets || [],
      metadata: options.metadata || {}
    });
    
    // Update context data
    this.contextData.set(contextType, {
      data: contextData,
      source,
      timestamp
    });
    
    // Emit publication event
    this.emit('contextPublished', {
      contextType,
      contextData,
      source,
      timestamp,
      targets: options.targets || [],
      metadata: options.metadata || {}
    });
    
    return true;
  }
}

module.exports = MockMCPContextManager;
