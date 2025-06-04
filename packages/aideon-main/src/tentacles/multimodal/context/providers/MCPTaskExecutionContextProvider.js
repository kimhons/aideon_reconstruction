/**
 * @fileoverview MCPTaskExecutionContextProvider base class for Task Execution tentacles.
 * Provides context management capabilities for task execution components.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');

// Import dependencies in a way that can be mocked in tests
let dependencies = {};
try {
  dependencies = {
    Logger: require('../../../../../core/logging/Logger').Logger,
    ConfigurationService: require('../../../../../core/ConfigurationService').ConfigurationService,
    PerformanceMonitor: require('../../../../../core/monitoring/PerformanceMonitor').PerformanceMonitor
  };
} catch (error) {
  // Fallback for tests - will be overridden by dependency injection
  dependencies = {
    Logger: class Logger {
      constructor(name) { this.name = name; }
      debug() {}
      info() {}
      warn() {}
      error() {}
    },
    ConfigurationService: class ConfigurationService {
      getConfig(key, defaultValue) { return defaultValue; }
    },
    PerformanceMonitor: class PerformanceMonitor {
      constructor() {}
      startTimer() { return 'mock-timer'; }
      endTimer() {}
    }
  };
}

// Import EnhancedAsyncLockAdapter with path that can be overridden in tests
let EnhancedAsyncLockAdapter;
try {
  EnhancedAsyncLockAdapter = require('../../../input/utils/EnhancedAsyncLockAdapter').EnhancedAsyncLockAdapter;
} catch (error) {
  // Fallback for tests - will be overridden by dependency injection
  EnhancedAsyncLockAdapter = {
    withLock: async (lockName, fn, ...args) => fn(...args)
  };
}

/**
 * Base class for all Task Execution MCP context providers.
 * Provides common functionality for context management in task execution components.
 */
class MCPTaskExecutionContextProvider extends EventEmitter {
  /**
   * Creates a new MCPTaskExecutionContextProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.providerId - Unique identifier for this provider
   * @param {ConfigurationService} [options.configService] - Configuration service
   * @param {Logger} [options.logger] - Logger instance
   * @param {PerformanceMonitor} [options.performanceMonitor] - Performance monitor
   */
  constructor(options = {}) {
    super();
    
    if (!options.providerId) {
      throw new Error('providerId is required for MCPTaskExecutionContextProvider');
    }
    
    this.providerId = options.providerId;
    
    // Allow dependency injection for core dependencies
    const { Logger, ConfigurationService, PerformanceMonitor } = options.dependencies || dependencies;
    
    this.configService = options.configService || new ConfigurationService();
    this.logger = options.logger || new Logger(`MCPTaskExecutionContextProvider:${this.providerId}`);
    this.performanceMonitor = options.performanceMonitor || new PerformanceMonitor({
      configService: this.configService,
      logger: this.logger
    });
    
    // Allow dependency injection of EnhancedAsyncLockAdapter
    this.lockAdapter = options.lockAdapter || EnhancedAsyncLockAdapter;
    
    // Load configuration
    this.config = this.configService.getConfig('mcp.taskExecution', {
      contextTTL: 3600000, // 1 hour
      maxContextSize: 1048576, // 1MB
      persistContext: true,
      privacyEnabled: true,
      securityLevel: 'high',
      compressionEnabled: true,
      compressionThreshold: 10240, // 10KB
      priorityLevels: ['low', 'medium', 'high', 'critical'],
      defaultPriority: 'medium'
    });
    
    // Initialize context storage
    this.contexts = new Map();
    
    // Initialize locks
    this.locks = {
      contextAccess: this.lockAdapter,
      contextUpdate: this.lockAdapter,
      contextPersistence: this.lockAdapter
    };
    
    this.logger.info(`MCPTaskExecutionContextProvider initialized with ID: ${this.providerId}`);
  }
  
  /**
   * Registers this provider with the MCP Context Manager.
   * 
   * @param {Object} mcpContextManager - MCP Context Manager instance
   * @returns {Promise<boolean>} Whether registration was successful
   */
  async register(mcpContextManager) {
    if (!mcpContextManager) {
      throw new Error('mcpContextManager is required for registration');
    }
    
    try {
      this.mcpContextManager = mcpContextManager;
      
      // Register supported context types
      const registrationResult = await mcpContextManager.registerProvider(this.providerId, {
        provider: this,
        contextTypes: this.getSupportedContextTypes(),
        capabilities: this.getCapabilities()
      });
      
      if (registrationResult) {
        this.logger.info(`Provider ${this.providerId} registered successfully with MCP Context Manager`);
        
        // Subscribe to relevant context updates from other providers
        await this.subscribeToRelevantContexts();
      } else {
        this.logger.error(`Failed to register provider ${this.providerId} with MCP Context Manager`);
      }
      
      return registrationResult;
    } catch (error) {
      this.logger.error(`Error registering provider ${this.providerId}`, error);
      return false;
    }
  }
  
  /**
   * Gets the supported context types for this provider.
   * Must be implemented by subclasses.
   * 
   * @returns {string[]} Array of supported context types
   */
  getSupportedContextTypes() {
    throw new Error('getSupportedContextTypes must be implemented by subclass');
  }
  
  /**
   * Gets the capabilities of this provider.
   * 
   * @returns {Object} Provider capabilities
   */
  getCapabilities() {
    return {
      canProvide: true,
      canConsume: true,
      canPersist: this.config.persistContext,
      privacyLevel: this.config.securityLevel,
      priorityLevels: this.config.priorityLevels,
      defaultPriority: this.config.defaultPriority,
      maxContextSize: this.config.maxContextSize
    };
  }
  
  /**
   * Subscribes to relevant context types from other providers.
   * 
   * @returns {Promise<void>}
   */
  async subscribeToRelevantContexts() {
    if (!this.mcpContextManager) {
      throw new Error('Provider must be registered before subscribing to contexts');
    }
    
    try {
      // Get relevant context types based on provider type
      const relevantContextTypes = this.getRelevantContextTypes();
      
      for (const contextType of relevantContextTypes) {
        await this.mcpContextManager.subscribeToContext(this.providerId, contextType);
        this.logger.debug(`Subscribed to context type: ${contextType}`);
      }
      
      this.logger.info(`Provider ${this.providerId} subscribed to ${relevantContextTypes.length} context types`);
    } catch (error) {
      this.logger.error(`Error subscribing to relevant contexts`, error);
    }
  }
  
  /**
   * Gets relevant context types for this provider.
   * Must be implemented by subclasses.
   * 
   * @returns {string[]} Array of relevant context types
   */
  getRelevantContextTypes() {
    throw new Error('getRelevantContextTypes must be implemented by subclass');
  }
  
  /**
   * Provides context to the MCP Context Manager.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @param {Object} [options] - Additional options
   * @param {string} [options.priority] - Priority level
   * @param {number} [options.ttl] - Time to live in milliseconds
   * @param {boolean} [options.persist] - Whether to persist the context
   * @returns {Promise<boolean>} Whether context was successfully provided
   */
  async provideContext(contextType, contextData, options = {}) {
    if (!this.mcpContextManager) {
      throw new Error('Provider must be registered before providing context');
    }
    
    if (!contextType || !contextData) {
      throw new Error('contextType and contextData are required');
    }
    
    // Start performance monitoring
    const timerId = this.performanceMonitor.startTimer(`provideContext_${contextType}`);
    
    try {
      // Validate context type
      if (!this.getSupportedContextTypes().includes(contextType)) {
        throw new Error(`Context type ${contextType} is not supported by this provider`);
      }
      
      // Validate context data
      this.validateContextData(contextType, contextData);
      
      // Apply privacy controls if enabled
      let processedContextData = contextData;
      if (this.config.privacyEnabled) {
        processedContextData = this.applyPrivacyControls(contextType, contextData);
      }
      
      // Apply compression if enabled and data exceeds threshold
      if (this.config.compressionEnabled && 
          JSON.stringify(processedContextData).length > this.config.compressionThreshold) {
        processedContextData = await this.compressContextData(processedContextData);
      }
      
      // Prepare context metadata
      const contextMetadata = {
        providerId: this.providerId,
        timestamp: Date.now(),
        priority: options.priority || this.config.defaultPriority,
        ttl: options.ttl || this.config.contextTTL,
        persist: options.persist !== undefined ? options.persist : this.config.persistContext,
        compressed: processedContextData._compressed || false
      };
      
      // Store context locally
      await this.locks.contextUpdate.acquire(async () => {
        this.contexts.set(contextType, {
          data: processedContextData,
          metadata: contextMetadata
        });
      });
      
      // Provide context to MCP Context Manager
      const result = await this.mcpContextManager.provideContext(
        this.providerId,
        contextType,
        processedContextData,
        contextMetadata
      );
      
      // Emit event
      this.emit('contextProvided', {
        contextType,
        metadata: contextMetadata
      });
      
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      return result;
    } catch (error) {
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      this.logger.error(`Error providing context ${contextType}`, error);
      return false;
    }
  }
  
  /**
   * Validates context data against schema.
   * Must be implemented by subclasses.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data to validate
   * @throws {Error} If validation fails
   */
  validateContextData(contextType, contextData) {
    throw new Error('validateContextData must be implemented by subclass');
  }
  
  /**
   * Applies privacy controls to context data.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @returns {Object} Privacy-controlled context data
   */
  applyPrivacyControls(contextType, contextData) {
    // Base implementation - subclasses should override with specific privacy controls
    return { ...contextData };
  }
  
  /**
   * Compresses context data.
   * 
   * @param {Object} contextData - Context data to compress
   * @returns {Promise<Object>} Compressed context data
   */
  async compressContextData(contextData) {
    // Simple implementation - in production, use proper compression
    return {
      _compressed: true,
      _originalSize: JSON.stringify(contextData).length,
      data: JSON.stringify(contextData)
    };
  }
  
  /**
   * Decompresses context data.
   * 
   * @param {Object} compressedData - Compressed context data
   * @returns {Promise<Object>} Decompressed context data
   */
  async decompressContextData(compressedData) {
    if (!compressedData._compressed) {
      return compressedData;
    }
    
    // Simple implementation - in production, use proper decompression
    return JSON.parse(compressedData.data);
  }
  
  /**
   * Consumes context from the MCP Context Manager.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async consumeContext(contextType, contextData, metadata) {
    // Start performance monitoring
    const timerId = this.performanceMonitor.startTimer(`consumeContext_${contextType}`);
    
    try {
      // Skip if context is from this provider
      if (metadata.providerId === this.providerId) {
        return;
      }
      
      // Decompress if necessary
      let processedContextData = contextData;
      if (contextData._compressed) {
        processedContextData = await this.decompressContextData(contextData);
      }
      
      // Process context based on type
      await this.processContext(contextType, processedContextData, metadata);
      
      // Emit event
      this.emit('contextConsumed', {
        contextType,
        metadata
      });
      
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
    } catch (error) {
      // End performance monitoring
      this.performanceMonitor.endTimer(timerId);
      
      this.logger.error(`Error consuming context ${contextType}`, error);
    }
  }
  
  /**
   * Processes consumed context.
   * Must be implemented by subclasses.
   * 
   * @param {string} contextType - Type of context
   * @param {Object} contextData - Context data
   * @param {Object} metadata - Context metadata
   * @returns {Promise<void>}
   */
  async processContext(contextType, contextData, metadata) {
    throw new Error('processContext must be implemented by subclass');
  }
  
  /**
   * Gets context by type.
   * 
   * @param {string} contextType - Type of context
   * @returns {Promise<Object|null>} Context data or null if not found
   */
  async getContext(contextType) {
    return await this.locks.contextAccess.acquire(async () => {
      const context = this.contexts.get(contextType);
      
      if (!context) {
        return null;
      }
      
      // Check if context has expired
      if (context.metadata.timestamp + context.metadata.ttl < Date.now()) {
        this.contexts.delete(contextType);
        return null;
      }
      
      // Decompress if necessary
      let contextData = context.data;
      if (contextData._compressed) {
        contextData = await this.decompressContextData(contextData);
      }
      
      return {
        data: contextData,
        metadata: context.metadata
      };
    });
  }
  
  /**
   * Clears all contexts.
   * 
   * @returns {Promise<void>}
   */
  async clearContexts() {
    await this.locks.contextUpdate.acquire(async () => {
      this.contexts.clear();
      this.logger.info('All contexts cleared');
    });
  }
  
  /**
   * Disposes of the provider.
   * 
   * @returns {Promise<void>}
   */
  async dispose() {
    this.logger.info(`Disposing provider ${this.providerId}`);
    
    // Unregister from MCP Context Manager
    if (this.mcpContextManager) {
      await this.mcpContextManager.unregisterProvider(this.providerId);
    }
    
    // Clear contexts
    await this.clearContexts();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    this.logger.info(`Provider ${this.providerId} disposed`);
  }
}

module.exports = { MCPTaskExecutionContextProvider };
