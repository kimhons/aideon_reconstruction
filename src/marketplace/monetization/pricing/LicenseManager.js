/**
 * @fileoverview License Manager for the Aideon Tentacle Marketplace
 * 
 * This module provides license management functionality, handling license
 * generation, validation, and lifecycle management.
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
 * LicenseManager class - Manages license generation and validation
 */
class LicenseManager {
  /**
   * Create a new LicenseManager instance
   * @param {Object} options - Configuration options
   * @param {string} options.storagePath - Path to store license data
   * @param {string} options.privateKeyPath - Path to private key for signing licenses
   * @param {string} options.publicKeyPath - Path to public key for verifying licenses
   */
  constructor(options = {}) {
    this.options = options;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'license-data');
    this.privateKeyPath = options.privateKeyPath || path.join(process.cwd(), 'keys', 'license_private.pem');
    this.publicKeyPath = options.publicKeyPath || path.join(process.cwd(), 'keys', 'license_public.pem');
    this.logger = new Logger('LicenseManager');
    this.events = new EventEmitter();
    this.licenses = new Map();
    this.initialized = false;
    
    // Define license types
    this.licenseTypes = {
      PERPETUAL: 'perpetual',
      SUBSCRIPTION: 'subscription',
      TRIAL: 'trial',
      GHOST_MODE: 'ghost_mode',
      RENTAL: 'rental'
    };
    
    // Define license statuses
    this.licenseStatuses = {
      ACTIVE: 'active',
      EXPIRED: 'expired',
      REVOKED: 'revoked',
      SUSPENDED: 'suspended'
    };
  }

  /**
   * Initialize the license manager
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('LicenseManager already initialized');
      return true;
    }

    this.logger.info('Initializing LicenseManager');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'licenses'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'activations'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'revocations'), { recursive: true });
      
      // Ensure keys directory exists
      await fs.mkdir(path.dirname(this.privateKeyPath), { recursive: true });
      
      // Check if keys exist, generate if not
      await this._ensureKeysExist();
      
      // Load existing licenses
      await this._loadLicenses();
      
      this.initialized = true;
      this.logger.info('LicenseManager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize LicenseManager', error);
      throw error;
    }
  }

  /**
   * Ensure cryptographic keys exist
   * @returns {Promise<void>}
   * @private
   */
  async _ensureKeysExist() {
    try {
      // Check if private key exists
      await fs.access(this.privateKeyPath);
      // Check if public key exists
      await fs.access(this.publicKeyPath);
      
      this.logger.info('License cryptographic keys found');
    } catch (error) {
      // Keys don't exist, generate them
      this.logger.info('License cryptographic keys not found, generating new keys');
      
      // In a real implementation, we would use proper key generation
      // For this mock implementation, we'll create placeholder keys
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Save keys
      await fs.writeFile(this.privateKeyPath, privateKey);
      await fs.writeFile(this.publicKeyPath, publicKey);
      
      this.logger.info('License cryptographic keys generated and saved');
    }
  }

  /**
   * Load existing licenses
   * @returns {Promise<void>}
   * @private
   */
  async _loadLicenses() {
    const licensesDir = path.join(this.storagePath, 'licenses');
    
    try {
      const files = await fs.readdir(licensesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(licensesDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const license = JSON.parse(data);
            
            this.licenses.set(license.id, license);
          } catch (error) {
            this.logger.error(`Failed to load license from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.licenses.size} existing licenses`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load licenses', error);
      }
    }
  }

  /**
   * Save license to file
   * @param {string} licenseId - License ID
   * @param {Object} license - License data
   * @returns {Promise<void>}
   * @private
   */
  async _saveLicense(licenseId, license) {
    const licensePath = path.join(this.storagePath, 'licenses', `${licenseId}.json`);
    
    await fs.writeFile(licensePath, JSON.stringify(license, null, 2));
  }

  /**
   * Sign license data
   * @param {Object} licenseData - License data to sign
   * @returns {Promise<string>} - Promise resolving to the signature
   * @private
   */
  async _signLicenseData(licenseData) {
    try {
      // Read private key
      const privateKey = await fs.readFile(this.privateKeyPath, 'utf8');
      
      // Create string representation of license data
      const licenseString = JSON.stringify(licenseData);
      
      // Sign license data
      const signature = crypto.createSign('SHA256').update(licenseString).sign({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING
      }, 'base64');
      
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign license data', error);
      throw error;
    }
  }

  /**
   * Verify license signature
   * @param {Object} licenseData - License data to verify
   * @param {string} signature - Signature to verify
   * @returns {Promise<boolean>} - Promise resolving to true if signature is valid
   * @private
   */
  async _verifyLicenseSignature(licenseData, signature) {
    try {
      // Read public key
      const publicKey = await fs.readFile(this.publicKeyPath, 'utf8');
      
      // Create string representation of license data
      const licenseString = JSON.stringify(licenseData);
      
      // Verify signature
      const isValid = crypto.createVerify('SHA256').update(licenseString).verify({
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING
      }, signature, 'base64');
      
      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify license signature', error);
      return false;
    }
  }

  /**
   * Generate a license
   * @param {Object} options - License generation options
   * @param {string} options.transactionId - Transaction ID
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.pricingModel - Pricing model
   * @returns {Promise<Object>} - Promise resolving to the generated license
   */
  async generateLicense(options) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Generating license for user: ${options.userId}, tentacle: ${options.tentacleId}`);
    
    try {
      // Generate license ID
      const licenseId = `lic_${crypto.randomBytes(8).toString('hex')}`;
      
      // Determine license type based on pricing model
      let licenseType;
      let expiresAt = null;
      
      switch (options.pricingModel) {
        case 'free':
          licenseType = this.licenseTypes.PERPETUAL;
          break;
        case 'one_time':
          licenseType = this.licenseTypes.PERPETUAL;
          break;
        case 'subscription':
          licenseType = this.licenseTypes.SUBSCRIPTION;
          // Set expiration to 30 days from now (would be based on subscription period in real implementation)
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'ghost_mode':
          licenseType = this.licenseTypes.GHOST_MODE;
          // Set expiration to 1 year from now
          expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'rental':
          licenseType = this.licenseTypes.RENTAL;
          // Set expiration to 7 days from now (would be based on rental period in real implementation)
          expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          licenseType = this.licenseTypes.TRIAL;
          // Set expiration to 14 days from now
          expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      // Create license data
      const licenseData = {
        id: licenseId,
        userId: options.userId,
        tentacleId: options.tentacleId,
        transactionId: options.transactionId,
        type: licenseType,
        status: this.licenseStatuses.ACTIVE,
        createdAt: new Date().toISOString(),
        expiresAt,
        activations: 0,
        maxActivations: 5, // Allow up to 5 device activations
        features: {}, // Additional features can be added here
        metadata: {
          pricingModel: options.pricingModel
        }
      };
      
      // Sign license data
      const signature = await this._signLicenseData(licenseData);
      
      // Create complete license
      const license = {
        ...licenseData,
        signature
      };
      
      // Store license
      this.licenses.set(licenseId, license);
      
      // Save license to file
      await this._saveLicense(licenseId, license);
      
      // Emit event
      this.events.emit('license:generated', { license });
      
      return {
        success: true,
        licenseId,
        license
      };
    } catch (error) {
      this.logger.error(`Failed to generate license for user: ${options.userId}, tentacle: ${options.tentacleId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
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
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Validating license: ${options.licenseId}`);
    
    try {
      // Get license
      const license = await this.getLicense(options.licenseId);
      
      if (!license) {
        return {
          valid: false,
          error: `License ${options.licenseId} not found`
        };
      }
      
      // Check if license belongs to user
      if (license.userId !== options.userId) {
        return {
          valid: false,
          error: 'License does not belong to this user'
        };
      }
      
      // Check if license is for the correct tentacle
      if (license.tentacleId !== options.tentacleId) {
        return {
          valid: false,
          error: 'License is not valid for this tentacle'
        };
      }
      
      // Check if license is active
      if (license.status !== this.licenseStatuses.ACTIVE) {
        return {
          valid: false,
          error: `License is ${license.status}`
        };
      }
      
      // Check if license has expired
      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        // Update license status
        license.status = this.licenseStatuses.EXPIRED;
        await this._saveLicense(license.id, license);
        
        return {
          valid: false,
          error: 'License has expired'
        };
      }
      
      // Verify license signature
      const isSignatureValid = await this._verifyLicenseSignature({
        ...license,
        signature: undefined // Remove signature from data to verify
      }, license.signature);
      
      if (!isSignatureValid) {
        return {
          valid: false,
          error: 'License signature is invalid'
        };
      }
      
      // Check if device is activated
      const isDeviceActivated = await this._isDeviceActivated(license.id, options.deviceInfo);
      
      if (!isDeviceActivated) {
        // Check if maximum activations reached
        if (license.activations >= license.maxActivations) {
          return {
            valid: false,
            error: 'Maximum number of activations reached',
            canActivate: false
          };
        }
        
        return {
          valid: true,
          requiresActivation: true,
          canActivate: true
        };
      }
      
      return {
        valid: true,
        licenseType: license.type,
        expiresAt: license.expiresAt,
        features: license.features
      };
    } catch (error) {
      this.logger.error(`Failed to validate license: ${options.licenseId}`, error);
      
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check if device is activated for a license
   * @param {string} licenseId - License ID
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<boolean>} - Promise resolving to true if device is activated
   * @private
   */
  async _isDeviceActivated(licenseId, deviceInfo) {
    try {
      // Generate device fingerprint
      const deviceFingerprint = this._generateDeviceFingerprint(deviceInfo);
      
      // Check if activation exists
      const activationPath = path.join(this.storagePath, 'activations', `${licenseId}_${deviceFingerprint}.json`);
      
      try {
        await fs.access(activationPath);
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to check device activation for license: ${licenseId}`, error);
      return false;
    }
  }

  /**
   * Generate device fingerprint
   * @param {Object} deviceInfo - Device information
   * @returns {string} - Device fingerprint
   * @private
   */
  _generateDeviceFingerprint(deviceInfo) {
    // In a real implementation, this would use hardware identifiers
    // For this mock implementation, we'll use a hash of the device info
    const deviceInfoString = JSON.stringify(deviceInfo || {});
    return crypto.createHash('sha256').update(deviceInfoString).digest('hex');
  }

  /**
   * Activate a license for a device
   * @param {Object} options - License activation options
   * @param {string} options.licenseId - License ID
   * @param {string} options.userId - User ID
   * @param {Object} options.deviceInfo - Device information
   * @returns {Promise<Object>} - Promise resolving to activation result
   */
  async activateLicense(options) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Activating license: ${options.licenseId}`);
    
    try {
      // Get license
      const license = await this.getLicense(options.licenseId);
      
      if (!license) {
        return {
          success: false,
          error: `License ${options.licenseId} not found`
        };
      }
      
      // Check if license belongs to user
      if (license.userId !== options.userId) {
        return {
          success: false,
          error: 'License does not belong to this user'
        };
      }
      
      // Check if license is active
      if (license.status !== this.licenseStatuses.ACTIVE) {
        return {
          success: false,
          error: `License is ${license.status}`
        };
      }
      
      // Check if license has expired
      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        // Update license status
        license.status = this.licenseStatuses.EXPIRED;
        await this._saveLicense(license.id, license);
        
        return {
          success: false,
          error: 'License has expired'
        };
      }
      
      // Check if device is already activated
      const deviceFingerprint = this._generateDeviceFingerprint(options.deviceInfo);
      const isDeviceActivated = await this._isDeviceActivated(license.id, options.deviceInfo);
      
      if (isDeviceActivated) {
        return {
          success: true,
          alreadyActivated: true
        };
      }
      
      // Check if maximum activations reached
      if (license.activations >= license.maxActivations) {
        return {
          success: false,
          error: 'Maximum number of activations reached'
        };
      }
      
      // Create activation
      const activationId = `act_${crypto.randomBytes(8).toString('hex')}`;
      const activation = {
        id: activationId,
        licenseId: license.id,
        userId: options.userId,
        deviceFingerprint,
        deviceInfo: options.deviceInfo,
        createdAt: new Date().toISOString()
      };
      
      // Save activation
      const activationPath = path.join(this.storagePath, 'activations', `${license.id}_${deviceFingerprint}.json`);
      await fs.writeFile(activationPath, JSON.stringify(activation, null, 2));
      
      // Update license
      license.activations += 1;
      await this._saveLicense(license.id, license);
      
      // Emit event
      this.events.emit('license:activated', { license, activation });
      
      return {
        success: true,
        activationId
      };
    } catch (error) {
      this.logger.error(`Failed to activate license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deactivate a license for a device
   * @param {Object} options - License deactivation options
   * @param {string} options.licenseId - License ID
   * @param {string} options.userId - User ID
   * @param {Object} options.deviceInfo - Device information
   * @returns {Promise<Object>} - Promise resolving to deactivation result
   */
  async deactivateLicense(options) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Deactivating license: ${options.licenseId}`);
    
    try {
      // Get license
      const license = await this.getLicense(options.licenseId);
      
      if (!license) {
        return {
          success: false,
          error: `License ${options.licenseId} not found`
        };
      }
      
      // Check if license belongs to user
      if (license.userId !== options.userId) {
        return {
          success: false,
          error: 'License does not belong to this user'
        };
      }
      
      // Check if device is activated
      const deviceFingerprint = this._generateDeviceFingerprint(options.deviceInfo);
      const isDeviceActivated = await this._isDeviceActivated(license.id, options.deviceInfo);
      
      if (!isDeviceActivated) {
        return {
          success: false,
          error: 'Device is not activated for this license'
        };
      }
      
      // Delete activation
      const activationPath = path.join(this.storagePath, 'activations', `${license.id}_${deviceFingerprint}.json`);
      await fs.unlink(activationPath);
      
      // Update license
      license.activations = Math.max(0, license.activations - 1);
      await this._saveLicense(license.id, license);
      
      // Emit event
      this.events.emit('license:deactivated', { license, deviceFingerprint });
      
      return {
        success: true
      };
    } catch (error) {
      this.logger.error(`Failed to deactivate license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke a license
   * @param {Object} options - License revocation options
   * @param {string} options.licenseId - License ID
   * @param {string} options.reason - Revocation reason
   * @returns {Promise<Object>} - Promise resolving to revocation result
   */
  async revokeLicense(options) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Revoking license: ${options.licenseId}`);
    
    try {
      // Get license
      const license = await this.getLicense(options.licenseId);
      
      if (!license) {
        return {
          success: false,
          error: `License ${options.licenseId} not found`
        };
      }
      
      // Update license status
      license.status = this.licenseStatuses.REVOKED;
      license.revokedAt = new Date().toISOString();
      license.revocationReason = options.reason;
      
      // Save license
      await this._saveLicense(license.id, license);
      
      // Save revocation record
      const revocationId = `rev_${crypto.randomBytes(8).toString('hex')}`;
      const revocation = {
        id: revocationId,
        licenseId: license.id,
        reason: options.reason,
        createdAt: new Date().toISOString()
      };
      
      const revocationPath = path.join(this.storagePath, 'revocations', `${license.id}.json`);
      await fs.writeFile(revocationPath, JSON.stringify(revocation, null, 2));
      
      // Emit event
      this.events.emit('license:revoked', { license, revocation });
      
      return {
        success: true,
        revocationId
      };
    } catch (error) {
      this.logger.error(`Failed to revoke license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Renew a license
   * @param {Object} options - License renewal options
   * @param {string} options.licenseId - License ID
   * @param {string} options.transactionId - Transaction ID
   * @param {number} options.durationDays - Renewal duration in days
   * @returns {Promise<Object>} - Promise resolving to renewal result
   */
  async renewLicense(options) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Renewing license: ${options.licenseId}`);
    
    try {
      // Get license
      const license = await this.getLicense(options.licenseId);
      
      if (!license) {
        return {
          success: false,
          error: `License ${options.licenseId} not found`
        };
      }
      
      // Check if license can be renewed
      if (license.status === this.licenseStatuses.REVOKED) {
        return {
          success: false,
          error: 'Revoked licenses cannot be renewed'
        };
      }
      
      // Calculate new expiration date
      let newExpiresAt;
      
      if (license.expiresAt && new Date(license.expiresAt) > new Date()) {
        // If license is still valid, extend from current expiration date
        newExpiresAt = new Date(license.expiresAt);
      } else {
        // If license has expired, extend from now
        newExpiresAt = new Date();
      }
      
      // Add renewal duration
      newExpiresAt.setDate(newExpiresAt.getDate() + (options.durationDays || 30));
      
      // Update license
      license.expiresAt = newExpiresAt.toISOString();
      license.status = this.licenseStatuses.ACTIVE;
      license.renewalTransactionId = options.transactionId;
      license.lastRenewalAt = new Date().toISOString();
      
      // Save license
      await this._saveLicense(license.id, license);
      
      // Emit event
      this.events.emit('license:renewed', { license });
      
      return {
        success: true,
        expiresAt: license.expiresAt
      };
    } catch (error) {
      this.logger.error(`Failed to renew license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a license by ID
   * @param {string} licenseId - License ID
   * @returns {Promise<Object>} - Promise resolving to the license
   */
  async getLicense(licenseId) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    // Get license from memory
    const license = this.licenses.get(licenseId);
    
    if (license) {
      return license;
    }
    
    // Try to load license from file
    const licensePath = path.join(this.storagePath, 'licenses', `${licenseId}.json`);
    
    try {
      const data = await fs.readFile(licensePath, 'utf8');
      const loadedLicense = JSON.parse(data);
      
      // Cache license in memory
      this.licenses.set(licenseId, loadedLicense);
      
      return loadedLicense;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Get licenses for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of licenses
   */
  async getUserLicenses(userId) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    const userLicenses = [];
    
    for (const license of this.licenses.values()) {
      if (license.userId === userId) {
        userLicenses.push(license);
      }
    }
    
    return userLicenses;
  }

  /**
   * Get licenses for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Array<Object>>} - Promise resolving to an array of licenses
   */
  async getTentacleLicenses(tentacleId) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    const tentacleLicenses = [];
    
    for (const license of this.licenses.values()) {
      if (license.tentacleId === tentacleId) {
        tentacleLicenses.push(license);
      }
    }
    
    return tentacleLicenses;
  }

  /**
   * Export a license for offline use
   * @param {string} licenseId - License ID
   * @returns {Promise<Object>} - Promise resolving to the exported license
   */
  async exportLicense(licenseId) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info(`Exporting license: ${licenseId}`);
    
    try {
      // Get license
      const license = await this.getLicense(licenseId);
      
      if (!license) {
        throw new Error(`License ${licenseId} not found`);
      }
      
      // Create exportable license
      const exportableLicense = {
        id: license.id,
        userId: license.userId,
        tentacleId: license.tentacleId,
        type: license.type,
        status: license.status,
        createdAt: license.createdAt,
        expiresAt: license.expiresAt,
        features: license.features,
        signature: license.signature
      };
      
      // Encode license as base64
      const licenseString = JSON.stringify(exportableLicense);
      const encodedLicense = Buffer.from(licenseString).toString('base64');
      
      return {
        success: true,
        encodedLicense
      };
    } catch (error) {
      this.logger.error(`Failed to export license: ${licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import a license from offline format
   * @param {string} encodedLicense - Encoded license string
   * @returns {Promise<Object>} - Promise resolving to the imported license
   */
  async importLicense(encodedLicense) {
    if (!this.initialized) {
      throw new Error('LicenseManager not initialized');
    }
    
    this.logger.info('Importing license');
    
    try {
      // Decode license
      const licenseString = Buffer.from(encodedLicense, 'base64').toString('utf8');
      const license = JSON.parse(licenseString);
      
      // Verify license signature
      const isSignatureValid = await this._verifyLicenseSignature({
        ...license,
        signature: undefined // Remove signature from data to verify
      }, license.signature);
      
      if (!isSignatureValid) {
        throw new Error('License signature is invalid');
      }
      
      // Check if license already exists
      const existingLicense = await this.getLicense(license.id);
      
      if (existingLicense) {
        // Update existing license if needed
        if (existingLicense.status === this.licenseStatuses.REVOKED) {
          return {
            success: false,
            error: 'License has been revoked'
          };
        }
        
        return {
          success: true,
          license: existingLicense,
          alreadyExists: true
        };
      }
      
      // Store license
      this.licenses.set(license.id, license);
      
      // Save license to file
      await this._saveLicense(license.id, license);
      
      // Emit event
      this.events.emit('license:imported', { license });
      
      return {
        success: true,
        license
      };
    } catch (error) {
      this.logger.error('Failed to import license', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the status of the license manager
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      licenses: this.licenses.size,
      keysAvailable: fs.existsSync(this.privateKeyPath) && fs.existsSync(this.publicKeyPath)
    };
  }

  /**
   * Shutdown the license manager
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('LicenseManager not initialized');
      return true;
    }
    
    this.logger.info('Shutting down LicenseManager');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { LicenseManager };
