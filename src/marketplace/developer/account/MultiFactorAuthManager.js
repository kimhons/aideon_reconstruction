/**
 * @fileoverview Multi-Factor Authentication Manager for the Aideon Developer Portal
 * 
 * This module provides functionality for managing multi-factor authentication
 * for developer accounts, including setup, verification, and recovery.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const crypto = require('crypto');
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');

/**
 * MultiFactorAuthManager class - Manages multi-factor authentication for developer accounts
 */
class MultiFactorAuthManager {
  /**
   * Create a new MultiFactorAuthManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.accountManager - Reference to the account manager
   * @param {Object} options.notificationService - Reference to the notification service
   * @param {Object} options.securitySettings - Security settings for MFA
   */
  constructor(options = {}) {
    this.options = options;
    this.accountManager = options.accountManager;
    this.notificationService = options.notificationService;
    this.securitySettings = options.securitySettings || {
      mfaRequired: true,
      mfaGracePeriodDays: 7,
      mfaRecoveryCodeCount: 10,
      mfaSessionDurationHours: 24,
      mfaRateLimitAttempts: 5,
      mfaRateLimitTimeWindowMinutes: 15
    };
    this.logger = new Logger('MultiFactorAuthManager');
    this.events = new EventEmitter();
    this.mfaSessions = new Map();
    this.rateLimitTracking = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the multi-factor authentication manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('MultiFactorAuthManager already initialized');
      return true;
    }

    this.logger.info('Initializing MultiFactorAuthManager');
    
    if (!this.accountManager) {
      throw new Error('AccountManager reference is required');
    }
    
    try {
      // Set up event listeners for account events
      this.accountManager.events.on('developer:created', this._handleDeveloperCreated.bind(this));
      
      this.initialized = true;
      this.logger.info('MultiFactorAuthManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MultiFactorAuthManager', error);
      throw error;
    }
  }

  /**
   * Handle developer created event
   * @param {Object} event - Developer created event
   * @private
   */
  async _handleDeveloperCreated(event) {
    const { account } = event;
    
    if (this.securitySettings.mfaRequired) {
      this.logger.info(`MFA required for new developer account: ${account.id}`);
      
      // Update account with MFA requirement
      await this.accountManager.updateDeveloperAccount(account.id, {
        securityProfile: {
          ...account.securityProfile,
          mfaRequired: true,
          mfaRequiredBy: this._calculateMfaRequiredByDate(),
          mfaEnabled: false
        }
      });
      
      // Notify developer about MFA requirement
      if (this.notificationService) {
        await this.notificationService.sendNotification(account.userId, {
          type: 'security',
          title: 'Multi-Factor Authentication Required',
          message: `Your developer account requires multi-factor authentication. Please set it up within ${this.securitySettings.mfaGracePeriodDays} days.`,
          action: 'setup_mfa',
          priority: 'high'
        });
      }
    }
  }

  /**
   * Calculate the date by which MFA must be set up
   * @returns {string} - ISO string date
   * @private
   */
  _calculateMfaRequiredByDate() {
    const date = new Date();
    date.setDate(date.getDate() + this.securitySettings.mfaGracePeriodDays);
    return date.toISOString();
  }

  /**
   * Generate a new TOTP secret for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to the generated secret and QR code
   */
  async generateTotpSecret(developerId) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    this.logger.info(`Generating TOTP secret for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Aideon Developer Portal:${account.metadata.email || developerId}`
    });
    
    // Generate QR code
    const qrCodeUrl = await new Promise((resolve, reject) => {
      qrcode.toDataURL(secret.otpauth_url, (error, dataUrl) => {
        if (error) {
          reject(error);
        } else {
          resolve(dataUrl);
        }
      });
    });
    
    // Store temporary secret in account
    await this.accountManager.updateDeveloperAccount(developerId, {
      securityProfile: {
        ...account.securityProfile,
        tempTotpSecret: secret.base32,
        tempTotpSecretCreatedAt: new Date().toISOString()
      }
    });
    
    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  }

  /**
   * Verify a TOTP token for a developer
   * @param {string} developerId - Developer account ID
   * @param {string} token - TOTP token to verify
   * @returns {Promise<boolean>} - Promise resolving to true if token is valid
   */
  async verifyTotpToken(developerId, token) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    this.logger.info(`Verifying TOTP token for developer: ${developerId}`);
    
    // Check rate limiting
    if (this._isRateLimited(developerId)) {
      throw new Error('Too many verification attempts. Please try again later.');
    }
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Determine which secret to use
    const secret = account.securityProfile.mfaEnabled ? 
      account.securityProfile.totpSecret : 
      account.securityProfile.tempTotpSecret;
    
    if (!secret) {
      throw new Error('No TOTP secret found for developer');
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 step before/after for clock drift
    });
    
    if (!verified) {
      // Track failed attempt
      this._trackFailedAttempt(developerId);
      return false;
    }
    
    // If verifying a temporary secret, activate MFA
    if (!account.securityProfile.mfaEnabled && account.securityProfile.tempTotpSecret) {
      // Generate recovery codes
      const recoveryCodes = this._generateRecoveryCodes();
      
      // Update account with MFA enabled
      await this.accountManager.updateDeveloperAccount(developerId, {
        securityProfile: {
          ...account.securityProfile,
          mfaEnabled: true,
          mfaEnabledAt: new Date().toISOString(),
          totpSecret: account.securityProfile.tempTotpSecret,
          tempTotpSecret: null,
          tempTotpSecretCreatedAt: null,
          recoveryCodes: recoveryCodes
        }
      });
      
      // Emit event
      this.events.emit('mfa:enabled', { developerId });
      
      // Return recovery codes with verification result
      return {
        verified: true,
        recoveryCodes: recoveryCodes
      };
    }
    
    // Create MFA session
    const sessionId = this._createMfaSession(developerId);
    
    return {
      verified: true,
      sessionId: sessionId
    };
  }

  /**
   * Check if a developer is rate limited for verification attempts
   * @param {string} developerId - Developer account ID
   * @returns {boolean} - True if rate limited
   * @private
   */
  _isRateLimited(developerId) {
    const tracking = this.rateLimitTracking.get(developerId);
    
    if (!tracking) {
      return false;
    }
    
    // Calculate time window
    const windowMs = this.securitySettings.mfaRateLimitTimeWindowMinutes * 60 * 1000;
    const windowStart = Date.now() - windowMs;
    
    // Filter attempts within time window
    const recentAttempts = tracking.attempts.filter(timestamp => timestamp > windowStart);
    
    // Update tracking with only recent attempts
    this.rateLimitTracking.set(developerId, {
      attempts: recentAttempts
    });
    
    // Check if number of attempts exceeds limit
    return recentAttempts.length >= this.securitySettings.mfaRateLimitAttempts;
  }

  /**
   * Track a failed verification attempt
   * @param {string} developerId - Developer account ID
   * @private
   */
  _trackFailedAttempt(developerId) {
    const tracking = this.rateLimitTracking.get(developerId) || { attempts: [] };
    
    tracking.attempts.push(Date.now());
    
    this.rateLimitTracking.set(developerId, tracking);
  }

  /**
   * Generate recovery codes for a developer
   * @returns {Array<string>} - Array of recovery codes
   * @private
   */
  _generateRecoveryCodes() {
    const codes = [];
    
    for (let i = 0; i < this.securitySettings.mfaRecoveryCodeCount; i++) {
      // Generate a code in format: XXXX-XXXX-XXXX (where X is alphanumeric)
      const code = [
        crypto.randomBytes(2).toString('hex').toUpperCase(),
        crypto.randomBytes(2).toString('hex').toUpperCase(),
        crypto.randomBytes(2).toString('hex').toUpperCase()
      ].join('-');
      
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Create an MFA session for a developer
   * @param {string} developerId - Developer account ID
   * @returns {string} - Session ID
   * @private
   */
  _createMfaSession(developerId) {
    const sessionId = `mfa_${crypto.randomBytes(16).toString('hex')}`;
    
    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.securitySettings.mfaSessionDurationHours);
    
    // Store session
    this.mfaSessions.set(sessionId, {
      developerId,
      createdAt: new Date(),
      expiresAt: expiresAt
    });
    
    return sessionId;
  }

  /**
   * Validate an MFA session
   * @param {string} sessionId - MFA session ID
   * @returns {Promise<Object>} - Promise resolving to the session if valid
   */
  async validateMfaSession(sessionId) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    const session = this.mfaSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Invalid MFA session');
    }
    
    // Check if session has expired
    if (new Date() > new Date(session.expiresAt)) {
      this.mfaSessions.delete(sessionId);
      throw new Error('MFA session has expired');
    }
    
    return session;
  }

  /**
   * Use a recovery code for a developer
   * @param {string} developerId - Developer account ID
   * @param {string} recoveryCode - Recovery code to use
   * @returns {Promise<boolean>} - Promise resolving to true if recovery code is valid
   */
  async useRecoveryCode(developerId, recoveryCode) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    this.logger.info(`Using recovery code for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    if (!account.securityProfile.mfaEnabled) {
      throw new Error('MFA is not enabled for this developer');
    }
    
    if (!account.securityProfile.recoveryCodes || account.securityProfile.recoveryCodes.length === 0) {
      throw new Error('No recovery codes available');
    }
    
    // Check if recovery code is valid
    const codeIndex = account.securityProfile.recoveryCodes.indexOf(recoveryCode);
    
    if (codeIndex === -1) {
      return false;
    }
    
    // Remove used recovery code
    const updatedCodes = [...account.securityProfile.recoveryCodes];
    updatedCodes.splice(codeIndex, 1);
    
    // Update account
    await this.accountManager.updateDeveloperAccount(developerId, {
      securityProfile: {
        ...account.securityProfile,
        recoveryCodes: updatedCodes,
        lastRecoveryUsed: new Date().toISOString()
      }
    });
    
    // Create MFA session
    const sessionId = this._createMfaSession(developerId);
    
    // Emit event
    this.events.emit('mfa:recovery_used', { developerId });
    
    return {
      verified: true,
      sessionId: sessionId,
      remainingCodes: updatedCodes.length
    };
  }

  /**
   * Disable MFA for a developer
   * @param {string} developerId - Developer account ID
   * @param {string} token - TOTP token to verify before disabling
   * @returns {Promise<boolean>} - Promise resolving to true if MFA was disabled
   */
  async disableMfa(developerId, token) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    this.logger.info(`Disabling MFA for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    if (!account.securityProfile.mfaEnabled) {
      throw new Error('MFA is not enabled for this developer');
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: account.securityProfile.totpSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });
    
    if (!verified) {
      throw new Error('Invalid verification token');
    }
    
    // Check if MFA is required
    if (this.securitySettings.mfaRequired) {
      throw new Error('MFA is required and cannot be disabled');
    }
    
    // Update account
    await this.accountManager.updateDeveloperAccount(developerId, {
      securityProfile: {
        ...account.securityProfile,
        mfaEnabled: false,
        mfaDisabledAt: new Date().toISOString(),
        totpSecret: null,
        recoveryCodes: null
      }
    });
    
    // Invalidate all MFA sessions for this developer
    for (const [sessionId, session] of this.mfaSessions.entries()) {
      if (session.developerId === developerId) {
        this.mfaSessions.delete(sessionId);
      }
    }
    
    // Emit event
    this.events.emit('mfa:disabled', { developerId });
    
    return true;
  }

  /**
   * Generate new recovery codes for a developer
   * @param {string} developerId - Developer account ID
   * @param {string} token - TOTP token to verify before generating new codes
   * @returns {Promise<Array<string>>} - Promise resolving to the new recovery codes
   */
  async regenerateRecoveryCodes(developerId, token) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    this.logger.info(`Regenerating recovery codes for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    if (!account.securityProfile.mfaEnabled) {
      throw new Error('MFA is not enabled for this developer');
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: account.securityProfile.totpSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });
    
    if (!verified) {
      throw new Error('Invalid verification token');
    }
    
    // Generate new recovery codes
    const recoveryCodes = this._generateRecoveryCodes();
    
    // Update account
    await this.accountManager.updateDeveloperAccount(developerId, {
      securityProfile: {
        ...account.securityProfile,
        recoveryCodes: recoveryCodes,
        recoveryCodesRegeneratedAt: new Date().toISOString()
      }
    });
    
    // Emit event
    this.events.emit('mfa:recovery_regenerated', { developerId });
    
    return recoveryCodes;
  }

  /**
   * Get MFA status for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to the MFA status
   */
  async getMfaStatus(developerId) {
    if (!this.initialized) {
      throw new Error('MultiFactorAuthManager not initialized');
    }
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    return {
      required: this.securitySettings.mfaRequired,
      enabled: account.securityProfile.mfaEnabled || false,
      requiredBy: account.securityProfile.mfaRequiredBy,
      enabledAt: account.securityProfile.mfaEnabledAt,
      recoveryCodesRemaining: account.securityProfile.recoveryCodes ? 
        account.securityProfile.recoveryCodes.length : 0,
      setupPending: !account.securityProfile.mfaEnabled && 
        account.securityProfile.tempTotpSecret ? true : false
    };
  }

  /**
   * Get the status of the multi-factor authentication manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeSessions: this.mfaSessions.size
    };
  }

  /**
   * Shutdown the multi-factor authentication manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('MultiFactorAuthManager not initialized');
      return true;
    }
    
    this.logger.info('Shutting down MultiFactorAuthManager');
    
    // Clear all sessions
    this.mfaSessions.clear();
    this.rateLimitTracking.clear();
    
    // Remove event listeners
    if (this.accountManager) {
      this.accountManager.events.removeAllListeners('developer:created');
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { MultiFactorAuthManager };
