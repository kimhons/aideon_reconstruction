/**
 * @fileoverview Factory function implementation for NeuralCoordinationHub.
 * This module provides a factory function that creates a NeuralCoordinationHub object
 * with all methods directly on the instance to ensure compatibility with duck typing
 * checks across module boundaries.
 * 
 * @module core/neural/NeuralCoordinationHubFactory
 */

const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

// --- Enums and Constants ---

const PathwayStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  PENDING: "PENDING",
  ERROR: "ERROR"
};

const PathwayType = {
  DIRECT: "DIRECT",
  BRIDGED: "BRIDGED",
  MULTI_HOP: "MULTI_HOP",
  TENTACLE: "TENTACLE"
};

const PathwayPriority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW"
};

/**
 * Creates a new NeuralCoordinationHub instance with all methods directly on the object.
 * This factory function pattern ensures method preservation across module boundaries.
 * 
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Name of the hub
 * @param {string} [config.description] - Description of the hub
 * @param {Object} [config.eventEmitter] - Event emitter
 * @param {Object} [config.metrics] - Metrics collector
 * @param {Object} [config.logger] - Logger instance
 * @param {boolean} [config.enableLearning] - Whether to enable learning
 * @param {boolean} [config.enableAutoScaling] - Whether to enable auto-scaling
 * @returns {Object} NeuralCoordinationHub instance with all methods as own properties
 */
function createNeuralCoordinationHub(config = {}) {
  // Create default dependencies if not provided
  const logger = config.logger || {
    info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
    debug: (message, ...args) => {},
    warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args)
  };
  
  const eventEmitter = config.eventEmitter || new EventEmitter();
  
  const metrics = config.metrics || {
    recordMetric: (name, data) => {}
  };
  
  // Create hub instance with all properties and methods directly on the object
  const hub = {
    // Core properties
    id: config.id || uuidv4(),
    name: config.name || "NeuralCoordinationHub",
    description: config.description || "Provides coordination capabilities for neural pathways and tentacles.",
    config: config,
    logger: logger,
    eventEmitter: eventEmitter,
    metrics: metrics,
    pathways: new Map(),
    tentacles: new Map(),
    connections: new Map(),
    enableLearning: config.enableLearning !== false,
    enableAutoScaling: config.enableAutoScaling !== false,
    
    // Methods as direct properties to ensure preservation across module boundaries
    initializeDefaultPathways: function() {
      // Register core pathways
      this.registerPathway({
        name: "Core System Pathway",
        type: PathwayType.DIRECT,
        priority: PathwayPriority.CRITICAL,
        description: "Core system communication pathway",
        config: {
          capacity: 1000,
          bufferSize: 100,
          timeout: 5000
        }
      });
      
      this.registerPathway({
        name: "User Interface Pathway",
        type: PathwayType.DIRECT,
        priority: PathwayPriority.HIGH,
        description: "User interface communication pathway",
        config: {
          capacity: 500,
          bufferSize: 50,
          timeout: 2000
        }
      });
      
      this.registerPathway({
        name: "Data Processing Pathway",
        type: PathwayType.BRIDGED,
        priority: PathwayPriority.MEDIUM,
        description: "Data processing communication pathway",
        config: {
          capacity: 2000,
          bufferSize: 200,
          timeout: 10000
        }
      });
      
      this.registerPathway({
        name: "External Integration Pathway",
        type: PathwayType.MULTI_HOP,
        priority: PathwayPriority.LOW,
        description: "External integration communication pathway",
        config: {
          capacity: 300,
          bufferSize: 30,
          timeout: 15000
        }
      });
      
      this.registerPathway({
        name: "Error Handling Pathway",
        type: PathwayType.DIRECT,
        priority: PathwayPriority.HIGH,
        description: "Error handling communication pathway",
        config: {
          capacity: 100,
          bufferSize: 50,
          timeout: 3000
        }
      });
    },
    
    registerPathway: function(pathway) {
      const pathwayId = pathway.id || uuidv4();
      
      this.logger.info(`Registering pathway: ${pathway.name || pathwayId}`);
      
      // Create pathway object
      const pathwayObj = {
        id: pathwayId,
        name: pathway.name || `Pathway ${pathwayId}`,
        type: pathway.type || PathwayType.DIRECT,
        priority: pathway.priority || PathwayPriority.MEDIUM,
        description: pathway.description || "",
        config: pathway.config || {},
        status: PathwayStatus.ACTIVE,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: "1.0.0",
          messageCount: 0,
          errorCount: 0,
          lastActiveAt: Date.now()
        }
      };
      
      // Store pathway
      this.pathways.set(pathwayId, pathwayObj);
      
      // Emit event
      this.eventEmitter.emit("pathway:registered", {
        pathwayId,
        name: pathwayObj.name,
        type: pathwayObj.type
      });
      
      return pathwayId;
    },
    
    registerTentacle: function(tentacle) {
      const tentacleId = tentacle.id || uuidv4();
      
      this.logger.info(`Registering tentacle: ${tentacle.name || tentacleId}`);
      
      // Create tentacle object
      const tentacleObj = {
        id: tentacleId,
        name: tentacle.name || `Tentacle ${tentacleId}`,
        type: tentacle.type || "GENERIC",
        description: tentacle.description || "",
        config: tentacle.config || {},
        interface: tentacle.interface || {},
        status: "ACTIVE",
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: "1.0.0",
          connectionCount: 0,
          lastActiveAt: Date.now()
        }
      };
      
      // Store tentacle
      this.tentacles.set(tentacleId, tentacleObj);
      
      // Emit event
      this.eventEmitter.emit("tentacle:registered", {
        tentacleId,
        name: tentacleObj.name,
        type: tentacleObj.type
      });
      
      return tentacleId;
    },
    
    createConnection: function(sourceId, targetId, config = {}) {
      const connectionId = uuidv4();
      
      // Verify source and target exist
      const source = this.pathways.get(sourceId) || this.tentacles.get(sourceId);
      if (!source) {
        throw new Error(`Source entity with ID ${sourceId} does not exist`);
      }
      
      const target = this.pathways.get(targetId) || this.tentacles.get(targetId);
      if (!target) {
        throw new Error(`Target entity with ID ${targetId} does not exist`);
      }
      
      this.logger.info(`Creating connection from ${source.name} to ${target.name}`);
      
      // Create connection object
      const connection = {
        id: connectionId,
        sourceId,
        targetId,
        config: config || {},
        status: "ACTIVE",
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
          errorCount: 0,
          lastActiveAt: Date.now()
        }
      };
      
      // Store connection
      this.connections.set(connectionId, connection);
      
      // Update entity metadata
      if (this.tentacles.has(sourceId)) {
        const tentacle = this.tentacles.get(sourceId);
        tentacle.metadata.connectionCount++;
        tentacle.metadata.updatedAt = Date.now();
      }
      
      if (this.tentacles.has(targetId)) {
        const tentacle = this.tentacles.get(targetId);
        tentacle.metadata.connectionCount++;
        tentacle.metadata.updatedAt = Date.now();
      }
      
      // Emit event
      this.eventEmitter.emit("connection:created", {
        connectionId,
        sourceId,
        targetId
      });
      
      return connectionId;
    },
    
    sendMessage: async function(pathwayId, message, options = {}) {
      const pathway = this.pathways.get(pathwayId);
      if (!pathway) {
        throw new Error(`Pathway with ID ${pathwayId} does not exist`);
      }
      
      if (pathway.status !== PathwayStatus.ACTIVE) {
        throw new Error(`Pathway ${pathway.name} is not active (status: ${pathway.status})`);
      }
      
      const messageId = message.id || uuidv4();
      
      this.logger.info(`Sending message ${messageId} through pathway ${pathway.name}`);
      
      // Create message object
      const messageObj = {
        id: messageId,
        payload: message.payload || message,
        metadata: {
          timestamp: Date.now(),
          pathwayId,
          senderId: message.senderId || options.senderId || "SYSTEM",
          priority: message.priority || options.priority || "NORMAL"
        }
      };
      
      try {
        // Process message
        const result = await this.processMessage(pathway, messageObj, options);
        
        // Update pathway metadata
        pathway.metadata.messageCount++;
        pathway.metadata.lastActiveAt = Date.now();
        pathway.metadata.updatedAt = Date.now();
        
        // Emit event
        this.eventEmitter.emit("message:sent", {
          messageId,
          pathwayId,
          success: true
        });
        
        // Record metrics
        this.metrics.recordMetric("message_sent", {
          pathwayId,
          messageId,
          success: true,
          duration: Date.now() - messageObj.metadata.timestamp
        });
        
        return result;
      } catch (error) {
        this.logger.error(`Error sending message ${messageId}: ${error.message}`, error);
        
        // Update pathway metadata
        pathway.metadata.errorCount++;
        pathway.metadata.updatedAt = Date.now();
        
        // Emit event
        this.eventEmitter.emit("message:error", {
          messageId,
          pathwayId,
          error: error.message
        });
        
        // Record metrics
        this.metrics.recordMetric("message_sent", {
          pathwayId,
          messageId,
          success: false,
          error: error.message
        });
        
        throw error;
      }
    },
    
    processMessage: async function(pathway, message, options) {
      // Check pathway capacity
      if (pathway.config.capacity && pathway.metadata.messageCount >= pathway.config.capacity) {
        if (this.enableAutoScaling) {
          await this.scalePathway(pathway);
        } else {
          throw new Error(`Pathway ${pathway.name} has reached capacity`);
        }
      }
      
      // Process based on pathway type
      switch (pathway.type) {
        case PathwayType.DIRECT:
          return await this.processDirectPathway(pathway, message, options);
        case PathwayType.BRIDGED:
          return await this.processBridgedPathway(pathway, message, options);
        case PathwayType.MULTI_HOP:
          return await this.processMultiHopPathway(pathway, message, options);
        case PathwayType.TENTACLE:
          return await this.processTentaclePathway(pathway, message, options);
        default:
          throw new Error(`Unsupported pathway type: ${pathway.type}`);
      }
    },
    
    processDirectPathway: async function(pathway, message, options) {
      // Find connections for this pathway
      const connections = Array.from(this.connections.values())
        .filter(conn => conn.sourceId === pathway.id && conn.status === "ACTIVE");
      
      if (connections.length === 0) {
        return {
          messageId: message.id,
          status: "DELIVERED",
          timestamp: Date.now(),
          recipients: []
        };
      }
      
      // Deliver to all connections
      const deliveryPromises = connections.map(async connection => {
        const target = this.pathways.get(connection.targetId) || this.tentacles.get(connection.targetId);
        
        if (!target) {
          throw new Error(`Target entity with ID ${connection.targetId} does not exist`);
        }
        
        // Deliver message
        await this.deliverMessage(target, message, connection, options);
        
        return {
          targetId: connection.targetId,
          targetName: target.name,
          status: "DELIVERED",
          timestamp: Date.now()
        };
      });
      
      const deliveryResults = await Promise.all(deliveryPromises);
      
      return {
        messageId: message.id,
        status: "DELIVERED",
        timestamp: Date.now(),
        recipients: deliveryResults
      };
    },
    
    processBridgedPathway: async function(pathway, message, options) {
      // This is a simplified implementation
      // In a real implementation, this would handle bridged communication
      
      // For now, use the same logic as direct pathway
      return this.processDirectPathway(pathway, message, options);
    },
    
    processMultiHopPathway: async function(pathway, message, options) {
      // This is a simplified implementation
      // In a real implementation, this would handle multi-hop communication
      
      // For now, use the same logic as direct pathway
      return this.processDirectPathway(pathway, message, options);
    },
    
    processTentaclePathway: async function(pathway, message, options) {
      // This is a simplified implementation
      // In a real implementation, this would handle tentacle-specific communication
      
      // For now, use the same logic as direct pathway
      return this.processDirectPathway(pathway, message, options);
    },
    
    deliverMessage: async function(target, message, connection, options) {
      // This is a simplified implementation
      // In a real implementation, this would handle actual message delivery
      
      // Update connection metadata
      connection.metadata.messageCount++;
      connection.metadata.lastActiveAt = Date.now();
      connection.metadata.updatedAt = Date.now();
      
      // If target is a tentacle, handle tentacle-specific delivery
      if (this.tentacles.has(target.id)) {
        return this.deliverToTentacle(target, message, connection, options);
      }
      
      // If target is a pathway, just return success
      return {
        status: "DELIVERED",
        timestamp: Date.now()
      };
    },
    
    deliverToTentacle: async function(tentacle, message, connection, options) {
      // This is a simplified implementation
      // In a real implementation, this would handle tentacle-specific delivery
      
      // Update tentacle metadata
      tentacle.metadata.lastActiveAt = Date.now();
      
      // Just return success for now
      return {
        status: "DELIVERED",
        timestamp: Date.now()
      };
    },
    
    scalePathway: async function(pathway) {
      this.logger.info(`Auto-scaling pathway: ${pathway.name}`);
      
      // This is a simplified implementation
      // In a real implementation, this would handle actual scaling
      
      // Just increase capacity for now
      pathway.config.capacity *= 2;
      pathway.metadata.updatedAt = Date.now();
      
      // Emit event
      this.eventEmitter.emit("pathway:scaled", {
        pathwayId: pathway.id,
        name: pathway.name,
        newCapacity: pathway.config.capacity
      });
      
      return {
        pathwayId: pathway.id,
        name: pathway.name,
        newCapacity: pathway.config.capacity,
        timestamp: Date.now()
      };
    },
    
    getPathway: function(pathwayId) {
      const pathway = this.pathways.get(pathwayId);
      if (!pathway) {
        throw new Error(`Pathway with ID ${pathwayId} does not exist`);
      }
      return pathway;
    },
    
    getTentacle: function(tentacleId) {
      const tentacle = this.tentacles.get(tentacleId);
      if (!tentacle) {
        throw new Error(`Tentacle with ID ${tentacleId} does not exist`);
      }
      return tentacle;
    },
    
    getConnection: function(connectionId) {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error(`Connection with ID ${connectionId} does not exist`);
      }
      return connection;
    },
    
    listPathways: function() {
      return Array.from(this.pathways.values());
    },
    
    listTentacles: function() {
      return Array.from(this.tentacles.values());
    },
    
    listConnections: function() {
      return Array.from(this.connections.values());
    },
    
    updatePathwayStatus: function(pathwayId, status) {
      const pathway = this.getPathway(pathwayId);
      
      this.logger.info(`Updating pathway ${pathway.name} status to ${status}`);
      
      pathway.status = status;
      pathway.metadata.updatedAt = Date.now();
      
      // Emit event
      this.eventEmitter.emit("pathway:status-updated", {
        pathwayId,
        name: pathway.name,
        status
      });
      
      return pathway;
    },
    
    updateTentacleStatus: function(tentacleId, status) {
      const tentacle = this.getTentacle(tentacleId);
      
      this.logger.info(`Updating tentacle ${tentacle.name} status to ${status}`);
      
      tentacle.status = status;
      tentacle.metadata.updatedAt = Date.now();
      
      // Emit event
      this.eventEmitter.emit("tentacle:status-updated", {
        tentacleId,
        name: tentacle.name,
        status
      });
      
      return tentacle;
    },
    
    removePathway: function(pathwayId) {
      const pathway = this.getPathway(pathwayId);
      
      this.logger.info(`Removing pathway: ${pathway.name}`);
      
      // Remove all connections involving this pathway
      const connections = Array.from(this.connections.values())
        .filter(conn => conn.sourceId === pathwayId || conn.targetId === pathwayId);
      
      for (const connection of connections) {
        this.connections.delete(connection.id);
      }
      
      // Remove pathway
      this.pathways.delete(pathwayId);
      
      // Emit event
      this.eventEmitter.emit("pathway:removed", {
        pathwayId,
        name: pathway.name
      });
      
      return {
        pathwayId,
        name: pathway.name,
        connectionsRemoved: connections.length
      };
    },
    
    removeTentacle: function(tentacleId) {
      const tentacle = this.getTentacle(tentacleId);
      
      this.logger.info(`Removing tentacle: ${tentacle.name}`);
      
      // Remove all connections involving this tentacle
      const connections = Array.from(this.connections.values())
        .filter(conn => conn.sourceId === tentacleId || conn.targetId === tentacleId);
      
      for (const connection of connections) {
        this.connections.delete(connection.id);
      }
      
      // Remove tentacle
      this.tentacles.delete(tentacleId);
      
      // Emit event
      this.eventEmitter.emit("tentacle:removed", {
        tentacleId,
        name: tentacle.name
      });
      
      return {
        tentacleId,
        name: tentacle.name,
        connectionsRemoved: connections.length
      };
    },
    
    removeConnection: function(connectionId) {
      const connection = this.getConnection(connectionId);
      
      this.logger.info(`Removing connection: ${connectionId}`);
      
      // Remove connection
      this.connections.delete(connectionId);
      
      // Emit event
      this.eventEmitter.emit("connection:removed", {
        connectionId,
        sourceId: connection.sourceId,
        targetId: connection.targetId
      });
      
      return {
        connectionId,
        sourceId: connection.sourceId,
        targetId: connection.targetId
      };
    },
    
    getStatistics: function() {
      return {
        pathwayCount: this.pathways.size,
        tentacleCount: this.tentacles.size,
        connectionCount: this.connections.size,
        messageCount: Array.from(this.pathways.values()).reduce((sum, p) => sum + p.metadata.messageCount, 0),
        errorCount: Array.from(this.pathways.values()).reduce((sum, p) => sum + p.metadata.errorCount, 0),
        timestamp: Date.now()
      };
    }
  };
  
  // Initialize default pathways
  hub.initializeDefaultPathways();
  
  // Log creation
  logger.info(`Created NeuralCoordinationHub: ${hub.name} (ID: ${hub.id})`);
  
  // Add debugging helper to verify method presence
  hub.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`NeuralCoordinationHub has these methods: ${methods.join(', ')}`);
    return methods;
  };
  
  return hub;
}

module.exports = createNeuralCoordinationHub;
