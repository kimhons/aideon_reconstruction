/**
 * @fileoverview API Registry - Registry for all Aideon APIs
 * 
 * This module provides a registry for all APIs in the Aideon system.
 * It handles registration and management of API endpoints.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../logging/Logger');
const { EventEmitter } = require('../events/EventEmitter');

/**
 * ApiRegistry class - Registry for all Aideon APIs
 */
class ApiRegistry {
  /**
   * Create a new ApiRegistry instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.apis = new Map();
    this.logger = new Logger('ApiRegistry');
    this.events = new EventEmitter();
    this.initialized = false;
  }

  /**
   * Initialize the API registry
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('ApiRegistry already initialized');
      return true;
    }

    this.logger.info('Initializing ApiRegistry');
    this.initialized = true;
    return true;
  }

  /**
   * Register an API endpoint
   * @param {string} path - API path
   * @param {Function} handler - API handler function
   * @param {Object} options - API options
   * @returns {boolean} - True if registration was successful
   */
  register(path, handler, options = {}) {
    if (this.apis.has(path)) {
      this.logger.warn(`API endpoint ${path} already registered`);
      return false;
    }

    this.logger.info(`Registering API endpoint: ${path}`);
    this.apis.set(path, { handler, options });
    this.events.emit('api:registered', { path, options });
    return true;
  }

  /**
   * Get an API handler by path
   * @param {string} path - API path
   * @returns {Function|null} - API handler function or null if not found
   */
  getHandler(path) {
    const api = this.apis.get(path);
    return api ? api.handler : null;
  }

  /**
   * Get the status of the API registry
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      apiCount: this.apis.size,
      paths: Array.from(this.apis.keys())
    };
  }

  /**
   * Shutdown the API registry
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('ApiRegistry not initialized');
      return true;
    }

    this.logger.info('Shutting down ApiRegistry');
    this.apis.clear();
    this.initialized = false;
    return true;
  }
}

module.exports = { ApiRegistry };
