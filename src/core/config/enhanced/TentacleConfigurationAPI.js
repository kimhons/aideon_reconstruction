/**
 * @fileoverview Tentacle Configuration API for Aideon
 * 
 * The TentacleConfigurationAPI provides a standardized interface for tentacles
 * to access and modify configuration values from the Enhanced Configuration System.
 * 
 * This component is part of the Enhanced Configuration System designed
 * to improve Aideon's GAIA Score by enhancing reliability and adaptability.
 */

'use strict';

const EventEmitter = require('events');

/**
 * Tentacle Configuration API class
 * 
 * Provides a standardized interface for tentacles to access and modify
 * configuration values from the Enhanced Configuration System.
 */
class TentacleConfigurationAPI {
  /**
   * Creates a new TentacleConfigurationAPI instance
   * 
   * @param {Object} options - API options
   * @param {Object} options.configManager - Configuration manager instance
   * @param {Object} options.featureFlagManager - Feature flag manager instance
   * @param {Object} options.environmentManager - Environment manager instance
   * @param {string} options.tentacleId - Tentacle identifier
   */
  constructor(options = {}) {
    this.configManager = options.configManager;
    this.featureFlagManager = options.featureFlagManager;
    this.environmentManager = options.environmentManager;
    this.tentacleId = options.tentacleId || '';
    this.namespace = `tentacles.${this.tentacleId}`;
    this.eventEmitter = new EventEmitter();
    this.registeredConfigs = new Map();
    this.schemaRegistry = new Map();
    
    // Set up change listeners
    if (this.configManager) {
      this.configManager.onConfigChange(this.namespace, (event) => {
        this.eventEmitter.emit('configChange', event);
      });
    }
  }

  /**
   * Gets a configuration value
   * 
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} Configuration value
   */
  get(key, defaultValue) {
    if (!this.configManager) {
      return defaultValue;
    }
    
    const path = this.getFullPath(key);
    return this.configManager.get(path, defaultValue);
  }

  /**
   * Sets a configuration value
   * 
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   * @param {Object} options - Set options
   * @returns {boolean} Success status
   */
  set(key, value, options = {}) {
    if (!this.configManager) {
      return false;
    }
    
    const path = this.getFullPath(key);
    return this.configManager.set(path, value, options);
  }

  /**
   * Checks if a configuration key exists
   * 
   * @param {string} key - Configuration key
   * @returns {boolean} Whether the key exists
   */
  has(key) {
    if (!this.configManager) {
      return false;
    }
    
    const path = this.getFullPath(key);
    return this.configManager.has(path);
  }

  /**
   * Deletes a configuration value
   * 
   * @param {string} key - Configuration key
   * @param {Object} options - Delete options
   * @returns {boolean} Success status
   */
  delete(key, options = {}) {
    if (!this.configManager) {
      return false;
    }
    
    const path = this.getFullPath(key);
    return this.configManager.delete(path, options);
  }

  /**
   * Begins a configuration transaction
   * 
   * @returns {Object} Transaction object
   */
  beginTransaction() {
    if (!this.configManager) {
      throw new Error('Configuration manager not available');
    }
    
    return this.configManager.beginTransaction();
  }

  /**
   * Sets a configuration value in a transaction
   * 
   * @param {Object} transaction - Transaction object
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   * @returns {Object} Updated transaction
   */
  setInTransaction(transaction, key, value) {
    if (!transaction) {
      throw new Error('Transaction is required');
    }
    
    const path = this.getFullPath(key);
    transaction.set(path, value);
    return transaction;
  }

  /**
   * Deletes a configuration value in a transaction
   * 
   * @param {Object} transaction - Transaction object
   * @param {string} key - Configuration key
   * @returns {Object} Updated transaction
   */
  deleteInTransaction(transaction, key) {
    if (!transaction) {
      throw new Error('Transaction is required');
    }
    
    const path = this.getFullPath(key);
    transaction.delete(path);
    return transaction;
  }

  /**
   * Commits a configuration transaction
   * 
   * @param {Object} transaction - Transaction object
   * @returns {boolean} Success status
   */
  commitTransaction(transaction) {
    if (!this.configManager) {
      throw new Error('Configuration manager not available');
    }
    
    return this.configManager.commitTransaction(transaction);
  }

  /**
   * Rolls back a configuration transaction
   * 
   * @param {Object} transaction - Transaction object
   * @returns {boolean} Success status
   */
  rollbackTransaction(transaction) {
    if (!this.configManager) {
      throw new Error('Configuration manager not available');
    }
    
    return this.configManager.rollbackTransaction(transaction);
  }

  /**
   * Registers a configuration schema
   * 
   * @param {string} key - Configuration key
   * @param {Object} schema - JSON Schema
   * @returns {boolean} Success status
   */
  registerSchema(key, schema) {
    if (!this.configManager) {
      return false;
    }
    
    const path = this.getFullPath(key);
    this.schemaRegistry.set(key, schema);
    return this.configManager.registerSchema(path, schema);
  }

  /**
   * Registers default configuration values
   * 
   * @param {Object} defaults - Default configuration values
   * @returns {boolean} Success status
   */
  registerDefaults(defaults) {
    if (!this.configManager || !defaults) {
      return false;
    }
    
    const transaction = this.beginTransaction();
    
    for (const [key, value] of Object.entries(defaults)) {
      const path = this.getFullPath(key);
      
      // Only set if not already set
      if (!this.configManager.has(path)) {
        transaction.set(path, value);
      }
      
      // Register this configuration
      this.registeredConfigs.set(key, {
        defaultValue: value,
        description: '',
        type: typeof value
      });
    }
    
    return this.commitTransaction(transaction);
  }

  /**
   * Registers a configuration with metadata
   * 
   * @param {string} key - Configuration key
   * @param {Object} options - Configuration options
   * @param {*} options.defaultValue - Default value
   * @param {string} options.description - Configuration description
   * @param {string} options.type - Configuration type
   * @param {Object} options.schema - JSON Schema
   * @returns {boolean} Success status
   */
  registerConfig(key, options = {}) {
    if (!key) {
      throw new Error('Configuration key is required');
    }
    
    // Register schema if provided
    if (options.schema) {
      this.registerSchema(key, options.schema);
    }
    
    // Register default value if provided and not already set
    if (options.defaultValue !== undefined) {
      const path = this.getFullPath(key);
      if (!this.configManager || !this.configManager.has(path)) {
        this.set(key, options.defaultValue);
      }
    }
    
    // Register configuration metadata
    this.registeredConfigs.set(key, {
      defaultValue: options.defaultValue,
      description: options.description || '',
      type: options.type || (options.defaultValue !== undefined ? typeof options.defaultValue : 'any')
    });
    
    return true;
  }

  /**
   * Gets all registered configurations
   * 
   * @returns {Object} Registered configurations
   */
  getRegisteredConfigs() {
    const result = {};
    for (const [key, config] of this.registeredConfigs.entries()) {
      result[key] = {
        ...config,
        currentValue: this.get(key, config.defaultValue)
      };
    }
    return result;
  }

  /**
   * Checks if a feature is enabled
   * 
   * @param {string} key - Feature flag key
   * @param {Object} context - Evaluation context
   * @returns {boolean} Whether the feature is enabled
   */
  isFeatureEnabled(key, context = {}) {
    if (!this.featureFlagManager) {
      return false;
    }
    
    // Prefix with tentacle ID if not already prefixed
    const flagKey = key.includes('.') ? key : `${this.tentacleId}.${key}`;
    return this.featureFlagManager.isEnabled(flagKey, context);
  }

  /**
   * Registers a feature flag
   * 
   * @param {string} key - Feature flag key
   * @param {Object} options - Feature flag options
   * @returns {boolean} Success status
   */
  registerFeatureFlag(key, options = {}) {
    if (!this.featureFlagManager) {
      return false;
    }
    
    // Prefix with tentacle ID if not already prefixed
    const flagKey = key.includes('.') ? key : `${this.tentacleId}.${key}`;
    
    try {
      // Add flag if it doesn't exist
      if (!this.featureFlagManager.getFlag(flagKey)) {
        return this.featureFlagManager.addFlag(flagKey, options);
      }
      
      // Update flag if it exists
      return this.featureFlagManager.updateFlag(flagKey, options);
    } catch (err) {
      console.error(`Error registering feature flag ${flagKey}:`, err);
      return false;
    }
  }

  /**
   * Gets the current environment
   * 
   * @returns {string} Current environment
   */
  getCurrentEnvironment() {
    if (!this.environmentManager) {
      return 'development';
    }
    
    return this.environmentManager.getCurrentEnvironment();
  }

  /**
   * Checks if the current environment is production
   * 
   * @returns {boolean} Whether the current environment is production
   */
  isProduction() {
    return this.getCurrentEnvironment() === 'production';
  }

  /**
   * Checks if the current environment is development
   * 
   * @returns {boolean} Whether the current environment is development
   */
  isDevelopment() {
    return this.getCurrentEnvironment() === 'development';
  }

  /**
   * Sets an environment-specific configuration override
   * 
   * @param {string} environment - Environment name
   * @param {string} key - Configuration key
   * @param {*} value - Override value
   * @returns {boolean} Success status
   */
  setEnvironmentOverride(environment, key, value) {
    if (!this.environmentManager) {
      return false;
    }
    
    const path = this.getFullPath(key);
    return this.environmentManager.setOverride(environment, path, value);
  }

  /**
   * Gets the full configuration path for a key
   * 
   * @param {string} key - Configuration key
   * @returns {string} Full configuration path
   * @private
   */
  getFullPath(key) {
    return key.includes('.') ? key : `${this.namespace}.${key}`;
  }

  /**
   * Adds a configuration change listener
   * 
   * @param {string} key - Configuration key
   * @param {Function} callback - Callback function
   * @returns {boolean} Success status
   */
  onConfigChange(key, callback) {
    if (!key || typeof callback !== 'function') {
      throw new Error('Key and callback are required');
    }
    
    const path = this.getFullPath(key);
    
    // Register with config manager if available
    if (this.configManager) {
      this.configManager.onConfigChange(path, callback);
    }
    
    // Also register with local event emitter
    this.eventEmitter.on(`configChange:${key}`, callback);
    
    return true;
  }

  /**
   * Removes a configuration change listener
   * 
   * @param {string} key - Configuration key
   * @param {Function} callback - Callback function
   * @returns {boolean} Success status
   */
  offConfigChange(key, callback) {
    if (!key || typeof callback !== 'function') {
      return false;
    }
    
    const path = this.getFullPath(key);
    
    // Unregister from config manager if available
    if (this.configManager) {
      this.configManager.offConfigChange(path, callback);
    }
    
    // Also unregister from local event emitter
    this.eventEmitter.off(`configChange:${key}`, callback);
    
    return true;
  }

  /**
   * Generates documentation for tentacle configuration
   * 
   * @param {string} format - Documentation format ('markdown', 'html', 'json')
   * @returns {string} Generated documentation
   */
  generateDocumentation(format = 'markdown') {
    switch (format.toLowerCase()) {
      case 'markdown':
        return this.generateMarkdownDocumentation();
      case 'html':
        return this.generateHtmlDocumentation();
      case 'json':
        return JSON.stringify(this.generateJsonDocumentation(), null, 2);
      default:
        throw new Error(`Unsupported documentation format: ${format}`);
    }
  }

  /**
   * Generates Markdown documentation for tentacle configuration
   * 
   * @returns {string} Markdown documentation
   * @private
   */
  generateMarkdownDocumentation() {
    let doc = `# ${this.tentacleId} Configuration\n\n`;
    
    doc += `## Configuration Options\n\n`;
    
    for (const [key, config] of this.registeredConfigs.entries()) {
      doc += `### ${key}\n\n`;
      
      if (config.description) {
        doc += `${config.description}\n\n`;
      }
      
      doc += `- **Type:** ${config.type}\n`;
      doc += `- **Default Value:** \`${JSON.stringify(config.defaultValue)}\`\n`;
      doc += `- **Current Value:** \`${JSON.stringify(this.get(key, config.defaultValue))}\`\n\n`;
      
      // Add schema information if available
      const schema = this.schemaRegistry.get(key);
      if (schema) {
        doc += `#### Schema\n\n`;
        
        if (schema.type) {
          doc += `- **Type:** ${schema.type}\n`;
        }
        
        if (schema.enum) {
          doc += `- **Allowed Values:** ${schema.enum.map(v => `\`${v}\``).join(', ')}\n`;
        }
        
        if (schema.minimum !== undefined) {
          doc += `- **Minimum:** ${schema.minimum}\n`;
        }
        
        if (schema.maximum !== undefined) {
          doc += `- **Maximum:** ${schema.maximum}\n`;
        }
        
        doc += `\n`;
      }
    }
    
    doc += `## Feature Flags\n\n`;
    
    if (this.featureFlagManager) {
      const allFlags = this.featureFlagManager.getAllFlags();
      const tentacleFlags = Object.entries(allFlags).filter(([key]) => 
        key.startsWith(`${this.tentacleId}.`) || key.includes(`.${this.tentacleId}.`)
      );
      
      if (tentacleFlags.length > 0) {
        for (const [key, flag] of tentacleFlags) {
          doc += `### ${key}\n\n`;
          
          if (flag.description) {
            doc += `${flag.description}\n\n`;
          }
          
          doc += `- **Enabled:** ${flag.enabled}\n`;
          doc += `- **Rollout Percentage:** ${flag.rolloutPercentage}%\n`;
          
          if (flag.targetSegments && flag.targetSegments.length > 0) {
            doc += `- **Target Segments:** ${flag.targetSegments.join(', ')}\n`;
          }
          
          doc += `\n`;
        }
      } else {
        doc += `No feature flags registered for this tentacle.\n\n`;
      }
    } else {
      doc += `Feature flag manager not available.\n\n`;
    }
    
    doc += `## Environment Overrides\n\n`;
    
    if (this.environmentManager) {
      const environments = this.environmentManager.getEnvironments();
      
      for (const [envName, envConfig] of Object.entries(environments)) {
        doc += `### ${envName}\n\n`;
        
        if (envConfig.description) {
          doc += `${envConfig.description}\n\n`;
        }
        
        const overrides = this.environmentManager.getOverride(envName);
        const tentacleOverrides = Object.entries(overrides).filter(([key]) => 
          key.startsWith(`${this.namespace}.`) || key === this.namespace
        );
        
        if (tentacleOverrides.length > 0) {
          doc += `#### Overrides\n\n`;
          
          for (const [key, value] of tentacleOverrides) {
            const shortKey = key.startsWith(`${this.namespace}.`) ? 
              key.substring(this.namespace.length + 1) : key;
            
            doc += `- **${shortKey}:** \`${JSON.stringify(value)}\`\n`;
          }
          
          doc += `\n`;
        } else {
          doc += `No overrides for this environment.\n\n`;
        }
      }
    } else {
      doc += `Environment manager not available.\n\n`;
    }
    
    return doc;
  }

  /**
   * Generates HTML documentation for tentacle configuration
   * 
   * @returns {string} HTML documentation
   * @private
   */
  generateHtmlDocumentation() {
    let doc = `<!DOCTYPE html>
<html>
<head>
  <title>${this.tentacleId} Configuration</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    h2 { color: #444; margin-top: 30px; }
    h3 { color: #555; }
    .config-item { margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .config-item h3 { margin-top: 0; }
    .config-meta { color: #666; font-size: 0.9em; }
    .config-value { font-family: monospace; background-color: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
    .feature-flag { margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .feature-flag h3 { margin-top: 0; }
    .env-override { margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    .env-override h3 { margin-top: 0; }
  </style>
</head>
<body>
  <h1>${this.tentacleId} Configuration</h1>
  
  <h2>Configuration Options</h2>`;
    
    for (const [key, config] of this.registeredConfigs.entries()) {
      doc += `
  <div class="config-item">
    <h3>${key}</h3>`;
      
      if (config.description) {
        doc += `
    <p>${config.description}</p>`;
      }
      
      doc += `
    <div class="config-meta">
      <p><strong>Type:</strong> ${config.type}</p>
      <p><strong>Default Value:</strong> <span class="config-value">${JSON.stringify(config.defaultValue)}</span></p>
      <p><strong>Current Value:</strong> <span class="config-value">${JSON.stringify(this.get(key, config.defaultValue))}</span></p>
    </div>`;
      
      // Add schema information if available
      const schema = this.schemaRegistry.get(key);
      if (schema) {
        doc += `
    <div class="config-schema">
      <h4>Schema</h4>
      <ul>`;
        
        if (schema.type) {
          doc += `
        <li><strong>Type:</strong> ${schema.type}</li>`;
        }
        
        if (schema.enum) {
          doc += `
        <li><strong>Allowed Values:</strong> ${schema.enum.map(v => `<code>${v}</code>`).join(', ')}</li>`;
        }
        
        if (schema.minimum !== undefined) {
          doc += `
        <li><strong>Minimum:</strong> ${schema.minimum}</li>`;
        }
        
        if (schema.maximum !== undefined) {
          doc += `
        <li><strong>Maximum:</strong> ${schema.maximum}</li>`;
        }
        
        doc += `
      </ul>
    </div>`;
      }
      
      doc += `
  </div>`;
    }
    
    doc += `
  
  <h2>Feature Flags</h2>`;
    
    if (this.featureFlagManager) {
      const allFlags = this.featureFlagManager.getAllFlags();
      const tentacleFlags = Object.entries(allFlags).filter(([key]) => 
        key.startsWith(`${this.tentacleId}.`) || key.includes(`.${this.tentacleId}.`)
      );
      
      if (tentacleFlags.length > 0) {
        for (const [key, flag] of tentacleFlags) {
          doc += `
  <div class="feature-flag">
    <h3>${key}</h3>`;
          
          if (flag.description) {
            doc += `
    <p>${flag.description}</p>`;
          }
          
          doc += `
    <ul>
      <li><strong>Enabled:</strong> ${flag.enabled}</li>
      <li><strong>Rollout Percentage:</strong> ${flag.rolloutPercentage}%</li>`;
          
          if (flag.targetSegments && flag.targetSegments.length > 0) {
            doc += `
      <li><strong>Target Segments:</strong> ${flag.targetSegments.join(', ')}</li>`;
          }
          
          doc += `
    </ul>
  </div>`;
        }
      } else {
        doc += `
  <p>No feature flags registered for this tentacle.</p>`;
      }
    } else {
      doc += `
  <p>Feature flag manager not available.</p>`;
    }
    
    doc += `
  
  <h2>Environment Overrides</h2>`;
    
    if (this.environmentManager) {
      const environments = this.environmentManager.getEnvironments();
      
      for (const [envName, envConfig] of Object.entries(environments)) {
        doc += `
  <div class="env-override">
    <h3>${envName}</h3>`;
        
        if (envConfig.description) {
          doc += `
    <p>${envConfig.description}</p>`;
        }
        
        const overrides = this.environmentManager.getOverride(envName);
        const tentacleOverrides = Object.entries(overrides).filter(([key]) => 
          key.startsWith(`${this.namespace}.`) || key === this.namespace
        );
        
        if (tentacleOverrides.length > 0) {
          doc += `
    <h4>Overrides</h4>
    <ul>`;
          
          for (const [key, value] of tentacleOverrides) {
            const shortKey = key.startsWith(`${this.namespace}.`) ? 
              key.substring(this.namespace.length + 1) : key;
            
            doc += `
      <li><strong>${shortKey}:</strong> <span class="config-value">${JSON.stringify(value)}</span></li>`;
          }
          
          doc += `
    </ul>`;
        } else {
          doc += `
    <p>No overrides for this environment.</p>`;
        }
        
        doc += `
  </div>`;
      }
    } else {
      doc += `
  <p>Environment manager not available.</p>`;
    }
    
    doc += `
</body>
</html>`;
    
    return doc;
  }

  /**
   * Generates JSON documentation for tentacle configuration
   * 
   * @returns {Object} JSON documentation
   * @private
   */
  generateJsonDocumentation() {
    const configs = {};
    for (const [key, config] of this.registeredConfigs.entries()) {
      configs[key] = {
        ...config,
        currentValue: this.get(key, config.defaultValue),
        schema: this.schemaRegistry.get(key) || null
      };
    }
    
    const featureFlags = {};
    if (this.featureFlagManager) {
      const allFlags = this.featureFlagManager.getAllFlags();
      for (const [key, flag] of Object.entries(allFlags)) {
        if (key.startsWith(`${this.tentacleId}.`) || key.includes(`.${this.tentacleId}.`)) {
          featureFlags[key] = flag;
        }
      }
    }
    
    const environmentOverrides = {};
    if (this.environmentManager) {
      const environments = this.environmentManager.getEnvironments();
      for (const [envName, envConfig] of Object.entries(environments)) {
        const overrides = this.environmentManager.getOverride(envName);
        const tentacleOverrides = {};
        
        for (const [key, value] of Object.entries(overrides)) {
          if (key.startsWith(`${this.namespace}.`) || key === this.namespace) {
            const shortKey = key.startsWith(`${this.namespace}.`) ? 
              key.substring(this.namespace.length + 1) : key;
            
            tentacleOverrides[shortKey] = value;
          }
        }
        
        environmentOverrides[envName] = {
          description: envConfig.description,
          overrides: tentacleOverrides
        };
      }
    }
    
    return {
      tentacleId: this.tentacleId,
      namespace: this.namespace,
      configurations: configs,
      featureFlags,
      environmentOverrides,
      currentEnvironment: this.getCurrentEnvironment()
    };
  }
}

module.exports = TentacleConfigurationAPI;
