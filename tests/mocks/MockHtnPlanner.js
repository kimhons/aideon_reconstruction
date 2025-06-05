/**
 * MockHtnPlanner.js
 * 
 * Mock implementation of the Hierarchical Task Network (HTN) Planner for testing the Error Recovery System.
 * This mock simulates the planning capabilities that would be provided by the actual HTN Planner.
 * 
 * @module tests/mocks/MockHtnPlanner
 */

'use strict';

/**
 * Mock HTN Planner for testing
 */
class MockHtnPlanner {
  /**
   * Creates a new MockHtnPlanner instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.isInitialized = false;
    this.planHistory = [];
    this.executionHistory = [];
    this.adaptationHistory = [];
    
    // Configure mock behavior
    this.mockBehavior = {
      shouldSucceed: options.shouldSucceed !== false,
      shouldDelay: options.shouldDelay === true,
      delayMs: options.delayMs || 100,
      planningConfidence: options.planningConfidence || 0.85,
      maxPlanDepth: options.maxPlanDepth || 5
    };
    
    // Pre-configured plans for testing
    this.mockPlans = {
      'network_recovery': {
        id: 'network_recovery',
        steps: [
          {
            id: 'check_connectivity',
            action: 'diagnostic',
            parameters: { target: 'network', timeout: 2000 }
          },
          {
            id: 'retry_connection',
            action: 'retry',
            parameters: { maxAttempts: 3, backoffFactor: 1.5 }
          },
          {
            id: 'switch_endpoint',
            action: 'resource_switch',
            parameters: { resourceType: 'endpoint', target: 'backup_endpoint' },
            condition: { type: 'failure', step: 'retry_connection' }
          }
        ],
        estimatedSuccessRate: 0.85,
        estimatedDurationMs: 5000
      },
      
      'database_recovery': {
        id: 'database_recovery',
        steps: [
          {
            id: 'check_db_status',
            action: 'diagnostic',
            parameters: { target: 'database', timeout: 1000 }
          },
          {
            id: 'reconnect_db',
            action: 'reconnect',
            parameters: { target: 'primary_db', timeout: 3000 }
          },
          {
            id: 'switch_db',
            action: 'resource_switch',
            parameters: { resourceType: 'database', target: 'backup_db' },
            condition: { type: 'failure', step: 'reconnect_db' }
          },
          {
            id: 'verify_connection',
            action: 'diagnostic',
            parameters: { target: 'active_db', timeout: 1000 }
          }
        ],
        estimatedSuccessRate: 0.9,
        estimatedDurationMs: 8000
      },
      
      'permission_recovery': {
        id: 'permission_recovery',
        steps: [
          {
            id: 'check_permissions',
            action: 'diagnostic',
            parameters: { target: 'permissions', timeout: 1000 }
          },
          {
            id: 'request_elevation',
            action: 'permission_request',
            parameters: { level: 'elevated', timeout: 10000 }
          },
          {
            id: 'retry_operation',
            action: 'retry',
            parameters: { maxAttempts: 1, delay: 0 },
            condition: { type: 'success', step: 'request_elevation' }
          },
          {
            id: 'notify_user',
            action: 'notification',
            parameters: { level: 'warning', message: 'Permission denied' },
            condition: { type: 'failure', step: 'request_elevation' }
          }
        ],
        estimatedSuccessRate: 0.7,
        estimatedDurationMs: 12000
      },
      
      'resource_management': {
        id: 'resource_management',
        steps: [
          {
            id: 'check_resources',
            action: 'diagnostic',
            parameters: { target: 'system_resources', timeout: 1000 }
          },
          {
            id: 'reduce_concurrency',
            action: 'concurrency_adjustment',
            parameters: { target: 5, gradual: true }
          },
          {
            id: 'free_resources',
            action: 'resource_cleanup',
            parameters: { targets: ['cache', 'temp_files'] }
          },
          {
            id: 'verify_resources',
            action: 'diagnostic',
            parameters: { target: 'system_resources', timeout: 1000 }
          }
        ],
        estimatedSuccessRate: 0.8,
        estimatedDurationMs: 6000
      },
      
      'validation_recovery': {
        id: 'validation_recovery',
        steps: [
          {
            id: 'analyze_input',
            action: 'diagnostic',
            parameters: { target: 'input_data', timeout: 1000 }
          },
          {
            id: 'sanitize_input',
            action: 'data_transformation',
            parameters: { operations: ['trim', 'escape', 'validate'] }
          },
          {
            id: 'retry_operation',
            action: 'retry',
            parameters: { maxAttempts: 1, delay: 0 }
          }
        ],
        estimatedSuccessRate: 0.95,
        estimatedDurationMs: 3000
      }
    };
  }
  
  /**
   * Initialize the mock planner
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
      throw new Error('Mock HTN Planner initialization failure');
    }
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Generate a recovery plan
   * 
   * @param {Object} request - Planning request
   * @param {Object} context - Planning context
   * @returns {Promise<Object>} Generated plan
   */
  async generatePlan(request, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 2));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock HTN Planner generation failure');
    }
    
    // Store plan request
    this.planHistory.push({
      request,
      context,
      timestamp: Date.now()
    });
    
    // Process plan request
    const { errorType, errorPattern, constraints = {} } = request;
    let plan;
    
    // Select appropriate plan based on error type or pattern
    if (errorType === 'NetworkError' || errorPattern === 'network_timeout') {
      plan = this._clonePlan(this.mockPlans.network_recovery);
    } else if (errorType === 'DatabaseError' || errorPattern === 'database_connection') {
      plan = this._clonePlan(this.mockPlans.database_recovery);
    } else if (errorType === 'PermissionError' || errorPattern === 'permission_denied') {
      plan = this._clonePlan(this.mockPlans.permission_recovery);
    } else if (errorType === 'ResourceError' || errorPattern === 'resource_exhausted') {
      plan = this._clonePlan(this.mockPlans.resource_management);
    } else if (errorType === 'ValidationError' || errorPattern === 'validation_error') {
      plan = this._clonePlan(this.mockPlans.validation_recovery);
    } else {
      // Default to network recovery for unknown errors
      plan = this._clonePlan(this.mockPlans.network_recovery);
      plan.estimatedSuccessRate *= 0.7; // Lower confidence for unknown errors
    }
    
    // Apply constraints
    if (constraints.maxDuration && plan.estimatedDurationMs > constraints.maxDuration) {
      // Simplify plan to meet duration constraint
      plan.steps = plan.steps.slice(0, Math.max(2, Math.floor(plan.steps.length * 0.7)));
      plan.estimatedDurationMs = Math.min(plan.estimatedDurationMs, constraints.maxDuration);
      plan.estimatedSuccessRate *= 0.9; // Lower success rate for simplified plan
    }
    
    if (constraints.maxSteps && plan.steps.length > constraints.maxSteps) {
      // Truncate plan to meet step constraint
      plan.steps = plan.steps.slice(0, constraints.maxSteps);
      plan.estimatedSuccessRate *= 0.9; // Lower success rate for truncated plan
    }
    
    // Add plan metadata
    plan.generatedAt = Date.now();
    plan.planId = `plan_${this.planHistory.length}`;
    plan.confidence = this.mockBehavior.planningConfidence * (0.9 + Math.random() * 0.2); // Add some randomness
    
    return {
      success: true,
      plan,
      alternatives: this._generateAlternatives(plan, request),
      processingTime: this.mockBehavior.delayMs * 2
    };
  }
  
  /**
   * Execute a recovery plan
   * 
   * @param {Object} plan - Plan to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executePlan(plan, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!plan || !plan.steps || plan.steps.length === 0) {
      return {
        success: false,
        reason: 'invalid_plan',
        message: 'Plan is invalid or empty'
      };
    }
    
    // Store execution request
    this.executionHistory.push({
      plan,
      options,
      timestamp: Date.now()
    });
    
    // Process each step
    const stepResults = [];
    let success = true;
    let aborted = false;
    
    for (const step of plan.steps) {
      if (aborted) {
        stepResults.push({
          stepId: step.id,
          status: 'skipped',
          reason: 'plan_aborted'
        });
        continue;
      }
      
      // Simulate step execution delay
      if (this.mockBehavior.shouldDelay) {
        await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
      }
      
      // Check if step should be executed based on conditions
      if (step.condition) {
        const { type, step: conditionStep } = step.condition;
        const conditionStepResult = stepResults.find(r => r.stepId === conditionStep);
        
        if (conditionStepResult) {
          const conditionMet = (type === 'success' && conditionStepResult.status === 'success') ||
                              (type === 'failure' && conditionStepResult.status === 'failure');
          
          if (!conditionMet) {
            stepResults.push({
              stepId: step.id,
              status: 'skipped',
              reason: 'condition_not_met'
            });
            continue;
          }
        }
      }
      
      // Determine step success probability
      let stepSuccessProbability = 0.8; // Base probability
      
      // Adjust based on action type
      switch (step.action) {
        case 'diagnostic':
          stepSuccessProbability = 0.95;
          break;
        case 'retry':
          stepSuccessProbability = 0.7;
          break;
        case 'resource_switch':
          stepSuccessProbability = 0.8;
          break;
        case 'permission_request':
          stepSuccessProbability = 0.6;
          break;
        case 'notification':
          stepSuccessProbability = 0.99;
          break;
      }
      
      // Adjust based on options
      if (options.forceSuccess) {
        stepSuccessProbability = 1.0;
      } else if (options.forceFailure) {
        stepSuccessProbability = 0.0;
      }
      
      // Determine step outcome
      const stepSuccess = Math.random() < stepSuccessProbability;
      const stepDuration = Math.floor(this.mockBehavior.delayMs * (0.8 + Math.random() * 0.4));
      
      // Record step result
      const stepResult = {
        stepId: step.id,
        action: step.action,
        parameters: step.parameters,
        status: stepSuccess ? 'success' : 'failure',
        durationMs: stepDuration,
        timestamp: Date.now()
      };
      
      if (!stepSuccess) {
        stepResult.error = {
          code: 'step_execution_failed',
          message: `Failed to execute ${step.action} action`
        };
        
        // Update overall success
        success = false;
        
        // Check if we should abort on failure
        if (options.abortOnFailure) {
          aborted = true;
        }
      }
      
      stepResults.push(stepResult);
    }
    
    return {
      success,
      planId: plan.planId,
      steps: stepResults,
      aborted,
      completedSteps: stepResults.filter(s => s.status === 'success').length,
      totalSteps: plan.steps.length,
      durationMs: stepResults.reduce((total, step) => total + (step.durationMs || 0), 0)
    };
  }
  
  /**
   * Adapt planning strategy based on execution results
   * 
   * @param {Object} adaptationRequest - Adaptation request
   * @returns {Promise<Object>} Adaptation result
   */
  async adaptPlanningStrategy(adaptationRequest) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock HTN Planner adaptation failure');
    }
    
    // Store adaptation
    this.adaptationHistory.push({
      request: adaptationRequest,
      timestamp: Date.now()
    });
    
    // Process adaptation
    const { planId, executionResult, adaptationRules } = adaptationRequest;
    
    if (!planId || !executionResult) {
      return {
        success: false,
        reason: 'missing_required_fields',
        message: 'Plan ID and execution result are required for adaptation'
      };
    }
    
    // Generate adaptation changes
    const changes = [];
    
    // Analyze execution result
    const failedSteps = executionResult.steps.filter(s => s.status === 'failure');
    
    if (failedSteps.length > 0) {
      // Add alternative actions for failed steps
      for (const failedStep of failedSteps) {
        changes.push({
          type: 'step_alternative',
          stepId: failedStep.stepId,
          originalAction: failedStep.action,
          alternativeAction: this._getAlternativeAction(failedStep.action),
          reason: 'step_failure'
        });
      }
    }
    
    // Add general improvements
    if (executionResult.durationMs > 10000) {
      changes.push({
        type: 'optimization',
        target: 'duration',
        action: 'parallel_execution',
        parameters: { maxParallelSteps: 2 },
        reason: 'execution_too_slow'
      });
    }
    
    if (adaptationRules && adaptationRules.length > 0) {
      // Apply custom adaptation rules
      for (const rule of adaptationRules) {
        changes.push({
          type: 'custom_rule',
          rule: rule.id,
          parameters: rule.parameters,
          reason: 'user_defined_rule'
        });
      }
    }
    
    return {
      success: true,
      adaptationId: `adapt_${this.adaptationHistory.length}`,
      changes,
      appliedRules: adaptationRules ? adaptationRules.length : 0,
      processingTime: this.mockBehavior.delayMs
    };
  }
  
  /**
   * Get planning statistics
   * 
   * @returns {Object} Planning statistics
   */
  getPlanningStatistics() {
    return {
      plansGenerated: this.planHistory.length,
      plansExecuted: this.executionHistory.length,
      adaptationsApplied: this.adaptationHistory.length,
      averageConfidence: this.mockBehavior.planningConfidence,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Reset the mock planner
   */
  reset() {
    this.planHistory = [];
    this.executionHistory = [];
    this.adaptationHistory = [];
  }
  
  /**
   * Clone a plan to avoid modifying the original
   * 
   * @param {Object} plan - Plan to clone
   * @returns {Object} Cloned plan
   * @private
   */
  _clonePlan(plan) {
    return JSON.parse(JSON.stringify(plan));
  }
  
  /**
   * Generate alternative plans
   * 
   * @param {Object} mainPlan - Main plan
   * @param {Object} request - Planning request
   * @returns {Array<Object>} Alternative plans
   * @private
   */
  _generateAlternatives(mainPlan, request) {
    const alternatives = [];
    
    // Generate a simplified alternative
    if (mainPlan.steps.length > 2) {
      const simplifiedPlan = this._clonePlan(mainPlan);
      simplifiedPlan.steps = simplifiedPlan.steps.slice(0, 2);
      simplifiedPlan.planId = `${mainPlan.planId}_simple`;
      simplifiedPlan.estimatedSuccessRate = mainPlan.estimatedSuccessRate * 0.8;
      simplifiedPlan.estimatedDurationMs = Math.floor(mainPlan.estimatedDurationMs * 0.6);
      simplifiedPlan.isAlternative = true;
      
      alternatives.push(simplifiedPlan);
    }
    
    // Generate a more comprehensive alternative
    const comprehensivePlan = this._clonePlan(mainPlan);
    comprehensivePlan.steps = [...comprehensivePlan.steps];
    
    // Add verification step if not present
    if (!comprehensivePlan.steps.some(s => s.action === 'diagnostic' && s.id.includes('verify'))) {
      comprehensivePlan.steps.push({
        id: 'verify_recovery',
        action: 'diagnostic',
        parameters: { target: 'system_state', timeout: 2000 }
      });
    }
    
    comprehensivePlan.planId = `${mainPlan.planId}_comprehensive`;
    comprehensivePlan.estimatedSuccessRate = Math.min(0.95, mainPlan.estimatedSuccessRate * 1.1);
    comprehensivePlan.estimatedDurationMs = Math.floor(mainPlan.estimatedDurationMs * 1.3);
    comprehensivePlan.isAlternative = true;
    
    alternatives.push(comprehensivePlan);
    
    return alternatives;
  }
  
  /**
   * Get an alternative action for a failed action
   * 
   * @param {string} action - Original action
   * @returns {string} Alternative action
   * @private
   */
  _getAlternativeAction(action) {
    const alternatives = {
      'retry': 'resource_switch',
      'resource_switch': 'retry',
      'reconnect': 'resource_switch',
      'permission_request': 'notification',
      'concurrency_adjustment': 'resource_cleanup',
      'diagnostic': 'retry'
    };
    
    return alternatives[action] || 'diagnostic';
  }
}

module.exports = MockHtnPlanner;
