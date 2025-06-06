/**
 * @fileoverview UserDashboard component for the Aideon Tentacle Marketplace.
 * This component provides a dashboard for users to manage their tentacles,
 * licenses, and marketplace activity.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require("../../../core/logging/Logger");
const { EventEmitter } = require("../../../core/events/EventEmitter");
const path = require("path");

// In a real React application, these would be actual React imports
// For this conceptual implementation, we use placeholder objects
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };

/**
 * UserDashboard class - Provides user dashboard functionality
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
      currentUser: null,
      installedTentacles: [],
      purchasedTentacles: [],
      licenses: [],
      subscriptions: [],
      currentTab: "installed", // installed, purchased, licenses, subscriptions, activity
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

      // Setup event listeners
      if (this.installationManager) {
        this.installationManager.events.on("installation:completed", this._handleInstallationCompleted.bind(this));
        this.installationManager.events.on("uninstallation:completed", this._handleUninstallationCompleted.bind(this));
      }

      if (this.monetizationCore) {
        this.monetizationCore.events.on("license:activated", this._handleLicenseActivated.bind(this));
        this.monetizationCore.events.on("license:deactivated", this._handleLicenseDeactivated.bind(this));
        this.monetizationCore.events.on("subscription:changed", this._handleSubscriptionChanged.bind(this));
      }

      // Load user data
      await this.loadUserData();

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
   * Load user data
   * @returns {Promise<Object>} - Promise resolving to user data
   */
  async loadUserData() {
    this.logger.info("Loading user data");
    
    try {
      this.state.isLoading = true;
      
      // In a real implementation, this would call the MarketplaceCore API
      // For this mock implementation, we'll use placeholder data
      const currentUser = {
        id: "user123",
        username: "JohnDoe",
        email: "john.doe@example.com",
        avatarUrl: "https://example.com/avatars/johndoe.png",
        joinDate: "2025-01-15"
      };
      
      // Load installed tentacles
      const installedTentacles = await this._loadInstalledTentacles();
      
      // Load purchased tentacles
      const purchasedTentacles = await this._loadPurchasedTentacles();
      
      // Load licenses
      const licenses = await this._loadLicenses();
      
      // Load subscriptions
      const subscriptions = await this._loadSubscriptions();
      
      // Update state
      this.state.currentUser = currentUser;
      this.state.installedTentacles = installedTentacles;
      this.state.purchasedTentacles = purchasedTentacles;
      this.state.licenses = licenses;
      this.state.subscriptions = subscriptions;
      this.state.isLoading = false;
      
      this.logger.info("User data loaded successfully");
      return {
        currentUser,
        installedTentacles,
        purchasedTentacles,
        licenses,
        subscriptions
      };
    } catch (error) {
      this.state.isLoading = false;
      this.state.error = `Failed to load user data: ${error.message}`;
      this.logger.error("Failed to load user data", error);
      throw error;
    }
  }

  /**
   * Load installed tentacles
   * @returns {Promise<Array>} - Promise resolving to array of installed tentacles
   * @private
   */
  async _loadInstalledTentacles() {
    try {
      if (this.installationManager) {
        return this.installationManager.getAllInstalledTentacles();
      }
      
      // Fallback if installation manager is not available
      return [
        {
          id: "contextual-intelligence",
          name: "Contextual Intelligence",
          version: "1.0.0",
          installDate: "2025-05-20",
          status: "active"
        },
        {
          id: "productivity-suite",
          name: "Productivity Suite",
          version: "2.1.3",
          installDate: "2025-05-15",
          status: "active"
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load installed tentacles", error);
      return [];
    }
  }

  /**
   * Load purchased tentacles
   * @returns {Promise<Array>} - Promise resolving to array of purchased tentacles
   * @private
   */
  async _loadPurchasedTentacles() {
    try {
      // In a real implementation, this would call the MonetizationCore
      // For this mock implementation, we'll use placeholder data
      return [
        {
          id: "devmaster",
          name: "DevMaster",
          purchaseDate: "2025-05-10",
          price: 49.99,
          licenseType: "one_time"
        },
        {
          id: "contextual-intelligence",
          name: "Contextual Intelligence",
          purchaseDate: "2025-05-20",
          price: 39.99,
          licenseType: "one_time"
        },
        {
          id: "productivity-suite",
          name: "Productivity Suite",
          purchaseDate: "2025-05-15",
          price: 29.99,
          licenseType: "subscription"
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load purchased tentacles", error);
      return [];
    }
  }

  /**
   * Load licenses
   * @returns {Promise<Array>} - Promise resolving to array of licenses
   * @private
   */
  async _loadLicenses() {
    try {
      // In a real implementation, this would call the MonetizationCore
      // For this mock implementation, we'll use placeholder data
      return [
        {
          id: "license-devmaster",
          tentacleId: "devmaster",
          tentacleName: "DevMaster",
          licenseKey: "DM-1234-5678-9012",
          activationDate: "2025-05-10",
          expirationDate: null,
          status: "active",
          type: "perpetual"
        },
        {
          id: "license-contextual-intelligence",
          tentacleId: "contextual-intelligence",
          tentacleName: "Contextual Intelligence",
          licenseKey: "CI-2345-6789-0123",
          activationDate: "2025-05-20",
          expirationDate: null,
          status: "active",
          type: "perpetual"
        },
        {
          id: "license-productivity-suite",
          tentacleId: "productivity-suite",
          tentacleName: "Productivity Suite",
          licenseKey: "PS-3456-7890-1234",
          activationDate: "2025-05-15",
          expirationDate: "2026-05-15",
          status: "active",
          type: "subscription"
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load licenses", error);
      return [];
    }
  }

  /**
   * Load subscriptions
   * @returns {Promise<Array>} - Promise resolving to array of subscriptions
   * @private
   */
  async _loadSubscriptions() {
    try {
      // In a real implementation, this would call the MonetizationCore
      // For this mock implementation, we'll use placeholder data
      return [
        {
          id: "sub-productivity-suite",
          tentacleId: "productivity-suite",
          tentacleName: "Productivity Suite",
          startDate: "2025-05-15",
          nextBillingDate: "2025-06-15",
          amount: 29.99,
          interval: "monthly",
          status: "active",
          paymentMethod: "Credit Card ending in 1234"
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load subscriptions", error);
      return [];
    }
  }

  /**
   * Change the current tab
   * @param {string} tab - Tab name
   */
  changeTab(tab) {
    this.logger.info(`Changing tab to: ${tab}`);
    this.state.currentTab = tab;
  }

  /**
   * Install a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to installation result
   */
  async installTentacle(tentacleId) {
    this.logger.info(`Installing tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      const result = await this.installationManager.installTentacle(tentacleId);
      
      if (result.success && !result.alreadyInstalled) {
        // Refresh installed tentacles
        this.state.installedTentacles = await this._loadInstalledTentacles();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to install tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Uninstall a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to uninstallation result
   */
  async uninstallTentacle(tentacleId) {
    this.logger.info(`Uninstalling tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      const result = await this.installationManager.uninstallTentacle(tentacleId);
      
      if (result.success) {
        // Refresh installed tentacles
        this.state.installedTentacles = await this._loadInstalledTentacles();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to uninstall tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Update a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to update result
   */
  async updateTentacle(tentacleId) {
    this.logger.info(`Updating tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      const result = await this.installationManager.updateTentacle(tentacleId);
      
      if (result.success) {
        // Refresh installed tentacles
        this.state.installedTentacles = await this._loadInstalledTentacles();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to update tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Enable a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to enable result
   */
  async enableTentacle(tentacleId) {
    this.logger.info(`Enabling tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      const result = await this.installationManager.enableTentacle(tentacleId);
      
      if (result.success) {
        // Refresh installed tentacles
        this.state.installedTentacles = await this._loadInstalledTentacles();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to enable tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Disable a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to disable result
   */
  async disableTentacle(tentacleId) {
    this.logger.info(`Disabling tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      const result = await this.installationManager.disableTentacle(tentacleId);
      
      if (result.success) {
        // Refresh installed tentacles
        this.state.installedTentacles = await this._loadInstalledTentacles();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to disable tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Activate a license
   * @param {string} licenseKey - License key
   * @returns {Promise<Object>} - Promise resolving to activation result
   */
  async activateLicense(licenseKey) {
    this.logger.info(`Activating license: ${licenseKey}`);
    
    try {
      if (!this.monetizationCore) {
        throw new Error("MonetizationCore not available");
      }
      
      // In a real implementation, this would call the MonetizationCore
      // For this mock implementation, we'll simulate license activation
      
      // Check if license is already in the list
      const existingLicense = this.state.licenses.find(license => license.licenseKey === licenseKey);
      if (existingLicense) {
        return {
          success: true,
          licenseId: existingLicense.id,
          message: "License already activated"
        };
      }
      
      // Simulate license activation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add new license to the list
      const newLicense = {
        id: `license-${Date.now()}`,
        tentacleId: "new-tentacle",
        tentacleName: "New Tentacle",
        licenseKey: licenseKey,
        activationDate: new Date().toISOString().split('T')[0],
        expirationDate: null,
        status: "active",
        type: "perpetual"
      };
      
      this.state.licenses = [...this.state.licenses, newLicense];
      
      // Add to purchased tentacles
      const newPurchase = {
        id: newLicense.tentacleId,
        name: newLicense.tentacleName,
        purchaseDate: newLicense.activationDate,
        price: 0, // Unknown price for manually activated license
        licenseType: "one_time"
      };
      
      this.state.purchasedTentacles = [...this.state.purchasedTentacles, newPurchase];
      
      return {
        success: true,
        licenseId: newLicense.id,
        message: "License activated successfully"
      };
    } catch (error) {
      this.logger.error(`Failed to activate license: ${licenseKey}`, error);
      return {
        success: false,
        message: `Failed to activate license: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Deactivate a license
   * @param {string} licenseId - License ID
   * @returns {Promise<Object>} - Promise resolving to deactivation result
   */
  async deactivateLicense(licenseId) {
    this.logger.info(`Deactivating license: ${licenseId}`);
    
    try {
      if (!this.monetizationCore) {
        throw new Error("MonetizationCore not available");
      }
      
      // In a real implementation, this would call the MonetizationCore
      // For this mock implementation, we'll simulate license deactivation
      
      // Find the license
      const licenseIndex = this.state.licenses.findIndex(license => license.id === licenseId);
      if (licenseIndex === -1) {
        return {
          success: false,
          message: "License not found"
        };
      }
      
      // Update license status
      const updatedLicenses = [...this.state.licenses];
      updatedLicenses[licenseIndex] = {
        ...updatedLicenses[licenseIndex],
        status: "inactive"
      };
      
      this.state.licenses = updatedLicenses;
      
      return {
        success: true,
        licenseId,
        message: "License deactivated successfully"
      };
    } catch (error) {
      this.logger.error(`Failed to deactivate license: ${licenseId}`, error);
      return {
        success: false,
        message: `Failed to deactivate license: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} - Promise resolving to cancellation result
   */
  async cancelSubscription(subscriptionId) {
    this.logger.info(`Cancelling subscription: ${subscriptionId}`);
    
    try {
      if (!this.monetizationCore) {
        throw new Error("MonetizationCore not available");
      }
      
      // In a real implementation, this would call the MonetizationCore
      // For this mock implementation, we'll simulate subscription cancellation
      
      // Find the subscription
      const subscriptionIndex = this.state.subscriptions.findIndex(sub => sub.id === subscriptionId);
      if (subscriptionIndex === -1) {
        return {
          success: false,
          message: "Subscription not found"
        };
      }
      
      // Update subscription status
      const updatedSubscriptions = [...this.state.subscriptions];
      updatedSubscriptions[subscriptionIndex] = {
        ...updatedSubscriptions[subscriptionIndex],
        status: "cancelled",
        cancellationDate: new Date().toISOString().split('T')[0]
      };
      
      this.state.subscriptions = updatedSubscriptions;
      
      return {
        success: true,
        subscriptionId,
        message: "Subscription cancelled successfully"
      };
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${subscriptionId}`, error);
      return {
        success: false,
        message: `Failed to cancel subscription: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Handle installation completed event
   * @param {Object} event - Installation completed event
   * @private
   */
  async _handleInstallationCompleted(event) {
    this.logger.info(`Handling installation completed event for tentacle: ${event.tentacleId}`);
    
    // Refresh installed tentacles
    this.state.installedTentacles = await this._loadInstalledTentacles();
  }

  /**
   * Handle uninstallation completed event
   * @param {Object} event - Uninstallation completed event
   * @private
   */
  async _handleUninstallationCompleted(event) {
    this.logger.info(`Handling uninstallation completed event for tentacle: ${event.tentacleId}`);
    
    // Refresh installed tentacles
    this.state.installedTentacles = await this._loadInstalledTentacles();
  }

  /**
   * Handle license activated event
   * @param {Object} event - License activated event
   * @private
   */
  async _handleLicenseActivated(event) {
    this.logger.info(`Handling license activated event: ${event.licenseId}`);
    
    // Refresh licenses
    this.state.licenses = await this._loadLicenses();
    
    // Refresh purchased tentacles
    this.state.purchasedTentacles = await this._loadPurchasedTentacles();
  }

  /**
   * Handle license deactivated event
   * @param {Object} event - License deactivated event
   * @private
   */
  async _handleLicenseDeactivated(event) {
    this.logger.info(`Handling license deactivated event: ${event.licenseId}`);
    
    // Refresh licenses
    this.state.licenses = await this._loadLicenses();
  }

  /**
   * Handle subscription changed event
   * @param {Object} event - Subscription changed event
   * @private
   */
  async _handleSubscriptionChanged(event) {
    this.logger.info(`Handling subscription changed event: ${event.subscriptionId}`);
    
    // Refresh subscriptions
    this.state.subscriptions = await this._loadSubscriptions();
  }

  /**
   * Render the UserDashboard component
   * @returns {Object} - React-like element representing the component
   */
  render() {
    const { currentUser, installedTentacles, purchasedTentacles, licenses, subscriptions, currentTab, isLoading, error } = this.state;
    
    // Error state
    if (error) {
      return React.createElement("div", { className: "error-message" }, `Error: ${error}`);
    }
    
    // Loading state
    if (isLoading || !currentUser) {
      return React.createElement("div", { className: "loading-indicator" }, "Loading user dashboard...");
    }
    
    // Main content
    return React.createElement(
      "div",
      { className: "user-dashboard" },
      // User profile section
      React.createElement(
        "div",
        { className: "user-profile" },
        React.createElement("img", { 
          className: "user-avatar",
          src: currentUser.avatarUrl,
          alt: `${currentUser.username} avatar`
        }),
        React.createElement("h2", { className: "user-name" }, currentUser.username),
        React.createElement("p", { className: "user-email" }, currentUser.email),
        React.createElement("p", { className: "user-join-date" }, `Member since ${currentUser.joinDate}`)
      ),
      
      // Tabs navigation
      React.createElement(
        "div",
        { className: "dashboard-tabs" },
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "installed" ? "active" : ""}`,
            onClick: () => this.changeTab("installed")
          }, 
          `Installed (${installedTentacles.length})`
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "purchased" ? "active" : ""}`,
            onClick: () => this.changeTab("purchased")
          }, 
          `Purchased (${purchasedTentacles.length})`
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "licenses" ? "active" : ""}`,
            onClick: () => this.changeTab("licenses")
          }, 
          `Licenses (${licenses.length})`
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "subscriptions" ? "active" : ""}`,
            onClick: () => this.changeTab("subscriptions")
          }, 
          `Subscriptions (${subscriptions.length})`
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "activity" ? "active" : ""}`,
            onClick: () => this.changeTab("activity")
          }, 
          "Activity"
        )
      ),
      
      // Tab content
      React.createElement(
        "div",
        { className: "dashboard-tab-content" },
        // Installed tentacles tab
        currentTab === "installed" ?
          React.createElement(
            "div",
            { className: "tab-installed" },
            React.createElement("h2", null, "Installed Tentacles"),
            installedTentacles.length > 0 ?
              React.createElement(
                "table",
                { className: "tentacle-table" },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", null, "Name"),
                    React.createElement("th", null, "Version"),
                    React.createElement("th", null, "Install Date"),
                    React.createElement("th", null, "Status"),
                    React.createElement("th", null, "Actions")
                  )
                ),
                React.createElement(
                  "tbody",
                  null,
                  installedTentacles.map(tentacle => 
                    React.createElement(
                      "tr",
                      { key: tentacle.id },
                      React.createElement("td", null, tentacle.name),
                      React.createElement("td", null, tentacle.version),
                      React.createElement("td", null, tentacle.installDate),
                      React.createElement("td", null, 
                        React.createElement("span", { 
                          className: `status-badge ${tentacle.status}`
                        }, tentacle.status)
                      ),
                      React.createElement("td", null,
                        React.createElement(
                          "div",
                          { className: "action-buttons" },
                          React.createElement("button", { 
                            onClick: () => this.updateTentacle(tentacle.id)
                          }, "Update"),
                          tentacle.status === "active" ?
                            React.createElement("button", { 
                              onClick: () => this.disableTentacle(tentacle.id)
                            }, "Disable") :
                            React.createElement("button", { 
                              onClick: () => this.enableTentacle(tentacle.id)
                            }, "Enable"),
                          React.createElement("button", { 
                            className: "danger",
                            onClick: () => this.uninstallTentacle(tentacle.id)
                          }, "Uninstall")
                        )
                      )
                    )
                  )
                )
              ) :
              React.createElement("p", { className: "no-items" }, "No tentacles installed.")
          ) : null,
        
        // Purchased tentacles tab
        currentTab === "purchased" ?
          React.createElement(
            "div",
            { className: "tab-purchased" },
            React.createElement("h2", null, "Purchased Tentacles"),
            purchasedTentacles.length > 0 ?
              React.createElement(
                "table",
                { className: "tentacle-table" },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", null, "Name"),
                    React.createElement("th", null, "Purchase Date"),
                    React.createElement("th", null, "Price"),
                    React.createElement("th", null, "License Type"),
                    React.createElement("th", null, "Actions")
                  )
                ),
                React.createElement(
                  "tbody",
                  null,
                  purchasedTentacles.map(tentacle => 
                    React.createElement(
                      "tr",
                      { key: tentacle.id },
                      React.createElement("td", null, tentacle.name),
                      React.createElement("td", null, tentacle.purchaseDate),
                      React.createElement("td", null, tentacle.price > 0 ? `$${tentacle.price.toFixed(2)}` : "Free"),
                      React.createElement("td", null, tentacle.licenseType === "one_time" ? "Perpetual" : "Subscription"),
                      React.createElement("td", null,
                        React.createElement(
                          "div",
                          { className: "action-buttons" },
                          !this.installedTentacles.find(t => t.id === tentacle.id) ?
                            React.createElement("button", { 
                              onClick: () => this.installTentacle(tentacle.id)
                            }, "Install") : null,
                          React.createElement("button", { 
                            onClick: () => this.events.emit("tentacle:view", { tentacleId: tentacle.id })
                          }, "View Details")
                        )
                      )
                    )
                  )
                )
              ) :
              React.createElement("p", { className: "no-items" }, "No tentacles purchased.")
          ) : null,
        
        // Licenses tab
        currentTab === "licenses" ?
          React.createElement(
            "div",
            { className: "tab-licenses" },
            React.createElement("h2", null, "Licenses"),
            React.createElement(
              "div",
              { className: "license-activation" },
              React.createElement("h3", null, "Activate License"),
              React.createElement(
                "form",
                { 
                  onSubmit: (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    this.activateLicense(formData.get("licenseKey"));
                    e.target.reset();
                  }
                },
                React.createElement("input", { 
                  type: "text", 
                  name: "licenseKey", 
                  placeholder: "Enter license key",
                  required: true
                }),
                React.createElement("button", { type: "submit" }, "Activate")
              )
            ),
            licenses.length > 0 ?
              React.createElement(
                "table",
                { className: "license-table" },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", null, "Tentacle"),
                    React.createElement("th", null, "License Key"),
                    React.createElement("th", null, "Activation Date"),
                    React.createElement("th", null, "Expiration"),
                    React.createElement("th", null, "Status"),
                    React.createElement("th", null, "Actions")
                  )
                ),
                React.createElement(
                  "tbody",
                  null,
                  licenses.map(license => 
                    React.createElement(
                      "tr",
                      { key: license.id },
                      React.createElement("td", null, license.tentacleName),
                      React.createElement("td", null, license.licenseKey),
                      React.createElement("td", null, license.activationDate),
                      React.createElement("td", null, license.expirationDate || "Never"),
                      React.createElement("td", null, 
                        React.createElement("span", { 
                          className: `status-badge ${license.status}`
                        }, license.status)
                      ),
                      React.createElement("td", null,
                        React.createElement(
                          "div",
                          { className: "action-buttons" },
                          license.status === "active" ?
                            React.createElement("button", { 
                              onClick: () => this.deactivateLicense(license.id)
                            }, "Deactivate") : null
                        )
                      )
                    )
                  )
                )
              ) :
              React.createElement("p", { className: "no-items" }, "No licenses found.")
          ) : null,
        
        // Subscriptions tab
        currentTab === "subscriptions" ?
          React.createElement(
            "div",
            { className: "tab-subscriptions" },
            React.createElement("h2", null, "Subscriptions"),
            subscriptions.length > 0 ?
              React.createElement(
                "table",
                { className: "subscription-table" },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", null, "Tentacle"),
                    React.createElement("th", null, "Start Date"),
                    React.createElement("th", null, "Next Billing"),
                    React.createElement("th", null, "Amount"),
                    React.createElement("th", null, "Status"),
                    React.createElement("th", null, "Actions")
                  )
                ),
                React.createElement(
                  "tbody",
                  null,
                  subscriptions.map(subscription => 
                    React.createElement(
                      "tr",
                      { key: subscription.id },
                      React.createElement("td", null, subscription.tentacleName),
                      React.createElement("td", null, subscription.startDate),
                      React.createElement("td", null, subscription.nextBillingDate),
                      React.createElement("td", null, `$${subscription.amount.toFixed(2)}/${subscription.interval}`),
                      React.createElement("td", null, 
                        React.createElement("span", { 
                          className: `status-badge ${subscription.status}`
                        }, subscription.status)
                      ),
                      React.createElement("td", null,
                        React.createElement(
                          "div",
                          { className: "action-buttons" },
                          subscription.status === "active" ?
                            React.createElement("button", { 
                              className: "danger",
                              onClick: () => this.cancelSubscription(subscription.id)
                            }, "Cancel") : null
                        )
                      )
                    )
                  )
                )
              ) :
              React.createElement("p", { className: "no-items" }, "No active subscriptions.")
          ) : null,
        
        // Activity tab
        currentTab === "activity" ?
          React.createElement(
            "div",
            { className: "tab-activity" },
            React.createElement("h2", null, "Recent Activity"),
            React.createElement(
              "div",
              { className: "activity-list" },
              React.createElement(
                "div",
                { className: "activity-item" },
                React.createElement("span", { className: "activity-date" }, "2025-06-05"),
                React.createElement("span", { className: "activity-type purchase" }, "Purchase"),
                React.createElement("span", { className: "activity-description" }, "Purchased DevMaster tentacle")
              ),
              React.createElement(
                "div",
                { className: "activity-item" },
                React.createElement("span", { className: "activity-date" }, "2025-06-05"),
                React.createElement("span", { className: "activity-type install" }, "Install"),
                React.createElement("span", { className: "activity-description" }, "Installed DevMaster tentacle")
              ),
              React.createElement(
                "div",
                { className: "activity-item" },
                React.createElement("span", { className: "activity-date" }, "2025-05-20"),
                React.createElement("span", { className: "activity-type purchase" }, "Purchase"),
                React.createElement("span", { className: "activity-description" }, "Purchased Contextual Intelligence tentacle")
              ),
              React.createElement(
                "div",
                { className: "activity-item" },
                React.createElement("span", { className: "activity-date" }, "2025-05-20"),
                React.createElement("span", { className: "activity-type install" }, "Install"),
                React.createElement("span", { className: "activity-description" }, "Installed Contextual Intelligence tentacle")
              ),
              React.createElement(
                "div",
                { className: "activity-item" },
                React.createElement("span", { className: "activity-date" }, "2025-05-15"),
                React.createElement("span", { className: "activity-type subscription" }, "Subscription"),
                React.createElement("span", { className: "activity-description" }, "Started subscription for Productivity Suite tentacle")
              ),
              React.createElement(
                "div",
                { className: "activity-item" },
                React.createElement("span", { className: "activity-date" }, "2025-05-15"),
                React.createElement("span", { className: "activity-type install" }, "Install"),
                React.createElement("span", { className: "activity-description" }, "Installed Productivity Suite tentacle")
              )
            )
          ) : null
      )
    );
  }

  /**
   * Get the status of the UserDashboard
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentTab: this.state.currentTab,
      installedTentacleCount: this.state.installedTentacles.length,
      purchasedTentacleCount: this.state.purchasedTentacles.length,
      licenseCount: this.state.licenses.length,
      subscriptionCount: this.state.subscriptions.length
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
    
    // Remove event listeners
    if (this.installationManager) {
      this.installationManager.events.off("installation:completed", this._handleInstallationCompleted);
      this.installationManager.events.off("uninstallation:completed", this._handleUninstallationCompleted);
    }

    if (this.monetizationCore) {
      this.monetizationCore.events.off("license:activated", this._handleLicenseActivated);
      this.monetizationCore.events.off("license:deactivated", this._handleLicenseDeactivated);
      this.monetizationCore.events.off("subscription:changed", this._handleSubscriptionChanged);
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { UserDashboard };
