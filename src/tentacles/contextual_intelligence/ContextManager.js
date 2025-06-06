/**
 * @fileoverview Context Manager for the Contextual Intelligence Tentacle.
 * This is the central component responsible for managing context throughout the system.
 * It coordinates all other context management components and provides the main API for context operations.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { deepClone, deepMerge } = require('../utils/object_utils');

// Import managers - these will be implemented in subsequent steps
const ContextHierarchyManager = require('./hierarchy_manager/ContextHierarchyManager');
const CrossDomainContextManager = require('./cross_domain_manager/CrossDomainContextManager');

// These will be implemented in future steps
let TemporalContextManager;
let ContextPersistenceManager;
let ContextAnalysisEngine;
let ContextVisualizationTool;

// Dynamic imports to handle missing modules gracefully
try {
  TemporalContextManager = require('./temporal_manager/TemporalContextManager');
} catch (error) {
  // Module will be implemented later
  TemporalContextManager = class TemporalContextManagerStub {
    constructor() {
      console.warn('TemporalContextManager not implemented yet. Using stub.');
    }
    createSnapshot() { return Promise.resolve(null); }
    getContextAtTime() { return Promise.resolve(null); }
    getContextEvolution() { return Promise.resolve([]); }
  };
}

try {
  ContextPersistenceManager = require('./persistence_manager/ContextPersistenceManager');
} catch (error) {
  // Module will be implemented later
  ContextPersistenceManager = class ContextPersistenceManagerStub {
    constructor() {
      console.warn('ContextPersistenceManager not implemented yet. Using stub.');
    }
    saveContext() { return Promise.resolve(true); }
    loadContext() { return Promise.resolve(null); }
    deleteContext() { return Promise.resolve(true); }
  };
}

try {
  ContextAnalysisEngine = require('./analysis_engine/ContextAnalysisEngine');
} catch (error) {
  // Module will be implemented later
  ContextAnalysisEngine = class ContextAnalysisEngineStub {
    constructor() {
      console.warn('ContextAnalysisEngine not implemented yet. Using stub.');
    }
    analyzeContext() { return Promise.resolve({}); }
    detectPatterns() { return Promise.resolve([]); }
    generateInsights() { return Promise.resolve([]); }
  };
}

try {
  ContextVisualizationTool = require('./visualization_tool/ContextVisualizationTool');
} catch (error) {
  // Module will be implemented later
  ContextVisualizationTool = class ContextVisualizationToolStub {
    constructor() {
      console.warn('ContextVisualizationTool not implemented yet. Using stub.');
    }
    visualizeContext() { return Promise.resolve(null); }
  };
}

/**
 * The central component responsible for managing context throughout the system.
 */
class ContextManager {
  /**
   * Creates a new ContextManager instance.
   * @param {Object} options - Configuration options
   * @param {Map} [options.activeContexts] - Initial active contexts
   * @param {Map} [options.contextHistory] - Initial context history
   * @param {EventEmitter} [options.eventEmitter] - Event emitter for context events
   * @param {ContextHierarchyManager} [options.hierarchyManager] - Context hierarchy manager
   * @param {TemporalContextManager} [options.temporalManager] - Temporal context manager
   * @param {CrossDomainContextManager} [options.crossDomainManager] - Cross-domain context manager
   * @param {ContextPersistenceManager} [options.persistenceManager] - Context persistence manager
   * @param {ContextAnalysisEngine} [options.analysisEngine] - Context analysis engine
   * @param {ContextVisualizationTool} [options.visualizationTool] - Context visualization tool
   */
  constructor(options = {}) {
    this.activeContexts = options.activeContexts || new Map();
    this.contextHistory = options.contextHistory || new Map();
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    
    // Set up maximum listeners to avoid memory leaks
    this.eventEmitter.setMaxListeners(100);
    
    // Initialize component managers
    this.hierarchyManager = options.hierarchyManager || new ContextHierarchyManager({
      eventEmitter: this.eventEmitter
    });
    
    this.temporalManager = options.temporalManager || new TemporalContextManager({
      eventEmitter: this.eventEmitter
    });
    
    this.crossDomainManager = options.crossDomainManager || new CrossDomainContextManager({
      eventEmitter: this.eventEmitter
    });
    
    this.persistenceManager = options.persistenceManager || new ContextPersistenceManager({
      eventEmitter: this.eventEmitter
    });
    
    this.analysisEngine = options.analysisEngine || new ContextAnalysisEngine({
      eventEmitter: this.eventEmitter
    });
    
    this.visualizationTool = options.visualizationTool || new ContextVisualizationTool({
      eventEmitter: this.eventEmitter
    });
    
    // Set up context watchers
    this.contextWatchers = new Map();
    
    // Set up event listeners
    this._setupEventListeners();
    
    // Initialization state
    this.initialized = false;
    this.initializationPromise = null;
  }
  
  /**
   * Initializes the Context Manager and all its components.
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return true;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = (async () => {
      try {
        // Initialize all component managers
        await Promise.all([
          this._safeInitialize(this.hierarchyManager, 'hierarchyManager'),
          this._safeInitialize(this.temporalManager, 'temporalManager'),
          this._safeInitialize(this.crossDomainManager, 'crossDomainManager'),
          this._safeInitialize(this.persistenceManager, 'persistenceManager'),
          this._safeInitialize(this.analysisEngine, 'analysisEngine'),
          this._safeInitialize(this.visualizationTool, 'visualizationTool')
        ]);
        
        // Load persisted contexts if available
        if (options.loadPersistedContexts !== false) {
          await this._loadPersistedContexts();
        }
        
        this.initialized = true;
        this.eventEmitter.emit('context:manager:initialized');
        return true;
      } catch (error) {
        this.eventEmitter.emit('context:manager:error', {
          operation: 'initialize',
          error: error.message
        });
        throw error;
      }
    })();
    
    return this.initializationPromise;
  }
  
  /**
   * Safely initializes a component manager.
   * @param {Object} manager - The manager to initialize
   * @param {string} managerName - The name of the manager
   * @returns {Promise<void>} - Promise resolving when initialization is complete
   * @private
   */
  async _safeInitialize(manager, managerName) {
    try {
      if (manager && typeof manager.initialize === 'function') {
        await manager.initialize();
      }
    } catch (error) {
      this.eventEmitter.emit('context:manager:warning', {
        operation: 'initialize',
        component: managerName,
        error: error.message
      });
      // Continue initialization despite component failure
    }
  }
  
  /**
   * Loads persisted contexts from storage.
   * @returns {Promise<void>} - Promise resolving when loading is complete
   * @private
   */
  async _loadPersistedContexts() {
    try {
      if (this.persistenceManager && typeof this.persistenceManager.loadAllContexts === 'function') {
        const contexts = await this.persistenceManager.loadAllContexts();
        
        if (contexts && typeof contexts === 'object') {
          for (const [path, context] of Object.entries(contexts)) {
            await this.registerContext(path, {
              type: context._type || 'unknown',
              initialState: context,
              persistence: { enabled: true }
            });
          }
        }
      }
    } catch (error) {
      this.eventEmitter.emit('context:manager:warning', {
        operation: 'loadPersistedContexts',
        error: error.message
      });
    }
  }
  
  /**
   * Sets up event listeners for context events.
   * @private
   */
  _setupEventListeners() {
    // Listen for context updates from hierarchy manager
    this.eventEmitter.on('context:updated', (event) => {
      const { path, oldValue, newValue } = event;
      
      // Update active contexts
      this.activeContexts.set(path, newValue);
      
      // Notify watchers
      this._notifyWatchers(path, newValue, oldValue);
      
      // Create temporal snapshot if needed
      this._createTemporalSnapshotIfNeeded(path, newValue);
      
      // Persist context if needed
      this._persistContextIfNeeded(path, newValue);
    });
    
    // Listen for context registrations
    this.eventEmitter.on('context:registered', (event) => {
      const { path, type } = event;
      
      // Add to active contexts
      if (this.hierarchyManager) {
        const context = this.hierarchyManager.getContext(path);
        if (context) {
          this.activeContexts.set(path, context);
        }
      }
    });
    
    // Listen for context deletions
    this.eventEmitter.on('context:deleted', (event) => {
      const { path, oldValue } = event;
      
      // Remove from active contexts
      this.activeContexts.delete(path);
      
      // Add to history
      this.contextHistory.set(path, {
        lastValue: oldValue,
        deletedAt: Date.now()
      });
      
      // Remove watchers
      this.contextWatchers.delete(path);
      
      // Delete persisted context if needed
      this._deletePersistedContextIfNeeded(path);
    });
  }
  
  /**
   * Creates a temporal snapshot if needed.
   * @param {string} path - The context path
   * @param {Object} context - The context value
   * @private
   */
  async _createTemporalSnapshotIfNeeded(path, context) {
    try {
      if (this.temporalManager && typeof this.temporalManager.createSnapshot === 'function') {
        await this.temporalManager.createSnapshot(path, deepClone(context));
      }
    } catch (error) {
      this.eventEmitter.emit('context:manager:warning', {
        operation: 'createTemporalSnapshot',
        path,
        error: error.message
      });
    }
  }
  
  /**
   * Persists a context if needed.
   * @param {string} path - The context path
   * @param {Object} context - The context value
   * @private
   */
  async _persistContextIfNeeded(path, context) {
    try {
      // Check if context has persistence enabled
      const persistenceEnabled = this._isContextPersistenceEnabled(path);
      
      if (persistenceEnabled && this.persistenceManager && typeof this.persistenceManager.saveContext === 'function') {
        await this.persistenceManager.saveContext(path, deepClone(context));
      }
    } catch (error) {
      this.eventEmitter.emit('context:manager:warning', {
        operation: 'persistContext',
        path,
        error: error.message
      });
    }
  }
  
  /**
   * Deletes a persisted context if needed.
   * @param {string} path - The context path
   * @private
   */
  async _deletePersistedContextIfNeeded(path) {
    try {
      // Check if context has persistence enabled
      const persistenceEnabled = this._isContextPersistenceEnabled(path);
      
      if (persistenceEnabled && this.persistenceManager && typeof this.persistenceManager.deleteContext === 'function') {
        await this.persistenceManager.deleteContext(path);
      }
    } catch (error) {
      this.eventEmitter.emit('context:manager:warning', {
        operation: 'deletePersistedContext',
        path,
        error: error.message
      });
    }
  }
  
  /**
   * Checks if context persistence is enabled for a path.
   * @param {string} path - The context path
   * @returns {boolean} - True if persistence is enabled
   * @private
   */
  _isContextPersistenceEnabled(path) {
    // Default to false
    let persistenceEnabled = false;
    
    try {
      // Try to get context definition from active contexts
      const context = this.activeContexts.get(path);
      
      if (context && context._persistence && context._persistence.enabled) {
        persistenceEnabled = true;
      }
    } catch (error) {
      // Ignore errors
    }
    
    return persistenceEnabled;
  }
  
  /**
   * Notifies watchers of context changes.
   * @param {string} path - The context path
   * @param {Object} newValue - The new context value
   * @param {Object} oldValue - The old context value
   * @private
   */
  _notifyWatchers(path, newValue, oldValue) {
    // Notify exact path watchers
    if (this.contextWatchers.has(path)) {
      const watchers = this.contextWatchers.get(path);
      for (const watcher of watchers) {
        try {
          watcher(deepClone(newValue), deepClone(oldValue), path);
        } catch (error) {
          this.eventEmitter.emit('context:manager:warning', {
            operation: 'notifyWatcher',
            path,
            error: error.message
          });
        }
      }
    }
    
    // Notify parent path watchers
    const pathParts = path.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      
      if (this.contextWatchers.has(parentPath)) {
        const watchers = this.contextWatchers.get(parentPath);
        for (const watcher of watchers) {
          try {
            // For parent watchers, we need to get the full context at the parent path
            const parentContext = this.getContext(parentPath);
            const oldParentContext = oldValue ? this._getParentContextFromPath(oldValue, parentPath, path) : null;
            
            watcher(deepClone(parentContext), deepClone(oldParentContext), path);
          } catch (error) {
            this.eventEmitter.emit('context:manager:warning', {
              operation: 'notifyParentWatcher',
              path: parentPath,
              error: error.message
            });
          }
        }
      }
    }
  }
  
  /**
   * Gets a parent context from a path.
   * @param {Object} context - The context
   * @param {string} parentPath - The parent path
   * @param {string} fullPath - The full path
   * @returns {Object|null} - The parent context or null
   * @private
   */
  _getParentContextFromPath(context, parentPath, fullPath) {
    // This is a simplified implementation
    return null;
  }
  
  /**
   * Registers a new context.
   * @param {string} path - The path where the context should be registered
   * @param {Object} contextDefinition - The context definition
   * @param {string} contextDefinition.type - The type of context (e.g., 'task', 'domain')
   * @param {string} [contextDefinition.parent] - The parent context path
   * @param {Object} [contextDefinition.initialState] - The initial state of the context
   * @param {Object} [contextDefinition.schema] - The schema for validating the context
   * @param {Object} [contextDefinition.persistence] - Persistence options
   * @param {boolean} [contextDefinition.persistence.enabled] - Whether persistence is enabled
   * @param {string} [contextDefinition.persistence.expiration] - When the context expires
   * @returns {Promise<boolean>} - Promise resolving to true if registration was successful
   */
  async registerContext(path, contextDefinition) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Validate inputs
      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }
      
      if (!contextDefinition || typeof contextDefinition !== 'object') {
        throw new Error('Context definition must be an object');
      }
      
      if (!contextDefinition.type) {
        throw new Error('Context definition must include a type');
      }
      
      // Prepare the initial state with metadata
      const initialState = contextDefinition.initialState || {};
      
      // Add metadata to the context
      const contextWithMetadata = {
        ...initialState,
        _type: contextDefinition.type,
        _createdAt: Date.now(),
        _updatedAt: Date.now()
      };
      
      // Add persistence metadata if specified
      if (contextDefinition.persistence) {
        contextWithMetadata._persistence = {
          enabled: contextDefinition.persistence.enabled !== undefined ? contextDefinition.persistence.enabled : false,
          expiration: contextDefinition.persistence.expiration || null
        };
      }
      
      // Register with hierarchy manager
      const success = this.hierarchyManager.registerContext(path, {
        ...contextDefinition,
        initialState: contextWithMetadata
      });
      
      if (success) {
        // Add to active contexts
        const context = this.hierarchyManager.getContext(path);
        if (context) {
          this.activeContexts.set(path, context);
          
          // Create initial temporal snapshot
          await this._createTemporalSnapshotIfNeeded(path, context);
          
          // Persist if needed
          await this._persistContextIfNeeded(path, context);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'registerContext',
        path,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Gets a context.
   * @param {string} path - The path to the context
   * @returns {Object|null} - The context or null if not found
   */
  getContext(path) {
    try {
      if (!this.initialized) {
        throw new Error('Context Manager is not initialized');
      }
      
      // Try to get from active contexts first
      if (this.activeContexts.has(path)) {
        return deepClone(this.activeContexts.get(path));
      }
      
      // Fall back to hierarchy manager
      if (this.hierarchyManager) {
        return this.hierarchyManager.getContext(path);
      }
      
      return null;
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'getContext',
        path,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Updates a context.
   * @param {string} path - The path to the context
   * @param {Object} updates - The updates to apply
   * @param {boolean} [merge=true] - Whether to merge with existing context or replace
   * @returns {Promise<boolean>} - Promise resolving to true if update was successful
   */
  async updateContext(path, updates, merge = true) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Validate inputs
      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates must be an object');
      }
      
      // Add metadata to updates
      const updatesWithMetadata = {
        ...updates,
        _updatedAt: Date.now()
      };
      
      // Update with hierarchy manager
      return this.hierarchyManager.updateContext(path, updatesWithMetadata, merge);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'updateContext',
        path,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Deletes a context.
   * @param {string} path - The path to the context
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deleteContext(path) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Validate inputs
      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }
      
      // Delete with hierarchy manager
      return this.hierarchyManager.deleteContext(path);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'deleteContext',
        path,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Lists all contexts.
   * @param {string} [basePath=''] - The base path to start listing from
   * @param {boolean} [recursive=true] - Whether to list recursively
   * @returns {Promise<Array<string>>} - Promise resolving to array of context paths
   */
  async listContexts(basePath = '', recursive = true) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // List with hierarchy manager
      return this.hierarchyManager.listContexts(basePath, recursive);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'listContexts',
        basePath,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Watches for changes to a specific context.
   * @param {string} path - The path to the context
   * @param {Function} callback - The callback to call when the context changes
   * @returns {Function} - Function to stop watching
   */
  watchContext(path, callback) {
    try {
      if (!path || typeof path !== 'string') {
        throw new Error('Context path must be a non-empty string');
      }
      
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
      }
      
      // Add to watchers
      if (!this.contextWatchers.has(path)) {
        this.contextWatchers.set(path, new Set());
      }
      
      const watchers = this.contextWatchers.get(path);
      watchers.add(callback);
      
      // Return function to stop watching
      return () => {
        if (this.contextWatchers.has(path)) {
          const watchers = this.contextWatchers.get(path);
          watchers.delete(callback);
          
          if (watchers.size === 0) {
            this.contextWatchers.delete(path);
          }
        }
      };
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'watchContext',
        path,
        error: error.message
      });
      
      // Return no-op function
      return () => {};
    }
  }
  
  /**
   * Gets historical context at a specific time.
   * @param {string} path - The path to the context
   * @param {number} timestamp - The timestamp to get context at
   * @returns {Promise<Object|null>} - Promise resolving to historical context or null
   */
  async getContextAtTime(path, timestamp) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.temporalManager || typeof this.temporalManager.getContextAtTime !== 'function') {
        throw new Error('Temporal Context Manager not available');
      }
      
      return this.temporalManager.getContextAtTime(path, timestamp);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'getContextAtTime',
        path,
        timestamp,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Gets context evolution over a time period.
   * @param {string} path - The path to the context
   * @param {number} startTime - The start timestamp
   * @param {number} endTime - The end timestamp
   * @returns {Promise<Array<Object>>} - Promise resolving to array of context snapshots
   */
  async getContextEvolution(path, startTime, endTime) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.temporalManager || typeof this.temporalManager.getContextEvolution !== 'function') {
        throw new Error('Temporal Context Manager not available');
      }
      
      return this.temporalManager.getContextEvolution(path, startTime, endTime);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'getContextEvolution',
        path,
        startTime,
        endTime,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Translates context between domains.
   * @param {string} sourceDomain - The source domain path
   * @param {string} targetDomain - The target domain path
   * @param {Object} sourceContext - The source context to translate
   * @returns {Promise<Object|null>} - Promise resolving to translated context or null
   */
  async translateContext(sourceDomain, targetDomain, sourceContext) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.crossDomainManager || typeof this.crossDomainManager.translateContext !== 'function') {
        throw new Error('Cross-Domain Context Manager not available');
      }
      
      return this.crossDomainManager.translateContext(sourceDomain, targetDomain, sourceContext);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'translateContext',
        sourceDomain,
        targetDomain,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Analyzes context to extract insights.
   * @param {string} path - The path to the context
   * @param {Array<string>} [analysisTypes] - Types of analysis to perform
   * @returns {Promise<Object>} - Promise resolving to analysis results
   */
  async analyzeContext(path, analysisTypes) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.analysisEngine || typeof this.analysisEngine.analyzeContext !== 'function') {
        throw new Error('Context Analysis Engine not available');
      }
      
      const context = this.getContext(path);
      if (!context) {
        throw new Error(`Context not found at path: ${path}`);
      }
      
      return this.analysisEngine.analyzeContext(context, analysisTypes);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'analyzeContext',
        path,
        error: error.message
      });
      return {};
    }
  }
  
  /**
   * Visualizes context for debugging.
   * @param {string} path - The path to the context
   * @param {string} [format='json'] - Visualization format
   * @returns {Promise<string|null>} - Promise resolving to visualization or null
   */
  async visualizeContext(path, format = 'json') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.visualizationTool || typeof this.visualizationTool.visualizeContext !== 'function') {
        throw new Error('Context Visualization Tool not available');
      }
      
      const context = this.getContext(path);
      if (!context) {
        throw new Error(`Context not found at path: ${path}`);
      }
      
      return this.visualizationTool.visualizeContext(context, format);
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'visualizeContext',
        path,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Shuts down the Context Manager and all its components.
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    try {
      // Shut down all component managers
      await Promise.all([
        this._safeShutdown(this.hierarchyManager, 'hierarchyManager'),
        this._safeShutdown(this.temporalManager, 'temporalManager'),
        this._safeShutdown(this.crossDomainManager, 'crossDomainManager'),
        this._safeShutdown(this.persistenceManager, 'persistenceManager'),
        this._safeShutdown(this.analysisEngine, 'analysisEngine'),
        this._safeShutdown(this.visualizationTool, 'visualizationTool')
      ]);
      
      // Clear all watchers
      this.contextWatchers.clear();
      
      // Remove all listeners
      this.eventEmitter.removeAllListeners();
      
      this.initialized = false;
      this.initializationPromise = null;
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('context:manager:error', {
        operation: 'shutdown',
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Safely shuts down a component manager.
   * @param {Object} manager - The manager to shut down
   * @param {string} managerName - The name of the manager
   * @returns {Promise<void>} - Promise resolving when shutdown is complete
   * @private
   */
  async _safeShutdown(manager, managerName) {
    try {
      if (manager && typeof manager.shutdown === 'function') {
        await manager.shutdown();
      }
    } catch (error) {
      this.eventEmitter.emit('context:manager:warning', {
        operation: 'shutdown',
        component: managerName,
        error: error.message
      });
      // Continue shutdown despite component failure
    }
  }
}

module.exports = ContextManager;
