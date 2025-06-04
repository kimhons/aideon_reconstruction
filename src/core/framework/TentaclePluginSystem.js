/**
 * @fileoverview TentaclePluginSystem - Plugin architecture for third-party tentacle development.
 * This module provides a plugin system that allows third-party developers to create
 * and distribute tentacles for Aideon, with standardized packaging, versioning,
 * and security features.
 * 
 * @module core/framework/TentaclePluginSystem
 */

const { v4: uuidv4 } = require("uuid");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Import the ModularTentacleFramework
const { 
  createModularTentacleFramework,
  TentacleState,
  TentacleCategory,
  CapabilityType,
  TentacleRegistrationError,
  TentacleInitializationError,
  TentacleNotFoundError,
  CapabilityNotFoundError,
  DependencyError,
  ValidationError
} = require('./ModularTentacleFramework');

// --- Plugin System Error Types ---
class PluginValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginValidationError";
  }
}

class PluginInstallationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginInstallationError";
  }
}

class PluginActivationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginActivationError";
  }
}

class PluginSecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginSecurityError";
  }
}

class PluginCompatibilityError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginCompatibilityError";
  }
}

class PluginNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginNotFoundError";
  }
}

class PluginDependencyError extends Error {
  constructor(message) {
    super(message);
    this.name = "PluginDependencyError";
  }
}

// --- Plugin Manifest Schema ---
const manifestSchema = {
  name: { type: "string", required: true },
  version: { type: "string", required: true },
  description: { type: "string", required: true },
  author: { type: "string", required: true },
  license: { type: "string", required: true },
  main: { type: "string", required: true },
  tentacles: { type: "array", required: true },
  dependencies: { type: "object", required: false },
  aideonVersion: { type: "string", required: true },
  permissions: { type: "array", required: false },
  repository: { type: "string", required: false },
  homepage: { type: "string", required: false },
  bugs: { type: "string", required: false },
  keywords: { type: "array", required: false }
};

/**
 * Creates a TentaclePluginSystem instance with all methods directly on the object.
 * This factory function pattern ensures method preservation across module boundaries.
 * 
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Name of the plugin system
 * @param {Object} [config.eventEmitter] - Event emitter
 * @param {Object} [config.metrics] - Metrics collector
 * @param {Object} [config.logger] - Logger instance
 * @param {string} [config.pluginsDir] - Directory for storing plugins
 * @param {boolean} [config.enableAutoDiscovery] - Whether to enable auto-discovery of plugins
 * @param {boolean} [config.enableAutoUpdate] - Whether to enable auto-update of plugins
 * @param {boolean} [config.enforceSignatureVerification] - Whether to enforce signature verification
 * @param {Object} [config.tentacleFramework] - Existing tentacle framework instance
 * @returns {Object} TentaclePluginSystem instance with all methods as own properties
 */
function createTentaclePluginSystem(config = {}) {
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
  
  // Use existing framework or create a new one
  const tentacleFramework = config.tentacleFramework || createModularTentacleFramework({
    logger,
    eventEmitter,
    metrics,
    enableAutoDiscovery: config.enableAutoDiscovery !== false,
    enableDynamicLoading: true
  });
  
  // Create plugin system instance with all properties and methods directly on the object
  const pluginSystem = {
    // Core properties
    id: config.id || uuidv4(),
    name: config.name || "TentaclePluginSystem",
    config: config,
    logger: logger,
    eventEmitter: eventEmitter,
    metrics: metrics,
    tentacleFramework: tentacleFramework,
    plugins: new Map(),
    pluginsDir: config.pluginsDir || path.join(process.cwd(), 'plugins'),
    enableAutoDiscovery: config.enableAutoDiscovery !== false,
    enableAutoUpdate: config.enableAutoUpdate !== false,
    enforceSignatureVerification: config.enforceSignatureVerification !== false,
    trustedPublishers: new Set(),
    
    // Methods as direct properties to ensure preservation across module boundaries
    initialize: function() {
      this.logger.info(`Initializing TentaclePluginSystem: ${this.name} (ID: ${this.id})`);
      
      // Ensure plugins directory exists
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir, { recursive: true });
      }
      
      // Register trusted publishers
      if (Array.isArray(config.trustedPublishers)) {
        for (const publisher of config.trustedPublishers) {
          this.trustedPublishers.add(publisher);
        }
      }
      
      // Discover installed plugins
      if (this.enableAutoDiscovery) {
        this.discoverPlugins();
      }
      
      this.eventEmitter.emit("plugin-system:initialized", {
        systemId: this.id,
        name: this.name
      });
      
      return this;
    },
    
    /**
     * Validates a plugin manifest against the schema.
     * 
     * @param {Object} manifest - Plugin manifest
     * @returns {Object} Validation result
     */
    validateManifest: function(manifest) {
      const errors = [];
      
      // Check required fields
      for (const [field, schema] of Object.entries(manifestSchema)) {
        if (schema.required && (manifest[field] === undefined || manifest[field] === null)) {
          errors.push(`Missing required field: ${field}`);
        } else if (manifest[field] !== undefined && typeof manifest[field] !== schema.type) {
          errors.push(`Invalid type for field ${field}: expected ${schema.type}, got ${typeof manifest[field]}`);
        }
      }
      
      // Validate version format (semver)
      if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
        errors.push(`Invalid version format: ${manifest.version}. Must be semver (e.g., 1.0.0)`);
      }
      
      // Validate tentacles array
      if (Array.isArray(manifest.tentacles)) {
        for (let i = 0; i < manifest.tentacles.length; i++) {
          const tentacle = manifest.tentacles[i];
          if (!tentacle.type || typeof tentacle.type !== 'string') {
            errors.push(`Invalid tentacle at index ${i}: missing or invalid type`);
          }
          if (!tentacle.factory || typeof tentacle.factory !== 'string') {
            errors.push(`Invalid tentacle at index ${i}: missing or invalid factory`);
          }
          if (tentacle.capabilities && !Array.isArray(tentacle.capabilities)) {
            errors.push(`Invalid tentacle at index ${i}: capabilities must be an array`);
          }
          if (tentacle.dependencies && !Array.isArray(tentacle.dependencies)) {
            errors.push(`Invalid tentacle at index ${i}: dependencies must be an array`);
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    },
    
    /**
     * Installs a plugin from a directory.
     * 
     * @param {string} pluginDir - Plugin directory
     * @param {Object} options - Installation options
     * @param {boolean} [options.activate] - Whether to activate the plugin after installation
     * @returns {Object} Installed plugin record
     */
    installPlugin: function(pluginDir, options = {}) {
      this.logger.info(`Installing plugin from directory: ${pluginDir}`);
      
      try {
        // Read manifest
        const manifestPath = path.join(pluginDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
          throw new PluginValidationError(`Plugin manifest not found: ${manifestPath}`);
        }
        
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        // Validate manifest
        const validation = this.validateManifest(manifest);
        if (!validation.valid) {
          throw new PluginValidationError(`Invalid plugin manifest: ${validation.errors.join(', ')}`);
        }
        
        // Check signature if required
        if (this.enforceSignatureVerification) {
          const signaturePath = path.join(pluginDir, 'signature.json');
          if (!fs.existsSync(signaturePath)) {
            throw new PluginSecurityError(`Plugin signature not found: ${signaturePath}`);
          }
          
          const signature = JSON.parse(fs.readFileSync(signaturePath, 'utf8'));
          
          if (!this.verifyPluginSignature(manifest, signature)) {
            throw new PluginSecurityError(`Invalid plugin signature for ${manifest.name}`);
          }
        }
        
        // Check compatibility
        this.checkPluginCompatibility(manifest);
        
        // Check dependencies
        this.checkPluginDependencies(manifest);
        
        // Create plugin record
        const pluginId = `${manifest.name}@${manifest.version}`;
        
        if (this.plugins.has(pluginId)) {
          throw new PluginInstallationError(`Plugin ${pluginId} is already installed`);
        }
        
        const pluginRecord = {
          id: pluginId,
          manifest,
          directory: pluginDir,
          state: 'INSTALLED',
          tentacles: new Map(),
          metadata: {
            installedAt: Date.now()
          }
        };
        
        // Store plugin
        this.plugins.set(pluginId, pluginRecord);
        
        // Emit event
        this.eventEmitter.emit("plugin:installed", {
          pluginId,
          name: manifest.name,
          version: manifest.version
        });
        
        // Activate if requested
        if (options.activate) {
          this.activatePlugin(pluginId);
        }
        
        return pluginRecord;
      } catch (error) {
        this.logger.error(`Error installing plugin from ${pluginDir}: ${error.message}`, error);
        throw error;
      }
    },
    
    /**
     * Activates an installed plugin.
     * 
     * @param {string} pluginId - Plugin ID
     * @returns {Object} Activated plugin record
     */
    activatePlugin: function(pluginId) {
      const pluginRecord = this.plugins.get(pluginId);
      
      if (!pluginRecord) {
        throw new PluginNotFoundError(`Plugin not found: ${pluginId}`);
      }
      
      if (pluginRecord.state === 'ACTIVE') {
        this.logger.warn(`Plugin ${pluginId} is already active`);
        return pluginRecord;
      }
      
      this.logger.info(`Activating plugin: ${pluginId}`);
      
      try {
        // Load plugin module
        const mainPath = path.join(pluginRecord.directory, pluginRecord.manifest.main);
        const pluginModule = require(mainPath);
        
        // Register tentacles
        for (const tentacleDef of pluginRecord.manifest.tentacles) {
          const factoryPath = path.join(pluginRecord.directory, tentacleDef.factory);
          const tentacleFactory = require(factoryPath);
          
          // Register factory with framework
          this.tentacleFramework.registerTentacleFactory(tentacleDef.type, {
            create: tentacleFactory.createTentacle || tentacleFactory,
            category: tentacleDef.category || TentacleCategory.EXTENSION,
            capabilities: tentacleDef.capabilities || [],
            dependencies: tentacleDef.dependencies || []
          });
          
          // Store factory reference
          pluginRecord.tentacles.set(tentacleDef.type, {
            type: tentacleDef.type,
            factory: tentacleFactory,
            instances: new Set()
          });
        }
        
        // Call plugin activation hook if available
        if (pluginModule.activate && typeof pluginModule.activate === 'function') {
          pluginModule.activate(this.tentacleFramework);
        }
        
        // Update state
        pluginRecord.state = 'ACTIVE';
        pluginRecord.metadata.activatedAt = Date.now();
        
        // Emit event
        this.eventEmitter.emit("plugin:activated", {
          pluginId,
          name: pluginRecord.manifest.name,
          version: pluginRecord.manifest.version
        });
        
        return pluginRecord;
      } catch (error) {
        this.logger.error(`Error activating plugin ${pluginId}: ${error.message}`, error);
        
        // Update state
        pluginRecord.state = 'ERROR';
        pluginRecord.metadata.error = {
          message: error.message,
          stack: error.stack
        };
        
        // Emit event
        this.eventEmitter.emit("plugin:activation-failed", {
          pluginId,
          error: error.message
        });
        
        throw new PluginActivationError(`Failed to activate plugin ${pluginId}: ${error.message}`);
      }
    },
    
    /**
     * Deactivates an active plugin.
     * 
     * @param {string} pluginId - Plugin ID
     * @returns {Object} Deactivated plugin record
     */
    deactivatePlugin: function(pluginId) {
      const pluginRecord = this.plugins.get(pluginId);
      
      if (!pluginRecord) {
        throw new PluginNotFoundError(`Plugin not found: ${pluginId}`);
      }
      
      if (pluginRecord.state !== 'ACTIVE') {
        this.logger.warn(`Plugin ${pluginId} is not active`);
        return pluginRecord;
      }
      
      this.logger.info(`Deactivating plugin: ${pluginId}`);
      
      try {
        // Load plugin module
        const mainPath = path.join(pluginRecord.directory, pluginRecord.manifest.main);
        const pluginModule = require(mainPath);
        
        // Call plugin deactivation hook if available
        if (pluginModule.deactivate && typeof pluginModule.deactivate === 'function') {
          pluginModule.deactivate(this.tentacleFramework);
        }
        
        // Stop and unregister tentacle instances
        for (const [type, tentacle] of pluginRecord.tentacles.entries()) {
          for (const instanceId of tentacle.instances) {
            try {
              this.tentacleFramework.stopTentacle(instanceId);
              this.tentacleFramework.unregisterTentacle(instanceId);
            } catch (error) {
              this.logger.warn(`Error stopping tentacle ${instanceId}: ${error.message}`);
            }
          }
          
          // Clear instances
          tentacle.instances.clear();
        }
        
        // Update state
        pluginRecord.state = 'INSTALLED';
        pluginRecord.metadata.deactivatedAt = Date.now();
        
        // Emit event
        this.eventEmitter.emit("plugin:deactivated", {
          pluginId,
          name: pluginRecord.manifest.name,
          version: pluginRecord.manifest.version
        });
        
        return pluginRecord;
      } catch (error) {
        this.logger.error(`Error deactivating plugin ${pluginId}: ${error.message}`, error);
        
        // Update state
        pluginRecord.state = 'ERROR';
        pluginRecord.metadata.error = {
          message: error.message,
          stack: error.stack
        };
        
        // Emit event
        this.eventEmitter.emit("plugin:deactivation-failed", {
          pluginId,
          error: error.message
        });
        
        throw error;
      }
    },
    
    /**
     * Uninstalls a plugin.
     * 
     * @param {string} pluginId - Plugin ID
     * @param {Object} options - Uninstallation options
     * @param {boolean} [options.removeFiles] - Whether to remove plugin files
     * @returns {boolean} Whether the uninstallation was successful
     */
    uninstallPlugin: function(pluginId, options = {}) {
      const pluginRecord = this.plugins.get(pluginId);
      
      if (!pluginRecord) {
        throw new PluginNotFoundError(`Plugin not found: ${pluginId}`);
      }
      
      this.logger.info(`Uninstalling plugin: ${pluginId}`);
      
      try {
        // Deactivate if active
        if (pluginRecord.state === 'ACTIVE') {
          this.deactivatePlugin(pluginId);
        }
        
        // Remove plugin files if requested
        if (options.removeFiles) {
          // In a real implementation, this would recursively delete the plugin directory
          this.logger.info(`Removing plugin files: ${pluginRecord.directory}`);
          // fs.rmdirSync(pluginRecord.directory, { recursive: true });
        }
        
        // Remove plugin record
        this.plugins.delete(pluginId);
        
        // Emit event
        this.eventEmitter.emit("plugin:uninstalled", {
          pluginId,
          name: pluginRecord.manifest.name,
          version: pluginRecord.manifest.version
        });
        
        return true;
      } catch (error) {
        this.logger.error(`Error uninstalling plugin ${pluginId}: ${error.message}`, error);
        
        // Emit event
        this.eventEmitter.emit("plugin:uninstallation-failed", {
          pluginId,
          error: error.message
        });
        
        throw error;
      }
    },
    
    /**
     * Creates a tentacle instance from a plugin.
     * 
     * @param {string} pluginId - Plugin ID
     * @param {string} tentacleType - Tentacle type
     * @param {Object} config - Tentacle configuration
     * @param {Object} dependencies - Tentacle dependencies
     * @returns {Object} Created tentacle instance
     */
    createTentacleFromPlugin: function(pluginId, tentacleType, config = {}, dependencies = {}) {
      const pluginRecord = this.plugins.get(pluginId);
      
      if (!pluginRecord) {
        throw new PluginNotFoundError(`Plugin not found: ${pluginId}`);
      }
      
      if (pluginRecord.state !== 'ACTIVE') {
        throw new PluginActivationError(`Plugin ${pluginId} is not active`);
      }
      
      const tentacleRecord = pluginRecord.tentacles.get(tentacleType);
      
      if (!tentacleRecord) {
        throw new TentacleNotFoundError(`Tentacle type ${tentacleType} not found in plugin ${pluginId}`);
      }
      
      this.logger.info(`Creating tentacle of type ${tentacleType} from plugin ${pluginId}`);
      
      // Create tentacle using framework
      const tentacle = this.tentacleFramework.createTentacle(tentacleType, config, dependencies);
      
      // Store instance reference
      tentacleRecord.instances.add(tentacle.id);
      
      return tentacle;
    },
    
    /**
     * Discovers installed plugins.
     * 
     * @returns {Array<Object>} Discovered plugin records
     */
    discoverPlugins: function() {
      this.logger.info(`Discovering plugins in directory: ${this.pluginsDir}`);
      
      const discoveredPlugins = [];
      
      try {
        // Get subdirectories
        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginDir = path.join(this.pluginsDir, entry.name);
            
            try {
              // Check if directory contains a manifest
              const manifestPath = path.join(pluginDir, 'manifest.json');
              
              if (fs.existsSync(manifestPath)) {
                // Install plugin
                const pluginRecord = this.installPlugin(pluginDir, { activate: false });
                discoveredPlugins.push(pluginRecord);
              }
            } catch (error) {
              this.logger.warn(`Error discovering plugin in ${pluginDir}: ${error.message}`);
            }
          }
        }
        
        this.logger.info(`Discovered ${discoveredPlugins.length} plugins`);
        
        return discoveredPlugins;
      } catch (error) {
        this.logger.error(`Error discovering plugins: ${error.message}`, error);
        throw error;
      }
    },
    
    /**
     * Verifies a plugin signature.
     * 
     * @param {Object} manifest - Plugin manifest
     * @param {Object} signature - Plugin signature
     * @returns {boolean} Whether the signature is valid
     */
    verifyPluginSignature: function(manifest, signature) {
      try {
        // Check if publisher is trusted
        if (!this.trustedPublishers.has(signature.publisher)) {
          this.logger.warn(`Untrusted publisher: ${signature.publisher}`);
          return false;
        }
        
        // In a real implementation, this would verify the cryptographic signature
        // For now, just check that the signature contains the expected fields
        if (!signature.publisher || !signature.signature || !signature.algorithm) {
          return false;
        }
        
        this.logger.info(`Verified signature for plugin ${manifest.name} from publisher ${signature.publisher}`);
        
        return true;
      } catch (error) {
        this.logger.error(`Error verifying plugin signature: ${error.message}`, error);
        return false;
      }
    },
    
    /**
     * Checks plugin compatibility with the current Aideon version.
     * 
     * @param {Object} manifest - Plugin manifest
     * @returns {boolean} Whether the plugin is compatible
     */
    checkPluginCompatibility: function(manifest) {
      // In a real implementation, this would check semver compatibility
      // For now, just check that the aideonVersion field exists
      if (!manifest.aideonVersion) {
        throw new PluginCompatibilityError(`Plugin ${manifest.name} does not specify an Aideon version`);
      }
      
      // Mock version check
      const currentVersion = '1.0.0'; // This would be the actual Aideon version
      
      if (manifest.aideonVersion !== currentVersion) {
        this.logger.warn(`Plugin ${manifest.name} was built for Aideon version ${manifest.aideonVersion}, but current version is ${currentVersion}`);
      }
      
      return true;
    },
    
    /**
     * Checks plugin dependencies.
     * 
     * @param {Object} manifest - Plugin manifest
     * @returns {boolean} Whether all dependencies are satisfied
     */
    checkPluginDependencies: function(manifest) {
      if (!manifest.dependencies) {
        return true;
      }
      
      const missingDependencies = [];
      
      for (const [dependency, version] of Object.entries(manifest.dependencies)) {
        // Check if dependency is installed
        let found = false;
        
        for (const [pluginId, record] of this.plugins.entries()) {
          if (record.manifest.name === dependency) {
            // In a real implementation, this would check semver compatibility
            found = true;
            break;
          }
        }
        
        if (!found) {
          missingDependencies.push(`${dependency}@${version}`);
        }
      }
      
      if (missingDependencies.length > 0) {
        throw new PluginDependencyError(`Plugin ${manifest.name} has unsatisfied dependencies: ${missingDependencies.join(', ')}`);
      }
      
      return true;
    },
    
    /**
     * Updates a plugin to a newer version.
     * 
     * @param {string} pluginId - Plugin ID
     * @param {string} newVersion - New version
     * @returns {Object} Updated plugin record
     */
    updatePlugin: function(pluginId, newVersion) {
      // This is a placeholder implementation
      // In a real implementation, this would download and install the new version
      this.logger.info(`Updating plugin ${pluginId} to version ${newVersion}`);
      
      throw new Error("Plugin update not implemented");
    },
    
    /**
     * Gets a list of all installed plugins.
     * 
     * @returns {Array<Object>} Array of plugin records
     */
    listPlugins: function() {
      return Array.from(this.plugins.entries()).map(([id, record]) => ({
        id,
        name: record.manifest.name,
        version: record.manifest.version,
        description: record.manifest.description,
        author: record.manifest.author,
        state: record.state,
        tentacleCount: record.tentacles.size,
        installedAt: record.metadata.installedAt,
        activatedAt: record.metadata.activatedAt
      }));
    },
    
    /**
     * Gets a plugin by ID.
     * 
     * @param {string} pluginId - Plugin ID
     * @returns {Object} Plugin record
     */
    getPlugin: function(pluginId) {
      const pluginRecord = this.plugins.get(pluginId);
      
      if (!pluginRecord) {
        throw new PluginNotFoundError(`Plugin not found: ${pluginId}`);
      }
      
      return pluginRecord;
    },
    
    /**
     * Gets a plugin by name.
     * 
     * @param {string} name - Plugin name
     * @returns {Object} Plugin record
     */
    getPluginByName: function(name) {
      for (const [id, record] of this.plugins.entries()) {
        if (record.manifest.name === name) {
          return record;
        }
      }
      
      throw new PluginNotFoundError(`Plugin not found: ${name}`);
    },
    
    /**
     * Gets statistics about the plugin system.
     * 
     * @returns {Object} Plugin system statistics
     */
    getStatistics: function() {
      const pluginsByState = {};
      let totalTentacles = 0;
      
      for (const [id, record] of this.plugins.entries()) {
        pluginsByState[record.state] = (pluginsByState[record.state] || 0) + 1;
        
        for (const [type, tentacle] of record.tentacles.entries()) {
          totalTentacles += tentacle.instances.size;
        }
      }
      
      return {
        pluginCount: this.plugins.size,
        activePlugins: pluginsByState['ACTIVE'] || 0,
        installedPlugins: pluginsByState['INSTALLED'] || 0,
        errorPlugins: pluginsByState['ERROR'] || 0,
        totalTentacles,
        trustedPublishers: this.trustedPublishers.size,
        timestamp: Date.now()
      };
    },
    
    /**
     * Adds a trusted publisher.
     * 
     * @param {string} publisherId - Publisher ID
     * @returns {Object} This plugin system instance for chaining
     */
    addTrustedPublisher: function(publisherId) {
      this.trustedPublishers.add(publisherId);
      
      this.logger.info(`Added trusted publisher: ${publisherId}`);
      
      return this;
    },
    
    /**
     * Removes a trusted publisher.
     * 
     * @param {string} publisherId - Publisher ID
     * @returns {Object} This plugin system instance for chaining
     */
    removeTrustedPublisher: function(publisherId) {
      this.trustedPublishers.delete(publisherId);
      
      this.logger.info(`Removed trusted publisher: ${publisherId}`);
      
      return this;
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
  
  // Initialize plugin system
  pluginSystem.initialize();
  
  // Log creation
  logger.info(`Created TentaclePluginSystem: ${pluginSystem.name} (ID: ${pluginSystem.id})`);
  
  // Add debugging helper to verify method presence
  pluginSystem.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`TentaclePluginSystem has these methods: ${methods.join(', ')}`);
    return methods;
  };
  
  return pluginSystem;
}

/**
 * Creates a TentacleRegistry instance with all methods directly on the object.
 * This factory function pattern ensures method preservation across module boundaries.
 * 
 * @param {Object} config - Configuration options
 * @param {string} [config.id] - Unique identifier
 * @param {string} [config.name] - Name of the registry
 * @param {Object} [config.eventEmitter] - Event emitter
 * @param {Object} [config.metrics] - Metrics collector
 * @param {Object} [config.logger] - Logger instance
 * @param {Object} [config.tentacleFramework] - Existing tentacle framework instance
 * @param {Object} [config.pluginSystem] - Existing plugin system instance
 * @returns {Object} TentacleRegistry instance with all methods as own properties
 */
function createTentacleRegistry(config = {}) {
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
  
  // Use existing framework or create a new one
  const tentacleFramework = config.tentacleFramework || createModularTentacleFramework({
    logger,
    eventEmitter,
    metrics,
    enableAutoDiscovery: true,
    enableDynamicLoading: true
  });
  
  // Use existing plugin system or create a new one
  const pluginSystem = config.pluginSystem || createTentaclePluginSystem({
    logger,
    eventEmitter,
    metrics,
    tentacleFramework,
    enableAutoDiscovery: true,
    enableAutoUpdate: true
  });
  
  // Create registry instance with all properties and methods directly on the object
  const registry = {
    // Core properties
    id: config.id || uuidv4(),
    name: config.name || "TentacleRegistry",
    config: config,
    logger: logger,
    eventEmitter: eventEmitter,
    metrics: metrics,
    tentacleFramework: tentacleFramework,
    pluginSystem: pluginSystem,
    tentacleInstances: new Map(),
    tentacleConfigurations: new Map(),
    tentacleUsageStats: new Map(),
    
    // Methods as direct properties to ensure preservation across module boundaries
    initialize: function() {
      this.logger.info(`Initializing TentacleRegistry: ${this.name} (ID: ${this.id})`);
      
      // Listen for tentacle events
      this.tentacleFramework.on("tentacle:registered", this.handleTentacleRegistered.bind(this));
      this.tentacleFramework.on("tentacle:initialized", this.handleTentacleInitialized.bind(this));
      this.tentacleFramework.on("tentacle:unregistered", this.handleTentacleUnregistered.bind(this));
      
      this.eventEmitter.emit("registry:initialized", {
        registryId: this.id,
        name: this.name
      });
      
      return this;
    },
    
    /**
     * Handles tentacle registered event.
     * 
     * @param {Object} event - Event data
     */
    handleTentacleRegistered: function(event) {
      const { tentacleId, type, category, capabilities } = event;
      
      this.logger.debug(`Tentacle registered: ${tentacleId} (${type})`);
      
      // Store instance reference
      this.tentacleInstances.set(tentacleId, {
        id: tentacleId,
        type,
        category,
        capabilities,
        registeredAt: Date.now()
      });
      
      // Initialize usage stats
      this.tentacleUsageStats.set(tentacleId, {
        id: tentacleId,
        invocationCount: 0,
        lastInvoked: null,
        averageResponseTime: 0,
        errorCount: 0
      });
    },
    
    /**
     * Handles tentacle initialized event.
     * 
     * @param {Object} event - Event data
     */
    handleTentacleInitialized: function(event) {
      const { tentacleId, type, category } = event;
      
      this.logger.debug(`Tentacle initialized: ${tentacleId} (${type})`);
      
      // Update instance record
      const instance = this.tentacleInstances.get(tentacleId);
      
      if (instance) {
        instance.initializedAt = Date.now();
        instance.status = 'ACTIVE';
      }
    },
    
    /**
     * Handles tentacle unregistered event.
     * 
     * @param {Object} event - Event data
     */
    handleTentacleUnregistered: function(event) {
      const { tentacleId } = event;
      
      this.logger.debug(`Tentacle unregistered: ${tentacleId}`);
      
      // Remove instance reference
      this.tentacleInstances.delete(tentacleId);
      
      // Remove usage stats
      this.tentacleUsageStats.delete(tentacleId);
    },
    
    /**
     * Registers a tentacle configuration.
     * 
     * @param {string} configId - Configuration ID
     * @param {Object} configuration - Tentacle configuration
     * @returns {Object} This registry instance for chaining
     */
    registerTentacleConfiguration: function(configId, configuration) {
      if (this.tentacleConfigurations.has(configId)) {
        this.logger.warn(`Tentacle configuration ${configId} already exists, overwriting`);
      }
      
      this.logger.info(`Registering tentacle configuration: ${configId}`);
      
      // Validate configuration
      if (!configuration.type) {
        throw new ValidationError(`Invalid tentacle configuration: missing type`);
      }
      
      // Store configuration
      this.tentacleConfigurations.set(configId, {
        id: configId,
        ...configuration,
        registeredAt: Date.now()
      });
      
      // Emit event
      this.eventEmitter.emit("configuration:registered", {
        configId,
        type: configuration.type
      });
      
      return this;
    },
    
    /**
     * Creates a tentacle from a configuration.
     * 
     * @param {string} configId - Configuration ID
     * @param {Object} overrides - Configuration overrides
     * @returns {Object} Created tentacle instance
     */
    createTentacleFromConfiguration: function(configId, overrides = {}) {
      const configuration = this.tentacleConfigurations.get(configId);
      
      if (!configuration) {
        throw new ValidationError(`Tentacle configuration not found: ${configId}`);
      }
      
      this.logger.info(`Creating tentacle from configuration: ${configId}`);
      
      // Merge configuration with overrides
      const mergedConfig = {
        ...configuration,
        ...overrides
      };
      
      // Create tentacle
      const tentacle = this.tentacleFramework.createTentacle(
        configuration.type,
        mergedConfig,
        mergedConfig.dependencies || {}
      );
      
      // Initialize tentacle
      this.tentacleFramework.initializeTentacle(tentacle.id);
      
      return tentacle;
    },
    
    /**
     * Creates a tentacle from a plugin.
     * 
     * @param {string} pluginName - Plugin name
     * @param {string} tentacleType - Tentacle type
     * @param {Object} config - Tentacle configuration
     * @param {Object} dependencies - Tentacle dependencies
     * @returns {Object} Created tentacle instance
     */
    createTentacleFromPlugin: function(pluginName, tentacleType, config = {}, dependencies = {}) {
      try {
        // Get plugin by name
        const plugin = this.pluginSystem.getPluginByName(pluginName);
        
        // Create tentacle
        return this.pluginSystem.createTentacleFromPlugin(
          plugin.id,
          tentacleType,
          config,
          dependencies
        );
      } catch (error) {
        this.logger.error(`Error creating tentacle from plugin ${pluginName}: ${error.message}`, error);
        throw error;
      }
    },
    
    /**
     * Gets a tentacle by ID.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} Tentacle instance
     */
    getTentacle: function(tentacleId) {
      return this.tentacleFramework.getTentacle(tentacleId);
    },
    
    /**
     * Gets tentacles by type.
     * 
     * @param {string} type - Tentacle type
     * @returns {Array<Object>} Array of tentacle instances
     */
    getTentaclesByType: function(type) {
      return this.tentacleFramework.getTentaclesByType(type);
    },
    
    /**
     * Gets tentacles by capability.
     * 
     * @param {string} capability - Capability identifier
     * @returns {Array<Object>} Array of tentacle instances
     */
    getTentaclesByCapability: function(capability) {
      return this.tentacleFramework.getTentaclesByCapability(capability);
    },
    
    /**
     * Gets a tentacle that provides a specific capability.
     * 
     * @param {string} capability - Capability identifier
     * @returns {Object} Tentacle instance
     */
    getTentacleWithCapability: function(capability) {
      return this.tentacleFramework.getTentacleWithCapability(capability);
    },
    
    /**
     * Records tentacle usage.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @param {Object} usageData - Usage data
     * @returns {Object} This registry instance for chaining
     */
    recordTentacleUsage: function(tentacleId, usageData) {
      const stats = this.tentacleUsageStats.get(tentacleId);
      
      if (!stats) {
        return this;
      }
      
      // Update usage stats
      stats.invocationCount++;
      stats.lastInvoked = Date.now();
      
      if (usageData.responseTime) {
        // Update average response time
        const totalTime = stats.averageResponseTime * (stats.invocationCount - 1) + usageData.responseTime;
        stats.averageResponseTime = totalTime / stats.invocationCount;
      }
      
      if (usageData.error) {
        stats.errorCount++;
      }
      
      // Record metric
      this.metrics.recordMetric("tentacle_usage", {
        tentacleId,
        ...usageData
      });
      
      return this;
    },
    
    /**
     * Gets usage statistics for a tentacle.
     * 
     * @param {string} tentacleId - Tentacle ID
     * @returns {Object} Usage statistics
     */
    getTentacleUsageStats: function(tentacleId) {
      const stats = this.tentacleUsageStats.get(tentacleId);
      
      if (!stats) {
        throw new TentacleNotFoundError(`Tentacle not found: ${tentacleId}`);
      }
      
      return stats;
    },
    
    /**
     * Gets a list of all registered tentacles.
     * 
     * @returns {Array<Object>} Array of tentacle records
     */
    listTentacles: function() {
      return this.tentacleFramework.listTentacles();
    },
    
    /**
     * Gets a list of all registered tentacle configurations.
     * 
     * @returns {Array<Object>} Array of configuration records
     */
    listTentacleConfigurations: function() {
      return Array.from(this.tentacleConfigurations.entries()).map(([id, config]) => ({
        id,
        type: config.type,
        name: config.name || id,
        registeredAt: config.registeredAt
      }));
    },
    
    /**
     * Gets statistics about the registry.
     * 
     * @returns {Object} Registry statistics
     */
    getStatistics: function() {
      const frameworkStats = this.tentacleFramework.getStatistics();
      const pluginStats = this.pluginSystem.getStatistics();
      
      return {
        tentacleCount: this.tentacleInstances.size,
        configurationCount: this.tentacleConfigurations.size,
        framework: frameworkStats,
        plugins: pluginStats,
        timestamp: Date.now()
      };
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
  
  // Initialize registry
  registry.initialize();
  
  // Log creation
  logger.info(`Created TentacleRegistry: ${registry.name} (ID: ${registry.id})`);
  
  // Add debugging helper to verify method presence
  registry.debugMethods = function() {
    const methods = Object.keys(this).filter(key => typeof this[key] === 'function');
    logger.info(`TentacleRegistry has these methods: ${methods.join(', ')}`);
    return methods;
  };
  
  return registry;
}

module.exports = {
  createTentaclePluginSystem,
  createTentacleRegistry,
  // Export error types
  PluginValidationError,
  PluginInstallationError,
  PluginActivationError,
  PluginSecurityError,
  PluginCompatibilityError,
  PluginNotFoundError,
  PluginDependencyError
};
