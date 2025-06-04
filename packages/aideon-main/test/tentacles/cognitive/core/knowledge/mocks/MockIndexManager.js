/**
 * @fileoverview Mock implementation of IndexManager for testing purposes.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Mock implementation of IndexManager for testing purposes.
 */
class MockIndexManager {
  /**
   * Creates a new MockIndexManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    
    // In-memory storage for indexes
    this.indexes = new Map();
    this.initialized = false;
    
    // Create a no-op logger if none provided
    if (!this.logger) {
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
      };
    }
  }
  
  /**
   * Initializes the index manager.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info("Initializing MockIndexManager");
    this.initialized = true;
    return Promise.resolve();
  }
  
  /**
   * Creates an index for a specific property.
   * 
   * @param {string} indexName - Name of the index
   * @param {string} propertyPath - Path to the property to index
   * @param {Object} options - Index options
   * @returns {Promise<boolean>} - True if successful
   */
  async createIndex(indexName, propertyPath, options = {}) {
    this._checkInitialized();
    
    this.indexes.set(indexName, {
      propertyPath,
      options,
      entries: new Map()
    });
    
    return Promise.resolve(true);
  }
  
  /**
   * Updates an index.
   * 
   * @param {string} indexName - Name of the index
   * @param {Object} options - Update options
   * @returns {Promise<boolean>} - True if successful
   */
  async updateIndex(indexName, options = {}) {
    this._checkInitialized();
    
    if (!this.indexes.has(indexName)) {
      return Promise.resolve(false);
    }
    
    const index = this.indexes.get(indexName);
    index.options = { ...index.options, ...options };
    
    return Promise.resolve(true);
  }
  
  /**
   * Searches an index.
   * 
   * @param {string} indexName - Name of the index
   * @param {*} value - Value to search for
   * @param {Object} options - Search options
   * @returns {Promise<Array<string>>} - Array of matching entity IDs
   */
  async searchIndex(indexName, value, options = {}) {
    this._checkInitialized();
    
    if (!this.indexes.has(indexName)) {
      return Promise.resolve([]);
    }
    
    const index = this.indexes.get(indexName);
    const results = [];
    
    for (const [entityId, indexedValue] of index.entries) {
      if (indexedValue === value) {
        results.push(entityId);
      }
    }
    
    return Promise.resolve(results);
  }
  
  /**
   * Deletes an entity from an index.
   * 
   * @param {string} indexName - Name of the index
   * @param {string} entityId - ID of the entity to delete
   * @returns {Promise<boolean>} - True if successful
   */
  async deleteFromIndex(indexName, entityId) {
    this._checkInitialized();
    
    if (!this.indexes.has(indexName)) {
      return Promise.resolve(false);
    }
    
    const index = this.indexes.get(indexName);
    const deleted = index.entries.delete(entityId);
    
    return Promise.resolve(deleted);
  }
  
  /**
   * Indexes a node.
   * 
   * @param {string} nodeId - ID of the node to index
   * @param {string} type - Type of the node
   * @param {Object} properties - Node properties
   * @returns {Promise<void>}
   */
  async indexNode(nodeId, type, properties) {
    this._checkInitialized();
    
    // Create type-based index if it doesn't exist
    const typeIndexName = `type_${type}`;
    if (!this.indexes.has(typeIndexName)) {
      await this.createIndex(typeIndexName, "type");
    }
    
    // Add node to type index
    const typeIndex = this.indexes.get(typeIndexName);
    typeIndex.entries.set(nodeId, type);
    
    // Index each property
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const propIndexName = `prop_${key}`;
        
        if (!this.indexes.has(propIndexName)) {
          await this.createIndex(propIndexName, `properties.${key}`);
        }
        
        const propIndex = this.indexes.get(propIndexName);
        propIndex.entries.set(nodeId, value);
      }
    }
    
    return Promise.resolve();
  }
  
  /**
   * Updates indexes for a node.
   * 
   * @param {string} nodeId - ID of the node to update
   * @param {string} type - Type of the node
   * @param {Object} properties - Updated node properties
   * @returns {Promise<void>}
   */
  async updateNodeIndex(nodeId, type, properties) {
    this._checkInitialized();
    
    // Remove existing property indexes for this node
    for (const index of this.indexes.values()) {
      index.entries.delete(nodeId);
    }
    
    // Re-index the node
    await this.indexNode(nodeId, type, properties);
    
    return Promise.resolve();
  }
  
  /**
   * Removes a node from all indexes.
   * 
   * @param {string} nodeId - ID of the node to remove
   * @returns {Promise<void>}
   */
  async removeNodeFromIndex(nodeId) {
    this._checkInitialized();
    
    // Remove from all indexes
    for (const index of this.indexes.values()) {
      index.entries.delete(nodeId);
    }
    
    return Promise.resolve();
  }
  
  /**
   * Indexes an edge.
   * 
   * @param {string} edgeId - ID of the edge to index
   * @param {string} sourceId - ID of the source node
   * @param {string} targetId - ID of the target node
   * @param {string} type - Type of the edge
   * @param {Object} properties - Edge properties
   * @returns {Promise<void>}
   */
  async indexEdge(edgeId, sourceId, targetId, type, properties) {
    this._checkInitialized();
    
    // Create source node index if it doesn't exist
    const sourceIndexName = "edge_source";
    if (!this.indexes.has(sourceIndexName)) {
      await this.createIndex(sourceIndexName, "sourceId");
    }
    
    // Add edge to source index
    const sourceIndex = this.indexes.get(sourceIndexName);
    sourceIndex.entries.set(edgeId, sourceId);
    
    // Create target node index if it doesn't exist
    const targetIndexName = "edge_target";
    if (!this.indexes.has(targetIndexName)) {
      await this.createIndex(targetIndexName, "targetId");
    }
    
    // Add edge to target index
    const targetIndex = this.indexes.get(targetIndexName);
    targetIndex.entries.set(edgeId, targetId);
    
    // Create type-based index if it doesn't exist
    const typeIndexName = `edge_type_${type}`;
    if (!this.indexes.has(typeIndexName)) {
      await this.createIndex(typeIndexName, "type");
    }
    
    // Add edge to type index
    const typeIndex = this.indexes.get(typeIndexName);
    typeIndex.entries.set(edgeId, type);
    
    return Promise.resolve();
  }
  
  /**
   * Updates indexes for an edge.
   * 
   * @param {string} edgeId - ID of the edge to update
   * @param {string} sourceId - ID of the source node
   * @param {string} targetId - ID of the target node
   * @param {string} type - Type of the edge
   * @param {Object} properties - Updated edge properties
   * @returns {Promise<void>}
   */
  async updateEdgeIndex(edgeId, sourceId, targetId, type, properties) {
    this._checkInitialized();
    
    // Remove existing property indexes for this edge
    for (const index of this.indexes.values()) {
      index.entries.delete(edgeId);
    }
    
    // Re-index the edge
    await this.indexEdge(edgeId, sourceId, targetId, type, properties);
    
    return Promise.resolve();
  }
  
  /**
   * Removes an edge from all indexes.
   * 
   * @param {string} edgeId - ID of the edge to remove
   * @returns {Promise<void>}
   */
  async removeEdgeFromIndex(edgeId) {
    this._checkInitialized();
    
    // Remove from all indexes
    for (const index of this.indexes.values()) {
      index.entries.delete(edgeId);
    }
    
    return Promise.resolve();
  }
  
  /**
   * Checks if the index manager is initialized.
   * 
   * @private
   * @throws {Error} If the index manager is not initialized
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error("IndexManager is not initialized");
    }
  }
}

module.exports = { MockIndexManager };
