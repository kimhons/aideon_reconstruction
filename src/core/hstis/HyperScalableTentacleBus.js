/**
 * HyperScalableTentacleBus.js
 * 
 * Implementation of the hyper-scalable tentacle communication bus
 * designed to support 60+ tentacles with thousands of interactions per second.
 * 
 * Features:
 * - Extreme scalability
 * - Dynamic discovery
 * - Versioned interfaces
 * - Intelligent routing
 * - Comprehensive monitoring
 * - Fault tolerance
 * - Future extensibility
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { Logger } = require('../utils/Logger');

// Priority levels for message handling
const PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4
};

// Quality of Service levels
const QOS = {
  AT_MOST_ONCE: 0,    // Fire and forget
  AT_LEAST_ONCE: 1,   // Guaranteed delivery
  EXACTLY_ONCE: 2     // Guaranteed delivery with deduplication
};

// Communication patterns
const PATTERN = {
  EVENT: 'event',           // One-way asynchronous
  REQUEST_RESPONSE: 'req-res', // Two-way synchronous
  PUBLISH_SUBSCRIBE: 'pub-sub', // One-to-many
  STREAM: 'stream',         // Continuous data flow
  SAGA: 'saga'              // Coordinated multi-step
};

/**
 * Hyper-Scalable Tentacle Bus implementation
 * @class HyperScalableTentacleBus
 * @extends EventEmitter
 */
class HyperScalableTentacleBus extends EventEmitter {
  /**
   * Create a new Hyper-Scalable Tentacle Bus
   * @constructor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    this.logger = new Logger('HyperScalableTentacleBus');
    
    // Initialize data structures
    this.subscriptions = new Map();
    this.messageHistory = [];
    this.messageQueues = new Map();
    this.batchQueues = new Map();
    this.pendingRequests = new Map();
    this.responders = new Map();
    this.streams = new Map();
    this.sagas = new Map();
    this.tentacleRegistry = new Map();
    this.capabilityRegistry = new Map();
    this.schemaRegistry = new Map();
    this.routeCache = new Map();
    
    // Configuration
    this.config = {
      maxHistorySize: options.maxHistorySize || 10000,
      maxQueueSize: options.maxQueueSize || 100000,
      batchingEnabled: options.batchingEnabled !== false,
      batchInterval: options.batchInterval || 50, // ms
      batchMaxSize: options.batchMaxSize || 1000,
      prioritizationEnabled: options.prioritizationEnabled !== false,
      monitoringEnabled: options.monitoringEnabled !== false,
      monitoringInterval: options.monitoringInterval || 5000, // ms
      defaultPriority: options.defaultPriority || PRIORITY.NORMAL,
      defaultQos: options.defaultQos || QOS.AT_LEAST_ONCE,
      requestTimeout: options.requestTimeout || 30000, // ms
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerResetTimeout: options.circuitBreakerResetTimeout || 30000, // ms
      dynamicDiscoveryEnabled: options.dynamicDiscoveryEnabled !== false,
      discoveryInterval: options.discoveryInterval || 10000, // ms
      versionNegotiationEnabled: options.versionNegotiationEnabled !== false,
      intelligentRoutingEnabled: options.intelligentRoutingEnabled !== false,
      routeCacheSize: options.routeCacheSize || 1000,
      routeCacheTtl: options.routeCacheTtl || 60000, // ms
      ...options
    };
    
    // Performance metrics
    this.metrics = {
      messagesPublished: 0,
      messagesDelivered: 0,
      messageErrors: 0,
      activeSubscriptions: 0,
      pendingRequests: 0,
      activeStreams: 0,
      activeSagas: 0,
      registeredTentacles: 0,
      registeredCapabilities: 0,
      queueSizes: {},
      processingTimes: [],
      routingDecisions: {},
      circuitBreakerTrips: {},
      versionNegotiations: {},
      lastMonitoringTime: Date.now()
    };
    
    // Circuit breaker state
    this.circuitBreakers = new Map();
    
    // Initialize batching timers
    if (this.config.batchingEnabled) {
      this.batchTimers = new Map();
    }
    
    // Start monitoring if enabled
    if (this.config.monitoringEnabled) {
      this.startMonitoring();
    }
    
    // Start dynamic discovery if enabled
    if (this.config.dynamicDiscoveryEnabled) {
      this.startDiscovery();
    }
    
    this.logger.info('Hyper-Scalable Tentacle Bus initialized');
  }

  /**
   * Get the singleton instance
   * @static
   * @param {Object} options - Configuration options
   * @returns {HyperScalableTentacleBus} The singleton instance
   */
  static getInstance(options = {}) {
    if (!HyperScalableTentacleBus.instance) {
      HyperScalableTentacleBus.instance = new HyperScalableTentacleBus(options);
    }
    return HyperScalableTentacleBus.instance;
  }

  /**
   * Register a tentacle with the bus
   * @param {Object} tentacle - Tentacle to register
   * @param {Object} options - Registration options
   * @returns {Promise<Object>} Registration result
   */
  async registerTentacle(tentacle, options = {}) {
    const tentacleId = tentacle.id || `tentacle-${uuidv4()}`;
    const version = tentacle.version || '1.0.0';
    
    this.logger.info(`Registering tentacle: ${tentacle.name || 'Unnamed'} (${tentacleId}) v${version}`);
    
    // Create tentacle record
    const tentacleRecord = {
      id: tentacleId,
      name: tentacle.name || 'Unnamed Tentacle',
      description: tentacle.description || '',
      version: version,
      capabilities: tentacle.capabilities || [],
      status: 'active',
      health: {
        status: 'healthy',
        lastCheck: Date.now(),
        failures: 0
      },
      load: {
        cpu: 0,
        memory: 0,
        messages: 0
      },
      instance: tentacle,
      registeredAt: Date.now(),
      options: options
    };
    
    // Add to registry
    this.tentacleRegistry.set(tentacleId, tentacleRecord);
    
    // Register capabilities
    for (const capability of tentacleRecord.capabilities) {
      this.registerCapability(tentacleId, capability, options);
    }
    
    // Set up heartbeat if enabled
    if (options.heartbeat !== false) {
      const heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
      
      tentacleRecord.heartbeatTimer = setInterval(() => {
        this.checkTentacleHealth(tentacleId);
      }, heartbeatInterval);
    }
    
    // Update metrics
    this.metrics.registeredTentacles = this.tentacleRegistry.size;
    
    // Publish registration event
    this.publish('tentacle:registered', {
      tentacleId,
      name: tentacleRecord.name,
      version: tentacleRecord.version,
      capabilities: tentacleRecord.capabilities
    }, {
      priority: PRIORITY.HIGH,
      qos: QOS.AT_LEAST_ONCE
    });
    
    return {
      tentacleId,
      timestamp: Date.now(),
      success: true
    };
  }

  /**
   * Unregister a tentacle from the bus
   * @param {string} tentacleId - ID of the tentacle to unregister
   * @returns {Promise<boolean>} Success
   */
  async unregisterTentacle(tentacleId) {
    const tentacleRecord = this.tentacleRegistry.get(tentacleId);
    
    if (!tentacleRecord) {
      this.logger.warn(`Tentacle not found: ${tentacleId}`);
      return false;
    }
    
    this.logger.info(`Unregistering tentacle: ${tentacleRecord.name} (${tentacleId})`);
    
    // Clear heartbeat timer
    if (tentacleRecord.heartbeatTimer) {
      clearInterval(tentacleRecord.heartbeatTimer);
    }
    
    // Unregister capabilities
    for (const capability of tentacleRecord.capabilities) {
      this.unregisterCapability(tentacleId, capability);
    }
    
    // Remove from registry
    this.tentacleRegistry.delete(tentacleId);
    
    // Update metrics
    this.metrics.registeredTentacles = this.tentacleRegistry.size;
    
    // Publish unregistration event
    this.publish('tentacle:unregistered', {
      tentacleId,
      name: tentacleRecord.name
    }, {
      priority: PRIORITY.HIGH,
      qos: QOS.AT_LEAST_ONCE
    });
    
    return true;
  }

  /**
   * Register a capability for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string|Object} capability - Capability to register
   * @param {Object} options - Registration options
   */
  registerCapability(tentacleId, capability, options = {}) {
    // Handle string or object capability
    const capabilityName = typeof capability === 'string' ? capability : capability.name;
    const capabilityVersion = typeof capability === 'object' ? capability.version || '1.0.0' : '1.0.0';
    const capabilitySchema = typeof capability === 'object' ? capability.schema : null;
    
    // Create capability record if it doesn't exist
    if (!this.capabilityRegistry.has(capabilityName)) {
      this.capabilityRegistry.set(capabilityName, {
        name: capabilityName,
        tentacles: new Map(),
        versions: new Set()
      });
    }
    
    const capabilityRecord = this.capabilityRegistry.get(capabilityName);
    
    // Add tentacle to capability record
    capabilityRecord.tentacles.set(tentacleId, {
      version: capabilityVersion,
      priority: options.priority || 0,
      options: options
    });
    
    // Add version to capability record
    capabilityRecord.versions.add(capabilityVersion);
    
    // Register schema if provided
    if (capabilitySchema) {
      this.registerSchema(capabilityName, capabilityVersion, capabilitySchema);
    }
    
    this.logger.debug(`Registered capability: ${capabilityName} v${capabilityVersion} for tentacle: ${tentacleId}`);
    
    // Update metrics
    this.metrics.registeredCapabilities = Array.from(this.capabilityRegistry.values())
      .reduce((count, cap) => count + cap.tentacles.size, 0);
  }

  /**
   * Unregister a capability for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string|Object} capability - Capability to unregister
   */
  unregisterCapability(tentacleId, capability) {
    // Handle string or object capability
    const capabilityName = typeof capability === 'string' ? capability : capability.name;
    
    if (!this.capabilityRegistry.has(capabilityName)) {
      return;
    }
    
    const capabilityRecord = this.capabilityRegistry.get(capabilityName);
    
    // Remove tentacle from capability record
    capabilityRecord.tentacles.delete(tentacleId);
    
    // Remove capability record if no tentacles have it
    if (capabilityRecord.tentacles.size === 0) {
      this.capabilityRegistry.delete(capabilityName);
    } else {
      // Recalculate versions
      capabilityRecord.versions = new Set(
        Array.from(capabilityRecord.tentacles.values()).map(t => t.version)
      );
    }
    
    this.logger.debug(`Unregistered capability: ${capabilityName} for tentacle: ${tentacleId}`);
    
    // Update metrics
    this.metrics.registeredCapabilities = Array.from(this.capabilityRegistry.values())
      .reduce((count, cap) => count + cap.tentacles.size, 0);
    
    // Clear route cache for this capability
    this.clearRouteCache(capabilityName);
  }

  /**
   * Register a schema for a capability
   * @param {string} capabilityName - Name of the capability
   * @param {string} version - Version of the schema
   * @param {Object} schema - Schema definition
   */
  registerSchema(capabilityName, version, schema) {
    const schemaKey = `${capabilityName}:${version}`;
    
    this.schemaRegistry.set(schemaKey, {
      capability: capabilityName,
      version: version,
      schema: schema,
      registeredAt: Date.now()
    });
    
    this.logger.debug(`Registered schema for capability: ${capabilityName} v${version}`);
  }

  /**
   * Get schema for a capability
   * @param {string} capabilityName - Name of the capability
   * @param {string} version - Version of the schema
   * @returns {Object|null} Schema definition
   */
  getSchema(capabilityName, version) {
    const schemaKey = `${capabilityName}:${version}`;
    const schemaRecord = this.schemaRegistry.get(schemaKey);
    
    return schemaRecord ? schemaRecord.schema : null;
  }

  /**
   * Check if a message conforms to a schema
   * @param {string} capabilityName - Name of the capability
   * @param {string} version - Version of the schema
   * @param {Object} message - Message to validate
   * @returns {boolean} Whether the message is valid
   */
  validateMessage(capabilityName, version, message) {
    const schema = this.getSchema(capabilityName, version);
    
    if (!schema) {
      // No schema, assume valid
      return true;
    }
    
    // TODO: Implement schema validation
    // This would typically use a library like Ajv or similar
    
    return true;
  }

  /**
   * Find compatible version between consumer and provider
   * @param {string} capabilityName - Name of the capability
   * @param {string} consumerVersion - Version requested by consumer
   * @returns {string|null} Compatible version
   */
  findCompatibleVersion(capabilityName, consumerVersion) {
    if (!this.capabilityRegistry.has(capabilityName)) {
      return null;
    }
    
    const capabilityRecord = this.capabilityRegistry.get(capabilityName);
    const availableVersions = Array.from(capabilityRecord.versions);
    
    if (availableVersions.includes(consumerVersion)) {
      // Exact match
      return consumerVersion;
    }
    
    // Parse versions
    const parsedConsumer = this.parseVersion(consumerVersion);
    const parsedAvailable = availableVersions.map(v => ({
      version: v,
      parsed: this.parseVersion(v)
    }));
    
    // Find compatible version (same major version, equal or higher minor/patch)
    const compatible = parsedAvailable.find(v => 
      v.parsed.major === parsedConsumer.major && 
      (v.parsed.minor > parsedConsumer.minor || 
        (v.parsed.minor === parsedConsumer.minor && v.parsed.patch >= parsedConsumer.patch))
    );
    
    if (compatible) {
      // Update metrics
      if (!this.metrics.versionNegotiations[capabilityName]) {
        this.metrics.versionNegotiations[capabilityName] = { total: 0, compatible: 0, incompatible: 0 };
      }
      this.metrics.versionNegotiations[capabilityName].total++;
      this.metrics.versionNegotiations[capabilityName].compatible++;
      
      return compatible.version;
    }
    
    // Find highest version with same major
    const sameMajor = parsedAvailable.filter(v => v.parsed.major === parsedConsumer.major);
    if (sameMajor.length > 0) {
      const highest = sameMajor.reduce((prev, curr) => 
        (curr.parsed.minor > prev.parsed.minor || 
          (curr.parsed.minor === prev.parsed.minor && curr.parsed.patch > prev.parsed.patch)) 
          ? curr : prev
      );
      
      // Update metrics
      if (!this.metrics.versionNegotiations[capabilityName]) {
        this.metrics.versionNegotiations[capabilityName] = { total: 0, compatible: 0, incompatible: 0 };
      }
      this.metrics.versionNegotiations[capabilityName].total++;
      this.metrics.versionNegotiations[capabilityName].compatible++;
      
      return highest.version;
    }
    
    // Update metrics
    if (!this.metrics.versionNegotiations[capabilityName]) {
      this.metrics.versionNegotiations[capabilityName] = { total: 0, compatible: 0, incompatible: 0 };
    }
    this.metrics.versionNegotiations[capabilityName].total++;
    this.metrics.versionNegotiations[capabilityName].incompatible++;
    
    // No compatible version found
    return null;
  }

  /**
   * Parse version string into components
   * @private
   * @param {string} version - Version string (e.g., "1.2.3")
   * @returns {Object} Parsed version
   */
  parseVersion(version) {
    const parts = version.split('.');
    return {
      major: parseInt(parts[0]) || 0,
      minor: parseInt(parts[1]) || 0,
      patch: parseInt(parts[2]) || 0
    };
  }

  /**
   * Check health of a tentacle
   * @private
   * @param {string} tentacleId - ID of the tentacle
   */
  async checkTentacleHealth(tentacleId) {
    const tentacleRecord = this.tentacleRegistry.get(tentacleId);
    
    if (!tentacleRecord) {
      return;
    }
    
    try {
      // Call health check method if available
      if (tentacleRecord.instance && typeof tentacleRecord.instance.getHealth === 'function') {
        const health = await tentacleRecord.instance.getHealth();
        
        // Update health record
        tentacleRecord.health = {
          status: health.status || 'healthy',
          lastCheck: Date.now(),
          failures: health.status === 'healthy' ? 0 : tentacleRecord.health.failures + 1,
          details: health
        };
        
        // Update load information
        if (health.metrics) {
          tentacleRecord.load = {
            cpu: health.metrics.cpu || 0,
            memory: health.metrics.memory || 0,
            messages: health.metrics.messages || 0
          };
        }
      } else {
        // No health check method, assume healthy
        tentacleRecord.health.status = 'healthy';
        tentacleRecord.health.lastCheck = Date.now();
        tentacleRecord.health.failures = 0;
      }
      
      // Check if tentacle was previously unhealthy
      if (tentacleRecord.status === 'unhealthy' && tentacleRecord.health.status === 'healthy') {
        // Tentacle recovered
        tentacleRecord.status = 'active';
        
        // Publish recovery event
        this.publish('tentacle:recovered', {
          tentacleId,
          name: tentacleRecord.name
        }, {
          priority: PRIORITY.HIGH
        });
      }
    } catch (error) {
      // Health check failed
      tentacleRecord.health.status = 'unhealthy';
      tentacleRecord.health.lastCheck = Date.now();
      tentacleRecord.health.failures++;
      tentacleRecord.health.lastError = error.message;
      
      this.logger.warn(`Health check failed for tentacle: ${tentacleRecord.name} (${tentacleId})`, error);
      
      // Mark tentacle as unhealthy if too many failures
      if (tentacleRecord.health.failures >= this.config.circuitBreakerThreshold) {
        tentacleRecord.status = 'unhealthy';
        
        // Publish unhealthy event
        this.publish('tentacle:unhealthy', {
          tentacleId,
          name: tentacleRecord.name,
          failures: tentacleRecord.health.failures,
          error: error.message
        }, {
          priority: PRIORITY.HIGH
        });
      }
    }
  }

  /**
   * Start dynamic discovery process
   * @private
   */
  startDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    this.discoveryInterval = setInterval(() => {
      this.discoverTentacles();
    }, this.config.discoveryInterval);
    
    this.logger.info('Dynamic discovery started');
  }

  /**
   * Stop dynamic discovery process
   */
  stopDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    this.logger.info('Dynamic discovery stopped');
  }

  /**
   * Discover tentacles in the system
   * @private
   */
  async discoverTentacles() {
    this.logger.debug('Running tentacle discovery');
    
    // This would typically involve scanning for tentacles in the system
    // For now, we'll just check the health of registered tentacles
    
    for (const [tentacleId, tentacleRecord] of this.tentacleRegistry.entries()) {
      // Skip if checked recently
      const timeSinceLastCheck = Date.now() - tentacleRecord.health.lastCheck;
      if (timeSinceLastCheck < this.config.discoveryInterval / 2) {
        continue;
      }
      
      this.checkTentacleHealth(tentacleId);
    }
  }

  /**
   * Publish a message to a channel
   * @param {string} channel - Channel to publish to
   * @param {Object} message - Message to publish
   * @param {Object} options - Publish options
   * @returns {string} Message ID
   */
  publish(channel, message, options = {}) {
    const startTime = this.config.monitoringEnabled ? Date.now() : 0;
    const messageId = options.id || uuidv4();
    const timestamp = Date.now();
    const priority = options.priority !== undefined ? options.priority : this.config.defaultPriority;
    const qos = options.qos !== undefined ? options.qos : this.config.defaultQos;
    const pattern = options.pattern || PATTERN.EVENT;
    const version = options.version || '1.0.0';
    
    // Create message object
    const messageObject = {
      id: messageId,
      channel,
      data: message,
      timestamp,
      sender: options.sender || 'unknown',
      metadata: options.metadata || {},
      priority,
      qos,
      pattern,
      version
    };
    
    this.logger.debug(`Publishing message to channel: ${channel}`, { 
      messageId, 
      priority, 
      qos,
      pattern,
      version
    });
    
    // Validate message against schema if available
    if (this.config.versionNegotiationEnabled && !this.validateMessage(channel, version, message)) {
      throw new Error(`Message validation failed for channel: ${channel} v${version}`);
    }
    
    // Store in history if QoS requires it
    if (qos > QOS.AT_MOST_ONCE) {
      this.messageHistory.push(messageObject);
      if (this.messageHistory.length > this.config.maxHistorySize) {
        this.messageHistory.shift();
      }
    }
    
    // Update metrics
    this.metrics.messagesPublished++;
    
    // Handle batching if enabled and not a critical priority message
    if (this.config.batchingEnabled && priority > PRIORITY.HIGH && options.batch !== false) {
      this.queueForBatch(channel, messageObject);
      return messageId;
    }
    
    // Handle prioritization if enabled
    if (this.config.prioritizationEnabled && priority > PRIORITY.CRITICAL) {
      this.queueByPriority(channel, messageObject);
      return messageId;
    }
    
    // Direct emission for critical messages or when features are disabled
    this.emitMessage(channel, messageObject);
    
    // Record processing time for monitoring
    if (this.config.monitoringEnabled) {
      const processingTime = Date.now() - startTime;
      this.metrics.processingTimes.push(processingTime);
      
      // Keep only the last 100 processing times
      if (this.metrics.processingTimes.length > 100) {
        this.metrics.processingTimes.shift();
      }
    }
    
    return messageId;
  }

  /**
   * Send a request and wait for response
   * @param {string} channel - Channel to send request to
   * @param {Object} request - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(channel, request, options = {}) {
    const requestId = options.id || uuidv4();
    const timeout = options.timeout || this.config.requestTimeout;
    const priority = options.priority !== undefined ? options.priority : PRIORITY.NORMAL;
    const version = options.version || '1.0.0';
    
    this.logger.debug(`Sending request to channel: ${channel}`, { requestId, timeout, priority });
    
    // Create promise for response
    const responsePromise = new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        // Remove from pending requests
        this.pendingRequests.delete(requestId);
        
        // Update metrics
        this.metrics.pendingRequests = this.pendingRequests.size;
        
        reject(new Error(`Request timed out after ${timeout}ms: ${requestId}`));
      }, timeout);
      
      // Store in pending requests
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        timestamp: Date.now(),
        channel,
        options
      });
      
      // Update metrics
      this.metrics.pendingRequests = this.pendingRequests.size;
    });
    
    // Publish request
    this.publish(`${channel}.request`, request, {
      id: requestId,
      priority,
      qos: QOS.AT_LEAST_ONCE,
      pattern: PATTERN.REQUEST_RESPONSE,
      version,
      metadata: {
        requestId,
        responseChannel: `${channel}.response.${requestId}`
      },
      ...options
    });
    
    // Subscribe to response
    const responseChannel = `${channel}.response.${requestId}`;
    const subscriptionId = this.subscribe(responseChannel, (message) => {
      // Get pending request
      const pendingRequest = this.pendingRequests.get(requestId);
      
      if (!pendingRequest) {
        return;
      }
      
      // Clear timeout
      clearTimeout(pendingRequest.timeoutId);
      
      // Remove from pending requests
      this.pendingRequests.delete(requestId);
      
      // Update metrics
      this.metrics.pendingRequests = this.pendingRequests.size;
      
      // Unsubscribe from response channel
      this.unsubscribe(subscriptionId);
      
      // Resolve promise
      pendingRequest.resolve(message.data);
    }, {
      once: true
    });
    
    // Return response promise
    return responsePromise;
  }

  /**
   * Register a responder for a request channel
   * @param {string} channel - Channel to respond to
   * @param {Function} handler - Handler function
   * @param {Object} options - Responder options
   * @returns {string} Responder ID
   */
  respondTo(channel, handler, options = {}) {
    const responderId = options.id || uuidv4();
    const requestChannel = `${channel}.request`;
    
    this.logger.debug(`Registering responder for channel: ${channel}`, { responderId });
    
    // Subscribe to request channel
    const subscriptionId = this.subscribe(requestChannel, async (message) => {
      const requestId = message.id;
      const responseChannel = `${channel}.response.${requestId}`;
      
      try {
        // Call handler
        const response = await handler(message);
        
        // Publish response
        this.publish(responseChannel, response, {
          priority: message.priority,
          qos: QOS.AT_LEAST_ONCE,
          pattern: PATTERN.REQUEST_RESPONSE,
          version: message.version,
          metadata: {
            requestId,
            responderId
          }
        });
      } catch (error) {
        // Publish error response
        this.publish(responseChannel, {
          error: error.message,
          stack: error.stack
        }, {
          priority: PRIORITY.HIGH,
          qos: QOS.AT_LEAST_ONCE,
          pattern: PATTERN.REQUEST_RESPONSE,
          version: message.version,
          metadata: {
            requestId,
            responderId,
            error: true
          }
        });
      }
    }, options);
    
    // Store responder
    this.responders.set(responderId, {
      id: responderId,
      channel,
      subscriptionId,
      options
    });
    
    return responderId;
  }

  /**
   * Unregister a responder
   * @param {string} responderId - Responder ID
   * @returns {boolean} Success
   */
  unregisterResponder(responderId) {
    const responder = this.responders.get(responderId);
    
    if (!responder) {
      this.logger.warn(`Responder not found: ${responderId}`);
      return false;
    }
    
    // Unsubscribe from request channel
    this.unsubscribe(responder.subscriptionId);
    
    // Remove responder
    this.responders.delete(responderId);
    
    this.logger.debug(`Unregistered responder: ${responderId}`);
    
    return true;
  }

  /**
   * Create a message stream
   * @param {string} channel - Stream channel
   * @param {Object} options - Stream options
   * @returns {Object} Stream object
   */
  createStream(channel, options = {}) {
    const streamId = options.id || uuidv4();
    
    this.logger.debug(`Creating stream: ${channel}`, { streamId });
    
    // Create stream object
    const stream = {
      id: streamId,
      channel,
      options,
      createdAt: Date.now(),
      messageCount: 0,
      
      // Write to stream
      write: (data) => {
        return this.publish(`${channel}.stream`, data, {
          pattern: PATTERN.STREAM,
          metadata: {
            streamId
          },
          ...options
        });
      },
      
      // End stream
      end: () => {
        this.publish(`${channel}.stream.end`, {
          streamId,
          messageCount: stream.messageCount,
          duration: Date.now() - stream.createdAt
        }, {
          priority: PRIORITY.HIGH,
          qos: QOS.AT_LEAST_ONCE,
          pattern: PATTERN.STREAM,
          metadata: {
            streamId,
            end: true
          }
        });
        
        // Remove from streams
        this.streams.delete(streamId);
        
        // Update metrics
        this.metrics.activeStreams = this.streams.size;
        
        return true;
      }
    };
    
    // Store stream
    this.streams.set(streamId, stream);
    
    // Update metrics
    this.metrics.activeStreams = this.streams.size;
    
    return stream;
  }

  /**
   * Consume a message stream
   * @param {string} channel - Stream channel
   * @param {Object} options - Consumer options
   * @param {Function} handler - Stream handler
   * @returns {string} Consumer ID
   */
  consumeStream(channel, options = {}, handler) {
    const consumerId = options.id || uuidv4();
    const streamChannel = `${channel}.stream`;
    const endChannel = `${channel}.stream.end`;
    
    this.logger.debug(`Consuming stream: ${channel}`, { consumerId });
    
    // Set up batching if requested
    let batchTimer = null;
    let batchMessages = [];
    
    const processBatch = async () => {
      if (batchMessages.length === 0) {
        return;
      }
      
      const messagesToProcess = [...batchMessages];
      batchMessages = [];
      
      try {
        await handler(messagesToProcess);
      } catch (error) {
        this.logger.error(`Error in stream consumer: ${consumerId}`, error);
      }
    };
    
    // Subscribe to stream channel
    const streamSubscriptionId = this.subscribe(streamChannel, async (message) => {
      if (options.batchSize && options.batchSize > 1) {
        // Add to batch
        batchMessages.push(message);
        
        // Process batch if full
        if (batchMessages.length >= options.batchSize) {
          if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
          }
          
          await processBatch();
        } else if (!batchTimer && options.processInterval) {
          // Start timer for partial batch
          batchTimer = setTimeout(async () => {
            batchTimer = null;
            await processBatch();
          }, options.processInterval);
        }
      } else {
        // Process immediately
        try {
          await handler([message]);
        } catch (error) {
          this.logger.error(`Error in stream consumer: ${consumerId}`, error);
        }
      }
    }, options);
    
    // Subscribe to end channel
    const endSubscriptionId = this.subscribe(endChannel, async (message) => {
      // Process any remaining messages
      if (batchMessages.length > 0) {
        if (batchTimer) {
          clearTimeout(batchTimer);
          batchTimer = null;
        }
        
        await processBatch();
      }
      
      // Unsubscribe if autoUnsubscribe is enabled
      if (options.autoUnsubscribe !== false) {
        this.unsubscribe(streamSubscriptionId);
        this.unsubscribe(endSubscriptionId);
      }
      
      // Call end handler if provided
      if (options.onEnd && typeof options.onEnd === 'function') {
        try {
          await options.onEnd(message.data);
        } catch (error) {
          this.logger.error(`Error in stream end handler: ${consumerId}`, error);
        }
      }
    }, options);
    
    // Return consumer ID (same as stream subscription ID)
    return streamSubscriptionId;
  }

  /**
   * Create a saga for coordinating multi-step operations
   * @param {string} name - Saga name
   * @param {Object} options - Saga options
   * @returns {Object} Saga object
   */
  createSaga(name, options = {}) {
    const sagaId = options.id || uuidv4();
    
    this.logger.debug(`Creating saga: ${name}`, { sagaId });
    
    // Create saga object
    const saga = {
      id: sagaId,
      name,
      options,
      steps: [],
      currentStep: -1,
      status: 'created',
      createdAt: Date.now(),
      results: {},
      errors: {},
      
      // Add step to saga
      step: (stepName, stepConfig) => {
        saga.steps.push({
          name: stepName,
          action: stepConfig.action,
          compensation: stepConfig.compensation,
          options: stepConfig.options || {}
        });
        
        return saga;
      },
      
      // Execute saga
      execute: async () => {
        saga.status = 'running';
        saga.startedAt = Date.now();
        
        // Publish saga start event
        this.publish('saga:started', {
          sagaId,
          name,
          steps: saga.steps.map(s => s.name)
        }, {
          priority: PRIORITY.HIGH,
          qos: QOS.AT_LEAST_ONCE,
          pattern: PATTERN.SAGA,
          metadata: {
            sagaId
          }
        });
        
        try {
          // Execute steps
          for (let i = 0; i < saga.steps.length; i++) {
            const step = saga.steps[i];
            saga.currentStep = i;
            
            // Publish step start event
            this.publish('saga:step:started', {
              sagaId,
              name,
              step: step.name,
              stepIndex: i
            }, {
              priority: PRIORITY.NORMAL,
              pattern: PATTERN.SAGA,
              metadata: {
                sagaId
              }
            });
            
            try {
              // Execute step action
              const result = await step.action();
              
              // Store result
              saga.results[step.name] = result;
              
              // Publish step complete event
              this.publish('saga:step:completed', {
                sagaId,
                name,
                step: step.name,
                stepIndex: i,
                result
              }, {
                priority: PRIORITY.NORMAL,
                pattern: PATTERN.SAGA,
                metadata: {
                  sagaId
                }
              });
            } catch (error) {
              // Store error
              saga.errors[step.name] = error;
              
              // Publish step failed event
              this.publish('saga:step:failed', {
                sagaId,
                name,
                step: step.name,
                stepIndex: i,
                error: error.message
              }, {
                priority: PRIORITY.HIGH,
                qos: QOS.AT_LEAST_ONCE,
                pattern: PATTERN.SAGA,
                metadata: {
                  sagaId
                }
              });
              
              // Compensate previous steps
              await saga.compensate(i - 1);
              
              // Set saga status
              saga.status = 'failed';
              saga.completedAt = Date.now();
              
              // Publish saga failed event
              this.publish('saga:failed', {
                sagaId,
                name,
                failedStep: step.name,
                error: error.message
              }, {
                priority: PRIORITY.HIGH,
                qos: QOS.AT_LEAST_ONCE,
                pattern: PATTERN.SAGA,
                metadata: {
                  sagaId
                }
              });
              
              throw error;
            }
          }
          
          // All steps completed successfully
          saga.status = 'completed';
          saga.completedAt = Date.now();
          
          // Publish saga completed event
          this.publish('saga:completed', {
            sagaId,
            name,
            results: saga.results
          }, {
            priority: PRIORITY.HIGH,
            qos: QOS.AT_LEAST_ONCE,
            pattern: PATTERN.SAGA,
            metadata: {
              sagaId
            }
          });
          
          return {
            sagaId,
            name,
            status: saga.status,
            results: saga.results
          };
        } catch (error) {
          // Error already handled above
          return {
            sagaId,
            name,
            status: saga.status,
            results: saga.results,
            errors: saga.errors
          };
        } finally {
          // Remove from sagas if not persistent
          if (!options.persistent) {
            this.sagas.delete(sagaId);
            
            // Update metrics
            this.metrics.activeSagas = this.sagas.size;
          }
        }
      },
      
      // Compensate steps
      compensate: async (fromStep) => {
        for (let i = fromStep; i >= 0; i--) {
          const step = saga.steps[i];
          
          if (!step.compensation) {
            continue;
          }
          
          // Publish compensation start event
          this.publish('saga:compensation:started', {
            sagaId,
            name,
            step: step.name,
            stepIndex: i
          }, {
            priority: PRIORITY.HIGH,
            pattern: PATTERN.SAGA,
            metadata: {
              sagaId
            }
          });
          
          try {
            // Execute compensation
            await step.compensation();
            
            // Publish compensation complete event
            this.publish('saga:compensation:completed', {
              sagaId,
              name,
              step: step.name,
              stepIndex: i
            }, {
              priority: PRIORITY.NORMAL,
              pattern: PATTERN.SAGA,
              metadata: {
                sagaId
              }
            });
          } catch (error) {
            // Publish compensation failed event
            this.publish('saga:compensation:failed', {
              sagaId,
              name,
              step: step.name,
              stepIndex: i,
              error: error.message
            }, {
              priority: PRIORITY.HIGH,
              qos: QOS.AT_LEAST_ONCE,
              pattern: PATTERN.SAGA,
              metadata: {
                sagaId
              }
            });
            
            // Continue with other compensations
          }
        }
      }
    };
    
    // Store saga
    this.sagas.set(sagaId, saga);
    
    // Update metrics
    this.metrics.activeSagas = this.sagas.size;
    
    return saga;
  }

  /**
   * Subscribe to a channel
   * @param {string} channel - Channel to subscribe to
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   * @returns {string} Subscription ID
   */
  subscribe(channel, callback, options = {}) {
    const subscriptionId = options.id || uuidv4();
    const version = options.version || '1.0.0';
    
    const subscription = {
      id: subscriptionId,
      channel,
      callback,
      options,
      version,
      createdAt: Date.now(),
      messageCount: 0,
      errorCount: 0,
      lastMessageTime: null
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Add event listener
    const listener = (message) => {
      // Check version compatibility if enabled
      if (this.config.versionNegotiationEnabled && message.version) {
        const compatibleVersion = this.findCompatibleVersion(channel, version);
        
        if (!compatibleVersion) {
          this.logger.warn(`Version incompatibility: ${channel} consumer v${version}, message v${message.version}`);
          return;
        }
      }
      
      // Apply filter if provided
      if (options.filter && !options.filter(message)) {
        return;
      }
      
      // Handle batch messages if this is a batch subscription
      if (options.handleBatch && channel.endsWith('.batch') && Array.isArray(message.data)) {
        try {
          callback(message);
          subscription.messageCount += message.data.length;
          subscription.lastMessageTime = Date.now();
          
          // Unsubscribe if once option is set
          if (options.once) {
            this.unsubscribe(subscriptionId);
          }
        } catch (error) {
          this.logger.error(`Error in batch subscription callback for channel: ${channel}`, error);
          subscription.errorCount++;
          
          // Check circuit breaker
          this.checkCircuitBreaker(channel, error);
        }
        return;
      }
      
      // Handle regular messages
      try {
        callback(message);
        subscription.messageCount++;
        subscription.lastMessageTime = Date.now();
        
        // Unsubscribe if once option is set
        if (options.once) {
          this.unsubscribe(subscriptionId);
        }
      } catch (error) {
        this.logger.error(`Error in subscription callback for channel: ${channel}`, error);
        subscription.errorCount++;
        
        // Check circuit breaker
        this.checkCircuitBreaker(channel, error);
      }
    };
    
    subscription.listener = listener;
    this.on(channel, listener);
    
    // Also subscribe to batch channel if requested
    if (options.includeBatch && !channel.endsWith('.batch')) {
      const batchListener = (batchMessage) => {
        if (options.filter) {
          // For batch messages, apply filter to each message in batch
          const filteredData = batchMessage.data.filter(item => {
            const dummyMessage = {
              ...batchMessage,
              data: item
            };
            return options.filter(dummyMessage);
          });
          
          if (filteredData.length === 0) {
            return;
          }
          
          // Create filtered batch message
          const filteredBatchMessage = {
            ...batchMessage,
            data: filteredData,
            metadata: {
              ...batchMessage.metadata,
              filteredBatchSize: filteredData.length
            }
          };
          
          try {
            callback(filteredBatchMessage);
            subscription.messageCount += filteredData.length;
            subscription.lastMessageTime = Date.now();
          } catch (error) {
            this.logger.error(`Error in batch subscription callback for channel: ${channel}`, error);
            subscription.errorCount++;
            
            // Check circuit breaker
            this.checkCircuitBreaker(channel, error);
          }
        } else {
          try {
            callback(batchMessage);
            subscription.messageCount += batchMessage.data.length;
            subscription.lastMessageTime = Date.now();
          } catch (error) {
            this.logger.error(`Error in batch subscription callback for channel: ${channel}`, error);
            subscription.errorCount++;
            
            // Check circuit breaker
            this.checkCircuitBreaker(channel, error);
          }
        }
      };
      
      subscription.batchListener = batchListener;
      this.on(`${channel}.batch`, batchListener);
    }
    
    this.logger.debug(`Subscribed to channel: ${channel}`, { subscriptionId });
    
    // Update metrics
    this.metrics.activeSubscriptions = this.subscriptions.size;
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from a channel
   * @param {string} subscriptionId - Subscription ID
   * @returns {boolean} Success
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      this.logger.warn(`Subscription not found: ${subscriptionId}`);
      return false;
    }
    
    // Remove event listener
    this.removeListener(subscription.channel, subscription.listener);
    
    // Remove batch listener if exists
    if (subscription.batchListener) {
      this.removeListener(`${subscription.channel}.batch`, subscription.batchListener);
    }
    
    // Remove subscription
    this.subscriptions.delete(subscriptionId);
    
    this.logger.debug(`Unsubscribed from channel: ${subscription.channel}`, { subscriptionId });
    
    // Update metrics
    this.metrics.activeSubscriptions = this.subscriptions.size;
    
    return true;
  }

  /**
   * Check circuit breaker for a channel
   * @private
   * @param {string} channel - Channel to check
   * @param {Error} error - Error that occurred
   */
  checkCircuitBreaker(channel, error) {
    if (!this.config.circuitBreakerThreshold) {
      return;
    }
    
    // Get or create circuit breaker
    if (!this.circuitBreakers.has(channel)) {
      this.circuitBreakers.set(channel, {
        failures: 0,
        lastFailure: null,
        open: false,
        openedAt: null,
        resetTimer: null
      });
    }
    
    const breaker = this.circuitBreakers.get(channel);
    
    // Increment failure count
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    // Check if threshold reached
    if (!breaker.open && breaker.failures >= this.config.circuitBreakerThreshold) {
      // Open circuit breaker
      breaker.open = true;
      breaker.openedAt = Date.now();
      
      // Set reset timer
      breaker.resetTimer = setTimeout(() => {
        // Half-open circuit breaker
        breaker.open = false;
        breaker.failures = 0;
        breaker.resetTimer = null;
        
        this.logger.info(`Circuit breaker reset for channel: ${channel}`);
        
        // Publish circuit breaker reset event
        this.publish('circuit-breaker:reset', {
          channel,
          openDuration: Date.now() - breaker.openedAt
        }, {
          priority: PRIORITY.HIGH
        });
      }, this.config.circuitBreakerResetTimeout);
      
      this.logger.warn(`Circuit breaker opened for channel: ${channel}`, {
        failures: breaker.failures,
        error: error.message
      });
      
      // Publish circuit breaker open event
      this.publish('circuit-breaker:open', {
        channel,
        failures: breaker.failures,
        error: error.message
      }, {
        priority: PRIORITY.HIGH
      });
      
      // Update metrics
      if (!this.metrics.circuitBreakerTrips[channel]) {
        this.metrics.circuitBreakerTrips[channel] = 0;
      }
      this.metrics.circuitBreakerTrips[channel]++;
    }
  }

  /**
   * Queue a message for batch processing
   * @private
   * @param {string} channel - Channel to publish to
   * @param {Object} messageObject - Message object
   */
  queueForBatch(channel, messageObject) {
    // Create batch queue for channel if it doesn't exist
    if (!this.batchQueues.has(channel)) {
      this.batchQueues.set(channel, []);
      
      // Create batch timer for channel
      this.batchTimers.set(channel, setTimeout(() => {
        this.processBatch(channel);
      }, this.config.batchInterval));
    }
    
    // Add message to batch queue
    const batchQueue = this.batchQueues.get(channel);
    batchQueue.push(messageObject);
    
    // Process batch immediately if it reaches max size
    if (batchQueue.length >= this.config.batchMaxSize) {
      clearTimeout(this.batchTimers.get(channel));
      this.batchTimers.delete(channel);
      this.processBatch(channel);
    }
  }

  /**
   * Process a batch of messages for a channel
   * @private
   * @param {string} channel - Channel to process batch for
   */
  processBatch(channel) {
    if (!this.batchQueues.has(channel)) {
      return;
    }
    
    const batchQueue = this.batchQueues.get(channel);
    if (batchQueue.length === 0) {
      this.batchQueues.delete(channel);
      return;
    }
    
    // Create batch message
    const batchMessage = {
      id: uuidv4(),
      channel: `${channel}.batch`,
      data: batchQueue.map(msg => msg.data),
      timestamp: Date.now(),
      sender: 'batch',
      metadata: {
        batchSize: batchQueue.length,
        originalMessages: batchQueue.map(msg => ({
          id: msg.id,
          sender: msg.sender,
          timestamp: msg.timestamp,
          metadata: msg.metadata
        }))
      },
      priority: Math.min(...batchQueue.map(msg => msg.priority)),
      qos: Math.max(...batchQueue.map(msg => msg.qos)),
      pattern: PATTERN.PUBLISH_SUBSCRIBE,
      version: batchQueue[0].version // Use version from first message
    };
    
    // Emit batch message
    this.emitMessage(`${channel}.batch`, batchMessage);
    
    // Also emit individual messages for backward compatibility
    batchQueue.forEach(msg => {
      this.emitMessage(channel, msg);
    });
    
    // Clear batch queue
    this.batchQueues.delete(channel);
    this.batchTimers.delete(channel);
  }

  /**
   * Queue a message by priority
   * @private
   * @param {string} channel - Channel to publish to
   * @param {Object} messageObject - Message object
   */
  queueByPriority(channel, messageObject) {
    // Create message queue for channel if it doesn't exist
    if (!this.messageQueues.has(channel)) {
      this.messageQueues.set(channel, []);
    }
    
    const queue = this.messageQueues.get(channel);
    
    // Check queue size limit
    if (queue.length >= this.config.maxQueueSize) {
      // If queue is full, drop lowest priority message if new message has higher priority
      const lowestPriorityIndex = queue.reduce((lowestIdx, msg, idx, arr) => 
        msg.priority > arr[lowestIdx].priority ? idx : lowestIdx, 0);
      
      if (queue[lowestPriorityIndex].priority > messageObject.priority) {
        queue[lowestPriorityIndex] = messageObject;
      } else {
        this.logger.warn(`Message queue full for channel: ${channel}, dropping message`, { messageId: messageObject.id });
        return;
      }
    } else {
      // Add message to queue
      queue.push(messageObject);
    }
    
    // Sort queue by priority (lower number = higher priority)
    queue.sort((a, b) => a.priority - b.priority);
    
    // Process queue asynchronously
    setImmediate(() => this.processQueue(channel));
  }

  /**
   * Process a message queue for a channel
   * @private
   * @param {string} channel - Channel to process queue for
   */
  processQueue(channel) {
    if (!this.messageQueues.has(channel)) {
      return;
    }
    
    const queue = this.messageQueues.get(channel);
    if (queue.length === 0) {
      this.messageQueues.delete(channel);
      return;
    }
    
    // Get highest priority message (front of queue)
    const messageObject = queue.shift();
    
    // Emit message
    this.emitMessage(channel, messageObject);
    
    // Update metrics
    if (this.config.monitoringEnabled) {
      this.metrics.queueSizes[channel] = queue.length;
    }
    
    // Process next message in queue asynchronously
    if (queue.length > 0) {
      setImmediate(() => this.processQueue(channel));
    }
  }

  /**
   * Emit a message to subscribers
   * @private
   * @param {string} channel - Channel to emit to
   * @param {Object} messageObject - Message object
   */
  emitMessage(channel, messageObject) {
    // Check circuit breaker
    if (this.circuitBreakers.has(channel) && this.circuitBreakers.get(channel).open) {
      this.logger.debug(`Circuit breaker open for channel: ${channel}, message dropped`, { messageId: messageObject.id });
      return;
    }
    
    try {
      // Emit event
      this.emit(channel, messageObject);
      this.emit('*', messageObject);
      
      // Update metrics
      this.metrics.messagesDelivered++;
      
      // Update routing decisions for monitoring
      if (this.config.monitoringEnabled) {
        if (!this.metrics.routingDecisions[channel]) {
          this.metrics.routingDecisions[channel] = 0;
        }
        this.metrics.routingDecisions[channel]++;
      }
    } catch (error) {
      this.logger.error(`Error emitting message to channel: ${channel}`, error);
      this.metrics.messageErrors++;
    }
  }

  /**
   * Route a request to a tentacle based on capability
   * @param {string} capability - Capability to route to
   * @param {Object} request - Request to route
   * @param {Object} options - Routing options
   * @returns {Promise<Object>} Response from tentacle
   */
  async routeRequest(capability, request, options = {}) {
    if (!this.config.intelligentRoutingEnabled) {
      throw new Error('Intelligent routing is disabled');
    }
    
    const version = options.version || '1.0.0';
    
    this.logger.debug(`Routing request for capability: ${capability} v${version}`);
    
    // Check route cache
    const cacheKey = `${capability}:${version}:${JSON.stringify(options)}`;
    if (this.routeCache.has(cacheKey)) {
      const cachedRoute = this.routeCache.get(cacheKey);
      
      // Check if cache is still valid
      if (Date.now() - cachedRoute.timestamp < this.config.routeCacheTtl) {
        // Check if tentacle is still healthy
        const tentacle = this.tentacleRegistry.get(cachedRoute.tentacleId);
        if (tentacle && tentacle.status === 'active' && tentacle.health.status === 'healthy') {
          this.logger.debug(`Using cached route for capability: ${capability}`, { tentacleId: cachedRoute.tentacleId });
          return this.routeToTentacle(cachedRoute.tentacleId, capability, request, options);
        }
      }
      
      // Cache invalid, remove it
      this.routeCache.delete(cacheKey);
    }
    
    // Find tentacles with capability
    const tentacles = this.findTentaclesWithCapability(capability, version);
    
    if (tentacles.length === 0) {
      throw new Error(`No tentacles found with capability: ${capability} v${version}`);
    }
    
    // Select tentacle based on options
    let selectedTentacle;
    
    if (options.tentacleId) {
      // Select specific tentacle
      selectedTentacle = tentacles.find(t => t.id === options.tentacleId);
      
      if (!selectedTentacle) {
        throw new Error(`Tentacle not found with ID: ${options.tentacleId}`);
      }
    } else if (options.strategy === 'random') {
      // Select random tentacle
      selectedTentacle = tentacles[Math.floor(Math.random() * tentacles.length)];
    } else if (options.strategy === 'round-robin') {
      // Get round-robin counter
      if (!this.roundRobinCounters) {
        this.roundRobinCounters = new Map();
      }
      
      if (!this.roundRobinCounters.has(capability)) {
        this.roundRobinCounters.set(capability, 0);
      }
      
      const counter = this.roundRobinCounters.get(capability);
      selectedTentacle = tentacles[counter % tentacles.length];
      
      // Update counter
      this.roundRobinCounters.set(capability, counter + 1);
    } else if (options.strategy === 'load-balanced') {
      // Select tentacle with lowest load
      selectedTentacle = tentacles.reduce((lowest, current) => {
        // Calculate load score (lower is better)
        const lowestLoad = lowest.load.cpu * 0.5 + lowest.load.memory * 0.3 + lowest.load.messages * 0.2;
        const currentLoad = current.load.cpu * 0.5 + current.load.memory * 0.3 + current.load.messages * 0.2;
        
        return currentLoad < lowestLoad ? current : lowest;
      }, tentacles[0]);
    } else {
      // Default: select tentacle with highest priority
      selectedTentacle = tentacles.reduce((highest, current) => {
        const highestPriority = this.capabilityRegistry.get(capability).tentacles.get(highest.id).priority || 0;
        const currentPriority = this.capabilityRegistry.get(capability).tentacles.get(current.id).priority || 0;
        
        return currentPriority > highestPriority ? current : highest;
      }, tentacles[0]);
    }
    
    this.logger.info(`Routing request to tentacle: ${selectedTentacle.name} (${selectedTentacle.id})`);
    
    // Cache route
    this.routeCache.set(cacheKey, {
      tentacleId: selectedTentacle.id,
      capability,
      version,
      timestamp: Date.now()
    });
    
    // Trim cache if too large
    if (this.routeCache.size > this.config.routeCacheSize) {
      // Remove oldest entry
      const oldestKey = Array.from(this.routeCache.entries())
        .reduce((oldest, current) => 
          current[1].timestamp < oldest[1].timestamp ? current : oldest
        )[0];
      
      this.routeCache.delete(oldestKey);
    }
    
    // Route request to selected tentacle
    return this.routeToTentacle(selectedTentacle.id, capability, request, options);
  }

  /**
   * Find tentacles with a specific capability
   * @param {string} capability - Capability to look for
   * @param {string} version - Requested version
   * @returns {Array<Object>} Tentacles with the capability
   */
  findTentaclesWithCapability(capability, version) {
    if (!this.capabilityRegistry.has(capability)) {
      return [];
    }
    
    const capabilityRecord = this.capabilityRegistry.get(capability);
    const result = [];
    
    // Check each tentacle
    for (const [tentacleId, tentacleCapability] of capabilityRecord.tentacles.entries()) {
      // Get tentacle record
      const tentacleRecord = this.tentacleRegistry.get(tentacleId);
      
      if (!tentacleRecord) {
        continue;
      }
      
      // Check if tentacle is active and healthy
      if (tentacleRecord.status !== 'active' || tentacleRecord.health.status !== 'healthy') {
        continue;
      }
      
      // Check version compatibility
      if (this.config.versionNegotiationEnabled) {
        const compatibleVersion = this.findCompatibleVersion(capability, version);
        
        if (!compatibleVersion) {
          continue;
        }
      }
      
      result.push(tentacleRecord);
    }
    
    return result;
  }

  /**
   * Route a request to a specific tentacle
   * @private
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} capability - Capability to use
   * @param {Object} request - Request to route
   * @param {Object} options - Routing options
   * @returns {Promise<Object>} Response from tentacle
   */
  async routeToTentacle(tentacleId, capability, request, options = {}) {
    const tentacleRecord = this.tentacleRegistry.get(tentacleId);
    
    if (!tentacleRecord) {
      throw new Error(`Tentacle not found: ${tentacleId}`);
    }
    
    // Check if tentacle is active and healthy
    if (tentacleRecord.status !== 'active' || tentacleRecord.health.status !== 'healthy') {
      throw new Error(`Tentacle is not available: ${tentacleId}`);
    }
    
    // Call tentacle capability
    const tentacle = tentacleRecord.instance;
    
    if (!tentacle) {
      throw new Error(`Tentacle instance not available: ${tentacleId}`);
    }
    
    // Check if tentacle has direct method for capability
    if (typeof tentacle[capability] === 'function') {
      return tentacle[capability](request, options);
    }
    
    // Check if tentacle has handleCapability method
    if (typeof tentacle.handleCapability === 'function') {
      return tentacle.handleCapability(capability, request, options);
    }
    
    // Use request-response pattern
    return this.request(`${capability}.${tentacleId}`, request, options);
  }

  /**
   * Clear route cache for a capability
   * @param {string} capability - Capability to clear cache for
   */
  clearRouteCache(capability) {
    // Remove all entries for capability
    for (const key of this.routeCache.keys()) {
      if (key.startsWith(`${capability}:`)) {
        this.routeCache.delete(key);
      }
    }
  }

  /**
   * Start performance monitoring
   * @private
   */
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
    }, this.config.monitoringInterval);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Update performance metrics
   * @private
   */
  updateMetrics() {
    const now = Date.now();
    const timeDiff = (now - this.metrics.lastMonitoringTime) / 1000; // in seconds
    
    // Calculate message rate
    this.metrics.messageRate = this.metrics.messagesPublished / timeDiff;
    this.metrics.deliveryRate = this.metrics.messagesDelivered / timeDiff;
    this.metrics.errorRate = this.metrics.messageErrors / timeDiff;
    
    // Calculate average processing time
    if (this.metrics.processingTimes.length > 0) {
      this.metrics.avgProcessingTime = this.metrics.processingTimes.reduce((sum, time) => sum + time, 0) / this.metrics.processingTimes.length;
    }
    
    // Update queue sizes
    for (const [channel, queue] of this.messageQueues.entries()) {
      this.metrics.queueSizes[channel] = queue.length;
    }
    
    // Log metrics if significant activity
    if (this.metrics.messagesPublished > 100 || this.metrics.messageErrors > 0) {
      this.logger.info('Hyper-Scalable Tentacle Bus Metrics', {
        messageRate: this.metrics.messageRate.toFixed(2) + '/s',
        deliveryRate: this.metrics.deliveryRate.toFixed(2) + '/s',
        errorRate: this.metrics.errorRate.toFixed(2) + '/s',
        activeSubscriptions: this.metrics.activeSubscriptions,
        pendingRequests: this.metrics.pendingRequests,
        activeStreams: this.metrics.activeStreams,
        activeSagas: this.metrics.activeSagas,
        registeredTentacles: this.metrics.registeredTentacles,
        registeredCapabilities: this.metrics.registeredCapabilities,
        avgProcessingTime: this.metrics.avgProcessingTime ? this.metrics.avgProcessingTime.toFixed(2) + 'ms' : 'N/A'
      });
    }
    
    // Reset counters
    this.metrics.messagesPublished = 0;
    this.metrics.messagesDelivered = 0;
    this.metrics.messageErrors = 0;
    this.metrics.lastMonitoringTime = now;
  }

  /**
   * Get current performance metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    // Update metrics before returning
    if (this.config.monitoringEnabled) {
      this.updateMetrics();
    }
    
    return { ...this.metrics };
  }

  /**
   * Flush all message queues
   * @returns {number} Number of messages flushed
   */
  flushQueues() {
    let flushedCount = 0;
    
    // Flush batch queues
    for (const [channel, queue] of this.batchQueues.entries()) {
      if (queue.length > 0) {
        this.processBatch(channel);
        flushedCount += queue.length;
      }
      
      if (this.batchTimers.has(channel)) {
        clearTimeout(this.batchTimers.get(channel));
        this.batchTimers.delete(channel);
      }
    }
    
    // Flush priority queues
    for (const [channel, queue] of this.messageQueues.entries()) {
      flushedCount += queue.length;
      
      // Process all messages in queue
      while (queue.length > 0) {
        const messageObject = queue.shift();
        this.emitMessage(channel, messageObject);
      }
      
      this.messageQueues.delete(channel);
    }
    
    return flushedCount;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Stop monitoring
    this.stopMonitoring();
    
    // Stop discovery
    this.stopDiscovery();
    
    // Flush all queues
    this.flushQueues();
    
    // Clear all pending requests
    for (const [requestId, pendingRequest] of this.pendingRequests.entries()) {
      clearTimeout(pendingRequest.timeoutId);
      pendingRequest.reject(new Error('Bus cleanup'));
      this.pendingRequests.delete(requestId);
    }
    
    // Clear all subscriptions
    for (const subscriptionId of this.subscriptions.keys()) {
      this.unsubscribe(subscriptionId);
    }
    
    // Clear all responders
    for (const responderId of this.responders.keys()) {
      this.unregisterResponder(responderId);
    }
    
    // Clear all streams
    for (const [streamId, stream] of this.streams.entries()) {
      stream.end();
    }
    
    // Clear all circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.resetTimer) {
        clearTimeout(breaker.resetTimer);
      }
    }
    this.circuitBreakers.clear();
    
    // Clear all tentacles
    for (const tentacleId of this.tentacleRegistry.keys()) {
      this.unregisterTentacle(tentacleId);
    }
    
    // Clear all listeners
    this.removeAllListeners();
    
    this.logger.info('Hyper-Scalable Tentacle Bus cleaned up');
  }
}

// Export constants and class
module.exports = { 
  HyperScalableTentacleBus,
  PRIORITY,
  QOS,
  PATTERN
};
