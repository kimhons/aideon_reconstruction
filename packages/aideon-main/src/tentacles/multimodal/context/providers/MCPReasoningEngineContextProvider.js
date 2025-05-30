/**
 * @fileoverview MCP Reasoning Engine Context Provider base class.
 * 
 * This class serves as the foundation for all reasoning engine context providers,
 * enabling seamless integration between the Reasoning Engine components and the
 * Model Context Protocol (MCP) system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLockAdapter } = require('../../input/utils/index');

/**
 * Base class for all reasoning engine MCP context providers.
 */
class MCPReasoningEngineContextProvider extends EventEmitter {
  /**
   * Creates a new MCPReasoningEngineContextProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   */
  constructor(options) {
    super();
    
    if (!options || !options.logger || !options.contextManager) {
      throw new Error('MCPReasoningEngineContextProvider requires valid logger and contextManager');
    }
    
    this.logger = options.logger;
    this.contextManager = options.contextManager;
    this.contextTypePrefix = 'reasoning';
    this.initialized = false;
    this.lock = new EnhancedAsyncLockAdapter();
    
    // Default confidence threshold for context operations
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    
    // Default TTL for context entries (in milliseconds)
    this.defaultTTL = options.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours
    
    this.logger.debug('MCPReasoningEngineContextProvider created');
  }
  
  /**
   * Initializes the provider and registers it with the context manager.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    return this.lock.acquire('initialize', async () => {
      if (this.initialized) {
        this.logger.debug('MCPReasoningEngineContextProvider already initialized');
        return true;
      }
      
      try {
        if (!this.contextManager.isInitialized) {
          throw new Error('Context manager must be initialized before provider');
        }
        
        // Register this provider with the context manager
        await this.contextManager.registerContextProvider({
          id: this.constructor.name,
          provider: this,
          supportedTypes: this.getSupportedContextTypes()
        });
        
        this.initialized = true;
        this.logger.info(`${this.constructor.name} initialized successfully`);
        this.emit('initialized');
        return true;
      } catch (error) {
        this.logger.error(`Failed to initialize ${this.constructor.name}:`, error);
        return false;
      }
    });
  }
  
  /**
   * Returns the list of context types supported by this provider.
   * 
   * @returns {Array<string>} List of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.strategy.selection`,
      `${this.contextTypePrefix}.task.execution`,
      `${this.contextTypePrefix}.result.generation`,
      `${this.contextTypePrefix}.explanation.trace`,
      `${this.contextTypePrefix}.uncertainty.assessment`
    ];
  }
  
  /**
   * Adds a new context entry to the MCP system.
   * 
   * @param {string} type - Context type (must be one of supported types)
   * @param {Object} data - Context data
   * @param {number} [confidence=1.0] - Confidence score (0.0 to 1.0)
   * @param {number} [ttl] - Time-to-live in milliseconds
   * @returns {Promise<string>} Context ID if successful
   */
  async addContext(type, data, confidence = 1.0, ttl) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} must be initialized before adding context`);
    }
    
    if (!this.getSupportedContextTypes().includes(type)) {
      throw new Error(`Unsupported context type: ${type}`);
    }
    
    if (confidence < this.confidenceThreshold) {
      this.logger.debug(`Context rejected due to low confidence: ${confidence} < ${this.confidenceThreshold}`);
      return null;
    }
    
    const contextEntry = {
      source: this.constructor.name,
      type,
      data,
      confidence,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
    
    try {
      const contextId = await this.contextManager.addContext(contextEntry);
      this.logger.debug(`Added context ${type} with ID ${contextId}`);
      return contextId;
    } catch (error) {
      this.logger.error(`Failed to add context ${type}:`, error);
      throw error;
    }
  }
  
  /**
   * Queries for context entries of a specific type.
   * 
   * @param {string} type - Context type to query
   * @param {Object} [filter] - Optional filter criteria
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Maximum number of results
   * @param {string} [options.sortBy] - Field to sort by
   * @param {boolean} [options.descending] - Sort in descending order
   * @returns {Promise<Array<Object>>} Matching context entries
   */
  async queryContexts(type, filter = {}, options = {}) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} must be initialized before querying contexts`);
    }
    
    try {
      const contexts = await this.contextManager.queryContexts({
        type,
        ...filter
      }, options);
      
      this.logger.debug(`Retrieved ${contexts.length} contexts of type ${type}`);
      return contexts;
    } catch (error) {
      this.logger.error(`Failed to query contexts of type ${type}:`, error);
      throw error;
    }
  }
  
  /**
   * Updates an existing context entry.
   * 
   * @param {string} contextId - ID of the context to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateContext(contextId, updates) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} must be initialized before updating context`);
    }
    
    try {
      const result = await this.contextManager.updateContext(contextId, updates);
      this.logger.debug(`Updated context ${contextId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update context ${contextId}:`, error);
      throw error;
    }
  }
  
  /**
   * Removes a context entry.
   * 
   * @param {string} contextId - ID of the context to remove
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeContext(contextId) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} must be initialized before removing context`);
    }
    
    try {
      const result = await this.contextManager.removeContext(contextId);
      this.logger.debug(`Removed context ${contextId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to remove context ${contextId}:`, error);
      throw error;
    }
  }
  
  /**
   * Gracefully shuts down the provider.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    return this.lock.acquire('shutdown', async () => {
      if (!this.initialized) {
        this.logger.debug(`${this.constructor.name} not initialized, nothing to shut down`);
        return;
      }
      
      try {
        // Perform any cleanup operations here
        this.initialized = false;
        this.logger.info(`${this.constructor.name} shut down successfully`);
        this.emit('shutdown');
      } catch (error) {
        this.logger.error(`Error during ${this.constructor.name} shutdown:`, error);
        throw error;
      }
    });
  }
}

module.exports = {
  MCPReasoningEngineContextProvider
};
