/**
 * @fileoverview Mock TentacleRegistry for testing
 */

const { EventEmitter } = require('../../src/core/events/EventEmitter');

class TentacleRegistry {
  constructor(options = {}) {
    this.options = options;
    this.events = new EventEmitter();
    this.tentacles = new Map();
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async shutdown() {
    this.initialized = false;
    return true;
  }

  async registerTentacle(tentacle) {
    if (!this.initialized) {
      throw new Error('TentacleRegistry not initialized');
    }
    this.tentacles.set(tentacle.id, tentacle);
    this.events.emit('tentacle:registered', { tentacle });
    return { success: true, tentacleId: tentacle.id };
  }

  async unregisterTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error('TentacleRegistry not initialized');
    }
    const exists = this.tentacles.has(tentacleId);
    this.tentacles.delete(tentacleId);
    if (exists) {
      this.events.emit('tentacle:unregistered', { tentacleId });
    }
    return { success: true, tentacleId };
  }

  async getTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error('TentacleRegistry not initialized');
    }
    return this.tentacles.get(tentacleId) || null;
  }

  async getAllTentacles() {
    if (!this.initialized) {
      throw new Error('TentacleRegistry not initialized');
    }
    return Array.from(this.tentacles.values());
  }

  getStatus() {
    return {
      initialized: this.initialized,
      tentacleCount: this.tentacles.size
    };
  }
}

module.exports = { TentacleRegistry };
