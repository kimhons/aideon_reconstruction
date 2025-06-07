/**
 * @fileoverview MarketplaceBrowser component with dependency injection support
 * This component handles browsing and discovering tentacles in the marketplace
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
 * MarketplaceBrowser class - Handles browsing and discovering tentacles
 */
class MarketplaceBrowser {
  /**
   * Create a new MarketplaceBrowser instance
   * @param {Object} options - Configuration options
   * @param {Object} options.marketplaceCore - Reference to the MarketplaceCore
   * @param {Object} options.config - Browser configuration settings
   */
  constructor(options = {}) {
    this.options = options;
    this.marketplaceCore = options.marketplaceCore;
    this.config = options.config || {};
    this.logger = new Logger("MarketplaceBrowser");
    this.events = new EventEmitter();
    this.state = {
      tentacles: [],
      categories: [],
      featured: [],
      searchQuery: '',
      filters: {
        category: null,
        price: null,
        rating: null,
        sortBy: 'popularity'
      },
      pagination: {
        page: 1,
        pageSize: this.config.defaultPageSize || 12,
        totalItems: 0,
        totalPages: 0
      },
      isLoading: false,
      error: null
    };
    this.initialized = false;

    this.logger.info("MarketplaceBrowser instance created");
  }

  /**
   * Initialize the MarketplaceBrowser
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("MarketplaceBrowser already initialized");
      return true;
    }

    this.logger.info("Initializing MarketplaceBrowser");

    try {
      // Validate dependencies
      if (!this.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }

      // Initialize marketplace core if not already initialized
      if (!this.marketplaceCore.initialized) {
        await this.marketplaceCore.initialize();
      }

      // Load initial data
      await this._loadInitialData();

      this.initialized = true;
      this.logger.info("MarketplaceBrowser initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize MarketplaceBrowser", error);
      this.state.error = error.message;
      throw error;
    }
  }

  /**
   * Load initial data
   * @private
   */
  async _loadInitialData() {
    this.logger.info("Loading initial data");

    try {
      this.state.isLoading = true;

      // Load categories
      this.state.categories = await this._loadCategories();

      // Load featured tentacles
      this.state.featured = await this._loadFeatured();

      // Load tentacles with default filters
      await this.loadTentacles();

      this.logger.info("Initial data loaded successfully");
    } catch (error) {
      this.logger.error("Failed to load initial data", error);
      this.state.error = error.message;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Load categories
   * @returns {Promise<Array>} - Promise resolving to array of categories
   * @private
   */
  async _loadCategories() {
    this.logger.info("Loading categories");

    try {
      // In a real implementation, this would call the marketplace core API
      // For this mock implementation, we'll return some sample categories
      return [
        { id: 'development', name: 'Development', count: 42 },
        { id: 'productivity', name: 'Productivity', count: 38 },
        { id: 'ai', name: 'Artificial Intelligence', count: 27 },
        { id: 'data', name: 'Data Processing', count: 19 },
        { id: 'security', name: 'Security', count: 15 }
      ];
    } catch (error) {
      this.logger.error("Failed to load categories", error);
      throw error;
    }
  }

  /**
   * Load featured tentacles
   * @returns {Promise<Array>} - Promise resolving to array of featured tentacles
   * @private
   */
  async _loadFeatured() {
    this.logger.info("Loading featured tentacles");

    try {
      // In a real implementation, this would call the marketplace core API
      // For this mock implementation, we'll return some sample featured tentacles
      return [
        {
          id: 'devmaster',
          name: 'DevMaster',
          description: 'Complete development environment with AI assistance',
          category: 'development',
          rating: 4.8,
          downloads: 12500,
          price: 49.99
        },
        {
          id: 'contextual-intelligence',
          name: 'Contextual Intelligence',
          description: 'Advanced context awareness for all your tasks',
          category: 'ai',
          rating: 4.9,
          downloads: 9800,
          price: 39.99
        },
        {
          id: 'data-wizard',
          name: 'Data Wizard',
          description: 'Powerful data processing and visualization',
          category: 'data',
          rating: 4.7,
          downloads: 8200,
          price: 29.99
        }
      ];
    } catch (error) {
      this.logger.error("Failed to load featured tentacles", error);
      throw error;
    }
  }

  /**
   * Load tentacles based on current search query and filters
   * @returns {Promise<Array>} - Promise resolving to array of tentacles
   */
  async loadTentacles() {
    this.logger.info("Loading tentacles", {
      searchQuery: this.state.searchQuery,
      filters: this.state.filters,
      pagination: this.state.pagination
    });

    try {
      this.state.isLoading = true;

      // In a real implementation, this would call the marketplace core API
      // For this mock implementation, we'll return some sample tentacles
      const tentacles = [
        {
          id: 'devmaster',
          name: 'DevMaster',
          description: 'Complete development environment with AI assistance',
          category: 'development',
          rating: 4.8,
          downloads: 12500,
          price: 49.99
        },
        {
          id: 'contextual-intelligence',
          name: 'Contextual Intelligence',
          description: 'Advanced context awareness for all your tasks',
          category: 'ai',
          rating: 4.9,
          downloads: 9800,
          price: 39.99
        },
        {
          id: 'data-wizard',
          name: 'Data Wizard',
          description: 'Powerful data processing and visualization',
          category: 'data',
          rating: 4.7,
          downloads: 8200,
          price: 29.99
        },
        {
          id: 'security-guardian',
          name: 'Security Guardian',
          description: 'Comprehensive security monitoring and protection',
          category: 'security',
          rating: 4.6,
          downloads: 7500,
          price: 34.99
        },
        {
          id: 'productivity-boost',
          name: 'Productivity Boost',
          description: 'Streamline your workflow and boost productivity',
          category: 'productivity',
          rating: 4.5,
          downloads: 15000,
          price: 0
        }
      ];

      // Apply search filter
      let filteredTentacles = tentacles;
      if (this.state.searchQuery) {
        const query = this.state.searchQuery.toLowerCase();
        filteredTentacles = tentacles.filter(tentacle => 
          tentacle.name.toLowerCase().includes(query) || 
          tentacle.description.toLowerCase().includes(query)
        );
      }

      // Apply category filter
      if (this.state.filters.category) {
        filteredTentacles = filteredTentacles.filter(tentacle => 
          tentacle.category === this.state.filters.category
        );
      }

      // Apply price filter
      if (this.state.filters.price) {
        switch (this.state.filters.price) {
          case 'free':
            filteredTentacles = filteredTentacles.filter(tentacle => tentacle.price === 0);
            break;
          case 'paid':
            filteredTentacles = filteredTentacles.filter(tentacle => tentacle.price > 0);
            break;
        }
      }

      // Apply rating filter
      if (this.state.filters.rating) {
        const minRating = parseFloat(this.state.filters.rating);
        filteredTentacles = filteredTentacles.filter(tentacle => tentacle.rating >= minRating);
      }

      // Apply sorting
      switch (this.state.filters.sortBy) {
        case 'popularity':
          filteredTentacles.sort((a, b) => b.downloads - a.downloads);
          break;
        case 'rating':
          filteredTentacles.sort((a, b) => b.rating - a.rating);
          break;
        case 'price_low':
          filteredTentacles.sort((a, b) => a.price - b.price);
          break;
        case 'price_high':
          filteredTentacles.sort((a, b) => b.price - a.price);
          break;
        case 'name':
          filteredTentacles.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }

      // Apply pagination
      const { page, pageSize } = this.state.pagination;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTentacles = filteredTentacles.slice(startIndex, endIndex);

      // Update state
      this.state.tentacles = paginatedTentacles;
      this.state.pagination.totalItems = filteredTentacles.length;
      this.state.pagination.totalPages = Math.ceil(filteredTentacles.length / pageSize);

      this.logger.info(`Loaded ${paginatedTentacles.length} tentacles`);
      
      // Emit tentacles loaded event
      this.events.emit('tentacles:loaded', {
        tentacles: paginatedTentacles,
        pagination: this.state.pagination
      });

      return paginatedTentacles;
    } catch (error) {
      this.logger.error("Failed to load tentacles", error);
      this.state.error = error.message;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Search for tentacles
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Promise resolving to array of tentacles
   */
  async search(query) {
    this.logger.info(`Searching for tentacles with query: ${query}`);
    
    this.state.searchQuery = query;
    this.state.pagination.page = 1; // Reset to first page
    
    return await this.loadTentacles();
  }

  /**
   * Apply filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - Promise resolving to array of tentacles
   */
  async applyFilters(filters) {
    this.logger.info("Applying filters", filters);
    
    // Update filters
    this.state.filters = {
      ...this.state.filters,
      ...filters
    };
    
    this.state.pagination.page = 1; // Reset to first page
    
    return await this.loadTentacles();
  }

  /**
   * Set pagination
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Array>} - Promise resolving to array of tentacles
   */
  async setPagination(pagination) {
    this.logger.info("Setting pagination", pagination);
    
    // Update pagination
    this.state.pagination = {
      ...this.state.pagination,
      ...pagination
    };
    
    return await this.loadTentacles();
  }

  /**
   * Get tentacle details
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to tentacle details
   */
  async getTentacleDetails(tentacleId) {
    this.logger.info(`Getting details for tentacle: ${tentacleId}`);
    
    try {
      // In a real implementation, this would call the marketplace core API
      // For this mock implementation, we'll return a sample tentacle
      const tentacle = {
        id: tentacleId,
        name: tentacleId === 'devmaster' ? 'DevMaster' : 'Unknown Tentacle',
        description: 'Complete development environment with AI assistance',
        longDescription: 'DevMaster is a comprehensive development environment that integrates with your favorite tools and provides AI-powered assistance for coding, debugging, and testing. It supports multiple programming languages and frameworks, and includes features like code completion, refactoring suggestions, and automated testing.',
        category: 'development',
        rating: 4.8,
        downloads: 12500,
        price: 49.99,
        version: '1.0.0',
        author: 'Aideon AI Team',
        releaseDate: '2025-01-15',
        lastUpdate: '2025-05-20',
        requirements: {
          minCpu: '2 GHz dual-core',
          minRam: '4 GB',
          minDisk: '500 MB',
          supportedOs: ['Windows', 'macOS', 'Linux']
        },
        screenshots: [
          'devmaster_screenshot_1.png',
          'devmaster_screenshot_2.png',
          'devmaster_screenshot_3.png'
        ],
        features: [
          'AI-powered code completion',
          'Integrated debugging tools',
          'Automated testing',
          'Multi-language support',
          'Git integration',
          'Customizable UI'
        ]
      };
      
      // Emit tentacle selected event
      this.events.emit('tentacle:selected', {
        tentacleId,
        tentacle
      });
      
      return tentacle;
    } catch (error) {
      this.logger.error(`Failed to get details for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Get the status of the MarketplaceBrowser
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      tentacleCount: this.state.tentacles.length,
      categoryCount: this.state.categories.length,
      isLoading: this.state.isLoading,
      error: this.state.error
    };
  }

  /**
   * Shutdown the MarketplaceBrowser
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn("MarketplaceBrowser not initialized");
      return true;
    }
    
    this.logger.info("Shutting down MarketplaceBrowser");
    
    try {
      // Clear state
      this.state.tentacles = [];
      this.state.categories = [];
      this.state.featured = [];
      this.state.isLoading = false;
      
      this.initialized = false;
      this.logger.info("MarketplaceBrowser shutdown complete");
      return true;
    } catch (error) {
      this.logger.error("Failed to shutdown MarketplaceBrowser", error);
      throw error;
    }
  }
}

module.exports = { MarketplaceBrowser };
