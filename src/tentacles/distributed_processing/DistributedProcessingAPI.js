/**
 * DistributedProcessingAPI.js
 * 
 * Provides a unified interface for other Aideon components to leverage distributed processing capabilities.
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

/**
 * @typedef {import('../types').TaskPriority} TaskPriority
 * @typedef {import('../types').TaskRequirements} TaskRequirements
 * @typedef {import('../types').TaskStatus} TaskStatus
 * @typedef {import('../types').DistributedProcessingMetrics} DistributedProcessingMetrics
 */

/**
 * @typedef {Object} DistributedProcessingOptions
 * @property {TaskPriority} [priority] - Priority of the task
 * @property {number} [timeout] - Timeout in milliseconds
 * @property {boolean} [requireConfirmation] - Whether user confirmation is required
 * @property {boolean} [allowRemoteExecution] - Whether remote execution is allowed
 * @property {TaskRequirements} [resourceRequirements] - Resource requirements
 */

/**
 * @typedef {Object} DistributedProcessingResult
 * @property {*} result - The result of the distributed processing
 * @property {DistributedProcessingMetrics} metrics - Metrics about the processing
 * @property {Object.<string, number>} nodeContributions - Node ID to contribution percentage
 */

/**
 * Interface for distributed processing API
 * @interface IDistributedProcessingAPI
 */
class IDistributedProcessingAPI {
  /**
   * Execute a task in a distributed manner
   * @template T
   * @param {string} taskType - Type of task to execute
   * @param {*} payload - Task payload
   * @param {DistributedProcessingOptions} [options] - Options for execution
   * @returns {Promise<DistributedProcessingResult<T>>} - Result of the distributed processing
   */
  async executeDistributed(taskType, payload, options) {
    throw new Error('Method not implemented');
  }

  /**
   * Cancel a distributed execution
   * @param {string} taskId - ID of the task to cancel
   * @returns {Promise<boolean>} - Whether the cancellation was successful
   */
  async cancelDistributedExecution(taskId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get the status of a distributed execution
   * @param {string} taskId - ID of the task
   * @returns {Promise<TaskStatus>} - Status of the task
   */
  async getExecutionStatus(taskId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get available distributed capabilities
   * @returns {Promise<string[]>} - List of available capabilities
   */
  async getAvailableDistributedCapabilities() {
    throw new Error('Method not implemented');
  }
}

/**
 * Implementation of the distributed processing API
 */
class DistributedProcessingService extends EventEmitter {
  /**
   * Create a new DistributedProcessingService
   * @param {import('../task/TaskOrchestrator')} taskOrchestrator - Task orchestrator
   * @param {import('../resource/ResourceManager')} resourceManager - Resource manager
   * @param {import('../result/ResultManager')} resultManager - Result manager
   */
  constructor(taskOrchestrator, resourceManager, resultManager) {
    super();
    this.taskOrchestrator = taskOrchestrator;
    this.resourceManager = resourceManager;
    this.resultManager = resultManager;
    this.tasks = new Map();
  }

  /**
   * Initialize the distributed processing service
   * @returns {Promise<void>}
   */
  async initialize() {
    // Register for task orchestrator events
    this.taskOrchestrator.on('taskCompleted', (taskId, result) => {
      this.emit('taskCompleted', taskId, result);
    });

    this.taskOrchestrator.on('taskFailed', (taskId, error) => {
      this.emit('taskFailed', taskId, error);
    });

    this.taskOrchestrator.on('taskProgress', (taskId, progress) => {
      this.emit('taskProgress', taskId, progress);
    });

    // Initialize components
    await this.taskOrchestrator.initialize();
    await this.resourceManager.initialize();
    await this.resultManager.initialize();
  }

  /**
   * Execute a task in a distributed manner
   * @template T
   * @param {string} taskType - Type of task to execute
   * @param {*} payload - Task payload
   * @param {DistributedProcessingOptions} [options={}] - Options for execution
   * @returns {Promise<DistributedProcessingResult<T>>} - Result of the distributed processing
   */
  async executeDistributed(taskType, payload, options = {}) {
    const taskId = uuidv4();
    const startTime = Date.now();

    // Create task object
    const task = {
      id: taskId,
      type: taskType,
      priority: options.priority || { level: 50, preemptive: false },
      requirements: options.resourceRequirements || {},
      dependencies: [],
      payload
    };

    // Store task reference
    this.tasks.set(taskId, {
      task,
      options,
      startTime
    });

    try {
      // Check if user confirmation is required
      if (options.requireConfirmation) {
        await this._requestUserConfirmation(task);
      }

      // Find suitable nodes based on resource requirements
      const suitableNodes = await this.resourceManager.findSuitableNodes(task.requirements);
      
      if (suitableNodes.length === 0 && !options.allowRemoteExecution) {
        throw new Error('No suitable nodes found and remote execution is not allowed');
      }

      // Process the task
      const taskResult = await this.taskOrchestrator.processTask(task);
      
      // Collect and aggregate results
      const aggregatedResult = await this.resultManager.collectResults(taskId);
      
      // Calculate metrics
      const endTime = Date.now();
      const metrics = {
        totalExecutionTime: endTime - startTime,
        distributionOverhead: taskResult.metrics ? taskResult.metrics.distributionOverhead || 0 : 0,
        nodeCount: taskResult.metrics ? taskResult.metrics.nodeCount || 1 : 1,
        resourceUtilization: taskResult.metrics ? taskResult.metrics.resourceUtilization || {} : {}
      };

      // Calculate node contributions
      const nodeContributions = {};
      if (taskResult.nodeContributions) {
        Object.assign(nodeContributions, taskResult.nodeContributions);
      } else {
        // Default to 100% contribution from the executing node
        nodeContributions[taskResult.nodeId || 'local'] = 100;
      }

      // Clean up task reference
      this.tasks.delete(taskId);

      // Return the result
      return {
        result: aggregatedResult.result,
        metrics,
        nodeContributions
      };
    } catch (error) {
      // Clean up task reference
      this.tasks.delete(taskId);
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Cancel a distributed execution
   * @param {string} taskId - ID of the task to cancel
   * @returns {Promise<boolean>} - Whether the cancellation was successful
   */
  async cancelDistributedExecution(taskId) {
    if (!this.tasks.has(taskId)) {
      return false;
    }

    try {
      const success = await this.taskOrchestrator.cancelTask(taskId);
      if (success) {
        this.tasks.delete(taskId);
      }
      return success;
    } catch (error) {
      console.error(`Error canceling task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Get the status of a distributed execution
   * @param {string} taskId - ID of the task
   * @returns {Promise<TaskStatus>} - Status of the task
   */
  async getExecutionStatus(taskId) {
    if (!this.tasks.has(taskId)) {
      throw new Error(`Task ${taskId} not found`);
    }

    try {
      return await this.taskOrchestrator.getTaskStatus(taskId);
    } catch (error) {
      console.error(`Error getting task status for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get available distributed capabilities
   * @returns {Promise<string[]>} - List of available capabilities
   */
  async getAvailableDistributedCapabilities() {
    try {
      const nodes = await this.resourceManager.getAllNodes();
      const capabilities = new Set();
      
      for (const node of nodes) {
        for (const capability of node.capabilities) {
          capabilities.add(capability.name);
        }
      }
      
      return Array.from(capabilities);
    } catch (error) {
      console.error('Error getting available capabilities:', error);
      return [];
    }
  }

  /**
   * Request user confirmation for task execution
   * @private
   * @param {Object} task - Task to confirm
   * @returns {Promise<void>}
   */
  async _requestUserConfirmation(task) {
    // This would integrate with Aideon's user interaction system
    // For now, we'll just resolve immediately
    return Promise.resolve();
  }
}

module.exports = {
  IDistributedProcessingAPI,
  DistributedProcessingService
};
