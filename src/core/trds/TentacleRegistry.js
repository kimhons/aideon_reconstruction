/**
 * TentacleRegistry.js
 * 
 * Registry for managing tentacles in the Aideon AI Desktop Agent.
 * Provides tentacle registration, discovery, and capability-based routing.
 * 
 * Enhanced with dynamic tentacle loading, capability discovery, and advanced routing.
 */

// Import using module aliases instead of relative paths
const { TentacleCommunicationBus } = require('./TentacleCommunicationBus');
const { TentacleResourceManager } = require('./TentacleResourceManager');
const { Logger } = require('../utils/Logger');

/**
 * Registry for managing tentacles
 * @class TentacleRegistry
 */
class TentacleRegistry {
  /**
   * Constructor for the TentacleRegistry class
   * @constructor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.logger = new Logger('TentacleRegistry');
    this.tentacles = new Map();
    this.capabilities = new Map();
    this.domains = new Map();
    
    this.options = {
      enableCapabilityRouting: options.enableCapabilityRouting !== false,
      enableDomainOrganization: options.enableDomainOrganization !== false,
      enableDynamicLoading: options.enableDynamicLoading !== false,
      ...options
    };
    
    // Get communication bus
    this.communicationBus = TentacleCommunicationBus.getInstance();
    
    // Get resource manager
    this.resourceManager = TentacleResourceManager.getInstance();
    
    this.logger.info('TentacleRegistry initialized');
  }

  /**
   * Get the singleton instance
   * @static
   * @returns {TentacleRegistry} The singleton instance
   */
  static getInstance() {
    if (!TentacleRegistry.instance) {
      TentacleRegistry.instance = new TentacleRegistry();
    }
    return TentacleRegistry.instance;
  }

  /**
   * Register a tentacle with the registry
   * @async
   * @param {Object} tentacle - Tentacle to register
   * @returns {Promise<Object>} Registration result
   */
  async registerTentacle(tentacle) {
    const tentacleId = tentacle.id || `tentacle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info(`Registering tentacle: ${tentacle.name} (${tentacleId})`);
    
    // Set tentacle ID if not already set
    if (!tentacle.id) {
      tentacle.id = tentacleId;
    }
    
    // Add to registry
    this.tentacles.set(tentacleId, tentacle);
    
    // Register capabilities
    const capabilities = tentacle.getCapabilities ? tentacle.getCapabilities() : [];
    
    for (const capability of capabilities) {
      this.registerCapability(tentacleId, capability);
    }
    
    // Register domain
    if (tentacle.domain) {
      this.registerDomain(tentacleId, tentacle.domain);
    }
    
    // Allocate resources
    if (tentacle.getResourceRequirements) {
      const resourceRequirements = tentacle.getResourceRequirements();
      this.resourceManager.allocateResources(tentacleId, resourceRequirements);
    }
    
    // Publish registration event
    this.communicationBus.publish('tentacle-registered', {
      tentacleId,
      name: tentacle.name,
      description: tentacle.description,
      version: tentacle.version,
      capabilities
    });
    
    return {
      tentacleId,
      timestamp: Date.now(),
      success: true
    };
  }

  /**
   * Unregister a tentacle from the registry
   * @param {string} tentacleId - ID of the tentacle to unregister
   * @returns {boolean} Success
   */
  unregisterTentacle(tentacleId) {
    const tentacle = this.tentacles.get(tentacleId);
    
    if (!tentacle) {
      this.logger.warn(`Tentacle not found: ${tentacleId}`);
      return false;
    }
    
    this.logger.info(`Unregistering tentacle: ${tentacle.name} (${tentacleId})`);
    
    // Remove capabilities
    const capabilities = tentacle.getCapabilities ? tentacle.getCapabilities() : [];
    
    for (const capability of capabilities) {
      this.unregisterCapability(tentacleId, capability);
    }
    
    // Remove domain
    if (tentacle.domain) {
      this.unregisterDomain(tentacleId, tentacle.domain);
    }
    
    // Release resources
    this.resourceManager.releaseResources(tentacleId);
    
    // Remove from registry
    this.tentacles.delete(tentacleId);
    
    // Publish unregistration event
    this.communicationBus.publish('tentacle-unregistered', {
      tentacleId,
      name: tentacle.name
    });
    
    return true;
  }

  /**
   * Register a capability for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} capability - Capability to register
   */
  registerCapability(tentacleId, capability) {
    if (!this.capabilities.has(capability)) {
      this.capabilities.set(capability, new Set());
    }
    
    this.capabilities.get(capability).add(tentacleId);
    
    this.logger.debug(`Registered capability: ${capability} for tentacle: ${tentacleId}`);
  }

  /**
   * Unregister a capability for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} capability - Capability to unregister
   */
  unregisterCapability(tentacleId, capability) {
    if (!this.capabilities.has(capability)) {
      return;
    }
    
    this.capabilities.get(capability).delete(tentacleId);
    
    // Remove capability if no tentacles have it
    if (this.capabilities.get(capability).size === 0) {
      this.capabilities.delete(capability);
    }
    
    this.logger.debug(`Unregistered capability: ${capability} for tentacle: ${tentacleId}`);
  }

  /**
   * Register a domain for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} domain - Domain to register
   */
  registerDomain(tentacleId, domain) {
    if (!this.domains.has(domain)) {
      this.domains.set(domain, new Set());
    }
    
    this.domains.get(domain).add(tentacleId);
    
    this.logger.debug(`Registered domain: ${domain} for tentacle: ${tentacleId}`);
  }

  /**
   * Unregister a domain for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} domain - Domain to unregister
   */
  unregisterDomain(tentacleId, domain) {
    if (!this.domains.has(domain)) {
      return;
    }
    
    this.domains.get(domain).delete(tentacleId);
    
    // Remove domain if no tentacles have it
    if (this.domains.get(domain).size === 0) {
      this.domains.delete(domain);
    }
    
    this.logger.debug(`Unregistered domain: ${domain} for tentacle: ${tentacleId}`);
  }

  /**
   * Get a tentacle by ID
   * @param {string} tentacleId - ID of the tentacle
   * @returns {Object} The tentacle
   */
  getTentacle(tentacleId) {
    return this.tentacles.get(tentacleId);
  }

  /**
   * Get all tentacles
   * @returns {Array<Object>} All tentacles
   */
  getAllTentacles() {
    return Array.from(this.tentacles.values());
  }

  /**
   * Get tentacles with a specific capability
   * @param {string} capability - Capability to look for
   * @returns {Array<Object>} Tentacles with the capability
   */
  getTentaclesWithCapability(capability) {
    if (!this.capabilities.has(capability)) {
      return [];
    }
    
    const tentacleIds = Array.from(this.capabilities.get(capability));
    return tentacleIds.map(id => this.tentacles.get(id)).filter(Boolean);
  }

  /**
   * Get tentacles in a specific domain
   * @param {string} domain - Domain to look for
   * @returns {Array<Object>} Tentacles in the domain
   */
  getTentaclesInDomain(domain) {
    if (!this.domains.has(domain)) {
      return [];
    }
    
    const tentacleIds = Array.from(this.domains.get(domain));
    return tentacleIds.map(id => this.tentacles.get(id)).filter(Boolean);
  }

  /**
   * Route a request to a tentacle based on capability
   * @async
   * @param {string} capability - Capability to route to
   * @param {Object} request - Request to route
   * @param {Object} options - Routing options
   * @returns {Promise<Object>} Response from tentacle
   */
  async routeRequest(capability, request, options = {}) {
    if (!this.options.enableCapabilityRouting) {
      throw new Error('Capability routing is disabled');
    }
    
    const tentacles = this.getTentaclesWithCapability(capability);
    
    if (tentacles.length === 0) {
      throw new Error(`No tentacles found with capability: ${capability}`);
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
      // TODO: Implement round-robin selection
      selectedTentacle = tentacles[0];
    } else if (options.strategy === 'load-balanced') {
      // Select tentacle with lowest load
      selectedTentacle = tentacles.reduce((lowest, current) => {
        const lowestUsage = this.resourceManager.getTentacleResourceUsage(lowest.id);
        const currentUsage = this.resourceManager.getTentacleResourceUsage(current.id);
        
        if (!lowestUsage || !currentUsage) {
          return lowest;
        }
        
        const lowestLoad = lowestUsage.usage.cpu / lowestUsage.allocation.cpu;
        const currentLoad = currentUsage.usage.cpu / currentUsage.allocation.cpu;
        
        return currentLoad < lowestLoad ? current : lowest;
      }, tentacles[0]);
    } else {
      // Default: select first tentacle
      selectedTentacle = tentacles[0];
    }
    
    this.logger.info(`Routing request to tentacle: ${selectedTentacle.name} (${selectedTentacle.id})`);
    
    // Call tentacle capability
    const capabilityFn = selectedTentacle[capability] || selectedTentacle.handleCapability;
    
    if (typeof capabilityFn !== 'function') {
      throw new Error(`Tentacle does not implement capability: ${capability}`);
    }
    
    return capabilityFn.call(selectedTentacle, request, options);
  }

  /**
   * Load a tentacle dynamically
   * @async
   * @param {string} tentaclePath - Path to tentacle module
   * @returns {Promise<Object>} Loaded tentacle
   */
  async loadTentacle(tentaclePath) {
    if (!this.options.enableDynamicLoading) {
      throw new Error('Dynamic loading is disabled');
    }
    
    this.logger.info(`Loading tentacle from path: ${tentaclePath}`);
    
    try {
      // Load tentacle module
      const tentacleModule = require(tentaclePath);
      
      // Get tentacle class
      const TentacleClass = tentacleModule.default || Object.values(tentacleModule)[0];
      
      if (!TentacleClass) {
        throw new Error('No tentacle class found in module');
      }
      
      // Create tentacle instance
      const tentacle = new TentacleClass();
      
      // Initialize tentacle
      if (tentacle.initialize) {
        await tentacle.initialize();
      }
      
      // Register tentacle
      await this.registerTentacle(tentacle);
      
      return tentacle;
    } catch (error) {
      this.logger.error(`Failed to load tentacle: ${tentaclePath}`, error);
      throw error;
    }
  }

  /**
   * Get all available capabilities
   * @returns {Array<string>} Available capabilities
   */
  getAvailableCapabilities() {
    return Array.from(this.capabilities.keys());
  }

  /**
   * Get all available domains
   * @returns {Array<string>} Available domains
   */
  getAvailableDomains() {
    return Array.from(this.domains.keys());
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Unregister all tentacles
    for (const tentacleId of this.tentacles.keys()) {
      this.unregisterTentacle(tentacleId);
    }
    
    this.tentacles.clear();
    this.capabilities.clear();
    this.domains.clear();
    
    this.logger.info('TentacleRegistry cleaned up');
  }
}

module.exports = { TentacleRegistry };
