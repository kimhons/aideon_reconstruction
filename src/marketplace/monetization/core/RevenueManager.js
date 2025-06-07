/**
 * @fileoverview Revenue Manager for the Aideon Tentacle Marketplace
 * 
 * This module provides revenue management functionality, handling revenue sharing,
 * developer payouts, and financial reporting.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * RevenueManager class - Manages revenue sharing and developer payouts
 */
class RevenueManager {
  /**
   * Create a new RevenueManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.developerService - Reference to the developer service
   * @param {Object} options.payoutService - Reference to the payout service
   * @param {string} options.storagePath - Path to store revenue data
   * @param {Object} options.revenueSharingConfig - Revenue sharing configuration
   */
  constructor(options = {}) {
    this.options = options;
    this.developerService = options.developerService;
    this.payoutService = options.payoutService;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'revenue-data');
    this.revenueSharingConfig = options.revenueSharingConfig || this._getDefaultRevenueSharingConfig();
    this.logger = new Logger('RevenueManager');
    this.events = new EventEmitter();
    this.revenueEntries = new Map();
    this.developerRevenue = new Map();
    this.initialized = false;
  }

  /**
   * Get default revenue sharing configuration
   * @returns {Object} - Default revenue sharing configuration
   * @private
   */
  _getDefaultRevenueSharingConfig() {
    return {
      // Base revenue share (70% to developer, 30% to platform)
      baseShare: {
        developer: 0.7,
        platform: 0.3
      },
      // Tiered revenue share based on developer level
      tieredShare: {
        bronze: {
          developer: 0.7,
          platform: 0.3,
          threshold: 0 // Starting level
        },
        silver: {
          developer: 0.75,
          platform: 0.25,
          threshold: 10000 // $10,000 in lifetime revenue
        },
        gold: {
          developer: 0.8,
          platform: 0.2,
          threshold: 50000 // $50,000 in lifetime revenue
        },
        platinum: {
          developer: 0.85,
          platform: 0.15,
          threshold: 100000 // $100,000 in lifetime revenue
        }
      },
      // Special pricing models may have different revenue shares
      pricingModelShare: {
        subscription: {
          developer: 0.7,
          platform: 0.3
        },
        one_time: {
          developer: 0.7,
          platform: 0.3
        },
        ghost_mode: {
          developer: 0.8, // Higher share for Ghost Mode
          platform: 0.2
        },
        rental: {
          developer: 0.65, // Lower share for rental keys
          platform: 0.35
        }
      },
      // Minimum payout amount
      minimumPayout: 50,
      // Payout schedule (in days)
      payoutSchedule: 30
    };
  }

  /**
   * Initialize the revenue manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('RevenueManager already initialized');
      return true;
    }

    this.logger.info('Initializing RevenueManager');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'revenue'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'payouts'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'developers'), { recursive: true });
      
      // Initialize payout service if available
      if (this.payoutService) {
        await this.payoutService.initialize();
      } else {
        this.logger.warn('PayoutService not provided, payouts will be unavailable');
      }
      
      // Load existing revenue data
      await this._loadRevenueData();
      
      this.initialized = true;
      this.logger.info('RevenueManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize RevenueManager', error);
      throw error;
    }
  }

  /**
   * Load existing revenue data
   * @returns {Promise<void>}
   * @private
   */
  async _loadRevenueData() {
    // Load revenue entries
    const revenueDir = path.join(this.storagePath, 'revenue');
    
    try {
      const files = await fs.readdir(revenueDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(revenueDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const revenueEntry = JSON.parse(data);
            
            this.revenueEntries.set(revenueEntry.id, revenueEntry);
          } catch (error) {
            this.logger.error(`Failed to load revenue entry from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.revenueEntries.size} existing revenue entries`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load revenue entries', error);
      }
    }
    
    // Load developer revenue
    const developersDir = path.join(this.storagePath, 'developers');
    
    try {
      const files = await fs.readdir(developersDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(developersDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const developerRevenue = JSON.parse(data);
            
            this.developerRevenue.set(developerRevenue.developerId, developerRevenue);
          } catch (error) {
            this.logger.error(`Failed to load developer revenue from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded revenue data for ${this.developerRevenue.size} developers`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load developer revenue', error);
      }
    }
  }

  /**
   * Save revenue entry to file
   * @param {string} revenueId - Revenue ID
   * @param {Object} revenueEntry - Revenue entry data
   * @returns {Promise<void>}
   * @private
   */
  async _saveRevenueEntry(revenueId, revenueEntry) {
    const revenuePath = path.join(this.storagePath, 'revenue', `${revenueId}.json`);
    
    await fs.writeFile(revenuePath, JSON.stringify(revenueEntry, null, 2));
  }

  /**
   * Save developer revenue to file
   * @param {string} developerId - Developer ID
   * @param {Object} developerRevenue - Developer revenue data
   * @returns {Promise<void>}
   * @private
   */
  async _saveDeveloperRevenue(developerId, developerRevenue) {
    const developerPath = path.join(this.storagePath, 'developers', `${developerId}.json`);
    
    await fs.writeFile(developerPath, JSON.stringify(developerRevenue, null, 2));
  }

  /**
   * Calculate revenue share for a transaction
   * @param {Object} options - Revenue calculation options
   * @param {string} options.developerId - Developer ID
   * @param {number} options.amount - Transaction amount
   * @param {string} options.pricingModel - Pricing model
   * @returns {Promise<Object>} - Promise resolving to revenue share calculation
   * @private
   */
  async _calculateRevenueShare(options) {
    // Get developer revenue tier
    let developerTier = 'bronze';
    let developerLifetimeRevenue = 0;
    
    if (this.developerRevenue.has(options.developerId)) {
      const revenue = this.developerRevenue.get(options.developerId);
      developerLifetimeRevenue = revenue.lifetimeRevenue || 0;
      
      // Determine tier based on lifetime revenue
      const tiers = Object.entries(this.revenueSharingConfig.tieredShare)
        .sort((a, b) => b[1].threshold - a[1].threshold);
      
      for (const [tier, config] of tiers) {
        if (developerLifetimeRevenue >= config.threshold) {
          developerTier = tier;
          break;
        }
      }
    }
    
    // Get revenue share percentages
    let developerShare = this.revenueSharingConfig.baseShare.developer;
    let platformShare = this.revenueSharingConfig.baseShare.platform;
    
    // Apply tier-based share if available
    if (this.revenueSharingConfig.tieredShare[developerTier]) {
      developerShare = this.revenueSharingConfig.tieredShare[developerTier].developer;
      platformShare = this.revenueSharingConfig.tieredShare[developerTier].platform;
    }
    
    // Apply pricing model-specific share if available
    if (options.pricingModel && 
        this.revenueSharingConfig.pricingModelShare[options.pricingModel]) {
      developerShare = this.revenueSharingConfig.pricingModelShare[options.pricingModel].developer;
      platformShare = this.revenueSharingConfig.pricingModelShare[options.pricingModel].platform;
    }
    
    // Calculate actual amounts
    const developerAmount = Math.round(options.amount * developerShare * 100) / 100;
    const platformAmount = Math.round(options.amount * platformShare * 100) / 100;
    
    return {
      developerTier,
      developerShare,
      platformShare,
      developerAmount,
      platformAmount,
      lifetimeRevenue: developerLifetimeRevenue
    };
  }

  /**
   * Process revenue for a transaction
   * @param {Object} options - Revenue processing options
   * @param {string} options.transactionId - Transaction ID
   * @param {string} options.developerId - Developer ID
   * @param {number} options.amount - Transaction amount
   * @param {string} options.currency - Transaction currency
   * @param {string} options.pricingModel - Pricing model
   * @returns {Promise<Object>} - Promise resolving to revenue processing result
   */
  async processRevenue(options) {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    this.logger.info(`Processing revenue for transaction: ${options.transactionId}`);
    
    try {
      // Generate revenue ID
      const revenueId = `rev_${crypto.randomBytes(8).toString('hex')}`;
      
      // Calculate revenue share
      const revenueShare = await this._calculateRevenueShare({
        developerId: options.developerId,
        amount: options.amount,
        pricingModel: options.pricingModel
      });
      
      // Create revenue entry
      const revenueEntry = {
        id: revenueId,
        transactionId: options.transactionId,
        developerId: options.developerId,
        amount: options.amount,
        currency: options.currency,
        pricingModel: options.pricingModel,
        developerAmount: revenueShare.developerAmount,
        platformAmount: revenueShare.platformAmount,
        developerShare: revenueShare.developerShare,
        platformShare: revenueShare.platformShare,
        developerTier: revenueShare.developerTier,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store revenue entry
      this.revenueEntries.set(revenueId, revenueEntry);
      
      // Save revenue entry to file
      await this._saveRevenueEntry(revenueId, revenueEntry);
      
      // Update developer revenue
      await this._updateDeveloperRevenue({
        developerId: options.developerId,
        amount: options.amount,
        developerAmount: revenueShare.developerAmount,
        currency: options.currency
      });
      
      // Emit event
      this.events.emit('revenue:processed', { revenueEntry });
      
      return {
        success: true,
        revenueId,
        developerAmount: revenueShare.developerAmount,
        platformAmount: revenueShare.platformAmount
      };
    } catch (error) {
      this.logger.error(`Failed to process revenue for transaction: ${options.transactionId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update developer revenue
   * @param {Object} options - Developer revenue update options
   * @param {string} options.developerId - Developer ID
   * @param {number} options.amount - Transaction amount
   * @param {number} options.developerAmount - Developer amount
   * @param {string} options.currency - Transaction currency
   * @returns {Promise<void>}
   * @private
   */
  async _updateDeveloperRevenue(options) {
    // Get or create developer revenue entry
    let developerRevenue = this.developerRevenue.get(options.developerId);
    
    if (!developerRevenue) {
      developerRevenue = {
        developerId: options.developerId,
        lifetimeRevenue: 0,
        availableBalance: 0,
        pendingBalance: 0,
        paidBalance: 0,
        currency: options.currency,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Update revenue amounts
    developerRevenue.lifetimeRevenue += options.amount;
    developerRevenue.pendingBalance += options.developerAmount;
    developerRevenue.lastUpdated = new Date().toISOString();
    
    // Store developer revenue
    this.developerRevenue.set(options.developerId, developerRevenue);
    
    // Save developer revenue to file
    await this._saveDeveloperRevenue(options.developerId, developerRevenue);
  }

  /**
   * Adjust revenue for a transaction (e.g., for refunds)
   * @param {Object} options - Revenue adjustment options
   * @param {string} options.transactionId - Transaction ID
   * @param {string} options.revenueId - Revenue ID
   * @param {string} options.developerId - Developer ID
   * @param {number} options.amount - Adjustment amount (negative for refunds)
   * @param {string} options.currency - Transaction currency
   * @param {string} options.reason - Adjustment reason
   * @returns {Promise<Object>} - Promise resolving to revenue adjustment result
   */
  async adjustRevenue(options) {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    this.logger.info(`Adjusting revenue for transaction: ${options.transactionId}`);
    
    try {
      // Get revenue entry
      const revenueEntry = this.revenueEntries.get(options.revenueId);
      
      if (!revenueEntry) {
        throw new Error(`Revenue entry ${options.revenueId} not found`);
      }
      
      // Calculate adjustment amounts
      const developerAdjustment = Math.round(options.amount * revenueEntry.developerShare * 100) / 100;
      const platformAdjustment = Math.round(options.amount * revenueEntry.platformShare * 100) / 100;
      
      // Create adjustment entry
      const adjustmentId = `adj_${crypto.randomBytes(8).toString('hex')}`;
      
      const adjustmentEntry = {
        id: adjustmentId,
        revenueId: options.revenueId,
        transactionId: options.transactionId,
        developerId: options.developerId,
        amount: options.amount,
        developerAdjustment,
        platformAdjustment,
        reason: options.reason,
        createdAt: new Date().toISOString()
      };
      
      // Update revenue entry
      revenueEntry.adjustments = revenueEntry.adjustments || [];
      revenueEntry.adjustments.push(adjustmentEntry);
      revenueEntry.updatedAt = new Date().toISOString();
      
      // Save revenue entry to file
      await this._saveRevenueEntry(options.revenueId, revenueEntry);
      
      // Update developer revenue
      await this._adjustDeveloperRevenue({
        developerId: options.developerId,
        amount: options.amount,
        developerAmount: developerAdjustment,
        currency: options.currency
      });
      
      // Emit event
      this.events.emit('revenue:adjusted', { revenueEntry, adjustmentEntry });
      
      return {
        success: true,
        adjustmentId,
        developerAdjustment,
        platformAdjustment
      };
    } catch (error) {
      this.logger.error(`Failed to adjust revenue for transaction: ${options.transactionId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Adjust developer revenue
   * @param {Object} options - Developer revenue adjustment options
   * @param {string} options.developerId - Developer ID
   * @param {number} options.amount - Adjustment amount
   * @param {number} options.developerAmount - Developer adjustment amount
   * @param {string} options.currency - Transaction currency
   * @returns {Promise<void>}
   * @private
   */
  async _adjustDeveloperRevenue(options) {
    // Get developer revenue entry
    const developerRevenue = this.developerRevenue.get(options.developerId);
    
    if (!developerRevenue) {
      throw new Error(`Developer revenue for ${options.developerId} not found`);
    }
    
    // Update revenue amounts
    developerRevenue.lifetimeRevenue += options.amount;
    developerRevenue.pendingBalance += options.developerAmount;
    developerRevenue.lastUpdated = new Date().toISOString();
    
    // Save developer revenue to file
    await this._saveDeveloperRevenue(options.developerId, developerRevenue);
  }

  /**
   * Process payouts for eligible developers
   * @returns {Promise<Object>} - Promise resolving to payout processing result
   */
  async processPayouts() {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    if (!this.payoutService) {
      throw new Error('PayoutService not available');
    }
    
    this.logger.info('Processing payouts for eligible developers');
    
    const results = {
      success: true,
      processed: 0,
      failed: 0,
      payouts: []
    };
    
    try {
      // Find eligible developers
      for (const [developerId, revenue] of this.developerRevenue.entries()) {
        // Check if developer has enough balance for payout
        if (revenue.pendingBalance >= this.revenueSharingConfig.minimumPayout) {
          try {
            // Process payout
            const payoutResult = await this._processDeveloperPayout(developerId);
            
            results.processed++;
            results.payouts.push(payoutResult);
          } catch (error) {
            this.logger.error(`Failed to process payout for developer: ${developerId}`, error);
            
            results.failed++;
            results.payouts.push({
              developerId,
              success: false,
              error: error.message
            });
          }
        }
      }
      
      // Emit event
      this.events.emit('payouts:processed', { results });
      
      return results;
    } catch (error) {
      this.logger.error('Failed to process payouts', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process payout for a developer
   * @param {string} developerId - Developer ID
   * @returns {Promise<Object>} - Promise resolving to payout result
   * @private
   */
  async _processDeveloperPayout(developerId) {
    // Get developer revenue
    const developerRevenue = this.developerRevenue.get(developerId);
    
    if (!developerRevenue) {
      throw new Error(`Developer revenue for ${developerId} not found`);
    }
    
    // Generate payout ID
    const payoutId = `pay_${crypto.randomBytes(8).toString('hex')}`;
    
    // Create payout
    const payout = {
      id: payoutId,
      developerId,
      amount: developerRevenue.pendingBalance,
      currency: developerRevenue.currency,
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Process payout with payout service
    const payoutResult = await this.payoutService.processPayout({
      payoutId,
      developerId,
      amount: developerRevenue.pendingBalance,
      currency: developerRevenue.currency
    });
    
    // Update payout with result
    payout.status = payoutResult.success ? 'completed' : 'failed';
    payout.error = payoutResult.error;
    payout.gatewayPayoutId = payoutResult.gatewayPayoutId;
    payout.updatedAt = new Date().toISOString();
    
    // Save payout to file
    const payoutPath = path.join(this.storagePath, 'payouts', `${payoutId}.json`);
    await fs.writeFile(payoutPath, JSON.stringify(payout, null, 2));
    
    // Update developer revenue
    if (payoutResult.success) {
      developerRevenue.paidBalance += developerRevenue.pendingBalance;
      developerRevenue.availableBalance += developerRevenue.pendingBalance;
      developerRevenue.pendingBalance = 0;
      developerRevenue.lastPayout = {
        payoutId,
        amount: payout.amount,
        date: payout.createdAt
      };
      developerRevenue.lastUpdated = new Date().toISOString();
      
      // Save developer revenue to file
      await this._saveDeveloperRevenue(developerId, developerRevenue);
    }
    
    // Emit event
    this.events.emit('payout:processed', { payout });
    
    return {
      developerId,
      payoutId,
      amount: payout.amount,
      currency: payout.currency,
      success: payoutResult.success,
      error: payoutResult.error
    };
  }

  /**
   * Get revenue entry by ID
   * @param {string} revenueId - Revenue ID
   * @returns {Promise<Object>} - Promise resolving to revenue entry
   */
  async getRevenueEntry(revenueId) {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    // Get revenue entry from memory
    const revenueEntry = this.revenueEntries.get(revenueId);
    
    if (revenueEntry) {
      return revenueEntry;
    }
    
    // Try to load revenue entry from file
    const revenuePath = path.join(this.storagePath, 'revenue', `${revenueId}.json`);
    
    try {
      const data = await fs.readFile(revenuePath, 'utf8');
      const loadedRevenueEntry = JSON.parse(data);
      
      // Cache revenue entry in memory
      this.revenueEntries.set(revenueId, loadedRevenueEntry);
      
      return loadedRevenueEntry;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Revenue entry ${revenueId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Get revenue entries for a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Array<Object>>} - Promise resolving to array of revenue entries
   */
  async getTransactionRevenue(transactionId) {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    const transactionRevenue = [];
    
    for (const revenueEntry of this.revenueEntries.values()) {
      if (revenueEntry.transactionId === transactionId) {
        transactionRevenue.push(revenueEntry);
      }
    }
    
    return transactionRevenue;
  }

  /**
   * Get developer revenue summary
   * @param {string} developerId - Developer ID
   * @returns {Promise<Object>} - Promise resolving to developer revenue summary
   */
  async getDeveloperRevenueSummary(developerId) {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    // Get developer revenue from memory
    const developerRevenue = this.developerRevenue.get(developerId);
    
    if (developerRevenue) {
      // Determine developer tier
      let developerTier = 'bronze';
      const tiers = Object.entries(this.revenueSharingConfig.tieredShare)
        .sort((a, b) => b[1].threshold - a[1].threshold);
      
      for (const [tier, config] of tiers) {
        if (developerRevenue.lifetimeRevenue >= config.threshold) {
          developerTier = tier;
          break;
        }
      }
      
      // Calculate next tier threshold
      let nextTierThreshold = null;
      let nextTier = null;
      
      for (const [tier, config] of Object.entries(this.revenueSharingConfig.tieredShare)) {
        if (config.threshold > developerRevenue.lifetimeRevenue && 
            (nextTierThreshold === null || config.threshold < nextTierThreshold)) {
          nextTierThreshold = config.threshold;
          nextTier = tier;
        }
      }
      
      // Create summary
      return {
        developerId,
        lifetimeRevenue: developerRevenue.lifetimeRevenue,
        availableBalance: developerRevenue.availableBalance,
        pendingBalance: developerRevenue.pendingBalance,
        paidBalance: developerRevenue.paidBalance,
        currency: developerRevenue.currency,
        currentTier: developerTier,
        currentShare: this.revenueSharingConfig.tieredShare[developerTier].developer,
        nextTier: nextTier,
        nextTierThreshold: nextTierThreshold,
        nextTierShare: nextTier ? this.revenueSharingConfig.tieredShare[nextTier].developer : null,
        amountToNextTier: nextTierThreshold ? nextTierThreshold - developerRevenue.lifetimeRevenue : null,
        lastPayout: developerRevenue.lastPayout,
        lastUpdated: developerRevenue.lastUpdated
      };
    }
    
    // Try to load developer revenue from file
    const developerPath = path.join(this.storagePath, 'developers', `${developerId}.json`);
    
    try {
      const data = await fs.readFile(developerPath, 'utf8');
      const loadedDeveloperRevenue = JSON.parse(data);
      
      // Cache developer revenue in memory
      this.developerRevenue.set(developerId, loadedDeveloperRevenue);
      
      // Recursively call this method to generate summary
      return this.getDeveloperRevenueSummary(developerId);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Developer has no revenue yet
        return {
          developerId,
          lifetimeRevenue: 0,
          availableBalance: 0,
          pendingBalance: 0,
          paidBalance: 0,
          currency: 'USD',
          currentTier: 'bronze',
          currentShare: this.revenueSharingConfig.tieredShare.bronze.developer,
          nextTier: 'silver',
          nextTierThreshold: this.revenueSharingConfig.tieredShare.silver.threshold,
          nextTierShare: this.revenueSharingConfig.tieredShare.silver.developer,
          amountToNextTier: this.revenueSharingConfig.tieredShare.silver.threshold,
          lastPayout: null,
          lastUpdated: null
        };
      }
      
      throw error;
    }
  }

  /**
   * Get marketplace revenue summary
   * @returns {Promise<Object>} - Promise resolving to marketplace revenue summary
   */
  async getMarketplaceRevenueSummary() {
    if (!this.initialized) {
      throw new Error('RevenueManager not initialized');
    }
    
    // Calculate totals
    let totalRevenue = 0;
    let platformRevenue = 0;
    let developerRevenue = 0;
    let pendingPayouts = 0;
    let completedPayouts = 0;
    
    for (const revenueEntry of this.revenueEntries.values()) {
      totalRevenue += revenueEntry.amount;
      platformRevenue += revenueEntry.platformAmount;
      developerRevenue += revenueEntry.developerAmount;
    }
    
    for (const revenue of this.developerRevenue.values()) {
      pendingPayouts += revenue.pendingBalance;
      completedPayouts += revenue.paidBalance;
    }
    
    // Create summary
    return {
      totalRevenue,
      platformRevenue,
      developerRevenue,
      pendingPayouts,
      completedPayouts,
      developerCount: this.developerRevenue.size,
      transactionCount: this.revenueEntries.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get the status of the revenue manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      revenueEntries: this.revenueEntries.size,
      developerRevenue: this.developerRevenue.size,
      payoutServiceAvailable: this.payoutService ? true : false
    };
  }

  /**
   * Shutdown the revenue manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('RevenueManager not initialized');
      return true;
    }
    
    this.logger.info('Shutting down RevenueManager');
    
    // Shutdown payout service
    if (this.payoutService && typeof this.payoutService.shutdown === 'function') {
      await this.payoutService.shutdown();
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { RevenueManager };
