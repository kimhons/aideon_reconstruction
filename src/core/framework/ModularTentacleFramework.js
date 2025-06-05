/**
 * @fileoverview ModularTentacleFramework - Core architecture for dynamic tentacle growth.
 * This module provides the foundation for Aideon's ability to dynamically grow tentacles
 * based on user needs, with standardized interfaces and lifecycle management.
 * 
 * @module core/framework/ModularTentacleFramework
 */

const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");

// --- Tentacle Lifecycle States ---
const TentacleState = {
  REGISTERED: "REGISTERED",   // Tentacle is registered but not initialized
  INITIALIZING: "INITIALIZING", // Tentacle is being initialized
  ACTIVE: "ACTIVE",         // Tentacle is active and ready for use
  PAUSED: "PAUSED",         // Tentacle is temporarily paused
  STOPPING: "STOPPING",     // Tentacle is in the process of stopping
  STOPPED: "STOPPED",       // Tentacle is stopped but can be restarted
  FAILED: "FAILED",         // Tentacle failed to initialize or encountered a fatal error
  UNREGISTERING: "UNREGISTERING", // Tentacle is being unregistered
  UNREGISTERED: "UNREGISTERED"  // Tentacle is unregistered and resources released
};

// --- Tentacle Categories ---
const TentacleCategory = {
  CORE: "CORE",           // Essential system tentacles
  EXTENSION: "EXTENSION",   // Extended functionality tentacles
  INTEGRATION: "INTEGRATION", // External system integration tentacles
  UTILITY: "UTILITY",       // Utility and helper tentacles
  USER: "USER",           // User-created or customized tentacles
  EXPERIMENTAL: "EXPERIMENTAL" // Experimental or beta tentacles
};

// --- Tentacle Capability Types ---
const CapabilityType = {
  PROVIDER: "PROVIDER",     // Provides capabilities to other tentacles
  CONSUMER: "CONSUMER",     // Consumes capabilities from other tentacles
  PROCESSOR: "PROCESSOR",   // Processes data or requests
  CONNECTOR: "CONNECTOR",   // Connects different tentacles or systems
  ANALYZER: "ANALYZER",     // Analyzes data or behavior
  GENERATOR: "GENERATOR"    // Generates content or data
};

// --- Error Types ---
class TentacleRegistrationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TentacleRegistrationError";
  }
}

class TentacleInitializationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TentacleInitializationError";
  }
}

class TentacleNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "TentacleNotFoundError";
  }
}

class CapabilityNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "CapabilityNotFoundError";
  }
}

class DependencyError extends Error {
  constructor(message) {
    super(message);
    this.name = "DependencyError";
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Creates a ModularTentacleFramework instance with all methods directly on the object.
 * This factory function pattern ensures method preservation across module boundaries.
 * 
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Name of the framework
 * @param {Object} [config.eventEmitter] - Event emitter
 * @param {Object} [config.metrics] - Metrics collector
 * @param {Object} [config.logger] - Logger instance
 * @param {boolean} [config.enableAutoDiscovery] - Whether to enable auto-discovery of tentacles
 * @param {boolean} [config.enableDynamicLoading] - Whether to enable dynamic loading of tentacles
 * @returns {Object} ModularTentacleFramework instance with all methods as own properties
 */
function createModularTentacleFramework(config = {}) {
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
  
  // Create framework instance with all properties and methods directly on the object
  const framework = {
    // Core properties
    id: config.id || uuidv4(),
    name: config.name || "ModularTentacleFramework",
    config: config,
    logger: logger,
    eventEmitter: eventEmitter,
    metrics: metrics,
    tentacles: new Map(),
    capabilities: new Map(),
    dependencies: new Map(),
    tentacleFactories: new Map(),
    enableAutoDiscovery: config.enableAutoDiscovery !== false,
    enableDynamicLoading: config.enableDynamicLoading !== false,
    
    // Methods as direct properties to ensure preservation across module boundaries
    initialize: function() {
      this.logger.info(`Initializing ModularTentacleFramework: ${this.name} (ID: ${this.id})`);
      
      // Register core tentacle factories
      this.registerTentacleFactory("neural", {
        create: (config) => {
          // Import the factory function dynamically
          const createNeuralCoordinationHub = require('../neural/NeuralCoordinationHubFactory');
          return createNeuralCoordinationHub(config);
        },
        category: TentacleCategory.CORE,
        capabilities: ["neural_coordination", "pathway_management", "tentacle_registration"],
        dependencies: []
      });
      
      this.registerTentacleFactory("semantic", {
        create: (config) => {
          // Import the factory function dynamically
          const createSemanticTranslator = require('../semantic/SemanticTranslatorFactory');
          return createSemanticTranslator(config);
        },
        category: TentacleCategory.CORE,
        capabilities: ["semantic_translation", "domain_management", "concept_mapping"],
        dependencies: []
      });
      
      this.registerTentacleFactory("query", {
        create: (config) => {
          // Import the factory function dynamically
          const { createCrossDomainQueryProcessor } = require('../semantic/CrossDomainQueryProcessorFactory');
          
          // Ensure dependencies are provided
          if (!config.knowledgeGraph) {
            throw new DependencyError("CrossDomainQueryProcessor requires a knowledgeGraph dependency");
          }
          
          if (!config.translator) {
            throw new DependencyError("CrossDomainQueryProcessor requires a translator dependency");
          }
          
          return createCrossDomainQueryProcessor(config.knowledgeGraph, config.translator, config);
        },
        category: TentacleCategory.CORE,
        capabilities: ["cross_domain_query", "query_decomposition", "query_execution"],
        dependencies: ["knowledge_graph", "semantic_translation"]
      });
      
      this.eventEmitter.emit("framework:initialized", {
        frameworkId: this.id,
        name: this.name
      });
      
      return this;
    },
    
    /**
     * Registers a tentacle factory for creating tentacles of a specific type.
     * 
     * @param {string} type - Tentacle type identifier
     * @param {Object} factory - Factory definition
     * @param {Function} factory.create - Factory function to create tentacle instances
     * @param {string} factory.category - Tentacle category
     * @param {Array<string>} factory.capabilities - Capabilities provided by tentacles of this type
     * @param {Array<string>} factory.dependencies - Dependencies required by tentacles of this type
     * @returns {Object} This framework instance for chaining
     */
    registerTentacleFactory: function(type, factory) {
      if (this.tentacleFactories.has(type)) {
        this.logger.warn(`Tentacle factory for type ${type} already exists, overwriting`);
      }
      
      this.logger.info(`Registering tentacle factory for type: ${type}`);
      
      // Validate factory
      if (!factory.create || typeof factory.create !== 'function') {
        throw new ValidationError(`Invalid tentacle factory for type ${type}: missing create function`);
      }
      
      if (!factory.category || !Object.values(TentacleCategory).includes(factory.category)) {
        throw new ValidationError(`Invalid tentacle factory for type ${type}: invalid category`);
      }
      
      if (!Array.isArray(factory.capabilities) || factory.capabilities.length === 0) {
        throw new ValidationError(`Invalid tentacle factory for type ${type}: must provide at least one capability`);
      }
      
      if (!Array.isArray(factory.dependencies)) {
        throw new ValidationError(`Invalid tentacle factory for type ${type}: dependencies must be an array`);
      }
      
      // Store factory
      this.tentacleFactories.set(type, {
        type,
        create: factory.create,
        category: factory.category,
        capabilities: factory.capabilities,
        dependencies: factory.dependencies,
        metadata: {
          registeredAt: Date.now()
        }
      });
      
      // Emit event
      this.eventEmitter.emit("factory:registered", {
        type,
        category: factory.category,
        capabilities: factory.capabilities
      });
      
      return this;
    },
    
    /**
     * Creates and registers a tentacle instance.
     * 
     * @param {string} type - Tentacle type identifier
     * @param {Object} config - Tentacle configuration
     * @param {string} [config.id] - Unique identifier (generated if not provided)
     * @param {string} [config.name] - Name of the tentacle
     * @param {Object} [dependencies] - Dependencies to inject into the tentacle
     * @returns {Object} Created tentacle instance
     */
    createTentacle: function(type, config = {}, dependencies = {}) {
      const factory = this.tentacleFactories.get(type);
      
      if (!factory) {
        throw new TentacleRegistrationError(`No factory registered for tentacle type: ${type}`);
      }
      
      this.logger.info(`Creating tentacle of type ${type}: ${config.name || 'unnamed'}`);
      
      // Validate and resolve dependencies
      const resolvedDependencies = this.resolveDependencies(factory.dependencies, dependencies);
      
      // Merge configuration with dependencies
      const mergedConfig = {
        ...config,
        ...resolvedDependencies,
        logger: config.logger || this.logger,
        eventEmitter: config.eventEmitter || this.eventEmitter,
        metrics: config.metrics || this.metrics
      };
      
      try {
        // Create tentacle instance
        const tentacle = factory.create(mergedConfig);
        
        // Generate ID if not provided
        const tentacleId = config.id || tentacle.id || uuidv4();
        
        // Register tentacle
        this.registerTentacle(tentacleId, tentacle, {
          type,
          category: factory.category,
          capabilities: factory.capabilities,
          dependencies: factory.dependencies,
          config: mergedConfig
        });
        
        return tentacle;
      } catch (error) {
        this.logger.error(`Error creating tentacle of type ${type}: ${error.message}`, error);
        throw new TentacleInitializationError(`Failed to create tentacle of type ${type}: ${error.message}`);
      }
    },
    
    /**
     * Registers an existing tentacle instance.
     * 
     * @param {string} tentacleId - Unique identifier for the tentacle
     * @param {Object} tentacle - Tentacle instance
     * @param {Object} metadata - Tentacle metadata
     * @param {string} metadata.type - Tentacle type
     * @param {string} metadata.category - Tentacle category
     * @param {Array<string>} metadata.capabilities - Capabilities provided by the tentacle
     * @param {Array<string>} metadata.dependencies - Dependencies required by the tentacle
     * @param {Object} metadata.config - Tentacle configuration
     * @returns {Object} This framework instance for chaining
     */
    registerTentacle: function(tentacleId, tentacle, metadata) {
      if (this.tentacles.has(tentacleId)) {
        throw new TentacleRegistrationError(`Tentacle with ID ${tentacleId} is already registered`);
      }
      
      this.logger.info(`Registering tentacle: ${tentacle.name || tentacleId} (ID: ${tentacleId})`);
      
      // Create tentacle record
      const tentacleRecord = {
        id: tentacleId,
        instance: tentacle,
        type: metadata.type,
        category: metadata.category,
        capabilities: metadata.capabilities || [],
        dependencies: metadata.dependencies || [],
        config: metadata.config || {},
        state: TentacleState.REGISTERED,
        metadata: {
          registeredAt: Date.now(),
          lastStateChange: Date.now()
        }
      };
      
      // Store tentacle
      this.tentacles.set(tentacleId, tentacleRecord);
      
      // Register capabilities
      for (const capability of tentacleRecord.capabilities) {
        this.registerCapability(capability, tentacleId);
      }
      
      // Emit event
      this.eventEmitter.emit("tentacle:registered", {
        tentacleId,
        type: tentacleRecord.type,
        category: tentacleRecord.category,
        capabilities: tentacleRecord.capabilities
      });
      
      // Initialize tentacle if auto-initialization is enabled
      if (this.config.autoInitializeTentacles) {
        this.initializeTentacle(tentacleId);
      }
      
      return this;
    },
    
    /**
     * Initializes a registered tentacle.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} Initialized tentacle instance
     */
    initializeTentacle: function(tentacleId) {
      const tentacleRecord = this.tentacles.get(tentacleId);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle with ID ${tentacleId} is not registered`);
      }
      
      if (tentacleRecord.state !== TentacleState.REGISTERED && 
          tentacleRecord.state !== TentacleState.STOPPED) {
        this.logger.warn(`Tentacle ${tentacleId} is already initialized or in an incompatible state: ${tentacleRecord.state}`);
        return tentacleRecord.instance;
      }
      
      this.logger.info(`Initializing tentacle: ${tentacleRecord.instance.name || tentacleId}`);
      
      // Update state
      tentacleRecord.state = TentacleState.INITIALIZING;
      tentacleRecord.metadata.lastStateChange = Date.now();
      
      try {
        // Initialize tentacle if it has an initialize method
        if (typeof tentacleRecord.instance.initialize === 'function') {
          tentacleRecord.instance.initialize();
        }
        
        // Update state
        tentacleRecord.state = TentacleState.ACTIVE;
        tentacleRecord.metadata.lastStateChange = Date.now();
        tentacleRecord.metadata.initializedAt = Date.now();
        
        // Emit event
        this.eventEmitter.emit("tentacle:initialized", {
          tentacleId,
          type: tentacleRecord.type,
          category: tentacleRecord.category
        });
        
        return tentacleRecord.instance;
      } catch (error) {
        // Update state
        tentacleRecord.state = TentacleState.FAILED;
        tentacleRecord.metadata.lastStateChange = Date.now();
        tentacleRecord.metadata.error = {
          message: error.message,
          stack: error.stack
        };
        
        // Emit event
        this.eventEmitter.emit("tentacle:initialization-failed", {
          tentacleId,
          error: error.message
        });
        
        throw new TentacleInitializationError(`Failed to initialize tentacle ${tentacleId}: ${error.message}`);
      }
    },
    
    /**
     * Registers a capability provided by a tentacle.
     * 
     * @param {string} capability - Capability identifier
     * @param {string} tentacleId - ID of the tentacle providing the capability
     * @returns {Object} This framework instance for chaining
     */
    registerCapability: function(capability, tentacleId) {
      if (!this.capabilities.has(capability)) {
        this.capabilities.set(capability, new Set());
      }
      
      this.capabilities.get(capability).add(tentacleId);
      
      this.logger.debug(`Registered capability ${capability} for tentacle ${tentacleId}`);
      
      return this;
    },
    
    /**
     * Resolves dependencies for a tentacle.
     * 
     * @param {Array<string>} requiredDependencies - List of required dependency types
     * @param {Object} providedDependencies - Map of provided dependencies
     * @returns {Object} Resolved dependencies
     */
    resolveDependencies: function(requiredDependencies, providedDependencies) {
      const resolved = {};
      
      for (const dependency of requiredDependencies) {
        // Check if dependency is directly provided
        if (providedDependencies[dependency]) {
          resolved[dependency] = providedDependencies[dependency];
          continue;
        }
        
        // Check if dependency is available as a capability
        if (this.capabilities.has(dependency)) {
          const providers = Array.from(this.capabilities.get(dependency));
          
          if (providers.length > 0) {
            // Get the first provider (could implement more sophisticated selection)
            const providerId = providers[0];
            const provider = this.tentacles.get(providerId);
            
            if (provider && provider.state === TentacleState.ACTIVE) {
              resolved[dependency] = provider.instance;
              continue;
            }
          }
        }
        
        // If we get here, the dependency couldn't be resolved
        throw new DependencyError(`Could not resolve dependency: ${dependency}`);
      }
      
      return resolved;
    },
    
    /**
     * Gets a tentacle by ID.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} Tentacle instance
     */
    getTentacle: function(tentacleId) {
      const tentacleRecord = this.tentacles.get(tentacleId);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle with ID ${tentacleId} is not registered`);
      }
      
      return tentacleRecord.instance;
    },
    
    /**
     * Gets tentacles by type.
     * 
     * @param {string} type - Tentacle type
     * @returns {Array<Object>} Array of tentacle instances
     */
    getTentaclesByType: function(type) {
      const tentacles = [];
      
      for (const [id, record] of this.tentacles.entries()) {
        if (record.type === type) {
          tentacles.push(record.instance);
        }
      }
      
      return tentacles;
    },
    
    /**
     * Gets tentacles by category.
     * 
     * @param {string} category - Tentacle category
     * @returns {Array<Object>} Array of tentacle instances
     */
    getTentaclesByCategory: function(category) {
      const tentacles = [];
      
      for (const [id, record] of this.tentacles.entries()) {
        if (record.category === category) {
          tentacles.push(record.instance);
        }
      }
      
      return tentacles;
    },
    
    /**
     * Gets tentacles by capability.
     * 
     * @param {string} capability - Capability identifier
     * @returns {Array<Object>} Array of tentacle instances
     */
    getTentaclesByCapability: function(capability) {
      const tentacles = [];
      
      if (this.capabilities.has(capability)) {
        for (const tentacleId of this.capabilities.get(capability)) {
          const record = this.tentacles.get(tentacleId);
          if (record) {
            tentacles.push(record.instance);
          }
        }
      }
      
      return tentacles;
    },
    
    /**
     * Gets a tentacle that provides a specific capability.
     * 
     * @param {string} capability - Capability identifier
     * @returns {Object} Tentacle instance
     */
    getTentacleWithCapability: function(capability) {
      const tentacles = this.getTentaclesByCapability(capability);
      
      if (tentacles.length === 0) {
        throw new CapabilityNotFoundError(`No tentacle provides capability: ${capability}`);
      }
      
      return tentacles[0];
    },
    
    /**
     * Pauses a tentacle.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} This framework instance for chaining
     */
    pauseTentacle: function(tentacleId) {
      const tentacleRecord = this.tentacles.get(tentacleId);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle with ID ${tentacleId} is not registered`);
      }
      
      if (tentacleRecord.state !== TentacleState.ACTIVE) {
        this.logger.warn(`Cannot pause tentacle ${tentacleId} in state: ${tentacleRecord.state}`);
        return this;
      }
      
      this.logger.info(`Pausing tentacle: ${tentacleRecord.instance.name || tentacleId}`);
      
      // Call pause method if available
      if (typeof tentacleRecord.instance.pause === 'function') {
        tentacleRecord.instance.pause();
      }
      
      // Update state
      tentacleRecord.state = TentacleState.PAUSED;
      tentacleRecord.metadata.lastStateChange = Date.now();
      
      // Emit event
      this.eventEmitter.emit("tentacle:paused", {
        tentacleId,
        type: tentacleRecord.type,
        category: tentacleRecord.category
      });
      
      return this;
    },
    
    /**
     * Resumes a paused tentacle.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} This framework instance for chaining
     */
    resumeTentacle: function(tentacleId) {
      const tentacleRecord = this.tentacles.get(tentacleId);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle with ID ${tentacleId} is not registered`);
      }
      
      if (tentacleRecord.state !== TentacleState.PAUSED) {
        this.logger.warn(`Cannot resume tentacle ${tentacleId} in state: ${tentacleRecord.state}`);
        return this;
      }
      
      this.logger.info(`Resuming tentacle: ${tentacleRecord.instance.name || tentacleId}`);
      
      // Call resume method if available
      if (typeof tentacleRecord.instance.resume === 'function') {
        tentacleRecord.instance.resume();
      }
      
      // Update state
      tentacleRecord.state = TentacleState.ACTIVE;
      tentacleRecord.metadata.lastStateChange = Date.now();
      
      // Emit event
      this.eventEmitter.emit("tentacle:resumed", {
        tentacleId,
        type: tentacleRecord.type,
        category: tentacleRecord.category
      });
      
      return this;
    },
    
    /**
     * Stops a tentacle.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} This framework instance for chaining
     */
    stopTentacle: function(tentacleId) {
      const tentacleRecord = this.tentacles.get(tentacleId);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle with ID ${tentacleId} is not registered`);
      }
      
      if (tentacleRecord.state !== TentacleState.ACTIVE && 
          tentacleRecord.state !== TentacleState.PAUSED) {
        this.logger.warn(`Cannot stop tentacle ${tentacleId} in state: ${tentacleRecord.state}`);
        return this;
      }
      
      this.logger.info(`Stopping tentacle: ${tentacleRecord.instance.name || tentacleId}`);
      
      // Update state
      tentacleRecord.state = TentacleState.STOPPING;
      tentacleRecord.metadata.lastStateChange = Date.now();
      
      try {
        // Call stop method if available
        if (typeof tentacleRecord.instance.stop === 'function') {
          tentacleRecord.instance.stop();
        }
        
        // Update state
        tentacleRecord.state = TentacleState.STOPPED;
        tentacleRecord.metadata.lastStateChange = Date.now();
        
        // Emit event
        this.eventEmitter.emit("tentacle:stopped", {
          tentacleId,
          type: tentacleRecord.type,
          category: tentacleRecord.category
        });
      } catch (error) {
        // Update state
        tentacleRecord.state = TentacleState.FAILED;
        tentacleRecord.metadata.lastStateChange = Date.now();
        tentacleRecord.metadata.error = {
          message: error.message,
          stack: error.stack
        };
        
        // Emit event
        this.eventEmitter.emit("tentacle:stop-failed", {
          tentacleId,
          error: error.message
        });
        
        this.logger.error(`Error stopping tentacle ${tentacleId}: ${error.message}`, error);
      }
      
      return this;
    },
    
    /**
     * Unregisters a tentacle.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} This framework instance for chaining
     */
    unregisterTentacle: function(tentacleId) {
      const tentacleRecord = this.tentacles.get(tentacleId);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle with ID ${tentacleId} is not registered`);
      }
      
      this.logger.info(`Unregistering tentacle: ${tentacleRecord.instance.name || tentacleId}`);
      
      // Stop tentacle if active
      if (tentacleRecord.state === TentacleState.ACTIVE || 
          tentacleRecord.state === TentacleState.PAUSED) {
        this.stopTentacle(tentacleId);
      }
      
      // Update state
      tentacleRecord.state = TentacleState.UNREGISTERING;
      tentacleRecord.metadata.lastStateChange = Date.now();
      
      try {
        // Call unregister method if available
        if (typeof tentacleRecord.instance.unregister === 'function') {
          tentacleRecord.instance.unregister();
        }
        
        // Remove capabilities
        for (const capability of tentacleRecord.capabilities) {
          if (this.capabilities.has(capability)) {
            this.capabilities.get(capability).delete(tentacleId);
            
            // Clean up empty capability sets
            if (this.capabilities.get(capability).size === 0) {
              this.capabilities.delete(capability);
            }
          }
        }
        
        // Remove tentacle
        this.tentacles.delete(tentacleId);
        
        // Emit event
        this.eventEmitter.emit("tentacle:unregistered", {
          tentacleId,
          type: tentacleRecord.type,
          category: tentacleRecord.category
        });
      } catch (error) {
        // Update state but keep tentacle registered
        tentacleRecord.state = TentacleState.FAILED;
        tentacleRecord.metadata.lastStateChange = Date.now();
        tentacleRecord.metadata.error = {
          message: error.message,
          stack: error.stack
        };
        
        // Emit event
        this.eventEmitter.emit("tentacle:unregister-failed", {
          tentacleId,
          error: error.message
        });
        
        this.logger.error(`Error unregistering tentacle ${tentacleId}: ${error.message}`, error);
      }
      
      return this;
    },
    
    /**
     * Discovers available tentacle types.
     * 
     * @returns {Array<Object>} Array of available tentacle types
     */
    discoverTentacleTypes: function() {
      if (!this.enableAutoDiscovery) {
        this.logger.warn("Auto-discovery is disabled");
        return Array.from(this.tentacleFactories.keys());
      }
      
      this.logger.info("Discovering available tentacle types");
      
      // In a real implementation, this would scan for available tentacle modules
      // For now, just return the registered factories
      return Array.from(this.tentacleFactories.entries()).map(([type, factory]) => ({
        type,
        category: factory.category,
        capabilities: factory.capabilities,
        dependencies: factory.dependencies
      }));
    },
    
    /**
     * Dynamically loads a tentacle module.
     * 
     * @param {string} modulePath - Path to the tentacle module
     * @returns {Object} Loaded tentacle factory
     */
    loadTentacleModule: function(modulePath) {
      if (!this.enableDynamicLoading) {
        throw new Error("Dynamic loading is disabled");
      }
      
      this.logger.info(`Loading tentacle module: ${modulePath}`);
      
      try {
        // In a real implementation, this would dynamically load the module
        // For now, just require the module
        const module = require(modulePath);
        
        // Register factory if module exports a factory function
        if (module.createTentacle && typeof module.createTentacle === 'function') {
          const type = module.type || modulePath.split('/').pop().replace(/\.js$/, '');
          
          this.registerTentacleFactory(type, {
            create: module.createTentacle,
            category: module.category || TentacleCategory.EXTENSION,
            capabilities: module.capabilities || [],
            dependencies: module.dependencies || []
          });
          
          return this.tentacleFactories.get(type);
        } else {
          throw new Error(`Module does not export a valid tentacle factory: ${modulePath}`);
        }
      } catch (error) {
        this.logger.error(`Error loading tentacle module ${modulePath}: ${error.message}`, error);
        throw error;
      }
    },
    
    /**
     * Gets statistics about the framework.
     * 
     * @returns {Object} Framework statistics
     */
    getStatistics: function() {
      const tentaclesByCategory = {};
      const tentaclesByState = {};
      const tentaclesByType = {};
      
      // Initialize counters
      for (const category of Object.values(TentacleCategory)) {
        tentaclesByCategory[category] = 0;
      }
      
      for (const state of Object.values(TentacleState)) {
        tentaclesByState[state] = 0;
      }
      
      // Count tentacles
      for (const [id, record] of this.tentacles.entries()) {
        tentaclesByCategory[record.category] = (tentaclesByCategory[record.category] || 0) + 1;
        tentaclesByState[record.state] = (tentaclesByState[record.state] || 0) + 1;
        tentaclesByType[record.type] = (tentaclesByType[record.type] || 0) + 1;
      }
      
      return {
        tentacleCount: this.tentacles.size,
        factoryCount: this.tentacleFactories.size,
        capabilityCount: this.capabilities.size,
        tentaclesByCategory,
        tentaclesByState,
        tentaclesByType,
        timestamp: Date.now()
      };
    },
    
    /**
     * Gets a list of all registered tentacles.
     * 
     * @returns {Array<Object>} Array of tentacle records
     */
    listTentacles: function() {
      return Array.from(this.tentacles.entries()).map(([id, record]) => ({
        id,
        name: record.instance.name || id,
        type: record.type,
        category: record.category,
        state: record.state,
        capabilities: record.capabilities,
        registeredAt: record.metadata.registeredAt,
        lastStateChange: record.metadata.lastStateChange
      }));
    },
    
    /**
     * Gets a list of all registered tentacle factories.
     * 
     * @returns {Array<Object>} Array of factory records
     */
    listTentacleFactories: function() {
      return Array.from(this.tentacleFactories.entries()).map(([type, factory]) => ({
        type,
        category: factory.category,
        capabilities: factory.capabilities,
        dependencies: factory.dependencies,
        registeredAt: factory.metadata.registeredAt
      }));
    },
    
    /**
     * Gets a list of all registered capabilities.
     * 
     * @returns {Array<Object>} Array of capability records
     */
    listCapabilities: function() {
      return Array.from(this.capabilities.entries()).map(([capability, tentacleIds]) => ({
        capability,
        providerCount: tentacleIds.size,
        providers: Array.from(tentacleIds)
      }));
    },
    
    // Event interface methods
    on: function(event, listener) {
      this.eventEmitter.on(event, listener);
      return this;
    },
    
    once: function(event, listener) {
      this.eventEmitter.once(event, listener);
      return this;
    },
    
    off: function(event, listener) {
      this.eventEmitter.off(event, listener);
      return this;
    },
    
    emit: function(event, ...args) {
      return this.eventEmitter.emit(event, ...args);
    }
  };
  
  // Initialize framework
  framework.initialize();
  
  // Log creation
  logger.info(`Created ModularTentacleFramework: ${framework.name} (ID: ${framework.id})`);
  
  // Add debugging helper to verify method presence
  framework.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`ModularTentacleFramework has these methods: ${methods.join(', ')}`);
    return methods;
  };
  
  return framework;
}

module.exports = {
  createModularTentacleFramework,
  TentacleState,
  TentacleCategory,
  CapabilityType,
  // Export error types
  TentacleRegistrationError,
  TentacleInitializationError,
  TentacleNotFoundError,
  CapabilityNotFoundError,
  DependencyError,
  ValidationError
};
