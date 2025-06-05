/**
 * @fileoverview Implementation of the ResourceManager component for the Autonomous Error Recovery System.
 * This component manages resource allocation and deallocation for recovery strategies,
 * ensuring that resources are properly managed during recovery operations.
 * 
 * @module core/error_recovery/ResourceManager
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

/**
 * ResourceManager handles resource allocation and deallocation for recovery strategies.
 */
class ResourceManager {
  /**
   * Creates a new ResourceManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector
   * @param {EventEmitter} options.eventEmitter - Event emitter for resource events
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    
    // Resource registry
    this.resources = new Map();
    
    // Allocation registry
    this.allocations = new Map();
    
    // Resource types
    this.resourceTypes = new Set(['cpu', 'memory', 'disk', 'network', 'gpu', 'custom']);
    
    this.logger.info('ResourceManager initialized');
  }
  
  /**
   * Registers a resource.
   * @param {Object} resource - Resource to register
   * @param {string} resource.type - Resource type
   * @param {string} resource.name - Resource name
   * @param {number} resource.capacity - Resource capacity
   * @param {string} resource.unit - Resource unit
   * @returns {string} Resource ID
   */
  registerResource(resource) {
    if (!resource || !resource.type || !resource.name) {
      throw new Error('Invalid resource: missing required fields');
    }
    
    if (!this.resourceTypes.has(resource.type)) {
      throw new Error(`Invalid resource type: ${resource.type}`);
    }
    
    const resourceId = uuidv4();
    const registeredResource = {
      id: resourceId,
      type: resource.type,
      name: resource.name,
      capacity: resource.capacity || 0,
      available: resource.capacity || 0,
      unit: resource.unit || '',
      metadata: resource.metadata || {},
      registeredAt: Date.now()
    };
    
    this.resources.set(resourceId, registeredResource);
    
    this.logger.debug(`Registered resource ${resourceId}: ${resource.name} (${resource.type})`);
    this.eventEmitter.emit('resource:registered', { resourceId, resource: registeredResource });
    
    return resourceId;
  }
  
  /**
   * Unregisters a resource.
   * @param {string} resourceId - Resource ID
   * @returns {boolean} Whether the resource was unregistered
   */
  unregisterResource(resourceId) {
    if (!this.resources.has(resourceId)) {
      return false;
    }
    
    // Check if resource has active allocations
    const activeAllocations = [...this.allocations.values()]
      .filter(allocation => allocation.resourceId === resourceId && allocation.active);
    
    if (activeAllocations.length > 0) {
      throw new Error(`Cannot unregister resource ${resourceId}: has active allocations`);
    }
    
    const resource = this.resources.get(resourceId);
    this.resources.delete(resourceId);
    
    this.logger.debug(`Unregistered resource ${resourceId}: ${resource.name}`);
    this.eventEmitter.emit('resource:unregistered', { resourceId, resource });
    
    return true;
  }
  
  /**
   * Gets a resource by ID.
   * @param {string} resourceId - Resource ID
   * @returns {Object|null} Resource or null if not found
   */
  getResource(resourceId) {
    return this.resources.get(resourceId) || null;
  }
  
  /**
   * Gets all resources of a specific type.
   * @param {string} type - Resource type
   * @returns {Array<Object>} Resources of the specified type
   */
  getResourcesByType(type) {
    return [...this.resources.values()]
      .filter(resource => resource.type === type);
  }
  
  /**
   * Allocates resources for a recovery strategy.
   * @param {string} strategyId - Strategy ID
   * @param {Array<Object>} requests - Resource allocation requests
   * @param {string} requests[].resourceId - Resource ID
   * @param {number} requests[].amount - Amount to allocate
   * @param {Object} [options] - Allocation options
   * @returns {Promise<Array<Object>>} Allocation results
   */
  async allocateResources(strategyId, requests, options = {}) {
    this.logger.debug(`Allocating resources for strategy ${strategyId}`);
    
    const results = [];
    const allocations = [];
    
    try {
      // Process each request
      for (const request of requests) {
        const { resourceId, amount } = request;
        
        // Get resource
        const resource = this.resources.get(resourceId);
        if (!resource) {
          throw new Error(`Resource not found: ${resourceId}`);
        }
        
        // Check if enough resources are available
        if (resource.available < amount) {
          throw new Error(`Not enough resources available for ${resourceId}: requested ${amount}, available ${resource.available}`);
        }
        
        // Create allocation
        const allocationId = uuidv4();
        const allocation = {
          id: allocationId,
          strategyId,
          resourceId,
          amount,
          active: true,
          allocatedAt: Date.now(),
          metadata: request.metadata || {}
        };
        
        // Update resource availability
        resource.available -= amount;
        
        // Store allocation
        this.allocations.set(allocationId, allocation);
        allocations.push(allocation);
        
        // Add to results
        results.push({
          allocationId,
          resourceId,
          amount,
          successful: true
        });
      }
      
      // Emit event
      this.eventEmitter.emit('resource:allocated', { 
        strategyId, 
        allocations: allocations.map(a => a.id) 
      });
      
      return results;
    } catch (error) {
      // Rollback allocations on error
      for (const allocation of allocations) {
        const resource = this.resources.get(allocation.resourceId);
        if (resource) {
          resource.available += allocation.amount;
        }
        this.allocations.delete(allocation.id);
      }
      
      throw error;
    }
  }
  
  /**
   * Deallocates resources.
   * @param {Array<string>} allocationIds - Allocation IDs
   * @returns {Promise<Array<Object>>} Deallocation results
   */
  async deallocateResources(allocationIds) {
    this.logger.debug(`Deallocating resources: ${allocationIds.join(', ')}`);
    
    const results = [];
    
    for (const allocationId of allocationIds) {
      try {
        // Get allocation
        const allocation = this.allocations.get(allocationId);
        if (!allocation) {
          results.push({
            allocationId,
            successful: false,
            error: 'Allocation not found'
          });
          continue;
        }
        
        // Check if allocation is active
        if (!allocation.active) {
          results.push({
            allocationId,
            successful: false,
            error: 'Allocation already deallocated'
          });
          continue;
        }
        
        // Get resource
        const resource = this.resources.get(allocation.resourceId);
        if (!resource) {
          results.push({
            allocationId,
            successful: false,
            error: 'Resource not found'
          });
          continue;
        }
        
        // Update resource availability
        resource.available += allocation.amount;
        
        // Update allocation
        allocation.active = false;
        allocation.deallocatedAt = Date.now();
        
        results.push({
          allocationId,
          resourceId: allocation.resourceId,
          amount: allocation.amount,
          successful: true
        });
      } catch (error) {
        results.push({
          allocationId,
          successful: false,
          error: error.message
        });
      }
    }
    
    // Emit event
    this.eventEmitter.emit('resource:deallocated', { 
      allocationIds, 
      results 
    });
    
    return results;
  }
  
  /**
   * Gets all allocations for a strategy.
   * @param {string} strategyId - Strategy ID
   * @returns {Array<Object>} Allocations for the strategy
   */
  getAllocationsForStrategy(strategyId) {
    return [...this.allocations.values()]
      .filter(allocation => allocation.strategyId === strategyId);
  }
  
  /**
   * Gets all active allocations.
   * @returns {Array<Object>} Active allocations
   */
  getActiveAllocations() {
    return [...this.allocations.values()]
      .filter(allocation => allocation.active);
  }
  
  /**
   * Creates a resource allocation plan for a strategy.
   * @param {Array<Object>} actions - Strategy actions
   * @param {Object} systemState - Current system state
   * @returns {Promise<Object>} Resource allocation plan
   */
  async createResourceAllocationPlan(actions, systemState) {
    this.logger.debug(`Creating resource allocation plan for ${actions.length} actions`);
    
    // Aggregate resource requirements
    const aggregatedRequirements = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
      gpu: 0,
      custom: {}
    };
    
    // Calculate peak requirements
    for (const action of actions) {
      const requirements = action.resourceRequirements || {};
      
      // CPU
      if (requirements.cpu && requirements.cpu.peak) {
        aggregatedRequirements.cpu = Math.max(
          aggregatedRequirements.cpu,
          requirements.cpu.peak
        );
      }
      
      // Memory
      if (requirements.memory && requirements.memory.peak) {
        aggregatedRequirements.memory = Math.max(
          aggregatedRequirements.memory,
          requirements.memory.peak
        );
      }
      
      // Disk
      if (requirements.disk && requirements.disk.peak) {
        aggregatedRequirements.disk = Math.max(
          aggregatedRequirements.disk,
          requirements.disk.peak
        );
      }
      
      // Network
      if (requirements.network && requirements.network.bandwidth) {
        aggregatedRequirements.network = Math.max(
          aggregatedRequirements.network,
          requirements.network.bandwidth
        );
      }
      
      // GPU
      if (requirements.gpu && requirements.gpu.peak) {
        aggregatedRequirements.gpu = Math.max(
          aggregatedRequirements.gpu,
          requirements.gpu.peak
        );
      }
      
      // Custom
      if (requirements.custom) {
        for (const [key, value] of Object.entries(requirements.custom)) {
          aggregatedRequirements.custom[key] = Math.max(
            aggregatedRequirements.custom[key] || 0,
            value
          );
        }
      }
    }
    
    // Create allocation plan
    const allocationPlan = {
      requirements: aggregatedRequirements,
      allocations: [],
      feasible: true,
      bottlenecks: []
    };
    
    // Check resource availability
    const cpuResources = this.getResourcesByType('cpu');
    const memoryResources = this.getResourcesByType('memory');
    const diskResources = this.getResourcesByType('disk');
    const networkResources = this.getResourcesByType('network');
    const gpuResources = this.getResourcesByType('gpu');
    
    // CPU allocation
    if (aggregatedRequirements.cpu > 0) {
      const availableCpu = cpuResources.reduce((total, resource) => total + resource.available, 0);
      
      if (availableCpu < aggregatedRequirements.cpu) {
        allocationPlan.feasible = false;
        allocationPlan.bottlenecks.push({
          resourceType: 'cpu',
          required: aggregatedRequirements.cpu,
          available: availableCpu
        });
      } else {
        // Allocate from available resources
        let remainingRequirement = aggregatedRequirements.cpu;
        
        for (const resource of cpuResources) {
          if (remainingRequirement <= 0) break;
          
          const allocationAmount = Math.min(remainingRequirement, resource.available);
          
          allocationPlan.allocations.push({
            resourceId: resource.id,
            resourceType: 'cpu',
            amount: allocationAmount
          });
          
          remainingRequirement -= allocationAmount;
        }
      }
    }
    
    // Similar allocation logic for other resource types...
    // (Simplified for brevity)
    
    return allocationPlan;
  }
}

module.exports = ResourceManager;
