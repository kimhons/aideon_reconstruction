/**
 * @fileoverview Registry Service for the Aideon Tentacle Marketplace
 * 
 * This module provides the core registry functionality for the Tentacle Marketplace,
 * handling tentacle metadata, versioning, and repository management.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * RegistryService class - Core registry for marketplace tentacles
 */
class RegistryService {
  /**
   * Create a new RegistryService instance
   * @param {Object} options - Configuration options
   * @param {string} options.storagePath - Path to store registry data
   * @param {Object} options.verificationService - Reference to the verification service
   */
  constructor(options = {}) {
    this.options = options;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'marketplace', 'registry');
    this.verificationService = options.verificationService;
    this.tentacles = new Map();
    this.logger = new Logger('MarketplaceRegistry');
    this.events = new EventEmitter();
    this.initialized = false;
  }

  /**
   * Initialize the registry service
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('RegistryService already initialized');
      return true;
    }

    this.logger.info('Initializing RegistryService');
    
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Load existing registry data
      await this.loadRegistry();
      
      this.initialized = true;
      this.logger.info('RegistryService initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize RegistryService', error);
      return false;
    }
  }

  /**
   * Load registry data from storage
   * @returns {Promise<void>}
   * @private
   */
  async loadRegistry() {
    try {
      const registryFile = path.join(this.storagePath, 'registry.json');
      const exists = await fs.access(registryFile).then(() => true).catch(() => false);
      
      if (!exists) {
        this.logger.info('Registry file does not exist, creating new registry');
        await this.saveRegistry();
        return;
      }
      
      const data = await fs.readFile(registryFile, 'utf8');
      const registry = JSON.parse(data);
      
      // Load tentacles into memory
      for (const [id, tentacle] of Object.entries(registry.tentacles)) {
        this.tentacles.set(id, tentacle);
      }
      
      this.logger.info(`Loaded ${this.tentacles.size} tentacles from registry`);
    } catch (error) {
      this.logger.error('Failed to load registry', error);
      throw error;
    }
  }

  /**
   * Save registry data to storage
   * @returns {Promise<void>}
   * @private
   */
  async saveRegistry() {
    try {
      const registry = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        tentacles: Object.fromEntries(this.tentacles)
      };
      
      const registryFile = path.join(this.storagePath, 'registry.json');
      await fs.writeFile(registryFile, JSON.stringify(registry, null, 2), 'utf8');
      
      this.logger.info('Registry saved successfully');
    } catch (error) {
      this.logger.error('Failed to save registry', error);
      throw error;
    }
  }

  /**
   * Register a new tentacle in the marketplace
   * @param {Object} tentacle - Tentacle metadata and package information
   * @returns {Promise<Object>} - Promise resolving to the registered tentacle
   */
  async registerTentacle(tentacle) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    if (!tentacle.id) {
      throw new Error('Tentacle ID is required');
    }
    
    if (this.tentacles.has(tentacle.id)) {
      throw new Error(`Tentacle with ID ${tentacle.id} already exists`);
    }
    
    this.logger.info(`Registering tentacle: ${tentacle.id}`);
    
    // Generate a unique registry ID
    tentacle.registryId = crypto.randomUUID();
    
    // Add registration metadata
    tentacle.registeredAt = new Date().toISOString();
    tentacle.updatedAt = tentacle.registeredAt;
    tentacle.downloads = 0;
    tentacle.rating = 0;
    tentacle.ratingCount = 0;
    
    // Verify the tentacle if verification service is available
    if (this.verificationService) {
      const verificationResult = await this.verificationService.verifyTentacle(tentacle);
      
      if (!verificationResult.approved) {
        throw new Error(`Tentacle verification failed: ${verificationResult.reason}`);
      }
      
      tentacle.verification = {
        status: 'approved',
        timestamp: new Date().toISOString(),
        verificationId: verificationResult.verificationId
      };
    } else {
      tentacle.verification = {
        status: 'pending',
        timestamp: new Date().toISOString()
      };
    }
    
    // Store the tentacle in the registry
    this.tentacles.set(tentacle.id, tentacle);
    
    // Save the registry
    await this.saveRegistry();
    
    // Emit event
    this.events.emit('tentacle:registered', { tentacle });
    
    return tentacle;
  }

  /**
   * Update an existing tentacle in the marketplace
   * @param {string} id - Tentacle ID
   * @param {Object} updates - Tentacle updates
   * @returns {Promise<Object>} - Promise resolving to the updated tentacle
   */
  async updateTentacle(id, updates) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    if (!this.tentacles.has(id)) {
      throw new Error(`Tentacle with ID ${id} not found`);
    }
    
    this.logger.info(`Updating tentacle: ${id}`);
    
    const tentacle = this.tentacles.get(id);
    
    // Apply updates
    const updatedTentacle = {
      ...tentacle,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Verify the tentacle if verification service is available and package was updated
    if (this.verificationService && updates.package) {
      const verificationResult = await this.verificationService.verifyTentacle(updatedTentacle);
      
      if (!verificationResult.approved) {
        throw new Error(`Tentacle verification failed: ${verificationResult.reason}`);
      }
      
      updatedTentacle.verification = {
        status: 'approved',
        timestamp: new Date().toISOString(),
        verificationId: verificationResult.verificationId
      };
    }
    
    // Store the updated tentacle in the registry
    this.tentacles.set(id, updatedTentacle);
    
    // Save the registry
    await this.saveRegistry();
    
    // Emit event
    this.events.emit('tentacle:updated', { tentacle: updatedTentacle });
    
    return updatedTentacle;
  }

  /**
   * Get a tentacle by ID
   * @param {string} id - Tentacle ID
   * @returns {Object|null} - Tentacle object or null if not found
   */
  getTentacle(id) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    return this.tentacles.get(id) || null;
  }

  /**
   * Get all tentacles in the registry
   * @param {Object} filters - Optional filters to apply
   * @returns {Array<Object>} - Array of tentacle objects
   */
  getAllTentacles(filters = {}) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    let tentacles = Array.from(this.tentacles.values());
    
    // Apply filters if provided
    if (filters.category) {
      tentacles = tentacles.filter(t => t.category === filters.category);
    }
    
    if (filters.author) {
      tentacles = tentacles.filter(t => t.author === filters.author);
    }
    
    if (filters.minRating) {
      tentacles = tentacles.filter(t => t.rating >= filters.minRating);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      tentacles = tentacles.filter(t => 
        t.tags && filters.tags.some(tag => t.tags.includes(tag))
      );
    }
    
    return tentacles;
  }

  /**
   * Delete a tentacle from the registry
   * @param {string} id - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deleteTentacle(id) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    if (!this.tentacles.has(id)) {
      throw new Error(`Tentacle with ID ${id} not found`);
    }
    
    this.logger.info(`Deleting tentacle: ${id}`);
    
    const tentacle = this.tentacles.get(id);
    
    // Remove the tentacle from the registry
    this.tentacles.delete(id);
    
    // Save the registry
    await this.saveRegistry();
    
    // Emit event
    this.events.emit('tentacle:deleted', { tentacle });
    
    return true;
  }

  /**
   * Search for tentacles in the registry
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array<Object>} - Array of matching tentacle objects
   */
  searchTentacles(query, options = {}) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    const searchFields = options.fields || ['name', 'description', 'tags'];
    const limit = options.limit || 100;
    
    let results = Array.from(this.tentacles.values());
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      
      results = results.filter(tentacle => {
        return searchFields.some(field => {
          const value = tentacle[field];
          
          if (!value) {
            return false;
          }
          
          if (Array.isArray(value)) {
            return value.some(v => v.toLowerCase().includes(lowerQuery));
          }
          
          return value.toLowerCase().includes(lowerQuery);
        });
      });
    }
    
    // Apply sorting if specified
    if (options.sortBy) {
      const sortField = options.sortBy;
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      
      results.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * sortOrder;
        if (a[sortField] > b[sortField]) return 1 * sortOrder;
        return 0;
      });
    }
    
    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    
    return results.slice(0, limit);
  }

  /**
   * Increment download count for a tentacle
   * @param {string} id - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to the updated tentacle
   */
  async incrementDownloads(id) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    if (!this.tentacles.has(id)) {
      throw new Error(`Tentacle with ID ${id} not found`);
    }
    
    const tentacle = this.tentacles.get(id);
    
    // Increment download count
    tentacle.downloads = (tentacle.downloads || 0) + 1;
    
    // Save the registry
    await this.saveRegistry();
    
    return tentacle;
  }

  /**
   * Add a rating for a tentacle
   * @param {string} id - Tentacle ID
   * @param {number} rating - Rating value (1-5)
   * @returns {Promise<Object>} - Promise resolving to the updated tentacle
   */
  async addRating(id, rating) {
    if (!this.initialized) {
      throw new Error('RegistryService not initialized');
    }
    
    if (!this.tentacles.has(id)) {
      throw new Error(`Tentacle with ID ${id} not found`);
    }
    
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    const tentacle = this.tentacles.get(id);
    
    // Update rating
    const currentRating = tentacle.rating || 0;
    const currentCount = tentacle.ratingCount || 0;
    
    tentacle.ratingCount = currentCount + 1;
    tentacle.rating = ((currentRating * currentCount) + rating) / tentacle.ratingCount;
    
    // Save the registry
    await this.saveRegistry();
    
    return tentacle;
  }

  /**
   * Get the status of the registry service
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      tentacleCount: this.tentacles.size,
      storagePath: this.storagePath
    };
  }

  /**
   * Shutdown the registry service
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('RegistryService not initialized');
      return true;
    }

    this.logger.info('Shutting down RegistryService');
    
    try {
      // Save registry before shutdown
      await this.saveRegistry();
      
      this.initialized = false;
      this.logger.info('RegistryService shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown RegistryService', error);
      return false;
    }
  }
}

module.exports = { RegistryService };
