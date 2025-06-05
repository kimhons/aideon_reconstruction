/**
 * DistributedRecoveryAnalyzer.js
 * 
 * Analyzes and coordinates recovery strategies across distributed environments.
 * This component is responsible for understanding the distributed nature of errors
 * and generating appropriate recovery strategies that work across multiple devices.
 * 
 * @module src/core/error_recovery/strategy/DistributedRecoveryAnalyzer
 */

'use strict';

/**
 * Class responsible for analyzing and coordinating distributed recovery strategies
 */
class DistributedRecoveryAnalyzer {
  /**
   * Creates a new DistributedRecoveryAnalyzer instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.deviceManager - Device manager for accessing device information
   * @param {Object} options.networkManager - Network manager for communication
   * @param {Object} options.knowledgeFramework - Knowledge framework for distributed patterns
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.deviceManager = options.deviceManager;
    this.networkManager = options.networkManager;
    this.knowledgeFramework = options.knowledgeFramework;
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.deviceCache = new Map();
    this.networkTopology = null;
    this.distributedPatterns = [];
    this.isInitialized = false;
  }
  
  /**
   * Initialize the analyzer and load required data
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    // Load distributed error patterns
    if (this.knowledgeFramework) {
      try {
        const patterns = await this.knowledgeFramework.query({
          type: 'distributed_error_pattern',
          active: true
        });
        
        if (patterns && patterns.length > 0) {
          this.distributedPatterns = patterns;
        }
      } catch (error) {
        console.warn('Failed to load distributed error patterns:', error.message);
        // Continue with default patterns
      }
    }
    
    // Set up default patterns if none were loaded
    if (this.distributedPatterns.length === 0) {
      this.distributedPatterns = this._getDefaultDistributedPatterns();
    }
    
    // Subscribe to device and network events if event bus is available
    if (this.eventBus) {
      this.eventBus.on('device:connected', this._handleDeviceConnected.bind(this));
      this.eventBus.on('device:disconnected', this._handleDeviceDisconnected.bind(this));
      this.eventBus.on('network:topology:changed', this._handleNetworkTopologyChanged.bind(this));
    }
    
    // Initialize network topology
    await this._updateNetworkTopology();
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'DistributedRecoveryAnalyzer',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the analyzer and load required data
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Analyze error for distributed recovery options
   * 
   * @param {Object} error - The error object
   * @param {Object} context - Additional context information
   * @returns {Object} Distributed analysis results
   */
  async analyzeDistributedRecovery(error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Check if this is a distributed environment
    const isDistributed = await this._isDistributedEnvironment();
    if (!isDistributed) {
      return {
        isDistributed: false,
        reason: 'Not a distributed environment',
        devices: []
      };
    }
    
    // Get available devices
    const devices = await this._getAvailableDevices();
    
    // Check if error has distributed characteristics
    const distributedCharacteristics = await this._identifyDistributedCharacteristics(error);
    
    // Identify affected devices
    const affectedDevices = await this._identifyAffectedDevices(error, devices);
    
    // Determine coordination strategy
    const coordinationStrategy = await this._determineCoordinationStrategy(
      error, 
      affectedDevices,
      distributedCharacteristics
    );
    
    // Generate device-specific recovery options
    const deviceRecoveryOptions = await this._generateDeviceRecoveryOptions(
      error,
      affectedDevices,
      coordinationStrategy
    );
    
    return {
      isDistributed: true,
      distributedCharacteristics,
      devices: affectedDevices,
      coordinationStrategy,
      deviceRecoveryOptions,
      networkTopology: this._getSimplifiedNetworkTopology()
    };
  }
  
  /**
   * Enhance a recovery strategy with distributed capabilities
   * 
   * @param {Object} strategy - The strategy to enhance
   * @param {Object} distributedAnalysis - Results from analyzeDistributedRecovery
   * @returns {Object} Enhanced strategy
   */
  async enhanceStrategyWithDistributedCapabilities(strategy, distributedAnalysis) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategy || !distributedAnalysis || !distributedAnalysis.isDistributed) {
      return strategy;
    }
    
    // Create a copy of the strategy to avoid modifying the original
    const enhancedStrategy = { ...strategy };
    
    // Add distributed capabilities
    enhancedStrategy.distributedCapabilities = {
      isDistributed: true,
      coordinationStrategy: distributedAnalysis.coordinationStrategy,
      deviceActions: {}
    };
    
    // Add device-specific actions
    for (const device of distributedAnalysis.devices) {
      const deviceOptions = distributedAnalysis.deviceRecoveryOptions[device.id];
      if (deviceOptions) {
        enhancedStrategy.distributedCapabilities.deviceActions[device.id] = {
          actions: deviceOptions.actions,
          priority: deviceOptions.priority,
          dependencies: deviceOptions.dependencies
        };
      }
    }
    
    // Add coordination actions
    enhancedStrategy.actions = enhancedStrategy.actions || [];
    
    // Add synchronization action if needed
    if (distributedAnalysis.coordinationStrategy.type === 'synchronized') {
      enhancedStrategy.actions.push({
        type: 'synchronize',
        target: 'distributed_coordinator',
        params: {
          devices: distributedAnalysis.devices.map(d => d.id),
          timeout: distributedAnalysis.coordinationStrategy.timeoutMs || 5000,
          retries: distributedAnalysis.coordinationStrategy.retries || 3
        }
      });
    }
    
    // Add coordination action
    enhancedStrategy.actions.push({
      type: 'coordinate',
      target: 'distributed_coordinator',
      params: {
        strategy: distributedAnalysis.coordinationStrategy.type,
        devices: distributedAnalysis.devices.map(d => d.id),
        timeout: distributedAnalysis.coordinationStrategy.timeoutMs || 5000
      }
    });
    
    return enhancedStrategy;
  }
  
  /**
   * Check if a strategy can be executed in a distributed environment
   * 
   * @param {Object} strategy - The strategy to check
   * @returns {Object} Compatibility check result
   */
  async checkDistributedCompatibility(strategy) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!strategy) {
      return {
        compatible: false,
        reason: 'Strategy is null or undefined'
      };
    }
    
    // Check if this is a distributed environment
    const isDistributed = await this._isDistributedEnvironment();
    if (!isDistributed) {
      return {
        compatible: true, // Non-distributed strategies are compatible with non-distributed environments
        reason: 'Not a distributed environment'
      };
    }
    
    // Check if strategy has distributed capabilities
    if (!strategy.distributedCapabilities) {
      return {
        compatible: false,
        reason: 'Strategy lacks distributed capabilities',
        canEnhance: true
      };
    }
    
    // Check if all required devices are available
    const requiredDevices = Object.keys(strategy.distributedCapabilities.deviceActions || {});
    const availableDevices = await this._getAvailableDevices();
    const availableDeviceIds = availableDevices.map(d => d.id);
    
    const missingDevices = requiredDevices.filter(id => !availableDeviceIds.includes(id));
    if (missingDevices.length > 0) {
      return {
        compatible: false,
        reason: `Missing required devices: ${missingDevices.join(', ')}`,
        missingDevices
      };
    }
    
    // Check if coordination strategy is supported
    const coordinationStrategy = strategy.distributedCapabilities.coordinationStrategy;
    if (!this._isSupportedCoordinationStrategy(coordinationStrategy)) {
      return {
        compatible: false,
        reason: `Unsupported coordination strategy: ${coordinationStrategy.type}`
      };
    }
    
    return {
      compatible: true
    };
  }
  
  /**
   * Check if this is a distributed environment
   * 
   * @returns {boolean} Whether this is a distributed environment
   * @private
   */
  async _isDistributedEnvironment() {
    // Check if device manager is available
    if (!this.deviceManager) {
      return false;
    }
    
    try {
      // Get connected devices
      const devices = await this.deviceManager.getConnectedDevices();
      
      // Consider it distributed if there are multiple devices
      return devices && devices.length > 1;
    } catch (error) {
      console.warn('Error checking distributed environment:', error.message);
      return false;
    }
  }
  
  /**
   * Get available devices
   * 
   * @returns {Array} List of available devices
   * @private
   */
  async _getAvailableDevices() {
    if (!this.deviceManager) {
      return [];
    }
    
    try {
      // Get connected devices
      const devices = await this.deviceManager.getConnectedDevices();
      
      // Update device cache
      for (const device of devices) {
        this.deviceCache.set(device.id, {
          device,
          lastSeen: Date.now()
        });
      }
      
      return devices;
    } catch (error) {
      console.warn('Error getting available devices:', error.message);
      
      // Fall back to cached devices if available
      if (this.deviceCache.size > 0) {
        return Array.from(this.deviceCache.values())
          .filter(entry => entry.lastSeen > Date.now() - 300000) // Only use devices seen in the last 5 minutes
          .map(entry => entry.device);
      }
      
      return [];
    }
  }
  
  /**
   * Identify distributed characteristics of an error
   * 
   * @param {Object} error - The error object
   * @returns {Object} Distributed characteristics
   * @private
   */
  async _identifyDistributedCharacteristics(error) {
    const characteristics = {
      isDistributed: false,
      scope: 'local',
      propagationRisk: 'low',
      consistencyImpact: 'low',
      patterns: []
    };
    
    // Check error type and code for distributed indicators
    const distributedErrorTypes = [
      'NetworkError',
      'SynchronizationError',
      'ConsistencyError',
      'DistributedTransactionError',
      'ReplicationError',
      'PartitionError'
    ];
    
    if (error.type && distributedErrorTypes.includes(error.type)) {
      characteristics.isDistributed = true;
      characteristics.scope = 'multi_device';
    }
    
    // Check error code for distributed indicators
    const distributedErrorCodes = [
      'SYNC_FAILED',
      'REPLICATION_ERROR',
      'CONSISTENCY_VIOLATION',
      'NETWORK_PARTITION',
      'DISTRIBUTED_DEADLOCK',
      'QUORUM_FAILURE'
    ];
    
    if (error.code && distributedErrorCodes.some(code => error.code.includes(code))) {
      characteristics.isDistributed = true;
      characteristics.scope = 'multi_device';
    }
    
    // Check error context for distributed indicators
    if (error.context) {
      if (error.context.isDistributed) {
        characteristics.isDistributed = true;
      }
      
      if (error.context.affectedDevices && error.context.affectedDevices.length > 1) {
        characteristics.isDistributed = true;
        characteristics.scope = 'multi_device';
      }
      
      if (error.context.consistencyImpact) {
        characteristics.consistencyImpact = error.context.consistencyImpact;
      }
      
      if (error.context.propagationRisk) {
        characteristics.propagationRisk = error.context.propagationRisk;
      }
    }
    
    // Match against known distributed patterns
    for (const pattern of this.distributedPatterns) {
      if (this._matchesDistributedPattern(error, pattern)) {
        characteristics.isDistributed = true;
        characteristics.patterns.push(pattern.id);
        
        // Update characteristics based on pattern
        if (pattern.scope && pattern.scope !== 'local') {
          characteristics.scope = pattern.scope;
        }
        
        if (pattern.propagationRisk && 
            this._getRiskLevel(pattern.propagationRisk) > this._getRiskLevel(characteristics.propagationRisk)) {
          characteristics.propagationRisk = pattern.propagationRisk;
        }
        
        if (pattern.consistencyImpact && 
            this._getRiskLevel(pattern.consistencyImpact) > this._getRiskLevel(characteristics.consistencyImpact)) {
          characteristics.consistencyImpact = pattern.consistencyImpact;
        }
      }
    }
    
    return characteristics;
  }
  
  /**
   * Identify devices affected by an error
   * 
   * @param {Object} error - The error object
   * @param {Array} devices - List of available devices
   * @returns {Array} List of affected devices
   * @private
   */
  async _identifyAffectedDevices(error, devices) {
    const affectedDevices = [];
    
    // Check error context for explicitly affected devices
    if (error.context && error.context.affectedDevices) {
      const explicitlyAffected = error.context.affectedDevices;
      
      for (const device of devices) {
        if (explicitlyAffected.includes(device.id)) {
          affectedDevices.push({
            ...device,
            affectedBy: 'explicit',
            primarySource: explicitlyAffected[0] === device.id
          });
        }
      }
      
      if (affectedDevices.length > 0) {
        return affectedDevices;
      }
    }
    
    // Check error source device
    if (error.context && error.context.sourceDevice) {
      const sourceDeviceId = error.context.sourceDevice;
      const sourceDevice = devices.find(d => d.id === sourceDeviceId);
      
      if (sourceDevice) {
        affectedDevices.push({
          ...sourceDevice,
          affectedBy: 'source',
          primarySource: true
        });
      }
    }
    
    // If no affected devices identified yet, assume current device is affected
    if (affectedDevices.length === 0 && devices.length > 0) {
      // Assume first device is current device (or use device marked as current if available)
      const currentDevice = devices.find(d => d.isCurrent) || devices[0];
      
      affectedDevices.push({
        ...currentDevice,
        affectedBy: 'assumed',
        primarySource: true
      });
    }
    
    // Identify potentially affected devices based on network topology and error characteristics
    const characteristics = await this._identifyDistributedCharacteristics(error);
    
    if (characteristics.isDistributed && characteristics.scope === 'multi_device') {
      // Get network topology
      const topology = await this._getNetworkTopology();
      
      // Find devices connected to affected devices
      for (const affectedDevice of [...affectedDevices]) {
        const connectedDevices = this._getConnectedDevices(affectedDevice.id, topology);
        
        for (const connectedId of connectedDevices) {
          const device = devices.find(d => d.id === connectedId);
          if (device && !affectedDevices.some(d => d.id === device.id)) {
            affectedDevices.push({
              ...device,
              affectedBy: 'connected',
              primarySource: false
            });
          }
        }
      }
      
      // Add devices based on propagation risk
      if (characteristics.propagationRisk === 'high') {
        // In high propagation risk, consider all devices potentially affected
        for (const device of devices) {
          if (!affectedDevices.some(d => d.id === device.id)) {
            affectedDevices.push({
              ...device,
              affectedBy: 'propagation_risk',
              primarySource: false
            });
          }
        }
      }
    }
    
    return affectedDevices;
  }
  
  /**
   * Determine coordination strategy for distributed recovery
   * 
   * @param {Object} error - The error object
   * @param {Array} affectedDevices - List of affected devices
   * @param {Object} characteristics - Distributed characteristics
   * @returns {Object} Coordination strategy
   * @private
   */
  async _determineCoordinationStrategy(error, affectedDevices, characteristics) {
    // Default strategy
    const strategy = {
      type: 'sequential',
      order: 'priority',
      timeoutMs: 10000,
      retries: 3
    };
    
    // Check if synchronization is required
    if (characteristics.consistencyImpact === 'high') {
      strategy.type = 'synchronized';
      strategy.waitForAll = true;
    } else if (characteristics.scope === 'multi_device' && affectedDevices.length > 2) {
      strategy.type = 'parallel';
      strategy.maxConcurrent = Math.min(affectedDevices.length, 3);
    }
    
    // Check for specific error types that require special coordination
    if (error.type === 'ConsistencyError' || error.type === 'ReplicationError') {
      strategy.type = 'synchronized';
      strategy.waitForAll = true;
      strategy.consistencyCheck = true;
    } else if (error.type === 'NetworkError' || error.type === 'PartitionError') {
      strategy.type = 'adaptive';
      strategy.fallbackToLocal = true;
    }
    
    // Check for patterns that suggest specific coordination strategies
    for (const patternId of characteristics.patterns) {
      const pattern = this.distributedPatterns.find(p => p.id === patternId);
      if (pattern && pattern.recommendedCoordination) {
        // Override with pattern-specific recommendations
        Object.assign(strategy, pattern.recommendedCoordination);
      }
    }
    
    return strategy;
  }
  
  /**
   * Generate device-specific recovery options
   * 
   * @param {Object} error - The error object
   * @param {Array} affectedDevices - List of affected devices
   * @param {Object} coordinationStrategy - Coordination strategy
   * @returns {Object} Device-specific recovery options
   * @private
   */
  async _generateDeviceRecoveryOptions(error, affectedDevices, coordinationStrategy) {
    const deviceOptions = {};
    
    for (const device of affectedDevices) {
      const options = {
        actions: [],
        priority: device.primarySource ? 'high' : 'medium',
        dependencies: []
      };
      
      // Generate actions based on device role and error type
      if (device.primarySource) {
        // Primary source device gets main recovery actions
        options.actions.push({
          type: this._getActionTypeForError(error),
          target: error.context ? error.context.component : 'affected_component',
          params: this._getActionParamsForError(error)
        });
      } else if (device.affectedBy === 'connected') {
        // Connected devices get verification and potential recovery actions
        options.actions.push({
          type: 'verify',
          target: error.context ? error.context.component : 'affected_component',
          params: {
            timeout: 2000,
            thorough: true
          }
        });
        
        // Add conditional recovery action
        options.actions.push({
          type: 'conditional_recovery',
          target: error.context ? error.context.component : 'affected_component',
          condition: 'verification_failed',
          action: {
            type: this._getActionTypeForError(error),
            params: this._getActionParamsForError(error)
          }
        });
      } else if (device.affectedBy === 'propagation_risk') {
        // Devices at risk of propagation get preventive actions
        options.actions.push({
          type: 'preventive',
          target: error.context ? error.context.component : 'affected_component',
          params: {
            isolate: true,
            timeout: 5000
          }
        });
      }
      
      // Add synchronization action if using synchronized coordination
      if (coordinationStrategy.type === 'synchronized') {
        options.actions.push({
          type: 'sync_state',
          target: 'distributed_coordinator',
          params: {
            timeout: 3000,
            retries: 2
          }
        });
      }
      
      // Set dependencies based on coordination strategy
      if (coordinationStrategy.type === 'sequential' && !device.primarySource) {
        // Non-primary devices depend on primary device in sequential coordination
        const primaryDevice = affectedDevices.find(d => d.primarySource);
        if (primaryDevice) {
          options.dependencies.push(primaryDevice.id);
        }
      }
      
      deviceOptions[device.id] = options;
    }
    
    return deviceOptions;
  }
  
  /**
   * Get action type appropriate for an error
   * 
   * @param {Object} error - The error object
   * @returns {string} Action type
   * @private
   */
  _getActionTypeForError(error) {
    switch (error.type) {
      case 'NetworkError':
        return 'retry';
        
      case 'ConsistencyError':
      case 'ReplicationError':
        return 'synchronize';
        
      case 'ConfigurationError':
        return 'reconfigure';
        
      case 'ResourceError':
        return 'allocate';
        
      case 'PartitionError':
        return 'reconnect';
        
      default:
        return 'recover';
    }
  }
  
  /**
   * Get action parameters appropriate for an error
   * 
   * @param {Object} error - The error object
   * @returns {Object} Action parameters
   * @private
   */
  _getActionParamsForError(error) {
    const params = {
      timeout: 5000,
      retries: 3
    };
    
    switch (error.type) {
      case 'NetworkError':
        params.exponentialBackoff = true;
        params.maxRetries = 5;
        break;
        
      case 'ConsistencyError':
      case 'ReplicationError':
        params.forceConsistency = true;
        params.timeout = 10000;
        break;
        
      case 'ConfigurationError':
        params.resetToDefault = true;
        params.validateAfter = true;
        break;
        
      case 'ResourceError':
        params.priority = 'high';
        params.alternative = true;
        break;
        
      case 'PartitionError':
        params.alternativeRoutes = true;
        params.timeout = 15000;
        break;
    }
    
    return params;
  }
  
  /**
   * Check if an error matches a distributed pattern
   * 
   * @param {Object} error - The error object
   * @param {Object} pattern - The pattern to match against
   * @returns {boolean} Whether the error matches the pattern
   * @private
   */
  _matchesDistributedPattern(error, pattern) {
    // Check error type
    if (pattern.errorTypes && !pattern.errorTypes.includes(error.type)) {
      return false;
    }
    
    // Check error code
    if (pattern.errorCodes && error.code && 
        !pattern.errorCodes.some(code => error.code.includes(code))) {
      return false;
    }
    
    // Check error message
    if (pattern.messagePatterns && error.message) {
      const matchesMessage = pattern.messagePatterns.some(msgPattern => 
        error.message.includes(msgPattern)
      );
      
      if (!matchesMessage) {
        return false;
      }
    }
    
    // Check context criteria
    if (pattern.contextCriteria && error.context) {
      for (const [key, value] of Object.entries(pattern.contextCriteria)) {
        if (error.context[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Get risk level as numeric value
   * 
   * @param {string} level - Risk level string
   * @returns {number} Numeric risk level
   * @private
   */
  _getRiskLevel(level) {
    switch (level) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
  
  /**
   * Get network topology
   * 
   * @returns {Object} Network topology
   * @private
   */
  async _getNetworkTopology() {
    if (this.networkTopology) {
      return this.networkTopology;
    }
    
    await this._updateNetworkTopology();
    return this.networkTopology;
  }
  
  /**
   * Update network topology
   * 
   * @returns {Promise<void>}
   * @private
   */
  async _updateNetworkTopology() {
    if (!this.networkManager) {
      this.networkTopology = { nodes: [], edges: [] };
      return;
    }
    
    try {
      const topology = await this.networkManager.getNetworkTopology();
      this.networkTopology = topology;
    } catch (error) {
      console.warn('Failed to update network topology:', error.message);
      // Create empty topology if update fails
      this.networkTopology = { nodes: [], edges: [] };
    }
  }
  
  /**
   * Get simplified network topology
   * 
   * @returns {Object} Simplified network topology
   * @private
   */
  _getSimplifiedNetworkTopology() {
    if (!this.networkTopology) {
      return { nodes: [], edges: [] };
    }
    
    // Create a simplified version with just device IDs and connections
    return {
      nodes: this.networkTopology.nodes.map(node => ({
        id: node.id,
        type: node.type
      })),
      edges: this.networkTopology.edges.map(edge => ({
        source: edge.source,
        target: edge.target
      }))
    };
  }
  
  /**
   * Get devices connected to a specific device
   * 
   * @param {string} deviceId - ID of the device
   * @param {Object} topology - Network topology
   * @returns {Array} List of connected device IDs
   * @private
   */
  _getConnectedDevices(deviceId, topology) {
    const connectedIds = [];
    
    if (!topology || !topology.edges) {
      return connectedIds;
    }
    
    // Find edges where this device is source or target
    for (const edge of topology.edges) {
      if (edge.source === deviceId && !connectedIds.includes(edge.target)) {
        connectedIds.push(edge.target);
      } else if (edge.target === deviceId && !connectedIds.includes(edge.source)) {
        connectedIds.push(edge.source);
      }
    }
    
    return connectedIds;
  }
  
  /**
   * Check if a coordination strategy is supported
   * 
   * @param {Object} strategy - The coordination strategy
   * @returns {boolean} Whether the strategy is supported
   * @private
   */
  _isSupportedCoordinationStrategy(strategy) {
    if (!strategy || !strategy.type) {
      return false;
    }
    
    const supportedTypes = ['sequential', 'parallel', 'synchronized', 'adaptive'];
    return supportedTypes.includes(strategy.type);
  }
  
  /**
   * Get default distributed patterns
   * 
   * @returns {Array} Default distributed patterns
   * @private
   */
  _getDefaultDistributedPatterns() {
    return [
      {
        id: 'network_partition',
        name: 'Network Partition',
        description: 'Devices unable to communicate due to network partition',
        errorTypes: ['NetworkError', 'PartitionError'],
        errorCodes: ['NETWORK_PARTITION', 'CONNECTION_LOST'],
        messagePatterns: ['partition', 'unreachable', 'connection lost'],
        scope: 'multi_device',
        propagationRisk: 'medium',
        consistencyImpact: 'high',
        recommendedCoordination: {
          type: 'adaptive',
          fallbackToLocal: true,
          timeoutMs: 15000
        }
      },
      {
        id: 'replication_failure',
        name: 'Replication Failure',
        description: 'Data replication between devices failed',
        errorTypes: ['ReplicationError', 'ConsistencyError'],
        errorCodes: ['REPLICATION_FAILED', 'SYNC_ERROR'],
        messagePatterns: ['replication', 'sync failed', 'consistency'],
        scope: 'multi_device',
        propagationRisk: 'high',
        consistencyImpact: 'high',
        recommendedCoordination: {
          type: 'synchronized',
          waitForAll: true,
          consistencyCheck: true,
          timeoutMs: 20000
        }
      },
      {
        id: 'distributed_deadlock',
        name: 'Distributed Deadlock',
        description: 'Deadlock between operations on multiple devices',
        errorTypes: ['DeadlockError', 'DistributedTransactionError'],
        errorCodes: ['DEADLOCK', 'TRANSACTION_TIMEOUT'],
        messagePatterns: ['deadlock', 'transaction', 'timeout'],
        scope: 'multi_device',
        propagationRisk: 'medium',
        consistencyImpact: 'medium',
        recommendedCoordination: {
          type: 'sequential',
          order: 'priority',
          timeoutMs: 10000
        }
      }
    ];
  }
  
  /**
   * Handle device connected event
   * 
   * @param {Object} event - The device connected event
   * @private
   */
  _handleDeviceConnected(event) {
    if (!event || !event.device || !event.device.id) {
      return;
    }
    
    // Update device cache
    this.deviceCache.set(event.device.id, {
      device: event.device,
      lastSeen: Date.now()
    });
  }
  
  /**
   * Handle device disconnected event
   * 
   * @param {Object} event - The device disconnected event
   * @private
   */
  _handleDeviceDisconnected(event) {
    if (!event || !event.deviceId) {
      return;
    }
    
    // Update device cache with disconnected status
    const cachedEntry = this.deviceCache.get(event.deviceId);
    if (cachedEntry) {
      cachedEntry.device.status = 'disconnected';
      cachedEntry.device.disconnectedAt = Date.now();
      cachedEntry.lastSeen = Date.now();
    }
  }
  
  /**
   * Handle network topology changed event
   * 
   * @param {Object} event - The topology changed event
   * @private
   */
  _handleNetworkTopologyChanged(event) {
    if (!event || !event.topology) {
      return;
    }
    
    // Update network topology
    this.networkTopology = event.topology;
  }
}

module.exports = DistributedRecoveryAnalyzer;
