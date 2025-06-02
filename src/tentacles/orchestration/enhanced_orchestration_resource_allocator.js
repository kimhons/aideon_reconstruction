/**
 * Enhanced Orchestration Tentacle - Dynamic Resource Allocator
 * 
 * This file implements the Dynamic Resource Allocator component as specified in the
 * Enhanced Orchestration Tentacle architecture and interfaces.
 */

const { EOTComponent } = require('./enhanced_orchestration_foundation');

/**
 * Dynamic Resource Allocator
 * 
 * Responsible for allocating and managing computational resources across agents and tasks.
 * Features predictive scaling, multi-objective optimization, and adaptive resource management.
 */
class DynamicResourceAllocator extends EOTComponent {
  constructor(config = {}) {
    super('DynamicResourceAllocator', config);
    this.allocations = new Map();
    this.resourceLimits = config.resourceLimits || {
      cpu: 4,
      memory: 4 * 1024 * 1024 * 1024, // 4 GB
      gpu: 1,
      networkBandwidth: 100 // Mbps
    };
    this.currentUsage = {
      cpu: 0,
      memory: 0,
      gpu: 0,
      networkBandwidth: 0
    };
    this.allocationStrategies = new Map();
    this.resourcePredictor = null;
    this.optimizationEngine = null;
  }

  async initialize(dependencies) {
    try {
      // Extract dependencies
      this.eventBus = dependencies.eventBus;
      
      // Initialize resource predictor
      this.resourcePredictor = new ResourcePredictor(this.config.prediction || {});
      await this.resourcePredictor.initialize();
      
      // Initialize optimization engine
      this.optimizationEngine = new ResourceOptimizationEngine(this.config.optimization || {});
      await this.optimizationEngine.initialize();
      
      // Register allocation strategies
      await this.registerAllocationStrategies();
      
      // Subscribe to relevant events
      if (this.eventBus) {
        this.eventBus.subscribe('eot:resource:allocation_request', this.handleAllocationRequest.bind(this), this.id);
        this.eventBus.subscribe('eot:resource:release_request', this.handleReleaseRequest.bind(this), this.id);
        this.eventBus.subscribe('eot:task:decomposed', this.handleTaskDecomposed.bind(this), this.id);
      }
      
      // Start resource monitoring
      this.startMonitoring();
      
      this.logger.info('Dynamic Resource Allocator initialized');
      return await super.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize Dynamic Resource Allocator:', error);
      return false;
    }
  }

  /**
   * Register available allocation strategies
   */
  async registerAllocationStrategies() {
    // Register default strategies
    this.allocationStrategies.set('priority_based', new PriorityBasedAllocationStrategy());
    this.allocationStrategies.set('fair_share', new FairShareAllocationStrategy());
    this.allocationStrategies.set('deadline_aware', new DeadlineAwareAllocationStrategy());
    
    // Register advanced strategies if configured
    if (this.config.enableAdvancedStrategies) {
      this.allocationStrategies.set('predictive', new PredictiveAllocationStrategy());
      this.allocationStrategies.set('multi_objective', new MultiObjectiveAllocationStrategy());
    }
    
    this.logger.info(`Registered ${this.allocationStrategies.size} allocation strategies`);
  }

  /**
   * Start resource monitoring
   */
  startMonitoring() {
    const interval = this.config.monitoringInterval || 5000; // Default: 5 seconds
    
    this.monitoringInterval = setInterval(() => {
      this.updateResourceUsage();
    }, interval);
    
    this.logger.info(`Resource monitoring started (interval: ${interval}ms)`);
  }

  /**
   * Update current resource usage
   */
  async updateResourceUsage() {
    try {
      // Reset usage counters
      this.currentUsage = {
        cpu: 0,
        memory: 0,
        gpu: 0,
        networkBandwidth: 0
      };
      
      // Sum up all active allocations
      for (const allocation of this.allocations.values()) {
        if (allocation.status === 'active') {
          this.currentUsage.cpu += allocation.resources.cpu || 0;
          this.currentUsage.memory += allocation.resources.memory || 0;
          this.currentUsage.gpu += allocation.resources.gpu || 0;
          this.currentUsage.networkBandwidth += allocation.resources.networkBandwidth || 0;
        }
      }
      
      // Calculate utilization percentages
      const utilization = {
        cpu: this.resourceLimits.cpu > 0 ? (this.currentUsage.cpu / this.resourceLimits.cpu) * 100 : 0,
        memory: this.resourceLimits.memory > 0 ? (this.currentUsage.memory / this.resourceLimits.memory) * 100 : 0,
        gpu: this.resourceLimits.gpu > 0 ? (this.currentUsage.gpu / this.resourceLimits.gpu) * 100 : 0,
        networkBandwidth: this.resourceLimits.networkBandwidth > 0 ? 
          (this.currentUsage.networkBandwidth / this.resourceLimits.networkBandwidth) * 100 : 0
      };
      
      // Log current usage if significant changes
      this.logger.debug(`Resource utilization: CPU ${utilization.cpu.toFixed(1)}%, Memory ${utilization.memory.toFixed(1)}%, GPU ${utilization.gpu.toFixed(1)}%, Network ${utilization.networkBandwidth.toFixed(1)}%`);
      
      // Publish resource usage update event
      if (this.eventBus) {
        await this.eventBus.publish('eot:resource:usage_update', {
          usage: this.currentUsage,
          limits: this.resourceLimits,
          utilization,
          timestamp: Date.now()
        }, this.id);
      }
      
      // Check for resource pressure and trigger optimization if needed
      if (this.shouldOptimizeResources(utilization)) {
        await this.optimizeResourceAllocations();
      }
    } catch (error) {
      this.logger.error('Error updating resource usage:', error);
    }
  }

  /**
   * Determine if resource optimization is needed
   */
  shouldOptimizeResources(utilization) {
    // Check if any resource is above high threshold
    const highThreshold = this.config.highUtilizationThreshold || 80;
    
    return utilization.cpu > highThreshold ||
           utilization.memory > highThreshold ||
           utilization.gpu > highThreshold ||
           utilization.networkBandwidth > highThreshold;
  }

  /**
   * Optimize resource allocations
   */
  async optimizeResourceAllocations() {
    this.logger.info('Optimizing resource allocations');
    
    try {
      // Get all active allocations
      const activeAllocations = Array.from(this.allocations.values())
        .filter(allocation => allocation.status === 'active');
      
      if (activeAllocations.length === 0) {
        this.logger.debug('No active allocations to optimize');
        return;
      }
      
      // Use optimization engine to rebalance resources
      const optimizationResult = await this.optimizationEngine.optimizeAllocations(
        activeAllocations,
        this.resourceLimits,
        this.currentUsage
      );
      
      // Apply optimization results
      for (const update of optimizationResult.updates) {
        const allocation = this.allocations.get(update.allocationId);
        
        if (allocation) {
          // Store previous resources for event
          const previousResources = { ...allocation.resources };
          
          // Update allocation
          allocation.resources = update.newResources;
          allocation.lastUpdated = Date.now();
          
          // Notify about the change
          if (this.eventBus) {
            await this.eventBus.publish('eot:resource:allocation_updated', {
              allocationId: update.allocationId,
              requesterId: allocation.requesterId,
              previousResources,
              newResources: update.newResources,
              reason: 'optimization',
              timestamp: Date.now()
            }, this.id);
          }
          
          this.logger.info(`Optimized allocation ${update.allocationId} for ${allocation.requesterId}`);
        }
      }
      
      this.logger.info(`Resource optimization completed: ${optimizationResult.updates.length} allocations updated`);
    } catch (error) {
      this.logger.error('Error optimizing resource allocations:', error);
    }
  }

  /**
   * Handle allocation request event
   */
  async handleAllocationRequest(request) {
    try {
      this.logger.info(`Received allocation request from ${request.requesterId}`);
      const result = await this.requestAllocation(request);
      await this.eventBus.publish('eot:resource:allocated', result, this.id);
    } catch (error) {
      this.logger.error(`Error processing allocation request from ${request.requesterId}:`, error);
      await this.eventBus.publish('eot:resource:allocation_failed', {
        requesterId: request.requesterId,
        requirements: request.requirements,
        error: error.message,
        timestamp: Date.now()
      }, this.id);
    }
  }

  /**
   * Handle release request event
   */
  async handleReleaseRequest(request) {
    try {
      this.logger.info(`Received release request for allocation ${request.allocationId}`);
      await this.releaseAllocation(request.allocationId);
      await this.eventBus.publish('eot:resource:released', {
        allocationId: request.allocationId,
        timestamp: Date.now()
      }, this.id);
    } catch (error) {
      this.logger.error(`Error processing release request for ${request.allocationId}:`, error);
      await this.eventBus.publish('eot:resource:release_failed', {
        allocationId: request.allocationId,
        error: error.message,
        timestamp: Date.now()
      }, this.id);
    }
  }

  /**
   * Handle task decomposed event
   */
  async handleTaskDecomposed(decompositionResult) {
    try {
      this.logger.info(`Received task decomposition for goal: ${decompositionResult.goalId}`);
      
      // Pre-allocate resources for the decomposed tasks if configured
      if (this.config.enablePreallocation) {
        await this.preallocateResourcesForTasks(decompositionResult);
      }
    } catch (error) {
      this.logger.error(`Error handling task decomposition for goal ${decompositionResult.goalId}:`, error);
    }
  }

  /**
   * Pre-allocate resources for decomposed tasks
   */
  async preallocateResourcesForTasks(decompositionResult) {
    // This would be implemented in a real system to reserve resources
    // for upcoming tasks based on the decomposition
    this.logger.info(`Pre-allocation for goal ${decompositionResult.goalId} not implemented yet`);
  }

  /**
   * Requests resource allocation for a task or agent
   * @param {Object} request - Allocation request
   * @returns {Promise<Object>} - Allocation result
   */
  async requestAllocation(request) {
    // Validate request
    if (!request.requesterId || !request.requirements) {
      throw new Error('Invalid allocation request: must contain requesterId and requirements');
    }
    
    // Generate allocation ID
    const allocationId = `alloc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Select allocation strategy
    const strategyName = request.strategy || 'priority_based';
    const strategy = this.allocationStrategies.get(strategyName);
    
    if (!strategy) {
      throw new Error(`Unknown allocation strategy: ${strategyName}`);
    }
    
    // Check resource availability
    const availableResources = this.getAvailableResources();
    
    // Use strategy to determine allocation
    const allocationResult = await strategy.allocate(
      request,
      availableResources,
      this.resourceLimits,
      this.allocations
    );
    
    if (!allocationResult.success) {
      throw new Error(`Resource allocation failed: ${allocationResult.reason}`);
    }
    
    // Create allocation record
    const allocation = {
      id: allocationId,
      requesterId: request.requesterId,
      resources: allocationResult.resources,
      priority: request.priority || 0,
      status: 'active',
      created: Date.now(),
      lastUpdated: Date.now(),
      expiresAt: request.durationHint ? Date.now() + (request.durationHint * 1000) : null
    };
    
    // Store allocation
    this.allocations.set(allocationId, allocation);
    
    // Update current usage
    this.currentUsage.cpu += allocation.resources.cpu || 0;
    this.currentUsage.memory += allocation.resources.memory || 0;
    this.currentUsage.gpu += allocation.resources.gpu || 0;
    this.currentUsage.networkBandwidth += allocation.resources.networkBandwidth || 0;
    
    this.logger.info(`Allocated resources for ${request.requesterId}: CPU ${allocation.resources.cpu}, Memory ${allocation.resources.memory}, GPU ${allocation.resources.gpu || 0}`);
    
    // Return allocation result
    return {
      allocationId,
      requesterId: request.requesterId,
      resources: allocation.resources,
      status: 'active',
      timestamp: Date.now()
    };
  }

  /**
   * Releases previously allocated resources
   * @param {string} allocationId - ID of the allocation to release
   * @returns {Promise<void>}
   */
  async releaseAllocation(allocationId) {
    // Check if allocation exists
    if (!this.allocations.has(allocationId)) {
      throw new Error(`Allocation ${allocationId} not found`);
    }
    
    const allocation = this.allocations.get(allocationId);
    
    // Only update if allocation is active
    if (allocation.status === 'active') {
      // Update current usage
      this.currentUsage.cpu -= allocation.resources.cpu || 0;
      this.currentUsage.memory -= allocation.resources.memory || 0;
      this.currentUsage.gpu -= allocation.resources.gpu || 0;
      this.currentUsage.networkBandwidth -= allocation.resources.networkBandwidth || 0;
      
      // Ensure usage doesn't go negative due to rounding errors
      this.currentUsage.cpu = Math.max(0, this.currentUsage.cpu);
      this.currentUsage.memory = Math.max(0, this.currentUsage.memory);
      this.currentUsage.gpu = Math.max(0, this.currentUsage.gpu);
      this.currentUsage.networkBandwidth = Math.max(0, this.currentUsage.networkBandwidth);
      
      // Update allocation status
      allocation.status = 'released';
      allocation.lastUpdated = Date.now();
      
      this.logger.info(`Released allocation ${allocationId} for ${allocation.requesterId}`);
    } else {
      this.logger.warn(`Allocation ${allocationId} already in state: ${allocation.status}`);
    }
  }

  /**
   * Retrieves current resource availability
   * @returns {Promise<Object>} - Available resources
   */
  async getResourceAvailability() {
    const available = {
      cpu: Math.max(0, this.resourceLimits.cpu - this.currentUsage.cpu),
      memory: Math.max(0, this.resourceLimits.memory - this.currentUsage.memory),
      gpu: Math.max(0, this.resourceLimits.gpu - this.currentUsage.gpu),
      networkBandwidth: Math.max(0, this.resourceLimits.networkBandwidth - this.currentUsage.networkBandwidth)
    };
    
    // Calculate utilization percentages
    const utilization = {
      cpu: this.resourceLimits.cpu > 0 ? (this.currentUsage.cpu / this.resourceLimits.cpu) * 100 : 0,
      memory: this.resourceLimits.memory > 0 ? (this.currentUsage.memory / this.resourceLimits.memory) * 100 : 0,
      gpu: this.resourceLimits.gpu > 0 ? (this.currentUsage.gpu / this.resourceLimits.gpu) * 100 : 0,
      networkBandwidth: this.resourceLimits.networkBandwidth > 0 ? 
        (this.currentUsage.networkBandwidth / this.resourceLimits.networkBandwidth) * 100 : 0
    };
    
    return {
      available,
      total: this.resourceLimits,
      used: this.currentUsage,
      utilization,
      timestamp: Date.now()
    };
  }

  /**
   * Get available resources
   */
  getAvailableResources() {
    return {
      cpu: Math.max(0, this.resourceLimits.cpu - this.currentUsage.cpu),
      memory: Math.max(0, this.resourceLimits.memory - this.currentUsage.memory),
      gpu: Math.max(0, this.resourceLimits.gpu - this.currentUsage.gpu),
      networkBandwidth: Math.max(0, this.resourceLimits.networkBandwidth - this.currentUsage.networkBandwidth)
    };
  }

  /**
   * Update resource limits
   * @param {Object} newLimits - New resource limits
   * @returns {Promise<void>}
   */
  async updateResourceLimits(newLimits) {
    // Validate new limits
    if (!newLimits) {
      throw new Error('New limits must be provided');
    }
    
    // Update limits
    if (newLimits.cpu !== undefined) this.resourceLimits.cpu = newLimits.cpu;
    if (newLimits.memory !== undefined) this.resourceLimits.memory = newLimits.memory;
    if (newLimits.gpu !== undefined) this.resourceLimits.gpu = newLimits.gpu;
    if (newLimits.networkBandwidth !== undefined) this.resourceLimits.networkBandwidth = newLimits.networkBandwidth;
    
    this.logger.info(`Resource limits updated: CPU ${this.resourceLimits.cpu}, Memory ${this.resourceLimits.memory}, GPU ${this.resourceLimits.gpu}, Network ${this.resourceLimits.networkBandwidth}`);
    
    // Check if we need to optimize allocations due to limit changes
    if (this.currentUsage.cpu > this.resourceLimits.cpu ||
        this.currentUsage.memory > this.resourceLimits.memory ||
        this.currentUsage.gpu > this.resourceLimits.gpu ||
        this.currentUsage.networkBandwidth > this.resourceLimits.networkBandwidth) {
      
      this.logger.warn('Current usage exceeds new limits, triggering optimization');
      await this.optimizeResourceAllocations();
    }
  }

  async shutdown() {
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('eot:resource:allocation_request', this.id);
      this.eventBus.unsubscribe('eot:resource:release_request', this.id);
      this.eventBus.unsubscribe('eot:task:decomposed', this.id);
    }
    
    // Release all active allocations
    for (const [allocationId, allocation] of this.allocations.entries()) {
      if (allocation.status === 'active') {
        try {
          await this.releaseAllocation(allocationId);
        } catch (error) {
          this.logger.error(`Error releasing allocation ${allocationId} during shutdown:`, error);
        }
      }
    }
    
    this.logger.info('Dynamic Resource Allocator shutdown');
    return await super.shutdown();
  }
}

/**
 * Resource Predictor
 * 
 * Predicts future resource needs based on historical data and task characteristics
 */
class ResourcePredictor {
  constructor(config = {}) {
    this.config = config;
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('ResourcePredictor');
    this.historyWindow = config.historyWindow || 100; // Number of data points to keep
    this.historyData = [];
    this.models = new Map();
  }

  async initialize() {
    // Initialize prediction models
    this.models.set('cpu', { weights: [0.5, 0.3, 0.2], bias: 0.1 });
    this.models.set('memory', { weights: [0.6, 0.3, 0.1], bias: 0.2 });
    this.models.set('gpu', { weights: [0.7, 0.2, 0.1], bias: 0.05 });
    this.models.set('networkBandwidth', { weights: [0.4, 0.4, 0.2], bias: 0.1 });
    
    this.logger.info('Resource Predictor initialized');
    return true;
  }

  /**
   * Add a data point to the history
   * @param {Object} dataPoint - Resource usage data point
   */
  addDataPoint(dataPoint) {
    this.historyData.push({
      ...dataPoint,
      timestamp: Date.now()
    });
    
    // Trim history if needed
    if (this.historyData.length > this.historyWindow) {
      this.historyData.shift();
    }
  }

  /**
   * Predict future resource needs
   * @param {Object} task - Task to predict for
   * @param {number} timeHorizon - Time horizon in seconds
   * @returns {Promise<Object>} - Predicted resource needs
   */
  async predictResourceNeeds(task, timeHorizon = 60) {
    // In a real implementation, this would use sophisticated ML models
    // Here we use a simple linear model for demonstration
    
    // Extract features
    const features = this.extractTaskFeatures(task);
    
    // Make predictions for each resource type
    const predictions = {};
    
    for (const [resourceType, model] of this.models.entries()) {
      // Simple linear model: prediction = sum(feature_i * weight_i) + bias
      let prediction = model.bias;
      
      for (let i = 0; i < features.length && i < model.weights.length; i++) {
        prediction += features[i] * model.weights[i];
      }
      
      // Scale by time horizon (simple linear scaling)
      prediction *= (timeHorizon / 60); // Normalize to per-minute
      
      predictions[resourceType] = prediction;
    }
    
    return predictions;
  }

  /**
   * Extract features from a task for prediction
   * @param {Object} task - Task to extract features from
   * @returns {number[]} - Feature vector
   */
  extractTaskFeatures(task) {
    // Simple feature extraction
    const features = [
      task.estimatedDuration || 60, // Duration in seconds
      task.requiredCapabilities ? task.requiredCapabilities.length : 0, // Number of capabilities
      task.resourceNeeds ? (task.resourceNeeds.cpu || 0.1) : 0.1 // Base CPU needs
    ];
    
    // Normalize features
    features[0] = features[0] / 3600; // Normalize duration to hours
    features[1] = features[1] / 10; // Normalize capabilities count
    
    return features;
  }
}

/**
 * Resource Optimization Engine
 * 
 * Optimizes resource allocations based on priorities and constraints
 */
class ResourceOptimizationEngine {
  constructor(config = {}) {
    this.config = config;
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('ResourceOptimizationEngine');
  }

  async initialize() {
    this.logger.info('Resource Optimization Engine initialized');
    return true;
  }

  /**
   * Optimize resource allocations
   * @param {Object[]} activeAllocations - Currently active allocations
   * @param {Object} resourceLimits - Total resource limits
   * @param {Object} currentUsage - Current resource usage
   * @returns {Promise<Object>} - Optimization result
   */
  async optimizeAllocations(activeAllocations, resourceLimits, currentUsage) {
    this.logger.info(`Optimizing ${activeAllocations.length} allocations`);
    
    // Sort allocations by priority (descending)
    const sortedAllocations = [...activeAllocations].sort((a, b) => b.priority - a.priority);
    
    // Calculate total requested resources
    const totalRequested = {
      cpu: 0,
      memory: 0,
      gpu: 0,
      networkBandwidth: 0
    };
    
    for (const allocation of sortedAllocations) {
      totalRequested.cpu += allocation.resources.cpu || 0;
      totalRequested.memory += allocation.resources.memory || 0;
      totalRequested.gpu += allocation.resources.gpu || 0;
      totalRequested.networkBandwidth += allocation.resources.networkBandwidth || 0;
    }
    
    // Check if we need to scale down
    const updates = [];
    const resourceTypes = ['cpu', 'memory', 'gpu', 'networkBandwidth'];
    
    for (const resourceType of resourceTypes) {
      if (currentUsage[resourceType] > resourceLimits[resourceType]) {
        // Need to scale down this resource
        const scaleFactor = resourceLimits[resourceType] / currentUsage[resourceType];
        
        this.logger.info(`Need to scale down ${resourceType} by factor ${scaleFactor.toFixed(2)}`);
        
        // Apply scaling to allocations based on priority
        for (const allocation of sortedAllocations) {
          // Skip high-priority allocations if possible
          if (allocation.priority > 8 && sortedAllocations.length > 1) {
            continue;
          }
          
          if (allocation.resources[resourceType]) {
            const newValue = allocation.resources[resourceType] * scaleFactor;
            
            // Create update if significant change
            if (Math.abs(newValue - allocation.resources[resourceType]) > 0.01) {
              const update = updates.find(u => u.allocationId === allocation.id);
              
              if (update) {
                // Update existing update
                update.newResources[resourceType] = newValue;
              } else {
                // Create new update
                updates.push({
                  allocationId: allocation.id,
                  newResources: {
                    ...allocation.resources,
                    [resourceType]: newValue
                  }
                });
              }
            }
          }
        }
      }
    }
    
    return {
      updates,
      timestamp: Date.now()
    };
  }
}

/**
 * Base class for allocation strategies
 */
class AllocationStrategy {
  constructor() {
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('AllocationStrategy');
  }
  
  async allocate(request, availableResources, resourceLimits, currentAllocations) {
    throw new Error('Method not implemented');
  }
}

/**
 * Priority-Based Allocation Strategy
 */
class PriorityBasedAllocationStrategy extends AllocationStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('PriorityStrategy');
  }
  
  async allocate(request, availableResources, resourceLimits, currentAllocations) {
    this.logger.info(`Allocating resources for ${request.requesterId} using priority-based strategy`);
    
    // Check if we have enough resources
    const requirements = request.requirements;
    const strict = request.allocationMode === 'strict';
    
    // Check each resource type
    for (const resourceType of ['cpu', 'memory', 'gpu', 'networkBandwidth']) {
      const required = requirements[resourceType] || 0;
      const available = availableResources[resourceType] || 0;
      
      if (required > available) {
        if (strict) {
          // In strict mode, fail if we don't have enough resources
          return {
            success: false,
            reason: `Not enough ${resourceType} available (required: ${required}, available: ${available})`
          };
        } else {
          // In non-strict mode, allocate what we can
          requirements[resourceType] = available;
        }
      }
    }
    
    return {
      success: true,
      resources: requirements
    };
  }
}

/**
 * Fair Share Allocation Strategy
 */
class FairShareAllocationStrategy extends AllocationStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('FairShareStrategy');
  }
  
  async allocate(request, availableResources, resourceLimits, currentAllocations) {
    this.logger.info(`Allocating resources for ${request.requesterId} using fair-share strategy`);
    
    // Count active allocations per requester
    const requesterCounts = new Map();
    
    for (const allocation of currentAllocations.values()) {
      if (allocation.status === 'active') {
        const count = requesterCounts.get(allocation.requesterId) || 0;
        requesterCounts.set(allocation.requesterId, count + 1);
      }
    }
    
    // Get count for current requester
    const requesterCount = requesterCounts.get(request.requesterId) || 0;
    
    // Calculate fair share factor (1.0 for first allocation, decreases with more allocations)
    const fairShareFactor = 1.0 / (requesterCount + 1);
    
    // Apply fair share to requested resources
    const requirements = { ...request.requirements };
    const strict = request.allocationMode === 'strict';
    
    // Check each resource type
    for (const resourceType of ['cpu', 'memory', 'gpu', 'networkBandwidth']) {
      const required = requirements[resourceType] || 0;
      
      // Apply fair share factor if this isn't the first allocation
      const adjustedRequired = requesterCount > 0 ? required * fairShareFactor : required;
      
      // Check against available resources
      const available = availableResources[resourceType] || 0;
      
      if (adjustedRequired > available) {
        if (strict) {
          // In strict mode, fail if we don't have enough resources
          return {
            success: false,
            reason: `Not enough ${resourceType} available (required: ${adjustedRequired}, available: ${available})`
          };
        } else {
          // In non-strict mode, allocate what we can
          requirements[resourceType] = available;
        }
      } else {
        // Allocate adjusted amount
        requirements[resourceType] = adjustedRequired;
      }
    }
    
    return {
      success: true,
      resources: requirements
    };
  }
}

/**
 * Deadline-Aware Allocation Strategy
 */
class DeadlineAwareAllocationStrategy extends AllocationStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('DeadlineAwareStrategy');
  }
  
  async allocate(request, availableResources, resourceLimits, currentAllocations) {
    this.logger.info(`Allocating resources for ${request.requesterId} using deadline-aware strategy`);
    
    // Calculate urgency factor based on deadline
    let urgencyFactor = 1.0;
    
    if (request.deadline) {
      const now = Date.now();
      const deadline = new Date(request.deadline).getTime();
      const timeRemaining = deadline - now;
      
      if (timeRemaining <= 0) {
        // Past deadline, maximum urgency
        urgencyFactor = 2.0;
      } else if (timeRemaining < 60000) {
        // Less than 1 minute, high urgency
        urgencyFactor = 1.5;
      } else if (timeRemaining < 300000) {
        // Less than 5 minutes, medium urgency
        urgencyFactor = 1.2;
      }
    }
    
    // Apply urgency factor to requested resources
    const requirements = { ...request.requirements };
    const strict = request.allocationMode === 'strict';
    
    // Check each resource type
    for (const resourceType of ['cpu', 'memory', 'gpu', 'networkBandwidth']) {
      const required = requirements[resourceType] || 0;
      
      // Apply urgency factor
      const adjustedRequired = required * urgencyFactor;
      
      // Check against available resources
      const available = availableResources[resourceType] || 0;
      
      if (adjustedRequired > available) {
        if (strict) {
          // In strict mode, fail if we don't have enough resources
          return {
            success: false,
            reason: `Not enough ${resourceType} available (required: ${adjustedRequired}, available: ${available})`
          };
        } else {
          // In non-strict mode, allocate what we can
          requirements[resourceType] = available;
        }
      } else {
        // Allocate adjusted amount
        requirements[resourceType] = adjustedRequired;
      }
    }
    
    return {
      success: true,
      resources: requirements
    };
  }
}

/**
 * Predictive Allocation Strategy
 */
class PredictiveAllocationStrategy extends AllocationStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('PredictiveStrategy');
  }
  
  async allocate(request, availableResources, resourceLimits, currentAllocations) {
    this.logger.info(`Allocating resources for ${request.requesterId} using predictive strategy`);
    
    // In a real implementation, this would use ML models to predict resource needs
    // For now, we'll just use the requested resources
    
    const requirements = { ...request.requirements };
    const strict = request.allocationMode === 'strict';
    
    // Check each resource type
    for (const resourceType of ['cpu', 'memory', 'gpu', 'networkBandwidth']) {
      const required = requirements[resourceType] || 0;
      const available = availableResources[resourceType] || 0;
      
      if (required > available) {
        if (strict) {
          // In strict mode, fail if we don't have enough resources
          return {
            success: false,
            reason: `Not enough ${resourceType} available (required: ${required}, available: ${available})`
          };
        } else {
          // In non-strict mode, allocate what we can
          requirements[resourceType] = available;
        }
      }
    }
    
    return {
      success: true,
      resources: requirements
    };
  }
}

/**
 * Multi-Objective Allocation Strategy
 */
class MultiObjectiveAllocationStrategy extends AllocationStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('MultiObjectiveStrategy');
  }
  
  async allocate(request, availableResources, resourceLimits, currentAllocations) {
    this.logger.info(`Allocating resources for ${request.requesterId} using multi-objective strategy`);
    
    // In a real implementation, this would use multi-objective optimization
    // For now, we'll just use a weighted sum of objectives
    
    const requirements = { ...request.requirements };
    const strict = request.allocationMode === 'strict';
    
    // Define weights for different objectives
    const weights = {
      resourceEfficiency: 0.4,
      fairness: 0.3,
      priority: 0.3
    };
    
    // Calculate priority factor
    const priorityFactor = request.priority ? (request.priority / 10) : 0.5;
    
    // Calculate fairness factor
    let fairnessFactor = 1.0;
    const requesterCounts = new Map();
    
    for (const allocation of currentAllocations.values()) {
      if (allocation.status === 'active') {
        const count = requesterCounts.get(allocation.requesterId) || 0;
        requesterCounts.set(allocation.requesterId, count + 1);
      }
    }
    
    const requesterCount = requesterCounts.get(request.requesterId) || 0;
    fairnessFactor = 1.0 / (requesterCount + 1);
    
    // Calculate resource efficiency factor
    const resourceEfficiencyFactor = 0.8; // Fixed value for now
    
    // Calculate overall adjustment factor
    const adjustmentFactor = 
      weights.resourceEfficiency * resourceEfficiencyFactor +
      weights.fairness * fairnessFactor +
      weights.priority * priorityFactor;
    
    // Apply adjustment factor to requested resources
    for (const resourceType of ['cpu', 'memory', 'gpu', 'networkBandwidth']) {
      const required = requirements[resourceType] || 0;
      
      // Apply adjustment factor
      const adjustedRequired = required * adjustmentFactor;
      
      // Check against available resources
      const available = availableResources[resourceType] || 0;
      
      if (adjustedRequired > available) {
        if (strict) {
          // In strict mode, fail if we don't have enough resources
          return {
            success: false,
            reason: `Not enough ${resourceType} available (required: ${adjustedRequired}, available: ${available})`
          };
        } else {
          // In non-strict mode, allocate what we can
          requirements[resourceType] = available;
        }
      } else {
        // Allocate adjusted amount
        requirements[resourceType] = adjustedRequired;
      }
    }
    
    return {
      success: true,
      resources: requirements
    };
  }
}

// Export the Resource Allocator and related classes
module.exports = {
  DynamicResourceAllocator,
  ResourcePredictor,
  ResourceOptimizationEngine,
  AllocationStrategy,
  PriorityBasedAllocationStrategy,
  FairShareAllocationStrategy,
  DeadlineAwareAllocationStrategy,
  PredictiveAllocationStrategy,
  MultiObjectiveAllocationStrategy
};
