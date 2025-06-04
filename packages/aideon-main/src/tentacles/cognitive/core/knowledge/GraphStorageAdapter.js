/**
 * @fileoverview GraphStorageAdapter interface for the Knowledge Graph Manager.
 * Defines the interface for adapters that provide storage for the knowledge graph.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

/**
 * Interface for adapters that provide storage for the knowledge graph.
 * Concrete implementations should extend this class and implement all methods.
 * @abstract
 */
class GraphStorageAdapter {
  /**
   * Creates a new GraphStorageAdapter instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   */
  constructor(options = {}) {
    if (this.constructor === GraphStorageAdapter) {
      throw new Error('GraphStorageAdapter is an abstract class and cannot be instantiated directly');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
  }
  
  /**
   * Initializes the storage adapter.
   * 
   * @returns {Promise<void>}
   * @abstract
   */
  async initialize() {
    throw new Error('Method not implemented: initialize()');
  }
  
  /**
   * Stores a node in the graph.
   * 
   * @param {Object} nodeData - Node data to store
   * @returns {Promise<string>} - ID of the stored node
   * @abstract
   */
  async storeNode(nodeData) {
    throw new Error('Method not implemented: storeNode()');
  }
  
  /**
   * Retrieves a node from the graph.
   * 
   * @param {string} nodeId - ID of the node to retrieve
   * @returns {Promise<Object|null>} - Node data or null if not found
   * @abstract
   */
  async retrieveNode(nodeId) {
    throw new Error('Method not implemented: retrieveNode()');
  }
  
  /**
   * Updates node data in the graph.
   * 
   * @param {string} nodeId - ID of the node to update
   * @param {Object} nodeData - New node data
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async updateNodeData(nodeId, nodeData) {
    throw new Error('Method not implemented: updateNodeData()');
  }
  
  /**
   * Deletes a node from the graph.
   * 
   * @param {string} nodeId - ID of the node to delete
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async deleteNode(nodeId) {
    throw new Error('Method not implemented: deleteNode()');
  }
  
  /**
   * Stores an edge in the graph.
   * 
   * @param {Object} edgeData - Edge data to store
   * @returns {Promise<string>} - ID of the stored edge
   * @abstract
   */
  async storeEdge(edgeData) {
    throw new Error('Method not implemented: storeEdge()');
  }
  
  /**
   * Retrieves an edge from the graph.
   * 
   * @param {string} edgeId - ID of the edge to retrieve
   * @returns {Promise<Object|null>} - Edge data or null if not found
   * @abstract
   */
  async retrieveEdge(edgeId) {
    throw new Error('Method not implemented: retrieveEdge()');
  }
  
  /**
   * Updates edge data in the graph.
   * 
   * @param {string} edgeId - ID of the edge to update
   * @param {Object} edgeData - New edge data
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async updateEdgeData(edgeId, edgeData) {
    throw new Error('Method not implemented: updateEdgeData()');
  }
  
  /**
   * Deletes an edge from the graph.
   * 
   * @param {string} edgeId - ID of the edge to delete
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async deleteEdge(edgeId) {
    throw new Error('Method not implemented: deleteEdge()');
  }
  
  /**
   * Stores a hyperedge in the graph.
   * 
   * @param {Object} hyperedgeData - Hyperedge data to store
   * @returns {Promise<string>} - ID of the stored hyperedge
   * @abstract
   */
  async storeHyperedge(hyperedgeData) {
    throw new Error('Method not implemented: storeHyperedge()');
  }
  
  /**
   * Retrieves a hyperedge from the graph.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to retrieve
   * @returns {Promise<Object|null>} - Hyperedge data or null if not found
   * @abstract
   */
  async retrieveHyperedge(hyperedgeId) {
    throw new Error('Method not implemented: retrieveHyperedge()');
  }
  
  /**
   * Updates hyperedge data in the graph.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to update
   * @param {Object} hyperedgeData - New hyperedge data
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async updateHyperedgeData(hyperedgeId, hyperedgeData) {
    throw new Error('Method not implemented: updateHyperedgeData()');
  }
  
  /**
   * Deletes a hyperedge from the graph.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to delete
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async deleteHyperedge(hyperedgeId) {
    throw new Error('Method not implemented: deleteHyperedge()');
  }
  
  /**
   * Stores a temporal version of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} versionData - Version data to store
   * @param {number} timestamp - Timestamp for the version
   * @returns {Promise<string>} - ID of the stored version
   * @abstract
   */
  async storeTemporalVersion(entityId, versionData, timestamp) {
    throw new Error('Method not implemented: storeTemporalVersion()');
  }
  
  /**
   * Retrieves temporal versions of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} timeRange - Time range to retrieve versions for
   * @param {number} [timeRange.start] - Start timestamp
   * @param {number} [timeRange.end] - End timestamp
   * @returns {Promise<Array<Object>>} - Array of version data
   * @abstract
   */
  async retrieveTemporalVersions(entityId, timeRange) {
    throw new Error('Method not implemented: retrieveTemporalVersions()');
  }
  
  /**
   * Queries nodes based on criteria.
   * 
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array<Object>>} - Array of matching nodes
   * @abstract
   */
  async queryNodes(criteria) {
    throw new Error('Method not implemented: queryNodes()');
  }
  
  /**
   * Queries edges based on criteria.
   * 
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array<Object>>} - Array of matching edges
   * @abstract
   */
  async queryEdges(criteria) {
    throw new Error('Method not implemented: queryEdges()');
  }
  
  /**
   * Queries hyperedges based on criteria.
   * 
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array<Object>>} - Array of matching hyperedges
   * @abstract
   */
  async queryHyperedges(criteria) {
    throw new Error('Method not implemented: queryHyperedges()');
  }
  
  /**
   * Batch stores multiple nodes.
   * 
   * @param {Array<Object>} nodesData - Array of node data to store
   * @returns {Promise<Array<string>>} - Array of stored node IDs
   * @abstract
   */
  async batchStoreNodes(nodesData) {
    throw new Error('Method not implemented: batchStoreNodes()');
  }
  
  /**
   * Batch stores multiple edges.
   * 
   * @param {Array<Object>} edgesData - Array of edge data to store
   * @returns {Promise<Array<string>>} - Array of stored edge IDs
   * @abstract
   */
  async batchStoreEdges(edgesData) {
    throw new Error('Method not implemented: batchStoreEdges()');
  }
  
  /**
   * Clears all data from storage.
   * 
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async clearStorage() {
    throw new Error('Method not implemented: clearStorage()');
  }
  
  /**
   * Optimizes storage for better performance.
   * 
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async optimizeStorage() {
    throw new Error('Method not implemented: optimizeStorage()');
  }
  
  /**
   * Gets storage statistics.
   * 
   * @returns {Promise<Object>} - Storage statistics
   * @abstract
   */
  async getStorageStats() {
    throw new Error('Method not implemented: getStorageStats()');
  }
  
  /**
   * Creates a new partition in the storage.
   * 
   * @param {string} partitionId - ID for the new partition
   * @returns {Promise<boolean>} - Success status
   * @abstract
   */
  async createPartition(partitionId) {
    throw new Error('Method not implemented: createPartition()');
  }
  
  /**
   * Stores data in a specific partition.
   * 
   * @param {string} partitionId - ID of the partition
   * @param {Object} data - Data to store
   * @returns {Promise<string>} - ID of the stored entity
   * @abstract
   */
  async storeInPartition(partitionId, data) {
    throw new Error('Method not implemented: storeInPartition()');
  }
  
  /**
   * Retrieves data from a specific partition.
   * 
   * @param {string} partitionId - ID of the partition
   * @param {string} entityId - ID of the entity to retrieve
   * @returns {Promise<Object|null>} - Entity data or null if not found
   * @abstract
   */
  async retrieveFromPartition(partitionId, entityId) {
    throw new Error('Method not implemented: retrieveFromPartition()');
  }
  
  /**
   * Shuts down the storage adapter.
   * 
   * @returns {Promise<void>}
   * @abstract
   */
  async shutdown() {
    throw new Error('Method not implemented: shutdown()');
  }
}

module.exports = { GraphStorageAdapter };
