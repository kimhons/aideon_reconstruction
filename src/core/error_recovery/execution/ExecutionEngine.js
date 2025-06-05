/**
 * ExecutionEngine.js
 * 
 * Provides the core execution capabilities for recovery strategies.
 * This component is responsible for executing strategy actions in various modes
 * (sequential, parallel, phased) and handling execution monitoring and feedback.
 * 
 * @module src/core/error_recovery/execution/ExecutionEngine
 */

'use strict';

/**
 * Class responsible for executing recovery strategy actions
 */
class ExecutionEngine {
  /**
   * Creates a new ExecutionEngine instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.monitoringSystem - System for monitoring execution
   * @param {Object} options.rollbackManager - Manager for handling rollbacks
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.monitoringSystem = options.monitoringSystem;
    this.rollbackManager = options.rollbackManager;
    this.config = options.config || {};
    
    this.defaultTimeout = this.config.defaultTimeoutMs || 30000;
    this.maxRetries = this.config.maxRetries || 3;
    this.defaultExecutionMode = this.config.defaultExecutionMode || 'sequential';
    
    this.activeExecutions = new Map();
    this._initialize();
  }
  
  /**
   * Initialize the execution engine
   * @private
   */
  _initialize() {
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('execution:cancel', this._handleCancelRequest.bind(this));
    }
  }
  
  /**
   * Execute a recovery strategy
   * 
   * @param {Object} strategy - Strategy to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeStrategy(strategy, options = {}) {
    if (!strategy || !Array.isArray(strategy.actions) || strategy.actions.length === 0) {
      return {
        success: false,
        error: 'Invalid strategy or empty actions',
        strategyId: strategy?.id
      };
    }
    
    const executionId = options.executionId || `exec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const executionMode = options.executionMode || this.defaultExecutionMode;
    const timeout = options.timeoutMs || this.defaultTimeout;
    const context = options.context || {};
    
    // Create execution context
    const executionContext = {
      id: executionId,
      strategyId: strategy.id,
      startTime: Date.now(),
      mode: executionMode,
      timeout,
      status: 'running',
      actions: [...strategy.actions],
      results: [],
      completedActions: 0,
      failedActions: 0,
      context
    };
    
    // Register active execution
    this.activeExecutions.set(executionId, executionContext);
    
    // Emit execution started event
    if (this.eventBus) {
      this.eventBus.emit('strategy:execution:started', {
        executionId,
        strategyId: strategy.id,
        mode: executionMode,
        actionCount: strategy.actions.length,
        timestamp: executionContext.startTime,
        context
      });
    }
    
    // Start monitoring if available
    if (this.monitoringSystem) {
      this.monitoringSystem.startMonitoring(executionId, {
        strategy,
        executionContext
      });
    }
    
    // Create snapshot for rollback if available
    if (this.rollbackManager) {
      await this.rollbackManager.createSnapshot(executionId, {
        strategy,
        executionContext
      });
    }
    
    try {
      // Execute strategy based on mode
      let result;
      
      switch (executionMode) {
        case 'parallel':
          result = await this._executeParallel(executionContext, strategy);
          break;
        case 'phased':
          result = await this._executePhased(executionContext, strategy);
          break;
        case 'distributed':
          result = await this._executeDistributed(executionContext, strategy);
          break;
        case 'sequential':
        default:
          result = await this._executeSequential(executionContext, strategy);
      }
      
      // Update execution status
      executionContext.status = result.success ? 'completed' : 'failed';
      executionContext.endTime = Date.now();
      executionContext.executionTime = executionContext.endTime - executionContext.startTime;
      
      // Emit execution completed event
      if (this.eventBus) {
        this.eventBus.emit('strategy:execution:completed', {
          executionId,
          strategyId: strategy.id,
          success: result.success,
          executionTime: executionContext.executionTime,
          completedActions: executionContext.completedActions,
          failedActions: executionContext.failedActions,
          timestamp: executionContext.endTime,
          context
        });
      }
      
      // Stop monitoring if available
      if (this.monitoringSystem) {
        this.monitoringSystem.stopMonitoring(executionId, {
          success: result.success,
          executionContext
        });
      }
      
      return {
        ...result,
        executionId,
        executionTime: executionContext.executionTime
      };
    } catch (error) {
      // Handle execution error
      executionContext.status = 'error';
      executionContext.endTime = Date.now();
      executionContext.executionTime = executionContext.endTime - executionContext.startTime;
      executionContext.error = error.message;
      
      // Emit execution failed event
      if (this.eventBus) {
        this.eventBus.emit('strategy:execution:failed', {
          executionId,
          strategyId: strategy.id,
          error: error.message,
          executionTime: executionContext.executionTime,
          completedActions: executionContext.completedActions,
          failedActions: executionContext.failedActions,
          timestamp: executionContext.endTime,
          context
        });
      }
      
      // Stop monitoring if available
      if (this.monitoringSystem) {
        this.monitoringSystem.stopMonitoring(executionId, {
          success: false,
          error,
          executionContext
        });
      }
      
      // Perform rollback if available and needed
      if (this.rollbackManager && this.config.autoRollbackOnError !== false) {
        try {
          await this.rollbackManager.performRollback(executionId, {
            error,
            executionContext
          });
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError.message);
        }
      }
      
      return {
        success: false,
        error: error.message,
        executionId,
        executionTime: executionContext.executionTime,
        completedActions: executionContext.completedActions,
        failedActions: executionContext.failedActions,
        strategyId: strategy.id
      };
    } finally {
      // Clean up after execution timeout
      setTimeout(() => {
        this.activeExecutions.delete(executionId);
      }, 60000); // Keep execution context for 1 minute for potential queries
    }
  }
  
  /**
   * Cancel an active execution
   * 
   * @param {string} executionId - ID of execution to cancel
   * @returns {boolean} Whether cancellation was successful
   */
  cancelExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'running') {
      return false;
    }
    
    execution.status = 'cancelled';
    execution.endTime = Date.now();
    execution.executionTime = execution.endTime - execution.startTime;
    
    // Emit execution cancelled event
    if (this.eventBus) {
      this.eventBus.emit('strategy:execution:cancelled', {
        executionId,
        strategyId: execution.strategyId,
        executionTime: execution.executionTime,
        completedActions: execution.completedActions,
        timestamp: execution.endTime
      });
    }
    
    // Stop monitoring if available
    if (this.monitoringSystem) {
      this.monitoringSystem.stopMonitoring(executionId, {
        success: false,
        cancelled: true,
        executionContext: execution
      });
    }
    
    // Perform rollback if available and needed
    if (this.rollbackManager && this.config.autoRollbackOnCancel !== false) {
      this.rollbackManager.performRollback(executionId, {
        cancelled: true,
        executionContext: execution
      }).catch(error => {
        console.error('Rollback failed:', error.message);
      });
    }
    
    return true;
  }
  
  /**
   * Get execution status
   * 
   * @param {string} executionId - ID of execution to check
   * @returns {Object} Execution status
   */
  getExecutionStatus(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return { found: false };
    }
    
    return {
      found: true,
      status: execution.status,
      startTime: execution.startTime,
      endTime: execution.endTime,
      executionTime: execution.endTime ? execution.endTime - execution.startTime : Date.now() - execution.startTime,
      completedActions: execution.completedActions,
      failedActions: execution.failedActions,
      totalActions: execution.actions.length,
      progress: execution.actions.length > 0 ? 
        (execution.completedActions / execution.actions.length) * 100 : 0
    };
  }
  
  /**
   * Execute strategy actions sequentially
   * 
   * @param {Object} executionContext - Execution context
   * @param {Object} strategy - Strategy to execute
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeSequential(executionContext, strategy) {
    const { actions } = strategy;
    const results = [];
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      // Check if execution was cancelled
      if (executionContext.status === 'cancelled') {
        return {
          success: false,
          error: 'Execution cancelled',
          results,
          completedActions: i,
          strategyId: strategy.id
        };
      }
      
      try {
        // Execute action with retry logic
        const actionResult = await this._executeActionWithRetry(action, executionContext);
        results.push(actionResult);
        
        // Update execution context
        executionContext.completedActions++;
        executionContext.results.push(actionResult);
        
        // Check if action failed and should stop execution
        if (!actionResult.success && action.critical !== false) {
          executionContext.failedActions++;
          return {
            success: false,
            error: `Action ${i + 1} failed: ${actionResult.error}`,
            failedActionIndex: i,
            results,
            completedActions: i + 1,
            failedActions: 1,
            strategyId: strategy.id
          };
        }
        
        // Check if action failed but is non-critical
        if (!actionResult.success) {
          executionContext.failedActions++;
        }
      } catch (error) {
        // Handle unexpected action execution error
        executionContext.failedActions++;
        return {
          success: false,
          error: `Action ${i + 1} threw an exception: ${error.message}`,
          failedActionIndex: i,
          results,
          completedActions: i,
          failedActions: 1,
          strategyId: strategy.id
        };
      }
    }
    
    // All actions completed successfully
    return {
      success: executionContext.failedActions === 0,
      results,
      completedActions: actions.length,
      failedActions: executionContext.failedActions,
      strategyId: strategy.id
    };
  }
  
  /**
   * Execute strategy actions in parallel
   * 
   * @param {Object} executionContext - Execution context
   * @param {Object} strategy - Strategy to execute
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeParallel(executionContext, strategy) {
    const { actions } = strategy;
    const actionPromises = [];
    const results = new Array(actions.length);
    
    // Create promises for all actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const actionPromise = this._executeActionWithRetry(action, executionContext)
        .then(result => {
          // Update execution context
          executionContext.completedActions++;
          if (!result.success) {
            executionContext.failedActions++;
          }
          
          // Store result
          results[i] = result;
          return { index: i, result };
        })
        .catch(error => {
          // Handle unexpected action execution error
          executionContext.failedActions++;
          results[i] = {
            success: false,
            error: error.message
          };
          return { index: i, error };
        });
      
      actionPromises.push(actionPromise);
    }
    
    // Wait for all actions to complete
    await Promise.all(actionPromises);
    
    // Check if any critical actions failed
    let failedCriticalAction = false;
    let failedCriticalIndex = -1;
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const result = results[i];
      
      if (!result.success && action.critical !== false) {
        failedCriticalAction = true;
        failedCriticalIndex = i;
        break;
      }
    }
    
    // Return execution result
    return {
      success: executionContext.failedActions === 0,
      results,
      completedActions: executionContext.completedActions,
      failedActions: executionContext.failedActions,
      failedCriticalAction,
      failedActionIndex: failedCriticalIndex,
      strategyId: strategy.id
    };
  }
  
  /**
   * Execute strategy actions in phases
   * 
   * @param {Object} executionContext - Execution context
   * @param {Object} strategy - Strategy to execute
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executePhased(executionContext, strategy) {
    const { actions } = strategy;
    const results = [];
    
    // Group actions by phase
    const phases = new Map();
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const phase = action.phase || 0;
      
      if (!phases.has(phase)) {
        phases.set(phase, []);
      }
      
      phases.get(phase).push({ index: i, action });
    }
    
    // Sort phases
    const sortedPhases = Array.from(phases.keys()).sort((a, b) => a - b);
    
    // Execute each phase
    for (const phase of sortedPhases) {
      const phaseActions = phases.get(phase);
      const phaseResults = new Array(phaseActions.length);
      const phasePromises = [];
      
      // Check if execution was cancelled
      if (executionContext.status === 'cancelled') {
        return {
          success: false,
          error: 'Execution cancelled',
          results,
          completedActions: executionContext.completedActions,
          failedActions: executionContext.failedActions,
          strategyId: strategy.id
        };
      }
      
      // Execute all actions in this phase in parallel
      for (let i = 0; i < phaseActions.length; i++) {
        const { index, action } = phaseActions[i];
        
        const actionPromise = this._executeActionWithRetry(action, executionContext)
          .then(result => {
            // Update execution context
            executionContext.completedActions++;
            if (!result.success) {
              executionContext.failedActions++;
            }
            
            // Store result
            results[index] = result;
            phaseResults[i] = result;
            return { index, result };
          })
          .catch(error => {
            // Handle unexpected action execution error
            executionContext.failedActions++;
            const result = {
              success: false,
              error: error.message
            };
            results[index] = result;
            phaseResults[i] = result;
            return { index, error };
          });
        
        phasePromises.push(actionPromise);
      }
      
      // Wait for all actions in this phase to complete
      await Promise.all(phasePromises);
      
      // Check if any critical actions failed in this phase
      let failedCriticalAction = false;
      let failedCriticalIndex = -1;
      
      for (let i = 0; i < phaseActions.length; i++) {
        const { index, action } = phaseActions[i];
        const result = phaseResults[i];
        
        if (!result.success && action.critical !== false) {
          failedCriticalAction = true;
          failedCriticalIndex = index;
          break;
        }
      }
      
      // If a critical action failed, stop execution
      if (failedCriticalAction) {
        return {
          success: false,
          error: `Critical action failed in phase ${phase}`,
          failedActionIndex: failedCriticalIndex,
          results,
          completedActions: executionContext.completedActions,
          failedActions: executionContext.failedActions,
          strategyId: strategy.id
        };
      }
    }
    
    // All phases completed
    return {
      success: executionContext.failedActions === 0,
      results,
      completedActions: executionContext.completedActions,
      failedActions: executionContext.failedActions,
      strategyId: strategy.id
    };
  }
  
  /**
   * Execute strategy actions in distributed mode
   * 
   * @param {Object} executionContext - Execution context
   * @param {Object} strategy - Strategy to execute
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _executeDistributed(executionContext, strategy) {
    // In a real implementation, this would coordinate execution across multiple devices
    // For now, we'll simulate distributed execution by using the phased execution
    return this._executePhased(executionContext, strategy);
  }
  
  /**
   * Execute a single action with retry logic
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeActionWithRetry(action, executionContext) {
    const maxRetries = action.maxRetries !== undefined ? action.maxRetries : this.maxRetries;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check if execution was cancelled
      if (executionContext.status === 'cancelled') {
        return {
          success: false,
          error: 'Execution cancelled',
          action: action.type,
          attempt
        };
      }
      
      try {
        // Execute action
        const result = await this._executeAction(action, executionContext);
        
        // If successful, return result
        if (result.success) {
          return {
            ...result,
            attempt: attempt + 1
          };
        }
        
        // If not successful, store error for retry
        lastError = result.error;
        
        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          // Calculate backoff delay (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        // Store unexpected error for retry
        lastError = error.message;
        
        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          // Calculate backoff delay (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    return {
      success: false,
      error: lastError || 'Action failed after all retry attempts',
      action: action.type,
      attempt: maxRetries + 1
    };
  }
  
  /**
   * Execute a single action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeAction(action, executionContext) {
    if (!action || !action.type) {
      return {
        success: false,
        error: 'Invalid action',
        action: 'unknown'
      };
    }
    
    // Emit action execution started event
    if (this.eventBus) {
      this.eventBus.emit('action:execution:started', {
        executionId: executionContext.id,
        strategyId: executionContext.strategyId,
        actionType: action.type,
        timestamp: Date.now()
      });
    }
    
    try {
      // Execute action based on type
      let result;
      
      switch (action.type) {
        case 'system_call':
          result = await this._executeSystemCall(action, executionContext);
          break;
        case 'file_write':
          result = await this._executeFileWrite(action, executionContext);
          break;
        case 'file_read':
          result = await this._executeFileRead(action, executionContext);
          break;
        case 'process_kill':
          result = await this._executeProcessKill(action, executionContext);
          break;
        case 'network_config':
          result = await this._executeNetworkConfig(action, executionContext);
          break;
        case 'service_control':
          result = await this._executeServiceControl(action, executionContext);
          break;
        case 'api_call':
          result = await this._executeApiCall(action, executionContext);
          break;
        case 'ui_interaction':
          result = await this._executeUiInteraction(action, executionContext);
          break;
        case 'wait':
          result = await this._executeWait(action, executionContext);
          break;
        default:
          result = {
            success: false,
            error: `Unsupported action type: ${action.type}`
          };
      }
      
      // Emit action execution completed event
      if (this.eventBus) {
        this.eventBus.emit('action:execution:completed', {
          executionId: executionContext.id,
          strategyId: executionContext.strategyId,
          actionType: action.type,
          success: result.success,
          timestamp: Date.now()
        });
      }
      
      return {
        ...result,
        action: action.type
      };
    } catch (error) {
      // Emit action execution failed event
      if (this.eventBus) {
        this.eventBus.emit('action:execution:failed', {
          executionId: executionContext.id,
          strategyId: executionContext.strategyId,
          actionType: action.type,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      return {
        success: false,
        error: error.message,
        action: action.type
      };
    }
  }
  
  /**
   * Execute system call action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeSystemCall(action, executionContext) {
    // In a real implementation, this would execute a system command
    // For now, we'll simulate success
    return {
      success: true,
      output: 'System call executed successfully'
    };
  }
  
  /**
   * Execute file write action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeFileWrite(action, executionContext) {
    // In a real implementation, this would write to a file
    // For now, we'll simulate success
    return {
      success: true,
      output: 'File write executed successfully'
    };
  }
  
  /**
   * Execute file read action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeFileRead(action, executionContext) {
    // In a real implementation, this would read from a file
    // For now, we'll simulate success
    return {
      success: true,
      output: 'File read executed successfully',
      data: 'Simulated file content'
    };
  }
  
  /**
   * Execute process kill action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeProcessKill(action, executionContext) {
    // In a real implementation, this would kill a process
    // For now, we'll simulate success
    return {
      success: true,
      output: 'Process kill executed successfully'
    };
  }
  
  /**
   * Execute network configuration action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeNetworkConfig(action, executionContext) {
    // In a real implementation, this would configure network settings
    // For now, we'll simulate success
    return {
      success: true,
      output: 'Network configuration executed successfully'
    };
  }
  
  /**
   * Execute service control action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeServiceControl(action, executionContext) {
    // In a real implementation, this would control a service
    // For now, we'll simulate success
    return {
      success: true,
      output: 'Service control executed successfully'
    };
  }
  
  /**
   * Execute API call action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeApiCall(action, executionContext) {
    // In a real implementation, this would make an API call
    // For now, we'll simulate success
    return {
      success: true,
      output: 'API call executed successfully',
      data: { status: 'ok' }
    };
  }
  
  /**
   * Execute UI interaction action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeUiInteraction(action, executionContext) {
    // In a real implementation, this would interact with a UI
    // For now, we'll simulate success
    return {
      success: true,
      output: 'UI interaction executed successfully'
    };
  }
  
  /**
   * Execute wait action
   * 
   * @param {Object} action - Action to execute
   * @param {Object} executionContext - Execution context
   * @returns {Promise<Object>} Action execution result
   * @private
   */
  async _executeWait(action, executionContext) {
    const duration = action.duration || 1000;
    
    // Wait for specified duration
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return {
      success: true,
      output: `Waited for ${duration}ms`
    };
  }
  
  /**
   * Handle cancel request event
   * 
   * @param {Object} data - Cancel request data
   * @private
   */
  _handleCancelRequest(data) {
    if (!data || !data.executionId) {
      return;
    }
    
    this.cancelExecution(data.executionId);
  }
  
  /**
   * Dispose resources used by this engine
   */
  dispose() {
    if (this.eventBus) {
      this.eventBus.removeAllListeners('execution:cancel');
    }
    
    this.activeExecutions.clear();
  }
}

module.exports = ExecutionEngine;
