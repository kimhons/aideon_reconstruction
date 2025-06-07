/**
 * @fileoverview Stripe Connector for the Aideon Tentacle Marketplace
 * 
 * This module provides integration with the Stripe payment gateway,
 * handling payment processing, refunds, and subscription management.
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
 * Mock Stripe API client for development and testing
 * In production, this would be replaced with the actual Stripe SDK
 */
class MockStripeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.payments = new Map();
    this.refunds = new Map();
    this.subscriptions = new Map();
    this.customers = new Map();
  }

  async createPaymentIntent(options) {
    const id = `pi_${crypto.randomBytes(8).toString('hex')}`;
    const paymentIntent = {
      id,
      amount: options.amount,
      currency: options.currency,
      status: 'succeeded',
      created: Date.now(),
      metadata: options.metadata || {}
    };
    
    this.payments.set(id, paymentIntent);
    
    return paymentIntent;
  }

  async createRefund(options) {
    const id = `re_${crypto.randomBytes(8).toString('hex')}`;
    const refund = {
      id,
      payment_intent: options.payment_intent,
      amount: options.amount,
      status: 'succeeded',
      created: Date.now(),
      reason: options.reason || 'requested_by_customer'
    };
    
    this.refunds.set(id, refund);
    
    return refund;
  }

  async createCustomer(options) {
    const id = `cus_${crypto.randomBytes(8).toString('hex')}`;
    const customer = {
      id,
      email: options.email,
      name: options.name,
      created: Date.now(),
      metadata: options.metadata || {}
    };
    
    this.customers.set(id, customer);
    
    return customer;
  }

  async createSubscription(options) {
    const id = `sub_${crypto.randomBytes(8).toString('hex')}`;
    const subscription = {
      id,
      customer: options.customer,
      status: 'active',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      metadata: options.metadata || {}
    };
    
    this.subscriptions.set(id, subscription);
    
    return subscription;
  }

  async cancelSubscription(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    subscription.status = 'canceled';
    subscription.canceled_at = Date.now();
    
    return subscription;
  }
}

/**
 * StripeConnector class - Integrates with Stripe payment gateway
 */
class StripeConnector {
  /**
   * Create a new StripeConnector instance
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - Stripe API key
   * @param {string} options.webhookSecret - Stripe webhook secret
   * @param {string} options.storagePath - Path to store Stripe data
   */
  constructor(options = {}) {
    this.options = options;
    this.apiKey = options.apiKey || process.env.STRIPE_API_KEY || 'sk_test_mock';
    this.webhookSecret = options.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock';
    this.storagePath = options.storagePath || path.join(process.cwd(), 'stripe-data');
    this.logger = new Logger('StripeConnector');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // In production, this would be the actual Stripe SDK
    // this.stripe = require('stripe')(this.apiKey);
    this.stripe = new MockStripeClient(this.apiKey);
    
    // Define payment statuses
    this.paymentStatuses = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REFUNDED: 'refunded'
    };
  }

  /**
   * Initialize the Stripe connector
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('StripeConnector already initialized');
      return true;
    }

    this.logger.info('Initializing StripeConnector');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'payments'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'refunds'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'customers'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'subscriptions'), { recursive: true });
      
      this.initialized = true;
      this.logger.info('StripeConnector initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize StripeConnector', error);
      throw error;
    }
  }

  /**
   * Save payment data to file
   * @param {string} paymentId - Payment ID
   * @param {Object} paymentData - Payment data
   * @returns {Promise<void>}
   * @private
   */
  async _savePaymentData(paymentId, paymentData) {
    const paymentPath = path.join(this.storagePath, 'payments', `${paymentId}.json`);
    
    await fs.writeFile(paymentPath, JSON.stringify(paymentData, null, 2));
  }

  /**
   * Process a payment
   * @param {Object} options - Payment options
   * @param {string} options.paymentId - Payment ID
   * @param {number} options.amount - Payment amount
   * @param {string} options.currency - Payment currency
   * @param {string} options.paymentMethod - Payment method
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - Promise resolving to payment result
   */
  async processPayment(options) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    this.logger.info(`Processing Stripe payment: ${options.paymentId}`);
    
    try {
      // Create payment intent
      const paymentIntent = await this.stripe.createPaymentIntent({
        amount: Math.round(options.amount * 100), // Convert to cents
        currency: options.currency.toLowerCase(),
        metadata: {
          paymentId: options.paymentId,
          ...options.metadata
        }
      });
      
      // Create payment data
      const paymentData = {
        id: options.paymentId,
        gatewayPaymentId: paymentIntent.id,
        amount: options.amount,
        currency: options.currency,
        status: this.paymentStatuses.COMPLETED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: options.metadata
      };
      
      // Save payment data
      await this._savePaymentData(options.paymentId, paymentData);
      
      // Emit event
      this.events.emit('payment:processed', { paymentData });
      
      return {
        success: true,
        gatewayPaymentId: paymentIntent.id
      };
    } catch (error) {
      this.logger.error(`Failed to process Stripe payment: ${options.paymentId}`, error);
      
      // Save failed payment data
      const paymentData = {
        id: options.paymentId,
        amount: options.amount,
        currency: options.currency,
        status: this.paymentStatuses.FAILED,
        error: error.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: options.metadata
      };
      
      await this._savePaymentData(options.paymentId, paymentData);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process a refund
   * @param {Object} options - Refund options
   * @param {string} options.paymentId - Payment ID
   * @param {string} options.gatewayPaymentId - Gateway payment ID
   * @param {number} options.amount - Refund amount
   * @param {string} options.reason - Refund reason
   * @returns {Promise<Object>} - Promise resolving to refund result
   */
  async processRefund(options) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    this.logger.info(`Processing Stripe refund for payment: ${options.paymentId}`);
    
    try {
      // Create refund
      const refund = await this.stripe.createRefund({
        payment_intent: options.gatewayPaymentId,
        amount: Math.round(options.amount * 100), // Convert to cents
        reason: options.reason || 'requested_by_customer',
        metadata: {
          paymentId: options.paymentId
        }
      });
      
      // Save refund data
      const refundPath = path.join(this.storagePath, 'refunds', `${refund.id}.json`);
      
      await fs.writeFile(refundPath, JSON.stringify({
        id: refund.id,
        paymentId: options.paymentId,
        gatewayPaymentId: options.gatewayPaymentId,
        amount: options.amount,
        reason: options.reason,
        createdAt: new Date().toISOString()
      }, null, 2));
      
      // Update payment data
      const paymentPath = path.join(this.storagePath, 'payments', `${options.paymentId}.json`);
      
      try {
        const paymentDataStr = await fs.readFile(paymentPath, 'utf8');
        const paymentData = JSON.parse(paymentDataStr);
        
        paymentData.status = this.paymentStatuses.REFUNDED;
        paymentData.refundId = refund.id;
        paymentData.refundAmount = options.amount;
        paymentData.refundReason = options.reason;
        paymentData.updatedAt = new Date().toISOString();
        
        await fs.writeFile(paymentPath, JSON.stringify(paymentData, null, 2));
      } catch (error) {
        this.logger.error(`Failed to update payment data for refund: ${options.paymentId}`, error);
      }
      
      // Emit event
      this.events.emit('payment:refunded', { refundId: refund.id, paymentId: options.paymentId });
      
      return {
        success: true,
        gatewayRefundId: refund.id
      };
    } catch (error) {
      this.logger.error(`Failed to process Stripe refund for payment: ${options.paymentId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a customer
   * @param {Object} options - Customer options
   * @param {string} options.userId - User ID
   * @param {string} options.email - Customer email
   * @param {string} options.name - Customer name
   * @returns {Promise<Object>} - Promise resolving to customer result
   */
  async createCustomer(options) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    this.logger.info(`Creating Stripe customer for user: ${options.userId}`);
    
    try {
      // Create customer
      const customer = await this.stripe.createCustomer({
        email: options.email,
        name: options.name,
        metadata: {
          userId: options.userId
        }
      });
      
      // Save customer data
      const customerPath = path.join(this.storagePath, 'customers', `${options.userId}.json`);
      
      await fs.writeFile(customerPath, JSON.stringify({
        userId: options.userId,
        gatewayCustomerId: customer.id,
        email: options.email,
        name: options.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, null, 2));
      
      // Emit event
      this.events.emit('customer:created', { userId: options.userId, gatewayCustomerId: customer.id });
      
      return {
        success: true,
        gatewayCustomerId: customer.id
      };
    } catch (error) {
      this.logger.error(`Failed to create Stripe customer for user: ${options.userId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get customer by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Promise resolving to customer data
   */
  async getCustomer(userId) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    try {
      // Load customer data
      const customerPath = path.join(this.storagePath, 'customers', `${userId}.json`);
      const customerDataStr = await fs.readFile(customerPath, 'utf8');
      
      return JSON.parse(customerDataStr);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Create a subscription
   * @param {Object} options - Subscription options
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {number} options.amount - Subscription amount
   * @param {string} options.currency - Subscription currency
   * @param {string} options.interval - Subscription interval (month, year)
   * @returns {Promise<Object>} - Promise resolving to subscription result
   */
  async createSubscription(options) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    this.logger.info(`Creating Stripe subscription for user: ${options.userId}, tentacle: ${options.tentacleId}`);
    
    try {
      // Get or create customer
      let customer = await this.getCustomer(options.userId);
      
      if (!customer) {
        // Get user details from options or fetch from user service
        const userDetails = {
          userId: options.userId,
          email: options.email || `user_${options.userId}@example.com`,
          name: options.name || `User ${options.userId}`
        };
        
        const customerResult = await this.createCustomer(userDetails);
        
        if (!customerResult.success) {
          throw new Error(`Failed to create customer: ${customerResult.error}`);
        }
        
        customer = await this.getCustomer(options.userId);
      }
      
      // Create subscription
      const subscription = await this.stripe.createSubscription({
        customer: customer.gatewayCustomerId,
        items: [
          {
            price_data: {
              currency: options.currency.toLowerCase(),
              product_data: {
                name: `Tentacle ${options.tentacleId} Subscription`,
                metadata: {
                  tentacleId: options.tentacleId
                }
              },
              unit_amount: Math.round(options.amount * 100), // Convert to cents
              recurring: {
                interval: options.interval || 'month'
              }
            }
          }
        ],
        metadata: {
          userId: options.userId,
          tentacleId: options.tentacleId
        }
      });
      
      // Save subscription data
      const subscriptionId = `sub_${crypto.randomBytes(8).toString('hex')}`;
      const subscriptionPath = path.join(this.storagePath, 'subscriptions', `${subscriptionId}.json`);
      
      const subscriptionData = {
        id: subscriptionId,
        userId: options.userId,
        tentacleId: options.tentacleId,
        gatewaySubscriptionId: subscription.id,
        amount: options.amount,
        currency: options.currency,
        interval: options.interval || 'month',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
      };
      
      await fs.writeFile(subscriptionPath, JSON.stringify(subscriptionData, null, 2));
      
      // Emit event
      this.events.emit('subscription:created', { subscriptionData });
      
      return {
        success: true,
        subscriptionId,
        gatewaySubscriptionId: subscription.id,
        currentPeriodEnd: subscriptionData.currentPeriodEnd
      };
    } catch (error) {
      this.logger.error(`Failed to create Stripe subscription for user: ${options.userId}, tentacle: ${options.tentacleId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel a subscription
   * @param {Object} options - Cancellation options
   * @param {string} options.subscriptionId - Subscription ID
   * @param {string} options.gatewaySubscriptionId - Gateway subscription ID
   * @returns {Promise<Object>} - Promise resolving to cancellation result
   */
  async cancelSubscription(options) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    this.logger.info(`Canceling Stripe subscription: ${options.subscriptionId}`);
    
    try {
      // Cancel subscription
      await this.stripe.cancelSubscription(options.gatewaySubscriptionId);
      
      // Update subscription data
      const subscriptionPath = path.join(this.storagePath, 'subscriptions', `${options.subscriptionId}.json`);
      
      try {
        const subscriptionDataStr = await fs.readFile(subscriptionPath, 'utf8');
        const subscriptionData = JSON.parse(subscriptionDataStr);
        
        subscriptionData.status = 'canceled';
        subscriptionData.canceledAt = new Date().toISOString();
        subscriptionData.updatedAt = new Date().toISOString();
        
        await fs.writeFile(subscriptionPath, JSON.stringify(subscriptionData, null, 2));
      } catch (error) {
        this.logger.error(`Failed to update subscription data for cancellation: ${options.subscriptionId}`, error);
      }
      
      // Emit event
      this.events.emit('subscription:canceled', { subscriptionId: options.subscriptionId });
      
      return {
        success: true
      };
    } catch (error) {
      this.logger.error(`Failed to cancel Stripe subscription: ${options.subscriptionId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle webhook event
   * @param {Object} event - Webhook event
   * @returns {Promise<Object>} - Promise resolving to webhook handling result
   */
  async handleWebhook(event) {
    if (!this.initialized) {
      throw new Error('StripeConnector not initialized');
    }
    
    this.logger.info(`Handling Stripe webhook event: ${event.type}`);
    
    try {
      // In production, verify webhook signature
      // const signature = request.headers['stripe-signature'];
      // const event = this.stripe.webhooks.constructEvent(request.body, signature, this.webhookSecret);
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this._handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this._handlePaymentFailed(event.data.object);
          break;
        case 'charge.refunded':
          await this._handleRefund(event.data.object);
          break;
        case 'customer.subscription.created':
          await this._handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this._handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this._handleSubscriptionDeleted(event.data.object);
          break;
        default:
          this.logger.info(`Unhandled webhook event type: ${event.type}`);
      }
      
      return {
        success: true
      };
    } catch (error) {
      this.logger.error(`Failed to handle Stripe webhook event: ${event.type}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle payment succeeded webhook event
   * @param {Object} paymentIntent - Payment intent object
   * @returns {Promise<void>}
   * @private
   */
  async _handlePaymentSucceeded(paymentIntent) {
    const paymentId = paymentIntent.metadata.paymentId;
    
    if (!paymentId) {
      this.logger.warn('Payment intent has no paymentId in metadata');
      return;
    }
    
    try {
      const paymentPath = path.join(this.storagePath, 'payments', `${paymentId}.json`);
      
      try {
        const paymentDataStr = await fs.readFile(paymentPath, 'utf8');
        const paymentData = JSON.parse(paymentDataStr);
        
        paymentData.status = this.paymentStatuses.COMPLETED;
        paymentData.updatedAt = new Date().toISOString();
        
        await fs.writeFile(paymentPath, JSON.stringify(paymentData, null, 2));
        
        // Emit event
        this.events.emit('payment:succeeded', { paymentId });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.error(`Failed to update payment data for succeeded payment: ${paymentId}`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle payment succeeded webhook for payment: ${paymentId}`, error);
    }
  }

  /**
   * Handle payment failed webhook event
   * @param {Object} paymentIntent - Payment intent object
   * @returns {Promise<void>}
   * @private
   */
  async _handlePaymentFailed(paymentIntent) {
    const paymentId = paymentIntent.metadata.paymentId;
    
    if (!paymentId) {
      this.logger.warn('Payment intent has no paymentId in metadata');
      return;
    }
    
    try {
      const paymentPath = path.join(this.storagePath, 'payments', `${paymentId}.json`);
      
      try {
        const paymentDataStr = await fs.readFile(paymentPath, 'utf8');
        const paymentData = JSON.parse(paymentDataStr);
        
        paymentData.status = this.paymentStatuses.FAILED;
        paymentData.error = paymentIntent.last_payment_error?.message || 'Payment failed';
        paymentData.updatedAt = new Date().toISOString();
        
        await fs.writeFile(paymentPath, JSON.stringify(paymentData, null, 2));
        
        // Emit event
        this.events.emit('payment:failed', { paymentId, error: paymentData.error });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.error(`Failed to update payment data for failed payment: ${paymentId}`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle payment failed webhook for payment: ${paymentId}`, error);
    }
  }

  /**
   * Handle refund webhook event
   * @param {Object} charge - Charge object
   * @returns {Promise<void>}
   * @private
   */
  async _handleRefund(charge) {
    // In a real implementation, we would look up the payment by the charge ID
    // For this mock implementation, we'll just log the event
    this.logger.info(`Received refund webhook for charge: ${charge.id}`);
  }

  /**
   * Handle subscription created webhook event
   * @param {Object} subscription - Subscription object
   * @returns {Promise<void>}
   * @private
   */
  async _handleSubscriptionCreated(subscription) {
    // In a real implementation, we would look up the subscription by the subscription ID
    // For this mock implementation, we'll just log the event
    this.logger.info(`Received subscription created webhook for subscription: ${subscription.id}`);
  }

  /**
   * Handle subscription updated webhook event
   * @param {Object} subscription - Subscription object
   * @returns {Promise<void>}
   * @private
   */
  async _handleSubscriptionUpdated(subscription) {
    // In a real implementation, we would look up the subscription by the subscription ID
    // For this mock implementation, we'll just log the event
    this.logger.info(`Received subscription updated webhook for subscription: ${subscription.id}`);
  }

  /**
   * Handle subscription deleted webhook event
   * @param {Object} subscription - Subscription object
   * @returns {Promise<void>}
   * @private
   */
  async _handleSubscriptionDeleted(subscription) {
    // In a real implementation, we would look up the subscription by the subscription ID
    // For this mock implementation, we'll just log the event
    this.logger.info(`Received subscription deleted webhook for subscription: ${subscription.id}`);
  }

  /**
   * Get the status of the Stripe connector
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      apiKeyConfigured: !!this.apiKey,
      webhookSecretConfigured: !!this.webhookSecret
    };
  }

  /**
   * Shutdown the Stripe connector
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('StripeConnector not initialized');
      return true;
    }
    
    this.logger.info('Shutting down StripeConnector');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { StripeConnector };
