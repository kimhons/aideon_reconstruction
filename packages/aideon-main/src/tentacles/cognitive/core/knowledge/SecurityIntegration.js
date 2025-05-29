/**
 * @fileoverview SecurityIntegration for the Knowledge Graph Manager.
 * Provides security integration for knowledge graph operations including
 * access control, encryption, and audit logging.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');

/**
 * Security operation types for audit logging.
 * @enum {string}
 */
const SecurityOperationType = {
  /**
   * Read operation.
   */
  READ: 'read',
  
  /**
   * Write operation.
   */
  WRITE: 'write',
  
  /**
   * Delete operation.
   */
  DELETE: 'delete',
  
  /**
   * Query operation.
   */
  QUERY: 'query',
  
  /**
   * Administrative operation.
   */
  ADMIN: 'admin'
};

/**
 * Access levels for knowledge graph entities.
 * @enum {string}
 */
const AccessLevel = {
  /**
   * No access.
   */
  NONE: 'none',
  
  /**
   * Read-only access.
   */
  READ: 'read',
  
  /**
   * Read and write access.
   */
  WRITE: 'write',
  
  /**
   * Full access including delete.
   */
  FULL: 'full',
  
  /**
   * Administrative access.
   */
  ADMIN: 'admin'
};

/**
 * Provides security integration for knowledge graph operations.
 */
class SecurityIntegration extends EventEmitter {
  /**
   * Creates a new SecurityIntegration instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} options.securityManager - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   */
  constructor(options = {}) {
    super();
    
    if (!options.securityManager) {
      throw new Error('SecurityIntegration requires a securityManager instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    
    this.initialized = false;
  }
  
  /**
   * Initializes the security integration.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing SecurityIntegration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('securityIntegration_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.security', {
          enableAccessControl: true,
          enableEncryption: true,
          enableAuditLogging: true,
          defaultAccessLevel: AccessLevel.READ,
          sensitivePropertyPatterns: [
            'password',
            'secret',
            'token',
            'key',
            'credential',
            'private'
          ]
        });
        
        this.config = config;
      } else {
        this.config = {
          enableAccessControl: true,
          enableEncryption: true,
          enableAuditLogging: true,
          defaultAccessLevel: AccessLevel.READ,
          sensitivePropertyPatterns: [
            'password',
            'secret',
            'token',
            'key',
            'credential',
            'private'
          ]
        };
      }
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('SecurityIntegration initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('SecurityIntegration initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`SecurityIntegration initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Checks if the current user has access to perform an operation.
   * 
   * @param {string} entityId - ID of the entity
   * @param {SecurityOperationType} operationType - Type of operation
   * @param {Object} [context={}] - Additional context
   * @returns {Promise<boolean>} - Whether access is granted
   */
  async checkAccess(entityId, operationType, context = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableAccessControl) {
      return true;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('securityIntegration_checkAccess');
    }
    
    try {
      // Get current user from security manager
      const currentUser = await this.securityManager.getCurrentUser();
      
      if (!currentUser) {
        if (this.logger) {
          this.logger.warn('Access check failed: No current user');
        }
        return false;
      }
      
      // Check if user is admin (has all access)
      if (currentUser.isAdmin) {
        return true;
      }
      
      // Get entity access control list
      const acl = await this.getEntityAcl(entityId);
      
      // Check user's access level
      const userAccessLevel = this.getUserAccessLevel(currentUser, acl);
      
      // Determine required access level for operation
      const requiredAccessLevel = this.getRequiredAccessLevel(operationType);
      
      // Compare access levels
      const hasAccess = this.compareAccessLevels(userAccessLevel, requiredAccessLevel) >= 0;
      
      if (!hasAccess && this.logger) {
        this.logger.warn('Access denied', {
          userId: currentUser.id,
          entityId,
          operationType,
          userAccessLevel,
          requiredAccessLevel
        });
      }
      
      // Log access check
      if (this.config.enableAuditLogging) {
        await this.logAccessCheck(currentUser.id, entityId, operationType, hasAccess, context);
      }
      
      return hasAccess;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Access check failed', { error: error.message, stack: error.stack });
      }
      
      // Default to deny on error
      return false;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Gets the access control list for an entity.
   * 
   * @private
   * @param {string} entityId - ID of the entity
   * @returns {Promise<Object>} - Access control list
   */
  async getEntityAcl(entityId) {
    try {
      // This would typically retrieve ACL from storage
      // For now, we'll use the security manager
      return await this.securityManager.getEntityAcl(entityId);
    } catch (error) {
      if (this.logger) {
        this.logger.warn(`Failed to get ACL for entity ${entityId}`, { error: error.message });
      }
      
      // Return default ACL
      return {
        defaultAccessLevel: this.config.defaultAccessLevel,
        userAccessLevels: {},
        roleAccessLevels: {}
      };
    }
  }
  
  /**
   * Gets the access level for a user based on ACL.
   * 
   * @private
   * @param {Object} user - User object
   * @param {Object} acl - Access control list
   * @returns {AccessLevel} - User's access level
   */
  getUserAccessLevel(user, acl) {
    // Check user-specific access level
    if (acl.userAccessLevels && acl.userAccessLevels[user.id]) {
      return acl.userAccessLevels[user.id];
    }
    
    // Check role-based access levels
    if (acl.roleAccessLevels && user.roles) {
      let highestAccessLevel = AccessLevel.NONE;
      
      for (const role of user.roles) {
        const roleAccessLevel = acl.roleAccessLevels[role];
        
        if (roleAccessLevel) {
          const comparison = this.compareAccessLevels(roleAccessLevel, highestAccessLevel);
          
          if (comparison > 0) {
            highestAccessLevel = roleAccessLevel;
          }
        }
      }
      
      if (highestAccessLevel !== AccessLevel.NONE) {
        return highestAccessLevel;
      }
    }
    
    // Return default access level
    return acl.defaultAccessLevel || this.config.defaultAccessLevel;
  }
  
  /**
   * Gets the required access level for an operation type.
   * 
   * @private
   * @param {SecurityOperationType} operationType - Type of operation
   * @returns {AccessLevel} - Required access level
   */
  getRequiredAccessLevel(operationType) {
    switch (operationType) {
      case SecurityOperationType.READ:
        return AccessLevel.READ;
      case SecurityOperationType.WRITE:
        return AccessLevel.WRITE;
      case SecurityOperationType.DELETE:
        return AccessLevel.FULL;
      case SecurityOperationType.ADMIN:
        return AccessLevel.ADMIN;
      case SecurityOperationType.QUERY:
        return AccessLevel.READ;
      default:
        return AccessLevel.READ;
    }
  }
  
  /**
   * Compares two access levels.
   * 
   * @private
   * @param {AccessLevel} a - First access level
   * @param {AccessLevel} b - Second access level
   * @returns {number} - Comparison result (-1, 0, or 1)
   */
  compareAccessLevels(a, b) {
    const levels = {
      [AccessLevel.NONE]: 0,
      [AccessLevel.READ]: 1,
      [AccessLevel.WRITE]: 2,
      [AccessLevel.FULL]: 3,
      [AccessLevel.ADMIN]: 4
    };
    
    const levelA = levels[a] || 0;
    const levelB = levels[b] || 0;
    
    return Math.sign(levelA - levelB);
  }
  
  /**
   * Logs an access check.
   * 
   * @private
   * @param {string} userId - ID of the user
   * @param {string} entityId - ID of the entity
   * @param {SecurityOperationType} operationType - Type of operation
   * @param {boolean} granted - Whether access was granted
   * @param {Object} context - Additional context
   * @returns {Promise<void>}
   */
  async logAccessCheck(userId, entityId, operationType, granted, context) {
    try {
      const logEntry = {
        timestamp: Date.now(),
        userId,
        entityId,
        operationType,
        granted,
        context
      };
      
      await this.securityManager.logSecurityEvent('access_check', logEntry);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to log access check', { error: error.message });
      }
    }
  }
  
  /**
   * Encrypts sensitive properties in an object.
   * 
   * @param {Object} data - Data to encrypt
   * @returns {Promise<Object>} - Data with encrypted properties
   */
  async encryptSensitiveData(data) {
    this.ensureInitialized();
    
    if (!this.config.enableEncryption) {
      return data;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('securityIntegration_encryptSensitiveData');
    }
    
    try {
      // Clone the data
      const result = JSON.parse(JSON.stringify(data));
      
      // Process properties recursively
      await this.processObjectProperties(result, async (key, value) => {
        if (this.isSensitiveProperty(key) && typeof value === 'string') {
          return await this.securityManager.encrypt(value);
        }
        return value;
      });
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to encrypt sensitive data', { error: error.message, stack: error.stack });
      }
      
      // Return original data on error
      return data;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Decrypts sensitive properties in an object.
   * 
   * @param {Object} data - Data to decrypt
   * @returns {Promise<Object>} - Data with decrypted properties
   */
  async decryptSensitiveData(data) {
    this.ensureInitialized();
    
    if (!this.config.enableEncryption) {
      return data;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('securityIntegration_decryptSensitiveData');
    }
    
    try {
      // Clone the data
      const result = JSON.parse(JSON.stringify(data));
      
      // Process properties recursively
      await this.processObjectProperties(result, async (key, value) => {
        if (this.isSensitiveProperty(key) && typeof value === 'string') {
          try {
            return await this.securityManager.decrypt(value);
          } catch (e) {
            // If decryption fails, it might not be encrypted
            return value;
          }
        }
        return value;
      });
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to decrypt sensitive data', { error: error.message, stack: error.stack });
      }
      
      // Return original data on error
      return data;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Processes object properties recursively.
   * 
   * @private
   * @param {Object} obj - Object to process
   * @param {Function} processor - Property processor function
   * @returns {Promise<void>}
   */
  async processObjectProperties(obj, processor) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    const promises = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        // Recursively process nested objects
        promises.push(this.processObjectProperties(value, processor));
      } else {
        // Process leaf property
        promises.push((async () => {
          obj[key] = await processor(key, value);
        })());
      }
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Checks if a property is sensitive.
   * 
   * @private
   * @param {string} key - Property key
   * @returns {boolean} - Whether the property is sensitive
   */
  isSensitiveProperty(key) {
    const patterns = this.config.sensitivePropertyPatterns || [];
    
    return patterns.some(pattern => {
      if (typeof pattern === 'string') {
        return key.toLowerCase().includes(pattern.toLowerCase());
      } else if (pattern instanceof RegExp) {
        return pattern.test(key);
      }
      return false;
    });
  }
  
  /**
   * Logs an operation for audit purposes.
   * 
   * @param {SecurityOperationType} operationType - Type of operation
   * @param {Object} details - Operation details
   * @returns {Promise<void>}
   */
  async logOperation(operationType, details) {
    this.ensureInitialized();
    
    if (!this.config.enableAuditLogging) {
      return;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('securityIntegration_logOperation');
    }
    
    try {
      // Get current user from security manager
      const currentUser = await this.securityManager.getCurrentUser();
      
      const logEntry = {
        timestamp: Date.now(),
        userId: currentUser ? currentUser.id : 'system',
        operationType,
        details
      };
      
      await this.securityManager.logSecurityEvent('operation', logEntry);
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to log operation', { error: error.message, stack: error.stack });
      }
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Sanitizes data for output, removing sensitive information.
   * 
   * @param {Object} data - Data to sanitize
   * @returns {Object} - Sanitized data
   */
  sanitizeData(data) {
    this.ensureInitialized();
    
    try {
      // Clone the data
      const result = JSON.parse(JSON.stringify(data));
      
      // Process properties recursively
      this.processObjectPropertiesSync(result, (key, value) => {
        if (this.isSensitiveProperty(key)) {
          return '[REDACTED]';
        }
        return value;
      });
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to sanitize data', { error: error.message, stack: error.stack });
      }
      
      // Return empty object on error
      return {};
    }
  }
  
  /**
   * Processes object properties recursively (synchronous version).
   * 
   * @private
   * @param {Object} obj - Object to process
   * @param {Function} processor - Property processor function
   */
  processObjectPropertiesSync(obj, processor) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        // Recursively process nested objects
        this.processObjectPropertiesSync(value, processor);
      } else {
        // Process leaf property
        obj[key] = processor(key, value);
      }
    }
  }
  
  /**
   * Ensures the integration is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the integration is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('SecurityIntegration is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Shuts down the security integration.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down SecurityIntegration');
    }
    
    this.initialized = false;
    
    this.emit('shutdown');
  }
}

module.exports = { SecurityIntegration, SecurityOperationType, AccessLevel };
