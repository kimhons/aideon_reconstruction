/**
 * @fileoverview Tentacle Integration Layer for the Neural Hyperconnectivity System.
 * This module provides a comprehensive integration layer that connects existing
 * tentacles to the Neural Hyperconnectivity System, ensuring seamless communication
 * and context preservation across the entire Aideon ecosystem.
 * 
 * @module core/neural/adapters/TentacleIntegrationLayer
 */

const { TentacleAdapter, DomainSpecificTentacleAdapter, TentacleAdapterFactory } = require('./TentacleAdapter');
const { NeuralCoordinationHub } = require('../NeuralCoordinationHub');

/**
 * Manages the integration of all tentacles with the Neural Hyperconnectivity System.
 */
class TentacleIntegrationLayer {
  /**
   * Creates a new tentacle integration layer.
   * @param {NeuralCoordinationHub} hub - The neural coordination hub instance.
   * @param {Object} options - Configuration options.
   */
  constructor(hub, options = {}) {
    if (!hub || !(hub instanceof NeuralCoordinationHub)) {
      throw new Error('Valid NeuralCoordinationHub instance is required');
    }
    
    this.hub = hub;
    this.options = {
      autoRegisterTentacles: true,
      enableLegacyFallback: true,
      adaptiveBandwidth: true,
      contextPreservationLevel: 'high',
      ...options
    };
    
    this.adapters = new Map();
    this.tentacleRegistry = new Map();
    this.domainRegistry = new Map();
    
    this.stats = {
      registeredTentacles: 0,
      activeAdapters: 0,
      totalMessagesProcessed: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
      averageLatency: 0,
      errors: 0,
      lastUpdated: Date.now()
    };
    
    console.log('TentacleIntegrationLayer initialized');
  }
  
  /**
   * Registers a tentacle with the integration layer.
   * @param {Object} tentacle - The tentacle instance to register.
   * @param {Object} options - Registration options.
   * @returns {TentacleAdapter} - The created adapter.
   */
  registerTentacle(tentacle, options = {}) {
    try {
      if (!tentacle || !tentacle.id) {
        this.stats.errors++;
        throw new Error('Tentacle instance with valid ID is required');
      }
      
      const tentacleId = tentacle.id;
      
      // Check if already registered
      if (this.adapters.has(tentacleId)) {
        console.log(`Tentacle ${tentacleId} already registered, returning existing adapter`);
        return this.adapters.get(tentacleId);
      }
      
      // Merge options
      const adapterOptions = {
        ...this.options,
        ...options
      };
      
      // Create appropriate adapter
      const adapter = TentacleAdapterFactory.createAdapter(tentacle, this.hub, adapterOptions);
      
      // Store adapter
      this.adapters.set(tentacleId, adapter);
      
      // Register in tentacle registry
      this.tentacleRegistry.set(tentacleId, {
        tentacle,
        adapter,
        registeredAt: Date.now(),
        options: adapterOptions
      });
      
      // Register in domain registry if applicable
      const domain = tentacle.domain || tentacle.domainType || 'generic';
      if (!this.domainRegistry.has(domain)) {
        this.domainRegistry.set(domain, new Set());
      }
      this.domainRegistry.get(domain).add(tentacleId);
      
      // Update stats
      this.stats.registeredTentacles++;
      this.stats.activeAdapters++;
      this.stats.lastUpdated = Date.now();
      
      console.log(`Tentacle ${tentacleId} registered with domain ${domain}`);
      
      // Register with hub if auto-register is enabled
      if (this.options.autoRegisterTentacles) {
        adapter.register().catch(error => {
          console.error(`Error auto-registering tentacle ${tentacleId}:`, error);
          this.stats.errors++;
        });
      }
      
      return adapter;
    } catch (error) {
      console.error('Error registering tentacle:', error);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Unregisters a tentacle from the integration layer.
   * @param {string} tentacleId - ID of the tentacle to unregister.
   * @returns {boolean} - Whether unregistration was successful.
   */
  unregisterTentacle(tentacleId) {
    try {
      if (!this.adapters.has(tentacleId)) {
        console.warn(`Tentacle ${tentacleId} not registered, cannot unregister`);
        return false;
      }
      
      // Get tentacle info
      const tentacleInfo = this.tentacleRegistry.get(tentacleId);
      
      // Remove from domain registry
      const domain = tentacleInfo.tentacle.domain || tentacleInfo.tentacle.domainType || 'generic';
      if (this.domainRegistry.has(domain)) {
        this.domainRegistry.get(domain).delete(tentacleId);
        
        // Clean up empty domain sets
        if (this.domainRegistry.get(domain).size === 0) {
          this.domainRegistry.delete(domain);
        }
      }
      
      // Remove from registries
      this.adapters.delete(tentacleId);
      this.tentacleRegistry.delete(tentacleId);
      
      // Update stats
      this.stats.activeAdapters--;
      this.stats.lastUpdated = Date.now();
      
      console.log(`Tentacle ${tentacleId} unregistered`);
      return true;
    } catch (error) {
      console.error(`Error unregistering tentacle ${tentacleId}:`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * Gets an adapter for a registered tentacle.
   * @param {string} tentacleId - ID of the tentacle.
   * @returns {TentacleAdapter|null} - The adapter or null if not found.
   */
  getAdapter(tentacleId) {
    return this.adapters.get(tentacleId) || null;
  }
  
  /**
   * Gets all tentacles registered for a specific domain.
   * @param {string} domain - Domain to query.
   * @returns {Array<string>} - Array of tentacle IDs in the domain.
   */
  getTentaclesByDomain(domain) {
    if (!this.domainRegistry.has(domain)) {
      return [];
    }
    
    return Array.from(this.domainRegistry.get(domain));
  }
  
  /**
   * Sends a message from one tentacle to another through the neural system.
   * @param {string} sourceTentacleId - Source tentacle ID.
   * @param {string} targetTentacleId - Target tentacle ID.
   * @param {Object} message - Message to send.
   * @param {Object} options - Send options.
   * @returns {Promise<Object>} - Send result.
   */
  async sendMessage(sourceTentacleId, targetTentacleId, message, options = {}) {
    try {
      const sourceAdapter = this.getAdapter(sourceTentacleId);
      
      if (!sourceAdapter) {
        this.stats.errors++;
        throw new Error(`Source tentacle ${sourceTentacleId} not registered`);
      }
      
      // Check if target is registered
      if (!this.adapters.has(targetTentacleId)) {
        console.warn(`Target tentacle ${targetTentacleId} not registered, attempting direct transmission`);
      }
      
      const startTime = Date.now();
      
      const result = await sourceAdapter.send(targetTentacleId, message, options);
      
      // Update stats
      this.stats.totalMessagesProcessed++;
      this.stats.totalBytesSent += JSON.stringify(message).length;
      
      const latency = Date.now() - startTime;
      this._updateAverageLatency(latency);
      
      return result;
    } catch (error) {
      console.error(`Error sending message from ${sourceTentacleId} to ${targetTentacleId}:`, error);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Broadcasts a message to all tentacles in a specific domain.
   * @param {string} sourceTentacleId - Source tentacle ID.
   * @param {string} targetDomain - Target domain.
   * @param {Object} message - Message to broadcast.
   * @param {Object} options - Broadcast options.
   * @returns {Promise<Array<Object>>} - Array of send results.
   */
  async broadcastToDomain(sourceTentacleId, targetDomain, message, options = {}) {
    try {
      const targetTentacles = this.getTentaclesByDomain(targetDomain);
      
      if (targetTentacles.length === 0) {
        console.warn(`No tentacles registered for domain ${targetDomain}`);
        return [];
      }
      
      const results = [];
      
      for (const targetId of targetTentacles) {
        // Skip sending to self
        if (targetId === sourceTentacleId) {
          continue;
        }
        
        try {
          const result = await this.sendMessage(sourceTentacleId, targetId, message, options);
          results.push({
            targetId,
            result,
            success: true
          });
        } catch (error) {
          results.push({
            targetId,
            error: error.message,
            success: false
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Error broadcasting from ${sourceTentacleId} to domain ${targetDomain}:`, error);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Processes an incoming message for a tentacle.
   * @param {string} targetTentacleId - Target tentacle ID.
   * @param {Object} transmission - Transmission from neural system.
   * @returns {Object} - Processed message.
   */
  processIncomingMessage(targetTentacleId, transmission) {
    try {
      const targetAdapter = this.getAdapter(targetTentacleId);
      
      if (!targetAdapter) {
        this.stats.errors++;
        throw new Error(`Target tentacle ${targetTentacleId} not registered`);
      }
      
      const message = targetAdapter.receive(transmission);
      
      // Update stats
      this.stats.totalMessagesProcessed++;
      this.stats.totalBytesReceived += JSON.stringify(transmission).length;
      this.stats.lastUpdated = Date.now();
      
      return message;
    } catch (error) {
      console.error(`Error processing incoming message for ${targetTentacleId}:`, error);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Gets statistics for the integration layer.
   * @returns {Object} - Integration layer statistics.
   */
  getStats() {
    // Collect stats from all adapters
    let totalPathways = 0;
    
    for (const adapter of this.adapters.values()) {
      const adapterStats = adapter.getStats();
      totalPathways += adapterStats.pathwayCacheSize || 0;
    }
    
    return {
      ...this.stats,
      registeredDomains: this.domainRegistry.size,
      totalPathways,
      hubStats: this.hub.getStats()
    };
  }
  
  /**
   * Updates the average latency with a new measurement.
   * @private
   * @param {number} latency - New latency measurement.
   */
  _updateAverageLatency(latency) {
    const alpha = 0.2; // Smoothing factor
    this.stats.averageLatency = 
      alpha * latency + (1 - alpha) * (this.stats.averageLatency || latency);
    this.stats.lastUpdated = Date.now();
  }
  
  /**
   * Bulk registers multiple tentacles.
   * @param {Array<Object>} tentacles - Array of tentacle instances.
   * @param {Object} options - Registration options.
   * @returns {Array<TentacleAdapter>} - Array of created adapters.
   */
  registerMultipleTentacles(tentacles, options = {}) {
    try {
      if (!Array.isArray(tentacles)) {
        this.stats.errors++;
        throw new Error('Expected array of tentacles');
      }
      
      const adapters = [];
      
      for (const tentacle of tentacles) {
        try {
          const adapter = this.registerTentacle(tentacle, options);
          adapters.push(adapter);
        } catch (error) {
          console.error(`Error registering tentacle ${tentacle.id || 'unknown'}:`, error);
          this.stats.errors++;
        }
      }
      
      return adapters;
    } catch (error) {
      console.error('Error registering multiple tentacles:', error);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Creates a communication chain across multiple tentacles.
   * @param {Array<string>} tentacleChain - Ordered array of tentacle IDs.
   * @param {Object} initialMessage - Initial message to send.
   * @param {Object} options - Chain options.
   * @returns {Promise<Object>} - Final result.
   */
  async createCommunicationChain(tentacleChain, initialMessage, options = {}) {
    try {
      if (!Array.isArray(tentacleChain) || tentacleChain.length < 2) {
        this.stats.errors++;
        throw new Error('Tentacle chain must be an array with at least 2 tentacles');
      }
      
      let currentMessage = initialMessage;
      let currentOptions = options;
      
      // Process through chain
      for (let i = 0; i < tentacleChain.length - 1; i++) {
        const sourceId = tentacleChain[i];
        const targetId = tentacleChain[i + 1];
        
        // Add chain position to options
        currentOptions = {
          ...currentOptions,
          chainPosition: i,
          chainLength: tentacleChain.length - 1
        };
        
        // Send to next tentacle in chain
        const result = await this.sendMessage(sourceId, targetId, currentMessage, currentOptions);
        
        // Prepare for next hop
        if (result.success && options.processIntermediateResults !== false) {
          // Extract processed message for next hop
          const targetAdapter = this.getAdapter(targetId);
          if (targetAdapter) {
            const processedMessage = targetAdapter.receive({
              success: true,
              transmissionId: result.transmissionId,
              result: {
                signal: { type: currentMessage.type, payload: currentMessage.payload },
                context: { sourceTentacleId: sourceId }
              }
            });
            
            currentMessage = processedMessage;
          }
        }
      }
      
      return {
        success: true,
        chainCompleted: true,
        finalTargetId: tentacleChain[tentacleChain.length - 1],
        finalMessage: currentMessage
      };
    } catch (error) {
      console.error('Error creating communication chain:', error);
      this.stats.errors++;
      throw error;
    }
  }
}

module.exports = {
  TentacleIntegrationLayer
};
