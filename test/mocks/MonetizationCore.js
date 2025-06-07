/**
 * @fileoverview Mock MonetizationCore for testing
 */

const { EventEmitter } = require('../../src/core/events/EventEmitter');

class MonetizationCore {
  constructor(options = {}) {
    this.options = options;
    this.events = new EventEmitter();
    this.initialized = false;
    this.licenses = new Map();
    this.subscriptions = new Map();
    this.transactions = [];
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async shutdown() {
    this.initialized = false;
    return true;
  }

  async processPurchase(options) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const transaction = {
      id: `txn-${Date.now()}`,
      tentacleId: options.tentacleId,
      amount: options.amount,
      currency: options.currency || 'USD',
      timestamp: new Date().toISOString(),
      status: 'completed',
      paymentMethod: options.paymentMethod || 'credit_card'
    };
    
    this.transactions.push(transaction);
    this.events.emit('purchase:completed', { transaction });
    
    return {
      success: true,
      transactionId: transaction.id,
      message: 'Purchase completed successfully'
    };
  }

  async activateLicense(licenseKey, options = {}) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const license = {
      id: `license-${Date.now()}`,
      licenseKey,
      tentacleId: options.tentacleId || 'unknown',
      activationDate: new Date().toISOString(),
      expirationDate: options.expirationDate || null,
      status: 'active'
    };
    
    this.licenses.set(license.id, license);
    this.events.emit('license:activated', { licenseId: license.id });
    
    return {
      success: true,
      licenseId: license.id,
      message: 'License activated successfully'
    };
  }

  async deactivateLicense(licenseId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const license = this.licenses.get(licenseId);
    if (!license) {
      return {
        success: false,
        message: 'License not found'
      };
    }
    
    license.status = 'inactive';
    this.events.emit('license:deactivated', { licenseId });
    
    return {
      success: true,
      licenseId,
      message: 'License deactivated successfully'
    };
  }

  async createSubscription(options) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const subscription = {
      id: `sub-${Date.now()}`,
      tentacleId: options.tentacleId,
      userId: options.userId,
      startDate: new Date().toISOString(),
      nextBillingDate: options.nextBillingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      amount: options.amount,
      interval: options.interval || 'monthly',
      status: 'active'
    };
    
    this.subscriptions.set(subscription.id, subscription);
    this.events.emit('subscription:created', { subscriptionId: subscription.id });
    
    return {
      success: true,
      subscriptionId: subscription.id,
      message: 'Subscription created successfully'
    };
  }

  async cancelSubscription(subscriptionId) {
    if (!this.initialized) {
      throw new Error('MonetizationCore not initialized');
    }
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return {
        success: false,
        message: 'Subscription not found'
      };
    }
    
    subscription.status = 'cancelled';
    subscription.cancellationDate = new Date().toISOString();
    this.events.emit('subscription:cancelled', { subscriptionId });
    
    return {
      success: true,
      subscriptionId,
      message: 'Subscription cancelled successfully'
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      licenseCount: this.licenses.size,
      subscriptionCount: this.subscriptions.size,
      transactionCount: this.transactions.length
    };
  }
}

module.exports = { MonetizationCore };
