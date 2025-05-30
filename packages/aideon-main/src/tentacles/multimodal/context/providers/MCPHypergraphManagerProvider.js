/**
 * @fileoverview MCPHypergraphManagerProvider integrates the HypergraphManager
 * with the Model Context Protocol (MCP) system.
 * 
 * This provider enables the HypergraphManager to share context about hypergraph
 * operations, complex relationships, and multi-entity connections with other
 * tentacles in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPKnowledgeGraphContextProvider } = require('./MCPKnowledgeGraphContextProvider');

/**
 * Provider for integrating HypergraphManager with MCP.
 */
class MCPHypergraphManagerProvider extends MCPKnowledgeGraphContextProvider {
  /**
   * Creates a new MCPHypergraphManagerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.hypergraphManager - HypergraphManager instance
   * @param {Object} [options.config] - Provider-specific configuration
   */
  constructor(options) {
    super(options);
    
    if (!options || !options.hypergraphManager) {
      throw new Error('MCPHypergraphManagerProvider requires a valid hypergraphManager');
    }
    
    this.hypergraphManager = options.hypergraphManager;
    this.contextTypePrefix = 'knowledge.hypergraph';
    
    this.logger.info('MCPHypergraphManagerProvider created');
  }
  
  /**
   * Sets up event listeners for hypergraph events.
   * 
   * @private
   */
  setupEventListeners() {
    // Hyperedge added event
    this.hypergraphManager.on('hyperedgeAdded', async (event) => {
      try {
        await this.handleHyperedgeAdded(event);
      } catch (error) {
        this.logger.error('Error handling hyperedgeAdded event:', error);
      }
    });
    
    // Hyperedge updated event
    this.hypergraphManager.on('hyperedgeUpdated', async (event) => {
      try {
        await this.handleHyperedgeUpdated(event);
      } catch (error) {
        this.logger.error('Error handling hyperedgeUpdated event:', error);
      }
    });
    
    // Hyperedge removed event
    this.hypergraphManager.on('hyperedgeRemoved', async (event) => {
      try {
        await this.handleHyperedgeRemoved(event);
      } catch (error) {
        this.logger.error('Error handling hyperedgeRemoved event:', error);
      }
    });
    
    // Complex relation added event
    this.hypergraphManager.on('complexRelationAdded', async (event) => {
      try {
        await this.handleComplexRelationAdded(event);
      } catch (error) {
        this.logger.error('Error handling complexRelationAdded event:', error);
      }
    });
    
    // Complex relation updated event
    this.hypergraphManager.on('complexRelationUpdated', async (event) => {
      try {
        await this.handleComplexRelationUpdated(event);
      } catch (error) {
        this.logger.error('Error handling complexRelationUpdated event:', error);
      }
    });
    
    // Complex relation removed event
    this.hypergraphManager.on('complexRelationRemoved', async (event) => {
      try {
        await this.handleComplexRelationRemoved(event);
      } catch (error) {
        this.logger.error('Error handling complexRelationRemoved event:', error);
      }
    });
    
    // Hypergraph query event
    this.hypergraphManager.on('hypergraphQueried', async (event) => {
      try {
        await this.handleHypergraphQueried(event);
      } catch (error) {
        this.logger.error('Error handling hypergraphQueried event:', error);
      }
    });
    
    this.logger.info('HypergraphManager event listeners setup complete');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.relation`,
      `${this.contextTypePrefix}.query`
    ];
  }
  
  /**
   * Handles hyperedge added events.
   * 
   * @private
   * @param {Object} event - Hyperedge added event
   * @returns {Promise<string>} - Context ID
   */
  async handleHyperedgeAdded(event) {
    const { hyperedgeId, nodeIds, type, properties, confidence } = event;
    
    const contextData = {
      operation: 'add',
      hyperedgeId,
      nodeIds,
      type,
      properties: this.sanitizeProperties(properties),
      nodeCount: nodeIds.length,
      timestamp: Date.now()
    };
    
    // Higher priority for hyperedges with more nodes (more complex relationships)
    const priority = this.calculateHyperedgePriority(nodeIds.length, type);
    
    return this.addKnowledgeContext(
      contextData,
      'relation',
      priority,
      confidence || 0.9,
      ['hyperedge', 'add', type]
    );
  }
  
  /**
   * Handles hyperedge updated events.
   * 
   * @private
   * @param {Object} event - Hyperedge updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleHyperedgeUpdated(event) {
    const { hyperedgeId, nodeIds, type, properties, changes, confidence } = event;
    
    const contextData = {
      operation: 'update',
      hyperedgeId,
      nodeIds,
      type,
      properties: this.sanitizeProperties(properties),
      changes: this.sanitizeProperties(changes),
      nodeCount: nodeIds.length,
      timestamp: Date.now()
    };
    
    const priority = this.calculateHyperedgePriority(nodeIds.length, type);
    
    return this.addKnowledgeContext(
      contextData,
      'relation',
      priority,
      confidence || 0.85,
      ['hyperedge', 'update', type]
    );
  }
  
  /**
   * Handles hyperedge removed events.
   * 
   * @private
   * @param {Object} event - Hyperedge removed event
   * @returns {Promise<string>} - Context ID
   */
  async handleHyperedgeRemoved(event) {
    const { hyperedgeId, nodeIds, type, confidence } = event;
    
    const contextData = {
      operation: 'remove',
      hyperedgeId,
      nodeIds,
      type,
      nodeCount: nodeIds ? nodeIds.length : 0,
      timestamp: Date.now()
    };
    
    // Removal of complex relationships can be significant
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'relation',
      priority,
      confidence || 0.95,
      ['hyperedge', 'remove', type]
    );
  }
  
  /**
   * Handles complex relation added events.
   * 
   * @private
   * @param {Object} event - Complex relation added event
   * @returns {Promise<string>} - Context ID
   */
  async handleComplexRelationAdded(event) {
    const { relationId, entities, relationType, attributes, confidence } = event;
    
    const contextData = {
      operation: 'add',
      relationId,
      entities,
      relationType,
      attributes: this.sanitizeProperties(attributes),
      entityCount: entities.length,
      timestamp: Date.now()
    };
    
    // Complex relations are typically high priority
    const priority = this.calculateComplexRelationPriority(entities.length, relationType);
    
    return this.addKnowledgeContext(
      contextData,
      'relation',
      priority,
      confidence || 0.9,
      ['complex', 'add', relationType]
    );
  }
  
  /**
   * Handles complex relation updated events.
   * 
   * @private
   * @param {Object} event - Complex relation updated event
   * @returns {Promise<string>} - Context ID
   */
  async handleComplexRelationUpdated(event) {
    const { relationId, entities, relationType, attributes, changes, confidence } = event;
    
    const contextData = {
      operation: 'update',
      relationId,
      entities,
      relationType,
      attributes: this.sanitizeProperties(attributes),
      changes: this.sanitizeProperties(changes),
      entityCount: entities.length,
      timestamp: Date.now()
    };
    
    const priority = this.calculateComplexRelationPriority(entities.length, relationType);
    
    return this.addKnowledgeContext(
      contextData,
      'relation',
      priority,
      confidence || 0.85,
      ['complex', 'update', relationType]
    );
  }
  
  /**
   * Handles complex relation removed events.
   * 
   * @private
   * @param {Object} event - Complex relation removed event
   * @returns {Promise<string>} - Context ID
   */
  async handleComplexRelationRemoved(event) {
    const { relationId, entities, relationType, confidence } = event;
    
    const contextData = {
      operation: 'remove',
      relationId,
      entities,
      relationType,
      entityCount: entities ? entities.length : 0,
      timestamp: Date.now()
    };
    
    // Removal of complex relations is significant
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'relation',
      priority,
      confidence || 0.95,
      ['complex', 'remove', relationType]
    );
  }
  
  /**
   * Handles hypergraph query events.
   * 
   * @private
   * @param {Object} event - Hypergraph query event
   * @returns {Promise<string>} - Context ID
   */
  async handleHypergraphQueried(event) {
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
   * Calculates priority for hyperedge operations based on node count and type.
   * 
   * @private
   * @param {number} nodeCount - Number of nodes in the hyperedge
   * @param {string} type - Type of the hyperedge
   * @returns {number} - Priority value (1-10)
   */
  calculateHyperedgePriority(nodeCount, type) {
    // More nodes generally means more complex and important relationships
    if (nodeCount > 5) {
      return 8;
    } else if (nodeCount > 3) {
      return 7;
    }
    
    // Certain types of hyperedges may be more significant
    if (type.includes('causal') || type.includes('temporal')) {
      return 7;
    }
    
    return 6; // Default priority for hyperedges
  }
  
  /**
   * Calculates priority for complex relation operations based on entity count and type.
   * 
   * @private
   * @param {number} entityCount - Number of entities in the relation
   * @param {string} relationType - Type of the relation
   * @returns {number} - Priority value (1-10)
   */
  calculateComplexRelationPriority(entityCount, relationType) {
    // More entities generally means more complex and important relationships
    if (entityCount > 5) {
      return 8;
    } else if (entityCount > 3) {
      return 7;
    }
    
    // Certain types of relations may be more significant
    if (relationType.includes('causal_network') || relationType.includes('event_chain')) {
      return 8;
    }
    
    return 6; // Default priority for complex relations
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

module.exports = { MCPHypergraphManagerProvider };
