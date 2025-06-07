/**
 * @fileoverview Mock MarketplaceCore for testing
 */

const { EventEmitter } = require('../../src/core/events/EventEmitter');

class MarketplaceCore {
  constructor(options = {}) {
    this.options = options;
    this.events = new EventEmitter();
    this.components = {
      registryService: {
        events: new EventEmitter()
      },
      localRepositoryManager: {
        events: new EventEmitter()
      },
      tentacleRegistryConnector: {
        events: new EventEmitter()
      },
      marketplaceBrowser: {
        events: new EventEmitter()
      },
      installationManager: {
        events: new EventEmitter()
      }
    };
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

  browse() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    return {
      search: jest.fn().mockResolvedValue([]),
      getTentacleDetails: jest.fn().mockResolvedValue({}),
      getCategories: jest.fn().mockResolvedValue([]),
      getFeatured: jest.fn().mockResolvedValue([])
    };
  }

  manage() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    return {
      install: jest.fn().mockResolvedValue({ success: true }),
      uninstall: jest.fn().mockResolvedValue({ success: true }),
      update: jest.fn().mockResolvedValue({ success: true }),
      getInstalled: jest.fn().mockResolvedValue([]),
      isInstalled: jest.fn().mockResolvedValue(false),
      getStatus: jest.fn().mockResolvedValue({})
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      components: {
        registryService: { initialized: true },
        localRepositoryManager: { initialized: true },
        tentacleRegistryConnector: { initialized: true },
        marketplaceBrowser: { initialized: true },
        installationManager: { initialized: true }
      }
    };
  }
}

module.exports = { MarketplaceCore };
