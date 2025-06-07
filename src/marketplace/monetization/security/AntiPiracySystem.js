/**
 * @fileoverview Anti-Piracy System for the Aideon Tentacle Marketplace
 * 
 * This module provides anti-piracy measures to protect tentacles from
 * unauthorized use and distribution.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../../core/logging/Logger');
const { EventEmitter } = require('../../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');

/**
 * AntiPiracySystem class - Implements anti-piracy measures
 */
class AntiPiracySystem {
  /**
   * Create a new AntiPiracySystem instance
   * @param {Object} options - Configuration options
   * @param {string} options.storagePath - Path to store anti-piracy data
   * @param {Object} options.licenseManager - Reference to the license manager
   */
  constructor(options = {}) {
    this.options = options;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'antipiracy-data');
    this.licenseManager = options.licenseManager;
    this.logger = new Logger('AntiPiracySystem');
    this.events = new EventEmitter();
    this.protectedLicenses = new Map();
    this.revokedFingerprints = new Set();
    this.initialized = false;
    
    // Define protection levels
    this.protectionLevels = {
      BASIC: 'basic',
      STANDARD: 'standard',
      HIGH: 'high',
      MAXIMUM: 'maximum'
    };
    
    // Define default protection level
    this.defaultProtectionLevel = this.protectionLevels.STANDARD;
  }

  /**
   * Initialize the anti-piracy system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('AntiPiracySystem already initialized');
      return true;
    }

    this.logger.info('Initializing AntiPiracySystem');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'protected'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'revoked'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'reports'), { recursive: true });
      
      // Load protected licenses
      await this._loadProtectedLicenses();
      
      // Load revoked fingerprints
      await this._loadRevokedFingerprints();
      
      this.initialized = true;
      this.logger.info('AntiPiracySystem initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize AntiPiracySystem', error);
      throw error;
    }
  }

  /**
   * Load protected licenses
   * @returns {Promise<void>}
   * @private
   */
  async _loadProtectedLicenses() {
    const protectedDir = path.join(this.storagePath, 'protected');
    
    try {
      const files = await fs.readdir(protectedDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(protectedDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const protection = JSON.parse(data);
            
            this.protectedLicenses.set(protection.licenseId, protection);
          } catch (error) {
            this.logger.error(`Failed to load protected license from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.protectedLicenses.size} protected licenses`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load protected licenses', error);
      }
    }
  }

  /**
   * Load revoked fingerprints
   * @returns {Promise<void>}
   * @private
   */
  async _loadRevokedFingerprints() {
    const revokedDir = path.join(this.storagePath, 'revoked');
    
    try {
      const files = await fs.readdir(revokedDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(revokedDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const revocation = JSON.parse(data);
            
            if (revocation.fingerprints && Array.isArray(revocation.fingerprints)) {
              for (const fingerprint of revocation.fingerprints) {
                this.revokedFingerprints.add(fingerprint);
              }
            }
          } catch (error) {
            this.logger.error(`Failed to load revoked fingerprints from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.revokedFingerprints.size} revoked fingerprints`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load revoked fingerprints', error);
      }
    }
  }

  /**
   * Save protection data to file
   * @param {string} licenseId - License ID
   * @param {Object} protection - Protection data
   * @returns {Promise<void>}
   * @private
   */
  async _saveProtection(licenseId, protection) {
    const protectionPath = path.join(this.storagePath, 'protected', `${licenseId}.json`);
    
    await fs.writeFile(protectionPath, JSON.stringify(protection, null, 2));
  }

  /**
   * Generate hardware fingerprint
   * @param {Object} deviceInfo - Device information
   * @returns {string} - Hardware fingerprint
   * @private
   */
  _generateHardwareFingerprint(deviceInfo) {
    // In a real implementation, this would use hardware identifiers
    // For this mock implementation, we'll use a hash of the device info
    
    // If deviceInfo is provided, use it
    if (deviceInfo) {
      const deviceInfoString = JSON.stringify(deviceInfo);
      return crypto.createHash('sha256').update(deviceInfoString).digest('hex');
    }
    
    // Otherwise, generate a fingerprint from system information
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().map(cpu => cpu.model),
      totalMemory: os.totalmem(),
      networkInterfaces: Object.values(os.networkInterfaces())
        .flat()
        .filter(iface => !iface.internal && iface.mac !== '00:00:00:00:00:00')
        .map(iface => iface.mac)
    };
    
    const systemInfoString = JSON.stringify(systemInfo);
    return crypto.createHash('sha256').update(systemInfoString).digest('hex');
  }

  /**
   * Protect a license
   * @param {Object} options - License protection options
   * @param {string} options.transactionId - Transaction ID
   * @param {string} options.licenseId - License ID
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.protectionLevel - Protection level
   * @returns {Promise<Object>} - Promise resolving to protection result
   */
  async protectLicense(options) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    this.logger.info(`Protecting license: ${options.licenseId}`);
    
    try {
      // Get license if license manager is available
      let license = null;
      if (this.licenseManager) {
        license = await this.licenseManager.getLicense(options.licenseId);
        
        if (!license) {
          throw new Error(`License ${options.licenseId} not found`);
        }
      }
      
      // Determine protection level
      const protectionLevel = options.protectionLevel || this.defaultProtectionLevel;
      
      // Create protection data
      const protection = {
        licenseId: options.licenseId,
        userId: options.userId || (license ? license.userId : null),
        tentacleId: options.tentacleId || (license ? license.tentacleId : null),
        transactionId: options.transactionId || (license ? license.transactionId : null),
        protectionLevel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        allowedFingerprints: [],
        validationTokens: [],
        obfuscationSeed: crypto.randomBytes(16).toString('hex')
      };
      
      // Store protection data
      this.protectedLicenses.set(options.licenseId, protection);
      
      // Save protection data to file
      await this._saveProtection(options.licenseId, protection);
      
      // Emit event
      this.events.emit('license:protected', { protection });
      
      return {
        success: true,
        protectionLevel
      };
    } catch (error) {
      this.logger.error(`Failed to protect license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check a license
   * @param {Object} options - License check options
   * @param {string} options.licenseId - License ID
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {Object} options.deviceInfo - Device information
   * @returns {Promise<Object>} - Promise resolving to check result
   */
  async checkLicense(options) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    this.logger.info(`Checking license: ${options.licenseId}`);
    
    try {
      // Get protection data
      const protection = this.protectedLicenses.get(options.licenseId);
      
      if (!protection) {
        // If no protection data found, license is not protected
        return {
          valid: true,
          protected: false
        };
      }
      
      // Check if user ID matches
      if (protection.userId && options.userId && protection.userId !== options.userId) {
        return {
          valid: false,
          error: 'License does not belong to this user'
        };
      }
      
      // Check if tentacle ID matches
      if (protection.tentacleId && options.tentacleId && protection.tentacleId !== options.tentacleId) {
        return {
          valid: false,
          error: 'License is not valid for this tentacle'
        };
      }
      
      // Generate hardware fingerprint
      const hardwareFingerprint = this._generateHardwareFingerprint(options.deviceInfo);
      
      // Check if fingerprint is revoked
      if (this.revokedFingerprints.has(hardwareFingerprint)) {
        return {
          valid: false,
          error: 'Device has been revoked'
        };
      }
      
      // If protection level is basic, no further checks needed
      if (protection.protectionLevel === this.protectionLevels.BASIC) {
        return {
          valid: true,
          protected: true,
          protectionLevel: protection.protectionLevel
        };
      }
      
      // For standard protection level and above, check if fingerprint is allowed
      if (protection.allowedFingerprints.length > 0) {
        if (!protection.allowedFingerprints.includes(hardwareFingerprint)) {
          // If fingerprint is not allowed, add it if there's room
          if (protection.allowedFingerprints.length < 5) {
            protection.allowedFingerprints.push(hardwareFingerprint);
            protection.updatedAt = new Date().toISOString();
            await this._saveProtection(options.licenseId, protection);
          } else {
            return {
              valid: false,
              error: 'Maximum number of devices reached'
            };
          }
        }
      } else {
        // No fingerprints yet, add this one
        protection.allowedFingerprints.push(hardwareFingerprint);
        protection.updatedAt = new Date().toISOString();
        await this._saveProtection(options.licenseId, protection);
      }
      
      // For high protection level and above, generate validation token
      if (protection.protectionLevel === this.protectionLevels.HIGH || 
          protection.protectionLevel === this.protectionLevels.MAXIMUM) {
        const validationToken = this._generateValidationToken(options.licenseId, hardwareFingerprint);
        
        // Store validation token
        protection.validationTokens = protection.validationTokens.filter(token => 
          new Date(token.expiresAt) > new Date()
        );
        
        protection.validationTokens.push(validationToken);
        protection.updatedAt = new Date().toISOString();
        await this._saveProtection(options.licenseId, protection);
        
        return {
          valid: true,
          protected: true,
          protectionLevel: protection.protectionLevel,
          validationToken: validationToken.token,
          validationTokenExpiresAt: validationToken.expiresAt
        };
      }
      
      return {
        valid: true,
        protected: true,
        protectionLevel: protection.protectionLevel
      };
    } catch (error) {
      this.logger.error(`Failed to check license: ${options.licenseId}`, error);
      
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Generate validation token
   * @param {string} licenseId - License ID
   * @param {string} fingerprint - Hardware fingerprint
   * @returns {Object} - Validation token
   * @private
   */
  _generateValidationToken(licenseId, fingerprint) {
    // Generate token
    const tokenData = `${licenseId}:${fingerprint}:${Date.now()}`;
    const token = crypto.createHash('sha256').update(tokenData).digest('hex');
    
    // Set expiration (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    return {
      token,
      fingerprint,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Validate a token
   * @param {Object} options - Token validation options
   * @param {string} options.licenseId - License ID
   * @param {string} options.token - Validation token
   * @param {Object} options.deviceInfo - Device information
   * @returns {Promise<Object>} - Promise resolving to validation result
   */
  async validateToken(options) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    this.logger.info(`Validating token for license: ${options.licenseId}`);
    
    try {
      // Get protection data
      const protection = this.protectedLicenses.get(options.licenseId);
      
      if (!protection) {
        return {
          valid: false,
          error: 'License is not protected'
        };
      }
      
      // Generate hardware fingerprint
      const hardwareFingerprint = this._generateHardwareFingerprint(options.deviceInfo);
      
      // Find token
      const tokenEntry = protection.validationTokens.find(t => t.token === options.token);
      
      if (!tokenEntry) {
        return {
          valid: false,
          error: 'Invalid token'
        };
      }
      
      // Check if token has expired
      if (new Date(tokenEntry.expiresAt) < new Date()) {
        return {
          valid: false,
          error: 'Token has expired'
        };
      }
      
      // Check if fingerprint matches
      if (tokenEntry.fingerprint !== hardwareFingerprint) {
        return {
          valid: false,
          error: 'Token is not valid for this device'
        };
      }
      
      return {
        valid: true
      };
    } catch (error) {
      this.logger.error(`Failed to validate token for license: ${options.licenseId}`, error);
      
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke a device
   * @param {Object} options - Device revocation options
   * @param {string} options.licenseId - License ID
   * @param {string} options.fingerprint - Hardware fingerprint
   * @param {string} options.reason - Revocation reason
   * @returns {Promise<Object>} - Promise resolving to revocation result
   */
  async revokeDevice(options) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    this.logger.info(`Revoking device for license: ${options.licenseId}`);
    
    try {
      // Get protection data
      const protection = this.protectedLicenses.get(options.licenseId);
      
      if (!protection) {
        return {
          success: false,
          error: 'License is not protected'
        };
      }
      
      // Check if fingerprint is in allowed list
      const fingerprintIndex = protection.allowedFingerprints.indexOf(options.fingerprint);
      
      if (fingerprintIndex === -1) {
        return {
          success: false,
          error: 'Device is not registered with this license'
        };
      }
      
      // Remove fingerprint from allowed list
      protection.allowedFingerprints.splice(fingerprintIndex, 1);
      
      // Add fingerprint to revoked set
      this.revokedFingerprints.add(options.fingerprint);
      
      // Save revocation
      const revocationId = `rev_${crypto.randomBytes(8).toString('hex')}`;
      const revocation = {
        id: revocationId,
        licenseId: options.licenseId,
        fingerprints: [options.fingerprint],
        reason: options.reason,
        createdAt: new Date().toISOString()
      };
      
      const revocationPath = path.join(this.storagePath, 'revoked', `${revocationId}.json`);
      await fs.writeFile(revocationPath, JSON.stringify(revocation, null, 2));
      
      // Update protection data
      protection.updatedAt = new Date().toISOString();
      await this._saveProtection(options.licenseId, protection);
      
      // Emit event
      this.events.emit('device:revoked', { licenseId: options.licenseId, fingerprint: options.fingerprint });
      
      return {
        success: true,
        revocationId
      };
    } catch (error) {
      this.logger.error(`Failed to revoke device for license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Report piracy
   * @param {Object} options - Piracy report options
   * @param {string} options.licenseId - License ID
   * @param {string} options.reportType - Report type
   * @param {string} options.description - Report description
   * @param {Object} options.evidence - Evidence data
   * @returns {Promise<Object>} - Promise resolving to report result
   */
  async reportPiracy(options) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    this.logger.info(`Reporting piracy for license: ${options.licenseId}`);
    
    try {
      // Generate report ID
      const reportId = `rep_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create report
      const report = {
        id: reportId,
        licenseId: options.licenseId,
        reportType: options.reportType,
        description: options.description,
        evidence: options.evidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save report
      const reportPath = path.join(this.storagePath, 'reports', `${reportId}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Emit event
      this.events.emit('piracy:reported', { report });
      
      return {
        success: true,
        reportId
      };
    } catch (error) {
      this.logger.error(`Failed to report piracy for license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get protection data for a license
   * @param {string} licenseId - License ID
   * @returns {Promise<Object>} - Promise resolving to protection data
   */
  async getProtection(licenseId) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    // Get protection data from memory
    const protection = this.protectedLicenses.get(licenseId);
    
    if (protection) {
      return protection;
    }
    
    // Try to load protection data from file
    const protectionPath = path.join(this.storagePath, 'protected', `${licenseId}.json`);
    
    try {
      const data = await fs.readFile(protectionPath, 'utf8');
      const loadedProtection = JSON.parse(data);
      
      // Cache protection data in memory
      this.protectedLicenses.set(licenseId, loadedProtection);
      
      return loadedProtection;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Update protection level for a license
   * @param {Object} options - Protection update options
   * @param {string} options.licenseId - License ID
   * @param {string} options.protectionLevel - New protection level
   * @returns {Promise<Object>} - Promise resolving to update result
   */
  async updateProtectionLevel(options) {
    if (!this.initialized) {
      throw new Error('AntiPiracySystem not initialized');
    }
    
    this.logger.info(`Updating protection level for license: ${options.licenseId}`);
    
    try {
      // Get protection data
      const protection = await this.getProtection(options.licenseId);
      
      if (!protection) {
        return {
          success: false,
          error: 'License is not protected'
        };
      }
      
      // Validate protection level
      if (!Object.values(this.protectionLevels).includes(options.protectionLevel)) {
        return {
          success: false,
          error: `Invalid protection level: ${options.protectionLevel}`
        };
      }
      
      // Update protection level
      protection.protectionLevel = options.protectionLevel;
      protection.updatedAt = new Date().toISOString();
      
      // Save protection data
      await this._saveProtection(options.licenseId, protection);
      
      // Emit event
      this.events.emit('protection:updated', { protection });
      
      return {
        success: true,
        protectionLevel: options.protectionLevel
      };
    } catch (error) {
      this.logger.error(`Failed to update protection level for license: ${options.licenseId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the status of the anti-piracy system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      protectedLicenses: this.protectedLicenses.size,
      revokedFingerprints: this.revokedFingerprints.size
    };
  }

  /**
   * Shutdown the anti-piracy system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('AntiPiracySystem not initialized');
      return true;
    }
    
    this.logger.info('Shutting down AntiPiracySystem');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { AntiPiracySystem };
