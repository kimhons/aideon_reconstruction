/**
 * @fileoverview Tentacle Integration Layer for the Neural Hyperconnectivity System.
 * This module provides adapter interfaces for existing tentacles to connect to the
 * neural system, ensuring backward compatibility and seamless migration.
 * 
 * @module core/neural/adapters/TentacleAdapter
 */

const { HyperconnectedNeuralPathway } = require('../HyperconnectedNeuralPathway');
const { NeuralCoordinationHub } = require('../NeuralCoordinationHub');

/**
 * Base adapter class for integrating tentacles with the Neural Hyperconnectivity System.
 */
class TentacleAdapter {
  /**
   * Creates a new tentacle adapter.
   * @param {Object} tentacle - The tentacle instance to adapt.
   * @param {NeuralCoordinationHub} hub - The neural coordination hub instance.
   * @param {Object} options - Configuration options.
   */
  constructor(tentacle, hub, options = {}) {
    if (!tentacle || !tentacle.id) {
      throw new Error('Tentacle instance with valid ID is required');
    }
    
    if (!hub || !(hub instanceof NeuralCoordinationHub)) {
      throw new Error('Valid NeuralCoordinationHub instance is required');
    }
    
    this.tentacle = tentacle;
    this.tentacleId = tentacle.id;
    this.hub = hub;
    this.options = {
      enableLegacyFallback: true,
      contextPreservationLevel: 'high',
      adaptiveBandwidth: true,
      ...options
    };
    
    this.pathwayCache = new Map();
    this.communicationStats = {
      messagesProcessed: 0,
      bytesSent: 0,
      bytesReceived: 0,
      averageLatency: 0,
      errors: 0
    };
    
    // Bind original communication methods for fallback
    this._originalSend = tentacle.send ? tentacle.send.bind(tentacle) : null;
    this._originalReceive = tentacle.receive ? tentacle.receive.bind(tentacle) : null;
    
    console.log(`TentacleAdapter initialized for ${this.tentacleId}`);
  }
  
  /**
   * Sends a message to another tentacle through the neural system.
   * @param {string} targetTentacleId - Target tentacle ID.
   * @param {Object} message - Message to send.
   * @param {Object} options - Send options.
   * @returns {Promise<Object>} - Send result.
   */
  async send(targetTentacleId, message, options = {}) {
    try {
      const startTime = Date.now();
      
      // Prepare context from message metadata and options
      const context = this._prepareContext(message, options);
      
      // Get or establish neural pathway
      const pathway = await this._getOrCreatePathway(targetTentacleId);
      
      // Prepare signal from message content
      const signal = {
        type: message.type || 'standard',
        payload: message.payload || message,
        metadata: message.metadata || {},
        timestamp: Date.now()
      };
      
      // Transmit through neural pathway
      const result = await pathway.transmit(signal, context);
      
      // Update stats
      const latency = Date.now() - startTime;
      this._updateStats('send', signal, latency);
      
      return {
        success: true,
        transmissionId: result.transmissionId,
        latency,
        targetTentacleId
      };
    } catch (error) {
      console.error(`Error sending message to ${targetTentacleId}:`, error);
      this.communicationStats.errors++;
      
      // Fall back to original send method if available and enabled
      if (this.options.enableLegacyFallback && this._originalSend) {
        console.warn(`Falling back to legacy communication for ${targetTentacleId}`);
        return this._originalSend(targetTentacleId, message, options);
      }
      
      throw error;
    }
  }
  
  /**
   * Receives a message from the neural system.
   * @param {Object} transmission - Transmission from neural system.
   * @returns {Object} - Processed message.
   */
  receive(transmission) {
    try {
      const startTime = Date.now();
      
      // Extract signal and context from transmission
      const { signal, context } = transmission.result;
      
      // Convert signal back to message format
      const message = {
        type: signal.type,
        payload: signal.payload,
        metadata: {
          ...signal.metadata,
          sourceTentacleId: context.sourceTentacleId,
          transmissionId: transmission.transmissionId,
          timestamp: signal.timestamp,
          neuralEnhanced: true
        }
      };
      
      // Preserve context for future communications
      if (context._id) {
        message.metadata.contextId = context._id;
      }
      
      // Update stats
      const latency = Date.now() - startTime;
      this._updateStats('receive', signal, latency);
      
      return message;
    } catch (error) {
      console.error('Error processing received transmission:', error);
      this.communicationStats.errors++;
      
      // Return raw transmission if processing fails
      return {
        type: 'raw_transmission',
        payload: transmission,
        metadata: {
          error: error.message,
          processingFailed: true
        }
      };
    }
  }
  
  /**
   * Registers this tentacle with the neural coordination hub.
   * @returns {Promise<boolean>} - Registration result.
   */
  async register() {
    try {
      // Register tentacle capabilities with hub
      const capabilities = await this._getTentacleCapabilities();
      
      // TODO: Implement hub registration when hub API is extended
      
      console.log(`Tentacle ${this.tentacleId} registered with Neural Coordination Hub`);
      return true;
    } catch (error) {
      console.error(`Error registering tentacle ${this.tentacleId}:`, error);
      return false;
    }
  }
  
  /**
   * Gets communication statistics.
   * @returns {Object} - Communication statistics.
   */
  getStats() {
    return {
      ...this.communicationStats,
      pathwayCacheSize: this.pathwayCache.size,
      tentacleId: this.tentacleId
    };
  }
  
  /**
   * Prepares context object from message metadata and options.
   * @private
   * @param {Object} message - Message to send.
   * @param {Object} options - Send options.
   * @returns {Object} - Prepared context.
   */
  _prepareContext(message, options) {
    const context = {
      operation: options.operation || 'message_transfer',
      sourceTentacleId: this.tentacleId,
      timestamp: Date.now()
    };
    
    // Add priority if specified
    if (options.priority) {
      context.priority = Math.max(1, Math.min(5, options.priority));
    }
    
    // Add session ID if available
    if (options.sessionId) {
      context.sessionId = options.sessionId;
    }
    
    // Add previous context ID if available for context chaining
    if (message.metadata && message.metadata.contextId) {
      context._parentId = message.metadata.contextId;
    }
    
    // Add related context IDs if available
    if (options.relatedContextIds) {
      context._relatedIds = options.relatedContextIds;
    }
    
    return context;
  }
  
  /**
   * Gets or creates a neural pathway to target tentacle.
   * @private
   * @param {string} targetTentacleId - Target tentacle ID.
   * @returns {Promise<HyperconnectedNeuralPathway>} - Neural pathway.
   */
  async _getOrCreatePathway(targetTentacleId) {
    const pathwayKey = `${this.tentacleId}-${targetTentacleId}`;
    
    // Check cache first
    if (this.pathwayCache.has(pathwayKey)) {
      return this.pathwayCache.get(pathwayKey);
    }
    
    // Establish new pathway through hub
    const pathway = this.hub.establishPathway(this.tentacleId, targetTentacleId);
    
    // Cache for future use
    this.pathwayCache.set(pathwayKey, pathway);
    
    return pathway;
  }
  
  /**
   * Updates communication statistics.
   * @private
   * @param {string} direction - 'send' or 'receive'.
   * @param {Object} signal - Signal being processed.
   * @param {number} latency - Processing latency.
   */
  _updateStats(direction, signal, latency) {
    this.communicationStats.messagesProcessed++;
    
    // Estimate size in bytes
    const size = JSON.stringify(signal).length;
    
    if (direction === 'send') {
      this.communicationStats.bytesSent += size;
    } else {
      this.communicationStats.bytesReceived += size;
    }
    
    // Update average latency with exponential moving average
    const alpha = 0.2; // Smoothing factor
    this.communicationStats.averageLatency = 
      alpha * latency + (1 - alpha) * (this.communicationStats.averageLatency || latency);
  }
  
  /**
   * Gets tentacle capabilities for registration.
   * @private
   * @returns {Promise<Object>} - Tentacle capabilities.
   */
  async _getTentacleCapabilities() {
    // Default implementation - override in specialized adapters
    return {
      tentacleId: this.tentacleId,
      communicationProtocols: ['standard'],
      dataFormats: ['json'],
      specializations: []
    };
  }
}

/**
 * Specialized adapter for domain-specific tentacles.
 */
class DomainSpecificTentacleAdapter extends TentacleAdapter {
  /**
   * Creates a new domain-specific tentacle adapter.
   * @param {Object} tentacle - The tentacle instance to adapt.
   * @param {NeuralCoordinationHub} hub - The neural coordination hub instance.
   * @param {Object} options - Configuration options.
   */
  constructor(tentacle, hub, options = {}) {
    super(tentacle, hub, options);
    
    this.domainType = options.domainType || 'generic';
    this.domainSpecificHandlers = options.domainHandlers || {};
    
    console.log(`DomainSpecificTentacleAdapter initialized for ${this.tentacleId} (domain: ${this.domainType})`);
  }
  
  /**
   * Sends a message with domain-specific enhancements.
   * @param {string} targetTentacleId - Target tentacle ID.
   * @param {Object} message - Message to send.
   * @param {Object} options - Send options.
   * @returns {Promise<Object>} - Send result.
   */
  async send(targetTentacleId, message, options = {}) {
    // Apply domain-specific transformations if handler exists
    if (this.domainSpecificHandlers.transformOutgoing) {
      message = await this.domainSpecificHandlers.transformOutgoing(message, targetTentacleId);
    }
    
    // Add domain information to options
    const enhancedOptions = {
      ...options,
      sourceDomain: this.domainType
    };
    
    return super.send(targetTentacleId, message, enhancedOptions);
  }
  
  /**
   * Receives a message with domain-specific processing.
   * @param {Object} transmission - Transmission from neural system.
   * @returns {Object} - Processed message.
   */
  receive(transmission) {
    // Process with base adapter first
    const message = super.receive(transmission);
    
    // Apply domain-specific transformations if handler exists
    if (this.domainSpecificHandlers.transformIncoming) {
      return this.domainSpecificHandlers.transformIncoming(message, transmission.result.context);
    }
    
    return message;
  }
  
  /**
   * Gets domain-specific tentacle capabilities.
   * @private
   * @returns {Promise<Object>} - Tentacle capabilities.
   */
  async _getTentacleCapabilities() {
    const baseCapabilities = await super._getTentacleCapabilities();
    
    return {
      ...baseCapabilities,
      domainType: this.domainType,
      domainSpecificProtocols: this.domainSpecificHandlers.supportedProtocols || []
    };
  }
}

/**
 * Factory for creating appropriate tentacle adapters.
 */
class TentacleAdapterFactory {
  /**
   * Creates an appropriate adapter for the given tentacle.
   * @param {Object} tentacle - The tentacle instance to adapt.
   * @param {NeuralCoordinationHub} hub - The neural coordination hub instance.
   * @param {Object} options - Configuration options.
   * @returns {TentacleAdapter} - The created adapter.
   */
  static createAdapter(tentacle, hub, options = {}) {
    // Determine tentacle type
    const tentacleType = TentacleAdapterFactory._determineTentacleType(tentacle);
    
    // Create appropriate adapter based on tentacle type
    switch (tentacleType) {
      case 'domain_specific':
        return new DomainSpecificTentacleAdapter(tentacle, hub, {
          ...options,
          domainType: tentacle.domainType || tentacle.domain || 'generic'
        });
        
      // Add more specialized adapters as needed
      
      default:
        return new TentacleAdapter(tentacle, hub, options);
    }
  }
  
  /**
   * Determines the type of tentacle for adapter selection.
   * @private
   * @param {Object} tentacle - The tentacle instance.
   * @returns {string} - Tentacle type.
   */
  static _determineTentacleType(tentacle) {
    if (tentacle.domainType || tentacle.domain) {
      return 'domain_specific';
    }
    
    // Add more type detection logic as needed
    
    return 'standard';
  }
}

module.exports = {
  TentacleAdapter,
  DomainSpecificTentacleAdapter,
  TentacleAdapterFactory
};
