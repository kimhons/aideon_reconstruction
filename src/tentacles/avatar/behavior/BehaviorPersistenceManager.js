/**
 * @fileoverview BehaviorPersistenceManager handles the storage, retrieval, and management
 * of avatar behavior data, including user preferences, learned behaviors, and behavior history.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Manager for avatar behavior persistence
 */
class BehaviorPersistenceManager {
  /**
   * Creates a new BehaviorPersistenceManager instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   * @param {string} [options.storageDirectory=null] - Directory for behavior data storage
   */
  constructor(options = {}) {
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('BehaviorPersistenceManager');
    this.events = new EventEmitter();
    
    // Storage directory for behavior data
    this.storageDirectory = options.storageDirectory || null;
    
    // In-memory cache for behavior data
    this.cache = {
      preferences: new Map(),
      history: new Map(),
      learned: new Map()
    };
    
    // Storage status
    this.storageStatus = {
      initialized: false,
      lastSync: null,
      pendingWrites: 0
    };
    
    // Configuration
    this.config = {
      autoSyncInterval: 300000, // 5 minutes
      maxHistoryItems: 1000,
      maxCacheSize: 50 * 1024 * 1024, // 50 MB
      compressionEnabled: true,
      encryptionEnabled: false,
      persistenceEnabled: true
    };
    
    // Auto-sync timer
    this.autoSyncTimer = null;
    
    this.isInitialized = false;
    
    this.logger.info('BehaviorPersistenceManager created');
  }
  
  /**
   * Initializes the behavior persistence manager
   * 
   * @param {Object} [options] - Initialization options
   * @param {Object} [options.configuration] - Manager configuration
   * @param {string} [options.storageDirectory] - Directory for behavior data storage
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = 'behavior_persistence_init';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn('BehaviorPersistenceManager already initialized');
        return;
      }
      
      this.logger.info('Initializing BehaviorPersistenceManager');
      
      // Apply configuration if provided
      if (options.configuration) {
        this.config = {
          ...this.config,
          ...options.configuration
        };
      }
      
      // Set storage directory
      if (options.storageDirectory) {
        this.storageDirectory = options.storageDirectory;
      }
      
      // Ensure storage directory exists
      if (this.storageDirectory) {
        await this._ensureStorageDirectoryExists();
      } else {
        this.logger.warn('No storage directory specified, persistence will be limited to memory');
        this.config.persistenceEnabled = false;
      }
      
      // Initialize storage structure
      if (this.config.persistenceEnabled) {
        await this._initializeStorageStructure();
      }
      
      // Load existing data
      if (this.config.persistenceEnabled) {
        await this._loadExistingData();
      }
      
      // Start auto-sync if enabled
      if (this.config.persistenceEnabled && this.config.autoSyncInterval > 0) {
        this._startAutoSync();
      }
      
      this.isInitialized = true;
      this.storageStatus.initialized = true;
      this.events.emit('initialized');
      this.logger.info('BehaviorPersistenceManager initialized');
    } catch (error) {
      this.logger.error('Error initializing BehaviorPersistenceManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Stores user behavior preferences
   * 
   * @param {string} userId - User identifier
   * @param {string} preferenceType - Type of preference
   * @param {Object} preferenceData - Preference data
   * @param {Object} [options] - Storage options
   * @param {boolean} [options.immediate=false] - Whether to persist immediately
   * @returns {Promise<Object>} Stored preference data
   */
  async storePreference(userId, preferenceType, preferenceData, options = {}) {
    const lockKey = `store_preference_${userId}_${preferenceType}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Storing behavior preference', { 
        userId, preferenceType 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!preferenceType) {
        throw new Error('Preference type is required');
      }
      if (!preferenceData || typeof preferenceData !== 'object') {
        throw new Error('Preference data must be an object');
      }
      
      // Create user preference map if it doesn't exist
      if (!this.cache.preferences.has(userId)) {
        this.cache.preferences.set(userId, new Map());
      }
      
      // Create preference object with metadata
      const preference = {
        type: preferenceType,
        data: preferenceData,
        created: preferenceData.created || Date.now(),
        lastUpdated: Date.now()
      };
      
      // Store in cache
      this.cache.preferences.get(userId).set(preferenceType, preference);
      
      // Persist immediately if requested
      if (options.immediate && this.config.persistenceEnabled) {
        await this._persistPreference(userId, preferenceType, preference);
      } else if (this.config.persistenceEnabled) {
        this.storageStatus.pendingWrites++;
      }
      
      // Emit event
      this.events.emit('preference_stored', {
        userId,
        preferenceType,
        preference
      });
      
      return preference;
    } catch (error) {
      this.logger.error('Error storing behavior preference', { 
        error, userId, preferenceType 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Retrieves user behavior preferences
   * 
   * @param {string} userId - User identifier
   * @param {string} [preferenceType] - Type of preference (optional, returns all if not specified)
   * @returns {Promise<Object|Map>} Retrieved preference data
   */
  async getPreference(userId, preferenceType) {
    const lockKey = `get_preference_${userId}_${preferenceType || 'all'}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Retrieving behavior preference', { 
        userId, preferenceType 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check if user preferences exist
      if (!this.cache.preferences.has(userId)) {
        if (preferenceType) {
          return null;
        } else {
          return new Map();
        }
      }
      
      // Return specific preference if type is specified
      if (preferenceType) {
        const preference = this.cache.preferences.get(userId).get(preferenceType);
        return preference || null;
      }
      
      // Return all preferences for user
      return this.cache.preferences.get(userId);
    } catch (error) {
      this.logger.error('Error retrieving behavior preference', { 
        error, userId, preferenceType 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Records behavior history
   * 
   * @param {string} userId - User identifier
   * @param {string} behaviorType - Type of behavior
   * @param {Object} behaviorData - Behavior data
   * @param {Object} [options] - Storage options
   * @param {boolean} [options.immediate=false] - Whether to persist immediately
   * @returns {Promise<Object>} Recorded history entry
   */
  async recordHistory(userId, behaviorType, behaviorData, options = {}) {
    const lockKey = `record_history_${userId}_${behaviorType}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Recording behavior history', { 
        userId, behaviorType 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!behaviorType) {
        throw new Error('Behavior type is required');
      }
      if (!behaviorData || typeof behaviorData !== 'object') {
        throw new Error('Behavior data must be an object');
      }
      
      // Create user history map if it doesn't exist
      if (!this.cache.history.has(userId)) {
        this.cache.history.set(userId, new Map());
      }
      
      // Create behavior type array if it doesn't exist
      if (!this.cache.history.get(userId).has(behaviorType)) {
        this.cache.history.get(userId).set(behaviorType, []);
      }
      
      // Create history entry with metadata
      const historyEntry = {
        type: behaviorType,
        data: behaviorData,
        timestamp: Date.now(),
        id: `${userId}_${behaviorType}_${Date.now()}`
      };
      
      // Add to history array
      const historyArray = this.cache.history.get(userId).get(behaviorType);
      historyArray.push(historyEntry);
      
      // Trim history if it exceeds max size
      if (historyArray.length > this.config.maxHistoryItems) {
        historyArray.splice(0, historyArray.length - this.config.maxHistoryItems);
      }
      
      // Persist immediately if requested
      if (options.immediate && this.config.persistenceEnabled) {
        await this._persistHistory(userId, behaviorType);
      } else if (this.config.persistenceEnabled) {
        this.storageStatus.pendingWrites++;
      }
      
      // Emit event
      this.events.emit('history_recorded', {
        userId,
        behaviorType,
        historyEntry
      });
      
      return historyEntry;
    } catch (error) {
      this.logger.error('Error recording behavior history', { 
        error, userId, behaviorType 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Retrieves behavior history
   * 
   * @param {string} userId - User identifier
   * @param {string} [behaviorType] - Type of behavior (optional, returns all if not specified)
   * @param {Object} [options] - Retrieval options
   * @param {number} [options.limit] - Maximum number of entries to return
   * @param {number} [options.offset] - Offset for pagination
   * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
   * @returns {Promise<Array|Map>} Retrieved history entries
   */
  async getHistory(userId, behaviorType, options = {}) {
    const lockKey = `get_history_${userId}_${behaviorType || 'all'}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Retrieving behavior history', { 
        userId, behaviorType 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Set default options
      const limit = options.limit || this.config.maxHistoryItems;
      const offset = options.offset || 0;
      const sortOrder = options.sortOrder || 'desc';
      
      // Check if user history exists
      if (!this.cache.history.has(userId)) {
        if (behaviorType) {
          return [];
        } else {
          return new Map();
        }
      }
      
      // Return specific behavior history if type is specified
      if (behaviorType) {
        const history = this.cache.history.get(userId).get(behaviorType) || [];
        
        // Sort history
        const sortedHistory = [...history].sort((a, b) => {
          return sortOrder === 'asc' 
            ? a.timestamp - b.timestamp 
            : b.timestamp - a.timestamp;
        });
        
        // Apply pagination
        return sortedHistory.slice(offset, offset + limit);
      }
      
      // Return all history for user
      const allHistory = new Map();
      for (const [type, entries] of this.cache.history.get(userId).entries()) {
        // Sort history
        const sortedEntries = [...entries].sort((a, b) => {
          return sortOrder === 'asc' 
            ? a.timestamp - b.timestamp 
            : b.timestamp - a.timestamp;
        });
        
        // Apply pagination
        allHistory.set(type, sortedEntries.slice(offset, offset + limit));
      }
      
      return allHistory;
    } catch (error) {
      this.logger.error('Error retrieving behavior history', { 
        error, userId, behaviorType 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Stores learned behavior
   * 
   * @param {string} userId - User identifier
   * @param {string} behaviorId - Behavior identifier
   * @param {Object} behaviorData - Learned behavior data
   * @param {Object} [options] - Storage options
   * @param {boolean} [options.immediate=false] - Whether to persist immediately
   * @returns {Promise<Object>} Stored learned behavior
   */
  async storeLearnedBehavior(userId, behaviorId, behaviorData, options = {}) {
    const lockKey = `store_learned_${userId}_${behaviorId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Storing learned behavior', { 
        userId, behaviorId 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!behaviorId) {
        throw new Error('Behavior ID is required');
      }
      if (!behaviorData || typeof behaviorData !== 'object') {
        throw new Error('Behavior data must be an object');
      }
      
      // Create user learned map if it doesn't exist
      if (!this.cache.learned.has(userId)) {
        this.cache.learned.set(userId, new Map());
      }
      
      // Create learned behavior object with metadata
      const learnedBehavior = {
        id: behaviorId,
        data: behaviorData,
        created: behaviorData.created || Date.now(),
        lastUpdated: Date.now(),
        version: behaviorData.version || 1
      };
      
      // Store in cache
      this.cache.learned.get(userId).set(behaviorId, learnedBehavior);
      
      // Persist immediately if requested
      if (options.immediate && this.config.persistenceEnabled) {
        await this._persistLearnedBehavior(userId, behaviorId, learnedBehavior);
      } else if (this.config.persistenceEnabled) {
        this.storageStatus.pendingWrites++;
      }
      
      // Emit event
      this.events.emit('learned_behavior_stored', {
        userId,
        behaviorId,
        learnedBehavior
      });
      
      return learnedBehavior;
    } catch (error) {
      this.logger.error('Error storing learned behavior', { 
        error, userId, behaviorId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Retrieves learned behavior
   * 
   * @param {string} userId - User identifier
   * @param {string} [behaviorId] - Behavior identifier (optional, returns all if not specified)
   * @returns {Promise<Object|Map>} Retrieved learned behavior
   */
  async getLearnedBehavior(userId, behaviorId) {
    const lockKey = `get_learned_${userId}_${behaviorId || 'all'}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Retrieving learned behavior', { 
        userId, behaviorId 
      });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check if user learned behaviors exist
      if (!this.cache.learned.has(userId)) {
        if (behaviorId) {
          return null;
        } else {
          return new Map();
        }
      }
      
      // Return specific learned behavior if ID is specified
      if (behaviorId) {
        const learnedBehavior = this.cache.learned.get(userId).get(behaviorId);
        return learnedBehavior || null;
      }
      
      // Return all learned behaviors for user
      return this.cache.learned.get(userId);
    } catch (error) {
      this.logger.error('Error retrieving learned behavior', { 
        error, userId, behaviorId 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Synchronizes in-memory cache with persistent storage
   * 
   * @param {Object} [options] - Sync options
   * @param {boolean} [options.force=false] - Whether to force sync even if no changes
   * @returns {Promise<Object>} Sync result
   */
  async syncStorage(options = {}) {
    const lockKey = 'sync_storage';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      if (!this.config.persistenceEnabled) {
        this.logger.warn('Persistence is disabled, sync operation skipped');
        return { success: false, reason: 'persistence_disabled' };
      }
      
      this.logger.debug('Synchronizing storage');
      
      // Skip if no pending writes and not forced
      if (this.storageStatus.pendingWrites === 0 && !options.force) {
        this.logger.debug('No pending writes, sync skipped');
        return { success: true, changes: 0 };
      }
      
      // Persist all data
      let changes = 0;
      
      // Persist preferences
      for (const [userId, preferences] of this.cache.preferences.entries()) {
        for (const [preferenceType, preference] of preferences.entries()) {
          await this._persistPreference(userId, preferenceType, preference);
          changes++;
        }
      }
      
      // Persist history
      for (const [userId, historyMap] of this.cache.history.entries()) {
        for (const behaviorType of historyMap.keys()) {
          await this._persistHistory(userId, behaviorType);
          changes++;
        }
      }
      
      // Persist learned behaviors
      for (const [userId, behaviors] of this.cache.learned.entries()) {
        for (const [behaviorId, behavior] of behaviors.entries()) {
          await this._persistLearnedBehavior(userId, behaviorId, behavior);
          changes++;
        }
      }
      
      // Update storage status
      this.storageStatus.lastSync = Date.now();
      this.storageStatus.pendingWrites = 0;
      
      // Emit event
      this.events.emit('storage_synced', {
        timestamp: this.storageStatus.lastSync,
        changes
      });
      
      return {
        success: true,
        timestamp: this.storageStatus.lastSync,
        changes
      };
    } catch (error) {
      this.logger.error('Error synchronizing storage', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Clears behavior data for a user
   * 
   * @param {string} userId - User identifier
   * @param {string} [dataType] - Type of data to clear (preferences, history, learned, or all)
   * @returns {Promise<Object>} Clear result
   */
  async clearUserData(userId, dataType = 'all') {
    const lockKey = `clear_user_data_${userId}_${dataType}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Clearing user behavior data', { userId, dataType });
      
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const validTypes = ['preferences', 'history', 'learned', 'all'];
      if (!validTypes.includes(dataType)) {
        throw new Error(`Invalid data type: ${dataType}. Must be one of: ${validTypes.join(', ')}`);
      }
      
      // Clear data based on type
      if (dataType === 'all' || dataType === 'preferences') {
        this.cache.preferences.delete(userId);
        
        if (this.config.persistenceEnabled) {
          const preferencesDir = path.join(this.storageDirectory, 'preferences', userId);
          try {
            await fs.rm(preferencesDir, { recursive: true, force: true });
          } catch (err) {
            // Ignore if directory doesn't exist
            if (err.code !== 'ENOENT') {
              throw err;
            }
          }
        }
      }
      
      if (dataType === 'all' || dataType === 'history') {
        this.cache.history.delete(userId);
        
        if (this.config.persistenceEnabled) {
          const historyDir = path.join(this.storageDirectory, 'history', userId);
          try {
            await fs.rm(historyDir, { recursive: true, force: true });
          } catch (err) {
            // Ignore if directory doesn't exist
            if (err.code !== 'ENOENT') {
              throw err;
            }
          }
        }
      }
      
      if (dataType === 'all' || dataType === 'learned') {
        this.cache.learned.delete(userId);
        
        if (this.config.persistenceEnabled) {
          const learnedDir = path.join(this.storageDirectory, 'learned', userId);
          try {
            await fs.rm(learnedDir, { recursive: true, force: true });
          } catch (err) {
            // Ignore if directory doesn't exist
            if (err.code !== 'ENOENT') {
              throw err;
            }
          }
        }
      }
      
      // Emit event
      this.events.emit('user_data_cleared', {
        userId,
        dataType
      });
      
      return {
        success: true,
        userId,
        dataType
      };
    } catch (error) {
      this.logger.error('Error clearing user behavior data', { 
        error, userId, dataType 
      });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets storage status
   * 
   * @returns {Object} Storage status
   */
  getStorageStatus() {
    return { ...this.storageStatus };
  }
  
  /**
   * Updates manager configuration
   * 
   * @param {Object} configUpdates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(configUpdates) {
    const lockKey = 'update_behavior_persistence_config';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error('BehaviorPersistenceManager not initialized');
      }
      
      this.logger.debug('Updating configuration', { 
        updateKeys: Object.keys(configUpdates) 
      });
      
      const oldConfig = { ...this.config };
      
      // Update configuration
      this.config = {
        ...this.config,
        ...configUpdates
      };
      
      // Handle auto-sync changes
      if (oldConfig.autoSyncInterval !== this.config.autoSyncInterval ||
          oldConfig.persistenceEnabled !== this.config.persistenceEnabled) {
        // Stop existing timer
        if (this.autoSyncTimer) {
          clearInterval(this.autoSyncTimer);
          this.autoSyncTimer = null;
        }
        
        // Start new timer if enabled
        if (this.config.persistenceEnabled && this.config.autoSyncInterval > 0) {
          this._startAutoSync();
        }
      }
      
      // Emit event
      this.events.emit('config_updated', this.config);
      
      return { ...this.config };
    } catch (error) {
      this.logger.error('Error updating configuration', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets current manager configuration
   * 
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Registers an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    this.events.on(event, listener);
  }
  
  /**
   * Removes an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
  
  /**
   * Shuts down the behavior persistence manager
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    const lockKey = 'behavior_persistence_shutdown';
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn('BehaviorPersistenceManager not initialized, nothing to shut down');
        return;
      }
      
      this.logger.info('Shutting down BehaviorPersistenceManager');
      
      // Sync storage before shutdown
      if (this.config.persistenceEnabled && this.storageStatus.pendingWrites > 0) {
        try {
          await this.syncStorage({ force: true });
        } catch (error) {
          this.logger.error('Error syncing storage during shutdown', { error });
        }
      }
      
      // Stop auto-sync timer
      if (this.autoSyncTimer) {
        clearInterval(this.autoSyncTimer);
        this.autoSyncTimer = null;
      }
      
      this.isInitialized = false;
      this.events.emit('shutdown');
      this.logger.info('BehaviorPersistenceManager shut down');
    } catch (error) {
      this.logger.error('Error shutting down BehaviorPersistenceManager', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Ensures storage directory exists
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _ensureStorageDirectoryExists() {
    try {
      await fs.mkdir(this.storageDirectory, { recursive: true });
      this.logger.debug('Storage directory ensured', { 
        directory: this.storageDirectory 
      });
    } catch (error) {
      this.logger.error('Error ensuring storage directory exists', { 
        error, directory: this.storageDirectory 
      });
      throw error;
    }
  }
  
  /**
   * Initializes storage structure
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _initializeStorageStructure() {
    try {
      // Create subdirectories for different data types
      const subdirs = ['preferences', 'history', 'learned'];
      
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.storageDirectory, subdir), { recursive: true });
      }
      
      this.logger.debug('Storage structure initialized');
    } catch (error) {
      this.logger.error('Error initializing storage structure', { error });
      throw error;
    }
  }
  
  /**
   * Loads existing data from storage
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadExistingData() {
    try {
      // Load preferences
      await this._loadPreferences();
      
      // Load history
      await this._loadHistory();
      
      // Load learned behaviors
      await this._loadLearnedBehaviors();
      
      this.logger.debug('Existing data loaded');
    } catch (error) {
      this.logger.error('Error loading existing data', { error });
      throw error;
    }
  }
  
  /**
   * Loads preferences from storage
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadPreferences() {
    try {
      const preferencesDir = path.join(this.storageDirectory, 'preferences');
      
      // Check if directory exists
      try {
        await fs.access(preferencesDir);
      } catch (err) {
        // Directory doesn't exist, nothing to load
        return;
      }
      
      // Get user directories
      const userDirs = await fs.readdir(preferencesDir);
      
      for (const userId of userDirs) {
        const userDir = path.join(preferencesDir, userId);
        const stats = await fs.stat(userDir);
        
        if (!stats.isDirectory()) {
          continue;
        }
        
        // Create user preference map
        this.cache.preferences.set(userId, new Map());
        
        // Get preference files
        const preferenceFiles = await fs.readdir(userDir);
        
        for (const file of preferenceFiles) {
          if (!file.endsWith('.json')) {
            continue;
          }
          
          const preferenceType = file.slice(0, -5); // Remove .json extension
          const filePath = path.join(userDir, file);
          
          try {
            const data = await fs.readFile(filePath, 'utf8');
            const preference = JSON.parse(data);
            
            this.cache.preferences.get(userId).set(preferenceType, preference);
          } catch (err) {
            this.logger.warn('Error loading preference file', { 
              error: err, userId, preferenceType, filePath 
            });
          }
        }
      }
      
      this.logger.debug('Preferences loaded');
    } catch (error) {
      this.logger.error('Error loading preferences', { error });
      throw error;
    }
  }
  
  /**
   * Loads history from storage
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadHistory() {
    try {
      const historyDir = path.join(this.storageDirectory, 'history');
      
      // Check if directory exists
      try {
        await fs.access(historyDir);
      } catch (err) {
        // Directory doesn't exist, nothing to load
        return;
      }
      
      // Get user directories
      const userDirs = await fs.readdir(historyDir);
      
      for (const userId of userDirs) {
        const userDir = path.join(historyDir, userId);
        const stats = await fs.stat(userDir);
        
        if (!stats.isDirectory()) {
          continue;
        }
        
        // Create user history map
        this.cache.history.set(userId, new Map());
        
        // Get behavior type files
        const behaviorFiles = await fs.readdir(userDir);
        
        for (const file of behaviorFiles) {
          if (!file.endsWith('.json')) {
            continue;
          }
          
          const behaviorType = file.slice(0, -5); // Remove .json extension
          const filePath = path.join(userDir, file);
          
          try {
            const data = await fs.readFile(filePath, 'utf8');
            const history = JSON.parse(data);
            
            if (Array.isArray(history)) {
              this.cache.history.get(userId).set(behaviorType, history);
            }
          } catch (err) {
            this.logger.warn('Error loading history file', { 
              error: err, userId, behaviorType, filePath 
            });
          }
        }
      }
      
      this.logger.debug('History loaded');
    } catch (error) {
      this.logger.error('Error loading history', { error });
      throw error;
    }
  }
  
  /**
   * Loads learned behaviors from storage
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadLearnedBehaviors() {
    try {
      const learnedDir = path.join(this.storageDirectory, 'learned');
      
      // Check if directory exists
      try {
        await fs.access(learnedDir);
      } catch (err) {
        // Directory doesn't exist, nothing to load
        return;
      }
      
      // Get user directories
      const userDirs = await fs.readdir(learnedDir);
      
      for (const userId of userDirs) {
        const userDir = path.join(learnedDir, userId);
        const stats = await fs.stat(userDir);
        
        if (!stats.isDirectory()) {
          continue;
        }
        
        // Create user learned map
        this.cache.learned.set(userId, new Map());
        
        // Get behavior files
        const behaviorFiles = await fs.readdir(userDir);
        
        for (const file of behaviorFiles) {
          if (!file.endsWith('.json')) {
            continue;
          }
          
          const behaviorId = file.slice(0, -5); // Remove .json extension
          const filePath = path.join(userDir, file);
          
          try {
            const data = await fs.readFile(filePath, 'utf8');
            const behavior = JSON.parse(data);
            
            this.cache.learned.get(userId).set(behaviorId, behavior);
          } catch (err) {
            this.logger.warn('Error loading learned behavior file', { 
              error: err, userId, behaviorId, filePath 
            });
          }
        }
      }
      
      this.logger.debug('Learned behaviors loaded');
    } catch (error) {
      this.logger.error('Error loading learned behaviors', { error });
      throw error;
    }
  }
  
  /**
   * Persists preference to storage
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {string} preferenceType - Type of preference
   * @param {Object} preference - Preference data
   * @returns {Promise<void>}
   */
  async _persistPreference(userId, preferenceType, preference) {
    try {
      if (!this.config.persistenceEnabled) {
        return;
      }
      
      const userDir = path.join(this.storageDirectory, 'preferences', userId);
      await fs.mkdir(userDir, { recursive: true });
      
      const filePath = path.join(userDir, `${preferenceType}.json`);
      await fs.writeFile(filePath, JSON.stringify(preference, null, 2));
      
      this.logger.debug('Preference persisted', { 
        userId, preferenceType, filePath 
      });
    } catch (error) {
      this.logger.error('Error persisting preference', { 
        error, userId, preferenceType 
      });
      throw error;
    }
  }
  
  /**
   * Persists history to storage
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {string} behaviorType - Type of behavior
   * @returns {Promise<void>}
   */
  async _persistHistory(userId, behaviorType) {
    try {
      if (!this.config.persistenceEnabled) {
        return;
      }
      
      const userDir = path.join(this.storageDirectory, 'history', userId);
      await fs.mkdir(userDir, { recursive: true });
      
      const filePath = path.join(userDir, `${behaviorType}.json`);
      const history = this.cache.history.get(userId).get(behaviorType);
      
      await fs.writeFile(filePath, JSON.stringify(history, null, 2));
      
      this.logger.debug('History persisted', { 
        userId, behaviorType, filePath, entries: history.length 
      });
    } catch (error) {
      this.logger.error('Error persisting history', { 
        error, userId, behaviorType 
      });
      throw error;
    }
  }
  
  /**
   * Persists learned behavior to storage
   * 
   * @private
   * @param {string} userId - User identifier
   * @param {string} behaviorId - Behavior identifier
   * @param {Object} behavior - Learned behavior data
   * @returns {Promise<void>}
   */
  async _persistLearnedBehavior(userId, behaviorId, behavior) {
    try {
      if (!this.config.persistenceEnabled) {
        return;
      }
      
      const userDir = path.join(this.storageDirectory, 'learned', userId);
      await fs.mkdir(userDir, { recursive: true });
      
      const filePath = path.join(userDir, `${behaviorId}.json`);
      await fs.writeFile(filePath, JSON.stringify(behavior, null, 2));
      
      this.logger.debug('Learned behavior persisted', { 
        userId, behaviorId, filePath 
      });
    } catch (error) {
      this.logger.error('Error persisting learned behavior', { 
        error, userId, behaviorId 
      });
      throw error;
    }
  }
  
  /**
   * Starts auto-sync timer
   * 
   * @private
   */
  _startAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }
    
    this.autoSyncTimer = setInterval(async () => {
      try {
        if (this.storageStatus.pendingWrites > 0) {
          await this.syncStorage();
        }
      } catch (error) {
        this.logger.error('Error in auto-sync', { error });
      }
    }, this.config.autoSyncInterval);
    
    this.logger.debug('Auto-sync started', { 
      interval: this.config.autoSyncInterval 
    });
  }
}

module.exports = { BehaviorPersistenceManager };
