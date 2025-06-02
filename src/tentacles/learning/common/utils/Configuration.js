/**
 * @fileoverview Configuration management utility for the Learning from Demonstration system.
 * Provides centralized configuration handling with support for defaults, overrides,
 * and environment-specific settings.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

class Configuration {
  /**
   * Creates a new Configuration instance.
   * @param {Object} defaultConfig - Default configuration values
   */
  constructor(defaultConfig = {}) {
    this._config = { ...defaultConfig };
    this._listeners = new Map();
    this._nextListenerId = 1;
  }

  /**
   * Gets a configuration value.
   * @param {string} key - The configuration key
   * @param {*} defaultValue - Default value if key is not found
   * @returns {*} The configuration value or defaultValue if not found
   */
  get(key, defaultValue = undefined) {
    const parts = key.split('.');
    let current = this._config;
    
    for (let i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) {
        return defaultValue;
      }
      current = current[parts[i]];
    }
    
    return current !== undefined ? current : defaultValue;
  }

  /**
   * Sets a configuration value.
   * @param {string} key - The configuration key
   * @param {*} value - The value to set
   * @returns {Configuration} This instance for chaining
   */
  set(key, value) {
    const parts = key.split('.');
    let current = this._config;
    
    // Navigate to the correct nesting level
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined || current[parts[i]] === null) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    // Set the value
    const lastKey = parts[parts.length - 1];
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    // Notify listeners if value changed
    if (oldValue !== value) {
      this._notifyListeners(key, value, oldValue);
    }
    
    return this;
  }

  /**
   * Updates multiple configuration values at once.
   * @param {Object} configObject - Object containing key-value pairs to update
   * @param {string} [prefix=''] - Optional prefix for all keys
   * @returns {Configuration} This instance for chaining
   */
  update(configObject, prefix = '') {
    for (const [key, value] of Object.entries(configObject)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively update nested objects
        this.update(value, fullKey);
      } else {
        this.set(fullKey, value);
      }
    }
    
    return this;
  }

  /**
   * Loads configuration from a JSON object.
   * @param {Object} jsonConfig - Configuration object to load
   * @returns {Configuration} This instance for chaining
   */
  loadFromJson(jsonConfig) {
    this.update(jsonConfig);
    return this;
  }

  /**
   * Resets configuration to default values.
   * @param {Object} [defaultConfig={}] - New default configuration (optional)
   * @returns {Configuration} This instance for chaining
   */
  reset(defaultConfig = {}) {
    const oldConfig = { ...this._config };
    this._config = { ...defaultConfig };
    
    // Notify listeners about all changed keys
    this._notifyAllChanges(oldConfig, this._config);
    
    return this;
  }

  /**
   * Adds a listener for configuration changes.
   * @param {Function} callback - Callback function(key, newValue, oldValue)
   * @returns {number} Listener ID for later removal
   */
  addChangeListener(callback) {
    const id = this._nextListenerId++;
    this._listeners.set(id, callback);
    return id;
  }

  /**
   * Removes a configuration change listener.
   * @param {number} listenerId - ID of the listener to remove
   * @returns {boolean} True if listener was removed, false if not found
   */
  removeChangeListener(listenerId) {
    return this._listeners.delete(listenerId);
  }

  /**
   * Notifies all listeners about a configuration change.
   * @param {string} key - The changed configuration key
   * @param {*} newValue - The new value
   * @param {*} oldValue - The old value
   * @private
   */
  _notifyListeners(key, newValue, oldValue) {
    this._listeners.forEach(callback => {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        console.error(`Error in configuration change listener: ${error.message}`);
      }
    });
  }

  /**
   * Notifies listeners about all changes between two configuration objects.
   * @param {Object} oldConfig - Previous configuration
   * @param {Object} newConfig - New configuration
   * @param {string} [prefix=''] - Key prefix for nested objects
   * @private
   */
  _notifyAllChanges(oldConfig, newConfig, prefix = '') {
    // Check all keys in the new config
    for (const [key, newValue] of Object.entries(newConfig)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const oldValue = oldConfig[key];
      
      if (newValue !== null && typeof newValue === 'object' && !Array.isArray(newValue) &&
          oldValue !== null && typeof oldValue === 'object' && !Array.isArray(oldValue)) {
        // Recursively check nested objects
        this._notifyAllChanges(oldValue, newValue, fullKey);
      } else if (newValue !== oldValue) {
        this._notifyListeners(fullKey, newValue, oldValue);
      }
    }
    
    // Check for keys that were removed
    for (const [key, oldValue] of Object.entries(oldConfig)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (!(key in newConfig)) {
        this._notifyListeners(fullKey, undefined, oldValue);
      }
    }
  }

  /**
   * Creates a scoped configuration with a prefix.
   * @param {string} prefix - Prefix for all keys in this scope
   * @returns {Object} A scoped configuration object
   */
  scope(prefix) {
    const self = this;
    
    return {
      get(key, defaultValue) {
        return self.get(`${prefix}.${key}`, defaultValue);
      },
      
      set(key, value) {
        self.set(`${prefix}.${key}`, value);
        return this;
      },
      
      update(configObject) {
        self.update(configObject, prefix);
        return this;
      },
      
      addChangeListener(callback) {
        const wrappedCallback = (key, newValue, oldValue) => {
          if (key.startsWith(`${prefix}.`)) {
            const scopedKey = key.substring(prefix.length + 1);
            callback(scopedKey, newValue, oldValue);
          }
        };
        
        return self.addChangeListener(wrappedCallback);
      },
      
      removeChangeListener(listenerId) {
        return self.removeChangeListener(listenerId);
      },
      
      scope(subPrefix) {
        return self.scope(`${prefix}.${subPrefix}`);
      }
    };
  }
}

module.exports = Configuration;
