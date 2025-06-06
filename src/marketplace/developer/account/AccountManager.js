/**
 * @fileoverview Account Manager for the Aideon Developer Portal
 * 
 * This module provides functionality for managing developer accounts,
 * including creation, authentication, and API key management.
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
 * AccountManager class - Manages developer accounts for the Developer Portal
 */
class AccountManager {
  /**
   * Create a new AccountManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.authService - Reference to the authentication service
   * @param {string} options.storagePath - Path to store account data
   * @param {Object} options.securitySettings - Security settings for account management
   */
  constructor(options = {}) {
    this.options = options;
    this.authService = options.authService;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'developer-accounts');
    this.securitySettings = options.securitySettings || {
      developerVettingLevel: 'standard',
      identityVerificationRequired: true,
      apiKeyExpirationDays: 90,
      maxApiKeysPerDeveloper: 5
    };
    this.logger = new Logger('AccountManager');
    this.events = new EventEmitter();
    this.accounts = new Map();
    this.apiKeys = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the account manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('AccountManager already initialized');
      return true;
    }

    this.logger.info('Initializing AccountManager');
    
    if (!this.authService) {
      throw new Error('AuthService reference is required');
    }
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Load accounts from storage
      await this._loadAccounts();
      
      // Load API keys from storage
      await this._loadApiKeys();
      
      this.initialized = true;
      this.logger.info('AccountManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize AccountManager', error);
      throw error;
    }
  }

  /**
   * Load accounts from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadAccounts() {
    try {
      const accountsFile = path.join(this.storagePath, 'accounts.json');
      
      // Check if file exists
      try {
        await fs.access(accountsFile);
      } catch (error) {
        // File doesn't exist, create empty accounts file
        await fs.writeFile(accountsFile, JSON.stringify([]));
        return;
      }
      
      // Read accounts from file
      const data = await fs.readFile(accountsFile, 'utf8');
      const accounts = JSON.parse(data);
      
      // Populate accounts map
      accounts.forEach(account => {
        this.accounts.set(account.id, account);
      });
      
      this.logger.info(`Loaded ${accounts.length} developer accounts`);
    } catch (error) {
      this.logger.error('Failed to load accounts', error);
      throw error;
    }
  }

  /**
   * Save accounts to storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveAccounts() {
    try {
      const accountsFile = path.join(this.storagePath, 'accounts.json');
      const accounts = Array.from(this.accounts.values());
      
      await fs.writeFile(accountsFile, JSON.stringify(accounts, null, 2));
      
      this.logger.info(`Saved ${accounts.length} developer accounts`);
    } catch (error) {
      this.logger.error('Failed to save accounts', error);
      throw error;
    }
  }

  /**
   * Load API keys from storage
   * @returns {Promise<void>}
   * @private
   */
  async _loadApiKeys() {
    try {
      const apiKeysFile = path.join(this.storagePath, 'api_keys.json');
      
      // Check if file exists
      try {
        await fs.access(apiKeysFile);
      } catch (error) {
        // File doesn't exist, create empty API keys file
        await fs.writeFile(apiKeysFile, JSON.stringify([]));
        return;
      }
      
      // Read API keys from file
      const data = await fs.readFile(apiKeysFile, 'utf8');
      const apiKeys = JSON.parse(data);
      
      // Populate API keys map
      apiKeys.forEach(apiKey => {
        this.apiKeys.set(apiKey.id, apiKey);
      });
      
      this.logger.info(`Loaded ${apiKeys.length} API keys`);
    } catch (error) {
      this.logger.error('Failed to load API keys', error);
      throw error;
    }
  }

  /**
   * Save API keys to storage
   * @returns {Promise<void>}
   * @private
   */
  async _saveApiKeys() {
    try {
      const apiKeysFile = path.join(this.storagePath, 'api_keys.json');
      const apiKeys = Array.from(this.apiKeys.values());
      
      await fs.writeFile(apiKeysFile, JSON.stringify(apiKeys, null, 2));
      
      this.logger.info(`Saved ${apiKeys.length} API keys`);
    } catch (error) {
      this.logger.error('Failed to save API keys', error);
      throw error;
    }
  }

  /**
   * Create a new developer account
   * @param {string} userId - User ID from the authentication service
   * @param {Object} metadata - Developer metadata
   * @returns {Promise<Object>} - Promise resolving to the created developer account
   */
  async createDeveloperAccount(userId, metadata = {}) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    this.logger.info(`Creating developer account for user: ${userId}`);
    
    // Verify user exists in auth service
    const user = await this.authService.getUser(userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Check if user already has a developer account
    const existingAccount = Array.from(this.accounts.values())
      .find(account => account.userId === userId);
    
    if (existingAccount) {
      throw new Error(`User ${userId} already has a developer account`);
    }
    
    // Determine vetting status based on security settings
    let vettingStatus = 'pending';
    
    if (this.securitySettings.developerVettingLevel === 'basic') {
      vettingStatus = 'approved';
    } else if (this.securitySettings.developerVettingLevel === 'standard') {
      vettingStatus = this.securitySettings.identityVerificationRequired ? 
        'pending_verification' : 'approved';
    } else if (this.securitySettings.developerVettingLevel === 'enhanced') {
      vettingStatus = 'pending_review';
    }
    
    // Create developer account
    const account = {
      id: `dev_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      metadata: {
        name: user.name || 'Unknown Developer',
        email: user.email || 'unknown@example.com',
        ...metadata
      },
      vettingStatus,
      securityProfile: {
        identityVerified: false,
        trustScore: 0,
        riskLevel: 'unknown',
        lastReviewDate: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store account
    this.accounts.set(account.id, account);
    await this._saveAccounts();
    
    // Emit event
    this.events.emit('developer:created', { account });
    
    return account;
  }

  /**
   * Get a developer account by ID
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to the developer account
   */
  async getDeveloperAccount(developerId) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    const account = this.accounts.get(developerId);
    
    if (!account) {
      throw new Error(`Developer account ${developerId} not found`);
    }
    
    return account;
  }

  /**
   * Get a developer account by user ID
   * @param {string} userId - User ID from the authentication service
   * @returns {Promise<Object>} - Promise resolving to the developer account
   */
  async getDeveloperAccountByUserId(userId) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    const account = Array.from(this.accounts.values())
      .find(account => account.userId === userId);
    
    if (!account) {
      throw new Error(`Developer account for user ${userId} not found`);
    }
    
    return account;
  }

  /**
   * Update a developer account
   * @param {string} developerId - Developer account ID
   * @param {Object} updates - Updates to apply to the account
   * @returns {Promise<Object>} - Promise resolving to the updated developer account
   */
  async updateDeveloperAccount(developerId, updates = {}) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    this.logger.info(`Updating developer account: ${developerId}`);
    
    const account = this.accounts.get(developerId);
    
    if (!account) {
      throw new Error(`Developer account ${developerId} not found`);
    }
    
    // Apply updates
    const updatedAccount = {
      ...account,
      metadata: {
        ...account.metadata,
        ...(updates.metadata || {})
      },
      vettingStatus: updates.vettingStatus || account.vettingStatus,
      securityProfile: {
        ...account.securityProfile,
        ...(updates.securityProfile || {})
      },
      updatedAt: new Date().toISOString()
    };
    
    // Store updated account
    this.accounts.set(developerId, updatedAccount);
    await this._saveAccounts();
    
    // Emit event
    this.events.emit('developer:updated', { 
      account: updatedAccount,
      previousAccount: account
    });
    
    return updatedAccount;
  }

  /**
   * Delete a developer account
   * @param {string} developerId - Developer account ID
   * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
   */
  async deleteDeveloperAccount(developerId) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    this.logger.info(`Deleting developer account: ${developerId}`);
    
    const account = this.accounts.get(developerId);
    
    if (!account) {
      throw new Error(`Developer account ${developerId} not found`);
    }
    
    // Delete account
    this.accounts.delete(developerId);
    await this._saveAccounts();
    
    // Delete associated API keys
    const developerApiKeys = Array.from(this.apiKeys.values())
      .filter(apiKey => apiKey.developerId === developerId);
    
    for (const apiKey of developerApiKeys) {
      this.apiKeys.delete(apiKey.id);
    }
    
    await this._saveApiKeys();
    
    // Emit event
    this.events.emit('developer:deleted', { account });
    
    return true;
  }

  /**
   * Generate a new API key for a developer
   * @param {string} developerId - Developer account ID
   * @param {Object} options - API key options
   * @returns {Promise<Object>} - Promise resolving to the generated API key
   */
  async generateApiKey(developerId, options = {}) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    this.logger.info(`Generating API key for developer: ${developerId}`);
    
    const account = this.accounts.get(developerId);
    
    if (!account) {
      throw new Error(`Developer account ${developerId} not found`);
    }
    
    // Check if developer is approved
    if (account.vettingStatus !== 'approved') {
      throw new Error(`Developer ${developerId} is not approved for API key generation`);
    }
    
    // Check if developer has reached the maximum number of API keys
    const developerApiKeys = Array.from(this.apiKeys.values())
      .filter(apiKey => apiKey.developerId === developerId && !apiKey.revoked);
    
    if (developerApiKeys.length >= this.securitySettings.maxApiKeysPerDeveloper) {
      throw new Error(`Developer ${developerId} has reached the maximum number of API keys`);
    }
    
    // Generate API key
    const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
    const keySecret = crypto.randomBytes(32).toString('base64');
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.securitySettings.apiKeyExpirationDays);
    
    // Create API key record
    const apiKey = {
      id: keyId,
      developerId,
      name: options.name || `API Key ${developerApiKeys.length + 1}`,
      permissions: options.permissions || ['read', 'write'],
      revoked: false,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    };
    
    // Store API key
    this.apiKeys.set(keyId, apiKey);
    await this._saveApiKeys();
    
    // Emit event
    this.events.emit('apikey:generated', { apiKey });
    
    // Return API key with secret (only time the secret is available)
    return {
      ...apiKey,
      secret: keySecret
    };
  }

  /**
   * Revoke an API key
   * @param {string} keyId - API key ID
   * @returns {Promise<boolean>} - Promise resolving to true if revocation was successful
   */
  async revokeApiKey(keyId) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    this.logger.info(`Revoking API key: ${keyId}`);
    
    const apiKey = this.apiKeys.get(keyId);
    
    if (!apiKey) {
      throw new Error(`API key ${keyId} not found`);
    }
    
    // Revoke API key
    const updatedApiKey = {
      ...apiKey,
      revoked: true,
      updatedAt: new Date().toISOString()
    };
    
    // Store updated API key
    this.apiKeys.set(keyId, updatedApiKey);
    await this._saveApiKeys();
    
    // Emit event
    this.events.emit('apikey:revoked', { apiKey: updatedApiKey });
    
    return true;
  }

  /**
   * Validate an API key
   * @param {string} keyId - API key ID
   * @param {string} keySecret - API key secret
   * @returns {Promise<Object>} - Promise resolving to the API key if valid
   */
  async validateApiKey(keyId, keySecret) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    const apiKey = this.apiKeys.get(keyId);
    
    if (!apiKey) {
      throw new Error(`API key ${keyId} not found`);
    }
    
    // Check if API key is revoked
    if (apiKey.revoked) {
      throw new Error(`API key ${keyId} has been revoked`);
    }
    
    // Check if API key has expired
    const expiresAt = new Date(apiKey.expiresAt);
    if (expiresAt < new Date()) {
      throw new Error(`API key ${keyId} has expired`);
    }
    
    // Update last used timestamp
    const updatedApiKey = {
      ...apiKey,
      lastUsedAt: new Date().toISOString()
    };
    
    // Store updated API key
    this.apiKeys.set(keyId, updatedApiKey);
    await this._saveApiKeys();
    
    return updatedApiKey;
  }

  /**
   * Get API keys for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of API keys
   */
  async getApiKeysForDeveloper(developerId) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    const account = this.accounts.get(developerId);
    
    if (!account) {
      throw new Error(`Developer account ${developerId} not found`);
    }
    
    // Get API keys for developer
    const developerApiKeys = Array.from(this.apiKeys.values())
      .filter(apiKey => apiKey.developerId === developerId);
    
    // Remove secrets from API keys
    return developerApiKeys.map(apiKey => ({
      ...apiKey,
      secret: undefined
    }));
  }

  /**
   * Update developer vetting status
   * @param {string} developerId - Developer account ID
   * @param {string} vettingStatus - New vetting status
   * @param {Object} securityProfile - Updated security profile
   * @returns {Promise<Object>} - Promise resolving to the updated developer account
   */
  async updateDeveloperVetting(developerId, vettingStatus, securityProfile = {}) {
    if (!this.initialized) {
      throw new Error('AccountManager not initialized');
    }
    
    this.logger.info(`Updating vetting status for developer ${developerId} to ${vettingStatus}`);
    
    const account = this.accounts.get(developerId);
    
    if (!account) {
      throw new Error(`Developer account ${developerId} not found`);
    }
    
    // Validate vetting status
    const validStatuses = ['pending', 'pending_verification', 'pending_review', 'approved', 'rejected'];
    if (!validStatuses.includes(vettingStatus)) {
      throw new Error(`Invalid vetting status: ${vettingStatus}`);
    }
    
    // Update account
    return this.updateDeveloperAccount(developerId, {
      vettingStatus,
      securityProfile: {
        ...account.securityProfile,
        ...securityProfile,
        lastReviewDate: new Date().toISOString()
      }
    });
  }

  /**
   * Get the status of the account manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      accountCount: this.accounts.size,
      apiKeyCount: this.apiKeys.size,
      securitySettings: { ...this.securitySettings }
    };
  }

  /**
   * Shutdown the account manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('AccountManager not initialized');
      return true;
    }

    this.logger.info('Shutting down AccountManager');
    
    try {
      // Save accounts and API keys
      await this._saveAccounts();
      await this._saveApiKeys();
      
      this.initialized = false;
      this.logger.info('AccountManager shutdown successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown AccountManager', error);
      return false;
    }
  }
}

module.exports = { AccountManager };
