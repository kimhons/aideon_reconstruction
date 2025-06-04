/**
 * @fileoverview Knowledge Graph Manager for the Aideon AI Desktop Agent.
 * Provides comprehensive knowledge representation, storage, and retrieval capabilities.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { NodeType } = require('./NodeType');
const { EdgeType } = require('./EdgeType');
const { IndexManager } = require('./IndexManager');
const { SemanticCache } = require('./SemanticCache');
const { QueryProcessor } = require('./QueryProcessor');
const { HypergraphManager } = require('./HypergraphManager');
const { TemporalManager } = require('./TemporalManager');
const { AdvancedQueryEngine } = require('./AdvancedQueryEngine');
const { ProbabilisticKnowledgeManager } = require('./ProbabilisticKnowledgeManager');
const { GraphNeuralNetworkManager } = require('./GraphNeuralNetworkManager');

/**
 * Knowledge Graph Manager for the Aideon AI Desktop Agent.
 * Provides comprehensive knowledge representation, storage, and retrieval capabilities.
 * 
 * @extends EventEmitter
 */
class KnowledgeGraphManager extends EventEmitter {
  /**
   * Creates a new KnowledgeGraphManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service
   * @param {Object} options.securityManager - Security manager
   * @param {Object} options.performanceMonitor - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   * @param {Object} [options.indexManager] - Index manager
   * @param {Object} [options.semanticCache] - Semantic cache
   * @param {Object} [options.queryProcessor] - Query processor
   * @param {Object} [options.hypergraphManager] - Hypergraph manager
   * @param {Object} [options.temporalManager] - Temporal manager
   * @param {Object} [options.advancedQueryEngine] - Advanced query engine
   * @param {Object} [options.probabilisticKnowledgeManager] - Probabilistic knowledge manager
   * @param {Object} [options.graphNeuralNetworkManager] - Graph neural network manager
   */
  constructor(options) {
    super();
    
    if (!options.storageAdapter) {
      throw new Error("KnowledgeGraphManager requires a storageAdapter instance");
    }
    
    // Core dependencies
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    
    // Core components
    this.indexManager = options.indexManager || new IndexManager({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      storageAdapter: this.storageAdapter
    });
    
    this.semanticCache = options.semanticCache || new SemanticCache({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor
    });
    
    this.queryProcessor = options.queryProcessor || new QueryProcessor({
      logger: this.logger,
      configService: this.configService, 
      performanceMonitor: this.performanceMonitor, 
      storageAdapter: this.storageAdapter, 
      indexManager: this.indexManager 
    });

    // Initialize advanced components
    this.hypergraphManager = options.hypergraphManager || new HypergraphManager({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      storageAdapter: this.storageAdapter
    });

    this.temporalManager = options.temporalManager || new TemporalManager({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      storageAdapter: this.storageAdapter
    });

    this.advancedQueryEngine = options.advancedQueryEngine || new AdvancedQueryEngine({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      storageAdapter: this.storageAdapter,
      indexManager: this.indexManager
    });
    
    // Initialize probabilistic knowledge manager
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager || new ProbabilisticKnowledgeManager({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      storageAdapter: this.storageAdapter
    });
    
    // Initialize graph neural network manager
    this.graphNeuralNetworkManager = options.graphNeuralNetworkManager || new GraphNeuralNetworkManager({
      logger: this.logger,
      configService: this.configService,
      performanceMonitor: this.performanceMonitor,
      storageAdapter: this.storageAdapter
    });

    this.initialized = false;
    this._loggedInitialization = false; // Track if we've logged initialization
  }

  /**
   * Initializes the Knowledge Graph Manager and its components.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      // Already initialized, don't reinitialize or log again
      return;
    }

    if (this.logger) {
      this.logger.debug("Initializing KnowledgeGraphManager");
    }

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_initialize");
    }

    try {
      // Initialize components in order
      await this.storageAdapter.initialize();
      await this.indexManager.initialize();
      await this.semanticCache.initialize();
      await this.queryProcessor.initialize();
      
      // Initialize advanced components
      await this.hypergraphManager.initialize();
      await this.temporalManager.initialize();
      await this.advancedQueryEngine.initialize();
      
      // Initialize probabilistic knowledge and graph neural network managers
      await this.probabilisticKnowledgeManager.initialize();
      await this.graphNeuralNetworkManager.initialize();

      this.initialized = true;

      if (this.logger) {
        this.logger.info("KnowledgeGraphManager initialized successfully");
      }

      this.emit("initialized");
    } catch (error) {
      if (this.logger) {
        this.logger.error("KnowledgeGraphManager initialization failed", { error: error.message, stack: error.stack });
      }
      throw new Error(`KnowledgeGraphManager initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Ensures the manager is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the manager is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("KnowledgeGraphManager is not initialized. Call initialize() first.");
    }
  }

  /**
   * Updates indexes for a node.
   * 
   * @param {string} nodeId - ID of the node to index
   * @param {NodeType} type - Type of the node
   * @param {Object} properties - Node properties
   * @returns {Promise<void>}
   */
  async updateIndexesForNode(nodeId, type, properties) {
    if (!this.indexManager) {
      return;
    }

    try {
      await this.indexManager.indexNode(nodeId, type, properties);
      
      if (this.logger) {
        this.logger.debug(`Updated indexes for node: ${nodeId}`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update indexes for node: ${error.message}`, { nodeId, error: error.stack });
      }
      throw error;
    }
  }

  // --- Node Management ---

  /**
   * Adds a new node to the knowledge graph.
   *
   * @param {NodeType} type - Type of the node
   * @param {Object} properties - Node properties
   * @param {Object} [metadata={}] - Node metadata (e.g., source, confidence)
   * @param {number} [timestamp] - Timestamp for temporal nodes
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.withUncertainty=false] - Whether to include uncertainty information
   * @param {number} [options.confidenceScore] - Confidence score for probabilistic knowledge
   * @returns {Promise<string>} - ID of the newly created node
   */
  async addNode(type, properties, metadata = {}, timestamp, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_addNode");
    }

    try {
      // Validate node type
      if (!Object.values(NodeType).includes(type)) {
        throw new Error(`Invalid node type: ${type}`);
      }

      // Generate unique ID
      const nodeId = uuidv4();

      // Prepare node data
      const nodeData = {
        id: nodeId,
        type,
        properties: { ...properties },
        metadata: { 
          ...metadata,
          createdAt: timestamp || Date.now(),
          updatedAt: timestamp || Date.now()
        }
      };

      // Apply security policies
      if (this.securityManager && this.securityManager.applyNodeSecurityPolicies) {
        await this.securityManager.applyNodeSecurityPolicies(nodeData);
      }
      
      // Handle probabilistic knowledge if requested
      if (options.withUncertainty) {
        const confidenceScore = options.confidenceScore !== undefined ? options.confidenceScore : 1.0;
        await this.probabilisticKnowledgeManager.addNodeWithUncertainty(nodeId, type, properties, confidenceScore);
        
        // Add confidence score to metadata
        nodeData.metadata.confidenceScore = confidenceScore;
      }

      // Store node
      await this.storageAdapter.storeNode(nodeData);

      // Index node
      await this.updateIndexesForNode(nodeId, type, properties);

      // Invalidate cache
      await this.semanticCache.invalidate({ nodeId });

      if (this.logger) {
        this.logger.debug(`Added node: ${nodeId}`, { type, properties: Object.keys(properties) });
      }

      this.emit("nodeAdded", { nodeId, type, properties });
      return nodeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add node: ${error.message}`, { type, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves a node from the knowledge graph.
   *
   * @param {string} nodeId - ID of the node to retrieve
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.includeUncertainty=false] - Whether to include uncertainty information
   * @returns {Promise<Object>} - Node data
   */
  async getNode(nodeId, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_getNode");
    }

    try {
      // Check cache first
      const cachedNode = await this.semanticCache.get({ nodeId });
      if (cachedNode && !options.includeUncertainty) {
        if (this.logger) {
          this.logger.debug(`Retrieved node from cache: ${nodeId}`);
        }
        return cachedNode;
      }

      // Retrieve from storage
      const node = await this.storageAdapter.retrieveNode(nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyNodeAccessPolicies) {
        await this.securityManager.applyNodeAccessPolicies(node);
      }
      
      // Include uncertainty information if requested
      if (options.includeUncertainty) {
        const uncertaintyInfo = await this.probabilisticKnowledgeManager.getNodeUncertainty(nodeId);
        if (uncertaintyInfo) {
          node.uncertainty = uncertaintyInfo;
        }
      }

      // Cache result (only if not including uncertainty)
      if (!options.includeUncertainty) {
        await this.semanticCache.set({ nodeId }, node);
      }

      if (this.logger) {
        this.logger.debug(`Retrieved node: ${nodeId}`, { type: node.type });
      }

      return node;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to retrieve node: ${error.message}`, { nodeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Updates a node in the knowledge graph.
   *
   * @param {string} nodeId - ID of the node to update
   * @param {Object} properties - Updated node properties
   * @param {Object} [metadata={}] - Updated node metadata
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.updateUncertainty=false] - Whether to update uncertainty information
   * @param {number} [options.confidenceScore] - Updated confidence score
   * @returns {Promise<boolean>} - True if successful
   */
  async updateNode(nodeId, properties, metadata = {}, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_updateNode");
    }

    try {
      // Get existing node
      const existingNode = await this.storageAdapter.retrieveNode(nodeId);
      if (!existingNode) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyNodeUpdatePolicies) {
        await this.securityManager.applyNodeUpdatePolicies(existingNode, properties, metadata);
      }

      // Prepare update data
      const updateData = {
        properties: { ...properties },
        metadata: { 
          ...existingNode.metadata,
          ...metadata,
          updatedAt: Date.now()
        }
      };
      
      // Update uncertainty information if requested
      if (options.updateUncertainty) {
        const confidenceScore = options.confidenceScore !== undefined ? options.confidenceScore : 
                               (existingNode.metadata.confidenceScore || 1.0);
        await this.probabilisticKnowledgeManager.updateNodeUncertainty(nodeId, properties, confidenceScore);
        
        // Update confidence score in metadata
        updateData.metadata.confidenceScore = confidenceScore;
      }

      // Update node
      const success = await this.storageAdapter.updateNodeData(nodeId, updateData);
      if (!success) {
        throw new Error(`Failed to update node: ${nodeId}`);
      }

      // Update index
      await this.indexManager.updateNodeIndex(nodeId, existingNode.type, properties);

      // Invalidate cache
      await this.semanticCache.invalidate({ nodeId });

      if (this.logger) {
        this.logger.debug(`Updated node: ${nodeId}`, { properties: Object.keys(properties) });
      }

      this.emit("nodeUpdated", { nodeId, properties });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update node: ${error.message}`, { nodeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Deletes a node from the knowledge graph.
   *
   * @param {string} nodeId - ID of the node to delete
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.deleteUncertaintyInfo=true] - Whether to delete associated uncertainty information
   * @returns {Promise<boolean>} - True if successful
   */
  async deleteNode(nodeId, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_deleteNode");
    }

    try {
      // Get existing node
      const existingNode = await this.storageAdapter.retrieveNode(nodeId);
      if (!existingNode) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyNodeDeletePolicies) {
        await this.securityManager.applyNodeDeletePolicies(existingNode);
      }
      
      // Delete uncertainty information if requested
      const deleteUncertaintyInfo = options.deleteUncertaintyInfo !== false; // Default to true
      if (deleteUncertaintyInfo) {
        await this.probabilisticKnowledgeManager.deleteNodeUncertainty(nodeId);
      }

      // Delete node
      const success = await this.storageAdapter.deleteNode(nodeId);
      if (!success) {
        throw new Error(`Failed to delete node: ${nodeId}`);
      }

      // Remove from index
      await this.indexManager.removeNodeFromIndex(nodeId);

      // Invalidate cache
      await this.semanticCache.invalidate({ nodeId });

      if (this.logger) {
        this.logger.debug(`Deleted node: ${nodeId}`);
      }

      this.emit("nodeDeleted", { nodeId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to delete node: ${error.message}`, { nodeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  // --- Edge Management ---

  /**
   * Adds a new edge to the knowledge graph.
   *
   * @param {string} sourceId - ID of the source node
   * @param {string} targetId - ID of the target node
   * @param {EdgeType} type - Type of the edge
   * @param {Object} [properties={}] - Edge properties
   * @param {Object} [metadata={}] - Edge metadata
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.withUncertainty=false] - Whether to include uncertainty information
   * @param {number} [options.confidenceScore] - Confidence score for probabilistic knowledge
   * @returns {Promise<string>} - ID of the newly created edge
   */
  async addEdge(sourceId, targetId, type, properties = {}, metadata = {}, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_addEdge");
    }

    try {
      // Validate edge type
      if (!Object.values(EdgeType).includes(type)) {
        throw new Error(`Invalid edge type: ${type}`);
      }

      // Verify source and target nodes exist
      const sourceNode = await this.storageAdapter.retrieveNode(sourceId);
      if (!sourceNode) {
        throw new Error(`Source node not found: ${sourceId}`);
      }

      const targetNode = await this.storageAdapter.retrieveNode(targetId);
      if (!targetNode) {
        throw new Error(`Target node not found: ${targetId}`);
      }

      // Generate unique ID
      const edgeId = uuidv4();

      // Prepare edge data
      const edgeData = {
        id: edgeId,
        sourceId,
        targetId,
        type,
        properties: { ...properties },
        metadata: { 
          ...metadata,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      };

      // Apply security policies
      if (this.securityManager && this.securityManager.applyEdgeSecurityPolicies) {
        await this.securityManager.applyEdgeSecurityPolicies(edgeData, sourceNode, targetNode);
      }
      
      // Handle probabilistic knowledge if requested
      if (options.withUncertainty) {
        const confidenceScore = options.confidenceScore !== undefined ? options.confidenceScore : 1.0;
        await this.probabilisticKnowledgeManager.addEdgeWithUncertainty(edgeId, sourceId, targetId, type, properties, confidenceScore);
        
        // Add confidence score to metadata
        edgeData.metadata.confidenceScore = confidenceScore;
      }

      // Store edge
      await this.storageAdapter.storeEdge(edgeData);

      // Index edge
      await this.indexManager.indexEdge(edgeId, sourceId, targetId, type, properties);

      // Invalidate cache
      await this.semanticCache.invalidate({ edgeId, sourceId, targetId });

      if (this.logger) {
        this.logger.debug(`Added edge: ${edgeId}`, { sourceId, targetId, type });
      }

      this.emit("edgeAdded", { edgeId, sourceId, targetId, type });
      return edgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add edge: ${error.message}`, { sourceId, targetId, type, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves an edge from the knowledge graph.
   *
   * @param {string} edgeId - ID of the edge to retrieve
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.includeUncertainty=false] - Whether to include uncertainty information
   * @returns {Promise<Object>} - Edge data
   */
  async getEdge(edgeId, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_getEdge");
    }

    try {
      // Check cache first
      const cachedEdge = await this.semanticCache.get({ edgeId });
      if (cachedEdge && !options.includeUncertainty) {
        if (this.logger) {
          this.logger.debug(`Retrieved edge from cache: ${edgeId}`);
        }
        return cachedEdge;
      }

      // Retrieve from storage
      const edge = await this.storageAdapter.retrieveEdge(edgeId);
      if (!edge) {
        throw new Error(`Edge not found: ${edgeId}`);
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyEdgeAccessPolicies) {
        await this.securityManager.applyEdgeAccessPolicies(edge);
      }
      
      // Include uncertainty information if requested
      if (options.includeUncertainty) {
        const uncertaintyInfo = await this.probabilisticKnowledgeManager.getEdgeUncertainty(edgeId);
        if (uncertaintyInfo) {
          edge.uncertainty = uncertaintyInfo;
        }
      }

      // Cache result (only if not including uncertainty)
      if (!options.includeUncertainty) {
        await this.semanticCache.set({ edgeId }, edge);
      }

      if (this.logger) {
        this.logger.debug(`Retrieved edge: ${edgeId}`, { type: edge.type });
      }

      return edge;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to retrieve edge: ${error.message}`, { edgeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Updates an edge in the knowledge graph.
   *
   * @param {string} edgeId - ID of the edge to update
   * @param {Object} properties - Updated edge properties
   * @param {Object} [metadata={}] - Updated edge metadata
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.updateUncertainty=false] - Whether to update uncertainty information
   * @param {number} [options.confidenceScore] - Updated confidence score
   * @returns {Promise<boolean>} - True if successful
   */
  async updateEdge(edgeId, properties, metadata = {}, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_updateEdge");
    }

    try {
      // Get existing edge
      const existingEdge = await this.storageAdapter.retrieveEdge(edgeId);
      if (!existingEdge) {
        throw new Error(`Edge not found: ${edgeId}`);
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyEdgeUpdatePolicies) {
        await this.securityManager.applyEdgeUpdatePolicies(existingEdge, properties, metadata);
      }

      // Prepare update data
      const updateData = {
        properties: { ...properties },
        metadata: { 
          ...existingEdge.metadata,
          ...metadata,
          updatedAt: Date.now()
        }
      };
      
      // Update uncertainty information if requested
      if (options.updateUncertainty) {
        const confidenceScore = options.confidenceScore !== undefined ? options.confidenceScore : 
                               (existingEdge.metadata.confidenceScore || 1.0);
        await this.probabilisticKnowledgeManager.updateEdgeUncertainty(edgeId, properties, confidenceScore);
        
        // Update confidence score in metadata
        updateData.metadata.confidenceScore = confidenceScore;
      }

      // Update edge
      const success = await this.storageAdapter.updateEdgeData(edgeId, updateData);
      if (!success) {
        throw new Error(`Failed to update edge: ${edgeId}`);
      }

      // Update index
      await this.indexManager.updateEdgeIndex(edgeId, existingEdge.sourceId, existingEdge.targetId, existingEdge.type, properties);

      // Invalidate cache
      await this.semanticCache.invalidate({ edgeId, sourceId: existingEdge.sourceId, targetId: existingEdge.targetId });

      if (this.logger) {
        this.logger.debug(`Updated edge: ${edgeId}`, { properties: Object.keys(properties) });
      }

      this.emit("edgeUpdated", { edgeId, properties });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update edge: ${error.message}`, { edgeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Deletes an edge from the knowledge graph.
   *
   * @param {string} edgeId - ID of the edge to delete
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.deleteUncertaintyInfo=true] - Whether to delete associated uncertainty information
   * @returns {Promise<boolean>} - True if successful
   */
  async deleteEdge(edgeId, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_deleteEdge");
    }

    try {
      // Get existing edge
      const existingEdge = await this.storageAdapter.retrieveEdge(edgeId);
      if (!existingEdge) {
        throw new Error(`Edge not found: ${edgeId}`);
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyEdgeDeletePolicies) {
        await this.securityManager.applyEdgeDeletePolicies(existingEdge);
      }
      
      // Delete uncertainty information if requested
      const deleteUncertaintyInfo = options.deleteUncertaintyInfo !== false; // Default to true
      if (deleteUncertaintyInfo) {
        await this.probabilisticKnowledgeManager.deleteEdgeUncertainty(edgeId);
      }

      // Delete edge
      const success = await this.storageAdapter.deleteEdge(edgeId);
      if (!success) {
        throw new Error(`Failed to delete edge: ${edgeId}`);
      }

      // Remove from index
      await this.indexManager.removeEdgeFromIndex(edgeId);

      // Invalidate cache
      await this.semanticCache.invalidate({ edgeId, sourceId: existingEdge.sourceId, targetId: existingEdge.targetId });

      if (this.logger) {
        this.logger.debug(`Deleted edge: ${edgeId}`);
      }

      this.emit("edgeDeleted", { edgeId });
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to delete edge: ${error.message}`, { edgeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  // --- Query Operations ---

  /**
   * Executes a query on the knowledge graph.
   *
   * @param {Object} query - Query object
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Object>} - Query results
   */
  async executeQuery(query, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_executeQuery");
    }

    try {
      // Check cache first
      const cacheKey = JSON.stringify({ query, options });
      const cachedResult = await this.semanticCache.get({ query: cacheKey });
      if (cachedResult) {
        if (this.logger) {
          this.logger.debug("Retrieved query result from cache", { query });
        }
        return cachedResult;
      }

      // Apply security policies
      if (this.securityManager && this.securityManager.applyQuerySecurityPolicies) {
        await this.securityManager.applyQuerySecurityPolicies(query, options);
      }

      // Process query
      const result = await this.queryProcessor.processQuery(query, options);

      // Cache result
      await this.semanticCache.set({ query: cacheKey }, result);

      if (this.logger) {
        this.logger.debug("Executed query", { query, resultCount: result.nodes?.length || 0 });
      }

      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to execute query: ${error.message}`, { query, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Executes an advanced query on the knowledge graph.
   *
   * @param {Object} query - Advanced query object
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Object>} - Query results
   */
  async executeAdvancedQuery(query, options = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_executeAdvancedQuery");
    }

    try {
      // Apply security policies
      if (this.securityManager && this.securityManager.applyQuerySecurityPolicies) {
        await this.securityManager.applyQuerySecurityPolicies(query, options);
      }

      // Process advanced query
      const result = await this.advancedQueryEngine.processQuery(query, options);

      if (this.logger) {
        this.logger.debug("Executed advanced query", { query, resultCount: result.nodes?.length || 0 });
      }

      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to execute advanced query: ${error.message}`, { query, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  // --- Hypergraph Operations ---

  /**
   * Creates a hyperedge connecting multiple nodes.
   *
   * @param {Array<string>} nodeIds - IDs of nodes to connect
   * @param {string} type - Type of the hyperedge
   * @param {Object} [properties={}] - Hyperedge properties
   * @param {Object} [metadata={}] - Hyperedge metadata
   * @returns {Promise<string>} - ID of the newly created hyperedge
   */
  async createHyperedge(nodeIds, type, properties = {}, metadata = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_createHyperedge");
    }

    try {
      const hyperedgeId = await this.hypergraphManager.createHyperedge(nodeIds, type, properties, metadata);

      if (this.logger) {
        this.logger.debug(`Created hyperedge: ${hyperedgeId}`, { nodeIds, type });
      }

      return hyperedgeId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to create hyperedge: ${error.message}`, { nodeIds, type, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves a hyperedge from the knowledge graph.
   *
   * @param {string} hyperedgeId - ID of the hyperedge to retrieve
   * @returns {Promise<Object>} - Hyperedge data
   */
  async getHyperedge(hyperedgeId) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_getHyperedge");
    }

    try {
      const hyperedge = await this.hypergraphManager.getHyperedge(hyperedgeId);

      if (this.logger) {
        this.logger.debug(`Retrieved hyperedge: ${hyperedgeId}`);
      }

      return hyperedge;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to retrieve hyperedge: ${error.message}`, { hyperedgeId, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  // --- Temporal Operations ---

  /**
   * Adds a temporal version of a node.
   *
   * @param {string} nodeId - ID of the base node
   * @param {Object} properties - Node properties for this version
   * @param {number} timestamp - Timestamp for this version
   * @param {Object} [metadata={}] - Version metadata
   * @returns {Promise<string>} - ID of the temporal version
   */
  async addTemporalVersion(nodeId, properties, timestamp, metadata = {}) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_addTemporalVersion");
    }

    try {
      const versionId = await this.temporalManager.addVersion(nodeId, properties, timestamp, metadata);

      if (this.logger) {
        this.logger.debug(`Added temporal version: ${versionId}`, { nodeId, timestamp });
      }

      return versionId;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to add temporal version: ${error.message}`, { nodeId, timestamp, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }

  /**
   * Retrieves a node at a specific point in time.
   *
   * @param {string} nodeId - ID of the node
   * @param {number} timestamp - Timestamp to retrieve
   * @returns {Promise<Object>} - Node data at the specified time
   */
  async getNodeAtTime(nodeId, timestamp) {
    this.ensureInitialized();

    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_getNodeAtTime");
    }

    try {
      const node = await this.temporalManager.getNodeAtTime(nodeId, timestamp);

      if (this.logger) {
        this.logger.debug(`Retrieved node at time: ${nodeId}`, { timestamp });
      }

      return node;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to retrieve node at time: ${error.message}`, { nodeId, timestamp, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  // --- Probabilistic Knowledge Operations ---
  
  /**
   * Gets the confidence score for a node or edge.
   *
   * @param {string} id - ID of the node or edge
   * @param {boolean} [isEdge=false] - Whether the ID refers to an edge
   * @returns {Promise<number>} - Confidence score (0-1)
   */
  async getConfidenceScore(id, isEdge = false) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_getConfidenceScore");
    }
    
    try {
      const result = isEdge 
        ? await this.probabilisticKnowledgeManager.getEdgeConfidence(id)
        : await this.probabilisticKnowledgeManager.getNodeConfidence(id);
      
      if (this.logger) {
        this.logger.debug(`Retrieved confidence score for ${isEdge ? 'edge' : 'node'}: ${id}`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get confidence score: ${error.message}`, { id, isEdge, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Updates the confidence score for a node or edge.
   *
   * @param {string} id - ID of the node or edge
   * @param {number} confidenceScore - New confidence score (0-1)
   * @param {boolean} [isEdge=false] - Whether the ID refers to an edge
   * @returns {Promise<boolean>} - True if successful
   */
  async updateConfidenceScore(id, confidenceScore, isEdge = false) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_updateConfidenceScore");
    }
    
    try {
      const result = isEdge 
        ? await this.probabilisticKnowledgeManager.updateEdgeConfidence(id, confidenceScore)
        : await this.probabilisticKnowledgeManager.updateNodeConfidence(id, confidenceScore);
      
      // Update metadata in the main storage
      const updateData = {
        metadata: {
          confidenceScore,
          updatedAt: Date.now()
        }
      };
      
      if (isEdge) {
        await this.storageAdapter.updateEdgeData(id, updateData);
        await this.semanticCache.invalidate({ edgeId: id });
      } else {
        await this.storageAdapter.updateNodeData(id, updateData);
        await this.semanticCache.invalidate({ nodeId: id });
      }
      
      if (this.logger) {
        this.logger.debug(`Updated confidence score for ${isEdge ? 'edge' : 'node'}: ${id}`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to update confidence score: ${error.message}`, { id, confidenceScore, isEdge, error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds nodes or edges with confidence scores in a specified range.
   *
   * @param {number} minConfidence - Minimum confidence score
   * @param {number} [maxConfidence=1.0] - Maximum confidence score
   * @param {boolean} [edgesOnly=false] - Whether to search for edges only
   * @param {boolean} [nodesOnly=false] - Whether to search for nodes only
   * @returns {Promise<Array<Object>>} - Matching nodes and/or edges with their confidence scores
   */
  async findByConfidence(minConfidence, maxConfidence = 1.0, edgesOnly = false, nodesOnly = false) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_findByConfidence");
    }
    
    try {
      const result = await this.probabilisticKnowledgeManager.findByConfidenceRange(
        minConfidence, 
        maxConfidence,
        edgesOnly,
        nodesOnly
      );
      
      if (this.logger) {
        this.logger.debug(`Found ${result.length} items with confidence between ${minConfidence} and ${maxConfidence}`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find by confidence: ${error.message}`, { 
          minConfidence, 
          maxConfidence, 
          edgesOnly, 
          nodesOnly, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  // --- Graph Neural Network Operations ---
  
  /**
   * Predicts relationships between entities in the knowledge graph.
   *
   * @param {string} headEntityId - ID of the head entity
   * @param {string} [relationId] - Optional relation ID (if provided, predicts tail entities)
   * @param {string} [tailEntityId] - Optional tail entity ID (if provided with headEntityId, predicts relations)
   * @param {Object} [options={}] - Prediction options
   * @returns {Promise<Object>} - Prediction results
   */
  async predictRelationships(headEntityId, relationId, tailEntityId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_predictRelationships");
    }
    
    try {
      const result = await this.graphNeuralNetworkManager.predictRelationships(
        headEntityId,
        relationId,
        tailEntityId,
        options
      );
      
      if (this.logger) {
        this.logger.debug(`Predicted relationships for entity: ${headEntityId}`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to predict relationships: ${error.message}`, { 
          headEntityId, 
          relationId, 
          tailEntityId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Completes a knowledge graph by predicting missing entities or relations.
   *
   * @param {Array<Object>} subgraph - Existing subgraph triples
   * @param {Array<Object>} missingElements - Description of missing elements to predict
   * @param {Object} [options={}] - Completion options
   * @returns {Promise<Object>} - Completion results
   */
  async completeKnowledgeGraph(subgraph, missingElements, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_completeKnowledgeGraph");
    }
    
    try {
      const result = await this.graphNeuralNetworkManager.completeKnowledgeGraph(
        subgraph,
        missingElements,
        options
      );
      
      if (this.logger) {
        this.logger.debug(`Completed knowledge graph with ${subgraph.length} triples and ${missingElements.length} missing elements`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to complete knowledge graph: ${error.message}`, { 
          subgraphSize: subgraph.length, 
          missingElementsCount: missingElements.length, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds similar entities based on embedding similarity.
   *
   * @param {string} entityId - Entity ID
   * @param {Object} [options={}] - Similarity options
   * @returns {Promise<Object>} - Similar entities
   */
  async findSimilarEntities(entityId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_findSimilarEntities");
    }
    
    try {
      const result = await this.graphNeuralNetworkManager.findSimilarEntities(
        entityId,
        options
      );
      
      if (this.logger) {
        this.logger.debug(`Found similar entities for: ${entityId}`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find similar entities: ${error.message}`, { 
          entityId, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Trains a graph neural network model on knowledge graph data.
   *
   * @param {string} modelId - Model ID
   * @param {Array<Object>} trainingData - Training data triples
   * @param {Object} [options={}] - Training options
   * @returns {Promise<Object>} - Training results
   */
  async trainGraphNeuralNetwork(modelId, trainingData, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer("knowledgeGraphManager_trainGraphNeuralNetwork");
    }
    
    try {
      const result = await this.graphNeuralNetworkManager.trainModel(
        modelId,
        trainingData,
        options
      );
      
      if (this.logger) {
        this.logger.debug(`Trained graph neural network model: ${modelId} on ${trainingData.length} triples`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to train graph neural network: ${error.message}`, { 
          modelId, 
          trainingDataSize: trainingData.length, 
          error: error.stack 
        });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

module.exports = KnowledgeGraphManager;
