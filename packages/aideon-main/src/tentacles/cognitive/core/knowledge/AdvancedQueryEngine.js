/**
 * @fileoverview AdvancedQueryEngine for the Knowledge Graph Manager.
 * Provides sophisticated query capabilities including path finding, pattern matching,
 * and semantic similarity search.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');

/**
 * Query complexity levels for performance optimization.
 * @enum {string}
 */
const QueryComplexity = {
  /**
   * Simple queries with direct lookups.
   */
  SIMPLE: 'simple',
  
  /**
   * Moderate complexity queries with basic filtering and sorting.
   */
  MODERATE: 'moderate',
  
  /**
   * Complex queries with joins and aggregations.
   */
  COMPLEX: 'complex',
  
  /**
   * Very complex queries with recursive patterns and advanced analytics.
   */
  VERY_COMPLEX: 'very_complex'
};

/**
 * Provides advanced query capabilities for the knowledge graph.
 */
class AdvancedQueryEngine extends EventEmitter {
  /**
   * Creates a new AdvancedQueryEngine instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   * @param {Object} options.indexManager - Index manager
   * @param {Object} [options.semanticCache] - Semantic cache
   * @param {Object} [options.hypergraphManager] - Hypergraph manager
   * @param {Object} [options.temporalManager] - Temporal manager
   */
  constructor(options = {}) {
    super();
    
    if (!options.storageAdapter) {
      throw new Error('AdvancedQueryEngine requires a storageAdapter instance');
    }
    
    if (!options.indexManager) {
      throw new Error('AdvancedQueryEngine requires an indexManager instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    this.indexManager = options.indexManager;
    this.semanticCache = options.semanticCache;
    this.hypergraphManager = options.hypergraphManager;
    this.temporalManager = options.temporalManager;
    
    this.initialized = false;
  }
  
  /**
   * Initializes the advanced query engine.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing AdvancedQueryEngine');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('advancedQueryEngine_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.advancedQuery', {
          maxPathLength: 10,
          maxRecursionDepth: 5,
          enableSemanticSearch: true,
          maxResultsPerQuery: 1000,
          timeoutMs: 30000, // 30 seconds
          enableQueryOptimization: true
        });
        
        this.config = config;
      } else {
        this.config = {
          maxPathLength: 10,
          maxRecursionDepth: 5,
          enableSemanticSearch: true,
          maxResultsPerQuery: 1000,
          timeoutMs: 30000, // 30 seconds
          enableQueryOptimization: true
        };
      }
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('AdvancedQueryEngine initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('AdvancedQueryEngine initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`AdvancedQueryEngine initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds paths between two nodes.
   * 
   * @param {string} startNodeId - ID of the start node
   * @param {string} endNodeId - ID of the end node
   * @param {Object} [options={}] - Path finding options
   * @param {number} [options.maxLength] - Maximum path length
   * @param {Array<string>} [options.edgeTypes] - Edge types to consider
   * @param {boolean} [options.bidirectional=true] - Whether to use bidirectional search
   * @param {Object} [options.edgeFilter] - Filter for edges
   * @returns {Promise<Array<Object>>} - Found paths
   */
  async findPaths(startNodeId, endNodeId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('advancedQueryEngine_findPaths');
    }
    
    try {
      // Check if nodes exist
      const startNode = await this.storageAdapter.retrieveNode(startNodeId);
      const endNode = await this.storageAdapter.retrieveNode(endNodeId);
      
      if (!startNode || !endNode) {
        throw new Error(`Start node (${startNodeId}) or end node (${endNodeId}) not found`);
      }
      
      // Set up options
      const maxLength = options.maxLength || this.config.maxPathLength;
      const bidirectional = options.bidirectional !== false;
      
      // Check cache first
      if (this.semanticCache) {
        const cacheKey = `path_${startNodeId}_${endNodeId}_${JSON.stringify(options)}`;
        const cachedResult = await this.semanticCache.retrieve(cacheKey);
        if (cachedResult) {
          return cachedResult.result;
        }
      }
      
      // Determine search strategy based on complexity
      let paths;
      if (bidirectional) {
        paths = await this.bidirectionalSearch(startNodeId, endNodeId, maxLength, options);
      } else {
        paths = await this.unidirectionalSearch(startNodeId, endNodeId, maxLength, options);
      }
      
      // Cache result
      if (this.semanticCache && paths.length > 0) {
        const cacheKey = `path_${startNodeId}_${endNodeId}_${JSON.stringify(options)}`;
        await this.semanticCache.store(cacheKey, paths);
      }
      
      if (this.logger) {
        this.logger.debug(`Found ${paths.length} paths from ${startNodeId} to ${endNodeId}`);
      }
      
      return paths;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find paths from ${startNodeId} to ${endNodeId}`, { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Performs a unidirectional search for paths.
   * 
   * @private
   * @param {string} startNodeId - ID of the start node
   * @param {string} endNodeId - ID of the end node
   * @param {number} maxLength - Maximum path length
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} - Found paths
   */
  async unidirectionalSearch(startNodeId, endNodeId, maxLength, options) {
    // Initialize queue with start node
    const queue = [{
      path: [{ id: startNodeId, type: 'node' }],
      visited: new Set([startNodeId])
    }];
    
    const paths = [];
    
    while (queue.length > 0) {
      const { path, visited } = queue.shift();
      const currentNodeId = path[path.length - 1].id;
      
      // Check if we've reached the end node
      if (currentNodeId === endNodeId && path.length > 1) {
        paths.push(this.reconstructPath(path));
        continue;
      }
      
      // Check if we've reached the maximum path length
      if (path.length >= (maxLength * 2) + 1) {
        continue;
      }
      
      // Get outgoing edges
      const outgoingEdges = await this.storageAdapter.queryEdges({ sourceId: currentNodeId });
      
      // Filter edges if needed
      const filteredEdges = this.filterEdges(outgoingEdges, options.edgeTypes, options.edgeFilter);
      
      // Process each edge
      for (const edge of filteredEdges) {
        const targetNodeId = edge.targetId;
        
        // Skip if already visited
        if (visited.has(targetNodeId)) {
          continue;
        }
        
        // Create new path
        const newPath = [...path, { id: edge.id, type: 'edge' }, { id: targetNodeId, type: 'node' }];
        const newVisited = new Set(visited);
        newVisited.add(targetNodeId);
        
        // Add to queue
        queue.push({ path: newPath, visited: newVisited });
      }
    }
    
    return paths;
  }
  
  /**
   * Performs a bidirectional search for paths.
   * 
   * @private
   * @param {string} startNodeId - ID of the start node
   * @param {string} endNodeId - ID of the end node
   * @param {number} maxLength - Maximum path length
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} - Found paths
   */
  async bidirectionalSearch(startNodeId, endNodeId, maxLength, options) {
    // Initialize forward and backward queues
    const forwardQueue = [{
      path: [{ id: startNodeId, type: 'node' }],
      visited: new Set([startNodeId])
    }];
    
    const backwardQueue = [{
      path: [{ id: endNodeId, type: 'node' }],
      visited: new Set([endNodeId])
    }];
    
    // Initialize maps to store paths
    const forwardPaths = new Map();
    const backwardPaths = new Map();
    
    // Initialize result paths
    const paths = [];
    
    // Maximum depth for each direction (half of maxLength)
    const maxDepth = Math.ceil(maxLength / 2);
    
    // Process forward and backward queues alternately
    let forward = true;
    
    while (forwardQueue.length > 0 || backwardQueue.length > 0) {
      // Choose queue to process
      const queue = forward ? forwardQueue : backwardQueue;
      const pathMap = forward ? forwardPaths : backwardPaths;
      const oppositePathMap = forward ? backwardPaths : forwardPaths;
      
      if (queue.length === 0) {
        forward = !forward;
        continue;
      }
      
      const { path, visited } = queue.shift();
      const currentNodeId = path[path.length - 1].id;
      
      // Store path in map
      pathMap.set(currentNodeId, path);
      
      // Check if we've found a connection
      if (oppositePathMap.has(currentNodeId)) {
        const oppositePath = oppositePathMap.get(currentNodeId);
        
        // Combine paths
        let combinedPath;
        if (forward) {
          combinedPath = [...path, ...oppositePath.slice(1).reverse()];
        } else {
          combinedPath = [...oppositePath, ...path.slice(1).reverse()];
        }
        
        paths.push(this.reconstructPath(combinedPath));
        continue;
      }
      
      // Check if we've reached the maximum depth
      if (path.length >= maxDepth * 2 + 1) {
        continue;
      }
      
      // Get edges
      let edges;
      if (forward) {
        edges = await this.storageAdapter.queryEdges({ sourceId: currentNodeId });
      } else {
        edges = await this.storageAdapter.queryEdges({ targetId: currentNodeId });
      }
      
      // Filter edges if needed
      const filteredEdges = this.filterEdges(edges, options.edgeTypes, options.edgeFilter);
      
      // Process each edge
      for (const edge of filteredEdges) {
        const nextNodeId = forward ? edge.targetId : edge.sourceId;
        
        // Skip if already visited
        if (visited.has(nextNodeId)) {
          continue;
        }
        
        // Create new path
        let newPath;
        if (forward) {
          newPath = [...path, { id: edge.id, type: 'edge' }, { id: nextNodeId, type: 'node' }];
        } else {
          newPath = [...path, { id: edge.id, type: 'edge' }, { id: nextNodeId, type: 'node' }];
        }
        
        const newVisited = new Set(visited);
        newVisited.add(nextNodeId);
        
        // Add to queue
        queue.push({ path: newPath, visited: newVisited });
      }
      
      // Switch direction
      forward = !forward;
    }
    
    return paths;
  }
  
  /**
   * Filters edges based on types and custom filter.
   * 
   * @private
   * @param {Array<Object>} edges - Edges to filter
   * @param {Array<string>} [edgeTypes] - Edge types to include
   * @param {Object} [edgeFilter] - Custom edge filter
   * @returns {Array<Object>} - Filtered edges
   */
  filterEdges(edges, edgeTypes, edgeFilter) {
    let filteredEdges = edges;
    
    // Filter by edge types
    if (edgeTypes && edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => edgeTypes.includes(edge.type));
    }
    
    // Apply custom filter
    if (edgeFilter) {
      filteredEdges = filteredEdges.filter(edge => {
        for (const [key, value] of Object.entries(edgeFilter)) {
          if (key.startsWith('properties.')) {
            const propKey = key.substring('properties.'.length);
            if (edge.properties[propKey] !== value) {
              return false;
            }
          } else if (edge[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    return filteredEdges;
  }
  
  /**
   * Reconstructs a path from path elements.
   * 
   * @private
   * @param {Array<Object>} pathElements - Path elements
   * @returns {Object} - Reconstructed path
   */
  async reconstructPath(pathElements) {
    const path = {
      nodes: [],
      edges: [],
      length: Math.floor(pathElements.length / 2)
    };
    
    // Collect node and edge IDs
    const nodeIds = [];
    const edgeIds = [];
    
    for (let i = 0; i < pathElements.length; i++) {
      const element = pathElements[i];
      if (element.type === 'node') {
        nodeIds.push(element.id);
      } else {
        edgeIds.push(element.id);
      }
    }
    
    // Fetch nodes and edges
    const nodePromises = nodeIds.map(id => this.storageAdapter.retrieveNode(id));
    const edgePromises = edgeIds.map(id => this.storageAdapter.retrieveEdge(id));
    
    const [nodes, edges] = await Promise.all([
      Promise.all(nodePromises),
      Promise.all(edgePromises)
    ]);
    
    path.nodes = nodes;
    path.edges = edges;
    
    return path;
  }
  
  /**
   * Finds patterns in the knowledge graph.
   * 
   * @param {Object} pattern - Pattern specification
   * @param {Object} [options={}] - Pattern matching options
   * @returns {Promise<Array<Object>>} - Matching subgraphs
   */
  async findPatterns(pattern, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('advancedQueryEngine_findPatterns');
    }
    
    try {
      // Check cache first
      if (this.semanticCache) {
        const cacheKey = `pattern_${JSON.stringify(pattern)}_${JSON.stringify(options)}`;
        const cachedResult = await this.semanticCache.retrieve(cacheKey);
        if (cachedResult) {
          return cachedResult.result;
        }
      }
      
      // Validate pattern
      this.validatePattern(pattern);
      
      // Determine pattern complexity
      const complexity = this.determinePatternComplexity(pattern);
      
      // Choose matching strategy based on complexity
      let matches;
      if (complexity === QueryComplexity.SIMPLE) {
        matches = await this.simplePatternMatch(pattern, options);
      } else if (complexity === QueryComplexity.MODERATE) {
        matches = await this.moderatePatternMatch(pattern, options);
      } else {
        matches = await this.complexPatternMatch(pattern, options);
      }
      
      // Apply limit
      const limit = options.limit || this.config.maxResultsPerQuery;
      if (matches.length > limit) {
        matches = matches.slice(0, limit);
      }
      
      // Cache result
      if (this.semanticCache && matches.length > 0) {
        const cacheKey = `pattern_${JSON.stringify(pattern)}_${JSON.stringify(options)}`;
        await this.semanticCache.store(cacheKey, matches);
      }
      
      if (this.logger) {
        this.logger.debug(`Found ${matches.length} matches for pattern`);
      }
      
      return matches;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to find patterns', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Validates a pattern specification.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @throws {Error} If the pattern is invalid
   */
  validatePattern(pattern) {
    if (!pattern) {
      throw new Error('Pattern specification is required');
    }
    
    if (!pattern.nodes || !Array.isArray(pattern.nodes) || pattern.nodes.length === 0) {
      throw new Error('Pattern must include at least one node');
    }
    
    if (pattern.edges && !Array.isArray(pattern.edges)) {
      throw new Error('Pattern edges must be an array');
    }
    
    // Validate node references in edges
    if (pattern.edges) {
      for (const edge of pattern.edges) {
        if (!edge.source || !edge.target) {
          throw new Error('Each edge must have source and target properties');
        }
        
        const sourceIndex = edge.source;
        const targetIndex = edge.target;
        
        if (sourceIndex < 0 || sourceIndex >= pattern.nodes.length) {
          throw new Error(`Edge source index ${sourceIndex} is out of bounds`);
        }
        
        if (targetIndex < 0 || targetIndex >= pattern.nodes.length) {
          throw new Error(`Edge target index ${targetIndex} is out of bounds`);
        }
      }
    }
  }
  
  /**
   * Determines the complexity of a pattern.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @returns {QueryComplexity} - Pattern complexity
   */
  determinePatternComplexity(pattern) {
    const nodeCount = pattern.nodes.length;
    const edgeCount = pattern.edges ? pattern.edges.length : 0;
    
    // Check for recursive patterns
    const hasRecursion = pattern.recursive === true;
    
    // Check for complex constraints
    const hasComplexConstraints = pattern.nodes.some(node => 
      node.constraints && Object.keys(node.constraints).some(key => 
        key.includes('$') || key.includes('.')
      )
    );
    
    if (hasRecursion || (nodeCount > 5 && edgeCount > 10)) {
      return QueryComplexity.VERY_COMPLEX;
    } else if (hasComplexConstraints || (nodeCount > 3 && edgeCount > 5)) {
      return QueryComplexity.COMPLEX;
    } else if (nodeCount > 1 && edgeCount > 0) {
      return QueryComplexity.MODERATE;
    } else {
      return QueryComplexity.SIMPLE;
    }
  }
  
  /**
   * Performs simple pattern matching.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @param {Object} options - Matching options
   * @returns {Promise<Array<Object>>} - Matching subgraphs
   */
  async simplePatternMatch(pattern, options) {
    // For simple patterns (single node or node-edge-node)
    const matches = [];
    
    // Start with the first node
    const startNodePattern = pattern.nodes[0];
    const startNodes = await this.findMatchingNodes(startNodePattern);
    
    if (pattern.nodes.length === 1) {
      // Single node pattern
      return startNodes.map(node => ({
        nodes: [node],
        edges: []
      }));
    }
    
    // Node-edge-node pattern
    if (pattern.nodes.length === 2 && pattern.edges && pattern.edges.length === 1) {
      const edge = pattern.edges[0];
      const endNodePattern = pattern.nodes[1];
      
      for (const startNode of startNodes) {
        // Find edges from start node
        const edgeConstraints = edge.constraints || {};
        const edges = await this.storageAdapter.queryEdges({
          sourceId: startNode.id,
          ...edgeConstraints
        });
        
        for (const matchedEdge of edges) {
          // Check if target node matches pattern
          const endNode = await this.storageAdapter.retrieveNode(matchedEdge.targetId);
          if (this.nodeMatchesPattern(endNode, endNodePattern)) {
            matches.push({
              nodes: [startNode, endNode],
              edges: [matchedEdge]
            });
          }
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Performs moderate complexity pattern matching.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @param {Object} options - Matching options
   * @returns {Promise<Array<Object>>} - Matching subgraphs
   */
  async moderatePatternMatch(pattern, options) {
    // For moderate patterns (small subgraphs)
    const matches = [];
    
    // Start with the most constrained node
    const startNodeIndex = this.findMostConstrainedNodeIndex(pattern);
    const startNodePattern = pattern.nodes[startNodeIndex];
    const startNodes = await this.findMatchingNodes(startNodePattern);
    
    // For each start node, expand the pattern
    for (const startNode of startNodes) {
      const match = {
        nodes: Array(pattern.nodes.length).fill(null),
        edges: []
      };
      
      match.nodes[startNodeIndex] = startNode;
      
      // Expand pattern from start node
      const expanded = await this.expandPattern(pattern, match, startNodeIndex, new Set([startNodeIndex]));
      
      if (expanded) {
        matches.push(match);
      }
      
      // Check if we've reached the limit
      if (matches.length >= (options.limit || this.config.maxResultsPerQuery)) {
        break;
      }
    }
    
    return matches;
  }
  
  /**
   * Performs complex pattern matching.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @param {Object} options - Matching options
   * @returns {Promise<Array<Object>>} - Matching subgraphs
   */
  async complexPatternMatch(pattern, options) {
    // For complex patterns, use a more sophisticated approach
    // This is a simplified implementation; a real one would use more advanced algorithms
    
    // Start with the most constrained node
    const startNodeIndex = this.findMostConstrainedNodeIndex(pattern);
    const startNodePattern = pattern.nodes[startNodeIndex];
    
    // Find candidate start nodes
    const startNodes = await this.findMatchingNodes(startNodePattern);
    
    // Initialize matches
    const matches = [];
    
    // For each start node, try to match the pattern
    for (const startNode of startNodes) {
      // Initialize match with start node
      const match = {
        nodes: Array(pattern.nodes.length).fill(null),
        edges: []
      };
      
      match.nodes[startNodeIndex] = startNode;
      
      // Use backtracking to find matches
      await this.backtrackingMatch(pattern, match, new Set([startNodeIndex]), matches, options);
      
      // Check if we've reached the limit
      if (matches.length >= (options.limit || this.config.maxResultsPerQuery)) {
        break;
      }
    }
    
    return matches;
  }
  
  /**
   * Finds the index of the most constrained node in a pattern.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @returns {number} - Index of the most constrained node
   */
  findMostConstrainedNodeIndex(pattern) {
    let maxConstraints = -1;
    let maxIndex = 0;
    
    for (let i = 0; i < pattern.nodes.length; i++) {
      const node = pattern.nodes[i];
      const constraintCount = node.constraints ? Object.keys(node.constraints).length : 0;
      
      if (constraintCount > maxConstraints) {
        maxConstraints = constraintCount;
        maxIndex = i;
      }
    }
    
    return maxIndex;
  }
  
  /**
   * Finds nodes matching a pattern.
   * 
   * @private
   * @param {Object} nodePattern - Node pattern
   * @returns {Promise<Array<Object>>} - Matching nodes
   */
  async findMatchingNodes(nodePattern) {
    const constraints = nodePattern.constraints || {};
    return await this.storageAdapter.queryNodes(constraints);
  }
  
  /**
   * Checks if a node matches a pattern.
   * 
   * @private
   * @param {Object} node - Node to check
   * @param {Object} pattern - Node pattern
   * @returns {boolean} - Whether the node matches the pattern
   */
  nodeMatchesPattern(node, pattern) {
    const constraints = pattern.constraints || {};
    
    for (const [key, value] of Object.entries(constraints)) {
      if (key.startsWith('properties.')) {
        const propKey = key.substring('properties.'.length);
        if (node.properties[propKey] !== value) {
          return false;
        }
      } else if (node[key] !== value) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Expands a pattern from a node.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @param {Object} match - Current match
   * @param {number} currentNodeIndex - Index of the current node
   * @param {Set<number>} matched - Set of matched node indices
   * @returns {Promise<boolean>} - Whether the expansion was successful
   */
  async expandPattern(pattern, match, currentNodeIndex, matched) {
    // If all nodes are matched, we're done
    if (matched.size === pattern.nodes.length) {
      return true;
    }
    
    // Find edges connected to the current node
    const connectedEdges = [];
    
    if (pattern.edges) {
      for (let i = 0; i < pattern.edges.length; i++) {
        const edge = pattern.edges[i];
        
        if (edge.source === currentNodeIndex && !matched.has(edge.target)) {
          connectedEdges.push({ edgeIndex: i, nodeIndex: edge.target, isOutgoing: true });
        } else if (edge.target === currentNodeIndex && !matched.has(edge.source)) {
          connectedEdges.push({ edgeIndex: i, nodeIndex: edge.source, isOutgoing: false });
        }
      }
    }
    
    // Try each connected edge
    for (const { edgeIndex, nodeIndex, isOutgoing } of connectedEdges) {
      const edgePattern = pattern.edges[edgeIndex];
      const nodePattern = pattern.nodes[nodeIndex];
      
      // Find edges from current node
      const currentNode = match.nodes[currentNodeIndex];
      const edgeConstraints = edgePattern.constraints || {};
      
      const edges = isOutgoing ?
        await this.storageAdapter.queryEdges({
          sourceId: currentNode.id,
          ...edgeConstraints
        }) :
        await this.storageAdapter.queryEdges({
          targetId: currentNode.id,
          ...edgeConstraints
        });
      
      // Try each edge
      for (const edge of edges) {
        // Get the connected node
        const connectedNodeId = isOutgoing ? edge.targetId : edge.sourceId;
        const connectedNode = await this.storageAdapter.retrieveNode(connectedNodeId);
        
        // Check if node matches pattern
        if (this.nodeMatchesPattern(connectedNode, nodePattern)) {
          // Update match
          match.nodes[nodeIndex] = connectedNode;
          match.edges.push(edge);
          matched.add(nodeIndex);
          
          // Recursively expand from the new node
          const success = await this.expandPattern(pattern, match, nodeIndex, matched);
          
          if (success) {
            return true;
          }
          
          // Backtrack
          match.nodes[nodeIndex] = null;
          match.edges.pop();
          matched.delete(nodeIndex);
        }
      }
    }
    
    return false;
  }
  
  /**
   * Uses backtracking to find pattern matches.
   * 
   * @private
   * @param {Object} pattern - Pattern specification
   * @param {Object} match - Current match
   * @param {Set<number>} matched - Set of matched node indices
   * @param {Array<Object>} matches - Array to store found matches
   * @param {Object} options - Matching options
   * @returns {Promise<void>}
   */
  async backtrackingMatch(pattern, match, matched, matches, options) {
    // If all nodes are matched, we've found a match
    if (matched.size === pattern.nodes.length) {
      matches.push({
        nodes: [...match.nodes],
        edges: [...match.edges]
      });
      return;
    }
    
    // Find an unmatched node that's connected to a matched node
    let nextNodeIndex = -1;
    let connectedNodeIndex = -1;
    let edgePattern = null;
    let isOutgoing = false;
    
    if (pattern.edges) {
      for (const edge of pattern.edges) {
        if (matched.has(edge.source) && !matched.has(edge.target)) {
          nextNodeIndex = edge.target;
          connectedNodeIndex = edge.source;
          edgePattern = edge;
          isOutgoing = true;
          break;
        } else if (matched.has(edge.target) && !matched.has(edge.source)) {
          nextNodeIndex = edge.source;
          connectedNodeIndex = edge.target;
          edgePattern = edge;
          isOutgoing = false;
          break;
        }
      }
    }
    
    // If no connected unmatched node, try any unmatched node
    if (nextNodeIndex === -1) {
      for (let i = 0; i < pattern.nodes.length; i++) {
        if (!matched.has(i)) {
          nextNodeIndex = i;
          break;
        }
      }
    }
    
    // Get the node pattern
    const nodePattern = pattern.nodes[nextNodeIndex];
    
    // Find candidate nodes
    let candidateNodes;
    
    if (connectedNodeIndex !== -1) {
      // Find nodes connected to the matched node
      const connectedNode = match.nodes[connectedNodeIndex];
      const edgeConstraints = edgePattern.constraints || {};
      
      const edges = isOutgoing ?
        await this.storageAdapter.queryEdges({
          sourceId: connectedNode.id,
          ...edgeConstraints
        }) :
        await this.storageAdapter.queryEdges({
          targetId: connectedNode.id,
          ...edgeConstraints
        });
      
      // Get connected nodes
      const nodeIds = edges.map(edge => isOutgoing ? edge.targetId : edge.sourceId);
      const nodePromises = nodeIds.map(id => this.storageAdapter.retrieveNode(id));
      candidateNodes = await Promise.all(nodePromises);
      
      // Filter by pattern
      candidateNodes = candidateNodes.filter(node => 
        node && this.nodeMatchesPattern(node, nodePattern)
      );
    } else {
      // Find all matching nodes
      candidateNodes = await this.findMatchingNodes(nodePattern);
    }
    
    // Try each candidate
    for (const node of candidateNodes) {
      // Check if node is already used in the match
      if (match.nodes.some(n => n && n.id === node.id)) {
        continue;
      }
      
      // Update match
      match.nodes[nextNodeIndex] = node;
      matched.add(nextNodeIndex);
      
      // If we have a connected node, add the edge
      if (connectedNodeIndex !== -1) {
        const connectedNode = match.nodes[connectedNodeIndex];
        
        // Find the edge between the nodes
        const edge = isOutgoing ?
          await this.storageAdapter.queryEdges({
            sourceId: connectedNode.id,
            targetId: node.id
          }).then(edges => edges[0]) :
          await this.storageAdapter.queryEdges({
            sourceId: node.id,
            targetId: connectedNode.id
          }).then(edges => edges[0]);
        
        if (edge) {
          match.edges.push(edge);
        }
      }
      
      // Recursively continue matching
      await this.backtrackingMatch(pattern, match, matched, matches, options);
      
      // Check if we've reached the limit
      if (matches.length >= (options.limit || this.config.maxResultsPerQuery)) {
        return;
      }
      
      // Backtrack
      match.nodes[nextNodeIndex] = null;
      matched.delete(nextNodeIndex);
      
      if (connectedNodeIndex !== -1 && match.edges.length > 0) {
        match.edges.pop();
      }
    }
  }
  
  /**
   * Performs semantic similarity search.
   * 
   * @param {Object} query - Semantic query
   * @param {Object} [options={}] - Search options
   * @returns {Promise<Array<Object>>} - Search results
   */
  async semanticSearch(query, options = {}) {
    this.ensureInitialized();
    
    if (!this.config.enableSemanticSearch) {
      throw new Error('Semantic search is not enabled in the configuration');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('advancedQueryEngine_semanticSearch');
    }
    
    try {
      // Check cache first
      if (this.semanticCache) {
        const cacheKey = `semantic_${JSON.stringify(query)}_${JSON.stringify(options)}`;
        const cachedResult = await this.semanticCache.retrieve(cacheKey);
        if (cachedResult) {
          return cachedResult.result;
        }
      }
      
      // Validate query
      if (!query.text && !query.embedding && !query.nodeId) {
        throw new Error('Semantic query must include text, embedding, or nodeId');
      }
      
      let results;
      
      if (query.nodeId) {
        // Find similar nodes to the given node
        results = await this.findSimilarNodes(query.nodeId, options);
      } else if (query.embedding) {
        // Search by embedding
        results = await this.searchByEmbedding(query.embedding, options);
      } else {
        // Search by text
        results = await this.searchByText(query.text, options);
      }
      
      // Cache result
      if (this.semanticCache && results.length > 0) {
        const cacheKey = `semantic_${JSON.stringify(query)}_${JSON.stringify(options)}`;
        await this.semanticCache.store(cacheKey, results);
      }
      
      if (this.logger) {
        this.logger.debug(`Found ${results.length} results for semantic search`);
      }
      
      return results;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to perform semantic search', { error: error.message, stack: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Finds nodes similar to a given node.
   * 
   * @private
   * @param {string} nodeId - ID of the reference node
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} - Similar nodes
   */
  async findSimilarNodes(nodeId, options) {
    // Get the reference node
    const node = await this.storageAdapter.retrieveNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Check if node has an embedding
    if (!node.embedding) {
      throw new Error(`Node ${nodeId} does not have an embedding`);
    }
    
    // Search by embedding
    return await this.searchByEmbedding(node.embedding, options);
  }
  
  /**
   * Searches for nodes by embedding.
   * 
   * @private
   * @param {Array<number>} embedding - Vector embedding
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} - Search results
   */
  async searchByEmbedding(embedding, options) {
    // This would typically use a vector index for efficient search
    // For now, we'll use a simple approach
    
    // Check if we have a vector index
    const vectorIndexes = await this.indexManager.getVectorIndexes();
    
    if (vectorIndexes.length > 0) {
      // Use the first vector index
      const indexName = vectorIndexes[0].name;
      
      // Search using the index
      const results = await this.indexManager.searchVectorIndex(
        indexName,
        embedding,
        options.limit || 10,
        options.threshold || 0.7
      );
      
      // Fetch the nodes
      const nodePromises = results.map(result => 
        this.storageAdapter.retrieveNode(result.id)
      );
      
      const nodes = await Promise.all(nodePromises);
      
      // Add similarity scores
      return nodes.map((node, i) => ({
        node,
        similarity: results[i].similarity
      }));
    } else {
      // No vector index, use a fallback approach
      if (this.logger) {
        this.logger.warn('No vector index available for semantic search, using fallback approach');
      }
      
      // Get all nodes (inefficient, but works for demonstration)
      const allNodes = await this.storageAdapter.queryNodes({});
      
      // Filter nodes with embeddings
      const nodesWithEmbeddings = allNodes.filter(node => node.embedding);
      
      // Calculate similarities
      const results = nodesWithEmbeddings.map(node => ({
        node,
        similarity: this.cosineSimilarity(embedding, node.embedding)
      }));
      
      // Sort by similarity (descending)
      results.sort((a, b) => b.similarity - a.similarity);
      
      // Apply threshold
      const threshold = options.threshold || 0.7;
      const filteredResults = results.filter(result => result.similarity >= threshold);
      
      // Apply limit
      const limit = options.limit || 10;
      return filteredResults.slice(0, limit);
    }
  }
  
  /**
   * Searches for nodes by text.
   * 
   * @private
   * @param {string} text - Search text
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} - Search results
   */
  async searchByText(text, options) {
    // This would typically generate an embedding from the text
    // and then search by embedding
    // For now, we'll use a simple text search approach
    
    // Check if we have a full-text index
    const fullTextIndexes = await this.indexManager.getFullTextIndexes();
    
    if (fullTextIndexes.length > 0) {
      // Use the first full-text index
      const indexName = fullTextIndexes[0].name;
      
      // Search using the index
      const results = await this.indexManager.searchFullTextIndex(
        indexName,
        text,
        options.limit || 10
      );
      
      // Fetch the nodes
      const nodePromises = results.map(result => 
        this.storageAdapter.retrieveNode(result.id)
      );
      
      const nodes = await Promise.all(nodePromises);
      
      // Add relevance scores
      return nodes.map((node, i) => ({
        node,
        relevance: results[i].score
      }));
    } else {
      // No full-text index, use a fallback approach
      if (this.logger) {
        this.logger.warn('No full-text index available for text search, using fallback approach');
      }
      
      // Get all nodes (inefficient, but works for demonstration)
      const allNodes = await this.storageAdapter.queryNodes({});
      
      // Simple text matching
      const results = [];
      
      for (const node of allNodes) {
        let score = 0;
        
        // Check node properties for text matches
        for (const [key, value] of Object.entries(node.properties)) {
          if (typeof value === 'string' && value.toLowerCase().includes(text.toLowerCase())) {
            score += 1;
          }
        }
        
        if (score > 0) {
          results.push({
            node,
            relevance: score
          });
        }
      }
      
      // Sort by relevance (descending)
      results.sort((a, b) => b.relevance - a.relevance);
      
      // Apply limit
      const limit = options.limit || 10;
      return results.slice(0, limit);
    }
  }
  
  /**
   * Calculates cosine similarity between two vectors.
   * 
   * @private
   * @param {Array<number>} a - First vector
   * @param {Array<number>} b - Second vector
   * @returns {number} - Cosine similarity
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Ensures the engine is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the engine is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('AdvancedQueryEngine is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Shuts down the advanced query engine.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down AdvancedQueryEngine');
    }
    
    this.initialized = false;
    
    this.emit('shutdown');
  }
}

module.exports = { AdvancedQueryEngine, QueryComplexity };
