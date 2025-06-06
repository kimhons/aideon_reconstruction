/**
 * @fileoverview TentacleRegistry Connector for the Aideon Tentacle Marketplace
 * 
 * This module provides integration between the marketplace and the core TentacleRegistry,
 * allowing marketplace tentacles to be registered and managed by the core system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');

/**
 * TentacleRegistryConnector class - Connects marketplace tentacles to the core TentacleRegistry
 */
class TentacleRegistryConnector {
  /**
   * Create a new TentacleRegistryConnector instance
   * @param {Object} options - Configuration options
   * @param {Object} options.tentacleRegistry - Reference to the core TentacleRegistry
   * @param {Object} options.localRepositoryManager - Reference to the LocalRepositoryManager
   */
  constructor(options = {}) {
    this.options = options;
    this.tentacleRegistry = options.tentacleRegistry;
    this.localRepositoryManager = options.localRepositoryManager;
    this.logger = new Logger('TentacleRegistryConnector');
    this.events = new EventEmitter();
    this.registeredTentacles = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the TentacleRegistry connector
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('TentacleRegistryConnector already initialized');
      return true;
    }

    this.logger.info('Initializing TentacleRegistryConnector');
    
    if (!this.tentacleRegistry) {
      throw new Error('TentacleRegistry reference is required');
    }
    
    if (!this.localRepositoryManager) {
      throw new Error('LocalRepositoryManager reference is required');
    }
    
    // Subscribe to local repository events
    this.localRepositoryManager.events.on('tentacle:installed', this.handleTentacleInstalled.bind(this));
    this.localRepositoryManager.events.on('tentacle:uninstalled', this.handleTentacleUninstalled.bind(this));
    
    // Load previously registered tentacles
    await this.loadRegisteredTentacles();
    
    this.initialized = true;
    this.logger.info('TentacleRegistryConnector initialized successfully');
    return true;
  }

  /**
   * Load previously registered tentacles
   * @returns {Promise<void>}
   * @private
   */
  async loadRegisteredTentacles() {
    try {
      // Get all installed tentacles
      const installedTentacles = this.localRepositoryManager.getAllInstalledTentacles();
      
      for (const tentacle of installedTentacles) {
        // Check if tentacle is already registered with the core
        const registered = await this.checkTentacleRegistration(tentacle.id);
        
        if (registered) {
          this.registeredTentacles.set(tentacle.id, {
            id: tentacle.id,
            registeredAt: new Date().toISOString(),
            tentacleInfo: tentacle
          });
        }
      }
      
      this.logger.info(`Loaded ${this.registeredTentacles.size} registered tentacles`);
    } catch (error) {
      this.logger.error('Failed to load registered tentacles', error);
      throw error;
    }
  }

  /**
   * Check if a tentacle is registered with the core TentacleRegistry
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if tentacle is registered
   * @private
   */
  async checkTentacleRegistration(tentacleId) {
    try {
      const tentacle = this.tentacleRegistry.getTentacle(tentacleId);
      return !!tentacle;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle tentacle installed event
   * @param {Object} event - Event data
   * @private
   */
  async handleTentacleInstalled(event) {
    try {
      const { tentacle } = event;
      
      // Register the tentacle with the core
      await this.registerTentacle(tentacle.id);
    } catch (error) {
      this.logger.error('Failed to handle tentacle installed event', error);
    }
  }

  /**
   * Handle tentacle uninstalled event
   * @param {Object} event - Event data
   * @private
   */
  async handleTentacleUninstalled(event) {
    try {
      const { tentacle } = event;
      
      // Unregister the tentacle from the core
      await this.unregisterTentacle(tentacle.id);
    } catch (error) {
      this.logger.error('Failed to handle tentacle uninstalled event', error);
    }
  }

  /**
   * Register a marketplace tentacle with the core TentacleRegistry
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to the registered tentacle info
   */
  async registerTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error('TentacleRegistryConnector not initialized');
    }
    
    this.logger.info(`Registering tentacle with core: ${tentacleId}`);
    
    // Get the installed tentacle
    const installedTentacle = this.localRepositoryManager.getInstalledTentacle(tentacleId);
    
    if (!installedTentacle) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    // Check if already registered
    if (this.registeredTentacles.has(tentacleId)) {
      this.logger.warn(`Tentacle ${tentacleId} is already registered with the core`);
      return this.registeredTentacles.get(tentacleId);
    }
    
    try {
      // Get the tentacle package
      const packageData = await this.localRepositoryManager.getTentaclePackage(tentacleId);
      
      // Extract the package to a temporary directory
      const tempDir = path.join(this.localRepositoryManager.storagePath, '_temp', tentacleId);
      await fs.mkdir(tempDir, { recursive: true });
      
      const zip = new AdmZip(packageData);
      zip.extractAllTo(tempDir, true);
      
      // Load the tentacle module
      const tentacleModule = require(path.join(tempDir, 'index.js'));
      
      // Create an instance of the tentacle
      const TentacleClass = tentacleModule[installedTentacle.metadata.mainClass];
      
      if (!TentacleClass) {
        throw new Error(`Main class ${installedTentacle.metadata.mainClass} not found in tentacle module`);
      }
      
      const tentacleInstance = new TentacleClass(installedTentacle.metadata.options || {});
      
      // Register the tentacle with the core
      await this.tentacleRegistry.registerTentacle(tentacleId, tentacleInstance);
      
      // Store registration info
      const registrationInfo = {
        id: tentacleId,
        registeredAt: new Date().toISOString(),
        tentacleInfo: installedTentacle,
        tempDir
      };
      
      this.registeredTentacles.set(tentacleId, registrationInfo);
      
      // Emit event
      this.events.emit('tentacle:registered', { tentacle: registrationInfo });
      
      return registrationInfo;
    } catch (error) {
      this.logger.error(`Failed to register tentacle ${tentacleId} with core`, error);
      throw error;
    }
  }

  /**
   * Unregister a marketplace tentacle from the core TentacleRegistry
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if unregistration was successful
   */
  async unregisterTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error('TentacleRegistryConnector not initialized');
    }
    
    this.logger.info(`Unregistering tentacle from core: ${tentacleId}`);
    
    // Check if registered
    if (!this.registeredTentacles.has(tentacleId)) {
      this.logger.warn(`Tentacle ${tentacleId} is not registered with the core`);
      return true;
    }
    
    try {
      const registrationInfo = this.registeredTentacles.get(tentacleId);
      
      // Get the tentacle from the core
      const tentacle = this.tentacleRegistry.getTentacle(tentacleId);
      
      if (tentacle) {
        // Shutdown the tentacle
        if (tentacle.initialized && typeof tentacle.shutdown === 'function') {
          await tentacle.shutdown();
        }
        
        // Unregister from the core
        await this.tentacleRegistry.unregisterTentacle(tentacleId);
      }
      
      // Clean up temporary directory
      if (registrationInfo.tempDir) {
        try {
          await fs.rm(registrationInfo.tempDir, { recursive: true, force: true });
        } catch (error) {
          this.logger.error(`Failed to remove temporary directory: ${registrationInfo.tempDir}`, error);
        }
      }
      
      // Remove from registered tentacles
      this.registeredTentacles.delete(tentacleId);
      
      // Emit event
      this.events.emit('tentacle:unregistered', { tentacle: registrationInfo });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister tentacle ${tentacleId} from core`, error);
      throw error;
    }
  }

  /**
   * Get a registered tentacle by ID
   * @param {string} tentacleId - Tentacle ID
   * @returns {Object|null} - Registered tentacle info or null if not found
   */
  getRegisteredTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error('TentacleRegistryConnector not initialized');
    }
    
    return this.registeredTentacles.get(tentacleId) || null;
  }

  /**
   * Get all registered tentacles
   * @returns {Array<Object>} - Array of registered tentacle info
   */
  getAllRegisteredTentacles() {
    if (!this.initialized) {
      throw new Error('TentacleRegistryConnector not initialized');
    }
    
    return Array.from(this.registeredTentacles.values());
  }

  /**
   * Get the status of the TentacleRegistry connector
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      tentacleCount: this.registeredTentacles.size
    };
  }

  /**
   * Shutdown the TentacleRegistry connector
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('TentacleRegistryConnector not initialized');
      return true;
    }

    this.logger.info('Shutting down TentacleRegistryConnector');
    
    try {
      // Unregister all tentacles
      const tentacleIds = Array.from(this.registeredTentacles.keys());
      
      for (const id of tentacleIds) {
        try {
          await this.unregisterTentacle(id);
        } catch (error) {
          this.logger.error(`Failed to unregister tentacle ${id} during shutdown`, error);
        }
      }
      
      // Unsubscribe from events
      this.localRepositoryManager.events.removeAllListeners();
      
      this.initialized = false;
      this.logger.info('TentacleRegistryConnector shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown TentacleRegistryConnector', error);
      return false;
    }
  }
}

module.exports = { TentacleRegistryConnector };
