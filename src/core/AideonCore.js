/**
 * @fileoverview Aideon Core - Main entry point for the Aideon system
 * 
 * This module provides the main entry point for the Aideon system.
 * It initializes all core components and tentacles.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('./logging/Logger');
const { EventEmitter } = require('./events/EventEmitter');
const { TentacleRegistry } = require('./tentacles/TentacleRegistry');
const { ApiRegistry } = require('./api/ApiRegistry');

/**
 * AideonCore class - Main entry point for the Aideon system
 */
class AideonCore {
  /**
   * Create a new AideonCore instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.logger = new Logger('AideonCore');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Core components
    this.api = new ApiRegistry();
    this.tentacles = new TentacleRegistry({
      aideon: this,
      api: this.api
    });
  }

  /**
   * Initialize the Aideon system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('AideonCore already initialized');
      return true;
    }

    this.logger.info('Initializing AideonCore');
    
    try {
      // Initialize API registry
      await this.api.initialize();
      
      // Initialize tentacle registry
      await this.tentacles.initialize();
      
      this.initialized = true;
      this.logger.info('AideonCore initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize AideonCore', error);
      return false;
    }
  }

  /**
   * Get the status of the Aideon system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      api: this.api.getStatus(),
      tentacles: this.tentacles.getStatus()
    };
  }

  /**
   * Shutdown the Aideon system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('AideonCore not initialized');
      return true;
    }

    this.logger.info('Shutting down AideonCore');
    
    try {
      // Shutdown tentacle registry
      await this.tentacles.shutdown();
      
      // Shutdown API registry
      await this.api.shutdown();
      
      this.initialized = false;
      this.logger.info('AideonCore shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown AideonCore', error);
      return false;
    }
  }

  /**
   * Get a tentacle by ID
   * @param {string} id - Tentacle ID
   * @returns {Object|null} - Tentacle instance or null if not found
   */
  getTentacle(id) {
    return this.tentacles.getTentacle(id);
  }

  /**
   * Get all registered tentacles
   * @returns {Map<string, Object>} - Map of tentacle ID to tentacle instance
   */
  getAllTentacles() {
    return this.tentacles.getAllTentacles();
  }
}

module.exports = { AideonCore };
