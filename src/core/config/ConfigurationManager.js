/**
 * @fileoverview Enhanced Configuration System for Aideon.
 * This module provides a dynamic, context-aware configuration management system
 * that adapts to user preferences, system state, and environmental conditions.
 * 
 * @module core/config/ConfigurationManager
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

/**
 * ConfigurationManager class provides a centralized system for managing
 * configuration across the Aideon system with dynamic adaptation capabilities.
 */
class ConfigurationManager {
  /**
   * Creates a new ConfigurationManager instance.
   * @param {Object} options - Configuration options
   * @param {string} options.configDir - Directory for configuration storage
   * @param {boolean} options.enableAutoSave - Whether to automatically save changes
   * @param {number} options.autoSaveInterval - Interval in ms for auto-saving
   * @param {boolean} options.enableWatchers - Whether to enable file watchers
   * @param {Object} options.metricsCollector - Optional MetricsCollector instance
   */
  constructor(options = {}) {
    this.options = {
      configDir: options.configDir || path.join(os.homedir(), '.aideon', 'config'),
      enableAutoSave: options.enableAutoSave !== undefined ? options.enableAutoSave : true,
      autoSaveInterval: options.autoSaveInterval || 60000, // Default: 1 minute
      enableWatchers: options.enableWatchers !== undefined ? options.enableWatchers : true,
      metricsCollector: options.metricsCollector || null
    };
    
    // Ensure config directory exists
    if (!fs.existsSync(this.options.configDir)) {
      fs.mkdirSync(this.options.configDir, { recursive: true });
    }
    
    // Initialize configuration storage
    this.configs = {};
    this.schemas = {};
    this.watchers = {};
    this.contextProviders = {};
    this.overrides = {};
    
    // Set up event emitter for change notifications
    this.events = new EventEmitter();
    
    // Set up auto-save interval if enabled
    if (this.options.enableAutoSave) {
      this.autoSaveIntervalId = setInterval(() => {
        this.saveAll();
      }, this.options.autoSaveInterval);
    }
    
    // Initialize metrics if collector is provided
    if (this.options.metricsCollector) {
      this.initializeMetrics();
    }
    
    // Load system configuration
    this.loadSystemConfig();
  }
  
  /**
   * Initializes metrics for the configuration system.
   * @private
   */
  initializeMetrics() {
    const metrics = this.options.metricsCollector;
    
    // Define configuration metrics
    metrics.defineMetric('config.changes', 'counter', 'Configuration change count');
    metrics.defineMetric('config.overrides', 'counter', 'Configuration override count');
    metrics.defineMetric('config.adaptations', 'counter', 'Configuration adaptation count');
    metrics.defineMetric('config.validation.failures', 'counter', 'Configuration validation failure count');
    metrics.defineMetric('config.load.time', 'histogram', 'Configuration load time in ms');
    metrics.defineMetric('config.save.time', 'histogram', 'Configuration save time in ms');
    
    // Define dimensions
    metrics.defineDimension('config.namespace', 'Configuration namespace');
    metrics.defineDimension('config.key', 'Configuration key');
    metrics.defineDimension('config.context', 'Configuration context');
  }
  
  /**
   * Loads the system configuration.
   * @private
   */
  loadSystemConfig() {
    // Define system configuration schema
    this.defineConfigSchema('system', {
      properties: {
        logLevel: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error'],
          default: 'info',
          description: 'System-wide logging level'
        },
        dataDir: {
          type: 'string',
          default: path.join(os.homedir(), '.aideon', 'data'),
          description: 'Directory for application data storage'
        },
        tempDir: {
          type: 'string',
          default: path.join(os.tmpdir(), 'aideon'),
          description: 'Directory for temporary files'
        },
        maxConcurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 32,
          default: Math.max(1, Math.floor(os.cpus().length / 2)),
          description: 'Maximum number of concurrent operations'
        },
        networkTimeout: {
          type: 'integer',
          minimum: 1000,
          maximum: 300000,
          default: 30000,
          description: 'Network request timeout in milliseconds'
        },
        enableTelemetry: {
          type: 'boolean',
          default: true,
          description: 'Whether to enable anonymous telemetry'
        },
        updateChannel: {
          type: 'string',
          enum: ['stable', 'beta', 'dev'],
          default: 'stable',
          description: 'Update channel for receiving application updates'
        }
      }
    });
    
    // Load system configuration
    this.loadConfig('system');
    
    // Register context providers for system configuration
    this.registerContextProvider('system.networkType', () => {
      // Simple network type detection based on connection information
      // In a real implementation, this would use more sophisticated detection
      return 'unknown';
    });
    
    this.registerContextProvider('system.deviceType', () => {
      // Simple device type detection based on system information
      const totalMem = os.totalmem();
      if (totalMem < 4 * 1024 * 1024 * 1024) {
        return 'low-end';
      } else if (totalMem < 8 * 1024 * 1024 * 1024) {
        return 'mid-range';
      } else {
        return 'high-end';
      }
    });
    
    this.registerContextProvider('system.batteryStatus', () => {
      // In a real implementation, this would check actual battery status
      return 'unknown';
    });
    
    // Define context-based overrides for system configuration
    this.defineContextOverride('system.maxConcurrency', {
      context: 'system.deviceType',
      values: {
        'low-end': 1,
        'mid-range': Math.max(1, Math.floor(os.cpus().length / 2)),
        'high-end': Math.max(2, os.cpus().length - 1)
      }
    });
    
    this.defineContextOverride('system.networkTimeout', {
      context: 'system.networkType',
      values: {
        'wifi': 30000,
        'ethernet': 30000,
        'cellular': 60000,
        'unknown': 45000
      }
    });
  }
  
  /**
   * Defines a configuration schema for a namespace.
   * @param {string} namespace - Configuration namespace
   * @param {Object} schema - JSON Schema object defining the configuration
   * @returns {boolean} - Success status
   */
  defineConfigSchema(namespace, schema) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    if (!schema || typeof schema !== 'object') {
      throw new Error('Configuration schema must be a valid JSON Schema object');
    }
    
    this.schemas[namespace] = {
      namespace,
      schema,
      createdAt: new Date()
    };
    
    return true;
  }
  
  /**
   * Loads configuration for a namespace.
   * @param {string} namespace - Configuration namespace
   * @returns {Object} - Loaded configuration
   */
  loadConfig(namespace) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    const startTime = Date.now();
    
    // Check if schema exists
    if (!this.schemas[namespace]) {
      throw new Error(`Configuration schema not defined for namespace: ${namespace}`);
    }
    
    // Initialize with default values from schema
    const defaults = this.getDefaultsFromSchema(this.schemas[namespace].schema);
    
    // Set initial configuration with defaults
    if (!this.configs[namespace]) {
      this.configs[namespace] = { ...defaults };
    }
    
    // Try to load from file
    const configPath = path.join(this.options.configDir, `${namespace}.json`);
    
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        
        // Merge with defaults
        this.configs[namespace] = {
          ...defaults,
          ...fileConfig
        };
        
        // Validate against schema
        this.validateConfig(namespace);
      } else {
        // Save defaults to file
        this.saveConfig(namespace);
      }
      
      // Set up file watcher if enabled
      if (this.options.enableWatchers && !this.watchers[namespace]) {
        this.watchers[namespace] = fs.watch(configPath, () => {
          this.reloadConfig(namespace);
        });
      }
    } catch (error) {
      console.error(`Error loading configuration for ${namespace}:`, error);
      // Fallback to defaults
      this.configs[namespace] = { ...defaults };
    }
    
    // Apply context overrides
    this.applyContextOverrides(namespace);
    
    // Record metrics if available
    if (this.options.metricsCollector) {
      const loadTime = Date.now() - startTime;
      this.options.metricsCollector.recordMetric('config.load.time', loadTime, {
        'config.namespace': namespace
      });
    }
    
    return this.configs[namespace];
  }
  
  /**
   * Reloads configuration from file for a namespace.
   * @param {string} namespace - Configuration namespace
   * @returns {Object} - Reloaded configuration
   */
  reloadConfig(namespace) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    // Check if schema exists
    if (!this.schemas[namespace]) {
      throw new Error(`Configuration schema not defined for namespace: ${namespace}`);
    }
    
    const configPath = path.join(this.options.configDir, `${namespace}.json`);
    
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        
        // Get defaults from schema
        const defaults = this.getDefaultsFromSchema(this.schemas[namespace].schema);
        
        // Store old config for change detection
        const oldConfig = { ...this.configs[namespace] };
        
        // Merge with defaults
        this.configs[namespace] = {
          ...defaults,
          ...fileConfig
        };
        
        // Validate against schema
        this.validateConfig(namespace);
        
        // Apply context overrides
        this.applyContextOverrides(namespace);
        
        // Detect changes
        const changes = this.detectConfigChanges(oldConfig, this.configs[namespace]);
        
        // Emit change events
        if (Object.keys(changes).length > 0) {
          this.events.emit('configChanged', {
            namespace,
            changes,
            config: this.configs[namespace]
          });
          
          // Record metrics if available
          if (this.options.metricsCollector) {
            this.options.metricsCollector.recordMetric('config.changes', Object.keys(changes).length, {
              'config.namespace': namespace
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error reloading configuration for ${namespace}:`, error);
      // Keep existing configuration
    }
    
    return this.configs[namespace];
  }
  
  /**
   * Saves configuration for a namespace.
   * @param {string} namespace - Configuration namespace
   * @returns {boolean} - Success status
   */
  saveConfig(namespace) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    const startTime = Date.now();
    
    // Check if configuration exists
    if (!this.configs[namespace]) {
      throw new Error(`Configuration not loaded for namespace: ${namespace}`);
    }
    
    const configPath = path.join(this.options.configDir, `${namespace}.json`);
    
    try {
      // Create a copy without applied overrides
      const configToSave = { ...this.configs[namespace] };
      
      // Remove override values
      if (this.overrides[namespace]) {
        for (const key in this.overrides[namespace]) {
          if (this.overrides[namespace][key].applied) {
            // Restore original value if available
            if (this.overrides[namespace][key].originalValue !== undefined) {
              configToSave[key] = this.overrides[namespace][key].originalValue;
            }
          }
        }
      }
      
      // Write to file
      fs.writeFileSync(
        configPath,
        JSON.stringify(configToSave, null, 2),
        'utf8'
      );
      
      // Record metrics if available
      if (this.options.metricsCollector) {
        const saveTime = Date.now() - startTime;
        this.options.metricsCollector.recordMetric('config.save.time', saveTime, {
          'config.namespace': namespace
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving configuration for ${namespace}:`, error);
      return false;
    }
  }
  
  /**
   * Saves all configurations.
   * @returns {boolean} - Success status
   */
  saveAll() {
    let success = true;
    
    for (const namespace in this.configs) {
      const result = this.saveConfig(namespace);
      if (!result) {
        success = false;
      }
    }
    
    return success;
  }
  
  /**
   * Gets configuration value for a key.
   * @param {string} namespace - Configuration namespace
   * @param {string} key - Configuration key
   * @returns {*} - Configuration value
   */
  get(namespace, key) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    // Load configuration if not loaded
    if (!this.configs[namespace]) {
      this.loadConfig(namespace);
    }
    
    // Return entire configuration if no key specified
    if (!key) {
      return { ...this.configs[namespace] };
    }
    
    return this.configs[namespace][key];
  }
  
  /**
   * Sets configuration value for a key.
   * @param {string} namespace - Configuration namespace
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @returns {boolean} - Success status
   */
  set(namespace, key, value) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    if (!key) {
      throw new Error('Configuration key is required');
    }
    
    // Load configuration if not loaded
    if (!this.configs[namespace]) {
      this.loadConfig(namespace);
    }
    
    // Store old value for change detection
    const oldValue = this.configs[namespace][key];
    
    // Update value
    this.configs[namespace][key] = value;
    
    // Validate against schema
    try {
      this.validateConfig(namespace);
    } catch (error) {
      // Restore old value on validation failure
      this.configs[namespace][key] = oldValue;
      throw error;
    }
    
    // Save configuration if auto-save is enabled
    if (this.options.enableAutoSave) {
      this.saveConfig(namespace);
    }
    
    // Emit change event
    if (oldValue !== value) {
      const changes = { [key]: { oldValue, newValue: value } };
      
      this.events.emit('configChanged', {
        namespace,
        changes,
        config: this.configs[namespace]
      });
      
      // Record metrics if available
      if (this.options.metricsCollector) {
        this.options.metricsCollector.recordMetric('config.changes', 1, {
          'config.namespace': namespace,
          'config.key': key
        });
      }
    }
    
    return true;
  }
  
  /**
   * Updates multiple configuration values.
   * @param {string} namespace - Configuration namespace
   * @param {Object} values - Object with key-value pairs to update
   * @returns {boolean} - Success status
   */
  update(namespace, values) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    if (!values || typeof values !== 'object') {
      throw new Error('Values must be an object');
    }
    
    // Load configuration if not loaded
    if (!this.configs[namespace]) {
      this.loadConfig(namespace);
    }
    
    // Store old values for change detection
    const oldValues = { ...this.configs[namespace] };
    
    // Update values
    for (const key in values) {
      this.configs[namespace][key] = values[key];
    }
    
    // Validate against schema
    try {
      this.validateConfig(namespace);
    } catch (error) {
      // Restore old values on validation failure
      this.configs[namespace] = oldValues;
      throw error;
    }
    
    // Save configuration if auto-save is enabled
    if (this.options.enableAutoSave) {
      this.saveConfig(namespace);
    }
    
    // Detect changes
    const changes = this.detectConfigChanges(oldValues, this.configs[namespace]);
    
    // Emit change event if there are changes
    if (Object.keys(changes).length > 0) {
      this.events.emit('configChanged', {
        namespace,
        changes,
        config: this.configs[namespace]
      });
      
      // Record metrics if available
      if (this.options.metricsCollector) {
        this.options.metricsCollector.recordMetric('config.changes', Object.keys(changes).length, {
          'config.namespace': namespace
        });
      }
    }
    
    return true;
  }
  
  /**
   * Resets configuration to default values.
   * @param {string} namespace - Configuration namespace
   * @param {string} key - Optional key to reset (if not provided, resets all)
   * @returns {boolean} - Success status
   */
  reset(namespace, key) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    // Check if schema exists
    if (!this.schemas[namespace]) {
      throw new Error(`Configuration schema not defined for namespace: ${namespace}`);
    }
    
    // Get defaults from schema
    const defaults = this.getDefaultsFromSchema(this.schemas[namespace].schema);
    
    // Store old values for change detection
    const oldValues = { ...this.configs[namespace] };
    
    if (key) {
      // Reset specific key
      if (defaults[key] !== undefined) {
        this.configs[namespace][key] = defaults[key];
      }
    } else {
      // Reset all keys
      this.configs[namespace] = { ...defaults };
    }
    
    // Apply context overrides
    this.applyContextOverrides(namespace);
    
    // Save configuration if auto-save is enabled
    if (this.options.enableAutoSave) {
      this.saveConfig(namespace);
    }
    
    // Detect changes
    const changes = this.detectConfigChanges(oldValues, this.configs[namespace]);
    
    // Emit change event if there are changes
    if (Object.keys(changes).length > 0) {
      this.events.emit('configChanged', {
        namespace,
        changes,
        config: this.configs[namespace]
      });
      
      // Record metrics if available
      if (this.options.metricsCollector) {
        this.options.metricsCollector.recordMetric('config.changes', Object.keys(changes).length, {
          'config.namespace': namespace
        });
      }
    }
    
    return true;
  }
  
  /**
   * Validates configuration against its schema.
   * @param {string} namespace - Configuration namespace
   * @returns {boolean} - Validation result
   */
  validateConfig(namespace) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    // Check if schema exists
    if (!this.schemas[namespace]) {
      throw new Error(`Configuration schema not defined for namespace: ${namespace}`);
    }
    
    // Check if configuration exists
    if (!this.configs[namespace]) {
      throw new Error(`Configuration not loaded for namespace: ${namespace}`);
    }
    
    const schema = this.schemas[namespace].schema;
    const config = this.configs[namespace];
    
    // Simple validation for required properties and types
    if (schema.properties) {
      for (const key in schema.properties) {
        const propSchema = schema.properties[key];
        
        // Check if property exists
        if (config[key] === undefined) {
          if (propSchema.required) {
            // Record metrics if available
            if (this.options.metricsCollector) {
              this.options.metricsCollector.recordMetric('config.validation.failures', 1, {
                'config.namespace': namespace,
                'config.key': key
              });
            }
            throw new Error(`Required configuration property missing: ${key}`);
          }
          continue;
        }
        
        // Check type
        if (propSchema.type) {
          let valid = false;
          
          switch (propSchema.type) {
            case 'string':
              valid = typeof config[key] === 'string';
              break;
            case 'number':
              valid = typeof config[key] === 'number';
              break;
            case 'integer':
              valid = Number.isInteger(config[key]);
              break;
            case 'boolean':
              valid = typeof config[key] === 'boolean';
              break;
            case 'array':
              valid = Array.isArray(config[key]);
              break;
            case 'object':
              valid = typeof config[key] === 'object' && !Array.isArray(config[key]) && config[key] !== null;
              break;
          }
          
          if (!valid) {
            // Record metrics if available
            if (this.options.metricsCollector) {
              this.options.metricsCollector.recordMetric('config.validation.failures', 1, {
                'config.namespace': namespace,
                'config.key': key
              });
            }
            throw new Error(`Invalid type for configuration property ${key}: expected ${propSchema.type}`);
          }
        }
        
        // Check enum values
        if (propSchema.enum && !propSchema.enum.includes(config[key])) {
          // Record metrics if available
          if (this.options.metricsCollector) {
            this.options.metricsCollector.recordMetric('config.validation.failures', 1, {
              'config.namespace': namespace,
              'config.key': key
            });
          }
          throw new Error(`Invalid value for configuration property ${key}: must be one of ${propSchema.enum.join(', ')}`);
        }
        
        // Check minimum/maximum for numbers
        if ((propSchema.type === 'number' || propSchema.type === 'integer') && typeof config[key] === 'number') {
          if (propSchema.minimum !== undefined && config[key] < propSchema.minimum) {
            // Record metrics if available
            if (this.options.metricsCollector) {
              this.options.metricsCollector.recordMetric('config.validation.failures', 1, {
                'config.namespace': namespace,
                'config.key': key
              });
            }
            throw new Error(`Invalid value for configuration property ${key}: must be at least ${propSchema.minimum}`);
          }
          
          if (propSchema.maximum !== undefined && config[key] > propSchema.maximum) {
            // Record metrics if available
            if (this.options.metricsCollector) {
              this.options.metricsCollector.recordMetric('config.validation.failures', 1, {
                'config.namespace': namespace,
                'config.key': key
              });
            }
            throw new Error(`Invalid value for configuration property ${key}: must be at most ${propSchema.maximum}`);
          }
        }
      }
    }
    
    return true;
  }
  
  /**
   * Extracts default values from a schema.
   * @param {Object} schema - JSON Schema object
   * @returns {Object} - Object with default values
   * @private
   */
  getDefaultsFromSchema(schema) {
    const defaults = {};
    
    if (schema.properties) {
      for (const key in schema.properties) {
        const propSchema = schema.properties[key];
        if (propSchema.default !== undefined) {
          defaults[key] = propSchema.default;
        }
      }
    }
    
    return defaults;
  }
  
  /**
   * Detects changes between two configuration objects.
   * @param {Object} oldConfig - Old configuration
   * @param {Object} newConfig - New configuration
   * @returns {Object} - Object with changes
   * @private
   */
  detectConfigChanges(oldConfig, newConfig) {
    const changes = {};
    
    // Find added or modified keys
    for (const key in newConfig) {
      if (oldConfig[key] === undefined) {
        changes[key] = { oldValue: undefined, newValue: newConfig[key] };
      } else if (oldConfig[key] !== newConfig[key]) {
        changes[key] = { oldValue: oldConfig[key], newValue: newConfig[key] };
      }
    }
    
    // Find removed keys
    for (const key in oldConfig) {
      if (newConfig[key] === undefined) {
        changes[key] = { oldValue: oldConfig[key], newValue: undefined };
      }
    }
    
    return changes;
  }
  
  /**
   * Registers a context provider function.
   * @param {string} contextKey - Context key
   * @param {Function} providerFn - Provider function that returns context value
   * @returns {boolean} - Success status
   */
  registerContextProvider(contextKey, providerFn) {
    if (!contextKey) {
      throw new Error('Context key is required');
    }
    
    if (typeof providerFn !== 'function') {
      throw new Error('Provider function is required');
    }
    
    this.contextProviders[contextKey] = providerFn;
    
    return true;
  }
  
  /**
   * Gets context value from a registered provider.
   * @param {string} contextKey - Context key
   * @returns {*} - Context value
   */
  getContextValue(contextKey) {
    if (!contextKey) {
      throw new Error('Context key is required');
    }
    
    if (!this.contextProviders[contextKey]) {
      throw new Error(`Context provider not registered for key: ${contextKey}`);
    }
    
    try {
      return this.contextProviders[contextKey]();
    } catch (error) {
      console.error(`Error getting context value for ${contextKey}:`, error);
      return null;
    }
  }
  
  /**
   * Defines a context-based override for a configuration property.
   * @param {string} configPath - Configuration path in format 'namespace.key'
   * @param {Object} override - Override definition
   * @param {string} override.context - Context key
   * @param {Object} override.values - Map of context values to configuration values
   * @returns {boolean} - Success status
   */
  defineContextOverride(configPath, override) {
    if (!configPath) {
      throw new Error('Configuration path is required');
    }
    
    if (!override || !override.context || !override.values) {
      throw new Error('Override definition is invalid');
    }
    
    // Parse configuration path
    const [namespace, key] = configPath.split('.');
    
    if (!namespace || !key) {
      throw new Error('Configuration path must be in format "namespace.key"');
    }
    
    // Initialize overrides for namespace if not exists
    if (!this.overrides[namespace]) {
      this.overrides[namespace] = {};
    }
    
    // Store override definition
    this.overrides[namespace][key] = {
      context: override.context,
      values: override.values,
      applied: false,
      originalValue: undefined
    };
    
    // Apply override if configuration is loaded
    if (this.configs[namespace]) {
      this.applyContextOverride(namespace, key);
    }
    
    return true;
  }
  
  /**
   * Applies context overrides for a namespace.
   * @param {string} namespace - Configuration namespace
   * @private
   */
  applyContextOverrides(namespace) {
    if (!namespace) {
      throw new Error('Configuration namespace is required');
    }
    
    // Check if overrides exist for namespace
    if (!this.overrides[namespace]) {
      return;
    }
    
    // Apply each override
    for (const key in this.overrides[namespace]) {
      this.applyContextOverride(namespace, key);
    }
  }
  
  /**
   * Applies a specific context override.
   * @param {string} namespace - Configuration namespace
   * @param {string} key - Configuration key
   * @private
   */
  applyContextOverride(namespace, key) {
    if (!namespace || !key) {
      return;
    }
    
    // Check if override exists
    if (!this.overrides[namespace] || !this.overrides[namespace][key]) {
      return;
    }
    
    // Check if configuration exists
    if (!this.configs[namespace]) {
      return;
    }
    
    const override = this.overrides[namespace][key];
    const contextKey = override.context;
    
    try {
      // Get context value
      const contextValue = this.getContextValue(contextKey);
      
      // Check if context value has a mapping
      if (contextValue !== null && override.values[contextValue] !== undefined) {
        // Store original value if not already stored
        if (!override.applied) {
          override.originalValue = this.configs[namespace][key];
        }
        
        // Apply override
        this.configs[namespace][key] = override.values[contextValue];
        override.applied = true;
        
        // Record metrics if available
        if (this.options.metricsCollector) {
          this.options.metricsCollector.recordMetric('config.adaptations', 1, {
            'config.namespace': namespace,
            'config.key': key,
            'config.context': contextKey
          });
        }
      } else if (override.applied) {
        // Restore original value if context no longer applies
        this.configs[namespace][key] = override.originalValue;
        override.applied = false;
      }
    } catch (error) {
      console.error(`Error applying context override for ${namespace}.${key}:`, error);
    }
  }
  
  /**
   * Subscribes to configuration change events.
   * @param {Function} callback - Callback function
   * @param {string} namespace - Optional namespace filter
   * @returns {Function} - Unsubscribe function
   */
  subscribeToChanges(callback, namespace) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const handler = (event) => {
      if (!namespace || event.namespace === namespace) {
        callback(event);
      }
    };
    
    this.events.on('configChanged', handler);
    
    return () => {
      this.events.off('configChanged', handler);
    };
  }
  
  /**
   * Stops the configuration manager and saves any pending changes.
   * @returns {Promise<void>}
   */
  async stop() {
    // Clear auto-save interval
    if (this.autoSaveIntervalId) {
      clearInterval(this.autoSaveIntervalId);
    }
    
    // Close file watchers
    for (const namespace in this.watchers) {
      this.watchers[namespace].close();
    }
    
    // Save all configurations
    this.saveAll();
  }
}

module.exports = ConfigurationManager;
