/**
 * @fileoverview Configuration System for managing application configuration.
 * Provides hierarchical configuration management with validation and versioning.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const { deepClone, deepMerge } = require('../utils/object');
const { validateSchema } = require('../utils/validation');
const { ConfigError } = require('../utils/errorHandling');
const Logger = require('./LoggingSystem').Logger;

/**
 * Manages application configuration.
 */
class ConfigSystem {
  /**
   * Creates a new ConfigSystem instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this._config = {};
    this._schemas = new Map();
    this._history = [];
    this._maxHistorySize = options.maxHistorySize || 100;
    this._initialized = false;
    this._logger = new Logger('aideon:config');
    this._options = {
      enableValidation: options.enableValidation !== false,
      enableVersioning: options.enableVersioning !== false,
      ...options
    };
  }
  
  /**
   * Initializes the configuration system.
   * @returns {Promise<boolean>} Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Initializing configuration system');
      
      // Set up default configuration
      this._config = {
        system: {
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          logLevel: process.env.LOG_LEVEL || 'info'
        },
        tentacles: {},
        security: {
          enableAuthentication: true,
          enableEncryption: true,
          tokenExpiration: 3600 // 1 hour
        },
        api: {
          port: process.env.PORT || 3000,
          basePath: '/api',
          enableRateLimiting: true,
          enableCors: true
        },
        ui: {
          theme: 'light',
          language: 'en',
          enableAnimations: true
        }
      };
      
      // Add initial configuration to history
      if (this._options.enableVersioning) {
        this._addToHistory('system', 'initialize', this._config);
      }
      
      this._initialized = true;
      this._logger.info('Configuration system initialized');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to initialize configuration system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new ConfigError('Failed to initialize configuration system', 'CONFIG_INIT_ERROR', error);
    }
  }
  
  /**
   * Shuts down the configuration system.
   * @returns {Promise<boolean>} Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this._initialized) {
      return true;
    }
    
    try {
      this._logger.info('Shutting down configuration system');
      
      this._initialized = false;
      this._logger.info('Configuration system shut down');
      
      return true;
    } catch (error) {
      this._logger.error('Failed to shut down configuration system', {
        error: error.message,
        stack: error.stack
      });
      
      throw new ConfigError('Failed to shut down configuration system', 'CONFIG_SHUTDOWN_ERROR', error);
    }
  }
  
  /**
   * Gets a configuration value.
   * @param {string} path - The configuration path (dot notation)
   * @param {*} [defaultValue] - The default value if path not found
   * @returns {*} The configuration value
   */
  get(path, defaultValue) {
    if (!this._initialized) {
      throw new ConfigError('Configuration system not initialized', 'CONFIG_NOT_INITIALIZED');
    }
    
    if (!path || typeof path !== 'string') {
      throw new ConfigError('Invalid configuration path', 'CONFIG_PATH_ERROR');
    }
    
    try {
      // Split path into parts
      const parts = path.split('.');
      
      // Traverse configuration
      let current = this._config;
      
      for (const part of parts) {
        if (current === undefined || current === null) {
          return defaultValue;
        }
        
        current = current[part];
      }
      
      return current !== undefined ? deepClone(current) : defaultValue;
    } catch (error) {
      this._logger.error(`Failed to get configuration: ${path}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new ConfigError(`Failed to get configuration: ${path}`, 'CONFIG_GET_ERROR', error);
    }
  }
  
  /**
   * Sets a configuration value.
   * @param {string} path - The configuration path (dot notation)
   * @param {*} value - The configuration value
   * @param {Object} [options] - Set options
   * @param {string} [options.source] - The source of the change
   * @param {boolean} [options.validate=true] - Whether to validate the value
   * @returns {boolean} True if set was successful
   */
  set(path, value, options = {}) {
    if (!this._initialized) {
      throw new ConfigError('Configuration system not initialized', 'CONFIG_NOT_INITIALIZED');
    }
    
    if (!path || typeof path !== 'string') {
      throw new ConfigError('Invalid configuration path', 'CONFIG_PATH_ERROR');
    }
    
    try {
      // Split path into parts
      const parts = path.split('.');
      
      // Get parent path for validation
      const parentPath = parts.slice(0, -1).join('.');
      const key = parts[parts.length - 1];
      
      // Validate if enabled
      if (this._options.enableValidation && options.validate !== false) {
        this._validateValue(parentPath, key, value);
      }
      
      // Create a new configuration object
      const newConfig = deepClone(this._config);
      
      // Traverse and update configuration
      let current = newConfig;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        
        if (current[part] === undefined) {
          current[part] = {};
        }
        
        current = current[part];
      }
      
      // Set the value
      current[parts[parts.length - 1]] = deepClone(value);
      
      // Update configuration
      this._config = newConfig;
      
      // Add to history
      if (this._options.enableVersioning) {
        this._addToHistory(options.source || 'api', 'set', { path, value });
      }
      
      this._logger.debug(`Configuration set: ${path}`, {
        source: options.source
      });
      
      return true;
    } catch (error) {
      this._logger.error(`Failed to set configuration: ${path}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw new ConfigError(`Failed to set configuration: ${path}`, 'CONFIG_SET_ERROR', error);
    }
  }
  
  /**
   * Updates configuration with a partial configuration object.
   * @param {Object} config - The partial configuration object
   * @param {Object} [options] - Update options
   * @param {string} [options.source] - The source of the change
   * @param {boolean} [options.validate=true] - Whether to validate the configuration
   * @returns {boolean} True if update was successful
   */
  update(config, options = {}) {
    if (!this._initialized) {
      throw new ConfigError('Configuration system not initialized', 'CONFIG_NOT_INITIALIZED');
    }
    
    if (!config || typeof config !== 'object') {
      throw new ConfigError('Invalid configuration object', 'CONFIG_UPDATE_ERROR');
    }
    
    try {
      // Validate if enabled
      if (this._options.enableValidation && options.validate !== false) {
        this._validateConfig(config);
      }
      
      // Merge configurations
      const newConfig = deepMerge(this._config, config);
      
      // Update configuration
      this._config = newConfig;
      
      // Add to history
      if (this._options.enableVersioning) {
        this._addToHistory(options.source || 'api', 'update', config);
      }
      
      this._logger.debug('Configuration updated', {
        source: options.source
      });
      
      return true;
    } catch (error) {
      this._logger.error('Failed to update configuration', {
        error: error.message,
        stack: error.stack
      });
      
      throw new ConfigError('Failed to update configuration', 'CONFIG_UPDATE_ERROR', error);
    }
  }
  
  /**
   * Resets configuration to default values.
   * @param {Object} [options] - Reset options
   * @param {string} [options.source] - The source of the change
   * @returns {boolean} True if reset was successful
   */
  reset(options = {}) {
    if (!this._initialized) {
      throw new ConfigError('Configuration system not initialized', 'CONFIG_NOT_INITIALIZED');
    }
    
    try {
      // Re-initialize configuration
      this._config = {
        system: {
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          logLevel: process.env.LOG_LEVEL || 'info'
        },
        tentacles: {},
        security: {
          enableAuthentication: true,
          enableEncryption: true,
          tokenExpiration: 3600 // 1 hour
        },
        api: {
          port: process.env.PORT || 3000,
          basePath: '/api',
          enableRateLimiting: true,
          enableCors: true
        },
        ui: {
          theme: 'light',
          language: 'en',
          enableAnimations: true
        }
      };
      
      // Add to history
      if (this._options.enableVersioning) {
        this._addToHistory(options.source || 'api', 'reset', null);
      }
      
      this._logger.info('Configuration reset to defaults', {
        source: options.source
      });
      
      return true;
    } catch (error) {
      this._logger.error('Failed to reset configuration', {
        error: error.message,
        stack: error.stack
      });
      
      throw new ConfigError('Failed to reset configuration', 'CONFIG_RESET_ERROR', error);
    }
  }
  
  /**
   * Registers a configuration schema.
   * @param {string} path - The configuration path (dot notation)
   * @param {Object} schema - The JSON Schema object
   * @returns {boolean} True if registration was successful
   */
  registerSchema(path, schema) {
    if (!path || typeof path !== 'string') {
      throw new ConfigError('Invalid configuration path', 'CONFIG_SCHEMA_ERROR');
    }
    
    if (!schema || typeof schema !== 'object') {
      throw new ConfigError('Invalid schema object', 'CONFIG_SCHEMA_ERROR');
    }
    
    this._schemas.set(path, schema);
    
    this._logger.debug(`Schema registered: ${path}`);
    
    return true;
  }
  
  /**
   * Unregisters a configuration schema.
   * @param {string} path - The configuration path (dot notation)
   * @returns {boolean} True if unregistration was successful
   */
  unregisterSchema(path) {
    if (!path || typeof path !== 'string') {
      throw new ConfigError('Invalid configuration path', 'CONFIG_SCHEMA_ERROR');
    }
    
    const result = this._schemas.delete(path);
    
    if (result) {
      this._logger.debug(`Schema unregistered: ${path}`);
    }
    
    return result;
  }
  
  /**
   * Gets all registered schemas.
   * @returns {Object} The registered schemas
   */
  getSchemas() {
    const schemas = {};
    
    for (const [path, schema] of this._schemas.entries()) {
      schemas[path] = schema;
    }
    
    return schemas;
  }
  
  /**
   * Gets configuration history.
   * @param {Object} [query] - Query parameters
   * @param {string} [query.source] - Filter by source
   * @param {string} [query.action] - Filter by action
   * @param {number} [query.limit] - Limit the number of entries
   * @param {number} [query.offset] - Offset for pagination
   * @returns {Array<Object>} The configuration history
   */
  getHistory(query = {}) {
    if (!this._options.enableVersioning) {
      throw new ConfigError('Configuration versioning is disabled', 'CONFIG_VERSIONING_DISABLED');
    }
    
    let history = [...this._history];
    
    // Apply filters
    if (query.source) {
      history = history.filter(entry => entry.source === query.source);
    }
    
    if (query.action) {
      history = history.filter(entry => entry.action === query.action);
    }
    
    // Sort by timestamp (newest first)
    history.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    if (query.offset) {
      history = history.slice(query.offset);
    }
    
    if (query.limit) {
      history = history.slice(0, query.limit);
    }
    
    return history;
  }
  
  /**
   * Gets the entire configuration.
   * @returns {Object} The configuration
   */
  getAll() {
    if (!this._initialized) {
      throw new ConfigError('Configuration system not initialized', 'CONFIG_NOT_INITIALIZED');
    }
    
    return deepClone(this._config);
  }
  
  /**
   * Gets the system configuration.
   * @returns {Object} The system configuration
   */
  getSystemConfig() {
    return this.get('system', {});
  }
  
  /**
   * Gets the tentacle configuration.
   * @param {string} tentacleId - The tentacle ID
   * @returns {Object} The tentacle configuration
   */
  getTentacleConfig(tentacleId) {
    if (!tentacleId) {
      throw new ConfigError('Tentacle ID is required', 'CONFIG_TENTACLE_ERROR');
    }
    
    return this.get(`tentacles.${tentacleId}`, {});
  }
  
  /**
   * Sets the tentacle configuration.
   * @param {string} tentacleId - The tentacle ID
   * @param {Object} config - The tentacle configuration
   * @param {Object} [options] - Set options
   * @returns {boolean} True if set was successful
   */
  setTentacleConfig(tentacleId, config, options = {}) {
    if (!tentacleId) {
      throw new ConfigError('Tentacle ID is required', 'CONFIG_TENTACLE_ERROR');
    }
    
    return this.set(`tentacles.${tentacleId}`, config, {
      ...options,
      source: options.source || tentacleId
    });
  }
  
  /**
   * Checks if the configuration system is healthy.
   * @returns {boolean} True if the configuration system is healthy
   */
  isHealthy() {
    return this._initialized;
  }
  
  /**
   * Validates a configuration value against a schema.
   * @param {string} parentPath - The parent path
   * @param {string} key - The configuration key
   * @param {*} value - The configuration value
   * @throws {ConfigError} If validation fails
   * @private
   */
  _validateValue(parentPath, key, value) {
    // Find the most specific schema
    let schemaPath = parentPath;
    let schema = this._schemas.get(schemaPath);
    
    while (!schema && schemaPath) {
      // Try parent path
      const parts = schemaPath.split('.');
      parts.pop();
      schemaPath = parts.join('.');
      schema = this._schemas.get(schemaPath);
    }
    
    if (!schema) {
      // No schema found, skip validation
      return;
    }
    
    // Validate against schema
    const validation = validateSchema({ [key]: value }, {
      type: 'object',
      properties: {
        [key]: schema.properties && schema.properties[key]
      }
    });
    
    if (!validation.valid) {
      throw new ConfigError(
        `Invalid configuration value for ${parentPath}.${key}`,
        'CONFIG_VALIDATION_ERROR',
        validation.errors
      );
    }
  }
  
  /**
   * Validates a configuration object against schemas.
   * @param {Object} config - The configuration object
   * @throws {ConfigError} If validation fails
   * @private
   */
  _validateConfig(config) {
    // Validate each path in the configuration
    const validatePath = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recurse into nested objects
          validatePath(value, currentPath);
        } else {
          // Validate leaf value
          const parentPath = path;
          this._validateValue(parentPath, key, value);
        }
      }
    };
    
    validatePath(config);
  }
  
  /**
   * Adds an entry to the configuration history.
   * @param {string} source - The source of the change
   * @param {string} action - The action performed
   * @param {*} data - The change data
   * @private
   */
  _addToHistory(source, action, data) {
    // Add to history
    this._history.push({
      id: uuidv4(),
      source,
      action,
      data: deepClone(data),
      timestamp: Date.now()
    });
    
    // Trim history if needed
    if (this._history.length > this._maxHistorySize) {
      this._history = this._history.slice(-this._maxHistorySize);
    }
  }
}

module.exports = ConfigSystem;
