/**
 * @fileoverview Mock BaseTentacle for testing purposes
 * 
 * This file provides a mock implementation of the BaseTentacle class for testing.
 * It simulates the core functionality of the BaseTentacle without requiring the actual implementation.
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
   * @param {string} options.id - Unique identifier for the tentacle
   * @param {string} options.name - Display name for the tentacle
   * @param {string} options.description - Description of the tentacle's functionality
   * @param {string} options.version - Version of the tentacle
   */
  constructor(options = {}) {
    this.id = options.id || 'mock-tentacle';
    this.name = options.name || 'Mock Tentacle';
    this.description = options.description || 'Mock tentacle for testing purposes';
    this.version = options.version || '1.0.0';
    this.capabilities = new Map();
    this.initialized = false;
    
    console.log(`Mock BaseTentacle created: ${this.name} (${this.id})`);
  }
  
  /**
   * Registers a capability with the tentacle
   * @param {string} name - Name of the capability
   * @param {Function} handler - Function that implements the capability
   */
  registerCapability(name, handler) {
    this.capabilities.set(name, handler);
    console.log(`Registered capability: ${name}`);
  }
  
  /**
   * Executes a capability
   * @param {string} name - Name of the capability to execute
   * @param {...any} args - Arguments to pass to the capability handler
   * @returns {Promise<any>} Result of the capability execution
   */
  async executeCapability(name, ...args) {
    if (!this.capabilities.has(name)) {
      throw new Error(`Capability not found: ${name}`);
    }
    
    const handler = this.capabilities.get(name);
    return await handler(...args);
  }
  
  /**
   * Gets all registered capabilities
   * @returns {Array<string>} Array of capability names
   */
  getCapabilities() {
    return Array.from(this.capabilities.keys());
  }
  
  /**
   * Checks if a capability is registered
   * @param {string} name - Name of the capability
   * @returns {boolean} True if the capability is registered, false otherwise
   */
  hasCapability(name) {
    return this.capabilities.has(name);
  }
}

module.exports = BaseTentacle;
