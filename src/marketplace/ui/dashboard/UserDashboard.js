/**
 * @fileoverview UserDashboard component with dependency injection support
 * This component provides a dashboard for users to manage their tentacles and licenses
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
 * UserDashboard class - Provides a dashboard for users to manage their tentacles and licenses
 */
class UserDashboard {
  /**
   * Create a new UserDashboard instance
   * @param {Object} options - Configuration options
   * @param {Object} options.marketplaceCore - Reference to the MarketplaceCore
   * @param {Object} options.installationManager - Reference to the InstallationManager
   * @param {Object} options.monetizationCore - Reference to the MonetizationCore
   * @param {Object} options.config - Dashboard configuration settings
   */
  constructor(options = {}) {
    this.options = options;
    this.marketplaceCore = options.marketplaceCore;
    this.installationManager = options.installationManager;
    this.monetizationCore = options.monetizationCore;
    this.config = options.config || {};
    this.logger = new Logger("UserDashboard");
    this.events = new EventEmitter();
    this.state = {
      installedTentacles: [],
      purchasedTentacles: [],
      licenses: [],
      subscriptions: [],
      isLoading: false,
      error: null
    };
    this.initialized = false;

    this.logger.info("UserDashboard instance created");
  }

  /**
   * Initialize the UserDashboard
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("UserDashboard already initialized");
      return true;
    }

    this.logger.info("Initializing UserDashboard");

    try {
      // Validate dependencies
      if (!this.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }

      if (!this.installationManager) {
        throw new Error("InstallationManager reference is required");
      }

      if (!this.monetizationCore) {
        throw new Error("MonetizationCore reference is required");
      }

      // Initialize marketplace core if not already initialized
      if (!this.marketplaceCore.initialized) {
        await this.marketplaceCore.initialize();
      }

      // Initialize installation manager if not already initialized
      if (!this.installationManager.initialized) {
        await this.installationManager.initialize();
      }

      // Initialize monetization core if not already initialized
      if (!this.monetizationCore.initialized) {
        await this.monetizationCore.initialize();
      }

      // Set up event listeners
      this._setupEventListeners();

      this.initialized = true;
      this.logger.info("UserDashboard initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize UserDashboard", error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    this.logger.info("Setting up event listeners");

    // Listen for installation manager events
    if (this.installationManager && this.installationManager.events) {
      this.installationManager.events.on("installation:completed", this._handleInstallationCompleted.bind(this));
      this.installationManager.events.on("uninstallation:completed", this._handleUninstallationCompleted.bind(this));
      this.installationManager.events.on("update:completed", this._handleUpdateCompleted.bind(this));
    }

    // Listen for monetization core events
    if (this.monetizationCore && this.monetizationCore.events) {
      this.monetizationCore.events.on("license:activated", this._handleLicenseActivated.bind(this));
      this.monetizationCore.events.on("license:deactivated", this._handleLicenseDeactivated.bind(this));
      this.monetizationCore.events.on("subscription:created", this._handleSubscriptionCreated.bind(this));
      this.monetizationCore.events.on("subscription:cancelled", this._handleSubscriptionCancelled.bind(this));
    }

    this.logger.info("Event listeners set up");
  }

  /**
   * Handle installation completed event
   * @param {Object} event - Installation completed event
   * @private
   */
  _handleInstallationCompleted(event) {
    const { tentacleId } = event;
    this.logger.info(`Installation completed for tentacle: ${tentacleId}`);

    // Refresh installed tentacles
    this.loadUserData();
  }

  /**
   * Handle uninstallation completed event
   * @param {Object} event - Uninstallation completed event
   * @private
   */
  _handleUninstallationCompleted(event) {
    const { tentacleId } = event;
    this.logger.info(`Uninstallation completed for tentacle: ${tentacleId}`);

    // Refresh installed tentacles
    this.loadUserData();
  }

  /**
   * Handle update completed event
   * @param {Object} event - Update completed event
   * @private
   */
  _handleUpdateCompleted(event) {
    const { tentacleId, version } = event;
    this.logger.info(`Update completed for tentacle: ${tentacleId} to version ${version}`);

    // Refresh installed tentacles
    this.loadUserData();
  }

  /**
   * Handle license activated event
   * @param {Object} event - License activated event
   * @private
   */
  _handleLicenseActivated(event) {
    const { licenseId } = event;
    this.logger.info(`License activated: ${licenseId}`);

    // Refresh licenses
    this._loadLicenses();
  }

  /**
   * Handle license deactivated event
   * @param {Object} event - License deactivated event
   * @private
   */
  _handleLicenseDeactivated(event) {
    const { licenseId } = event;
    this.logger.info(`License deactivated: ${licenseId}`);

    // Refresh licenses
    this._loadLicenses();
  }

  /**
   * Handle subscription created event
   * @param {Object} event - Subscription created event
   * @private
   */
  _handleSubscriptionCreated(event) {
    const { subscriptionId } = event;
    this.logger.info(`Subscription created: ${subscriptionId}`);

    // Refresh subscriptions
    this._loadSubscriptions();
  }

  /**
   * Handle subscription cancelled event
   * @param {Object} event - Subscription cancelled event
   * @private
   */
  _handleSubscriptionCancelled(event) {
    const { subscriptionId } = event;
    this.logger.info(`Subscription cancelled: ${subscriptionId}`);

    // Refresh subscriptions
    this._loadSubscriptions();
  }

  /**
   * Load user data
   * @returns {Promise<Object>} - Promise resolving to user data
   */
  async loadUserData() {
    if (!this.initialized) {
      throw new Error("UserDashboard not initialized");
    }

    this.logger.info("Loading user data");

    try {
      this.state.isLoading = true;

      // Load installed tentacles
      this.state.installedTentacles = await this._loadInstalledTentacles();

      // Load purchased tentacles
      this.state.purchasedTentacles = await this._loadPurchasedTentacles();

      // Load licenses
      this.state.licenses = await this._loadLicenses();

      // Load subscriptions
      this.state.subscriptions = await this._loadSubscriptions();

      // Emit user data loaded event
      this.events.emit('user:data:loaded', {
        installedTentacleCount: this.state.installedTentacles.length,
        purchasedTentacleCount: this.state.purchasedTentacles.length,
        licenseCount: this.state.licenses.length,
        subscriptionCount: this.state.subscriptions.length
      });

      this.logger.info("User data loaded successfully");
      return {
        installedTentacles: this.state.installedTentacles,
        purchasedTentacles: this.state.purchasedTentacles,
        licenses: this.state.licenses,
        subscriptions: this.state.subscriptions
      };
    } catch (error) {
      this.logger.error("Failed to load user data", error);
      this.state.error = error.message;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Load installed tentacles
   * @returns {Promise<Array>} - Promise resolving to array of installed tentacles
   * @private
   */
  async _loadInstalledTentacles() {
    this.logger.info("Loading installed tentacles");

    try {
      // In a real implementation, this would call the installation manager API
      // For this mock implementation, we'll return the installed tentacles from the installation manager
      return this.installationManager.getInstalledTentacles();
    } catch (error) {
      this.logger.error("Failed to load installed tentacles", error);
      throw error;
    }
  }

  /**
   * Load purchased tentacles
   * @returns {Promise<Array>} - Promise resolving to array of purchased tentacles
   * @private
   */
  async _loadPurchasedTentacles() {
    this.logger.info("Loading purchased tentacles");

    try {
      // In a real implementation, this would call the monetization system API
      // For this mock implementation, we'll return some sample purchased tentacles
      return [
        {
          id: 'devmaster',
          name: 'DevMaster',
          purchaseDate: '2025-05-01',
          price: 49.99,
          licenseType: 'perpetual'
        },
        {
          id: 'data-wizard',
          name: 'Data Wizard',
          purchaseDate: '2025-04-15',
          price: 29.99,
          licenseType: 'perpetual'
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load purchased tentacles", error);
      throw error;
    }
  }

  /**
   * Load licenses
   * @returns {Promise<Array>} - Promise resolving to array of licenses
   * @private
   */
  async _loadLicenses() {
    this.logger.info("Loading licenses");

    try {
      // In a real implementation, this would call the monetization system API
      // For this mock implementation, we'll return some sample licenses
      return [
        {
          id: 'license-1',
          tentacleId: 'devmaster',
          licenseKey: 'DM-1234-5678-9012',
          activationDate: '2025-05-01',
          expirationDate: null,
          status: 'active'
        },
        {
          id: 'license-2',
          tentacleId: 'data-wizard',
          licenseKey: 'DW-5678-9012-3456',
          activationDate: '2025-04-15',
          expirationDate: null,
          status: 'active'
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load licenses", error);
      throw error;
    }
  }

  /**
   * Load subscriptions
   * @returns {Promise<Array>} - Promise resolving to array of subscriptions
   * @private
   */
  async _loadSubscriptions() {
    this.logger.info("Loading subscriptions");

    try {
      // In a real implementation, this would call the monetization system API
      // For this mock implementation, we'll return some sample subscriptions
      return [
        {
          id: 'sub-1',
          tentacleId: 'security-guardian',
          startDate: '2025-05-10',
          nextBillingDate: '2025-06-10',
          amount: 4.99,
          interval: 'monthly',
          status: 'active'
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load subscriptions", error);
      throw error;
    }
  }

  /**
   * Activate license
   * @param {string} licenseKey - License key
   * @returns {Promise<Object>} - Promise resolving to activation result
   */
  async activateLicense(licenseKey) {
    if (!this.initialized) {
      throw new Error("UserDashboard not initialized");
    }

    this.logger.info(`Activating license: ${licenseKey}`);

    try {
      // In a real implementation, this would call the monetization system API
      // For this mock implementation, we'll simulate a successful activation
      const result = {
        success: true,
        licenseId: `license-${Date.now()}`,
        message: 'License activated successfully'
      };

      // Add license to state
      this.state.licenses.push({
        id: result.licenseId,
        tentacleId: 'unknown', // In a real implementation, this would be determined by the license key
        licenseKey,
        activationDate: new Date().toISOString().split('T')[0],
        expirationDate: null,
        status: 'active'
      });

      // Emit license activated event
      this.events.emit('license:activated', {
        licenseId: result.licenseId,
        licenseKey
      });

      this.logger.info(`License activated: ${licenseKey}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to activate license: ${licenseKey}`, error);
      throw error;
    }
  }

  /**
   * Deactivate license
   * @param {string} licenseId - License ID
   * @returns {Promise<Object>} - Promise resolving to deactivation result
   */
  async deactivateLicense(licenseId) {
    if (!this.initialized) {
      throw new Error("UserDashboard not initialized");
    }

    this.logger.info(`Deactivating license: ${licenseId}`);

    try {
      // Find license in state
      const licenseIndex = this.state.licenses.findIndex(license => license.id === licenseId);
      if (licenseIndex === -1) {
        throw new Error(`License not found: ${licenseId}`);
      }

      // In a real implementation, this would call the monetization system API
      // For this mock implementation, we'll simulate a successful deactivation
      const result = {
        success: true,
        licenseId,
        message: 'License deactivated successfully'
      };

      // Update license status in state
      this.state.licenses[licenseIndex].status = 'inactive';

      // Emit license deactivated event
      this.events.emit('license:deactivated', {
        licenseId
      });

      this.logger.info(`License deactivated: ${licenseId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to deactivate license: ${licenseId}`, error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} - Promise resolving to cancellation result
   */
  async cancelSubscription(subscriptionId) {
    if (!this.initialized) {
      throw new Error("UserDashboard not initialized");
    }

    this.logger.info(`Cancelling subscription: ${subscriptionId}`);

    try {
      // Find subscription in state
      const subscriptionIndex = this.state.subscriptions.findIndex(subscription => subscription.id === subscriptionId);
      if (subscriptionIndex === -1) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      // In a real implementation, this would call the monetization system API
      // For this mock implementation, we'll simulate a successful cancellation
      const result = {
        success: true,
        subscriptionId,
        message: 'Subscription cancelled successfully'
      };

      // Update subscription status in state
      this.state.subscriptions[subscriptionIndex].status = 'cancelled';
      this.state.subscriptions[subscriptionIndex].cancellationDate = new Date().toISOString().split('T')[0];

      // Emit subscription cancelled event
      this.events.emit('subscription:cancelled', {
        subscriptionId
      });

      this.logger.info(`Subscription cancelled: ${subscriptionId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${subscriptionId}`, error);
      throw error;
    }
  }

  /**
   * Get the status of the UserDashboard
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      installedTentacleCount: this.state.installedTentacles.length,
      purchasedTentacleCount: this.state.purchasedTentacles.length,
      licenseCount: this.state.licenses.length,
      subscriptionCount: this.state.subscriptions.length,
      isLoading: this.state.isLoading,
      error: this.state.error
    };
  }

  /**
   * Shutdown the UserDashboard
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn("UserDashboard not initialized");
      return true;
    }
    
    this.logger.info("Shutting down UserDashboard");
    
    try {
      // Clear state
      this.state.installedTentacles = [];
      this.state.purchasedTentacles = [];
      this.state.licenses = [];
      this.state.subscriptions = [];
      this.state.isLoading = false;
      
      this.initialized = false;
      this.logger.info("UserDashboard shutdown complete");
      return true;
    } catch (error) {
      this.logger.error("Failed to shutdown UserDashboard", error);
      throw error;
    }
  }
}

module.exports = { UserDashboard };
