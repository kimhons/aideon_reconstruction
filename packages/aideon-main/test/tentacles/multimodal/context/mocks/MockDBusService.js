/**
 * @fileoverview Mock D-Bus Service for MCP integration tests.
 * 
 * This module provides a mock implementation of the D-Bus service used by the
 * Linux MCP adapter, allowing tests to run without actual D-Bus dependencies.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * Mock D-Bus Service for MCP integration tests.
 * 
 * This class provides a mock implementation of the D-Bus service used by the
 * Linux MCP adapter, allowing tests to run without actual D-Bus dependencies.
 */
class MockDBusService extends EventEmitter {
  /**
   * Creates a new Mock D-Bus Service.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.isRunning = false;
    this.contexts = new Map();
    
    this.logger.info('Mock D-Bus Service created');
  }
  
  /**
   * Starts the Mock D-Bus Service.
   * 
   * @returns {Promise<boolean>} True if service was started successfully
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Mock D-Bus Service already running');
      return true;
    }
    
    try {
      this.logger.info('Starting Mock D-Bus Service');
      
      // Simulate service startup delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.isRunning = true;
      this.emit('started');
      this.logger.info('Mock D-Bus Service started successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to start Mock D-Bus Service:', error);
      throw error;
    }
  }
  
  /**
   * Stops the Mock D-Bus Service.
   * 
   * @returns {Promise<boolean>} True if service was stopped successfully
   */
  async stop() {
    if (!this.isRunning) {
      this.logger.warn('Mock D-Bus Service not running');
      return true;
    }
    
    try {
      this.logger.info('Stopping Mock D-Bus Service');
      
      // Simulate service shutdown delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      this.isRunning = false;
      this.emit('stopped');
      this.logger.info('Mock D-Bus Service stopped successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to stop Mock D-Bus Service:', error);
      throw error;
    }
  }
  
  /**
   * Adds a context to the Mock D-Bus Service.
   * 
   * @param {Object} context - Context object
   * @returns {Promise<string>} Context ID
   */
  async addContext(context) {
    if (!this.isRunning) {
      throw new Error('Mock D-Bus Service not running');
    }
    
    try {
      // Generate ID if not provided
      if (!context.id) {
        context.id = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Store context
      this.contexts.set(context.id, context);
      
      // Emit event
      this.emit('contextAdded', context);
      
      this.logger.debug(`Context added to Mock D-Bus Service: ${context.id}`);
      
      return context.id;
    } catch (error) {
      this.logger.error('Failed to add context to Mock D-Bus Service:', error);
      throw error;
    }
  }
  
  /**
   * Updates a context in the Mock D-Bus Service.
   * 
   * @param {string} contextId - Context ID
   * @param {Object} updates - Context updates
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateContext(contextId, updates) {
    if (!this.isRunning) {
      throw new Error('Mock D-Bus Service not running');
    }
    
    try {
      // Check if context exists
      if (!this.contexts.has(contextId)) {
        throw new Error(`Context not found: ${contextId}`);
      }
      
      // Get current context
      const context = this.contexts.get(contextId);
      
      // Apply updates
      const updatedContext = {
        ...context,
        ...updates,
        id: contextId // Ensure ID doesn't change
      };
      
      // Store updated context
      this.contexts.set(contextId, updatedContext);
      
      // Emit event
      this.emit('contextUpdated', updatedContext);
      
      this.logger.debug(`Context updated in Mock D-Bus Service: ${contextId}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to update context in Mock D-Bus Service:', error);
      throw error;
    }
  }
  
  /**
   * Removes a context from the Mock D-Bus Service.
   * 
   * @param {string} contextId - Context ID
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeContext(contextId) {
    if (!this.isRunning) {
      throw new Error('Mock D-Bus Service not running');
    }
    
    try {
      // Check if context exists
      if (!this.contexts.has(contextId)) {
        throw new Error(`Context not found: ${contextId}`);
      }
      
      // Remove context
      this.contexts.delete(contextId);
      
      // Emit event
      this.emit('contextRemoved', contextId);
      
      this.logger.debug(`Context removed from Mock D-Bus Service: ${contextId}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to remove context from Mock D-Bus Service:', error);
      throw error;
    }
  }
  
  /**
   * Gets a context from the Mock D-Bus Service.
   * 
   * @param {string} contextId - Context ID
   * @returns {Promise<Object|null>} Context object or null if not found
   */
  async getContext(contextId) {
    if (!this.isRunning) {
      throw new Error('Mock D-Bus Service not running');
    }
    
    try {
      // Check if context exists
      if (!this.contexts.has(contextId)) {
        return null;
      }
      
      return this.contexts.get(contextId);
    } catch (error) {
      this.logger.error('Failed to get context from Mock D-Bus Service:', error);
      throw error;
    }
  }
  
  /**
   * Queries contexts from the Mock D-Bus Service.
   * 
   * @param {Object} query - Query parameters
   * @returns {Promise<Array<Object>>} Array of context objects
   */
  async queryContexts(query = {}) {
    if (!this.isRunning) {
      throw new Error('Mock D-Bus Service not running');
    }
    
    try {
      // Get all contexts
      let contexts = Array.from(this.contexts.values());
      
      // Apply type filter
      if (query.type) {
        contexts = contexts.filter(context => context.type === query.type);
      }
      
      // Apply tags filter
      if (query.tags && query.tags.length > 0) {
        contexts = contexts.filter(context => {
          if (!context.tags || !Array.isArray(context.tags)) {
            return false;
          }
          
          return query.tags.every(tag => context.tags.includes(tag));
        });
      }
      
      // Apply confidence filter
      if (query.minConfidence) {
        contexts = contexts.filter(context => 
          typeof context.confidence === 'number' && 
          context.confidence >= query.minConfidence
        );
      }
      
      // Apply sorting
      if (query.sortBy) {
        const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
        
        contexts.sort((a, b) => {
          const valueA = a[query.sortBy];
          const valueB = b[query.sortBy];
          
          if (valueA < valueB) {
            return -1 * sortOrder;
          }
          
          if (valueA > valueB) {
            return 1 * sortOrder;
          }
          
          return 0;
        });
      }
      
      // Apply limit
      if (query.limit && typeof query.limit === 'number') {
        contexts = contexts.slice(0, query.limit);
      }
      
      return contexts;
    } catch (error) {
      this.logger.error('Failed to query contexts from Mock D-Bus Service:', error);
      throw error;
    }
  }
}

module.exports = { MockDBusService };
