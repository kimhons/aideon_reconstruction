/**
 * EnhancedIntegrationValidationRunner.js
 * 
 * An enhanced validation runner for the Autonomous Error Recovery System.
 * Provides comprehensive validation of recovery strategies with detailed reporting.
 */

const { v4: uuidv4 } = require('uuid');

class EnhancedIntegrationValidationRunner {
  /**
   * Creates a new EnhancedIntegrationValidationRunner instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus instance
   * @param {Object} options.contextManager - Context manager instance
   * @param {Object} options.metrics - Metrics collector instance
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.contextManager = options.contextManager;
    this.metrics = options.metrics;
    this.logger = options.logger || console;
    
    // Validation rules registry
    this.validationRules = new Map();
    
    // Register default validation rules
    this.registerDefaultValidationRules();
    
    // Validation history
    this.validationHistory = new Map();
    
    this.logger.info('EnhancedIntegrationValidationRunner initialized');
  }
  
  /**
   * Registers a validation rule
   * 
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} rule - Validation rule object
   * @param {string} rule.name - Human-readable rule name
   * @param {string} rule.description - Rule description
   * @param {number} rule.priority - Rule priority (higher runs first)
   * @param {Function} rule.validate - Validation function
   * @returns {EnhancedIntegrationValidationRunner} - This instance for chaining
   */
  registerValidationRule(ruleId, rule) {
    if (!ruleId || typeof ruleId !== 'string') {
      throw new Error('Rule ID must be a non-empty string');
    }
    
    if (!rule || typeof rule !== 'object') {
      throw new Error(`Invalid rule object for ${ruleId}`);
    }
    
    if (!rule.validate || typeof rule.validate !== 'function') {
      throw new Error(`Invalid validation rule: ${ruleId}. Missing validate function.`);
    }
    
    this.validationRules.set(ruleId, {
      id: ruleId,
      ...rule,
      registeredAt: Date.now()
    });
    
    this.logger.debug(`Registered validation rule: ${ruleId} - ${rule.name}`);
    
    return this;
  }
  
  /**
   * Registers default validation rules
   * 
   * @private
   */
  registerDefaultValidationRules() {
    // Structure validation
    this.registerValidationRule('structure', {
      name: 'Strategy Structure Validation',
      description: 'Validates the basic structure of a recovery strategy',
      priority: 100,
      validate: (strategy) => {
        if (!strategy) {
          return {
            valid: false,
            message: 'Strategy is undefined'
          };
        }
        
        if (!strategy.id) {
          return {
            valid: false,
            message: 'Strategy is missing ID'
          };
        }
        
        if (!strategy.actions || !Array.isArray(strategy.actions) || strategy.actions.length === 0) {
          return {
            valid: false,
            message: 'Strategy has no actions'
          };
        }
        
        return { valid: true };
      }
    });
    
    // Action validation
    this.registerValidationRule('actions', {
      name: 'Action Validation',
      description: 'Validates each action in the strategy',
      priority: 90,
      validate: (strategy) => {
        if (!strategy || !strategy.actions) {
          return {
            valid: false,
            message: 'Strategy has no actions'
          };
        }
        
        for (let i = 0; i < strategy.actions.length; i++) {
          const action = strategy.actions[i];
          
          if (!action.actionId) {
            return {
              valid: false,
              message: `Action at index ${i} is missing actionId`
            };
          }
          
          if (!action.parameters || typeof action.parameters !== 'object') {
            return {
              valid: false,
              message: `Action at index ${i} is missing parameters`
            };
          }
        }
        
        return { valid: true };
      }
    });
    
    // Action sequence validation
    this.registerValidationRule('sequence', {
      name: 'Action Sequence Validation',
      description: 'Validates the sequence of actions in the strategy',
      priority: 80,
      validate: (strategy) => {
        if (!strategy || !strategy.actions || strategy.actions.length === 0) {
          return {
            valid: false,
            message: 'Strategy has no actions'
          };
        }
        
        // Check for dependencies between actions
        for (let i = 1; i < strategy.actions.length; i++) {
          const currentAction = strategy.actions[i];
          const previousAction = strategy.actions[i - 1];
          
          if (currentAction.dependencies) {
            // If action has explicit dependencies, check they're satisfied
            for (const dependency of currentAction.dependencies) {
              const dependencyMet = strategy.actions.slice(0, i).some(a => a.actionId === dependency);
              
              if (!dependencyMet) {
                return {
                  valid: false,
                  message: `Action ${currentAction.actionId} depends on ${dependency} which is not executed before it`
                };
              }
            }
          }
        }
        
        return { valid: true };
      }
    });
    
    // Resource validation
    this.registerValidationRule('resources', {
      name: 'Resource Validation',
      description: 'Validates resource requirements of the strategy',
      priority: 70,
      validate: (strategy, context) => {
        if (!strategy || !strategy.actions) {
          return {
            valid: false,
            message: 'Strategy has no actions'
          };
        }
        
        // Check if strategy has resource requirements
        if (!strategy.resourceRequirements) {
          return { valid: true }; // No explicit requirements, assume valid
        }
        
        // If context has available resources, check against requirements
        if (context && context.availableResources) {
          const { availableResources } = context;
          const { resourceRequirements } = strategy;
          
          // Check CPU
          if (resourceRequirements.cpu && availableResources.cpu < resourceRequirements.cpu) {
            return {
              valid: false,
              message: `Insufficient CPU resources: required ${resourceRequirements.cpu}, available ${availableResources.cpu}`
            };
          }
          
          // Check memory
          if (resourceRequirements.memory && availableResources.memory < resourceRequirements.memory) {
            return {
              valid: false,
              message: `Insufficient memory resources: required ${resourceRequirements.memory}, available ${availableResources.memory}`
            };
          }
          
          // Check disk
          if (resourceRequirements.disk && availableResources.disk < resourceRequirements.disk) {
            return {
              valid: false,
              message: `Insufficient disk resources: required ${resourceRequirements.disk}, available ${availableResources.disk}`
            };
          }
        }
        
        return { valid: true };
      }
    });
    
    // Safety validation
    this.registerValidationRule('safety', {
      name: 'Safety Validation',
      description: 'Validates safety aspects of the strategy',
      priority: 60,
      validate: (strategy, context) => {
        if (!strategy || !strategy.actions) {
          return {
            valid: false,
            message: 'Strategy has no actions'
          };
        }
        
        // Check for critical system actions
        const criticalActions = strategy.actions.filter(action => 
          action.actionId.includes('system') || 
          action.actionId.includes('critical') ||
          action.actionId.includes('delete') ||
          action.actionId.includes('remove')
        );
        
        if (criticalActions.length > 0) {
          // If strategy contains critical actions, check for safety measures
          if (!strategy.safetyMeasures || Object.keys(strategy.safetyMeasures).length === 0) {
            return {
              valid: false,
              message: 'Strategy contains critical actions but no safety measures'
            };
          }
          
          // Check for rollback plan
          if (!strategy.safetyMeasures.rollbackPlan) {
            return {
              valid: false,
              message: 'Strategy contains critical actions but no rollback plan'
            };
          }
        }
        
        return { valid: true };
      }
    });
    
    // Context compatibility validation
    this.registerValidationRule('contextCompatibility', {
      name: 'Context Compatibility Validation',
      description: 'Validates compatibility of the strategy with the context',
      priority: 50,
      validate: (strategy, context) => {
        if (!strategy) {
          return {
            valid: false,
            message: 'Strategy is undefined'
          };
        }
        
        if (!context) {
          return {
            valid: true // No context to validate against
          };
        }
        
        // Check if strategy has context requirements
        if (!strategy.contextRequirements) {
          return { valid: true }; // No explicit requirements, assume valid
        }
        
        // Check required context fields
        const { contextRequirements } = strategy;
        
        if (contextRequirements.requiredFields) {
          const missingFields = contextRequirements.requiredFields.filter(field => 
            context[field] === undefined
          );
          
          if (missingFields.length > 0) {
            return {
              valid: false,
              message: `Context missing required fields: ${missingFields.join(', ')}`
            };
          }
        }
        
        return { valid: true };
      }
    });
    
    // Neural validation (if neural context available)
    this.registerValidationRule('neural', {
      name: 'Neural Validation',
      description: 'Validates strategy using neural insights',
      priority: 40,
      validate: (strategy, context) => {
        if (!strategy) {
          return {
            valid: false,
            message: 'Strategy is undefined'
          };
        }
        
        // Skip if no neural context available
        if (!context || !context.neuralValidationCriteria) {
          return { valid: true };
        }
        
        const { neuralValidationCriteria } = context;
        
        // Apply neural safety checks
        if (neuralValidationCriteria.safetyChecks && neuralValidationCriteria.safetyChecks.length > 0) {
          for (const check of neuralValidationCriteria.safetyChecks) {
            // Simple string-based check for demonstration
            // In a real implementation, this would be more sophisticated
            const actionIds = strategy.actions.map(a => a.actionId);
            
            if (check.forbiddenActions) {
              const forbiddenFound = actionIds.some(id => 
                check.forbiddenActions.some(forbidden => id.includes(forbidden))
              );
              
              if (forbiddenFound) {
                return {
                  valid: false,
                  message: `Strategy contains actions forbidden by neural safety check: ${check.name}`
                };
              }
            }
          }
        }
        
        return { valid: true };
      }
    });
  }
  
  /**
   * Validates a recovery strategy
   * 
   * @param {Object} strategy - Recovery strategy to validate
   * @param {Object} context - Context object
   * @param {Object} options - Validation options
   * @param {boolean} options.failFast - Whether to stop on first failure
   * @returns {Promise<boolean>} - Whether the strategy is valid
   */
  async validateStrategy(strategy, context = {}, options = {}) {
    const validationId = uuidv4();
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Starting enhanced strategy validation: ${validationId}`);
      
      if (this.eventBus) {
        this.eventBus.emit('validation:started', { validationId, strategy, context });
      }
      
      if (this.metrics) {
        this.metrics.incrementCounter('validation_total');
      }
      
      // Get validation rules sorted by priority
      const rules = Array.from(this.validationRules.values())
        .sort((a, b) => b.priority - a.priority);
      
      // Apply each validation rule
      const results = [];
      let isValid = true;
      
      for (const rule of rules) {
        const ruleStartTime = Date.now();
        const result = await rule.validate(strategy, context, options);
        const ruleDuration = Date.now() - ruleStartTime;
        
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          valid: result.valid,
          message: result.message,
          details: result.details,
          duration: ruleDuration
        });
        
        if (!result.valid) {
          isValid = false;
          this.logger.warn(`Validation rule ${rule.id} failed: ${result.message}`);
          
          if (options.failFast) {
            break;
          }
        }
        
        if (this.metrics) {
          this.metrics.recordTiming(`validation_rule_${rule.id}`, ruleDuration);
          this.metrics.recordSuccess(`validation_rule_${rule.id}`, result.valid);
        }
      }
      
      const duration = Date.now() - startTime;
      
      // Record validation result
      const validationResult = {
        validationId,
        strategyId: strategy.id,
        isValid,
        results,
        timestamp: Date.now(),
        duration
      };
      
      this.validationHistory.set(validationId, validationResult);
      
      this.logger.debug(`Completed strategy validation in ${duration}ms: ${validationId}, isValid: ${isValid}`);
      
      if (this.eventBus) {
        this.eventBus.emit('validation:completed', { 
          validationId, 
          isValid, 
          results,
          duration 
        });
      }
      
      if (this.metrics) {
        this.metrics.recordTiming('validation', duration);
        this.metrics.recordSuccess('validation', isValid);
      }
      
      return isValid;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error during strategy validation: ${error.message}`, error);
      
      if (this.eventBus) {
        this.eventBus.emit('validation:failed', { 
          validationId, 
          error, 
          duration 
        });
      }
      
      // Record validation failure
      this.validationHistory.set(validationId, {
        validationId,
        strategyId: strategy?.id || 'unknown',
        isValid: false,
        error: {
          message: error.message,
          stack: error.stack
        },
        timestamp: Date.now(),
        duration
      });
      
      if (this.metrics) {
        this.metrics.recordTiming('validation', duration);
        this.metrics.recordSuccess('validation', false);
      }
      
      return false;
    }
  }
  
  /**
   * Gets validation history
   * 
   * @param {string} validationId - Optional validation ID to filter by
   * @returns {Array|Object} - Validation history or specific validation result
   */
  getValidationHistory(validationId) {
    if (validationId) {
      return this.validationHistory.get(validationId) || null;
    }
    
    return Array.from(this.validationHistory.values());
  }
  
  /**
   * Gets all registered validation rules
   * 
   * @returns {Array<Object>} - Array of validation rules
   */
  getValidationRules() {
    return Array.from(this.validationRules.values());
  }
  
  /**
   * Sets the logger instance
   * 
   * @param {Object} logger - Logger instance with debug, info, warn, error methods
   * @returns {EnhancedIntegrationValidationRunner} - This instance for chaining
   */
  setLogger(logger) {
    if (!logger || typeof logger !== 'object') {
      throw new Error('Invalid logger: must be an object');
    }
    
    if (!logger.debug || !logger.info || !logger.warn || !logger.error) {
      throw new Error('Invalid logger: must have debug, info, warn, error methods');
    }
    
    this.logger = logger;
    return this;
  }
  
  /**
   * Sets the event bus instance
   * 
   * @param {Object} eventBus - Event bus instance
   * @returns {EnhancedIntegrationValidationRunner} - This instance for chaining
   */
  setEventBus(eventBus) {
    if (!eventBus || typeof eventBus !== 'object') {
      throw new Error('Invalid event bus: must be an object');
    }
    
    if (!eventBus.emit || typeof eventBus.emit !== 'function') {
      throw new Error('Invalid event bus: must have emit method');
    }
    
    this.eventBus = eventBus;
    return this;
  }
  
  /**
   * Sets the context manager instance
   * 
   * @param {Object} contextManager - Context manager instance
   * @returns {EnhancedIntegrationValidationRunner} - This instance for chaining
   */
  setContextManager(contextManager) {
    if (!contextManager || typeof contextManager !== 'object') {
      throw new Error('Invalid context manager: must be an object');
    }
    
    if (!contextManager.getContext || typeof contextManager.getContext !== 'function') {
      throw new Error('Invalid context manager: must have getContext method');
    }
    
    this.contextManager = contextManager;
    return this;
  }
  
  /**
   * Sets the metrics collector instance
   * 
   * @param {Object} metrics - Metrics collector instance
   * @returns {EnhancedIntegrationValidationRunner} - This instance for chaining
   */
  setMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
      throw new Error('Invalid metrics collector: must be an object');
    }
    
    if (!metrics.incrementCounter || !metrics.recordTiming || !metrics.recordSuccess) {
      throw new Error('Invalid metrics collector: must have incrementCounter, recordTiming, and recordSuccess methods');
    }
    
    this.metrics = metrics;
    return this;
  }
}

module.exports = EnhancedIntegrationValidationRunner;
