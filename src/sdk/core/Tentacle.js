/**
 * @fileoverview Base Tentacle class that all tentacles must extend.
 * Provides core functionality and lifecycle management for tentacles.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { deepClone, deepMerge } = require('../utils/object');
const Logger = require('../systems/LoggingSystem').Logger;
const { TentacleState } = require('../enums');
const { TentacleError } = require('../utils/errorHandling');

/**
 * Base class for all Aideon tentacles.
 * Provides lifecycle management, event handling, API registration, and more.
 */
class Tentacle {
  /**
   * Creates a new Tentacle instance.
   * @param {Object} options - Configuration options
   * @param {string} options.id - Unique identifier for the tentacle
   * @param {string} options.name - Human-readable name of the tentacle
   * @param {string} options.version - Semantic version of the tentacle
   * @param {string} options.description - Description of the tentacle's functionality
   * @param {Object} [options.metadata] - Additional metadata for the tentacle
   * @param {Object} [options.dependencies] - Tentacle dependencies
   * @param {Object} [options.config] - Initial configuration
   */
  constructor(options = {}) {
    // Validate required options
    if (!options.id) {
      throw new TentacleError('Tentacle ID is required', 'TENTACLE_INIT_ERROR');
    }
    
    if (!options.name) {
      throw new TentacleError('Tentacle name is required', 'TENTACLE_INIT_ERROR');
    }
    
    if (!options.version) {
      throw new TentacleError('Tentacle version is required', 'TENTACLE_INIT_ERROR');
    }
    
    // Core properties
    this.id = options.id;
    this.name = options.name;
    this.version = options.version;
    this.description = options.description || '';
    this.metadata = options.metadata || {};
    this.dependencies = options.dependencies || {};
    
    // Internal state
    this._state = TentacleState.UNINITIALIZED;
    this._initializationPromise = null;
    this._shutdownPromise = null;
    this._instanceId = uuidv4();
    this._createdAt = Date.now();
    this._lastInitializedAt = null;
    this._lastError = null;
    this._apiEndpoints = new Map();
    this._eventSubscriptions = new Map();
    
    // Core components (will be injected by Aideon core)
    this._aideon = null;
    this._logger = new Logger(`tentacle:${this.id}`);
    this._eventEmitter = new EventEmitter();
    
    // Set up maximum listeners to avoid memory leaks
    this._eventEmitter.setMaxListeners(100);
    
    // Initial configuration
    this._config = options.config || {};
  }
  
  /**
   * Gets the current state of the tentacle.
   * @returns {TentacleState} The current state
   */
  get state() {
    return this._state;
  }
  
  /**
   * Gets the Aideon core instance.
   * @returns {AideonCore|null} The Aideon core instance or null if not set
   */
  get aideon() {
    return this._aideon;
  }
  
  /**
   * Gets the logger instance.
   * @returns {Logger} The logger instance
   */
  get logger() {
    return this._logger;
  }
  
  /**
   * Gets the event emitter instance.
   * @returns {EventEmitter} The event emitter instance
   */
  get eventEmitter() {
    return this._eventEmitter;
  }
  
  /**
   * Sets the Aideon core instance.
   * @param {AideonCore} aideon - The Aideon core instance
   */
  setAideonCore(aideon) {
    this._aideon = aideon;
  }
  
  /**
   * Initializes the tentacle.
   * This method should be overridden by subclasses.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._state === TentacleState.READY) {
      return true;
    }
    
    if (this._initializationPromise) {
      return this._initializationPromise;
    }
    
    this._state = TentacleState.INITIALIZING;
    this._lastError = null;
    
    this._initializationPromise = (async () => {
      try {
        this.logger.info(`Initializing tentacle: ${this.name} (${this.id})`);
        
        // Check dependencies
        await this._checkDependencies();
        
        // Register API endpoints
        this.registerApiEndpoints();
        
        // Subscribe to events
        this.subscribeToEvents();
        
        // Call onInitialize hook (to be implemented by subclasses)
        if (typeof this.onInitialize === 'function') {
          await this.onInitialize();
        }
        
        this._state = TentacleState.READY;
        this._lastInitializedAt = Date.now();
        
        this.logger.info(`Tentacle initialized: ${this.name} (${this.id})`);
        this._eventEmitter.emit('tentacle:initialized', { id: this.id });
        
        return true;
      } catch (error) {
        this._state = TentacleState.ERROR;
        this._lastError = error;
        
        this.logger.error(`Failed to initialize tentacle: ${this.name} (${this.id})`, {
          error: error.message,
          stack: error.stack
        });
        
        this._eventEmitter.emit('tentacle:error', {
          id: this.id,
          error: error.message,
          operation: 'initialize'
        });
        
        throw error;
      } finally {
        this._initializationPromise = null;
      }
    })();
    
    return this._initializationPromise;
  }
  
  /**
   * Shuts down the tentacle.
   * This method should be overridden by subclasses.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (this._state === TentacleState.SHUTDOWN) {
      return true;
    }
    
    if (this._shutdownPromise) {
      return this._shutdownPromise;
    }
    
    this._state = TentacleState.SHUTTING_DOWN;
    
    this._shutdownPromise = (async () => {
      try {
        this.logger.info(`Shutting down tentacle: ${this.name} (${this.id})`);
        
        // Call onShutdown hook (to be implemented by subclasses)
        if (typeof this.onShutdown === 'function') {
          await this.onShutdown();
        }
        
        // Unsubscribe from events
        this._unsubscribeFromAllEvents();
        
        // Unregister API endpoints
        this._unregisterAllApiEndpoints();
        
        this._state = TentacleState.SHUTDOWN;
        
        this.logger.info(`Tentacle shut down: ${this.name} (${this.id})`);
        this._eventEmitter.emit('tentacle:shutdown', { id: this.id });
        
        return true;
      } catch (error) {
        this._state = TentacleState.ERROR;
        this._lastError = error;
        
        this.logger.error(`Failed to shut down tentacle: ${this.name} (${this.id})`, {
          error: error.message,
          stack: error.stack
        });
        
        this._eventEmitter.emit('tentacle:error', {
          id: this.id,
          error: error.message,
          operation: 'shutdown'
        });
        
        throw error;
      } finally {
        this._shutdownPromise = null;
      }
    })();
    
    return this._shutdownPromise;
  }
  
  /**
   * Registers API endpoints for the tentacle.
   * This method should be overridden by subclasses.
   */
  registerApiEndpoints() {
    // To be implemented by subclasses
  }
  
  /**
   * Subscribes to events for the tentacle.
   * This method should be overridden by subclasses.
   */
  subscribeToEvents() {
    // To be implemented by subclasses
  }
  
  /**
   * Gets the current status of the tentacle.
   * @returns {Object} The tentacle status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      state: this._state,
      createdAt: this._createdAt,
      lastInitializedAt: this._lastInitializedAt,
      lastError: this._lastError ? {
        message: this._lastError.message,
        code: this._lastError.code
      } : null,
      apiEndpoints: Array.from(this._apiEndpoints.keys()),
      eventSubscriptions: Array.from(this._eventSubscriptions.keys())
    };
  }
  
  /**
   * Configures the tentacle with new configuration.
   * @param {Object} config - The new configuration
   * @returns {Promise<boolean>} Promise resolving to true if configuration was successful
   */
  async configure(config) {
    try {
      this.logger.info(`Configuring tentacle: ${this.name} (${this.id})`);
      
      // Merge new configuration with existing configuration
      this._config = deepMerge(this._config, config);
      
      // Call onConfigure hook (to be implemented by subclasses)
      if (typeof this.onConfigure === 'function') {
        await this.onConfigure(this._config);
      }
      
      this.logger.info(`Tentacle configured: ${this.name} (${this.id})`);
      this._eventEmitter.emit('tentacle:configured', {
        id: this.id,
        config: deepClone(this._config)
      });
      
      return true;
    } catch (error) {
      this._lastError = error;
      
      this.logger.error(`Failed to configure tentacle: ${this.name} (${this.id})`, {
        error: error.message,
        stack: error.stack
      });
      
      this._eventEmitter.emit('tentacle:error', {
        id: this.id,
        error: error.message,
        operation: 'configure'
      });
      
      throw error;
    }
  }
  
  /**
   * Gets the current configuration of the tentacle.
   * @returns {Object} The current configuration
   */
  getConfig() {
    return deepClone(this._config);
  }
  
  /**
   * Upgrades the tentacle to a new version.
   * @param {string} newVersion - The new version
   * @returns {Promise<boolean>} Promise resolving to true if upgrade was successful
   */
  async upgrade(newVersion) {
    try {
      this.logger.info(`Upgrading tentacle: ${this.name} (${this.id}) to version ${newVersion}`);
      
      // Call onUpgrade hook (to be implemented by subclasses)
      if (typeof this.onUpgrade === 'function') {
        await this.onUpgrade(this.version, newVersion);
      }
      
      // Update version
      const oldVersion = this.version;
      this.version = newVersion;
      
      this.logger.info(`Tentacle upgraded: ${this.name} (${this.id}) from ${oldVersion} to ${newVersion}`);
      this._eventEmitter.emit('tentacle:upgraded', {
        id: this.id,
        oldVersion,
        newVersion
      });
      
      return true;
    } catch (error) {
      this._lastError = error;
      
      this.logger.error(`Failed to upgrade tentacle: ${this.name} (${this.id})`, {
        error: error.message,
        stack: error.stack
      });
      
      this._eventEmitter.emit('tentacle:error', {
        id: this.id,
        error: error.message,
        operation: 'upgrade'
      });
      
      throw error;
    }
  }
  
  /**
   * Creates a backup of the tentacle's state.
   * @returns {Promise<Object>} Promise resolving to the backup data
   */
  async backup() {
    try {
      this.logger.info(`Creating backup for tentacle: ${this.name} (${this.id})`);
      
      // Default backup data
      let backupData = {
        id: this.id,
        name: this.name,
        version: this.version,
        config: deepClone(this._config),
        timestamp: Date.now()
      };
      
      // Call onBackup hook (to be implemented by subclasses)
      if (typeof this.onBackup === 'function') {
        const customBackupData = await this.onBackup();
        if (customBackupData && typeof customBackupData === 'object') {
          backupData = {
            ...backupData,
            data: customBackupData
          };
        }
      }
      
      this.logger.info(`Backup created for tentacle: ${this.name} (${this.id})`);
      
      return backupData;
    } catch (error) {
      this._lastError = error;
      
      this.logger.error(`Failed to create backup for tentacle: ${this.name} (${this.id})`, {
        error: error.message,
        stack: error.stack
      });
      
      this._eventEmitter.emit('tentacle:error', {
        id: this.id,
        error: error.message,
        operation: 'backup'
      });
      
      throw error;
    }
  }
  
  /**
   * Restores the tentacle's state from a backup.
   * @param {Object} backupData - The backup data
   * @returns {Promise<boolean>} Promise resolving to true if restore was successful
   */
  async restore(backupData) {
    try {
      if (!backupData || typeof backupData !== 'object') {
        throw new TentacleError('Invalid backup data', 'TENTACLE_RESTORE_ERROR');
      }
      
      this.logger.info(`Restoring tentacle: ${this.name} (${this.id}) from backup`);
      
      // Restore configuration
      if (backupData.config) {
        this._config = deepClone(backupData.config);
      }
      
      // Call onRestore hook (to be implemented by subclasses)
      if (typeof this.onRestore === 'function') {
        await this.onRestore(backupData);
      }
      
      this.logger.info(`Tentacle restored: ${this.name} (${this.id})`);
      this._eventEmitter.emit('tentacle:restored', { id: this.id });
      
      return true;
    } catch (error) {
      this._lastError = error;
      
      this.logger.error(`Failed to restore tentacle: ${this.name} (${this.id})`, {
        error: error.message,
        stack: error.stack
      });
      
      this._eventEmitter.emit('tentacle:error', {
        id: this.id,
        error: error.message,
        operation: 'restore'
      });
      
      throw error;
    }
  }
  
  /**
   * Diagnoses the tentacle for issues.
   * @returns {Promise<Object>} Promise resolving to the diagnostic result
   */
  async diagnose() {
    try {
      this.logger.info(`Diagnosing tentacle: ${this.name} (${this.id})`);
      
      // Default diagnostic result
      let diagnosticResult = {
        id: this.id,
        name: this.name,
        version: this.version,
        state: this._state,
        timestamp: Date.now(),
        status: this._state === TentacleState.READY ? 'healthy' : 'unhealthy',
        issues: []
      };
      
      // Add last error if any
      if (this._lastError) {
        diagnosticResult.issues.push({
          type: 'error',
          message: this._lastError.message,
          code: this._lastError.code
        });
      }
      
      // Call onDiagnose hook (to be implemented by subclasses)
      if (typeof this.onDiagnose === 'function') {
        const customDiagnosticResult = await this.onDiagnose();
        if (customDiagnosticResult && typeof customDiagnosticResult === 'object') {
          if (Array.isArray(customDiagnosticResult.issues)) {
            diagnosticResult.issues = [
              ...diagnosticResult.issues,
              ...customDiagnosticResult.issues
            ];
          }
          
          if (customDiagnosticResult.status) {
            diagnosticResult.status = customDiagnosticResult.status;
          }
          
          if (customDiagnosticResult.details) {
            diagnosticResult.details = customDiagnosticResult.details;
          }
        }
      }
      
      this.logger.info(`Tentacle diagnosed: ${this.name} (${this.id})`);
      
      return diagnosticResult;
    } catch (error) {
      this._lastError = error;
      
      this.logger.error(`Failed to diagnose tentacle: ${this.name} (${this.id})`, {
        error: error.message,
        stack: error.stack
      });
      
      this._eventEmitter.emit('tentacle:error', {
        id: this.id,
        error: error.message,
        operation: 'diagnose'
      });
      
      throw error;
    }
  }
  
  /**
   * Registers an API endpoint.
   * @param {string} path - The API path
   * @param {string} method - The HTTP method
   * @param {Function} handler - The handler function
   * @param {Object} [options] - Additional options
   * @returns {boolean} True if registration was successful
   */
  registerApiEndpoint(path, method, handler, options = {}) {
    try {
      if (!path || typeof path !== 'string') {
        throw new TentacleError('Invalid API path', 'API_REGISTRATION_ERROR');
      }
      
      if (!method || typeof method !== 'string') {
        throw new TentacleError('Invalid HTTP method', 'API_REGISTRATION_ERROR');
      }
      
      if (typeof handler !== 'function') {
        throw new TentacleError('Invalid handler function', 'API_REGISTRATION_ERROR');
      }
      
      const key = `${method.toUpperCase()}:${path}`;
      
      // Check if endpoint already exists
      if (this._apiEndpoints.has(key)) {
        throw new TentacleError(`API endpoint already registered: ${key}`, 'API_REGISTRATION_ERROR');
      }
      
      // Register with Aideon core if available
      if (this._aideon && this._aideon.api) {
        this._aideon.api.register({
          path,
          method: method.toUpperCase(),
          handler,
          tentacleId: this.id,
          ...options
        });
      }
      
      // Store endpoint
      this._apiEndpoints.set(key, {
        path,
        method: method.toUpperCase(),
        handler,
        options
      });
      
      this.logger.debug(`API endpoint registered: ${key}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register API endpoint: ${method.toUpperCase()}:${path}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Unregisters an API endpoint.
   * @param {string} path - The API path
   * @param {string} method - The HTTP method
   * @returns {boolean} True if unregistration was successful
   */
  unregisterApiEndpoint(path, method) {
    try {
      if (!path || typeof path !== 'string') {
        throw new TentacleError('Invalid API path', 'API_UNREGISTRATION_ERROR');
      }
      
      if (!method || typeof method !== 'string') {
        throw new TentacleError('Invalid HTTP method', 'API_UNREGISTRATION_ERROR');
      }
      
      const key = `${method.toUpperCase()}:${path}`;
      
      // Check if endpoint exists
      if (!this._apiEndpoints.has(key)) {
        this.logger.warn(`API endpoint not found: ${key}`);
        return false;
      }
      
      // Unregister from Aideon core if available
      if (this._aideon && this._aideon.api) {
        this._aideon.api.unregister(path, method.toUpperCase());
      }
      
      // Remove endpoint
      this._apiEndpoints.delete(key);
      
      this.logger.debug(`API endpoint unregistered: ${key}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister API endpoint: ${method.toUpperCase()}:${path}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Subscribes to an event.
   * @param {string} eventName - The event name
   * @param {Function} listener - The event listener
   * @returns {boolean} True if subscription was successful
   */
  subscribeToEvent(eventName, listener) {
    try {
      if (!eventName || typeof eventName !== 'string') {
        throw new TentacleError('Invalid event name', 'EVENT_SUBSCRIPTION_ERROR');
      }
      
      if (typeof listener !== 'function') {
        throw new TentacleError('Invalid event listener', 'EVENT_SUBSCRIPTION_ERROR');
      }
      
      // Store subscription
      if (!this._eventSubscriptions.has(eventName)) {
        this._eventSubscriptions.set(eventName, new Set());
      }
      
      this._eventSubscriptions.get(eventName).add(listener);
      
      // Subscribe with Aideon core if available
      if (this._aideon && this._aideon.events) {
        this._aideon.events.on(eventName, listener);
      }
      
      this.logger.debug(`Subscribed to event: ${eventName}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to subscribe to event: ${eventName}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Unsubscribes from an event.
   * @param {string} eventName - The event name
   * @param {Function} listener - The event listener
   * @returns {boolean} True if unsubscription was successful
   */
  unsubscribeFromEvent(eventName, listener) {
    try {
      if (!eventName || typeof eventName !== 'string') {
        throw new TentacleError('Invalid event name', 'EVENT_UNSUBSCRIPTION_ERROR');
      }
      
      if (typeof listener !== 'function') {
        throw new TentacleError('Invalid event listener', 'EVENT_UNSUBSCRIPTION_ERROR');
      }
      
      // Check if subscription exists
      if (!this._eventSubscriptions.has(eventName)) {
        this.logger.warn(`Event subscription not found: ${eventName}`);
        return false;
      }
      
      const listeners = this._eventSubscriptions.get(eventName);
      
      if (!listeners.has(listener)) {
        this.logger.warn(`Event listener not found: ${eventName}`);
        return false;
      }
      
      // Remove subscription
      listeners.delete(listener);
      
      if (listeners.size === 0) {
        this._eventSubscriptions.delete(eventName);
      }
      
      // Unsubscribe from Aideon core if available
      if (this._aideon && this._aideon.events) {
        this._aideon.events.off(eventName, listener);
      }
      
      this.logger.debug(`Unsubscribed from event: ${eventName}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from event: ${eventName}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Publishes an event.
   * @param {string} eventName - The event name
   * @param {*} data - The event data
   * @returns {boolean} True if publication was successful
   */
  publishEvent(eventName, data) {
    try {
      if (!eventName || typeof eventName !== 'string') {
        throw new TentacleError('Invalid event name', 'EVENT_PUBLICATION_ERROR');
      }
      
      // Publish with Aideon core if available
      if (this._aideon && this._aideon.events) {
        this._aideon.events.emit(eventName, data);
      } else {
        // Fallback to local event emitter
        this._eventEmitter.emit(eventName, data);
      }
      
      this.logger.debug(`Published event: ${eventName}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish event: ${eventName}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * Checks if the tentacle's dependencies are satisfied.
   * @returns {Promise<boolean>} Promise resolving to true if dependencies are satisfied
   * @private
   */
  async _checkDependencies() {
    if (!this.dependencies || Object.keys(this.dependencies).length === 0) {
      return true;
    }
    
    if (!this._aideon || !this._aideon.tentacles) {
      throw new TentacleError('Cannot check dependencies: Aideon core not available', 'DEPENDENCY_CHECK_ERROR');
    }
    
    const unsatisfiedDependencies = [];
    
    for (const [tentacleId, versionRequirement] of Object.entries(this.dependencies)) {
      const tentacle = this._aideon.tentacles.get(tentacleId);
      
      if (!tentacle) {
        unsatisfiedDependencies.push({
          id: tentacleId,
          required: versionRequirement,
          found: null
        });
        continue;
      }
      
      // TODO: Implement version compatibility check
      // For now, just check if the tentacle exists
    }
    
    if (unsatisfiedDependencies.length > 0) {
      throw new TentacleError(
        `Unsatisfied dependencies: ${unsatisfiedDependencies.map(d => `${d.id}@${d.required}`).join(', ')}`,
        'DEPENDENCY_CHECK_ERROR'
      );
    }
    
    return true;
  }
  
  /**
   * Unregisters all API endpoints.
   * @private
   */
  _unregisterAllApiEndpoints() {
    for (const [key, endpoint] of this._apiEndpoints.entries()) {
      try {
        this.unregisterApiEndpoint(endpoint.path, endpoint.method);
      } catch (error) {
        this.logger.warn(`Failed to unregister API endpoint: ${key}`, {
          error: error.message
        });
      }
    }
    
    this._apiEndpoints.clear();
  }
  
  /**
   * Unsubscribes from all events.
   * @private
   */
  _unsubscribeFromAllEvents() {
    for (const [eventName, listeners] of this._eventSubscriptions.entries()) {
      for (const listener of listeners) {
        try {
          this.unsubscribeFromEvent(eventName, listener);
        } catch (error) {
          this.logger.warn(`Failed to unsubscribe from event: ${eventName}`, {
            error: error.message
          });
        }
      }
    }
    
    this._eventSubscriptions.clear();
  }
}

module.exports = Tentacle;
