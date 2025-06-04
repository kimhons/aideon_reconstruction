/**
 * ContextManager.js
 * 
 * A robust context management system for the Autonomous Error Recovery System.
 * Ensures context preservation across component boundaries and provides validation.
 */

const { v4: uuidv4 } = require('uuid');

class ContextManager {
  /**
   * Creates a new ContextManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus instance for emitting context events
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.contexts = new Map();
    this.logger = options.logger || console;
    this.eventBus = options.eventBus;
    this.includeMetadata = options.includeMetadata !== false; // Default to true
  }
  
  /**
   * Creates a new context with the given initial data
   * 
   * @param {Object} initialData - Initial context data
   * @param {string} source - Source identifier for the context creation
   * @returns {string} - Unique context ID
   */
  createContext(initialData = {}, source = 'system') {
    const contextId = uuidv4();
    
    // Store the initial data in history
    const initialHistory = {
      timestamp: Date.now(),
      source,
      data: { ...initialData },
      operation: 'create'
    };
    
    const context = {
      _meta: {
        id: contextId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source,
        updateHistory: [initialHistory]
      },
      ...initialData
    };
    
    this.contexts.set(contextId, context);
    
    if (this.eventBus) {
      this.eventBus.emit('context:created', { contextId, source });
    }
    
    this.logger.debug(`Created context ${contextId} from source ${source}`);
    
    return contextId;
  }
  
  /**
   * Gets a context by ID
   * 
   * @param {string} contextId - Context ID
   * @returns {Object} - Context object
   * @throws {Error} - If context not found
   */
  getContext(contextId) {
    if (!this.contexts.has(contextId)) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    const context = this.contexts.get(contextId);
    
    // Return a copy without metadata if includeMetadata is false
    if (!this.includeMetadata) {
      const { _meta, ...contextWithoutMeta } = context;
      return contextWithoutMeta;
    }
    
    return context;
  }
  
  /**
   * Updates a context with new data
   * 
   * @param {string} contextId - Context ID
   * @param {Object} data - Data to update
   * @param {string} source - Source identifier for the update
   * @returns {Object} - Updated context
   * @throws {Error} - If context not found
   */
  updateContext(contextId, data, source = 'system') {
    if (!this.contexts.has(contextId)) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    const context = this.contexts.get(contextId);
    const previousState = JSON.parse(JSON.stringify(context));
    
    // Update context
    Object.entries(data).forEach(([key, value]) => {
      if (key !== '_meta') {
        context[key] = value;
      }
    });
    
    // Create a snapshot of the updated data for history
    const { _meta, ...contextDataWithoutMeta } = context;
    const updateHistory = {
      timestamp: Date.now(),
      source,
      data: { ...contextDataWithoutMeta },
      operation: 'update',
      updatedFields: Object.keys(data).filter(k => k !== '_meta'),
      previousValues: Object.entries(previousState)
        .filter(([key]) => key !== '_meta' && data[key] !== undefined)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {})
    };
    
    // Update metadata
    context._meta.updatedAt = Date.now();
    context._meta.updateHistory.push(updateHistory);
    
    if (this.eventBus) {
      this.eventBus.emit('context:updated', { 
        contextId, 
        source,
        updatedFields: Object.keys(data).filter(k => k !== '_meta')
      });
    }
    
    this.logger.debug(`Updated context ${contextId} from source ${source}, fields: ${Object.keys(data).filter(k => k !== '_meta').join(', ')}`);
    
    // Return a copy without metadata if includeMetadata is false
    if (!this.includeMetadata) {
      const { _meta, ...contextWithoutMeta } = context;
      return contextWithoutMeta;
    }
    
    return context;
  }
  
  /**
   * Validates a context against required fields
   * 
   * @param {string} contextId - Context ID
   * @param {Array<string>} requiredFields - Array of required field names
   * @returns {Object} - Validation result with valid flag and message
   */
  validateContext(contextId, requiredFields = []) {
    if (!this.contexts.has(contextId)) {
      return {
        valid: false,
        message: `Context not found: ${contextId}`
      };
    }
    
    const context = this.contexts.get(contextId);
    const missingFields = requiredFields.filter(field => context[field] === undefined);
    
    if (missingFields.length > 0) {
      this.logger.warn(`Context ${contextId} validation failed: missing fields ${missingFields.join(', ')}`);
      return {
        valid: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      };
    }
    
    this.logger.debug(`Context ${contextId} validation passed for fields: ${requiredFields.join(', ')}`);
    return {
      valid: true
    };
  }
  
  /**
   * Deletes a context
   * 
   * @param {string} contextId - Context ID
   * @returns {boolean} - Whether the context was successfully deleted
   */
  deleteContext(contextId) {
    if (!this.contexts.has(contextId)) {
      this.logger.warn(`Failed to delete context: context not found ${contextId}`);
      return false;
    }
    
    this.contexts.delete(contextId);
    
    if (this.eventBus) {
      this.eventBus.emit('context:deleted', { contextId });
    }
    
    this.logger.debug(`Deleted context ${contextId}`);
    return true;
  }
  
  /**
   * Gets the update history for a context
   * 
   * @param {string} contextId - Context ID
   * @returns {Array<Object>} - Array of update history entries
   * @throws {Error} - If context not found
   */
  getContextHistory(contextId) {
    if (!this.contexts.has(contextId)) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    return this.contexts.get(contextId)._meta.updateHistory;
  }
  
  /**
   * Gets all context IDs
   * 
   * @returns {Array<string>} - Array of context IDs
   */
  getAllContextIds() {
    return Array.from(this.contexts.keys());
  }
  
  /**
   * Gets the number of contexts
   * 
   * @returns {number} - Number of contexts
   */
  getContextCount() {
    return this.contexts.size;
  }
  
  /**
   * Clears all contexts
   */
  clearAllContexts() {
    const contextIds = this.getAllContextIds();
    
    for (const contextId of contextIds) {
      this.deleteContext(contextId);
    }
    
    this.logger.info(`Cleared all contexts (${contextIds.length})`);
  }
  
  /**
   * Sets the logger instance
   * 
   * @param {Object} logger - Logger instance with debug, info, warn, error methods
   * @returns {ContextManager} - This ContextManager instance for chaining
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
  
  /**
   * Sets the event bus instance
   * 
   * @param {Object} eventBus - Event bus instance
   * @returns {ContextManager} - This ContextManager instance for chaining
   */
  setEventBus(eventBus) {
    if (!eventBus || typeof eventBus !== 'object') {
      throw new Error('Invalid event bus: must be an object');
    }
    
    if (!eventBus.emit || typeof eventBus.emit !== 'function') {
      throw new Error('Invalid event bus: must have emit method');
    }
    
    this.eventBus = eventBus;
    return this;
  }
  
  /**
   * Sets whether to include metadata in returned contexts
   * 
   * @param {boolean} include - Whether to include metadata
   * @returns {ContextManager} - This ContextManager instance for chaining
   */
  setIncludeMetadata(include) {
    this.includeMetadata = include;
    return this;
  }
}

module.exports = ContextManager;
