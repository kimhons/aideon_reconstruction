/**
 * SecurityValidator.js
 * 
 * Provides security validation capabilities for recovery strategy execution.
 * This component is responsible for validating permissions, assessing risks,
 * and enforcing security policies during strategy execution.
 * 
 * @module src/core/error_recovery/security/SecurityValidator
 */

'use strict';

/**
 * Class responsible for security validation during strategy execution
 */
class SecurityValidator {
  /**
   * Creates a new SecurityValidator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.permissionManager - Manager for permission validation
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.permissionManager = options.permissionManager;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.strictMode = this.config.strictMode === true;
    this.maxRiskLevel = this.config.maxRiskLevel || 'medium';
    this.requireUserApproval = this.config.requireUserApproval || ['high_risk', 'system_modification'];
    this.auditLevel = this.config.auditLevel || 'standard';
    
    this.riskLevels = {
      'none': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    
    this.validationCache = new Map();
    this._initialize();
  }
  
  /**
   * Initialize the security validator
   * @private
   */
  _initialize() {
    if (!this.enabled) {
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('security:policy:updated', this._handlePolicyUpdate.bind(this));
    }
  }
  
  /**
   * Validate a strategy for security concerns
   * 
   * @param {Object} strategy - Strategy to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateStrategy(strategy, options = {}) {
    if (!this.enabled || !strategy) {
      return {
        valid: true,
        reason: 'security_validation_disabled'
      };
    }
    
    const { context, executionId } = options;
    
    try {
      // Check if we have a cached validation result
      const cacheKey = this._generateCacheKey(strategy, context);
      if (this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey);
      }
      
      // Validate strategy metadata
      const metadataResult = this._validateMetadata(strategy);
      if (!metadataResult.valid) {
        return this._cacheAndReturn(cacheKey, metadataResult);
      }
      
      // Validate strategy actions
      const actionsResult = await this._validateActions(strategy.actions || [], context);
      if (!actionsResult.valid) {
        return this._cacheAndReturn(cacheKey, actionsResult);
      }
      
      // Validate overall risk level
      const riskResult = this._validateRiskLevel(strategy, actionsResult.riskLevel);
      if (!riskResult.valid) {
        return this._cacheAndReturn(cacheKey, riskResult);
      }
      
      // Check if user approval is required
      const approvalResult = await this._checkUserApprovalRequirement(strategy, actionsResult.riskLevel, context);
      if (!approvalResult.valid) {
        return this._cacheAndReturn(cacheKey, approvalResult);
      }
      
      // Emit validation success event
      if (this.eventBus) {
        this.eventBus.emit('security:validation:success', {
          strategyId: strategy.id,
          executionId,
          riskLevel: actionsResult.riskLevel,
          timestamp: Date.now()
        });
      }
      
      // Strategy is valid
      return this._cacheAndReturn(cacheKey, {
        valid: true,
        riskLevel: actionsResult.riskLevel,
        requiresApproval: approvalResult.requiresApproval
      });
    } catch (error) {
      // Emit validation error event
      if (this.eventBus) {
        this.eventBus.emit('security:validation:error', {
          strategyId: strategy.id,
          executionId,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      return {
        valid: false,
        error: error.message,
        reason: 'validation_error'
      };
    }
  }
  
  /**
   * Validate an action for security concerns
   * 
   * @param {Object} action - Action to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateAction(action, options = {}) {
    if (!this.enabled || !action) {
      return {
        valid: true,
        reason: 'security_validation_disabled'
      };
    }
    
    const { context, executionId } = options;
    
    try {
      // Check action type
      if (!action.type) {
        return {
          valid: false,
          reason: 'invalid_action_type'
        };
      }
      
      // Determine action risk level
      const riskLevel = this._determineActionRiskLevel(action);
      
      // Check if risk level is acceptable
      if (this.riskLevels[riskLevel] > this.riskLevels[this.maxRiskLevel]) {
        return {
          valid: false,
          reason: 'risk_level_exceeded',
          riskLevel,
          maxAllowedRiskLevel: this.maxRiskLevel
        };
      }
      
      // Check permissions if permission manager is available
      if (this.permissionManager) {
        const permissionResult = await this.permissionManager.checkPermission(action.type, {
          action,
          context
        });
        
        if (!permissionResult.granted) {
          return {
            valid: false,
            reason: 'permission_denied',
            permission: action.type,
            details: permissionResult.reason
          };
        }
      }
      
      // Check if user approval is required for this action
      const requiresApproval = this._actionRequiresUserApproval(action, riskLevel);
      
      // If user approval is required, check if it has been granted
      if (requiresApproval && context && !context.userApproved) {
        return {
          valid: false,
          reason: 'user_approval_required',
          riskLevel
        };
      }
      
      // Emit validation success event
      if (this.eventBus) {
        this.eventBus.emit('security:action:validation:success', {
          actionType: action.type,
          executionId,
          riskLevel,
          timestamp: Date.now()
        });
      }
      
      // Action is valid
      return {
        valid: true,
        riskLevel,
        requiresApproval
      };
    } catch (error) {
      // Emit validation error event
      if (this.eventBus) {
        this.eventBus.emit('security:action:validation:error', {
          actionType: action.type,
          executionId,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      return {
        valid: false,
        error: error.message,
        reason: 'validation_error'
      };
    }
  }
  
  /**
   * Request user approval for a strategy
   * 
   * @param {Object} strategy - Strategy requiring approval
   * @param {Object} options - Approval options
   * @returns {Promise<Object>} Approval result
   */
  async requestUserApproval(strategy, options = {}) {
    if (!this.enabled || !strategy) {
      return {
        approved: true,
        reason: 'security_validation_disabled'
      };
    }
    
    const { context, executionId, riskLevel } = options;
    
    try {
      // In a real implementation, this would interact with the user
      // For now, we'll simulate user approval
      const approved = Math.random() < 0.9; // 90% approval rate
      
      // Emit approval event
      if (this.eventBus) {
        this.eventBus.emit('security:approval:' + (approved ? 'granted' : 'denied'), {
          strategyId: strategy.id,
          executionId,
          riskLevel,
          timestamp: Date.now()
        });
      }
      
      return {
        approved,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        approved: false,
        error: error.message,
        reason: 'approval_error'
      };
    }
  }
  
  /**
   * Audit a strategy execution
   * 
   * @param {Object} strategy - Executed strategy
   * @param {Object} result - Execution result
   * @param {Object} options - Audit options
   * @returns {Promise<Object>} Audit result
   */
  async auditExecution(strategy, result, options = {}) {
    if (!this.enabled || !strategy) {
      return {
        success: true,
        reason: 'security_validation_disabled'
      };
    }
    
    const { context, executionId } = options;
    
    try {
      // Create audit record
      const auditRecord = {
        strategyId: strategy.id,
        executionId,
        timestamp: Date.now(),
        success: result.success,
        riskLevel: options.riskLevel || 'unknown',
        userApproved: context?.userApproved || false,
        actions: Array.isArray(result.results) ? result.results.length : 0,
        failedActions: Array.isArray(result.results) ? 
          result.results.filter(r => !r.success).length : 0,
        executionTime: result.executionTime || 0
      };
      
      // Add detailed information if audit level is comprehensive
      if (this.auditLevel === 'comprehensive') {
        auditRecord.actionDetails = Array.isArray(result.results) ? 
          result.results.map(r => ({
            type: r.action,
            success: r.success,
            error: r.error
          })) : [];
      }
      
      // Emit audit event
      if (this.eventBus) {
        this.eventBus.emit('security:audit:recorded', {
          strategyId: strategy.id,
          executionId,
          success: result.success,
          timestamp: Date.now()
        });
      }
      
      // In a real implementation, this would store the audit record
      // For now, we'll just return success
      return {
        success: true,
        auditId: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reason: 'audit_error'
      };
    }
  }
  
  /**
   * Handle policy update event
   * 
   * @param {Object} data - Policy update data
   * @private
   */
  _handlePolicyUpdate(data) {
    if (!data) {
      return;
    }
    
    // Update configuration based on policy changes
    if (data.maxRiskLevel && this.riskLevels[data.maxRiskLevel] !== undefined) {
      this.maxRiskLevel = data.maxRiskLevel;
    }
    
    if (Array.isArray(data.requireUserApproval)) {
      this.requireUserApproval = data.requireUserApproval;
    }
    
    if (data.strictMode !== undefined) {
      this.strictMode = data.strictMode === true;
    }
    
    if (data.auditLevel) {
      this.auditLevel = data.auditLevel;
    }
    
    // Clear validation cache
    this.validationCache.clear();
  }
  
  /**
   * Validate strategy metadata
   * 
   * @param {Object} strategy - Strategy to validate
   * @returns {Object} Validation result
   * @private
   */
  _validateMetadata(strategy) {
    // Check for required fields
    if (!strategy.id) {
      return {
        valid: false,
        reason: 'missing_strategy_id'
      };
    }
    
    if (!strategy.type) {
      return {
        valid: false,
        reason: 'missing_strategy_type'
      };
    }
    
    // Check for actions
    if (!Array.isArray(strategy.actions) || strategy.actions.length === 0) {
      return {
        valid: false,
        reason: 'empty_actions'
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate strategy actions
   * 
   * @param {Array} actions - Actions to validate
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Validation result
   * @private
   */
  async _validateActions(actions, context) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return {
        valid: false,
        reason: 'empty_actions'
      };
    }
    
    let highestRiskLevel = 'none';
    const invalidActions = [];
    
    // Validate each action
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      // Validate action
      const result = await this.validateAction(action, { context });
      
      if (!result.valid) {
        invalidActions.push({
          index: i,
          action: action.type,
          reason: result.reason,
          details: result.details
        });
        
        // In strict mode, fail on first invalid action
        if (this.strictMode) {
          return {
            valid: false,
            reason: 'invalid_action',
            action: action.type,
            actionIndex: i,
            details: result.reason
          };
        }
      }
      
      // Update highest risk level
      if (result.riskLevel && this.riskLevels[result.riskLevel] > this.riskLevels[highestRiskLevel]) {
        highestRiskLevel = result.riskLevel;
      }
    }
    
    // If any actions are invalid in non-strict mode, return invalid result
    if (invalidActions.length > 0) {
      return {
        valid: false,
        reason: 'invalid_actions',
        invalidActions
      };
    }
    
    return {
      valid: true,
      riskLevel: highestRiskLevel
    };
  }
  
  /**
   * Validate strategy risk level
   * 
   * @param {Object} strategy - Strategy to validate
   * @param {string} riskLevel - Determined risk level
   * @returns {Object} Validation result
   * @private
   */
  _validateRiskLevel(strategy, riskLevel) {
    // Check if risk level is acceptable
    if (this.riskLevels[riskLevel] > this.riskLevels[this.maxRiskLevel]) {
      return {
        valid: false,
        reason: 'risk_level_exceeded',
        riskLevel,
        maxAllowedRiskLevel: this.maxRiskLevel
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Check if user approval is required
   * 
   * @param {Object} strategy - Strategy to check
   * @param {string} riskLevel - Determined risk level
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Approval check result
   * @private
   */
  async _checkUserApprovalRequirement(strategy, riskLevel, context) {
    // Check if user approval is required based on risk level
    const requiresApproval = this._strategyRequiresUserApproval(strategy, riskLevel);
    
    // If user approval is required, check if it has been granted
    if (requiresApproval) {
      if (context && context.userApproved) {
        return {
          valid: true,
          requiresApproval: true
        };
      } else {
        return {
          valid: false,
          reason: 'user_approval_required',
          requiresApproval: true
        };
      }
    }
    
    return {
      valid: true,
      requiresApproval: false
    };
  }
  
  /**
   * Determine if a strategy requires user approval
   * 
   * @param {Object} strategy - Strategy to check
   * @param {string} riskLevel - Determined risk level
   * @returns {boolean} Whether user approval is required
   * @private
   */
  _strategyRequiresUserApproval(strategy, riskLevel) {
    // Check if strategy explicitly requires approval
    if (strategy.requiresUserApproval === true) {
      return true;
    }
    
    // Check if risk level requires approval
    if (this.requireUserApproval.includes(riskLevel)) {
      return true;
    }
    
    // Check if risk level requires approval (alternative format)
    if (this.requireUserApproval.includes(`risk_${riskLevel}`)) {
      return true;
    }
    
    // Check if strategy type requires approval
    if (this.requireUserApproval.includes(`type_${strategy.type}`)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine if an action requires user approval
   * 
   * @param {Object} action - Action to check
   * @param {string} riskLevel - Determined risk level
   * @returns {boolean} Whether user approval is required
   * @private
   */
  _actionRequiresUserApproval(action, riskLevel) {
    // Check if action explicitly requires approval
    if (action.requiresUserApproval === true) {
      return true;
    }
    
    // Check if risk level requires approval
    if (this.requireUserApproval.includes(riskLevel)) {
      return true;
    }
    
    // Check if risk level requires approval (alternative format)
    if (this.requireUserApproval.includes(`risk_${riskLevel}`)) {
      return true;
    }
    
    // Check if action type requires approval
    if (this.requireUserApproval.includes(action.type)) {
      return true;
    }
    
    // Check if action type requires approval (alternative format)
    if (this.requireUserApproval.includes(`action_${action.type}`)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine the risk level of an action
   * 
   * @param {Object} action - Action to check
   * @returns {string} Risk level
   * @private
   */
  _determineActionRiskLevel(action) {
    // If action specifies risk level, use that
    if (action.riskLevel && this.riskLevels[action.riskLevel] !== undefined) {
      return action.riskLevel;
    }
    
    // Otherwise, determine based on action type
    switch (action.type) {
      case 'system_call':
        return action.sudo === true ? 'high' : 'medium';
      case 'file_write':
        return action.path && (
          action.path.startsWith('/etc') || 
          action.path.startsWith('/bin') || 
          action.path.startsWith('/sbin')
        ) ? 'high' : 'medium';
      case 'process_kill':
        return 'medium';
      case 'network_config':
        return 'high';
      case 'service_control':
        return 'medium';
      case 'api_call':
        return action.authenticated === true ? 'medium' : 'low';
      case 'ui_interaction':
        return 'low';
      case 'wait':
        return 'none';
      default:
        return 'medium'; // Default to medium for unknown actions
    }
  }
  
  /**
   * Generate cache key for validation result
   * 
   * @param {Object} strategy - Strategy to validate
   * @param {Object} context - Execution context
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(strategy, context) {
    const strategyId = strategy.id || '';
    const contextId = context?.id || '';
    const userApproved = context?.userApproved ? '1' : '0';
    
    return `${strategyId}_${contextId}_${userApproved}`;
  }
  
  /**
   * Cache and return validation result
   * 
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Validation result
   * @returns {Object} Validation result
   * @private
   */
  _cacheAndReturn(cacheKey, result) {
    // Only cache valid results or results that can be fixed with user approval
    if (result.valid || result.reason === 'user_approval_required') {
      this.validationCache.set(cacheKey, result);
      
      // Set cache expiration
      setTimeout(() => {
        this.validationCache.delete(cacheKey);
      }, 300000); // Cache for 5 minutes
    }
    
    return result;
  }
  
  /**
   * Dispose resources used by this validator
   */
  dispose() {
    if (this.eventBus) {
      this.eventBus.removeAllListeners('security:policy:updated');
    }
    
    this.validationCache.clear();
  }
}

module.exports = SecurityValidator;
