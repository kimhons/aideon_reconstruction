/**
 * @fileoverview Implementation of the ResourcePreallocator class and related components
 * for the Predictive Intelligence Engine.
 * 
 * @module core/predictive/ResourcePreallocator
 */

const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

// --- Mock Dependencies (Replace with actual implementations or imports) ---

class MetricsCollector {
  recordMetric(name: string, data: any) {
    // console.log(`Metric: ${name}`, data);
  }
}

class Logger {
  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }
  debug(message: string, ...args: any[]) {
    // console.debug(`[DEBUG] ${message}`, ...args);
  }
  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

// --- Enums and Interfaces (from design) ---

enum ResourceType {
  MEMORY = "MEMORY",
  CPU = "CPU",
  GPU = "GPU",
  NETWORK_BANDWIDTH = "NETWORK_BANDWIDTH",
  DISK_IO = "DISK_IO",
  CACHE_SPACE = "CACHE_SPACE",
  CUSTOM = "CUSTOM"
}

enum AllocationStatus {
  PENDING = "PENDING",
  ALLOCATED = "ALLOCATED",
  ACTIVE = "ACTIVE",
  RELEASING = "RELEASING",
  RELEASED = "RELEASED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED"
}

interface RequestMetadata {
  createdAt: number;
  sourcePredictorId: string;
  triggeringPatternId?: string;
  targetApplication?: string;
  targetProcessId?: number;
  userId?: string;
  customProperties: Record<string, any>;
}

interface AllocationFeedback {
  usedSuccessfully: boolean;
  actualDuration?: number;
  actualAmountUsed?: number;
  reasonForRelease?: string;
}

interface ResourceAvailability {
  resourceType: ResourceType;
  total: number;
  available: number;
  used: number;
  predictedUsage?: number;
  timestamp: number;
}

interface IResourceRequest {
  requestId: string;
  resourceType: ResourceType;
  predictedNeed: number;
  confidence: number;
  priority: number;
  duration?: number;
  deadline?: number;
  metadata: RequestMetadata;
  associatedPredictionId?: string;
}

interface IResourceAllocation {
  allocationId: string;
  requestId: string;
  resourceType: ResourceType;
  allocatedAmount: number;
  status: AllocationStatus;
  allocatedAt: number;
  expiresAt?: number;
  actualUsage?: number;
  feedback?: AllocationFeedback;
}

interface IResourceMonitor {
  getResourceAvailability(type: ResourceType): Promise<ResourceAvailability>;
  subscribeToResourceChanges(type: ResourceType, callback: (availability: ResourceAvailability) => void): SubscriptionHandle;
  unsubscribe(handle: SubscriptionHandle): void;
}

interface SubscriptionHandle {
  id: string;
}

interface IAllocationStrategy {
  allocate(request: IResourceRequest, availability: ResourceAvailability): Promise<IResourceAllocation>;
  release(allocation: IResourceAllocation, feedback?: AllocationFeedback): Promise<boolean>;
  adjust?(allocation: IResourceAllocation, newAmount: number): Promise<boolean>;
}

interface PreallocatorStatistics {
  totalRequests: number;
  successfulAllocations: number;
  failedAllocations: number;
  averageAllocationTime: number;
  resourceHitRate: number;
  resourceWasteRate: number;
  allocationsByType: Record<ResourceType, number>;
}

interface PreallocatorConfig {
  id?: string;
  name?: string;
  description?: string;
  resourceMonitors?: Map<ResourceType, IResourceMonitor>;
  allocationStrategies?: Map<ResourceType, IAllocationStrategy>;
  eventEmitter?: EventEmitter;
  metrics?: MetricsCollector;
  logger?: Logger;
  predictor?: any; // IPredictor
  queueProcessingInterval?: number;
  expirationCheckInterval?: number;
  immediateProcessing?: boolean;
  [key: string]: any; // Allow additional config options
}

interface IResourcePreallocator {
  id: string;
  name: string;
  description: string;
  eventEmitter: EventEmitter;
  
  initialize(config: PreallocatorConfig): void;
  handlePrediction(prediction: any): Promise<void>; // IPrediction
  requestPreallocation(request: IResourceRequest): Promise<IResourceAllocation>;
  releaseAllocation(allocationId: string, feedback?: AllocationFeedback): Promise<boolean>;
  adjustAllocation(allocationId: string, newAmount: number): Promise<boolean>;
  getStatistics(): PreallocatorStatistics;
  reset(): void;
  on(eventName: string, listener: (...args: any[]) => void): void;
  off(eventName: string, listener: (...args: any[]) => void): void;
}

// --- Default Implementations (from design) ---

class MockResourceMonitor implements IResourceMonitor {
  private type: ResourceType;
  private total: number;
  private used: number;
  private logger: Logger;
  private subscriptions: Map<string, (availability: ResourceAvailability) => void>;
  private simulationInterval?: NodeJS.Timeout;
  
  constructor(type: ResourceType, total: number, logger?: Logger) {
    this.type = type;
    this.total = total;
    this.used = Math.random() * total * 0.5; // Start with some usage
    this.logger = logger || new Logger();
    this.subscriptions = new Map();
    this.logger.info(`MockResourceMonitor initialized for ${type} with total ${total}`);
    
    // Optional: Start simulation for subscriptions
    this.simulationInterval = setInterval(() => this.simulateUsageChange(), 5000);
  }
  
  async getResourceAvailability(): Promise<ResourceAvailability> {
    // Simulate usage fluctuations
    this.used += (Math.random() - 0.5) * this.total * 0.1;
    this.used = Math.max(0, Math.min(this.total, this.used));
    
    const availability: ResourceAvailability = {
      resourceType: this.type,
      total: this.total,
      available: this.total - this.used,
      used: this.used,
      timestamp: Date.now()
    };
    
    this.logger.debug(`Resource availability for ${this.type}: ${availability.available}/${this.total} available`);
    return availability;
  }
  
  subscribeToResourceChanges(type: ResourceType, callback: (availability: ResourceAvailability) => void): SubscriptionHandle {
    if (type !== this.type) {
      throw new Error(`Monitor type mismatch: ${type} vs ${this.type}`);
    }
    
    const id = uuidv4();
    this.subscriptions.set(id, callback);
    this.logger.debug(`New subscription ${id} for ${this.type} resource changes`);
    return { id };
  }
  
  unsubscribe(handle: SubscriptionHandle): void {
    this.subscriptions.delete(handle.id);
    this.logger.debug(`Unsubscribed ${handle.id} from ${this.type} resource changes`);
  }
  
  private simulateUsageChange(): void {
    if (this.subscriptions.size === 0) return;
    
    this.getResourceAvailability().then(availability => {
      for (const callback of this.subscriptions.values()) {
        try {
          callback(availability);
        } catch (error) {
          this.logger.error("Error in subscription callback", error);
        }
      }
    });
  }
  
  // Cleanup method for proper shutdown
  cleanup(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
  }
}

class MemoryAllocationStrategy implements IAllocationStrategy {
  private logger: Logger;
  
  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.logger.info("MemoryAllocationStrategy initialized");
  }
  
  async allocate(request: IResourceRequest, availability: ResourceAvailability): Promise<IResourceAllocation> {
    this.logger.debug(`Allocating ${request.predictedNeed}MB memory for request ${request.requestId}`);
    const allocationId = uuidv4();
    
    if (availability.available >= request.predictedNeed) {
      // Simulate allocation (e.g., reserve memory, adjust process priority)
      this.logger.debug(`Sufficient memory available: ${availability.available}MB >= ${request.predictedNeed}MB`);
      
      return {
        allocationId,
        requestId: request.requestId,
        resourceType: ResourceType.MEMORY,
        allocatedAmount: request.predictedNeed,
        status: AllocationStatus.ACTIVE,
        allocatedAt: Date.now(),
        expiresAt: request.duration ? Date.now() + request.duration : undefined
      };
    } else {
      this.logger.warn(`Insufficient memory available: ${availability.available}MB < ${request.predictedNeed}MB`);
      
      return {
        allocationId,
        requestId: request.requestId,
        resourceType: ResourceType.MEMORY,
        allocatedAmount: 0,
        status: AllocationStatus.FAILED,
        allocatedAt: Date.now()
      };
    }
  }
  
  async release(allocation: IResourceAllocation, feedback?: AllocationFeedback): Promise<boolean> {
    // Simulate release
    this.logger.debug(`Releasing ${allocation.allocatedAmount}MB memory (ID: ${allocation.allocationId})`);
    return true;
  }
  
  async adjust(allocation: IResourceAllocation, newAmount: number): Promise<boolean> {
    this.logger.debug(`Adjusting memory allocation ${allocation.allocationId} from ${allocation.allocatedAmount}MB to ${newAmount}MB`);
    // Simulate adjustment
    return true;
  }
}

class CPUAllocationStrategy implements IAllocationStrategy {
  private logger: Logger;
  
  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.logger.info("CPUAllocationStrategy initialized");
  }
  
  async allocate(request: IResourceRequest, availability: ResourceAvailability): Promise<IResourceAllocation> {
    this.logger.debug(`Allocating ${request.predictedNeed}% CPU for request ${request.requestId}`);
    const allocationId = uuidv4();
    
    if (availability.available >= request.predictedNeed) {
      // Simulate allocation (e.g., adjust process priority)
      this.logger.debug(`Sufficient CPU available: ${availability.available}% >= ${request.predictedNeed}%`);
      
      return {
        allocationId,
        requestId: request.requestId,
        resourceType: ResourceType.CPU,
        allocatedAmount: request.predictedNeed,
        status: AllocationStatus.ACTIVE,
        allocatedAt: Date.now(),
        expiresAt: request.duration ? Date.now() + request.duration : undefined
      };
    } else {
      this.logger.warn(`Insufficient CPU available: ${availability.available}% < ${request.predictedNeed}%`);
      
      return {
        allocationId,
        requestId: request.requestId,
        resourceType: ResourceType.CPU,
        allocatedAmount: 0,
        status: AllocationStatus.FAILED,
        allocatedAt: Date.now()
      };
    }
  }
  
  async release(allocation: IResourceAllocation, feedback?: AllocationFeedback): Promise<boolean> {
    // Simulate release
    this.logger.debug(`Releasing ${allocation.allocatedAmount}% CPU (ID: ${allocation.allocationId})`);
    return true;
  }
}

// --- Main Class Implementation (from design) ---

class ResourcePreallocator implements IResourcePreallocator {
  public id: string;
  public name: string;
  public description: string;
  public eventEmitter: EventEmitter;
  
  private config: PreallocatorConfig;
  private resourceMonitors: Map<ResourceType, IResourceMonitor>;
  private allocationStrategies: Map<ResourceType, IAllocationStrategy>;
  private activeAllocations: Map<string, IResourceAllocation>;
  private requestQueue: IResourceRequest[];
  private metrics: MetricsCollector;
  private logger: Logger;
  private predictor?: any; // IPredictor
  private queueProcessingInterval?: NodeJS.Timeout;
  private expirationCheckInterval?: NodeJS.Timeout;
  
  constructor(config: PreallocatorConfig) {
    this.id = config.id || uuidv4();
    this.name = config.name || "ResourcePreallocator";
    this.description = config.description || "Proactively allocates system resources based on predictions.";
    this.config = config;
    
    // Initialize dependencies
    this.logger = config.logger || new Logger();
    this.resourceMonitors = config.resourceMonitors || this.createDefaultMonitors();
    this.allocationStrategies = config.allocationStrategies || this.createDefaultStrategies();
    this.activeAllocations = new Map<string, IResourceAllocation>();
    this.requestQueue = [];
    this.eventEmitter = config.eventEmitter || new EventEmitter();
    this.metrics = config.metrics || new MetricsCollector();
    this.predictor = config.predictor;
    
    this.logger.info(`Constructing ResourcePreallocator: ${this.name} (ID: ${this.id})`);
    this.initialize(config);
  }
  
  initialize(config: PreallocatorConfig): void {
    this.logger.info(`Initializing ResourcePreallocator (ID: ${this.id})`);
    
    // Subscribe to predictions if predictor is provided
    if (this.predictor) {
      this.predictor.on("prediction:generated", this.handlePrediction.bind(this));
      this.logger.info(`Subscribed to predictions from predictor: ${this.predictor.id}`);
    }
    
    // Start processing the request queue periodically
    const queueInterval = this.config.queueProcessingInterval || 5000;
    this.queueProcessingInterval = setInterval(() => this.processQueue(), queueInterval);
    this.logger.debug(`Queue processing scheduled every ${queueInterval}ms`);
    
    // Start monitoring active allocations for expiration
    const expirationInterval = this.config.expirationCheckInterval || 60000;
    this.expirationCheckInterval = setInterval(() => this.checkExpiredAllocations(), expirationInterval);
    this.logger.debug(`Expiration checking scheduled every ${expirationInterval}ms`);
  }
  
  async handlePrediction(prediction: any): Promise<void> {
    this.logger.debug(`Received prediction: ${prediction.id}, Type: ${prediction.type}`);
    
    // Translate prediction into resource requests
    const requests = this.translatePredictionToRequests(prediction);
    
    for (const request of requests) {
      this.logger.info(`Generated resource request: ${request.requestId} for ${request.resourceType}`);
      // Add to queue for processing
      this.requestQueue.push(request);
      this.metrics.recordMetric("preallocation_request_generated", { 
        predictorId: request.metadata.sourcePredictorId, 
        resourceType: request.resourceType 
      });
    }
    
    // Optionally trigger immediate queue processing
    if (this.config.immediateProcessing) {
      this.processQueue();
    }
  }
  
  async requestPreallocation(request: IResourceRequest): Promise<IResourceAllocation> {
    this.logger.info(`Processing preallocation request: ${request.requestId} for ${request.resourceType}`);
    const strategy = this.allocationStrategies.get(request.resourceType);
    
    if (!strategy) {
      const error = `No allocation strategy found for resource type: ${request.resourceType}`;
      this.logger.error(error);
      throw new Error(error);
    }
    
    const monitor = this.resourceMonitors.get(request.resourceType);
    if (!monitor) {
      const error = `No resource monitor found for resource type: ${request.resourceType}`;
      this.logger.error(error);
      throw new Error(error);
    }
    
    try {
      const availability = await monitor.getResourceAvailability(request.resourceType);
      const allocation = await strategy.allocate(request, availability);
      
      if (allocation.status === AllocationStatus.ALLOCATED || allocation.status === AllocationStatus.ACTIVE) {
        this.activeAllocations.set(allocation.allocationId, allocation);
        this.logger.info(`Successfully preallocated ${allocation.allocatedAmount} of ${request.resourceType}, ID: ${allocation.allocationId}`);
        this.eventEmitter.emit("resource:allocated", allocation);
        this.metrics.recordMetric("resource_allocated", { 
          allocationId: allocation.allocationId, 
          resourceType: request.resourceType, 
          amount: allocation.allocatedAmount 
        });
      } else {
        this.logger.warn(`Preallocation failed or pending for request: ${request.requestId}, Status: ${allocation.status}`);
        this.metrics.recordMetric("preallocation_failed", { 
          requestId: request.requestId, 
          resourceType: request.resourceType 
        });
      }
      return allocation;
    } catch (error) {
      this.logger.error(`Error during preallocation for request ${request.requestId}:`, error);
      this.metrics.recordMetric("preallocation_error", { 
        requestId: request.requestId, 
        resourceType: request.resourceType 
      });
      throw error; // Re-throw error after logging
    }
  }
  
  async releaseAllocation(allocationId: string, feedback?: AllocationFeedback): Promise<boolean> {
    const allocation = this.activeAllocations.get(allocationId);
    if (!allocation) {
      this.logger.warn(`Attempted to release non-existent or inactive allocation: ${allocationId}`);
      return false;
    }
    
    this.logger.info(`Releasing allocation: ${allocationId} for ${allocation.resourceType}`);
    const strategy = this.allocationStrategies.get(allocation.resourceType);
    if (!strategy) {
      this.logger.error(`No allocation strategy found for resource type: ${allocation.resourceType}`);
      return false;
    }
    
    try {
      allocation.status = AllocationStatus.RELEASING;
      const success = await strategy.release(allocation, feedback);
      if (success) {
        allocation.status = AllocationStatus.RELEASED;
        allocation.feedback = feedback;
        this.activeAllocations.delete(allocationId);
        this.logger.info(`Successfully released allocation: ${allocationId}`);
        this.eventEmitter.emit("resource:released", allocation);
        this.metrics.recordMetric("resource_released", { 
          allocationId: allocation.allocationId, 
          resourceType: allocation.resourceType, 
          usedSuccessfully: feedback?.usedSuccessfully 
        });
        
        // Provide feedback to the predictor if applicable
        if (this.predictor && allocation.feedback && allocation.requestId) {
          // Find original request to get prediction ID
          // ... logic to map allocationId back to predictionId ...
          // this.predictor.updateModel({ predictionId: ..., actualOutcome: feedback, ... });
        }
      } else {
        allocation.status = AllocationStatus.ACTIVE; // Revert status if release failed
        this.logger.error(`Failed to release allocation: ${allocationId}`);
        this.metrics.recordMetric("release_failed", { allocationId: allocation.allocationId });
      }
      return success;
    } catch (error) {
      this.logger.error(`Error during release for allocation ${allocationId}:`, error);
      allocation.status = AllocationStatus.ACTIVE; // Revert status on error
      this.metrics.recordMetric("release_error", { allocationId: allocation.allocationId });
      return false;
    }
  }
  
  async adjustAllocation(allocationId: string, newAmount: number): Promise<boolean> {
    const allocation = this.activeAllocations.get(allocationId);
    if (!allocation) {
      this.logger.warn(`Attempted to adjust non-existent or inactive allocation: ${allocationId}`);
      return false;
    }
    
    this.logger.info(`Adjusting allocation: ${allocationId} from ${allocation.allocatedAmount} to ${newAmount}`);
    const strategy = this.allocationStrategies.get(allocation.resourceType);
    if (!strategy || !strategy.adjust) {
      this.logger.error(`No adjustment support for resource type: ${allocation.resourceType}`);
      return false;
    }
    
    try {
      const success = await strategy.adjust(allocation, newAmount);
      if (success) {
        allocation.allocatedAmount = newAmount;
        this.logger.info(`Successfully adjusted allocation: ${allocationId} to ${newAmount}`);
        this.eventEmitter.emit("resource:adjusted", allocation);
        this.metrics.recordMetric("resource_adjusted", { 
          allocationId: allocation.allocationId, 
          resourceType: allocation.resourceType, 
          newAmount 
        });
      } else {
        this.logger.error(`Failed to adjust allocation: ${allocationId}`);
        this.metrics.recordMetric("adjustment_failed", { allocationId: allocation.allocationId });
      }
      return success;
    } catch (error) {
      this.logger.error(`Error during adjustment for allocation ${allocationId}:`, error);
      this.metrics.recordMetric("adjustment_error", { allocationId: allocation.allocationId });
      return false;
    }
  }
  
  getStatistics(): PreallocatorStatistics {
    // Basic implementation - requires tracking metrics
    const stats: PreallocatorStatistics = {
      totalRequests: 0,
      successfulAllocations: 0,
      failedAllocations: 0,
      averageAllocationTime: 0,
      resourceHitRate: 0,
      resourceWasteRate: 0,
      allocationsByType: {} as Record<ResourceType, number>
    };
    
    // Initialize allocationsByType with zeros
    Object.values(ResourceType).forEach(type => {
      stats.allocationsByType[type] = 0;
    });
    
    // Count active allocations by type
    for (const allocation of this.activeAllocations.values()) {
      stats.allocationsByType[allocation.resourceType]++;
    }
    
    this.logger.warn("getStatistics provides placeholder data - requires metrics integration.");
    return stats;
  }
  
  reset(): void {
    this.logger.info(`Resetting ResourcePreallocator (ID: ${this.id})`);
    
    // Release all active allocations
    const allocationIds = [...this.activeAllocations.keys()];
    for (const allocationId of allocationIds) {
      this.releaseAllocation(allocationId, { usedSuccessfully: false, reasonForRelease: "Reset" })
        .catch(err => this.logger.error(`Error releasing allocation ${allocationId} during reset:`, err));
    }
    
    this.requestQueue = [];
    this.activeAllocations.clear();
    this.eventEmitter.emit("preallocator:reset", { preallocatorId: this.id });
  }
  
  // --- Event Emitter Wrappers ---
  on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  off(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(eventName, listener);
  }
  
  // --- Private Methods ---
  
  private translatePredictionToRequests(prediction: any): IResourceRequest[] {
    const requests: IResourceRequest[] = [];
    this.logger.debug(`Translating prediction to resource requests: ${prediction.id} (${prediction.type})`);
    
    // Logic to determine resource needs based on prediction type and value
    switch (prediction.type) {
      case "USER_ACTION":
        if (prediction.predictedValue === "open_application") {
          // Example: Predict application launch resource needs
          const appName = prediction.metadata?.customProperties?.applicationName || "unknown";
          this.logger.debug(`Predicting resources for application launch: ${appName}`);
          
          // Memory request
          requests.push({
            requestId: uuidv4(),
            resourceType: ResourceType.MEMORY,
            predictedNeed: this.estimateApplicationMemoryNeed(appName),
            confidence: prediction.confidence,
            priority: 1,
            duration: 300000, // 5 minutes
            metadata: { 
              createdAt: Date.now(), 
              sourcePredictorId: prediction.metadata?.modelId || "unknown", 
              associatedPredictionId: prediction.id,
              targetApplication: appName,
              customProperties: {}
            }
          });
          
          // CPU request
          requests.push({
            requestId: uuidv4(),
            resourceType: ResourceType.CPU,
            predictedNeed: this.estimateApplicationCpuNeed(appName),
            confidence: prediction.confidence,
            priority: 1,
            duration: 30000, // 30 seconds burst
            metadata: { 
              createdAt: Date.now(), 
              sourcePredictorId: prediction.metadata?.modelId || "unknown", 
              associatedPredictionId: prediction.id,
              targetApplication: appName,
              customProperties: {}
            }
          });
        }
        break;
        
      case "RESOURCE_NEED":
        // Direct resource need prediction
        if (prediction.targetVariable === "memory_need") {
          requests.push({
            requestId: uuidv4(),
            resourceType: ResourceType.MEMORY,
            predictedNeed: Number(prediction.predictedValue) || 1024, // Default to 1GB if not numeric
            confidence: prediction.confidence,
            priority: 2,
            duration: prediction.metadata?.customProperties?.duration || 60000, // 1 minute default
            metadata: { 
              createdAt: Date.now(), 
              sourcePredictorId: prediction.metadata?.modelId || "unknown", 
              associatedPredictionId: prediction.id,
              customProperties: {}
            }
          });
        }
        break;
        
      case "AVAILABILITY":
        // Availability predictions might trigger preemptive resource allocation
        if (prediction.predictedValue === "low" && prediction.confidence > 0.8) {
          // Example: Reserve some memory if we predict low availability
          requests.push({
            requestId: uuidv4(),
            resourceType: ResourceType.MEMORY,
            predictedNeed: 512, // 512MB emergency buffer
            confidence: prediction.confidence,
            priority: 3, // Lower priority
            duration: 600000, // 10 minutes
            metadata: { 
              createdAt: Date.now(), 
              sourcePredictorId: prediction.metadata?.modelId || "unknown", 
              associatedPredictionId: prediction.id,
              customProperties: { reason: "low_availability_prediction" }
            }
          });
        }
        break;
    }
    
    this.logger.info(`Generated ${requests.length} resource requests from prediction ${prediction.id}`);
    return requests;
  }
  
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) {
      return;
    }
    
    this.logger.debug(`Processing request queue (${this.requestQueue.length} items)`);
    
    // Prioritize requests (e.g., by confidence, priority, deadline)
    const sortedQueue = this.requestQueue.sort((a, b) => 
      b.priority - a.priority || // Higher priority first
      b.confidence - a.confidence || // Higher confidence next
      (a.deadline || Infinity) - (b.deadline || Infinity) // Earlier deadline last
    );
    
    this.requestQueue = []; // Clear queue, will re-add failed/pending ones
    
    for (const request of sortedQueue) {
      try {
        const allocation = await this.requestPreallocation(request);
        if (allocation.status === AllocationStatus.PENDING) {
          // Re-queue if pending (e.g., waiting for resources)
          this.requestQueue.push(request);
        }
      } catch (error) {
        this.logger.error(`Failed to process request ${request.requestId} from queue:`, error);
        // Optionally re-queue with lower priority or discard
        if (request.priority > 1) {
          request.priority--; // Lower priority for retry
          this.requestQueue.push(request);
        }
      }
    }
  }
  
  private checkExpiredAllocations(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [id, allocation] of this.activeAllocations.entries()) {
      if (allocation.expiresAt && allocation.expiresAt <= now) {
        this.logger.info(`Allocation ${id} expired. Releasing.`);
        this.releaseAllocation(id, { usedSuccessfully: false, reasonForRelease: "Expired" })
          .catch(err => this.logger.error(`Error releasing expired allocation ${id}:`, err));
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.logger.debug(`Released ${expiredCount} expired allocations`);
    }
  }
  
  private createDefaultMonitors(): Map<ResourceType, IResourceMonitor> {
    const monitors = new Map<ResourceType, IResourceMonitor>();
    
    // Create mock monitors for common resource types
    monitors.set(ResourceType.MEMORY, new MockResourceMonitor(ResourceType.MEMORY, 16384, this.logger)); // 16GB RAM
    monitors.set(ResourceType.CPU, new MockResourceMonitor(ResourceType.CPU, 100, this.logger)); // 100% CPU
    monitors.set(ResourceType.DISK_IO, new MockResourceMonitor(ResourceType.DISK_IO, 500, this.logger)); // 500MB/s
    monitors.set(ResourceType.NETWORK_BANDWIDTH, new MockResourceMonitor(ResourceType.NETWORK_BANDWIDTH, 100, this.logger)); // 100Mbps
    
    this.logger.info(`Created default resource monitors for ${monitors.size} resource types`);
    return monitors;
  }
  
  private createDefaultStrategies(): Map<ResourceType, IAllocationStrategy> {
    const strategies = new Map<ResourceType, IAllocationStrategy>();
    
    // Create strategies for common resource types
    strategies.set(ResourceType.MEMORY, new MemoryAllocationStrategy(this.logger));
    strategies.set(ResourceType.CPU, new CPUAllocationStrategy(this.logger));
    
    // For other types, use generic strategies or specialized ones as needed
    // strategies.set(ResourceType.DISK_IO, new DiskIOAllocationStrategy());
    // strategies.set(ResourceType.NETWORK_BANDWIDTH, new NetworkBandwidthAllocationStrategy());
    
    this.logger.info(`Created default allocation strategies for ${strategies.size} resource types`);
    return strategies;
  }
  
  // --- Helper Methods ---
  
  private estimateApplicationMemoryNeed(appName: string): number {
    // Simple lookup table for common applications
    const memoryEstimates: Record<string, number> = {
      "browser": 2048, // 2GB
      "photoshop": 4096, // 4GB
      "ide": 1536, // 1.5GB
      "office": 1024, // 1GB
      "default": 512 // 512MB
    };
    
    // Normalize app name for lookup
    const normalizedName = appName.toLowerCase();
    for (const [key, value] of Object.entries(memoryEstimates)) {
      if (normalizedName.includes(key)) {
        return value;
      }
    }
    
    return memoryEstimates.default;
  }
  
  private estimateApplicationCpuNeed(appName: string): number {
    // Simple lookup table for common applications (percentage of CPU)
    const cpuEstimates: Record<string, number> = {
      "browser": 30,
      "photoshop": 50,
      "ide": 25,
      "office": 15,
      "default": 10
    };
    
    // Normalize app name for lookup
    const normalizedName = appName.toLowerCase();
    for (const [key, value] of Object.entries(cpuEstimates)) {
      if (normalizedName.includes(key)) {
        return value;
      }
    }
    
    return cpuEstimates.default;
  }
  
  // --- Cleanup Method ---
  
  cleanup(): void {
    this.logger.info(`Cleaning up ResourcePreallocator (ID: ${this.id})`);
    
    // Clear intervals
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
    }
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
    
    // Release all allocations
    this.reset();
    
    // Clean up monitors if they have cleanup methods
    for (const monitor of this.resourceMonitors.values()) {
      if ((monitor as any).cleanup) {
        (monitor as any).cleanup();
      }
    }
  }
}

module.exports = {
  ResourcePreallocator,
  ResourceType,
  AllocationStatus,
  MockResourceMonitor,
  MemoryAllocationStrategy,
  CPUAllocationStrategy
  // Export other necessary classes/interfaces/enums
};
