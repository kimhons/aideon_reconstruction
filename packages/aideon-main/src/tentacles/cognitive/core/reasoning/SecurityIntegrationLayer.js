/**
 * @fileoverview SecurityIntegrationLayer for the Reasoning Engine.
 * 
 * The SecurityIntegrationLayer provides comprehensive security policy enforcement
 * for the Reasoning Engine, ensuring proper access control, data privacy, and
 * audit logging across all operations. It integrates with the broader Aideon
 * security framework and supports secure multi-tenant operations.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI
 * @license Proprietary
 */

const Logger = require('../../../../common/logging/Logger');
const ConfigurationService = require('../../../../common/config/ConfigurationService');
const PerformanceMonitor = require('../../../../common/performance/PerformanceMonitor');
const SecurityManager = require('../../../../common/security/SecurityManager');
const UserManager = require('../../../../common/user/UserManager');
const SubscriptionManager = require('../../../../common/subscription/SubscriptionManager');
const AuditLogger = require('../../../../common/logging/AuditLogger');
const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} SecurityPolicy
 * @property {string} id - Policy identifier
 * @property {string} name - Human-readable name
 * @property {string} description - Policy description
 * @property {string} scope - Policy scope ('global', 'tentacle', 'user', 'request')
 * @property {string[]} requiredTiers - Required subscription tiers ('core', 'pro', 'enterprise')
 * @property {Object} rules - Policy-specific rules
 * @property {Date} createdAt - When the policy was created
 * @property {Date} updatedAt - When the policy was last updated
 */

/**
 * @typedef {Object} SecurityContext
 * @property {string} userId - User identifier
 * @property {string} tentacleId - Tentacle identifier
 * @property {string} requestId - Request identifier
 * @property {string} sessionId - Session identifier
 * @property {string} tier - Subscription tier ('core', 'pro', 'enterprise')
 * @property {string[]} roles - User roles
 * @property {Object} metadata - Additional context metadata
 */

/**
 * @typedef {Object} AuditEvent
 * @property {string} id - Event identifier
 * @property {string} type - Event type
 * @property {string} userId - User identifier
 * @property {string} tentacleId - Tentacle identifier
 * @property {string} requestId - Request identifier
 * @property {string} action - Action performed
 * @property {string} resource - Resource affected
 * @property {string} outcome - Outcome ('success', 'failure', 'denied')
 * @property {Object} metadata - Additional event metadata
 * @property {Date} timestamp - When the event occurred
 */

/**
 * SecurityIntegrationLayer class for enforcing security policies in the Reasoning Engine.
 */
class SecurityIntegrationLayer {
  /**
   * Creates a new SecurityIntegrationLayer instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Logger} options.logger - Logger instance
   * @param {ConfigurationService} options.configService - Configuration service
   * @param {PerformanceMonitor} options.performanceMonitor - Performance monitor
   * @param {SecurityManager} options.securityManager - Security manager
   * @param {UserManager} options.userManager - User manager
   * @param {SubscriptionManager} options.subscriptionManager - Subscription manager
   * @param {AuditLogger} options.auditLogger - Audit logger
   */
  constructor(options) {
    if (!options) {
      throw new Error('SecurityIntegrationLayer requires options parameter');
    }
    
    if (!options.logger) {
      throw new Error('SecurityIntegrationLayer requires logger instance');
    }
    
    if (!options.configService) {
      throw new Error('SecurityIntegrationLayer requires configService instance');
    }
    
    if (!options.performanceMonitor) {
      throw new Error('SecurityIntegrationLayer requires performanceMonitor instance');
    }
    
    if (!options.securityManager) {
      throw new Error('SecurityIntegrationLayer requires securityManager instance');
    }
    
    if (!options.userManager) {
      throw new Error('SecurityIntegrationLayer requires userManager instance');
    }
    
    if (!options.subscriptionManager) {
      throw new Error('SecurityIntegrationLayer requires subscriptionManager instance');
    }
    
    if (!options.auditLogger) {
      throw new Error('SecurityIntegrationLayer requires auditLogger instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.securityManager = options.securityManager;
    this.userManager = options.userManager;
    this.subscriptionManager = options.subscriptionManager;
    this.auditLogger = options.auditLogger;
    
    // Initialize data structures
    this.policies = new Map();
    this.policyCache = new Map();
    this.contextCache = new Map();
    
    // Initialize state
    this.isInitialized = false;
    
    this.logger.info('SecurityIntegrationLayer created');
  }
  
  /**
   * Initializes the SecurityIntegrationLayer.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    try {
      this.logger.info('Initializing SecurityIntegrationLayer');
      
      // Load security policies from configuration
      const policies = await this.configService.getSecurityPolicies();
      
      // Register policies
      for (const policy of policies) {
        await this.registerPolicy(policy);
      }
      
      this.isInitialized = true;
      this.logger.info('SecurityIntegrationLayer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SecurityIntegrationLayer', error);
      throw new Error(`SecurityIntegrationLayer initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Registers a security policy.
   * 
   * @async
   * @param {SecurityPolicy} policy - Security policy to register
   * @returns {Promise<void>}
   * @throws {Error} If policy registration fails
   */
  async registerPolicy(policy) {
    this.ensureInitialized();
    
    if (!policy) {
      throw new Error('SecurityIntegrationLayer.registerPolicy requires policy parameter');
    }
    
    if (!policy.id) {
      throw new Error('Security policy must have an ID');
    }
    
    try {
      this.logger.debug(`Registering security policy ${policy.id}`, { policy });
      
      // Validate policy
      this.validatePolicy(policy);
      
      // Store policy
      this.policies.set(policy.id, {
        ...policy,
        updatedAt: new Date()
      });
      
      // Clear policy cache
      this.policyCache.clear();
      
      this.logger.info(`Security policy ${policy.id} registered successfully`);
    } catch (error) {
      this.logger.error(`Failed to register security policy ${policy.id}`, error, { policy });
      throw new Error(`Policy registration failed: ${error.message}`);
    }
  }
  
  /**
   * Validates a security policy.
   * 
   * @param {SecurityPolicy} policy - Security policy to validate
   * @throws {Error} If policy is invalid
   * @private
   */
  validatePolicy(policy) {
    // Required fields
    const requiredFields = ['id', 'name', 'scope', 'rules'];
    for (const field of requiredFields) {
      if (policy[field] === undefined) {
        throw new Error(`Missing required field in security policy: ${field}`);
      }
    }
    
    // Validate scope
    const validScopes = ['global', 'tentacle', 'user', 'request'];
    if (!validScopes.includes(policy.scope)) {
      throw new Error(`Invalid policy scope: ${policy.scope}`);
    }
    
    // Validate required tiers if specified
    if (policy.requiredTiers) {
      if (!Array.isArray(policy.requiredTiers)) {
        throw new Error('requiredTiers must be an array');
      }
      
      const validTiers = ['core', 'pro', 'enterprise'];
      for (const tier of policy.requiredTiers) {
        if (!validTiers.includes(tier)) {
          throw new Error(`Invalid subscription tier: ${tier}`);
        }
      }
    }
    
    // Validate rules (basic structure validation)
    if (typeof policy.rules !== 'object') {
      throw new Error('Policy rules must be an object');
    }
  }
  
  /**
   * Unregisters a security policy.
   * 
   * @async
   * @param {string} policyId - Policy ID to unregister
   * @returns {Promise<boolean>} True if unregistered, false if not found
   * @throws {Error} If policy unregistration fails
   */
  async unregisterPolicy(policyId) {
    this.ensureInitialized();
    
    if (!policyId) {
      throw new Error('SecurityIntegrationLayer.unregisterPolicy requires policyId parameter');
    }
    
    if (!this.policies.has(policyId)) {
      return false;
    }
    
    try {
      // Remove policy
      this.policies.delete(policyId);
      
      // Clear policy cache
      this.policyCache.clear();
      
      this.logger.info(`Security policy ${policyId} unregistered successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister security policy ${policyId}`, error);
      throw new Error(`Policy unregistration failed: ${error.message}`);
    }
  }
  
  /**
   * Gets a registered security policy.
   * 
   * @async
   * @param {string} policyId - Policy ID to retrieve
   * @returns {Promise<SecurityPolicy>} Security policy
   * @throws {Error} If policy is not found
   */
  async getPolicy(policyId) {
    this.ensureInitialized();
    
    if (!policyId) {
      throw new Error('SecurityIntegrationLayer.getPolicy requires policyId parameter');
    }
    
    const policy = this.policies.get(policyId);
    
    if (!policy) {
      throw new Error(`Security policy ${policyId} not found`);
    }
    
    return { ...policy }; // Return a copy to prevent modification
  }
  
  /**
   * Gets all registered security policies.
   * 
   * @async
   * @returns {Promise<SecurityPolicy[]>} Array of security policies
   */
  async getAllPolicies() {
    this.ensureInitialized();
    
    return Array.from(this.policies.values()).map(policy => ({ ...policy }));
  }
  
  /**
   * Creates a security context for a request.
   * 
   * @async
   * @param {Object} options - Context options
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.requestId - Request ID
   * @param {string} [options.sessionId] - Session ID
   * @param {Object} [options.metadata] - Additional context metadata
   * @returns {Promise<SecurityContext>} Security context
   * @throws {Error} If context creation fails
   */
  async createSecurityContext(options) {
    this.ensureInitialized();
    
    if (!options) {
      throw new Error('SecurityIntegrationLayer.createSecurityContext requires options parameter');
    }
    
    if (!options.userId) {
      throw new Error('SecurityIntegrationLayer.createSecurityContext requires userId');
    }
    
    if (!options.tentacleId) {
      throw new Error('SecurityIntegrationLayer.createSecurityContext requires tentacleId');
    }
    
    if (!options.requestId) {
      throw new Error('SecurityIntegrationLayer.createSecurityContext requires requestId');
    }
    
    try {
      this.logger.debug('Creating security context', { options });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer('createSecurityContext');
      
      // Get user information
      const user = await this.userManager.getUser(options.userId);
      
      if (!user) {
        throw new Error(`User ${options.userId} not found`);
      }
      
      // Get subscription information
      const subscription = await this.subscriptionManager.getUserSubscription(options.userId);
      
      if (!subscription) {
        throw new Error(`Subscription for user ${options.userId} not found`);
      }
      
      // Create context
      const context = {
        userId: options.userId,
        tentacleId: options.tentacleId,
        requestId: options.requestId,
        sessionId: options.sessionId || uuidv4(),
        tier: subscription.tier,
        roles: user.roles || [],
        metadata: options.metadata || {},
        createdAt: new Date()
      };
      
      // Store in cache
      const contextId = this.generateContextId(context);
      this.contextCache.set(contextId, context);
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker);
      
      this.logger.debug(`Security context created for request ${options.requestId}`);
      return { ...context }; // Return a copy to prevent modification
    } catch (error) {
      this.logger.error('Failed to create security context', error, { options });
      throw new Error(`Security context creation failed: ${error.message}`);
    }
  }
  
  /**
   * Generates a unique ID for a security context.
   * 
   * @param {SecurityContext} context - Security context
   * @returns {string} Context ID
   * @private
   */
  generateContextId(context) {
    return `${context.userId}:${context.tentacleId}:${context.requestId}`;
  }
  
  /**
   * Gets a security context.
   * 
   * @async
   * @param {Object} options - Context options
   * @param {string} options.userId - User ID
   * @param {string} options.tentacleId - Tentacle ID
   * @param {string} options.requestId - Request ID
   * @returns {Promise<SecurityContext>} Security context
   * @throws {Error} If context is not found
   */
  async getSecurityContext(options) {
    this.ensureInitialized();
    
    if (!options) {
      throw new Error('SecurityIntegrationLayer.getSecurityContext requires options parameter');
    }
    
    if (!options.userId) {
      throw new Error('SecurityIntegrationLayer.getSecurityContext requires userId');
    }
    
    if (!options.tentacleId) {
      throw new Error('SecurityIntegrationLayer.getSecurityContext requires tentacleId');
    }
    
    if (!options.requestId) {
      throw new Error('SecurityIntegrationLayer.getSecurityContext requires requestId');
    }
    
    const contextId = `${options.userId}:${options.tentacleId}:${options.requestId}`;
    const context = this.contextCache.get(contextId);
    
    if (!context) {
      throw new Error(`Security context not found for ${contextId}`);
    }
    
    return { ...context }; // Return a copy to prevent modification
  }
  
  /**
   * Enforces security policies for a reasoning request.
   * 
   * @async
   * @param {SecurityContext} context - Security context
   * @param {Object} request - Reasoning request
   * @returns {Promise<Object>} Sanitized request
   * @throws {Error} If policy enforcement fails or access is denied
   */
  async enforceRequestPolicies(context, request) {
    this.ensureInitialized();
    
    if (!context) {
      throw new Error('SecurityIntegrationLayer.enforceRequestPolicies requires context parameter');
    }
    
    if (!request) {
      throw new Error('SecurityIntegrationLayer.enforceRequestPolicies requires request parameter');
    }
    
    try {
      this.logger.debug('Enforcing request policies', { context, request });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer('enforceRequestPolicies');
      
      // Get applicable policies
      const policies = await this.getApplicablePolicies(context, 'request');
      
      // Apply policies
      let sanitizedRequest = { ...request };
      
      for (const policy of policies) {
        // Check tier requirements
        if (policy.requiredTiers && !policy.requiredTiers.includes(context.tier)) {
          const auditEvent = {
            type: 'access_denied',
            userId: context.userId,
            tentacleId: context.tentacleId,
            requestId: context.requestId,
            action: 'reasoning_request',
            resource: `policy:${policy.id}`,
            outcome: 'denied',
            metadata: {
              reason: `Subscription tier ${context.tier} does not meet required tier ${policy.requiredTiers.join(', ')}`,
              policyId: policy.id
            },
            timestamp: new Date()
          };
          
          await this.auditLogger.logEvent(auditEvent);
          
          throw new Error(`Access denied: Subscription tier ${context.tier} does not meet required tier ${policy.requiredTiers.join(', ')}`);
        }
        
        // Apply policy-specific rules
        sanitizedRequest = await this.applyPolicyRules(policy, context, sanitizedRequest);
      }
      
      // Log successful policy enforcement
      const auditEvent = {
        type: 'policy_enforced',
        userId: context.userId,
        tentacleId: context.tentacleId,
        requestId: context.requestId,
        action: 'reasoning_request',
        resource: `request:${context.requestId}`,
        outcome: 'success',
        metadata: {
          appliedPolicies: policies.map(p => p.id)
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker);
      
      this.logger.debug(`Request policies enforced for ${context.requestId}`);
      return sanitizedRequest;
    } catch (error) {
      // Log policy enforcement failure
      const auditEvent = {
        type: 'policy_enforcement_failed',
        userId: context.userId,
        tentacleId: context.tentacleId,
        requestId: context.requestId,
        action: 'reasoning_request',
        resource: `request:${context.requestId}`,
        outcome: 'failure',
        metadata: {
          error: error.message
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      this.logger.error('Failed to enforce request policies', error, { context, request });
      throw error; // Re-throw the original error
    }
  }
  
  /**
   * Enforces security policies for a reasoning response.
   * 
   * @async
   * @param {SecurityContext} context - Security context
   * @param {Object} response - Reasoning response
   * @returns {Promise<Object>} Sanitized response
   * @throws {Error} If policy enforcement fails
   */
  async enforceResponsePolicies(context, response) {
    this.ensureInitialized();
    
    if (!context) {
      throw new Error('SecurityIntegrationLayer.enforceResponsePolicies requires context parameter');
    }
    
    if (!response) {
      throw new Error('SecurityIntegrationLayer.enforceResponsePolicies requires response parameter');
    }
    
    try {
      this.logger.debug('Enforcing response policies', { context, response });
      
      // Start performance monitoring
      const perfMarker = this.performanceMonitor.startTimer('enforceResponsePolicies');
      
      // Get applicable policies
      const policies = await this.getApplicablePolicies(context, 'response');
      
      // Apply policies
      let sanitizedResponse = { ...response };
      
      for (const policy of policies) {
        // Apply policy-specific rules
        sanitizedResponse = await this.applyPolicyRules(policy, context, sanitizedResponse, 'response');
      }
      
      // Log successful policy enforcement
      const auditEvent = {
        type: 'policy_enforced',
        userId: context.userId,
        tentacleId: context.tentacleId,
        requestId: context.requestId,
        action: 'reasoning_response',
        resource: `response:${context.requestId}`,
        outcome: 'success',
        metadata: {
          appliedPolicies: policies.map(p => p.id)
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfMarker);
      
      this.logger.debug(`Response policies enforced for ${context.requestId}`);
      return sanitizedResponse;
    } catch (error) {
      // Log policy enforcement failure
      const auditEvent = {
        type: 'policy_enforcement_failed',
        userId: context.userId,
        tentacleId: context.tentacleId,
        requestId: context.requestId,
        action: 'reasoning_response',
        resource: `response:${context.requestId}`,
        outcome: 'failure',
        metadata: {
          error: error.message
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      this.logger.error('Failed to enforce response policies', error, { context, response });
      throw error; // Re-throw the original error
    }
  }
  
  /**
   * Gets policies applicable to a given context and scope.
   * 
   * @async
   * @param {SecurityContext} context - Security context
   * @param {string} scope - Policy scope
   * @returns {Promise<SecurityPolicy[]>} Applicable policies
   * @private
   */
  async getApplicablePolicies(context, scope) {
    // Check cache first
    const cacheKey = `${context.userId}:${context.tentacleId}:${scope}`;
    
    if (this.policyCache.has(cacheKey)) {
      return this.policyCache.get(cacheKey);
    }
    
    // Get all policies
    const allPolicies = Array.from(this.policies.values());
    
    // Filter by scope
    const scopePolicies = allPolicies.filter(policy => {
      // Global policies apply to all scopes
      if (policy.scope === 'global') {
        return true;
      }
      
      // Scope-specific policies
      return policy.scope === scope;
    });
    
    // Filter by tentacle if applicable
    const tentaclePolicies = scopePolicies.filter(policy => {
      // Skip tentacle-specific filtering if not a tentacle policy
      if (policy.scope !== 'tentacle') {
        return true;
      }
      
      // Check if policy applies to this tentacle
      return policy.rules.tentacleIds && policy.rules.tentacleIds.includes(context.tentacleId);
    });
    
    // Filter by user if applicable
    const userPolicies = tentaclePolicies.filter(policy => {
      // Skip user-specific filtering if not a user policy
      if (policy.scope !== 'user') {
        return true;
      }
      
      // Check if policy applies to this user
      return policy.rules.userIds && policy.rules.userIds.includes(context.userId);
    });
    
    // Cache the result
    this.policyCache.set(cacheKey, userPolicies);
    
    return userPolicies;
  }
  
  /**
   * Applies policy rules to a request or response.
   * 
   * @async
   * @param {SecurityPolicy} policy - Security policy
   * @param {SecurityContext} context - Security context
   * @param {Object} data - Request or response data
   * @param {string} [type='request'] - Data type ('request' or 'response')
   * @returns {Promise<Object>} Sanitized data
   * @private
   */
  async applyPolicyRules(policy, context, data, type = 'request') {
    // Clone data to avoid modifying the original
    let result = { ...data };
    
    // Apply general rules
    if (policy.rules.sanitize) {
      result = this.sanitizeData(result, policy.rules.sanitize);
    }
    
    // Apply type-specific rules
    if (type === 'request' && policy.rules.request) {
      // Request-specific rules
      if (policy.rules.request.maxPriority && result.priority > policy.rules.request.maxPriority) {
        result.priority = policy.rules.request.maxPriority;
      }
      
      if (policy.rules.request.allowedTypes && !policy.rules.request.allowedTypes.includes(result.type)) {
        throw new Error(`Request type ${result.type} is not allowed by policy ${policy.id}`);
      }
      
      if (policy.rules.request.sanitize) {
        result = this.sanitizeData(result, policy.rules.request.sanitize);
      }
    } else if (type === 'response' && policy.rules.response) {
      // Response-specific rules
      if (policy.rules.response.sanitize) {
        result = this.sanitizeData(result, policy.rules.response.sanitize);
      }
      
      if (policy.rules.response.redactFields) {
        result = this.redactFields(result, policy.rules.response.redactFields);
      }
    }
    
    return result;
  }
  
  /**
   * Sanitizes data according to sanitization rules.
   * 
   * @param {Object} data - Data to sanitize
   * @param {Object} rules - Sanitization rules
   * @returns {Object} Sanitized data
   * @private
   */
  sanitizeData(data, rules) {
    // Clone data to avoid modifying the original
    const result = { ...data };
    
    // Apply field-specific sanitization
    if (rules.fields) {
      for (const [field, fieldRules] of Object.entries(rules.fields)) {
        if (result[field] === undefined) {
          continue;
        }
        
        // Apply field rules
        if (fieldRules.maxLength && typeof result[field] === 'string' && result[field].length > fieldRules.maxLength) {
          result[field] = result[field].substring(0, fieldRules.maxLength);
        }
        
        if (fieldRules.pattern && typeof result[field] === 'string') {
          const regex = new RegExp(fieldRules.pattern);
          if (!regex.test(result[field])) {
            // Either remove the field or set to default value
            if (fieldRules.default !== undefined) {
              result[field] = fieldRules.default;
            } else {
              delete result[field];
            }
          }
        }
        
        if (fieldRules.type && typeof result[field] !== fieldRules.type) {
          // Either remove the field or set to default value
          if (fieldRules.default !== undefined) {
            result[field] = fieldRules.default;
          } else {
            delete result[field];
          }
        }
      }
    }
    
    // Remove disallowed fields
    if (rules.removeFields && Array.isArray(rules.removeFields)) {
      for (const field of rules.removeFields) {
        delete result[field];
      }
    }
    
    return result;
  }
  
  /**
   * Redacts sensitive fields in data.
   * 
   * @param {Object} data - Data to redact
   * @param {string[]} fields - Fields to redact
   * @returns {Object} Redacted data
   * @private
   */
  redactFields(data, fields) {
    // Clone data to avoid modifying the original
    const result = { ...data };
    
    // Redact specified fields
    for (const field of fields) {
      if (result[field] !== undefined) {
        if (typeof result[field] === 'string') {
          result[field] = '[REDACTED]';
        } else if (typeof result[field] === 'object' && result[field] !== null) {
          result[field] = Array.isArray(result[field]) ? [] : {};
        } else {
          result[field] = null;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Validates a user's access to a specific feature or operation.
   * 
   * @async
   * @param {string} userId - User ID
   * @param {string} feature - Feature or operation name
   * @param {Object} [options] - Additional options
   * @returns {Promise<boolean>} True if access is allowed
   */
  async validateAccess(userId, feature, options = {}) {
    this.ensureInitialized();
    
    if (!userId) {
      throw new Error('SecurityIntegrationLayer.validateAccess requires userId parameter');
    }
    
    if (!feature) {
      throw new Error('SecurityIntegrationLayer.validateAccess requires feature parameter');
    }
    
    try {
      this.logger.debug(`Validating access for user ${userId} to feature ${feature}`, { options });
      
      // Get user information
      const user = await this.userManager.getUser(userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Get subscription information
      const subscription = await this.subscriptionManager.getUserSubscription(userId);
      
      if (!subscription) {
        throw new Error(`Subscription for user ${userId} not found`);
      }
      
      // Check feature access based on subscription tier
      const hasAccess = await this.subscriptionManager.hasFeatureAccess(subscription.id, feature);
      
      // Log access check
      const auditEvent = {
        type: 'access_check',
        userId,
        action: 'feature_access',
        resource: `feature:${feature}`,
        outcome: hasAccess ? 'success' : 'denied',
        metadata: {
          tier: subscription.tier,
          feature
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      return hasAccess;
    } catch (error) {
      this.logger.error(`Failed to validate access for user ${userId} to feature ${feature}`, error, { options });
      
      // Log access check failure
      const auditEvent = {
        type: 'access_check_failed',
        userId,
        action: 'feature_access',
        resource: `feature:${feature}`,
        outcome: 'failure',
        metadata: {
          error: error.message,
          feature
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      return false; // Default to denying access on error
    }
  }
  
  /**
   * Validates a model's usage based on subscription tier and usage limits.
   * 
   * @async
   * @param {string} userId - User ID
   * @param {string} modelId - Model ID
   * @param {Object} [options] - Additional options
   * @returns {Promise<boolean>} True if model usage is allowed
   */
  async validateModelUsage(userId, modelId, options = {}) {
    this.ensureInitialized();
    
    if (!userId) {
      throw new Error('SecurityIntegrationLayer.validateModelUsage requires userId parameter');
    }
    
    if (!modelId) {
      throw new Error('SecurityIntegrationLayer.validateModelUsage requires modelId parameter');
    }
    
    try {
      this.logger.debug(`Validating model usage for user ${userId} and model ${modelId}`, { options });
      
      // Get user information
      const user = await this.userManager.getUser(userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Get subscription information
      const subscription = await this.subscriptionManager.getUserSubscription(userId);
      
      if (!subscription) {
        throw new Error(`Subscription for user ${userId} not found`);
      }
      
      // Check model access based on subscription tier
      const hasAccess = await this.subscriptionManager.hasModelAccess(subscription.id, modelId);
      
      if (!hasAccess) {
        // Log model access denied
        const auditEvent = {
          type: 'model_access',
          userId,
          action: 'model_usage',
          resource: `model:${modelId}`,
          outcome: 'denied',
          metadata: {
            tier: subscription.tier,
            modelId,
            reason: 'Subscription tier does not include access to this model'
          },
          timestamp: new Date()
        };
        
        await this.auditLogger.logEvent(auditEvent);
        
        return false;
      }
      
      // Check usage limits
      const usageLimit = await this.subscriptionManager.getModelUsageLimit(subscription.id, modelId);
      const currentUsage = await this.subscriptionManager.getCurrentModelUsage(userId, modelId);
      
      const withinLimits = usageLimit === -1 || currentUsage < usageLimit;
      
      // Log model access check
      const auditEvent = {
        type: 'model_access',
        userId,
        action: 'model_usage',
        resource: `model:${modelId}`,
        outcome: withinLimits ? 'success' : 'denied',
        metadata: {
          tier: subscription.tier,
          modelId,
          currentUsage,
          usageLimit,
          reason: withinLimits ? 'Within usage limits' : 'Usage limit exceeded'
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      return withinLimits;
    } catch (error) {
      this.logger.error(`Failed to validate model usage for user ${userId} and model ${modelId}`, error, { options });
      
      // Log model access check failure
      const auditEvent = {
        type: 'model_access_failed',
        userId,
        action: 'model_usage',
        resource: `model:${modelId}`,
        outcome: 'failure',
        metadata: {
          error: error.message,
          modelId
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      return false; // Default to denying access on error
    }
  }
  
  /**
   * Records model usage for a user.
   * 
   * @async
   * @param {string} userId - User ID
   * @param {string} modelId - Model ID
   * @param {number} [tokens=1] - Number of tokens used
   * @returns {Promise<void>}
   */
  async recordModelUsage(userId, modelId, tokens = 1) {
    this.ensureInitialized();
    
    if (!userId) {
      throw new Error('SecurityIntegrationLayer.recordModelUsage requires userId parameter');
    }
    
    if (!modelId) {
      throw new Error('SecurityIntegrationLayer.recordModelUsage requires modelId parameter');
    }
    
    try {
      this.logger.debug(`Recording model usage for user ${userId} and model ${modelId}`, { tokens });
      
      // Record usage
      await this.subscriptionManager.recordModelUsage(userId, modelId, tokens);
      
      // Log usage recording
      const auditEvent = {
        type: 'model_usage',
        userId,
        action: 'record_usage',
        resource: `model:${modelId}`,
        outcome: 'success',
        metadata: {
          modelId,
          tokens
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
    } catch (error) {
      this.logger.error(`Failed to record model usage for user ${userId} and model ${modelId}`, error, { tokens });
      
      // Log usage recording failure
      const auditEvent = {
        type: 'model_usage_failed',
        userId,
        action: 'record_usage',
        resource: `model:${modelId}`,
        outcome: 'failure',
        metadata: {
          error: error.message,
          modelId,
          tokens
        },
        timestamp: new Date()
      };
      
      await this.auditLogger.logEvent(auditEvent);
      
      throw new Error(`Failed to record model usage: ${error.message}`);
    }
  }
  
  /**
   * Ensures that the layer is initialized.
   * 
   * @throws {Error} If layer is not initialized
   * @private
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('SecurityIntegrationLayer is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Gets security audit logs for a user.
   * 
   * @async
   * @param {string} userId - User ID
   * @param {Object} [options] - Query options
   * @param {Date} [options.startDate] - Start date for logs
   * @param {Date} [options.endDate] - End date for logs
   * @param {string} [options.type] - Event type filter
   * @param {number} [options.limit=100] - Maximum number of logs to return
   * @returns {Promise<AuditEvent[]>} Audit events
   */
  async getUserAuditLogs(userId, options = {}) {
    this.ensureInitialized();
    
    if (!userId) {
      throw new Error('SecurityIntegrationLayer.getUserAuditLogs requires userId parameter');
    }
    
    try {
      this.logger.debug(`Getting audit logs for user ${userId}`, { options });
      
      // Query audit logs
      const logs = await this.auditLogger.queryLogs({
        userId,
        startDate: options.startDate,
        endDate: options.endDate,
        type: options.type,
        limit: options.limit || 100
      });
      
      return logs;
    } catch (error) {
      this.logger.error(`Failed to get audit logs for user ${userId}`, error, { options });
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }
  }
  
  /**
   * Gets security audit logs for a request.
   * 
   * @async
   * @param {string} requestId - Request ID
   * @returns {Promise<AuditEvent[]>} Audit events
   */
  async getRequestAuditLogs(requestId) {
    this.ensureInitialized();
    
    if (!requestId) {
      throw new Error('SecurityIntegrationLayer.getRequestAuditLogs requires requestId parameter');
    }
    
    try {
      this.logger.debug(`Getting audit logs for request ${requestId}`);
      
      // Query audit logs
      const logs = await this.auditLogger.queryLogs({
        requestId
      });
      
      return logs;
    } catch (error) {
      this.logger.error(`Failed to get audit logs for request ${requestId}`, error);
      throw new Error(`Failed to get request audit logs: ${error.message}`);
    }
  }
}

module.exports = SecurityIntegrationLayer;
