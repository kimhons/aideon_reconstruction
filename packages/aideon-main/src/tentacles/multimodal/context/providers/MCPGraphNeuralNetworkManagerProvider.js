/**
 * @fileoverview MCPGraphNeuralNetworkManagerProvider integrates the GraphNeuralNetworkManager
 * with the Model Context Protocol (MCP) system.
 * 
 * This provider enables the GraphNeuralNetworkManager to share context about graph embeddings,
 * neural network operations on knowledge graphs, and learned graph representations with
 * other tentacles in the Aideon system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { MCPKnowledgeGraphContextProvider } = require('./MCPKnowledgeGraphContextProvider');

/**
 * Provider for integrating GraphNeuralNetworkManager with MCP.
 */
class MCPGraphNeuralNetworkManagerProvider extends MCPKnowledgeGraphContextProvider {
  /**
   * Creates a new MCPGraphNeuralNetworkManagerProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.contextManager - MCP Context Manager instance
   * @param {Object} options.graphNeuralNetworkManager - GraphNeuralNetworkManager instance
   * @param {Object} [options.config] - Provider-specific configuration
   */
  constructor(options) {
    super(options);
    
    if (!options || !options.graphNeuralNetworkManager) {
      throw new Error('MCPGraphNeuralNetworkManagerProvider requires a valid graphNeuralNetworkManager');
    }
    
    this.graphNeuralNetworkManager = options.graphNeuralNetworkManager;
    this.contextTypePrefix = 'knowledge.gnn';
    
    this.logger.info('MCPGraphNeuralNetworkManagerProvider created');
  }
  
  /**
   * Sets up event listeners for graph neural network manager events.
   * 
   * @private
   */
  setupEventListeners() {
    // Embedding generated event
    this.graphNeuralNetworkManager.on('embeddingGenerated', async (event) => {
      try {
        await this.handleEmbeddingGenerated(event);
      } catch (error) {
        this.logger.error('Error handling embeddingGenerated event:', error);
      }
    });
    
    // Model trained event
    this.graphNeuralNetworkManager.on('modelTrained', async (event) => {
      try {
        await this.handleModelTrained(event);
      } catch (error) {
        this.logger.error('Error handling modelTrained event:', error);
      }
    });
    
    // Prediction made event
    this.graphNeuralNetworkManager.on('predictionMade', async (event) => {
      try {
        await this.handlePredictionMade(event);
      } catch (error) {
        this.logger.error('Error handling predictionMade event:', error);
      }
    });
    
    // Node classification event
    this.graphNeuralNetworkManager.on('nodeClassified', async (event) => {
      try {
        await this.handleNodeClassified(event);
      } catch (error) {
        this.logger.error('Error handling nodeClassified event:', error);
      }
    });
    
    // Link prediction event
    this.graphNeuralNetworkManager.on('linkPredicted', async (event) => {
      try {
        await this.handleLinkPredicted(event);
      } catch (error) {
        this.logger.error('Error handling linkPredicted event:', error);
      }
    });
    
    // Graph clustering event
    this.graphNeuralNetworkManager.on('graphClustered', async (event) => {
      try {
        await this.handleGraphClustered(event);
      } catch (error) {
        this.logger.error('Error handling graphClustered event:', error);
      }
    });
    
    this.logger.info('GraphNeuralNetworkManager event listeners setup complete');
  }
  
  /**
   * Gets the list of context types supported by this provider.
   * 
   * @returns {string[]} - Array of supported context types
   */
  getSupportedContextTypes() {
    return [
      `${this.contextTypePrefix}.embedding`,
      `${this.contextTypePrefix}.model`,
      `${this.contextTypePrefix}.prediction`
    ];
  }
  
  /**
   * Handles embedding generated events.
   * 
   * @private
   * @param {Object} event - Embedding generated event
   * @returns {Promise<string>} - Context ID
   */
  async handleEmbeddingGenerated(event) {
    const { embeddingId, entityId, entityType, dimensions, algorithm, metadata, confidence } = event;
    
    const contextData = {
      operation: 'generate',
      embeddingId,
      entityId,
      entityType,
      dimensions,
      algorithm,
      metadata: this.sanitizeProperties(metadata),
      timestamp: Date.now()
    };
    
    // Embeddings are moderately important
    const priority = 6;
    
    return this.addKnowledgeContext(
      contextData,
      'embedding',
      priority,
      confidence || 0.9,
      ['embedding', algorithm, entityType]
    );
  }
  
  /**
   * Handles model trained events.
   * 
   * @private
   * @param {Object} event - Model trained event
   * @returns {Promise<string>} - Context ID
   */
  async handleModelTrained(event) {
    const { modelId, modelType, parameters, metrics, trainingTime, entityCount, confidence } = event;
    
    const contextData = {
      operation: 'train',
      modelId,
      modelType,
      parameters: this.sanitizeProperties(parameters),
      metrics: this.sanitizeProperties(metrics),
      trainingTime,
      entityCount,
      timestamp: Date.now()
    };
    
    // Model training is significant
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'model',
      priority,
      confidence || 0.9,
      ['model', 'train', modelType]
    );
  }
  
  /**
   * Handles prediction made events.
   * 
   * @private
   * @param {Object} event - Prediction made event
   * @returns {Promise<string>} - Context ID
   */
  async handlePredictionMade(event) {
    const { predictionId, modelId, entityIds, predictionType, confidence } = event;
    
    const contextData = {
      operation: 'predict',
      predictionId,
      modelId,
      entityCount: entityIds.length,
      entityTypes: this.summarizeEntityTypes(entityIds),
      predictionType,
      timestamp: Date.now()
    };
    
    // Predictions are moderately important
    const priority = 6;
    
    return this.addKnowledgeContext(
      contextData,
      'prediction',
      priority,
      confidence || 0.85,
      ['prediction', predictionType]
    );
  }
  
  /**
   * Handles node classification events.
   * 
   * @private
   * @param {Object} event - Node classification event
   * @returns {Promise<string>} - Context ID
   */
  async handleNodeClassified(event) {
    const { nodeId, nodeType, classificationId, labels, scores, modelId, confidence } = event;
    
    const contextData = {
      operation: 'classify',
      nodeId,
      nodeType,
      classificationId,
      labels: this.sanitizeProperties(labels),
      scores: this.sanitizeProperties(scores),
      modelId,
      timestamp: Date.now()
    };
    
    // Node classification is important for knowledge organization
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'prediction',
      priority,
      confidence || 0.85,
      ['classification', 'node', nodeType]
    );
  }
  
  /**
   * Handles link prediction events.
   * 
   * @private
   * @param {Object} event - Link prediction event
   * @returns {Promise<string>} - Context ID
   */
  async handleLinkPredicted(event) {
    const { sourceId, targetId, predictionId, relationTypes, scores, modelId, confidence } = event;
    
    const contextData = {
      operation: 'predict_link',
      sourceId,
      targetId,
      predictionId,
      relationTypes: this.sanitizeProperties(relationTypes),
      scores: this.sanitizeProperties(scores),
      modelId,
      timestamp: Date.now()
    };
    
    // Link prediction is important for knowledge completion
    const priority = 7;
    
    return this.addKnowledgeContext(
      contextData,
      'prediction',
      priority,
      confidence || 0.8,
      ['prediction', 'link']
    );
  }
  
  /**
   * Handles graph clustering events.
   * 
   * @private
   * @param {Object} event - Graph clustering event
   * @returns {Promise<string>} - Context ID
   */
  async handleGraphClustered(event) {
    const { clusteringId, algorithm, clusterCount, nodeCount, metrics, modelId, confidence } = event;
    
    const contextData = {
      operation: 'cluster',
      clusteringId,
      algorithm,
      clusterCount,
      nodeCount,
      metrics: this.sanitizeProperties(metrics),
      modelId,
      timestamp: Date.now()
    };
    
    // Clustering provides important structural insights
    const priority = 6;
    
    return this.addKnowledgeContext(
      contextData,
      'model',
      priority,
      confidence || 0.85,
      ['clustering', algorithm]
    );
  }
  
  /**
   * Summarizes entity types from a list of entity IDs.
   * 
   * @private
   * @param {string[]} entityIds - List of entity IDs
   * @returns {Object} - Summary of entity types and counts
   */
  summarizeEntityTypes(entityIds) {
    if (!entityIds || !Array.isArray(entityIds)) {
      return {};
    }
    
    // In a real implementation, this would query the knowledge graph
    // to get entity types. For now, we'll extract type from ID format
    // assuming IDs follow a pattern like "type:id" (e.g., "person:123")
    const typeCounts = {};
    
    entityIds.forEach(id => {
      const parts = id.split(':');
      if (parts.length > 1) {
        const type = parts[0];
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      } else {
        typeCounts['unknown'] = (typeCounts['unknown'] || 0) + 1;
      }
    });
    
    return typeCounts;
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

module.exports = { MCPGraphNeuralNetworkManagerProvider };
