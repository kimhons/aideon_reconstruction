/**
 * AudioProcessingRegistry.js
 * 
 * Central registry for audio processing capabilities and components.
 * Manages registration, discovery, and access to audio processing components.
 * 
 * @module tentacles/audio-processing/core/AudioProcessingRegistry
 */

const { EventEmitter } = require('events');

/**
 * Audio Processing Registry class
 * Manages registration and discovery of audio processing components
 */
class AudioProcessingRegistry extends EventEmitter {
  /**
   * Constructor for the Audio Processing Registry
   * @param {Object} options - Configuration options
   * @param {boolean} options.strictMode - Whether to enforce strict capability validation
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    super();
    
    this.components = new Map();
    this.capabilities = new Map();
    this.dependencyGraph = new Map();
    this.strictMode = options.strictMode !== undefined ? options.strictMode : false;
    this.logger = options.logger || console;
    
    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Register a component with the registry
   * @param {string} capability - The capability provided by the component
   * @param {Object} component - The component instance
   * @param {Object} options - Registration options
   * @param {Array<string>} options.dependencies - Capabilities this component depends on
   * @param {Object} options.metadata - Additional metadata for the component
   * @returns {boolean} - True if registration was successful
   */
  register(capability, component, options = {}) {
    if (!capability || !component) {
      throw new Error('Both capability and component must be provided');
    }

    // Check if capability already registered
    if (this.components.has(capability) && this.strictMode) {
      throw new Error(`Capability "${capability}" is already registered`);
    }

    // Store component
    this.components.set(capability, component);
    
    // Register component's detailed capabilities if available
    if (typeof component.getCapabilities === 'function') {
      this.capabilities.set(capability, component.getCapabilities());
    } else {
      this.capabilities.set(capability, { basic: true });
    }
    
    // Store dependencies
    if (options.dependencies && Array.isArray(options.dependencies)) {
      this.dependencyGraph.set(capability, options.dependencies);
      
      // Validate dependencies if in strict mode
      if (this.strictMode) {
        for (const dependency of options.dependencies) {
          if (!this.components.has(dependency)) {
            this.logger.warn(`Component "${capability}" depends on unregistered capability "${dependency}"`);
          }
        }
      }
    } else {
      this.dependencyGraph.set(capability, []);
    }
    
    // Store metadata
    if (options.metadata) {
      const capabilityDetails = this.capabilities.get(capability);
      this.capabilities.set(capability, {
        ...capabilityDetails,
        metadata: options.metadata
      });
    }
    
    // Emit event
    this.emit('componentRegistered', {
      capability,
      component,
      dependencies: options.dependencies || [],
      metadata: options.metadata || {}
    });
    
    this.logger.debug(`Registered component for capability "${capability}"`);
    
    return true;
  }

  /**
   * Unregister a component from the registry
   * @param {string} capability - The capability to unregister
   * @returns {boolean} - True if unregistration was successful
   */
  unregister(capability) {
    if (!this.components.has(capability)) {
      return false;
    }
    
    // Check for dependent components
    const dependents = this._findDependents(capability);
    
    if (dependents.length > 0 && this.strictMode) {
      throw new Error(`Cannot unregister capability "${capability}" because it has dependents: ${dependents.join(', ')}`);
    }
    
    // Get component before removal for event
    const component = this.components.get(capability);
    
    // Remove component
    this.components.delete(capability);
    this.capabilities.delete(capability);
    this.dependencyGraph.delete(capability);
    
    // Emit event
    this.emit('componentUnregistered', {
      capability,
      component,
      dependents
    });
    
    this.logger.debug(`Unregistered component for capability "${capability}"`);
    
    return true;
  }

  /**
   * Get a component by capability
   * @param {string} capability - The capability to get the component for
   * @returns {Object|null} - The component instance or null if not found
   */
  getComponent(capability) {
    return this.components.get(capability) || null;
  }

  /**
   * Check if a capability is available
   * @param {string} capability - The capability to check
   * @returns {boolean} - True if the capability is available
   */
  hasCapability(capability) {
    return this.components.has(capability);
  }

  /**
   * Get detailed capabilities for a specific capability
   * @param {string} capability - The capability to get details for
   * @returns {Object|null} - The capability details or null if not found
   */
  getCapabilityDetails(capability) {
    return this.capabilities.get(capability) || null;
  }

  /**
   * Get all registered capabilities
   * @returns {Object} - Map of all capabilities and their details
   */
  getAllCapabilities() {
    const result = {};
    
    for (const [capability, details] of this.capabilities.entries()) {
      result[capability] = details;
    }
    
    return result;
  }

  /**
   * Get all registered components
   * @returns {Map} - Map of all components
   */
  getAllComponents() {
    return new Map(this.components);
  }

  /**
   * Find components that match specific criteria
   * @param {Function} predicate - Function that takes capability and component and returns boolean
   * @returns {Array} - Array of matching components
   */
  findComponents(predicate) {
    const result = [];
    
    for (const [capability, component] of this.components.entries()) {
      if (predicate(capability, component)) {
        result.push({ capability, component });
      }
    }
    
    return result;
  }

  /**
   * Get the number of registered components
   * @returns {number} - The number of registered components
   */
  getComponentCount() {
    return this.components.size;
  }

  /**
   * Clear all registered components
   */
  clear() {
    // Store components for event
    const previousComponents = new Map(this.components);
    
    // Clear all maps
    this.components.clear();
    this.capabilities.clear();
    this.dependencyGraph.clear();
    
    // Emit event
    this.emit('registryCleared', {
      previousComponents
    });
    
    this.logger.debug('Cleared all registered components');
  }
  
  /**
   * Get dependencies for a capability
   * @param {string} capability - The capability to get dependencies for
   * @returns {Array<string>} - Array of dependency capabilities
   */
  getDependencies(capability) {
    return this.dependencyGraph.get(capability) || [];
  }
  
  /**
   * Get all components that depend on a capability
   * @param {string} capability - The capability to find dependents for
   * @returns {Array<string>} - Array of dependent capabilities
   */
  getDependents(capability) {
    return this._findDependents(capability);
  }
  
  /**
   * Check if a capability has all its dependencies satisfied
   * @param {string} capability - The capability to check
   * @returns {boolean} - True if all dependencies are satisfied
   */
  areDependenciesSatisfied(capability) {
    const dependencies = this.getDependencies(capability);
    
    for (const dependency of dependencies) {
      if (!this.components.has(dependency)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get a topologically sorted list of capabilities
   * This ensures that dependencies are initialized before dependents
   * @returns {Array<string>} - Sorted list of capabilities
   */
  getInitializationOrder() {
    const visited = new Set();
    const temp = new Set();
    const order = [];
    
    // Helper function for depth-first search
    const visit = (capability) => {
      // Skip if already visited
      if (visited.has(capability)) {
        return;
      }
      
      // Check for circular dependency
      if (temp.has(capability)) {
        throw new Error(`Circular dependency detected involving "${capability}"`);
      }
      
      // Mark as temporarily visited
      temp.add(capability);
      
      // Visit dependencies
      const dependencies = this.getDependencies(capability);
      for (const dependency of dependencies) {
        if (this.components.has(dependency)) {
          visit(dependency);
        }
      }
      
      // Mark as visited
      temp.delete(capability);
      visited.add(capability);
      
      // Add to order
      order.push(capability);
    };
    
    // Visit all capabilities
    for (const capability of this.components.keys()) {
      if (!visited.has(capability)) {
        visit(capability);
      }
    }
    
    return order;
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Remove all listeners
    this.removeAllListeners();
  }
  
  /**
   * Find all components that depend on a capability
   * @private
   * @param {string} capability - The capability to find dependents for
   * @returns {Array<string>} - Array of dependent capabilities
   */
  _findDependents(capability) {
    const dependents = [];
    
    for (const [cap, dependencies] of this.dependencyGraph.entries()) {
      if (dependencies.includes(capability)) {
        dependents.push(cap);
      }
    }
    
    return dependents;
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Handle process exit
    process.on('beforeExit', () => {
      this.cleanup();
    });
  }
}

module.exports = AudioProcessingRegistry;
