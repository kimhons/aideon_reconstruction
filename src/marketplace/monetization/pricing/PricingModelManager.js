/**
 * @fileoverview Pricing Model Manager for the Aideon Tentacle Marketplace
 * 
 * This module provides pricing model management functionality, supporting
 * different pricing strategies for tentacles.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../../core/logging/Logger');
const { EventEmitter } = require('../../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * PricingModelManager class - Manages different pricing models
 */
class PricingModelManager {
  /**
   * Create a new PricingModelManager instance
   * @param {Object} options - Configuration options
   * @param {string} options.storagePath - Path to store pricing model data
   */
  constructor(options = {}) {
    this.options = options;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'pricing-data');
    this.logger = new Logger('PricingModelManager');
    this.events = new EventEmitter();
    this.pricingModels = new Map();
    this.tentaclePricing = new Map();
    this.initialized = false;
    
    // Define pricing model types
    this.pricingModelTypes = {
      FREE: 'free',
      ONE_TIME: 'one_time',
      SUBSCRIPTION: 'subscription',
      GHOST_MODE: 'ghost_mode',
      RENTAL: 'rental'
    };
    
    // Define subscription intervals
    this.subscriptionIntervals = {
      MONTHLY: 'month',
      YEARLY: 'year'
    };
  }

  /**
   * Initialize the pricing model manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('PricingModelManager already initialized');
      return true;
    }

    this.logger.info('Initializing PricingModelManager');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'models'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'tentacles'), { recursive: true });
      
      // Load pricing models
      await this._loadPricingModels();
      
      // Load tentacle pricing
      await this._loadTentaclePricing();
      
      this.initialized = true;
      this.logger.info('PricingModelManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize PricingModelManager', error);
      throw error;
    }
  }

  /**
   * Load pricing models
   * @returns {Promise<void>}
   * @private
   */
  async _loadPricingModels() {
    const modelsDir = path.join(this.storagePath, 'models');
    
    try {
      const files = await fs.readdir(modelsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(modelsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const model = JSON.parse(data);
            
            this.pricingModels.set(model.id, model);
          } catch (error) {
            this.logger.error(`Failed to load pricing model from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.pricingModels.size} pricing models`);
      
      // Create default pricing models if none exist
      if (this.pricingModels.size === 0) {
        await this._createDefaultPricingModels();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load pricing models', error);
      } else {
        // Create default pricing models
        await this._createDefaultPricingModels();
      }
    }
  }

  /**
   * Create default pricing models
   * @returns {Promise<void>}
   * @private
   */
  async _createDefaultPricingModels() {
    this.logger.info('Creating default pricing models');
    
    const defaultModels = [
      {
        id: 'free',
        name: 'Free',
        type: this.pricingModelTypes.FREE,
        description: 'Free tentacle with no cost',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'one_time',
        name: 'One-Time Purchase',
        type: this.pricingModelTypes.ONE_TIME,
        description: 'One-time purchase with perpetual license',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'subscription_monthly',
        name: 'Monthly Subscription',
        type: this.pricingModelTypes.SUBSCRIPTION,
        interval: this.subscriptionIntervals.MONTHLY,
        description: 'Monthly subscription with recurring payment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'subscription_yearly',
        name: 'Yearly Subscription',
        type: this.pricingModelTypes.SUBSCRIPTION,
        interval: this.subscriptionIntervals.YEARLY,
        description: 'Yearly subscription with recurring payment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ghost_mode',
        name: 'Ghost Mode',
        type: this.pricingModelTypes.GHOST_MODE,
        description: 'Ghost Mode with yearly renewal',
        interval: this.subscriptionIntervals.YEARLY,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rental',
        name: 'Rental',
        type: this.pricingModelTypes.RENTAL,
        description: 'Rental with time-limited access',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    for (const model of defaultModels) {
      this.pricingModels.set(model.id, model);
      
      const modelPath = path.join(this.storagePath, 'models', `${model.id}.json`);
      await fs.writeFile(modelPath, JSON.stringify(model, null, 2));
    }
    
    this.logger.info(`Created ${defaultModels.length} default pricing models`);
  }

  /**
   * Load tentacle pricing
   * @returns {Promise<void>}
   * @private
   */
  async _loadTentaclePricing() {
    const tentaclesDir = path.join(this.storagePath, 'tentacles');
    
    try {
      const files = await fs.readdir(tentaclesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(tentaclesDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const pricing = JSON.parse(data);
            
            this.tentaclePricing.set(pricing.tentacleId, pricing);
          } catch (error) {
            this.logger.error(`Failed to load tentacle pricing from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded pricing for ${this.tentaclePricing.size} tentacles`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load tentacle pricing', error);
      }
    }
  }

  /**
   * Save pricing model to file
   * @param {string} modelId - Pricing model ID
   * @param {Object} model - Pricing model data
   * @returns {Promise<void>}
   * @private
   */
  async _savePricingModel(modelId, model) {
    const modelPath = path.join(this.storagePath, 'models', `${modelId}.json`);
    
    await fs.writeFile(modelPath, JSON.stringify(model, null, 2));
  }

  /**
   * Save tentacle pricing to file
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} pricing - Tentacle pricing data
   * @returns {Promise<void>}
   * @private
   */
  async _saveTentaclePricing(tentacleId, pricing) {
    const pricingPath = path.join(this.storagePath, 'tentacles', `${tentacleId}.json`);
    
    await fs.writeFile(pricingPath, JSON.stringify(pricing, null, 2));
  }

  /**
   * Create a new pricing model
   * @param {Object} options - Pricing model options
   * @param {string} options.name - Pricing model name
   * @param {string} options.type - Pricing model type
   * @param {string} options.description - Pricing model description
   * @param {string} options.interval - Subscription interval (for subscription models)
   * @returns {Promise<Object>} - Promise resolving to the created pricing model
   */
  async createPricingModel(options) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    this.logger.info(`Creating pricing model: ${options.name}`);
    
    try {
      // Validate pricing model type
      if (!Object.values(this.pricingModelTypes).includes(options.type)) {
        throw new Error(`Invalid pricing model type: ${options.type}`);
      }
      
      // Validate subscription interval if applicable
      if (options.type === this.pricingModelTypes.SUBSCRIPTION && 
          !Object.values(this.subscriptionIntervals).includes(options.interval)) {
        throw new Error(`Invalid subscription interval: ${options.interval}`);
      }
      
      // Generate model ID
      const modelId = options.id || `model_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create pricing model
      const model = {
        id: modelId,
        name: options.name,
        type: options.type,
        description: options.description,
        interval: options.interval,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store pricing model
      this.pricingModels.set(modelId, model);
      
      // Save pricing model to file
      await this._savePricingModel(modelId, model);
      
      // Emit event
      this.events.emit('pricing-model:created', { model });
      
      return model;
    } catch (error) {
      this.logger.error(`Failed to create pricing model: ${options.name}`, error);
      throw error;
    }
  }

  /**
   * Update a pricing model
   * @param {string} modelId - Pricing model ID
   * @param {Object} updates - Pricing model updates
   * @returns {Promise<Object>} - Promise resolving to the updated pricing model
   */
  async updatePricingModel(modelId, updates) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    this.logger.info(`Updating pricing model: ${modelId}`);
    
    try {
      // Get pricing model
      const model = this.pricingModels.get(modelId);
      
      if (!model) {
        throw new Error(`Pricing model ${modelId} not found`);
      }
      
      // Validate pricing model type if provided
      if (updates.type && !Object.values(this.pricingModelTypes).includes(updates.type)) {
        throw new Error(`Invalid pricing model type: ${updates.type}`);
      }
      
      // Validate subscription interval if applicable
      if ((updates.type === this.pricingModelTypes.SUBSCRIPTION || 
           model.type === this.pricingModelTypes.SUBSCRIPTION) && 
          updates.interval && 
          !Object.values(this.subscriptionIntervals).includes(updates.interval)) {
        throw new Error(`Invalid subscription interval: ${updates.interval}`);
      }
      
      // Update pricing model
      Object.assign(model, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      
      // Save pricing model to file
      await this._savePricingModel(modelId, model);
      
      // Emit event
      this.events.emit('pricing-model:updated', { model });
      
      return model;
    } catch (error) {
      this.logger.error(`Failed to update pricing model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Delete a pricing model
   * @param {string} modelId - Pricing model ID
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deletePricingModel(modelId) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    this.logger.info(`Deleting pricing model: ${modelId}`);
    
    try {
      // Check if pricing model exists
      if (!this.pricingModels.has(modelId)) {
        throw new Error(`Pricing model ${modelId} not found`);
      }
      
      // Check if pricing model is in use
      for (const pricing of this.tentaclePricing.values()) {
        if (pricing.modelId === modelId) {
          throw new Error(`Pricing model ${modelId} is in use by tentacle ${pricing.tentacleId}`);
        }
      }
      
      // Delete pricing model
      this.pricingModels.delete(modelId);
      
      // Delete pricing model file
      const modelPath = path.join(this.storagePath, 'models', `${modelId}.json`);
      await fs.unlink(modelPath);
      
      // Emit event
      this.events.emit('pricing-model:deleted', { modelId });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete pricing model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Get a pricing model by ID
   * @param {string} modelId - Pricing model ID
   * @returns {Promise<Object>} - Promise resolving to the pricing model
   */
  async getPricingModel(modelId) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    // Get pricing model from memory
    const model = this.pricingModels.get(modelId);
    
    if (model) {
      return model;
    }
    
    // Try to load pricing model from file
    const modelPath = path.join(this.storagePath, 'models', `${modelId}.json`);
    
    try {
      const data = await fs.readFile(modelPath, 'utf8');
      const loadedModel = JSON.parse(data);
      
      // Cache pricing model in memory
      this.pricingModels.set(modelId, loadedModel);
      
      return loadedModel;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Pricing model ${modelId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Get all pricing models
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of pricing models
   */
  async getAllPricingModels() {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    return Array.from(this.pricingModels.values());
  }

  /**
   * Set pricing for a tentacle
   * @param {Object} options - Tentacle pricing options
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.modelId - Pricing model ID
   * @param {number} options.price - Price amount
   * @param {string} options.currency - Price currency
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - Promise resolving to the tentacle pricing
   */
  async setTentaclePricing(options) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    this.logger.info(`Setting pricing for tentacle: ${options.tentacleId}`);
    
    try {
      // Validate pricing model
      const model = await this.getPricingModel(options.modelId);
      
      if (!model) {
        throw new Error(`Pricing model ${options.modelId} not found`);
      }
      
      // Create or update tentacle pricing
      const pricing = this.tentaclePricing.get(options.tentacleId) || {
        tentacleId: options.tentacleId,
        createdAt: new Date().toISOString()
      };
      
      // Update pricing
      Object.assign(pricing, {
        modelId: options.modelId,
        modelType: model.type,
        price: options.price,
        currency: options.currency,
        interval: model.interval,
        metadata: options.metadata,
        updatedAt: new Date().toISOString()
      });
      
      // Store tentacle pricing
      this.tentaclePricing.set(options.tentacleId, pricing);
      
      // Save tentacle pricing to file
      await this._saveTentaclePricing(options.tentacleId, pricing);
      
      // Emit event
      this.events.emit('tentacle-pricing:set', { pricing });
      
      return pricing;
    } catch (error) {
      this.logger.error(`Failed to set pricing for tentacle: ${options.tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Get pricing for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to the tentacle pricing
   */
  async getTentaclePricing(tentacleId) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    // Get tentacle pricing from memory
    const pricing = this.tentaclePricing.get(tentacleId);
    
    if (pricing) {
      return pricing;
    }
    
    // Try to load tentacle pricing from file
    const pricingPath = path.join(this.storagePath, 'tentacles', `${tentacleId}.json`);
    
    try {
      const data = await fs.readFile(pricingPath, 'utf8');
      const loadedPricing = JSON.parse(data);
      
      // Cache tentacle pricing in memory
      this.tentaclePricing.set(tentacleId, loadedPricing);
      
      return loadedPricing;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Pricing for tentacle ${tentacleId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Delete pricing for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deleteTentaclePricing(tentacleId) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    this.logger.info(`Deleting pricing for tentacle: ${tentacleId}`);
    
    try {
      // Check if tentacle pricing exists
      if (!this.tentaclePricing.has(tentacleId)) {
        throw new Error(`Pricing for tentacle ${tentacleId} not found`);
      }
      
      // Delete tentacle pricing
      this.tentaclePricing.delete(tentacleId);
      
      // Delete tentacle pricing file
      const pricingPath = path.join(this.storagePath, 'tentacles', `${tentacleId}.json`);
      await fs.unlink(pricingPath);
      
      // Emit event
      this.events.emit('tentacle-pricing:deleted', { tentacleId });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete pricing for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Calculate price for a tentacle
   * @param {Object} options - Price calculation options
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.currency - Target currency
   * @returns {Promise<Object>} - Promise resolving to the price calculation
   */
  async calculatePrice(options) {
    if (!this.initialized) {
      throw new Error('PricingModelManager not initialized');
    }
    
    try {
      // Get tentacle pricing
      const pricing = await this.getTentaclePricing(options.tentacleId);
      
      if (!pricing) {
        throw new Error(`Pricing for tentacle ${options.tentacleId} not found`);
      }
      
      // Get pricing model
      const model = await this.getPricingModel(pricing.modelId);
      
      if (!model) {
        throw new Error(`Pricing model ${pricing.modelId} not found`);
      }
      
      // Calculate price
      let price = pricing.price;
      let currency = pricing.currency;
      
      // Convert currency if needed
      if (options.currency && options.currency !== pricing.currency) {
        // In a real implementation, we would use a currency conversion service
        // For this mock implementation, we'll just use a simple conversion
        if (pricing.currency === 'USD' && options.currency === 'EUR') {
          price = Math.round(price * 0.85 * 100) / 100;
          currency = 'EUR';
        } else if (pricing.currency === 'EUR' && options.currency === 'USD') {
          price = Math.round(price * 1.18 * 100) / 100;
          currency = 'USD';
        } else {
          // Unsupported conversion
          this.logger.warn(`Unsupported currency conversion: ${pricing.currency} to ${options.currency}`);
        }
      }
      
      return {
        tentacleId: options.tentacleId,
        modelId: pricing.modelId,
        modelType: model.type,
        price,
        currency,
        interval: model.interval,
        isFree: model.type === this.pricingModelTypes.FREE,
        isSubscription: model.type === this.pricingModelTypes.SUBSCRIPTION,
        isOneTime: model.type === this.pricingModelTypes.ONE_TIME,
        isGhostMode: model.type === this.pricingModelTypes.GHOST_MODE,
        isRental: model.type === this.pricingModelTypes.RENTAL
      };
    } catch (error) {
      this.logger.error(`Failed to calculate price for tentacle: ${options.tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Get the status of the pricing model manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      pricingModels: this.pricingModels.size,
      tentaclePricing: this.tentaclePricing.size
    };
  }

  /**
   * Shutdown the pricing model manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('PricingModelManager not initialized');
      return true;
    }
    
    this.logger.info('Shutting down PricingModelManager');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { PricingModelManager };
