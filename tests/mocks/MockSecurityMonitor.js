/**
 * MockSecurityMonitor.js
 * 
 * Mock implementation of the Security Monitor for testing the Error Recovery System.
 * This mock simulates the security validation and monitoring capabilities that would be 
 * provided by the actual Security Monitor.
 * 
 * @module tests/mocks/MockSecurityMonitor
 */

'use strict';

/**
 * Mock Security Monitor for testing
 */
class MockSecurityMonitor {
  /**
   * Creates a new MockSecurityMonitor instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.isInitialized = false;
    this.validationHistory = [];
    this.permissionHistory = [];
    this.auditHistory = [];
    
    // Configure mock behavior
    this.mockBehavior = {
      shouldSucceed: options.shouldSucceed !== false,
      shouldDelay: options.shouldDelay === true,
      delayMs: options.delayMs || 50,
      strictMode: options.strictMode === true,
      auditLevel: options.auditLevel || 'standard'
    };
    
    // Pre-configured permissions for testing
    this.mockPermissions = {
      'system_resource_access': {
        id: 'system_resource_access',
        level: 'standard',
        description: 'Access to system resources',
        granted: true
      },
      'network_modification': {
        id: 'network_modification',
        level: 'elevated',
        description: 'Modify network configurations',
        granted: false
      },
      'database_admin': {
        id: 'database_admin',
        level: 'admin',
        description: 'Administrative access to databases',
        granted: false
      },
      'file_system_write': {
        id: 'file_system_write',
        level: 'standard',
        description: 'Write access to file system',
        granted: true
      },
      'process_management': {
        id: 'process_management',
        level: 'elevated',
        description: 'Manage system processes',
        granted: true
      },
      'user_data_access': {
        id: 'user_data_access',
        level: 'sensitive',
        description: 'Access to user data',
        granted: false
      }
    };
    
    // Pre-configured security policies for testing
    this.mockPolicies = {
      'resource_access': {
        id: 'resource_access',
        rules: [
          {
            action: 'resource_switch',
            permission: 'system_resource_access',
            condition: { resourceType: '*' }
          },
          {
            action: 'resource_switch',
            permission: 'database_admin',
            condition: { resourceType: 'database' }
          }
        ]
      },
      'network_operations': {
        id: 'network_operations',
        rules: [
          {
            action: 'retry',
            permission: 'system_resource_access',
            condition: { target: 'network' }
          },
          {
            action: 'modify_network',
            permission: 'network_modification',
            condition: { operation: '*' }
          }
        ]
      },
      'data_operations': {
        id: 'data_operations',
        rules: [
          {
            action: 'read_data',
            permission: 'system_resource_access',
            condition: { dataType: 'system' }
          },
          {
            action: 'read_data',
            permission: 'user_data_access',
            condition: { dataType: 'user' }
          },
          {
            action: 'write_data',
            permission: 'file_system_write',
            condition: { dataType: '*' }
          }
        ]
      },
      'process_operations': {
        id: 'process_operations',
        rules: [
          {
            action: 'start_process',
            permission: 'process_management',
            condition: { processType: '*' }
          },
          {
            action: 'kill_process',
            permission: 'process_management',
            condition: { processType: '*' }
          }
        ]
      }
    };
  }
  
  /**
   * Initialize the mock security monitor
   * 
   * @returns {Promise<boolean>} Initialization result
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock Security Monitor initialization failure');
    }
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Validate a security operation
   * 
   * @param {Object} request - Validation request
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Validation result
   */
  async validateOperation(request, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock Security Monitor validation failure');
    }
    
    // Store validation request
    this.validationHistory.push({
      request,
      context,
      timestamp: Date.now()
    });
    
    // Process validation request
    const { action, parameters, securityLevel } = request;
    
    if (!action) {
      return {
        valid: false,
        reason: 'missing_action',
        message: 'Action is required for security validation'
      };
    }
    
    // Find applicable policy rules
    let applicableRules = [];
    
    for (const policy of Object.values(this.mockPolicies)) {
      const matchingRules = policy.rules.filter(rule => {
        // Match action
        if (rule.action !== action && rule.action !== '*') {
          return false;
        }
        
        // Match conditions if present
        if (rule.condition && parameters) {
          for (const [key, value] of Object.entries(rule.condition)) {
            if (value !== '*' && parameters[key] !== value) {
              return false;
            }
          }
        }
        
        return true;
      });
      
      applicableRules = [...applicableRules, ...matchingRules];
    }
    
    // If no rules found, use default behavior based on security level
    if (applicableRules.length === 0) {
      const isHighRisk = securityLevel === 'high';
      const isStrictMode = this.mockBehavior.strictMode;
      
      return {
        valid: !(isHighRisk || isStrictMode),
        reason: isHighRisk ? 'high_risk_no_rule' : (isStrictMode ? 'strict_mode_no_rule' : 'default_allow'),
        message: isHighRisk ? 'High-risk operation with no applicable security rules' : 
                (isStrictMode ? 'No applicable security rules found in strict mode' : 'Operation allowed by default'),
        requiresApproval: isHighRisk
      };
    }
    
    // Check permissions for all applicable rules
    const requiredPermissions = applicableRules.map(rule => rule.permission);
    const missingPermissions = [];
    
    for (const permissionId of requiredPermissions) {
      if (this.mockPermissions[permissionId] && !this.mockPermissions[permissionId].granted) {
        missingPermissions.push(permissionId);
      }
    }
    
    // Determine validation result
    const valid = missingPermissions.length === 0;
    const requiresApproval = securityLevel === 'high' || 
                            requiredPermissions.some(p => 
                              this.mockPermissions[p] && 
                              (this.mockPermissions[p].level === 'admin' || 
                               this.mockPermissions[p].level === 'sensitive'));
    
    // Create audit entry
    this._createAuditEntry({
      type: 'validation',
      action,
      parameters,
      securityLevel,
      result: valid ? 'allowed' : 'denied',
      requiredPermissions,
      missingPermissions
    });
    
    return {
      valid,
      reason: valid ? 'permission_granted' : 'permission_denied',
      message: valid ? 'Operation is allowed' : `Missing required permissions: ${missingPermissions.join(', ')}`,
      requiredPermissions,
      missingPermissions,
      requiresApproval
    };
  }
  
  /**
   * Request permission for an operation
   * 
   * @param {Object} request - Permission request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Permission result
   */
  async requestPermission(request, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 3));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock Security Monitor permission request failure');
    }
    
    // Store permission request
    this.permissionHistory.push({
      request,
      options,
      timestamp: Date.now()
    });
    
    // Process permission request
    const { permissions, reason, duration } = request;
    
    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return {
        granted: false,
        reason: 'missing_permissions',
        message: 'Permissions array is required for permission requests'
      };
    }
    
    // Check if permissions exist
    const nonExistentPermissions = permissions.filter(p => !this.mockPermissions[p]);
    
    if (nonExistentPermissions.length > 0) {
      return {
        granted: false,
        reason: 'unknown_permissions',
        message: `Unknown permissions requested: ${nonExistentPermissions.join(', ')}`
      };
    }
    
    // Determine if permissions should be granted
    const sensitivePermissions = permissions.filter(p => 
      this.mockPermissions[p].level === 'admin' || 
      this.mockPermissions[p].level === 'sensitive'
    );
    
    // Simulate user approval for sensitive permissions
    let userApproved = false;
    
    if (sensitivePermissions.length > 0 && !options.skipApproval) {
      // In a real system, this would prompt the user
      // For the mock, we'll simulate approval based on reason and options
      userApproved = reason && reason.length > 10 && Math.random() > 0.3;
      
      if (options.forceApproval) {
        userApproved = true;
      } else if (options.forceDenial) {
        userApproved = false;
      }
      
      // Add delay for user approval simulation
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 2));
    } else {
      userApproved = true;
    }
    
    // Grant permissions if approved
    if (userApproved) {
      // Temporarily grant permissions
      for (const permissionId of permissions) {
        if (this.mockPermissions[permissionId]) {
          this.mockPermissions[permissionId].granted = true;
          
          // If duration specified, schedule permission revocation
          if (duration) {
            setTimeout(() => {
              this.mockPermissions[permissionId].granted = false;
              
              // Create audit entry for revocation
              this._createAuditEntry({
                type: 'permission_revocation',
                permission: permissionId,
                reason: 'duration_expired',
                duration
              });
            }, duration);
          }
        }
      }
    }
    
    // Create audit entry
    this._createAuditEntry({
      type: 'permission_request',
      permissions,
      reason,
      duration,
      result: userApproved ? 'granted' : 'denied'
    });
    
    return {
      granted: userApproved,
      reason: userApproved ? 'approved' : 'denied',
      message: userApproved ? 'Permissions granted' : 'Permission request denied',
      expiresAt: duration ? Date.now() + duration : null
    };
  }
  
  /**
   * Check if an operation is permitted
   * 
   * @param {Object} request - Permission check request
   * @returns {Promise<Object>} Check result
   */
  async checkPermission(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock Security Monitor permission check failure');
    }
    
    // Process check request
    const { permission } = request;
    
    if (!permission) {
      return {
        permitted: false,
        reason: 'missing_permission',
        message: 'Permission ID is required for permission checks'
      };
    }
    
    // Check if permission exists
    if (!this.mockPermissions[permission]) {
      return {
        permitted: false,
        reason: 'unknown_permission',
        message: `Unknown permission: ${permission}`
      };
    }
    
    // Check if permission is granted
    const permitted = this.mockPermissions[permission].granted;
    
    return {
      permitted,
      reason: permitted ? 'permission_granted' : 'permission_denied',
      message: permitted ? 'Permission is granted' : 'Permission is denied',
      permissionDetails: {
        id: permission,
        level: this.mockPermissions[permission].level,
        description: this.mockPermissions[permission].description
      }
    };
  }
  
  /**
   * Get security audit logs
   * 
   * @param {Object} query - Audit query
   * @returns {Promise<Object>} Audit logs
   */
  async getAuditLogs(query = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock Security Monitor audit log failure');
    }
    
    // Filter logs based on query
    let filteredLogs = [...this.auditHistory];
    
    if (query.type) {
      filteredLogs = filteredLogs.filter(log => log.type === query.type);
    }
    
    if (query.result) {
      filteredLogs = filteredLogs.filter(log => log.result === query.result);
    }
    
    if (query.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime);
    }
    
    if (query.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime);
    }
    
    // Apply limit
    if (query.limit && filteredLogs.length > query.limit) {
      filteredLogs = filteredLogs.slice(0, query.limit);
    }
    
    return {
      success: true,
      logs: filteredLogs,
      count: filteredLogs.length,
      totalCount: this.auditHistory.length
    };
  }
  
  /**
   * Get security statistics
   * 
   * @returns {Object} Security statistics
   */
  getSecurityStatistics() {
    const validationCount = this.validationHistory.length;
    const permissionRequestCount = this.permissionHistory.length;
    const auditEntryCount = this.auditHistory.length;
    
    // Calculate approval rate
    const approvedRequests = this.permissionHistory.filter(
      entry => entry.result && entry.result.granted
    ).length;
    
    const approvalRate = permissionRequestCount > 0 ? 
      approvedRequests / permissionRequestCount : 0;
    
    // Calculate validation success rate
    const successfulValidations = this.validationHistory.filter(
      entry => entry.result && entry.result.valid
    ).length;
    
    const validationSuccessRate = validationCount > 0 ? 
      successfulValidations / validationCount : 0;
    
    return {
      validations: validationCount,
      permissionRequests: permissionRequestCount,
      auditEntries: auditEntryCount,
      approvalRate,
      validationSuccessRate,
      auditLevel: this.mockBehavior.auditLevel,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Reset the mock security monitor
   */
  reset() {
    this.validationHistory = [];
    this.permissionHistory = [];
    this.auditHistory = [];
    
    // Reset permissions to default state
    for (const permissionId in this.mockPermissions) {
      if (permissionId === 'system_resource_access' || permissionId === 'file_system_write' || permissionId === 'process_management') {
        this.mockPermissions[permissionId].granted = true;
      } else {
        this.mockPermissions[permissionId].granted = false;
      }
    }
  }
  
  /**
   * Create an audit entry
   * 
   * @param {Object} data - Audit data
   * @private
   */
  _createAuditEntry(data) {
    // Skip audit in minimal mode
    if (this.mockBehavior.auditLevel === 'minimal' && data.type !== 'permission_request') {
      return;
    }
    
    // Create audit entry
    const auditEntry = {
      ...data,
      timestamp: Date.now(),
      id: `audit_${this.auditHistory.length + 1}`
    };
    
    this.auditHistory.push(auditEntry);
  }
}

module.exports = MockSecurityMonitor;
