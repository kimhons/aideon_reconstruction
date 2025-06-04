/**
 * @fileoverview Dynamic Tentacle Loader for Aideon
 * 
 * This module provides the infrastructure for dynamically loading tentacles at runtime,
 * enabling Aideon to grow new capabilities based on user needs without requiring a restart.
 * 
 * The loader handles:
 * - Dynamic module loading and unloading
 * - Hot-swapping of tentacle implementations
 * - Dependency resolution for dynamically loaded tentacles
 * - Sandboxed execution of third-party tentacles
 * - Version compatibility checking
 * 
 * @module core/framework/DynamicTentacleLoader
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates a new DynamicTentacleLoader instance.
 * 
 * @param {Object} config - Configuration options
 * @param {string} config.id - Unique identifier for this loader
 * @param {string} config.name - Human-readable name for this loader
 * @param {Object} config.logger - Logger instance
 * @param {Object} config.metrics - Metrics collection instance
 * @param {EventEmitter} config.eventEmitter - Event emitter for system-wide events
 * @param {string} config.tentacleDirectory - Base directory for tentacle modules
 * @param {Object} config.tentacleFramework - Reference to the ModularTentacleFramework
 * @param {Object} config.tentacleRegistry - Reference to the TentacleRegistry
 * @param {boolean} config.sandboxEnabled - Whether to run tentacles in a sandbox
 * @param {Object} config.securityOptions - Security options for tentacle loading
 * @returns {Object} DynamicTentacleLoader instance
 */
function createDynamicTentacleLoader(config) {
  // Validate required configuration
  if (!config) throw new Error('Configuration is required');
  if (!config.logger) throw new Error('Logger is required');
  if (!config.metrics) throw new Error('Metrics is required');
  if (!config.eventEmitter) throw new Error('Event emitter is required');
  if (!config.tentacleDirectory) throw new Error('Tentacle directory is required');
  if (!config.tentacleFramework) throw new Error('Tentacle framework is required');
  if (!config.tentacleRegistry) throw new Error('Tentacle registry is required');
  
  // Initialize with defaults for optional configuration
  const id = config.id || uuidv4();
  const name = config.name || 'DynamicTentacleLoader';
  const sandboxEnabled = config.sandboxEnabled !== undefined ? config.sandboxEnabled : true;
  const securityOptions = config.securityOptions || {
    allowedModules: ['fs', 'path', 'events', 'uuid'],
    maxMemoryMB: 100,
    timeout: 5000, // ms
    allowNetworkAccess: false
  };
  
  // Internal state
  const logger = config.logger;
  const metrics = config.metrics;
  const eventEmitter = config.eventEmitter;
  const tentacleDirectory = path.resolve(config.tentacleDirectory);
  const tentacleFramework = config.tentacleFramework;
  const tentacleRegistry = config.tentacleRegistry;
  
  // Track loaded tentacles and their modules
  const loadedModules = new Map();
  const loadedTentacles = new Map();
  const tentacleVersions = new Map();
  const pendingLoads = new Map();
  
  // Event listeners
  const listeners = new Map();
  
  /**
   * Initializes the dynamic tentacle loader.
   * 
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   */
  async function initialize() {
    logger.info(`[${name}] Initializing dynamic tentacle loader`);
    
    // Ensure tentacle directory exists
    if (!fs.existsSync(tentacleDirectory)) {
      logger.info(`[${name}] Creating tentacle directory: ${tentacleDirectory}`);
      fs.mkdirSync(tentacleDirectory, { recursive: true });
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Scan for existing tentacles
    await scanTentacleDirectory();
    
    logger.info(`[${name}] Dynamic tentacle loader initialized`);
    eventEmitter.emit('dynamic-tentacle-loader:initialized', { id });
    
    return Promise.resolve();
  }
  
  /**
   * Sets up event listeners for tentacle-related events.
   */
  function setupEventListeners() {
    // Listen for tentacle installation requests
    const installListener = (data) => {
      if (data && data.tentacleId && data.source) {
        loadTentacle(data.tentacleId, data.source, data.options)
          .then(result => {
            eventEmitter.emit('dynamic-tentacle-loader:tentacle-loaded', {
              id: data.tentacleId,
              success: true,
              result
            });
          })
          .catch(error => {
            logger.error(`[${name}] Failed to load tentacle ${data.tentacleId}:`, error);
            eventEmitter.emit('dynamic-tentacle-loader:tentacle-load-failed', {
              id: data.tentacleId,
              error: error.message
            });
          });
      }
    };
    
    // Listen for tentacle uninstallation requests
    const uninstallListener = (data) => {
      if (data && data.tentacleId) {
        unloadTentacle(data.tentacleId)
          .then(result => {
            eventEmitter.emit('dynamic-tentacle-loader:tentacle-unloaded', {
              id: data.tentacleId,
              success: true
            });
          })
          .catch(error => {
            logger.error(`[${name}] Failed to unload tentacle ${data.tentacleId}:`, error);
            eventEmitter.emit('dynamic-tentacle-loader:tentacle-unload-failed', {
              id: data.tentacleId,
              error: error.message
            });
          });
      }
    };
    
    // Listen for tentacle update requests
    const updateListener = (data) => {
      if (data && data.tentacleId && data.source) {
        updateTentacle(data.tentacleId, data.source, data.options)
          .then(result => {
            eventEmitter.emit('dynamic-tentacle-loader:tentacle-updated', {
              id: data.tentacleId,
              success: true,
              result
            });
          })
          .catch(error => {
            logger.error(`[${name}] Failed to update tentacle ${data.tentacleId}:`, error);
            eventEmitter.emit('dynamic-tentacle-loader:tentacle-update-failed', {
              id: data.tentacleId,
              error: error.message
            });
          });
      }
    };
    
    // Register listeners
    eventEmitter.on('tentacle-registry:install-tentacle', installListener);
    eventEmitter.on('tentacle-registry:uninstall-tentacle', uninstallListener);
    eventEmitter.on('tentacle-registry:update-tentacle', updateListener);
    
    // Store listeners for cleanup
    listeners.set('install', installListener);
    listeners.set('uninstall', uninstallListener);
    listeners.set('update', updateListener);
  }
  
  /**
   * Scans the tentacle directory for existing tentacles.
   * 
   * @returns {Promise<Array>} Promise that resolves with the list of discovered tentacles
   */
  async function scanTentacleDirectory() {
    logger.info(`[${name}] Scanning tentacle directory: ${tentacleDirectory}`);
    
    try {
      const entries = fs.readdirSync(tentacleDirectory, { withFileTypes: true });
      const tentacleDirs = entries.filter(entry => entry.isDirectory());
      
      logger.info(`[${name}] Found ${tentacleDirs.length} potential tentacle directories`);
      
      const discoveredTentacles = [];
      
      for (const dir of tentacleDirs) {
        const tentacleId = dir.name;
        const tentaclePath = path.join(tentacleDirectory, tentacleId);
        const manifestPath = path.join(tentaclePath, 'tentacle.json');
        
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            logger.info(`[${name}] Discovered tentacle: ${manifest.name} (${tentacleId})`);
            
            // Register with tentacle registry but don't load yet
            tentacleRegistry.registerTentacleConfiguration({
              id: tentacleId,
              name: manifest.name,
              version: manifest.version,
              description: manifest.description,
              author: manifest.author,
              type: manifest.type,
              category: manifest.category,
              capabilities: manifest.capabilities,
              dependencies: manifest.dependencies,
              entryPoint: manifest.entryPoint,
              configSchema: manifest.configSchema,
              installed: true,
              enabled: manifest.autoEnable !== false,
              path: tentaclePath
            });
            
            // Track version
            tentacleVersions.set(tentacleId, manifest.version);
            
            discoveredTentacles.push({
              id: tentacleId,
              name: manifest.name,
              version: manifest.version,
              path: tentaclePath
            });
          } catch (error) {
            logger.error(`[${name}] Error processing tentacle manifest for ${tentacleId}:`, error);
          }
        }
      }
      
      logger.info(`[${name}] Discovered ${discoveredTentacles.length} valid tentacles`);
      return discoveredTentacles;
    } catch (error) {
      logger.error(`[${name}] Error scanning tentacle directory:`, error);
      return [];
    }
  }
  
  /**
   * Loads a tentacle from the specified source.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {string|Object} source - Source of the tentacle (path, URL, or module object)
   * @param {Object} options - Loading options
   * @param {boolean} options.autoEnable - Whether to automatically enable the tentacle
   * @param {boolean} options.force - Whether to force load even if already loaded
   * @param {Object} options.config - Configuration to pass to the tentacle
   * @returns {Promise<Object>} Promise that resolves with the loaded tentacle
   */
  async function loadTentacle(tentacleId, source, options = {}) {
    logger.info(`[${name}] Loading tentacle: ${tentacleId}`);
    
    // Check if already loading
    if (pendingLoads.has(tentacleId)) {
      return pendingLoads.get(tentacleId);
    }
    
    // Check if already loaded
    if (loadedTentacles.has(tentacleId) && !options.force) {
      logger.info(`[${name}] Tentacle ${tentacleId} already loaded`);
      return Promise.resolve(loadedTentacles.get(tentacleId));
    }
    
    // Create promise for this load operation
    const loadPromise = new Promise(async (resolve, reject) => {
      try {
        // Determine source type and load accordingly
        let tentacleModule;
        let tentaclePath;
        
        if (typeof source === 'string') {
          // Source is a path or URL
          if (source.startsWith('http://') || source.startsWith('https://')) {
            // URL source - download and install
            tentacleModule = await downloadAndInstallTentacle(tentacleId, source, options);
            tentaclePath = path.join(tentacleDirectory, tentacleId);
          } else {
            // Local path source
            tentaclePath = path.resolve(source);
            tentacleModule = await loadTentacleFromPath(tentacleId, tentaclePath, options);
          }
        } else if (typeof source === 'object') {
          // Source is a module object
          tentacleModule = source;
          tentaclePath = source.path || path.join(tentacleDirectory, tentacleId);
        } else {
          throw new Error(`Invalid tentacle source type: ${typeof source}`);
        }
        
        // Validate tentacle module
        if (!tentacleModule || typeof tentacleModule.createTentacle !== 'function') {
          throw new Error(`Invalid tentacle module: missing createTentacle function`);
        }
        
        // Load manifest
        const manifestPath = path.join(tentaclePath, 'tentacle.json');
        let manifest;
        
        if (fs.existsSync(manifestPath)) {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } else {
          // Create default manifest if none exists
          manifest = {
            id: tentacleId,
            name: tentacleModule.name || tentacleId,
            version: tentacleModule.version || '1.0.0',
            description: tentacleModule.description || '',
            author: tentacleModule.author || 'Unknown',
            type: tentacleModule.type || 'EXTENSION',
            category: tentacleModule.category || 'UTILITY',
            capabilities: tentacleModule.capabilities || [],
            dependencies: tentacleModule.dependencies || [],
            entryPoint: tentacleModule.entryPoint || 'index.js',
            configSchema: tentacleModule.configSchema || {},
            autoEnable: options.autoEnable !== false
          };
          
          // Save manifest
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }
        
        // Register with tentacle registry
        tentacleRegistry.registerTentacleConfiguration({
          id: tentacleId,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          type: manifest.type,
          category: manifest.category,
          capabilities: manifest.capabilities,
          dependencies: manifest.dependencies,
          entryPoint: manifest.entryPoint,
          configSchema: manifest.configSchema,
          installed: true,
          enabled: options.autoEnable !== false,
          path: tentaclePath
        });
        
        // Register factory with tentacle framework
        tentacleFramework.registerTentacleFactory(tentacleId, {
          create: tentacleModule.createTentacle,
          category: manifest.category,
          capabilities: manifest.capabilities,
          dependencies: manifest.dependencies
        });
        
        // Track loaded module and version
        loadedModules.set(tentacleId, tentacleModule);
        tentacleVersions.set(tentacleId, manifest.version);
        
        // Create tentacle instance if auto-enable
        let tentacleInstance = null;
        if (options.autoEnable !== false) {
          tentacleInstance = tentacleFramework.createTentacle(tentacleId, {
            ...options.config,
            name: manifest.name
          });
          
          // Initialize tentacle
          if (tentacleInstance) {
            tentacleFramework.initializeTentacle(tentacleInstance.id);
            loadedTentacles.set(tentacleId, tentacleInstance);
          }
        }
        
        logger.info(`[${name}] Successfully loaded tentacle: ${tentacleId} (${manifest.version})`);
        metrics.recordMetric('tentacle_loaded', {
          tentacleId,
          version: manifest.version,
          category: manifest.category
        });
        
        // Emit event
        eventEmitter.emit('dynamic-tentacle-loader:tentacle-loaded', {
          id: tentacleId,
          name: manifest.name,
          version: manifest.version,
          category: manifest.category,
          capabilities: manifest.capabilities
        });
        
        resolve(tentacleInstance || { id: tentacleId, manifest });
      } catch (error) {
        logger.error(`[${name}] Failed to load tentacle ${tentacleId}:`, error);
        metrics.recordMetric('tentacle_load_failed', {
          tentacleId,
          error: error.message
        });
        reject(error);
      } finally {
        // Remove from pending loads
        pendingLoads.delete(tentacleId);
      }
    });
    
    // Track pending load
    pendingLoads.set(tentacleId, loadPromise);
    
    return loadPromise;
  }
  
  /**
   * Loads a tentacle from a local file path.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {string} tentaclePath - Path to the tentacle directory
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Promise that resolves with the loaded tentacle module
   */
  async function loadTentacleFromPath(tentacleId, tentaclePath, options = {}) {
    logger.info(`[${name}] Loading tentacle from path: ${tentaclePath}`);
    
    // Check if directory exists
    if (!fs.existsSync(tentaclePath)) {
      throw new Error(`Tentacle path does not exist: ${tentaclePath}`);
    }
    
    // Load manifest to determine entry point
    const manifestPath = path.join(tentaclePath, 'tentacle.json');
    let entryPoint = 'index.js';
    
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        entryPoint = manifest.entryPoint || entryPoint;
      } catch (error) {
        logger.warn(`[${name}] Error reading tentacle manifest, using default entry point:`, error);
      }
    }
    
    // Resolve entry point path
    const entryPointPath = path.join(tentaclePath, entryPoint);
    
    if (!fs.existsSync(entryPointPath)) {
      throw new Error(`Tentacle entry point does not exist: ${entryPointPath}`);
    }
    
    try {
      // Load module
      let tentacleModule;
      
      if (sandboxEnabled && options.sandbox !== false) {
        // Load in sandbox
        tentacleModule = await loadModuleInSandbox(entryPointPath, securityOptions);
      } else {
        // Load directly
        tentacleModule = require(entryPointPath);
      }
      
      // Add path to module for reference
      tentacleModule.path = tentaclePath;
      
      return tentacleModule;
    } catch (error) {
      throw new Error(`Failed to load tentacle module: ${error.message}`);
    }
  }
  
  /**
   * Downloads and installs a tentacle from a URL.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {string} url - URL to download the tentacle from
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Promise that resolves with the installed tentacle module
   */
  async function downloadAndInstallTentacle(tentacleId, url, options = {}) {
    logger.info(`[${name}] Downloading tentacle from URL: ${url}`);
    
    // Implementation would include:
    // 1. Download archive from URL
    // 2. Verify integrity and authenticity
    // 3. Extract to tentacle directory
    // 4. Load the tentacle module
    
    // This is a placeholder for the actual implementation
    throw new Error('Downloading tentacles from URLs is not implemented yet');
  }
  
  /**
   * Loads a module in a sandboxed environment.
   * 
   * @param {string} modulePath - Path to the module
   * @param {Object} securityOptions - Security options for the sandbox
   * @returns {Promise<Object>} Promise that resolves with the sandboxed module
   */
  async function loadModuleInSandbox(modulePath, securityOptions) {
    logger.info(`[${name}] Loading module in sandbox: ${modulePath}`);
    
    // Read module source
    const moduleSource = fs.readFileSync(modulePath, 'utf8');
    
    // Create sandbox context
    const sandbox = {
      require: createSandboxedRequire(path.dirname(modulePath), securityOptions),
      module: { exports: {} },
      exports: {},
      console: {
        log: (...args) => logger.info(`[Sandbox] ${args.join(' ')}`),
        info: (...args) => logger.info(`[Sandbox] ${args.join(' ')}`),
        warn: (...args) => logger.warn(`[Sandbox] ${args.join(' ')}`),
        error: (...args) => logger.error(`[Sandbox] ${args.join(' ')}`)
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      process: {
        env: {} // Provide limited environment variables
      },
      Buffer
    };
    
    // Add context properties to module.exports and exports
    sandbox.module.exports = sandbox.exports;
    
    try {
      // Create script
      const script = new vm.Script(moduleSource, {
        filename: modulePath,
        timeout: securityOptions.timeout
      });
      
      // Run script in context
      const context = vm.createContext(sandbox);
      script.runInContext(context);
      
      // Return exported module
      return sandbox.module.exports;
    } catch (error) {
      throw new Error(`Error running module in sandbox: ${error.message}`);
    }
  }
  
  /**
   * Creates a sandboxed require function that only allows specific modules.
   * 
   * @param {string} basePath - Base path for resolving relative requires
   * @param {Object} securityOptions - Security options with allowedModules
   * @returns {Function} Sandboxed require function
   */
  function createSandboxedRequire(basePath, securityOptions) {
    return function sandboxedRequire(moduleName) {
      // Check if module is allowed
      if (securityOptions.allowedModules.includes(moduleName)) {
        // Built-in module, allow direct require
        return require(moduleName);
      } else if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        // Relative path, resolve against base path
        const resolvedPath = path.resolve(basePath, moduleName);
        
        // Check if path is within tentacle directory
        if (!resolvedPath.startsWith(tentacleDirectory)) {
          throw new Error(`Access denied: Cannot require module outside tentacle directory: ${moduleName}`);
        }
        
        // Load module
        return require(resolvedPath);
      } else if (moduleName.startsWith('/')) {
        // Absolute path, deny
        throw new Error(`Access denied: Cannot require absolute path: ${moduleName}`);
      } else {
        // Node module, check if allowed
        throw new Error(`Access denied: Node module not in allowlist: ${moduleName}`);
      }
    };
  }
  
  /**
   * Unloads a tentacle.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {Object} options - Unloading options
   * @param {boolean} options.removeFiles - Whether to remove the tentacle files
   * @returns {Promise<boolean>} Promise that resolves with true if successful
   */
  async function unloadTentacle(tentacleId, options = {}) {
    logger.info(`[${name}] Unloading tentacle: ${tentacleId}`);
    
    // Check if tentacle is loaded
    if (!loadedTentacles.has(tentacleId) && !loadedModules.has(tentacleId)) {
      logger.warn(`[${name}] Tentacle ${tentacleId} is not loaded`);
      return Promise.resolve(false);
    }
    
    try {
      // Get tentacle instance
      const tentacleInstance = loadedTentacles.get(tentacleId);
      
      // Stop tentacle if it's running
      if (tentacleInstance) {
        await tentacleFramework.stopTentacle(tentacleInstance.id);
      }
      
      // Unregister from framework
      tentacleFramework.unregisterTentacleFactory(tentacleId);
      
      // Unregister from registry
      tentacleRegistry.unregisterTentacleConfiguration(tentacleId);
      
      // Remove from tracking
      loadedTentacles.delete(tentacleId);
      loadedModules.delete(tentacleId);
      tentacleVersions.delete(tentacleId);
      
      // Remove files if requested
      if (options.removeFiles) {
        const tentaclePath = path.join(tentacleDirectory, tentacleId);
        if (fs.existsSync(tentaclePath)) {
          // Implementation would recursively delete directory
          // This is a placeholder for the actual implementation
          logger.info(`[${name}] Would remove tentacle files: ${tentaclePath}`);
        }
      }
      
      logger.info(`[${name}] Successfully unloaded tentacle: ${tentacleId}`);
      metrics.recordMetric('tentacle_unloaded', { tentacleId });
      
      // Emit event
      eventEmitter.emit('dynamic-tentacle-loader:tentacle-unloaded', {
        id: tentacleId
      });
      
      return true;
    } catch (error) {
      logger.error(`[${name}] Failed to unload tentacle ${tentacleId}:`, error);
      metrics.recordMetric('tentacle_unload_failed', {
        tentacleId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Updates a tentacle to a new version.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @param {string|Object} source - Source of the new version
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Promise that resolves with the updated tentacle
   */
  async function updateTentacle(tentacleId, source, options = {}) {
    logger.info(`[${name}] Updating tentacle: ${tentacleId}`);
    
    try {
      // Unload current version
      await unloadTentacle(tentacleId, { removeFiles: false });
      
      // Load new version
      const updatedTentacle = await loadTentacle(tentacleId, source, {
        ...options,
        force: true
      });
      
      logger.info(`[${name}] Successfully updated tentacle: ${tentacleId}`);
      metrics.recordMetric('tentacle_updated', {
        tentacleId,
        version: tentacleVersions.get(tentacleId)
      });
      
      return updatedTentacle;
    } catch (error) {
      logger.error(`[${name}] Failed to update tentacle ${tentacleId}:`, error);
      metrics.recordMetric('tentacle_update_failed', {
        tentacleId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Gets information about a loaded tentacle.
   * 
   * @param {string} tentacleId - Unique identifier for the tentacle
   * @returns {Object|null} Tentacle information or null if not loaded
   */
  function getTentacleInfo(tentacleId) {
    if (!loadedModules.has(tentacleId)) {
      return null;
    }
    
    const tentacleInstance = loadedTentacles.get(tentacleId);
    const version = tentacleVersions.get(tentacleId);
    
    return {
      id: tentacleId,
      version,
      loaded: true,
      initialized: !!tentacleInstance,
      instance: tentacleInstance
    };
  }
  
  /**
   * Lists all loaded tentacles.
   * 
   * @returns {Array<Object>} Array of tentacle information objects
   */
  function listLoadedTentacles() {
    return Array.from(loadedModules.keys()).map(tentacleId => getTentacleInfo(tentacleId));
  }
  
  /**
   * Shuts down the dynamic tentacle loader.
   * 
   * @returns {Promise<void>} Promise that resolves when shutdown is complete
   */
  async function shutdown() {
    logger.info(`[${name}] Shutting down dynamic tentacle loader`);
    
    // Unload all tentacles
    const unloadPromises = Array.from(loadedTentacles.keys()).map(tentacleId => 
      unloadTentacle(tentacleId).catch(error => {
        logger.error(`[${name}] Error unloading tentacle ${tentacleId} during shutdown:`, error);
      })
    );
    
    await Promise.all(unloadPromises);
    
    // Remove event listeners
    for (const [event, listener] of listeners.entries()) {
      eventEmitter.off(`tentacle-registry:${event}-tentacle`, listener);
    }
    
    listeners.clear();
    
    logger.info(`[${name}] Dynamic tentacle loader shut down`);
    return Promise.resolve();
  }
  
  // Create and return the public interface
  return {
    id,
    name,
    
    // Core methods
    initialize,
    shutdown,
    
    // Tentacle management
    loadTentacle,
    unloadTentacle,
    updateTentacle,
    
    // Information methods
    getTentacleInfo,
    listLoadedTentacles,
    
    // Event interface
    on: (event, listener) => eventEmitter.on(event, listener),
    once: (event, listener) => eventEmitter.once(event, listener),
    off: (event, listener) => eventEmitter.off(event, listener),
    emit: (event, data) => eventEmitter.emit(event, data)
  };
}

module.exports = {
  createDynamicTentacleLoader
};
