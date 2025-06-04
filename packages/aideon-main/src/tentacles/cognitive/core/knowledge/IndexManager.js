/**
 * @fileoverview IndexManager for the Knowledge Graph Manager.
 * Manages indexes for efficient graph queries.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');

/**
 * Manages indexes for efficient graph queries.
 */
class IndexManager extends EventEmitter {
  /**
   * Creates a new IndexManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.performanceMonitor] - Performance monitor
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    
    this.indexes = new Map();
    this.vectorIndexes = new Map();
    this.temporalIndexes = new Map();
    this.spatialIndexes = new Map();
    this.fullTextIndexes = new Map();
    
    this.initialized = false;
  }
  
  /**
   * Initializes the index manager.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing IndexManager');
    }
    
    // Load configuration if available
    if (this.configService) {
      const config = this.configService.get('cognitive.knowledge.indexing', {
        maxIndexes: 100,
        defaultIndexTypes: ['property', 'vector', 'temporal'],
        vectorDimensions: 768,
        vectorDistanceMetric: 'cosine',
        enableFullTextIndexing: true,
        defaultLanguage: 'en'
      });
      
      this.config = config;
    } else {
      this.config = {
        maxIndexes: 100,
        defaultIndexTypes: ['property', 'vector', 'temporal'],
        vectorDimensions: 768,
        vectorDistanceMetric: 'cosine',
        enableFullTextIndexing: true,
        defaultLanguage: 'en'
      };
    }
    
    this.initialized = true;
    
    if (this.logger) {
      this.logger.info('IndexManager initialized');
    }
    
    this.emit('initialized');
  }
  
  /**
   * Creates a new index.
   * 
   * @param {string} indexName - Name of the index
   * @param {string} indexType - Type of index ('property', 'composite')
   * @param {Array<string>} properties - Properties to index
   * @returns {Promise<boolean>} - Success status
   */
  async createIndex(indexName, indexType, properties) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.indexes.has(indexName)) {
      if (this.logger) {
        this.logger.warn(`Index ${indexName} already exists`);
      }
      return false;
    }
    
    if (this.indexes.size >= this.config.maxIndexes) {
      if (this.logger) {
        this.logger.error(`Maximum number of indexes (${this.config.maxIndexes}) reached`);
      }
      throw new Error(`Maximum number of indexes (${this.config.maxIndexes}) reached`);
    }
    
    const index = {
      name: indexName,
      type: indexType,
      properties: Array.isArray(properties) ? [...properties] : [properties],
      created: Date.now(),
      entries: new Map()
    };
    
    this.indexes.set(indexName, index);
    
    if (this.logger) {
      this.logger.debug(`Created ${indexType} index: ${indexName}`);
    }
    
    this.emit('indexCreated', { name: indexName, type: indexType });
    
    return true;
  }
  
  /**
   * Indexes a node in all applicable indexes.
   * 
   * @param {string} nodeId - ID of the node to index
   * @param {Object} nodeData - Node data to index
   * @returns {Promise<boolean>} - Success status
   */
  async indexNode(nodeId, nodeData) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!nodeId || !nodeData) {
      if (this.logger) {
        this.logger.warn('Cannot index node: missing nodeId or nodeData');
      }
      return false;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('indexNode');
    }
    
    try {
      // Index in property indexes
      for (const [indexName, index] of this.indexes.entries()) {
        const indexEntry = {
          properties: new Map(),
          data: nodeData
        };
        
        // Extract indexed properties
        for (const property of index.properties) {
          if (nodeData.properties && nodeData.properties[property] !== undefined) {
            indexEntry.properties.set(property, nodeData.properties[property]);
          }
        }
        
        // Only add to index if at least one indexed property exists
        if (indexEntry.properties.size > 0) {
          index.entries.set(nodeId, indexEntry);
        }
      }
      
      // Index in vector indexes if embeddings are available
      if (nodeData.embeddings) {
        for (const [embeddingType, embedding] of Object.entries(nodeData.embeddings)) {
          if (this.vectorIndexes.has(embeddingType) && Array.isArray(embedding)) {
            const vectorIndex = this.vectorIndexes.get(embeddingType);
            vectorIndex.vectors.set(nodeId, embedding);
            vectorIndex.metadata.set(nodeId, nodeData);
          }
        }
      }
      
      // Index in temporal indexes
      for (const [indexName, index] of this.temporalIndexes.entries()) {
        const temporalField = index.temporalField;
        let timestamp;
        
        // Extract timestamp from node data
        if (temporalField === 'createdAt' && nodeData.createdAt) {
          timestamp = nodeData.createdAt;
        } else if (temporalField === 'updatedAt' && nodeData.updatedAt) {
          timestamp = nodeData.updatedAt;
        } else if (nodeData.metadata && nodeData.metadata[temporalField]) {
          timestamp = nodeData.metadata[temporalField];
        } else if (nodeData.properties && nodeData.properties[temporalField]) {
          timestamp = nodeData.properties[temporalField];
        }
        
        if (timestamp) {
          // Add to time point index
          if (!index.timePoints.has(timestamp)) {
            index.timePoints.set(timestamp, new Set());
          }
          index.timePoints.get(timestamp).add(nodeId);
          
          // Add to entity index
          if (!index.entities.has(nodeId)) {
            index.entities.set(nodeId, new Set());
          }
          index.entities.get(nodeId).add(timestamp);
        }
      }
      
      // Index in full-text indexes
      if (this.config.enableFullTextIndexing) {
        for (const [indexName, index] of this.fullTextIndexes.entries()) {
          const textFields = index.textFields;
          const terms = new Set();
          
          // Extract text from node data
          for (const field of textFields) {
            let text;
            if (nodeData.properties && nodeData.properties[field]) {
              text = nodeData.properties[field];
            } else if (nodeData.metadata && nodeData.metadata[field]) {
              text = nodeData.metadata[field];
            }
            
            if (text && typeof text === 'string') {
              // Simple tokenization and normalization
              const tokens = text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(token => token.length > 2);
              
              for (const token of tokens) {
                terms.add(token);
              }
            }
          }
          
          // Add to term index
          for (const term of terms) {
            if (!index.terms.has(term)) {
              index.terms.set(term, new Set());
            }
            index.terms.get(term).add(nodeId);
          }
          
          // Add to entity index
          if (terms.size > 0) {
            index.entities.set(nodeId, terms);
          }
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Indexed node ${nodeId}`);
      }
      
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to index node ${nodeId}`, { error: error.message, stack: error.stack });
      }
      return false;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Removes a node from all indexes.
   * 
   * @param {string} nodeId - ID of the node to remove from indexes
   * @returns {Promise<boolean>} - Success status
   */
  async removeNodeFromIndex(nodeId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!nodeId) {
      if (this.logger) {
        this.logger.warn('Cannot remove node from index: missing nodeId');
      }
      return false;
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('removeNodeFromIndex');
    }
    
    try {
      // Remove from property indexes
      for (const index of this.indexes.values()) {
        index.entries.delete(nodeId);
      }
      
      // Remove from vector indexes
      for (const index of this.vectorIndexes.values()) {
        index.vectors.delete(nodeId);
        index.metadata.delete(nodeId);
      }
      
      // Remove from temporal indexes
      for (const index of this.temporalIndexes.values()) {
        if (index.entities.has(nodeId)) {
          const timestamps = index.entities.get(nodeId);
          for (const timestamp of timestamps) {
            if (index.timePoints.has(timestamp)) {
              index.timePoints.get(timestamp).delete(nodeId);
              if (index.timePoints.get(timestamp).size === 0) {
                index.timePoints.delete(timestamp);
              }
            }
          }
          index.entities.delete(nodeId);
        }
      }
      
      // Remove from full-text indexes
      for (const index of this.fullTextIndexes.values()) {
        if (index.entities.has(nodeId)) {
          const terms = index.entities.get(nodeId);
          for (const term of terms) {
            if (index.terms.has(term)) {
              index.terms.get(term).delete(nodeId);
              if (index.terms.get(term).size === 0) {
                index.terms.delete(term);
              }
            }
          }
          index.entities.delete(nodeId);
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Removed node ${nodeId} from all indexes`);
      }
      
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to remove node ${nodeId} from indexes`, { error: error.message, stack: error.stack });
      }
      return false;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Updates indexes for a node.
   * 
   * @param {string} nodeId - ID of the node to update
   * @param {Object} nodeData - Updated node data
   * @returns {Promise<boolean>} - Success status
   */
  async updateNodeIndex(nodeId, nodeData) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!nodeId || !nodeData) {
      if (this.logger) {
        this.logger.warn('Cannot update node index: missing nodeId or nodeData');
      }
      return false;
    }
    
    // Remove existing index entries
    await this.removeNodeFromIndex(nodeId);
    
    // Create new index entries
    return await this.indexNode(nodeId, nodeData);
  }
}

module.exports = { IndexManager };
