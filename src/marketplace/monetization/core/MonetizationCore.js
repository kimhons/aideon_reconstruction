/**
 * @fileoverview Monetization Core for the Aideon Tentacle Marketplace
 * 
 * This module provides the core functionality for the monetization system,
 * coordinating payment processing, revenue management, and licensing.
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
 * MonetizationCore class - Main controller for the monetization system
 */
class MonetizationCore {
  /**
   * Create a new MonetizationCore instance
   * @param {Object} options - Configuration options
   * @param {Object} options.paymentProcessor - Reference to the payment processor
   * @param {Object} options.revenueManager - Reference to the revenue manager
   * @param {Object} options.pricingModelManager - Reference to the pricing model manager
   * @param {Object} options.licenseManager - Reference to the license manager
   * @param {Object} options.antiPiracySystem - Reference to the anti-piracy system
   * @param {string} options.storagePath - Path to store monetization data
   */
  constructor(options = {}) {
    this.options = options;
    this.paymentProcessor = options.paymentProcessor;
    this.revenueManager = options.revenueManager;
    this.pricingModelManager = options.pricingModelManager;
    this.licenseManager = options.licenseManager;
    this.antiPiracySystem = options.antiPiracySystem;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'monetization-data');
    this.logger = new Logger('MonetizationCore');
    this.events = new EventEmitter();
    this.transactions = new Map();
    this.initialized = false;
    
    // Define transaction statuses
    this.transactionStatuses = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REFUNDED: 'refunded',
      DISPUTED: 'disputed'
    };
    
    // Define pricing models
    this.pricingModels = {
      FREE: 'free',
      ONE_TIME: 'one_time',
      SUBSCRIPTION: 'subscription',
      GHOST_MODE: 'ghost_mode',
      RENTAL: 'rental'
    };
  }

  /**
   * Initialize the monetization core
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('MonetizationCore already initialized');
      return true;
    }

    this.logger.info('Initializing MonetizationCore');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'transactions'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'licenses'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'revenue'), { recursive: true });
      
      // Initialize payment processor if available
      if (this.paymentProcessor) {
        await this.paymentProcessor.initialize();
      } else {
        this.logger.warn('PaymentProcessor not provided, payment processing will be unavailable');
      }
      
      // Initialize revenue manager if available
      if (this.revenueManager) {
        await this.revenueManager.initialize();
      } else {
        this.logger.warn('RevenueManager not provided, revenue management will be unavailable');
      }
      
      // Initialize pricing model manager if available
      if (this.pricingModelManager) {
        await this.pricingModelManager.initialize();
      } else {
        this.logger.warn('PricingModelManager not provided, pricing model management will be unavailable');
      }
      
      // Initialize license manager if available
      if (this.licenseManager) {
        await this.licenseManager.initialize();
      } else {
        this.logger.warn('LicenseManager not provided, license management will be unavailable');
      }
      
      // Initialize anti-piracy system if available
      if (this.antiPiracySystem) {
        await this.antiPiracySystem.initialize();
      } else {
        this.logger.warn('AntiPiracySystem not provided, anti-piracy measures will be unavailable');
      }
      
      // Load existing transactions
      await this._loadTransactions();
      
      this.initialized = true;
      this.logger.info('MonetizationCore initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MonetizationCore', error);
      throw error;
    }
  }

  /**
   * Load existing transactions
   * @returns {Promise<void>}
   * @private
   */
  async _loadTransactions() {
    const transactionsDir = path.join(this.storagePath, 'transactions');
    
    try {
      const files = await fs.readdir(transactionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(transactionsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const transaction = JSON.parse(data);
            
            this.transactions.set(transaction.id, transaction);
          } catch (error) {
            this.logger.error(`Failed to load transaction from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.transactions.size} existing transactions`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load transactions', error);
      }
    }
  }

  /**
   * Save transaction to file
   * @param {string} transactionId - Transaction ID
   * @param {Object} transaction - Transaction data
   * @returns {Promise<void>}
   * @private
   */
  async _saveTransaction(transactionId, transaction) {
    const transactionPath = path.join(this.storagePath, 'transactions', `${transactionId}.json`);
    
    await fs.writeFile(transactionPath, JSON.stringify(transaction, null, 2));
  }

  /**
   * Create a new transaction
   * @param {Object} options - Transaction options
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.developerId - Developer ID
   * @param {string} options.pricingModel - Pricing model
   * @param {number} options.amount - Transaction amount
   * @param {string} options.currency - Transaction currency
   * @param {string} options.paymentMethod - Payment method
   * @returns {Promise<Object>} - Promise resolving to the created transaction
   */
  async createTransaction(options) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    this.logger.info(`Creating transaction for tentacle: ${options.tentacleId}, user: ${options.userId}`);
    
    if (!this.paymentProcessor) {
      throw new Error('PaymentProcessor not available');
    }
    
    try {
      // Generate transaction ID
      const transactionId = `txn_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create transaction object
      const transaction = {
        id: transactionId,
        userId: options.userId,
        tentacleId: options.tentacleId,
        developerId: options.developerId,
        pricingModel: options.pricingModel,
        amount: options.amount,
        currency: options.currency,
        paymentMethod: options.paymentMethod,
        status: this.transactionStatuses.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store transaction
      this.transactions.set(transactionId, transaction);
      
      // Save transaction to file
      await this._saveTransaction(transactionId, transaction);
      
      // Emit event
      this.events.emit('transaction:created', { transaction });
      
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to create transaction for tentacle: ${options.tentacleId}, user: ${options.userId}`, error);
      throw error;
    }
  }

  /**
   * Process a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} - Promise resolving to the processed transaction
   */
  async processTransaction(transactionId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    this.logger.info(`Processing transaction: ${transactionId}`);
    
    if (!this.paymentProcessor) {
      throw new Error('PaymentProcessor not available');
    }
    
    // Get transaction
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    // Check if transaction is already processed
    if (transaction.status !== this.transactionStatuses.PENDING) {
      this.logger.warn(`Transaction ${transactionId} is already processed with status: ${transaction.status}`);
      return transaction;
    }
    
    try {
      // Update transaction status
      transaction.status = this.transactionStatuses.PROCESSING;
      transaction.updatedAt = new Date().toISOString();
      
      // Save transaction to file
      await this._saveTransaction(transactionId, transaction);
      
      // Process payment
      const paymentResult = await this.paymentProcessor.processPayment({
        transactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethod: transaction.paymentMethod,
        metadata: {
          userId: transaction.userId,
          tentacleId: transaction.tentacleId,
          developerId: transaction.developerId,
          pricingModel: transaction.pricingModel
        }
      });
      
      // Update transaction with payment result
      transaction.paymentId = paymentResult.paymentId;
      transaction.status = paymentResult.success ? this.transactionStatuses.COMPLETED : this.transactionStatuses.FAILED;
      transaction.error = paymentResult.error;
      transaction.updatedAt = new Date().toISOString();
      
      // If payment was successful, handle revenue sharing and license generation
      if (paymentResult.success) {
        // Handle revenue sharing
        if (this.revenueManager) {
          const revenueResult = await this.revenueManager.processRevenue({
            transactionId,
            developerId: transaction.developerId,
            amount: transaction.amount,
            currency: transaction.currency,
            pricingModel: transaction.pricingModel
          });
          
          transaction.revenueId = revenueResult.revenueId;
        }
        
        // Generate license
        if (this.licenseManager) {
          const licenseResult = await this.licenseManager.generateLicense({
            transactionId,
            userId: transaction.userId,
            tentacleId: transaction.tentacleId,
            pricingModel: transaction.pricingModel
          });
          
          transaction.licenseId = licenseResult.licenseId;
        }
        
        // Apply anti-piracy measures
        if (this.antiPiracySystem) {
          await this.antiPiracySystem.protectLicense({
            transactionId,
            licenseId: transaction.licenseId,
            userId: transaction.userId,
            tentacleId: transaction.tentacleId
          });
        }
      }
      
      // Save updated transaction to file
      await this._saveTransaction(transactionId, transaction);
      
      // Emit event
      this.events.emit('transaction:processed', { transaction });
      
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to process transaction: ${transactionId}`, error);
      
      // Update transaction with error
      transaction.status = this.transactionStatuses.FAILED;
      transaction.error = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      // Save updated transaction to file
      await this._saveTransaction(transactionId, transaction);
      
      // Emit event
      this.events.emit('transaction:failed', { transaction, error });
      
      throw error;
    }
  }

  /**
   * Refund a transaction
   * @param {string} transactionId - Transaction ID
   * @param {Object} options - Refund options
   * @param {string} options.reason - Refund reason
   * @param {number} options.amount - Refund amount (defaults to full amount)
   * @returns {Promise<Object>} - Promise resolving to the refunded transaction
   */
  async refundTransaction(transactionId, options = {}) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    this.logger.info(`Refunding transaction: ${transactionId}`);
    
    if (!this.paymentProcessor) {
      throw new Error('PaymentProcessor not available');
    }
    
    // Get transaction
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    // Check if transaction can be refunded
    if (transaction.status !== this.transactionStatuses.COMPLETED) {
      throw new Error(`Transaction ${transactionId} cannot be refunded with status: ${transaction.status}`);
    }
    
    try {
      // Process refund
      const refundResult = await this.paymentProcessor.processRefund({
        transactionId,
        paymentId: transaction.paymentId,
        amount: options.amount || transaction.amount,
        reason: options.reason
      });
      
      // Update transaction with refund result
      transaction.status = this.transactionStatuses.REFUNDED;
      transaction.refundId = refundResult.refundId;
      transaction.refundReason = options.reason;
      transaction.refundAmount = options.amount || transaction.amount;
      transaction.updatedAt = new Date().toISOString();
      
      // Handle revenue adjustment
      if (this.revenueManager) {
        await this.revenueManager.adjustRevenue({
          transactionId,
          revenueId: transaction.revenueId,
          developerId: transaction.developerId,
          amount: -(options.amount || transaction.amount),
          currency: transaction.currency,
          reason: options.reason
        });
      }
      
      // Revoke license
      if (this.licenseManager && transaction.licenseId) {
        await this.licenseManager.revokeLicense({
          licenseId: transaction.licenseId,
          reason: options.reason
        });
      }
      
      // Save updated transaction to file
      await this._saveTransaction(transactionId, transaction);
      
      // Emit event
      this.events.emit('transaction:refunded', { transaction });
      
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to refund transaction: ${transactionId}`, error);
      throw error;
    }
  }

  /**
   * Get a transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} - Promise resolving to the transaction
   */
  async getTransaction(transactionId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    // Get transaction from memory
    const transaction = this.transactions.get(transactionId);
    
    if (transaction) {
      return transaction;
    }
    
    // Try to load transaction from file
    const transactionPath = path.join(this.storagePath, 'transactions', `${transactionId}.json`);
    
    try {
      const data = await fs.readFile(transactionPath, 'utf8');
      const loadedTransaction = JSON.parse(data);
      
      // Cache transaction in memory
      this.transactions.set(transactionId, loadedTransaction);
      
      return loadedTransaction;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Transaction ${transactionId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Get transactions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of transactions
   */
  async getUserTransactions(userId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const userTransactions = [];
    
    for (const transaction of this.transactions.values()) {
      if (transaction.userId === userId) {
        userTransactions.push(transaction);
      }
    }
    
    return userTransactions;
  }

  /**
   * Get transactions for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of transactions
   */
  async getTentacleTransactions(tentacleId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const tentacleTransactions = [];
    
    for (const transaction of this.transactions.values()) {
      if (transaction.tentacleId === tentacleId) {
        tentacleTransactions.push(transaction);
      }
    }
    
    return tentacleTransactions;
  }

  /**
   * Get transactions for a developer
   * @param {string} developerId - Developer ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of transactions
   */
  async getDeveloperTransactions(developerId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const developerTransactions = [];
    
    for (const transaction of this.transactions.values()) {
      if (transaction.developerId === developerId) {
        developerTransactions.push(transaction);
      }
    }
    
    return developerTransactions;
  }

  /**
   * Get revenue summary for a developer
   * @param {string} developerId - Developer ID
   * @returns {Promise<Object>} - Promise resolving to revenue summary
   */
  async getDeveloperRevenueSummary(developerId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    if (!this.revenueManager) {
      throw new Error('RevenueManager not available');
    }
    
    return this.revenueManager.getDeveloperRevenueSummary(developerId);
  }

  /**
   * Validate a license
   * @param {Object} options - License validation options
   * @param {string} options.licenseId - License ID
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {Object} options.deviceInfo - Device information for hardware binding
   * @returns {Promise<Object>} - Promise resolving to license validation result
   */
  async validateLicense(options) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    if (!this.licenseManager) {
      throw new Error('LicenseManager not available');
    }
    
    this.logger.info(`Validating license: ${options.licenseId}`);
    
    try {
      // Validate license
      const validationResult = await this.licenseManager.validateLicense({
        licenseId: options.licenseId,
        userId: options.userId,
        tentacleId: options.tentacleId,
        deviceInfo: options.deviceInfo
      });
      
      // Check for piracy if anti-piracy system is available
      if (this.antiPiracySystem && validationResult.valid) {
        const piracyCheck = await this.antiPiracySystem.checkLicense({
          licenseId: options.licenseId,
          userId: options.userId,
          tentacleId: options.tentacleId,
          deviceInfo: options.deviceInfo
        });
        
        if (!piracyCheck.valid) {
          validationResult.valid = false;
          validationResult.error = piracyCheck.error;
        }
      }
      
      return validationResult;
    } catch (error) {
      this.logger.error(`Failed to validate license: ${options.licenseId}`, error);
      
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get the status of the monetization core
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      transactions: this.transactions.size,
      componentsStatus: {
        paymentProcessor: this.paymentProcessor ? 'available' : 'unavailable',
        revenueManager: this.revenueManager ? 'available' : 'unavailable',
        pricingModelManager: this.pricingModelManager ? 'available' : 'unavailable',
        licenseManager: this.licenseManager ? 'available' : 'unavailable',
        antiPiracySystem: this.antiPiracySystem ? 'available' : 'unavailable'
      }
    };
  }

  /**
   * Shutdown the monetization core
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('MonetizationCore not initialized');
      return true;
    }
    
    this.logger.info('Shutting down MonetizationCore');
    
    // Shutdown components
    if (this.paymentProcessor && typeof this.paymentProcessor.shutdown === 'function') {
      await this.paymentProcessor.shutdown();
    }
    
    if (this.revenueManager && typeof this.revenueManager.shutdown === 'function') {
      await this.revenueManager.shutdown();
    }
    
    if (this.pricingModelManager && typeof this.pricingModelManager.shutdown === 'function') {
      await this.pricingModelManager.shutdown();
    }
    
    if (this.licenseManager && typeof this.licenseManager.shutdown === 'function') {
      await this.licenseManager.shutdown();
    }
    
    if (this.antiPiracySystem && typeof this.antiPiracySystem.shutdown === 'function') {
      await this.antiPiracySystem.shutdown();
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { MonetizationCore };
