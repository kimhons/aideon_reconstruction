/**
 * @fileoverview Enhanced Configuration Manager for Aideon
 * 
 * The EnhancedConfigurationManager provides a comprehensive configuration management
 * solution for Aideon, supporting hierarchical configuration, dynamic updates,
 * validation, and environment-specific settings.
 * 
 * This system is designed to improve Aideon's GAIA Score by enhancing reliability,
 * adaptability, and performance optimization.
 */

'use strict';

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

/**
 * Enhanced Configuration Manager class
 * 
 * Provides hierarchical configuration access with dot notation,
 * configuration loading and persistence, validation, and change notification.
 */
class EnhancedConfigurationManager {
  /**
   * Creates a new EnhancedConfigurationManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.configDir - Directory for configuration files
   * @param {boolean} options.autoSave - Whether to automatically save changes
   * @param {number} options.autoSaveInterval - Interval for auto-saving in ms
   */
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(process.cwd(), 'config');
    this.autoSave = options.autoSave !== undefined ? options.autoSave : true;
    this.autoSaveInterval = options.autoSaveInterval || 5000;
    
    this.config = {};
    this.schemas = new Map();
    this.eventEmitter = new EventEmitter();
    this.changeListeners = new Map();
    this.transactionHistory = [];
    this.currentEnvironment = process.env.NODE_ENV || 'development';
    this.environmentOverrides = new Map();
    this.featureFlags = new Map();
    
    // Auto-save timer if enabled
    if (this.autoSave) {
      this.autoSaveTimer = setInterval(() => {
        this.saveToFile().catch(err => {
          console.error('Auto-save failed:', err);
        });
      }, this.autoSaveInterval);
    }
  }

  /**
   * Gets a configuration value by path
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {*} defaultValue - Default value if path doesn't exist
   * @returns {*} Configuration value or default value
   */
  get(path, defaultValue = undefined) {
    if (!path) {
      return this.config;
    }
    
    // Check environment overrides first
    const envOverrides = this.environmentOverrides.get(this.currentEnvironment);
    if (envOverrides && envOverrides[path] !== undefined) {
      return envOverrides[path];
    }
    
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : defaultValue;
  }

  /**
   * Sets a configuration value by path
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {*} value - Value to set
   * @param {Object} options - Set options
   * @param {string} options.transaction - Transaction ID if part of a transaction
   * @param {boolean} options.validate - Whether to validate against schema
   * @param {boolean} options.silent - Whether to suppress change events
   * @returns {boolean} Success status
   */
  set(path, value, options = {}) {
    if (!path) {
      throw new Error('Path is required');
    }
    
    const { transaction, validate = true, silent = false } = options;
    
    // Validate against schema if required
    if (validate) {
      const isValid = this.validateAgainstSchema(path, value);
      if (!isValid) {
        return false;
      }
    }
    
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this.config;
    
    // Create path if it doesn't exist
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    const oldValue = current[lastPart];
    current[lastPart] = value;
    
    // Emit change event if not silent
    if (!silent) {
      this.emitChange(path, value, oldValue, transaction);
    }
    
    return true;
  }

  /**
   * Checks if a configuration path exists
   * 
   * @param {string} path - Configuration path using dot notation
   * @returns {boolean} Whether the path exists
   */
  has(path) {
    if (!path) {
      return false;
    }
    
    // Check environment overrides first
    const envOverrides = this.environmentOverrides.get(this.currentEnvironment);
    if (envOverrides && envOverrides[path] !== undefined) {
      return true;
    }
    
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return false;
      }
      current = current[part];
    }
    
    return current !== undefined;
  }

  /**
   * Deletes a configuration value by path
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {Object} options - Delete options
   * @param {string} options.transaction - Transaction ID if part of a transaction
   * @param {boolean} options.silent - Whether to suppress change events
   * @returns {boolean} Success status
   */
  delete(path, options = {}) {
    if (!path) {
      throw new Error('Path is required');
    }
    
    const { transaction, silent = false } = options;
    
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null || typeof current[part] !== 'object') {
        return false;
      }
      current = current[part];
    }
    
    if (current === undefined || current === null || !(lastPart in current)) {
      return false;
    }
    
    const oldValue = current[lastPart];
    delete current[lastPart];
    
    // Emit change event if not silent
    if (!silent) {
      this.emitChange(path, undefined, oldValue, transaction);
    }
    
    return true;
  }

  /**
   * Registers a schema for configuration validation
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {Object} schema - JSON Schema for validation
   * @returns {boolean} Success status
   */
  registerSchema(path, schema) {
    if (!path || !schema) {
      throw new Error('Path and schema are required');
    }
    
    this.schemas.set(path, schema);
    return true;
  }

  /**
   * Validates a value against a registered schema
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {*} value - Value to validate
   * @returns {boolean} Validation result
   */
  validateAgainstSchema(path, value) {
    if (!path) {
      return true;
    }
    
    // Find the most specific schema that applies to this path
    let schemaPath = path;
    let schema = null;
    
    while (schemaPath && !schema) {
      schema = this.schemas.get(schemaPath);
      if (!schema) {
        const lastDotIndex = schemaPath.lastIndexOf('.');
        if (lastDotIndex === -1) {
          schemaPath = '';
        } else {
          schemaPath = schemaPath.substring(0, lastDotIndex);
        }
      }
    }
    
    if (!schema) {
      return true; // No schema found, validation passes
    }
    
    // Basic type validation
    if (schema.type) {
      if (schema.type === 'string' && typeof value !== 'string') {
        return false;
      } else if (schema.type === 'number' && typeof value !== 'number') {
        return false;
      } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
        return false;
      } else if (schema.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        return false;
      } else if (schema.type === 'array' && !Array.isArray(value)) {
        return false;
      }
    }
    
    // Number range validation
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        return false;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return false;
      }
    }
    
    // String validation
    if (schema.type === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return false;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return false;
      }
      if (schema.pattern !== undefined) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          return false;
        }
      }
    }
    
    // Array validation
    if (schema.type === 'array') {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        return false;
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        return false;
      }
      if (schema.items && schema.items.type) {
        for (const item of value) {
          if (schema.items.type === 'string' && typeof item !== 'string') {
            return false;
          } else if (schema.items.type === 'number' && typeof item !== 'number') {
            return false;
          } else if (schema.items.type === 'boolean' && typeof item !== 'boolean') {
            return false;
          } else if (schema.items.type === 'object' && (typeof item !== 'object' || item === null || Array.isArray(item))) {
            return false;
          } else if (schema.items.type === 'array' && !Array.isArray(item)) {
            return false;
          }
        }
      }
    }
    
    // Enum validation
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
      return false;
    }
    
    return true;
  }

  /**
   * Gets the schema version for a path
   * 
   * @param {string} path - Configuration path using dot notation
   * @returns {string|null} Schema version or null if not found
   */
  getSchemaVersion(path) {
    if (!path) {
      return null;
    }
    
    // Find the most specific schema that applies to this path
    let schemaPath = path;
    let schema = null;
    
    while (schemaPath && !schema) {
      schema = this.schemas.get(schemaPath);
      if (!schema) {
        const lastDotIndex = schemaPath.lastIndexOf('.');
        if (lastDotIndex === -1) {
          schemaPath = '';
        } else {
          schemaPath = schemaPath.substring(0, lastDotIndex);
        }
      }
    }
    
    return schema && schema.version ? schema.version : null;
  }

  /**
   * Begins a new configuration transaction
   * 
   * @returns {Object} Transaction object
   */
  beginTransaction() {
    const transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      changes: new Map(),
      originalValues: new Map(),
      timestamp: Date.now()
    };
    
    return transaction;
  }

  /**
   * Commits a configuration transaction
   * 
   * @param {Object} transaction - Transaction object
   * @returns {boolean} Success status
   */
  commitTransaction(transaction) {
    if (!transaction || !transaction.id || !transaction.changes) {
      throw new Error('Invalid transaction');
    }
    
    // Validate all changes
    for (const [path, value] of transaction.changes.entries()) {
      if (value !== undefined && !this.validateAgainstSchema(path, value)) {
        return false;
      }
    }
    
    // Apply all changes
    for (const [path, value] of transaction.changes.entries()) {
      if (value === undefined) {
        this.delete(path, { transaction: transaction.id, silent: true });
      } else {
        this.set(path, value, { transaction: transaction.id, validate: false, silent: true });
      }
    }
    
    // Record transaction in history
    this.transactionHistory.push({
      id: transaction.id,
      timestamp: transaction.timestamp,
      changes: Array.from(transaction.changes.entries())
    });
    
    // Emit a single transaction event
    this.eventEmitter.emit('transaction', {
      id: transaction.id,
      timestamp: transaction.timestamp,
      changes: Array.from(transaction.changes.entries())
    });
    
    return true;
  }

  /**
   * Rolls back a configuration transaction
   * 
   * @param {Object} transaction - Transaction object
   * @returns {boolean} Success status
   */
  rollbackTransaction(transaction) {
    if (!transaction || !transaction.id || !transaction.originalValues) {
      throw new Error('Invalid transaction');
    }
    
    // Restore original values
    for (const [path, value] of transaction.originalValues.entries()) {
      if (value === undefined) {
        this.delete(path, { transaction: `${transaction.id}-rollback`, silent: true });
      } else {
        this.set(path, value, { transaction: `${transaction.id}-rollback`, validate: false, silent: true });
      }
    }
    
    // Emit a rollback event
    this.eventEmitter.emit('rollback', {
      id: transaction.id,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets the current environment
   * 
   * @returns {string} Current environment
   */
  getCurrentEnvironment() {
    return this.currentEnvironment;
  }

  /**
   * Sets the current environment
   * 
   * @param {string} environment - Environment name
   * @returns {boolean} Success status
   */
  setEnvironment(environment) {
    if (!environment) {
      throw new Error('Environment is required');
    }
    
    const oldEnvironment = this.currentEnvironment;
    this.currentEnvironment = environment;
    
    // Emit environment change event
    this.eventEmitter.emit('environmentChange', {
      oldEnvironment,
      newEnvironment: environment,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets environment-specific overrides
   * 
   * @param {string} environment - Environment name
   * @returns {Object} Environment overrides
   */
  getEnvironmentOverrides(environment) {
    if (!environment) {
      return {};
    }
    
    return this.environmentOverrides.get(environment) || {};
  }

  /**
   * Sets environment-specific overrides
   * 
   * @param {string} environment - Environment name
   * @param {Object} overrides - Environment overrides
   * @returns {boolean} Success status
   */
  setEnvironmentOverrides(environment, overrides) {
    if (!environment || !overrides) {
      throw new Error('Environment and overrides are required');
    }
    
    this.environmentOverrides.set(environment, overrides);
    
    // Emit environment overrides change event
    this.eventEmitter.emit('environmentOverridesChange', {
      environment,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Checks if a feature is enabled
   * 
   * @param {string} featureKey - Feature key
   * @param {Object} context - Context for feature flag evaluation
   * @returns {boolean} Whether the feature is enabled
   */
  isFeatureEnabled(featureKey, context = {}) {
    if (!featureKey) {
      return false;
    }
    
    const feature = this.featureFlags.get(featureKey);
    if (!feature) {
      return false;
    }
    
    // If feature is not enabled, return false
    if (!feature.enabled) {
      return false;
    }
    
    // If rollout percentage is 100, return true
    if (feature.rolloutPercentage === 100) {
      return true;
    }
    
    // If rollout percentage is 0, return false
    if (feature.rolloutPercentage === 0) {
      return false;
    }
    
    // Check target segments
    if (feature.targetSegments && feature.targetSegments.length > 0) {
      if (context.segments) {
        const segments = Array.isArray(context.segments) ? context.segments : [context.segments];
        for (const segment of segments) {
          if (feature.targetSegments.includes(segment)) {
            return true;
          }
        }
      }
    }
    
    // Check rollout percentage
    if (feature.rolloutPercentage) {
      const userId = context.userId || 'anonymous';
      const hash = this.hashString(userId + featureKey);
      const percentage = hash % 100;
      return percentage < feature.rolloutPercentage;
    }
    
    return false;
  }

  /**
   * Sets a feature flag
   * 
   * @param {string} featureKey - Feature key
   * @param {Object} options - Feature flag options
   * @param {boolean} options.enabled - Whether the feature is enabled
   * @param {number} options.rolloutPercentage - Rollout percentage (0-100)
   * @param {string[]} options.targetSegments - Target segments
   * @returns {boolean} Success status
   */
  setFeatureFlag(featureKey, options) {
    if (!featureKey || !options) {
      throw new Error('Feature key and options are required');
    }
    
    const feature = {
      enabled: options.enabled !== undefined ? options.enabled : false,
      rolloutPercentage: options.rolloutPercentage !== undefined ? options.rolloutPercentage : 0,
      targetSegments: options.targetSegments || []
    };
    
    this.featureFlags.set(featureKey, feature);
    
    // Emit feature flag change event
    this.eventEmitter.emit('featureFlagChange', {
      featureKey,
      feature,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets the rollout percentage for a feature
   * 
   * @param {string} featureKey - Feature key
   * @returns {number} Rollout percentage
   */
  getFeatureRolloutPercentage(featureKey) {
    if (!featureKey) {
      return 0;
    }
    
    const feature = this.featureFlags.get(featureKey);
    if (!feature) {
      return 0;
    }
    
    return feature.rolloutPercentage || 0;
  }

  /**
   * Registers a configuration change listener
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {Function} callback - Callback function
   * @returns {boolean} Success status
   */
  onConfigChange(path, callback) {
    if (!path || typeof callback !== 'function') {
      throw new Error('Path and callback are required');
    }
    
    if (!this.changeListeners.has(path)) {
      this.changeListeners.set(path, new Set());
    }
    
    this.changeListeners.get(path).add(callback);
    return true;
  }

  /**
   * Unregisters a configuration change listener
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {Function} callback - Callback function
   * @returns {boolean} Success status
   */
  offConfigChange(path, callback) {
    if (!path || typeof callback !== 'function') {
      return false;
    }
    
    if (!this.changeListeners.has(path)) {
      return false;
    }
    
    return this.changeListeners.get(path).delete(callback);
  }

  /**
   * Emits a configuration change event
   * 
   * @param {string} path - Configuration path using dot notation
   * @param {*} newValue - New value
   * @param {*} oldValue - Old value
   * @param {string} transaction - Transaction ID if part of a transaction
   * @private
   */
  emitChange(path, newValue, oldValue, transaction) {
    const event = {
      path,
      newValue,
      oldValue,
      transaction,
      timestamp: Date.now()
    };
    
    // Emit global change event
    this.eventEmitter.emit('change', event);
    
    // Notify path-specific listeners
    if (this.changeListeners.has(path)) {
      for (const callback of this.changeListeners.get(path)) {
        try {
          callback(event);
        } catch (err) {
          console.error(`Error in change listener for ${path}:`, err);
        }
      }
    }
    
    // Notify parent path listeners
    let parentPath = path;
    while (parentPath.includes('.')) {
      parentPath = parentPath.substring(0, parentPath.lastIndexOf('.'));
      if (this.changeListeners.has(parentPath)) {
        for (const callback of this.changeListeners.get(parentPath)) {
          try {
            callback(event);
          } catch (err) {
            console.error(`Error in change listener for ${parentPath}:`, err);
          }
        }
      }
    }
  }

  /**
   * Saves configuration to a file
   * 
   * @param {string} filePath - File path (optional)
   * @returns {Promise<boolean>} Success status
   */
  async saveToFile(filePath) {
    const targetPath = filePath || path.join(this.configDir, `config.${this.currentEnvironment}.json`);
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      
      // Save configuration
      await fs.writeFile(targetPath, JSON.stringify({
        config: this.config,
        schemas: Array.from(this.schemas.entries()),
        environmentOverrides: Array.from(this.environmentOverrides.entries()),
        featureFlags: Array.from(this.featureFlags.entries()),
        timestamp: Date.now()
      }, null, 2));
      
      return true;
    } catch (err) {
      console.error('Failed to save configuration:', err);
      return false;
    }
  }

  /**
   * Loads configuration from a file
   * 
   * @param {string} filePath - File path (optional)
   * @returns {Promise<boolean>} Success status
   */
  async loadFromFile(filePath) {
    const targetPath = filePath || path.join(this.configDir, `config.${this.currentEnvironment}.json`);
    
    try {
      const data = await fs.readFile(targetPath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (parsed.config) {
        this.config = parsed.config;
      }
      
      if (parsed.schemas) {
        this.schemas = new Map(parsed.schemas);
      }
      
      if (parsed.environmentOverrides) {
        this.environmentOverrides = new Map(parsed.environmentOverrides);
      }
      
      if (parsed.featureFlags) {
        this.featureFlags = new Map(parsed.featureFlags);
      }
      
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, not an error
        return false;
      }
      
      console.error('Failed to load configuration:', err);
      return false;
    }
  }

  /**
   * Exports configuration to JSON
   * 
   * @returns {Object} Configuration as JSON
   */
  exportToJSON() {
    return {
      config: this.config,
      schemas: Array.from(this.schemas.entries()),
      environmentOverrides: Array.from(this.environmentOverrides.entries()),
      featureFlags: Array.from(this.featureFlags.entries()),
      timestamp: Date.now()
    };
  }

  /**
   * Imports configuration from JSON
   * 
   * @param {Object|string} json - Configuration as JSON or JSON string
   * @returns {boolean} Success status
   */
  importFromJSON(json) {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      
      if (parsed.config) {
        this.config = parsed.config;
      }
      
      if (parsed.schemas) {
        this.schemas = new Map(parsed.schemas);
      }
      
      if (parsed.environmentOverrides) {
        this.environmentOverrides = new Map(parsed.environmentOverrides);
      }
      
      if (parsed.featureFlags) {
        this.featureFlags = new Map(parsed.featureFlags);
      }
      
      return true;
    } catch (err) {
      console.error('Failed to import configuration:', err);
      return false;
    }
  }

  /**
   * Cleans up resources
   */
  dispose() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    this.eventEmitter.removeAllListeners();
    this.changeListeners.clear();
  }

  /**
   * Simple string hash function
   * 
   * @param {string} str - String to hash
   * @returns {number} Hash value
   * @private
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

module.exports = EnhancedConfigurationManager;
