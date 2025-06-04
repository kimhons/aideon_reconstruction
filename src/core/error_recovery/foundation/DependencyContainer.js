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
   * Resolves a dependency by name
   * 
   * @param {string} name - Dependency name to resolve
   * @returns {Promise<any>} - Resolved dependency instance
   * @throws {Error} - If dependency is not registered or resolution fails
   */
  async resolve(name) {
    if (!this.registry.has(name)) {
      throw new Error(`Dependency not registered: ${name}`);
    }

    const { factory, options } = this.registry.get(name);

    // Return cached singleton if available
    if (options.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    try {
      // Create new instance
      const instance = await factory(this);

      // Initialize if needed
      if (this.initializers.has(name)) {
        await this.initializers.get(name)(instance, this);
      }

      // Cache singleton
      if (options.singleton) {
        this.singletons.set(name, instance);
      }

      return instance;
    } catch (error) {
      this.logger.error(`Failed to resolve dependency '${name}': ${error.message}`, error);
      throw new Error(`Failed to resolve dependency '${name}': ${error.message}`);
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
    if (visiting.has(name)) {
      throw new Error(`Circular dependency detected: ${Array.from(visiting).join(' -> ')} -> ${name}`);
    }

    visiting.add(name);
    this.logger.debug(`Initializing dependency: ${name}`);

    // Resolve and initialize
    await this.resolve(name);

    visiting.delete(name);
    initialized.add(name);
    this.logger.debug(`Successfully initialized dependency: ${name}`);
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
          this.logger.warn(`Error disposing singleton '${name}': ${error.message}`, error);
        }
      }
    }
    
    this.singletons.clear();
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
