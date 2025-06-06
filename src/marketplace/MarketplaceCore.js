/**
 * @fileoverview Marketplace Core - Main entry point for the Aideon Tentacle Marketplace
 * 
 * This module provides the main entry point for the Aideon Tentacle Marketplace,
 * integrating all marketplace components and providing a unified API.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../core/logging/Logger');
const { EventEmitter } = require('../../core/events/EventEmitter');
const { RegistryService } = require('./core/registry/RegistryService');
const { LocalRepositoryManager } = require('./integration/repository/LocalRepositoryManager');
const { TentacleRegistryConnector } = require('./integration/connector/TentacleRegistryConnector');
const { MarketplaceBrowser } = require('./ui/browser/MarketplaceBrowser');
const { InstallationManager } = require('./ui/installation/InstallationManager');
const path = require('path');

/**
 * MarketplaceCore class - Main entry point for the Aideon Tentacle Marketplace
 */
class MarketplaceCore {
  /**
   * Create a new MarketplaceCore instance
   * @param {Object} options - Configuration options
   * @param {Object} options.tentacleRegistry - Reference to the core TentacleRegistry
   * @param {string} options.storagePath - Path to store marketplace data
   * @param {number} options.maxStorageSize - Maximum storage size in bytes
   */
  constructor(options = {}) {
    this.options = options;
    this.tentacleRegistry = options.tentacleRegistry;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'marketplace');
    this.maxStorageSize = options.maxStorageSize || 1024 * 1024 * 1024; // 1GB default
    this.logger = new Logger('MarketplaceCore');
    this.events = new EventEmitter();
    this.components = {};
    this.initialized = false;
  }

  /**
   * Initialize the marketplace core
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('MarketplaceCore already initialized');
      return true;
    }

    this.logger.info('Initializing MarketplaceCore');
    
    if (!this.tentacleRegistry) {
      throw new Error('TentacleRegistry reference is required');
    }
    
    try {
      // Initialize registry service
      this.components.registryService = new RegistryService({
        storagePath: path.join(this.storagePath, 'registry')
      });
      await this.components.registryService.initialize();
      
      // Initialize local repository manager
      this.components.localRepositoryManager = new LocalRepositoryManager({
        storagePath: path.join(this.storagePath, 'repository'),
        maxStorageSize: this.maxStorageSize
      });
      await this.components.localRepositoryManager.initialize();
      
      // Initialize tentacle registry connector
      this.components.tentacleRegistryConnector = new TentacleRegistryConnector({
        tentacleRegistry: this.tentacleRegistry,
        localRepositoryManager: this.components.localRepositoryManager
      });
      await this.components.tentacleRegistryConnector.initialize();
      
      // Initialize installation manager
      this.components.installationManager = new InstallationManager({
        registryService: this.components.registryService,
        localRepositoryManager: this.components.localRepositoryManager,
        tentacleRegistryConnector: this.components.tentacleRegistryConnector
      });
      await this.components.installationManager.initialize();
      
      // Initialize marketplace browser
      this.components.marketplaceBrowser = new MarketplaceBrowser({
        registryService: this.components.registryService,
        installationManager: this.components.installationManager
      });
      await this.components.marketplaceBrowser.initialize();
      
      // Set up event forwarding
      this.setupEventForwarding();
      
      this.initialized = true;
      this.logger.info('MarketplaceCore initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MarketplaceCore', error);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Set up event forwarding from components to marketplace core
   * @private
   */
  setupEventForwarding() {
    // Forward events from registry service
    this.components.registryService.events.on('tentacle:registered', event => {
      this.events.emit('registry:tentacle:registered', event);
    });
    
    this.components.registryService.events.on('tentacle:updated', event => {
      this.events.emit('registry:tentacle:updated', event);
    });
    
    this.components.registryService.events.on('tentacle:deleted', event => {
      this.events.emit('registry:tentacle:deleted', event);
    });
    
    // Forward events from local repository manager
    this.components.localRepositoryManager.events.on('tentacle:installed', event => {
      this.events.emit('repository:tentacle:installed', event);
    });
    
    this.components.localRepositoryManager.events.on('tentacle:uninstalled', event => {
      this.events.emit('repository:tentacle:uninstalled', event);
    });
    
    // Forward events from tentacle registry connector
    this.components.tentacleRegistryConnector.events.on('tentacle:registered', event => {
      this.events.emit('connector:tentacle:registered', event);
    });
    
    this.components.tentacleRegistryConnector.events.on('tentacle:unregistered', event => {
      this.events.emit('connector:tentacle:unregistered', event);
    });
    
    // Forward events from installation manager
    this.components.installationManager.events.on('tentacle:installed', event => {
      this.events.emit('installation:tentacle:installed', event);
    });
    
    this.components.installationManager.events.on('tentacle:uninstalled', event => {
      this.events.emit('installation:tentacle:uninstalled', event);
    });
    
    this.components.installationManager.events.on('tentacle:updated', event => {
      this.events.emit('installation:tentacle:updated', event);
    });
  }

  /**
   * Get the registry service
   * @returns {RegistryService} - Registry service instance
   */
  getRegistryService() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    return this.components.registryService;
  }

  /**
   * Get the local repository manager
   * @returns {LocalRepositoryManager} - Local repository manager instance
   */
  getLocalRepositoryManager() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    return this.components.localRepositoryManager;
  }

  /**
   * Get the tentacle registry connector
   * @returns {TentacleRegistryConnector} - Tentacle registry connector instance
   */
  getTentacleRegistryConnector() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    return this.components.tentacleRegistryConnector;
  }

  /**
   * Get the marketplace browser
   * @returns {MarketplaceBrowser} - Marketplace browser instance
   */
  getMarketplaceBrowser() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    return this.components.marketplaceBrowser;
  }

  /**
   * Get the installation manager
   * @returns {InstallationManager} - Installation manager instance
   */
  getInstallationManager() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    return this.components.installationManager;
  }

  /**
   * Browse the marketplace
   * @returns {Object} - Marketplace browser API
   */
  browse() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    const browser = this.components.marketplaceBrowser;
    
    return {
      /**
       * Get featured tentacles
       * @param {number} limit - Maximum number of tentacles to return
       * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
       */
      getFeatured: (limit = 10) => browser.getFeaturedTentacles(limit),
      
      /**
       * Get trending tentacles
       * @param {number} limit - Maximum number of tentacles to return
       * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
       */
      getTrending: (limit = 10) => browser.getTrendingTentacles(limit),
      
      /**
       * Get newest tentacles
       * @param {number} limit - Maximum number of tentacles to return
       * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
       */
      getNewest: (limit = 10) => browser.getNewestTentacles(limit),
      
      /**
       * Get tentacles by category
       * @param {string} category - Category name
       * @param {number} limit - Maximum number of tentacles to return
       * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
       */
      getByCategory: (category, limit = 50) => browser.getTentaclesByCategory(category, limit),
      
      /**
       * Search for tentacles
       * @param {string} query - Search query
       * @param {Object} options - Search options
       * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
       */
      search: (query, options = {}) => browser.searchTentacles(query, options),
      
      /**
       * Get tentacle details
       * @param {string} tentacleId - Tentacle ID
       * @returns {Promise<Object>} - Promise resolving to tentacle details
       */
      getTentacleDetails: (tentacleId) => browser.getTentacleDetails(tentacleId),
      
      /**
       * Get available categories
       * @returns {Array<string>} - Array of category names
       */
      getCategories: () => browser.getCategories()
    };
  }

  /**
   * Manage tentacle installations
   * @returns {Object} - Installation manager API
   */
  manage() {
    if (!this.initialized) {
      throw new Error('MarketplaceCore not initialized');
    }
    
    const manager = this.components.installationManager;
    
    return {
      /**
       * Install a tentacle from the marketplace
       * @param {string} tentacleId - Tentacle ID
       * @param {Object} options - Installation options
       * @returns {Promise<Object>} - Promise resolving to installation status
       */
      install: (tentacleId, options = {}) => manager.installTentacle(tentacleId, options),
      
      /**
       * Uninstall a tentacle
       * @param {string} tentacleId - Tentacle ID
       * @param {Object} options - Uninstallation options
       * @returns {Promise<Object>} - Promise resolving to uninstallation status
       */
      uninstall: (tentacleId, options = {}) => manager.uninstallTentacle(tentacleId, options),
      
      /**
       * Update a tentacle
       * @param {string} tentacleId - Tentacle ID
       * @param {Object} options - Update options
       * @returns {Promise<Object>} - Promise resolving to update status
       */
      update: (tentacleId, options = {}) => manager.updateTentacle(tentacleId, options),
      
      /**
       * Check if a tentacle is installed
       * @param {string} tentacleId - Tentacle ID
       * @returns {Promise<boolean>} - Promise resolving to true if tentacle is installed
       */
      isInstalled: (tentacleId) => manager.isTentacleInstalled(tentacleId),
      
      /**
       * Get installation status
       * @param {string} tentacleId - Tentacle ID
       * @returns {Promise<Object>} - Promise resolving to installation status
       */
      getStatus: (tentacleId) => manager.getInstallationStatus(tentacleId)
    };
  }

  /**
   * Get the status of the marketplace core
   * @returns {Promise<Object>} - Promise resolving to status object
   */
  async getStatus() {
    const status = {
      initialized: this.initialized,
      components: {}
    };
    
    if (this.initialized) {
      status.components.registryService = this.components.registryService.getStatus();
      status.components.localRepositoryManager = await this.components.localRepositoryManager.getStatus();
      status.components.tentacleRegistryConnector = this.components.tentacleRegistryConnector.getStatus();
      status.components.marketplaceBrowser = this.components.marketplaceBrowser.getStatus();
      status.components.installationManager = this.components.installationManager.getStatus();
    }
    
    return status;
  }

  /**
   * Shutdown the marketplace core
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('MarketplaceCore not initialized');
      return true;
    }

    this.logger.info('Shutting down MarketplaceCore');
    
    try {
      // Shutdown components in reverse order of initialization
      if (this.components.marketplaceBrowser) {
        await this.components.marketplaceBrowser.shutdown();
      }
      
      if (this.components.installationManager) {
        await this.components.installationManager.shutdown();
      }
      
      if (this.components.tentacleRegistryConnector) {
        await this.components.tentacleRegistryConnector.shutdown();
      }
      
      if (this.components.localRepositoryManager) {
        await this.components.localRepositoryManager.shutdown();
      }
      
      if (this.components.registryService) {
        await this.components.registryService.shutdown();
      }
      
      this.initialized = false;
      this.logger.info('MarketplaceCore shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown MarketplaceCore', error);
      return false;
    }
  }
}

module.exports = { MarketplaceCore };
