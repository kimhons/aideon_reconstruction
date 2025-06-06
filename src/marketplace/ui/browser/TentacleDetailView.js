/**
 * @fileoverview TentacleDetailView component for the Aideon Tentacle Marketplace.
 * This component provides detailed information about a specific tentacle.
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
 * TentacleDetailView class - Provides detailed view of a tentacle
 */
class TentacleDetailView {
  /**
   * Create a new TentacleDetailView instance
   * @param {Object} options - Configuration options
   * @param {Object} options.marketplaceCore - Reference to the MarketplaceCore
   * @param {Object} options.installationManager - Reference to the InstallationManager
   * @param {Object} options.config - View configuration settings
   */
  constructor(options = {}) {
    this.options = options;
    this.marketplaceCore = options.marketplaceCore;
    this.installationManager = options.installationManager;
    this.config = options.config || {};
    this.logger = new Logger("TentacleDetailView");
    this.events = new EventEmitter();
    this.state = {
      tentacleId: null,
      tentacle: null,
      reviews: [],
      currentTab: "overview", // overview, features, requirements, reviews
      isLoading: false,
      error: null,
      isInstalled: false,
      isInstalling: false,
      installProgress: 0,
      isPurchased: false,
      isInCart: false
    };
    this.initialized = false;

    this.logger.info("TentacleDetailView instance created");
  }

  /**
   * Initialize the TentacleDetailView
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("TentacleDetailView already initialized");
      return true;
    }

    this.logger.info("Initializing TentacleDetailView");

    try {
      // Validate dependencies
      if (!this.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }

      // Setup event listeners
      if (this.installationManager) {
        this.installationManager.events.on("installation:started", this._handleInstallationStarted.bind(this));
        this.installationManager.events.on("installation:progress", this._handleInstallationProgress.bind(this));
        this.installationManager.events.on("installation:completed", this._handleInstallationCompleted.bind(this));
        this.installationManager.events.on("installation:failed", this._handleInstallationFailed.bind(this));
      }

      this.initialized = true;
      this.logger.info("TentacleDetailView initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize TentacleDetailView", error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Load tentacle details
   * @param {string} tentacleId - ID of the tentacle to load
   * @returns {Promise<Object>} - Promise resolving to tentacle details
   */
  async loadTentacle(tentacleId) {
    this.logger.info(`Loading tentacle details: ${tentacleId}`);
    
    try {
      this.state.isLoading = true;
      this.state.tentacleId = tentacleId;
      
      // In a real implementation, this would call the MarketplaceCore API
      // For this mock implementation, we'll use placeholder data
      const tentacle = {
        id: tentacleId,
        name: tentacleId === "devmaster" ? "DevMaster" : 
              tentacleId === "contextual-intelligence" ? "Contextual Intelligence" : 
              `Tentacle ${tentacleId}`,
        description: tentacleId === "devmaster" ? 
          "Transform Aideon into a world-class software architect, developer, and deployment specialist." : 
          tentacleId === "contextual-intelligence" ? 
          "Enhance Aideon's ability to understand and maintain context across different domains and operations." :
          "This is a tentacle description.",
        longDescription: tentacleId === "devmaster" ? 
          "The DevMaster Tentacle transforms Aideon into a world-class software architect, developer, and deployment specialist. This tentacle is only available to admin users and those with special invite codes. It follows a modular architecture with five main components: Code Brain (AI), Visual Mind (UI), Deploy Hand (Ops), Collab Interface (Universal), and Lifecycle Manager." : 
          tentacleId === "contextual-intelligence" ? 
          "The Contextual Intelligence Tentacle enhances Aideon's ability to understand and maintain context across different domains and operations. The tentacle is designed with four main components: Context Hierarchy Manager, Temporal Context Tracker, Cross-Domain Context Preserver, and Context-Aware Decision Engine." :
          "This is a detailed description of the tentacle that would include more information about its features, benefits, and use cases.",
        category: tentacleId === "devmaster" ? "development" : 
                 tentacleId === "contextual-intelligence" ? "ai" : 
                 "utilities",
        developer: "Aideon Systems",
        developerInfo: {
          name: "Aideon Systems",
          website: "https://example.com/aideon",
          supportEmail: "support@aideon.example.com"
        },
        version: "1.0.0",
        releaseDate: "2025-05-15",
        lastUpdated: "2025-06-01",
        rating: 4.8,
        ratingCount: 156,
        price: tentacleId === "devmaster" ? 49.99 : 
               tentacleId === "contextual-intelligence" ? 39.99 : 
               19.99,
        pricingModel: "one_time",
        size: "42.5 MB",
        requirements: {
          minAideonVersion: "2.0.0",
          recommendedRam: "4 GB",
          diskSpace: "100 MB"
        },
        screenshots: [
          "https://example.com/screenshots/tentacle_1.png",
          "https://example.com/screenshots/tentacle_2.png",
          "https://example.com/screenshots/tentacle_3.png"
        ],
        features: [
          "Feature 1: Advanced AI-powered assistance for specific domain tasks",
          "Feature 2: Seamless integration with Aideon core systems",
          "Feature 3: Customizable settings and behaviors",
          "Feature 4: Comprehensive documentation and examples",
          "Feature 5: Regular updates and improvements"
        ],
        thumbnailUrl: `https://example.com/thumbnails/${tentacleId}.png`
      };
      
      // Check if tentacle is installed
      const isInstalled = await this._checkIfInstalled(tentacleId);
      
      // Check if tentacle is purchased
      const isPurchased = await this._checkIfPurchased(tentacleId);
      
      // Load reviews
      const reviews = await this._loadReviews(tentacleId);
      
      // Update state
      this.state.tentacle = tentacle;
      this.state.isInstalled = isInstalled;
      this.state.isPurchased = isPurchased;
      this.state.reviews = reviews;
      this.state.isLoading = false;
      
      this.logger.info(`Loaded tentacle details: ${tentacleId}`);
      return tentacle;
    } catch (error) {
      this.state.isLoading = false;
      this.state.error = `Failed to load tentacle details: ${error.message}`;
      this.logger.error(`Failed to load tentacle details: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Check if a tentacle is installed
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if tentacle is installed
   * @private
   */
  async _checkIfInstalled(tentacleId) {
    try {
      if (!this.installationManager) {
        return false;
      }
      
      // In a real implementation, this would call the InstallationManager
      // For this mock implementation, we'll return a placeholder value
      return tentacleId === "contextual-intelligence"; // Assume only this one is installed
    } catch (error) {
      this.logger.error(`Failed to check if tentacle is installed: ${tentacleId}`, error);
      return false;
    }
  }

  /**
   * Check if a tentacle is purchased
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if tentacle is purchased
   * @private
   */
  async _checkIfPurchased(tentacleId) {
    try {
      // In a real implementation, this would call the MonetizationSystem
      // For this mock implementation, we'll return a placeholder value
      return tentacleId === "contextual-intelligence" || tentacleId === "devmaster"; // Assume these are purchased
    } catch (error) {
      this.logger.error(`Failed to check if tentacle is purchased: ${tentacleId}`, error);
      return false;
    }
  }

  /**
   * Load reviews for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Array>} - Promise resolving to array of reviews
   * @private
   */
  async _loadReviews(tentacleId) {
    try {
      // In a real implementation, this would call the MarketplaceCore API
      // For this mock implementation, we'll use placeholder data
      return [
        {
          id: "review1",
          userId: "user1",
          username: "JohnDoe",
          rating: 5,
          title: "Excellent tentacle!",
          content: "This tentacle has greatly improved my productivity. The integration with Aideon is seamless, and the features are exactly what I needed. Highly recommended!",
          date: "2025-05-20"
        },
        {
          id: "review2",
          userId: "user2",
          username: "JaneSmith",
          rating: 4,
          title: "Very good, but could be better",
          content: "I like this tentacle, but it's missing a few features I need. The developer is responsive to feedback though, so I'm hopeful these will be added in future updates.",
          date: "2025-05-18"
        },
        {
          id: "review3",
          userId: "user3",
          username: "BobJohnson",
          rating: 5,
          title: "Game changer!",
          content: "This tentacle has completely transformed how I use Aideon. The features are intuitive and powerful, and the performance is excellent.",
          date: "2025-05-15"
        }
      ];
    } catch (error) {
      this.logger.error(`Failed to load reviews for tentacle: ${tentacleId}`, error);
      return [];
    }
  }

  /**
   * Install the tentacle
   * @returns {Promise<boolean>} - Promise resolving to true if installation was successful
   */
  async installTentacle() {
    const { tentacleId, tentacle, isInstalled } = this.state;
    
    if (!tentacleId || !tentacle) {
      this.logger.error("No tentacle loaded");
      return false;
    }
    
    if (isInstalled) {
      this.logger.info(`Tentacle already installed: ${tentacleId}`);
      return true;
    }
    
    this.logger.info(`Installing tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      // Start installation
      this.state.isInstalling = true;
      this.state.installProgress = 0;
      
      const result = await this.installationManager.installTentacle(tentacleId);
      
      if (!result.success) {
        throw new Error(result.error || "Installation failed");
      }
      
      this.state.isInstalled = true;
      this.state.isInstalling = false;
      this.state.installProgress = 100;
      
      this.logger.info(`Tentacle installed successfully: ${tentacleId}`);
      return true;
    } catch (error) {
      this.state.isInstalling = false;
      this.state.error = `Failed to install tentacle: ${error.message}`;
      this.logger.error(`Failed to install tentacle: ${tentacleId}`, error);
      return false;
    }
  }

  /**
   * Uninstall the tentacle
   * @returns {Promise<boolean>} - Promise resolving to true if uninstallation was successful
   */
  async uninstallTentacle() {
    const { tentacleId, tentacle, isInstalled } = this.state;
    
    if (!tentacleId || !tentacle) {
      this.logger.error("No tentacle loaded");
      return false;
    }
    
    if (!isInstalled) {
      this.logger.info(`Tentacle not installed: ${tentacleId}`);
      return true;
    }
    
    this.logger.info(`Uninstalling tentacle: ${tentacleId}`);
    
    try {
      if (!this.installationManager) {
        throw new Error("InstallationManager not available");
      }
      
      const result = await this.installationManager.uninstallTentacle(tentacleId);
      
      if (!result.success) {
        throw new Error(result.error || "Uninstallation failed");
      }
      
      this.state.isInstalled = false;
      
      this.logger.info(`Tentacle uninstalled successfully: ${tentacleId}`);
      return true;
    } catch (error) {
      this.state.error = `Failed to uninstall tentacle: ${error.message}`;
      this.logger.error(`Failed to uninstall tentacle: ${tentacleId}`, error);
      return false;
    }
  }

  /**
   * Purchase the tentacle
   * @returns {Promise<boolean>} - Promise resolving to true if purchase was successful
   */
  async purchaseTentacle() {
    const { tentacleId, tentacle, isPurchased } = this.state;
    
    if (!tentacleId || !tentacle) {
      this.logger.error("No tentacle loaded");
      return false;
    }
    
    if (isPurchased) {
      this.logger.info(`Tentacle already purchased: ${tentacleId}`);
      return true;
    }
    
    this.logger.info(`Purchasing tentacle: ${tentacleId}`);
    
    try {
      // In a real implementation, this would call the MonetizationSystem
      // For this mock implementation, we'll simulate a successful purchase
      
      // Emit purchase event
      this.events.emit("tentacle:purchase:initiated", {
        tentacleId,
        price: tentacle.price,
        pricingModel: tentacle.pricingModel
      });
      
      // Simulate purchase process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.state.isPurchased = true;
      
      // Emit purchase completed event
      this.events.emit("tentacle:purchase:completed", {
        tentacleId,
        price: tentacle.price,
        pricingModel: tentacle.pricingModel
      });
      
      this.logger.info(`Tentacle purchased successfully: ${tentacleId}`);
      return true;
    } catch (error) {
      this.state.error = `Failed to purchase tentacle: ${error.message}`;
      this.logger.error(`Failed to purchase tentacle: ${tentacleId}`, error);
      
      // Emit purchase failed event
      this.events.emit("tentacle:purchase:failed", {
        tentacleId,
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Add tentacle to cart
   * @returns {Promise<boolean>} - Promise resolving to true if tentacle was added to cart
   */
  async addToCart() {
    const { tentacleId, tentacle, isPurchased, isInCart } = this.state;
    
    if (!tentacleId || !tentacle) {
      this.logger.error("No tentacle loaded");
      return false;
    }
    
    if (isPurchased) {
      this.logger.info(`Tentacle already purchased: ${tentacleId}`);
      return false;
    }
    
    if (isInCart) {
      this.logger.info(`Tentacle already in cart: ${tentacleId}`);
      return true;
    }
    
    this.logger.info(`Adding tentacle to cart: ${tentacleId}`);
    
    try {
      // In a real implementation, this would call the MonetizationSystem
      // For this mock implementation, we'll simulate adding to cart
      this.state.isInCart = true;
      
      // Emit add to cart event
      this.events.emit("tentacle:cart:added", {
        tentacleId,
        price: tentacle.price,
        pricingModel: tentacle.pricingModel
      });
      
      this.logger.info(`Tentacle added to cart successfully: ${tentacleId}`);
      return true;
    } catch (error) {
      this.state.error = `Failed to add tentacle to cart: ${error.message}`;
      this.logger.error(`Failed to add tentacle to cart: ${tentacleId}`, error);
      return false;
    }
  }

  /**
   * Remove tentacle from cart
   * @returns {Promise<boolean>} - Promise resolving to true if tentacle was removed from cart
   */
  async removeFromCart() {
    const { tentacleId, isInCart } = this.state;
    
    if (!tentacleId) {
      this.logger.error("No tentacle loaded");
      return false;
    }
    
    if (!isInCart) {
      this.logger.info(`Tentacle not in cart: ${tentacleId}`);
      return true;
    }
    
    this.logger.info(`Removing tentacle from cart: ${tentacleId}`);
    
    try {
      // In a real implementation, this would call the MonetizationSystem
      // For this mock implementation, we'll simulate removing from cart
      this.state.isInCart = false;
      
      // Emit remove from cart event
      this.events.emit("tentacle:cart:removed", {
        tentacleId
      });
      
      this.logger.info(`Tentacle removed from cart successfully: ${tentacleId}`);
      return true;
    } catch (error) {
      this.state.error = `Failed to remove tentacle from cart: ${error.message}`;
      this.logger.error(`Failed to remove tentacle from cart: ${tentacleId}`, error);
      return false;
    }
  }

  /**
   * Submit a review for the tentacle
   * @param {Object} reviewData - Review data
   * @param {number} reviewData.rating - Rating (1-5)
   * @param {string} reviewData.title - Review title
   * @param {string} reviewData.content - Review content
   * @returns {Promise<boolean>} - Promise resolving to true if review was submitted successfully
   */
  async submitReview(reviewData) {
    const { tentacleId } = this.state;
    
    if (!tentacleId) {
      this.logger.error("No tentacle loaded");
      return false;
    }
    
    this.logger.info(`Submitting review for tentacle: ${tentacleId}`);
    
    try {
      // Validate review data
      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
        throw new Error("Invalid rating");
      }
      
      if (!reviewData.title || reviewData.title.trim().length === 0) {
        throw new Error("Review title is required");
      }
      
      if (!reviewData.content || reviewData.content.trim().length === 0) {
        throw new Error("Review content is required");
      }
      
      // In a real implementation, this would call the MarketplaceCore API
      // For this mock implementation, we'll simulate submitting a review
      const newReview = {
        id: `review${Date.now()}`,
        userId: "current_user",
        username: "CurrentUser",
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        date: new Date().toISOString().split('T')[0]
      };
      
      // Add review to state
      this.state.reviews = [newReview, ...this.state.reviews];
      
      // Update tentacle rating
      const totalRatings = this.state.tentacle.ratingCount + 1;
      const totalRatingSum = this.state.tentacle.rating * this.state.tentacle.ratingCount + reviewData.rating;
      const newRating = totalRatingSum / totalRatings;
      
      this.state.tentacle = {
        ...this.state.tentacle,
        rating: newRating,
        ratingCount: totalRatings
      };
      
      // Emit review submitted event
      this.events.emit("tentacle:review:submitted", {
        tentacleId,
        review: newReview
      });
      
      this.logger.info(`Review submitted successfully for tentacle: ${tentacleId}`);
      return true;
    } catch (error) {
      this.state.error = `Failed to submit review: ${error.message}`;
      this.logger.error(`Failed to submit review for tentacle: ${tentacleId}`, error);
      return false;
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
   * Handle installation started event
   * @param {Object} event - Installation started event
   * @private
   */
  _handleInstallationStarted(event) {
    if (event.tentacleId === this.state.tentacleId) {
      this.logger.info(`Installation started for tentacle: ${event.tentacleId}`);
      this.state.isInstalling = true;
      this.state.installProgress = 0;
    }
  }

  /**
   * Handle installation progress event
   * @param {Object} event - Installation progress event
   * @private
   */
  _handleInstallationProgress(event) {
    if (event.tentacleId === this.state.tentacleId) {
      this.logger.info(`Installation progress for tentacle: ${event.tentacleId} - ${event.progress}%`);
      this.state.installProgress = event.progress;
    }
  }

  /**
   * Handle installation completed event
   * @param {Object} event - Installation completed event
   * @private
   */
  _handleInstallationCompleted(event) {
    if (event.tentacleId === this.state.tentacleId) {
      this.logger.info(`Installation completed for tentacle: ${event.tentacleId}`);
      this.state.isInstalling = false;
      this.state.installProgress = 100;
      this.state.isInstalled = true;
    }
  }

  /**
   * Handle installation failed event
   * @param {Object} event - Installation failed event
   * @private
   */
  _handleInstallationFailed(event) {
    if (event.tentacleId === this.state.tentacleId) {
      this.logger.error(`Installation failed for tentacle: ${event.tentacleId} - ${event.error}`);
      this.state.isInstalling = false;
      this.state.error = `Installation failed: ${event.error}`;
    }
  }

  /**
   * Render the TentacleDetailView component
   * @returns {Object} - React-like element representing the component
   */
  render() {
    const { tentacle, reviews, currentTab, isLoading, error, isInstalled, isInstalling, installProgress, isPurchased, isInCart } = this.state;
    
    // Error state
    if (error) {
      return React.createElement("div", { className: "error-message" }, `Error: ${error}`);
    }
    
    // Loading state
    if (isLoading || !tentacle) {
      return React.createElement("div", { className: "loading-indicator" }, "Loading tentacle details...");
    }
    
    // Main content
    return React.createElement(
      "div",
      { className: "tentacle-detail-view" },
      // Header section
      React.createElement(
        "div",
        { className: "tentacle-header" },
        React.createElement("img", { 
          className: "tentacle-thumbnail",
          src: tentacle.thumbnailUrl,
          alt: `${tentacle.name} thumbnail`
        }),
        React.createElement(
          "div",
          { className: "tentacle-header-info" },
          React.createElement("h1", { className: "tentacle-name" }, tentacle.name),
          React.createElement("p", { className: "tentacle-developer" }, tentacle.developer),
          React.createElement(
            "div",
            { className: "tentacle-rating" },
            React.createElement("span", { className: "stars" }, "★".repeat(Math.round(tentacle.rating))),
            React.createElement("span", { className: "rating-value" }, tentacle.rating.toFixed(1)),
            React.createElement("span", { className: "rating-count" }, `(${tentacle.ratingCount})`)
          ),
          React.createElement(
            "div",
            { className: "tentacle-price" },
            tentacle.price === 0 ?
              React.createElement("span", { className: "free" }, "Free") :
              React.createElement("span", null, `$${tentacle.price.toFixed(2)}`)
          ),
          React.createElement(
            "div",
            { className: "tentacle-actions" },
            isPurchased || tentacle.price === 0 ?
              (isInstalled ?
                React.createElement("button", { 
                  className: "uninstall-button",
                  onClick: () => this.uninstallTentacle()
                }, "Uninstall") :
                (isInstalling ?
                  React.createElement(
                    "div",
                    { className: "install-progress" },
                    React.createElement("progress", { value: installProgress, max: 100 }),
                    React.createElement("span", null, `${installProgress}%`)
                  ) :
                  React.createElement("button", { 
                    className: "install-button",
                    onClick: () => this.installTentacle()
                  }, "Install")
                )
              ) :
              (isInCart ?
                React.createElement("button", { 
                  className: "remove-from-cart-button",
                  onClick: () => this.removeFromCart()
                }, "Remove from Cart") :
                React.createElement("div", null,
                  React.createElement("button", { 
                    className: "purchase-button",
                    onClick: () => this.purchaseTentacle()
                  }, "Purchase Now"),
                  React.createElement("button", { 
                    className: "add-to-cart-button",
                    onClick: () => this.addToCart()
                  }, "Add to Cart")
                )
              )
          )
        )
      ),
      
      // Tabs navigation
      React.createElement(
        "div",
        { className: "tentacle-tabs" },
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "overview" ? "active" : ""}`,
            onClick: () => this.changeTab("overview")
          }, 
          "Overview"
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "features" ? "active" : ""}`,
            onClick: () => this.changeTab("features")
          }, 
          "Features"
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "requirements" ? "active" : ""}`,
            onClick: () => this.changeTab("requirements")
          }, 
          "Requirements"
        ),
        React.createElement(
          "button", 
          { 
            className: `tab-button ${currentTab === "reviews" ? "active" : ""}`,
            onClick: () => this.changeTab("reviews")
          }, 
          `Reviews (${reviews.length})`
        )
      ),
      
      // Tab content
      React.createElement(
        "div",
        { className: "tentacle-tab-content" },
        // Overview tab
        currentTab === "overview" ?
          React.createElement(
            "div",
            { className: "tab-overview" },
            React.createElement("p", { className: "tentacle-description" }, tentacle.longDescription),
            React.createElement(
              "div",
              { className: "tentacle-screenshots" },
              tentacle.screenshots.map((screenshot, index) => 
                React.createElement("img", { 
                  key: index,
                  src: screenshot,
                  alt: `${tentacle.name} screenshot ${index + 1}`,
                  className: "screenshot"
                })
              )
            ),
            React.createElement(
              "div",
              { className: "tentacle-metadata" },
              React.createElement("p", null, `Version: ${tentacle.version}`),
              React.createElement("p", null, `Released: ${tentacle.releaseDate}`),
              React.createElement("p", null, `Last Updated: ${tentacle.lastUpdated}`),
              React.createElement("p", null, `Size: ${tentacle.size}`)
            )
          ) : null,
        
        // Features tab
        currentTab === "features" ?
          React.createElement(
            "div",
            { className: "tab-features" },
            React.createElement("h2", null, "Features"),
            React.createElement(
              "ul",
              { className: "feature-list" },
              tentacle.features.map((feature, index) => 
                React.createElement("li", { key: index }, feature)
              )
            )
          ) : null,
        
        // Requirements tab
        currentTab === "requirements" ?
          React.createElement(
            "div",
            { className: "tab-requirements" },
            React.createElement("h2", null, "System Requirements"),
            React.createElement(
              "div",
              { className: "requirements-list" },
              React.createElement("p", null, `Minimum Aideon Version: ${tentacle.requirements.minAideonVersion}`),
              React.createElement("p", null, `Recommended RAM: ${tentacle.requirements.recommendedRam}`),
              React.createElement("p", null, `Disk Space: ${tentacle.requirements.diskSpace}`)
            )
          ) : null,
        
        // Reviews tab
        currentTab === "reviews" ?
          React.createElement(
            "div",
            { className: "tab-reviews" },
            React.createElement("h2", null, "User Reviews"),
            React.createElement(
              "div",
              { className: "review-form" },
              React.createElement("h3", null, "Write a Review"),
              React.createElement(
                "form",
                { 
                  onSubmit: (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    this.submitReview({
                      rating: parseInt(formData.get("rating")),
                      title: formData.get("title"),
                      content: formData.get("content")
                    });
                    e.target.reset();
                  }
                },
                React.createElement(
                  "div",
                  { className: "rating-input" },
                  React.createElement("label", null, "Rating:"),
                  React.createElement(
                    "select",
                    { name: "rating", required: true },
                    React.createElement("option", { value: "5" }, "5 Stars"),
                    React.createElement("option", { value: "4" }, "4 Stars"),
                    React.createElement("option", { value: "3" }, "3 Stars"),
                    React.createElement("option", { value: "2" }, "2 Stars"),
                    React.createElement("option", { value: "1" }, "1 Star")
                  )
                ),
                React.createElement(
                  "div",
                  { className: "title-input" },
                  React.createElement("label", null, "Title:"),
                  React.createElement("input", { 
                    type: "text", 
                    name: "title", 
                    placeholder: "Review title",
                    required: true
                  })
                ),
                React.createElement(
                  "div",
                  { className: "content-input" },
                  React.createElement("label", null, "Review:"),
                  React.createElement("textarea", { 
                    name: "content", 
                    placeholder: "Write your review here...",
                    required: true,
                    rows: 4
                  })
                ),
                React.createElement("button", { type: "submit" }, "Submit Review")
              )
            ),
            React.createElement(
              "div",
              { className: "review-list" },
              reviews.length > 0 ?
                reviews.map(review => 
                  React.createElement(
                    "div",
                    { className: "review", key: review.id },
                    React.createElement(
                      "div",
                      { className: "review-header" },
                      React.createElement("span", { className: "review-stars" }, "★".repeat(review.rating)),
                      React.createElement("h3", { className: "review-title" }, review.title),
                      React.createElement("span", { className: "review-author" }, `by ${review.username}`),
                      React.createElement("span", { className: "review-date" }, review.date)
                    ),
                    React.createElement("p", { className: "review-content" }, review.content)
                  )
                ) :
                React.createElement("p", { className: "no-reviews" }, "No reviews yet. Be the first to review this tentacle!")
            )
          ) : null
      ),
      
      // Developer information
      React.createElement(
        "div",
        { className: "developer-info" },
        React.createElement("h2", null, "Developer Information"),
        React.createElement("p", null, `Developer: ${tentacle.developerInfo.name}`),
        React.createElement("p", null, `Website: ${tentacle.developerInfo.website}`),
        React.createElement("p", null, `Support: ${tentacle.developerInfo.supportEmail}`)
      )
    );
  }

  /**
   * Get the status of the TentacleDetailView
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentTentacle: this.state.tentacleId,
      isInstalled: this.state.isInstalled,
      isPurchased: this.state.isPurchased,
      reviewCount: this.state.reviews.length
    };
  }

  /**
   * Shutdown the TentacleDetailView
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn("TentacleDetailView not initialized");
      return true;
    }
    
    this.logger.info("Shutting down TentacleDetailView");
    
    // Remove event listeners
    if (this.installationManager) {
      this.installationManager.events.off("installation:started", this._handleInstallationStarted);
      this.installationManager.events.off("installation:progress", this._handleInstallationProgress);
      this.installationManager.events.off("installation:completed", this._handleInstallationCompleted);
      this.installationManager.events.off("installation:failed", this._handleInstallationFailed);
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { TentacleDetailView };
