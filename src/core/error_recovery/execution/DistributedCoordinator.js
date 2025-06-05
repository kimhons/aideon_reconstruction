/**
 * DistributedCoordinator.js
 * 
 * Provides coordination capabilities for distributed recovery strategy execution.
 * This component is responsible for coordinating execution across multiple devices
 * and managing state synchronization in distributed environments.
 * 
 * @module src/core/error_recovery/execution/DistributedCoordinator
 */

'use strict';

/**
 * Class responsible for coordinating distributed strategy execution
 */
class DistributedCoordinator {
  /**
   * Creates a new DistributedCoordinator instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.deviceRegistry - Registry of available devices
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.deviceRegistry = options.deviceRegistry;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.maxDevices = this.config.maxDevices || 3;
    this.coordinationTimeoutMs = this.config.coordinationTimeoutMs || 5000;
    this.heartbeatIntervalMs = this.config.heartbeatIntervalMs || 2000;
    this.failoverStrategy = this.config.failoverStrategy || 'automatic';
    
    this.activeCoordinations = new Map();
    this.deviceStatus = new Map();
    
    this._initialize();
  }
  
  /**
   * Initialize the distributed coordinator
   * @private
   */
  _initialize() {
    if (!this.enabled) {
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('device:status:changed', this._handleDeviceStatusChanged.bind(this));
      this.eventBus.on('device:heartbeat', this._handleDeviceHeartbeat.bind(this));
      this.eventBus.on('coordination:request', this._handleCoordinationRequest.bind(this));
      this.eventBus.on('coordination:response', this._handleCoordinationResponse.bind(this));
    }
    
    // Start heartbeat timer
    if (this.heartbeatIntervalMs > 0) {
      this.heartbeatTimer = setInterval(() => {
        this._sendHeartbeat();
      }, this.heartbeatIntervalMs);
    }
  }
  
  /**
   * Start coordination for distributed execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Coordination options
   * @returns {Promise<Object>} Coordination result
   */
  async startCoordination(executionId, options = {}) {
    if (!this.enabled || !executionId) {
      return {
        success: false,
        error: 'Distributed coordination is disabled',
        devices: []
      };
    }
    
    const { strategy, executionContext } = options;
    
    try {
      // Determine required devices based on strategy
      const requiredDevices = this._determineRequiredDevices(strategy);
      
      // Check if we have enough available devices
      const availableDevices = await this._getAvailableDevices(requiredDevices.count);
      
      if (availableDevices.length < requiredDevices.minRequired) {
        return {
          success: false,
          error: `Not enough available devices. Required: ${requiredDevices.minRequired}, Available: ${availableDevices.length}`,
          devices: availableDevices
        };
      }
      
      // Create coordination context
      const coordinationContext = {
        id: executionId,
        strategyId: strategy?.id,
        startTime: Date.now(),
        status: 'initializing',
        devices: availableDevices,
        deviceStatus: new Map(),
        requiredCapabilities: requiredDevices.capabilities,
        responses: new Map(),
        completionCallbacks: []
      };
      
      // Initialize device status
      for (const device of availableDevices) {
        coordinationContext.deviceStatus.set(device.id, {
          id: device.id,
          status: 'pending',
          lastHeartbeat: Date.now()
        });
      }
      
      // Register active coordination
      this.activeCoordinations.set(executionId, coordinationContext);
      
      // Emit coordination started event
      if (this.eventBus) {
        this.eventBus.emit('coordination:started', {
          executionId,
          strategyId: strategy?.id,
          deviceCount: availableDevices.length,
          timestamp: coordinationContext.startTime
        });
      }
      
      // Send coordination request to all devices
      const requestPromises = availableDevices.map(device => 
        this._sendCoordinationRequest(executionId, device, {
          strategy,
          executionContext
        })
      );
      
      // Wait for all devices to respond or timeout
      const results = await Promise.allSettled(requestPromises);
      
      // Process results
      const successfulDevices = [];
      const failedDevices = [];
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const device = availableDevices[i];
        
        if (result.status === 'fulfilled' && result.value.success) {
          successfulDevices.push(device);
          coordinationContext.deviceStatus.get(device.id).status = 'ready';
        } else {
          failedDevices.push({
            device,
            error: result.status === 'rejected' ? result.reason : result.value.error
          });
          coordinationContext.deviceStatus.get(device.id).status = 'failed';
        }
      }
      
      // Check if we have enough successful devices
      if (successfulDevices.length < requiredDevices.minRequired) {
        // Cleanup and return error
        this._cleanupCoordination(executionId);
        
        return {
          success: false,
          error: `Not enough devices ready for coordination. Required: ${requiredDevices.minRequired}, Ready: ${successfulDevices.length}`,
          devices: successfulDevices,
          failedDevices
        };
      }
      
      // Update coordination status
      coordinationContext.status = 'ready';
      
      return {
        success: true,
        devices: successfulDevices,
        failedDevices
      };
    } catch (error) {
      // Cleanup and return error
      this._cleanupCoordination(executionId);
      
      return {
        success: false,
        error: error.message,
        devices: []
      };
    }
  }
  
  /**
   * Execute action on distributed devices
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} action - Action to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeAction(executionId, action, options = {}) {
    if (!this.enabled || !executionId || !this.activeCoordinations.has(executionId)) {
      return {
        success: false,
        error: 'Invalid execution ID or coordination not started',
        results: []
      };
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    
    try {
      // Get ready devices
      const readyDevices = Array.from(coordinationContext.deviceStatus.entries())
        .filter(([_, status]) => status.status === 'ready')
        .map(([id, _]) => coordinationContext.devices.find(device => device.id === id))
        .filter(Boolean);
      
      if (readyDevices.length === 0) {
        return {
          success: false,
          error: 'No ready devices available for execution',
          results: []
        };
      }
      
      // Determine target devices for this action
      const targetDevices = this._determineTargetDevices(action, readyDevices, options);
      
      if (targetDevices.length === 0) {
        return {
          success: false,
          error: 'No suitable devices for action execution',
          results: []
        };
      }
      
      // Emit action distribution event
      if (this.eventBus) {
        this.eventBus.emit('coordination:action:distributing', {
          executionId,
          actionType: action.type,
          deviceCount: targetDevices.length,
          timestamp: Date.now()
        });
      }
      
      // Send action to all target devices
      const actionPromises = targetDevices.map(device => 
        this._sendActionToDevice(executionId, device, action, options)
      );
      
      // Wait for all devices to complete or timeout
      const results = await Promise.allSettled(actionPromises);
      
      // Process results
      const successResults = [];
      const failedResults = [];
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const device = targetDevices[i];
        
        if (result.status === 'fulfilled') {
          const actionResult = result.value;
          
          if (actionResult.success) {
            successResults.push({
              deviceId: device.id,
              ...actionResult
            });
          } else {
            failedResults.push({
              deviceId: device.id,
              error: actionResult.error,
              ...actionResult
            });
          }
        } else {
          failedResults.push({
            deviceId: device.id,
            error: result.reason.message || 'Unknown error'
          });
        }
      }
      
      // Determine overall success based on action criticality
      const success = action.critical !== false ? 
        failedResults.length === 0 : successResults.length > 0;
      
      // Emit action completion event
      if (this.eventBus) {
        this.eventBus.emit('coordination:action:completed', {
          executionId,
          actionType: action.type,
          success,
          successCount: successResults.length,
          failureCount: failedResults.length,
          timestamp: Date.now()
        });
      }
      
      return {
        success,
        results: [...successResults, ...failedResults],
        successCount: successResults.length,
        failureCount: failedResults.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }
  
  /**
   * Stop coordination for an execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Stop options
   * @returns {Promise<boolean>} Whether coordination was stopped successfully
   */
  async stopCoordination(executionId, options = {}) {
    if (!this.enabled || !executionId || !this.activeCoordinations.has(executionId)) {
      return false;
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    const { success, error, cancelled } = options;
    
    try {
      // Update coordination status
      coordinationContext.status = success ? 'completed' : (cancelled ? 'cancelled' : 'failed');
      coordinationContext.endTime = Date.now();
      coordinationContext.error = error;
      
      // Get ready devices
      const readyDevices = Array.from(coordinationContext.deviceStatus.entries())
        .filter(([_, status]) => status.status === 'ready')
        .map(([id, _]) => coordinationContext.devices.find(device => device.id === id))
        .filter(Boolean);
      
      // Send stop request to all ready devices
      const stopPromises = readyDevices.map(device => 
        this._sendStopRequest(executionId, device, options)
      );
      
      // Wait for all devices to respond or timeout
      await Promise.allSettled(stopPromises);
      
      // Emit coordination stopped event
      if (this.eventBus) {
        this.eventBus.emit('coordination:stopped', {
          executionId,
          status: coordinationContext.status,
          deviceCount: readyDevices.length,
          timestamp: coordinationContext.endTime
        });
      }
      
      // Resolve all pending completion callbacks
      for (const callback of coordinationContext.completionCallbacks) {
        try {
          callback({
            success: coordinationContext.status === 'completed',
            status: coordinationContext.status,
            error: coordinationContext.error
          });
        } catch (callbackError) {
          console.error('Error in completion callback:', callbackError);
        }
      }
      
      // Clean up after timeout
      setTimeout(() => {
        this._cleanupCoordination(executionId);
      }, 60000); // Keep coordination context for 1 minute for potential queries
      
      return true;
    } catch (error) {
      console.error('Error stopping coordination:', error);
      return false;
    }
  }
  
  /**
   * Wait for coordination completion
   * 
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Completion result
   */
  waitForCompletion(executionId) {
    if (!this.enabled || !executionId || !this.activeCoordinations.has(executionId)) {
      return Promise.resolve({
        success: false,
        error: 'Invalid execution ID or coordination not started'
      });
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    
    // If already completed, return result immediately
    if (coordinationContext.status === 'completed' || 
        coordinationContext.status === 'cancelled' || 
        coordinationContext.status === 'failed') {
      return Promise.resolve({
        success: coordinationContext.status === 'completed',
        status: coordinationContext.status,
        error: coordinationContext.error
      });
    }
    
    // Otherwise, return promise that will be resolved when coordination completes
    return new Promise(resolve => {
      coordinationContext.completionCallbacks.push(resolve);
    });
  }
  
  /**
   * Get coordination status
   * 
   * @param {string} executionId - Execution ID
   * @returns {Object} Coordination status
   */
  getCoordinationStatus(executionId) {
    if (!this.enabled || !executionId || !this.activeCoordinations.has(executionId)) {
      return { found: false };
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    const now = Date.now();
    
    // Count devices by status
    const deviceCounts = {
      total: coordinationContext.devices.length,
      ready: 0,
      pending: 0,
      failed: 0
    };
    
    for (const [_, status] of coordinationContext.deviceStatus.entries()) {
      deviceCounts[status.status]++;
    }
    
    return {
      found: true,
      status: coordinationContext.status,
      startTime: coordinationContext.startTime,
      endTime: coordinationContext.endTime,
      executionTime: coordinationContext.endTime ? 
        coordinationContext.endTime - coordinationContext.startTime : 
        now - coordinationContext.startTime,
      devices: deviceCounts
    };
  }
  
  /**
   * Handle device status changed event
   * 
   * @param {Object} data - Device status data
   * @private
   */
  _handleDeviceStatusChanged(data) {
    if (!data || !data.deviceId || !data.status) {
      return;
    }
    
    // Update device status
    this.deviceStatus.set(data.deviceId, {
      id: data.deviceId,
      status: data.status,
      lastUpdate: Date.now()
    });
    
    // Check if this affects any active coordinations
    for (const [executionId, coordinationContext] of this.activeCoordinations.entries()) {
      if (coordinationContext.deviceStatus.has(data.deviceId)) {
        const deviceStatus = coordinationContext.deviceStatus.get(data.deviceId);
        
        // If device was ready but is now offline/unavailable, handle failure
        if (deviceStatus.status === 'ready' && 
            (data.status === 'offline' || data.status === 'unavailable')) {
          this._handleDeviceFailure(executionId, data.deviceId);
        }
      }
    }
  }
  
  /**
   * Handle device heartbeat event
   * 
   * @param {Object} data - Heartbeat data
   * @private
   */
  _handleDeviceHeartbeat(data) {
    if (!data || !data.deviceId) {
      return;
    }
    
    // Update device heartbeat
    if (this.deviceStatus.has(data.deviceId)) {
      const status = this.deviceStatus.get(data.deviceId);
      status.lastHeartbeat = Date.now();
    }
    
    // Update heartbeat in active coordinations
    for (const [executionId, coordinationContext] of this.activeCoordinations.entries()) {
      if (coordinationContext.deviceStatus.has(data.deviceId)) {
        const deviceStatus = coordinationContext.deviceStatus.get(data.deviceId);
        deviceStatus.lastHeartbeat = Date.now();
      }
    }
  }
  
  /**
   * Handle coordination request event
   * 
   * @param {Object} data - Coordination request data
   * @private
   */
  _handleCoordinationRequest(data) {
    if (!data || !data.executionId || !data.sourceDeviceId) {
      return;
    }
    
    // In a real implementation, this would handle incoming coordination requests
    // For now, we'll just log the event
    console.debug(`Received coordination request from device ${data.sourceDeviceId} for execution ${data.executionId}`);
  }
  
  /**
   * Handle coordination response event
   * 
   * @param {Object} data - Coordination response data
   * @private
   */
  _handleCoordinationResponse(data) {
    if (!data || !data.executionId || !data.deviceId) {
      return;
    }
    
    const executionId = data.executionId;
    if (!this.activeCoordinations.has(executionId)) {
      return;
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    
    // Store response
    coordinationContext.responses.set(data.deviceId, {
      deviceId: data.deviceId,
      success: data.success,
      error: data.error,
      timestamp: Date.now()
    });
    
    // Update device status
    if (coordinationContext.deviceStatus.has(data.deviceId)) {
      const deviceStatus = coordinationContext.deviceStatus.get(data.deviceId);
      deviceStatus.status = data.success ? 'ready' : 'failed';
      deviceStatus.lastResponse = Date.now();
    }
  }
  
  /**
   * Send heartbeat to other devices
   * @private
   */
  _sendHeartbeat() {
    if (!this.eventBus) {
      return;
    }
    
    // In a real implementation, this would send heartbeat to other devices
    // For now, we'll just emit a local event
    this.eventBus.emit('device:heartbeat', {
      deviceId: 'local',
      timestamp: Date.now()
    });
  }
  
  /**
   * Send coordination request to a device
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} device - Target device
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response from device
   * @private
   */
  async _sendCoordinationRequest(executionId, device, options = {}) {
    // In a real implementation, this would send a request to the device
    // For now, we'll simulate a successful response
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 90% success rate
        if (Math.random() < 0.9) {
          resolve({
            success: true,
            deviceId: device.id,
            timestamp: Date.now()
          });
        } else {
          resolve({
            success: false,
            error: 'Simulated device failure',
            deviceId: device.id,
            timestamp: Date.now()
          });
        }
      }, 100 + Math.random() * 200); // Simulate network delay
    });
  }
  
  /**
   * Send action to a device
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} device - Target device
   * @param {Object} action - Action to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async _sendActionToDevice(executionId, device, action, options = {}) {
    // In a real implementation, this would send the action to the device
    // For now, we'll simulate a successful execution
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 95% success rate
        if (Math.random() < 0.95) {
          resolve({
            success: true,
            output: `Action ${action.type} executed successfully on device ${device.id}`,
            timestamp: Date.now()
          });
        } else {
          resolve({
            success: false,
            error: `Failed to execute action ${action.type} on device ${device.id}`,
            timestamp: Date.now()
          });
        }
      }, 200 + Math.random() * 300); // Simulate execution time
    });
  }
  
  /**
   * Send stop request to a device
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} device - Target device
   * @param {Object} options - Stop options
   * @returns {Promise<boolean>} Whether stop was successful
   * @private
   */
  async _sendStopRequest(executionId, device, options = {}) {
    // In a real implementation, this would send a stop request to the device
    // For now, we'll simulate a successful stop
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(true);
      }, 50 + Math.random() * 100); // Simulate network delay
    });
  }
  
  /**
   * Handle device failure during coordination
   * 
   * @param {string} executionId - Execution ID
   * @param {string} deviceId - Failed device ID
   * @private
   */
  _handleDeviceFailure(executionId, deviceId) {
    if (!this.activeCoordinations.has(executionId)) {
      return;
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    
    // Update device status
    if (coordinationContext.deviceStatus.has(deviceId)) {
      const deviceStatus = coordinationContext.deviceStatus.get(deviceId);
      deviceStatus.status = 'failed';
      deviceStatus.failureTime = Date.now();
    }
    
    // Emit device failure event
    if (this.eventBus) {
      this.eventBus.emit('coordination:device:failed', {
        executionId,
        deviceId,
        timestamp: Date.now()
      });
    }
    
    // Check if we need to handle failover
    if (this.failoverStrategy === 'automatic') {
      this._handleFailover(executionId, deviceId);
    }
  }
  
  /**
   * Handle failover for a failed device
   * 
   * @param {string} executionId - Execution ID
   * @param {string} failedDeviceId - Failed device ID
   * @private
   */
  async _handleFailover(executionId, failedDeviceId) {
    if (!this.activeCoordinations.has(executionId)) {
      return;
    }
    
    const coordinationContext = this.activeCoordinations.get(executionId);
    
    try {
      // Find a replacement device
      const failedDevice = coordinationContext.devices.find(device => device.id === failedDeviceId);
      if (!failedDevice) {
        return;
      }
      
      // Get required capabilities from failed device
      const requiredCapabilities = failedDevice.capabilities || [];
      
      // Find available devices with required capabilities
      const availableDevices = await this._getAvailableDevices(1, requiredCapabilities);
      
      if (availableDevices.length === 0) {
        // No replacement available
        console.warn(`No replacement device available for failed device ${failedDeviceId}`);
        return;
      }
      
      const replacementDevice = availableDevices[0];
      
      // Emit failover event
      if (this.eventBus) {
        this.eventBus.emit('coordination:failover:started', {
          executionId,
          failedDeviceId,
          replacementDeviceId: replacementDevice.id,
          timestamp: Date.now()
        });
      }
      
      // Send coordination request to replacement device
      const response = await this._sendCoordinationRequest(executionId, replacementDevice, {
        strategy: { id: coordinationContext.strategyId },
        isFailover: true,
        failedDeviceId
      });
      
      if (response.success) {
        // Update coordination context
        coordinationContext.devices = coordinationContext.devices.filter(device => device.id !== failedDeviceId);
        coordinationContext.devices.push(replacementDevice);
        
        coordinationContext.deviceStatus.delete(failedDeviceId);
        coordinationContext.deviceStatus.set(replacementDevice.id, {
          id: replacementDevice.id,
          status: 'ready',
          lastHeartbeat: Date.now()
        });
        
        // Emit failover success event
        if (this.eventBus) {
          this.eventBus.emit('coordination:failover:succeeded', {
            executionId,
            failedDeviceId,
            replacementDeviceId: replacementDevice.id,
            timestamp: Date.now()
          });
        }
      } else {
        // Emit failover failed event
        if (this.eventBus) {
          this.eventBus.emit('coordination:failover:failed', {
            executionId,
            failedDeviceId,
            replacementDeviceId: replacementDevice.id,
            error: response.error,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error handling failover:', error);
    }
  }
  
  /**
   * Clean up coordination resources
   * 
   * @param {string} executionId - Execution ID
   * @private
   */
  _cleanupCoordination(executionId) {
    if (!this.activeCoordinations.has(executionId)) {
      return;
    }
    
    this.activeCoordinations.delete(executionId);
  }
  
  /**
   * Determine required devices based on strategy
   * 
   * @param {Object} strategy - Strategy being executed
   * @returns {Object} Required devices info
   * @private
   */
  _determineRequiredDevices(strategy) {
    if (!strategy) {
      return {
        count: 1,
        minRequired: 1,
        capabilities: []
      };
    }
    
    // In a real implementation, this would analyze the strategy to determine
    // how many devices are needed and what capabilities they should have
    // For now, we'll use simple logic
    
    const isDistributed = strategy.distributed === true;
    const specifiedCount = strategy.deviceCount || 1;
    
    // Limit by configured max devices
    const count = Math.min(isDistributed ? specifiedCount : 1, this.maxDevices);
    
    // Determine minimum required devices
    const minRequired = strategy.minDevices || 1;
    
    // Determine required capabilities
    const capabilities = Array.isArray(strategy.requiredCapabilities) ? 
      strategy.requiredCapabilities : [];
    
    return {
      count,
      minRequired,
      capabilities
    };
  }
  
  /**
   * Get available devices with required capabilities
   * 
   * @param {number} count - Number of devices needed
   * @param {Array} capabilities - Required capabilities
   * @returns {Promise<Array>} Available devices
   * @private
   */
  async _getAvailableDevices(count = 1, capabilities = []) {
    // In a real implementation, this would query the device registry
    // For now, we'll simulate available devices
    
    // Always include local device
    const devices = [
      {
        id: 'local',
        name: 'Local Device',
        type: 'primary',
        capabilities: ['all'],
        status: 'available'
      }
    ];
    
    // Add simulated remote devices if needed
    if (count > 1) {
      for (let i = 1; i < Math.min(count, 5); i++) {
        devices.push({
          id: `device-${i}`,
          name: `Remote Device ${i}`,
          type: 'secondary',
          capabilities: ['basic'],
          status: 'available'
        });
      }
    }
    
    return devices;
  }
  
  /**
   * Determine target devices for an action
   * 
   * @param {Object} action - Action to execute
   * @param {Array} availableDevices - Available devices
   * @param {Object} options - Execution options
   * @returns {Array} Target devices
   * @private
   */
  _determineTargetDevices(action, availableDevices, options = {}) {
    if (!action || availableDevices.length === 0) {
      return [];
    }
    
    // If specific target devices are specified, use those
    if (options.targetDevices) {
      const targetIds = Array.isArray(options.targetDevices) ? 
        options.targetDevices : [options.targetDevices];
      
      return availableDevices.filter(device => targetIds.includes(device.id));
    }
    
    // If action specifies target device type, filter by that
    if (action.targetDeviceType) {
      const targets = availableDevices.filter(device => device.type === action.targetDeviceType);
      return targets.length > 0 ? targets : [];
    }
    
    // If action requires specific capabilities, filter by those
    if (Array.isArray(action.requiredCapabilities) && action.requiredCapabilities.length > 0) {
      return availableDevices.filter(device => 
        device.capabilities.includes('all') || 
        action.requiredCapabilities.every(cap => device.capabilities.includes(cap))
      );
    }
    
    // Default: use all available devices if action is broadcast, otherwise just the primary
    return action.broadcast === true ? 
      availableDevices : 
      availableDevices.filter(device => device.type === 'primary');
  }
  
  /**
   * Dispose resources used by this coordinator
   */
  dispose() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.eventBus) {
      this.eventBus.removeAllListeners('device:status:changed');
      this.eventBus.removeAllListeners('device:heartbeat');
      this.eventBus.removeAllListeners('coordination:request');
      this.eventBus.removeAllListeners('coordination:response');
    }
    
    this.activeCoordinations.clear();
    this.deviceStatus.clear();
  }
}

module.exports = DistributedCoordinator;
