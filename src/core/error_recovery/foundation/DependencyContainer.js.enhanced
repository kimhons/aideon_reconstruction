/**
 * @fileoverview Enhanced DependencyContainer implementation with improved singleton handling
 * and robust dependency resolution for the Autonomous Error Recovery System.
 * 
 * @module core/error_recovery/foundation/DependencyContainer
 */

/**
 * Enhanced DependencyContainer with improved singleton handling and dependency tracking.
 * Provides a robust dependency injection system for component wiring.
 */
class DependencyContainer {
  /**
   * Creates a new DependencyContainer instance.
   */
  constructor() {
    // Maps for storing registrations and instances
    this.instances = new Map();
    this.factories = new Map();
    this.singletons = new Map();
    
    // Dependency resolution tracking to detect circular dependencies
    this.resolutionStack = [];
    
    console.log('DependencyContainer initialized');
  }
  
  /**
   * Registers a factory function for a dependency.
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function that creates the dependency
   * @param {boolean} [singleton=false] - Whether this dependency should be a singleton
   * @returns {DependencyContainer} This container instance for chaining
   */
  register(name, factory, singleton = false) {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for '${name}' must be a function`);
    }
    
    this.factories.set(name, factory);
    
    if (singleton) {
      this.singletons.set(name, true);
    }
    
    return this;
  }
  
  /**
   * Registers a factory function as a singleton.
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function that creates the dependency
   * @returns {DependencyContainer} This container instance for chaining
   */
  registerSingleton(name, factory) {
    return this.register(name, factory, true);
  }
  
  /**
   * Registers an existing instance for a dependency.
   * @param {string} name - Dependency name
   * @param {any} instance - Instance to register
   * @returns {DependencyContainer} This container instance for chaining
   */
  registerInstance(name, instance) {
    this.instances.set(name, instance);
    return this;
  }
  
  /**
   * Resolves a dependency by name.
   * @param {string} name - Dependency name
   * @returns {any} Resolved dependency instance
   */
  resolve(name) {
    // Check for circular dependencies
    if (this.resolutionStack.includes(name)) {
      const dependencyChain = [...this.resolutionStack, name].join(' -> ');
      throw new Error(`Circular dependency detected: ${dependencyChain}`);
    }
    
    // Check if instance already exists (for singletons)
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }
    
    // Check if factory exists
    if (!this.factories.has(name)) {
      throw new Error(`No registration found for dependency: ${name}`);
    }
    
    // Track resolution stack for circular dependency detection
    this.resolutionStack.push(name);
    
    try {
      // Create instance using factory
      const factory = this.factories.get(name);
      const instance = factory(this);
      
      // Store instance if singleton
      if (this.singletons.has(name)) {
        this.instances.set(name, instance);
      }
      
      return instance;
    } finally {
      // Remove from resolution stack
      this.resolutionStack.pop();
    }
  }
  
  /**
   * Checks if a dependency is registered.
   * @param {string} name - Dependency name
   * @returns {boolean} True if dependency is registered
   */
  has(name) {
    return this.instances.has(name) || this.factories.has(name);
  }
  
  /**
   * Removes a dependency registration.
   * @param {string} name - Dependency name
   * @returns {boolean} True if dependency was removed
   */
  remove(name) {
    const hadInstance = this.instances.delete(name);
    const hadFactory = this.factories.delete(name);
    this.singletons.delete(name);
    
    return hadInstance || hadFactory;
  }
  
  /**
   * Clears all dependency registrations.
   */
  clear() {
    this.instances.clear();
    this.factories.clear();
    this.singletons.clear();
    this.resolutionStack = [];
  }
  
  /**
   * Gets the current state of the container for debugging.
   * @returns {Object} Container state
   */
  getDebugState() {
    return {
      registeredDependencies: Array.from(this.factories.keys()),
      resolvedSingletons: Array.from(this.instances.keys()),
      singletonDependencies: Array.from(this.singletons.keys()),
      currentResolutionStack: [...this.resolutionStack]
    };
  }
  
  /**
   * Prints the current state of the container for debugging.
   */
  printDebugState() {
    const state = this.getDebugState();
    console.log('DependencyContainer Debug State:');
    console.log('- Registered Dependencies:', state.registeredDependencies);
    console.log('- Resolved Singletons:', state.resolvedSingletons);
    console.log('- Singleton Dependencies:', state.singletonDependencies);
    console.log('- Current Resolution Stack:', state.currentResolutionStack);
  }
}

module.exports = DependencyContainer;
