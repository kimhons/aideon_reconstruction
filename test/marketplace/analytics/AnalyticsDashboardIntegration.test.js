/**
 * @fileoverview Tests for AnalyticsDashboardIntegration
 * This file contains tests for the AnalyticsDashboardIntegration component
 * for the Aideon Tentacle Marketplace analytics dashboard.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import required modules
const { AnalyticsDashboardIntegration } = require('../../../src/marketplace/analytics/integration/AnalyticsDashboardIntegration');

// Mock dependencies
jest.mock('../../../src/marketplace/analytics/data_collection/DataCollectionService', () => ({
  DataCollectionService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ collecting: true })
  }))
}));

jest.mock('../../../src/marketplace/analytics/data_collection/OfflineSyncManager', () => ({
  OfflineSyncManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ isOnline: true })
  }))
}));

jest.mock('../../../src/marketplace/analytics/storage/AnalyticsStorage', () => ({
  AnalyticsStorage: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ connected: true })
  }))
}));

jest.mock('../../../src/marketplace/analytics/processing/AnalyticsProcessingEngine', () => ({
  AnalyticsProcessingEngine: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ processing: true })
  }))
}));

jest.mock('../../../src/marketplace/analytics/ui/AnalyticsDashboardUI', () => ({
  AnalyticsDashboardUI: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ initialized: true })
  }))
}));

describe('AnalyticsDashboardIntegration', () => {
  let integration;
  let mockMarketplaceCore;
  let mockContainer;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock marketplace core
    mockMarketplaceCore = {
      events: {
        on: jest.fn(),
        off: jest.fn()
      }
    };
    
    // Create mock container
    mockContainer = document.createElement('div');
    
    // Create integration instance
    integration = new AnalyticsDashboardIntegration({
      marketplaceCore: mockMarketplaceCore,
      config: {
        dataCollection: { enabled: true },
        storage: { storageType: 'memory' },
        processing: { batchSize: 100 },
        ui: { refreshInterval: 30 }
      }
    });
  });
  
  describe('initialize', () => {
    it('should initialize all components', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Verify components were initialized
      expect(integration.analyticsStorage.initialize).toHaveBeenCalledTimes(1);
      expect(integration.offlineSyncManager.initialize).toHaveBeenCalledTimes(1);
      expect(integration.dataCollectionService.initialize).toHaveBeenCalledTimes(1);
      expect(integration.analyticsProcessingEngine.initialize).toHaveBeenCalledTimes(1);
      
      // Verify integration is initialized
      expect(integration.initialized).toBe(true);
    });
    
    it('should handle initialization errors', async () => {
      // Mock storage initialization failure
      const { AnalyticsStorage } = require('../../../src/marketplace/analytics/storage/AnalyticsStorage');
      AnalyticsStorage.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Storage initialization failed')),
        shutdown: jest.fn().mockResolvedValue(true)
      }));
      
      // Initialize integration
      await expect(integration.initialize()).rejects.toThrow('Storage initialization failed');
      
      // Verify integration is not initialized
      expect(integration.initialized).toBe(false);
    });
  });
  
  describe('initializeUI', () => {
    it('should initialize UI component', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Initialize UI
      await integration.initializeUI(mockContainer);
      
      // Verify UI was initialized
      expect(integration.analyticsDashboardUI.initialize).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error if integration not initialized', async () => {
      // Initialize UI without initializing integration
      await expect(integration.initializeUI(mockContainer)).rejects.toThrow('AnalyticsDashboardIntegration not initialized');
    });
    
    it('should handle UI initialization errors', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Mock UI initialization failure
      const { AnalyticsDashboardUI } = require('../../../src/marketplace/analytics/ui/AnalyticsDashboardUI');
      AnalyticsDashboardUI.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('UI initialization failed')),
        shutdown: jest.fn().mockResolvedValue(true)
      }));
      
      // Initialize UI
      await expect(integration.initializeUI(mockContainer)).rejects.toThrow('UI initialization failed');
    });
  });
  
  describe('checkAccess', () => {
    it('should allow access when role-based access is disabled', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Check access
      const access = integration.checkAccess('developer', 'userActivity');
      
      // Verify access
      expect(access).toBe(true);
    });
    
    it('should check role-based access when enabled', async () => {
      // Create integration with role-based access
      integration = new AnalyticsDashboardIntegration({
        marketplaceCore: mockMarketplaceCore,
        config: {
          security: {
            roleBasedAccess: true,
            roles: {
              admin: ['all'],
              developer: ['tentacleUsage']
            }
          }
        }
      });
      
      // Initialize integration
      await integration.initialize();
      
      // Check access
      const adminAccess = integration.checkAccess('admin', 'userActivity');
      const developerAccess1 = integration.checkAccess('developer', 'tentacleUsage');
      const developerAccess2 = integration.checkAccess('developer', 'userActivity');
      
      // Verify access
      expect(adminAccess).toBe(true);
      expect(developerAccess1).toBe(true);
      expect(developerAccess2).toBe(false);
    });
  });
  
  describe('getStatus', () => {
    it('should return status of all components', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Initialize UI
      await integration.initializeUI(mockContainer);
      
      // Get status
      const status = integration.getStatus();
      
      // Verify status
      expect(status.initialized).toBe(true);
      expect(status.dataCollectionService).toEqual({ collecting: true });
      expect(status.offlineSyncManager).toEqual({ isOnline: true });
      expect(status.analyticsStorage).toEqual({ connected: true });
      expect(status.analyticsProcessingEngine).toEqual({ processing: true });
      expect(status.analyticsDashboardUI).toEqual({ initialized: true });
    });
    
    it('should handle missing components', () => {
      // Get status without initialization
      const status = integration.getStatus();
      
      // Verify status
      expect(status.initialized).toBe(false);
      expect(status.dataCollectionService).toBeUndefined();
      expect(status.analyticsStorage).toBeUndefined();
      expect(status.analyticsProcessingEngine).toBeUndefined();
      expect(status.analyticsDashboardUI).toBeUndefined();
    });
  });
  
  describe('shutdown', () => {
    it('should shutdown all components', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Initialize UI
      await integration.initializeUI(mockContainer);
      
      // Store references to components for verification
      const analyticsDashboardUI = integration.analyticsDashboardUI;
      const analyticsProcessingEngine = integration.analyticsProcessingEngine;
      const dataCollectionService = integration.dataCollectionService;
      const offlineSyncManager = integration.offlineSyncManager;
      const analyticsStorage = integration.analyticsStorage;
      
      // Shutdown integration
      await integration.shutdown();
      
      // Verify components were shutdown
      expect(analyticsDashboardUI.shutdown).toHaveBeenCalledTimes(1);
      expect(analyticsProcessingEngine.shutdown).toHaveBeenCalledTimes(1);
      expect(dataCollectionService.shutdown).toHaveBeenCalledTimes(1);
      expect(offlineSyncManager.shutdown).toHaveBeenCalledTimes(1);
      expect(analyticsStorage.shutdown).toHaveBeenCalledTimes(1);
      
      // Verify integration is not initialized
      expect(integration.initialized).toBe(false);
      expect(integration.analyticsDashboardUI).toBeNull();
      expect(integration.analyticsProcessingEngine).toBeNull();
      expect(integration.dataCollectionService).toBeNull();
      expect(integration.offlineSyncManager).toBeNull();
      expect(integration.analyticsStorage).toBeNull();
    });
    
    it('should handle shutdown errors', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Mock storage shutdown failure
      integration.analyticsStorage.shutdown = jest.fn().mockRejectedValue(new Error('Storage shutdown failed'));
      
      // Shutdown integration
      await expect(integration.shutdown()).rejects.toThrow('Storage shutdown failed');
    });
    
    it('should handle missing components', async () => {
      // Shutdown without initialization
      await integration.shutdown();
      
      // Verify integration is not initialized
      expect(integration.initialized).toBe(false);
    });
  });
  
  describe('end-to-end integration', () => {
    it('should integrate all components correctly', async () => {
      // Initialize integration
      await integration.initialize();
      
      // Initialize UI
      await integration.initializeUI(mockContainer);
      
      // Verify components were initialized with correct dependencies
      const { DataCollectionService } = require('../../../src/marketplace/analytics/data_collection/DataCollectionService');
      expect(DataCollectionService).toHaveBeenCalledWith(expect.objectContaining({
        marketplaceCore: mockMarketplaceCore,
        analyticsStorage: integration.analyticsStorage,
        config: expect.any(Object)
      }));
      
      const { AnalyticsProcessingEngine } = require('../../../src/marketplace/analytics/processing/AnalyticsProcessingEngine');
      expect(AnalyticsProcessingEngine).toHaveBeenCalledWith(expect.objectContaining({
        analyticsStorage: integration.analyticsStorage,
        config: expect.any(Object)
      }));
      
      const { AnalyticsDashboardUI } = require('../../../src/marketplace/analytics/ui/AnalyticsDashboardUI');
      expect(AnalyticsDashboardUI).toHaveBeenCalledWith(expect.objectContaining({
        analyticsProcessingEngine: integration.analyticsProcessingEngine,
        container: mockContainer,
        config: expect.any(Object)
      }));
      
      // Shutdown integration
      await integration.shutdown();
    });
  });
});
