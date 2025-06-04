/**
 * @fileoverview ContextSecurityManager for protecting sensitive context data.
 * 
 * This module provides functionality for securing context data, enforcing privacy
 * policies, and managing access control for context operations.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLockAdapter } = require('../../../input/utils/EnhancedAsyncLockAdapter');
const crypto = require('crypto');

/**
 * ContextSecurityManager protects sensitive context data and enforces privacy policies.
 */
class ContextSecurityManager extends EventEmitter {
  /**
   * Constructor for ContextSecurityManager.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.securityManager Security manager for access control
   * @param {Object} options.mcpContextManager MCP Context Manager instance
   * @param {Object} options.contextPrioritizationSystem Context Prioritization System instance
   */
  constructor(options = {}) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for ContextSecurityManager');
    if (!options.logger) throw new Error('Logger is required for ContextSecurityManager');
    if (!options.configService) throw new Error('ConfigService is required for ContextSecurityManager');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for ContextSecurityManager');
    if (!options.securityManager) throw new Error('SecurityManager is required for ContextSecurityManager');
    if (!options.mcpContextManager) throw new Error('MCPContextManager is required for ContextSecurityManager');
    if (!options.contextPrioritizationSystem) throw new Error('ContextPrioritizationSystem is required for ContextSecurityManager');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.mcpContextManager = options.mcpContextManager;
    this.contextPrioritizationSystem = options.contextPrioritizationSystem;
    
    // Initialize state
    this.initialized = false;
    this.accessControlPolicies = new Map();
    this.encryptedContextData = new Map();
    this.securityMetadata = new Map();
    this.privacyPolicies = new Map();
    this.auditLog = [];
    this.retentionPolicies = new Map();
    this.sensitiveDataPatterns = new Map();
    
    // Default configuration
    this.config = {
      defaultAccessLevel: 'restricted',
      accessLevels: {
        public: 0,      // Accessible to all
        internal: 1,    // Accessible to internal components
        restricted: 2,  // Accessible to authorized components
        confidential: 3 // Accessible only to specific components
      },
      encryptionEnabled: true,
      defaultRetentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      auditLogEnabled: true,
      auditLogMaxSize: 1000,
      dataMinimizationEnabled: true,
      defaultEncryptionAlgorithm: 'aes-256-gcm'
    };
    
    // Create lock adapter for thread safety
    this.lockAdapter = new EnhancedAsyncLockAdapter();
    
    // Initialize locks
    this.locks = {
      access: this.lockAdapter,
      encryption: this.lockAdapter,
      policy: this.lockAdapter,
      audit: this.lockAdapter
    };
    
    this.logger.info('ContextSecurityManager created');
  }
  
  /**
   * Set security policy for a context type.
   * @param {string} contextType Context type
   * @param {Object} policy Security policy
   * @param {string} policy.accessLevel Access level (public, internal, restricted, confidential)
   * @param {Array<string>} policy.allowedSources List of allowed sources
   * @param {boolean} policy.encryptionRequired Whether encryption is required
   * @param {number} policy.retentionPeriod Retention period in milliseconds
   * @returns {Promise<boolean>} True if policy was set successfully
   */
  async setSecurityPolicy(contextType, policy) {
    try {
      this.logger.debug(`Setting security policy for context type: ${contextType}`);
      
      // Validate parameters
      if (!contextType) throw new Error('Context type is required');
      if (!policy) throw new Error('Policy is required');
      
      // Use lock to ensure thread safety
      await this.locks.policy.withLock('setSecurityPolicy', async () => {
        // Validate policy
        const accessLevel = policy.accessLevel || this.config.defaultAccessLevel;
        if (!this.config.accessLevels.hasOwnProperty(accessLevel)) {
          throw new Error(`Invalid access level: ${accessLevel}`);
        }
        
        // Store policy
        this.accessControlPolicies.set(contextType, {
          accessLevel,
          allowedSources: policy.allowedSources || [],
          encryptionRequired: policy.encryptionRequired !== undefined ? policy.encryptionRequired : this.config.encryptionEnabled,
          retentionPeriod: policy.retentionPeriod || this.config.defaultRetentionPeriod,
          timestamp: Date.now()
        });
        
        // Log policy change
        this._addAuditLogEntry({
          action: 'setPolicyChange',
          contextType,
          policy: this.accessControlPolicies.get(contextType),
          timestamp: Date.now()
        });
      });
      
      // Emit event
      this.emit('securityPolicyUpdated', {
        contextType,
        policy: this.accessControlPolicies.get(contextType),
        timestamp: Date.now()
      });
      
      this.logger.debug(`Security policy set for context type: ${contextType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set security policy: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Check access to context data.
   * @param {string} source Source requesting access
   * @param {string} contextType Context type
   * @returns {Promise<boolean>} True if access is allowed
   */
  async checkAccess(source, contextType) {
    try {
      this.logger.debug(`Checking access for context type: ${contextType}, source: ${source}`);
      
      // Use lock to ensure thread safety
      return await this.locks.access.withLock('checkAccess', async () => {
        // Get security policy for context type
        const policy = this.accessControlPolicies.get(contextType);
        if (!policy) {
          // No specific policy, use default access level
          const defaultAllowed = this.config.defaultAccessLevel === 'public';
          
          this.logger.debug(`No policy found for ${contextType}, using default access: ${defaultAllowed}`);
          
          // Log access attempt
          this._addAuditLogEntry({
            action: 'accessCheck',
            contextType,
            source,
            allowed: defaultAllowed,
            reason: 'default',
            timestamp: Date.now()
          });
          
          return defaultAllowed;
        }
        
        // Check if source is in allowed sources
        const allowed = policy.allowedSources.includes(source) || 
                        policy.accessLevel === 'public' ||
                        (policy.accessLevel === 'internal' && source.startsWith('internal.'));
        
        // Log access attempt
        this._addAuditLogEntry({
          action: 'accessCheck',
          contextType,
          source,
          allowed,
          reason: allowed ? 'policy' : 'denied',
          timestamp: Date.now()
        });
        
        this.logger.debug(`Access ${allowed ? 'allowed' : 'denied'} for ${contextType}, source: ${source}`);
        
        return allowed;
      });
    } catch (error) {
      this.logger.error(`Failed to check access: ${error.message}`, { error, contextType, source });
      return false;
    }
  }
  
  /**
   * Add entry to audit log.
   * @private
   * @param {Object} entry Audit log entry
   */
  _addAuditLogEntry(entry) {
    if (!this.config.auditLogEnabled) return;
    
    this.auditLog.push(entry);
    
    // Trim audit log if it exceeds maximum size
    if (this.auditLog.length > this.config.auditLogMaxSize) {
      this.auditLog = this.auditLog.slice(-this.config.auditLogMaxSize);
    }
  }
  
  /**
   * Initialize the context security manager.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing ContextSecurityManager');
      
      // Apply custom configuration if provided
      if (options.config) {
        this.config = { ...this.config, ...options.config };
      }
      
      // Load configuration from config service
      const configuredAccessLevels = this.configService.get('context.security.accessLevels');
      if (configuredAccessLevels) {
        this.config.accessLevels = { ...this.config.accessLevels, ...configuredAccessLevels };
      }
      
      // Initialize encryption keys
      await this._initializeEncryptionKeys();
      
      // Register sensitive data patterns
      this._registerSensitiveDataPatterns();
      
      // Set up event listeners
      this._setupEventListeners();
      
      // Register with MCP Context Manager
      await this.mcpContextManager.registerContextProvider('security.policies', this);
      
      // Also register with the standard name for test compatibility
      await this.mcpContextManager.registerContextProvider('security', this);
      
      this.initialized = true;
      this.logger.info('ContextSecurityManager initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize ContextSecurityManager: ${error.message}`, { error });
      this.initialized = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Initialize encryption keys.
   * @private
   * @returns {Promise<void>}
   */
  async _initializeEncryptionKeys() {
    try {
      this.logger.debug('Initializing encryption keys');
      
      // Get encryption key from security manager
      this.encryptionKey = await this.securityManager.getEncryptionKey('context');
      
      // If no key is available, generate a new one
      if (!this.encryptionKey) {
        this.logger.debug('No encryption key found, generating new key');
        
        // Generate a new encryption key
        this.encryptionKey = crypto.randomBytes(32); // 256-bit key
        
        // Store the key in security manager
        await this.securityManager.storeEncryptionKey('context', this.encryptionKey);
      }
      
      this.logger.debug('Encryption keys initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize encryption keys: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Register sensitive data patterns.
   * @private
   */
  _registerSensitiveDataPatterns() {
    try {
      this.logger.debug('Registering sensitive data patterns');
      
      // Register common sensitive data patterns
      this.sensitiveDataPatterns.set('email', {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: '[EMAIL REDACTED]'
      });
      
      this.sensitiveDataPatterns.set('phone', {
        pattern: /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
        replacement: '[PHONE REDACTED]'
      });
      
      this.sensitiveDataPatterns.set('ssn', {
        pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
        replacement: '[SSN REDACTED]'
      });
      
      this.sensitiveDataPatterns.set('creditCard', {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[CREDIT CARD REDACTED]'
      });
      
      this.sensitiveDataPatterns.set('password', {
        pattern: /\b(?:password|passwd|pwd)[\s:=]+\S+\b/gi,
        replacement: '[PASSWORD REDACTED]'
      });
      
      this.sensitiveDataPatterns.set('apiKey', {
        pattern: /\b(?:api[_-]?key|access[_-]?token)[\s:=]+\S+\b/gi,
        replacement: '[API KEY REDACTED]'
      });
      
      this.logger.debug('Sensitive data patterns registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register sensitive data patterns: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Set up event listeners for context operations.
   * @private
   */
  _setupEventListeners() {
    try {
      this.logger.debug('Setting up event listeners for context operations');
      
      // Listen for context update events from MCP Context Manager
      this.mcpContextManager.on('contextUpdated', this._handleContextUpdate.bind(this));
      
      // Listen for context request events from MCP Context Manager
      this.mcpContextManager.on('contextRequested', this._handleContextRequest.bind(this));
      
      // Listen for context access events from MCP Context Manager
      this.mcpContextManager.on('contextAccessed', this._handleContextAccess.bind(this));
      
      this.logger.debug('Event listeners set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up event listeners: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Handle context update events from MCP Context Manager.
   * @private
   * @param {Object} event Context update event
   */
  async _handleContextUpdate(event) {
    try {
      // Skip security metadata updates to avoid recursion
      if (event.contextType === 'security.metadata') {
        return;
      }
      
      this.logger.debug(`Handling context update for type: ${event.contextType}`);
      
      // Check if context contains sensitive data
      const containsSensitiveData = await this._checkForSensitiveData(event.contextData);
      
      // Apply data minimization if enabled and contains sensitive data
      let processedData = event.contextData;
      if (this.config.dataMinimizationEnabled && containsSensitiveData) {
        processedData = await this._applyDataMinimization(event.contextData);
      }
      
      // Check if context should be encrypted
      if (this.config.encryptionEnabled && (containsSensitiveData || this._shouldEncryptContextType(event.contextType))) {
        // Encrypt context data
        await this.encryptContext(event.contextType, processedData, event.source);
      }
      
      // Apply retention policy
      await this._applyRetentionPolicy(event.contextType);
      
      // Log audit event
      await this._logAuditEvent('update', event.contextType, event.source);
    } catch (error) {
      this.logger.error(`Failed to handle context update: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context request events from MCP Context Manager.
   * @private
   * @param {Object} event Context request event
   */
  async _handleContextRequest(event) {
    try {
      // Check if this is a request for security metadata
      if (event.contextType === 'security.metadata' || event.contextType.startsWith('security.')) {
        this.logger.debug(`Handling security metadata request for type: ${event.contextType}`);
        
        // Process security metadata request
        await this._processSecurityMetadataRequest(event.contextType, event.requestId, event.source);
      } else {
        // Check if we have encrypted data for this context type
        if (this.encryptedContextData.has(event.contextType)) {
          this.logger.debug(`Handling encrypted context request for type: ${event.contextType}`);
          
          // Check access control
          const hasAccess = await this.checkAccessControl(event.contextType, event.source);
          
          if (hasAccess) {
            // Decrypt and respond
            await this._processDecryptionRequest(event.contextType, event.requestId, event.source);
            
            // Log audit event
            await this._logAuditEvent('access', event.contextType, event.source, true);
          } else {
            // Log access denied
            await this._logAuditEvent('access_denied', event.contextType, event.source, false);
            
            // Respond with access denied
            await this.mcpContextManager.respondToContextRequest(requestId, {
              contextType: event.contextType,
              error: 'Access denied',
              timestamp: Date.now(),
              source: 'ContextSecurityManager'
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle context request: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Handle context access events from MCP Context Manager.
   * @private
   * @param {Object} event Context access event
   */
  async _handleContextAccess(event) {
    try {
      this.logger.debug(`Handling context access for type: ${event.contextType}`);
      
      // Log audit event
      await this._logAuditEvent('access', event.contextType, event.source, event.granted);
    } catch (error) {
      this.logger.error(`Failed to handle context access: ${error.message}`, { error, event });
    }
  }
  
  /**
   * Process security metadata request.
   * @private
   * @param {string} contextType Context type
   * @param {string} requestId Request ID
   * @param {string} source Source of the request
   */
  async _processSecurityMetadataRequest(contextType, requestId, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.access('processSecurityMetadataRequest', async () => {
        this.logger.debug(`Processing security metadata request for type: ${contextType}`);
        
        let contextData = null;
        
        if (contextType === 'security.metadata') {
          // Check if source has admin access
          const hasAdminAccess = await this.securityManager.checkPermission(source, 'admin');
          
          if (hasAdminAccess) {
            // Return all security metadata (without sensitive details)
            contextData = Object.fromEntries(
              Array.from(this.securityMetadata.entries()).map(([type, metadata]) => [
                type,
                {
                  accessLevel: metadata.accessLevel,
                  encrypted: metadata.encrypted,
                  containsSensitiveData: metadata.containsSensitiveData,
                  retentionPeriod: metadata.retentionPeriod,
                  createdAt: metadata.createdAt,
                  expiresAt: metadata.expiresAt
                }
              ])
            );
          } else {
            // Return limited metadata
            contextData = {
              message: 'Access to full security metadata requires admin permission'
            };
          }
        } else if (contextType.startsWith('security.')) {
          // Extract the specific context type
          const specificType = contextType.substring(9); // Remove 'security.' prefix
          
          // Check if source has access to this context type
          const hasAccess = await this.checkAccessControl(specificType, source);
          
          if (hasAccess) {
            const metadata = this.securityMetadata.get(specificType);
            
            if (metadata) {
              contextData = {
                accessLevel: metadata.accessLevel,
                encrypted: metadata.encrypted,
                containsSensitiveData: metadata.containsSensitiveData,
                retentionPeriod: metadata.retentionPeriod,
                createdAt: metadata.createdAt,
                expiresAt: metadata.expiresAt
              };
            }
          } else {
            contextData = {
              error: 'Access denied'
            };
          }
        }
        
        // Respond to request
        await this.mcpContextManager.respondToContextRequest(requestId, {
          contextType,
          contextData,
          timestamp: Date.now(),
          source: 'ContextSecurityManager'
        });
        
        this.logger.debug(`Security metadata request processed for type: ${contextType}`);
      });
    } catch (error) {
      this.logger.error(`Failed to process security metadata request: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Process decryption request.
   * @private
   * @param {string} contextType Context type
   * @param {string} requestId Request ID
   * @param {string} source Source of the request
   */
  async _processDecryptionRequest(contextType, requestId, source) {
    try {
      // Use lock to ensure thread safety
      await this.locks.encryption('processDecryptionRequest', async () => {
        this.logger.debug(`Processing decryption request for type: ${contextType}`);
        
        // Decrypt context data
        const contextData = await this.decryptContext(contextType);
        
        if (contextData) {
          // Respond to request
          await this.mcpContextManager.respondToContextRequest(requestId, {
            contextType,
            contextData,
            timestamp: Date.now(),
            source: 'ContextSecurityManager'
          });
          
          this.logger.debug(`Decryption request processed for type: ${contextType}`);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to process decryption request: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Check if context data contains sensitive information.
   * @private
   * @param {Object} contextData Context data
   * @returns {Promise<boolean>} True if context contains sensitive data
   */
  async _checkForSensitiveData(contextData) {
    try {
      // Skip check for null or undefined data
      if (contextData === null || contextData === undefined) {
        return false;
      }
      
      // Convert to string if not already
      const dataString = typeof contextData === 'string' 
        ? contextData 
        : JSON.stringify(contextData);
      
      // Check against sensitive data patterns
      for (const [patternName, patternInfo] of this.sensitiveDataPatterns.entries()) {
        if (patternInfo.pattern.test(dataString)) {
          this.logger.debug(`Detected sensitive data pattern: ${patternName}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to check for sensitive data: ${error.message}`, { error });
      return true; // Assume sensitive on error
    }
  }
  
  /**
   * Apply data minimization to context data.
   * @private
   * @param {Object} contextData Context data
   * @returns {Promise<Object>} Minimized context data
   */
  async _applyDataMinimization(contextData) {
    try {
      this.logger.debug('Applying data minimization');
      
      // Skip minimization for null or undefined data
      if (contextData === null || contextData === undefined) {
        return contextData;
      }
      
      // Handle different data types
      if (typeof contextData === 'string') {
        // Apply redaction to string
        return this._redactSensitiveData(contextData);
      } else if (typeof contextData === 'object') {
        // Convert to string
        const dataString = JSON.stringify(contextData);
        
        // Apply redaction
        const redactedString = this._redactSensitiveData(dataString);
        
        // Convert back to object
        try {
          return JSON.parse(redactedString);
        } catch (e) {
          // If parsing fails, return redacted string
          return redactedString;
        }
      } else {
        // For other types, return as is
        return contextData;
      }
    } catch (error) {
      this.logger.error(`Failed to apply data minimization: ${error.message}`, { error });
      return contextData; // Return original data on error
    }
  }
  
  /**
   * Redact sensitive data from text.
   * @private
   * @param {string} text Text to redact
   * @returns {string} Redacted text
   */
  _redactSensitiveData(text) {
    try {
      let redactedText = text;
      
      // Apply each pattern
      for (const [patternName, patternInfo] of this.sensitiveDataPatterns.entries()) {
        redactedText = redactedText.replace(patternInfo.pattern, patternInfo.replacement);
      }
      
      return redactedText;
    } catch (error) {
      this.logger.error(`Failed to redact sensitive data: ${error.message}`, { error });
      return text; // Return original text on error
    }
  }
  
  /**
   * Check if context type should be encrypted.
   * @private
   * @param {string} contextType Context type
   * @returns {boolean} True if context should be encrypted
   */
  _shouldEncryptContextType(contextType) {
    try {
      // Check if context type matches encryption patterns
      if (contextType.includes('credential') || 
          contextType.includes('password') || 
          contextType.includes('secret') || 
          contextType.includes('token') || 
          contextType.includes('key') ||
          contextType.includes('personal') ||
          contextType.includes('private')) {
        return true;
      }
      
      // Check access level
      const accessLevel = this._getAccessLevel(contextType);
      return accessLevel === 'confidential' || accessLevel === 'restricted';
    } catch (error) {
      this.logger.error(`Failed to check if context type should be encrypted: ${error.message}`, { error, contextType });
      return true; // Encrypt by default on error
    }
  }
  
  /**
   * Apply retention policy to context data.
   * @private
   * @param {string} contextType Context type
   * @returns {Promise<void>}
   */
  async _applyRetentionPolicy(contextType) {
    try {
      this.logger.debug(`Applying retention policy for context type: ${contextType}`);
      
      // Get retention period
      const retentionPeriod = this._getRetentionPeriod(contextType);
      
      // Calculate expiration time
      const now = Date.now();
      const expiresAt = now + retentionPeriod;
      
      // Update security metadata
      const metadata = this.securityMetadata.get(contextType) || {};
      metadata.retentionPeriod = retentionPeriod;
      metadata.createdAt = now;
      metadata.expiresAt = expiresAt;
      
      this.securityMetadata.set(contextType, metadata);
      
      // Schedule cleanup
      setTimeout(() => {
        this._cleanupExpiredContext(contextType).catch(error => {
          this.logger.error(`Failed to clean up expired context: ${error.message}`, { error, contextType });
        });
      }, retentionPeriod);
      
      this.logger.debug(`Retention policy applied for context type: ${contextType}, expires at: ${new Date(expiresAt).toISOString()}`);
    } catch (error) {
      this.logger.error(`Failed to apply retention policy: ${error.message}`, { error, contextType });
    }
  }
  
  /**
   * Clean up expired context data.
   * @private
   * @param {string} contextType Context type
   * @returns {Promise<void>}
   */
  async _cleanupExpiredContext(contextType) {
    try {
      this.logger.debug(`Cleaning up expired context for type: ${contextType}`);
      
      // Check if context has expired
      const metadata = this.securityMetadata.get(contextType);
      if (!metadata || !metadata.expiresAt) {
        return;
      }
      
      const now = Date.now();
      if (now >= metadata.expiresAt) {
        // Delete encrypted data
        this.encryptedContextData.delete(contextType);
        
        // Update metadata
        metadata.deleted = true;
        metadata.deletedAt = now;
        
        this.securityMetadata.set(contextType, metadata);
        
        // Log audit event
        await this._logAuditEvent('delete', contextType, 'retention_policy');
        
        this.logger.debug(`Expired context deleted for type: ${contextType}`);
        
        // Emit event
        this.emit('contextExpired', {
          contextType,
          timestamp: now
        });
      }
    } catch (error) {
      this.logger.error(`Failed to clean up expired context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Log audit event.
   * @private
   * @param {string} action Action performed
   * @param {string} contextType Context type
   * @param {string} source Source of the action
   * @param {boolean} success Whether the action was successful
   * @returns {Promise<void>}
   */
  async _logAuditEvent(action, contextType, source, success = true) {
    try {
      // Skip if audit logging is disabled
      if (!this.config.auditLogEnabled) {
        return;
      }
      
      // Use lock to ensure thread safety
      await this.locks.audit('logAuditEvent', async () => {
        this.logger.debug(`Logging audit event: ${action} on ${contextType} by ${source}`);
        
        // Create audit event
        const auditEvent = {
          timestamp: Date.now(),
          action,
          contextType,
          source,
          success,
          id: crypto.randomBytes(16).toString('hex')
        };
        
        // Add to audit log
        this.auditLog.push(auditEvent);
        
        // Trim audit log if it exceeds max size
        if (this.auditLog.length > this.config.auditLogMaxSize) {
          this.auditLog = this.auditLog.slice(-this.config.auditLogMaxSize);
        }
        
        // Emit event
        this.emit('auditEvent', auditEvent);
      });
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`, { error, action, contextType });
    }
  }
  
  /**
   * Get access level for a context type.
   * @private
   * @param {string} contextType Context type
   * @returns {string} Access level
   */
  _getAccessLevel(contextType) {
    try {
      // Check if we have a specific policy for this context type
      const policy = this.accessControlPolicies.get(contextType);
      if (policy && policy.accessLevel) {
        return policy.accessLevel;
      }
      
      // Check for pattern matches
      for (const [pattern, policy] of this.accessControlPolicies.entries()) {
        if (pattern.includes('*') && this._matchesPattern(contextType, pattern)) {
          return policy.accessLevel;
        }
      }
      
      // Return default access level
      return this.config.defaultAccessLevel;
    } catch (error) {
      this.logger.error(`Failed to get access level: ${error.message}`, { error, contextType });
      return this.config.defaultAccessLevel;
    }
  }
  
  /**
   * Get retention period for a context type.
   * @private
   * @param {string} contextType Context type
   * @returns {number} Retention period in milliseconds
   */
  _getRetentionPeriod(contextType) {
    try {
      // Check if we have a specific policy for this context type
      const policy = this.retentionPolicies.get(contextType);
      if (policy && policy.retentionPeriod) {
        return policy.retentionPeriod;
      }
      
      // Check for pattern matches
      for (const [pattern, policy] of this.retentionPolicies.entries()) {
        if (pattern.includes('*') && this._matchesPattern(contextType, pattern)) {
          return policy.retentionPeriod;
        }
      }
      
      // Return default retention period
      return this.config.defaultRetentionPeriod;
    } catch (error) {
      this.logger.error(`Failed to get retention period: ${error.message}`, { error, contextType });
      return this.config.defaultRetentionPeriod;
    }
  }
  
  /**
   * Check if a string matches a pattern with wildcards.
   * @private
   * @param {string} str String to check
   * @param {string} pattern Pattern with wildcards
   * @returns {boolean} True if string matches pattern
   */
  _matchesPattern(str, pattern) {
    try {
      // Convert pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      
      const regex = new RegExp(`^${regexPattern}$`);
      
      return regex.test(str);
    } catch (error) {
      this.logger.error(`Failed to match pattern: ${error.message}`, { error, str, pattern });
      return false;
    }
  }
  
  /**
   * Encrypt context data.
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @param {string} source Source of the context
   * @returns {Promise<boolean>} True if encryption was successful
   */
  async encryptContext(contextType, contextData, source) {
    try {
      this.logger.debug(`Encrypting context for type: ${contextType}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('contextEncryption');
      
      // Use lock to ensure thread safety
      return await this.locks.encryption('encryptContext', async () => {
        // Skip encryption for null or undefined data
        if (contextData === null || contextData === undefined) {
          this.logger.debug(`Skipping encryption for null or undefined data: ${contextType}`);
          return false;
        }
        
        // Convert to string if not already
        const dataString = typeof contextData === 'string' 
          ? contextData 
          : JSON.stringify(contextData);
        
        // Generate initialization vector
        const iv = crypto.randomBytes(16);
        
        // Encrypt data
        const cipher = crypto.createCipheriv(
          this.config.defaultEncryptionAlgorithm, 
          this.encryptionKey, 
          iv
        );
        
        let encryptedData = cipher.update(dataString, 'utf8', 'hex');
        encryptedData += cipher.final('hex');
        
        // Get authentication tag (for GCM mode)
        const authTag = cipher.getAuthTag ? cipher.getAuthTag() : null;
        
        // Create encrypted context object
        const encryptedContext = {
          algorithm: this.config.defaultEncryptionAlgorithm,
          iv: iv.toString('hex'),
          authTag: authTag ? authTag.toString('hex') : null,
          data: encryptedData,
          timestamp: Date.now()
        };
        
        // Store encrypted data
        this.encryptedContextData.set(contextType, encryptedContext);
        
        // Check if context contains sensitive data
        const containsSensitiveData = await this._checkForSensitiveData(contextData);
        
        // Get access level
        const accessLevel = this._getAccessLevel(contextType);
        
        // Update security metadata
        this.securityMetadata.set(contextType, {
          accessLevel,
          encrypted: true,
          containsSensitiveData,
          algorithm: this.config.defaultEncryptionAlgorithm,
          createdAt: Date.now(),
          source
        });
        
        // Apply retention policy
        await this._applyRetentionPolicy(contextType);
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextEncrypted', {
          contextType,
          timestamp: Date.now()
        });
        
        this.logger.debug(`Context encrypted for type: ${contextType}`);
        
        return true;
      });
    } catch (error) {
      this.logger.error(`Failed to encrypt context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Decrypt context data.
   * @param {string} contextType Context type
   * @returns {Promise<Object>} Decrypted context data
   */
  async decryptContext(contextType) {
    try {
      this.logger.debug(`Decrypting context for type: ${contextType}`);
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('contextDecryption');
      
      // Use lock to ensure thread safety
      return await this.locks.encryption('decryptContext', async () => {
        // Check if we have encrypted data for this context type
        if (!this.encryptedContextData.has(contextType)) {
          this.logger.debug(`No encrypted data found for type: ${contextType}`);
          return null;
        }
        
        // Get encrypted context
        const encryptedContext = this.encryptedContextData.get(contextType);
        
        // Extract encryption details
        const { algorithm, iv, authTag, data } = encryptedContext;
        
        // Convert hex to buffers
        const ivBuffer = Buffer.from(iv, 'hex');
        const authTagBuffer = authTag ? Buffer.from(authTag, 'hex') : null;
        
        // Decrypt data
        const decipher = crypto.createDecipheriv(
          algorithm, 
          this.encryptionKey, 
          ivBuffer
        );
        
        // Set authentication tag for GCM mode
        if (authTagBuffer && decipher.setAuthTag) {
          decipher.setAuthTag(authTagBuffer);
        }
        
        let decryptedData = decipher.update(data, 'hex', 'utf8');
        decryptedData += decipher.final('utf8');
        
        // Parse JSON if needed
        let resultData;
        try {
          resultData = JSON.parse(decryptedData);
        } catch (e) {
          // If not valid JSON, return as string
          resultData = decryptedData;
        }
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        // Emit event
        this.emit('contextDecrypted', {
          contextType,
          timestamp: Date.now()
        });
        
        this.logger.debug(`Context decrypted for type: ${contextType}`);
        
        return resultData;
      });
    } catch (error) {
      this.logger.error(`Failed to decrypt context: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Set access control policy for a context type.
   * @param {string} contextType Context type (supports wildcards)
   * @param {Object} policy Access control policy
   * @param {string} policy.accessLevel Access level
   * @param {Array<string>} policy.allowedSources List of allowed sources
   * @param {Array<string>} policy.allowedRoles List of allowed roles
   * @returns {Promise<boolean>} True if policy was set successfully
   */
  async setAccessControlPolicy(contextType, policy) {
    try {
      this.logger.debug(`Setting access control policy for type: ${contextType}`);
      
      // Validate parameters
      if (!contextType) throw new Error('Context type is required');
      if (!policy) throw new Error('Policy is required');
      if (!policy.accessLevel) throw new Error('Access level is required');
      
      // Use lock to ensure thread safety
      await this.locks.policy('setAccessControlPolicy', async () => {
        // Validate access level
        if (!this.config.accessLevels.hasOwnProperty(policy.accessLevel)) {
          throw new Error(`Invalid access level: ${policy.accessLevel}`);
        }
        
        // Set policy
        this.accessControlPolicies.set(contextType, {
          accessLevel: policy.accessLevel,
          allowedSources: policy.allowedSources || [],
          allowedRoles: policy.allowedRoles || []
        });
      });
      
      // Emit event
      this.emit('policyUpdated', {
        contextType,
        policyType: 'accessControl',
        timestamp: Date.now()
      });
      
      this.logger.debug(`Access control policy set for type: ${contextType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set access control policy: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Set retention policy for a context type.
   * @param {string} contextType Context type (supports wildcards)
   * @param {Object} policy Retention policy
   * @param {number} policy.retentionPeriod Retention period in milliseconds
   * @returns {Promise<boolean>} True if policy was set successfully
   */
  async setRetentionPolicy(contextType, policy) {
    try {
      this.logger.debug(`Setting retention policy for type: ${contextType}`);
      
      // Validate parameters
      if (!contextType) throw new Error('Context type is required');
      if (!policy) throw new Error('Policy is required');
      if (!policy.retentionPeriod) throw new Error('Retention period is required');
      
      // Use lock to ensure thread safety
      await this.locks.policy('setRetentionPolicy', async () => {
        // Validate retention period
        if (policy.retentionPeriod <= 0) {
          throw new Error('Retention period must be positive');
        }
        
        // Set policy
        this.retentionPolicies.set(contextType, {
          retentionPeriod: policy.retentionPeriod
        });
        
        // Update existing context data with this type
        if (this.securityMetadata.has(contextType)) {
          const metadata = this.securityMetadata.get(contextType);
          metadata.retentionPeriod = policy.retentionPeriod;
          metadata.expiresAt = metadata.createdAt + policy.retentionPeriod;
          
          this.securityMetadata.set(contextType, metadata);
        }
      });
      
      // Emit event
      this.emit('policyUpdated', {
        contextType,
        policyType: 'retention',
        timestamp: Date.now()
      });
      
      this.logger.debug(`Retention policy set for type: ${contextType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set retention policy: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Set privacy policy for a context type.
   * @param {string} contextType Context type (supports wildcards)
   * @param {Object} policy Privacy policy
   * @param {boolean} policy.minimizeData Whether to apply data minimization
   * @param {boolean} policy.encryptData Whether to encrypt data
   * @param {Array<string>} policy.sensitivePatterns List of sensitive data patterns to detect
   * @returns {Promise<boolean>} True if policy was set successfully
   */
  async setPrivacyPolicy(contextType, policy) {
    try {
      this.logger.debug(`Setting privacy policy for type: ${contextType}`);
      
      // Validate parameters
      if (!contextType) throw new Error('Context type is required');
      if (!policy) throw new Error('Policy is required');
      
      // Use lock to ensure thread safety
      await this.locks.policy('setPrivacyPolicy', async () => {
        // Set policy
        this.privacyPolicies.set(contextType, {
          minimizeData: policy.minimizeData !== undefined ? policy.minimizeData : true,
          encryptData: policy.encryptData !== undefined ? policy.encryptData : true,
          sensitivePatterns: policy.sensitivePatterns || []
        });
      });
      
      // Emit event
      this.emit('policyUpdated', {
        contextType,
        policyType: 'privacy',
        timestamp: Date.now()
      });
      
      this.logger.debug(`Privacy policy set for type: ${contextType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set privacy policy: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Check if a source has access to a context type.
   * @param {string} contextType Context type
   * @param {string} source Source requesting access
   * @returns {Promise<boolean>} True if access is allowed
   */
  async checkAccessControl(contextType, source) {
    try {
      this.logger.debug(`Checking access control for type: ${contextType}, source: ${source}`);
      
      // Use lock to ensure thread safety
      return await this.locks.access('checkAccessControl', async () => {
        // Get access level for context type
        const accessLevel = this._getAccessLevel(contextType);
        const accessLevelValue = this.config.accessLevels[accessLevel];
        
        // Get policy for context type
        const policy = this.accessControlPolicies.get(contextType);
        
        // Check source-specific access
        if (policy) {
          // Check if source is explicitly allowed
          if (policy.allowedSources && policy.allowedSources.includes(source)) {
            return true;
          }
          
          // Check if source has any of the allowed roles
          if (policy.allowedRoles && policy.allowedRoles.length > 0) {
            for (const role of policy.allowedRoles) {
              const hasRole = await this.securityManager.checkRole(source, role);
              if (hasRole) {
                return true;
              }
            }
          }
        }
        
        // Check access level permissions
        switch (accessLevel) {
          case 'public':
            // Public data is accessible to all
            return true;
            
          case 'internal':
            // Internal data is accessible to internal components
            return source.startsWith('internal.') || 
                   await this.securityManager.checkPermission(source, 'internal_access');
            
          case 'restricted':
            // Restricted data requires specific permission
            return await this.securityManager.checkPermission(source, 'restricted_access');
            
          case 'confidential':
            // Confidential data requires admin permission
            return await this.securityManager.checkPermission(source, 'admin');
            
          default:
            // Unknown access level
            this.logger.warn(`Unknown access level: ${accessLevel}`);
            return false;
        }
      });
    } catch (error) {
      this.logger.error(`Failed to check access control: ${error.message}`, { error, contextType, source });
      return false; // Deny access on error
    }
  }
  
  /**
   * Get security metadata for a context type.
   * @param {string} contextType Context type
   * @returns {Object} Security metadata
   */
  getSecurityMetadata(contextType) {
    try {
      this.logger.debug(`Getting security metadata for type: ${contextType}`);
      
      // Get metadata
      const metadata = this.securityMetadata.get(contextType);
      
      if (!metadata) {
        return null;
      }
      
      return {
        accessLevel: metadata.accessLevel,
        encrypted: metadata.encrypted,
        containsSensitiveData: metadata.containsSensitiveData,
        retentionPeriod: metadata.retentionPeriod,
        createdAt: metadata.createdAt,
        expiresAt: metadata.expiresAt
      };
    } catch (error) {
      this.logger.error(`Failed to get security metadata: ${error.message}`, { error, contextType });
      return null;
    }
  }
  
  /**
   * Get all security metadata.
   * @returns {Object} All security metadata
   */
  getAllSecurityMetadata() {
    try {
      this.logger.debug('Getting all security metadata');
      
      // Convert map to object
      return Object.fromEntries(
        Array.from(this.securityMetadata.entries()).map(([type, metadata]) => [
          type,
          {
            accessLevel: metadata.accessLevel,
            encrypted: metadata.encrypted,
            containsSensitiveData: metadata.containsSensitiveData,
            retentionPeriod: metadata.retentionPeriod,
            createdAt: metadata.createdAt,
            expiresAt: metadata.expiresAt
          }
        ])
      );
    } catch (error) {
      this.logger.error(`Failed to get all security metadata: ${error.message}`, { error });
      return {};
    }
  }
  
  /**
   * Get audit log entries.
   * @param {Object} options Query options
   * @param {number} options.limit Maximum number of entries to return
   * @param {number} options.offset Offset for pagination
   * @param {string} options.contextType Filter by context type
   * @param {string} options.action Filter by action
   * @param {string} options.source Filter by source
   * @param {boolean} options.success Filter by success
   * @returns {Array<Object>} Audit log entries
   */
  getAuditLog(options = {}) {
    try {
      this.logger.debug('Getting audit log entries');
      
      // Apply filters
      let filteredLog = this.auditLog;
      
      if (options.contextType) {
        filteredLog = filteredLog.filter(entry => entry.contextType === options.contextType);
      }
      
      if (options.action) {
        filteredLog = filteredLog.filter(entry => entry.action === options.action);
      }
      
      if (options.source) {
        filteredLog = filteredLog.filter(entry => entry.source === options.source);
      }
      
      if (options.success !== undefined) {
        filteredLog = filteredLog.filter(entry => entry.success === options.success);
      }
      
      // Sort by timestamp (newest first)
      filteredLog.sort((a, b) => b.timestamp - a.timestamp);
      
      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || filteredLog.length;
      
      return filteredLog.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error(`Failed to get audit log entries: ${error.message}`, { error });
      return [];
    }
  }
  
  /**
   * Register a sensitive data pattern.
   * @param {string} name Pattern name
   * @param {Object} patternInfo Pattern information
   * @param {RegExp} patternInfo.pattern Regular expression pattern
   * @param {string} patternInfo.replacement Replacement text
   * @returns {boolean} True if pattern was registered successfully
   */
  registerSensitiveDataPattern(name, patternInfo) {
    try {
      this.logger.debug(`Registering sensitive data pattern: ${name}`);
      
      // Validate parameters
      if (!name) throw new Error('Pattern name is required');
      if (!patternInfo) throw new Error('Pattern information is required');
      if (!patternInfo.pattern) throw new Error('Pattern is required');
      if (!patternInfo.replacement) throw new Error('Replacement is required');
      
      // Register pattern
      this.sensitiveDataPatterns.set(name, {
        pattern: patternInfo.pattern,
        replacement: patternInfo.replacement
      });
      
      this.logger.debug(`Sensitive data pattern registered: ${name}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register sensitive data pattern: ${error.message}`, { error, name });
      throw error;
    }
  }
  
  /**
   * Delete context data securely.
   * @param {string} contextType Context type
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteContextSecurely(contextType) {
    try {
      this.logger.debug(`Deleting context securely for type: ${contextType}`);
      
      // Use lock to ensure thread safety
      return await this.locks.encryption('deleteContextSecurely', async () => {
        // Delete encrypted data
        const hadData = this.encryptedContextData.delete(contextType);
        
        // Update metadata
        if (this.securityMetadata.has(contextType)) {
          const metadata = this.securityMetadata.get(contextType);
          metadata.deleted = true;
          metadata.deletedAt = Date.now();
          
          this.securityMetadata.set(contextType, metadata);
        }
        
        // Log audit event if data was deleted
        if (hadData) {
          await this._logAuditEvent('delete', contextType, 'manual_deletion');
          
          // Emit event
          this.emit('contextDeleted', {
            contextType,
            timestamp: Date.now()
          });
        }
        
        this.logger.debug(`Context deleted securely for type: ${contextType}`);
        
        return hadData;
      });
    } catch (error) {
      this.logger.error(`Failed to delete context securely: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Dispose of resources.
   * @returns {Promise<void>}
   */
  async dispose() {
    try {
      this.logger.info('Disposing ContextSecurityManager');
      
      // Clear all data
      this.accessControlPolicies.clear();
      this.encryptedContextData.clear();
      this.securityMetadata.clear();
      this.privacyPolicies.clear();
      this.auditLog = [];
      this.retentionPolicies.clear();
      this.sensitiveDataPatterns.clear();
      
      // Remove event listeners
      this.mcpContextManager.removeAllListeners('contextUpdated');
      this.mcpContextManager.removeAllListeners('contextRequested');
      this.mcpContextManager.removeAllListeners('contextAccessed');
      
      this.initialized = false;
      
      this.logger.info('ContextSecurityManager disposed successfully');
    } catch (error) {
      this.logger.error(`Failed to dispose ContextSecurityManager: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = ContextSecurityManager;
