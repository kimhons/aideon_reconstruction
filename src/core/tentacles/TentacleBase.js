/**
 * @fileoverview TentacleBase - Base class for all tentacles
 * 
 * This module provides the base class for all Aideon tentacles.
 */

const { EventEmitter } = require('../events/EventEmitter');
const { Logger } = require('../logging/Logger');

/**
 * TentacleBase class - Base class for all tentacles
 */
class TentacleBase {
  /**
   * Create a new TentacleBase instance
   * @param {Object} options - Configuration options
   * @param {string} options.id - Tentacle ID
   * @param {string} options.name - Tentacle name
   * @param {string} options.description - Tentacle description
   * @param {string} options.version - Tentacle version
   */
  constructor(options = {}) {
    this.id = options.id || 'unknown';
    this.name = options.name || 'Unknown Tentacle';
    this.description = options.description || 'No description provided';
    this.version = options.version || '0.0.1';
    this.initialized = false;
    this.aideon = null;
    this.api = null;
    this.logger = new Logger(`Tentacle:${this.id}`);
    this.events = new EventEmitter();
  }

  /**
   * Initialize the tentacle
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method not implemented: initialize()');
  }

  /**
   * Get the status of the tentacle
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      initialized: this.initialized
    };
  }

  /**
   * Shutdown the tentacle
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error('Method not implemented: shutdown()');
  }

  /**
   * Register the tentacle with the Aideon system
   * @param {Object} aideon - Aideon system reference
   * @param {Object} api - API registry reference
   */
  register(aideon, api) {
    this.aideon = aideon;
    this.api = api;
  }
}

module.exports = { TentacleBase };
