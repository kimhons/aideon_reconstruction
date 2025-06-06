/**
 * @fileoverview Environment Manager for Aideon
 * 
 * The EnvironmentManager provides environment-specific configuration capabilities
 * for the Enhanced Configuration System, supporting different settings across
 * development, testing, staging, and production environments.
 * 
 * This component is part of the Enhanced Configuration System designed
 * to improve Aideon's GAIA Score by enhancing reliability and adaptability.
 */

'use strict';

const EventEmitter = require('events');
const os = require('os');

/**
 * Environment Manager class
 * 
 * Provides environment detection, switching, and environment-specific
 * configuration capabilities.
 */
class EnvironmentManager {
  /**
   * Creates a new EnvironmentManager instance
   * 
   * @param {Object} options - Environment manager options
   * @param {string} options.defaultEnvironment - Default environment
   * @param {Object} options.environments - Environment definitions
   * @param {Object} options.configManager - Configuration manager instance
   */
  constructor(options = {}) {
    this.defaultEnvironment = options.defaultEnvironment || 'development';
    this.environments = options.environments || {
      development: { description: 'Development environment' },
      testing: { description: 'Testing environment' },
      staging: { description: 'Staging environment' },
      production: { description: 'Production environment' }
    };
    this.configManager = options.configManager;
    this.currentEnvironment = null;
    this.overrides = new Map();
    this.eventEmitter = new EventEmitter();
    this.detectionRules = options.detectionRules || [];
    
    // Initialize current environment
    this.currentEnvironment = this.detectEnvironment() || this.defaultEnvironment;
    
    // Apply environment overrides if config manager is available
    if (this.configManager && this.currentEnvironment) {
      this.applyEnvironmentOverrides(this.currentEnvironment);
    }
  }

  /**
   * Detects the current environment based on rules
   * 
   * @returns {string|null} Detected environment or null if not detected
   */
  detectEnvironment() {
    // Check NODE_ENV first
    if (process.env.NODE_ENV) {
      const nodeEnv = process.env.NODE_ENV.toLowerCase();
      if (this.environments[nodeEnv]) {
        return nodeEnv;
      }
    }
    
    // Check AIDEON_ENV
    if (process.env.AIDEON_ENV) {
      const aideonEnv = process.env.AIDEON_ENV.toLowerCase();
      if (this.environments[aideonEnv]) {
        return aideonEnv;
      }
    }
    
    // Apply custom detection rules
    for (const rule of this.detectionRules) {
      const detectedEnv = rule();
      if (detectedEnv && this.environments[detectedEnv]) {
        return detectedEnv;
      }
    }
    
    // Check hostname patterns
    const hostname = os.hostname().toLowerCase();
    
    if (hostname.includes('prod') || hostname.includes('production')) {
      return 'production';
    } else if (hostname.includes('staging') || hostname.includes('stage')) {
      return 'staging';
    } else if (hostname.includes('test') || hostname.includes('qa')) {
      return 'testing';
    } else if (hostname.includes('dev') || hostname.includes('development')) {
      return 'development';
    }
    
    return null;
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
    if (!environment || !this.environments[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    const oldEnvironment = this.currentEnvironment;
    this.currentEnvironment = environment;
    
    // Apply environment overrides if config manager is available
    if (this.configManager) {
      this.applyEnvironmentOverrides(environment);
    }
    
    // Emit environment change event
    this.eventEmitter.emit('environmentChange', {
      oldEnvironment,
      newEnvironment: environment,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets all available environments
   * 
   * @returns {Object} Available environments
   */
  getEnvironments() {
    return { ...this.environments };
  }

  /**
   * Adds a new environment
   * 
   * @param {string} name - Environment name
   * @param {Object} definition - Environment definition
   * @returns {boolean} Success status
   */
  addEnvironment(name, definition = {}) {
    if (!name) {
      throw new Error('Environment name is required');
    }
    
    if (this.environments[name]) {
      throw new Error(`Environment already exists: ${name}`);
    }
    
    this.environments[name] = {
      description: definition.description || `${name} environment`,
      ...definition
    };
    
    // Emit environment added event
    this.eventEmitter.emit('environmentAdded', {
      name,
      definition: this.environments[name],
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Updates an environment definition
   * 
   * @param {string} name - Environment name
   * @param {Object} definition - Environment definition
   * @returns {boolean} Success status
   */
  updateEnvironment(name, definition = {}) {
    if (!name || !this.environments[name]) {
      throw new Error(`Invalid environment: ${name}`);
    }
    
    this.environments[name] = {
      ...this.environments[name],
      ...definition
    };
    
    // Emit environment updated event
    this.eventEmitter.emit('environmentUpdated', {
      name,
      definition: this.environments[name],
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Removes an environment
   * 
   * @param {string} name - Environment name
   * @returns {boolean} Success status
   */
  removeEnvironment(name) {
    if (!name || !this.environments[name]) {
      throw new Error(`Invalid environment: ${name}`);
    }
    
    if (name === this.defaultEnvironment) {
      throw new Error('Cannot remove default environment');
    }
    
    if (name === this.currentEnvironment) {
      throw new Error('Cannot remove current environment');
    }
    
    delete this.environments[name];
    
    // Remove overrides for this environment
    this.overrides.delete(name);
    
    // Emit environment removed event
    this.eventEmitter.emit('environmentRemoved', {
      name,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Sets the default environment
   * 
   * @param {string} environment - Environment name
   * @returns {boolean} Success status
   */
  setDefaultEnvironment(environment) {
    if (!environment || !this.environments[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    const oldDefault = this.defaultEnvironment;
    this.defaultEnvironment = environment;
    
    // Emit default environment change event
    this.eventEmitter.emit('defaultEnvironmentChange', {
      oldDefault,
      newDefault: environment,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets the default environment
   * 
   * @returns {string} Default environment
   */
  getDefaultEnvironment() {
    return this.defaultEnvironment;
  }

  /**
   * Sets environment-specific configuration overrides
   * 
   * @param {string} environment - Environment name
   * @param {string} path - Configuration path
   * @param {*} value - Override value
   * @returns {boolean} Success status
   */
  setOverride(environment, path, value) {
    if (!environment || !this.environments[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    if (!path) {
      throw new Error('Path is required');
    }
    
    // Initialize overrides for this environment if not exists
    if (!this.overrides.has(environment)) {
      this.overrides.set(environment, new Map());
    }
    
    // Set override
    this.overrides.get(environment).set(path, value);
    
    // Apply override if this is the current environment
    if (environment === this.currentEnvironment && this.configManager) {
      const envOverrides = this.configManager.getEnvironmentOverrides(environment) || {};
      envOverrides[path] = value;
      this.configManager.setEnvironmentOverrides(environment, envOverrides);
    }
    
    // Emit override set event
    this.eventEmitter.emit('overrideSet', {
      environment,
      path,
      value,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets environment-specific configuration overrides
   * 
   * @param {string} environment - Environment name
   * @param {string} path - Configuration path (optional)
   * @returns {*} Override value or all overrides
   */
  getOverride(environment, path) {
    if (!environment || !this.environments[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    const envOverrides = this.overrides.get(environment);
    if (!envOverrides) {
      return path ? undefined : {};
    }
    
    if (path) {
      return envOverrides.get(path);
    }
    
    // Return all overrides as object
    const result = {};
    for (const [key, value] of envOverrides.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Removes environment-specific configuration override
   * 
   * @param {string} environment - Environment name
   * @param {string} path - Configuration path
   * @returns {boolean} Success status
   */
  removeOverride(environment, path) {
    if (!environment || !this.environments[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    if (!path) {
      throw new Error('Path is required');
    }
    
    const envOverrides = this.overrides.get(environment);
    if (!envOverrides || !envOverrides.has(path)) {
      return false;
    }
    
    // Remove override
    envOverrides.delete(path);
    
    // Update config manager if this is the current environment
    if (environment === this.currentEnvironment && this.configManager) {
      const configOverrides = this.configManager.getEnvironmentOverrides(environment) || {};
      delete configOverrides[path];
      this.configManager.setEnvironmentOverrides(environment, configOverrides);
    }
    
    // Emit override removed event
    this.eventEmitter.emit('overrideRemoved', {
      environment,
      path,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Applies environment-specific configuration overrides
   * 
   * @param {string} environment - Environment name
   * @returns {boolean} Success status
   * @private
   */
  applyEnvironmentOverrides(environment) {
    if (!environment || !this.environments[environment]) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    
    if (!this.configManager) {
      return false;
    }
    
    const envOverrides = this.overrides.get(environment);
    if (!envOverrides) {
      // Clear any existing overrides
      this.configManager.setEnvironmentOverrides(environment, {});
      return true;
    }
    
    // Convert Map to object for config manager
    const overridesObj = {};
    for (const [path, value] of envOverrides.entries()) {
      overridesObj[path] = value;
    }
    
    // Set environment overrides in config manager
    this.configManager.setEnvironmentOverrides(environment, overridesObj);
    
    return true;
  }

  /**
   * Adds a custom environment detection rule
   * 
   * @param {Function} rule - Detection rule function
   * @returns {boolean} Success status
   */
  addDetectionRule(rule) {
    if (typeof rule !== 'function') {
      throw new Error('Detection rule must be a function');
    }
    
    this.detectionRules.push(rule);
    return true;
  }

  /**
   * Checks if a value is valid for the current environment
   * 
   * @param {string} path - Configuration path
   * @param {*} value - Value to check
   * @returns {boolean} Whether the value is valid
   */
  isValidForEnvironment(path, value) {
    if (!path || !this.currentEnvironment) {
      return true;
    }
    
    const envConfig = this.environments[this.currentEnvironment];
    if (!envConfig || !envConfig.validationRules) {
      return true;
    }
    
    const rule = envConfig.validationRules[path];
    if (!rule) {
      return true;
    }
    
    if (typeof rule === 'function') {
      return rule(value, path, this.currentEnvironment);
    }
    
    return true;
  }

  /**
   * Adds an environment event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {EnvironmentManager} This environment manager for chaining
   */
  on(event, listener) {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Removes an environment event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {EnvironmentManager} This environment manager for chaining
   */
  off(event, listener) {
    this.eventEmitter.off(event, listener);
    return this;
  }

  /**
   * Serializes the environment manager to JSON
   * 
   * @returns {Object} Serialized environment manager
   */
  toJSON() {
    const overridesObj = {};
    for (const [env, overrides] of this.overrides.entries()) {
      overridesObj[env] = {};
      for (const [path, value] of overrides.entries()) {
        overridesObj[env][path] = value;
      }
    }
    
    return {
      defaultEnvironment: this.defaultEnvironment,
      currentEnvironment: this.currentEnvironment,
      environments: this.environments,
      overrides: overridesObj
    };
  }

  /**
   * Creates an environment manager from JSON
   * 
   * @param {Object|string} json - JSON object or string
   * @param {Object} configManager - Configuration manager instance
   * @returns {EnvironmentManager} Created environment manager
   * @static
   */
  static fromJSON(json, configManager) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    
    const manager = new EnvironmentManager({
      defaultEnvironment: parsed.defaultEnvironment,
      environments: parsed.environments,
      configManager
    });
    
    // Set current environment
    if (parsed.currentEnvironment) {
      manager.currentEnvironment = parsed.currentEnvironment;
    }
    
    // Set overrides
    if (parsed.overrides) {
      for (const [env, overrides] of Object.entries(parsed.overrides)) {
        for (const [path, value] of Object.entries(overrides)) {
          manager.setOverride(env, path, value);
        }
      }
    }
    
    return manager;
  }
}

module.exports = EnvironmentManager;
