/**
 * @fileoverview MCPUIContextProvider base class for User Interface tentacles.
 * 
 * This module provides the foundation for all UI context providers in the Aideon
 * AI Desktop Agent, enabling context sharing for UI state, interactions, preferences,
 * accessibility, and themes.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLockAdapter } = require('../../../input/utils/EnhancedAsyncLockAdapter');

/**
 * Base class for all UI context providers.
 */
class MCPUIContextProvider extends EventEmitter {
  /**
   * Constructor for MCPUIContextProvider.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.securityManager Security manager for access control
   * @param {Object} options.mcpContextManager MCP Context Manager instance
   */
  constructor(options = {}) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for MCPUIContextProvider');
    if (!options.logger) throw new Error('Logger is required for MCPUIContextProvider');
    if (!options.configService) throw new Error('ConfigService is required for MCPUIContextProvider');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for MCPUIContextProvider');
    if (!options.securityManager) throw new Error('SecurityManager is required for MCPUIContextProvider');
    if (!options.mcpContextManager) throw new Error('MCPContextManager is required for MCPUIContextProvider');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.mcpContextManager = options.mcpContextManager;
    
    // Initialize state
    this.initialized = false;
    this.contextTypes = new Set();
    this.contextData = new Map();
    this.contextSubscriptions = new Map();
    this.contextTTL = options.contextTTL || 3600000; // Default: 1 hour
    this.contextPersistence = options.contextPersistence || false;
    this.privacyControls = options.privacyControls || {
      enabled: true,
      piiDetection: true,
      piiRedaction: true,
      sensitiveDataMasking: true,
      retentionPolicy: 'session'
    };
    
    // Create lock adapter for thread safety
    this.lockAdapter = new EnhancedAsyncLockAdapter();
    
    // Initialize locks
    this.locks = {
      contextAccess: this.lockAdapter,
      contextUpdate: this.lockAdapter,
      contextPersistence: this.lockAdapter
    };
    
    this.logger.info('MCPUIContextProvider created');
  }
  
  /**
   * Initialize the UI context provider.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing MCPUIContextProvider');
      
      // Register context types with MCP Context Manager
      await this._registerContextTypes();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Load persisted context if enabled
      if (this.contextPersistence) {
        await this._loadPersistedContext();
      }
      
      this.initialized = true;
      this.logger.info('MCPUIContextProvider initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize MCPUIContextProvider: ${error.message}`, { error });
      this.initialized = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Register context types with MCP Context Manager.
   * @private
   * @returns {Promise<void>}
   */
  async _registerContextTypes() {
    try {
      this.logger.debug('Registering context types with MCP Context Manager');
      
      // This method should be overridden by subclasses to register specific context types
      
      this.logger.debug('Context types registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register context types: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up event listeners for context updates.
   * @private
   */
  _setupEventListeners() {
    try {
      this.logger.debug('Setting up event listeners for context updates');
      
      // Listen for context update events from MCP Context Manager
      this.mcpContextManager.on('contextUpdated', this._handleContextUpdate.bind(this));
      
      // Listen for context request events from MCP Context Manager
      this.mcpContextManager.on('contextRequested', this._handleContextRequest.bind(this));
      
      this.logger.debug('Event listeners set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up event listeners: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Handle context update events from MCP Context Manager.
   * @private
   * @param {Object} event Context update event
   */
  _handleContextUpdate(event) {
    try {
      // Check if this provider is responsible for the context type
      if (!this.contextTypes.has(event.contextType)) {
        return;
      }
      
      this.logger.debug(`Handling context update for type: ${event.contextType}`);
      
      // Process context update
      this._processContextUpdate(event.contextType, event.contextData, event.source);
    } catch (error) {
      this.logger.error(`Failed to handle context update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context request events from MCP Context Manager.
   * @private
   * @param {Object} event Context request event
   */
  _handleContextRequest(event) {
    try {
      // Check if this provider is responsible for the context type
      if (!this.contextTypes.has(event.contextType)) {
        return;
      }
      
      this.logger.debug(`Handling context request for type: ${event.contextType}`);
      
      // Process context request
      this._processContextRequest(event.contextType, event.requestId, event.source);
    } catch (error) {
      this.logger.error(`Failed to handle context request: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Process context update.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @param {string} source Source of the update
   */
  async _processContextUpdate(contextType, contextData, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.contextUpdate('processContextUpdate', async () => {
        this.logger.debug(`Processing context update for type: ${contextType}`);
        
        // Apply privacy controls
        const processedData = await this._applyPrivacyControls(contextType, contextData);
        
        // Update context data
        this.contextData.set(contextType, {
          data: processedData,
          timestamp: Date.now(),
          source,
          ttl: this.contextTTL
        });
        
        // Persist context if enabled
        if (this.contextPersistence) {
          await this._persistContext(contextType);
        }
        
        // Notify subscribers
        this._notifySubscribers(contextType, processedData);
        
        this.logger.debug(`Context update processed for type: ${contextType}`);
      });
    } catch (error) {
      this.logger.error(`Failed to process context update: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Process context request.
   * @private
   * @param {string} contextType Context type
   * @param {string} requestId Request ID
   * @param {string} source Source of the request
   */
  async _processContextRequest(contextType, requestId, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.contextAccess('processContextRequest', async () => {
        this.logger.debug(`Processing context request for type: ${contextType}`);
        
        // Get context data
        const contextEntry = this.contextData.get(contextType);
        
        // Check if context data exists and is not expired
        if (contextEntry && Date.now() - contextEntry.timestamp < contextEntry.ttl) {
          // Respond to request
          await this.mcpContextManager.respondToContextRequest(requestId, {
            contextType,
            contextData: contextEntry.data,
            timestamp: contextEntry.timestamp,
            source: this.constructor.name
          });
          
          this.logger.debug(`Context request processed for type: ${contextType}`);
        } else {
          // Respond with null if context data doesn't exist or is expired
          await this.mcpContextManager.respondToContextRequest(requestId, {
            contextType,
            contextData: null,
            timestamp: Date.now(),
            source: this.constructor.name
          });
          
          this.logger.debug(`Context request processed with null data for type: ${contextType}`);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to process context request: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Apply privacy controls to context data.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @returns {Promise<Object>} Processed context data
   */
  async _applyPrivacyControls(contextType, contextData) {
    try {
      // Skip if privacy controls are disabled
      if (!this.privacyControls.enabled) {
        return contextData;
      }
      
      this.logger.debug(`Applying privacy controls for context type: ${contextType}`);
      
      let processedData = JSON.parse(JSON.stringify(contextData));
      
      // Apply PII detection and redaction
      if (this.privacyControls.piiDetection && this.privacyControls.piiRedaction) {
        processedData = await this._redactPII(processedData);
      }
      
      // Apply sensitive data masking
      if (this.privacyControls.sensitiveDataMasking) {
        processedData = await this._maskSensitiveData(processedData);
      }
      
      // Apply retention policy
      if (this.privacyControls.retentionPolicy === 'session') {
        // Session-only data doesn't need special handling here
      } else if (this.privacyControls.retentionPolicy === 'temporary') {
        // Set a short TTL for temporary data
        this.contextTTL = 300000; // 5 minutes
      } else if (this.privacyControls.retentionPolicy === 'persistent') {
        // Enable persistence for persistent data
        this.contextPersistence = true;
      }
      
      return processedData;
    } catch (error) {
      this.logger.error(`Failed to apply privacy controls: ${error.message}`, { error, contextType });
      return contextData; // Return original data on error
    }
  }
  
  /**
   * Redact personally identifiable information (PII) from context data.
   * @private
   * @param {Object} data Context data
   * @returns {Promise<Object>} Processed context data
   */
  async _redactPII(data) {
    try {
      // This is a simplified implementation
      // In a production environment, this would use more sophisticated PII detection
      
      const piiPatterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        creditCard: /\b(?:\d{4}[ -]?){3}\d{4}\b/g
      };
      
      // Convert data to string for pattern matching
      let dataStr = JSON.stringify(data);
      
      // Apply redaction for each PII pattern
      for (const [type, pattern] of Object.entries(piiPatterns)) {
        dataStr = dataStr.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
      }
      
      // Convert back to object
      return JSON.parse(dataStr);
    } catch (error) {
      this.logger.error(`Failed to redact PII: ${error.message}`, { error });
      return data; // Return original data on error
    }
  }
  
  /**
   * Mask sensitive data in context data.
   * @private
   * @param {Object} data Context data
   * @returns {Promise<Object>} Processed context data
   */
  async _maskSensitiveData(data) {
    try {
      // This is a simplified implementation
      // In a production environment, this would use more sophisticated sensitive data detection
      
      const sensitiveKeys = [
        'password', 'token', 'secret', 'key', 'credential', 'auth',
        'apiKey', 'api_key', 'accessToken', 'access_token'
      ];
      
      // Deep clone data
      const processedData = JSON.parse(JSON.stringify(data));
      
      // Recursive function to mask sensitive data
      const maskRecursive = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
          return;
        }
        
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            maskRecursive(obj[key]);
          } else if (typeof obj[key] === 'string' && sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
            obj[key] = '[MASKED]';
          }
        }
      };
      
      maskRecursive(processedData);
      
      return processedData;
    } catch (error) {
      this.logger.error(`Failed to mask sensitive data: ${error.message}`, { error });
      return data; // Return original data on error
    }
  }
  
  /**
   * Persist context data.
   * @private
   * @param {string} contextType Context type
   * @returns {Promise<void>}
   */
  async _persistContext(contextType) {
    try {
      // Use lock to ensure thread safety
      await this.locks.contextPersistence('persistContext', async () => {
        this.logger.debug(`Persisting context for type: ${contextType}`);
        
        // Skip if context persistence is disabled
        if (!this.contextPersistence) {
          return;
        }
        
        // Get context data
        const contextEntry = this.contextData.get(contextType);
        if (!contextEntry) {
          return;
        }
        
        // Persist context data
        await this.mcpContextManager.persistContext({
          contextType,
          contextData: contextEntry.data,
          timestamp: contextEntry.timestamp,
          source: this.constructor.name,
          ttl: contextEntry.ttl
        });
        
        this.logger.debug(`Context persisted for type: ${contextType}`);
      });
    } catch (error) {
      this.logger.error(`Failed to persist context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Load persisted context data.
   * @private
   * @returns {Promise<void>}
   */
  async _loadPersistedContext() {
    try {
      // Use lock to ensure thread safety
      await this.locks.contextAccess('loadPersistedContext', async () => {
        this.logger.debug('Loading persisted context');
        
        // Skip if context persistence is disabled
        if (!this.contextPersistence) {
          return;
        }
        
        // Load persisted context for each context type
        for (const contextType of this.contextTypes) {
          const persistedContext = await this.mcpContextManager.loadPersistedContext(contextType);
          
          if (persistedContext && persistedContext.contextData) {
            // Update context data
            this.contextData.set(contextType, {
              data: persistedContext.contextData,
              timestamp: persistedContext.timestamp,
              source: persistedContext.source,
              ttl: persistedContext.ttl || this.contextTTL
            });
            
            this.logger.debug(`Persisted context loaded for type: ${contextType}`);
          }
        }
        
        this.logger.debug('Persisted context loaded successfully');
      });
    } catch (error) {
      this.logger.error(`Failed to load persisted context: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Notify subscribers of context updates.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   */
  _notifySubscribers(contextType, contextData) {
    try {
      this.logger.debug(`Notifying subscribers for context type: ${contextType}`);
      
      // Get subscribers for context type
      const subscribers = this.contextSubscriptions.get(contextType);
      if (!subscribers || subscribers.size === 0) {
        return;
      }
      
      // Notify subscribers
      for (const subscriber of subscribers) {
        try {
          subscriber(contextData);
        } catch (error) {
          this.logger.error(`Failed to notify subscriber: ${error.message}`, { error, contextType });
        }
      }
      
      this.logger.debug(`Subscribers notified for context type: ${contextType}`);
    } catch (error) {
      this.logger.error(`Failed to notify subscribers: ${error.message}`, { error, contextType });
    }
  }
  
  /**
   * Subscribe to context updates.
   * @param {string} contextType Context type
   * @param {Function} callback Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(contextType, callback) {
    try {
      this.logger.debug(`Subscribing to context type: ${contextType}`);
      
      // Validate context type
      if (!this.contextTypes.has(contextType)) {
        throw new Error(`Invalid context type: ${contextType}`);
      }
      
      // Validate callback
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
      }
      
      // Get or create subscribers set
      let subscribers = this.contextSubscriptions.get(contextType);
      if (!subscribers) {
        subscribers = new Set();
        this.contextSubscriptions.set(contextType, subscribers);
      }
      
      // Add subscriber
      subscribers.add(callback);
      
      this.logger.debug(`Subscribed to context type: ${contextType}`);
      
      // Return unsubscribe function
      return () => {
        this.unsubscribe(contextType, callback);
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Unsubscribe from context updates.
   * @param {string} contextType Context type
   * @param {Function} callback Callback function
   * @returns {boolean} True if unsubscribed successfully
   */
  unsubscribe(contextType, callback) {
    try {
      this.logger.debug(`Unsubscribing from context type: ${contextType}`);
      
      // Validate context type
      if (!this.contextTypes.has(contextType)) {
        throw new Error(`Invalid context type: ${contextType}`);
      }
      
      // Validate callback
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
      }
      
      // Get subscribers set
      const subscribers = this.contextSubscriptions.get(contextType);
      if (!subscribers) {
        return false;
      }
      
      // Remove subscriber
      const result = subscribers.delete(callback);
      
      this.logger.debug(`Unsubscribed from context type: ${contextType}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Update context data.
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @returns {Promise<boolean>} True if update was successful
   */
  async updateContext(contextType, contextData) {
    try {
      this.logger.debug(`Updating context for type: ${contextType}`);
      
      // Validate context type
      if (!this.contextTypes.has(contextType)) {
        throw new Error(`Invalid context type: ${contextType}`);
      }
      
      // Validate context data
      if (!contextData) {
        throw new Error('Context data is required');
      }
      
      // Update context via MCP Context Manager
      await this.mcpContextManager.updateContext({
        contextType,
        contextData,
        source: this.constructor.name
      });
      
      this.logger.debug(`Context updated for type: ${contextType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to update context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Get context data.
   * @param {string} contextType Context type
   * @returns {Promise<Object>} Context data
   */
  async getContext(contextType) {
    try {
      this.logger.debug(`Getting context for type: ${contextType}`);
      
      // Validate context type
      if (!this.contextTypes.has(contextType)) {
        throw new Error(`Invalid context type: ${contextType}`);
      }
      
      // Use lock to ensure thread safety
      return await this.locks.contextAccess('getContext', async () => {
        // Get context data
        const contextEntry = this.contextData.get(contextType);
        
        // Check if context data exists and is not expired
        if (contextEntry && Date.now() - contextEntry.timestamp < contextEntry.ttl) {
          this.logger.debug(`Context retrieved for type: ${contextType}`);
          return contextEntry.data;
        }
        
        // Request context from MCP Context Manager if not available locally
        const contextResponse = await this.mcpContextManager.requestContext(contextType);
        
        if (contextResponse && contextResponse.contextData) {
          // Update local context data
          this.contextData.set(contextType, {
            data: contextResponse.contextData,
            timestamp: contextResponse.timestamp,
            source: contextResponse.source,
            ttl: this.contextTTL
          });
          
          this.logger.debug(`Context retrieved from MCP Context Manager for type: ${contextType}`);
          return contextResponse.contextData;
        }
        
        this.logger.debug(`Context not found for type: ${contextType}`);
        return null;
      });
    } catch (error) {
      this.logger.error(`Failed to get context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Clear context data.
   * @param {string} contextType Context type
   * @returns {Promise<boolean>} True if clear was successful
   */
  async clearContext(contextType) {
    try {
      this.logger.debug(`Clearing context for type: ${contextType}`);
      
      // Validate context type
      if (!this.contextTypes.has(contextType)) {
        throw new Error(`Invalid context type: ${contextType}`);
      }
      
      // Use lock to ensure thread safety
      await this.locks.contextUpdate('clearContext', async () => {
        // Remove context data
        this.contextData.delete(contextType);
        
        // Clear persisted context if enabled
        if (this.contextPersistence) {
          await this.mcpContextManager.clearPersistedContext(contextType);
        }
      });
      
      this.logger.debug(`Context cleared for type: ${contextType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Dispose of resources.
   * @returns {Promise<void>}
   */
  async dispose() {
    try {
      this.logger.info('Disposing MCPUIContextProvider');
      
      // Clear all context data
      this.contextData.clear();
      
      // Clear all subscriptions
      this.contextSubscriptions.clear();
      
      // Remove event listeners
      this.mcpContextManager.removeAllListeners('contextUpdated');
      this.mcpContextManager.removeAllListeners('contextRequested');
      
      this.initialized = false;
      
      this.logger.info('MCPUIContextProvider disposed successfully');
    } catch (error) {
      this.logger.error(`Failed to dispose MCPUIContextProvider: ${error.message}`, { error });
      throw error;
    }
  }
}

// Export as default export to ensure require returns the class directly
module.exports = MCPUIContextProvider;
