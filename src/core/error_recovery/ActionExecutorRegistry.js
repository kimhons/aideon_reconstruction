/**
 * @fileoverview Implementation of the ActionExecutorRegistry component for the Autonomous Error Recovery System.
 * This component manages the registration and lookup of action executors that can perform recovery actions.
 * 
 * @module core/error_recovery/ActionExecutorRegistry
 */

const { v4: uuidv4 } = require('uuid');

/**
 * ActionExecutorRegistry manages the registration and lookup of action executors.
 */
class ActionExecutorRegistry {
  /**
   * Creates a new ActionExecutorRegistry instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    
    // Registry of action executors
    this.executors = new Map();
    
    // Registry of action types
    this.actionTypes = new Map();
    
    // Register default executors
    this._registerDefaultExecutors();
    
    this.logger.info('ActionExecutorRegistry initialized with default executors');
  }
  
  /**
   * Registers an action executor.
   * @param {string} actionType - Type of actions the executor can handle
   * @param {Object} executor - Action executor
   * @param {Function} executor.executeAction - Function to execute an action
   * @param {Function} [executor.validateAction] - Function to validate an action
   * @param {Function} [executor.estimateExecutionTime] - Function to estimate execution time
   * @param {Function} [executor.estimateResourceRequirements] - Function to estimate resource requirements
   * @returns {string} Executor ID
   */
  registerExecutor(actionType, executor) {
    const executorId = uuidv4();
    
    // Validate executor
    if (!executor || typeof executor.executeAction !== 'function') {
      throw new Error('Invalid executor: missing executeAction function');
    }
    
    // Register executor
    this.executors.set(executorId, {
      id: executorId,
      actionType,
      executor,
      registeredAt: Date.now()
    });
    
    // Register action type
    if (!this.actionTypes.has(actionType)) {
      this.actionTypes.set(actionType, new Set());
    }
    this.actionTypes.get(actionType).add(executorId);
    
    this.logger.debug(`Registered executor ${executorId} for action type ${actionType}`);
    
    return executorId;
  }
  
  /**
   * Unregisters an action executor.
   * @param {string} executorId - Executor ID
   * @returns {boolean} Whether the executor was unregistered
   */
  unregisterExecutor(executorId) {
    const registration = this.executors.get(executorId);
    if (!registration) {
      return false;
    }
    
    // Remove from executors
    this.executors.delete(executorId);
    
    // Remove from action types
    const actionType = registration.actionType;
    if (this.actionTypes.has(actionType)) {
      this.actionTypes.get(actionType).delete(executorId);
      
      // Clean up empty action type sets
      if (this.actionTypes.get(actionType).size === 0) {
        this.actionTypes.delete(actionType);
      }
    }
    
    this.logger.debug(`Unregistered executor ${executorId} for action type ${actionType}`);
    
    return true;
  }
  
  /**
   * Gets an executor for an action.
   * @param {string} actionId - Action ID
   * @returns {Object|null} Action executor or null if not found
   */
  getExecutorForAction(actionId) {
    // Find executor for action type
    const executorIds = this.actionTypes.get(actionId);
    if (!executorIds || executorIds.size === 0) {
      return null;
    }
    
    // Get first executor (in a real implementation, might use more sophisticated selection)
    const executorId = [...executorIds][0];
    const registration = this.executors.get(executorId);
    
    return registration ? registration.executor : null;
  }
  
  /**
   * Gets all executors for an action type.
   * @param {string} actionType - Action type
   * @returns {Array<Object>} Action executors
   */
  getExecutorsForActionType(actionType) {
    const executorIds = this.actionTypes.get(actionType);
    if (!executorIds || executorIds.size === 0) {
      return [];
    }
    
    return [...executorIds]
      .map(id => this.executors.get(id))
      .filter(Boolean)
      .map(registration => registration.executor);
  }
  
  /**
   * Gets all registered action types.
   * @returns {Array<string>} Action types
   */
  getRegisteredActionTypes() {
    return [...this.actionTypes.keys()];
  }
  
  /**
   * Gets all registered executors.
   * @returns {Array<Object>} Executor registrations
   */
  getRegisteredExecutors() {
    return [...this.executors.values()];
  }
  
  /**
   * Validates an action using the appropriate executor.
   * @param {string} actionId - Action ID
   * @param {Object} parameters - Action parameters
   * @returns {Object} Validation result
   */
  validateAction(actionId, parameters) {
    const executor = this.getExecutorForAction(actionId);
    if (!executor) {
      return {
        valid: false,
        message: `No executor found for action: ${actionId}`
      };
    }
    
    if (typeof executor.validateAction === 'function') {
      return executor.validateAction(actionId, parameters);
    }
    
    // Default validation if executor doesn't provide validation
    return {
      valid: true
    };
  }
  
  /**
   * Estimates execution time for an action.
   * @param {string} actionId - Action ID
   * @param {Object} parameters - Action parameters
   * @param {Object} systemState - Current system state
   * @returns {number} Estimated execution time in milliseconds
   */
  estimateExecutionTime(actionId, parameters, systemState) {
    const executor = this.getExecutorForAction(actionId);
    if (!executor) {
      return 5000; // Default 5 seconds
    }
    
    if (typeof executor.estimateExecutionTime === 'function') {
      return executor.estimateExecutionTime(actionId, parameters, systemState);
    }
    
    return 5000; // Default 5 seconds
  }
  
  /**
   * Estimates resource requirements for an action.
   * @param {string} actionId - Action ID
   * @param {Object} parameters - Action parameters
   * @param {Object} systemState - Current system state
   * @returns {Object} Resource requirements
   */
  estimateResourceRequirements(actionId, parameters, systemState) {
    const executor = this.getExecutorForAction(actionId);
    if (!executor) {
      return {
        cpu: { min: 0, recommended: 0, peak: 0, unit: 'percentage' },
        memory: { min: 0, recommended: 0, peak: 0, unit: 'MB' },
        disk: { min: 0, recommended: 0, unit: 'MB' },
        network: { bandwidth: 0, unit: 'Mbps' }
      };
    }
    
    if (typeof executor.estimateResourceRequirements === 'function') {
      return executor.estimateResourceRequirements(actionId, parameters, systemState);
    }
    
    return {
      cpu: { min: 0, recommended: 0, peak: 0, unit: 'percentage' },
      memory: { min: 0, recommended: 0, peak: 0, unit: 'MB' },
      disk: { min: 0, recommended: 0, unit: 'MB' },
      network: { bandwidth: 0, unit: 'Mbps' }
    };
  }
  
  /**
   * Registers default action executors for common recovery actions.
   * @private
   */
  _registerDefaultExecutors() {
    // Register RestartComponentAction executor
    this.registerExecutor('RestartComponentAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing RestartComponentAction for component: ${action.parameters.componentId}`);
        
        // Simulate component restart
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          success: true,
          actionId: action.id,
          componentId: action.parameters.componentId,
          timestamp: Date.now(),
          message: `Successfully restarted component ${action.parameters.componentId}`
        };
      },
      validateAction: (actionId, parameters) => {
        if (!parameters.componentId) {
          return { valid: false, message: 'Missing componentId parameter' };
        }
        return { valid: true };
      },
      estimateExecutionTime: () => 1000, // 1 second
      estimateResourceRequirements: () => ({
        cpu: { min: 5, recommended: 10, peak: 20, unit: 'percentage' },
        memory: { min: 50, recommended: 100, peak: 200, unit: 'MB' },
        disk: { min: 0, recommended: 0, unit: 'MB' },
        network: { bandwidth: 1, unit: 'Mbps' }
      })
    });
    
    // Register ReconfigureComponentAction executor
    this.registerExecutor('ReconfigureComponentAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing ReconfigureComponentAction for component: ${action.parameters.componentId}`);
        
        // Simulate component reconfiguration
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          success: true,
          actionId: action.id,
          componentId: action.parameters.componentId,
          timestamp: Date.now(),
          message: `Successfully reconfigured component ${action.parameters.componentId}`
        };
      },
      validateAction: (actionId, parameters) => {
        if (!parameters.componentId) {
          return { valid: false, message: 'Missing componentId parameter' };
        }
        if (!parameters.configuration) {
          return { valid: false, message: 'Missing configuration parameter' };
        }
        return { valid: true };
      }
    });
    
    // Register ReallocateResourcesAction executor
    this.registerExecutor('ReallocateResourcesAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing ReallocateResourcesAction for component: ${action.parameters.componentId}`);
        
        // Simulate resource reallocation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          success: true,
          actionId: action.id,
          componentId: action.parameters.componentId,
          timestamp: Date.now(),
          message: `Successfully reallocated resources for component ${action.parameters.componentId}`
        };
      }
    });
    
    // Register DiagnoseAction executor
    this.registerExecutor('DiagnoseAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing DiagnoseAction with depth: ${action.parameters.depth}`);
        
        // Validate depth parameter
        const depth = action.parameters.depth || 'medium';
        const validDepths = ['shallow', 'medium', 'deep'];
        if (!validDepths.includes(depth)) {
          return {
            success: false,
            actionId: action.id,
            timestamp: Date.now(),
            message: `Invalid depth parameter: ${depth}. Must be one of: ${validDepths.join(', ')}`
          };
        }
        
        // Simulate diagnosis process with variable duration based on depth
        const diagnosisDuration = {
          'shallow': 500,
          'medium': 1000,
          'deep': 2000
        }[depth];
        
        await new Promise(resolve => setTimeout(resolve, diagnosisDuration));
        
        // Generate diagnosis results based on depth
        const diagnosisResults = {
          errorType: context?.analysisResult?.errorType || 'unknown',
          componentId: context?.analysisResult?.componentId || action.parameters.componentId || 'unknown',
          confidence: depth === 'deep' ? 0.95 : (depth === 'medium' ? 0.85 : 0.7),
          details: `Diagnosis completed at ${depth} depth`,
          recommendations: [
            {
              actionType: 'RestartComponentAction',
              confidence: 0.8,
              reason: 'Component state inconsistency detected'
            }
          ]
        };
        
        return {
          success: true,
          actionId: action.id,
          timestamp: Date.now(),
          message: `Successfully completed ${depth} diagnosis`,
          diagnosisResults
        };
      },
      validateAction: (actionId, parameters) => {
        const depth = parameters.depth || 'medium';
        const validDepths = ['shallow', 'medium', 'deep'];
        
        if (!validDepths.includes(depth)) {
          return { 
            valid: false, 
            message: `Invalid depth parameter: ${depth}. Must be one of: ${validDepths.join(', ')}` 
          };
        }
        
        return { valid: true };
      },
      estimateExecutionTime: (actionId, parameters) => {
        const depth = parameters.depth || 'medium';
        const durationMap = {
          'shallow': 500,
          'medium': 1000,
          'deep': 2000
        };
        
        return durationMap[depth] || 1000;
      },
      estimateResourceRequirements: (actionId, parameters) => {
        const depth = parameters.depth || 'medium';
        const resourceMap = {
          'shallow': {
            cpu: { min: 5, recommended: 10, peak: 15, unit: 'percentage' },
            memory: { min: 50, recommended: 100, peak: 150, unit: 'MB' }
          },
          'medium': {
            cpu: { min: 10, recommended: 20, peak: 30, unit: 'percentage' },
            memory: { min: 100, recommended: 200, peak: 300, unit: 'MB' }
          },
          'deep': {
            cpu: { min: 20, recommended: 40, peak: 60, unit: 'percentage' },
            memory: { min: 200, recommended: 400, peak: 600, unit: 'MB' }
          }
        };
        
        const resources = resourceMap[depth] || resourceMap['medium'];
        
        return {
          ...resources,
          disk: { min: 10, recommended: 20, unit: 'MB' },
          network: { bandwidth: 1, unit: 'Mbps' }
        };
      }
    });
    
    // Register DeepDiagnoseAction executor
    this.registerExecutor('DeepDiagnoseAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing DeepDiagnoseAction with depth: ${action.parameters.depth}`);
        
        // Validate depth parameter
        const depth = action.parameters.depth || 'deep';
        if (depth !== 'deep') {
          this.logger.warn(`DeepDiagnoseAction received non-deep depth parameter: ${depth}, forcing to 'deep'`);
        }
        
        // Simulate deep diagnosis process
        await new Promise(resolve => setTimeout(resolve, 3000)); // Deep diagnosis takes longer
        
        // Generate comprehensive diagnosis results
        const diagnosisResults = {
          errorType: context?.analysisResult?.errorType || 'unknown',
          componentId: context?.analysisResult?.componentId || action.parameters.componentId || 'unknown',
          confidence: 0.98,
          details: 'Comprehensive deep diagnosis completed',
          rootCauses: [
            {
              cause: 'Resource contention',
              confidence: 0.92,
              affectedComponents: ['memory-manager', 'scheduler']
            },
            {
              cause: 'Configuration inconsistency',
              confidence: 0.85,
              affectedComponents: [action.parameters.componentId || 'unknown']
            }
          ],
          recommendations: [
            {
              actionType: 'ReallocateResourcesAction',
              confidence: 0.9,
              reason: 'Resource contention detected'
            },
            {
              actionType: 'ReconfigureComponentAction',
              confidence: 0.85,
              reason: 'Configuration inconsistency detected'
            },
            {
              actionType: 'RestartComponentAction',
              confidence: 0.7,
              reason: 'Component state reset recommended'
            }
          ],
          systemStateSnapshot: {
            timestamp: Date.now(),
            resourceUtilization: {
              cpu: 78,
              memory: 82,
              disk: 45
            },
            activeComponents: 12,
            pendingTasks: 8
          }
        };
        
        return {
          success: true,
          actionId: action.id,
          timestamp: Date.now(),
          message: 'Successfully completed deep diagnosis',
          diagnosisResults
        };
      },
      validateAction: (actionId, parameters) => {
        // DeepDiagnoseAction is more permissive with parameters
        // but we still validate the depth if provided
        if (parameters.depth && parameters.depth !== 'deep') {
          return { 
            valid: true, 
            message: `Warning: DeepDiagnoseAction works best with depth='deep', received: ${parameters.depth}` 
          };
        }
        
        return { valid: true };
      },
      estimateExecutionTime: () => 3000, // 3 seconds for deep diagnosis
      estimateResourceRequirements: () => ({
        cpu: { min: 30, recommended: 50, peak: 70, unit: 'percentage' },
        memory: { min: 300, recommended: 500, peak: 700, unit: 'MB' },
        disk: { min: 50, recommended: 100, unit: 'MB' },
        network: { bandwidth: 2, unit: 'Mbps' }
      })
    });
    
    // Register RepairDataAction executor
    this.registerExecutor('RepairDataAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing RepairDataAction for data: ${action.parameters.dataId}`);
        
        // Validate required parameters
        if (!action.parameters.dataId) {
          return {
            success: false,
            actionId: action.id,
            timestamp: Date.now(),
            message: 'Missing required parameter: dataId'
          };
        }
        
        // Determine repair strategy
        const repairStrategy = action.parameters.strategy || 'auto';
        const validStrategies = ['auto', 'rebuild', 'restore', 'reconcile'];
        
        if (!validStrategies.includes(repairStrategy)) {
          return {
            success: false,
            actionId: action.id,
            timestamp: Date.now(),
            message: `Invalid repair strategy: ${repairStrategy}. Must be one of: ${validStrategies.join(', ')}`
          };
        }
        
        // Simulate data repair process
        const repairDuration = {
          'auto': 1500,
          'rebuild': 2000,
          'restore': 1000,
          'reconcile': 2500
        }[repairStrategy];
        
        await new Promise(resolve => setTimeout(resolve, repairDuration));
        
        // Generate repair results
        const repairResults = {
          dataId: action.parameters.dataId,
          strategy: repairStrategy,
          entriesProcessed: Math.floor(Math.random() * 1000) + 100,
          entriesRepaired: Math.floor(Math.random() * 100) + 10,
          integrityScore: {
            before: 0.65,
            after: 0.98
          },
          verificationStatus: 'passed',
          details: `Data repair completed using ${repairStrategy} strategy`
        };
        
        return {
          success: true,
          actionId: action.id,
          timestamp: Date.now(),
          message: `Successfully repaired data ${action.parameters.dataId} using ${repairStrategy} strategy`,
          repairResults
        };
      },
      validateAction: (actionId, parameters) => {
        if (!parameters.dataId) {
          return { valid: false, message: 'Missing required parameter: dataId' };
        }
        
        if (parameters.strategy) {
          const validStrategies = ['auto', 'rebuild', 'restore', 'reconcile'];
          if (!validStrategies.includes(parameters.strategy)) {
            return { 
              valid: false, 
              message: `Invalid repair strategy: ${parameters.strategy}. Must be one of: ${validStrategies.join(', ')}` 
            };
          }
        }
        
        return { valid: true };
      },
      estimateExecutionTime: (actionId, parameters) => {
        const strategy = parameters.strategy || 'auto';
        const durationMap = {
          'auto': 1500,
          'rebuild': 2000,
          'restore': 1000,
          'reconcile': 2500
        };
        
        return durationMap[strategy] || 1500;
      },
      estimateResourceRequirements: (actionId, parameters) => {
        const strategy = parameters.strategy || 'auto';
        const resourceMap = {
          'auto': {
            cpu: { min: 20, recommended: 30, peak: 50, unit: 'percentage' },
            memory: { min: 200, recommended: 300, peak: 500, unit: 'MB' }
          },
          'rebuild': {
            cpu: { min: 30, recommended: 50, peak: 70, unit: 'percentage' },
            memory: { min: 300, recommended: 500, peak: 700, unit: 'MB' }
          },
          'restore': {
            cpu: { min: 10, recommended: 20, peak: 30, unit: 'percentage' },
            memory: { min: 100, recommended: 200, peak: 300, unit: 'MB' }
          },
          'reconcile': {
            cpu: { min: 40, recommended: 60, peak: 80, unit: 'percentage' },
            memory: { min: 400, recommended: 600, peak: 800, unit: 'MB' }
          }
        };
        
        const resources = resourceMap[strategy] || resourceMap['auto'];
        
        return {
          ...resources,
          disk: { min: 100, recommended: 200, unit: 'MB' },
          network: { bandwidth: 5, unit: 'Mbps' }
        };
      }
    });
    
    // Register FallbackAction executor - a generic fallback for any unhandled action types
    this.registerExecutor('FallbackAction', {
      executeAction: async (action, context) => {
        this.logger.info(`Executing FallbackAction for action: ${action.id}`);
        
        // Simulate generic action execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          success: true,
          actionId: action.id,
          timestamp: Date.now(),
          message: `Successfully executed fallback action for ${action.id}`
        };
      }
    });
  }
}

module.exports = ActionExecutorRegistry;
