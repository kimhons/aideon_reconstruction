/**
 * @fileoverview Payment Processor for the Aideon Tentacle Marketplace
 * 
 * This module provides payment processing functionality, integrating with
 * payment gateways like Stripe and PayPal.
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
 * PaymentProcessor class - Handles payment processing and gateway integration
 */
class PaymentProcessor {
  /**
   * Create a new PaymentProcessor instance
   * @param {Object} options - Configuration options
   * @param {Object} options.stripeConnector - Reference to the Stripe connector
   * @param {Object} options.paypalConnector - Reference to the PayPal connector
   * @param {string} options.storagePath - Path to store payment data
   * @param {string} options.defaultGateway - Default payment gateway to use
   */
  constructor(options = {}) {
    this.options = options;
    this.stripeConnector = options.stripeConnector;
    this.paypalConnector = options.paypalConnector;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'payment-data');
    this.defaultGateway = options.defaultGateway || 'stripe';
    this.logger = new Logger('PaymentProcessor');
    this.events = new EventEmitter();
    this.payments = new Map();
    this.initialized = false;
    
    // Define payment gateways
    this.paymentGateways = {
      STRIPE: 'stripe',
      PAYPAL: 'paypal'
    };
    
    // Define payment statuses
    this.paymentStatuses = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REFUNDED: 'refunded',
      DISPUTED: 'disputed'
    };
  }

  /**
   * Initialize the payment processor
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('PaymentProcessor already initialized');
      return true;
    }

    this.logger.info('Initializing PaymentProcessor');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'payments'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'refunds'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'disputes'), { recursive: true });
      
      // Initialize Stripe connector if available
      if (this.stripeConnector) {
        await this.stripeConnector.initialize();
      } else {
        this.logger.warn('StripeConnector not provided, Stripe payments will be unavailable');
      }
      
      // Initialize PayPal connector if available
      if (this.paypalConnector) {
        await this.paypalConnector.initialize();
      } else {
        this.logger.warn('PayPalConnector not provided, PayPal payments will be unavailable');
      }
      
      // Load existing payments
      await this._loadPayments();
      
      this.initialized = true;
      this.logger.info('PaymentProcessor initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize PaymentProcessor', error);
      throw error;
    }
  }

  /**
   * Load existing payments
   * @returns {Promise<void>}
   * @private
   */
  async _loadPayments() {
    const paymentsDir = path.join(this.storagePath, 'payments');
    
    try {
      const files = await fs.readdir(paymentsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(paymentsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const payment = JSON.parse(data);
            
            this.payments.set(payment.id, payment);
          } catch (error) {
            this.logger.error(`Failed to load payment from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.payments.size} existing payments`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load payments', error);
      }
    }
  }

  /**
   * Save payment to file
   * @param {string} paymentId - Payment ID
   * @param {Object} payment - Payment data
   * @returns {Promise<void>}
   * @private
   */
  async _savePayment(paymentId, payment) {
    const paymentPath = path.join(this.storagePath, 'payments', `${paymentId}.json`);
    
    await fs.writeFile(paymentPath, JSON.stringify(payment, null, 2));
  }

  /**
   * Get payment gateway connector
   * @param {string} gateway - Payment gateway name
   * @returns {Object} - Payment gateway connector
   * @private
   */
  _getGatewayConnector(gateway) {
    switch (gateway) {
      case this.paymentGateways.STRIPE:
        if (!this.stripeConnector) {
          throw new Error('Stripe connector not available');
        }
        return this.stripeConnector;
      case this.paymentGateways.PAYPAL:
        if (!this.paypalConnector) {
          throw new Error('PayPal connector not available');
        }
        return this.paypalConnector;
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  /**
   * Process a payment
   * @param {Object} options - Payment options
   * @param {string} options.transactionId - Transaction ID
   * @param {number} options.amount - Payment amount
   * @param {string} options.currency - Payment currency
   * @param {string} options.paymentMethod - Payment method
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - Promise resolving to payment result
   */
  async processPayment(options) {
    if (!this.initialized) {
      throw new Error('PaymentProcessor not initialized');
    }
    
    this.logger.info(`Processing payment for transaction: ${options.transactionId}`);
    
    try {
      // Generate payment ID
      const paymentId = `pay_${crypto.randomBytes(8).toString('hex')}`;
      
      // Determine payment gateway
      const gateway = options.paymentMethod === 'paypal' ? 
        this.paymentGateways.PAYPAL : this.paymentGateways.STRIPE;
      
      // Get gateway connector
      const gatewayConnector = this._getGatewayConnector(gateway);
      
      // Create payment object
      const payment = {
        id: paymentId,
        transactionId: options.transactionId,
        gateway,
        amount: options.amount,
        currency: options.currency,
        paymentMethod: options.paymentMethod,
        metadata: options.metadata,
        status: this.paymentStatuses.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store payment
      this.payments.set(paymentId, payment);
      
      // Save payment to file
      await this._savePayment(paymentId, payment);
      
      // Process payment with gateway
      const gatewayResult = await gatewayConnector.processPayment({
        paymentId,
        amount: options.amount,
        currency: options.currency,
        paymentMethod: options.paymentMethod,
        metadata: options.metadata
      });
      
      // Update payment with gateway result
      payment.gatewayPaymentId = gatewayResult.gatewayPaymentId;
      payment.status = gatewayResult.success ? 
        this.paymentStatuses.COMPLETED : this.paymentStatuses.FAILED;
      payment.error = gatewayResult.error;
      payment.updatedAt = new Date().toISOString();
      
      // Save updated payment to file
      await this._savePayment(paymentId, payment);
      
      // Emit event
      this.events.emit('payment:processed', { payment });
      
      return {
        success: gatewayResult.success,
        paymentId,
        gatewayPaymentId: gatewayResult.gatewayPaymentId,
        error: gatewayResult.error
      };
    } catch (error) {
      this.logger.error(`Failed to process payment for transaction: ${options.transactionId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process a refund
   * @param {Object} options - Refund options
   * @param {string} options.transactionId - Transaction ID
   * @param {string} options.paymentId - Payment ID
   * @param {number} options.amount - Refund amount
   * @param {string} options.reason - Refund reason
   * @returns {Promise<Object>} - Promise resolving to refund result
   */
  async processRefund(options) {
    if (!this.initialized) {
      throw new Error('PaymentProcessor not initialized');
    }
    
    this.logger.info(`Processing refund for payment: ${options.paymentId}`);
    
    try {
      // Get payment
      const payment = this.payments.get(options.paymentId);
      
      if (!payment) {
        throw new Error(`Payment ${options.paymentId} not found`);
      }
      
      // Check if payment can be refunded
      if (payment.status !== this.paymentStatuses.COMPLETED) {
        throw new Error(`Payment ${options.paymentId} cannot be refunded with status: ${payment.status}`);
      }
      
      // Generate refund ID
      const refundId = `ref_${crypto.randomBytes(8).toString('hex')}`;
      
      // Get gateway connector
      const gatewayConnector = this._getGatewayConnector(payment.gateway);
      
      // Process refund with gateway
      const gatewayResult = await gatewayConnector.processRefund({
        paymentId: options.paymentId,
        gatewayPaymentId: payment.gatewayPaymentId,
        amount: options.amount,
        reason: options.reason
      });
      
      // Update payment with refund information
      payment.status = this.paymentStatuses.REFUNDED;
      payment.refundId = refundId;
      payment.gatewayRefundId = gatewayResult.gatewayRefundId;
      payment.refundAmount = options.amount;
      payment.refundReason = options.reason;
      payment.updatedAt = new Date().toISOString();
      
      // Save updated payment to file
      await this._savePayment(options.paymentId, payment);
      
      // Save refund information
      const refundPath = path.join(this.storagePath, 'refunds', `${refundId}.json`);
      
      await fs.writeFile(refundPath, JSON.stringify({
        id: refundId,
        paymentId: options.paymentId,
        transactionId: options.transactionId,
        gatewayRefundId: gatewayResult.gatewayRefundId,
        amount: options.amount,
        reason: options.reason,
        createdAt: new Date().toISOString()
      }, null, 2));
      
      // Emit event
      this.events.emit('payment:refunded', { payment, refundId });
      
      return {
        success: true,
        refundId,
        gatewayRefundId: gatewayResult.gatewayRefundId
      };
    } catch (error) {
      this.logger.error(`Failed to process refund for payment: ${options.paymentId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle a payment dispute
   * @param {Object} options - Dispute options
   * @param {string} options.paymentId - Payment ID
   * @param {string} options.disputeId - Dispute ID
   * @param {string} options.reason - Dispute reason
   * @returns {Promise<Object>} - Promise resolving to dispute result
   */
  async handleDispute(options) {
    if (!this.initialized) {
      throw new Error('PaymentProcessor not initialized');
    }
    
    this.logger.info(`Handling dispute for payment: ${options.paymentId}`);
    
    try {
      // Get payment
      const payment = this.payments.get(options.paymentId);
      
      if (!payment) {
        throw new Error(`Payment ${options.paymentId} not found`);
      }
      
      // Update payment with dispute information
      payment.status = this.paymentStatuses.DISPUTED;
      payment.disputeId = options.disputeId;
      payment.disputeReason = options.reason;
      payment.updatedAt = new Date().toISOString();
      
      // Save updated payment to file
      await this._savePayment(options.paymentId, payment);
      
      // Save dispute information
      const disputePath = path.join(this.storagePath, 'disputes', `${options.disputeId}.json`);
      
      await fs.writeFile(disputePath, JSON.stringify({
        id: options.disputeId,
        paymentId: options.paymentId,
        transactionId: payment.transactionId,
        reason: options.reason,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, null, 2));
      
      // Emit event
      this.events.emit('payment:disputed', { payment, disputeId: options.disputeId });
      
      return {
        success: true,
        disputeId: options.disputeId
      };
    } catch (error) {
      this.logger.error(`Failed to handle dispute for payment: ${options.paymentId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a payment by ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} - Promise resolving to the payment
   */
  async getPayment(paymentId) {
    if (!this.initialized) {
      throw new Error('PaymentProcessor not initialized');
    }
    
    // Get payment from memory
    const payment = this.payments.get(paymentId);
    
    if (payment) {
      return payment;
    }
    
    // Try to load payment from file
    const paymentPath = path.join(this.storagePath, 'payments', `${paymentId}.json`);
    
    try {
      const data = await fs.readFile(paymentPath, 'utf8');
      const loadedPayment = JSON.parse(data);
      
      // Cache payment in memory
      this.payments.set(paymentId, loadedPayment);
      
      return loadedPayment;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Payment ${paymentId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Get payments for a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of payments
   */
  async getTransactionPayments(transactionId) {
    if (!this.initialized) {
      throw new Error('PaymentProcessor not initialized');
    }
    
    const transactionPayments = [];
    
    for (const payment of this.payments.values()) {
      if (payment.transactionId === transactionId) {
        transactionPayments.push(payment);
      }
    }
    
    return transactionPayments;
  }

  /**
   * Get the status of the payment processor
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      payments: this.payments.size,
      gatewaysStatus: {
        stripe: this.stripeConnector ? 'available' : 'unavailable',
        paypal: this.paypalConnector ? 'available' : 'unavailable'
      }
    };
  }

  /**
   * Shutdown the payment processor
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('PaymentProcessor not initialized');
      return true;
    }
    
    this.logger.info('Shutting down PaymentProcessor');
    
    // Shutdown connectors
    if (this.stripeConnector && typeof this.stripeConnector.shutdown === 'function') {
      await this.stripeConnector.shutdown();
    }
    
    if (this.paypalConnector && typeof this.paypalConnector.shutdown === 'function') {
      await this.paypalConnector.shutdown();
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { PaymentProcessor };
