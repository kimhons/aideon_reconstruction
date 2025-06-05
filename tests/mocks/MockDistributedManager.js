/**
 * MockDistributedManager.js
 * 
 * Mock implementation of the Distributed Manager for testing the Error Recovery System.
 * This mock simulates the distributed coordination capabilities that would be provided 
 * by the actual Distributed Manager.
 * 
 * @module tests/mocks/MockDistributedManager
 */

'use strict';

/**
 * Mock Distributed Manager for testing
 */
class MockDistributedManager {
  /**
   * Creates a new MockDistributedManager instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.isInitialized = false;
    this.connectedDevices = [];
    this.taskHistory = [];
    this.messageHistory = [];
    this.resourceAllocationHistory = [];
    
    // Configure mock behavior
    this.mockBehavior = {
      shouldSucceed: options.shouldSucceed !== false,
      shouldDelay: options.shouldDelay === true,
      delayMs: options.delayMs || 150,
      networkLatencyMs: options.networkLatencyMs || 50,
      deviceFailureRate: options.deviceFailureRate || 0.05,
      messageDropRate: options.messageDropRate || 0.02
    };
    
    // Pre-configured devices for testing
    this.mockDevices = [
      {
        id: 'device_1',
        name: 'Primary Device',
        type: 'desktop',
        status: 'online',
        capabilities: ['compute', 'storage', 'network'],
        resources: {
          cpu: 0.8,
          memory: 0.7,
          storage: 0.5,
          network: 0.9
        },
        location: 'local'
      },
      {
        id: 'device_2',
        name: 'Secondary Device',
        type: 'laptop',
        status: 'online',
        capabilities: ['compute', 'storage', 'network'],
        resources: {
          cpu: 0.6,
          memory: 0.5,
          storage: 0.4,
          network: 0.7
        },
        location: 'remote'
      },
      {
        id: 'device_3',
        name: 'Mobile Device',
        type: 'mobile',
        status: 'online',
        capabilities: ['compute', 'network'],
        resources: {
          cpu: 0.3,
          memory: 0.2,
          storage: 0.1,
          network: 0.5
        },
        location: 'remote'
      },
      {
        id: 'device_4',
        name: 'Edge Device',
        type: 'edge',
        status: 'offline',
        capabilities: ['compute', 'network'],
        resources: {
          cpu: 0.4,
          memory: 0.3,
          storage: 0.2,
          network: 0.6
        },
        location: 'remote'
      },
      {
        id: 'device_5',
        name: 'Server',
        type: 'server',
        status: 'online',
        capabilities: ['compute', 'storage', 'network', 'database'],
        resources: {
          cpu: 0.9,
          memory: 0.8,
          storage: 0.9,
          network: 0.95
        },
        location: 'remote'
      }
    ];
  }
  
  /**
   * Initialize the mock distributed manager
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
      throw new Error('Mock Distributed Manager initialization failure');
    }
    
    // Connect to online devices
    this.connectedDevices = this.mockDevices.filter(device => device.status === 'online');
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Get connected devices
   * 
   * @returns {Promise<Array<Object>>} Connected devices
   */
  async getConnectedDevices() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.mockBehavior.shouldDelay) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs));
    }
    
    if (!this.mockBehavior.shouldSucceed) {
      throw new Error('Mock Distributed Manager device retrieval failure');
    }
    
    // Simulate device status changes
    for (const device of this.connectedDevices) {
      if (Math.random() < this.mockBehavior.deviceFailureRate) {
        device.status = device.status === 'online' ? 'offline' : 'online';
      }
      
      // Update resource utilization
      for (const resource in device.resources) {
        device.resources[resource] = Math.min(0.95, Math.max(0.1, 
          device.resources[resource] + (Math.random() * 0.2 - 0.1)));
      }
    }
    
    return this.connectedDevices.filter(device => device.status === 'online');
  }
  
  /**
   * Execute a task on a remote device
   * 
   * @param {Object} request - Task execution request
   * @returns {Promise<Object>} Task execution result
   */
  async executeTask(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const { deviceId, task, parameters, timeout } = request;
    
    if (!deviceId) {
      return {
        success: false,
        reason: 'missing_device_id',
        message: 'Device ID is required for task execution'
      };
    }
    
    if (!task) {
      return {
        success: false,
        reason: 'missing_task',
        message: 'Task is required for execution'
      };
    }
    
    // Find target device
    const device = this.connectedDevices.find(d => d.id === deviceId);
    
    if (!device) {
      return {
        success: false,
        reason: 'device_not_found',
        message: `Device ${deviceId} not found or not connected`
      };
    }
    
    if (device.status !== 'online') {
      return {
        success: false,
        reason: 'device_offline',
        message: `Device ${deviceId} is offline`
      };
    }
    
    // Store task execution request
    const taskExecution = {
      deviceId,
      task,
      parameters,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.taskHistory.push(taskExecution);
    
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.mockBehavior.networkLatencyMs));
    
    // Simulate task execution
    const executionTime = Math.random() * 500 + 100;
    
    if (timeout && executionTime > timeout) {
      taskExecution.status = 'timeout';
      return {
        success: false,
        reason: 'execution_timeout',
        message: `Task execution timed out after ${timeout}ms`,
        taskId: this.taskHistory.length - 1
      };
    }
    
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    // Determine execution result
    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      taskExecution.status = 'completed';
      
      // Generate mock result based on task type
      let result;
      
      switch (task) {
        case 'error_recovery':
          result = {
            recoverySuccessful: Math.random() > 0.2,
            strategiesAttempted: Math.floor(Math.random() * 3) + 1,
            executionTimeMs: executionTime
          };
          break;
        case 'resource_allocation':
          result = {
            resourcesAllocated: true,
            allocatedResources: {
              cpu: Math.random() * 0.5,
              memory: Math.random() * 0.4,
              storage: Math.random() * 0.3
            }
          };
          break;
        case 'data_synchronization':
          result = {
            syncSuccessful: true,
            recordsSynced: Math.floor(Math.random() * 100) + 10,
            syncTimeMs: executionTime
          };
          break;
        default:
          result = {
            executed: true,
            executionTimeMs: executionTime
          };
      }
      
      return {
        success: true,
        result,
        deviceId,
        taskId: this.taskHistory.length - 1,
        executionTimeMs: executionTime
      };
    } else {
      taskExecution.status = 'failed';
      
      return {
        success: false,
        reason: 'execution_failed',
        message: 'Task execution failed on remote device',
        deviceId,
        taskId: this.taskHistory.length - 1
      };
    }
  }
  
  /**
   * Send a message to a remote device
   * 
   * @param {Object} request - Message request
   * @returns {Promise<Object>} Message result
   */
  async sendMessage(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const { deviceId, message, priority, requireAck } = request;
    
    if (!deviceId) {
      return {
        success: false,
        reason: 'missing_device_id',
        message: 'Device ID is required for sending messages'
      };
    }
    
    if (!message) {
      return {
        success: false,
        reason: 'missing_message',
        message: 'Message content is required'
      };
    }
    
    // Find target device
    const device = this.connectedDevices.find(d => d.id === deviceId);
    
    if (!device) {
      return {
        success: false,
        reason: 'device_not_found',
        message: `Device ${deviceId} not found or not connected`
      };
    }
    
    if (device.status !== 'online') {
      return {
        success: false,
        reason: 'device_offline',
        message: `Device ${deviceId} is offline`
      };
    }
    
    // Store message
    const messageRecord = {
      deviceId,
      message,
      priority: priority || 'normal',
      requireAck: requireAck !== false,
      timestamp: Date.now(),
      status: 'sent'
    };
    
    this.messageHistory.push(messageRecord);
    
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.mockBehavior.networkLatencyMs));
    
    // Simulate message delivery
    if (Math.random() < this.mockBehavior.messageDropRate) {
      messageRecord.status = 'dropped';
      
      return {
        success: false,
        reason: 'message_dropped',
        message: 'Message was dropped during transmission',
        messageId: this.messageHistory.length - 1
      };
    }
    
    messageRecord.status = 'delivered';
    
    // Simulate acknowledgment if required
    if (messageRecord.requireAck) {
      await new Promise(resolve => setTimeout(resolve, this.mockBehavior.networkLatencyMs));
      
      if (Math.random() < this.mockBehavior.messageDropRate) {
        messageRecord.status = 'delivered_no_ack';
        
        return {
          success: true,
          delivered: true,
          acknowledged: false,
          message: 'Message delivered but acknowledgment was not received',
          messageId: this.messageHistory.length - 1
        };
      }
      
      messageRecord.status = 'acknowledged';
    }
    
    return {
      success: true,
      delivered: true,
      acknowledged: messageRecord.requireAck ? messageRecord.status === 'acknowledged' : undefined,
      messageId: this.messageHistory.length - 1
    };
  }
  
  /**
   * Allocate resources across devices
   * 
   * @param {Object} request - Resource allocation request
   * @returns {Promise<Object>} Resource allocation result
   */
  async allocateResources(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const { resources, preferredDeviceId, constraints } = request;
    
    if (!resources) {
      return {
        success: false,
        reason: 'missing_resources',
        message: 'Resources are required for allocation'
      };
    }
    
    // Store allocation request
    const allocationRecord = {
      resources,
      preferredDeviceId,
      constraints,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.resourceAllocationHistory.push(allocationRecord);
    
    // Simulate allocation process
    await new Promise(resolve => setTimeout(resolve, this.mockBehavior.delayMs * 2));
    
    // Get available devices
    const availableDevices = await this.getConnectedDevices();
    
    if (availableDevices.length === 0) {
      allocationRecord.status = 'failed';
      
      return {
        success: false,
        reason: 'no_devices_available',
        message: 'No devices available for resource allocation'
      };
    }
    
    // Find suitable device
    let targetDevice;
    
    if (preferredDeviceId) {
      targetDevice = availableDevices.find(d => d.id === preferredDeviceId);
    }
    
    if (!targetDevice) {
      // Find device with most available resources
      targetDevice = availableDevices.reduce((best, current) => {
        const bestScore = this._calculateResourceScore(best, resources);
        const currentScore = this._calculateResourceScore(current, resources);
        
        return currentScore > bestScore ? current : best;
      }, availableDevices[0]);
    }
    
    // Check if device meets constraints
    if (constraints) {
      const meetsConstraints = this._checkConstraints(targetDevice, constraints);
      
      if (!meetsConstraints) {
        allocationRecord.status = 'failed';
        
        return {
          success: false,
          reason: 'constraints_not_met',
          message: 'No device meets the specified constraints',
          allocationId: this.resourceAllocationHistory.length - 1
        };
      }
    }
    
    // Check if device has enough resources
    const hasEnoughResources = this._checkResourceAvailability(targetDevice, resources);
    
    if (!hasEnoughResources) {
      allocationRecord.status = 'failed';
      
      return {
        success: false,
        reason: 'insufficient_resources',
        message: 'Insufficient resources available on target device',
        deviceId: targetDevice.id,
        allocationId: this.resourceAllocationHistory.length - 1
      };
    }
    
    // Allocate resources
    const allocatedResources = {};
    
    for (const resource in resources) {
      if (targetDevice.resources[resource] !== undefined) {
        allocatedResources[resource] = Math.min(resources[resource], targetDevice.resources[resource]);
        targetDevice.resources[resource] -= allocatedResources[resource];
      }
    }
    
    allocationRecord.status = 'allocated';
    allocationRecord.deviceId = targetDevice.id;
    allocationRecord.allocatedResources = allocatedResources;
    
    return {
      success: true,
      deviceId: targetDevice.id,
      allocatedResources,
      allocationId: this.resourceAllocationHistory.length - 1
    };
  }
  
  /**
   * Release allocated resources
   * 
   * @param {Object} request - Resource release request
   * @returns {Promise<Object>} Resource release result
   */
  async releaseResources(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const { allocationId } = request;
    
    if (allocationId === undefined) {
      return {
        success: false,
        reason: 'missing_allocation_id',
        message: 'Allocation ID is required for releasing resources'
      };
    }
    
    // Find allocation record
    const allocationRecord = this.resourceAllocationHistory[allocationId];
    
    if (!allocationRecord) {
      return {
        success: false,
        reason: 'allocation_not_found',
        message: `Allocation with ID ${allocationId} not found`
      };
    }
    
    if (allocationRecord.status !== 'allocated') {
      return {
        success: false,
        reason: 'invalid_allocation_status',
        message: `Allocation with ID ${allocationId} is not in 'allocated' state`
      };
    }
    
    // Find device
    const device = this.connectedDevices.find(d => d.id === allocationRecord.deviceId);
    
    if (!device) {
      return {
        success: false,
        reason: 'device_not_found',
        message: `Device ${allocationRecord.deviceId} not found or not connected`
      };
    }
    
    // Release resources
    for (const resource in allocationRecord.allocatedResources) {
      if (device.resources[resource] !== undefined) {
        device.resources[resource] += allocationRecord.allocatedResources[resource];
      }
    }
    
    allocationRecord.status = 'released';
    
    return {
      success: true,
      deviceId: device.id,
      releasedResources: allocationRecord.allocatedResources
    };
  }
  
  /**
   * Get task status
   * 
   * @param {Object} request - Task status request
   * @returns {Promise<Object>} Task status
   */
  async getTaskStatus(request) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const { taskId } = request;
    
    if (taskId === undefined) {
      return {
        success: false,
        reason: 'missing_task_id',
        message: 'Task ID is required for status retrieval'
      };
    }
    
    // Find task record
    const taskRecord = this.taskHistory[taskId];
    
    if (!taskRecord) {
      return {
        success: false,
        reason: 'task_not_found',
        message: `Task with ID ${taskId} not found`
      };
    }
    
    return {
      success: true,
      taskId,
      deviceId: taskRecord.deviceId,
      status: taskRecord.status,
      timestamp: taskRecord.timestamp,
      executionTime: Date.now() - taskRecord.timestamp
    };
  }
  
  /**
   * Get distributed manager statistics
   * 
   * @returns {Object} Distributed manager statistics
   */
  getDistributedStatistics() {
    const connectedDeviceCount = this.connectedDevices.filter(d => d.status === 'online').length;
    const taskCount = this.taskHistory.length;
    const messageCount = this.messageHistory.length;
    const resourceAllocationCount = this.resourceAllocationHistory.length;
    
    // Calculate task success rate
    const completedTasks = this.taskHistory.filter(t => t.status === 'completed').length;
    const taskSuccessRate = taskCount > 0 ? completedTasks / taskCount : 0;
    
    // Calculate message delivery rate
    const deliveredMessages = this.messageHistory.filter(
      m => m.status === 'delivered' || m.status === 'acknowledged' || m.status === 'delivered_no_ack'
    ).length;
    const messageDeliveryRate = messageCount > 0 ? deliveredMessages / messageCount : 0;
    
    // Calculate resource allocation success rate
    const successfulAllocations = this.resourceAllocationHistory.filter(
      a => a.status === 'allocated' || a.status === 'released'
    ).length;
    const allocationSuccessRate = resourceAllocationCount > 0 ? 
      successfulAllocations / resourceAllocationCount : 0;
    
    return {
      connectedDevices: connectedDeviceCount,
      totalDevices: this.mockDevices.length,
      tasks: taskCount,
      messages: messageCount,
      resourceAllocations: resourceAllocationCount,
      taskSuccessRate,
      messageDeliveryRate,
      allocationSuccessRate,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Reset the mock distributed manager
   */
  reset() {
    this.taskHistory = [];
    this.messageHistory = [];
    this.resourceAllocationHistory = [];
    
    // Reset device status and resources
    for (const device of this.mockDevices) {
      if (device.id !== 'device_4') { // Keep device_4 offline
        device.status = 'online';
      }
      
      // Reset resources
      device.resources = {
        cpu: 0.8 - (Math.random() * 0.3),
        memory: 0.7 - (Math.random() * 0.3),
        storage: 0.5 - (Math.random() * 0.2),
        network: 0.9 - (Math.random() * 0.2)
      };
    }
    
    // Reconnect to online devices
    this.connectedDevices = this.mockDevices.filter(device => device.status === 'online');
  }
  
  /**
   * Calculate resource score for a device
   * 
   * @param {Object} device - Device to score
   * @param {Object} requiredResources - Required resources
   * @returns {number} Resource score
   * @private
   */
  _calculateResourceScore(device, requiredResources) {
    let score = 0;
    
    for (const resource in requiredResources) {
      if (device.resources[resource] !== undefined) {
        if (device.resources[resource] >= requiredResources[resource]) {
          score += 1;
        } else {
          score += device.resources[resource] / requiredResources[resource];
        }
      }
    }
    
    return score;
  }
  
  /**
   * Check if a device meets constraints
   * 
   * @param {Object} device - Device to check
   * @param {Object} constraints - Constraints to check
   * @returns {boolean} Whether device meets constraints
   * @private
   */
  _checkConstraints(device, constraints) {
    if (constraints.type && device.type !== constraints.type) {
      return false;
    }
    
    if (constraints.capabilities) {
      for (const capability of constraints.capabilities) {
        if (!device.capabilities.includes(capability)) {
          return false;
        }
      }
    }
    
    if (constraints.location && device.location !== constraints.location) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if a device has enough resources
   * 
   * @param {Object} device - Device to check
   * @param {Object} requiredResources - Required resources
   * @returns {boolean} Whether device has enough resources
   * @private
   */
  _checkResourceAvailability(device, requiredResources) {
    for (const resource in requiredResources) {
      if (device.resources[resource] === undefined || 
          device.resources[resource] < requiredResources[resource]) {
        return false;
      }
    }
    
    return true;
  }
}

module.exports = MockDistributedManager;
