/**
 * @fileoverview Security Manager for Aideon system.
 * Provides security services including authentication, authorization, and encryption.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { Logger } = require('./logging/Logger');
const { ConfigurationService } = require('./ConfigurationService');

/**
 * Security Manager for handling authentication, authorization, and encryption.
 */
class SecurityManager extends EventEmitter {
  /**
   * Creates a new SecurityManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {ConfigurationService} [options.configService] - Configuration service
   * @param {Logger} [options.logger] - Logger instance
   */
  constructor(options = {}) {
    super();
    
    this.configService = options.configService || new ConfigurationService();
    this.logger = options.logger || new Logger('SecurityManager');
    
    // Load configuration
    this.config = this.configService.getConfig('security', {
      encryptionEnabled: true,
      encryptionAlgorithm: 'aes-256-gcm',
      keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      }
    });
    
    // Initialize security components
    this._initializeEncryption();
    
    this.logger.info('SecurityManager initialized');
  }
  
  /**
   * Initializes encryption components.
   * 
   * @private
   */
  _initializeEncryption() {
    if (!this.config.encryptionEnabled) {
      this.logger.warn('Encryption is disabled');
      return;
    }
    
    try {
      // Generate or load encryption keys
      this.encryptionKeys = new Map();
      
      // For testing purposes, generate a key
      const keyId = Date.now().toString();
      const key = crypto.randomBytes(32); // 256 bits
      
      this.encryptionKeys.set(keyId, {
        key,
        created: Date.now(),
        algorithm: this.config.encryptionAlgorithm
      });
      
      this.currentKeyId = keyId;
      
      this.logger.info('Encryption initialized');
    } catch (error) {
      this.logger.error('Failed to initialize encryption', error);
      throw new Error('Failed to initialize encryption: ' + error.message);
    }
  }
  
  /**
   * Encrypts data using the current encryption key.
   * 
   * @param {string|Buffer} data - Data to encrypt
   * @param {Object} [options] - Encryption options
   * @param {string} [options.keyId] - Specific key ID to use
   * @returns {Object} Encrypted data object with ciphertext, iv, tag, and keyId
   * @throws {Error} If encryption fails
   */
  encrypt(data, options = {}) {
    if (!this.config.encryptionEnabled) {
      throw new Error('Encryption is disabled');
    }
    
    try {
      // Get the encryption key
      const keyId = options.keyId || this.currentKeyId;
      const keyInfo = this.encryptionKeys.get(keyId);
      
      if (!keyInfo) {
        throw new Error(`Encryption key ${keyId} not found`);
      }
      
      // Generate initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        keyInfo.algorithm,
        keyInfo.key,
        iv
      );
      
      // Convert data to buffer if it's a string
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      
      // Encrypt data
      const ciphertext = Buffer.concat([
        cipher.update(dataBuffer),
        cipher.final()
      ]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      return {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        keyId
      };
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Encryption failed: ' + error.message);
    }
  }
  
  /**
   * Decrypts data.
   * 
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} encryptedData.ciphertext - Base64-encoded ciphertext
   * @param {string} encryptedData.iv - Base64-encoded initialization vector
   * @param {string} encryptedData.tag - Base64-encoded authentication tag
   * @param {string} encryptedData.keyId - Key ID used for encryption
   * @param {Object} [options] - Decryption options
   * @param {boolean} [options.returnBuffer=false] - Whether to return a buffer instead of a string
   * @returns {string|Buffer} Decrypted data
   * @throws {Error} If decryption fails
   */
  decrypt(encryptedData, options = {}) {
    if (!this.config.encryptionEnabled) {
      throw new Error('Encryption is disabled');
    }
    
    try {
      // Get the encryption key
      const keyInfo = this.encryptionKeys.get(encryptedData.keyId);
      
      if (!keyInfo) {
        throw new Error(`Decryption key ${encryptedData.keyId} not found`);
      }
      
      // Convert base64 strings to buffers
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        keyInfo.algorithm,
        keyInfo.key,
        iv
      );
      
      // Set authentication tag
      decipher.setAuthTag(tag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return options.returnBuffer ? decrypted : decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Decryption failed: ' + error.message);
    }
  }
  
  /**
   * Generates a secure hash of data.
   * 
   * @param {string|Buffer} data - Data to hash
   * @param {Object} [options] - Hashing options
   * @param {string} [options.algorithm='sha256'] - Hash algorithm
   * @param {string} [options.salt] - Salt to use (generated if not provided)
   * @param {number} [options.iterations=10000] - Number of iterations
   * @returns {Object} Hash object with hash, salt, iterations, and algorithm
   * @throws {Error} If hashing fails
   */
  hash(data, options = {}) {
    try {
      const algorithm = options.algorithm || 'sha256';
      const salt = options.salt ? Buffer.from(options.salt, 'base64') : crypto.randomBytes(16);
      const iterations = options.iterations || 10000;
      
      // Convert data to buffer if it's a string
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      
      // Generate hash
      const hash = crypto.pbkdf2Sync(
        dataBuffer,
        salt,
        iterations,
        64,
        algorithm
      );
      
      return {
        hash: hash.toString('base64'),
        salt: salt.toString('base64'),
        iterations,
        algorithm
      };
    } catch (error) {
      this.logger.error('Hashing failed', error);
      throw new Error('Hashing failed: ' + error.message);
    }
  }
  
  /**
   * Verifies a hash against data.
   * 
   * @param {string|Buffer} data - Data to verify
   * @param {Object} hashObj - Hash object
   * @param {string} hashObj.hash - Base64-encoded hash
   * @param {string} hashObj.salt - Base64-encoded salt
   * @param {number} hashObj.iterations - Number of iterations
   * @param {string} hashObj.algorithm - Hash algorithm
   * @returns {boolean} Whether the hash matches the data
   * @throws {Error} If verification fails
   */
  verifyHash(data, hashObj) {
    try {
      // Convert data to buffer if it's a string
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      
      // Generate hash with the same parameters
      const verifyHashObj = this.hash(dataBuffer, {
        algorithm: hashObj.algorithm,
        salt: hashObj.salt,
        iterations: hashObj.iterations
      });
      
      // Compare hashes
      return verifyHashObj.hash === hashObj.hash;
    } catch (error) {
      this.logger.error('Hash verification failed', error);
      throw new Error('Hash verification failed: ' + error.message);
    }
  }
  
  /**
   * Generates a random token.
   * 
   * @param {Object} [options] - Token options
   * @param {number} [options.length=32] - Token length in bytes
   * @param {string} [options.encoding='base64'] - Token encoding
   * @returns {string} Random token
   */
  generateToken(options = {}) {
    const length = options.length || 32;
    const encoding = options.encoding || 'base64';
    
    return crypto.randomBytes(length).toString(encoding);
  }
  
  /**
   * Validates a password against the password policy.
   * 
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with isValid and reasons
   */
  validatePassword(password) {
    const policy = this.config.passwordPolicy;
    const reasons = [];
    
    if (password.length < policy.minLength) {
      reasons.push(`Password must be at least ${policy.minLength} characters long`);
    }
    
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      reasons.push('Password must contain at least one uppercase letter');
    }
    
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      reasons.push('Password must contain at least one lowercase letter');
    }
    
    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      reasons.push('Password must contain at least one number');
    }
    
    if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      reasons.push('Password must contain at least one special character');
    }
    
    return {
      isValid: reasons.length === 0,
      reasons
    };
  }
  
  /**
   * Rotates encryption keys.
   * 
   * @returns {string} New key ID
   * @throws {Error} If key rotation fails
   */
  rotateEncryptionKeys() {
    if (!this.config.encryptionEnabled) {
      throw new Error('Encryption is disabled');
    }
    
    try {
      // Generate new key
      const keyId = Date.now().toString();
      const key = crypto.randomBytes(32); // 256 bits
      
      this.encryptionKeys.set(keyId, {
        key,
        created: Date.now(),
        algorithm: this.config.encryptionAlgorithm
      });
      
      // Update current key ID
      this.currentKeyId = keyId;
      
      this.logger.info('Encryption keys rotated');
      
      // Emit event
      this.emit('keysRotated', { keyId });
      
      return keyId;
    } catch (error) {
      this.logger.error('Key rotation failed', error);
      throw new Error('Key rotation failed: ' + error.message);
    }
  }
  
  /**
   * Disposes of the security manager.
   */
  dispose() {
    // Clear sensitive data
    this.encryptionKeys.clear();
    this.currentKeyId = null;
    
    this.removeAllListeners();
    
    this.logger.info('SecurityManager disposed');
  }
}

module.exports = { SecurityManager };
