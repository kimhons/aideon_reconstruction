/**
 * AssociativeMemoryNetworks.js
 * 
 * Manages the associative memory networks for the Enhanced Memory Tentacle.
 * Provides storage and retrieval of associative connections between concepts.
 * 
 * @module tentacles/memory/components/AssociativeMemoryNetworks
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { Logger } = require('../../../utils/Logger');

/**
 * Associative Memory Networks implementation
 * @class AssociativeMemoryNetworks
 * @extends EventEmitter
 */
class AssociativeMemoryNetworks extends EventEmitter {
  /**
   * Create a new Associative Memory Networks
   * @constructor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = new Logger('AssociativeMemoryNetworks');
    
    this.options = {
      dataPath: options.dataPath || 'data/test/memory/associative/associative_network.json',
      persistData: options.persistData !== false,
      ...options
    };
    
    // Associative network structure
    this.associativeNetwork = {
      nodes: {},
      edges: {},
      patterns: {}
    };
    
    this.logger.info('Associative Memory Networks initialized');
  }

  /**
   * Initialize the Associative Memory Networks
   * @async
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    try {
      // Load associative network if persistence is enabled
      if (this.options.persistData) {
        await this.loadAssociativeNetwork();
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Associative Memory Networks', error);
      throw error;
    }
  }

  /**
   * Load associative network from persistent storage
   * @async
   * @returns {Promise<boolean>} Load success
   */
  async loadAssociativeNetwork() {
    try {
      // Ensure directory exists before attempting to read/write
      const dirPath = path.dirname(this.options.dataPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      try {
        const data = await fs.readFile(this.options.dataPath, 'utf8');
        
        // Add robust JSON parsing with error recovery
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (parseError) {
          this.logger.error('Error parsing associative network JSON, creating new file', parseError);
          // If JSON is corrupted, create a new file with empty network
          parsed = {
            nodes: {},
            edges: {},
            patterns: {}
          };
          this.associativeNetwork = parsed;
          await this.saveAssociativeNetwork();
          return true;
        }
        
        this.associativeNetwork = parsed;
        
        this.logger.debug(`Loaded associative network with ${Object.keys(this.associativeNetwork.nodes).length} nodes and ${Object.keys(this.associativeNetwork.edges).length} edges`);
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          // File doesn't exist yet, create it with empty network
          await this.saveAssociativeNetwork();
          this.logger.debug('Created new associative network file');
        } else {
          this.logger.error('Error reading associative network file, creating new file', readError);
          // Initialize with empty data and create new file
          this.associativeNetwork = {
            nodes: {},
            edges: {},
            patterns: {}
          };
          await this.saveAssociativeNetwork();
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to load associative network, initializing with empty state', error);
      // Recover by initializing with empty state instead of throwing
      this.associativeNetwork = {
        nodes: {},
        edges: {},
        patterns: {}
      };
      await this.saveAssociativeNetwork();
      return true;
    }
  }

  /**
   * Save associative network to persistent storage
   * @async
   * @returns {Promise<boolean>} Save success
   */
  async saveAssociativeNetwork() {
    try {
      // Ensure directory exists before writing file
      const dirPath = path.dirname(this.options.dataPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      await fs.writeFile(
        this.options.dataPath,
        JSON.stringify(this.associativeNetwork, null, 2)
      );
      this.logger.debug(`Saved associative network with ${Object.keys(this.associativeNetwork.nodes).length} nodes and ${Object.keys(this.associativeNetwork.edges).length} edges`);
      return true;
    } catch (error) {
      this.logger.error('Failed to save associative network', error);
      throw error;
    }
  }

  /**
   * Add a node to the associative network
   * @async
   * @param {string} nodeId - Node ID
   * @param {Object} nodeData - Node data
   * @returns {Promise<Object>} Added node
   */
  async addNode(nodeId, nodeData) {
    // Create node
    const node = {
      id: nodeId,
      ...nodeData,
      timestamp: Date.now()
    };
    
    // Add to network
    this.associativeNetwork.nodes[nodeId] = node;
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveAssociativeNetwork();
    }
    
    // Emit node added event
    this.emit('node-added', node);
    
    this.logger.debug(`Added node: ${nodeId}`);
    
    return node;
  }

  /**
   * Get a node from the associative network
   * @param {string} nodeId - Node ID
   * @returns {Object} Node
   */
  getNode(nodeId) {
    return this.associativeNetwork.nodes[nodeId];
  }

  /**
   * Update a node in the associative network
   * @async
   * @param {string} nodeId - Node ID
   * @param {Object} updates - Node updates
   * @returns {Promise<Object>} Updated node
   */
  async updateNode(nodeId, updates) {
    // Check if node exists
    if (!this.associativeNetwork.nodes[nodeId]) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    // Update node
    const updatedNode = {
      ...this.associativeNetwork.nodes[nodeId],
      ...updates,
      lastUpdated: Date.now()
    };
    
    this.associativeNetwork.nodes[nodeId] = updatedNode;
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveAssociativeNetwork();
    }
    
    // Emit node updated event
    this.emit('node-updated', updatedNode);
    
    this.logger.debug(`Updated node: ${nodeId}`);
    
    return updatedNode;
  }

  /**
   * Remove a node from the associative network
   * @async
   * @param {string} nodeId - Node ID
   * @returns {Promise<boolean>} Removal success
   */
  async removeNode(nodeId) {
    // Check if node exists
    if (!this.associativeNetwork.nodes[nodeId]) {
      return false;
    }
    
    // Remove node
    delete this.associativeNetwork.nodes[nodeId];
    
    // Remove connected edges
    const edgesToRemove = [];
    
    for (const edgeId in this.associativeNetwork.edges) {
      const edge = this.associativeNetwork.edges[edgeId];
      
      if (edge.source === nodeId || edge.target === nodeId) {
        edgesToRemove.push(edgeId);
      }
    }
    
    for (const edgeId of edgesToRemove) {
      delete this.associativeNetwork.edges[edgeId];
    }
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveAssociativeNetwork();
    }
    
    // Emit node removed event
    this.emit('node-removed', { id: nodeId, edgesRemoved: edgesToRemove.length });
    
    this.logger.debug(`Removed node: ${nodeId} and ${edgesToRemove.length} connected edges`);
    
    return true;
  }

  /**
   * Add an edge to the associative network
   * @async
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {Object} edgeData - Edge data
   * @returns {Promise<Object>} Added edge
   */
  async addEdge(sourceId, targetId, edgeData = {}) {
    // Check if nodes exist
    if (!this.associativeNetwork.nodes[sourceId]) {
      throw new Error(`Source node not found: ${sourceId}`);
    }
    
    if (!this.associativeNetwork.nodes[targetId]) {
      throw new Error(`Target node not found: ${targetId}`);
    }
    
    // Generate edge ID
    const edgeId = `edge-${sourceId}-${targetId}-${Date.now()}`;
    
    // Create edge
    const edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: edgeData.type || 'association',
      weight: edgeData.weight || 1.0,
      ...edgeData,
      timestamp: Date.now()
    };
    
    // Add to network
    this.associativeNetwork.edges[edgeId] = edge;
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveAssociativeNetwork();
    }
    
    // Emit edge added event
    this.emit('edge-added', edge);
    
    this.logger.debug(`Added edge: ${edgeId} (${sourceId} -> ${targetId})`);
    
    return edge;
  }

  /**
   * Get an edge from the associative network
   * @param {string} edgeId - Edge ID
   * @returns {Object} Edge
   */
  getEdge(edgeId) {
    return this.associativeNetwork.edges[edgeId];
  }

  /**
   * Update an edge in the associative network
   * @async
   * @param {string} edgeId - Edge ID
   * @param {Object} updates - Edge updates
   * @returns {Promise<Object>} Updated edge
   */
  async updateEdge(edgeId, updates) {
    // Check if edge exists
    if (!this.associativeNetwork.edges[edgeId]) {
      throw new Error(`Edge not found: ${edgeId}`);
    }
    
    // Update edge
    const updatedEdge = {
      ...this.associativeNetwork.edges[edgeId],
      ...updates,
      lastUpdated: Date.now()
    };
    
    this.associativeNetwork.edges[edgeId] = updatedEdge;
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveAssociativeNetwork();
    }
    
    // Emit edge updated event
    this.emit('edge-updated', updatedEdge);
    
    this.logger.debug(`Updated edge: ${edgeId}`);
    
    return updatedEdge;
  }

  /**
   * Remove an edge from the associative network
   * @async
   * @param {string} edgeId - Edge ID
   * @returns {Promise<boolean>} Removal success
   */
  async removeEdge(edgeId) {
    // Check if edge exists
    if (!this.associativeNetwork.edges[edgeId]) {
      return false;
    }
    
    // Remove edge
    delete this.associativeNetwork.edges[edgeId];
    
    // Persist changes if enabled
    if (this.options.persistData) {
      await this.saveAssociativeNetwork();
    }
    
    // Emit edge removed event
    this.emit('edge-removed', { id: edgeId });
    
    this.logger.debug(`Removed edge: ${edgeId}`);
    
    return true;
  }

  /**
   * Find edges between nodes
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {Object} options - Search options
   * @returns {Array<Object>} Matching edges
   */
  findEdges(sourceId, targetId, options = {}) {
    const edges = [];
    
    for (const edgeId in this.associativeNetwork.edges) {
      const edge = this.associativeNetwork.edges[edgeId];
      
      // Check if edge connects the specified nodes
      if (edge.source === sourceId && edge.target === targetId) {
        edges.push(edge);
      }
      
      // Check reverse direction if bidirectional search is enabled
      if (options.bidirectional && edge.source === targetId && edge.target === sourceId) {
        edges.push(edge);
      }
    }
    
    return edges;
  }

  /**
   * Find connected nodes
   * @param {string} nodeId - Node ID
   * @param {Object} options - Search options
   * @returns {Array<Object>} Connected nodes
   */
  findConnectedNodes(nodeId, options = {}) {
    const connectedNodes = [];
    const nodeIds = new Set();
    
    // Find all edges connected to the node
    for (const edgeId in this.associativeNetwork.edges) {
      const edge = this.associativeNetwork.edges[edgeId];
      
      // Check outgoing connections
      if (edge.source === nodeId) {
        const targetNode = this.associativeNetwork.nodes[edge.target];
        
        if (targetNode && !nodeIds.has(targetNode.id)) {
          nodeIds.add(targetNode.id);
          connectedNodes.push({
            node: targetNode,
            edge,
            direction: 'outgoing'
          });
        }
      }
      
      // Check incoming connections
      if (edge.target === nodeId) {
        const sourceNode = this.associativeNetwork.nodes[edge.source];
        
        if (sourceNode && !nodeIds.has(sourceNode.id)) {
          nodeIds.add(sourceNode.id);
          connectedNodes.push({
            node: sourceNode,
            edge,
            direction: 'incoming'
          });
        }
      }
    }
    
    // Apply filters
    let filteredNodes = connectedNodes;
    
    // Filter by edge type
    if (options.edgeType) {
      filteredNodes = filteredNodes.filter(item => item.edge.type === options.edgeType);
    }
    
    // Filter by direction
    if (options.direction) {
      filteredNodes = filteredNodes.filter(item => item.direction === options.direction);
    }
    
    // Sort by edge weight (highest first)
    filteredNodes.sort((a, b) => b.edge.weight - a.edge.weight);
    
    // Apply limit
    if (options.limit) {
      filteredNodes = filteredNodes.slice(0, options.limit);
    }
    
    return filteredNodes;
  }

  /**
   * Add a concept to the associative network
   * @async
   * @param {Object} concept - Concept to add
   * @returns {Promise<Object>} Added concept
   */
  async addConcept(concept) {
    // Generate concept ID if not provided
    if (!concept.id) {
      concept.id = `concept-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Add as node
    return this.addNode(concept.id, concept);
  }
  
  /**
   * Spread activation through the associative network
   * @async
   * @param {string} sourceNodeId - Source node ID to start activation from
   * @param {Object} options - Activation options
   * @returns {Promise<Array<Object>>} Activated nodes
   */
  async spreadActivation(sourceNodeId, options = {}) {
    // Check if source node exists
    if (!this.associativeNetwork.nodes[sourceNodeId]) {
      throw new Error(`Source node not found: ${sourceNodeId}`);
    }
    
    const activationOptions = {
      maxDepth: options.maxDepth || 2,
      decayFactor: options.decayFactor || 0.5,
      activationThreshold: options.activationThreshold || 0.1,
      maxNodes: options.maxNodes || 20,
      ...options
    };
    
    // Initialize activation values
    const activationValues = new Map();
    activationValues.set(sourceNodeId, 1.0);
    
    // Initialize visited nodes
    const visitedNodes = new Set([sourceNodeId]);
    
    // Initialize queue with source node
    const queue = [{
      nodeId: sourceNodeId,
      depth: 0,
      activation: 1.0
    }];
    
    // Initialize result nodes
    const activatedNodes = [{
      node: this.associativeNetwork.nodes[sourceNodeId],
      activation: 1.0
    }];
    
    // Spread activation
    while (queue.length > 0 && activatedNodes.length < activationOptions.maxNodes) {
      const current = queue.shift();
      
      // Skip if max depth reached
      if (current.depth >= activationOptions.maxDepth) {
        continue;
      }
      
      // Find connected nodes
      const connectedEdges = Object.values(this.associativeNetwork.edges).filter(edge => 
        edge.source === current.nodeId || edge.target === current.nodeId
      );
      
      for (const edge of connectedEdges) {
        // Determine target node
        const targetNodeId = edge.source === current.nodeId ? edge.target : edge.source;
        
        // Skip if already visited
        if (visitedNodes.has(targetNodeId)) {
          continue;
        }
        
        // Calculate edge weight
        const edgeWeight = edge.weight || 1.0;
        
        // Calculate activation
        const newActivation = current.ac
(Content truncated due to size limit. Use line ranges to read in chunks)