/**
 * @fileoverview Marketplace Browser - User interface for browsing the Aideon Tentacle Marketplace
 * 
 * This module provides a user interface for discovering and exploring tentacles
 * in the Aideon Tentacle Marketplace.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * MarketplaceBrowser class - User interface for browsing the marketplace
 */
class MarketplaceBrowser {
  /**
   * Create a new MarketplaceBrowser instance
   * @param {Object} options - Configuration options
   * @param {Object} options.registryService - Reference to the RegistryService
   * @param {Object} options.installationManager - Reference to the InstallationManager
   */
  constructor(options = {}) {
    this.options = options;
    this.registryService = options.registryService;
    this.installationManager = options.installationManager;
    this.logger = new Logger('MarketplaceBrowser');
    this.events = new EventEmitter();
    this.initialized = false;
    this.categories = [
      'Development', 'Productivity', 'AI', 'Data', 'Security',
      'Communication', 'Utilities', 'Media', 'Integration', 'Other'
    ];
  }

  /**
   * Initialize the marketplace browser
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('MarketplaceBrowser already initialized');
      return true;
    }

    this.logger.info('Initializing MarketplaceBrowser');
    
    if (!this.registryService) {
      throw new Error('RegistryService reference is required');
    }
    
    this.initialized = true;
    this.logger.info('MarketplaceBrowser initialized successfully');
    return true;
  }

  /**
   * Get featured tentacles
   * @param {number} limit - Maximum number of tentacles to return
   * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
   */
  async getFeaturedTentacles(limit = 10) {
    if (!this.initialized) {
      throw new Error('MarketplaceBrowser not initialized');
    }
    
    // Get all tentacles and sort by rating
    const tentacles = this.registryService.getAllTentacles();
    
    // Sort by rating (highest first)
    const sorted = tentacles.sort((a, b) => b.rating - a.rating);
    
    // Return the top N
    return sorted.slice(0, limit);
  }

  /**
   * Get trending tentacles
   * @param {number} limit - Maximum number of tentacles to return
   * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
   */
  async getTrendingTentacles(limit = 10) {
    if (!this.initialized) {
      throw new Error('MarketplaceBrowser not initialized');
    }
    
    // Get all tentacles and sort by downloads
    const tentacles = this.registryService.getAllTentacles();
    
    // Sort by downloads (highest first)
    const sorted = tentacles.sort((a, b) => b.downloads - a.downloads);
    
    // Return the top N
    return sorted.slice(0, limit);
  }

  /**
   * Get newest tentacles
   * @param {number} limit - Maximum number of tentacles to return
   * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
   */
  async getNewestTentacles(limit = 10) {
    if (!this.initialized) {
      throw new Error('MarketplaceBrowser not initialized');
    }
    
    // Get all tentacles and sort by registration date
    const tentacles = this.registryService.getAllTentacles();
    
    // Sort by registration date (newest first)
    const sorted = tentacles.sort((a, b) => 
      new Date(b.registeredAt) - new Date(a.registeredAt)
    );
    
    // Return the top N
    return sorted.slice(0, limit);
  }

  /**
   * Get tentacles by category
   * @param {string} category - Category name
   * @param {number} limit - Maximum number of tentacles to return
   * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
   */
  async getTentaclesByCategory(category, limit = 50) {
    if (!this.initialized) {
      throw new Error('MarketplaceBrowser not initialized');
    }
    
    if (!this.categories.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }
    
    // Get tentacles by category
    const tentacles = this.registryService.getAllTentacles({ category });
    
    // Sort by rating (highest first)
    const sorted = tentacles.sort((a, b) => b.rating - a.rating);
    
    // Return the top N
    return sorted.slice(0, limit);
  }

  /**
   * Search for tentacles
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} - Promise resolving to array of tentacle objects
   */
  async searchTentacles(query, options = {}) {
    if (!this.initialized) {
      throw new Error('MarketplaceBrowser not initialized');
    }
    
    // Search tentacles
    return this.registryService.searchTentacles(query, options);
  }

  /**
   * Get tentacle details
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to tentacle details
   */
  async getTentacleDetails(tentacleId) {
    if (!this.initialized) {
      throw new Error('MarketplaceBrowser not initialized');
    }
    
    // Get tentacle
    const tentacle = this.registryService.getTentacle(tentacleId);
    
    if (!tentacle) {
      throw new Error(`Tentacle ${tentacleId} not found`);
    }
    
    // Check if tentacle is installed
    let isInstalled = false;
    if (this.installationManager) {
      isInstalled = await this.installationManager.isTentacleInstalled(tentacleId);
    }
    
    // Return tentacle details with installation status
    return {
      ...tentacle,
      isInstalled
    };
  }

  /**
   * Get available categories
   * @returns {Array<string>} - Array of category names
   */
  getCategories() {
    return [...this.categories];
  }

  /**
   * Get the status of the marketplace browser
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      categoryCount: this.categories.length
    };
  }

  /**
   * Shutdown the marketplace browser
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('MarketplaceBrowser not initialized');
      return true;
    }

    this.logger.info('Shutting down MarketplaceBrowser');
    
    this.initialized = false;
    this.logger.info('MarketplaceBrowser shutdown successfully');
    return true;
  }
}

module.exports = { MarketplaceBrowser };
