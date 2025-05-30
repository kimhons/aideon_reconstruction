/**
 * @fileoverview MCPKnowledgeGraphManagerProvider integrates the KnowledgeGraphManager
 * with the Model Context Protocol (MCP) system.
 * 
 * This provider enables the KnowledgeGraphManager to share context about graph
 * operations, updates, and queries with other tentacles in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPKnowledgeGraphContextProvider } = require('./MCPKnowledgeGraphContextProvider');

/**
 * Provider for integrating KnowledgeGraphManager with MCP.
 */
class MCPKnowledgeGraphManagerProvider extends MCPKnowledgeGraphContextProvider {
  /**
   * Creates a new MCPKnowledgeGraphManagerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.knowledgeGraphManager - KnowledgeGraphManager instance
   * @param {Object} [options.config] - Provider-specific configuration
   */
  constructor(options) {
    super(options);
    
    if (!options || !options.knowledgeGraphManager) {
      throw new Error('MCPKnowledgeGraphManagerProvider requires a valid knowledgeGraphManager');
    }
    
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.contextTypePrefix = 'knowledge.graph';
    
    this.logger.info('MCPKnowledgeGraphManagerProvider created');
  }
  
  /**
   * Sets up event listeners for knowledge graph events.
   * 
   * @private
   */
  setupEventListeners() {
    // Node added event
    this.knowledgeGraphManager.on('nodeAdded', async (event) => {
      try {
        await this.handleNodeAdded(event);
      } catch (error) {
        this.logger.error('Error handling nodeAdded event:', error);
      }
    });
    
    // Node updated event
    this.knowledgeGraphManager.on('nodeUpdated', async (event) => {
      try {
        await this.handleNodeUpdated(event);
      } catch (error) {
        this.logger.error('Error handling nodeUpdated event:', error);
      }
    });
    
    // Node removed event
    this.knowledgeGraphManager.on('nodeRemoved', async (event) => {
      try {
        await this.handleNodeRemoved(event);
      } catch (error) {
        this.logger.error('Error handling nodeRemoved event:', error);
      }
    });
    
    // Edge added event
    this.knowledgeGraphManager.on('edgeAdded', async (event) => {
      try {
        await this.handleEdgeAdded(event);
      } catch (error) {
        this.logger.error('Error handling edgeAdded event:', error);
      }
    });
    
    // Edge updated event
    this.knowledgeGraphManager.on('edgeUpdated', async (event) => {
      try {
        await this.handleEdgeUpdated(event);
      } catch (error) {
        this.logger.error('Error handling edgeUpdated event:', error);
      }
    });
    
    // Edge removed event
    this.knowledgeGraphManager.on('edgeRemoved', async (event) => {
      try {
        await this.handleEdgeRemoved(event);
      } catch (error) {
        this.logger.error('Error handling edgeRemoved event:', error);
      }
    });
    
    // Graph query event
    this.knowledgeGraphManager.on('graphQueried', async (event) => {
      try {
        await this.handleGraphQueried(event);
      } catch (error) {
        this.logger.error('Error handling graphQueried event:', error);
      }
    });
    
    // Inference event
    this.knowledgeGraphManager.on('inferencePerformed', async (event) => {
      try {
        await this.handleInferencePerformed(event);
      } catch (error) {
        this.logger.error('Error handling inferencePerformed event:', error);
      }
    });
    
    this.logger.info('KnowledgeGraphManager event listeners setup complete');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.update.node`,
      `${this.contextTypePrefix}.update.edge`,
      `${this.contextTypePrefix}.query`,
      `${this.contextTypePrefix}.inference`
    ];
  }
  
  /**
   * Handles node added events.
   * 
   * @private
   * @param {Object} event - Node added event
   * @returns {Promise<string>} - Context ID
   */
  async handleNodeAdded(event) {
    const { nodeId, nodeType, properties, confidence } = event;
    
    const contextData = {
      operation: 'add',
      nodeId,
      nodeType,
      properties: this.sanitizeProperties(properties),
      timestamp: Date.now()
    };
    
    // Higher priority for entity nodes vs. attribute nodes
    const priority = this.calculateNodePriority(nodeType, properties);
    
    return this.addKnowledgeContext(
      contextData,
      'update.node',
      priority,
      confidence || 0.9,
      ['node', 'add', nodeType]
    );
  }
  
  /**
   * Handles node updated events.
   * 
   * @private
   * @param {Object} event - Node updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleNodeUpdated(event) {
    const { nodeId, nodeType, properties, changes, confidence } = event;
    
    const contextData = {
      operation: 'update',
      nodeId,
      nodeType,
      properties: this.sanitizeProperties(properties),
      changes: this.sanitizeProperties(changes),
      timestamp: Date.now()
    };
    
    const priority = this.calculateNodePriority(nodeType, properties);
    
    return this.addKnowledgeContext(
      contextData,
      'update.node',
      priority,
      confidence || 0.85,
      ['node', 'update', nodeType]
    );
  }
  
  /**
   * Handles node removed events.
   * 
   * @private
   * @param {Object} event - Node removed event
   * @returns {Promise<string>} - Context ID
   */
  async handleNodeRemoved(event) {
    const { nodeId, nodeType, confidence } = event;
    
    const contextData = {
      operation: 'remove',
      nodeId,
      nodeType,
      timestamp: Date.now()
    };
    
    // Node removal is generally important as it can affect many relationships
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'update.node',
      priority,
      confidence || 0.95,
      ['node', 'remove', nodeType]
    );
  }
  
  /**
   * Handles edge added events.
   * 
   * @private
   * @param {Object} event - Edge added event
   * @returns {Promise<string>} - Context ID
   */
  async handleEdgeAdded(event) {
    const { edgeId, sourceId, targetId, edgeType, properties, confidence } = event;
    
    const contextData = {
      operation: 'add',
      edgeId,
      sourceId,
      targetId,
      edgeType,
      properties: this.sanitizeProperties(properties),
      timestamp: Date.now()
    };
    
    // Calculate priority based on edge type
    const priority = this.calculateEdgePriority(edgeType, properties);
    
    return this.addKnowledgeContext(
      contextData,
      'update.edge',
      priority,
      confidence || 0.9,
      ['edge', 'add', edgeType]
    );
  }
  
  /**
   * Handles edge updated events.
   * 
   * @private
   * @param {Object} event - Edge updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleEdgeUpdated(event) {
    const { edgeId, sourceId, targetId, edgeType, properties, changes, confidence } = event;
    
    const contextData = {
      operation: 'update',
      edgeId,
      sourceId,
      targetId,
      edgeType,
      properties: this.sanitizeProperties(properties),
      changes: this.sanitizeProperties(changes),
      timestamp: Date.now()
    };
    
    const priority = this.calculateEdgePriority(edgeType, properties);
    
    return this.addKnowledgeContext(
      contextData,
      'update.edge',
      priority,
      confidence || 0.85,
      ['edge', 'update', edgeType]
    );
  }
  
  /**
   * Handles edge removed events.
   * 
   * @private
   * @param {Object} event - Edge removed event
   * @returns {Promise<string>} - Context ID
   */
  async handleEdgeRemoved(event) {
    const { edgeId, sourceId, targetId, edgeType, confidence } = event;
    
    const contextData = {
      operation: 'remove',
      edgeId,
      sourceId,
      targetId,
      edgeType,
      timestamp: Date.now()
    };
    
    // Edge removal can be significant for reasoning
    const priority = 6;
    
    return this.addKnowledgeContext(
      contextData,
      'update.edge',
      priority,
      confidence || 0.95,
      ['edge', 'remove', edgeType]
    );
  }
  
  /**
   * Handles graph query events.
   * 
   * @private
   * @param {Object} event - Graph query event
   * @returns {Promise<string>} - Context ID
   */
  async handleGraphQueried(event) {
    const { queryId, queryType, parameters, resultCount, executionTime, confidence } = event;
    
    const contextData = {
      queryId,
      queryType,
      parameters: this.sanitizeProperties(parameters),
      resultCount,
      executionTime,
      timestamp: Date.now()
    };
    
    // Queries are generally lower priority than updates
    const priority = 4;
    
    return this.addKnowledgeContext(
      contextData,
      'query',
      priority,
      confidence || 0.8,
      ['query', queryType]
    );
  }
  
  /**
   * Handles inference performed events.
   * 
   * @private
   * @param {Object} event - Inference performed event
   * @returns {Promise<string>} - Context ID
   */
  async handleInferencePerformed(event) {
    const { inferenceId, inferenceType, inputs, results, confidence } = event;
    
    const contextData = {
      inferenceId,
      inferenceType,
      inputs: this.sanitizeProperties(inputs),
      resultCount: results ? results.length : 0,
      timestamp: Date.now()
    };
    
    // Inferences are high priority as they represent derived knowledge
    const priority = 8;
    
    return this.addKnowledgeContext(
      contextData,
      'inference',
      priority,
      confidence || 0.75,
      ['inference', inferenceType]
    );
  }
  
  /**
   * Calculates priority for node operations based on node type and properties.
   * 
   * @private
   * @param {string} nodeType - Type of the node
   * @param {Object} properties - Node properties
   * @returns {number} - Priority value (1-10)
   */
  calculateNodePriority(nodeType, properties) {
    // Entity nodes are generally more important than attribute nodes
    if (nodeType.includes('entity') || nodeType.includes('concept')) {
      return 7;
    }
    
    // Nodes with many properties might be more significant
    if (properties && Object.keys(properties).length > 5) {
      return 6;
    }
    
    return 5; // Default priority
  }
  
  /**
   * Calculates priority for edge operations based on edge type and properties.
   * 
   * @private
   * @param {string} edgeType - Type of the edge
   * @param {Object} properties - Edge properties
   * @returns {number} - Priority value (1-10)
   */
  calculateEdgePriority(edgeType, properties) {
    // Causal relationships are often more important
    if (edgeType.includes('causes') || edgeType.includes('results_in')) {
      return 7;
    }
    
    // Hierarchical relationships provide structure
    if (edgeType.includes('is_a') || edgeType.includes('part_of')) {
      return 6;
    }
    
    return 5; // Default priority
  }
  
  /**
   * Sanitizes properties to ensure they are suitable for context storage.
   * 
   * @private
   * @param {Object} properties - Properties to sanitize
   * @returns {Object} - Sanitized properties
   */
  sanitizeProperties(properties) {
    if (!properties) {
      return {};
    }
    
    // Create a shallow copy to avoid modifying the original
    const sanitized = { ...properties };
    
    // Remove any functions or circular references
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      
      // Remove functions
      if (typeof value === 'function') {
        delete sanitized[key];
      }
      // Handle potential circular references
      else if (typeof value === 'object' && value !== null) {
        try {
          // Test if it can be serialized
          JSON.stringify(value);
        } catch (error) {
          // If serialization fails, replace with a simple representation
          sanitized[key] = `[Complex Object: ${typeof value}]`;
        }
      }
    });
    
    return sanitized;
  }
}

module.exports = { MCPKnowledgeGraphManagerProvider };
