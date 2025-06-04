/**
 * @fileoverview Mock implementation of GraphStorageAdapter for testing purposes.
 * Provides a concrete implementation of the abstract GraphStorageAdapter class.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { GraphStorageAdapter } = require("../../../../../../src/tentacles/cognitive/core/knowledge/GraphStorageAdapter");
const { v4: uuidv4 } = require("uuid");

/**
 * Mock implementation of GraphStorageAdapter for testing purposes.
 * Uses in-memory storage to simulate a graph database.
 */
class MockGraphStorageAdapter extends GraphStorageAdapter {
  /**
   * Creates a new MockGraphStorageAdapter instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.securityManager - Security manager
   * @param {Object} options.performanceMonitor - Performance monitor
   */
  constructor(options = {}) {
    super(options);
    
    // In-memory storage
    this.nodes = new Map();
    this.edges = new Map();
    this.hyperedges = new Map();
    this.versions = new Map();
    this.temporalVersions = new Map(); // Dedicated storage for temporal versions
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
   * Initializes the storage adapter.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info("Initializing MockGraphStorageAdapter");
    this.initialized = true;
    return Promise.resolve();
  }
  
  /**
   * Shuts down the storage adapter.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.logger.info("Shutting down MockGraphStorageAdapter");
    this.initialized = false;
    return Promise.resolve();
  }
  
  /**
   * Stores a node in the graph.
   * 
   * @param {Object} nodeData - Node data to store
   * @returns {Promise<string>} - ID of the stored node
   */
  async storeNode(nodeData) {
    this._checkInitialized();
    
    const nodeId = nodeData.id || uuidv4();
    const node = {
      ...nodeData,
      id: nodeId,
      createdAt: nodeData.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    this.nodes.set(nodeId, node);
    return Promise.resolve(nodeId);
  }
  
  /**
   * Retrieves a node from the graph.
   * 
   * @param {string} nodeId - ID of the node to retrieve
   * @returns {Promise<Object|null>} - Node data or null if not found
   */
  async retrieveNode(nodeId) {
    this._checkInitialized();
    
    const node = this.nodes.get(nodeId);
    return Promise.resolve(node || null);
  }
  
  /**
   * Updates node data in the graph.
   * 
   * @param {string} nodeId - ID of the node to update
   * @param {Object} nodeData - Updated node data
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async updateNodeData(nodeId, nodeData) {
    this._checkInitialized();
    
    if (!this.nodes.has(nodeId)) {
      return Promise.resolve(false);
    }
    
    const existingNode = this.nodes.get(nodeId);
    
    // Properly merge properties and metadata
    const updatedNode = {
      ...existingNode,
      properties: {
        ...existingNode.properties,
        ...(nodeData.properties || {})
      },
      metadata: {
        ...existingNode.metadata,
        ...(nodeData.metadata || {})
      },
      id: nodeId, // Ensure ID doesn't change
      createdAt: existingNode.createdAt, // Preserve creation timestamp
      updatedAt: Date.now()
    };
    
    this.nodes.set(nodeId, updatedNode);
    return Promise.resolve(true);
  }
  
  /**
   * Deletes a node from the graph.
   * 
   * @param {string} nodeId - ID of the node to delete
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async deleteNode(nodeId) {
    this._checkInitialized();
    
    if (!this.nodes.has(nodeId)) {
      return Promise.resolve(false);
    }
    
    this.nodes.delete(nodeId);
    
    // Also delete related versions
    if (this.temporalVersions.has(nodeId)) {
      this.temporalVersions.delete(nodeId);
    }
    
    return Promise.resolve(true);
  }
  
  /**
   * Stores an edge in the graph.
   * 
   * @param {Object} edgeData - Edge data to store
   * @returns {Promise<string>} - ID of the stored edge
   */
  async storeEdge(edgeData) {
    this._checkInitialized();
    
    const edgeId = edgeData.id || uuidv4();
    const edge = {
      ...edgeData,
      id: edgeId,
      createdAt: edgeData.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    this.edges.set(edgeId, edge);
    return Promise.resolve(edgeId);
  }
  
  /**
   * Retrieves an edge from the graph.
   * 
   * @param {string} edgeId - ID of the edge to retrieve
   * @returns {Promise<Object|null>} - Edge data or null if not found
   */
  async retrieveEdge(edgeId) {
    this._checkInitialized();
    
    const edge = this.edges.get(edgeId);
    return Promise.resolve(edge || null);
  }
  
  /**
   * Updates edge data in the graph.
   * 
   * @param {string} edgeId - ID of the edge to update
   * @param {Object} edgeData - Updated edge data
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async updateEdgeData(edgeId, edgeData) {
    this._checkInitialized();
    
    if (!this.edges.has(edgeId)) {
      return Promise.resolve(false);
    }
    
    const existingEdge = this.edges.get(edgeId);
    
    // Properly merge properties and metadata
    const updatedEdge = {
      ...existingEdge,
      properties: {
        ...existingEdge.properties,
        ...(edgeData.properties || {})
      },
      metadata: {
        ...existingEdge.metadata,
        ...(edgeData.metadata || {})
      },
      id: edgeId, // Ensure ID doesn't change
      sourceId: edgeData.sourceId || existingEdge.sourceId, // Preserve source ID if not provided
      targetId: edgeData.targetId || existingEdge.targetId, // Preserve target ID if not provided
      type: edgeData.type || existingEdge.type, // Preserve type if not provided
      createdAt: existingEdge.createdAt, // Preserve creation timestamp
      updatedAt: Date.now()
    };
    
    this.edges.set(edgeId, updatedEdge);
    return Promise.resolve(true);
  }
  
  /**
   * Deletes an edge from the graph.
   * 
   * @param {string} edgeId - ID of the edge to delete
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async deleteEdge(edgeId) {
    this._checkInitialized();
    
    if (!this.edges.has(edgeId)) {
      return Promise.resolve(false);
    }
    
    this.edges.delete(edgeId);
    return Promise.resolve(true);
  }
  
  /**
   * Queries nodes in the graph based on criteria.
   * 
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array<Object>>} - Array of matching nodes
   */
  async queryNodes(criteria) {
    this._checkInitialized();
    
    const results = [];
    
    for (const node of this.nodes.values()) {
      let match = true;
      
      // Match by ID
      if (criteria.id && node.id !== criteria.id) {
        match = false;
      }
      
      // Match by type
      if (criteria.type && node.type !== criteria.type) {
        match = false;
      }
      
      // Match by properties
      if (criteria.properties) {
        for (const [key, value] of Object.entries(criteria.properties)) {
          if (!node.properties || node.properties[key] !== value) {
            match = false;
            break;
          }
        }
      }
      
      if (match) {
        results.push(node);
      }
    }
    
    return Promise.resolve(results);
  }
  
  /**
   * Queries edges in the graph based on criteria.
   * 
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array<Object>>} - Array of matching edges
   */
  async queryEdges(criteria) {
    this._checkInitialized();
    
    const results = [];
    
    for (const edge of this.edges.values()) {
      let match = true;
      
      // Match by ID
      if (criteria.id && edge.id !== criteria.id) {
        match = false;
      }
      
      // Match by source ID
      if (criteria.sourceId && edge.sourceId !== criteria.sourceId) {
        match = false;
      }
      
      // Match by target ID
      if (criteria.targetId && edge.targetId !== criteria.targetId) {
        match = false;
      }
      
      // Match by type
      if (criteria.type && edge.type !== criteria.type) {
        match = false;
      }
      
      // Match by properties
      if (criteria.properties) {
        for (const [key, value] of Object.entries(criteria.properties)) {
          if (!edge.properties || edge.properties[key] !== value) {
            match = false;
            break;
          }
        }
      }
      
      if (match) {
        results.push(edge);
      }
    }
    
    return Promise.resolve(results);
  }
  
  /**
   * Stores a hyperedge in the graph.
   * 
   * @param {Object} hyperedgeData - Hyperedge data to store
   * @returns {Promise<string>} - ID of the stored hyperedge
   */
  async storeHyperedge(hyperedgeData) {
    this._checkInitialized();
    
    const hyperedgeId = hyperedgeData.id || uuidv4();
    const hyperedge = {
      ...hyperedgeData,
      id: hyperedgeId,
      createdAt: hyperedgeData.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    this.hyperedges.set(hyperedgeId, hyperedge);
    return Promise.resolve(hyperedgeId);
  }
  
  /**
   * Retrieves a hyperedge from the graph.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to retrieve
   * @returns {Promise<Object|null>} - Hyperedge data or null if not found
   */
  async retrieveHyperedge(hyperedgeId) {
    this._checkInitialized();
    
    const hyperedge = this.hyperedges.get(hyperedgeId);
    return Promise.resolve(hyperedge || null);
  }
  
  /**
   * Updates hyperedge data in the graph.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to update
   * @param {Object} hyperedgeData - Updated hyperedge data
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async updateHyperedgeData(hyperedgeId, hyperedgeData) {
    this._checkInitialized();
    
    if (!this.hyperedges.has(hyperedgeId)) {
      return Promise.resolve(false);
    }
    
    const existingHyperedge = this.hyperedges.get(hyperedgeId);
    
    // Properly merge properties and metadata
    const updatedHyperedge = {
      ...existingHyperedge,
      properties: {
        ...existingHyperedge.properties,
        ...(hyperedgeData.properties || {})
      },
      metadata: {
        ...existingHyperedge.metadata,
        ...(hyperedgeData.metadata || {})
      },
      id: hyperedgeId, // Ensure ID doesn't change
      createdAt: existingHyperedge.createdAt, // Preserve creation timestamp
      updatedAt: Date.now()
    };
    
    this.hyperedges.set(hyperedgeId, updatedHyperedge);
    return Promise.resolve(true);
  }
  
  /**
   * Deletes a hyperedge from the graph.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to delete
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async deleteHyperedge(hyperedgeId) {
    this._checkInitialized();
    
    if (!this.hyperedges.has(hyperedgeId)) {
      return Promise.resolve(false);
    }
    
    this.hyperedges.delete(hyperedgeId);
    return Promise.resolve(true);
  }
  
  /**
   * Queries hyperedges in the graph based on criteria.
   * 
   * @param {Object} criteria - Query criteria
   * @returns {Promise<Array<Object>>} - Array of matching hyperedges
   */
  async queryHyperedges(criteria) {
    this._checkInitialized();
    
    const results = [];
    
    for (const hyperedge of this.hyperedges.values()) {
      let match = true;
      
      // Match by ID
      if (criteria.id && hyperedge.id !== criteria.id) {
        match = false;
      }
      
      // Match by type
      if (criteria.type && hyperedge.type !== criteria.type) {
        match = false;
      }
      
      // Match by node ID
      if (criteria.nodeId && (!hyperedge.nodeIds || !hyperedge.nodeIds.includes(criteria.nodeId))) {
        match = false;
      }
      
      // Match by role
      if (criteria.role && (!hyperedge.nodeRoles || !Object.keys(hyperedge.nodeRoles).includes(criteria.role))) {
        match = false;
      }
      
      // Match by properties
      if (criteria.properties) {
        for (const [key, value] of Object.entries(criteria.properties)) {
          if (!hyperedge.properties || hyperedge.properties[key] !== value) {
            match = false;
            break;
          }
        }
      }
      
      if (match) {
        results.push(hyperedge);
      }
    }
    
    return Promise.resolve(results);
  }
  
  /**
   * Stores a temporal version of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} versionData - Version data to store
   * @param {number} timestamp - Timestamp for the version
   * @returns {Promise<string>} - ID of the stored version
   */
  async storeTemporalVersion(entityId, versionData, timestamp) {
    this._checkInitialized();
    
    const versionId = versionData.versionId || uuidv4();
    const version = {
      ...versionData,
      versionId,
      entityId,
      timestamp,
      createdAt: Date.now()
    };
    
    // Initialize entity's version array if it doesn't exist
    if (!this.temporalVersions.has(entityId)) {
      this.temporalVersions.set(entityId, []);
    }
    
    // Add version to the entity's version array
    const entityVersions = this.temporalVersions.get(entityId);
    entityVersions.push(version);
    
    // Sort versions by timestamp
    entityVersions.sort((a, b) => a.timestamp - b.timestamp);
    
    return Promise.resolve(versionId);
  }
  
  /**
   * Retrieves a temporal version from the graph.
   * 
   * @param {string} versionId - ID of the version to retrieve
   * @returns {Promise<Object|null>} - Version data or null if not found
   */
  async retrieveTemporalVersion(versionId) {
    this._checkInitialized();
    
    // Search through all entity version arrays
    for (const entityVersions of this.temporalVersions.values()) {
      const version = entityVersions.find(v => v.versionId === versionId);
      if (version) {
        return Promise.resolve(version);
      }
    }
    
    return Promise.resolve(null);
  }
  
  /**
   * Retrieves all temporal versions of an entity.
   * 
   * @param {string} entityId - ID of the entity
   * @param {Object} [timeRange={}] - Optional time range filter
   * @returns {Promise<Array<Object>>} - Array of version data
   */
  async retrieveTemporalVersions(entityId, timeRange = {}) {
    this._checkInitialized();
    
    // First, get the original node
    const originalNode = this.nodes.get(entityId);
    
    if (!originalNode) {
      return Promise.resolve([]);
    }
    
    // Start with the original node as the first version
    const result = [
      {
        versionId: `original_${entityId}`,
        entityId,
        properties: originalNode.properties,
        timestamp: originalNode.createdAt,
        isOriginal: true
      }
    ];
    
    // Add all stored versions
    if (this.temporalVersions.has(entityId)) {
      let versions = this.temporalVersions.get(entityId);
      
      // Apply time range filter if specified
      if (timeRange.start !== undefined) {
        versions = versions.filter(v => v.timestamp >= timeRange.start);
      }
      
      if (timeRange.end !== undefined) {
        versions = versions.filter(v => v.timestamp <= timeRange.end);
      }
      
      // Add filtered versions to result
      result.push(...versions);
      
      // Sort all versions by timestamp
      result.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    return Promise.resolve(result);
  }
  
  /**
   * Deletes a temporal version from the graph.
   * 
   * @param {string} entityId - ID of the entity
   * @param {string} versionId - ID of the version to delete
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async deleteTemporalVersion(entityId, versionId) {
    this._checkInitialized();
    
    if (!this.temporalVersions.has(entityId)) {
      return Promise.resolve(false);
    }
    
    const entityVersions = this.temporalVersions.get(entityId);
    const initialLength = entityVersions.length;
    
    // Filter out the version to delete
    const filteredVersions = entityVersions.filter(v => v.versionId !== versionId);
    
    if (filteredVersions.length === initialLength) {
      // No version was deleted
      return Promise.resolve(false);
    }
    
    // Update the entity's version array
    this.temporalVersions.set(entityId, filteredVersions);
    
    return Promise.resolve(true);
  }
  
  /**
   * Checks if the storage adapter is initialized.
   * 
   * @private
   * @throws {Error} If the storage adapter is not initialized
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error("Storage adapter is not initialized");
    }
  }
}

module.exports = { MockGraphStorageAdapter };
