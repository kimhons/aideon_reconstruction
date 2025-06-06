/**
 * @fileoverview TentacleRegistry - Registry for all Aideon tentacles
 * 
 * This module provides a registry for all tentacles in the Aideon system.
 * It handles loading, initialization, and management of tentacles.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../logging/Logger');
const { EventEmitter } = require('../events/EventEmitter');
const { TentacleBase } = require('./TentacleBase');
const path = require('path');
const fs = require('fs');

/**
 * TentacleRegistry class - Registry for all Aideon tentacles
 */
class TentacleRegistry {
  /**
   * Create a new TentacleRegistry instance
   * @param {Object} options - Configuration options
   * @param {Object} options.aideon - Reference to the Aideon system
   * @param {Object} options.api - Reference to the API registry
   */
  constructor(options = {}) {
    this.aideon = options.aideon || null;
    this.api = options.api || null;
    this.tentacles = new Map();
    this.logger = new Logger('TentacleRegistry');
    this.events = new EventEmitter();
    this.initialized = false;
  }

  /**
   * Initialize the tentacle registry
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('TentacleRegistry already initialized');
      return true;
    }

    this.logger.info('Initializing TentacleRegistry');
    
    try {
      // Load built-in tentacles
      await this.loadBuiltInTentacles();
      
      // Load any additional tentacles from configuration
      // This could be extended to load from a config file or environment variables
      
      this.initialized = true;
      this.logger.info('TentacleRegistry initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize TentacleRegistry', error);
      return false;
    }
  }

  /**
   * Load built-in tentacles
   * @returns {Promise<void>}
   * @private
   */
  async loadBuiltInTentacles() {
    this.logger.info('Loading built-in tentacles');
    
    // Load DevMaster Tentacle
    try {
      const { DevMasterTentacle } = require('../../tentacles/devmaster');
      await this.registerTentacle('devmaster', new DevMasterTentacle());
      this.logger.info('DevMaster Tentacle loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load DevMaster Tentacle', error);
    }
    
    // Load Contextual Intelligence Tentacle
    try {
      const { ContextualIntelligenceTentacle } = require('../../tentacles/contextual_intelligence');
      await this.registerTentacle('contextual_intelligence', new ContextualIntelligenceTentacle());
      this.logger.info('Contextual Intelligence Tentacle loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load Contextual Intelligence Tentacle', error);
    }
  }

  /**
   * Register a tentacle with the registry
   * @param {string} id - Tentacle ID
   * @param {TentacleBase} tentacle - Tentacle instance
   * @returns {Promise<boolean>} - Promise resolving to true if registration was successful
   */
  async registerTentacle(id, tentacle) {
    if (!(tentacle instanceof TentacleBase)) {
      this.logger.error(`Tentacle ${id} is not an instance of TentacleBase`);
      return false;
    }

    if (this.tentacles.has(id)) {
      this.logger.warn(`Tentacle ${id} already registered`);
      return false;
    }

    this.logger.info(`Registering tentacle: ${id}`);
    
    // Register the tentacle with the Aideon system and API registry
    tentacle.register(this.aideon, this.api);
    
    // Initialize the tentacle
    try {
      await tentacle.initialize();
      this.tentacles.set(id, tentacle);
      this.events.emit('tentacle:registered', { id, tentacle });
      this.logger.info(`Tentacle ${id} registered and initialized successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize tentacle ${id}`, error);
      return false;
    }
  }

  /**
   * Get a tentacle by ID
   * @param {string} id - Tentacle ID
   * @returns {TentacleBase|null} - Tentacle instance or null if not found
   */
  getTentacle(id) {
    return this.tentacles.get(id) || null;
  }

  /**
   * Get all registered tentacles
   * @returns {Map<string, TentacleBase>} - Map of tentacle ID to tentacle instance
   */
  getAllTentacles() {
    return this.tentacles;
  }

  /**
   * Get the status of all tentacles
   * @returns {Object} - Status object with tentacle ID as key and status as value
   */
  getStatus() {
    const status = {};
    
    for (const [id, tentacle] of this.tentacles.entries()) {
      status[id] = tentacle.getStatus();
    }
    
    return {
      initialized: this.initialized,
      tentacleCount: this.tentacles.size,
      tentacles: status
    };
  }

  /**
   * Shutdown the tentacle registry and all registered tentacles
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('TentacleRegistry not initialized');
      return true;
    }

    this.logger.info('Shutting down TentacleRegistry');
    
    const shutdownPromises = [];
    
    // Shutdown all tentacles
    for (const [id, tentacle] of this.tentacles.entries()) {
      this.logger.info(`Shutting down tentacle: ${id}`);
      shutdownPromises.push(
        tentacle.shutdown()
          .catch(error => {
            this.logger.error(`Failed to shutdown tentacle ${id}`, error);
            return false;
          })
      );
    }
    
    // Wait for all tentacles to shutdown
    const results = await Promise.all(shutdownPromises);
    const allSuccessful = results.every(result => result !== false);
    
    if (allSuccessful) {
      this.tentacles.clear();
      this.initialized = false;
      this.logger.info('TentacleRegistry shutdown successfully');
      return true;
    } else {
      this.logger.error('Some tentacles failed to shutdown');
      return false;
    }
  }
}

module.exports = { TentacleRegistry };
