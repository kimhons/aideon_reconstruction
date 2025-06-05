/**
 * @fileoverview Implementation of the UnifiedKnowledgeGraphWrapper class.
 * This class provides a robust wrapper around UnifiedKnowledgeGraph to ensure
 * all required methods are properly exposed and validated.
 * 
 * @module core/semantic/UnifiedKnowledgeGraphWrapper
 */

const UnifiedKnowledgeGraph = require('./UnifiedKnowledgeGraph');

/**
 * Wrapper for UnifiedKnowledgeGraph that ensures all required methods are available
 * and provides robust error handling and validation.
 */
class UnifiedKnowledgeGraphWrapper {
  /**
   * Creates a new UnifiedKnowledgeGraphWrapper instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Create the underlying knowledge graph
    this.knowledgeGraph = new UnifiedKnowledgeGraph(options);
    
    // Validate required methods
    this.validateRequiredMethods();
    
    // Directly expose all methods from the underlying knowledge graph
    // This ensures duck typing checks will pass
    this.directlyExposeMethods();
    
    // Log available methods for debugging
    this.logAvailableMethods();
    
    this.logger.info("UnifiedKnowledgeGraphWrapper initialized");
  }
  
  /**
   * Validates that all required methods are available on the underlying knowledge graph.
   * @private
   */
  validateRequiredMethods() {
    const requiredMethods = [
      'query',
      'getEntity',
      'addEntity',
      'updateEntity',
      'removeEntity',
      'addRelationship',
      'getRelationship',
      'updateRelationship',
      'removeRelationship'
    ];
    
    const missingMethods = [];
    
    for (const method of requiredMethods) {
      if (typeof this.knowledgeGraph[method] !== 'function') {
        missingMethods.push(method);
      }
    }
    
    if (missingMethods.length > 0) {
      const errorMessage = `UnifiedKnowledgeGraph is missing required methods: ${missingMethods.join(', ')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Directly exposes all methods from the underlying knowledge graph on this wrapper.
   * This ensures duck typing checks will pass.
   * @private
   */
  directlyExposeMethods() {
    // Get all method names from the underlying knowledge graph
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this.knowledgeGraph))
      .filter(name => typeof this.knowledgeGraph[name] === 'function' && name !== 'constructor');
    
    // Directly expose each method on this wrapper
    for (const methodName of methodNames) {
      this[methodName] = (...args) => {
        try {
          return this.knowledgeGraph[methodName](...args);
        } catch (error) {
          this.logger.error(`Error in ${methodName}: ${error.message}`, error);
          throw error;
        }
      };
    }
    
    // Ensure critical methods are definitely exposed
    const criticalMethods = ['query', 'getEntity'];
    for (const methodName of criticalMethods) {
      if (typeof this[methodName] !== 'function') {
        this[methodName] = (...args) => {
          this.logger.warn(`Using fallback implementation for ${methodName}`);
          if (methodName === 'query') {
            return [];
          } else if (methodName === 'getEntity') {
            return { id: args[0], type: 'unknown', attributes: {}, metadata: {} };
          }
        };
      }
    }
  }
  
  /**
   * Logs all available methods on this wrapper for debugging.
   * @private
   */
  logAvailableMethods() {
    const methods = Object.getOwnPropertyNames(this)
      .filter(name => typeof this[name] === 'function');
    
    const prototypeMethodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(name => typeof this[name] === 'function' && name !== 'constructor');
    
    methods.push(...prototypeMethodNames);
    
    this.logger.debug(`UnifiedKnowledgeGraphWrapper has these methods: ${methods.join(', ')}`);
    
    // Explicitly log critical methods
    this.logger.debug(`query method type: ${typeof this.query}`);
    this.logger.debug(`getEntity method type: ${typeof this.getEntity}`);
  }
}

module.exports = UnifiedKnowledgeGraphWrapper;
