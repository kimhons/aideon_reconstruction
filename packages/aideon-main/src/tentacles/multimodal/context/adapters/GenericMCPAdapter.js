/**
 * @fileoverview Generic MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This module provides a fallback adapter for the MCP Context Manager when
 * platform-specific adapters are unavailable or fail to initialize.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Generic MCP Adapter for the Aideon AI Desktop Agent.
 * 
 * This class provides a fallback implementation for the MCP Context Manager
 * when platform-specific adapters are unavailable or fail to initialize.
 */
class GenericMCPAdapter extends EventEmitter {
  /**
   * Creates a new Generic MCP Adapter.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {Object} [options.config] - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    
    // Default configuration
    this.config = {
      storageLocation: path.join(os.homedir(), '.aideon', 'context', 'generic'),
      enablePersistence: true,
      syncInterval: 5000, // 5 seconds
      maxContextsPerFile: 1000,
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.syncTimer = null;
    this.pendingContexts = new Map();
    this.externalContexts = new Map();
    
    this.logger.info('Generic MCP Adapter created');
  }
  
  /**
   * Initializes the Generic MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Generic MCP Adapter already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing Generic MCP Adapter');
      
      // Verify dependencies
      if (!this.contextManager) {
        throw new Error('MCP Context Manager is required');
      }
      
      // Create storage directory if it doesn't exist
      if (this.config.enablePersistence) {
        await this.ensureStorageDirectory();
      }
      
      // Start sync timer if persistence is enabled
      if (this.config.enablePersistence) {
        this.startSyncTimer();
      }
      
      // Register context event handlers
      this.contextManager.on('contextAdded', this.handleContextAdded.bind(this));
      this.contextManager.on('contextUpdated', this.handleContextUpdated.bind(this));
      this.contextManager.on('contextRemoved', this.handleContextRemoved.bind(this));
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('Generic MCP Adapter initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Generic MCP Adapter:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the Generic MCP Adapter.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('Generic MCP Adapter not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down Generic MCP Adapter');
      
      // Stop sync timer
      this.stopSyncTimer();
      
      // Perform final sync if persistence is enabled
      if (this.config.enablePersistence && this.pendingContexts.size > 0) {
        await this.syncContexts();
      }
      
      // Unregister context event handlers
      this.contextManager.off('contextAdded', this.handleContextAdded.bind(this));
      this.contextManager.off('contextUpdated', this.handleContextUpdated.bind(this));
      this.contextManager.off('contextRemoved', this.handleContextRemoved.bind(this));
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('Generic MCP Adapter shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Generic MCP Adapter:', error);
      throw error;
    }
  }
  
  /**
   * Ensures the storage directory exists.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.config.storageLocation, { recursive: true });
      this.logger.debug(`Storage directory created: ${this.config.storageLocation}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Starts the sync timer.
   * 
   * @private
   */
  startSyncTimer() {
    if (this.syncTimer) {
      this.stopSyncTimer();
    }
    
    this.syncTimer = setInterval(async () => {
      try {
        if (this.pendingContexts.size > 0) {
          await this.syncContexts();
        }
      } catch (error) {
        this.logger.error('Failed to sync contexts:', error);
      }
    }, this.config.syncInterval);
    
    this.logger.debug('Sync timer started');
  }
  
  /**
   * Stops the sync timer.
   * 
   * @private
   */
  stopSyncTimer() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.logger.debug('Sync timer stopped');
    }
  }
  
  /**
   * Syncs contexts to storage.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async syncContexts() {
    if (!this.config.enablePersistence || this.pendingContexts.size === 0) {
      return;
    }
    
    try {
      this.logger.debug(`Syncing ${this.pendingContexts.size} contexts to storage`);
      
      // Create a copy of pending contexts
      const contexts = Array.from(this.pendingContexts.values());
      
      // Clear pending contexts
      this.pendingContexts.clear();
      
      // Group contexts by batch
      const batches = [];
      for (let i = 0; i < contexts.length; i += this.config.maxContextsPerFile) {
        batches.push(contexts.slice(i, i + this.config.maxContextsPerFile));
      }
      
      // Write each batch to a file
      for (const batch of batches) {
        const timestamp = Date.now();
        const filename = `contexts_${timestamp}_${crypto.randomBytes(4).toString('hex')}.json`;
        const filePath = path.join(this.config.storageLocation, filename);
        
        await fs.writeFile(filePath, JSON.stringify(batch, null, 2));
        this.logger.debug(`Wrote ${batch.length} contexts to ${filePath}`);
      }
    } catch (error) {
      this.logger.error('Failed to sync contexts to storage:', error);
      
      // Put contexts back in pending queue
      for (const context of contexts) {
        this.pendingContexts.set(context.id, context);
      }
      
      throw error;
    }
  }
  
  /**
   * Handles context added event.
   * 
   * @private
   * @param {Object} context - Context object
   */
  handleContextAdded(context) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      // Add context to pending queue
      this.pendingContexts.set(context.id, { ...context, operation: 'add' });
      
      // Emit event for external applications
      this.emit('externalContextAdded', context);
      
      this.logger.debug(`Context added to pending queue: ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to handle context added event:', error);
    }
  }
  
  /**
   * Handles context updated event.
   * 
   * @private
   * @param {Object} context - Context object
   */
  handleContextUpdated(context) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      // Update context in pending queue
      this.pendingContexts.set(context.id, { ...context, operation: 'update' });
      
      // Emit event for external applications
      this.emit('externalContextUpdated', context);
      
      this.logger.debug(`Context updated in pending queue: ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to handle context updated event:', error);
    }
  }
  
  /**
   * Handles context removed event.
   * 
   * @private
   * @param {string} contextId - Context ID
   */
  handleContextRemoved(contextId) {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      // Remove context from pending queue
      this.pendingContexts.set(contextId, { id: contextId, operation: 'remove' });
      
      // Emit event for external applications
      this.emit('externalContextRemoved', contextId);
      
      this.logger.debug(`Context removed from pending queue: ${contextId}`);
    } catch (error) {
      this.logger.error('Failed to handle context removed event:', error);
    }
  }
  
  /**
   * Adds an external context.
   * 
   * @param {Object} context - Context object
   * @returns {Promise<string>} Context ID
   */
  async addExternalContext(context) {
    if (!this.isInitialized) {
      throw new Error('Generic MCP Adapter not initialized');
    }
    
    try {
      // Generate ID if not provided
      if (!context.id) {
        context.id = crypto.randomUUID();
      }
      
      // Add metadata
      context.source = context.source || 'external';
      context.timestamp = context.timestamp || Date.now();
      
      // Store in external contexts map
      this.externalContexts.set(context.id, context);
      
      // Add to context manager
      await this.contextManager.addContext(context);
      
      this.logger.debug(`External context added: ${context.id}`);
      
      return context.id;
    } catch (error) {
      this.logger.error('Failed to add external context:', error);
      throw error;
    }
  }
  
  /**
   * Updates an external context.
   * 
   * @param {string} contextId - Context ID
   * @param {Object} updates - Context updates
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateExternalContext(contextId, updates) {
    if (!this.isInitialized) {
      throw new Error('Generic MCP Adapter not initialized');
    }
    
    try {
      // Check if context exists
      if (!this.externalContexts.has(contextId)) {
        throw new Error(`External context not found: ${contextId}`);
      }
      
      // Get current context
      const context = this.externalContexts.get(contextId);
      
      // Apply updates
      const updatedContext = {
        ...context,
        ...updates,
        id: contextId, // Ensure ID doesn't change
        timestamp: Date.now() // Update timestamp
      };
      
      // Store in external contexts map
      this.externalContexts.set(contextId, updatedContext);
      
      // Update in context manager
      await this.contextManager.updateContext(contextId, updatedContext);
      
      this.logger.debug(`External context updated: ${contextId}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to update external context:', error);
      throw error;
    }
  }
  
  /**
   * Removes an external context.
   * 
   * @param {string} contextId - Context ID
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeExternalContext(contextId) {
    if (!this.isInitialized) {
      throw new Error('Generic MCP Adapter not initialized');
    }
    
    try {
      // Check if context exists
      if (!this.externalContexts.has(contextId)) {
        throw new Error(`External context not found: ${contextId}`);
      }
      
      // Remove from external contexts map
      this.externalContexts.delete(contextId);
      
      // Remove from context manager
      await this.contextManager.removeContext(contextId);
      
      this.logger.debug(`External context removed: ${contextId}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to remove external context:', error);
      throw error;
    }
  }
  
  /**
   * Gets an external context.
   * 
   * @param {string} contextId - Context ID
   * @returns {Promise<Object|null>} Context object or null if not found
   */
  async getExternalContext(contextId) {
    if (!this.isInitialized) {
      throw new Error('Generic MCP Adapter not initialized');
    }
    
    try {
      // Check if context exists in external contexts map
      if (this.externalContexts.has(contextId)) {
        return this.externalContexts.get(contextId);
      }
      
      // Try to get from context manager
      const context = await this.contextManager.getContext(contextId);
      
      if (context) {
        // Store in external contexts map for future reference
        this.externalContexts.set(contextId, context);
      }
      
      return context;
    } catch (error) {
      this.logger.error('Failed to get external context:', error);
      throw error;
    }
  }
  
  /**
   * Queries external contexts.
   * 
   * @param {Object} query - Query parameters
   * @returns {Promise<Array<Object>>} Array of context objects
   */
  async queryExternalContexts(query = {}) {
    if (!this.isInitialized) {
      throw new Error('Generic MCP Adapter not initialized');
    }
    
    try {
      // Query context manager
      const contexts = await this.contextManager.queryContexts(query);
      
      // Store in external contexts map for future reference
      for (const context of contexts) {
        this.externalContexts.set(context.id, context);
      }
      
      return contexts;
    } catch (error) {
      this.logger.error('Failed to query external contexts:', error);
      throw error;
    }
  }
}

module.exports = { GenericMCPAdapter };
