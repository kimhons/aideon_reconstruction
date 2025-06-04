/**
 * DependencyContainer.js
 * 
 * A robust dependency injection container for the Autonomous Error Recovery System.
 * Manages component lifecycle, dependency resolution, and initialization sequence.
 */

class DependencyContainer {
  /**
   * Creates a new DependencyContainer instance
   */
  constructor() {
    this.registry = new Map();
    this.singletons = new Map();
    this.initializers = new Map();
    this.logger = console;
    this.resolutionStacks = new Map(); // Track resolution stacks per call chain
    this.resolutionInProgress = new Set(); // Global set to track all dependencies currently being resolved
  }

  /**
   * Registers a component factory with the container
   * 
   * @param {string} name - Unique identifier for the dependency
   * @param {Function} factory - Async factory function that creates the dependency
   * @param {Object} options - Registration options
   * @param {boolean} options.singleton - Whether to cache and reuse the instance (default: true)
   * @returns {DependencyContainer} - This container instance for chaining
   */
  register(name, factory, options = { singleton: true }) {
    if (!name || typeof name !== 'string') {
      throw new Error('Dependency name must be a non-empty string');
    }
    
    if (!factory || typeof factory !== 'function') {
      throw new Error(`Invalid factory for dependency '${name}': must be a function`);
    }
    
    this.registry.set(name, { factory, options });
    this.logger.debug(`Registered dependency: ${name}`);
    return this;
  }

  /**
   * Registers an initializer function for a dependency
   * 
   * @param {string} name - Dependency name
   * @param {Function} initializer - Async initializer function
   * @returns {DependencyContainer} - This container instance for chaining
   */
  registerInitializer(name, initializer) {
    if (!name || typeof name !== 'string') {
      throw new Error('Dependency name must be a non-empty string');
    }
    
    if (!initializer || typeof initializer !== 'function') {
      throw new Error(`Invalid initializer for dependency '${name}': must be a function`);
    }
    
    this.initializers.set(name, initializer);
    this.logger.debug(`Registered initializer for dependency: ${name}`);
    return this;
  }

  /**
   * Resolves a dependency by name with cycle detection
   * 
   * @param {string} name - Dependency name to resolve
   * @param {string} [callerId] - ID of the caller for tracking resolution chains
   * @returns {Promise<any>} - Resolved dependency instance
   * @throws {Error} - If dependency is not registered, resolution fails, or circular dependency detected
   */
  async resolve(name, callerId = 'root') {
    if (!this.registry.has(name)) {
      throw new Error(`Dependency not registered: ${name}`);
    }

    const { factory, options } = this.registry.get(name);

    // Return cached singleton if available
    if (options.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Check global resolution set first - this catches circular dependencies across different call chains
    if (this.resolutionInProgress.has(name)) {
      const stackInfo = Array.from(this.resolutionInProgress).join(' -> ') + ' -> ' + name;
      throw new Error(`Circular dependency detected (global): ${stackInfo}`);
    }

    // Initialize resolution stack for this call chain if not exists
    if (!this.resolutionStacks.has(callerId)) {
      this.resolutionStacks.set(callerId, new Set());
    }
    
    const resolutionStack = this.resolutionStacks.get(callerId);

    // Check for circular dependencies in this specific call chain
    if (resolutionStack.has(name)) {
      const stackArray = Array.from(resolutionStack);
      stackArray.push(name); // Add current dependency to show the complete cycle
      
      // Clear the resolution stack to prevent memory leaks
      this.resolutionStacks.delete(callerId);
      
      throw new Error(`Circular dependency detected (local): ${stackArray.join(' -> ')}`);
    }

    // Add to both local and global resolution tracking
    resolutionStack.add(name);
    this.resolutionInProgress.add(name);
    
    // Generate a unique ID for this resolution chain
    const resolutionId = `${callerId}_${name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.logger.debug(`Resolving dependency: ${name} (stack: ${Array.from(resolutionStack).join(', ')})`);

    try {
      // Create new instance with this resolution chain ID
      const instance = await factory(this, resolutionId);

      // Initialize if needed
      if (this.initializers.has(name)) {
        await this.initializers.get(name)(instance, this, resolutionId);
      }

      // Cache singleton
      if (options.singleton) {
        this.singletons.set(name, instance);
      }

      return instance;
    } catch (error) {
      this.logger.error(`Failed to resolve dependency '${name}': ${error.message}`);
      throw error; // Preserve original error for better debugging
    } finally {
      // Remove from both local and global resolution tracking
      resolutionStack.delete(name);
      this.resolutionInProgress.delete(name);
      
      // Clean up empty resolution stacks
      if (resolutionStack.size === 0) {
        this.resolutionStacks.delete(callerId);
      }
      
      this.logger.debug(`Completed resolving dependency: ${name}`);
    }
  }

  /**
   * Initializes all registered dependencies in the correct order
   * 
   * @returns {Promise<DependencyContainer>} - This container instance for chaining
   */
  async initializeAll() {
    const initialized = new Set();
    const dependencies = Array.from(this.registry.keys());

    this.logger.info(`Initializing ${dependencies.length} dependencies...`);

    // Reset global resolution tracking before initialization
    this.resolutionInProgress.clear();

    for (const name of dependencies) {
      await this.initializeDependency(name, initialized, new Set());
    }

    this.logger.info(`Successfully initialized ${initialized.size} dependencies`);
    return this;
  }

  /**
   * Initializes a single dependency and its dependencies
   * 
   * @param {string} name - Dependency name to initialize
   * @param {Set<string>} initialized - Set of already initialized dependencies
   * @param {Set<string>} visiting - Set of dependencies currently being initialized (for cycle detection)
   * @returns {Promise<void>}
   * @throws {Error} - If circular dependency is detected
   * @private
   */
  async initializeDependency(name, initialized, visiting) {
    if (initialized.has(name)) return;
    
    // Check both local and global circular dependencies
    if (visiting.has(name) || this.resolutionInProgress.has(name)) {
      const visitingArray = Array.from(visiting);
      visitingArray.push(name);
      throw new Error(`Circular dependency detected during initialization: ${visitingArray.join(' -> ')}`);
    }

    visiting.add(name);
    this.resolutionInProgress.add(name);
    
    this.logger.debug(`Initializing dependency: ${name}`);

    try {
      // Resolve and initialize with a unique initialization chain ID
      const initId = `init_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await this.resolve(name, initId);
      
      initialized.add(name);
      this.logger.debug(`Successfully initialized dependency: ${name}`);
    } finally {
      visiting.delete(name);
      this.resolutionInProgress.delete(name);
    }
  }

  /**
   * Disposes of all singleton instances that have a dispose method
   * 
   * @returns {Promise<void>}
   */
  async dispose() {
    this.logger.info(`Disposing ${this.singletons.size} singleton instances...`);
    
    // Dispose all singletons that have dispose method
    for (const [name, instance] of this.singletons.entries()) {
      if (typeof instance.dispose === 'function') {
        try {
          await instance.dispose();
          this.logger.debug(`Disposed singleton: ${name}`);
        } catch (error) {
          this.logger.warn(`Error disposing singleton '${name}': ${error.message}`);
        }
      }
    }
    
    this.singletons.clear();
    this.resolutionStacks.clear();
    this.resolutionInProgress.clear();
    this.logger.info('All singletons disposed');
  }

  /**
   * Sets the logger instance
   * 
   * @param {Object} logger - Logger instance with debug, info, warn, error methods
   * @returns {DependencyContainer} - This container instance for chaining
   */
  setLogger(logger) {
    if (!logger || typeof logger !== 'object') {
      throw new Error('Invalid logger: must be an object');
    }
    
    if (!logger.debug || !logger.info || !logger.warn || !logger.error) {
      throw new Error('Invalid logger: must have debug, info, warn, error methods');
    }
    
    this.logger = logger;
    return this;
  }
}

module.exports = DependencyContainer;
