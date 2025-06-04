/**
 * @fileoverview Context Synchronization Service for multi-device operation.
 * 
 * This module provides a service for synchronizing context across multiple devices,
 * supporting offline operation, bandwidth-efficient synchronization, and device capability awareness.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * ContextSynchronizationService manages context synchronization across multiple devices.
 */
class ContextSynchronizationService {
  /**
   * Constructor for ContextSynchronizationService.
   * @param {Object} dependencies Required dependencies
   * @param {Object} dependencies.logger Logger instance
   * @param {Object} dependencies.performanceMonitor Performance Monitor instance
   * @param {Object} dependencies.configService Configuration Service instance
   * @param {Object} dependencies.mcpContextManager MCP Context Manager instance
   * @param {Object} dependencies.contextSecurityManager Context Security Manager instance
   * @param {Object} dependencies.contextCompressionManager Context Compression Manager instance
   * @param {Object} dependencies.lockAdapter Lock Adapter instance
   */
  constructor(dependencies) {
    // Validate dependencies
    if (!dependencies) {
      throw new Error('Dependencies are required');
    }
    
    const { 
      logger, 
      performanceMonitor, 
      configService, 
      mcpContextManager,
      contextSecurityManager,
      contextCompressionManager,
      lockAdapter
    } = dependencies;
    
    if (!logger) {
      throw new Error('Logger is required');
    }
    
    if (!performanceMonitor) {
      throw new Error('Performance Monitor is required');
    }
    
    if (!configService) {
      throw new Error('Configuration Service is required');
    }
    
    if (!mcpContextManager) {
      throw new Error('MCP Context Manager is required');
    }
    
    if (!contextSecurityManager) {
      throw new Error('Context Security Manager is required');
    }
    
    if (!contextCompressionManager) {
      throw new Error('Context Compression Manager is required');
    }
    
    if (!lockAdapter) {
      throw new Error('Lock Adapter is required');
    }
    
    // Store dependencies
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.configService = configService;
    this.mcpContextManager = mcpContextManager;
    this.contextSecurityManager = contextSecurityManager;
    this.contextCompressionManager = contextCompressionManager;
    
    // Initialize locks
    this.locks = {
      sync: lockAdapter.createLock('contextSynchronization'),
      device: lockAdapter.createLock('deviceRegistration'),
      conflict: lockAdapter.createLock('conflictResolution'),
      queue: lockAdapter.createLock('syncQueue')
    };
    
    // Initialize state
    this.initialized = false;
    this.syncInProgress = false;
    this.registeredDevices = new Map();
    this.syncQueue = [];
    this.syncHistory = [];
    this.conflictResolutionStrategies = new Map();
    this.deviceCapabilities = new Map();
    this.offlineChanges = new Map();
    
    // Configure from service
    this.config = this.configService.getConfig('contextSynchronizationService') || {
      syncIntervalSeconds: 300, // 5 minutes
      maxSyncHistoryItems: 100,
      maxOfflineChanges: 1000,
      compressionEnabled: true,
      priorityContextTypes: ['user.preferences', 'user.history', 'app.state'],
      conflictResolutionStrategy: 'lastWriteWins',
      bandwidthOptimization: true,
      deltaUpdatesOnly: true,
      maxConcurrentSyncs: 3,
      offlineOperationEnabled: true,
      deviceCapabilityAware: true
    };
    
    // Register default conflict resolution strategies
    this._registerDefaultConflictResolutionStrategies();
    
    this.logger.info('ContextSynchronizationService created');
  }
  
  /**
   * Initialize the context synchronization service.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.debug('Initializing context synchronization service');
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('initContextSync');
      
      // Check if already initialized
      if (this.initialized) {
        this.logger.debug('Context synchronization service already initialized');
        return true;
      }
      
      // Register with MCP Context Manager
      await this.mcpContextManager.registerContextProvider('synchronization', this);
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Start periodic sync if enabled
      if (options.startPeriodicSync !== false && this.config.syncIntervalSeconds > 0) {
        this._startPeriodicSync();
      }
      
      // Set initialized state
      this.initialized = true;
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfTimer);
      
      this.logger.info('Context synchronization service initialized');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize context synchronization service: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Register a device for synchronization.
   * @param {Object} deviceInfo Device information
   * @param {string} deviceInfo.id Device ID
   * @param {string} deviceInfo.name Device name
   * @param {string} deviceInfo.type Device type
   * @param {Object} deviceInfo.capabilities Device capabilities
   * @param {Object} options Registration options
   * @returns {Promise<Object>} Registration result
   */
  async registerDevice(deviceInfo, options = {}) {
    try {
      this.logger.debug('Registering device', { deviceId: deviceInfo.id });
      
      // Validate device info
      if (!deviceInfo || !deviceInfo.id) {
        throw new Error('Device ID is required');
      }
      
      // Acquire lock
      await this.locks.device();
      
      try {
        // Check if device already registered
        const existingDevice = this.registeredDevices.get(deviceInfo.id);
        
        if (existingDevice) {
          // Update existing device
          const updatedDevice = {
            ...existingDevice,
            ...deviceInfo,
            lastSeen: Date.now(),
            updateCount: (existingDevice.updateCount || 0) + 1
          };
          
          this.registeredDevices.set(deviceInfo.id, updatedDevice);
          
          // Update device capabilities
          if (deviceInfo.capabilities) {
            this.deviceCapabilities.set(deviceInfo.id, deviceInfo.capabilities);
          }
          
          this.logger.debug('Updated existing device registration', { deviceId: deviceInfo.id });
          
          return {
            success: true,
            deviceId: deviceInfo.id,
            status: 'updated',
            lastSync: existingDevice.lastSync
          };
        } else {
          // Register new device
          const newDevice = {
            ...deviceInfo,
            registered: Date.now(),
            lastSeen: Date.now(),
            lastSync: null,
            syncCount: 0,
            updateCount: 0,
            status: 'active'
          };
          
          this.registeredDevices.set(deviceInfo.id, newDevice);
          
          // Store device capabilities
          if (deviceInfo.capabilities) {
            this.deviceCapabilities.set(deviceInfo.id, deviceInfo.capabilities);
          }
          
          this.logger.info('Registered new device', { deviceId: deviceInfo.id, deviceType: deviceInfo.type });
          
          return {
            success: true,
            deviceId: deviceInfo.id,
            status: 'registered',
            lastSync: null
          };
        }
      } finally {
        // Release lock
        this.locks.device.release();
      }
    } catch (error) {
      this.logger.error(`Failed to register device: ${error.message}`, { error, deviceId: deviceInfo?.id });
      throw error;
    }
  }
  
  /**
   * Unregister a device from synchronization.
   * @param {string} deviceId Device ID
   * @param {Object} options Unregistration options
   * @returns {Promise<boolean>} True if unregistration was successful
   */
  async unregisterDevice(deviceId, options = {}) {
    try {
      this.logger.debug('Unregistering device', { deviceId });
      
      // Validate device ID
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      // Acquire lock
      await this.locks.device();
      
      try {
        // Check if device is registered
        if (!this.registeredDevices.has(deviceId)) {
          this.logger.debug('Device not registered', { deviceId });
          return false;
        }
        
        // Remove device
        this.registeredDevices.delete(deviceId);
        this.deviceCapabilities.delete(deviceId);
        
        // Remove offline changes for this device
        this.offlineChanges.delete(deviceId);
        
        this.logger.info('Unregistered device', { deviceId });
        
        return true;
      } finally {
        // Release lock
        this.locks.device.release();
      }
    } catch (error) {
      this.logger.error(`Failed to unregister device: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Synchronize context with a device.
   * @param {string} deviceId Device ID
   * @param {Object} syncData Synchronization data
   * @param {Object} options Synchronization options
   * @returns {Promise<Object>} Synchronization result
   */
  async synchronize(deviceId, syncData = {}, options = {}) {
    try {
      this.logger.debug('Synchronizing context with device', { deviceId });
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('syncContext');
      
      // Validate device ID
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      // Check if device is registered
      if (!this.registeredDevices.has(deviceId)) {
        throw new Error(`Device not registered: ${deviceId}`);
      }
      
      // Acquire lock
      await this.locks.sync();
      
      try {
        // Set sync in progress
        this.syncInProgress = true;
        
        // Get device info
        const deviceInfo = this.registeredDevices.get(deviceId);
        
        // Process incoming changes
        const processedChanges = await this._processIncomingChanges(deviceId, syncData.changes || [], options);
        
        // Get outgoing changes
        const outgoingChanges = await this._getOutgoingChanges(deviceId, syncData.lastSyncTimestamp, options);
        
        // Resolve conflicts
        const resolvedConflicts = await this._resolveConflicts(deviceId, processedChanges, outgoingChanges, options);
        
        // Update device sync info
        const syncTimestamp = Date.now();
        deviceInfo.lastSync = syncTimestamp;
        deviceInfo.lastSeen = syncTimestamp;
        deviceInfo.syncCount = (deviceInfo.syncCount || 0) + 1;
        this.registeredDevices.set(deviceId, deviceInfo);
        
        // Add to sync history
        this._addToSyncHistory({
          deviceId,
          timestamp: syncTimestamp,
          incomingChanges: (syncData.changes || []).length,
          outgoingChanges: outgoingChanges.length,
          conflicts: resolvedConflicts.length
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Return sync result
        return {
          success: true,
          timestamp: syncTimestamp,
          changes: outgoingChanges,
          conflicts: resolvedConflicts,
          stats: {
            processedChanges: processedChanges.length,
            outgoingChanges: outgoingChanges.length,
            resolvedConflicts: resolvedConflicts.length
          }
        };
      } finally {
        // Reset sync in progress
        this.syncInProgress = false;
        
        // Release lock
        this.locks.sync.release();
      }
    } catch (error) {
      this.logger.error(`Failed to synchronize context: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Queue changes for offline synchronization.
   * @param {string} deviceId Device ID
   * @param {Array<Object>} changes Context changes
   * @param {Object} options Queue options
   * @returns {Promise<boolean>} True if queuing was successful
   */
  async queueOfflineChanges(deviceId, changes, options = {}) {
    try {
      this.logger.debug('Queuing offline changes', { deviceId, changeCount: changes.length });
      
      // Validate inputs
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      if (!Array.isArray(changes)) {
        throw new Error('Changes must be an array');
      }
      
      // Acquire lock
      await this.locks.queue();
      
      try {
        // Get existing offline changes for this device
        let deviceChanges = this.offlineChanges.get(deviceId) || [];
        
        // Add timestamp to changes
        const timestampedChanges = changes.map(change => ({
          ...change,
          queuedAt: Date.now()
        }));
        
        // Add to queue
        deviceChanges = [...deviceChanges, ...timestampedChanges];
        
        // Enforce max queue size
        if (deviceChanges.length > this.config.maxOfflineChanges) {
          deviceChanges = deviceChanges.slice(deviceChanges.length - this.config.maxOfflineChanges);
          this.logger.warn('Offline changes queue truncated due to size limit', { deviceId, newSize: deviceChanges.length });
        }
        
        // Update queue
        this.offlineChanges.set(deviceId, deviceChanges);
        
        this.logger.debug('Queued offline changes', { deviceId, totalQueuedChanges: deviceChanges.length });
        
        return true;
      } finally {
        // Release lock
        this.locks.queue.release();
      }
    } catch (error) {
      this.logger.error(`Failed to queue offline changes: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Get queued offline changes for a device.
   * @param {string} deviceId Device ID
   * @param {Object} options Options
   * @returns {Promise<Array<Object>>} Queued changes
   */
  async getOfflineChanges(deviceId, options = {}) {
    try {
      this.logger.debug('Getting offline changes', { deviceId });
      
      // Validate device ID
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      // Get offline changes
      const changes = this.offlineChanges.get(deviceId) || [];
      
      // Apply filters if specified
      let filteredChanges = [...changes];
      
      if (options.since) {
        filteredChanges = filteredChanges.filter(change => change.queuedAt >= options.since);
      }
      
      if (options.contextTypes && Array.isArray(options.contextTypes)) {
        filteredChanges = filteredChanges.filter(change => options.contextTypes.includes(change.contextType));
      }
      
      if (options.limit) {
        filteredChanges = filteredChanges.slice(0, options.limit);
      }
      
      this.logger.debug('Retrieved offline changes', { deviceId, changeCount: filteredChanges.length });
      
      return filteredChanges;
    } catch (error) {
      this.logger.error(`Failed to get offline changes: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Clear queued offline changes for a device.
   * @param {string} deviceId Device ID
   * @param {Object} options Options
   * @returns {Promise<boolean>} True if clearing was successful
   */
  async clearOfflineChanges(deviceId, options = {}) {
    try {
      this.logger.debug('Clearing offline changes', { deviceId });
      
      // Validate device ID
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      // Acquire lock
      await this.locks.queue();
      
      try {
        // Check if specific changes should be cleared
        if (options.changeIds && Array.isArray(options.changeIds)) {
          // Get existing changes
          const changes = this.offlineChanges.get(deviceId) || [];
          
          // Filter out specified changes
          const filteredChanges = changes.filter(change => !options.changeIds.includes(change.id));
          
          // Update queue
          this.offlineChanges.set(deviceId, filteredChanges);
          
          this.logger.debug('Cleared specific offline changes', { 
            deviceId, 
            clearedCount: changes.length - filteredChanges.length,
            remainingCount: filteredChanges.length 
          });
        } else {
          // Clear all changes
          this.offlineChanges.delete(deviceId);
          
          this.logger.debug('Cleared all offline changes', { deviceId });
        }
        
        return true;
      } finally {
        // Release lock
        this.locks.queue.release();
      }
    } catch (error) {
      this.logger.error(`Failed to clear offline changes: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Register a conflict resolution strategy.
   * @param {string} strategyName Strategy name
   * @param {Function} strategyFn Strategy function
   * @returns {boolean} True if registration was successful
   */
  registerConflictResolutionStrategy(strategyName, strategyFn) {
    try {
      if (!strategyName) {
        throw new Error('Strategy name is required');
      }
      
      if (typeof strategyFn !== 'function') {
        throw new Error('Strategy function is required');
      }
      
      this.conflictResolutionStrategies.set(strategyName, strategyFn);
      this.logger.debug(`Registered conflict resolution strategy: ${strategyName}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register conflict resolution strategy: ${error.message}`, { error, strategyName });
      throw error;
    }
  }
  
  /**
   * Get synchronization status for a device.
   * @param {string} deviceId Device ID
   * @returns {Promise<Object>} Synchronization status
   */
  async getSyncStatus(deviceId) {
    try {
      this.logger.debug('Getting sync status', { deviceId });
      
      // Validate device ID
      if (!deviceId) {
        throw new Error('Device ID is required');
      }
      
      // Check if device is registered
      if (!this.registeredDevices.has(deviceId)) {
        throw new Error(`Device not registered: ${deviceId}`);
      }
      
      // Get device info
      const deviceInfo = this.registeredDevices.get(deviceId);
      
      // Get offline changes
      const offlineChanges = this.offlineChanges.get(deviceId) || [];
      
      // Get sync history for this device
      const deviceSyncHistory = this.syncHistory.filter(entry => entry.deviceId === deviceId);
      
      // Create status object
      const status = {
        deviceId,
        registered: deviceInfo.registered,
        lastSeen: deviceInfo.lastSeen,
        lastSync: deviceInfo.lastSync,
        syncCount: deviceInfo.syncCount || 0,
        offlineChanges: offlineChanges.length,
        syncHistory: deviceSyncHistory.slice(0, 10), // Last 10 sync events
        status: deviceInfo.status || 'active'
      };
      
      return status;
    } catch (error) {
      this.logger.error(`Failed to get sync status: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Process incoming changes from a device.
   * @private
   * @param {string} deviceId Device ID
   * @param {Array<Object>} changes Incoming changes
   * @param {Object} options Processing options
   * @returns {Promise<Array<Object>>} Processed changes
   */
  async _processIncomingChanges(deviceId, changes, options) {
    const processedChanges = [];
    
    for (const change of changes) {
      try {
        // Validate change
        if (!change.contextType) {
          this.logger.warn('Skipping change without contextType', { deviceId, change });
          continue;
        }
        
        // Check security
        const hasAccess = await this.contextSecurityManager.checkAccess(
          deviceId,
          change.contextType,
          'write'
        );
        
        if (!hasAccess) {
          this.logger.warn('Access denied for context change', { deviceId, contextType: change.contextType });
          continue;
        }
        
        // Decompress if needed
        let contextData = change.contextData;
        
        if (change.compressed) {
          contextData = await this.contextCompressionManager.decompressContext(contextData);
        }
        
        // Apply change
        await this.mcpContextManager.publishContext(
          change.contextType,
          contextData,
          {
            source: deviceId,
            timestamp: change.timestamp || Date.now(),
            metadata: {
              ...change.metadata,
              syncSource: deviceId,
              syncTimestamp: Date.now()
            }
          }
        );
        
        // Add to processed changes
        processedChanges.push({
          id: change.id,
          contextType: change.contextType,
          timestamp: change.timestamp || Date.now(),
          status: 'applied'
        });
      } catch (error) {
        this.logger.error(`Failed to process change: ${error.message}`, { error, deviceId, changeId: change.id });
        
        // Add to processed changes with error
        processedChanges.push({
          id: change.id,
          contextType: change.contextType,
          timestamp: change.timestamp || Date.now(),
          status: 'error',
          error: error.message
        });
      }
    }
    
    return processedChanges;
  }
  
  /**
   * Get outgoing changes for a device.
   * @private
   * @param {string} deviceId Device ID
   * @param {number} lastSyncTimestamp Last sync timestamp
   * @param {Object} options Options
   * @returns {Promise<Array<Object>>} Outgoing changes
   */
  async _getOutgoingChanges(deviceId, lastSyncTimestamp, options) {
    // Get device capabilities
    const deviceCapabilities = this.deviceCapabilities.get(deviceId) || {};
    
    // Get context types to sync
    let contextTypes = [];
    
    if (options.contextTypes && Array.isArray(options.contextTypes)) {
      // Use specified context types
      contextTypes = options.contextTypes;
    } else {
      // Get all available context types
      const availableTypes = await this.mcpContextManager.getAvailableContextTypes();
      
      // Filter by priority if device capability aware
      if (this.config.deviceCapabilityAware && deviceCapabilities.contextTypePriorities) {
        // Sort by device priorities
        contextTypes = availableTypes.sort((a, b) => {
          const priorityA = deviceCapabilities.contextTypePriorities[a] || 0;
          const priorityB = deviceCapabilities.contextTypePriorities[b] || 0;
          return priorityB - priorityA; // Higher priority first
        });
      } else {
        // Use priority from config
        const priorityTypes = this.config.priorityContextTypes || [];
        
        // Put priority types first, then others
        contextTypes = [
          ...priorityTypes.filter(type => availableTypes.includes(type)),
          ...availableTypes.filter(type => !priorityTypes.includes(type))
        ];
      }
    }
    
    // Get changes for each context type
    const outgoingChanges = [];
    
    for (const contextType of contextTypes) {
      try {
        // Check security
        const hasAccess = await this.contextSecurityManager.checkAccess(
          deviceId,
          contextType,
          'read'
        );
        
        if (!hasAccess) {
          this.logger.debug('Access denied for context type', { deviceId, contextType });
          continue;
        }
        
        // Get context data
        const contextData = await this.mcpContextManager.getContext(contextType);
        
        if (!contextData) {
          continue;
        }
        
        // Check if changed since last sync
        const contextMetadata = await this.mcpContextManager.getContextMetadata(contextType);
        const lastUpdated = contextMetadata?.lastUpdated || Date.now();
        
        if (lastSyncTimestamp && lastUpdated <= lastSyncTimestamp && !options.forceSync) {
          // Skip unchanged context
          continue;
        }
        
        // Compress if enabled
        let finalContextData = contextData;
        let compressed = false;
        
        if (this.config.compressionEnabled) {
          finalContextData = await this.contextCompressionManager.compressContext(contextData);
          compressed = true;
        }
        
        // Add to outgoing changes
        outgoingChanges.push({
          id: `sync-${contextType}-${Date.now()}`,
          contextType,
          contextData: finalContextData,
          compressed,
          timestamp: lastUpdated,
          metadata: {
            source: 'sync',
            deviceId
          }
        });
      } catch (error) {
        this.logger.error(`Failed to get context for sync: ${error.message}`, { error, deviceId, contextType });
        // Continue with next context type
      }
    }
    
    // Add offline changes if any
    const offlineChanges = this.offlineChanges.get(deviceId) || [];
    
    if (offlineChanges.length > 0) {
      // Process and add offline changes
      for (const change of offlineChanges) {
        outgoingChanges.push({
          ...change,
          metadata: {
            ...change.metadata,
            offlineChange: true
          }
        });
      }
      
      // Clear processed offline changes
      await this.clearOfflineChanges(deviceId);
    }
    
    return outgoingChanges;
  }
  
  /**
   * Resolve conflicts between incoming and outgoing changes.
   * @private
   * @param {string} deviceId Device ID
   * @param {Array<Object>} incomingChanges Incoming changes
   * @param {Array<Object>} outgoingChanges Outgoing changes
   * @param {Object} options Options
   * @returns {Promise<Array<Object>>} Resolved conflicts
   */
  async _resolveConflicts(deviceId, incomingChanges, outgoingChanges, options) {
    // Acquire lock
    await this.locks.conflict();
    
    try {
      const resolvedConflicts = [];
      
      // Find potential conflicts (same context type)
      const incomingContextTypes = new Set(incomingChanges.map(change => change.contextType));
      const outgoingContextTypes = new Set(outgoingChanges.map(change => change.contextType));
      
      // Find intersection
      const conflictingTypes = [...incomingContextTypes].filter(type => outgoingContextTypes.has(type));
      
      for (const contextType of conflictingTypes) {
        try {
          // Get incoming and outgoing changes for this type
          const incomingForType = incomingChanges.filter(change => change.contextType === contextType);
          const outgoingForType = outgoingChanges.filter(change => change.contextType === contextType);
          
          // Skip if no actual conflict
          if (incomingForType.length === 0 || outgoingForType.length === 0) {
            continue;
          }
          
          // Get latest incoming and outgoing
          const latestIncoming = incomingForType.reduce((latest, change) => {
            return (!latest || change.timestamp > latest.timestamp) ? change : latest;
          }, null);
          
          const latestOutgoing = outgoingForType.reduce((latest, change) => {
            return (!latest || change.timestamp > latest.timestamp) ? change : latest;
          }, null);
          
          // Skip if timestamps are identical
          if (latestIncoming.timestamp === latestOutgoing.timestamp) {
            continue;
          }
          
          // Determine conflict resolution strategy
          let strategyName = options.conflictStrategy || this.config.conflictResolutionStrategy;
          
          // Get strategy function
          const strategyFn = this.conflictResolutionStrategies.get(strategyName) || 
                            this.conflictResolutionStrategies.get('lastWriteWins');
          
          // Apply strategy
          const resolution = await strategyFn(
            contextType,
            latestIncoming,
            latestOutgoing,
            deviceId,
            { mcpContextManager: this.mcpContextManager }
          );
          
          // Add to resolved conflicts
          resolvedConflicts.push({
            contextType,
            strategy: strategyName,
            winner: resolution.winner,
            resolution: resolution.action,
            timestamp: Date.now()
          });
          
          // Update outgoing changes if needed
          if (resolution.action === 'removeOutgoing') {
            // Remove this context type from outgoing changes
            const index = outgoingChanges.findIndex(change => change.contextType === contextType);
            if (index !== -1) {
              outgoingChanges.splice(index, 1);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to resolve conflict: ${error.message}`, { error, deviceId, contextType });
          // Continue with next conflict
        }
      }
      
      return resolvedConflicts;
    } finally {
      // Release lock
      this.locks.conflict.release();
    }
  }
  
  /**
   * Add entry to sync history.
   * @private
   * @param {Object} entry Sync history entry
   */
  _addToSyncHistory(entry) {
    // Add entry
    this.syncHistory.unshift({
      ...entry,
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    });
    
    // Trim history if needed
    if (this.syncHistory.length > this.config.maxSyncHistoryItems) {
      this.syncHistory = this.syncHistory.slice(0, this.config.maxSyncHistoryItems);
    }
  }
  
  /**
   * Set up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Listen for context updates
    this.mcpContextManager.on('contextUpdated', this._handleContextUpdated.bind(this));
    
    // Listen for device status changes
    this.mcpContextManager.on('deviceStatusChanged', this._handleDeviceStatusChanged.bind(this));
  }
  
  /**
   * Start periodic synchronization.
   * @private
   */
  _startPeriodicSync() {
    // Clear any existing interval
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
    }
    
    // Set up new interval
    this._syncInterval = setInterval(() => {
      this._performPeriodicSync().catch(error => {
        this.logger.error(`Periodic sync failed: ${error.message}`, { error });
      });
    }, this.config.syncIntervalSeconds * 1000);
    
    this.logger.debug(`Started periodic sync with interval: ${this.config.syncIntervalSeconds} seconds`);
  }
  
  /**
   * Perform periodic synchronization.
   * @private
   * @returns {Promise<void>}
   */
  async _performPeriodicSync() {
    // Skip if sync already in progress
    if (this.syncInProgress) {
      this.logger.debug('Skipping periodic sync: sync already in progress');
      return;
    }
    
    this.logger.debug('Performing periodic sync');
    
    // Get active devices
    const activeDevices = [...this.registeredDevices.entries()]
      .filter(([_, device]) => device.status === 'active')
      .map(([deviceId, _]) => deviceId);
    
    // Limit concurrent syncs
    const maxConcurrent = this.config.maxConcurrentSyncs;
    
    // Process devices in batches
    for (let i = 0; i < activeDevices.length; i += maxConcurrent) {
      const batch = activeDevices.slice(i, i + maxConcurrent);
      
      // Sync devices in parallel
      await Promise.all(batch.map(deviceId => {
        return this._syncDevice(deviceId).catch(error => {
          this.logger.error(`Failed to sync device: ${error.message}`, { error, deviceId });
        });
      }));
    }
    
    this.logger.debug('Periodic sync completed');
  }
  
  /**
   * Synchronize with a specific device.
   * @private
   * @param {string} deviceId Device ID
   * @returns {Promise<void>}
   */
  async _syncDevice(deviceId) {
    try {
      // Get device info
      const deviceInfo = this.registeredDevices.get(deviceId);
      
      if (!deviceInfo) {
        throw new Error(`Device not registered: ${deviceId}`);
      }
      
      // Check if device has offline changes
      const offlineChanges = this.offlineChanges.get(deviceId) || [];
      
      if (offlineChanges.length === 0) {
        // No offline changes, nothing to sync
        return;
      }
      
      // Process offline changes
      await this._processIncomingChanges(deviceId, offlineChanges, {});
      
      // Clear processed offline changes
      await this.clearOfflineChanges(deviceId);
      
      // Update device sync info
      deviceInfo.lastSync = Date.now();
      deviceInfo.syncCount = (deviceInfo.syncCount || 0) + 1;
      this.registeredDevices.set(deviceId, deviceInfo);
      
      this.logger.debug('Synced device offline changes', { deviceId, changeCount: offlineChanges.length });
    } catch (error) {
      this.logger.error(`Failed to sync device: ${error.message}`, { error, deviceId });
      throw error;
    }
  }
  
  /**
   * Handle context updated event.
   * @private
   * @param {Object} event Event data
   */
  async _handleContextUpdated(event) {
    try {
      const { contextType, source } = event;
      
      // Skip if source is sync
      if (source === 'sync') {
        return;
      }
      
      // Queue for offline devices
      const offlineDevices = [...this.registeredDevices.entries()]
        .filter(([deviceId, device]) => {
          // Skip source device
          if (deviceId === source) {
            return false;
          }
          
          // Check if device is offline
          return device.status === 'offline';
        })
        .map(([deviceId, _]) => deviceId);
      
      if (offlineDevices.length === 0) {
        return;
      }
      
      // Get context data
      const contextData = await this.mcpContextManager.getContext(contextType);
      
      if (!contextData) {
        return;
      }
      
      // Compress if enabled
      let finalContextData = contextData;
      let compressed = false;
      
      if (this.config.compressionEnabled) {
        finalContextData = await this.contextCompressionManager.compressContext(contextData);
        compressed = true;
      }
      
      // Create change object
      const change = {
        id: `offline-${contextType}-${Date.now()}`,
        contextType,
        contextData: finalContextData,
        compressed,
        timestamp: Date.now(),
        metadata: {
          source: source || 'system',
          offlineQueued: true
        }
      };
      
      // Queue for each offline device
      for (const deviceId of offlineDevices) {
        // Check security
        const hasAccess = await this.contextSecurityManager.checkAccess(
          deviceId,
          contextType,
          'read'
        );
        
        if (!hasAccess) {
          continue;
        }
        
        await this.queueOfflineChanges(deviceId, [change]);
      }
    } catch (error) {
      this.logger.error(`Failed to handle context updated event: ${error.message}`, { error });
    }
  }
  
  /**
   * Handle device status changed event.
   * @private
   * @param {Object} event Event data
   */
  async _handleDeviceStatusChanged(event) {
    try {
      const { deviceId, status } = event;
      
      // Update device status
      const deviceInfo = this.registeredDevices.get(deviceId);
      
      if (deviceInfo) {
        deviceInfo.status = status;
        deviceInfo.lastStatusChange = Date.now();
        this.registeredDevices.set(deviceId, deviceInfo);
        
        this.logger.debug('Updated device status', { deviceId, status });
      }
    } catch (error) {
      this.logger.error(`Failed to handle device status changed event: ${error.message}`, { error });
    }
  }
  
  /**
   * Register default conflict resolution strategies.
   * @private
   */
  _registerDefaultConflictResolutionStrategies() {
    // Last write wins strategy
    this.registerConflictResolutionStrategy('lastWriteWins', async (contextType, incoming, outgoing) => {
      // Compare timestamps
      if (incoming.timestamp >= outgoing.timestamp) {
        return {
          winner: 'incoming',
          action: 'removeOutgoing'
        };
      } else {
        return {
          winner: 'outgoing',
          action: 'keep'
        };
      }
    });
    
    // Server wins strategy
    this.registerConflictResolutionStrategy('serverWins', async () => {
      return {
        winner: 'outgoing',
        action: 'keep'
      };
    });
    
    // Client wins strategy
    this.registerConflictResolutionStrategy('clientWins', async () => {
      return {
        winner: 'incoming',
        action: 'removeOutgoing'
      };
    });
    
    // Merge strategy
    this.registerConflictResolutionStrategy('merge', async (contextType, incoming, outgoing, deviceId, { mcpContextManager }) => {
      try {
        // Get incoming and outgoing data
        let incomingData = incoming.contextData;
        let outgoingData = outgoing.contextData;
        
        // Decompress if needed
        if (incoming.compressed) {
          incomingData = await this.contextCompressionManager.decompressContext(incomingData);
        }
        
        if (outgoing.compressed) {
          outgoingData = await this.contextCompressionManager.decompressContext(outgoingData);
        }
        
        // Merge data (simple shallow merge)
        const mergedData = {
          ...outgoingData,
          ...incomingData,
          _merged: true,
          _mergedAt: Date.now()
        };
        
        // Publish merged context
        await mcpContextManager.publishContext(
          contextType,
          mergedData,
          {
            source: 'merge',
            timestamp: Date.now(),
            metadata: {
              mergedFrom: [incoming.id, outgoing.id],
              deviceId
            }
          }
        );
        
        return {
          winner: 'merged',
          action: 'removeOutgoing'
        };
      } catch (error) {
        // Fallback to last write wins
        if (incoming.timestamp >= outgoing.timestamp) {
          return {
            winner: 'incoming',
            action: 'removeOutgoing'
          };
        } else {
          return {
            winner: 'outgoing',
            action: 'keep'
          };
        }
      }
    });
  }
}

module.exports = ContextSynchronizationService;
