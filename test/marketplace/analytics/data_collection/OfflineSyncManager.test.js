/**
 * @fileoverview Tests for OfflineSyncManager
 * This file contains tests for the OfflineSyncManager component
 * for the Aideon Tentacle Marketplace analytics dashboard.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import required modules
const { OfflineSyncManager } = require('../../../../src/marketplace/analytics/data_collection/OfflineSyncManager');

// Mock dependencies
jest.mock('../../../../src/core/logging/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('../../../../src/core/events/EventEmitter', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }))
}));

describe('OfflineSyncManager', () => {
  let offlineSyncManager;
  let mockAnalyticsStorage;
  let originalLocalStorage;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock analytics storage
    mockAnalyticsStorage = {
      storeRawData: jest.fn().mockResolvedValue(true)
    };
    
    // Create offline sync manager instance
    offlineSyncManager = new OfflineSyncManager({
      analyticsStorage: mockAnalyticsStorage,
      config: {
        maxOfflineQueueSize: 100,
        syncInterval: 10,
        persistOfflineData: false
      }
    });
    
    // Save original localStorage if it exists
    if (typeof window !== 'undefined') {
      originalLocalStorage = window.localStorage;
    }
    
    // Mock localStorage for all environments
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
  });
  
  afterEach(() => {
    // Clean up
    if (typeof window !== 'undefined' && originalLocalStorage) {
      window.localStorage = originalLocalStorage;
    } else {
      delete global.localStorage;
    }
    
    // Clear any intervals
    if (offlineSyncManager._syncInterval) {
      clearInterval(offlineSyncManager._syncInterval);
    }
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Initialize offline sync manager
      await expect(offlineSyncManager.initialize()).resolves.toBe(true);
      
      // Verify initialization
      expect(offlineSyncManager.initialized).toBe(true);
    });
    
    it('should throw error if analytics storage is not provided', async () => {
      // Create offline sync manager without analytics storage
      offlineSyncManager = new OfflineSyncManager({
        config: {
          maxOfflineQueueSize: 100,
          syncInterval: 10
        }
      });
      
      // Initialize offline sync manager
      await expect(offlineSyncManager.initialize()).rejects.toThrow('AnalyticsStorage reference is required for initialization');
    });
    
    it('should load persisted offline data if configured', async () => {
      // Mock localStorage.getItem to return persisted data
      localStorage.getItem.mockReturnValue(JSON.stringify([
        { data: { type: 'test' }, timestamp: Date.now() }
      ]));
      
      // Create offline sync manager with persistOfflineData enabled
      offlineSyncManager = new OfflineSyncManager({
        analyticsStorage: mockAnalyticsStorage,
        config: {
          maxOfflineQueueSize: 100,
          syncInterval: 10,
          persistOfflineData: true
        }
      });
      
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
      
      // Verify persisted data was loaded
      expect(localStorage.getItem).toHaveBeenCalledWith(offlineSyncManager.config.offlineStorageKey);
    });
  });
  
  describe('queueData', () => {
    beforeEach(async () => {
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
    });
    
    it('should store data directly when online', async () => {
      // Set online status
      offlineSyncManager.isOnline = true;
      
      // Queue data
      const data = { type: 'test', value: 123 };
      await offlineSyncManager.queueData(data);
      
      // Verify data was stored directly
      expect(mockAnalyticsStorage.storeRawData).toHaveBeenCalledWith(data);
      expect(offlineSyncManager.offlineQueue.length).toBe(0);
    });
    
    it('should queue data when offline', async () => {
      // Set offline status
      offlineSyncManager.isOnline = false;
      
      // Queue data
      const data = { type: 'test', value: 123 };
      await offlineSyncManager.queueData(data);
      
      // Verify data was queued
      expect(mockAnalyticsStorage.storeRawData).not.toHaveBeenCalled();
      expect(offlineSyncManager.offlineQueue.length).toBe(1);
      expect(offlineSyncManager.offlineQueue[0].data).toEqual(data);
    });
    
    it('should truncate queue when it exceeds maximum size', async () => {
      // Set offline status
      offlineSyncManager.isOnline = false;
      
      // Queue more data than the maximum queue size
      for (let i = 0; i < 110; i++) {
        await offlineSyncManager.queueData({ type: 'test', value: i });
      }
      
      // Verify queue was truncated
      expect(offlineSyncManager.offlineQueue.length).toBe(100);
      expect(offlineSyncManager.offlineQueue[0].data.value).toBe(10);
      expect(offlineSyncManager.offlineQueue[99].data.value).toBe(109);
    });
    
    it('should persist offline data if configured', async () => {
      // Create offline sync manager with persistOfflineData enabled
      offlineSyncManager = new OfflineSyncManager({
        analyticsStorage: mockAnalyticsStorage,
        config: {
          maxOfflineQueueSize: 100,
          syncInterval: 10,
          persistOfflineData: true
        }
      });
      
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
      
      // Set offline status
      offlineSyncManager.isOnline = false;
      
      // Queue data
      const data = { type: 'test', value: 123 };
      await offlineSyncManager.queueData(data);
      
      // Verify data was persisted
      expect(localStorage.setItem).toHaveBeenCalledWith(
        offlineSyncManager.config.offlineStorageKey,
        expect.any(String)
      );
    });
    
    it('should throw error if not initialized', async () => {
      // Create new offline sync manager without initializing
      offlineSyncManager = new OfflineSyncManager({
        analyticsStorage: mockAnalyticsStorage
      });
      
      // Queue data
      await expect(offlineSyncManager.queueData({ type: 'test' })).rejects.toThrow('OfflineSyncManager not initialized');
    });
  });
  
  describe('synchronize', () => {
    beforeEach(async () => {
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
      
      // Set online status
      offlineSyncManager.isOnline = true;
    });
    
    it('should synchronize queued data', async () => {
      // Add items to offline queue
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() },
        { data: { type: 'test', value: 2 }, timestamp: Date.now() },
        { data: { type: 'test', value: 3 }, timestamp: Date.now() }
      ];
      
      // Synchronize
      const result = await offlineSyncManager.synchronize();
      
      // Verify synchronization
      expect(result.success).toBe(true);
      expect(result.synced).toBe(3);
      expect(result.remaining).toBe(0);
      expect(mockAnalyticsStorage.storeRawData).toHaveBeenCalledTimes(3);
      expect(offlineSyncManager.offlineQueue.length).toBe(0);
    });
    
    it('should handle synchronization errors', async () => {
      // Add items to offline queue
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() },
        { data: { type: 'test', value: 2 }, timestamp: Date.now() },
        { data: { type: 'test', value: 3 }, timestamp: Date.now() }
      ];
      
      // Mock storage error for the second item
      mockAnalyticsStorage.storeRawData = jest.fn()
        .mockImplementationOnce(() => Promise.resolve(true))
        .mockImplementationOnce(() => Promise.reject(new Error('Storage error')))
        .mockImplementationOnce(() => Promise.resolve(true));
      
      // Synchronize
      const result = await offlineSyncManager.synchronize();
      
      // Verify synchronization results
      expect(result.success).toBe(true);
      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(1); // Failed item is requeued
      expect(mockAnalyticsStorage.storeRawData).toHaveBeenCalledTimes(3);
      expect(offlineSyncManager.offlineQueue.length).toBe(1);
      
      // The synced count should be 2 (first and third items)
      expect(result.synced).toBe(2);
    });
    
    it('should not synchronize if offline', async () => {
      // Set offline status
      offlineSyncManager.isOnline = false;
      
      // Add items to offline queue
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() }
      ];
      
      // Synchronize
      const result = await offlineSyncManager.synchronize();
      
      // Verify no synchronization occurred
      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(result.remaining).toBe(1);
      expect(mockAnalyticsStorage.storeRawData).not.toHaveBeenCalled();
      expect(offlineSyncManager.offlineQueue.length).toBe(1);
    });
    
    it('should not synchronize if sync is already in progress', async () => {
      // Set sync in progress
      offlineSyncManager.syncInProgress = true;
      
      // Add items to offline queue
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() }
      ];
      
      // Synchronize
      const result = await offlineSyncManager.synchronize();
      
      // Verify no synchronization occurred
      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(result.remaining).toBe(1);
      expect(result.skipped).toBe(true);
      expect(mockAnalyticsStorage.storeRawData).not.toHaveBeenCalled();
      expect(offlineSyncManager.offlineQueue.length).toBe(1);
    });
    
    it('should throw error if not initialized', async () => {
      // Create new offline sync manager without initializing
      offlineSyncManager = new OfflineSyncManager({
        analyticsStorage: mockAnalyticsStorage
      });
      
      // Synchronize
      await expect(offlineSyncManager.synchronize()).rejects.toThrow('OfflineSyncManager not initialized');
    });
  });
  
  describe('setOnlineStatus', () => {
    beforeEach(async () => {
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
      
      // Mock synchronize method
      offlineSyncManager.synchronize = jest.fn().mockResolvedValue({
        success: true,
        synced: 0,
        remaining: 0
      });
    });
    
    it('should update online status', async () => {
      // Set online status
      await offlineSyncManager.setOnlineStatus(false);
      
      // Verify status was updated
      expect(offlineSyncManager.isOnline).toBe(false);
      expect(offlineSyncManager.events.emit).toHaveBeenCalledWith('status:change', { isOnline: false });
    });
    
    it('should not update if status is unchanged', async () => {
      // Set initial status
      offlineSyncManager.isOnline = true;
      
      // Set same status
      await offlineSyncManager.setOnlineStatus(true);
      
      // Verify no update occurred
      expect(offlineSyncManager.events.emit).not.toHaveBeenCalled();
    });
    
    it('should trigger synchronization when coming online with queued data', async () => {
      // Set initial status
      offlineSyncManager.isOnline = false;
      
      // Add items to offline queue
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() }
      ];
      
      // Set online status
      await offlineSyncManager.setOnlineStatus(true);
      
      // Verify synchronization was triggered
      expect(offlineSyncManager.synchronize).toHaveBeenCalled();
    });
    
    it('should not trigger synchronization when coming online with empty queue', async () => {
      // Set initial status
      offlineSyncManager.isOnline = false;
      
      // Set online status
      await offlineSyncManager.setOnlineStatus(true);
      
      // Verify synchronization was not triggered
      expect(offlineSyncManager.synchronize).not.toHaveBeenCalled();
    });
  });
  
  describe('getStatus', () => {
    beforeEach(async () => {
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
    });
    
    it('should return current status', () => {
      // Set some state
      offlineSyncManager.isOnline = false;
      offlineSyncManager.syncInProgress = true;
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() }
      ];
      
      // Get status
      const status = offlineSyncManager.getStatus();
      
      // Verify status
      expect(status.initialized).toBe(true);
      expect(status.isOnline).toBe(false);
      expect(status.syncInProgress).toBe(true);
      expect(status.queueSize).toBe(1);
      expect(status.maxQueueSize).toBe(100);
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
      
      // Mock interval
      offlineSyncManager._syncInterval = setInterval(() => {}, 1000);
    });
    
    it('should shutdown successfully', async () => {
      // Shutdown
      await offlineSyncManager.shutdown();
      
      // Verify shutdown
      expect(offlineSyncManager.initialized).toBe(false);
      expect(offlineSyncManager._syncInterval).toBeNull();
    });
    
    it('should persist offline data if configured', async () => {
      // Create offline sync manager with persistOfflineData enabled
      offlineSyncManager = new OfflineSyncManager({
        analyticsStorage: mockAnalyticsStorage,
        config: {
          maxOfflineQueueSize: 100,
          syncInterval: 10,
          persistOfflineData: true
        }
      });
      
      // Initialize offline sync manager
      await offlineSyncManager.initialize();
      
      // Mock interval
      offlineSyncManager._syncInterval = setInterval(() => {}, 1000);
      
      // Add items to offline queue
      offlineSyncManager.offlineQueue = [
        { data: { type: 'test', value: 1 }, timestamp: Date.now() }
      ];
      
      // Shutdown
      await offlineSyncManager.shutdown();
      
      // Verify data was persisted
      expect(localStorage.setItem).toHaveBeenCalledWith(
        offlineSyncManager.config.offlineStorageKey,
        expect.any(String)
      );
    });
  });
});
