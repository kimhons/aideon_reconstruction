/**
 * Configuration Service for the Quantum Computing Tentacle
 * 
 * Manages configuration settings for the quantum computing tentacle,
 * including local simulation settings, cloud provider credentials,
 * and feature toggles.
 * 
 * @module tentacles/quantum/core/ConfigurationService
 */

class ConfigurationService {
  /**
   * Creates a new instance of the Configuration Service
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.defaultConfig - Default configuration values
   * @param {Object} options.core - Reference to the Aideon core system
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.defaultConfig = options.defaultConfig || {};
    this.core = options.core;
    this.config = {};
    this.initialized = false;
    this.configChangeListeners = new Map();
    this.configChangeListenerId = 0;
  }

  /**
   * Initializes the Configuration Service
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.debug('Initializing Quantum Computing Configuration Service');
    
    try {
      // Load configuration from Aideon core if available
      if (this.core && this.core.configManager) {
        const coreConfig = await this.core.configManager.getTentacleConfig('quantum-computing');
        this.config = this.mergeConfigs(this.defaultConfig, coreConfig);
      } else {
        this.config = { ...this.defaultConfig };
      }
      
      // Apply environment-specific overrides
      this.applyEnvironmentOverrides();
      
      // Validate configuration
      this.validateConfiguration();
      
      this.initialized = true;
      this.logger.debug('Quantum Computing Configuration Service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Configuration Service', error);
      throw error;
    }
  }

  /**
   * Merges default configuration with provided configuration
   * 
   * @private
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} overrideConfig - Override configuration
   * @returns {Object} - Merged configuration
   */
  mergeConfigs(defaultConfig, overrideConfig) {
    const result = { ...defaultConfig };
    
    if (!overrideConfig) {
      return result;
    }
    
    // Deep merge of configuration objects
    for (const key in overrideConfig) {
      if (
        typeof overrideConfig[key] === 'object' && 
        overrideConfig[key] !== null && 
        !Array.isArray(overrideConfig[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.mergeConfigs(result[key], overrideConfig[key]);
      } else {
        result[key] = overrideConfig[key];
      }
    }
    
    return result;
  }

  /**
   * Applies environment-specific configuration overrides
   * 
   * @private
   */
  applyEnvironmentOverrides() {
    // Check for environment variables with AIDEON_QUANTUM_ prefix
    for (const key in process.env) {
      if (key.startsWith('AIDEON_QUANTUM_')) {
        const configPath = key
          .replace('AIDEON_QUANTUM_', '')
          .toLowerCase()
          .split('_')
          .join('.');
        
        this.setConfigValue(configPath, this.parseEnvironmentValue(process.env[key]));
      }
    }
  }

  /**
   * Parses environment variable values to appropriate types
   * 
   * @private
   * @param {string} value - Environment variable value
   * @returns {any} - Parsed value
   */
  parseEnvironmentValue(value) {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      // Not valid JSON, return as string
      return value;
    }
  }

  /**
   * Validates the configuration
   * 
   * @private
   * @throws {Error} If configuration is invalid
   */
  validateConfiguration() {
    // Validate local simulation settings
    const localSimulation = this.get('local.simulation', {});
    if (localSimulation.enabled && typeof localSimulation.maxQubits !== 'number') {
      this.logger.warn('Invalid local.simulation.maxQubits, using default');
      this.set('local.simulation.maxQubits', 20);
    }
    
    // Validate cloud provider settings
    const cloudProviders = this.get('cloud.providers', {});
    for (const providerId in cloudProviders) {
      const provider = cloudProviders[providerId];
      
      if (provider.enabled && !provider.credentials) {
        this.logger.warn(`Cloud provider ${providerId} is enabled but has no credentials`);
      }
    }
  }

  /**
   * Gets a configuration value by path
   * 
   * @param {string} path - Configuration path (dot notation)
   * @param {any} defaultValue - Default value if path not found
   * @returns {any} - Configuration value
   */
  get(path, defaultValue) {
    if (!this.initialized) {
      this.logger.warn('Configuration Service not initialized, using default values');
      return defaultValue;
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
   * @param {string} path - Configuration path (dot notation)
   * @param {any} value - Value to set
   * @returns {boolean} - Success status
   */
  set(path, value) {
    if (!this.initialized) {
      this.logger.warn('Configuration Service not initialized, cannot set values');
      return false;
    }
    
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this.config;
    
    // Navigate to the parent object
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    // Set the value
    const oldValue = current[lastPart];
    current[lastPart] = value;
    
    // Notify listeners if value changed
    if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
      this.notifyConfigChange(path, oldValue, value);
    }
    
    // Persist to core if available
    this.persistConfiguration();
    
    return true;
  }

  /**
   * Persists configuration to Aideon core
   * 
   * @private
   */
  async persistConfiguration() {
    if (this.core && this.core.configManager) {
      try {
        await this.core.configManager.setTentacleConfig('quantum-computing', this.config);
      } catch (error) {
        this.logger.error('Failed to persist configuration to core', error);
      }
    }
  }

  /**
   * Adds a configuration change listener
   * 
   * @param {string} path - Configuration path to listen for changes
   * @param {Function} callback - Callback function(path, oldValue, newValue)
   * @returns {number} - Listener ID for removal
   */
  addChangeListener(path, callback) {
    const id = ++this.configChangeListenerId;
    this.configChangeListeners.set(id, { path, callback });
    return id;
  }

  /**
   * Removes a configuration change listener
   * 
   * @param {number} id - Listener ID to remove
   * @returns {boolean} - Success status
   */
  removeChangeListener(id) {
    return this.configChangeListeners.delete(id);
  }

  /**
   * Notifies listeners of configuration changes
   * 
   * @private
   * @param {string} path - Configuration path that changed
   * @param {any} oldValue - Previous value
   * @param {any} newValue - New value
   */
  notifyConfigChange(path, oldValue, newValue) {
    for (const [id, listener] of this.configChangeListeners.entries()) {
      if (path === listener.path || path.startsWith(`${listener.path}.`)) {
        try {
          listener.callback(path, oldValue, newValue);
        } catch (error) {
          this.logger.error(`Error in config change listener ${id}`, error);
        }
      }
    }
  }

  /**
   * Gets the entire configuration object
   * 
   * @returns {Object} - Configuration object
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Resets configuration to defaults
   * 
   * @returns {Promise<boolean>} - Success status
   */
  async reset() {
    this.config = { ...this.defaultConfig };
    await this.persistConfiguration();
    return true;
  }

  /**
   * Shuts down the Configuration Service
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.logger.debug('Shutting down Configuration Service');
    this.configChangeListeners.clear();
    this.initialized = false;
  }
}

module.exports = { ConfigurationService };
