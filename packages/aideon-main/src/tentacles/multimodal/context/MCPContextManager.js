/**
 * @fileoverview MCP Context Manager for the Aideon AI Desktop Agent.
 * 
 * This module implements the core infrastructure for the Model Context Protocol (MCP)
 * integration in Aideon. It provides a central context management system that maintains
 * coherent context across different interactions and tasks, integrates information from
 * multiple input sources, and efficiently utilizes memory and processing resources.
 * 
 * The MCP Context Manager serves as the foundation for all platform-specific adapters
 * and tentacle enhancements, ensuring a consistent approach to context management
 * across the entire Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');

// Import utility modules
const { EnhancedAsyncLock } = require('../input/utils/EnhancedAsyncLock');
const { EnhancedCancellationToken } = require('../input/utils/EnhancedCancellationToken');
const { EnhancedAsyncOperation } = require('../input/utils/EnhancedAsyncOperation');

/**
 * @typedef {Object} ContextEntry
 * @property {string} id - Unique identifier for the context entry
 * @property {string} source - Source of the context (e.g., 'screen', 'voice', 'gesture')
 * @property {string} type - Type of context (e.g., 'visual', 'conversation', 'interaction')
 * @property {Object} data - Actual context data
 * @property {number} timestamp - Creation timestamp
 * @property {number} expiryTimestamp - Expiration timestamp (optional)
 * @property {number} priority - Priority level (1-10, with 10 being highest)
 * @property {number} confidence - Confidence score (0-1)
 * @property {string[]} tags - Array of tags for categorization
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} ContextQuery
 * @property {string} [id] - Query by specific ID
 * @property {string} [source] - Query by source
 * @property {string} [type] - Query by type
 * @property {string[]} [tags] - Query by tags (AND relationship)
 * @property {number} [minConfidence] - Minimum confidence threshold
 * @property {number} [minPriority] - Minimum priority threshold
 * @property {number} [fromTimestamp] - Query contexts from this timestamp
 * @property {number} [toTimestamp] - Query contexts until this timestamp
 * @property {boolean} [includeExpired] - Whether to include expired contexts
 * @property {number} [limit] - Maximum number of results to return
 * @property {string} [sortBy] - Sort field ('timestamp', 'priority', 'confidence')
 * @property {string} [sortOrder] - Sort order ('asc' or 'desc')
 */

/**
 * @typedef {Object} ContextUpdateOptions
 * @property {boolean} [merge] - Whether to merge with existing data (default: false)
 * @property {boolean} [updateTimestamp] - Whether to update the timestamp (default: true)
 * @property {boolean} [upsert] - Whether to create if not exists (default: false)
 */

/**
 * @typedef {Object} ContextPersistenceOptions
 * @property {string} [storageLocation] - Custom storage location
 * @property {boolean} [encrypt] - Whether to encrypt stored contexts
 * @property {string} [encryptionKey] - Custom encryption key
 * @property {string[]} [excludeSources] - Sources to exclude from persistence
 * @property {string[]} [excludeTypes] - Types to exclude from persistence
 * @property {number} [minConfidenceThreshold] - Minimum confidence for persistence
 */

/**
 * @typedef {Object} ContextManagerConfig
 * @property {number} [defaultExpiryTime] - Default context expiry time in ms
 * @property {number} [maxContextEntries] - Maximum number of context entries to keep in memory
 * @property {boolean} [enablePersistence] - Whether to enable context persistence
 * @property {ContextPersistenceOptions} [persistenceOptions] - Context persistence options
 * @property {boolean} [enableCompression] - Whether to enable context compression
 * @property {boolean} [enablePruning] - Whether to enable automatic context pruning
 * @property {number} [pruningInterval] - Interval for automatic pruning in ms
 * @property {number} [pruningThreshold] - Confidence threshold for pruning
 * @property {boolean} [enableDebugMode] - Whether to enable debug mode
 */

/**
 * MCP Context Manager for the Aideon AI Desktop Agent.
 * 
 * This class provides a central context management system that maintains
 * coherent context across different interactions and tasks.
 */
class MCPContextManager extends EventEmitter {
  /**
   * Creates a new MCP Context Manager.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.resourceManager] - Resource manager instance
   * @param {ContextManagerConfig} [options.config] - Context manager configuration
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.resourceManager = options.resourceManager;
    
    // Default configuration
    this.config = {
      defaultExpiryTime: 30 * 60 * 1000, // 30 minutes
      maxContextEntries: 1000,
      enablePersistence: true,
      persistenceOptions: {
        storageLocation: path.join(os.homedir(), '.aideon', 'context'),
        encrypt: true,
        excludeSources: [],
        excludeTypes: [],
        minConfidenceThreshold: 0.3
      },
      enableCompression: true,
      enablePruning: true,
      pruningInterval: 5 * 60 * 1000, // 5 minutes
      pruningThreshold: 0.2,
      enableDebugMode: false,
      ...options.config
    };
    
    // Initialize context store
    this.contextStore = new Map();
    
    // Initialize locks for thread safety
    this.contextLock = new EnhancedAsyncLock();
    this.persistenceLock = new EnhancedAsyncLock();
    
    // Initialize platform-specific adapter
    this.platformAdapter = null;
    
    // Initialize state
    this.isInitialized = false;
    this.isPersistenceInitialized = false;
    this.pruningIntervalId = null;
    
    // Debug data
    this.debugData = {
      operations: [],
      errors: [],
      metrics: {
        totalContextsAdded: 0,
        totalContextsUpdated: 0,
        totalContextsRemoved: 0,
        totalContextsQueried: 0,
        totalContextsPruned: 0,
        totalContextsPersisted: 0,
        totalContextsLoaded: 0
      }
    };
    
    this.logger.info('MCP Context Manager created');
  }
  
  /**
   * Initializes the MCP Context Manager.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('MCP Context Manager already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing MCP Context Manager');
      
      // Check for required resources if resource manager is available
      if (this.resourceManager) {
        const hasPermission = await this.resourceManager.checkPermission('context_storage');
        if (!hasPermission) {
          throw new Error('Permission denied for context storage');
        }
        
        await this.resourceManager.allocateResource('context_manager', {
          memoryLimit: this.config.maxContextEntries * 10 * 1024 // Rough estimate
        });
      }
      
      // Initialize context persistence if enabled
      if (this.config.enablePersistence) {
        await this.initializePersistence();
      }
      
      // Initialize platform-specific adapter
      await this.initializePlatformAdapter();
      
      // Start automatic pruning if enabled
      if (this.config.enablePruning) {
        this.startAutomaticPruning();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('MCP Context Manager initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MCP Context Manager:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initialize',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Shuts down the MCP Context Manager.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('MCP Context Manager not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down MCP Context Manager');
      
      // Stop automatic pruning
      if (this.pruningIntervalId) {
        clearInterval(this.pruningIntervalId);
        this.pruningIntervalId = null;
      }
      
      // Persist contexts before shutdown if persistence is enabled
      if (this.config.enablePersistence && this.isPersistenceInitialized) {
        await this.persistContexts();
      }
      
      // Shutdown platform-specific adapter
      if (this.platformAdapter && typeof this.platformAdapter.shutdown === 'function') {
        await this.platformAdapter.shutdown();
      }
      
      // Release resources if resource manager is available
      if (this.resourceManager) {
        await this.resourceManager.releaseResource('context_manager');
      }
      
      // Clear context store
      this.contextStore.clear();
      
      this.isInitialized = false;
      this.isPersistenceInitialized = false;
      this.emit('shutdown');
      this.logger.info('MCP Context Manager shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down MCP Context Manager:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'shutdown',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Gets the current platform adapter.
   * 
   * @returns {Object} The platform adapter instance
   */
  getPlatformAdapter() {
    return this.platformAdapter;
  }
  
  /**
   * Initializes the platform-specific adapter based on the current platform.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializePlatformAdapter() {
    const platform = os.platform();
    let AdapterClass;
    
    try {
      if (platform === 'win32') {
        // Use Windows-native MCP adapter
        AdapterClass = require('./adapters/WindowsNativeMCPAdapter').WindowsNativeMCPAdapter;
      } else if (platform === 'darwin') {
        // Use macOS MCP adapter
        AdapterClass = require('./adapters/MacOSMCPAdapter').MacOSMCPAdapter;
      } else {
        // Use Linux MCP adapter for Linux and other platforms
        AdapterClass = require('./adapters/LinuxMCPAdapter').LinuxMCPAdapter;
      }
      
      this.platformAdapter = new AdapterClass({
        logger: this.logger,
        contextManager: this
      });
      
      await this.platformAdapter.initialize();
      this.logger.info(`Initialized ${platform} MCP adapter`);
    } catch (error) {
      this.logger.error(`Failed to initialize platform adapter for ${platform}:`, error);
      this.logger.warn('Falling back to generic adapter');
      
      // Fall back to generic adapter
      const GenericAdapter = require('./adapters/GenericMCPAdapter').GenericMCPAdapter;
      this.platformAdapter = new GenericAdapter({
        logger: this.logger,
        contextManager: this
      });
      
      await this.platformAdapter.initialize();
    }
  }
  
  /**
   * Initializes the context persistence system.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializePersistence() {
    try {
      const { storageLocation } = this.config.persistenceOptions;
      
      // Create storage directory if it doesn't exist
      await fs.mkdir(storageLocation, { recursive: true });
      
      // Load persisted contexts
      await this.loadPersistedContexts();
      
      this.isPersistenceInitialized = true;
      this.logger.info('Context persistence initialized');
    } catch (error) {
      this.logger.error('Failed to initialize context persistence:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'initializePersistence',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Loads persisted contexts from storage.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadPersistedContexts() {
    const { storageLocation, encrypt } = this.config.persistenceOptions;
    
    try {
      // Check if context file exists
      const contextFilePath = path.join(storageLocation, 'contexts.json');
      try {
        await fs.access(contextFilePath);
      } catch (error) {
        // File doesn't exist, nothing to load
        this.logger.info('No persisted contexts found');
        return;
      }
      
      // Read and parse context file
      let contextData = await fs.readFile(contextFilePath, 'utf8');
      
      // Decrypt if encryption is enabled
      if (encrypt) {
        contextData = await this.decryptData(contextData);
      }
      
      const contexts = JSON.parse(contextData);
      
      // Add contexts to store
      let loadedCount = 0;
      for (const context of contexts) {
        // Skip expired contexts
        if (context.expiryTimestamp && context.expiryTimestamp < Date.now()) {
          continue;
        }
        
        this.contextStore.set(context.id, context);
        loadedCount++;
      }
      
      this.debugData.metrics.totalContextsLoaded += loadedCount;
      this.logger.info(`Loaded ${loadedCount} persisted contexts`);
    } catch (error) {
      this.logger.error('Failed to load persisted contexts:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'loadPersistedContexts',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Persists contexts to storage.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async persistContexts() {
    const { storageLocation, encrypt, excludeSources, excludeTypes, minConfidenceThreshold } = this.config.persistenceOptions;
    
    try {
      // Use a proper async function for the lock
      await this.persistenceLock.acquire(async () => {
        // Filter contexts for persistence
        const contexts = Array.from(this.contextStore.values()).filter(context => {
          // Skip excluded sources
          if (excludeSources.includes(context.source)) {
            return false;
          }
          
          // Skip excluded types
          if (excludeTypes.includes(context.type)) {
            return false;
          }
          
          // Skip low-confidence contexts
          if (context.confidence < minConfidenceThreshold) {
            return false;
          }
          
          // Skip expired contexts
          if (context.expiryTimestamp && context.expiryTimestamp < Date.now()) {
            return false;
          }
          
          return true;
        });
        
        // Prepare context data for persistence
        let contextData = JSON.stringify(contexts);
        
        // Encrypt if encryption is enabled
        if (encrypt) {
          contextData = await this.encryptData(contextData);
        }
        
        // Write to file
        const contextFilePath = path.join(storageLocation, 'contexts.json');
        await fs.writeFile(contextFilePath, contextData, 'utf8');
        
        this.debugData.metrics.totalContextsPersisted += contexts.length;
        this.logger.info(`Persisted ${contexts.length} contexts`);
      });
    } catch (error) {
      this.logger.error('Failed to persist contexts:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'persistContexts',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Encrypts data for secure storage.
   * 
   * @private
   * @param {string} data - Data to encrypt
   * @returns {Promise<string>} Encrypted data
   */
  async encryptData(data) {
    const { encryptionKey } = this.config.persistenceOptions;
    
    // Use provided key or generate one based on machine-specific information
    const key = encryptionKey || this.generateEncryptionKey();
    
    // Use AES-256-GCM for authenticated encryption
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return IV + Auth Tag + Encrypted Data
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }
  
  /**
   * Decrypts data from secure storage.
   * 
   * @private
   * @param {string} encryptedData - Encrypted data
   * @returns {Promise<string>} Decrypted data
   */
  async decryptData(encryptedData) {
    const { encryptionKey } = this.config.persistenceOptions;
    
    // Use provided key or generate one based on machine-specific information
    const key = encryptionKey || this.generateEncryptionKey();
    
    // Parse IV + Auth Tag + Encrypted Data
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    // Use AES-256-GCM for authenticated decryption
    const algorithm = 'aes-256-gcm';
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'hex'), iv);
    
    // Set authentication tag
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Generates an encryption key based on machine-specific information.
   * 
   * @private
   * @returns {string} Encryption key
   */
  generateEncryptionKey() {
    // Use machine-specific information to generate a consistent key
    const machineInfo = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0].model,
      os.userInfo().username
    ].join('|');
    
    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(machineInfo).digest('hex');
  }
  
  /**
   * Starts automatic context pruning.
   * 
   * @private
   */
  startAutomaticPruning() {
    if (this.pruningIntervalId) {
      clearInterval(this.pruningIntervalId);
    }
    
    this.pruningIntervalId = setInterval(async () => {
      try {
        await this.pruneExpiredContexts();
      } catch (error) {
        this.logger.error('Failed to prune expired contexts:', error);
      }
    }, this.config.pruningInterval);
    
    this.logger.info(`Automatic context pruning started (interval: ${this.config.pruningInterval}ms)`);
  }
  
  /**
   * Prunes expired contexts from the store.
   * 
   * @returns {Promise<number>} Number of pruned contexts
   */
  async pruneExpiredContexts() {
    if (!this.isInitialized) {
      throw new Error('MCP Context Manager not initialized');
    }
    
    try {
      // Use a proper async function for the lock
      return await this.contextLock.acquire(async () => {
        const now = Date.now();
        let prunedCount = 0;
        
        // Find expired contexts
        const expiredContextIds = [];
        for (const [id, context] of this.contextStore.entries()) {
          if (context.expiryTimestamp && context.expiryTimestamp < now) {
            expiredContextIds.push(id);
          }
        }
        
        // Remove expired contexts
        for (const id of expiredContextIds) {
          this.contextStore.delete(id);
          prunedCount++;
          
          // Emit event
          this.emit('contextRemoved', id);
        }
        
        // Prune low-confidence contexts if store is too large
        if (this.contextStore.size > this.config.maxContextEntries) {
          // Get contexts sorted by confidence (ascending)
          const contexts = Array.from(this.contextStore.entries())
            .sort(([, a], [, b]) => a.confidence - b.confidence);
          
          // Calculate how many contexts to prune
          const excessCount = this.contextStore.size - this.config.maxContextEntries;
          
          // Prune low-confidence contexts
          for (let i = 0; i < excessCount; i++) {
            const [id, context] = contexts[i];
            
            // Skip high-priority contexts
            if (context.priority >= 8) {
              continue;
            }
            
            // Skip contexts with confidence above threshold
            if (context.confidence > this.config.pruningThreshold) {
              continue;
            }
            
            this.contextStore.delete(id);
            prunedCount++;
            
            // Emit event
            this.emit('contextRemoved', id);
          }
        }
        
        if (prunedCount > 0) {
          this.debugData.metrics.totalContextsPruned += prunedCount;
          this.logger.info(`Pruned ${prunedCount} contexts`);
          
          // Persist contexts after pruning if persistence is enabled
          if (this.config.enablePersistence && this.isPersistenceInitialized) {
            await this.persistContexts();
          }
        }
        
        return prunedCount;
      });
    } catch (error) {
      this.logger.error('Failed to prune expired contexts:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'pruneExpiredContexts',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Adds a new context to the store.
   * 
   * @param {ContextEntry} context - Context to add
   * @returns {Promise<string>} Context ID
   */
  async addContext(context) {
    if (!this.isInitialized) {
      throw new Error('MCP Context Manager not initialized');
    }
    
    try {
      // Use a proper async function for the lock
      return await this.contextLock.acquire(async () => {
        // Generate ID if not provided
        if (!context.id) {
          context.id = crypto.randomUUID();
        }
        
        // Set timestamp if not provided
        if (!context.timestamp) {
          context.timestamp = Date.now();
        }
        
        // Set expiry timestamp if not provided
        if (!context.expiryTimestamp && this.config.defaultExpiryTime > 0) {
          context.expiryTimestamp = context.timestamp + this.config.defaultExpiryTime;
        }
        
        // Set default values for required fields
        context.source = context.source || 'unknown';
        context.type = context.type || 'generic';
        context.data = context.data || {};
        context.priority = context.priority || 5;
        context.confidence = context.confidence || 0.5;
        context.tags = context.tags || [];
        
        // Add to store
        this.contextStore.set(context.id, context);
        
        // Update metrics
        this.debugData.metrics.totalContextsAdded++;
        
        // Emit event
        this.emit('contextAdded', context);
        
        // Persist context if persistence is enabled
        if (this.config.enablePersistence && this.isPersistenceInitialized) {
          // Only persist high-confidence or high-priority contexts immediately
          if (context.confidence > 0.8 || context.priority > 7) {
            await this.persistContexts();
          }
        }
        
        this.logger.debug(`Context added: ${context.id}`);
        
        return context.id;
      });
    } catch (error) {
      this.logger.error('Failed to add context:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'addContext',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Updates an existing context in the store.
   * 
   * @param {string} contextId - Context ID to update
   * @param {Object} updates - Context updates
   * @param {ContextUpdateOptions} [options] - Update options
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateContext(contextId, updates, options = {}) {
    if (!this.isInitialized) {
      throw new Error('MCP Context Manager not initialized');
    }
    
    try {
      // Use a proper async function for the lock
      return await this.contextLock.acquire(async () => {
        // Check if context exists
        if (!this.contextStore.has(contextId)) {
          if (options.upsert) {
            // Create new context
            updates.id = contextId;
            await this.addContext(updates);
            return true;
          }
          
          return false;
        }
        
        // Get current context
        const context = this.contextStore.get(contextId);
        
        // Apply updates
        if (options.merge && updates.data && context.data) {
          // Merge data objects
          updates.data = { ...context.data, ...updates.data };
        }
        
        const updatedContext = {
          ...context,
          ...updates,
          id: contextId // Ensure ID doesn't change
        };
        
        // Update timestamp if specified
        if (options.updateTimestamp !== false) {
          updatedContext.timestamp = Date.now();
        }
        
        // Update in store
        this.contextStore.set(contextId, updatedContext);
        
        // Update metrics
        this.debugData.metrics.totalContextsUpdated++;
        
        // Emit event
        this.emit('contextUpdated', updatedContext);
        
        // Persist context if persistence is enabled
        if (this.config.enablePersistence && this.isPersistenceInitialized) {
          // Only persist high-confidence or high-priority contexts immediately
          if (updatedContext.confidence > 0.8 || updatedContext.priority > 7) {
            await this.persistContexts();
          }
        }
        
        this.logger.debug(`Context updated: ${contextId}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error('Failed to update context:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'updateContext',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Removes a context from the store.
   * 
   * @param {string} contextId - Context ID to remove
   * @returns {Promise<boolean>} True if removal was successful
   */
  async removeContext(contextId) {
    if (!this.isInitialized) {
      throw new Error('MCP Context Manager not initialized');
    }
    
    try {
      // Use a proper async function for the lock
      return await this.contextLock.acquire(async () => {
        // Check if context exists
        if (!this.contextStore.has(contextId)) {
          return false;
        }
        
        // Remove from store
        this.contextStore.delete(contextId);
        
        // Update metrics
        this.debugData.metrics.totalContextsRemoved++;
        
        // Emit event
        this.emit('contextRemoved', contextId);
        
        // Persist changes if persistence is enabled
        if (this.config.enablePersistence && this.isPersistenceInitialized) {
          await this.persistContexts();
        }
        
        this.logger.debug(`Context removed: ${contextId}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error('Failed to remove context:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'removeContext',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Gets a context from the store.
   * 
   * @param {string} contextId - Context ID to get
   * @returns {Promise<ContextEntry|null>} Context or null if not found
   */
  async getContext(contextId) {
    if (!this.isInitialized) {
      throw new Error('MCP Context Manager not initialized');
    }
    
    try {
      // Use a proper async function for the lock
      return await this.contextLock.acquire(async () => {
        // Check if context exists
        if (!this.contextStore.has(contextId)) {
          return null;
        }
        
        const context = this.contextStore.get(contextId);
        
        // Check if context is expired
        if (context.expiryTimestamp && context.expiryTimestamp < Date.now()) {
          // Remove expired context
          this.contextStore.delete(contextId);
          this.emit('contextRemoved', contextId);
          return null;
        }
        
        return context;
      });
    } catch (error) {
      this.logger.error('Failed to get context:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'getContext',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Queries contexts from the store.
   * 
   * @param {ContextQuery} query - Query parameters
   * @returns {Promise<Array<ContextEntry>>} Array of matching contexts
   */
  async queryContexts(query = {}) {
    if (!this.isInitialized) {
      throw new Error('MCP Context Manager not initialized');
    }
    
    try {
      // Use a proper async function for the lock
      return await this.contextLock.acquire(async () => {
        // Get all contexts
        let contexts = Array.from(this.contextStore.values());
        
        // Filter by ID
        if (query.id) {
          contexts = contexts.filter(context => context.id === query.id);
        }
        
        // Filter by source
        if (query.source) {
          contexts = contexts.filter(context => context.source === query.source);
        }
        
        // Filter by type
        if (query.type) {
          contexts = contexts.filter(context => context.type === query.type);
        }
        
        // Filter by tags
        if (query.tags && query.tags.length > 0) {
          contexts = contexts.filter(context => {
            if (!context.tags || !Array.isArray(context.tags)) {
              return false;
            }
            
            return query.tags.every(tag => context.tags.includes(tag));
          });
        }
        
        // Filter by confidence
        if (query.minConfidence) {
          contexts = contexts.filter(context => 
            typeof context.confidence === 'number' && 
            context.confidence >= query.minConfidence
          );
        }
        
        // Filter by priority
        if (query.minPriority) {
          contexts = contexts.filter(context => 
            typeof context.priority === 'number' && 
            context.priority >= query.minPriority
          );
        }
        
        // Filter by timestamp range
        if (query.fromTimestamp) {
          contexts = contexts.filter(context => context.timestamp >= query.fromTimestamp);
        }
        
        if (query.toTimestamp) {
          contexts = contexts.filter(context => context.timestamp <= query.toTimestamp);
        }
        
        // Filter expired contexts
        if (!query.includeExpired) {
          const now = Date.now();
          contexts = contexts.filter(context => 
            !context.expiryTimestamp || context.expiryTimestamp > now
          );
        }
        
        // Sort results
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
        
        // Update metrics
        this.debugData.metrics.totalContextsQueried++;
        
        return contexts;
      });
    } catch (error) {
      this.logger.error('Failed to query contexts:', error);
      this.debugData.errors.push({
        timestamp: Date.now(),
        operation: 'queryContexts',
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Gets debug information about the MCP Context Manager.
   * 
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      isPersistenceInitialized: this.isPersistenceInitialized,
      contextCount: this.contextStore.size,
      platformAdapter: this.platformAdapter ? {
        type: this.platformAdapter.constructor.name,
        isInitialized: this.platformAdapter.isInitialized
      } : null,
      metrics: this.debugData.metrics,
      errors: this.debugData.errors.slice(-10) // Last 10 errors
    };
  }
}

module.exports = { MCPContextManager };
