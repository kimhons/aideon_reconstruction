/**
 * @fileoverview Analytics Dashboard Integration for Analytics Dashboard
 * This service is responsible for integrating all analytics dashboard components
 * for the Aideon Tentacle Marketplace analytics dashboard.
 * 
 * @author Aideon AI Team
 * @version 1.1.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { DataCollectionService } = require('../data_collection/DataCollectionService');
const { OfflineSyncManager } = require('../data_collection/OfflineSyncManager');
const { AnalyticsStorage } = require('../storage/AnalyticsStorage');
const { AnalyticsProcessingEngine } = require('../processing/AnalyticsProcessingEngine');
const { AnalyticsDashboardUI } = require('../ui/AnalyticsDashboardUI');

/**
 * AnalyticsDashboardIntegration class - Integrates analytics dashboard components
 */
class AnalyticsDashboardIntegration {
  /**
   * Create a new AnalyticsDashboardIntegration instance
   * @param {Object} options - Configuration options
   * @param {Object} options.config - Integration configuration
   * @param {Object} options.marketplaceCore - Reference to MarketplaceCore instance
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.marketplaceCore = options.marketplaceCore;
    this.logger = new Logger('AnalyticsDashboardIntegration');
    
    // Default configuration
    this.config.dataCollection = this.config.dataCollection || {};
    this.config.storage = this.config.storage || {};
    this.config.processing = this.config.processing || {};
    this.config.ui = this.config.ui || {};
    this.config.security = this.config.security || {
      roleBasedAccess: false,
      roles: {
        admin: ['all'],
        marketplaceAdmin: ['userActivity', 'tentacleUsage', 'systemPerformance'],
        developer: ['tentacleUsage']
      }
    };
    
    this.dataCollectionService = null;
    this.offlineSyncManager = null;
    this.analyticsStorage = null;
    this.analyticsProcessingEngine = null;
    this.analyticsDashboardUI = null;
    
    this.initialized = false;
    
    this.logger.info('AnalyticsDashboardIntegration instance created');
  }
  
  /**
   * Initialize the AnalyticsDashboardIntegration
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    this.logger.info('Initializing AnalyticsDashboardIntegration');
    
    try {
      // Initialize storage
      this.analyticsStorage = new AnalyticsStorage({
        config: this.config.storage
      });
      
      await this.analyticsStorage.initialize();
      this.logger.info('AnalyticsStorage initialized');
      
      // Initialize offline sync manager
      this.offlineSyncManager = new OfflineSyncManager({
        analyticsStorage: this.analyticsStorage,
        config: this.config.offlineSync || {
          maxOfflineQueueSize: 10000,
          syncInterval: 60,
          persistOfflineData: true
        }
      });
      
      await this.offlineSyncManager.initialize();
      this.logger.info('OfflineSyncManager initialized');
      
      // Initialize data collection
      this.dataCollectionService = new DataCollectionService({
        marketplaceCore: this.marketplaceCore,
        analyticsStorage: this.analyticsStorage,
        config: this.config.dataCollection
      });
      
      await this.dataCollectionService.initialize();
      this.logger.info('DataCollectionService initialized');
      
      // Initialize processing engine
      this.analyticsProcessingEngine = new AnalyticsProcessingEngine({
        analyticsStorage: this.analyticsStorage,
        config: this.config.processing
      });
      
      await this.analyticsProcessingEngine.initialize();
      this.logger.info('AnalyticsProcessingEngine initialized');
      
      this.initialized = true;
      this.logger.info('AnalyticsDashboardIntegration initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize AnalyticsDashboardIntegration', error);
      await this.shutdown();
      throw error;
    }
  }
  
  /**
   * Initialize the UI
   * @param {HTMLElement} container - Container element for the dashboard
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initializeUI(container) {
    if (!this.initialized) {
      throw new Error('AnalyticsDashboardIntegration not initialized');
    }
    
    this.logger.info('Initializing AnalyticsDashboardUI');
    
    try {
      // Initialize UI
      this.analyticsDashboardUI = new AnalyticsDashboardUI({
        analyticsProcessingEngine: this.analyticsProcessingEngine,
        container,
        config: this.config.ui
      });
      
      await this.analyticsDashboardUI.initialize();
      this.logger.info('AnalyticsDashboardUI initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize AnalyticsDashboardUI', error);
      throw error;
    }
  }
  
  /**
   * Check if a user role has access to a specific data type
   * @param {string} role - User role
   * @param {string} dataType - Data type to check access for
   * @returns {boolean} - Whether the role has access to the data type
   */
  checkAccess(role, dataType) {
    if (!this.config.security.roleBasedAccess) {
      return true;
    }
    
    const rolePermissions = this.config.security.roles[role];
    
    if (!rolePermissions) {
      return false;
    }
    
    return rolePermissions.includes('all') || rolePermissions.includes(dataType);
  }
  
  /**
   * Get the status of the AnalyticsDashboardIntegration
   * @returns {Object} - Status object
   */
  getStatus() {
    const status = {
      initialized: this.initialized
    };
    
    if (this.dataCollectionService) {
      status.dataCollectionService = this.dataCollectionService.getStatus();
    }
    
    if (this.offlineSyncManager) {
      status.offlineSyncManager = this.offlineSyncManager.getStatus();
    }
    
    if (this.analyticsStorage) {
      status.analyticsStorage = this.analyticsStorage.getStatus();
    }
    
    if (this.analyticsProcessingEngine) {
      status.analyticsProcessingEngine = this.analyticsProcessingEngine.getStatus();
    }
    
    if (this.analyticsDashboardUI) {
      status.analyticsDashboardUI = this.analyticsDashboardUI.getStatus();
    }
    
    return status;
  }
  
  /**
   * Shutdown the AnalyticsDashboardIntegration
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    this.logger.info('Shutting down AnalyticsDashboardIntegration');
    
    try {
      // Shutdown UI
      if (this.analyticsDashboardUI) {
        await this.analyticsDashboardUI.shutdown();
        this.analyticsDashboardUI = null;
        this.logger.info('AnalyticsDashboardUI shutdown complete');
      }
      
      // Shutdown processing engine
      if (this.analyticsProcessingEngine) {
        await this.analyticsProcessingEngine.shutdown();
        this.analyticsProcessingEngine = null;
        this.logger.info('AnalyticsProcessingEngine shutdown complete');
      }
      
      // Shutdown data collection
      if (this.dataCollectionService) {
        await this.dataCollectionService.shutdown();
        this.dataCollectionService = null;
        this.logger.info('DataCollectionService shutdown complete');
      }
      
      // Shutdown offline sync manager
      if (this.offlineSyncManager) {
        await this.offlineSyncManager.shutdown();
        this.offlineSyncManager = null;
        this.logger.info('OfflineSyncManager shutdown complete');
      }
      
      // Shutdown storage
      if (this.analyticsStorage) {
        await this.analyticsStorage.shutdown();
        this.analyticsStorage = null;
        this.logger.info('AnalyticsStorage shutdown complete');
      }
      
      this.initialized = false;
      this.logger.info('AnalyticsDashboardIntegration shutdown complete');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown AnalyticsDashboardIntegration', error);
      throw error;
    }
  }
}

module.exports = { AnalyticsDashboardIntegration };
