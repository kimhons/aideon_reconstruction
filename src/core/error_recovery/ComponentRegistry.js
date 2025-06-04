/**
 * @fileoverview Implementation of the ComponentRegistry for the Autonomous Error Recovery System.
 * This component provides centralized registration, initialization, and management of system components.
 * 
 * @module core/error_recovery/ComponentRegistry
 * @requires events
 */

const EventEmitter = require("events");

/**
 * ComponentRegistry provides centralized registration, initialization, and management
 * of system components, supporting both new architecture and legacy components.
 */
class ComponentRegistry extends EventEmitter {
  /**
   * Creates a new ComponentRegistry instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Component registries
    this.components = new Map();
    this.componentsByType = new Map();
    this.componentsByCategory = new Map();
    
    // Dependency graph
    this.dependencies = new Map();
    this.dependents = new Map();
    
    // Initialization state
    this.initialized = new Set();
    this.initializing = new Set();
    this.failed = new Map();
    
    // Configuration
    this.config = options.config || {};
    
    this.logger.info("ComponentRegistry initialized");
  }
  
  /**
   * Registers a component with the registry.
   * @param {string} id - Component ID
   * @param {Object} component - Component instance
   * @param {Object} metadata - Component metadata
   * @param {string} metadata.type - Component type
   * @param {string} metadata.category - Component category (legacy, new, bridge)
   * @param {Array<string>} metadata.dependencies - Component dependencies
   * @param {boolean} metadata.autoInitialize - Whether to auto-initialize the component
   * @returns {boolean} Whether registration was successful
   */
  registerComponent(id, component, metadata = {}) {
    if (this.components.has(id)) {
      this.logger.warn(`Component with ID ${id} is already registered`);
      return false;
    }
    
    const {
      type = "unknown",
      category = "unknown",
      dependencies = [],
      autoInitialize = true
    } = metadata;
    
    // Register component
    this.components.set(id, {
      id,
      component,
      metadata: {
        type,
        category,
        dependencies,
        autoInitialize,
        registeredAt: Date.now(),
        ...metadata
      },
      initialized: false,
      initializationTime: null,
      initializationError: null
    });
    
    // Register by type
    if (!this.componentsByType.has(type)) {
      this.componentsByType.set(type, new Set());
    }
    this.componentsByType.get(type).add(id);
    
    // Register by category
    if (!this.componentsByCategory.has(category)) {
      this.componentsByCategory.set(category, new Set());
    }
    this.componentsByCategory.get(category).add(id);
    
    // Register dependencies
    this.dependencies.set(id, new Set(dependencies));
    
    // Register as dependent for each dependency
    for (const depId of dependencies) {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, new Set());
      }
      this.dependents.get(depId).add(id);
    }
    
    this.logger.debug(`Registered component: ${id} (${type}, ${category})`);
    this.emit("component:registered", { id, type, category });
    
    if (this.metrics) {
      this.metrics.recordMetric("component_registered", 1);
      this.metrics.recordMetric(`component_category_${category}`, 1);
    }
    
    // Auto-initialize if specified
    if (autoInitialize) {
      this.initializeComponent(id).catch(error => {
        this.logger.error(`Failed to auto-initialize component ${id}: ${error.message}`, error);
      });
    }
    
    return true;
  }
  
  /**
   * Initializes a component and its dependencies.
   * @param {string} id - Component ID
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initializeComponent(id) {
    if (!this.components.has(id)) {
      throw new Error(`Component ${id} is not registered`);
    }
    
    const componentInfo = this.components.get(id);
    
    // Check if already initialized
    if (componentInfo.initialized) {
      this.logger.debug(`Component ${id} is already initialized`);
      return true;
    }
    
    // Check if currently initializing (circular dependency)
    if (this.initializing.has(id)) {
      throw new Error(`Circular dependency detected while initializing ${id}`);
    }
    
    // Check if previously failed
    if (this.failed.has(id)) {
      const error = this.failed.get(id);
      throw new Error(`Component ${id} previously failed initialization: ${error.message}`);
    }
    
    this.logger.debug(`Initializing component: ${id}`);
    this.initializing.add(id);
    
    try {
      // Initialize dependencies first
      const dependencies = this.dependencies.get(id) || new Set();
      for (const depId of dependencies) {
        if (!this.components.has(depId)) {
          throw new Error(`Dependency ${depId} is not registered`);
        }
        
        if (!this.components.get(depId).initialized) {
          await this.initializeComponent(depId);
        }
      }
      
      // Get dependency instances
      const dependencyInstances = {};
      for (const depId of dependencies) {
        dependencyInstances[depId] = this.components.get(depId).component;
      }
      
      // Initialize component
      const startTime = Date.now();
      const component = componentInfo.component;
      
      if (typeof component.initialize === 'function') {
        await component.initialize(dependencyInstances);
      }
      
      // Update component info
      componentInfo.initialized = true;
      componentInfo.initializationTime = Date.now() - startTime;
      
      this.initialized.add(id);
      this.initializing.delete(id);
      
      this.logger.debug(`Component ${id} initialized in ${componentInfo.initializationTime}ms`);
      this.emit("component:initialized", { id, duration: componentInfo.initializationTime });
      
      if (this.metrics) {
        this.metrics.recordMetric("component_initialized", 1);
        this.metrics.recordMetric("component_initialization_time", componentInfo.initializationTime);
      }
      
      return true;
    } catch (error) {
      this.initializing.delete(id);
      this.failed.set(id, error);
      
      componentInfo.initializationError = error;
      
      this.logger.error(`Failed to initialize component ${id}: ${error.message}`, error);
      this.emit("component:initialization_failed", { id, error: error.message });
      
      if (this.metrics) {
        this.metrics.recordMetric("component_initialization_failed", 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Initializes all registered components.
   * @returns {Promise<Object>} Initialization results
   */
  async initializeAll() {
    this.logger.info("Initializing all components");
    
    const startTime = Date.now();
    const results = {
      successful: [],
      failed: []
    };
    
    // Get initialization order based on dependencies
    const initOrder = this.getInitializationOrder();
    
    // Initialize components in order
    for (const id of initOrder) {
      try {
        await this.initializeComponent(id);
        results.successful.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }
    
    const duration = Date.now() - startTime;
    this.logger.info(`Component initialization completed in ${duration}ms`);
    this.logger.info(`Successful: ${results.successful.length}, Failed: ${results.failed.length}`);
    
    if (this.metrics) {
      this.metrics.recordMetric("component_initialization_duration", duration);
      this.metrics.recordMetric("component_initialization_success_rate", 
        results.successful.length / (results.successful.length + results.failed.length));
    }
    
    return {
      duration,
      successful: results.successful,
      failed: results.failed,
      totalComponents: this.components.size
    };
  }
  
  /**
   * Gets a component by ID.
   * @param {string} id - Component ID
   * @returns {Object|null} Component instance or null if not found
   */
  getComponent(id) {
    if (!this.components.has(id)) {
      this.logger.warn(`Component ${id} not found`);
      return null;
    }
    
    return this.components.get(id).component;
  }
  
  /**
   * Gets components by type.
   * @param {string} type - Component type
   * @returns {Array<Object>} Component instances
   */
  getComponentsByType(type) {
    if (!this.componentsByType.has(type)) {
      return [];
    }
    
    const componentIds = this.componentsByType.get(type);
    return Array.from(componentIds)
      .filter(id => this.components.has(id))
      .map(id => this.components.get(id).component);
  }
  
  /**
   * Gets components by category.
   * @param {string} category - Component category
   * @returns {Array<Object>} Component instances
   */
  getComponentsByCategory(category) {
    if (!this.componentsByCategory.has(category)) {
      return [];
    }
    
    const componentIds = this.componentsByCategory.get(category);
    return Array.from(componentIds)
      .filter(id => this.components.has(id))
      .map(id => this.components.get(id).component);
  }
  
  /**
   * Gets initialization order based on dependencies.
   * @returns {Array<string>} Component IDs in initialization order
   * @private
   */
  getInitializationOrder() {
    const visited = new Set();
    const order = [];
    
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const dependencies = this.dependencies.get(id) || new Set();
      for (const depId of dependencies) {
        if (this.components.has(depId)) {
          visit(depId);
        }
      }
      
      order.push(id);
    };
    
    // Visit all components
    for (const id of this.components.keys()) {
      visit(id);
    }
    
    return order;
  }
  
  /**
   * Gets component status.
   * @param {string} id - Component ID
   * @returns {Object|null} Component status or null if not found
   */
  getComponentStatus(id) {
    if (!this.components.has(id)) {
      return null;
    }
    
    const componentInfo = this.components.get(id);
    return {
      id,
      type: componentInfo.metadata.type,
      category: componentInfo.metadata.category,
      initialized: componentInfo.initialized,
      initializationTime: componentInfo.initializationTime,
      initializationError: componentInfo.initializationError ? 
        componentInfo.initializationError.message : null,
      dependencies: Array.from(this.dependencies.get(id) || []),
      dependents: Array.from(this.dependents.get(id) || [])
    };
  }
  
  /**
   * Gets status of all components.
   * @returns {Object} Status of all components
   */
  getStatus() {
    const components = Array.from(this.components.keys()).map(id => this.getComponentStatus(id));
    
    const byCategory = {};
    for (const [category, ids] of this.componentsByCategory.entries()) {
      byCategory[category] = {
        total: ids.size,
        initialized: Array.from(ids).filter(id => 
          this.components.has(id) && this.components.get(id).initialized
        ).length
      };
    }
    
    const byType = {};
    for (const [type, ids] of this.componentsByType.entries()) {
      byType[type] = {
        total: ids.size,
        initialized: Array.from(ids).filter(id => 
          this.components.has(id) && this.components.get(id).initialized
        ).length
      };
    }
    
    return {
      totalComponents: this.components.size,
      initializedComponents: this.initialized.size,
      failedComponents: this.failed.size,
      byCategory,
      byType,
      components
    };
  }
  
  /**
   * Registers standard components for the Autonomous Error Recovery System.
   * @param {Object} options - Component instances
   * @returns {Promise<Object>} Registration results
   */
  async registerStandardComponents(options = {}) {
    this.logger.info("Registering standard components");
    
    const results = {
      registered: [],
      failed: []
    };
    
    try {
      // Register neural components
      if (options.neuralHub) {
        this.registerComponent("neuralHub", options.neuralHub, {
          type: "neural",
          category: "legacy",
          dependencies: []
        });
        results.registered.push("neuralHub");
      }
      
      // Register semantic components
      if (options.knowledgeGraph) {
        this.registerComponent("knowledgeGraph", options.knowledgeGraph, {
          type: "semantic",
          category: "legacy",
          dependencies: []
        });
        results.registered.push("knowledgeGraph");
      }
      
      if (options.semanticTranslator) {
        this.registerComponent("semanticTranslator", options.semanticTranslator, {
          type: "semantic",
          category: "legacy",
          dependencies: ["knowledgeGraph"]
        });
        results.registered.push("semanticTranslator");
      }
      
      if (options.semanticProcessor) {
        this.registerComponent("semanticProcessor", options.semanticProcessor, {
          type: "semantic",
          category: "legacy",
          dependencies: ["semanticTranslator"]
        });
        results.registered.push("semanticProcessor");
      }
      
      // Register predictive components
      if (options.bayesianPredictor) {
        this.registerComponent("bayesianPredictor", options.bayesianPredictor, {
          type: "predictive",
          category: "legacy",
          dependencies: []
        });
        results.registered.push("bayesianPredictor");
      }
      
      if (options.predictiveExecutor) {
        this.registerComponent("predictiveExecutor", options.predictiveExecutor, {
          type: "predictive",
          category: "legacy",
          dependencies: ["bayesianPredictor"]
        });
        results.registered.push("predictiveExecutor");
      }
      
      // Register legacy error recovery components
      if (options.causalAnalyzer) {
        this.registerComponent("causalAnalyzer", options.causalAnalyzer, {
          type: "error_recovery",
          category: "legacy",
          dependencies: ["neuralHub", "semanticProcessor"]
        });
        results.registered.push("causalAnalyzer");
      }
      
      if (options.strategyGenerator) {
        this.registerComponent("strategyGenerator", options.strategyGenerator, {
          type: "error_recovery",
          category: "legacy",
          dependencies: ["semanticTranslator", "bayesianPredictor"]
        });
        results.registered.push("strategyGenerator");
      }
      
      if (options.resolutionExecutor) {
        this.registerComponent("resolutionExecutor", options.resolutionExecutor, {
          type: "error_recovery",
          category: "legacy",
          dependencies: ["neuralHub", "semanticProcessor"]
        });
        results.registered.push("resolutionExecutor");
      }
      
      if (options.learningSystem) {
        this.registerComponent("learningSystem", options.learningSystem, {
          type: "error_recovery",
          category: "legacy",
          dependencies: ["bayesianPredictor"]
        });
        results.registered.push("learningSystem");
      }
      
      // Register new architecture components
      if (options.contextManager) {
        this.registerComponent("contextManager", options.contextManager, {
          type: "error_recovery",
          category: "new",
          dependencies: []
        });
        results.registered.push("contextManager");
      }
      
      if (options.strategyPipeline) {
        this.registerComponent("strategyPipeline", options.strategyPipeline, {
          type: "error_recovery",
          category: "new",
          dependencies: [
            "strategyGenerator", 
            "resolutionExecutor", 
            "bayesianPredictor", 
            "neuralHub", 
            "semanticProcessor", 
            "learningSystem"
          ]
        });
        results.registered.push("strategyPipeline");
      }
      
      if (options.errorHandler) {
        this.registerComponent("errorHandler", options.errorHandler, {
          type: "error_recovery",
          category: "new",
          dependencies: ["strategyPipeline", "contextManager", "neuralHub", "semanticProcessor"]
        });
        results.registered.push("errorHandler");
      }
      
      // Register bridge components
      if (options.strategyPipelineBridge) {
        this.registerComponent("strategyPipelineBridge", options.strategyPipelineBridge, {
          type: "bridge",
          category: "bridge",
          dependencies: ["strategyPipeline", "contextManager", "strategyGenerator", "resolutionExecutor"]
        });
        results.registered.push("strategyPipelineBridge");
      }
      
      // Register integration components
      if (options.integrationValidator) {
        this.registerComponent("integrationValidator", options.integrationValidator, {
          type: "validation",
          category: "legacy",
          dependencies: [
            "neuralHub", 
            "semanticProcessor", 
            "predictiveExecutor", 
            "causalAnalyzer", 
            "strategyGenerator", 
            "resolutionExecutor", 
            "learningSystem"
          ],
          autoInitialize: false
        });
        results.registered.push("integrationValidator");
      }
      
      if (options.comprehensiveValidator) {
        this.registerComponent("comprehensiveValidator", options.comprehensiveValidator, {
          type: "validation",
          category: "legacy",
          dependencies: ["integrationValidator"],
          autoInitialize: false
        });
        results.registered.push("comprehensiveValidator");
      }
      
      this.logger.info(`Registered ${results.registered.length} standard components`);
      
      return results;
    } catch (error) {
      this.logger.error(`Failed to register standard components: ${error.message}`, error);
      results.failed.push({ component: "unknown", error: error.message });
      return results;
    }
  }
}

module.exports = ComponentRegistry;
