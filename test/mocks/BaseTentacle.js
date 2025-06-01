/**
 * @fileoverview Mock BaseTentacle class for testing
 * 
 * @module test/mocks/BaseTentacle
 */

/**
 * @class BaseTentacle
 * @description Mock implementation of the BaseTentacle class for testing
 */
class BaseTentacle {
  /**
   * Creates an instance of BaseTentacle
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.id = options.id || 'base-tentacle';
    this.name = options.name || 'Base Tentacle';
    this.description = options.description || 'Base tentacle class';
    this.version = options.version || '1.0.0';
    this.capabilities = new Map();
  }
  
  /**
   * Initializes the tentacle
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    return true;
  }
  
  /**
   * Registers a capability
   * @param {string} name - Capability name
   * @param {Function} handler - Capability handler function
   */
  registerCapability(name, handler) {
    this.capabilities.set(name, handler);
  }
  
  /**
   * Checks if the tentacle has a capability
   * @param {string} name - Capability name
   * @returns {boolean} Whether the tentacle has the capability
   */
  hasCapability(name) {
    return this.capabilities.has(name);
  }
  
  /**
   * Executes a capability
   * @async
   * @param {string} name - Capability name
   * @param {Object} options - Capability options
   * @returns {Promise<any>} Capability result
   */
  async executeCapability(name, options) {
    if (!this.hasCapability(name)) {
      throw new Error(`Capability ${name} not found`);
    }
    
    const handler = this.capabilities.get(name);
    return await handler(options);
  }
  
  /**
   * Handles shutdown of the tentacle
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    return true;
  }
}

module.exports = BaseTentacle;
