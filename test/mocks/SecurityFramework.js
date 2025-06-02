/**
 * @fileoverview Mock Security Framework for testing.
 * Provides mock implementations of security functionality.
 * 
 * @module test/mocks/SecurityFramework
 */

/**
 * Mock Security Framework
 */
class MockSecurityFramework {
  /**
   * Create a new Mock Security Framework
   */
  constructor() {
    this.encryptionCalls = [];
    this.decryptionCalls = [];
    this.authorizationCalls = [];
    this.auditLogs = [];
  }
  
  /**
   * Encrypt data
   * @param {Object|string} data - Data to encrypt
   * @param {Object} options - Encryption options
   * @returns {Promise<Object>} Encrypted data
   */
  async encrypt(data, options = {}) {
    this.encryptionCalls.push({ timestamp: new Date(), options });
    
    // Mock encrypted data with a prefix
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = `encrypted:${serialized}`;
    
    this._logAudit('encrypt', { success: true });
    
    return {
      encrypted,
      metadata: {
        algorithm: options.algorithm || 'AES-256',
        timestamp: new Date(),
        keyId: options.keyId || 'mock-key-1'
      }
    };
  }
  
  /**
   * Decrypt data
   * @param {string} encryptedData - Encrypted data
   * @param {Object} options - Decryption options
   * @returns {Promise<Object|string>} Decrypted data
   */
  async decrypt(encryptedData, options = {}) {
    this.decryptionCalls.push({ timestamp: new Date(), options });
    
    // Check if this is mock encrypted data
    if (!encryptedData.startsWith('encrypted:')) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Extract the original data
    const serialized = encryptedData.substring('encrypted:'.length);
    let decrypted;
    
    try {
      // Try to parse as JSON
      decrypted = JSON.parse(serialized);
    } catch (e) {
      // If not valid JSON, return as string
      decrypted = serialized;
    }
    
    this._logAudit('decrypt', { success: true });
    
    return decrypted;
  }
  
  /**
   * Authorize action
   * @param {string} action - Action to authorize
   * @param {Object} context - Authorization context
   * @returns {Promise<boolean>} Authorization result
   */
  async authorize(action, context = {}) {
    this.authorizationCalls.push({ action, context, timestamp: new Date() });
    
    // Mock authorization logic - allow most actions
    let authorized = true;
    
    // Deny specific sensitive actions unless proper context is provided
    if (action === 'delete_all' && !context.adminOverride) {
      authorized = false;
    }
    
    if (action === 'access_sensitive_data' && !context.userAuthenticated) {
      authorized = false;
    }
    
    this._logAudit('authorize', { action, authorized });
    
    return authorized;
  }
  
  /**
   * Validate data
   * @param {Object} data - Data to validate
   * @param {Object} schema - Validation schema
   * @returns {Promise<Object>} Validation result
   */
  async validate(data, schema = {}) {
    // Mock validation - always valid for testing
    return {
      valid: true,
      errors: []
    };
  }
  
  /**
   * Get audit logs
   * @param {Object} query - Query parameters
   * @returns {Promise<Array<Object>>} Audit logs
   */
  async getAuditLogs(query = {}) {
    return this.auditLogs;
  }
  
  /**
   * Log audit event
   * @param {string} action - Action performed
   * @param {Object} details - Event details
   * @private
   */
  _logAudit(action, details) {
    this.auditLogs.push({
      action,
      details,
      timestamp: new Date(),
      id: `audit-${this.auditLogs.length + 1}`
    });
  }
  
  /**
   * Get status
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    return {
      encryptionCallCount: this.encryptionCalls.length,
      decryptionCallCount: this.decryptionCalls.length,
      authorizationCallCount: this.authorizationCalls.length,
      auditLogCount: this.auditLogs.length,
      status: 'operational'
    };
  }
}

module.exports = MockSecurityFramework;
