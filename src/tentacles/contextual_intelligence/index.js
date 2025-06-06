/**
 * @fileoverview Entry point for the Contextual Intelligence Tentacle.
 * Exports all components of the Contextual Intelligence system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const ContextManager = require('./ContextManager');
const ContextHierarchyManager = require('./hierarchy_manager/ContextHierarchyManager');
const CrossDomainContextManager = require('./cross_domain_manager/CrossDomainContextManager');
const TemporalContextManager = require('./temporal_manager/TemporalContextManager');
const ContextPersistenceManager = require('./persistence_manager/ContextPersistenceManager');
const ContextAnalysisEngine = require('./analysis_engine/ContextAnalysisEngine');

// This will be implemented in a future step
let ContextVisualizationTool;

try {
  ContextVisualizationTool = require('./visualization_tool/ContextVisualizationTool');
} catch (error) {
  // Module will be implemented later
  ContextVisualizationTool = class ContextVisualizationToolStub {
    constructor(options = {}) {
      this.options = options;
      this.initialized = false;
    }
    
    async initialize() {
      this.initialized = true;
      return true;
    }
    
    async visualizeContext() { 
      return Promise.resolve(null); 
    }
    
    async shutdown() {
      this.initialized = false;
      return true;
    }
  };
}

/**
 * Contextual Intelligence Tentacle
 * 
 * This tentacle enhances Aideon's ability to understand, maintain, and utilize
 * context across different domains, operations, and time periods.
 */
class ContextualIntelligenceTentacle {
  /**
   * Creates a new ContextualIntelligenceTentacle instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = options;
    this.initialized = false;
    this.initializationPromise = null;
    this.components = {};
  }

  /**
   * Initializes the Contextual Intelligence Tentacle.
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Create shared event emitter
        const EventEmitter = require('events');
        const eventEmitter = new EventEmitter();
        eventEmitter.setMaxListeners(100);

        // Initialize components
        this.components.hierarchyManager = new ContextHierarchyManager({
          eventEmitter,
          ...this.options.hierarchyManager
        });

        this.components.temporalManager = new TemporalContextManager({
          eventEmitter,
          ...this.options.temporalManager
        });

        this.components.crossDomainManager = new CrossDomainContextManager({
          eventEmitter,
          ...this.options.crossDomainManager
        });

        this.components.persistenceManager = new ContextPersistenceManager({
          eventEmitter,
          ...this.options.persistenceManager
        });

        this.components.analysisEngine = new ContextAnalysisEngine({
          eventEmitter,
          ...this.options.analysisEngine
        });

        this.components.visualizationTool = new ContextVisualizationTool({
          eventEmitter,
          ...this.options.visualizationTool
        });

        // Initialize context manager last, as it depends on other components
        this.components.contextManager = new ContextManager({
          eventEmitter,
          hierarchyManager: this.components.hierarchyManager,
          temporalManager: this.components.temporalManager,
          crossDomainManager: this.components.crossDomainManager,
          persistenceManager: this.components.persistenceManager,
          analysisEngine: this.components.analysisEngine,
          visualizationTool: this.components.visualizationTool,
          ...this.options.contextManager
        });

        // Initialize context manager
        await this.components.contextManager.initialize();

        this.initialized = true;
        return true;
      } catch (error) {
        console.error('Failed to initialize Contextual Intelligence Tentacle:', error);
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Gets the Context Manager instance.
   * @returns {ContextManager} - The Context Manager instance
   */
  getContextManager() {
    return this.components.contextManager;
  }

  /**
   * Gets the Context Hierarchy Manager instance.
   * @returns {ContextHierarchyManager} - The Context Hierarchy Manager instance
   */
  getContextHierarchyManager() {
    return this.components.hierarchyManager;
  }

  /**
   * Gets the Temporal Context Manager instance.
   * @returns {TemporalContextManager} - The Temporal Context Manager instance
   */
  getTemporalContextManager() {
    return this.components.temporalManager;
  }

  /**
   * Gets the Cross-Domain Context Manager instance.
   * @returns {CrossDomainContextManager} - The Cross-Domain Context Manager instance
   */
  getCrossDomainContextManager() {
    return this.components.crossDomainManager;
  }

  /**
   * Gets the Context Persistence Manager instance.
   * @returns {ContextPersistenceManager} - The Context Persistence Manager instance
   */
  getContextPersistenceManager() {
    return this.components.persistenceManager;
  }

  /**
   * Gets the Context Analysis Engine instance.
   * @returns {ContextAnalysisEngine} - The Context Analysis Engine instance
   */
  getContextAnalysisEngine() {
    return this.components.analysisEngine;
  }

  /**
   * Gets the Context Visualization Tool instance.
   * @returns {ContextVisualizationTool} - The Context Visualization Tool instance
   */
  getContextVisualizationTool() {
    return this.components.visualizationTool;
  }

  /**
   * Shuts down the Contextual Intelligence Tentacle.
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      return true;
    }

    try {
      // Shut down context manager first
      await this.components.contextManager.shutdown();

      this.initialized = false;
      this.initializationPromise = null;
      return true;
    } catch (error) {
      console.error('Failed to shut down Contextual Intelligence Tentacle:', error);
      return false;
    }
  }
}

// Export all components
module.exports = {
  ContextualIntelligenceTentacle,
  ContextManager,
  ContextHierarchyManager,
  TemporalContextManager,
  CrossDomainContextManager,
  ContextPersistenceManager,
  ContextAnalysisEngine,
  ContextVisualizationTool
};
