/**
 * @fileoverview Base Tentacle class for Aideon AI Desktop Agent.
 * Provides common functionality and interface for all tentacles.
 * 
 * @module core/tentacles/BaseTentacle
 * @requires core/utils/Logger
 * @requires core/integration
 */

const integration = require('../integration');

/**
 * Base class for all tentacles in the Aideon ecosystem
 */
class BaseTentacle {
  /**
   * Create a new BaseTentacle
   * @param {String} name - Name of the tentacle
   * @param {Object} config - Tentacle configuration
   * @param {Object} dependencies - Tentacle dependencies
   */
  constructor(name, config = {}, dependencies = {}) {
    this.name = name;
    this.config = config;
    this.dependencies = dependencies;
    this.status = 'initialized';
    
    // Register with integration system
    integration.registerComponent(`tentacle:${name}`, this, {
      type: 'tentacle',
      capabilities: this.getCapabilities()
    });
  }
  
  /**
   * Get tentacle capabilities
   * @returns {Array<String>} List of capabilities
   */
  getCapabilities() {
    return [];
  }
  
  /**
   * Handle incoming requests to the tentacle
   * @param {Object} request - The request object
   * @returns {Promise<Object>} The result of the command execution
   */
  async handleRequest(request) {
    throw new Error('handleRequest must be implemented by subclass');
  }
  
  /**
   * Get the status of the tentacle
   * @returns {Promise<Object>} Tentacle status
   */
  async getStatus() {
    return {
      name: this.name,
      status: this.status,
      timestamp: Date.now()
    };
  }
  
  /**
   * Initialize the tentacle
   * @returns {Promise<Boolean>} Success status
   */
  async initialize() {
    this.status = 'active';
    return true;
  }
  
  /**
   * Shutdown the tentacle
   * @returns {Promise<Boolean>} Success status
   */
  async shutdown() {
    this.status = 'inactive';
    return true;
  }
}

module.exports = BaseTentacle;
