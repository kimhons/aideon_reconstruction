/**
 * ResourceManager.js
 * 
 * Provides resource management capabilities for recovery strategy execution.
 * This component is responsible for allocating, tracking, and releasing resources
 * required during strategy execution.
 * 
 * @module src/core/error_recovery/resources/ResourceManager
 */

'use strict';

/**
 * Class responsible for managing resources during strategy execution
 */
class ResourceManager {
  /**
   * Creates a new ResourceManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.eventBus - Event bus for communication
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.config = options.config || {};
    
    this.enabled = this.config.enabled !== false;
    this.resourceLimits = this.config.resourceLimits || {
      memory: 256 * 1024 * 1024, // 256 MB
      cpu: 0.5, // 50% of one CPU core
      network: 5 * 1024 * 1024, // 5 MB/s
      storage: 100 * 1024 * 1024, // 100 MB
      handles: 100 // file handles, sockets, etc.
    };
    
    this.allocatedResources = new Map();
    this.resourceUsage = {
      memory: 0,
      cpu: 0,
      network: 0,
      storage: 0,
      handles: 0
    };
    
    this.isInitialized = false;
    this.monitoringInterval = null;
  }
  
  /**
   * Initialize the resource manager
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    if (!this.enabled) {
      this.isInitialized = true;
      return;
    }
    
    // Set up event listeners if event bus is available
    if (this.eventBus) {
      this.eventBus.on('resource:limit:updated', this._handleLimitUpdate.bind(this));
      this.eventBus.on('resource:usage:reported', this._handleUsageReport.bind(this));
    }
    
    // Start resource monitoring
    this._startMonitoring();
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'ResourceManager',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the resource manager
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Allocate resources for a strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} requirements - Resource requirements
   * @param {Object} options - Allocation options
   * @returns {Promise<Object>} Allocation result
   */
  async allocateResources(executionId, requirements = {}, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId) {
      return {
        success: true,
        reason: 'resource_management_disabled'
      };
    }
    
    try {
      // Check if resources are already allocated for this execution
      if (this.allocatedResources.has(executionId)) {
        return {
          success: false,
          reason: 'resources_already_allocated',
          executionId
        };
      }
      
      // Determine resource requirements
      const resourceRequirements = this._determineResourceRequirements(requirements);
      
      // Check if resources are available
      const availabilityResult = this._checkResourceAvailability(resourceRequirements);
      if (!availabilityResult.available) {
        return {
          success: false,
          reason: 'insufficient_resources',
          details: availabilityResult.details
        };
      }
      
      // Allocate resources
      const allocation = {
        id: executionId,
        requirements: resourceRequirements,
        allocated: Date.now(),
        priority: options.priority || 'normal',
        usage: {
          memory: 0,
          cpu: 0,
          network: 0,
          storage: 0,
          handles: 0
        }
      };
      
      // Update resource usage
      for (const [resource, amount] of Object.entries(resourceRequirements)) {
        if (this.resourceUsage[resource] !== undefined) {
          this.resourceUsage[resource] += amount;
        }
      }
      
      // Store allocation
      this.allocatedResources.set(executionId, allocation);
      
      // Emit allocation event
      if (this.eventBus) {
        this.eventBus.emit('resource:allocated', {
          executionId,
          requirements: resourceRequirements,
          timestamp: allocation.allocated
        });
      }
      
      return {
        success: true,
        allocation: {
          id: executionId,
          requirements: resourceRequirements,
          allocated: allocation.allocated
        }
      };
    } catch (error) {
      return {
        success: false,
        reason: 'allocation_error',
        error: error.message
      };
    }
  }
  
  /**
   * Release resources for a strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} options - Release options
   * @returns {Promise<Object>} Release result
   */
  async releaseResources(executionId, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId) {
      return {
        success: true,
        reason: 'resource_management_disabled'
      };
    }
    
    try {
      // Check if resources are allocated for this execution
      if (!this.allocatedResources.has(executionId)) {
        return {
          success: false,
          reason: 'resources_not_allocated',
          executionId
        };
      }
      
      // Get allocation
      const allocation = this.allocatedResources.get(executionId);
      
      // Update resource usage
      for (const [resource, amount] of Object.entries(allocation.requirements)) {
        if (this.resourceUsage[resource] !== undefined) {
          this.resourceUsage[resource] -= amount;
          
          // Ensure we don't go below zero
          if (this.resourceUsage[resource] < 0) {
            this.resourceUsage[resource] = 0;
          }
        }
      }
      
      // Remove allocation
      this.allocatedResources.delete(executionId);
      
      // Emit release event
      if (this.eventBus) {
        this.eventBus.emit('resource:released', {
          executionId,
          timestamp: Date.now()
        });
      }
      
      return {
        success: true,
        released: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        reason: 'release_error',
        error: error.message
      };
    }
  }
  
  /**
   * Update resource usage for a strategy execution
   * 
   * @param {string} executionId - Execution ID
   * @param {Object} usage - Resource usage
   * @returns {Promise<Object>} Update result
   */
  async updateResourceUsage(executionId, usage = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled || !executionId) {
      return {
        success: true,
        reason: 'resource_management_disabled'
      };
    }
    
    try {
      // Check if resources are allocated for this execution
      if (!this.allocatedResources.has(executionId)) {
        return {
          success: false,
          reason: 'resources_not_allocated',
          executionId
        };
      }
      
      // Get allocation
      const allocation = this.allocatedResources.get(executionId);
      
      // Update usage
      for (const [resource, amount] of Object.entries(usage)) {
        if (allocation.usage[resource] !== undefined) {
          allocation.usage[resource] = amount;
        }
      }
      
      // Check if usage exceeds allocation
      const exceedingResources = [];
      for (const [resource, amount] of Object.entries(allocation.usage)) {
        if (allocation.requirements[resource] !== undefined && 
            amount > allocation.requirements[resource]) {
          exceedingResources.push(resource);
        }
      }
      
      // Emit usage event
      if (this.eventBus) {
        this.eventBus.emit('resource:usage:updated', {
          executionId,
          usage: allocation.usage,
          exceeding: exceedingResources.length > 0,
          exceedingResources,
          timestamp: Date.now()
        });
      }
      
      return {
        success: true,
        usage: allocation.usage,
        exceeding: exceedingResources.length > 0,
        exceedingResources
      };
    } catch (error) {
      return {
        success: false,
        reason: 'update_error',
        error: error.message
      };
    }
  }
  
  /**
   * Check if resources are available for allocation
   * 
   * @param {Object} requirements - Resource requirements
   * @returns {Object} Availability result
   */
  async checkAvailability(requirements = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.enabled) {
      return {
        available: true,
        reason: 'resource_management_disabled'
      };
    }
    
    return this._checkResourceAvailability(
      this._determineResourceRequirements(requirements)
    );
  }
  
  /**
   * Get current resource usage
   * 
   * @returns {Object} Resource usage
   */
  async getResourceUsage() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return {
      ...this.resourceUsage,
      allocations: this.allocatedResources.size,
      timestamp: Date.now()
    };
  }
  
  /**
   * Handle resource limit update event
   * 
   * @param {Object} data - Limit update data
   * @private
   */
  _handleLimitUpdate(data) {
    if (!data || !data.limits) {
      return;
    }
    
    // Update resource limits
    for (const [resource, limit] of Object.entries(data.limits)) {
      if (this.resourceLimits[resource] !== undefined) {
        this.resourceLimits[resource] = limit;
      }
    }
  }
  
  /**
   * Handle resource usage report event
   * 
   * @param {Object} data - Usage report data
   * @private
   */
  _handleUsageReport(data) {
    if (!data || !data.executionId || !data.usage) {
      return;
    }
    
    // Update resource usage for the execution
    this.updateResourceUsage(data.executionId, data.usage);
  }
  
  /**
   * Start resource monitoring
   * @private
   */
  _startMonitoring() {
    // In a real implementation, this would start monitoring system resources
    // For now, we'll just set up a periodic check
    this.monitoringInterval = setInterval(() => {
      this._checkResourceUsage();
    }, 5000); // Check every 5 seconds
  }
  
  /**
   * Check current resource usage
   * @private
   */
  _checkResourceUsage() {
    // In a real implementation, this would check actual system resource usage
    // For now, we'll just simulate resource usage
    
    // Check if any allocations have exceeded their limits
    for (const [executionId, allocation] of this.allocatedResources.entries()) {
      const exceedingResources = [];
      
      for (const [resource, amount] of Object.entries(allocation.usage)) {
        if (allocation.requirements[resource] !== undefined && 
            amount > allocation.requirements[resource]) {
          exceedingResources.push(resource);
        }
      }
      
      if (exceedingResources.length > 0) {
        // Emit resource exceeded event
        if (this.eventBus) {
          this.eventBus.emit('resource:exceeded', {
            executionId,
            exceedingResources,
            timestamp: Date.now()
          });
        }
      }
    }
  }
  
  /**
   * Determine resource requirements based on input
   * 
   * @param {Object} requirements - Input requirements
   * @returns {Object} Normalized requirements
   * @private
   */
  _determineResourceRequirements(requirements) {
    const result = {};
    
    // Process each resource type
    for (const [resource, limit] of Object.entries(this.resourceLimits)) {
      // Use specified requirement or default to a percentage of the limit
      result[resource] = requirements[resource] !== undefined ? 
        requirements[resource] : (limit * 0.1); // Default to 10% of limit
      
      // Ensure requirement doesn't exceed limit
      if (result[resource] > limit) {
        result[resource] = limit;
      }
    }
    
    return result;
  }
  
  /**
   * Check if resources are available for allocation
   * 
   * @param {Object} requirements - Resource requirements
   * @returns {Object} Availability result
   * @private
   */
  _checkResourceAvailability(requirements) {
    const unavailableResources = [];
    
    // Check each resource type
    for (const [resource, amount] of Object.entries(requirements)) {
      if (this.resourceUsage[resource] !== undefined && 
          this.resourceLimits[resource] !== undefined) {
        
        // Calculate available amount
        const available = this.resourceLimits[resource] - this.resourceUsage[resource];
        
        // Check if enough is available
        if (amount > available) {
          unavailableResources.push({
            resource,
            required: amount,
            available,
            deficit: amount - available
          });
        }
      }
    }
    
    if (unavailableResources.length > 0) {
      return {
        available: false,
        details: unavailableResources
      };
    }
    
    return {
      available: true
    };
  }
  
  /**
   * Dispose resources used by this manager
   */
  async dispose() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.eventBus) {
      this.eventBus.removeAllListeners('resource:limit:updated');
      this.eventBus.removeAllListeners('resource:usage:reported');
    }
    
    this.allocatedResources.clear();
  }
}

module.exports = ResourceManager;
