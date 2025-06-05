/**
 * StrategySecurityValidator.js
 * 
 * Security validator for recovery strategies to ensure they meet security requirements
 * and have appropriate permissions before execution. This component is responsible for
 * validating that recovery strategies don't introduce security vulnerabilities or
 * violate security policies.
 * 
 * @module src/core/error_recovery/strategy/StrategySecurityValidator
 */

'use strict';

/**
 * Class responsible for validating security aspects of recovery strategies
 */
class StrategySecurityValidator {
  /**
   * Creates a new StrategySecurityValidator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.securityManager - Security manager for permission checks
   * @param {Object} options.knowledgeFramework - Knowledge framework for security policies
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.securityManager = options.securityManager;
    this.knowledgeFramework = options.knowledgeFramework;
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.securityPolicies = [];
    this.permissionCache = new Map();
    this.isInitialized = false;
  }
  
  /**
   * Initialize the validator and load security policies
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    // Load security policies
    if (this.knowledgeFramework) {
      try {
        const policies = await this.knowledgeFramework.query({
          type: 'security_policy',
          domain: 'error_recovery',
          active: true
        });
        
        if (policies && policies.length > 0) {
          this.securityPolicies = policies;
        }
      } catch (error) {
        console.warn('Failed to load security policies:', error.message);
        // Continue with default policies
      }
    }
    
    // Set up default policies if none were loaded
    if (this.securityPolicies.length === 0) {
      this.securityPolicies = this._getDefaultSecurityPolicies();
    }
    
    // Subscribe to policy updates if event bus is available
    if (this.eventBus) {
      this.eventBus.on('security:policy:updated', this._handlePolicyUpdate.bind(this));
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'StrategySecurityValidator',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the validator and load security policies
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Validate a recovery strategy against security policies
   * 
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Validation result
   */
  async validateStrategy(strategy, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategy) {
      return {
        valid: false,
        reason: 'Strategy is null or undefined',
        requiresUserApproval: false
      };
    }
    
    // Check if strategy has security context
    if (!strategy.securityContext) {
      strategy.securityContext = this._createDefaultSecurityContext(strategy);
    }
    
    // Validate against security policies
    const policyValidation = await this._validateAgainstPolicies(strategy, context);
    if (!policyValidation.valid) {
      return policyValidation;
    }
    
    // Check permissions if security manager is available
    if (this.securityManager) {
      const permissionValidation = await this._checkPermissions(strategy, context);
      if (!permissionValidation.valid) {
        return permissionValidation;
      }
    }
    
    // Check for high-risk actions
    const riskValidation = this._validateRiskLevel(strategy, context);
    if (!riskValidation.valid) {
      return riskValidation;
    }
    
    // All validations passed
    return {
      valid: true,
      requiresUserApproval: riskValidation.requiresUserApproval,
      approvalReason: riskValidation.requiresUserApproval ? riskValidation.reason : null,
      securityLevel: strategy.securityContext.level || 'standard'
    };
  }
  
  /**
   * Validate multiple strategies in batch
   * 
   * @param {Array} strategies - List of strategies to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Batch validation results
   */
  async validateStrategies(strategies, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategies || strategies.length === 0) {
      return {
        valid: false,
        reason: 'No strategies provided',
        results: []
      };
    }
    
    const results = [];
    let allValid = true;
    
    // Validate each strategy
    for (const strategy of strategies) {
      const result = await this.validateStrategy(strategy, context);
      results.push({
        strategy: strategy.id,
        ...result
      });
      
      if (!result.valid) {
        allValid = false;
      }
    }
    
    return {
      valid: allValid,
      reason: allValid ? null : 'One or more strategies failed validation',
      results
    };
  }
  
  /**
   * Check if a strategy requires user approval
   * 
   * @param {Object} strategy - The strategy to check
   * @param {Object} context - Additional context information
   * @returns {Object} Approval requirement result
   */
  requiresUserApproval(strategy, context = {}) {
    if (!strategy) {
      return {
        required: false,
        reason: 'Strategy is null or undefined'
      };
    }
    
    // Check security context
    const securityContext = strategy.securityContext || this._createDefaultSecurityContext(strategy);
    
    // High-risk strategies always require approval
    if (securityContext.riskLevel === 'high') {
      return {
        required: true,
        reason: 'High-risk strategy requires explicit user approval'
      };
    }
    
    // Check for sensitive actions
    const sensitiveActions = (strategy.actions || []).filter(action => 
      this._isSensitiveAction(action)
    );
    
    if (sensitiveActions.length > 0) {
      return {
        required: true,
        reason: `Strategy contains ${sensitiveActions.length} sensitive action(s) requiring approval`,
        actions: sensitiveActions.map(a => a.type)
      };
    }
    
    // Check for system modification
    if (this._involvesSystemModification(strategy)) {
      return {
        required: true,
        reason: 'Strategy involves system modification requiring approval'
      };
    }
    
    // Check context-specific requirements
    if (context.securitySensitive || context.productionEnvironment) {
      if (securityContext.riskLevel === 'medium') {
        return {
          required: true,
          reason: 'Medium-risk strategy requires approval in security-sensitive context'
        };
      }
    }
    
    // No approval required
    return {
      required: false
    };
  }
  
  /**
   * Validate a strategy against security policies
   * 
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Policy validation result
   * @private
   */
  async _validateAgainstPolicies(strategy, context) {
    for (const policy of this.securityPolicies) {
      // Skip inactive policies
      if (policy.active === false) {
        continue;
      }
      
      // Check if policy applies to this strategy
      if (policy.appliesTo && !this._policyApplies(policy.appliesTo, strategy, context)) {
        continue;
      }
      
      // Check policy rules
      for (const rule of (policy.rules || [])) {
        const ruleResult = await this._evaluateRule(rule, strategy, context);
        if (!ruleResult.valid) {
          return {
            valid: false,
            reason: `Security policy violation: ${policy.name} - ${ruleResult.reason}`,
            policy: policy.id,
            rule: rule.id,
            requiresUserApproval: rule.allowWithApproval === true
          };
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Check if a policy applies to a strategy
   * 
   * @param {Object} appliesTo - Policy application criteria
   * @param {Object} strategy - The strategy to check
   * @param {Object} context - Additional context information
   * @returns {boolean} Whether the policy applies
   * @private
   */
  _policyApplies(appliesTo, strategy, context) {
    // Check strategy type
    if (appliesTo.strategyTypes && !appliesTo.strategyTypes.includes(strategy.type)) {
      return false;
    }
    
    // Check action types
    if (appliesTo.actionTypes) {
      const strategyActionTypes = (strategy.actions || []).map(a => a.type);
      const hasMatchingAction = appliesTo.actionTypes.some(type => 
        strategyActionTypes.includes(type)
      );
      
      if (!hasMatchingAction) {
        return false;
      }
    }
    
    // Check security level
    if (appliesTo.securityLevels && 
        strategy.securityContext && 
        !appliesTo.securityLevels.includes(strategy.securityContext.level)) {
      return false;
    }
    
    // Check context criteria
    if (appliesTo.contexts) {
      let contextMatch = false;
      
      for (const contextCriteria of appliesTo.contexts) {
        let allCriteriaMatch = true;
        
        for (const [key, value] of Object.entries(contextCriteria)) {
          if (context[key] !== value) {
            allCriteriaMatch = false;
            break;
          }
        }
        
        if (allCriteriaMatch) {
          contextMatch = true;
          break;
        }
      }
      
      if (!contextMatch) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Evaluate a security policy rule
   * 
   * @param {Object} rule - The rule to evaluate
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Rule evaluation result
   * @private
   */
  async _evaluateRule(rule, strategy, context) {
    switch (rule.type) {
      case 'forbidden_action':
        return this._evaluateForbiddenActionRule(rule, strategy);
        
      case 'required_permission':
        return this._evaluateRequiredPermissionRule(rule, strategy, context);
        
      case 'max_risk_level':
        return this._evaluateMaxRiskLevelRule(rule, strategy);
        
      case 'required_approval':
        return this._evaluateRequiredApprovalRule(rule, strategy, context);
        
      case 'custom':
        return this._evaluateCustomRule(rule, strategy, context);
        
      default:
        return { 
          valid: true,
          reason: `Unknown rule type: ${rule.type}, skipping`
        };
    }
  }
  
  /**
   * Evaluate a forbidden action rule
   * 
   * @param {Object} rule - The rule to evaluate
   * @param {Object} strategy - The strategy to validate
   * @returns {Object} Rule evaluation result
   * @private
   */
  _evaluateForbiddenActionRule(rule, strategy) {
    const forbiddenActions = rule.forbiddenActions || [];
    
    for (const action of (strategy.actions || [])) {
      if (forbiddenActions.includes(action.type)) {
        return {
          valid: false,
          reason: `Action type '${action.type}' is forbidden by security policy`
        };
      }
      
      // Check for forbidden targets
      if (rule.forbiddenTargets && rule.forbiddenTargets.includes(action.target)) {
        return {
          valid: false,
          reason: `Target '${action.target}' is forbidden by security policy`
        };
      }
      
      // Check for forbidden parameters
      if (rule.forbiddenParameters && action.params) {
        for (const [param, value] of Object.entries(action.params)) {
          if (rule.forbiddenParameters[param] && 
              (rule.forbiddenParameters[param] === '*' || 
               rule.forbiddenParameters[param] === value)) {
            return {
              valid: false,
              reason: `Parameter '${param}' with value '${value}' is forbidden by security policy`
            };
          }
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Evaluate a required permission rule
   * 
   * @param {Object} rule - The rule to evaluate
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Rule evaluation result
   * @private
   */
  async _evaluateRequiredPermissionRule(rule, strategy, context) {
    if (!this.securityManager) {
      // Skip permission check if security manager is not available
      return { valid: true };
    }
    
    const requiredPermissions = rule.requiredPermissions || [];
    
    for (const permission of requiredPermissions) {
      try {
        const hasPermission = await this.securityManager.checkPermission(
          permission,
          strategy.securityContext,
          context
        );
        
        if (!hasPermission) {
          return {
            valid: false,
            reason: `Missing required permission: ${permission}`
          };
        }
      } catch (error) {
        return {
          valid: false,
          reason: `Error checking permission '${permission}': ${error.message}`
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Evaluate a maximum risk level rule
   * 
   * @param {Object} rule - The rule to evaluate
   * @param {Object} strategy - The strategy to validate
   * @returns {Object} Rule evaluation result
   * @private
   */
  _evaluateMaxRiskLevelRule(rule, strategy) {
    const riskLevels = ['low', 'medium', 'high'];
    const maxAllowedLevel = rule.maxRiskLevel || 'medium';
    
    const strategyRiskLevel = strategy.securityContext ? 
      (strategy.securityContext.riskLevel || 'medium') : 'medium';
    
    const maxAllowedIndex = riskLevels.indexOf(maxAllowedLevel);
    const strategyRiskIndex = riskLevels.indexOf(strategyRiskLevel);
    
    if (strategyRiskIndex > maxAllowedIndex) {
      return {
        valid: false,
        reason: `Strategy risk level '${strategyRiskLevel}' exceeds maximum allowed level '${maxAllowedLevel}'`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Evaluate a required approval rule
   * 
   * @param {Object} rule - The rule to evaluate
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Rule evaluation result
   * @private
   */
  _evaluateRequiredApprovalRule(rule, strategy, context) {
    const requiresApproval = this.requiresUserApproval(strategy, context);
    
    if (requiresApproval.required) {
      // Check if approval is already granted
      const approvalGranted = context.userApproval && 
        context.userApproval.strategyId === strategy.id &&
        context.userApproval.timestamp > Date.now() - (rule.approvalTtlMs || 300000);
      
      if (!approvalGranted) {
        return {
          valid: false,
          reason: requiresApproval.reason,
          requiresUserApproval: true
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Evaluate a custom rule
   * 
   * @param {Object} rule - The rule to evaluate
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Rule evaluation result
   * @private
   */
  async _evaluateCustomRule(rule, strategy, context) {
    if (!rule.evaluator) {
      return { valid: true };
    }
    
    try {
      // Try to evaluate using the knowledge framework
      if (this.knowledgeFramework && rule.evaluatorId) {
        const evaluator = await this.knowledgeFramework.getEvaluator(rule.evaluatorId);
        if (evaluator && typeof evaluator.evaluate === 'function') {
          const result = await evaluator.evaluate(strategy, context);
          return result;
        }
      }
      
      // Fallback to simple evaluation
      if (typeof rule.evaluator === 'function') {
        const result = await rule.evaluator(strategy, context);
        return result;
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Custom rule evaluation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Check permissions for a strategy
   * 
   * @param {Object} strategy - The strategy to check
   * @param {Object} context - Additional context information
   * @returns {Object} Permission check result
   * @private
   */
  async _checkPermissions(strategy, context) {
    if (!this.securityManager) {
      return { valid: true };
    }
    
    const requiredPermissions = this._getRequiredPermissions(strategy);
    
    for (const permission of requiredPermissions) {
      // Check permission cache first
      const cacheKey = `${permission}:${strategy.securityContext.level || 'standard'}`;
      if (this.permissionCache.has(cacheKey)) {
        const cachedResult = this.permissionCache.get(cacheKey);
        if (!cachedResult) {
          return {
            valid: false,
            reason: `Missing required permission: ${permission}`
          };
        }
        continue;
      }
      
      // Check permission with security manager
      try {
        const hasPermission = await this.securityManager.checkPermission(
          permission,
          strategy.securityContext,
          context
        );
        
        // Cache result
        this.permissionCache.set(cacheKey, hasPermission);
        
        if (!hasPermission) {
          return {
            valid: false,
            reason: `Missing required permission: ${permission}`
          };
        }
      } catch (error) {
        return {
          valid: false,
          reason: `Error checking permission '${permission}': ${error.message}`
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Get required permissions for a strategy
   * 
   * @param {Object} strategy - The strategy to check
   * @returns {Array} List of required permissions
   * @private
   */
  _getRequiredPermissions(strategy) {
    const permissions = [];
    
    // Add permissions from security context
    if (strategy.securityContext && strategy.securityContext.requiredPermissions) {
      permissions.push(...strategy.securityContext.requiredPermissions);
    }
    
    // Add permissions based on action types
    for (const action of (strategy.actions || [])) {
      const actionPermissions = this._getPermissionsForAction(action);
      for (const permission of actionPermissions) {
        if (!permissions.includes(permission)) {
          permissions.push(permission);
        }
      }
    }
    
    return permissions;
  }
  
  /**
   * Get permissions required for an action
   * 
   * @param {Object} action - The action to check
   * @returns {Array} List of required permissions
   * @private
   */
  _getPermissionsForAction(action) {
    const permissions = [];
    
    // Add permission based on action type
    switch (action.type) {
      case 'restart':
        permissions.push('system.restart');
        break;
        
      case 'reconfigure':
        permissions.push('system.configure');
        break;
        
      case 'allocate':
        permissions.push('resource.allocate');
        break;
        
      case 'release':
        permissions.push('resource.release');
        break;
        
      case 'modify':
        permissions.push('system.modify');
        break;
        
      case 'execute':
        permissions.push('system.execute');
        break;
        
      case 'notify':
        permissions.push('user.notify');
        break;
    }
    
    // Add target-specific permissions
    if (action.target) {
      if (action.target.startsWith('system.')) {
        permissions.push(`system.access.${action.target.substring(7)}`);
      } else if (action.target.startsWith('user.')) {
        permissions.push(`user.access.${action.target.substring(5)}`);
      } else if (action.target.startsWith('data.')) {
        permissions.push(`data.access.${action.target.substring(5)}`);
      }
    }
    
    return permissions;
  }
  
  /**
   * Validate risk level of a strategy
   * 
   * @param {Object} strategy - The strategy to validate
   * @param {Object} context - Additional context information
   * @returns {Object} Risk validation result
   * @private
   */
  _validateRiskLevel(strategy, context) {
    const securityContext = strategy.securityContext || this._createDefaultSecurityContext(strategy);
    const maxAllowedRiskLevel = this.config.maxRiskLevel || 'medium';
    
    const riskLevels = ['low', 'medium', 'high'];
    const maxAllowedIndex = riskLevels.indexOf(maxAllowedRiskLevel);
    const strategyRiskIndex = riskLevels.indexOf(securityContext.riskLevel || 'medium');
    
    if (strategyRiskIndex > maxAllowedIndex) {
      // Check if high-risk strategies are allowed with approval
      if (this.config.allowHighRiskWithApproval && securityContext.riskLevel === 'high') {
        return {
          valid: true,
          requiresUserApproval: true,
          reason: 'High-risk strategy requires user approval'
        };
      }
      
      return {
        valid: false,
        reason: `Strategy risk level '${securityContext.riskLevel}' exceeds maximum allowed level '${maxAllowedRiskLevel}'`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Check if an action is sensitive
   * 
   * @param {Object} action - The action to check
   * @returns {boolean} Whether the action is sensitive
   * @private
   */
  _isSensitiveAction(action) {
    const sensitiveActionTypes = [
      'restart',
      'reconfigure',
      'modify',
      'execute',
      'uninstall',
      'delete',
      'elevate'
    ];
    
    if (sensitiveActionTypes.includes(action.type)) {
      return true;
    }
    
    // Check for sensitive targets
    const sensitiveTargets = [
      'system',
      'security',
      'network',
      'database',
      'authentication'
    ];
    
    if (action.target && sensitiveTargets.some(t => action.target.includes(t))) {
      return true;
    }
    
    // Check for sensitive parameters
    if (action.params) {
      if (action.params.force === true || 
          action.params.bypass === true || 
          action.params.ignoreWarnings === true) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a strategy involves system modification
   * 
   * @param {Object} strategy - The strategy to check
   * @returns {boolean} Whether the strategy involves system modification
   * @private
   */
  _involvesSystemModification(strategy) {
    const modificationActionTypes = [
      'modify',
      'reconfigure',
      'install',
      'uninstall',
      'update',
      'delete'
    ];
    
    return (strategy.actions || []).some(action => 
      modificationActionTypes.includes(action.type)
    );
  }
  
  /**
   * Create default security context for a strategy
   * 
   * @param {Object} strategy - The strategy
   * @returns {Object} Default security context
   * @private
   */
  _createDefaultSecurityContext(strategy) {
    // Determine risk level based on strategy type and actions
    let riskLevel = 'low';
    
    // Check for sensitive actions
    const hasSensitiveActions = (strategy.actions || []).some(action => 
      this._isSensitiveAction(action)
    );
    
    if (hasSensitiveActions) {
      riskLevel = 'medium';
    }
    
    // Check for system modification
    if (this._involvesSystemModification(strategy)) {
      riskLevel = 'medium';
    }
    
    // Check strategy type
    if (strategy.type === 'restart' || strategy.type === 'reconfigure') {
      riskLevel = 'medium';
    }
    
    return {
      level: 'standard',
      riskLevel,
      requiredPermissions: this._getRequiredPermissions(strategy),
      elevatedPrivileges: false
    };
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
        id: 'default_forbidden_actions',
        name: 'Default Forbidden Actions',
        description: 'Prevents execution of potentially dangerous actions',
        active: true,
        appliesTo: {
          strategyTypes: ['all']
        },
        rules: [
          {
            id: 'no_system_commands',
            type: 'forbidden_action',
            forbiddenActions: ['execute_command', 'shell_exec', 'eval'],
            allowWithApproval: false
          },
          {
            id: 'no_privilege_escalation',
            type: 'forbidden_action',
            forbiddenActions: ['elevate_privileges', 'sudo'],
            allowWithApproval: true
          }
        ]
      },
      {
        id: 'default_risk_level',
        name: 'Default Risk Level',
        description: 'Enforces maximum risk level for strategies',
        active: true,
        appliesTo: {
          strategyTypes: ['all']
        },
        rules: [
          {
            id: 'max_risk_medium',
            type: 'max_risk_level',
            maxRiskLevel: 'medium',
            allowWithApproval: true
          }
        ]
      },
      {
        id: 'production_approval',
        name: 'Production Environment Approval',
        description: 'Requires approval for sensitive actions in production',
        active: true,
        appliesTo: {
          contexts: [
            { productionEnvironment: true }
          ]
        },
        rules: [
          {
            id: 'production_approval_required',
            type: 'required_approval',
            approvalTtlMs: 300000 // 5 minutes
          }
        ]
      }
    ];
  }
  
  /**
   * Handle security policy update event
   * 
   * @param {Object} event - The policy update event
   * @private
   */
  _handlePolicyUpdate(event) {
    if (!event || !event.policy || !event.policy.id) {
      return;
    }
    
    // Find existing policy
    const existingIndex = this.securityPolicies.findIndex(p => p.id === event.policy.id);
    
    if (existingIndex >= 0) {
      // Update existing policy
      this.securityPolicies[existingIndex] = event.policy;
    } else {
      // Add new policy
      this.securityPolicies.push(event.policy);
    }
    
    // Clear permission cache
    this.permissionCache.clear();
  }
}

module.exports = StrategySecurityValidator;
