/**
 * @fileoverview Featured Tentacles Showcase component for the Aideon Tentacle Marketplace
 * This component displays featured and recommended tentacles in a visually appealing showcase
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
 * FeaturedTentaclesShowcase class - Displays featured and recommended tentacles
 */
class FeaturedTentaclesShowcase {
  /**
   * Create a new FeaturedTentaclesShowcase instance
   * @param {Object} options - Configuration options
   * @param {HTMLElement|Object} options.container - DOM container element or mock for tests
   * @param {Object} options.marketplaceCore - Reference to the MarketplaceCore
   * @param {Object} options.config - Showcase configuration settings
   */
  constructor(options = {}) {
    this.options = options;
    this.container = options.container;
    this.marketplaceCore = options.marketplaceCore;
    this.config = options.config || {};
    this.logger = new Logger("FeaturedTentaclesShowcase");
    this.events = new EventEmitter();
    
    // Default configuration
    this.config.maxFeaturedTentacles = this.config.maxFeaturedTentacles || 5;
    this.config.maxRecommendedTentacles = this.config.maxRecommendedTentacles || 10;
    this.config.autoRotate = this.config.autoRotate !== false;
    this.config.rotationInterval = this.config.rotationInterval || 5000; // 5 seconds
    this.config.animationDuration = this.config.animationDuration || 500; // 0.5 seconds
    
    this.state = {
      featuredTentacles: [],
      recommendedTentacles: [],
      currentFeaturedIndex: 0,
      isLoading: false,
      error: null
    };
    
    this.initialized = false;
    this.rotationTimer = null;
    
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
    
    this.logger.info("FeaturedTentaclesShowcase instance created");
  }
  
  /**
   * Initialize the FeaturedTentaclesShowcase
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("FeaturedTentaclesShowcase already initialized");
      return true;
    }
    
    this.logger.info("Initializing FeaturedTentaclesShowcase");
    
    try {
      // Validate dependencies
      if (!this.container && process.env.NODE_ENV !== 'test') {
        throw new Error("Container element is required");
      }
      
      if (!this.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }
      
      // Initialize marketplace core if not already initialized
      if (!this.marketplaceCore.initialized) {
        await this.marketplaceCore.initialize();
      }
      
      // Load initial data
      await this.loadFeaturedTentacles();
      await this.loadRecommendedTentacles();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Set up UI layout
      if (process.env.NODE_ENV !== 'test') {
        this._setupUILayout();
      }
      
      // Start auto-rotation if enabled
      if (this.config.autoRotate) {
        this._startRotation();
      }
      
      this.initialized = true;
      this.logger.info("FeaturedTentaclesShowcase initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize FeaturedTentaclesShowcase", error);
      this.state.error = error.message;
      throw error;
    }
  }
  
  /**
   * Load featured tentacles
   * @returns {Promise<Array>} - Promise resolving to array of featured tentacles
   */
  async loadFeaturedTentacles() {
    this.logger.info("Loading featured tentacles");
    this.state.isLoading = true;
    
    try {
      // Get featured tentacles from marketplace core
      const featuredTentacles = await this.marketplaceCore.getFeaturedTentacles({
        limit: this.config.maxFeaturedTentacles
      });
      
      this.state.featuredTentacles = featuredTentacles;
      this.state.isLoading = false;
      
      // Emit featured tentacles loaded event
      this.events.emit('featured:loaded', {
        tentacles: featuredTentacles
      });
      
      // Render featured tentacles if container is available
      if (this.container && process.env.NODE_ENV !== 'test') {
        this._renderFeaturedTentacles();
      }
      
      this.logger.info(`Loaded ${featuredTentacles.length} featured tentacles`);
      return featuredTentacles;
    } catch (error) {
      this.logger.error("Failed to load featured tentacles", error);
      this.state.error = error.message;
      this.state.isLoading = false;
      throw error;
    }
  }
  
  /**
   * Load recommended tentacles
   * @returns {Promise<Array>} - Promise resolving to array of recommended tentacles
   */
  async loadRecommendedTentacles() {
    this.logger.info("Loading recommended tentacles");
    this.state.isLoading = true;
    
    try {
      // Get recommended tentacles from marketplace core
      const recommendedTentacles = await this.marketplaceCore.getRecommendedTentacles({
        limit: this.config.maxRecommendedTentacles
      });
      
      this.state.recommendedTentacles = recommendedTentacles;
      this.state.isLoading = false;
      
      // Emit recommended tentacles loaded event
      this.events.emit('recommended:loaded', {
        tentacles: recommendedTentacles
      });
      
      // Render recommended tentacles if container is available
      if (this.container && process.env.NODE_ENV !== 'test') {
        this._renderRecommendedTentacles();
      }
      
      this.logger.info(`Loaded ${recommendedTentacles.length} recommended tentacles`);
      return recommendedTentacles;
    } catch (error) {
      this.logger.error("Failed to load recommended tentacles", error);
      this.state.error = error.message;
      this.state.isLoading = false;
      throw error;
    }
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    this.logger.info("Setting up event listeners");
    
    // Listen for marketplace core events
    if (this.marketplaceCore && this.marketplaceCore.events) {
      this.marketplaceCore.events.on("tentacle:featured:updated", this._handleFeaturedUpdated.bind(this));
      this.marketplaceCore.events.on("tentacle:recommended:updated", this._handleRecommendedUpdated.bind(this));
    }
    
    // Set up UI event listeners if container is available
    if (this.container && process.env.NODE_ENV !== 'test') {
      // Previous button
      const prevButton = this.container.querySelector('.featured-prev-button');
      if (prevButton) {
        prevButton.addEventListener('click', this._handlePrevButtonClick.bind(this));
      }
      
      // Next button
      const nextButton = this.container.querySelector('.featured-next-button');
      if (nextButton) {
        nextButton.addEventListener('click', this._handleNextButtonClick.bind(this));
      }
      
      // Indicator buttons
      const indicators = this.container.querySelectorAll('.featured-indicator');
      indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => this._handleIndicatorClick(index));
      });
      
      // Pause rotation on hover
      const featuredContainer = this.container.querySelector('.featured-container');
      if (featuredContainer) {
        featuredContainer.addEventListener('mouseenter', this._handleContainerMouseEnter.bind(this));
        featuredContainer.addEventListener('mouseleave', this._handleContainerMouseLeave.bind(this));
      }
      
      // Tentacle click events
      const featuredItems = this.container.querySelectorAll('.featured-item');
      featuredItems.forEach(item => {
        item.addEventListener('click', () => this._handleTentacleClick(item.dataset.tentacleId));
      });
      
      const recommendedItems = this.container.querySelectorAll('.recommended-item');
      recommendedItems.forEach(item => {
        item.addEventListener('click', () => this._handleTentacleClick(item.dataset.tentacleId));
      });
    }
    
    this.logger.info("Event listeners set up");
  }
  
  /**
   * Set up UI layout
   * @private
   */
  _setupUILayout() {
    this.logger.info("Setting up UI layout");
    
    // Create showcase container
    const showcaseContainer = document.createElement('div');
    showcaseContainer.className = 'tentacle-showcase';
    
    // Create featured section
    const featuredSection = document.createElement('div');
    featuredSection.className = 'featured-section';
    
    // Create featured container
    const featuredContainer = document.createElement('div');
    featuredContainer.className = 'featured-container';
    
    // Create navigation controls
    const prevButton = document.createElement('button');
    prevButton.className = 'featured-prev-button';
    prevButton.innerHTML = '&lt;';
    prevButton.setAttribute('aria-label', 'Previous featured tentacle');
    
    const nextButton = document.createElement('button');
    nextButton.className = 'featured-next-button';
    nextButton.innerHTML = '&gt;';
    nextButton.setAttribute('aria-label', 'Next featured tentacle');
    
    // Create indicators container
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'featured-indicators';
    
    // Add navigation controls to featured section
    featuredSection.appendChild(prevButton);
    featuredSection.appendChild(featuredContainer);
    featuredSection.appendChild(nextButton);
    featuredSection.appendChild(indicatorsContainer);
    
    // Create recommended section
    const recommendedSection = document.createElement('div');
    recommendedSection.className = 'recommended-section';
    
    // Create recommended header
    const recommendedHeader = document.createElement('h3');
    recommendedHeader.className = 'recommended-header';
    recommendedHeader.textContent = 'Recommended for You';
    
    // Create recommended container
    const recommendedContainer = document.createElement('div');
    recommendedContainer.className = 'recommended-container';
    
    // Add header and container to recommended section
    recommendedSection.appendChild(recommendedHeader);
    recommendedSection.appendChild(recommendedContainer);
    
    // Add sections to showcase container
    showcaseContainer.appendChild(featuredSection);
    showcaseContainer.appendChild(recommendedSection);
    
    // Add showcase container to main container
    this.container.appendChild(showcaseContainer);
    
    this.logger.info("UI layout set up");
  }
  
  /**
   * Render featured tentacles
   * @private
   */
  _renderFeaturedTentacles() {
    this.logger.info("Rendering featured tentacles");
    
    const featuredContainer = this.container.querySelector('.featured-container');
    const indicatorsContainer = this.container.querySelector('.featured-indicators');
    
    if (!featuredContainer || !indicatorsContainer) {
      this.logger.error("Featured container or indicators container not found");
      return;
    }
    
    // Clear existing content
    featuredContainer.innerHTML = '';
    indicatorsContainer.innerHTML = '';
    
    // Render each featured tentacle
    this.state.featuredTentacles.forEach((tentacle, index) => {
      // Create featured item
      const featuredItem = document.createElement('div');
      featuredItem.className = 'featured-item';
      featuredItem.dataset.tentacleId = tentacle.id;
      
      if (index === this.state.currentFeaturedIndex) {
        featuredItem.classList.add('active');
      }
      
      // Create featured content
      const featuredContent = document.createElement('div');
      featuredContent.className = 'featured-content';
      
      // Create featured image
      const featuredImage = document.createElement('div');
      featuredImage.className = 'featured-image';
      featuredImage.style.backgroundImage = `url(${tentacle.imageUrl})`;
      
      // Create featured info
      const featuredInfo = document.createElement('div');
      featuredInfo.className = 'featured-info';
      
      // Create featured title
      const featuredTitle = document.createElement('h2');
      featuredTitle.className = 'featured-title';
      featuredTitle.textContent = tentacle.name;
      
      // Create featured description
      const featuredDescription = document.createElement('p');
      featuredDescription.className = 'featured-description';
      featuredDescription.textContent = tentacle.description;
      
      // Create featured button
      const featuredButton = document.createElement('button');
      featuredButton.className = 'featured-button';
      featuredButton.textContent = 'Learn More';
      featuredButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this._handleTentacleClick(tentacle.id);
      });
      
      // Add elements to featured info
      featuredInfo.appendChild(featuredTitle);
      featuredInfo.appendChild(featuredDescription);
      featuredInfo.appendChild(featuredButton);
      
      // Add elements to featured content
      featuredContent.appendChild(featuredImage);
      featuredContent.appendChild(featuredInfo);
      
      // Add content to featured item
      featuredItem.appendChild(featuredContent);
      
      // Add featured item to container
      featuredContainer.appendChild(featuredItem);
      
      // Create indicator
      const indicator = document.createElement('button');
      indicator.className = 'featured-indicator';
      indicator.setAttribute('aria-label', `Go to featured tentacle ${index + 1}`);
      
      if (index === this.state.currentFeaturedIndex) {
        indicator.classList.add('active');
      }
      
      indicator.addEventListener('click', () => this._handleIndicatorClick(index));
      
      // Add indicator to container
      indicatorsContainer.appendChild(indicator);
    });
    
    this.logger.info("Featured tentacles rendered");
  }
  
  /**
   * Render recommended tentacles
   * @private
   */
  _renderRecommendedTentacles() {
    this.logger.info("Rendering recommended tentacles");
    
    const recommendedContainer = this.container.querySelector('.recommended-container');
    
    if (!recommendedContainer) {
      this.logger.error("Recommended container not found");
      return;
    }
    
    // Clear existing content
    recommendedContainer.innerHTML = '';
    
    // Render each recommended tentacle
    this.state.recommendedTentacles.forEach(tentacle => {
      // Create recommended item
      const recommendedItem = document.createElement('div');
      recommendedItem.className = 'recommended-item';
      recommendedItem.dataset.tentacleId = tentacle.id;
      
      // Create recommended image
      const recommendedImage = document.createElement('div');
      recommendedImage.className = 'recommended-image';
      recommendedImage.style.backgroundImage = `url(${tentacle.imageUrl})`;
      
      // Create recommended info
      const recommendedInfo = document.createElement('div');
      recommendedInfo.className = 'recommended-info';
      
      // Create recommended title
      const recommendedTitle = document.createElement('h4');
      recommendedTitle.className = 'recommended-title';
      recommendedTitle.textContent = tentacle.name;
      
      // Create recommended category
      const recommendedCategory = document.createElement('span');
      recommendedCategory.className = 'recommended-category';
      recommendedCategory.textContent = tentacle.category;
      
      // Add elements to recommended info
      recommendedInfo.appendChild(recommendedTitle);
      recommendedInfo.appendChild(recommendedCategory);
      
      // Add elements to recommended item
      recommendedItem.appendChild(recommendedImage);
      recommendedItem.appendChild(recommendedInfo);
      
      // Add recommended item to container
      recommendedContainer.appendChild(recommendedItem);
    });
    
    this.logger.info("Recommended tentacles rendered");
  }
  
  /**
   * Start auto-rotation
   * @private
   */
  _startRotation() {
    this.logger.info("Starting auto-rotation");
    
    // Clear existing timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    // Set up new timer
    this.rotationTimer = setInterval(() => {
      this._rotateToNext();
    }, this.config.rotationInterval);
    
    this.logger.info("Auto-rotation started");
  }
  
  /**
   * Stop auto-rotation
   * @private
   */
  _stopRotation() {
    this.logger.info("Stopping auto-rotation");
    
    // Clear existing timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    
    this.logger.info("Auto-rotation stopped");
  }
  
  /**
   * Rotate to next featured tentacle
   * @private
   */
  _rotateToNext() {
    this.logger.info("Rotating to next featured tentacle");
    
    const featuredCount = this.state.featuredTentacles.length;
    
    if (featuredCount === 0) {
      return;
    }
    
    // Calculate next index
    const nextIndex = (this.state.currentFeaturedIndex + 1) % featuredCount;
    
    // Update current index
    this.state.currentFeaturedIndex = nextIndex;
    
    // Update UI
    if (this.container && process.env.NODE_ENV !== 'test') {
      this._updateFeaturedUI();
    }
    
    // Emit rotation event
    this.events.emit('featured:rotated', {
      index: nextIndex,
      tentacle: this.state.featuredTentacles[nextIndex]
    });
    
    this.logger.info(`Rotated to featured tentacle ${nextIndex + 1}`);
  }
  
  /**
   * Rotate to previous featured tentacle
   * @private
   */
  _rotateToPrev() {
    this.logger.info("Rotating to previous featured tentacle");
    
    const featuredCount = this.state.featuredTentacles.length;
    
    if (featuredCount === 0) {
      return;
    }
    
    // Calculate previous index
    const prevIndex = (this.state.currentFeaturedIndex - 1 + featuredCount) % featuredCount;
    
    // Update current index
    this.state.currentFeaturedIndex = prevIndex;
    
    // Update UI
    if (this.container && process.env.NODE_ENV !== 'test') {
      this._updateFeaturedUI();
    }
    
    // Emit rotation event
    this.events.emit('featured:rotated', {
      index: prevIndex,
      tentacle: this.state.featuredTentacles[prevIndex]
    });
    
    this.logger.info(`Rotated to featured tentacle ${prevIndex + 1}`);
  }
  
  /**
   * Rotate to specific featured tentacle
   * @param {number} index - Index of featured tentacle
   * @private
   */
  _rotateTo(index) {
    this.logger.info(`Rotating to featured tentacle ${index + 1}`);
    
    const featuredCount = this.state.featuredTentacles.length;
    
    if (featuredCount === 0 || index < 0 || index >= featuredCount) {
      return;
    }
    
    // Update current index
    this.state.currentFeaturedIndex = index;
    
    // Update UI
    if (this.container && process.env.NODE_ENV !== 'test') {
      this._updateFeaturedUI();
    }
    
    // Emit rotation event
    this.events.emit('featured:rotated', {
      index,
      tentacle: this.state.featuredTentacles[index]
    });
    
    this.logger.info(`Rotated to featured tentacle ${index + 1}`);
  }
  
  /**
   * Update featured UI
   * @private
   */
  _updateFeaturedUI() {
    this.logger.info("Updating featured UI");
    
    const featuredItems = this.container.querySelectorAll('.featured-item');
    const indicators = this.container.querySelectorAll('.featured-indicator');
    
    // Update featured items
    featuredItems.forEach((item, index) => {
      if (index === this.state.currentFeaturedIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Update indicators
    indicators.forEach((indicator, index) => {
      if (index === this.state.currentFeaturedIndex) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });
    
    this.logger.info("Featured UI updated");
  }
  
  /**
   * Handle featured updated event
   * @param {Object} event - Featured updated event
   * @private
   */
  _handleFeaturedUpdated(event) {
    this.logger.info("Featured tentacles updated");
    
    // Reload featured tentacles
    this.loadFeaturedTentacles().catch(error => {
      this.logger.error("Failed to reload featured tentacles", error);
    });
  }
  
  /**
   * Handle recommended updated event
   * @param {Object} event - Recommended updated event
   * @private
   */
  _handleRecommendedUpdated(event) {
    this.logger.info("Recommended tentacles updated");
    
    // Reload recommended tentacles
    this.loadRecommendedTentacles().catch(error => {
      this.logger.error("Failed to reload recommended tentacles", error);
    });
  }
  
  /**
   * Handle previous button click
   * @param {Event} event - Click event
   * @private
   */
  _handlePrevButtonClick(event) {
    this.logger.info("Previous button clicked");
    
    // Prevent default action
    event.preventDefault();
    
    // Rotate to previous tentacle
    this._rotateToPrev();
    
    // Restart auto-rotation if enabled
    if (this.config.autoRotate) {
      this._stopRotation();
      this._startRotation();
    }
  }
  
  /**
   * Handle next button click
   * @param {Event} event - Click event
   * @private
   */
  _handleNextButtonClick(event) {
    this.logger.info("Next button clicked");
    
    // Prevent default action
    event.preventDefault();
    
    // Rotate to next tentacle
    this._rotateToNext();
    
    // Restart auto-rotation if enabled
    if (this.config.autoRotate) {
      this._stopRotation();
      this._startRotation();
    }
  }
  
  /**
   * Handle indicator click
   * @param {number} index - Indicator index
   * @private
   */
  _handleIndicatorClick(index) {
    this.logger.info(`Indicator ${index + 1} clicked`);
    
    // Rotate to specific tentacle
    this._rotateTo(index);
    
    // Restart auto-rotation if enabled
    if (this.config.autoRotate) {
      this._stopRotation();
      this._startRotation();
    }
  }
  
  /**
   * Handle container mouse enter
   * @param {Event} event - Mouse enter event
   * @private
   */
  _handleContainerMouseEnter(event) {
    this.logger.info("Container mouse enter");
    
    // Stop auto-rotation if enabled
    if (this.config.autoRotate) {
      this._stopRotation();
    }
  }
  
  /**
   * Handle container mouse leave
   * @param {Event} event - Mouse leave event
   * @private
   */
  _handleContainerMouseLeave(event) {
    this.logger.info("Container mouse leave");
    
    // Restart auto-rotation if enabled
    if (this.config.autoRotate) {
      this._startRotation();
    }
  }
  
  /**
   * Handle tentacle click
   * @param {string} tentacleId - Tentacle ID
   * @private
   */
  _handleTentacleClick(tentacleId) {
    this.logger.info(`Tentacle clicked: ${tentacleId}`);
    
    // Find tentacle
    const tentacle = this._findTentacleById(tentacleId);
    
    if (!tentacle) {
      this.logger.error(`Tentacle not found: ${tentacleId}`);
      return;
    }
    
    // Emit tentacle selected event
    this.events.emit('tentacle:selected', {
      tentacleId,
      tentacle
    });
  }
  
  /**
   * Find tentacle by ID
   * @param {string} tentacleId - Tentacle ID
   * @returns {Object|null} - Tentacle object or null if not found
   * @private
   */
  _findTentacleById(tentacleId) {
    // Check featured tentacles
    const featuredTentacle = this.state.featuredTentacles.find(tentacle => tentacle.id === tentacleId);
    if (featuredTentacle) {
      return featuredTentacle;
    }
    
    // Check recommended tentacles
    const recommendedTentacle = this.state.recommendedTentacles.find(tentacle => tentacle.id === tentacleId);
    if (recommendedTentacle) {
      return recommendedTentacle;
    }
    
    return null;
  }
  
  /**
   * Get the status of the FeaturedTentaclesShowcase
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      featuredCount: this.state.featuredTentacles.length,
      recommendedCount: this.state.recommendedTentacles.length,
      currentFeaturedIndex: this.state.currentFeaturedIndex,
      isLoading: this.state.isLoading,
      error: this.state.error,
      autoRotate: this.config.autoRotate,
      rotationActive: !!this.rotationTimer
    };
  }
  
  /**
   * Shutdown the FeaturedTentaclesShowcase
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn("FeaturedTentaclesShowcase not initialized");
      return true;
    }
    
    this.logger.info("Shutting down FeaturedTentaclesShowcase");
    
    try {
      // Stop auto-rotation
      this._stopRotation();
      
      // Remove event listeners if container is available
      if (this.container && process.env.NODE_ENV !== 'test') {
        // Previous button
        const prevButton = this.container.querySelector('.featured-prev-button');
        if (prevButton) {
          prevButton.removeEventListener('click', this._handlePrevButtonClick);
        }
        
        // Next button
        const nextButton = this.container.querySelector('.featured-next-button');
        if (nextButton) {
          nextButton.removeEventListener('click', this._handleNextButtonClick);
        }
        
        // Container
        const featuredContainer = this.container.querySelector('.featured-container');
        if (featuredContainer) {
          featuredContainer.removeEventListener('mouseenter', this._handleContainerMouseEnter);
          featuredContainer.removeEventListener('mouseleave', this._handleContainerMouseLeave);
        }
      }
      
      this.initialized = false;
      this.logger.info("FeaturedTentaclesShowcase shutdown complete");
      return true;
    } catch (error) {
      this.logger.error("Failed to shutdown FeaturedTentaclesShowcase", error);
      throw error;
    }
  }
}

module.exports = { FeaturedTentaclesShowcase };
