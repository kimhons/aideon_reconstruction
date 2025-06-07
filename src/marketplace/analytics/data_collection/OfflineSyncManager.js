/**
 * @fileoverview Offline Synchronization Manager for Analytics Dashboard
 * This service is responsible for managing offline data collection and synchronization
 * for the Aideon Tentacle Marketplace analytics dashboard.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * OfflineSyncManager class - Manages offline data collection and synchronization
 */
class OfflineSyncManager {
  /**
   * Create a new OfflineSyncManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.config - Sync configuration
   * @param {Object} options.analyticsStorage - Reference to AnalyticsStorage instance
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.analyticsStorage = options.analyticsStorage;
    this.logger = new Logger('OfflineSyncManager');
    this.events = new EventEmitter();
    
    // Default configuration
    this.config.maxOfflineQueueSize = this.config.maxOfflineQueueSize || 10000;
    this.config.syncInterval = this.config.syncInterval || 60; // seconds
    this.config.persistOfflineData = this.config.persistOfflineData !== false;
    this.config.offlineStorageKey = this.config.offlineStorageKey || 'aideon_analytics_offline_data';
    
    this.offlineQueue = [];
    this.isOnline = true;
    this.syncInProgress = false;
    this.initialized = false;
    
    this.logger.info('OfflineSyncManager instance created');
  }
  
  /**
   * Initialize the OfflineSyncManager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    this.logger.info('Initializing OfflineSyncManager');
    
    if (!this.analyticsStorage) {
      throw new Error('AnalyticsStorage reference is required for initialization');
    }
    
    // Load any persisted offline data
    if (this.config.persistOfflineData) {
      await this._loadPersistedOfflineData();
    }
    
    // Set up network status monitoring
    this._setupNetworkMonitoring();
    
    // Set up sync interval
    this._setupSyncInterval();
    
    this.initialized = true;
    this.logger.info('OfflineSyncManager initialized');
    return true;
  }
  
  /**
   * Queue data for storage
   * @param {Object} data - Data to queue
   * @returns {Promise<boolean>} - Promise resolving to true if queuing was successful
   */
  async queueData(data) {
    if (!this.initialized) {
      throw new Error('OfflineSyncManager not initialized');
    }
    
    this.logger.debug(`Queuing data of type: ${data.type}`);
    
    try {
      // If online, store directly
      if (this.isOnline) {
        return await this.analyticsStorage.storeRawData(data);
      }
      
      // Otherwise, add to offline queue
      this.offlineQueue.push({
        data,
        timestamp: Date.now()
      });
      
      // Check if queue is too large
      if (this.offlineQueue.length > this.config.maxOfflineQueueSize) {
        // Remove oldest items
        this.offlineQueue = this.offlineQueue.slice(-this.config.maxOfflineQueueSize);
        this.logger.warn(`Offline queue exceeded maximum size, truncated to ${this.config.maxOfflineQueueSize} items`);
      }
      
      // Persist offline data if configured
      if (this.config.persistOfflineData) {
        await this._persistOfflineData();
      }
      
      // Emit event
      this.events.emit('data:queued', { 
        queueSize: this.offlineQueue.length,
        isOnline: this.isOnline
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to queue data', error);
      throw error;
    }
  }
  
  /**
   * Synchronize offline data
   * @returns {Promise<Object>} - Promise resolving to sync results
   */
  async synchronize() {
    if (!this.initialized) {
      throw new Error('OfflineSyncManager not initialized');
    }
    
    // If already syncing or no data to sync, return
    if (this.syncInProgress || this.offlineQueue.length === 0 || !this.isOnline) {
      return { 
        success: true, 
        synced: 0, 
        remaining: this.offlineQueue.length,
        skipped: this.syncInProgress
      };
    }
    
    this.logger.info(`Starting synchronization of ${this.offlineQueue.length} items`);
    this.syncInProgress = true;
    
    try {
      // Process queue in batches to avoid overwhelming the system
      const batchSize = 100;
      let syncedCount = 0;
      let failedCount = 0;
      
      while (this.offlineQueue.length > 0 && this.isOnline) {
        // Get batch
        const batch = this.offlineQueue.splice(0, batchSize);
        
        // Process batch
        for (const item of batch) {
          try {
            await this.analyticsStorage.storeRawData(item.data);
            syncedCount++;
          } catch (error) {
            this.logger.error('Failed to sync item', error);
            failedCount++;
            
            // Re-queue failed items if they're recent (less than 24 hours old)
            const itemAge = Date.now() - item.timestamp;
            if (itemAge < 24 * 60 * 60 * 1000) {
              this.offlineQueue.push(item);
            }
          }
        }
        
        // Persist updated queue if configured
        if (this.config.persistOfflineData) {
          await this._persistOfflineData();
        }
        
        // Emit progress event
        this.events.emit('sync:progress', {
          synced: syncedCount,
          failed: failedCount,
          remaining: this.offlineQueue.length
        });
      }
      
      this.logger.info(`Synchronization complete: ${syncedCount} synced, ${failedCount} failed, ${this.offlineQueue.length} remaining`);
      
      // Emit completion event
      this.events.emit('sync:complete', {
        synced: syncedCount,
        failed: failedCount,
        remaining: this.offlineQueue.length
      });
      
      return {
        success: true,
        synced: syncedCount,
        failed: failedCount,
        remaining: this.offlineQueue.length
      };
    } catch (error) {
      this.logger.error('Synchronization failed', error);
      
      // Emit error event
      this.events.emit('sync:error', {
        error: error.message,
        queueSize: this.offlineQueue.length
      });
      
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Set online status
   * @param {boolean} isOnline - Whether the system is online
   * @returns {Promise<boolean>} - Promise resolving to true if status change was successful
   */
  async setOnlineStatus(isOnline) {
    if (this.isOnline === isOnline) {
      return true;
    }
    
    this.logger.info(`Setting online status to: ${isOnline}`);
    this.isOnline = isOnline;
    
    // Emit event
    this.events.emit('status:change', { isOnline });
    
    // If coming online, start synchronization
    if (isOnline && this.offlineQueue.length > 0) {
      this.synchronize().catch(error => {
        this.logger.error('Failed to synchronize after coming online', error);
      });
    }
    
    return true;
  }
  
  /**
   * Set up network monitoring
   * @private
   */
  _setupNetworkMonitoring() {
    this.logger.debug('Setting up network monitoring');
    
    // In a browser environment, we would use the online/offline events
    // For Node.js, we need to use a different approach
    
    if (typeof window !== 'undefined') {
      // Browser environment
      window.addEventListener('online', () => {
        this.setOnlineStatus(true).catch(error => {
          this.logger.error('Failed to set online status', error);
        });
      });
      
      window.addEventListener('offline', () => {
        this.setOnlineStatus(false).catch(error => {
          this.logger.error('Failed to set offline status', error);
        });
      });
      
      // Set initial status
      this.isOnline = navigator.onLine;
    } else {
      // Node.js environment
      // We could use DNS lookups or HTTP requests to check connectivity
      // For now, we'll assume we're online and let the application set the status
      
      // Example: Periodic connectivity check
      setInterval(() => {
        this._checkConnectivity().catch(error => {
          this.logger.error('Failed to check connectivity', error);
        });
      }, 30000); // Check every 30 seconds
    }
  }
  
  /**
   * Check connectivity
   * @returns {Promise<boolean>} - Promise resolving to true if online
   * @private
   */
  async _checkConnectivity() {
    try {
      // In a real implementation, this would make a lightweight HTTP request
      // or DNS lookup to check connectivity
      
      // For now, we'll simulate a check
      const isOnline = Math.random() > 0.1; // 90% chance of being online
      
      await this.setOnlineStatus(isOnline);
      return isOnline;
    } catch (error) {
      this.logger.error('Connectivity check failed', error);
      await this.setOnlineStatus(false);
      return false;
    }
  }
  
  /**
   * Set up sync interval
   * @private
   */
  _setupSyncInterval() {
    // Set up periodic synchronization
    const intervalMs = this.config.syncInterval * 1000;
    
    this._syncInterval = setInterval(() => {
      if (this.isOnline && this.offlineQueue.length > 0 && !this.syncInProgress) {
        this.synchronize().catch(error => {
          this.logger.error('Failed to synchronize', error);
        });
      }
    }, intervalMs);
  }
  
  /**
   * Load persisted offline data
   * @returns {Promise<boolean>} - Promise resolving to true if loading was successful
   * @private
   */
  async _loadPersistedOfflineData() {
    this.logger.debug('Loading persisted offline data');
    
    try {
      let persistedData = null;
      
      if (typeof localStorage !== 'undefined') {
        // Browser environment
        const storedData = localStorage.getItem(this.config.offlineStorageKey);
        if (storedData) {
          persistedData = JSON.parse(storedData);
        }
      } else {
        // Node.js environment
        // In a real implementation, this would load from a file or database
        // For now, we'll simulate loading
        
        // Example: Load from file
        // const fs = require('fs').promises;
        // const storedData = await fs.readFile(this.config.offlineStorageKey, 'utf8');
        // if (storedData) {
        //   persistedData = JSON.parse(storedData);
        // }
      }
      
      if (persistedData && Array.isArray(persistedData)) {
        this.offlineQueue = persistedData;
        this.logger.info(`Loaded ${this.offlineQueue.length} items from persisted offline data`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to load persisted offline data', error);
      return false;
    }
  }
  
  /**
   * Persist offline data
   * @returns {Promise<boolean>} - Promise resolving to true if persistence was successful
   * @private
   */
  async _persistOfflineData() {
    this.logger.debug('Persisting offline data');
    
    try {
      if (typeof localStorage !== 'undefined') {
        // Browser environment
        localStorage.setItem(this.config.offlineStorageKey, JSON.stringify(this.offlineQueue));
      } else {
        // Node.js environment
        // In a real implementation, this would save to a file or database
        // For now, we'll simulate saving
        
        // Example: Save to file
        // const fs = require('fs').promises;
        // await fs.writeFile(this.config.offlineStorageKey, JSON.stringify(this.offlineQueue), 'utf8');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to persist offline data', error);
      return false;
    }
  }
  
  /**
   * Get the status of the OfflineSyncManager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      queueSize: this.offlineQueue.length,
      maxQueueSize: this.config.maxOfflineQueueSize
    };
  }
  
  /**
   * Shutdown the OfflineSyncManager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    this.logger.info('Shutting down OfflineSyncManager');
    
    // Clear sync interval
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
    
    // Persist any remaining offline data
    if (this.config.persistOfflineData && this.offlineQueue.length > 0) {
      await this._persistOfflineData();
    }
    
    this.initialized = false;
    this.logger.info('OfflineSyncManager shutdown complete');
    return true;
  }
}

module.exports = { OfflineSyncManager };
