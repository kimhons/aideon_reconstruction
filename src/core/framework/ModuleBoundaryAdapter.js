/**
 * @fileoverview ModuleBoundaryAdapter - Adapters for reliable cross-module communication.
 * This module provides adapters that ensure reliable method preservation when objects
 * cross module boundaries, particularly for existing class-based components.
 * 
 * @module core/framework/ModuleBoundaryAdapter
 */

const { v4: uuidv4 } = require("uuid");

/**
 * Creates a module boundary adapter for an object.
 * This adapter ensures that all methods are preserved when the object crosses module boundaries.
 * 
 * @param {Object} obj - The object to adapt
 * @param {Object} options - Adapter options
 * @param {Array<string>} [options.methodNames] - Specific method names to adapt (if not provided, all methods will be adapted)
 * @param {boolean} [options.includePrototypeMethods] - Whether to include methods from the prototype chain
 * @param {boolean} [options.preserveThis] - Whether to preserve the 'this' context in adapted methods
 * @returns {Object} Adapted object with all methods as own properties
 */
function createModuleBoundaryAdapter(obj, options = {}) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Cannot create adapter for non-object value');
  }
  
  const adapter = {};
  const methodNames = options.methodNames || [];
  const includePrototypeMethods = options.includePrototypeMethods !== false;
  const preserveThis = options.preserveThis !== false;
  
  // If no specific methods are provided, discover all methods
  if (methodNames.length === 0) {
    // Get own methods
    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (typeof obj[prop] === 'function' && prop !== 'constructor') {
        methodNames.push(prop);
      }
    });
    
    // Get prototype methods if requested
    if (includePrototypeMethods) {
      let proto = Object.getPrototypeOf(obj);
      while (proto && proto !== Object.prototype) {
        Object.getOwnPropertyNames(proto).forEach(prop => {
          if (typeof proto[prop] === 'function' && 
              prop !== 'constructor' && 
              !methodNames.includes(prop)) {
            methodNames.push(prop);
          }
        });
        proto = Object.getPrototypeOf(proto);
      }
    }
  }
  
  // Copy all properties (including non-methods)
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (prop !== 'constructor' && !methodNames.includes(prop)) {
      adapter[prop] = obj[prop];
    }
  });
  
  // Adapt all methods
  methodNames.forEach(methodName => {
    const method = obj[methodName];
    
    if (typeof method === 'function') {
      if (preserveThis) {
        // Preserve 'this' context
        adapter[methodName] = function(...args) {
          return method.apply(obj, args);
        };
      } else {
        // Direct method reference
        adapter[methodName] = method;
      }
    }
  });
  
  // Add adapter metadata
  adapter._adapter = {
    id: uuidv4(),
    originalType: obj.constructor ? obj.constructor.name : 'Object',
    adaptedMethods: methodNames,
    createdAt: Date.now()
  };
  
  return adapter;
}

/**
 * Creates a class adapter factory that produces adapter instances for a specific class.
 * 
 * @param {Function} ClassConstructor - The class constructor to adapt
 * @param {Object} options - Adapter options
 * @param {Array<string>} [options.methodNames] - Specific method names to adapt
 * @param {boolean} [options.includePrototypeMethods] - Whether to include methods from the prototype chain
 * @param {boolean} [options.preserveThis] - Whether to preserve the 'this' context in adapted methods
 * @returns {Function} Factory function that creates adapted instances
 */
function createClassAdapterFactory(ClassConstructor, options = {}) {
  if (typeof ClassConstructor !== 'function') {
    throw new Error('Class constructor must be a function');
  }
  
  /**
   * Factory function that creates an adapted instance of the class.
   * 
   * @param {...any} args - Arguments to pass to the class constructor
   * @returns {Object} Adapted instance with all methods as own properties
   */
  return function(...args) {
    // Create instance
    const instance = new ClassConstructor(...args);
    
    // Create adapter
    return createModuleBoundaryAdapter(instance, options);
  };
}

/**
 * Creates an event interface adapter that ensures event methods are preserved.
 * 
 * @param {Object} obj - The object to adapt
 * @param {Object} eventEmitter - Event emitter to use (if not provided, obj must have event methods)
 * @returns {Object} Adapted object with event methods as own properties
 */
function createEventInterfaceAdapter(obj, eventEmitter = null) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Cannot create adapter for non-object value');
  }
  
  const adapter = { ...obj };
  
  // Use provided event emitter or object's own methods
  const emitter = eventEmitter || obj;
  
  // Ensure event methods exist
  if (typeof emitter.on !== 'function' || 
      typeof emitter.once !== 'function' || 
      typeof emitter.off !== 'function' || 
      typeof emitter.emit !== 'function') {
    throw new Error('Event emitter must have on, once, off, and emit methods');
  }
  
  // Add event methods directly on the adapter
  adapter.on = function(event, listener) {
    emitter.on(event, listener);
    return this;
  };
  
  adapter.once = function(event, listener) {
    emitter.once(event, listener);
    return this;
  };
  
  adapter.off = function(event, listener) {
    emitter.off(event, listener);
    return this;
  };
  
  adapter.emit = function(event, ...args) {
    return emitter.emit(event, ...args);
  };
  
  return adapter;
}

/**
 * Creates a duck typing validator that checks if an object implements a specific interface.
 * 
 * @param {Object} interfaceDefinition - Interface definition with method names and parameter counts
 * @returns {Function} Validator function that checks if an object implements the interface
 */
function createDuckTypingValidator(interfaceDefinition) {
  /**
   * Validates that an object implements the specified interface.
   * 
   * @param {Object} obj - The object to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  return function validateInterface(obj) {
    if (!obj || typeof obj !== 'object') {
      return { 
        valid: false, 
        errors: ['Value is not an object'] 
      };
    }
    
    const errors = [];
    
    // Check each method in the interface
    for (const [methodName, paramCount] of Object.entries(interfaceDefinition)) {
      // Check if method exists
      if (typeof obj[methodName] !== 'function') {
        errors.push(`Missing method: ${methodName}`);
        continue;
      }
      
      // Check parameter count if specified
      if (paramCount !== undefined && obj[methodName].length !== paramCount) {
        errors.push(`Method ${methodName} has wrong parameter count: expected ${paramCount}, got ${obj[methodName].length}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  };
}

/**
 * Creates a proxy adapter that intercepts method calls and ensures they're preserved.
 * This is useful for adapting objects that may change their methods at runtime.
 * 
 * @param {Object} obj - The object to adapt
 * @param {Object} options - Adapter options
 * @param {Array<string>} [options.methodNames] - Specific method names to adapt
 * @param {Function} [options.onMethodCall] - Callback for method calls
 * @returns {Proxy} Proxy object that ensures method preservation
 */
function createProxyAdapter(obj, options = {}) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Cannot create adapter for non-object value');
  }
  
  const methodNames = options.methodNames || [];
  const onMethodCall = options.onMethodCall || (() => {});
  
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      
      // If this is a method we're interested in, ensure it's bound to the target
      if (typeof value === 'function' && 
          (methodNames.length === 0 || methodNames.includes(prop))) {
        // Create a wrapper function that calls the original method
        return function(...args) {
          // Call the onMethodCall callback
          onMethodCall(prop, args);
          
          // Call the original method
          return value.apply(target, args);
        };
      }
      
      return value;
    }
  });
}

/**
 * Creates a serialization-safe adapter that ensures an object can be safely serialized and deserialized.
 * This is useful for objects that need to be passed through serialization boundaries like IPC or network.
 * 
 * @param {Object} obj - The object to adapt
 * @param {Object} options - Adapter options
 * @param {Array<string>} [options.methodNames] - Specific method names to adapt
 * @param {Function} [options.methodImplementations] - Method implementations to use after deserialization
 * @returns {Object} Serialization-safe object
 */
function createSerializationSafeAdapter(obj, options = {}) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Cannot create adapter for non-object value');
  }
  
  const methodNames = options.methodNames || [];
  const methodImplementations = options.methodImplementations || {};
  
  // Create a plain object with all non-function properties
  const adapter = {};
  
  // Copy all non-function properties
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (typeof obj[prop] !== 'function') {
      adapter[prop] = obj[prop];
    }
  });
  
  // Add method stubs for serialization
  methodNames.forEach(methodName => {
    // Use provided implementation or create a stub
    adapter[methodName] = methodImplementations[methodName] || 
      function() {
        throw new Error(`Method ${methodName} was called after serialization without a proper implementation`);
      };
  });
  
  // Add serialization metadata
  adapter._serialization = {
    id: uuidv4(),
    originalType: obj.constructor ? obj.constructor.name : 'Object',
    methodNames,
    createdAt: Date.now()
  };
  
  return adapter;
}

/**
 * Creates a component adapter factory for a specific component type.
 * This factory creates adapters for components that follow a specific interface.
 * 
 * @param {string} componentType - Component type identifier
 * @param {Object} interfaceDefinition - Interface definition with method names
 * @returns {Function} Factory function that creates component adapters
 */
function createComponentAdapterFactory(componentType, interfaceDefinition) {
  // Create validator
  const validateInterface = createDuckTypingValidator(interfaceDefinition);
  
  /**
   * Creates a component adapter.
   * 
   * @param {Object} component - Component instance to adapt
   * @param {Object} options - Adapter options
   * @returns {Object} Adapted component
   */
  return function createComponentAdapter(component, options = {}) {
    // Validate component
    const validation = validateInterface(component);
    
    if (!validation.valid) {
      throw new Error(`Invalid ${componentType} component: ${validation.errors.join(', ')}`);
    }
    
    // Create adapter
    const adapter = createModuleBoundaryAdapter(component, {
      methodNames: Object.keys(interfaceDefinition),
      includePrototypeMethods: true,
      preserveThis: true,
      ...options
    });
    
    // Add component metadata
    adapter._component = {
      type: componentType,
      id: component.id || uuidv4(),
      adapterId: adapter._adapter.id
    };
    
    return adapter;
  };
}

// Create adapter factories for common Aideon components
const createKnowledgeGraphAdapter = createComponentAdapterFactory('knowledge_graph', {
  query: 2,
  getEntity: 1
});

const createSemanticTranslatorAdapter = createComponentAdapterFactory('semantic_translator', {
  translateConcept: 2,
  translateConcepts: 2
});

const createQueryProcessorAdapter = createComponentAdapterFactory('query_processor', {
  executeQuery: 3,
  normalizeQuery: 1
});

const createNeuralCoordinatorAdapter = createComponentAdapterFactory('neural_coordinator', {
  registerPathway: 2,
  activatePathway: 2
});

const createPredictorAdapter = createComponentAdapterFactory('predictor', {
  predict: 2,
  train: 2
});

module.exports = {
  createModuleBoundaryAdapter,
  createClassAdapterFactory,
  createEventInterfaceAdapter,
  createDuckTypingValidator,
  createProxyAdapter,
  createSerializationSafeAdapter,
  createComponentAdapterFactory,
  // Pre-configured adapters for common components
  createKnowledgeGraphAdapter,
  createSemanticTranslatorAdapter,
  createQueryProcessorAdapter,
  createNeuralCoordinatorAdapter,
  createPredictorAdapter
};
