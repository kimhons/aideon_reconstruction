/**
 * @fileoverview HypergraphManager for the Knowledge Graph Manager.
 * Provides hypergraph capabilities for representing complex many-to-many relationships.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { HyperedgeType } = require('./HyperedgeType');

/**
 * Provides hypergraph capabilities for representing complex many-to-many relationships.
 */
class HypergraphManager extends EventEmitter {
  /**
   * Creates a new HypergraphManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   */
  constructor(options = {}) {
    super();
    
    if (!options.storageAdapter) {
      throw new Error('HypergraphManager requires a storageAdapter instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    
    this.initialized = false;
  }
  
  /**
   * Initializes the hypergraph manager.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing HypergraphManager');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.hypergraph', {
          maxNodesPerHyperedge: 1000,
          enableRoleBasedConnections: true,
          enableWeightedConnections: true,
          enableDirectedHyperedges: true,
          enableNestedHyperedges: true
        });
        
        this.config = config;
      } else {
        this.config = {
          maxNodesPerHyperedge: 1000,
          enableRoleBasedConnections: true,
          enableWeightedConnections: true,
          enableDirectedHyperedges: true,
          enableNestedHyperedges: true
        };
      }
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('HypergraphManager initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('HypergraphManager initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`HypergraphManager initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a new hyperedge connecting multiple nodes.
   * 
   * @param {Array<string>} nodeIds - IDs of the nodes to connect
   * @param {HyperedgeType} type - Type of the hyperedge
   * @param {Object} [properties={}] - Hyperedge properties
   * @param {Object} [metadata={}] - Hyperedge metadata
   * @returns {Promise<string>} - ID of the created hyperedge
   */
  async createHyperedge(nodeIds, type, properties = {}, metadata = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_createHyperedge');
    }
    
    try {
      // Validate hyperedge type
      if (!Object.values(HyperedgeType).includes(type)) {
        throw new Error(`Invalid hyperedge type: ${type}`);
      }
      
      // Validate node count
      if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
        throw new Error('Hyperedge requires at least 2 nodes');
      }
      
      if (nodeIds.length > this.config.maxNodesPerHyperedge) {
        throw new Error(`Hyperedge exceeds maximum node count (${this.config.maxNodesPerHyperedge})`);
      }
      
      // Check if all nodes exist
      const nodeCheckPromises = nodeIds.map(nodeId => this.storageAdapter.retrieveNode(nodeId));
      const nodes = await Promise.all(nodeCheckPromises);
      
      const missingNodes = nodes
        .map((node, index) => node === null ? nodeIds[index] : null)
        .filter(nodeId => nodeId !== null);
      
      if (missingNodes.length > 0) {
        throw new Error(`Some nodes do not exist: ${missingNodes.join(', ')}`);
      }
      
      // Generate unique ID
      const hyperedgeId = uuidv4();
      
      // Prepare hyperedge data
      const hyperedgeData = {
        id: hyperedgeId,
        type,
        nodeIds: [...nodeIds],
        properties: { ...properties },
        metadata: {
          ...metadata,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store hyperedge using the adapter
      const storedHyperedgeId = await this.storageAdapter.storeHyperedge(hyperedgeData);
      
      if (this.logger) {
        this.logger.debug(`Created hyperedge ${storedHyperedgeId} of type ${type} connecting ${nodeIds.length} nodes`);
      }
      
      this.emit('hyperedgeCreated', { hyperedgeId: storedHyperedgeId, type, nodeIds });
      
      return storedHyperedgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create hyperedge', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a role-based hyperedge where nodes have specific roles.
   * 
   * @param {Object<string, string>} nodeRoles - Map of role names to node IDs
   * @param {HyperedgeType} type - Type of the hyperedge
   * @param {Object} [properties={}] - Hyperedge properties
   * @param {Object} [metadata={}] - Hyperedge metadata
   * @returns {Promise<string>} - ID of the created hyperedge
   */
  async createRoleBasedHyperedge(nodeRoles, type, properties = {}, metadata = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableRoleBasedConnections) {
      throw new Error('Role-based hyperedges are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_createRoleBasedHyperedge');
    }
    
    try {
      // Validate hyperedge type
      if (!Object.values(HyperedgeType).includes(type)) {
        throw new Error(`Invalid hyperedge type: ${type}`);
      }
      
      // Validate node roles
      if (typeof nodeRoles !== 'object' || Object.keys(nodeRoles).length < 2) {
        throw new Error('Role-based hyperedge requires at least 2 node roles');
      }
      
      const nodeIds = Object.values(nodeRoles);
      
      if (nodeIds.length > this.config.maxNodesPerHyperedge) {
        throw new Error(`Hyperedge exceeds maximum node count (${this.config.maxNodesPerHyperedge})`);
      }
      
      // Check if all nodes exist
      const nodeCheckPromises = nodeIds.map(nodeId => this.storageAdapter.retrieveNode(nodeId));
      const nodes = await Promise.all(nodeCheckPromises);
      
      const missingNodes = nodes
        .map((node, index) => node === null ? nodeIds[index] : null)
        .filter(nodeId => nodeId !== null);
      
      if (missingNodes.length > 0) {
        throw new Error(`Some nodes do not exist: ${missingNodes.join(', ')}`);
      }
      
      // Generate unique ID
      const hyperedgeId = uuidv4();
      
      // Prepare hyperedge data
      const hyperedgeData = {
        id: hyperedgeId,
        type,
        nodeIds,
        nodeRoles, // Store role information
        properties: { ...properties },
        metadata: {
          ...metadata,
          isRoleBased: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store hyperedge using the adapter
      const storedHyperedgeId = await this.storageAdapter.storeHyperedge(hyperedgeData);
      
      if (this.logger) {
        this.logger.debug(`Created role-based hyperedge ${storedHyperedgeId} of type ${type} with ${Object.keys(nodeRoles).length} roles`);
      }
      
      this.emit('hyperedgeCreated', { hyperedgeId: storedHyperedgeId, type, nodeRoles, isRoleBased: true });
      
      return storedHyperedgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create role-based hyperedge', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a weighted hyperedge where connections have weights.
   * 
   * @param {Array<{nodeId: string, weight: number}>} weightedNodes - Nodes with weights
   * @param {HyperedgeType} type - Type of the hyperedge
   * @param {Object} [properties={}] - Hyperedge properties
   * @param {Object} [metadata={}] - Hyperedge metadata
   * @returns {Promise<string>} - ID of the created hyperedge
   */
  async createWeightedHyperedge(weightedNodes, type, properties = {}, metadata = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableWeightedConnections) {
      throw new Error('Weighted hyperedges are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_createWeightedHyperedge');
    }
    
    try {
      // Validate hyperedge type
      if (!Object.values(HyperedgeType).includes(type)) {
        throw new Error(`Invalid hyperedge type: ${type}`);
      }
      
      // Validate weighted nodes
      if (!Array.isArray(weightedNodes) || weightedNodes.length < 2) {
        throw new Error('Weighted hyperedge requires at least 2 nodes');
      }
      
      if (weightedNodes.length > this.config.maxNodesPerHyperedge) {
        throw new Error(`Hyperedge exceeds maximum node count (${this.config.maxNodesPerHyperedge})`);
      }
      
      // Validate weights
      for (const node of weightedNodes) {
        if (!node.nodeId || typeof node.weight !== 'number') {
          throw new Error('Each weighted node must have a nodeId and a numeric weight');
        }
      }
      
      const nodeIds = weightedNodes.map(node => node.nodeId);
      
      // Check if all nodes exist
      const nodeCheckPromises = nodeIds.map(nodeId => this.storageAdapter.retrieveNode(nodeId));
      const nodes = await Promise.all(nodeCheckPromises);
      
      const missingNodes = nodes
        .map((node, index) => node === null ? nodeIds[index] : null)
        .filter(nodeId => nodeId !== null);
      
      if (missingNodes.length > 0) {
        throw new Error(`Some nodes do not exist: ${missingNodes.join(', ')}`);
      }
      
      // Generate unique ID
      const hyperedgeId = uuidv4();
      
      // Prepare hyperedge data
      const hyperedgeData = {
        id: hyperedgeId,
        type,
        nodeIds,
        weightedNodes, // Store weight information
        properties: { ...properties },
        metadata: {
          ...metadata,
          isWeighted: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store hyperedge using the adapter
      const storedHyperedgeId = await this.storageAdapter.storeHyperedge(hyperedgeData);
      
      if (this.logger) {
        this.logger.debug(`Created weighted hyperedge ${storedHyperedgeId} of type ${type} connecting ${weightedNodes.length} nodes`);
      }
      
      this.emit('hyperedgeCreated', { hyperedgeId: storedHyperedgeId, type, weightedNodes, isWeighted: true });
      
      return storedHyperedgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create weighted hyperedge', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a directed hyperedge with source and target node sets.
   * 
   * @param {Array<string>} sourceNodeIds - IDs of source nodes
   * @param {Array<string>} targetNodeIds - IDs of target nodes
   * @param {HyperedgeType} type - Type of the hyperedge
   * @param {Object} [properties={}] - Hyperedge properties
   * @param {Object} [metadata={}] - Hyperedge metadata
   * @returns {Promise<string>} - ID of the created hyperedge
   */
  async createDirectedHyperedge(sourceNodeIds, targetNodeIds, type, properties = {}, metadata = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableDirectedHyperedges) {
      throw new Error('Directed hyperedges are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_createDirectedHyperedge');
    }
    
    try {
      // Validate hyperedge type
      if (!Object.values(HyperedgeType).includes(type)) {
        throw new Error(`Invalid hyperedge type: ${type}`);
      }
      
      // Validate node sets
      if (!Array.isArray(sourceNodeIds) || sourceNodeIds.length === 0) {
        throw new Error('Directed hyperedge requires at least one source node');
      }
      
      if (!Array.isArray(targetNodeIds) || targetNodeIds.length === 0) {
        throw new Error('Directed hyperedge requires at least one target node');
      }
      
      const totalNodes = sourceNodeIds.length + targetNodeIds.length;
      if (totalNodes > this.config.maxNodesPerHyperedge) {
        throw new Error(`Hyperedge exceeds maximum node count (${this.config.maxNodesPerHyperedge})`);
      }
      
      // Check if all nodes exist
      const allNodeIds = [...sourceNodeIds, ...targetNodeIds];
      const nodeCheckPromises = allNodeIds.map(nodeId => this.storageAdapter.retrieveNode(nodeId));
      const nodes = await Promise.all(nodeCheckPromises);
      
      const missingNodes = nodes
        .map((node, index) => node === null ? allNodeIds[index] : null)
        .filter(nodeId => nodeId !== null);
      
      if (missingNodes.length > 0) {
        throw new Error(`Some nodes do not exist: ${missingNodes.join(', ')}`);
      }
      
      // Generate unique ID
      const hyperedgeId = uuidv4();
      
      // Prepare hyperedge data
      const hyperedgeData = {
        id: hyperedgeId,
        type,
        nodeIds: allNodeIds,
        sourceNodeIds: [...sourceNodeIds],
        targetNodeIds: [...targetNodeIds],
        properties: { ...properties },
        metadata: {
          ...metadata,
          isDirected: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store hyperedge using the adapter
      const storedHyperedgeId = await this.storageAdapter.storeHyperedge(hyperedgeData);
      
      if (this.logger) {
        this.logger.debug(`Created directed hyperedge ${storedHyperedgeId} of type ${type} from ${sourceNodeIds.length} sources to ${targetNodeIds.length} targets`);
      }
      
      this.emit('hyperedgeCreated', { 
        hyperedgeId: storedHyperedgeId, 
        type, 
        sourceNodeIds, 
        targetNodeIds, 
        isDirected: true 
      });
      
      return storedHyperedgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create directed hyperedge', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Creates a nested hyperedge that contains other hyperedges.
   * 
   * @param {Array<string>} hyperedgeIds - IDs of hyperedges to nest
   * @param {HyperedgeType} type - Type of the hyperedge
   * @param {Object} [properties={}] - Hyperedge properties
   * @param {Object} [metadata={}] - Hyperedge metadata
   * @returns {Promise<string>} - ID of the created hyperedge
   */
  async createNestedHyperedge(hyperedgeIds, type, properties = {}, metadata = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableNestedHyperedges) {
      throw new Error('Nested hyperedges are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_createNestedHyperedge');
    }
    
    try {
      // Validate hyperedge type
      if (!Object.values(HyperedgeType).includes(type)) {
        throw new Error(`Invalid hyperedge type: ${type}`);
      }
      
      // Validate hyperedge IDs
      if (!Array.isArray(hyperedgeIds) || hyperedgeIds.length < 2) {
        throw new Error('Nested hyperedge requires at least 2 hyperedges');
      }
      
      // Check if all hyperedges exist
      const hyperedgeCheckPromises = hyperedgeIds.map(id => this.storageAdapter.retrieveHyperedge(id));
      const hyperedges = await Promise.all(hyperedgeCheckPromises);
      
      const missingHyperedges = hyperedges
        .map((hyperedge, index) => hyperedge === null ? hyperedgeIds[index] : null)
        .filter(id => id !== null);
      
      if (missingHyperedges.length > 0) {
        throw new Error(`Some hyperedges do not exist: ${missingHyperedges.join(', ')}`);
      }
      
      // Collect all node IDs from nested hyperedges
      const allNodeIds = new Set();
      for (const hyperedge of hyperedges) {
        if (hyperedge.nodeIds) {
          for (const nodeId of hyperedge.nodeIds) {
            allNodeIds.add(nodeId);
          }
        }
      }
      
      if (allNodeIds.size > this.config.maxNodesPerHyperedge) {
        throw new Error(`Nested hyperedge exceeds maximum node count (${this.config.maxNodesPerHyperedge})`);
      }
      
      // Generate unique ID
      const hyperedgeId = uuidv4();
      
      // Prepare hyperedge data
      const hyperedgeData = {
        id: hyperedgeId,
        type,
        nodeIds: Array.from(allNodeIds),
        hyperedgeIds: [...hyperedgeIds],
        properties: { ...properties },
        metadata: {
          ...metadata,
          isNested: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Store hyperedge using the adapter
      const storedHyperedgeId = await this.storageAdapter.storeHyperedge(hyperedgeData);
      
      if (this.logger) {
        this.logger.debug(`Created nested hyperedge ${storedHyperedgeId} of type ${type} containing ${hyperedgeIds.length} hyperedges`);
      }
      
      this.emit('hyperedgeCreated', { 
        hyperedgeId: storedHyperedgeId, 
        type, 
        hyperedgeIds, 
        isNested: true 
      });
      
      return storedHyperedgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to create nested hyperedge', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves a hyperedge by ID.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to retrieve
   * @returns {Promise<Object|null>} - Hyperedge data or null if not found
   */
  async getHyperedge(hyperedgeId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_getHyperedge');
    }
    
    try {
      const hyperedge = await this.storageAdapter.retrieveHyperedge(hyperedgeId);
      
      if (!hyperedge && this.logger) {
        this.logger.debug(`Hyperedge ${hyperedgeId} not found`);
      }
      
      return hyperedge;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get hyperedge ${hyperedgeId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Updates a hyperedge.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to update
   * @param {Object} updates - Updates to apply
   * @returns {Promise<boolean>} - Success status
   */
  async updateHyperedge(hyperedgeId, updates) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_updateHyperedge');
    }
    
    try {
      // Get the existing hyperedge
      const existingHyperedge = await this.storageAdapter.retrieveHyperedge(hyperedgeId);
      
      if (!existingHyperedge) {
        if (this.logger) {
          this.logger.warn(`Hyperedge ${hyperedgeId} not found for update`);
        }
        return false;
      }
      
      // Prepare update data
      const updateData = {
        properties: updates.properties || existingHyperedge.properties,
        metadata: {
          ...existingHyperedge.metadata,
          ...(updates.metadata || {}),
          updatedAt: Date.now()
        }
      };
      
      // Update hyperedge using the adapter
      const success = await this.storageAdapter.updateHyperedgeData(hyperedgeId, updateData);
      
      if (success && this.logger) {
        this.logger.debug(`Updated hyperedge ${hyperedgeId}`);
      }
      
      if (success) {
        this.emit('hyperedgeUpdated', { hyperedgeId, updates });
      }
      
      return success;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update hyperedge ${hyperedgeId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Deletes a hyperedge.
   * 
   * @param {string} hyperedgeId - ID of the hyperedge to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteHyperedge(hyperedgeId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_deleteHyperedge');
    }
    
    try {
      // Check if hyperedge exists
      const hyperedge = await this.storageAdapter.retrieveHyperedge(hyperedgeId);
      
      if (!hyperedge) {
        if (this.logger) {
          this.logger.warn(`Hyperedge ${hyperedgeId} not found for deletion`);
        }
        return false;
      }
      
      // Delete hyperedge using the adapter
      const success = await this.storageAdapter.deleteHyperedge(hyperedgeId);
      
      if (success && this.logger) {
        this.logger.debug(`Deleted hyperedge ${hyperedgeId}`);
      }
      
      if (success) {
        this.emit('hyperedgeDeleted', { hyperedgeId });
      }
      
      return success;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to delete hyperedge ${hyperedgeId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves all hyperedges that include a specific node.
   * 
   * @param {string} nodeId - ID of the node
   * @returns {Promise<Array<Object>>} - Array of hyperedges
   */
  async getHyperedgesByNode(nodeId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_getHyperedgesByNode');
    }
    
    try {
      // Query hyperedges using the adapter
      const hyperedges = await this.storageAdapter.queryHyperedges({ nodeId });
      
      if (this.logger) {
        this.logger.debug(`Found ${hyperedges.length} hyperedges for node ${nodeId}`);
      }
      
      return hyperedges;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get hyperedges for node ${nodeId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves all hyperedges of a specific type.
   * 
   * @param {HyperedgeType} type - Type of hyperedges to retrieve
   * @returns {Promise<Array<Object>>} - Array of hyperedges
   */
  async getHyperedgesByType(type) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_getHyperedgesByType');
    }
    
    try {
      // Validate hyperedge type
      if (!Object.values(HyperedgeType).includes(type)) {
        throw new Error(`Invalid hyperedge type: ${type}`);
      }
      
      // Query hyperedges using the adapter
      const hyperedges = await this.storageAdapter.queryHyperedges({ type });
      
      if (this.logger) {
        this.logger.debug(`Found ${hyperedges.length} hyperedges of type ${type}`);
      }
      
      return hyperedges;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get hyperedges of type ${type}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Retrieves all hyperedges with a specific role.
   * 
   * @param {string} role - Role name
   * @returns {Promise<Array<Object>>} - Array of hyperedges
   */
  async getHyperedgesByRole(role) {
    this.ensureInitialized();
    
    if (!this.config.enableRoleBasedConnections) {
      throw new Error('Role-based hyperedges are not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('hypergraphManager_getHyperedgesByRole');
    }
    
    try {
      // Query hyperedges using the adapter
      const hyperedges = await this.storageAdapter.queryHyperedges({ role });
      
      if (this.logger) {
        this.logger.debug(`Found ${hyperedges.length} hyperedges with role ${role}`);
      }
      
      return hyperedges;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get hyperedges with role ${role}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Ensures the manager is initialized and throws an error if not.
   * 
   * @private
   * @throws {Error} If the manager is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('HypergraphManager is not initialized');
    }
  }
}

module.exports = { HypergraphManager };
