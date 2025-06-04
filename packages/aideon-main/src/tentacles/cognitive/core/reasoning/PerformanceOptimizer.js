/**
 * @fileoverview PerformanceOptimizer for the Aideon AI Desktop Agent's Reasoning Engine.
 * Manages resource allocation, caching, parallel execution, and performance optimization.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const LRUCache = require('lru-cache');
const os = require('os');

/**
 * PerformanceOptimizer for the Aideon AI Desktop Agent's Reasoning Engine.
 * Manages resource allocation, caching, parallel execution, and performance optimization.
 * 
 * @extends EventEmitter
 */
class PerformanceOptimizer extends EventEmitter {
  /**
   * Creates a new PerformanceOptimizer instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} [options.systemPerformanceOrchestrator] - System-wide performance orchestrator
   * @param {Object} [options.securityManager] - Security manager
   */
  constructor(options) {
    super();
    
    if (!options) {
      throw new Error("PerformanceOptimizer requires options");
    }
    
    if (!options.logger) {
      throw new Error("PerformanceOptimizer requires a logger instance");
    }
    
    if (!options.configService) {
      throw new Error("PerformanceOptimizer requires a configService instance");
    }
    
    if (!options.performanceMonitor) {
      throw new Error("PerformanceOptimizer requires a performanceMonitor instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.systemPerformanceOrchestrator = options.systemPerformanceOrchestrator;
    this.securityManager = options.securityManager;
    
    // Resource management
    this.allocatedResources = new Map(); // Map of taskId -> allocated resources
    this.resourceUsage = new Map(); // Map of resourceType -> current usage
    
    // Caching
    this.resultCache = null; // Initialized in initialize()
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Task management
    this.runningTasks = new Map(); // Map of taskId -> task info
    this.taskPerformanceProfiles = new Map(); // Map of taskType -> performance profile
    
    // Configuration
    this.maxCacheSize = this.configService.get('reasoning.performance.maxCacheSize', 1000);
    this.maxCacheAge = this.configService.get('reasoning.performance.maxCacheAge', 3600000); // 1 hour in ms
    this.enableParallelExecution = this.configService.get('reasoning.performance.enableParallelExecution', true);
    this.maxParallelTasks = this.configService.get('reasoning.performance.maxParallelTasks', 4);
    this.resourceThrottlingThreshold = this.configService.get('reasoning.performance.resourceThrottlingThreshold', 0.8); // 80%
    this.performanceProfilingEnabled = this.configService.get('reasoning.performance.profilingEnabled', true);
    this.adaptiveOptimizationEnabled = this.configService.get('reasoning.performance.adaptiveOptimizationEnabled', true);
    
    // System tier (Core, Pro, Enterprise)
    this.systemTier = this.configService.get('system.tier', 'Core');
    
    this.initialized = false;
  }

  /**
   * Initializes the PerformanceOptimizer.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.logger.debug("Initializing PerformanceOptimizer");

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_initialize");
    }

    try {
      // Initialize cache with LRU strategy
      this.resultCache = new LRUCache({
        max: this.maxCacheSize,
        ttl: this.maxCacheAge,
        updateAgeOnGet: true,
        allowStale: false
      });
      
      // Initialize resource tracking
      await this._initializeResourceTracking();
      
      // Load performance profiles if available
      await this._loadPerformanceProfiles();
      
      // Register with system performance orchestrator if available
      if (this.systemPerformanceOrchestrator && 
          typeof this.systemPerformanceOrchestrator.registerComponent === 'function') {
        await this.systemPerformanceOrchestrator.registerComponent('reasoningEngine', {
          priority: this._getComponentPriority(),
          resourceRequirements: this._getBaseResourceRequirements(),
          adaptiveScaling: true
        });
      }
      
      this.initialized = true;

      this.logger.info("PerformanceOptimizer initialized successfully", {
        cacheSize: this.maxCacheSize,
        parallelExecution: this.enableParallelExecution,
        maxParallelTasks: this.maxParallelTasks,
        systemTier: this.systemTier
      });

      this.emit("initialized");
    } catch (error) {
      this.logger.error("PerformanceOptimizer initialization failed", { error: error.message, stack: error.stack });
      throw new Error(`PerformanceOptimizer initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Initializes resource tracking.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _initializeResourceTracking() {
    try {
      // Initialize resource usage tracking
      this.resourceUsage.set('cpu', 0);
      this.resourceUsage.set('memory', 0);
      this.resourceUsage.set('io', 0);
      this.resourceUsage.set('network', 0);
      
      // Get system resources
      this.systemResources = {
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg()[0]
      };
      
      // Set up periodic resource monitoring
      this._setupResourceMonitoring();
      
      this.logger.debug("Resource tracking initialized", this.systemResources);
    } catch (error) {
      this.logger.error(`Failed to initialize resource tracking: ${error.message}`, { error: error.stack });
      // Continue initialization even if resource tracking fails
    }
  }

  /**
   * Sets up periodic resource monitoring.
   * 
   * @private
   */
  _setupResourceMonitoring() {
    // Monitor system resources periodically
    const monitoringInterval = this.configService.get('reasoning.performance.monitoringIntervalMs', 5000); // 5 seconds
    
    if (this._resourceMonitoringInterval) {
      clearInterval(this._resourceMonitoringInterval);
    }
    
    this._resourceMonitoringInterval = setInterval(() => {
      try {
        // Update system resources
        this.systemResources.freeMemory = os.freemem();
        this.systemResources.loadAverage = os.loadavg()[0];
        
        // Calculate current CPU usage (load average / CPU count)
        const cpuUsage = Math.min(1, this.systemResources.loadAverage / this.systemResources.cpuCount);
        this.resourceUsage.set('cpu', cpuUsage);
        
        // Calculate current memory usage
        const memoryUsage = 1 - (this.systemResources.freeMemory / this.systemResources.totalMemory);
        this.resourceUsage.set('memory', memoryUsage);
        
        // Check if we need to throttle resources
        if (this.adaptiveOptimizationEnabled) {
          this._checkResourceThrottling();
        }
      } catch (error) {
        this.logger.error(`Resource monitoring error: ${error.message}`, { error: error.stack });
      }
    }, monitoringInterval);
  }

  /**
   * Checks if resource throttling is needed and applies it.
   * 
   * @private
   */
  _checkResourceThrottling() {
    try {
      const cpuUsage = this.resourceUsage.get('cpu');
      const memoryUsage = this.resourceUsage.get('memory');
      
      // Check if we're above throttling threshold
      if (cpuUsage > this.resourceThrottlingThreshold || 
          memoryUsage > this.resourceThrottlingThreshold) {
        
        // Apply throttling
        if (cpuUsage > this.resourceThrottlingThreshold) {
          // Reduce max parallel tasks
          const newMaxParallelTasks = Math.max(1, Math.floor(this.maxParallelTasks * 0.75));
          if (newMaxParallelTasks < this.maxParallelTasks) {
            this.logger.debug(`Throttling CPU: reducing max parallel tasks from ${this.maxParallelTasks} to ${newMaxParallelTasks}`);
            this.maxParallelTasks = newMaxParallelTasks;
          }
        }
        
        if (memoryUsage > this.resourceThrottlingThreshold) {
          // Clear some cache entries if memory usage is high
          const entriesToRemove = Math.ceil(this.resultCache.size * 0.1); // Remove 10% of entries
          if (entriesToRemove > 0) {
            this.logger.debug(`Throttling memory: clearing ${entriesToRemove} cache entries`);
            this._removeOldestCacheEntries(entriesToRemove);
          }
        }
        
        // Emit throttling event
        this.emit("resourceThrottling", {
          cpuUsage,
          memoryUsage,
          maxParallelTasks: this.maxParallelTasks
        });
      } else if (cpuUsage < this.resourceThrottlingThreshold * 0.7 && 
                 memoryUsage < this.resourceThrottlingThreshold * 0.7) {
        // If usage is well below threshold, restore resources
        const configMaxParallelTasks = this.configService.get('reasoning.performance.maxParallelTasks', 4);
        if (this.maxParallelTasks < configMaxParallelTasks) {
          this.logger.debug(`Restoring max parallel tasks from ${this.maxParallelTasks} to ${configMaxParallelTasks}`);
          this.maxParallelTasks = configMaxParallelTasks;
          
          // Emit restoration event
          this.emit("resourceRestoration", {
            cpuUsage,
            memoryUsage,
            maxParallelTasks: this.maxParallelTasks
          });
        }
      }
    } catch (error) {
      this.logger.error(`Resource throttling error: ${error.message}`, { error: error.stack });
    }
  }

  /**
   * Removes oldest cache entries.
   * 
   * @private
   * @param {number} count - Number of entries to remove
   */
  _removeOldestCacheEntries(count) {
    try {
      // LRUCache doesn't provide direct access to oldest entries
      // So we'll use a workaround by dumping and recreating the cache
      
      // Get all entries
      const entries = Array.from(this.resultCache.entries());
      
      // Sort by age (assuming TTL cache with updateAgeOnGet)
      entries.sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);
      
      // Remove oldest entries
      for (let i = 0; i < Math.min(count, entries.length); i++) {
        this.resultCache.delete(entries[i][0]);
      }
    } catch (error) {
      this.logger.error(`Failed to remove oldest cache entries: ${error.message}`, { error: error.stack });
    }
  }

  /**
   * Loads performance profiles from configuration or previous runs.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _loadPerformanceProfiles() {
    try {
      // Load default performance profiles from configuration
      const defaultProfiles = this.configService.get('reasoning.performance.defaultProfiles', {});
      
      for (const [taskType, profile] of Object.entries(defaultProfiles)) {
        this.taskPerformanceProfiles.set(taskType, {
          ...profile,
          source: 'default',
          timestamp: Date.now()
        });
      }
      
      // If system performance orchestrator is available, get profiles from there
      if (this.systemPerformanceOrchestrator && 
          typeof this.systemPerformanceOrchestrator.getPerformanceProfiles === 'function') {
        const orchestratorProfiles = await this.systemPerformanceOrchestrator.getPerformanceProfiles('reasoningEngine');
        
        if (orchestratorProfiles && typeof orchestratorProfiles === 'object') {
          for (const [taskType, profile] of Object.entries(orchestratorProfiles)) {
            this.taskPerformanceProfiles.set(taskType, {
              ...profile,
              source: 'orchestrator',
              timestamp: Date.now()
            });
          }
        }
      }
      
      this.logger.debug(`Loaded ${this.taskPerformanceProfiles.size} performance profiles`);
    } catch (error) {
      this.logger.error(`Failed to load performance profiles: ${error.message}`, { error: error.stack });
      // Continue initialization even if loading fails
    }
  }

  /**
   * Gets component priority based on system tier.
   * 
   * @private
   * @returns {number} - Priority (0-100)
   */
  _getComponentPriority() {
    switch (this.systemTier) {
      case 'Enterprise':
        return 80; // High priority for Enterprise tier
      case 'Pro':
        return 60; // Medium-high priority for Pro tier
      case 'Core':
      default:
        return 40; // Medium priority for Core tier
    }
  }

  /**
   * Gets base resource requirements based on system tier.
   * 
   * @private
   * @returns {Object} - Resource requirements
   */
  _getBaseResourceRequirements() {
    switch (this.systemTier) {
      case 'Enterprise':
        return {
          cpu: 0.3, // 30% of CPU
          memory: 0.25, // 25% of memory
          io: 0.2, // 20% of IO
          network: 0.1 // 10% of network
        };
      case 'Pro':
        return {
          cpu: 0.2, // 20% of CPU
          memory: 0.15, // 15% of memory
          io: 0.1, // 10% of IO
          network: 0.05 // 5% of network
        };
      case 'Core':
      default:
        return {
          cpu: 0.1, // 10% of CPU
          memory: 0.1, // 10% of memory
          io: 0.05, // 5% of IO
          network: 0.02 // 2% of network
        };
    }
  }

  /**
   * Ensures the optimizer is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the optimizer is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("PerformanceOptimizer is not initialized. Call initialize() first.");
    }
  }

  /**
   * Allocates resources for a reasoning task.
   * 
   * @param {Object} task - Task information
   * @param {Object} availableResources - Available resources
   * @returns {Promise<Object>} - Allocated resources
   */
  async allocateResources(task, availableResources = null) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_allocateResources");
    }

    try {
      // Validate task
      if (!task || !task.id || !task.type) {
        throw new Error("Invalid task for resource allocation");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyResourceAllocationPolicies) {
        task = await this.securityManager.applyResourceAllocationPolicies(task, availableResources);
      }
      
      // Get system-wide available resources if not provided
      if (!availableResources) {
        availableResources = this._getAvailableResources();
      }
      
      // Calculate required resources based on task type and complexity
      const requiredResources = this._calculateRequiredResources(task);
      
      // Check if resources are available
      const resourcesAvailable = this._checkResourcesAvailable(requiredResources, availableResources);
      
      if (!resourcesAvailable) {
        // If resources not available, try to adjust requirements
        const adjustedResources = this._adjustResourceRequirements(requiredResources, availableResources);
        
        // If still not available, throw error
        if (!this._checkResourcesAvailable(adjustedResources, availableResources)) {
          throw new Error(`Insufficient resources for task ${task.id}`);
        }
        
        // Use adjusted resources
        this.logger.debug(`Using adjusted resources for task ${task.id}`, { 
          original: requiredResources, 
          adjusted: adjustedResources 
        });
        
        // Allocate adjusted resources
        await this._allocateResourcesInternal(task.id, adjustedResources);
        
        return adjustedResources;
      }
      
      // Allocate resources
      await this._allocateResourcesInternal(task.id, requiredResources);
      
      return requiredResources;
    } catch (error) {
      this.logger.error(`Failed to allocate resources: ${error.message}`, { error: error.stack });
      
      // Return minimal resources in case of error
      const minimalResources = this._getMinimalResources();
      await this._allocateResourcesInternal(task.id, minimalResources);
      
      return minimalResources;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Gets available system resources.
   * 
   * @private
   * @returns {Object} - Available resources
   */
  _getAvailableResources() {
    try {
      // Calculate available CPU
      const cpuUsage = this.resourceUsage.get('cpu');
      const availableCpu = Math.max(0, 1 - cpuUsage);
      
      // Calculate available memory
      const memoryUsage = this.resourceUsage.get('memory');
      const availableMemory = Math.max(0, 1 - memoryUsage);
      
      // Get IO and network from resource usage (if available)
      const ioUsage = this.resourceUsage.get('io') || 0;
      const availableIo = Math.max(0, 1 - ioUsage);
      
      const networkUsage = this.resourceUsage.get('network') || 0;
      const availableNetwork = Math.max(0, 1 - networkUsage);
      
      return {
        cpu: availableCpu,
        memory: availableMemory,
        io: availableIo,
        network: availableNetwork
      };
    } catch (error) {
      this.logger.error(`Failed to get available resources: ${error.message}`, { error: error.stack });
      
      // Return conservative estimates in case of error
      return {
        cpu: 0.5,
        memory: 0.5,
        io: 0.5,
        network: 0.5
      };
    }
  }

  /**
   * Calculates required resources based on task type and complexity.
   * 
   * @private
   * @param {Object} task - Task information
   * @returns {Object} - Required resources
   */
  _calculateRequiredResources(task) {
    try {
      // Get performance profile for task type
      const profile = this.taskPerformanceProfiles.get(task.type) || {
        cpuWeight: 1,
        memoryWeight: 1,
        ioWeight: 0.5,
        networkWeight: 0.2
      };
      
      // Get task complexity (default to medium)
      const complexity = task.complexity || 0.5; // 0-1 scale
      
      // Calculate base resource requirements based on system tier
      const baseRequirements = this._getBaseResourceRequirements();
      
      // Calculate required resources based on complexity and weights
      return {
        cpu: baseRequirements.cpu * profile.cpuWeight * (1 + complexity),
        memory: baseRequirements.memory * profile.memoryWeight * (1 + complexity),
        io: baseRequirements.io * profile.ioWeight * (1 + complexity),
        network: baseRequirements.network * profile.networkWeight * (1 + complexity)
      };
    } catch (error) {
      this.logger.error(`Failed to calculate required resources: ${error.message}`, { error: error.stack });
      
      // Return default resources in case of error
      return this._getBaseResourceRequirements();
    }
  }

  /**
   * Checks if required resources are available.
   * 
   * @private
   * @param {Object} requiredResources - Required resources
   * @param {Object} availableResources - Available resources
   * @returns {boolean} - Whether resources are available
   */
  _checkResourcesAvailable(requiredResources, availableResources) {
    return (
      requiredResources.cpu <= availableResources.cpu &&
      requiredResources.memory <= availableResources.memory &&
      requiredResources.io <= availableResources.io &&
      requiredResources.network <= availableResources.network
    );
  }

  /**
   * Adjusts resource requirements to fit available resources.
   * 
   * @private
   * @param {Object} requiredResources - Required resources
   * @param {Object} availableResources - Available resources
   * @returns {Object} - Adjusted resources
   */
  _adjustResourceRequirements(requiredResources, availableResources) {
    try {
      // Calculate scaling factor for each resource
      const cpuScale = availableResources.cpu / requiredResources.cpu;
      const memoryScale = availableResources.memory / requiredResources.memory;
      const ioScale = availableResources.io / requiredResources.io;
      const networkScale = availableResources.network / requiredResources.network;
      
      // Find minimum scaling factor (bottleneck)
      const minScale = Math.min(
        cpuScale < 1 ? cpuScale : 1,
        memoryScale < 1 ? memoryScale : 1,
        ioScale < 1 ? ioScale : 1,
        networkScale < 1 ? networkScale : 1
      );
      
      // If no scaling needed, return original
      if (minScale >= 1) {
        return requiredResources;
      }
      
      // Apply scaling factor with a small buffer
      const scalingFactor = minScale * 0.9; // 90% of available to leave some buffer
      
      return {
        cpu: requiredResources.cpu * scalingFactor,
        memory: requiredResources.memory * scalingFactor,
        io: requiredResources.io * scalingFactor,
        network: requiredResources.network * scalingFactor
      };
    } catch (error) {
      this.logger.error(`Failed to adjust resource requirements: ${error.message}`, { error: error.stack });
      
      // Return minimal resources in case of error
      return this._getMinimalResources();
    }
  }

  /**
   * Gets minimal resource requirements.
   * 
   * @private
   * @returns {Object} - Minimal resources
   */
  _getMinimalResources() {
    return {
      cpu: 0.05, // 5% of CPU
      memory: 0.05, // 5% of memory
      io: 0.02, // 2% of IO
      network: 0.01 // 1% of network
    };
  }

  /**
   * Allocates resources internally.
   * 
   * @private
   * @param {string} taskId - Task identifier
   * @param {Object} resources - Resources to allocate
   * @returns {Promise<void>}
   */
  async _allocateResourcesInternal(taskId, resources) {
    try {
      // Store allocated resources
      this.allocatedResources.set(taskId, {
        ...resources,
        allocatedAt: Date.now()
      });
      
      // Update resource usage
      for (const [resourceType, amount] of Object.entries(resources)) {
        const currentUsage = this.resourceUsage.get(resourceType) || 0;
        this.resourceUsage.set(resourceType, currentUsage + amount);
      }
      
      // Notify system performance orchestrator if available
      if (this.systemPerformanceOrchestrator && 
          typeof this.systemPerformanceOrchestrator.notifyResourceAllocation === 'function') {
        await this.systemPerformanceOrchestrator.notifyResourceAllocation('reasoningEngine', taskId, resources);
      }
      
      this.logger.debug(`Allocated resources for task ${taskId}`, resources);
    } catch (error) {
      this.logger.error(`Failed to allocate resources internally: ${error.message}`, { error: error.stack });
      // Continue even if internal allocation fails
    }
  }

  /**
   * Monitors resource usage for a task.
   * 
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object>} - Current resource usage
   */
  async monitorResourceUsage(taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_monitorResourceUsage");
    }

    try {
      // Check if task exists
      if (!this.allocatedResources.has(taskId)) {
        throw new Error(`Task ${taskId} not found for resource monitoring`);
      }
      
      // Get allocated resources
      const allocatedResources = this.allocatedResources.get(taskId);
      
      // Get task info if available
      const taskInfo = this.runningTasks.get(taskId);
      
      // Calculate resource usage percentage
      const usagePercentage = {};
      
      if (taskInfo && taskInfo.startTime) {
        const elapsedTime = Date.now() - taskInfo.startTime;
        const expectedDuration = taskInfo.expectedDuration || 1000; // Default to 1 second
        
        // Calculate usage percentage based on elapsed time
        const timePercentage = Math.min(1, elapsedTime / expectedDuration);
        
        for (const [resourceType, amount] of Object.entries(allocatedResources)) {
          if (resourceType !== 'allocatedAt') {
            usagePercentage[resourceType] = amount * timePercentage;
          }
        }
      } else {
        // If no task info, assume 50% usage
        for (const [resourceType, amount] of Object.entries(allocatedResources)) {
          if (resourceType !== 'allocatedAt') {
            usagePercentage[resourceType] = amount * 0.5;
          }
        }
      }
      
      return {
        taskId,
        allocatedResources,
        usagePercentage,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(`Failed to monitor resource usage: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Releases resources allocated for a task.
   * 
   * @param {string} taskId - Task identifier
   * @returns {Promise<boolean>} - Whether resources were released
   */
  async releaseResources(taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_releaseResources");
    }

    try {
      // Check if task exists
      if (!this.allocatedResources.has(taskId)) {
        return false;
      }
      
      // Get allocated resources
      const allocatedResources = this.allocatedResources.get(taskId);
      
      // Update resource usage
      for (const [resourceType, amount] of Object.entries(allocatedResources)) {
        if (resourceType !== 'allocatedAt') {
          const currentUsage = this.resourceUsage.get(resourceType) || 0;
          this.resourceUsage.set(resourceType, Math.max(0, currentUsage - amount));
        }
      }
      
      // Remove from allocated resources
      this.allocatedResources.delete(taskId);
      
      // Remove from running tasks
      this.runningTasks.delete(taskId);
      
      // Notify system performance orchestrator if available
      if (this.systemPerformanceOrchestrator && 
          typeof this.systemPerformanceOrchestrator.notifyResourceRelease === 'function') {
        await this.systemPerformanceOrchestrator.notifyResourceRelease('reasoningEngine', taskId);
      }
      
      this.logger.debug(`Released resources for task ${taskId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to release resources: ${error.message}`, { error: error.stack });
      return false;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Caches a reasoning result.
   * 
   * @param {string} key - Cache key
   * @param {Object} result - Result to cache
   * @param {Object} metadata - Result metadata
   * @returns {Promise<boolean>} - Whether result was cached
   */
  async cacheResult(key, result, metadata = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_cacheResult");
    }

    try {
      // Validate inputs
      if (!key || !result) {
        throw new Error("Invalid inputs for result caching");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyCachePolicies) {
        const shouldCache = await this.securityManager.applyCachePolicies(key, result, metadata);
        if (!shouldCache) {
          this.logger.debug(`Caching denied by security policies for key: ${key}`);
          return false;
        }
      }
      
      // Add timestamp to metadata
      const enhancedMetadata = {
        ...metadata,
        cachedAt: Date.now(),
        lastAccessed: Date.now()
      };
      
      // Store in cache
      this.resultCache.set(key, { result, metadata: enhancedMetadata });
      
      this.logger.debug(`Cached result for key: ${key}`, { metadataSize: JSON.stringify(enhancedMetadata).length });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to cache result: ${error.message}`, { error: error.stack });
      return false;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves a cached result.
   * 
   * @param {string} key - Cache key
   * @param {Object} context - Context information
   * @returns {Promise<Object|null>} - Cached result or null if not found
   */
  async retrieveCachedResult(key, context = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_retrieveCachedResult");
    }

    try {
      // Validate key
      if (!key) {
        throw new Error("Invalid key for cache retrieval");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyCacheRetrievalPolicies) {
        const canRetrieve = await this.securityManager.applyCacheRetrievalPolicies(key, context);
        if (!canRetrieve) {
          this.logger.debug(`Cache retrieval denied by security policies for key: ${key}`);
          this.cacheMisses++;
          return null;
        }
      }
      
      // Check if result exists in cache
      if (!this.resultCache.has(key)) {
        this.cacheMisses++;
        return null;
      }
      
      // Get cached result
      const cachedItem = this.resultCache.get(key);
      
      if (!cachedItem) {
        this.cacheMisses++;
        return null;
      }
      
      // Update last accessed timestamp
      cachedItem.metadata.lastAccessed = Date.now();
      
      // Check if result is still valid based on context
      if (context.maxAge && cachedItem.metadata.cachedAt) {
        const age = Date.now() - cachedItem.metadata.cachedAt;
        if (age > context.maxAge) {
          this.logger.debug(`Cached result expired for key: ${key}`, { 
            age, 
            maxAge: context.maxAge 
          });
          this.cacheMisses++;
          return null;
        }
      }
      
      // Check if context requires specific metadata
      if (context.requiredMetadata && typeof context.requiredMetadata === 'object') {
        for (const [key, value] of Object.entries(context.requiredMetadata)) {
          if (cachedItem.metadata[key] !== value) {
            this.logger.debug(`Cached result metadata mismatch for key: ${key}`, { 
              required: context.requiredMetadata, 
              actual: cachedItem.metadata 
            });
            this.cacheMisses++;
            return null;
          }
        }
      }
      
      this.cacheHits++;
      
      this.logger.debug(`Retrieved cached result for key: ${key}`, { 
        cacheHits: this.cacheHits, 
        cacheMisses: this.cacheMisses 
      });
      
      return {
        result: cachedItem.result,
        metadata: cachedItem.metadata,
        fromCache: true
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve cached result: ${error.message}`, { error: error.stack });
      this.cacheMisses++;
      return null;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Invalidates cache entries matching a pattern.
   * 
   * @param {string|RegExp} pattern - Pattern to match
   * @returns {Promise<number>} - Number of invalidated entries
   */
  async invalidateCache(pattern) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_invalidateCache");
    }

    try {
      // Validate pattern
      if (!pattern) {
        throw new Error("Invalid pattern for cache invalidation");
      }
      
      let count = 0;
      
      // Convert string pattern to RegExp if needed
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      
      // Get all keys
      const keys = Array.from(this.resultCache.keys());
      
      // Invalidate matching keys
      for (const key of keys) {
        if (regex.test(key)) {
          this.resultCache.delete(key);
          count++;
        }
      }
      
      this.logger.debug(`Invalidated ${count} cache entries matching pattern: ${pattern}`);
      
      return count;
    } catch (error) {
      this.logger.error(`Failed to invalidate cache: ${error.message}`, { error: error.stack });
      return 0;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Optimizes task execution by determining execution strategy.
   * 
   * @param {Array<Object>} tasks - Tasks to optimize
   * @returns {Promise<Object>} - Optimization result
   */
  async optimizeTaskExecution(tasks) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_optimizeTaskExecution");
    }

    try {
      // Validate tasks
      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error("Invalid tasks for execution optimization");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTaskOptimizationPolicies) {
        tasks = await this.securityManager.applyTaskOptimizationPolicies(tasks);
      }
      
      // Check for cached results first
      const tasksWithCacheStatus = await Promise.all(tasks.map(async (task) => {
        // Generate cache key
        const cacheKey = this._generateCacheKey(task);
        
        // Check cache
        const cachedResult = await this.retrieveCachedResult(cacheKey, task.context || {});
        
        return {
          ...task,
          cacheKey,
          cachedResult: cachedResult ? cachedResult.result : null,
          fromCache: !!cachedResult
        };
      }));
      
      // Separate cached and non-cached tasks
      const cachedTasks = tasksWithCacheStatus.filter(task => task.fromCache);
      const nonCachedTasks = tasksWithCacheStatus.filter(task => !task.fromCache);
      
      // If all tasks are cached, return immediately
      if (nonCachedTasks.length === 0) {
        return {
          strategy: 'cache_only',
          cachedTasks,
          nonCachedTasks: [],
          parallelExecution: false,
          executionPlan: []
        };
      }
      
      // Determine if parallel execution is possible
      const canExecuteInParallel = this.enableParallelExecution && 
                                  nonCachedTasks.length > 1 && 
                                  nonCachedTasks.length <= this.maxParallelTasks;
      
      // Check if tasks can be parallelized
      let parallelizableTasks = [];
      
      if (canExecuteInParallel) {
        parallelizableTasks = await this.identifyParallelizableTasks(nonCachedTasks);
      }
      
      // Create execution plan
      const executionPlan = this._createExecutionPlan(
        nonCachedTasks, 
        parallelizableTasks, 
        canExecuteInParallel
      );
      
      return {
        strategy: canExecuteInParallel ? 'parallel' : 'sequential',
        cachedTasks,
        nonCachedTasks,
        parallelExecution: canExecuteInParallel,
        parallelizableTasks,
        executionPlan
      };
    } catch (error) {
      this.logger.error(`Failed to optimize task execution: ${error.message}`, { error: error.stack });
      
      // Return sequential execution as fallback
      return {
        strategy: 'sequential',
        cachedTasks: [],
        nonCachedTasks: tasks,
        parallelExecution: false,
        executionPlan: tasks.map(task => ({
          taskId: task.id,
          executionOrder: 0,
          parallelGroup: null
        }))
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Generates a cache key for a task.
   * 
   * @private
   * @param {Object} task - Task information
   * @returns {string} - Cache key
   */
  _generateCacheKey(task) {
    try {
      // Extract key components
      const components = {
        type: task.type,
        input: task.input,
        parameters: task.parameters
      };
      
      // Generate deterministic string representation
      const stringRepresentation = JSON.stringify(components, (key, value) => {
        // Sort object keys for deterministic serialization
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return Object.keys(value).sort().reduce((sorted, key) => {
            sorted[key] = value[key];
            return sorted;
          }, {});
        }
        return value;
      });
      
      // Use hash function if available
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
        // Use SHA-256 for hashing
        const encoder = new TextEncoder();
        const data = encoder.encode(stringRepresentation);
        const hashBuffer = crypto.subtle.digest('SHA-256', data);
        
        // Convert hash to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return `${task.type}_${hashHex}`;
      }
      
      // Fallback to simple hash
      let hash = 0;
      for (let i = 0; i < stringRepresentation.length; i++) {
        const char = stringRepresentation.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      return `${task.type}_${Math.abs(hash).toString(16)}`;
    } catch (error) {
      this.logger.error(`Failed to generate cache key: ${error.message}`, { error: error.stack });
      
      // Fallback to task ID or random ID
      return `${task.type}_${task.id || uuidv4()}`;
    }
  }

  /**
   * Identifies tasks that can be executed in parallel.
   * 
   * @param {Array<Object>} tasks - Tasks to analyze
   * @returns {Promise<Array<Object>>} - Parallelizable tasks
   */
  async identifyParallelizableTasks(tasks) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_identifyParallelizableTasks");
    }

    try {
      // Validate tasks
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return [];
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyParallelizationPolicies) {
        tasks = await this.securityManager.applyParallelizationPolicies(tasks);
      }
      
      // Build dependency graph
      const dependencyGraph = this._buildDependencyGraph(tasks);
      
      // Find independent tasks (no dependencies)
      const independentTasks = tasks.filter(task => {
        const dependencies = dependencyGraph.get(task.id) || [];
        return dependencies.length === 0;
      });
      
      // Check resource requirements
      const availableResources = this._getAvailableResources();
      const parallelizableTasks = [];
      
      // Calculate total resource requirements for independent tasks
      let totalResourceRequirements = {
        cpu: 0,
        memory: 0,
        io: 0,
        network: 0
      };
      
      for (const task of independentTasks) {
        const requiredResources = this._calculateRequiredResources(task);
        
        // Check if adding this task would exceed available resources
        const wouldExceed = Object.entries(requiredResources).some(([resourceType, amount]) => {
          return totalResourceRequirements[resourceType] + amount > availableResources[resourceType];
        });
        
        if (!wouldExceed) {
          // Add to parallelizable tasks
          parallelizableTasks.push(task);
          
          // Update total resource requirements
          for (const [resourceType, amount] of Object.entries(requiredResources)) {
            totalResourceRequirements[resourceType] += amount;
          }
        }
        
        // Stop if we've reached max parallel tasks
        if (parallelizableTasks.length >= this.maxParallelTasks) {
          break;
        }
      }
      
      return parallelizableTasks;
    } catch (error) {
      this.logger.error(`Failed to identify parallelizable tasks: ${error.message}`, { error: error.stack });
      return [];
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Builds a dependency graph for tasks.
   * 
   * @private
   * @param {Array<Object>} tasks - Tasks to analyze
   * @returns {Map<string, Array<string>>} - Dependency graph
   */
  _buildDependencyGraph(tasks) {
    try {
      // Create dependency graph
      const dependencyGraph = new Map();
      
      // Initialize graph with empty dependencies
      for (const task of tasks) {
        dependencyGraph.set(task.id, []);
      }
      
      // Add dependencies
      for (const task of tasks) {
        if (task.dependencies && Array.isArray(task.dependencies)) {
          dependencyGraph.set(task.id, task.dependencies);
        }
      }
      
      return dependencyGraph;
    } catch (error) {
      this.logger.error(`Failed to build dependency graph: ${error.message}`, { error: error.stack });
      
      // Return empty graph as fallback
      return new Map();
    }
  }

  /**
   * Creates an execution plan for tasks.
   * 
   * @private
   * @param {Array<Object>} tasks - Tasks to execute
   * @param {Array<Object>} parallelizableTasks - Tasks that can be executed in parallel
   * @param {boolean} useParallel - Whether to use parallel execution
   * @returns {Array<Object>} - Execution plan
   */
  _createExecutionPlan(tasks, parallelizableTasks, useParallel) {
    try {
      // If not using parallel execution, return sequential plan
      if (!useParallel || parallelizableTasks.length <= 1) {
        return tasks.map((task, index) => ({
          taskId: task.id,
          executionOrder: index,
          parallelGroup: null
        }));
      }
      
      // Create parallel execution groups
      const parallelizableIds = new Set(parallelizableTasks.map(task => task.id));
      const executionPlan = [];
      
      // Group 0 is for parallel tasks
      for (const task of tasks) {
        if (parallelizableIds.has(task.id)) {
          executionPlan.push({
            taskId: task.id,
            executionOrder: 0,
            parallelGroup: 0
          });
        }
      }
      
      // Remaining tasks are executed sequentially after parallel group
      let order = 1;
      for (const task of tasks) {
        if (!parallelizableIds.has(task.id)) {
          executionPlan.push({
            taskId: task.id,
            executionOrder: order++,
            parallelGroup: null
          });
        }
      }
      
      return executionPlan;
    } catch (error) {
      this.logger.error(`Failed to create execution plan: ${error.message}`, { error: error.stack });
      
      // Return sequential plan as fallback
      return tasks.map((task, index) => ({
        taskId: task.id,
        executionOrder: index,
        parallelGroup: null
      }));
    }
  }

  /**
   * Schedules parallel execution of tasks.
   * 
   * @param {Array<Object>} tasks - Tasks to execute in parallel
   * @returns {Promise<Array<Object>>} - Execution results
   */
  async scheduleParallelExecution(tasks) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_scheduleParallelExecution");
    }

    try {
      // Validate tasks
      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error("Invalid tasks for parallel execution");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyParallelExecutionPolicies) {
        tasks = await this.securityManager.applyParallelExecutionPolicies(tasks);
      }
      
      // Check if parallel execution is enabled
      if (!this.enableParallelExecution) {
        throw new Error("Parallel execution is disabled");
      }
      
      // Limit number of parallel tasks
      const tasksToExecute = tasks.slice(0, this.maxParallelTasks);
      
      // Allocate resources for each task
      const resourceAllocationPromises = tasksToExecute.map(task => 
        this.allocateResources(task)
      );
      
      // Wait for all resource allocations
      const allocatedResources = await Promise.all(resourceAllocationPromises);
      
      // Track tasks
      for (let i = 0; i < tasksToExecute.length; i++) {
        const task = tasksToExecute[i];
        const resources = allocatedResources[i];
        
        this.runningTasks.set(task.id, {
          ...task,
          startTime: Date.now(),
          expectedDuration: task.expectedDuration || 5000, // Default to 5 seconds
          resources
        });
      }
      
      // Return execution context
      return {
        tasks: tasksToExecute,
        allocatedResources,
        maxParallelTasks: this.maxParallelTasks,
        executionStartTime: Date.now()
      };
    } catch (error) {
      this.logger.error(`Failed to schedule parallel execution: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Selects execution tier based on task and system load.
   * 
   * @param {Object} task - Task information
   * @param {Object} systemLoad - System load information
   * @returns {Promise<string>} - Selected tier
   */
  async selectExecutionTier(task, systemLoad) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_selectExecutionTier");
    }

    try {
      // Validate inputs
      if (!task) {
        throw new Error("Invalid task for tier selection");
      }
      
      // Apply security policies if available
      if (this.securityManager && this.securityManager.applyTierSelectionPolicies) {
        task = await this.securityManager.applyTierSelectionPolicies(task, systemLoad);
      }
      
      // Get system load if not provided
      if (!systemLoad) {
        systemLoad = {
          cpu: this.resourceUsage.get('cpu') || 0,
          memory: this.resourceUsage.get('memory') || 0
        };
      }
      
      // Get task priority (default to medium)
      const priority = task.priority || 'medium';
      
      // Get task complexity (default to medium)
      const complexity = task.complexity || 0.5;
      
      // Get system tier
      const systemTier = this.systemTier;
      
      // Define tier thresholds based on system tier
      let highLoadThreshold, mediumLoadThreshold;
      
      switch (systemTier) {
        case 'Enterprise':
          highLoadThreshold = 0.9; // 90%
          mediumLoadThreshold = 0.7; // 70%
          break;
        case 'Pro':
          highLoadThreshold = 0.8; // 80%
          mediumLoadThreshold = 0.6; // 60%
          break;
        case 'Core':
        default:
          highLoadThreshold = 0.7; // 70%
          mediumLoadThreshold = 0.5; // 50%
      }
      
      // Calculate current load
      const currentLoad = Math.max(systemLoad.cpu, systemLoad.memory);
      
      // Select tier based on load, priority, and complexity
      let selectedTier;
      
      if (currentLoad >= highLoadThreshold) {
        // High load
        if (priority === 'high') {
          selectedTier = complexity > 0.7 ? 'medium' : 'high';
        } else if (priority === 'medium') {
          selectedTier = 'low';
        } else {
          selectedTier = 'minimal';
        }
      } else if (currentLoad >= mediumLoadThreshold) {
        // Medium load
        if (priority === 'high') {
          selectedTier = 'high';
        } else if (priority === 'medium') {
          selectedTier = complexity > 0.7 ? 'low' : 'medium';
        } else {
          selectedTier = 'low';
        }
      } else {
        // Low load
        if (priority === 'high') {
          selectedTier = 'high';
        } else if (priority === 'medium') {
          selectedTier = 'medium';
        } else {
          selectedTier = complexity > 0.7 ? 'low' : 'medium';
        }
      }
      
      // Adjust based on system tier
      if (systemTier === 'Core' && selectedTier === 'high') {
        selectedTier = 'medium';
      }
      
      this.logger.debug(`Selected execution tier for task ${task.id}: ${selectedTier}`, {
        priority,
        complexity,
        currentLoad,
        systemTier
      });
      
      return selectedTier;
    } catch (error) {
      this.logger.error(`Failed to select execution tier: ${error.message}`, { error: error.stack });
      
      // Return medium tier as fallback
      return 'medium';
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Throttles non-critical tasks based on system load.
   * 
   * @param {Object} systemLoad - System load information
   * @returns {Promise<Object>} - Throttling result
   */
  async throttleNonCriticalTasks(systemLoad) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_throttleNonCriticalTasks");
    }

    try {
      // Validate system load
      if (!systemLoad) {
        systemLoad = {
          cpu: this.resourceUsage.get('cpu') || 0,
          memory: this.resourceUsage.get('memory') || 0
        };
      }
      
      // Check if throttling is needed
      const currentLoad = Math.max(systemLoad.cpu, systemLoad.memory);
      
      if (currentLoad < this.resourceThrottlingThreshold) {
        return {
          throttled: false,
          message: 'Throttling not needed',
          currentLoad
        };
      }
      
      // Get running tasks
      const runningTasks = Array.from(this.runningTasks.entries());
      
      // Find non-critical tasks (low priority)
      const nonCriticalTasks = runningTasks.filter(([, task]) => 
        task.priority === 'low' || !task.priority
      );
      
      if (nonCriticalTasks.length === 0) {
        return {
          throttled: false,
          message: 'No non-critical tasks to throttle',
          currentLoad
        };
      }
      
      // Calculate how many tasks to throttle
      const throttleCount = Math.ceil(nonCriticalTasks.length * 0.5); // Throttle 50% of non-critical tasks
      
      // Sort by start time (newest first)
      nonCriticalTasks.sort(([, taskA], [, taskB]) => 
        (taskB.startTime || 0) - (taskA.startTime || 0)
      );
      
      // Throttle tasks
      const throttledTasks = [];
      
      for (let i = 0; i < Math.min(throttleCount, nonCriticalTasks.length); i++) {
        const [taskId, task] = nonCriticalTasks[i];
        
        // Reduce allocated resources
        if (this.allocatedResources.has(taskId)) {
          const resources = this.allocatedResources.get(taskId);
          const throttledResources = {};
          
          // Reduce resources by 50%
          for (const [resourceType, amount] of Object.entries(resources)) {
            if (resourceType !== 'allocatedAt') {
              // Update resource usage
              const currentUsage = this.resourceUsage.get(resourceType) || 0;
              const reduction = amount * 0.5;
              
              throttledResources[resourceType] = amount - reduction;
              this.resourceUsage.set(resourceType, Math.max(0, currentUsage - reduction));
            } else {
              throttledResources[resourceType] = resources[resourceType];
            }
          }
          
          // Update allocated resources
          this.allocatedResources.set(taskId, throttledResources);
          
          throttledTasks.push({
            taskId,
            originalResources: resources,
            throttledResources
          });
        }
      }
      
      this.logger.debug(`Throttled ${throttledTasks.length} non-critical tasks`, {
        currentLoad,
        throttleCount,
        nonCriticalTasksCount: nonCriticalTasks.length
      });
      
      return {
        throttled: true,
        throttledTasks,
        throttledCount: throttledTasks.length,
        currentLoad
      };
    } catch (error) {
      this.logger.error(`Failed to throttle non-critical tasks: ${error.message}`, { error: error.stack });
      
      return {
        throttled: false,
        message: `Error: ${error.message}`,
        currentLoad: systemLoad.cpu || 0
      };
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Profiles task performance.
   * 
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object>} - Performance profile
   */
  async profileTaskPerformance(taskId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_profileTaskPerformance");
    }

    try {
      // Check if task exists
      if (!this.runningTasks.has(taskId)) {
        throw new Error(`Task ${taskId} not found for performance profiling`);
      }
      
      // Get task info
      const taskInfo = this.runningTasks.get(taskId);
      
      // Check if task has completed
      if (!taskInfo.endTime) {
        throw new Error(`Task ${taskId} has not completed yet`);
      }
      
      // Calculate performance metrics
      const executionTime = taskInfo.endTime - taskInfo.startTime;
      const expectedDuration = taskInfo.expectedDuration || 5000; // Default to 5 seconds
      
      // Calculate performance ratio (1.0 means exactly as expected)
      const performanceRatio = executionTime / expectedDuration;
      
      // Calculate resource efficiency
      const resourceEfficiency = {};
      
      if (taskInfo.resources) {
        for (const [resourceType, amount] of Object.entries(taskInfo.resources)) {
          if (resourceType !== 'allocatedAt') {
            // Calculate efficiency based on resource usage and execution time
            const efficiency = 1 / (performanceRatio * amount);
            resourceEfficiency[resourceType] = Math.min(1, efficiency);
          }
        }
      }
      
      // Create performance profile
      const profile = {
        taskId,
        taskType: taskInfo.type,
        executionTime,
        expectedDuration,
        performanceRatio,
        resourceEfficiency,
        timestamp: Date.now()
      };
      
      // Store in performance profiles
      this.taskPerformanceProfiles.set(taskInfo.type, {
        ...profile,
        source: 'profiling',
        timestamp: Date.now()
      });
      
      // Update system performance orchestrator if available
      if (this.systemPerformanceOrchestrator && 
          typeof this.systemPerformanceOrchestrator.updatePerformanceProfile === 'function') {
        await this.systemPerformanceOrchestrator.updatePerformanceProfile('reasoningEngine', taskInfo.type, profile);
      }
      
      this.logger.debug(`Profiled task performance for ${taskId}`, {
        executionTime,
        performanceRatio
      });
      
      return profile;
    } catch (error) {
      this.logger.error(`Failed to profile task performance: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Gets statistics about the performance optimizer.
   * 
   * @returns {Promise<Object>} - Optimizer statistics
   */
  async getStatistics() {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_getStatistics");
    }

    try {
      // Get cache statistics
      const cacheStats = {
        size: this.resultCache.size,
        maxSize: this.maxCacheSize,
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRatio: this.cacheHits + this.cacheMisses > 0 ? 
          this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
      };
      
      // Get resource usage
      const resourceUsage = {};
      
      for (const [resourceType, usage] of this.resourceUsage.entries()) {
        resourceUsage[resourceType] = usage;
      }
      
      // Get running tasks count
      const runningTasksCount = this.runningTasks.size;
      
      // Get allocated resources count
      const allocatedResourcesCount = this.allocatedResources.size;
      
      // Get performance profiles count
      const performanceProfilesCount = this.taskPerformanceProfiles.size;
      
      // Compile statistics
      const statistics = {
        cacheStats,
        resourceUsage,
        runningTasksCount,
        allocatedResourcesCount,
        performanceProfilesCount,
        systemResources: this.systemResources,
        configuration: {
          maxCacheSize: this.maxCacheSize,
          maxCacheAge: this.maxCacheAge,
          enableParallelExecution: this.enableParallelExecution,
          maxParallelTasks: this.maxParallelTasks,
          resourceThrottlingThreshold: this.resourceThrottlingThreshold,
          performanceProfilingEnabled: this.performanceProfilingEnabled,
          adaptiveOptimizationEnabled: this.adaptiveOptimizationEnabled,
          systemTier: this.systemTier
        }
      };
      
      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Cleans up resources and cache.
   * 
   * @param {Object} [options] - Cleanup options
   * @param {boolean} [options.clearCache] - Whether to clear cache
   * @param {boolean} [options.releaseAllResources] - Whether to release all resources
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanup(options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("performanceOptimizer_cleanup");
    }

    try {
      const clearCache = options.clearCache !== undefined ? options.clearCache : false;
      const releaseAllResources = options.releaseAllResources !== undefined ? options.releaseAllResources : false;
      
      let cacheEntriesRemoved = 0;
      let resourcesReleased = 0;
      
      // Clear cache if requested
      if (clearCache) {
        cacheEntriesRemoved = this.resultCache.size;
        this.resultCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
      }
      
      // Release all resources if requested
      if (releaseAllResources) {
        const taskIds = Array.from(this.allocatedResources.keys());
        
        for (const taskId of taskIds) {
          await this.releaseResources(taskId);
          resourcesReleased++;
        }
        
        // Reset resource usage
        for (const resourceType of this.resourceUsage.keys()) {
          this.resourceUsage.set(resourceType, 0);
        }
        
        // Clear running tasks
        this.runningTasks.clear();
      }
      
      this.logger.debug(`Cleaned up performance optimizer`, { 
        cacheEntriesRemoved,
        resourcesReleased
      });
      
      return {
        cacheEntriesRemoved,
        resourcesReleased
      };
    } catch (error) {
      this.logger.error(`Failed to clean up: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

module.exports = { PerformanceOptimizer };
