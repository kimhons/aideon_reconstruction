/**
 * @fileoverview Mock ConfigurationService for integration tests
 */

class ConfigurationService {
  constructor(options = {}) {
    this.config = new Map();
    this.defaultValues = new Map();
  }

  getConfig(key, defaultValue = null) {
    if (this.config.has(key)) {
      return this.config.get(key);
    }
    
    if (defaultValue !== null) {
      return defaultValue;
    }
    
    if (this.defaultValues.has(key)) {
      return this.defaultValues.get(key);
    }
    
    return null;
  }

  setConfig(key, value) {
    this.config.set(key, value);
    return true;
  }

  setDefaultValue(key, value) {
    this.defaultValues.set(key, value);
    return true;
  }

  hasConfig(key) {
    return this.config.has(key) || this.defaultValues.has(key);
  }

  removeConfig(key) {
    return this.config.delete(key);
  }
}

module.exports = ConfigurationService;
