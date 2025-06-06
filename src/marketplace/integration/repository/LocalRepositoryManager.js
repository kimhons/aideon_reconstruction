/**
 * @fileoverview Local Repository Manager for the Aideon Tentacle Marketplace
 * 
 * This module provides functionality for managing the local repository of
 * installed marketplace tentacles, handling storage, retrieval, and cleanup.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * LocalRepositoryManager class - Manages local storage of marketplace tentacles
 */
class LocalRepositoryManager {
  /**
   * Create a new LocalRepositoryManager instance
   * @param {Object} options - Configuration options
   * @param {string} options.storagePath - Path to store tentacle packages
   * @param {number} options.maxStorageSize - Maximum storage size in bytes
   */
  constructor(options = {}) {
    this.options = options;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'marketplace', 'repository');
    this.maxStorageSize = options.maxStorageSize || 1024 * 1024 * 1024; // 1GB default
    this.installedTentacles = new Map();
    this.logger = new Logger('LocalRepositoryManager');
    this.events = new EventEmitter();
    this.initialized = false;
  }

  /**
   * Initialize the local repository manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('LocalRepositoryManager already initialized');
      return true;
    }

    this.logger.info('Initializing LocalRepositoryManager');
    
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Load installed tentacles data
      await this.loadInstalledTentacles();
      
      this.initialized = true;
      this.logger.info('LocalRepositoryManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize LocalRepositoryManager', error);
      return false;
    }
  }

  /**
   * Load installed tentacles data from storage
   * @returns {Promise<void>}
   * @private
   */
  async loadInstalledTentacles() {
    try {
      const installedFile = path.join(this.storagePath, 'installed.json');
      const exists = await fs.access(installedFile).then(() => true).catch(() => false);
      
      if (!exists) {
        this.logger.info('Installed tentacles file does not exist, creating new file');
        await this.saveInstalledTentacles();
        return;
      }
      
      const data = await fs.readFile(installedFile, 'utf8');
      const installed = JSON.parse(data);
      
      // Load installed tentacles into memory
      for (const [id, tentacle] of Object.entries(installed.tentacles)) {
        this.installedTentacles.set(id, tentacle);
      }
      
      this.logger.info(`Loaded ${this.installedTentacles.size} installed tentacles`);
    } catch (error) {
      this.logger.error('Failed to load installed tentacles', error);
      throw error;
    }
  }

  /**
   * Save installed tentacles data to storage
   * @returns {Promise<void>}
   * @private
   */
  async saveInstalledTentacles() {
    try {
      const installed = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        tentacles: Object.fromEntries(this.installedTentacles)
      };
      
      const installedFile = path.join(this.storagePath, 'installed.json');
      await fs.writeFile(installedFile, JSON.stringify(installed, null, 2), 'utf8');
      
      this.logger.info('Installed tentacles saved successfully');
    } catch (error) {
      this.logger.error('Failed to save installed tentacles', error);
      throw error;
    }
  }

  /**
   * Install a tentacle package to the local repository
   * @param {string} tentacleId - Tentacle ID
   * @param {Buffer} packageData - Tentacle package data
   * @param {Object} metadata - Tentacle metadata
   * @returns {Promise<Object>} - Promise resolving to the installed tentacle info
   */
  async installTentacle(tentacleId, packageData, metadata) {
    if (!this.initialized) {
      throw new Error('LocalRepositoryManager not initialized');
    }
    
    this.logger.info(`Installing tentacle: ${tentacleId}`);
    
    // Check if tentacle is already installed
    if (this.installedTentacles.has(tentacleId)) {
      throw new Error(`Tentacle ${tentacleId} is already installed`);
    }
    
    // Check available storage space
    await this.ensureStorageSpace(packageData.length);
    
    // Generate package hash for integrity verification
    const packageHash = crypto.createHash('sha256').update(packageData).digest('hex');
    
    // Create tentacle directory
    const tentacleDir = path.join(this.storagePath, tentacleId);
    await fs.mkdir(tentacleDir, { recursive: true });
    
    // Save package file
    const packageFile = path.join(tentacleDir, 'package.zip');
    await fs.writeFile(packageFile, packageData);
    
    // Create installed tentacle record
    const installedTentacle = {
      id: tentacleId,
      installedAt: new Date().toISOString(),
      packageHash,
      packageSize: packageData.length,
      version: metadata.version,
      path: tentacleDir,
      metadata
    };
    
    // Add to installed tentacles
    this.installedTentacles.set(tentacleId, installedTentacle);
    
    // Save installed tentacles
    await this.saveInstalledTentacles();
    
    // Emit event
    this.events.emit('tentacle:installed', { tentacle: installedTentacle });
    
    return installedTentacle;
  }

  /**
   * Ensure there is enough storage space for a new package
   * @param {number} requiredSize - Required size in bytes
   * @returns {Promise<void>}
   * @private
   */
  async ensureStorageSpace(requiredSize) {
    // Get current storage usage
    const usage = await this.getStorageUsage();
    
    // Check if there's enough space
    if (usage.used + requiredSize <= this.maxStorageSize) {
      return;
    }
    
    this.logger.warn('Insufficient storage space, cleaning up old packages');
    
    // Get installed tentacles sorted by installation date (oldest first)
    const tentacles = Array.from(this.installedTentacles.values())
      .sort((a, b) => new Date(a.installedAt) - new Date(b.installedAt));
    
    let freedSpace = 0;
    const toRemove = [];
    
    // Find tentacles to remove until we have enough space
    for (const tentacle of tentacles) {
      if (usage.used + requiredSize - freedSpace <= this.maxStorageSize) {
        break;
      }
      
      freedSpace += tentacle.packageSize;
      toRemove.push(tentacle.id);
    }
    
    // Remove tentacles
    for (const id of toRemove) {
      await this.uninstallTentacle(id, { cleanupOnly: true });
    }
    
    // Check if we have enough space now
    if (usage.used + requiredSize - freedSpace > this.maxStorageSize) {
      throw new Error('Insufficient storage space even after cleanup');
    }
  }

  /**
   * Get the current storage usage
   * @returns {Promise<Object>} - Promise resolving to storage usage info
   * @private
   */
  async getStorageUsage() {
    let used = 0;
    
    for (const tentacle of this.installedTentacles.values()) {
      used += tentacle.packageSize;
    }
    
    return {
      used,
      max: this.maxStorageSize,
      available: this.maxStorageSize - used,
      percentUsed: (used / this.maxStorageSize) * 100
    };
  }

  /**
   * Uninstall a tentacle from the local repository
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} options - Uninstall options
   * @returns {Promise<boolean>} - Promise resolving to true if uninstallation was successful
   */
  async uninstallTentacle(tentacleId, options = {}) {
    if (!this.initialized) {
      throw new Error('LocalRepositoryManager not initialized');
    }
    
    if (!this.installedTentacles.has(tentacleId)) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    this.logger.info(`Uninstalling tentacle: ${tentacleId}`);
    
    const tentacle = this.installedTentacles.get(tentacleId);
    
    // Remove tentacle directory
    try {
      await fs.rm(tentacle.path, { recursive: true, force: true });
    } catch (error) {
      this.logger.error(`Failed to remove tentacle directory: ${tentacle.path}`, error);
      if (!options.cleanupOnly) {
        throw error;
      }
    }
    
    // Remove from installed tentacles
    this.installedTentacles.delete(tentacleId);
    
    // Save installed tentacles
    await this.saveInstalledTentacles();
    
    // Emit event
    if (!options.cleanupOnly) {
      this.events.emit('tentacle:uninstalled', { tentacle });
    }
    
    return true;
  }

  /**
   * Get an installed tentacle by ID
   * @param {string} tentacleId - Tentacle ID
   * @returns {Object|null} - Installed tentacle info or null if not found
   */
  getInstalledTentacle(tentacleId) {
    if (!this.initialized) {
      throw new Error('LocalRepositoryManager not initialized');
    }
    
    return this.installedTentacles.get(tentacleId) || null;
  }

  /**
   * Get all installed tentacles
   * @returns {Array<Object>} - Array of installed tentacle info
   */
  getAllInstalledTentacles() {
    if (!this.initialized) {
      throw new Error('LocalRepositoryManager not initialized');
    }
    
    return Array.from(this.installedTentacles.values());
  }

  /**
   * Get the package data for an installed tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Buffer>} - Promise resolving to the package data
   */
  async getTentaclePackage(tentacleId) {
    if (!this.initialized) {
      throw new Error('LocalRepositoryManager not initialized');
    }
    
    const tentacle = this.installedTentacles.get(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    const packageFile = path.join(tentacle.path, 'package.zip');
    
    try {
      return await fs.readFile(packageFile);
    } catch (error) {
      this.logger.error(`Failed to read package file: ${packageFile}`, error);
      throw error;
    }
  }

  /**
   * Verify the integrity of an installed tentacle package
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if package is valid
   */
  async verifyTentaclePackage(tentacleId) {
    if (!this.initialized) {
      throw new Error('LocalRepositoryManager not initialized');
    }
    
    const tentacle = this.installedTentacles.get(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} is not installed`);
    }
    
    const packageFile = path.join(tentacle.path, 'package.zip');
    
    try {
      const packageData = await fs.readFile(packageFile);
      const packageHash = crypto.createHash('sha256').update(packageData).digest('hex');
      
      return packageHash === tentacle.packageHash;
    } catch (error) {
      this.logger.error(`Failed to verify package: ${packageFile}`, error);
      return false;
    }
  }

  /**
   * Get the status of the local repository manager
   * @returns {Promise<Object>} - Promise resolving to status object
   */
  async getStatus() {
    const usage = await this.getStorageUsage();
    
    return {
      initialized: this.initialized,
      tentacleCount: this.installedTentacles.size,
      storagePath: this.storagePath,
      storageUsage: usage
    };
  }

  /**
   * Shutdown the local repository manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('LocalRepositoryManager not initialized');
      return true;
    }

    this.logger.info('Shutting down LocalRepositoryManager');
    
    try {
      // Save installed tentacles before shutdown
      await this.saveInstalledTentacles();
      
      this.initialized = false;
      this.logger.info('LocalRepositoryManager shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown LocalRepositoryManager', error);
      return false;
    }
  }
}

module.exports = { LocalRepositoryManager };
