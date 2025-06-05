/**
 * StrategySecurityFramework.js
 * 
 * Provides security validation and enforcement for recovery strategies.
 * This component ensures that recovery strategies adhere to security policies,
 * have appropriate permissions, and don't introduce security vulnerabilities.
 * 
 * @module src/core/error_recovery/security/StrategySecurityFramework
 */

'use strict';

/**
 * Class responsible for strategy security validation and enforcement
 */
class StrategySecurityFramework {
  /**
   * Creates a new StrategySecurityFramework instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.permissionManager - Permission manager for checking permissions
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.permissionManager = options.permissionManager;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.strictMode = this.config.strictMode === true;
    this.requireUserApproval = this.config.requireUserApproval || ['high_risk', 'system_modification'];
    this.maxRiskLevel = this.config.maxRiskLevel || 'medium';
    this.auditLevel = this.config.auditLevel || 'standard';
    
    this.securityPolicies = this.config.securityPolicies || this._getDefaultSecurityPolicies();
    this.riskLevels = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the security framework
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    if (!this.enabled) {
      this.isInitialized = true;
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('security:policy:updated', this._handlePolicyUpdate.bind(this));
      this.eventBus.on('user:approval:received', this._handleUserApproval.bind(this));
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'StrategySecurityFramework',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the security framework
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Validate a strategy against security policies
   * 
   * @param {Object} strategy - Strategy to validate
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   */
  async validateStrategy(strategy, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !strategy) {
      return { valid: true, reason: 'security_disabled' };
    }
    
    // Basic strategy validation
    if (!this._validateStrategyStructure(strategy)) {
      return { 
        valid: false, 
        reason: 'invalid_structure',
        message: 'Strategy structure is invalid or incomplete'
      };
    }
    
    // Risk assessment
    const riskAssessment = this._assessRisk(strategy, context);
    
    // Check if risk level exceeds maximum allowed
    if (this.riskLevels[riskAssessment.level] > this.riskLevels[this.maxRiskLevel]) {
      return {
        valid: false,
        reason: 'risk_too_high',
        message: `Strategy risk level (${riskAssessment.level}) exceeds maximum allowed (${this.maxRiskLevel})`,
        riskAssessment
      };
    }
    
    // Permission validation
    const permissionResult = this._validatePermissions(strategy, context);
    if (!permissionResult.valid) {
      return permissionResult;
    }
    
    // Policy validation
    const policyResult = this._validateAgainstPolicies(strategy, context);
    if (!policyResult.valid) {
      return policyResult;
    }
    
    // Check if user approval is required
    const approvalRequired = this._isUserApprovalRequired(strategy, riskAssessment);
    
    // Create validation result
    const result = {
      valid: true,
      riskAssessment,
      approvalRequired,
      auditRecord: this._createAuditRecord(strategy, context, riskAssessment)
    };
    
    // If user approval is required but not yet granted, mark as pending
    if (approvalRequired && !this._hasUserApproval(strategy, context)) {
      result.valid = false;
      result.reason = 'approval_required';
      result.message = 'User approval required for this strategy';
      result.pendingApproval = true;
    }
    
    return result;
  }
  
  /**
   * Request user approval for a strategy
   * 
   * @param {Object} strategy - Strategy requiring approval
   * @param {Object} context - Approval context
   * @returns {Promise<Object>} Approval result
   */
  async requestUserApproval(strategy, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.eventBus) {
      return { approved: false, reason: 'event_bus_unavailable' };
    }
    
    const approvalId = `approval_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Create approval request
    const approvalRequest = {
      id: approvalId,
      timestamp: Date.now(),
      strategy: {
        id: strategy.id,
        type: strategy.type,
        description: strategy.description,
        actions: strategy.actions ? strategy.actions.map(a => ({
          type: a.type,
          description: a.description
        })) : []
      },
      riskAssessment: this._assessRisk(strategy, context),
      context: {
        errorType: context.errorType,
        priority: context.priority,
        environment: context.environment
      }
    };
    
    // Emit approval request event
    this.eventBus.emit('security:approval:requested', approvalRequest);
    
    // Return promise that resolves when approval is received or rejected
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.eventBus.removeAllListeners(`approval:${approvalId}:received`);
        resolve({ approved: false, reason: 'timeout' });
      }, 30000); // 30 second timeout
      
      this.eventBus.once(`approval:${approvalId}:received`, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }
  
  /**
   * Check if a strategy has already been approved
   * 
   * @param {Object} strategy - Strategy to check
   * @param {Object} context - Check context
   * @returns {boolean} Whether strategy is approved
   */
  async isStrategyApproved(strategy, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategy || !strategy.id) {
      return false;
    }
    
    return this._hasUserApproval(strategy, context);
  }
  
  /**
   * Get security policies
   * 
   * @returns {Array} Security policies
   */
  async getSecurityPolicies() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return [...this.securityPolicies];
  }
  
  /**
   * Update security policies
   * 
   * @param {Array} policies - New security policies
   * @returns {boolean} Whether update was successful
   */
  async updateSecurityPolicies(policies) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!Array.isArray(policies)) {
      return false;
    }
    
    this.securityPolicies = [...policies];
    
    // Emit policy updated event if event bus is available
    if (this.eventBus) {
      this.eventBus.emit('security:policy:updated', {
        policies: this.securityPolicies,
        timestamp: Date.now()
      });
    }
    
    return true;
  }
  
  /**
   * Handle policy update event
   * 
   * @param {Object} data - Policy update data
   * @private
   */
  _handlePolicyUpdate(data) {
    if (data && Array.isArray(data.policies)) {
      this.securityPolicies = [...data.policies];
    }
  }
  
  /**
   * Handle user approval event
   * 
   * @param {Object} data - Approval data
   * @private
   */
  _handleUserApproval(data) {
    if (!data || !data.approvalId) {
      return;
    }
    
    // Emit approval received event
    this.eventBus.emit(`approval:${data.approvalId}:received`, {
      approved: data.approved === true,
      reason: data.reason || (data.approved ? 'user_approved' : 'user_rejected'),
      timestamp: Date.now()
    });
  }
  
  /**
   * Validate strategy structure
   * 
   * @param {Object} strategy - Strategy to validate
   * @returns {boolean} Whether structure is valid
   * @private
   */
  _validateStrategyStructure(strategy) {
    if (!strategy || typeof strategy !== 'object') {
      return false;
    }
    
    // Check required fields
    if (!strategy.id || !strategy.type || !strategy.description) {
      return false;
    }
    
    // Check actions
    if (!Array.isArray(strategy.actions) || strategy.actions.length === 0) {
      return false;
    }
    
    // Check each action
    for (const action of strategy.actions) {
      if (!action.type || !action.description) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Assess risk of a strategy
   * 
   * @param {Object} strategy - Strategy to assess
   * @param {Object} context - Assessment context
   * @returns {Object} Risk assessment
   * @private
   */
  _assessRisk(strategy, context = {}) {
    if (!strategy) {
      return { level: 'unknown', score: 0, factors: [] };
    }
    
    const factors = [];
    let riskScore = 0;
    
    // Base risk by strategy type
    switch (strategy.type) {
      case 'system_restart':
        riskScore += 3;
        factors.push({ name: 'system_restart', impact: 3 });
        break;
      case 'file_modification':
        riskScore += 2;
        factors.push({ name: 'file_modification', impact: 2 });
        break;
      case 'process_termination':
        riskScore += 2;
        factors.push({ name: 'process_termination', impact: 2 });
        break;
      case 'network_reconfiguration':
        riskScore += 2;
        factors.push({ name: 'network_reconfiguration', impact: 2 });
        break;
      case 'service_restart':
        riskScore += 1;
        factors.push({ name: 'service_restart', impact: 1 });
        break;
      case 'retry':
        riskScore += 0;
        factors.push({ name: 'retry', impact: 0 });
        break;
      default:
        riskScore += 1;
        factors.push({ name: 'unknown_type', impact: 1 });
    }
    
    // Risk by action types
    if (Array.isArray(strategy.actions)) {
      for (const action of strategy.actions) {
        switch (action.type) {
          case 'system_call':
            riskScore += 2;
            factors.push({ name: 'system_call', impact: 2 });
            break;
          case 'file_write':
            riskScore += 2;
            factors.push({ name: 'file_write', impact: 2 });
            break;
          case 'process_kill':
            riskScore += 2;
            factors.push({ name: 'process_kill', impact: 2 });
            break;
          case 'network_config':
            riskScore += 2;
            factors.push({ name: 'network_config', impact: 2 });
            break;
          case 'service_control':
            riskScore += 1;
            factors.push({ name: 'service_control', impact: 1 });
            break;
          case 'api_call':
            riskScore += 1;
            factors.push({ name: 'api_call', impact: 1 });
            break;
          case 'ui_interaction':
            riskScore += 1;
            factors.push({ name: 'ui_interaction', impact: 1 });
            break;
        }
      }
    }
    
    // Risk by context
    if (context.priority === 'high') {
      riskScore -= 1;
      factors.push({ name: 'high_priority', impact: -1 });
    }
    
    if (context.errorType === 'critical') {
      riskScore -= 1;
      factors.push({ name: 'critical_error', impact: -1 });
    }
    
    // Determine risk level
    let riskLevel;
    if (riskScore <= 1) {
      riskLevel = 'low';
    } else if (riskScore <= 3) {
      riskLevel = 'medium';
    } else if (riskScore <= 5) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }
    
    return {
      level: riskLevel,
      score: riskScore,
      factors
    };
  }
  
  /**
   * Validate strategy permissions
   * 
   * @param {Object} strategy - Strategy to validate
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   * @private
   */
  _validatePermissions(strategy, context = {}) {
    if (!this.permissionManager || !strategy) {
      return { valid: true, reason: 'permission_check_skipped' };
    }
    
    try {
      // Check permissions for each action
      if (Array.isArray(strategy.actions)) {
        for (const action of strategy.actions) {
          const permission = this._getRequiredPermission(action);
          
          if (permission && !this.permissionManager.hasPermission(permission, context)) {
            return {
              valid: false,
              reason: 'permission_denied',
              message: `Permission denied: ${permission} required for action ${action.type}`,
              permission
            };
          }
        }
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: 'permission_check_error',
        message: `Error checking permissions: ${error.message}`
      };
    }
  }
  
  /**
   * Validate strategy against security policies
   * 
   * @param {Object} strategy - Strategy to validate
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   * @private
   */
  _validateAgainstPolicies(strategy, context = {}) {
    if (!Array.isArray(this.securityPolicies) || this.securityPolicies.length === 0) {
      return { valid: true, reason: 'no_policies' };
    }
    
    // Check each policy
    for (const policy of this.securityPolicies) {
      if (!policy.enabled) {
        continue;
      }
      
      // Skip policy if conditions don't match
      if (policy.conditions && !this._matchesConditions(policy.conditions, strategy, context)) {
        continue;
      }
      
      // Check if policy denies the strategy
      if (policy.action === 'deny') {
        return {
          valid: false,
          reason: 'policy_violation',
          message: policy.message || 'Strategy violates security policy',
          policy: policy.id
        };
      }
      
      // Check if policy requires approval
      if (policy.action === 'require_approval') {
        if (!this._hasUserApproval(strategy, context)) {
          return {
            valid: false,
            reason: 'approval_required',
            message: policy.message || 'User approval required by security policy',
            policy: policy.id,
            pendingApproval: true
          };
        }
      }
      
      // Check if policy adds restrictions
      if (policy.action === 'restrict' && Array.isArray(policy.restrictions)) {
        for (const restriction of policy.restrictions) {
          if (!this._meetsRestriction(restriction, strategy, context)) {
            return {
              valid: false,
              reason: 'restriction_violation',
              message: restriction.message || 'Strategy violates security restriction',
              policy: policy.id,
              restriction: restriction.id
            };
          }
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Check if user approval is required for a strategy
   * 
   * @param {Object} strategy - Strategy to check
   * @param {Object} riskAssessment - Risk assessment
   * @returns {boolean} Whether approval is required
   * @private
   */
  _isUserApprovalRequired(strategy, riskAssessment) {
    if (!strategy || !riskAssessment) {
      return false;
    }
    
    // Check if risk level requires approval
    if (this.requireUserApproval.includes(riskAssessment.level)) {
      return true;
    }
    
    // Check if strategy type requires approval
    if (this.requireUserApproval.includes(strategy.type)) {
      return true;
    }
    
    // Check if any action type requires approval
    if (Array.isArray(strategy.actions)) {
      for (const action of strategy.actions) {
        if (this.requireUserApproval.includes(action.type)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if a strategy has user approval
   * 
   * @param {Object} strategy - Strategy to check
   * @param {Object} context - Check context
   * @returns {boolean} Whether strategy is approved
   * @private
   */
  _hasUserApproval(strategy, context = {}) {
    // In a real implementation, this would check an approval database or cache
    // For now, we'll assume no approvals exist
    return false;
  }
  
  /**
   * Get required permission for an action
   * 
   * @param {Object} action - Action to check
   * @returns {string|null} Required permission or null
   * @private
   */
  _getRequiredPermission(action) {
    if (!action || !action.type) {
      return null;
    }
    
    switch (action.type) {
      case 'system_call':
        return 'system:execute';
      case 'file_write':
        return 'file:write';
      case 'process_kill':
        return 'process:terminate';
      case 'network_config':
        return 'network:configure';
      case 'service_control':
        return 'service:control';
      case 'api_call':
        return 'api:access';
      case 'ui_interaction':
        return 'ui:interact';
      default:
        return null;
    }
  }
  
  /**
   * Check if strategy matches conditions
   * 
   * @param {Object} conditions - Conditions to check
   * @param {Object} strategy - Strategy to check
   * @param {Object} context - Check context
   * @returns {boolean} Whether conditions match
   * @private
   */
  _matchesConditions(conditions, strategy, context = {}) {
    if (!conditions || typeof conditions !== 'object') {
      return true;
    }
    
    // Check strategy type
    if (conditions.strategyType && strategy.type !== conditions.strategyType) {
      return false;
    }
    
    // Check risk level
    if (conditions.minRiskLevel || conditions.maxRiskLevel) {
      const riskAssessment = this._assessRisk(strategy, context);
      const riskLevel = this.riskLevels[riskAssessment.level] || 0;
      
      if (conditions.minRiskLevel && riskLevel < this.riskLevels[conditions.minRiskLevel]) {
        return false;
      }
      
      if (conditions.maxRiskLevel && riskLevel > this.riskLevels[conditions.maxRiskLevel]) {
        return false;
      }
    }
    
    // Check action types
    if (Array.isArray(conditions.actionTypes) && conditions.actionTypes.length > 0) {
      if (!Array.isArray(strategy.actions)) {
        return false;
      }
      
      const actionTypes = strategy.actions.map(a => a.type);
      const hasMatchingAction = conditions.actionTypes.some(type => actionTypes.includes(type));
      
      if (!hasMatchingAction) {
        return false;
      }
    }
    
    // Check context
    if (conditions.context && typeof conditions.context === 'object') {
      for (const [key, value] of Object.entries(conditions.context)) {
        if (context[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Check if strategy meets a restriction
   * 
   * @param {Object} restriction - Restriction to check
   * @param {Object} strategy - Strategy to check
   * @param {Object} context - Check context
   * @returns {boolean} Whether restriction is met
   * @private
   */
  _meetsRestriction(restriction, strategy, context = {}) {
    if (!restriction || typeof restriction !== 'object') {
      return true;
    }
    
    // Check max actions
    if (restriction.maxActions !== undefined && 
        Array.isArray(strategy.actions) && 
        strategy.actions.length > restriction.maxActions) {
      return false;
    }
    
    // Check forbidden action types
    if (Array.isArray(restriction.forbiddenActionTypes) && 
        Array.isArray(strategy.actions)) {
      const actionTypes = strategy.actions.map(a => a.type);
      const hasForbiddenAction = restriction.forbiddenActionTypes.some(type => 
        actionTypes.includes(type)
      );
      
      if (hasForbiddenAction) {
        return false;
      }
    }
    
    // Check required approvals
    if (restriction.requireApproval === true && 
        !this._hasUserApproval(strategy, context)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Create audit record for a strategy validation
   * 
   * @param {Object} strategy - Validated strategy
   * @param {Object} context - Validation context
   * @param {Object} riskAssessment - Risk assessment
   * @returns {Object} Audit record
   * @private
   */
  _createAuditRecord(strategy, context, riskAssessment) {
    if (this.auditLevel === 'none') {
      return null;
    }
    
    const record = {
      timestamp: Date.now(),
      strategyId: strategy.id,
      strategyType: strategy.type,
      riskLevel: riskAssessment.level,
      riskScore: riskAssessment.score,
      context: {
        errorType: context.errorType,
        priority: context.priority,
        environment: context.environment
      }
    };
    
    if (this.auditLevel === 'detailed') {
      record.actions = strategy.actions ? strategy.actions.map(a => ({
        type: a.type,
        description: a.description
      })) : [];
      
      record.riskFactors = riskAssessment.factors;
    }
    
    return record;
  }
  
  /**
   * Get default security policies
   * 
   * @returns {Array} Default security policies
   * @private
   */
  _getDefaultSecurityPolicies() {
    return [
      {
        id: 'high_risk_approval',
        name: 'High Risk Approval',
        description: 'Require approval for high risk strategies',
        enabled: true,
        conditions: {
          minRiskLevel: 'high'
        },
        action: 'require_approval',
        message: 'High risk strategy requires user approval'
      },
      {
        id: 'system_restart_restriction',
        name: 'System Restart Restriction',
        description: 'Restrict system restart strategies',
        enabled: true,
        conditions: {
          strategyType: 'system_restart'
        },
        action: 'restrict',
        restrictions: [
          {
            id: 'critical_only',
            description: 'Only allow for critical errors',
            context: {
              errorType: 'critical'
            },
            message: 'System restart only allowed for critical errors'
          }
        ]
      },
      {
        id: 'file_modification_approval',
        name: 'File Modification Approval',
        description: 'Require approval for file modification',
        enabled: true,
        conditions: {
          actionTypes: ['file_write']
        },
        action: 'require_approval',
        message: 'File modification requires user approval'
      },
      {
        id: 'process_termination_restriction',
        name: 'Process Termination Restriction',
        description: 'Restrict process termination',
        enabled: true,
        conditions: {
          actionTypes: ['process_kill']
        },
        action: 'restrict',
        restrictions: [
          {
            id: 'max_processes',
            description: 'Limit number of processes that can be terminated',
            maxActions: 3,
            message: 'Cannot terminate more than 3 processes'
          }
        ]
      }
    ];
  }
  
  /**
   * Dispose resources used by this framework
   */
  async dispose() {
    if (this.eventBus) {
      this.eventBus.removeAllListeners('security:policy:updated');
      this.eventBus.removeAllListeners('user:approval:received');
    }
  }
}

module.exports = StrategySecurityFramework;
