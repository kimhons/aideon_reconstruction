/**
 * @fileoverview MCPLearningContextProvider base class for integrating
 * Learning from Demonstration components with the Model Context Protocol (MCP).
 * 
 * This provider serves as the foundation for all Learning from Demonstration context providers,
 * enabling seamless context sharing between learning components and other tentacles
 * in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLockAdapter } = require('../../input/utils/EnhancedAsyncLockAdapter');
const { EnhancedCancellationToken } = require('../../input/utils/EnhancedCancellationToken');

/**
 * Base class for Learning from Demonstration context providers that integrate with MCP.
 */
class MCPLearningContextProvider extends EventEmitter {
  /**
   * Creates a new MCPLearningContextProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.config - Provider-specific configuration
   * @param {number} [options.config.minConfidenceThreshold=0.6] - Minimum confidence threshold for context sharing
   * @param {number} [options.config.contextTTL=3600000] - Default TTL for learning contexts (1 hour)
   * @param {boolean} [options.config.enablePersistence=true] - Whether to persist contexts to storage
   * @param {boolean} [options.config.enablePrivacyControls=true] - Whether to enable privacy controls for learning data
   */
  constructor(options) {
    super();
    
    if (!options || !options.contextManager) {
      throw new Error('MCPLearningContextProvider requires a valid contextManager');
    }
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    this.config = options.config || {};
    
    // Default configuration
    this.minConfidenceThreshold = this.config.minConfidenceThreshold || 0.6;
    this.contextTTL = this.config.contextTTL || 3600000; // 1 hour
    this.enablePersistence = this.config.enablePersistence !== false;
    this.enablePrivacyControls = this.config.enablePrivacyControls !== false;
    
    // Initialize state
    this.isInitialized = false;
    this.isShutdown = false;
    
    // Create locks for thread safety
    this.initializationLock = new EnhancedAsyncLockAdapter('initialization');
    this.operationLock = new EnhancedAsyncLockAdapter('operation');
    
    // Context type prefix for all learning contexts
    this.contextTypePrefix = 'learning';
    
    this.logger.info('MCPLearningContextProvider created');
  }
  
  /**
   * Initializes the context provider and establishes connections.
   * 
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(options = {}) {
    return this.initializationLock.acquire(async () => {
      if (this.isInitialized) {
        this.logger.info('MCPLearningContextProvider already initialized');
        return true;
      }
      
      try {
        this.logger.info('Initializing MCPLearningContextProvider');
        
        // Ensure context manager is initialized
        if (!this.contextManager.isInitialized) {
          await this.contextManager.initialize();
        }
        
        // Register with context manager
        await this.registerWithContextManager();
        
        // Set up event listeners
        this.setupEventListeners();
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('MCPLearningContextProvider initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize MCPLearningContextProvider:', error);
        throw error;
      }
    });
  }
  
  /**
   * Registers this provider with the context manager.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async registerWithContextManager() {
    await this.contextManager.registerContextProvider({
      id: this.constructor.name,
      name: 'Learning Context Provider',
      description: 'Provides context from learning from demonstration operations',
      types: this.getSupportedContextTypes(),
      provider: this
    });
    
    this.logger.info('Registered with context manager');
  }
  
  /**
   * Sets up event listeners for learning events.
   * 
   * @private
   */
  setupEventListeners() {
    // To be implemented by subclasses
    this.logger.info('Event listeners setup complete');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.demonstration.recording`,
      `${this.contextTypePrefix}.demonstration.session`,
      `${this.contextTypePrefix}.pattern.detected`,
      `${this.contextTypePrefix}.workflow.generated`
    ];
  }
  
  /**
   * Adds a learning context to the MCP context manager.
   * 
   * @param {Object} contextData - The context data to add
   * @param {string} contextType - The specific context type (will be prefixed with learning)
   * @param {number} [priority=5] - Context priority (1-10)
   * @param {number} [confidence=0.8] - Confidence score (0-1)
   * @param {string[]} [tags=[]] - Context tags for categorization
   * @returns {Promise<string>} - The ID of the added context
   */
  async addLearningContext(contextData, contextType, priority = 5, confidence = 0.8, tags = []) {
    return this.operationLock.acquire(async () => {
      if (!this.isInitialized) {
        throw new Error('MCPLearningContextProvider not initialized');
      }
      
      if (confidence < this.minConfidenceThreshold) {
        this.logger.debug(`Skipping low confidence context: ${confidence} < ${this.minConfidenceThreshold}`);
        return null;
      }
      
      // Apply privacy controls if enabled
      let processedData = contextData;
      if (this.enablePrivacyControls) {
        processedData = this.applyPrivacyControls(contextData, contextType);
      }
      
      const fullContextType = `${this.contextTypePrefix}.${contextType}`;
      
      const context = {
        source: this.constructor.name,
        type: fullContextType,
        data: processedData,
        priority: Math.max(1, Math.min(10, priority)), // Ensure priority is between 1-10
        confidence: Math.max(0, Math.min(1, confidence)), // Ensure confidence is between 0-1
        tags: ['learning', 'demonstration', ...tags],
        timestamp: Date.now(),
        expiryTimestamp: Date.now() + this.contextTTL
      };
      
      if (!this.enablePersistence) {
        context.persistent = false;
      }
      
      this.logger.debug(`Adding learning context: ${fullContextType}`, { 
        priority, 
        confidence,
        dataKeys: Object.keys(processedData)
      });
      
      const contextId = await this.contextManager.addContext(context);
      this.emit('contextAdded', { contextId, type: fullContextType });
      return contextId;
    });
  }
  
  /**
   * Applies privacy controls to learning context data.
   * 
   * @private
   * @param {Object} contextData - The original context data
   * @param {string} contextType - The specific context type
   * @returns {Object} - The processed context data with privacy controls applied
   */
  applyPrivacyControls(contextData, contextType) {
    // Base implementation - subclasses should override with specific privacy logic
    // This could include PII removal, data minimization, etc.
    return contextData;
  }
  
  /**
   * Queries for learning contexts of a specific type.
   * 
   * @param {string} contextType - The specific context type (will be prefixed with learning)
   * @param {Object} [filters={}] - Additional filters for the query
   * @returns {Promise<Object[]>} - Array of matching contexts
   */
  async queryLearningContexts(contextType, filters = {}) {
    if (!this.isInitialized) {
      throw new Error('MCPLearningContextProvider not initialized');
    }
    
    const fullContextType = `${this.contextTypePrefix}.${contextType}`;
    
    const query = {
      type: fullContextType,
      ...filters
    };
    
    this.logger.debug(`Querying learning contexts: ${fullContextType}`, filters);
    return this.contextManager.queryContexts(query);
  }
  
  /**
   * Updates an existing learning context.
   * 
   * @param {string} contextId - The ID of the context to update
   * @param {Object} contextData - The new context data
   * @param {number} [confidence] - New confidence score (0-1)
   * @returns {Promise<boolean>} - True if update was successful
   */
  async updateLearningContext(contextId, contextData, confidence) {
    return this.operationLock.acquire(async () => {
      if (!this.isInitialized) {
        throw new Error('MCPLearningContextProvider not initialized');
      }
      
      const existingContext = await this.contextManager.getContext(contextId);
      if (!existingContext) {
        this.logger.warn(`Cannot update non-existent context: ${contextId}`);
        return false;
      }
      
      // Apply privacy controls if enabled
      let processedData = contextData;
      if (this.enablePrivacyControls) {
        const contextType = existingContext.type.replace(`${this.contextTypePrefix}.`, '');
        processedData = this.applyPrivacyControls(contextData, contextType);
      }
      
      const updates = { data: processedData };
      
      if (confidence !== undefined) {
        if (confidence < this.minConfidenceThreshold) {
          this.logger.debug(`Removing low confidence context: ${confidence} < ${this.minConfidenceThreshold}`);
          await this.contextManager.removeContext(contextId);
          return true;
        }
        
        updates.confidence = Math.max(0, Math.min(1, confidence));
      }
      
      this.logger.debug(`Updating learning context: ${contextId}`, {
        dataKeys: Object.keys(processedData),
        confidence: updates.confidence
      });
      
      const success = await this.contextManager.updateContext(contextId, updates);
      if (success) {
        this.emit('contextUpdated', { contextId, type: existingContext.type });
      }
      
      return success;
    });
  }
  
  /**
   * Removes a learning context.
   * 
   * @param {string} contextId - The ID of the context to remove
   * @returns {Promise<boolean>} - True if removal was successful
   */
  async removeLearningContext(contextId) {
    return this.operationLock.acquire(async () => {
      if (!this.isInitialized) {
        throw new Error('MCPLearningContextProvider not initialized');
      }
      
      const existingContext = await this.contextManager.getContext(contextId);
      if (!existingContext) {
        this.logger.warn(`Cannot remove non-existent context: ${contextId}`);
        return false;
      }
      
      this.logger.debug(`Removing learning context: ${contextId}`);
      
      const success = await this.contextManager.removeContext(contextId);
      if (success) {
        this.emit('contextRemoved', { contextId, type: existingContext.type });
      }
      
      return success;
    });
  }
  
  /**
   * Shuts down the context provider and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return this.initializationLock.acquire(async () => {
      if (!this.isInitialized || this.isShutdown) {
        return true;
      }
      
      try {
        this.logger.info('Shutting down MCPLearningContextProvider');
        
        // Clean up event listeners
        this.removeAllListeners();
        
        this.isShutdown = true;
        this.isInitialized = false;
        
        this.logger.info('MCPLearningContextProvider shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down MCPLearningContextProvider:', error);
        throw error;
      }
    });
  }
}

module.exports = { MCPLearningContextProvider };
