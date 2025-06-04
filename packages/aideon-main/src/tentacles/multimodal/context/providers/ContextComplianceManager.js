/**
 * @fileoverview Context Compliance Manager for regulatory compliance.
 * 
 * This module provides a manager for ensuring regulatory compliance,
 * handling policy-based filtering, data sovereignty, and audit logging.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * ContextComplianceManager ensures regulatory compliance for context data.
 */
class ContextComplianceManager {
  /**
   * Constructor for ContextComplianceManager.
   * @param {Object} dependencies Required dependencies
   * @param {Object} dependencies.logger Logger instance
   * @param {Object} dependencies.performanceMonitor Performance Monitor instance
   * @param {Object} dependencies.configService Configuration Service instance
   * @param {Object} dependencies.mcpContextManager MCP Context Manager instance
   * @param {Object} dependencies.contextSecurityManager Context Security Manager instance
   * @param {Object} dependencies.lockAdapter Lock Adapter instance
   */
  constructor(dependencies) {
    // Validate dependencies
    if (!dependencies) {
      throw new Error("Dependencies are required");
    }
    
    const { 
      logger, 
      performanceMonitor, 
      configService, 
      mcpContextManager,
      contextSecurityManager,
      lockAdapter
    } = dependencies;
    
    if (!logger) {
      throw new Error("Logger is required");
    }
    
    if (!performanceMonitor) {
      throw new Error("Performance Monitor is required");
    }
    
    if (!configService) {
      throw new Error("Configuration Service is required");
    }
    
    if (!mcpContextManager) {
      throw new Error("MCP Context Manager is required");
    }
    
    if (!contextSecurityManager) {
      throw new Error("Context Security Manager is required");
    }
    
    if (!lockAdapter) {
      throw new Error("Lock Adapter is required");
    }
    
    // Store dependencies
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.configService = configService;
    this.mcpContextManager = mcpContextManager;
    this.contextSecurityManager = contextSecurityManager;
    
    // Initialize locks
    this.locks = {
      policy: lockAdapter.createLock("compliancePolicy"),
      audit: lockAdapter.createLock("complianceAudit"),
      filter: lockAdapter.createLock("complianceFilter")
    };
    
    // Initialize state
    this.initialized = false;
    this.compliancePolicies = new Map(); // Policy ID -> Policy details
    this.auditLog = [];
    this.policyEngines = new Map(); // Policy type -> Engine
    
    // Configure from service
    this.config = this.configService.getConfig("contextComplianceManager") || {
      defaultPolicyLevel: "strict",
      maxAuditLogSize: 10000,
      auditLogRotationIntervalSeconds: 3600, // 1 hour
      enableDataSovereignty: true,
      defaultDataRegion: "global",
      supportedComplianceStandards: ["GDPR", "HIPAA", "CCPA"]
    };
    
    // Register default policy engines
    this._registerDefaultPolicyEngines();
    
    this.logger.info("ContextComplianceManager created");
  }
  
  /**
   * Initialize the context compliance manager.
   * @param {Object} options Initialization options
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize(options = {}) {
    try {
      this.logger.debug("Initializing context compliance manager");
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer("initComplianceManager");
      
      // Check if already initialized
      if (this.initialized) {
        this.logger.debug("Context compliance manager already initialized");
        return true;
      }
      
      // Load policies from config service
      await this.loadPolicies();
      
      // Register hooks with MCP Context Manager
      this._registerContextHooks();
      
      // Start audit log rotation if enabled
      if (this.config.auditLogRotationIntervalSeconds > 0) {
        this._startAuditLogRotation();
      }
      
      // Set initialized state
      this.initialized = true;
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfTimer);
      
      this.logger.info("Context compliance manager initialized");
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize context compliance manager: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Load compliance policies from configuration.
   * @returns {Promise<boolean>} True if policies were loaded successfully
   */
  async loadPolicies() {
    try {
      this.logger.debug("Loading compliance policies");
      
      // Acquire lock
      await this.locks.policy();
      
      try {
        // Get policies from config service
        const policies = this.configService.getConfig("compliancePolicies") || [];
        
        // Clear existing policies
        this.compliancePolicies.clear();
        
        // Load new policies
        for (const policy of policies) {
          if (policy.id && policy.type && policy.rules) {
            this.compliancePolicies.set(policy.id, policy);
            this.logger.debug(`Loaded compliance policy: ${policy.id}`, { type: policy.type });
          } else {
            this.logger.warn("Skipping invalid compliance policy", { policy });
          }
        }
        
        this.logger.info(`Loaded ${this.compliancePolicies.size} compliance policies`);
        return true;
      } finally {
        // Release lock
        this.locks.policy.release();
      }
    } catch (error) {
      this.logger.error(`Failed to load compliance policies: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Add or update a compliance policy.
   * @param {Object} policy Policy details
   * @returns {Promise<boolean>} True if policy was added/updated successfully
   */
  async setPolicy(policy) {
    try {
      this.logger.debug("Setting compliance policy", { policyId: policy?.id });
      
      // Validate policy
      if (!policy || !policy.id || !policy.type || !policy.rules) {
        throw new Error("Invalid policy structure");
      }
      
      // Acquire lock
      await this.locks.policy();
      
      try {
        // Add/update policy
        this.compliancePolicies.set(policy.id, policy);
        
        // Persist policy (optional, depends on config service implementation)
        // await this.configService.setConfig("compliancePolicies", [...this.compliancePolicies.values()]);
        
        this.logger.info(`Set compliance policy: ${policy.id}`, { type: policy.type });
        return true;
      } finally {
        // Release lock
        this.locks.policy.release();
      }
    } catch (error) {
      this.logger.error(`Failed to set compliance policy: ${error.message}`, { error, policyId: policy?.id });
      throw error;
    }
  }
  
  /**
   * Remove a compliance policy.
   * @param {string} policyId Policy ID
   * @returns {Promise<boolean>} True if policy was removed successfully
   */
  async removePolicy(policyId) {
    try {
      this.logger.debug("Removing compliance policy", { policyId });
      
      // Validate policy ID
      if (!policyId) {
        throw new Error("Policy ID is required");
      }
      
      // Acquire lock
      await this.locks.policy();
      
      try {
        // Remove policy
        const deleted = this.compliancePolicies.delete(policyId);
        
        if (deleted) {
          // Persist changes (optional)
          // await this.configService.setConfig("compliancePolicies", [...this.compliancePolicies.values()]);
          this.logger.info(`Removed compliance policy: ${policyId}`);
        } else {
          this.logger.debug(`Compliance policy not found: ${policyId}`);
        }
        
        return deleted;
      } finally {
        // Release lock
        this.locks.policy.release();
      }
    } catch (error) {
      this.logger.error(`Failed to remove compliance policy: ${error.message}`, { error, policyId });
      throw error;
    }
  }
  
  /**
   * Check context data against compliance policies.
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @param {Object} metadata Context metadata
   * @returns {Promise<Object>} Compliance check result { compliant: boolean, violations: Array<Object>, filteredData: Object }
   */
  async checkCompliance(contextType, contextData, metadata = {}) {
    try {
      this.logger.debug("Checking compliance", { contextType });
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer("checkCompliance");
      
      // Acquire lock
      await this.locks.filter();
      
      let compliant = true;
      const violations = [];
      let filteredData = { ...contextData }; // Start with original data
      
      try {
        // Iterate through applicable policies
        for (const policy of this.compliancePolicies.values()) {
          // Check if policy applies to this context type
          if (this._policyApplies(policy, contextType, metadata)) {
            // Get policy engine
            const engine = this.policyEngines.get(policy.type) || this.policyEngines.get("default");
            
            if (engine) {
              // Apply policy
              const result = await engine.apply(policy, contextType, filteredData, metadata);
              
              if (!result.compliant) {
                compliant = false;
                violations.push(...result.violations);
              }
              
              // Update filtered data
              filteredData = result.filteredData;
            } else {
              this.logger.warn(`No policy engine found for type: ${policy.type}`, { policyId: policy.id });
            }
          }
        }
        
        // Log compliance check result
        await this._logAuditEvent("complianceCheck", {
          contextType,
          compliant,
          violationCount: violations.length,
          source: metadata.source,
          userId: metadata.userId
        });
        
        // End performance monitoring
        this.performanceMonitor.endTimer(perfTimer);
        
        return { compliant, violations, filteredData };
      } finally {
        // Release lock
        this.locks.filter.release();
      }
    } catch (error) {
      this.logger.error(`Failed to check compliance: ${error.message}`, { error, contextType });
      throw error;
    }
  }
  
  /**
   * Get the audit log.
   * @param {Object} options Filtering options
   * @param {number} options.limit Maximum number of entries
   * @param {number} options.since Timestamp to get entries since
   * @param {string} options.eventType Filter by event type
   * @param {string} options.userId Filter by user ID
   * @returns {Promise<Array<Object>>} Audit log entries
   */
  async getAuditLog(options = {}) {
    try {
      this.logger.debug("Getting audit log", { options });
      
      // Acquire lock
      await this.locks.audit();
      
      try {
        // Apply filters
        let filteredLog = [...this.auditLog];
        
        if (options.since) {
          filteredLog = filteredLog.filter(entry => entry.timestamp >= options.since);
        }
        
        if (options.eventType) {
          filteredLog = filteredLog.filter(entry => entry.eventType === options.eventType);
        }
        
        if (options.userId) {
          filteredLog = filteredLog.filter(entry => entry.details?.userId === options.userId);
        }
        
        // Apply limit
        if (options.limit) {
          filteredLog = filteredLog.slice(0, options.limit);
        }
        
        return filteredLog;
      } finally {
        // Release lock
        this.locks.audit.release();
      }
    } catch (error) {
      this.logger.error(`Failed to get audit log: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Register a policy engine for a specific policy type.
   * @param {string} policyType Policy type
   * @param {Object} engine Policy engine instance
   * @returns {boolean} True if registration was successful
   */
  registerPolicyEngine(policyType, engine) {
    try {
      if (!policyType) {
        throw new Error("Policy type is required");
      }
      
      if (!engine || typeof engine.apply !== "function") {
        throw new Error("Invalid policy engine instance");
      }
      
      this.policyEngines.set(policyType, engine);
      this.logger.debug(`Registered policy engine for type: ${policyType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register policy engine: ${error.message}`, { error, policyType });
      throw error;
    }
  }
  
  /**
   * Register hooks with MCP Context Manager.
   * @private
   */
  _registerContextHooks() {
    // Register pre-publish hook
    this.mcpContextManager.registerHook("prePublish", this._handlePrePublish.bind(this));
    
    // Register pre-get hook
    this.mcpContextManager.registerHook("preGet", this._handlePreGet.bind(this));
    
    this.logger.debug("Registered context hooks for compliance checks");
  }
  
  /**
   * Handle pre-publish context hook.
   * @private
   * @param {string} contextType Context type
   * @param {Object} contextData Context data
   * @param {Object} options Publish options
   * @returns {Promise<Object>} Modified context data and options
   */
  async _handlePrePublish(contextType, contextData, options) {
    try {
      // Check compliance
      const result = await this.checkCompliance(contextType, contextData, options.metadata || {});
      
      if (!result.compliant) {
        // Log violation
        this.logger.warn("Compliance violation detected on publish", {
          contextType,
          violations: result.violations,
          source: options.metadata?.source
        });
        
        // Handle violation based on policy (e.g., block, filter, log)
        // For now, we filter the data
        return { contextData: result.filteredData, options };
      }
      
      // Data is compliant, return original
      return { contextData, options };
    } catch (error) {
      this.logger.error(`Error in pre-publish compliance check: ${error.message}`, { error, contextType });
      // Allow publish to proceed in case of error
      return { contextData, options };
    }
  }
  
  /**
   * Handle pre-get context hook.
   * @private
   * @param {string} contextType Context type
   * @param {Object} options Get options
   * @returns {Promise<Object>} Modified options
   */
  async _handlePreGet(contextType, options) {
    // This hook can be used to check if the requester has permission
    // based on compliance rules before retrieving the data.
    // For now, we just log the access attempt.
    
    try {
      await this._logAuditEvent("contextAccessAttempt", {
        contextType,
        requester: options.requester,
        userId: options.userId
      });
    } catch (error) {
      this.logger.error(`Error logging context access attempt: ${error.message}`, { error, contextType });
    }
    
    // Return original options
    return options;
  }
  
  /**
   * Log an audit event.
   * @private
   * @param {string} eventType Event type
   * @param {Object} details Event details
   * @returns {Promise<void>}
   */
  async _logAuditEvent(eventType, details) {
    try {
      // Acquire lock
      await this.locks.audit();
      
      try {
        // Create audit entry
        const entry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: Date.now(),
          eventType,
          details
        };
        
        // Add to log
        this.auditLog.unshift(entry);
        
        // Trim log if needed
        if (this.auditLog.length > this.config.maxAuditLogSize) {
          this.auditLog = this.auditLog.slice(0, this.config.maxAuditLogSize);
        }
      } finally {
        // Release lock
        this.locks.audit.release();
      }
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`, { error, eventType });
    }
  }
  
  /**
   * Check if a policy applies to the given context.
   * @private
   * @param {Object} policy Policy object
   * @param {string} contextType Context type
   * @param {Object} metadata Context metadata
   * @returns {boolean} True if the policy applies
   */
  _policyApplies(policy, contextType, metadata) {
    // Check context type match
    if (policy.contextTypes && !policy.contextTypes.includes(contextType)) {
      return false;
    }
    
    // Check source match
    if (policy.sources && metadata.source && !policy.sources.includes(metadata.source)) {
      return false;
    }
    
    // Check user/role match
    if (policy.users && metadata.userId && !policy.users.includes(metadata.userId)) {
      return false;
    }
    
    if (policy.roles && metadata.userRoles && !policy.roles.some(role => metadata.userRoles.includes(role))) {
      return false;
    }
    
    // Check data region match
    if (this.config.enableDataSovereignty && policy.dataRegion) {
      const contextRegion = metadata.dataRegion || this.config.defaultDataRegion;
      if (policy.dataRegion !== contextRegion) {
        return false;
      }
    }
    
    // Policy applies
    return true;
  }
  
  /**
   * Start periodic audit log rotation.
   * @private
   */
  _startAuditLogRotation() {
    // Clear any existing interval
    if (this._auditLogRotationInterval) {
      clearInterval(this._auditLogRotationInterval);
    }
    
    // Set up new interval
    this._auditLogRotationInterval = setInterval(() => {
      this._rotateAuditLog().catch(error => {
        this.logger.error(`Audit log rotation failed: ${error.message}`, { error });
      });
    }, this.config.auditLogRotationIntervalSeconds * 1000);
    
    this.logger.debug(`Started audit log rotation with interval: ${this.config.auditLogRotationIntervalSeconds} seconds`);
  }
  
  /**
   * Rotate the audit log.
   * @private
   * @returns {Promise<void>}
   */
  async _rotateAuditLog() {
    try {
      this.logger.debug("Rotating audit log");
      
      // Acquire lock
      await this.locks.audit();
      
      try {
        // Get current log
        const currentLog = [...this.auditLog];
        
        // Clear current log
        this.auditLog = [];
        
        // Persist rotated log (e.g., write to file, send to log management system)
        // This part needs a concrete implementation based on requirements
        this.logger.info(`Rotated audit log with ${currentLog.length} entries`);
        
        // Example: Log to console
        // console.log("Rotated Audit Log:", JSON.stringify(currentLog, null, 2));
        
      } finally {
        // Release lock
        this.locks.audit.release();
      }
    } catch (error) {
      this.logger.error(`Failed to rotate audit log: ${error.message}`, { error });
    }
  }
  
  /**
   * Register default policy engines.
   * @private
   */
  _registerDefaultPolicyEngines() {
    // Default engine (basic filtering)
    this.registerPolicyEngine("default", {
      apply: async (policy, contextType, contextData, metadata) => {
        let compliant = true;
        const violations = [];
        let filteredData = { ...contextData };
        
        // Example: PII filtering rule
        if (policy.rules?.filterPII) {
          const piiFields = policy.rules.piiFields || ["email", "phone", "address"];
          for (const field of piiFields) {
            if (filteredData[field]) {
              filteredData[field] = "[REDACTED]";
              violations.push({ rule: "filterPII", field });
              compliant = false; // Consider filtering a violation
            }
          }
        }
        
        // Example: Data sovereignty rule
        if (policy.rules?.enforceDataRegion && policy.dataRegion) {
          const contextRegion = metadata.dataRegion || this.config.defaultDataRegion;
          if (policy.dataRegion !== contextRegion) {
            // Block data if region doesn't match
            violations.push({ rule: "enforceDataRegion", expected: policy.dataRegion, actual: contextRegion });
            return { compliant: false, violations, filteredData: {} }; // Return empty data
          }
        }
        
        return { compliant, violations, filteredData };
      }
    });
    
    // GDPR engine
    this.registerPolicyEngine("GDPR", {
      apply: async (policy, contextType, contextData, metadata) => {
        // Implement GDPR specific rules (e.g., consent checks, right to be forgotten)
        // This is a placeholder
        return { compliant: true, violations: [], filteredData: contextData };
      }
    });
    
    // HIPAA engine
    this.registerPolicyEngine("HIPAA", {
      apply: async (policy, contextType, contextData, metadata) => {
        // Implement HIPAA specific rules (e.g., PHI access control, encryption)
        // This is a placeholder
        return { compliant: true, violations: [], filteredData: contextData };
      }
    });
  }
}

module.exports = ContextComplianceManager;
