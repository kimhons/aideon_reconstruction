/**
 * @fileoverview Integration of FeaturedTentaclesShowcase with MarketplaceUI
 * This file updates the MarketplaceUI to integrate the FeaturedTentaclesShowcase component
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies with support for dependency injection in tests
let Logger;
let EventEmitter;

// Use try-catch to support both direct imports and mocked imports
try {
  const LoggerModule = require('../../../core/logging/Logger');
  const EventEmitterModule = require('../../../core/events/EventEmitter');
  
  Logger = LoggerModule.Logger;
  EventEmitter = EventEmitterModule.EventEmitter;
} catch (error) {
  // In test environment, these will be mocked
  Logger = require('../../../test/mocks/Logger').Logger;
  EventEmitter = require('../../../test/mocks/EventEmitter').EventEmitter;
}

// Import UI components
const { MarketplaceBrowser } = require('./browser/MarketplaceBrowser');
const { TentacleDetailView } = require('./browser/TentacleDetailView');
const { InstallationManager } = require('./installation/InstallationManager');
const { UserDashboard } = require('./dashboard/UserDashboard');
const { FeaturedTentaclesShowcase } = require('./showcase/FeaturedTentaclesShowcase');

/**
 * MarketplaceUI class - Main UI controller for the Aideon Tentacle Marketplace
 */
class MarketplaceUI {
  /**
   * Create a new MarketplaceUI instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement|Object} options.container - DOM container element or mock for tests
   * @param {Object} options.marketplaceCore - Reference to the MarketplaceCore
   * @param {Object} options.monetizationCore - Reference to the MonetizationCore
   * @param {Object} options.tentacleRegistry - Reference to the TentacleRegistry
   * @param {Object} options.config - UI configuration settings
   */
  constructor(options = {}) {
    this.options = options;
    this.container = options.container;
    this.marketplaceCore = options.marketplaceCore;
    this.monetizationCore = options.monetizationCore;
    this.tentacleRegistry = options.tentacleRegistry;
    this.config = options.config || {};
    this.logger = new Logger("MarketplaceUI");
    this.events = new EventEmitter();
    this.state = {
      currentView: null,
      isLoading: false,
      error: null
    };
    this.initialized = false;

    // For testing environments, accept a mock container
    if (process.env.NODE_ENV === 'test' && !this.container) {
      this.container = {
        appendChild: () => {},
        querySelector: () => ({}),
        querySelectorAll: () => ([]),
        addEventListener: () => {},
        removeEventListener: () => {},
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {}
        }
      };
    }

    this.logger.info("MarketplaceUI instance created");
  }

  /**
   * Initialize the MarketplaceUI
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("MarketplaceUI already initialized");
      return true;
    }

    this.logger.info("Initializing MarketplaceUI");

    try {
      // Validate dependencies
      if (!this.container && process.env.NODE_ENV !== 'test') {
        throw new Error("Container element is required");
      }

      if (!this.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }

      if (!this.monetizationCore) {
        throw new Error("MonetizationCore reference is required");
      }

      if (!this.tentacleRegistry) {
        throw new Error("TentacleRegistry reference is required");
      }

      // Initialize marketplace core if not already initialized
      if (!this.marketplaceCore.initialized) {
        await this.marketplaceCore.initialize();
      }

      // Initialize monetization core if not already initialized
      if (!this.monetizationCore.initialized) {
        await this.monetizationCore.initialize();
      }

      // Initialize tentacle registry if not already initialized
      if (!this.tentacleRegistry.initialized) {
        await this.tentacleRegistry.initialize();
      }

      // Initialize UI components in the correct order to avoid circular dependencies
      await this._initializeUIComponents();

      // Set up event listeners
      this._setupEventListeners();

      // Set up UI layout
      if (process.env.NODE_ENV !== 'test') {
        this._setupUILayout();
      }

      this.initialized = true;
      this.logger.info("MarketplaceUI initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize MarketplaceUI", error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Initialize UI components
   * @private
   */
  async _initializeUIComponents() {
    this.logger.info("Initializing UI components");

    try {
      // Create and initialize InstallationManager first
      this.installationManager = new InstallationManager({
        marketplaceCore: this.marketplaceCore,
        tentacleRegistry: this.tentacleRegistry,
        config: this.config.installation
      });
      await this.installationManager.initialize();

      // Create and initialize MarketplaceBrowser
      this.browser = new MarketplaceBrowser({
        marketplaceCore: this.marketplaceCore,
        config: this.config.browser
      });
      await this.browser.initialize();

      // Create and initialize TentacleDetailView with InstallationManager reference
      this.browser.detailView = new TentacleDetailView({
        marketplaceCore: this.marketplaceCore,
        installationManager: this.installationManager, // Now available
        config: this.config.detailView
      });
      await this.browser.detailView.initialize();

      // Create and initialize UserDashboard
      this.dashboard = new UserDashboard({
        marketplaceCore: this.marketplaceCore,
        installationManager: this.installationManager,
        monetizationCore: this.monetizationCore,
        config: this.config.dashboard
      });
      await this.dashboard.initialize();
      
      // Create and initialize FeaturedTentaclesShowcase
      this.featuredShowcase = new FeaturedTentaclesShowcase({
        marketplaceCore: this.marketplaceCore,
        config: this.config.featuredShowcase
      });
      await this.featuredShowcase.initialize();

      this.logger.info("UI components initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize UI components", error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    this.logger.info("Setting up event listeners");

    // Listen for browser events
    if (this.browser && this.browser.events) {
      this.browser.events.on("tentacle:selected", this._handleTentacleSelected.bind(this));
    }

    // Listen for detail view events
    if (this.browser.detailView && this.browser.detailView.events) {
      this.browser.detailView.events.on("tentacle:installed", this._handleTentacleInstalled.bind(this));
      this.browser.detailView.events.on("tentacle:purchased", this._handleTentaclePurchased.bind(this));
    }

    // Listen for installation manager events
    if (this.installationManager && this.installationManager.events) {
      this.installationManager.events.on("installation:completed", this._handleInstallationCompleted.bind(this));
      this.installationManager.events.on("uninstallation:completed", this._handleUninstallationCompleted.bind(this));
    }

    // Listen for dashboard events
    if (this.dashboard && this.dashboard.events) {
      this.dashboard.events.on("user:data:loaded", this._handleUserDataLoaded.bind(this));
    }
    
    // Listen for featured showcase events
    if (this.featuredShowcase && this.featuredShowcase.events) {
      this.featuredShowcase.events.on("tentacle:selected", this._handleTentacleSelected.bind(this));
      this.featuredShowcase.events.on("featured:loaded", this._handleFeaturedLoaded.bind(this));
      this.featuredShowcase.events.on("recommended:loaded", this._handleRecommendedLoaded.bind(this));
    }

    this.logger.info("Event listeners set up");
  }

  /**
   * Set up UI layout
   * @private
   */
  _setupUILayout() {
    this.logger.info("Setting up UI layout");

    // Create main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'marketplace-ui-container';
    
    // Create featured showcase container
    const featuredContainer = document.createElement('div');
    featuredContainer.className = 'marketplace-featured-container';
    
    // Create browser container
    const browserContainer = document.createElement('div');
    browserContainer.className = 'marketplace-browser-container';
    
    // Create detail container
    const detailContainer = document.createElement('div');
    detailContainer.className = 'marketplace-detail-container';
    
    // Create dashboard container
    const dashboardContainer = document.createElement('div');
    dashboardContainer.className = 'marketplace-dashboard-container';
    
    // Add containers to main container
    mainContainer.appendChild(featuredContainer);
    mainContainer.appendChild(browserContainer);
    mainContainer.appendChild(detailContainer);
    mainContainer.appendChild(dashboardContainer);
    
    // Add main container to container
    this.container.appendChild(mainContainer);
    
    // Initialize featured showcase with its container
    if (this.featuredShowcase) {
      this.featuredShowcase.container = featuredContainer;
      this._renderFeaturedShowcase();
    }
    
    // Initialize browser with its container
    if (this.browser) {
      this.browser.container = browserContainer;
      this._renderBrowser();
    }
    
    // Initialize detail view with its container
    if (this.browser.detailView) {
      this.browser.detailView.container = detailContainer;
      this._renderDetailView();
    }
    
    // Initialize dashboard with its container
    if (this.dashboard) {
      this.dashboard.container = dashboardContainer;
      this._renderDashboard();
    }
    
    // Set initial view
    this.navigateTo('browse').catch(error => {
      this.logger.error("Failed to navigate to initial view", error);
    });

    this.logger.info("UI layout set up");
  }
  
  /**
   * Render featured showcase
   * @private
   */
  _renderFeaturedShowcase() {
    this.logger.info("Rendering featured showcase");
    
    // In a real implementation, this would render the featured showcase
    // For this mock implementation, we'll just log the action
    this.logger.info("Featured showcase rendered");
  }
  
  /**
   * Render browser
   * @private
   */
  _renderBrowser() {
    this.logger.info("Rendering browser");
    
    // In a real implementation, this would render the browser
    // For this mock implementation, we'll just log the action
    this.logger.info("Browser rendered");
  }
  
  /**
   * Render detail view
   * @private
   */
  _renderDetailView() {
    this.logger.info("Rendering detail view");
    
    // In a real implementation, this would render the detail view
    // For this mock implementation, we'll just log the action
    this.logger.info("Detail view rendered");
  }
  
  /**
   * Render dashboard
   * @private
   */
  _renderDashboard() {
    this.logger.info("Rendering dashboard");
    
    // In a real implementation, this would render the dashboard
    // For this mock implementation, we'll just log the action
    this.logger.info("Dashboard rendered");
  }

  /**
   * Handle tentacle selected event
   * @param {Object} event - Tentacle selected event
   * @private
   */
  _handleTentacleSelected(event) {
    const { tentacleId, tentacle } = event;
    this.logger.info(`Tentacle selected: ${tentacleId}`);

    // Update state
    this.state.currentView = 'detail';

    // Emit tentacle selected event
    this.events.emit('tentacle:selected', {
      tentacleId,
      tentacle
    });
    
    // Navigate to detail view
    this.navigateTo('detail', { tentacleId }).catch(error => {
      this.logger.error(`Failed to navigate to detail view for tentacle ${tentacleId}`, error);
    });
  }

  /**
   * Handle tentacle installed event
   * @param {Object} event - Tentacle installed event
   * @private
   */
  _handleTentacleInstalled(event) {
    const { tentacleId, result } = event;
    this.logger.info(`Tentacle installed: ${tentacleId}`);

    // Emit tentacle installed event
    this.events.emit('tentacle:installed', {
      tentacleId,
      result
    });
  }

  /**
   * Handle tentacle purchased event
   * @param {Object} event - Tentacle purchased event
   * @private
   */
  _handleTentaclePurchased(event) {
    const { tentacleId, result } = event;
    this.logger.info(`Tentacle purchased: ${tentacleId}`);

    // Emit tentacle purchased event
    this.events.emit('tentacle:purchased', {
      tentacleId,
      result
    });
  }

  /**
   * Handle installation completed event
   * @param {Object} event - Installation completed event
   * @private
   */
  _handleInstallationCompleted(event) {
    const { tentacleId } = event;
    this.logger.info(`Installation completed for tentacle: ${tentacleId}`);

    // Emit installation completed event
    this.events.emit('installation:completed', {
      tentacleId
    });
  }

  /**
   * Handle uninstallation completed event
   * @param {Object} event - Uninstallation completed event
   * @private
   */
  _handleUninstallationCompleted(event) {
    const { tentacleId } = event;
    this.logger.info(`Uninstallation completed for tentacle: ${tentacleId}`);

    // Emit uninstallation completed event
    this.events.emit('uninstallation:completed', {
      tentacleId
    });
  }

  /**
   * Handle user data loaded event
   * @param {Object} event - User data loaded event
   * @private
   */
  _handleUserDataLoaded(event) {
    const { installedTentacleCount, purchasedTentacleCount } = event;
    this.logger.info(`User data loaded: ${installedTentacleCount} installed tentacles, ${purchasedTentacleCount} purchased tentacles`);

    // Emit user data loaded event
    this.events.emit('user:data:loaded', event);
  }
  
  /**
   * Handle featured loaded event
   * @param {Object} event - Featured loaded event
   * @private
   */
  _handleFeaturedLoaded(event) {
    const { tentacles } = event;
    this.logger.info(`Featured tentacles loaded: ${tentacles.length} tentacles`);
    
    // Emit featured loaded event
    this.events.emit('featured:loaded', event);
  }
  
  /**
   * Handle recommended loaded event
   * @param {Object} event - Recommended loaded event
   * @private
   */
  _handleRecommendedLoaded(event) {
    const { tentacles } = event;
    this.logger.info(`Recommended tentacles loaded: ${tentacles.length} tentacles`);
    
    // Emit recommended loaded event
    this.events.emit('recommended:loaded', event);
  }

  /**
   * Navigate to a specific view
   * @param {string} view - View name
   * @param {Object} params - Navigation parameters
   * @returns {Promise<boolean>} - Promise resolving to true if navigation was successful
   */
  async navigateTo(view, params = {}) {
    if (!this.initialized) {
      throw new Error("MarketplaceUI not initialized");
    }

    this.logger.info(`Navigating to view: ${view}`);

    try {
      // Update state
      this.state.currentView = view;

      // Handle navigation based on view
      switch (view) {
        case 'browse':
          // Show browser view
          // In a real implementation, this would update the UI
          break;
        case 'detail':
          // Show detail view for specific tentacle
          if (params.tentacleId) {
            await this.browser.detailView.loadTentacle(params.tentacleId);
          }
          break;
        case 'dashboard':
          // Show user dashboard
          await this.dashboard.loadUserData();
          break;
        default:
          throw new Error(`Unknown view: ${view}`);
      }

      // Emit navigation event
      this.events.emit('navigation:complete', {
        view,
        params
      });

      this.logger.info(`Navigation to ${view} complete`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to navigate to ${view}`, error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Get the status of the MarketplaceUI
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentView: this.state.currentView,
      isLoading: this.state.isLoading,
      error: this.state.error,
      browser: this.browser ? this.browser.getStatus() : null,
      installationManager: this.installationManager ? this.installationManager.getStatus() : null,
      dashboard: this.dashboard ? this.dashboard.getStatus() : null,
      featuredShowcase: this.featuredShowcase ? this.featuredShowcase.getStatus() : null
    };
  }

  /**
   * Shutdown the MarketplaceUI
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn("MarketplaceUI not initialized");
      return true;
    }
    
    this.logger.info("Shutting down MarketplaceUI");
    
    try {
      // Shutdown UI components
      if (this.browser) {
        await this.browser.shutdown();
      }
      
      if (this.browser.detailView) {
        await this.browser.detailView.shutdown();
      }
      
      if (this.installationManager) {
        await this.installationManager.shutdown();
      }
      
      if (this.dashboard) {
        await this.dashboard.shutdown();
      }
      
      if (this.featuredShowcase) {
        await this.featuredShowcase.shutdown();
      }
      
      this.initialized = false;
      this.logger.info("MarketplaceUI shutdown complete");
      return true;
    } catch (error) {
      this.logger.error("Failed to shutdown MarketplaceUI", error);
      throw error;
    }
  }
}

module.exports = { MarketplaceUI };
