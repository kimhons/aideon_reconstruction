/**
 * @fileoverview Installation Manager for the Aideon Tentacle Marketplace
 * 
 * This module provides functionality for installing, updating, and uninstalling
 * tentacles from the marketplace.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * InstallationManager class - Manages installation of marketplace tentacles
 */
class InstallationManager {
  /**
   * Create a new InstallationManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.registryService - Reference to the RegistryService
   * @param {Object} options.localRepositoryManager - Reference to the LocalRepositoryManager
   * @param {Object} options.tentacleRegistryConnector - Reference to the TentacleRegistryConnector
   */
  constructor(options = {}) {
    this.options = options;
    this.registryService = options.registryService;
    this.localRepositoryManager = options.localRepositoryManager;
    this.tentacleRegistryConnector = options.tentacleRegistryConnector;
    this.logger = new Logger('InstallationManager');
    this.events = new EventEmitter();
    this.installationQueue = [];
    this.isProcessing = false;
    this.initialized = false;
  }

  /**
   * Initialize the installation manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('InstallationManager already initialized');
      return true;
    }

    this.logger.info('Initializing InstallationManager');
    
    if (!this.registryService) {
      throw new Error('RegistryService reference is required');
    }
    
    if (!this.localRepositoryManager) {
      throw new Error('LocalRepositoryManager reference is required');
    }
    
    if (!this.tentacleRegistryConnector) {
      throw new Error('TentacleRegistryConnector reference is required');
    }
    
    this.initialized = true;
    this.logger.info('InstallationManager initialized successfully');
    return true;
  }

  /**
   * Install a tentacle from the marketplace
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} - Promise resolving to installation status
   */
  async installTentacle(tentacleId, options = {}) {
    if (!this.initialized) {
      throw new Error('InstallationManager not initialized');
    }
    
    this.logger.info(`Installing tentacle: ${tentacleId}`);
    
    // Check if tentacle exists in registry
    const tentacle = this.registryService.getTentacle(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} not found in registry`);
    }
    
    // Check if tentacle is already installed
    const isInstalled = await this.isTentacleInstalled(tentacleId);
    
    if (isInstalled) {
      this.logger.warn(`Tentacle ${tentacleId} is already installed`);
      return { status: 'already-installed', tentacleId };
    }
    
    // Create installation task
    const task = {
      id: tentacleId,
      type: 'install',
      options,
      status: 'queued',
      queuedAt: new Date().toISOString()
    };
    
    // Add to queue
    this.installationQueue.push(task);
    
    // Start processing queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return { status: 'queued', tentacleId, task };
  }

  /**
   * Process the installation queue
   * @returns {Promise<void>}
   * @private
   */
  async processQueue() {
    if (this.isProcessing || this.installationQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.installationQueue.length > 0) {
        const task = this.installationQueue.shift();
        
        this.logger.info(`Processing ${task.type} task for tentacle: ${task.id}`);
        
        task.status = 'processing';
        task.startedAt = new Date().toISOString();
        
        try {
          if (task.type === 'install') {
            await this.processInstallTask(task);
          } else if (task.type === 'uninstall') {
            await this.processUninstallTask(task);
          } else if (task.type === 'update') {
            await this.processUpdateTask(task);
          } else {
            this.logger.error(`Unknown task type: ${task.type}`);
            task.status = 'failed';
            task.error = `Unknown task type: ${task.type}`;
          }
        } catch (error) {
          this.logger.error(`Failed to process ${task.type} task for tentacle: ${task.id}`, error);
          task.status = 'failed';
          task.error = error.message;
          
          // Emit event
          this.events.emit(`tentacle:${task.type}:failed`, { task, error });
        }
        
        task.completedAt = new Date().toISOString();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process an install task
   * @param {Object} task - Installation task
   * @returns {Promise<void>}
   * @private
   */
  async processInstallTask(task) {
    const tentacleId = task.id;
    
    // Get tentacle from registry
    const tentacle = this.registryService.getTentacle(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} not found in registry`);
    }
    
    // Download package
    this.logger.info(`Downloading package for tentacle: ${tentacleId}`);
    
    // This would normally fetch from a remote server
    // For now, we'll simulate the package data
    const packageData = Buffer.from(`Simulated package data for ${tentacleId}`);
    
    // Install to local repository
    this.logger.info(`Installing package for tentacle: ${tentacleId}`);
    const installedTentacle = await this.localRepositoryManager.installTentacle(
      tentacleId,
      packageData,
      tentacle
    );
    
    // Register with core
    this.logger.info(`Registering tentacle with core: ${tentacleId}`);
    await this.tentacleRegistryConnector.registerTentacle(tentacleId);
    
    // Update download count
    await this.registryService.incrementDownloads(tentacleId);
    
    // Update task status
    task.status = 'completed';
    
    // Emit event
    this.events.emit('tentacle:installed', { task, tentacle: installedTentacle });
  }

  /**
   * Process an uninstall task
   * @param {Object} task - Uninstallation task
   * @returns {Promise<void>}
   * @private
   */
  async processUninstallTask(task) {
    const tentacleId = task.id;
    
    // Unregister from core
    this.logger.info(`Unregistering tentacle from core: ${tentacleId}`);
    await this.tentacleRegistryConnector.unregisterTentacle(tentacleId);
    
    // Uninstall from local repository
    this.logger.info(`Uninstalling tentacle: ${tentacleId}`);
    await this.localRepositoryManager.uninstallTentacle(tentacleId);
    
    // Update task status
    task.status = 'completed';
    
    // Emit event
    this.events.emit('tentacle:uninstalled', { task });
  }

  /**
   * Process an update task
   * @param {Object} task - Update task
   * @returns {Promise<void>}
   * @private
   */
  async processUpdateTask(task) {
    const tentacleId = task.id;
    const targetVersion = task.options.version;
    
    // Get tentacle from registry
    const tentacle = this.registryService.getTentacle(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} not found in registry`);
    }
    
    // Check if installed
    const installedTentacle = this.localRepositoryManager.getInstalledTentacle(tentacleId);
    
    if (!installedTentacle) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    // Check if update is needed
    if (installedTentacle.version === targetVersion) {
      this.logger.info(`Tentacle ${tentacleId} is already at version ${targetVersion}`);
      task.status = 'skipped';
      return;
    }
    
    // Unregister from core
    this.logger.info(`Unregistering tentacle from core: ${tentacleId}`);
    await this.tentacleRegistryConnector.unregisterTentacle(tentacleId);
    
    // Download package
    this.logger.info(`Downloading package for tentacle: ${tentacleId} version ${targetVersion}`);
    
    // This would normally fetch from a remote server
    // For now, we'll simulate the package data
    const packageData = Buffer.from(`Simulated package data for ${tentacleId} version ${targetVersion}`);
    
    // Uninstall old version
    this.logger.info(`Uninstalling old version of tentacle: ${tentacleId}`);
    await this.localRepositoryManager.uninstallTentacle(tentacleId);
    
    // Install new version
    this.logger.info(`Installing new version of tentacle: ${tentacleId}`);
    const updatedTentacle = await this.localRepositoryManager.installTentacle(
      tentacleId,
      packageData,
      {
        ...tentacle,
        version: targetVersion
      }
    );
    
    // Register with core
    this.logger.info(`Registering tentacle with core: ${tentacleId}`);
    await this.tentacleRegistryConnector.registerTentacle(tentacleId);
    
    // Update task status
    task.status = 'completed';
    
    // Emit event
    this.events.emit('tentacle:updated', { task, tentacle: updatedTentacle });
  }

  /**
   * Uninstall a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} options - Uninstallation options
   * @returns {Promise<Object>} - Promise resolving to uninstallation status
   */
  async uninstallTentacle(tentacleId, options = {}) {
    if (!this.initialized) {
      throw new Error('InstallationManager not initialized');
    }
    
    this.logger.info(`Uninstalling tentacle: ${tentacleId}`);
    
    // Check if tentacle is installed
    const isInstalled = await this.isTentacleInstalled(tentacleId);
    
    if (!isInstalled) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    // Create uninstallation task
    const task = {
      id: tentacleId,
      type: 'uninstall',
      options,
      status: 'queued',
      queuedAt: new Date().toISOString()
    };
    
    // Add to queue
    this.installationQueue.push(task);
    
    // Start processing queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return { status: 'queued', tentacleId, task };
  }

  /**
   * Update a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Promise resolving to update status
   */
  async updateTentacle(tentacleId, options = {}) {
    if (!this.initialized) {
      throw new Error('InstallationManager not initialized');
    }
    
    this.logger.info(`Updating tentacle: ${tentacleId}`);
    
    // Check if tentacle exists in registry
    const tentacle = this.registryService.getTentacle(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} not found in registry`);
    }
    
    // Check if tentacle is installed
    const isInstalled = await this.isTentacleInstalled(tentacleId);
    
    if (!isInstalled) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    // Create update task
    const task = {
      id: tentacleId,
      type: 'update',
      options: {
        version: options.version || tentacle.version,
        ...options
      },
      status: 'queued',
      queuedAt: new Date().toISOString()
    };
    
    // Add to queue
    this.installationQueue.push(task);
    
    // Start processing queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return { status: 'queued', tentacleId, task };
  }

  /**
   * Check if a tentacle is installed
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if tentacle is installed
   */
  async isTentacleInstalled(tentacleId) {
    if (!this.initialized) {
      throw new Error('InstallationManager not initialized');
    }
    
    const installedTentacle = this.localRepositoryManager.getInstalledTentacle(tentacleId);
    return !!installedTentacle;
  }

  /**
   * Get installation status
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to installation status
   */
  async getInstallationStatus(tentacleId) {
    if (!this.initialized) {
      throw new Error('InstallationManager not initialized');
    }
    
    // Check if tentacle is in queue
    const queuedTask = this.installationQueue.find(task => task.id === tentacleId);
    
    if (queuedTask) {
      return {
        tentacleId,
        status: 'queued',
        task: queuedTask
      };
    }
    
    // Check if tentacle is installed
    const isInstalled = await this.isTentacleInstalled(tentacleId);
    
    if (isInstalled) {
      const installedTentacle = this.localRepositoryManager.getInstalledTentacle(tentacleId);
      const isRegistered = this.tentacleRegistryConnector.getRegisteredTentacle(tentacleId);
      
      return {
        tentacleId,
        status: 'installed',
        installedAt: installedTentacle.installedAt,
        version: installedTentacle.version,
        isRegistered: !!isRegistered
      };
    }
    
    return {
      tentacleId,
      status: 'not-installed'
    };
  }

  /**
   * Get the status of the installation manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      queueLength: this.installationQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Shutdown the installation manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('InstallationManager not initialized');
      return true;
    }

    this.logger.info('Shutting down InstallationManager');
    
    // Wait for queue to finish processing
    if (this.isProcessing) {
      this.logger.info('Waiting for installation queue to finish processing');
      
      // Wait for processing to complete
      while (this.isProcessing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.initialized = false;
    this.logger.info('InstallationManager shutdown successfully');
    return true;
  }
}

module.exports = { InstallationManager };
