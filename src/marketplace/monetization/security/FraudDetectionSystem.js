/**
 * @fileoverview Fraud Detection System for the Aideon Tentacle Marketplace
 * 
 * This module provides fraud detection capabilities to identify and prevent
 * fraudulent activities in the marketplace.
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
 * FraudDetectionSystem class - Detects and prevents fraudulent activities
 */
class FraudDetectionSystem {
  /**
   * Create a new FraudDetectionSystem instance
   * @param {Object} options - Configuration options
   * @param {Object} options.paymentProcessor - Reference to the payment processor
   * @param {Object} options.revenueManager - Reference to the revenue manager
   * @param {string} options.storagePath - Path to store fraud detection data
   */
  constructor(options = {}) {
    this.options = options;
    this.paymentProcessor = options.paymentProcessor;
    this.revenueManager = options.revenueManager;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'fraud-data');
    this.logger = new Logger('FraudDetectionSystem');
    this.events = new EventEmitter();
    this.fraudCases = new Map();
    this.suspiciousActivities = new Map();
    this.blockedEntities = new Map();
    this.riskScores = new Map();
    this.initialized = false;
    
    // Define fraud types
    this.fraudTypes = {
      PAYMENT: 'payment_fraud',
      CHARGEBACK: 'chargeback',
      ACCOUNT: 'account_fraud',
      PIRACY: 'piracy',
      ABUSE: 'system_abuse',
      MONEY_LAUNDERING: 'money_laundering'
    };
    
    // Define risk levels
    this.riskLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    };
  }

  /**
   * Initialize the fraud detection system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('FraudDetectionSystem already initialized');
      return true;
    }

    this.logger.info('Initializing FraudDetectionSystem');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'cases'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'activities'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'blocked'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'risk'), { recursive: true });
      
      // Load existing fraud cases
      await this._loadFraudCases();
      
      // Load suspicious activities
      await this._loadSuspiciousActivities();
      
      // Load blocked entities
      await this._loadBlockedEntities();
      
      // Load risk scores
      await this._loadRiskScores();
      
      // Register event listeners
      this._registerEventListeners();
      
      this.initialized = true;
      this.logger.info('FraudDetectionSystem initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize FraudDetectionSystem', error);
      throw error;
    }
  }

  /**
   * Load existing fraud cases
   * @returns {Promise<void>}
   * @private
   */
  async _loadFraudCases() {
    const casesDir = path.join(this.storagePath, 'cases');
    
    try {
      const files = await fs.readdir(casesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(casesDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const fraudCase = JSON.parse(data);
            
            this.fraudCases.set(fraudCase.id, fraudCase);
          } catch (error) {
            this.logger.error(`Failed to load fraud case from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.fraudCases.size} existing fraud cases`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load fraud cases', error);
      }
    }
  }

  /**
   * Load suspicious activities
   * @returns {Promise<void>}
   * @private
   */
  async _loadSuspiciousActivities() {
    const activitiesDir = path.join(this.storagePath, 'activities');
    
    try {
      const files = await fs.readdir(activitiesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(activitiesDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const activity = JSON.parse(data);
            
            this.suspiciousActivities.set(activity.id, activity);
          } catch (error) {
            this.logger.error(`Failed to load suspicious activity from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.suspiciousActivities.size} suspicious activities`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load suspicious activities', error);
      }
    }
  }

  /**
   * Load blocked entities
   * @returns {Promise<void>}
   * @private
   */
  async _loadBlockedEntities() {
    const blockedDir = path.join(this.storagePath, 'blocked');
    
    try {
      const files = await fs.readdir(blockedDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(blockedDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const entity = JSON.parse(data);
            
            this.blockedEntities.set(entity.id, entity);
          } catch (error) {
            this.logger.error(`Failed to load blocked entity from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.blockedEntities.size} blocked entities`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load blocked entities', error);
      }
    }
  }

  /**
   * Load risk scores
   * @returns {Promise<void>}
   * @private
   */
  async _loadRiskScores() {
    const riskDir = path.join(this.storagePath, 'risk');
    
    try {
      const files = await fs.readdir(riskDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(riskDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const risk = JSON.parse(data);
            
            this.riskScores.set(risk.entityId, risk);
          } catch (error) {
            this.logger.error(`Failed to load risk score from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.riskScores.size} risk scores`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load risk scores', error);
      }
    }
  }

  /**
   * Register event listeners
   * @private
   */
  _registerEventListeners() {
    // Listen for payment events if payment processor is available
    if (this.paymentProcessor) {
      this.paymentProcessor.events.on('payment:created', this._handlePaymentCreated.bind(this));
      this.paymentProcessor.events.on('payment:succeeded', this._handlePaymentSucceeded.bind(this));
      this.paymentProcessor.events.on('payment:failed', this._handlePaymentFailed.bind(this));
      this.paymentProcessor.events.on('payment:refunded', this._handlePaymentRefunded.bind(this));
      this.paymentProcessor.events.on('payment:disputed', this._handlePaymentDisputed.bind(this));
    }
    
    // Listen for revenue events if revenue manager is available
    if (this.revenueManager) {
      this.revenueManager.events.on('revenue:entry:created', this._handleRevenueEntryCreated.bind(this));
      this.revenueManager.events.on('revenue:payout:created', this._handleRevenuePayoutCreated.bind(this));
    }
  }

  /**
   * Handle payment created event
   * @param {Object} event - Payment created event
   * @private
   */
  async _handlePaymentCreated(event) {
    try {
      // Check for suspicious payment patterns
      await this._checkPaymentRisk(event.payment);
    } catch (error) {
      this.logger.error('Error handling payment created event', error);
    }
  }

  /**
   * Handle payment succeeded event
   * @param {Object} event - Payment succeeded event
   * @private
   */
  async _handlePaymentSucceeded(event) {
    try {
      // Update risk score based on successful payment
      await this._updateRiskScore(event.payment.userId, -5);
    } catch (error) {
      this.logger.error('Error handling payment succeeded event', error);
    }
  }

  /**
   * Handle payment failed event
   * @param {Object} event - Payment failed event
   * @private
   */
  async _handlePaymentFailed(event) {
    try {
      // Update risk score based on failed payment
      await this._updateRiskScore(event.payment.userId, 10);
      
      // Check for multiple failed payments
      const failedPayments = await this._countFailedPayments(event.payment.userId);
      
      if (failedPayments >= 3) {
        await this._createSuspiciousActivity({
          entityType: 'user',
          entityId: event.payment.userId,
          activityType: 'multiple_failed_payments',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            failedCount: failedPayments,
            latestPaymentId: event.payment.id
          }
        });
      }
    } catch (error) {
      this.logger.error('Error handling payment failed event', error);
    }
  }

  /**
   * Handle payment refunded event
   * @param {Object} event - Payment refunded event
   * @private
   */
  async _handlePaymentRefunded(event) {
    try {
      // Update risk score based on refunded payment
      await this._updateRiskScore(event.payment.userId, 5);
      
      // Check for multiple refunds
      const refundedPayments = await this._countRefundedPayments(event.payment.userId);
      
      if (refundedPayments >= 2) {
        await this._createSuspiciousActivity({
          entityType: 'user',
          entityId: event.payment.userId,
          activityType: 'multiple_refunds',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            refundCount: refundedPayments,
            latestPaymentId: event.payment.id
          }
        });
      }
    } catch (error) {
      this.logger.error('Error handling payment refunded event', error);
    }
  }

  /**
   * Handle payment disputed event
   * @param {Object} event - Payment disputed event
   * @private
   */
  async _handlePaymentDisputed(event) {
    try {
      // Update risk score based on disputed payment
      await this._updateRiskScore(event.payment.userId, 20);
      
      // Create suspicious activity for disputed payment
      await this._createSuspiciousActivity({
        entityType: 'user',
        entityId: event.payment.userId,
        activityType: 'payment_dispute',
        riskLevel: this.riskLevels.HIGH,
        data: {
          paymentId: event.payment.id,
          amount: event.payment.amount,
          currency: event.payment.currency,
          disputeReason: event.dispute.reason
        }
      });
      
      // Check for multiple disputes
      const disputedPayments = await this._countDisputedPayments(event.payment.userId);
      
      if (disputedPayments >= 2) {
        // Create fraud case for multiple disputes
        await this.createFraudCase({
          fraudType: this.fraudTypes.CHARGEBACK,
          entityType: 'user',
          entityId: event.payment.userId,
          riskLevel: this.riskLevels.HIGH,
          description: `Multiple payment disputes (${disputedPayments}) detected`,
          evidence: {
            disputeCount: disputedPayments,
            latestDisputeId: event.dispute.id,
            latestPaymentId: event.payment.id
          }
        });
      }
    } catch (error) {
      this.logger.error('Error handling payment disputed event', error);
    }
  }

  /**
   * Handle revenue entry created event
   * @param {Object} event - Revenue entry created event
   * @private
   */
  async _handleRevenueEntryCreated(event) {
    try {
      // Check for suspicious revenue patterns
      await this._checkRevenueRisk(event.entry);
    } catch (error) {
      this.logger.error('Error handling revenue entry created event', error);
    }
  }

  /**
   * Handle revenue payout created event
   * @param {Object} event - Revenue payout created event
   * @private
   */
  async _handleRevenuePayoutCreated(event) {
    try {
      // Check for suspicious payout patterns
      await this._checkPayoutRisk(event.payout);
    } catch (error) {
      this.logger.error('Error handling revenue payout created event', error);
    }
  }

  /**
   * Check payment risk
   * @param {Object} payment - Payment data
   * @returns {Promise<void>}
   * @private
   */
  async _checkPaymentRisk(payment) {
    try {
      // Check for high-value transactions
      if (payment.amount >= 1000) {
        await this._createSuspiciousActivity({
          entityType: 'user',
          entityId: payment.userId,
          activityType: 'high_value_transaction',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency
          }
        });
      }
      
      // Check for rapid successive transactions
      const recentPayments = await this._countRecentPayments(payment.userId, 3600); // 1 hour
      
      if (recentPayments >= 5) {
        await this._createSuspiciousActivity({
          entityType: 'user',
          entityId: payment.userId,
          activityType: 'rapid_transactions',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            paymentCount: recentPayments,
            timeframeSeconds: 3600,
            latestPaymentId: payment.id
          }
        });
      }
      
      // Check for unusual payment methods or locations
      // This would require additional data in a real implementation
    } catch (error) {
      this.logger.error('Error checking payment risk', error);
    }
  }

  /**
   * Check revenue risk
   * @param {Object} entry - Revenue entry data
   * @returns {Promise<void>}
   * @private
   */
  async _checkRevenueRisk(entry) {
    try {
      // Check for unusual revenue spikes
      const averageRevenue = await this._calculateAverageRevenue(entry.developerId, 30); // 30 days
      
      if (entry.amount > averageRevenue * 5 && averageRevenue > 0) {
        await this._createSuspiciousActivity({
          entityType: 'developer',
          entityId: entry.developerId,
          activityType: 'unusual_revenue_spike',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            entryId: entry.id,
            amount: entry.amount,
            averageAmount: averageRevenue,
            ratio: entry.amount / averageRevenue
          }
        });
      }
      
      // Check for unusual tentacle revenue patterns
      const tentacleAverageRevenue = await this._calculateTentacleAverageRevenue(entry.tentacleId, 30); // 30 days
      
      if (entry.amount > tentacleAverageRevenue * 10 && tentacleAverageRevenue > 0) {
        await this._createSuspiciousActivity({
          entityType: 'tentacle',
          entityId: entry.tentacleId,
          activityType: 'unusual_tentacle_revenue',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            entryId: entry.id,
            amount: entry.amount,
            averageAmount: tentacleAverageRevenue,
            ratio: entry.amount / tentacleAverageRevenue
          }
        });
      }
    } catch (error) {
      this.logger.error('Error checking revenue risk', error);
    }
  }

  /**
   * Check payout risk
   * @param {Object} payout - Payout data
   * @returns {Promise<void>}
   * @private
   */
  async _checkPayoutRisk(payout) {
    try {
      // Check for unusual payout amounts
      const averagePayout = await this._calculateAveragePayout(payout.developerId, 90); // 90 days
      
      if (payout.amount > averagePayout * 3 && averagePayout > 0) {
        await this._createSuspiciousActivity({
          entityType: 'developer',
          entityId: payout.developerId,
          activityType: 'unusual_payout_amount',
          riskLevel: this.riskLevels.MEDIUM,
          data: {
            payoutId: payout.id,
            amount: payout.amount,
            averageAmount: averagePayout,
            ratio: payout.amount / averagePayout
          }
        });
      }
      
      // Check for changes in payout destination
      const previousPayouts = await this._getPreviousPayouts(payout.developerId, 5);
      
      if (previousPayouts.length > 0) {
        const previousDestination = previousPayouts[0].destination;
        
        if (payout.destination !== previousDestination) {
          await this._createSuspiciousActivity({
            entityType: 'developer',
            entityId: payout.developerId,
            activityType: 'changed_payout_destination',
            riskLevel: this.riskLevels.MEDIUM,
            data: {
              payoutId: payout.id,
              newDestination: payout.destination,
              previousDestination
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('Error checking payout risk', error);
    }
  }

  /**
   * Count failed payments for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Promise resolving to the count of failed payments
   * @private
   */
  async _countFailedPayments(userId) {
    // In a real implementation, this would query the payment processor
    // For this mock implementation, we'll return a random number
    return Math.floor(Math.random() * 5);
  }

  /**
   * Count refunded payments for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Promise resolving to the count of refunded payments
   * @private
   */
  async _countRefundedPayments(userId) {
    // In a real implementation, this would query the payment processor
    // For this mock implementation, we'll return a random number
    return Math.floor(Math.random() * 3);
  }

  /**
   * Count disputed payments for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Promise resolving to the count of disputed payments
   * @private
   */
  async _countDisputedPayments(userId) {
    // In a real implementation, this would query the payment processor
    // For this mock implementation, we'll return a random number
    return Math.floor(Math.random() * 2);
  }

  /**
   * Count recent payments for a user
   * @param {string} userId - User ID
   * @param {number} timeframeSeconds - Timeframe in seconds
   * @returns {Promise<number>} - Promise resolving to the count of recent payments
   * @private
   */
  async _countRecentPayments(userId, timeframeSeconds) {
    // In a real implementation, this would query the payment processor
    // For this mock implementation, we'll return a random number
    return Math.floor(Math.random() * 10);
  }

  /**
   * Calculate average revenue for a developer
   * @param {string} developerId - Developer ID
   * @param {number} days - Number of days to consider
   * @returns {Promise<number>} - Promise resolving to the average revenue
   * @private
   */
  async _calculateAverageRevenue(developerId, days) {
    // In a real implementation, this would query the revenue manager
    // For this mock implementation, we'll return a random number
    return Math.random() * 1000;
  }

  /**
   * Calculate average revenue for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @param {number} days - Number of days to consider
   * @returns {Promise<number>} - Promise resolving to the average revenue
   * @private
   */
  async _calculateTentacleAverageRevenue(tentacleId, days) {
    // In a real implementation, this would query the revenue manager
    // For this mock implementation, we'll return a random number
    return Math.random() * 500;
  }

  /**
   * Calculate average payout for a developer
   * @param {string} developerId - Developer ID
   * @param {number} days - Number of days to consider
   * @returns {Promise<number>} - Promise resolving to the average payout
   * @private
   */
  async _calculateAveragePayout(developerId, days) {
    // In a real implementation, this would query the revenue manager
    // For this mock implementation, we'll return a random number
    return Math.random() * 2000;
  }

  /**
   * Get previous payouts for a developer
   * @param {string} developerId - Developer ID
   * @param {number} count - Number of payouts to retrieve
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of payouts
   * @private
   */
  async _getPreviousPayouts(developerId, count) {
    // In a real implementation, this would query the revenue manager
    // For this mock implementation, we'll return an empty array
    return [];
  }

  /**
   * Create a suspicious activity
   * @param {Object} options - Suspicious activity options
   * @param {string} options.entityType - Entity type (user, developer, tentacle)
   * @param {string} options.entityId - Entity ID
   * @param {string} options.activityType - Activity type
   * @param {string} options.riskLevel - Risk level
   * @param {Object} options.data - Additional data
   * @returns {Promise<Object>} - Promise resolving to the created activity
   * @private
   */
  async _createSuspiciousActivity(options) {
    try {
      // Generate activity ID
      const activityId = `act_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create activity
      const activity = {
        id: activityId,
        entityType: options.entityType,
        entityId: options.entityId,
        activityType: options.activityType,
        riskLevel: options.riskLevel,
        data: options.data,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store activity
      this.suspiciousActivities.set(activityId, activity);
      
      // Save activity to file
      const activityPath = path.join(this.storagePath, 'activities', `${activityId}.json`);
      await fs.writeFile(activityPath, JSON.stringify(activity, null, 2));
      
      // Update risk score
      let riskIncrement;
      switch (options.riskLevel) {
        case this.riskLevels.LOW:
          riskIncrement = 5;
          break;
        case this.riskLevels.MEDIUM:
          riskIncrement = 15;
          break;
        case this.riskLevels.HIGH:
          riskIncrement = 30;
          break;
        case this.riskLevels.CRITICAL:
          riskIncrement = 50;
          break;
        default:
          riskIncrement = 10;
      }
      
      await this._updateRiskScore(options.entityId, riskIncrement);
      
      // Emit event
      this.events.emit('activity:created', { activity });
      
      return activity;
    } catch (error) {
      this.logger.error('Failed to create suspicious activity', error);
      throw error;
    }
  }

  /**
   * Update risk score for an entity
   * @param {string} entityId - Entity ID
   * @param {number} increment - Risk score increment
   * @returns {Promise<Object>} - Promise resolving to the updated risk score
   * @private
   */
  async _updateRiskScore(entityId, increment) {
    try {
      // Get existing risk score
      let risk = this.riskScores.get(entityId);
      
      if (!risk) {
        // Create new risk score
        risk = {
          entityId,
          score: 0,
          level: this.riskLevels.LOW,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      
      // Update score
      risk.score = Math.max(0, risk.score + increment);
      risk.updatedAt = new Date().toISOString();
      
      // Determine risk level
      if (risk.score >= 100) {
        risk.level = this.riskLevels.CRITICAL;
      } else if (risk.score >= 70) {
        risk.level = this.riskLevels.HIGH;
      } else if (risk.score >= 40) {
        risk.level = this.riskLevels.MEDIUM;
      } else {
        risk.level = this.riskLevels.LOW;
      }
      
      // Store risk score
      this.riskScores.set(entityId, risk);
      
      // Save risk score to file
      const riskPath = path.join(this.storagePath, 'risk', `${entityId}.json`);
      await fs.writeFile(riskPath, JSON.stringify(risk, null, 2));
      
      // Check if entity should be blocked
      if (risk.score >= 100) {
        await this._blockEntity({
          entityId,
          reason: 'High risk score',
          riskScore: risk.score
        });
      }
      
      return risk;
    } catch (error) {
      this.logger.error(`Failed to update risk score for entity: ${entityId}`, error);
      throw error;
    }
  }

  /**
   * Block an entity
   * @param {Object} options - Block options
   * @param {string} options.entityId - Entity ID
   * @param {string} options.reason - Block reason
   * @param {number} options.riskScore - Risk score
   * @returns {Promise<Object>} - Promise resolving to the blocked entity
   * @private
   */
  async _blockEntity(options) {
    try {
      // Check if entity is already blocked
      if (this.blockedEntities.has(options.entityId)) {
        return this.blockedEntities.get(options.entityId);
      }
      
      // Create blocked entity
      const blocked = {
        id: options.entityId,
        reason: options.reason,
        riskScore: options.riskScore,
        createdAt: new Date().toISOString()
      };
      
      // Store blocked entity
      this.blockedEntities.set(options.entityId, blocked);
      
      // Save blocked entity to file
      const blockedPath = path.join(this.storagePath, 'blocked', `${options.entityId}.json`);
      await fs.writeFile(blockedPath, JSON.stringify(blocked, null, 2));
      
      // Emit event
      this.events.emit('entity:blocked', { blocked });
      
      return blocked;
    } catch (error) {
      this.logger.error(`Failed to block entity: ${options.entityId}`, error);
      throw error;
    }
  }

  /**
   * Create a fraud case
   * @param {Object} options - Fraud case options
   * @param {string} options.fraudType - Fraud type
   * @param {string} options.entityType - Entity type
   * @param {string} options.entityId - Entity ID
   * @param {string} options.riskLevel - Risk level
   * @param {string} options.description - Description
   * @param {Object} options.evidence - Evidence data
   * @returns {Promise<Object>} - Promise resolving to the created fraud case
   */
  async createFraudCase(options) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    this.logger.info(`Creating fraud case for ${options.entityType}: ${options.entityId}`);
    
    try {
      // Validate fraud type
      if (!Object.values(this.fraudTypes).includes(options.fraudType)) {
        throw new Error(`Invalid fraud type: ${options.fraudType}`);
      }
      
      // Validate risk level
      if (!Object.values(this.riskLevels).includes(options.riskLevel)) {
        throw new Error(`Invalid risk level: ${options.riskLevel}`);
      }
      
      // Generate case ID
      const caseId = `case_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create fraud case
      const fraudCase = {
        id: caseId,
        fraudType: options.fraudType,
        entityType: options.entityType,
        entityId: options.entityId,
        riskLevel: options.riskLevel,
        description: options.description,
        evidence: options.evidence,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store fraud case
      this.fraudCases.set(caseId, fraudCase);
      
      // Save fraud case to file
      const casePath = path.join(this.storagePath, 'cases', `${caseId}.json`);
      await fs.writeFile(casePath, JSON.stringify(fraudCase, null, 2));
      
      // Update risk score
      let riskIncrement;
      switch (options.riskLevel) {
        case this.riskLevels.LOW:
          riskIncrement = 10;
          break;
        case this.riskLevels.MEDIUM:
          riskIncrement = 30;
          break;
        case this.riskLevels.HIGH:
          riskIncrement = 60;
          break;
        case this.riskLevels.CRITICAL:
          riskIncrement = 100;
          break;
        default:
          riskIncrement = 20;
      }
      
      await this._updateRiskScore(options.entityId, riskIncrement);
      
      // Emit event
      this.events.emit('fraud:detected', { fraudCase });
      
      return {
        success: true,
        caseId,
        fraudCase
      };
    } catch (error) {
      this.logger.error(`Failed to create fraud case for ${options.entityType}: ${options.entityId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update a fraud case
   * @param {Object} options - Update options
   * @param {string} options.caseId - Case ID
   * @param {string} options.status - New status
   * @param {string} options.notes - Notes
   * @returns {Promise<Object>} - Promise resolving to the updated fraud case
   */
  async updateFraudCase(options) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    this.logger.info(`Updating fraud case: ${options.caseId}`);
    
    try {
      // Get fraud case
      const fraudCase = this.fraudCases.get(options.caseId);
      
      if (!fraudCase) {
        throw new Error(`Fraud case ${options.caseId} not found`);
      }
      
      // Update fraud case
      if (options.status) {
        fraudCase.status = options.status;
      }
      
      if (options.notes) {
        fraudCase.notes = options.notes;
      }
      
      fraudCase.updatedAt = new Date().toISOString();
      
      // Save fraud case to file
      const casePath = path.join(this.storagePath, 'cases', `${options.caseId}.json`);
      await fs.writeFile(casePath, JSON.stringify(fraudCase, null, 2));
      
      // Emit event
      this.events.emit('fraud:updated', { fraudCase });
      
      return {
        success: true,
        fraudCase
      };
    } catch (error) {
      this.logger.error(`Failed to update fraud case: ${options.caseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a fraud case by ID
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} - Promise resolving to the fraud case
   */
  async getFraudCase(caseId) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    // Get fraud case from memory
    const fraudCase = this.fraudCases.get(caseId);
    
    if (fraudCase) {
      return fraudCase;
    }
    
    // Try to load fraud case from file
    const casePath = path.join(this.storagePath, 'cases', `${caseId}.json`);
    
    try {
      const data = await fs.readFile(casePath, 'utf8');
      const loadedCase = JSON.parse(data);
      
      // Cache fraud case in memory
      this.fraudCases.set(caseId, loadedCase);
      
      return loadedCase;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Get fraud cases for an entity
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of fraud cases
   */
  async getEntityFraudCases(entityId) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    const entityCases = [];
    
    for (const fraudCase of this.fraudCases.values()) {
      if (fraudCase.entityId === entityId) {
        entityCases.push(fraudCase);
      }
    }
    
    return entityCases;
  }

  /**
   * Get risk score for an entity
   * @param {string} entityId - Entity ID
   * @returns {Promise<Object>} - Promise resolving to the risk score
   */
  async getRiskScore(entityId) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    // Get risk score from memory
    const risk = this.riskScores.get(entityId);
    
    if (risk) {
      return risk;
    }
    
    // Try to load risk score from file
    const riskPath = path.join(this.storagePath, 'risk', `${entityId}.json`);
    
    try {
      const data = await fs.readFile(riskPath, 'utf8');
      const loadedRisk = JSON.parse(data);
      
      // Cache risk score in memory
      this.riskScores.set(entityId, loadedRisk);
      
      return loadedRisk;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Return default risk score
        return {
          entityId,
          score: 0,
          level: this.riskLevels.LOW,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      
      throw error;
    }
  }

  /**
   * Check if an entity is blocked
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} - Promise resolving to true if entity is blocked
   */
  async isEntityBlocked(entityId) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    return this.blockedEntities.has(entityId);
  }

  /**
   * Get suspicious activities for an entity
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of suspicious activities
   */
  async getEntityActivities(entityId) {
    if (!this.initialized) {
      throw new Error('FraudDetectionSystem not initialized');
    }
    
    const entityActivities = [];
    
    for (const activity of this.suspiciousActivities.values()) {
      if (activity.entityId === entityId) {
        entityActivities.push(activity);
      }
    }
    
    return entityActivities;
  }

  /**
   * Get the status of the fraud detection system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      fraudCases: this.fraudCases.size,
      suspiciousActivities: this.suspiciousActivities.size,
      blockedEntities: this.blockedEntities.size,
      riskScores: this.riskScores.size,
      paymentProcessorAvailable: this.paymentProcessor ? true : false,
      revenueManagerAvailable: this.revenueManager ? true : false
    };
  }

  /**
   * Shutdown the fraud detection system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('FraudDetectionSystem not initialized');
      return true;
    }
    
    this.logger.info('Shutting down FraudDetectionSystem');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { FraudDetectionSystem };
