/**
 * @fileoverview InstallationManager component with dependency injection support
 * This component handles the installation, update, and removal of tentacles
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies with support for dependency injection in tests
let Logger;
let EventEmitter;

// Use try-catch to support both direct imports and mocked imports
try {
  const LoggerModule = require('../../../../core/logging/Logger');
  const EventEmitterModule = require('../../../../core/events/EventEmitter');
  
  Logger = LoggerModule.Logger;
  EventEmitter = EventEmitterModule.EventEmitter;
} catch (error) {
  // In test environment, these will be mocked
  Logger = require('../../../../test/mocks/Logger').Logger;
  EventEmitter = require('../../../../test/mocks/EventEmitter').EventEmitter;
}

/**
 * InstallationManager class - Handles installation, update, and removal of tentacles
 */
class InstallationManager {
  /**
   * Create a new InstallationManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.marketplaceCore - Reference to the MarketplaceCore
   * @param {Object} options.tentacleRegistry - Reference to the TentacleRegistry
   * @param {Object} options.config - Installation configuration settings
   */
  constructor(options = {}) {
    this.options = options;
    this.marketplaceCore = options.marketplaceCore;
    this.tentacleRegistry = options.tentacleRegistry;
    this.config = options.config || {};
    this.logger = new Logger("InstallationManager");
    this.events = new EventEmitter();
    this.installationQueue = [];
    this.updateQueue = [];
    this.installedTentacles = new Map();
    this.state = {
      isProcessing: false,
      currentOperation: null,
      error: null
    };
    this.initialized = false;

    this.logger.info("InstallationManager instance created");
  }

  /**
   * Initialize the InstallationManager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("InstallationManager already initialized");
      return true;
    }

    this.logger.info("Initializing InstallationManager");

    try {
      // Validate dependencies
      if (!this.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }

      if (!this.tentacleRegistry) {
        throw new Error("TentacleRegistry reference is required");
      }

      // Initialize marketplace core if not already initialized
      if (!this.marketplaceCore.initialized) {
        await this.marketplaceCore.initialize();
      }

      // Initialize tentacle registry if not already initialized
      if (!this.tentacleRegistry.initialized) {
        await this.tentacleRegistry.initialize();
      }

      // Load installed tentacles
      await this._loadInstalledTentacles();

      // Set up event listeners
      this._setupEventListeners();

      this.initialized = true;
      this.logger.info("InstallationManager initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize InstallationManager", error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Load installed tentacles
   * @private
   */
  async _loadInstalledTentacles() {
    this.logger.info("Loading installed tentacles");

    try {
      // In a real implementation, this would call the marketplace core API
      // For this mock implementation, we'll set up some sample installed tentacles
      this.installedTentacles.set('contextual-intelligence', {
        id: 'contextual-intelligence',
        name: 'Contextual Intelligence',
        version: '1.0.0',
        installDate: '2025-05-15',
        status: 'active',
        path: '/tentacles/contextual-intelligence'
      });

      this.installedTentacles.set('data-wizard', {
        id: 'data-wizard',
        name: 'Data Wizard',
        version: '1.0.0',
        installDate: '2025-05-10',
        status: 'active',
        path: '/tentacles/data-wizard'
      });

      this.logger.info(`Loaded ${this.installedTentacles.size} installed tentacles`);
    } catch (error) {
      this.logger.error("Failed to load installed tentacles", error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    this.logger.info("Setting up event listeners");

    // Listen for marketplace core events
    if (this.marketplaceCore && this.marketplaceCore.events) {
      this.marketplaceCore.events.on("tentacle:updated", this._handleTentacleUpdated.bind(this));
    }

    // Listen for tentacle registry events
    if (this.tentacleRegistry && this.tentacleRegistry.events) {
      this.tentacleRegistry.events.on("tentacle:registered", this._handleTentacleRegistered.bind(this));
      this.tentacleRegistry.events.on("tentacle:unregistered", this._handleTentacleUnregistered.bind(this));
    }

    this.logger.info("Event listeners set up");
  }

  /**
   * Handle tentacle updated event
   * @param {Object} event - Tentacle updated event
   * @private
   */
  _handleTentacleUpdated(event) {
    const { tentacleId, version } = event;
    this.logger.info(`Tentacle updated: ${tentacleId} to version ${version}`);

    // Update installed tentacle version
    const tentacle = this.installedTentacles.get(tentacleId);
    if (tentacle) {
      tentacle.version = version;
      tentacle.updateDate = new Date().toISOString().split('T')[0];
      this.installedTentacles.set(tentacleId, tentacle);

      // Emit tentacle updated event
      this.events.emit('tentacle:updated', {
        tentacleId,
        version
      });
    }
  }

  /**
   * Handle tentacle registered event
   * @param {Object} event - Tentacle registered event
   * @private
   */
  _handleTentacleRegistered(event) {
    const { tentacle } = event;
    this.logger.info(`Tentacle registered: ${tentacle.id}`);

    // Check if tentacle is installed
    if (this.installedTentacles.has(tentacle.id)) {
      // Update installed tentacle status
      const installedTentacle = this.installedTentacles.get(tentacle.id);
      installedTentacle.status = 'active';
      this.installedTentacles.set(tentacle.id, installedTentacle);

      // Emit tentacle activated event
      this.events.emit('tentacle:activated', {
        tentacleId: tentacle.id
      });
    }
  }

  /**
   * Handle tentacle unregistered event
   * @param {Object} event - Tentacle unregistered event
   * @private
   */
  _handleTentacleUnregistered(event) {
    const { tentacleId } = event;
    this.logger.info(`Tentacle unregistered: ${tentacleId}`);

    // Check if tentacle is installed
    if (this.installedTentacles.has(tentacleId)) {
      // Update installed tentacle status
      const installedTentacle = this.installedTentacles.get(tentacleId);
      installedTentacle.status = 'inactive';
      this.installedTentacles.set(tentacleId, installedTentacle);

      // Emit tentacle deactivated event
      this.events.emit('tentacle:deactivated', {
        tentacleId
      });
    }
  }

  /**
   * Install tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to installation result
   */
  async installTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error("InstallationManager not initialized");
    }

    this.logger.info(`Queueing installation for tentacle: ${tentacleId}`);

    // Check if tentacle is already installed
    if (this.installedTentacles.has(tentacleId)) {
      this.logger.warn(`Tentacle already installed: ${tentacleId}`);
      return {
        success: true,
        tentacleId,
        message: 'Tentacle already installed'
      };
    }

    // Check if tentacle is already in queue
    const existingQueueItem = this.installationQueue.find(item => item.tentacleId === tentacleId);
    if (existingQueueItem) {
      this.logger.warn(`Tentacle already in installation queue: ${tentacleId}`);
      return new Promise((resolve, reject) => {
        existingQueueItem.resolve = resolve;
        existingQueueItem.reject = reject;
      });
    }

    // Create a new promise for this installation
    return new Promise((resolve, reject) => {
      // Add to installation queue
      this.installationQueue.push({
        tentacleId,
        resolve,
        reject
      });

      // Emit tentacle installation queued event
      this.events.emit('installation:queued', {
        tentacleId
      });

      // Process queue if not already processing
      if (!this.state.isProcessing) {
        this._processNextInQueue();
      }
    });
  }

  /**
   * Process next item in installation queue
   * @private
   */
  async _processNextInQueue() {
    if (this.installationQueue.length === 0) {
      this.logger.info("Installation queue empty");
      this.state.isProcessing = false;
      this.state.currentOperation = null;
      return;
    }

    this.state.isProcessing = true;
    const queueItem = this.installationQueue.shift();
    const { tentacleId, resolve, reject } = queueItem;

    this.logger.info(`Processing installation for tentacle: ${tentacleId}`);
    this.state.currentOperation = {
      type: 'install',
      tentacleId,
      startTime: Date.now()
    };

    // Emit installation started event
    this.events.emit('installation:started', {
      tentacleId
    });

    try {
      // In a real implementation, this would download and install the tentacle
      // For this mock implementation, we'll simulate the installation process
      
      // Simulate download
      this.logger.info(`Downloading tentacle: ${tentacleId}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate download time
      
      // Simulate installation
      this.logger.info(`Installing tentacle: ${tentacleId}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate installation time
      
      // Simulate registration with tentacle registry
      this.logger.info(`Registering tentacle: ${tentacleId}`);
      await this.tentacleRegistry.registerTentacle({
        id: tentacleId,
        name: tentacleId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        version: '1.0.0'
      });
      
      // Add to installed tentacles
      this.installedTentacles.set(tentacleId, {
        id: tentacleId,
        name: tentacleId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        version: '1.0.0',
        installDate: new Date().toISOString().split('T')[0],
        status: 'active',
        path: `/tentacles/${tentacleId}`
      });
      
      // Emit installation completed event
      this.events.emit('installation:completed', {
        tentacleId
      });
      
      // Resolve promise
      const result = {
        success: true,
        tentacleId,
        message: 'Installation completed successfully'
      };
      resolve(result);
      
      this.logger.info(`Installation completed for tentacle: ${tentacleId}`);
    } catch (error) {
      this.logger.error(`Failed to install tentacle: ${tentacleId}`, error);
      
      // Emit installation failed event
      this.events.emit('installation:failed', {
        tentacleId,
        error: error.message
      });
      
      // Reject promise
      reject(error);
    } finally {
      this.state.currentOperation = null;
      
      // Process next item in queue
      this._processNextInQueue();
    }
  }

  /**
   * Uninstall tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to uninstallation result
   */
  async uninstallTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error("InstallationManager not initialized");
    }

    this.logger.info(`Uninstalling tentacle: ${tentacleId}`);

    try {
      // Check if tentacle is installed
      if (!this.installedTentacles.has(tentacleId)) {
        this.logger.warn(`Tentacle not installed: ${tentacleId}`);
        return {
          success: true,
          tentacleId,
          message: 'Tentacle not installed'
        };
      }

      // Emit uninstallation started event
      this.events.emit('uninstallation:started', {
        tentacleId
      });

      // In a real implementation, this would uninstall the tentacle
      // For this mock implementation, we'll simulate the uninstallation process
      
      // Simulate unregistration from tentacle registry
      this.logger.info(`Unregistering tentacle: ${tentacleId}`);
      await this.tentacleRegistry.unregisterTentacle(tentacleId);
      
      // Simulate file removal
      this.logger.info(`Removing tentacle files: ${tentacleId}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate file removal time
      
      // Remove from installed tentacles
      this.installedTentacles.delete(tentacleId);
      
      // Emit uninstallation completed event
      this.events.emit('uninstallation:completed', {
        tentacleId
      });
      
      this.logger.info(`Uninstallation completed for tentacle: ${tentacleId}`);
      return {
        success: true,
        tentacleId,
        message: 'Uninstallation completed successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to uninstall tentacle: ${tentacleId}`, error);
      
      // Emit uninstallation failed event
      this.events.emit('uninstallation:failed', {
        tentacleId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Update tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to update result
   */
  async updateTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error("InstallationManager not initialized");
    }

    this.logger.info(`Updating tentacle: ${tentacleId}`);

    try {
      // Check if tentacle is installed
      if (!this.installedTentacles.has(tentacleId)) {
        this.logger.warn(`Tentacle not installed: ${tentacleId}`);
        throw new Error('Tentacle not installed');
      }

      // Emit update started event
      this.events.emit('update:started', {
        tentacleId
      });

      // In a real implementation, this would update the tentacle
      // For this mock implementation, we'll simulate the update process
      
      // Simulate download
      this.logger.info(`Downloading update for tentacle: ${tentacleId}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate download time
      
      // Simulate update
      this.logger.info(`Updating tentacle: ${tentacleId}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate update time
      
      // Update installed tentacle version
      const tentacle = this.installedTentacles.get(tentacleId);
      const versionParts = tentacle.version.split('.');
      versionParts[2] = parseInt(versionParts[2]) + 1;
      tentacle.version = versionParts.join('.');
      tentacle.updateDate = new Date().toISOString().split('T')[0];
      this.installedTentacles.set(tentacleId, tentacle);
      
      // Emit update completed event
      this.events.emit('update:completed', {
        tentacleId,
        version: tentacle.version
      });
      
      this.logger.info(`Update completed for tentacle: ${tentacleId} to version ${tentacle.version}`);
      return {
        success: true,
        tentacleId,
        version: tentacle.version,
        message: 'Update completed successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to update tentacle: ${tentacleId}`, error);
      
      // Emit update failed event
      this.events.emit('update:failed', {
        tentacleId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get installed tentacles
   * @returns {Array} - Array of installed tentacles
   */
  getInstalledTentacles() {
    if (!this.initialized) {
      throw new Error("InstallationManager not initialized");
    }

    return Array.from(this.installedTentacles.values());
  }

  /**
   * Check if tentacle is installed
   * @param {string} tentacleId - Tentacle ID
   * @returns {boolean} - True if tentacle is installed
   */
  isTentacleInstalled(tentacleId) {
    if (!this.initialized) {
      throw new Error("InstallationManager not initialized");
    }

    return this.installedTentacles.has(tentacleId);
  }

  /**
   * Get tentacle installation status
   * @param {string} tentacleId - Tentacle ID
   * @returns {Object} - Tentacle installation status
   */
  getTentacleStatus(tentacleId) {
    if (!this.initialized) {
      throw new Error("InstallationManager not initialized");
    }

    // Check if tentacle is installed
    if (!this.installedTentacles.has(tentacleId)) {
      return {
        installed: false,
        status: 'not_installed'
      };
    }

    // Get installed tentacle
    const tentacle = this.installedTentacles.get(tentacleId);

    return {
      installed: true,
      status: tentacle.status,
      version: tentacle.version,
      installDate: tentacle.installDate,
      updateDate: tentacle.updateDate,
      path: tentacle.path
    };
  }

  /**
   * Get the status of the InstallationManager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      installedTentacleCount: this.installedTentacles.size,
      queueLength: this.installationQueue.length,
      isProcessing: this.state.isProcessing,
      currentOperation: this.state.currentOperation,
      error: this.state.error
    };
  }

  /**
   * Shutdown the InstallationManager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn("InstallationManager not initialized");
      return true;
    }
    
    this.logger.info("Shutting down InstallationManager");
    
    try {
      // Clear queues
      this.installationQueue = [];
      this.updateQueue = [];
      
      // Reset state
      this.state.isProcessing = false;
      this.state.currentOperation = null;
      
      this.initialized = false;
      this.logger.info("InstallationManager shutdown complete");
      return true;
    } catch (error) {
      this.logger.error("Failed to shutdown InstallationManager", error);
      throw error;
    }
  }
}

module.exports = { InstallationManager };
