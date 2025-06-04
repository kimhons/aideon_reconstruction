/**
 * @fileoverview Implementation of the RollbackManager component for the Autonomous Error Recovery System.
 * This component manages rollback operations for recovery strategies, ensuring that the system
 * can be safely restored to a known good state if a recovery action fails.
 * 
 * @module core/error_recovery/RollbackManager
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

/**
 * RollbackManager handles the creation and execution of rollback plans for recovery strategies.
 */
class RollbackManager {
  /**
   * Creates a new RollbackManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector
   * @param {EventEmitter} options.eventEmitter - Event emitter for rollback events
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    
    // Registry of rollback plans
    this.rollbackPlans = new Map();
    
    // History of executed rollbacks
    this.rollbackHistory = new Map();
    this.historyMaxSize = options.historyMaxSize || 100;
    
    this.logger.info('RollbackManager initialized');
  }
  
  /**
   * Creates a rollback plan for a recovery strategy.
   * @param {Object} strategy - Recovery strategy
   * @param {Object} context - Context information
   * @param {Object} context.systemState - Current system state
   * @param {Object} context.analysisResult - Result of causal analysis
   * @returns {Promise<Object>} Rollback plan
   */
  async createRollbackPlan(strategy, context) {
    const rollbackId = uuidv4();
    
    // Validate strategy object to prevent undefined errors
    if (!strategy) {
      this.logger.error('Cannot create rollback plan: strategy is undefined');
      return {
        id: rollbackId,
        strategyId: 'unknown',
        actions: [],
        createdAt: Date.now(),
        error: {
          message: 'Strategy object is undefined',
          code: 'INVALID_STRATEGY'
        },
        metadata: {
          originalStrategy: null,
          context: {
            systemStateSnapshot: context && context.systemState ? 
              this.createSystemStateSnapshot(context.systemState) : {}
          }
        }
      };
    }
    
    // Ensure strategy has an ID
    const strategyId = strategy.id || uuidv4();
    this.logger.debug(`Creating rollback plan ${rollbackId} for strategy ${strategyId}`);
    
    try {
      // Generate rollback actions for each action in the strategy
      const rollbackActions = [];
      
      // Ensure strategy has actions array
      const actions = strategy.actions || [];
      
      for (const action of actions) {
        const rollbackAction = await this.generateRollbackAction(action, context);
        if (rollbackAction) {
          rollbackActions.push(rollbackAction);
        }
      }
      
      // Create the rollback plan
      const rollbackPlan = {
        id: rollbackId,
        strategyId: strategy.id,
        actions: rollbackActions,
        createdAt: Date.now(),
        metadata: {
          originalStrategy: {
            id: strategy.id,
            name: strategy.name,
            description: strategy.description
          },
          context: {
            systemStateSnapshot: this.createSystemStateSnapshot(context.systemState)
          }
        }
      };
      
      // Store the rollback plan
      this.rollbackPlans.set(rollbackId, rollbackPlan);
      
      this.logger.debug(`Created rollback plan ${rollbackId} with ${rollbackActions.length} actions`);
      return rollbackPlan;
    } catch (error) {
      this.logger.error(`Failed to create rollback plan for strategy ${strategy.id}: ${error.message}`, error);
      
      // Create a minimal rollback plan for error handling
      const minimalRollbackPlan = {
        id: rollbackId,
        strategyId: strategy.id,
        actions: [],
        createdAt: Date.now(),
        error: {
          message: error.message,
          code: error.code || 'ROLLBACK_PLAN_CREATION_FAILED'
        },
        metadata: {
          originalStrategy: {
            id: strategy.id,
            name: strategy.name
          }
        }
      };
      
      this.rollbackPlans.set(rollbackId, minimalRollbackPlan);
      return minimalRollbackPlan;
    }
  }
  
  /**
   * Generates a rollback action for a recovery action.
   * @param {Object} action - Recovery action
   * @param {Object} context - Context information
   * @returns {Promise<Object|null>} Rollback action or null if no rollback is needed
   * @private
   */
  async generateRollbackAction(action, context) {
    // Default implementation - can be overridden in subclasses
    
    // Simple mapping of action types to rollback actions
    const actionTypeToRollback = {
      'restart_service': {
        actionId: 'verify_service_status',
        parameters: {
          serviceName: action.parameters.serviceName,
          expectedStatus: 'running'
        }
      },
      'clear_cache': {
        actionId: 'verify_cache_state',
        parameters: {
          cacheName: action.parameters.cacheName
        }
      },
      'update_configuration': {
        actionId: 'restore_configuration',
        parameters: {
          configPath: action.parameters.configPath,
          originalValue: context.systemState.configurations?.[action.parameters.configPath]
        }
      },
      'allocate_resources': {
        actionId: 'release_resources',
        parameters: {
          resourceId: action.parameters.resourceId,
          amount: action.parameters.amount
        }
      }
    };
    
    // Get rollback action based on action type
    const rollbackTemplate = actionTypeToRollback[action.actionId];
    
    if (!rollbackTemplate) {
      // No specific rollback action defined for this action type
      return {
        actionId: 'verify_system_state',
        parameters: {
          componentId: action.parameters.componentId || 'unknown',
          timeout: 5000
        },
        order: 1000 - (action.order || 0), // Reverse order for rollback
        description: `Verify system state after ${action.actionId}`
      };
    }
    
    return {
      ...rollbackTemplate,
      order: 1000 - (action.order || 0), // Reverse order for rollback
      description: `Rollback for ${action.actionId}: ${action.description || ''}`
    };
  }
  
  /**
   * Creates a snapshot of the system state for rollback purposes.
   * @param {Object} systemState - Current system state
   * @returns {Object} System state snapshot
   * @private
   */
  createSystemStateSnapshot(systemState) {
    // Create a simplified snapshot with essential information
    return {
      timestamp: Date.now(),
      services: systemState.services || {},
      resources: systemState.resources || {},
      configurations: systemState.configurations || {},
      connections: systemState.connections || {}
    };
  }
  
  /**
   * Executes a rollback plan.
   * @param {Object} rollbackPlan - Rollback plan to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Rollback execution result
   */
  async executeRollback(rollbackPlan, context) {
    const startTime = Date.now();
    const rollbackExecutionId = uuidv4();
    
    this.logger.info(`Executing rollback plan ${rollbackPlan.id}`);
    this.eventEmitter.emit('rollback:started', { 
      rollbackExecutionId, 
      rollbackPlan 
    });
    
    try {
      // Execute rollback actions in reverse order
      const sortedActions = [...rollbackPlan.actions].sort((a, b) => a.order - b.order);
      const actionResults = [];
      
      for (const action of sortedActions) {
        try {
          this.logger.debug(`Executing rollback action: ${action.actionId}`);
          
          // Simulate action execution
          await new Promise(resolve => setTimeout(resolve, 100));
          
          actionResults.push({
            actionId: action.actionId,
            successful: true,
            startTime: Date.now(),
            endTime: Date.now() + 100,
            result: {
              status: 'completed',
              message: `Successfully executed rollback action ${action.actionId}`
            }
          });
        } catch (actionError) {
          this.logger.error(`Error executing rollback action ${action.actionId}: ${actionError.message}`);
          
          actionResults.push({
            actionId: action.actionId,
            successful: false,
            startTime: Date.now(),
            endTime: Date.now(),
            error: {
              message: actionError.message,
              code: actionError.code
            }
          });
        }
      }
      
      // Create rollback result
      const rollbackResult = {
        rollbackExecutionId,
        rollbackPlanId: rollbackPlan.id,
        strategyId: rollbackPlan.strategyId,
        successful: actionResults.every(result => result.successful),
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        actionResults
      };
      
      // Update rollback history
      this.updateRollbackHistory(rollbackExecutionId, rollbackResult);
      
      this.logger.info(`Rollback execution completed: ${rollbackResult.successful ? 'successful' : 'failed'}`);
      this.eventEmitter.emit('rollback:completed', { 
        rollbackExecutionId, 
        result: rollbackResult 
      });
      
      return rollbackResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error during rollback execution: ${error.message}`, error);
      
      const failureResult = {
        rollbackExecutionId,
        rollbackPlanId: rollbackPlan.id,
        strategyId: rollbackPlan.strategyId,
        successful: false,
        startTime,
        endTime: Date.now(),
        duration,
        actionResults: [],
        error: {
          message: error.message,
          code: error.code || 'ROLLBACK_EXECUTION_FAILED',
          stack: error.stack
        }
      };
      
      // Update rollback history
      this.updateRollbackHistory(rollbackExecutionId, failureResult);
      
      this.eventEmitter.emit('rollback:failed', { 
        rollbackExecutionId, 
        error, 
        result: failureResult 
      });
      
      return failureResult;
    }
  }
  
  /**
   * Updates the rollback history.
   * @param {string} rollbackExecutionId - Rollback execution ID
   * @param {Object} result - Rollback execution result
   * @private
   */
  updateRollbackHistory(rollbackExecutionId, result) {
    // Add to history
    this.rollbackHistory.set(rollbackExecutionId, result);
    
    // Trim history if needed
    if (this.rollbackHistory.size > this.historyMaxSize) {
      const oldestKey = [...this.rollbackHistory.keys()][0];
      this.rollbackHistory.delete(oldestKey);
    }
    
    // Record metrics
    if (this.metrics) {
      this.metrics.recordMetric('rollback_execution', {
        rollbackExecutionId,
        successful: result.successful,
        duration: result.duration,
        actionCount: result.actionResults.length
      });
    }
  }
  
  /**
   * Gets a rollback plan by ID.
   * @param {string} rollbackPlanId - Rollback plan ID
   * @returns {Object|null} Rollback plan or null if not found
   */
  getRollbackPlan(rollbackPlanId) {
    return this.rollbackPlans.get(rollbackPlanId) || null;
  }
  
  /**
   * Gets rollback execution history by ID.
   * @param {string} rollbackExecutionId - Rollback execution ID
   * @returns {Object|null} Rollback execution result or null if not found
   */
  getRollbackExecutionHistory(rollbackExecutionId) {
    return this.rollbackHistory.get(rollbackExecutionId) || null;
  }
  
  /**
   * Gets all rollback plans for a strategy.
   * @param {string} strategyId - Strategy ID
   * @returns {Array<Object>} Rollback plans for the strategy
   */
  getRollbackPlansForStrategy(strategyId) {
    return [...this.rollbackPlans.values()]
      .filter(plan => plan.strategyId === strategyId);
  }
  
  /**
   * Cleans up old rollback plans.
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {number} Number of plans removed
   */
  cleanupOldRollbackPlans(maxAge) {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [id, plan] of this.rollbackPlans.entries()) {
      if (now - plan.createdAt > maxAge) {
        this.rollbackPlans.delete(id);
        removedCount++;
      }
    }
    
    this.logger.debug(`Cleaned up ${removedCount} old rollback plans`);
    return removedCount;
  }
}

module.exports = RollbackManager;
