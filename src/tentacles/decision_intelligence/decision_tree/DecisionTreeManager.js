/**
 * @fileoverview Decision Tree Manager for the Decision Intelligence Tentacle
 * 
 * This component is responsible for creating, visualizing, and managing decision trees
 * for complex decision-making scenarios.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Decision Tree Manager for the Decision Intelligence Tentacle
 */
class DecisionTreeManager {
  /**
   * Creates a new instance of the Decision Tree Manager
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('DecisionTreeManager');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      maxTreeDepth: config.maxTreeDepth || 10,
      maxNodesPerTree: config.maxNodesPerTree || 100,
      defaultProbabilityThreshold: config.defaultProbabilityThreshold || 0.1,
      storageEnabled: config.storageEnabled !== undefined ? config.storageEnabled : true,
      ...config
    };
    
    // Storage for decision trees
    this.trees = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.createTree = this.createTree.bind(this);
    this.getTree = this.getTree.bind(this);
    this.updateTree = this.updateTree.bind(this);
    this.deleteTree = this.deleteTree.bind(this);
    this.listTrees = this.listTrees.bind(this);
    this.evaluateTree = this.evaluateTree.bind(this);
    this.visualizeTree = this.visualizeTree.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Decision Tree Manager
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Decision Tree Manager');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Load saved trees if storage is enabled
      if (this.config.storageEnabled) {
        await this._loadSavedTrees();
      }
      
      this.initialized = true;
      this.logger.info('Decision Tree Manager initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'decisionTreeManager' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('decisionTreeManager');
      
      if (config) {
        this.config.maxTreeDepth = config.get('maxTreeDepth') || this.config.maxTreeDepth;
        this.config.maxNodesPerTree = config.get('maxNodesPerTree') || this.config.maxNodesPerTree;
        this.config.defaultProbabilityThreshold = config.get('defaultProbabilityThreshold') || this.config.defaultProbabilityThreshold;
        this.config.storageEnabled = config.get('storageEnabled') !== undefined ? config.get('storageEnabled') : this.config.storageEnabled;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Loads saved decision trees from storage
   * @private
   * @returns {Promise<void>} A promise that resolves when trees are loaded
   */
  async _loadSavedTrees() {
    if (!this.aideon || !this.aideon.storage) {
      this.logger.warn('Storage service not available, skipping tree loading');
      return;
    }
    
    try {
      this.logger.info('Loading saved decision trees');
      
      const savedTrees = await this.aideon.storage.getNamespace('decisionTrees').getAll();
      
      if (savedTrees && Object.keys(savedTrees).length > 0) {
        for (const [id, treeData] of Object.entries(savedTrees)) {
          this.trees.set(id, treeData);
        }
        
        this.logger.info(`Loaded ${this.trees.size} decision trees`);
      } else {
        this.logger.info('No saved decision trees found');
      }
    } catch (error) {
      this.logger.error('Failed to load saved trees', error);
      // Continue initialization even if loading fails
    }
  }
  
  /**
   * Saves a decision tree to storage
   * @private
   * @param {string} id The tree ID
   * @param {Object} tree The tree data
   * @returns {Promise<void>} A promise that resolves when the tree is saved
   */
  async _saveTree(id, tree) {
    if (!this.config.storageEnabled || !this.aideon || !this.aideon.storage) {
      return;
    }
    
    try {
      await this.aideon.storage.getNamespace('decisionTrees').set(id, tree);
      this.logger.info(`Saved decision tree: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to save decision tree: ${id}`, error);
      // Continue operation even if saving fails
    }
  }
  
  /**
   * Deletes a decision tree from storage
   * @private
   * @param {string} id The tree ID
   * @returns {Promise<void>} A promise that resolves when the tree is deleted
   */
  async _deleteTreeFromStorage(id) {
    if (!this.config.storageEnabled || !this.aideon || !this.aideon.storage) {
      return;
    }
    
    try {
      await this.aideon.storage.getNamespace('decisionTrees').delete(id);
      this.logger.info(`Deleted decision tree from storage: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete decision tree from storage: ${id}`, error);
      // Continue operation even if deletion fails
    }
  }
  
  /**
   * Shuts down the Decision Tree Manager
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Decision Tree Manager');
    
    try {
      // Save any unsaved trees
      if (this.config.storageEnabled) {
        const savePromises = [];
        for (const [id, tree] of this.trees.entries()) {
          if (tree.dirty) {
            savePromises.push(this._saveTree(id, tree));
          }
        }
        
        if (savePromises.length > 0) {
          await Promise.all(savePromises);
        }
      }
      
      // Clear trees
      this.trees.clear();
      
      this.initialized = false;
      this.logger.info('Decision Tree Manager shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'decisionTreeManager' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Decision Tree Manager
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      treeCount: this.trees.size
    };
  }
  
  /**
   * Creates a new decision tree
   * @param {Object} treeDefinition The tree definition
   * @param {Object} context The context for tree creation
   * @returns {Promise<Object>} A promise that resolves with the created tree
   */
  async createTree(treeDefinition, context = {}) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    if (!treeDefinition) {
      throw new Error('Tree definition is required');
    }
    
    if (!treeDefinition.name) {
      throw new Error('Tree name is required');
    }
    
    this.logger.info(`Creating decision tree: ${treeDefinition.name}`);
    
    try {
      // Generate tree ID if not provided
      const id = treeDefinition.id || `tree-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Check if tree with this ID already exists
      if (this.trees.has(id)) {
        throw new Error(`Tree with ID ${id} already exists`);
      }
      
      // Validate tree definition
      this._validateTreeDefinition(treeDefinition);
      
      // Create tree object
      const tree = {
        id,
        name: treeDefinition.name,
        description: treeDefinition.description || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: context.userId || 'system',
        nodes: treeDefinition.nodes || [],
        edges: treeDefinition.edges || [],
        metadata: {
          ...treeDefinition.metadata || {},
          nodeCount: treeDefinition.nodes ? treeDefinition.nodes.length : 0,
          maxDepth: this._calculateTreeDepth(treeDefinition.nodes || [], treeDefinition.edges || [])
        },
        dirty: true
      };
      
      // Add tree to collection
      this.trees.set(id, tree);
      
      // Save tree if storage is enabled
      if (this.config.storageEnabled) {
        await this._saveTree(id, { ...tree, dirty: false });
        tree.dirty = false;
      }
      
      // Emit tree created event
      this.events.emit('tree:created', {
        treeId: id,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      // Track metrics if available
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent('decisionTree:created', {
          treeId: id,
          userId: context.userId,
          nodeCount: tree.metadata.nodeCount
        });
      }
      
      return tree;
    } catch (error) {
      this.logger.error('Tree creation failed', error);
      
      // Emit tree creation error event
      this.events.emit('tree:error', {
        error: 'creation_failed',
        message: error.message,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Gets a decision tree by ID
   * @param {string} id The tree ID
   * @returns {Promise<Object>} A promise that resolves with the tree
   */
  async getTree(id) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    if (!id) {
      throw new Error('Tree ID is required');
    }
    
    this.logger.info(`Getting decision tree: ${id}`);
    
    // Check if tree exists in memory
    if (this.trees.has(id)) {
      return this.trees.get(id);
    }
    
    // If not in memory and storage is enabled, try to load from storage
    if (this.config.storageEnabled && this.aideon && this.aideon.storage) {
      try {
        const tree = await this.aideon.storage.getNamespace('decisionTrees').get(id);
        
        if (tree) {
          // Add to in-memory collection
          this.trees.set(id, tree);
          return tree;
        }
      } catch (error) {
        this.logger.error(`Failed to load tree from storage: ${id}`, error);
      }
    }
    
    throw new Error(`Tree with ID ${id} not found`);
  }
  
  /**
   * Updates an existing decision tree
   * @param {string} id The tree ID
   * @param {Object} updates The updates to apply
   * @param {Object} context The context for tree update
   * @returns {Promise<Object>} A promise that resolves with the updated tree
   */
  async updateTree(id, updates, context = {}) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    if (!id) {
      throw new Error('Tree ID is required');
    }
    
    if (!updates) {
      throw new Error('Updates are required');
    }
    
    this.logger.info(`Updating decision tree: ${id}`);
    
    try {
      // Get existing tree
      const existingTree = await this.getTree(id);
      
      if (!existingTree) {
        throw new Error(`Tree with ID ${id} not found`);
      }
      
      // Create updated tree
      const updatedTree = {
        ...existingTree,
        name: updates.name || existingTree.name,
        description: updates.description !== undefined ? updates.description : existingTree.description,
        updatedAt: Date.now(),
        nodes: updates.nodes || existingTree.nodes,
        edges: updates.edges || existingTree.edges,
        metadata: {
          ...existingTree.metadata,
          ...updates.metadata || {},
          nodeCount: updates.nodes ? updates.nodes.length : existingTree.metadata.nodeCount,
          maxDepth: updates.nodes || updates.edges ? 
            this._calculateTreeDepth(
              updates.nodes || existingTree.nodes, 
              updates.edges || existingTree.edges
            ) : 
            existingTree.metadata.maxDepth
        },
        dirty: true
      };
      
      // Validate updated tree
      this._validateTreeDefinition({
        name: updatedTree.name,
        nodes: updatedTree.nodes,
        edges: updatedTree.edges
      });
      
      // Update tree in collection
      this.trees.set(id, updatedTree);
      
      // Save tree if storage is enabled
      if (this.config.storageEnabled) {
        await this._saveTree(id, { ...updatedTree, dirty: false });
        updatedTree.dirty = false;
      }
      
      // Emit tree updated event
      this.events.emit('tree:updated', {
        treeId: id,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      // Track metrics if available
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent('decisionTree:updated', {
          treeId: id,
          userId: context.userId,
          nodeCount: updatedTree.metadata.nodeCount
        });
      }
      
      return updatedTree;
    } catch (error) {
      this.logger.error(`Tree update failed: ${id}`, error);
      
      // Emit tree update error event
      this.events.emit('tree:error', {
        error: 'update_failed',
        treeId: id,
        message: error.message,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Deletes a decision tree
   * @param {string} id The tree ID
   * @param {Object} context The context for tree deletion
   * @returns {Promise<boolean>} A promise that resolves with the deletion result
   */
  async deleteTree(id, context = {}) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    if (!id) {
      throw new Error('Tree ID is required');
    }
    
    this.logger.info(`Deleting decision tree: ${id}`);
    
    try {
      // Check if tree exists
      if (!this.trees.has(id)) {
        if (!this.config.storageEnabled) {
          throw new Error(`Tree with ID ${id} not found`);
        }
        
        // Try to load from storage before deleting
        try {
          await this.getTree(id);
        } catch (error) {
          throw new Error(`Tree with ID ${id} not found`);
        }
      }
      
      // Delete from in-memory collection
      this.trees.delete(id);
      
      // Delete from storage if enabled
      if (this.config.storageEnabled) {
        await this._deleteTreeFromStorage(id);
      }
      
      // Emit tree deleted event
      this.events.emit('tree:deleted', {
        treeId: id,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      // Track metrics if available
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent('decisionTree:deleted', {
          treeId: id,
          userId: context.userId
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Tree deletion failed: ${id}`, error);
      
      // Emit tree deletion error event
      this.events.emit('tree:error', {
        error: 'deletion_failed',
        treeId: id,
        message: error.message,
        userId: context.userId,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Lists all decision trees
   * @param {Object} filters Optional filters for the list
   * @returns {Promise<Array>} A promise that resolves with the list of trees
   */
  async listTrees(filters = {}) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    this.logger.info('Listing decision trees', { filters });
    
    // Convert Map to Array
    let trees = Array.from(this.trees.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.userId) {
        trees = trees.filter(tree => tree.createdBy === filters.userId);
      }
      
      if (filters.name) {
        const namePattern = new RegExp(filters.name, 'i');
        trees = trees.filter(tree => namePattern.test(tree.name));
      }
      
      if (filters.createdAfter) {
        trees = trees.filter(tree => tree.createdAt >= filters.createdAfter);
      }
      
      if (filters.createdBefore) {
        trees = trees.filter(tree => tree.createdAt <= filters.createdBefore);
      }
      
      if (filters.updatedAfter) {
        trees = trees.filter(tree => tree.updatedAt >= filters.updatedAfter);
      }
      
      if (filters.updatedBefore) {
        trees = trees.filter(tree => tree.updatedAt <= filters.updatedBefore);
      }
    }
    
    // Sort by creation date (newest first) by default
    trees.sort((a, b) => b.createdAt - a.createdAt);
    
    return trees;
  }
  
  /**
   * Evaluates a decision tree with given inputs
   * @param {string} id The tree ID
   * @param {Object} inputs The input values for evaluation
   * @param {Object} options Evaluation options
   * @returns {Promise<Object>} A promise that resolves with the evaluation result
   */
  async evaluateTree(id, inputs = {}, options = {}) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    if (!id) {
      throw new Error('Tree ID is required');
    }
    
    this.logger.info(`Evaluating decision tree: ${id}`);
    
    try {
      // Get tree
      const tree = await this.getTree(id);
      
      if (!tree) {
        throw new Error(`Tree with ID ${id} not found`);
      }
      
      // Set evaluation options
      const evaluationOptions = {
        probabilityThreshold: options.probabilityThreshold || this.config.defaultProbabilityThreshold,
        maxDepth: options.maxDepth || tree.metadata.maxDepth,
        includeIntermediateResults: options.includeIntermediateResults !== undefined ? options.includeIntermediateResults : false,
        ...options
      };
      
      // Perform evaluation
      const result = this._evaluateTreeInternal(tree, inputs, evaluationOptions);
      
      // Track metrics if available
      if (this.aideon && this.aideon.metrics) {
        this.aideon.metrics.trackEvent('decisionTree:evaluated', {
          treeId: id,
          pathLength: result.path ? result.path.length : 0,
          outcome: result.outcome ? result.outcome.id : null
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Tree evaluation failed: ${id}`, error);
      
      // Emit tree evaluation error event
      this.events.emit('tree:error', {
        error: 'evaluation_failed',
        treeId: id,
        message: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Internal method to evaluate a decision tree
   * @private
   * @param {Object} tree The tree to evaluate
   * @param {Object} inputs The input values
   * @param {Object} options Evaluation options
   * @returns {Object} The evaluation result
   */
  _evaluateTreeInternal(tree, inputs, options) {
    // Find root node
    const rootNode = this._findRootNode(tree.nodes, tree.edges);
    
    if (!rootNode) {
      throw new Error('Tree has no root node');
    }
    
    // Initialize evaluation state
    const state = {
      currentNode: rootNode,
      path: [rootNode.id],
      intermediateResults: options.includeIntermediateResults ? {} : null,
      depth: 0
    };
    
    // Evaluate tree
    while (state.currentNode && state.depth < options.maxDepth) {
      // Check if current node is a leaf (outcome) node
      if (state.currentNode.type === 'outcome') {
        return {
          outcome: state.currentNode,
          confidence: state.currentNode.probability || 1.0,
          path: state.path,
          intermediateResults: state.intermediateResults
        };
      }
      
      // Process decision node
      if (state.currentNode.type === 'decision') {
        const nextNode = this._processDecisionNode(state.currentNode, tree.nodes, tree.edges, inputs);
        
        if (!nextNode) {
          break; // No valid path found
        }
        
        // Update state
        state.currentNode = nextNode;
        state.path.push(nextNode.id);
        state.depth++;
        
        // Store intermediate result if enabled
        if (options.includeIntermediateResults) {
          state.intermediateResults[state.currentNode.id] = {
            nodeId: state.currentNode.id,
            nodeType: state.currentNode.type,
            depth: state.depth,
            inputs: { ...inputs }
          };
        }
        
        continue;
      }
      
      // Process chance node
      if (state.currentNode.type === 'chance') {
        const nextNode = this._processChanceNode(state.currentNode, tree.nodes, tree.edges, inputs, options.probabilityThreshold);
        
        if (!nextNode) {
          break; // No valid path found
        }
        
        // Update state
        state.currentNode = nextNode;
        state.path.push(nextNode.id);
        state.depth++;
        
        // Store intermediate result if enabled
        if (options.includeIntermediateResults) {
          state.intermediateResults[state.currentNode.id] = {
            nodeId: state.currentNode.id,
            nodeType: state.currentNode.type,
            depth: state.depth,
            inputs: { ...inputs }
          };
        }
        
        continue;
      }
      
      // Unknown node type
      throw new Error(`Unknown node type: ${state.currentNode.type}`);
    }
    
    // If we get here, no outcome was reached
    return {
      outcome: null,
      confidence: 0,
      path: state.path,
      intermediateResults: state.intermediateResults,
      error: state.depth >= options.maxDepth ? 'max_depth_exceeded' : 'no_valid_path'
    };
  }
  
  /**
   * Processes a decision node during tree evaluation
   * @private
   * @param {Object} node The decision node
   * @param {Array} nodes All nodes in the tree
   * @param {Array} edges All edges in the tree
   * @param {Object} inputs The input values
   * @returns {Object|null} The next node or null if no path is valid
   */
  _processDecisionNode(node, nodes, edges, inputs) {
    // Get outgoing edges from this node
    const outgoingEdges = edges.filter(edge => edge.source === node.id);
    
    if (outgoingEdges.length === 0) {
      return null; // No outgoing edges
    }
    
    // Find the first edge whose condition is satisfied
    for (const edge of outgoingEdges) {
      if (this._evaluateCondition(edge.condition, inputs)) {
        // Find target node
        const targetNode = nodes.find(n => n.id === edge.target);
        return targetNode || null;
      }
    }
    
    return null; // No condition satisfied
  }
  
  /**
   * Processes a chance node during tree evaluation
   * @private
   * @param {Object} node The chance node
   * @param {Array} nodes All nodes in the tree
   * @param {Array} edges All edges in the tree
   * @param {Object} inputs The input values
   * @param {number} probabilityThreshold The minimum probability threshold
   * @returns {Object|null} The next node or null if no path is valid
   */
  _processChanceNode(node, nodes, edges, inputs, probabilityThreshold) {
    // Get outgoing edges from this node
    const outgoingEdges = edges.filter(edge => edge.source === node.id);
    
    if (outgoingEdges.length === 0) {
      return null; // No outgoing edges
    }
    
    // Calculate adjusted probabilities based on inputs
    const adjustedEdges = outgoingEdges.map(edge => {
      let probability = edge.probability || 0;
      
      // Apply input adjustments if defined
      if (edge.probabilityAdjustments) {
        for (const [inputName, adjustment] of Object.entries(edge.probabilityAdjustments)) {
          if (inputs[inputName] !== undefined) {
            probability += adjustment * inputs[inputName];
          }
        }
      }
      
      // Ensure probability is between 0 and 1
      probability = Math.max(0, Math.min(1, probability));
      
      return {
        ...edge,
        adjustedProbability: probability
      };
    });
    
    // Filter edges by probability threshold
    const validEdges = adjustedEdges.filter(edge => edge.adjustedProbability >= probabilityThreshold);
    
    if (validEdges.length === 0) {
      return null; // No edge meets the probability threshold
    }
    
    // Sort by probability (highest first)
    validEdges.sort((a, b) => b.adjustedProbability - a.adjustedProbability);
    
    // Return the highest probability node
    const targetNode = nodes.find(n => n.id === validEdges[0].target);
    return targetNode || null;
  }
  
  /**
   * Evaluates a condition against inputs
   * @private
   * @param {Object} condition The condition to evaluate
   * @param {Object} inputs The input values
   * @returns {boolean} Whether the condition is satisfied
   */
  _evaluateCondition(condition, inputs) {
    if (!condition) {
      return true; // No condition means always true
    }
    
    // Simple condition (variable comparison)
    if (condition.variable && condition.operator && condition.value !== undefined) {
      const variableValue = inputs[condition.variable];
      
      // Variable not found in inputs
      if (variableValue === undefined) {
        return false;
      }
      
      // Evaluate based on operator
      switch (condition.operator) {
        case '==':
          return variableValue == condition.value;
        case '===':
          return variableValue === condition.value;
        case '!=':
          return variableValue != condition.value;
        case '!==':
          return variableValue !== condition.value;
        case '>':
          return variableValue > condition.value;
        case '>=':
          return variableValue >= condition.value;
        case '<':
          return variableValue < condition.value;
        case '<=':
          return variableValue <= condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(variableValue);
        case 'contains':
          return String(variableValue).includes(String(condition.value));
        case 'startsWith':
          return String(variableValue).startsWith(String(condition.value));
        case 'endsWith':
          return String(variableValue).endsWith(String(condition.value));
        default:
          return false;
      }
    }
    
    // Compound condition (AND)
    if (condition.and && Array.isArray(condition.and)) {
      return condition.and.every(subCondition => this._evaluateCondition(subCondition, inputs));
    }
    
    // Compound condition (OR)
    if (condition.or && Array.isArray(condition.or)) {
      return condition.or.some(subCondition => this._evaluateCondition(subCondition, inputs));
    }
    
    // Compound condition (NOT)
    if (condition.not) {
      return !this._evaluateCondition(condition.not, inputs);
    }
    
    // Function condition
    if (condition.function && typeof condition.function === 'string') {
      try {
        // Create a safe evaluation context
        const context = {
          inputs: { ...inputs },
          result: false
        };
        
        // Create and execute function
        const func = new Function('context', `
          with (context) {
            try {
              result = ${condition.function};
            } catch (e) {
              result = false;
            }
            return result;
          }
        `);
        
        return func(context);
      } catch (error) {
        this.logger.error('Error evaluating function condition', error);
        return false;
      }
    }
    
    // Unknown condition format
    return false;
  }
  
  /**
   * Generates a visualization of a decision tree
   * @param {string} id The tree ID
   * @param {Object} options Visualization options
   * @returns {Promise<Object>} A promise that resolves with the visualization data
   */
  async visualizeTree(id, options = {}) {
    if (!this.initialized) {
      throw new Error('Decision Tree Manager not initialized');
    }
    
    if (!id) {
      throw new Error('Tree ID is required');
    }
    
    this.logger.info(`Visualizing decision tree: ${id}`);
    
    try {
      // Get tree
      const tree = await this.getTree(id);
      
      if (!tree) {
        throw new Error(`Tree with ID ${id} not found`);
      }
      
      // Set visualization options
      const visualizationOptions = {
        format: options.format || 'json',
        includeMetadata: options.includeMetadata !== undefined ? options.includeMetadata : true,
        includeConditions: options.includeConditions !== undefined ? options.includeConditions : true,
        includeProbabilities: options.includeProbabilities !== undefined ? options.includeProbabilities : true,
        ...options
      };
      
      // Generate visualization based on format
      let visualization;
      switch (visualizationOptions.format) {
        case 'json':
          visualization = this._generateJsonVisualization(tree, visualizationOptions);
          break;
        case 'svg':
          visualization = this._generateSvgVisualization(tree, visualizationOptions);
          break;
        case 'dot':
          visualization = this._generateDotVisualization(tree, visualizationOptions);
          break;
        case 'mermaid':
          visualization = this._generateMermaidVisualization(tree, visualizationOptions);
          break;
        default:
          throw new Error(`Unsupported visualization format: ${visualizationOptions.format}`);
      }
      
      return visualization;
    } catch (error) {
      this.logger.error(`Tree visualization failed: ${id}`, error);
      
      // Emit tree visualization error event
      this.events.emit('tree:error', {
        error: 'visualization_failed',
        treeId: id,
        message: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }
  
  /**
   * Generates a JSON visualization of a decision tree
   * @private
   * @param {Object} tree The tree to visualize
   * @param {Object} options Visualization options
   * @returns {Object} The visualization data
   */
  _generateJsonVisualization(tree, options) {
    // Create a clean copy of the tree for visualization
    const visualization = {
      id: tree.id,
      name: tree.name,
      description: tree.description,
      nodes: tree.nodes.map(node => {
        const visualNode = {
          id: node.id,
          type: node.type,
          name: node.name,
          description: node.description
        };
        
        // Include node-type specific properties
        if (node.type === 'outcome') {
          visualNode.value = node.value;
          
          if (options.includeProbabilities && node.probability !== undefined) {
            visualNode.probability = node.probability;
          }
        }
        
        return visualNode;
      }),
      edges: tree.edges.map(edge => {
        const visualEdge = {
          source: edge.source,
          target: edge.target
        };
        
        // Include conditions if requested
        if (options.includeConditions && edge.condition) {
          visualEdge.condition = edge.condition;
        }
        
        // Include probabilities if requested
        if (options.includeProbabilities && edge.probability !== undefined) {
          visualEdge.probability = edge.probability;
        }
        
        return visualEdge;
      })
    };
    
    // Include metadata if requested
    if (options.includeMetadata) {
      visualization.metadata = { ...tree.metadata };
    }
    
    return visualization;
  }
  
  /**
   * Generates an SVG visualization of a decision tree
   * @private
   * @param {Object} tree The tree to visualize
   * @param {Object} options Visualization options
   * @returns {Object} The visualization data
   */
  _generateSvgVisualization(tree, options) {
    // Generate DOT format first
    const dotVisualization = this._generateDotVisualization(tree, options);
    
    // Convert DOT to SVG using a simple layout algorithm
    // In a real implementation, this would use a proper graph layout library
    
    // For now, return a placeholder SVG
    const svgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <style>
          .node rect { fill: #fff; stroke: #333; stroke-width: 1.5px; }
          .node text { font-family: Arial; font-size: 12px; }
          .edge path { fill: none; stroke: #333; stroke-width: 1.5px; }
          .edge text { font-family: Arial; font-size: 10px; }
        </style>
        <g transform="translate(20,20)">
          <text x="0" y="20" font-family="Arial" font-size="16px" font-weight="bold">${tree.name}</text>
          <text x="0" y="40" font-family="Arial" font-size="12px">${tree.description || ''}</text>
          <text x="0" y="60" font-family="Arial" font-size="12px">Tree visualization placeholder (${tree.nodes.length} nodes, ${tree.edges.length} edges)</text>
        </g>
      </svg>
    `;
    
    return {
      format: 'svg',
      content: svgContent
    };
  }
  
  /**
   * Generates a DOT visualization of a decision tree
   * @private
   * @param {Object} tree The tree to visualize
   * @param {Object} options Visualization options
   * @returns {Object} The visualization data
   */
  _generateDotVisualization(tree, options) {
    // Generate DOT format for the tree
    let dotContent = `digraph "${tree.name}" {\n`;
    dotContent += '  rankdir=TB;\n';
    dotContent += '  node [shape=box, style=filled, fillcolor=white];\n';
    dotContent += '\n';
    
    // Add nodes
    for (const node of tree.nodes) {
      let nodeLabel = node.name || node.id;
      let nodeShape = 'box';
      let nodeColor = 'white';
      
      // Customize based on node type
      if (node.type === 'decision') {
        nodeShape = 'diamond';
        nodeColor = '#e6f3ff';
      } else if (node.type === 'chance') {
        nodeShape = 'ellipse';
        nodeColor = '#fff0e6';
      } else if (node.type === 'outcome') {
        nodeShape = 'box';
        nodeColor = '#e6ffe6';
        
        // Include value in label
        if (node.value !== undefined) {
          nodeLabel += `\\nValue: ${node.value}`;
        }
        
        // Include probability in label
        if (options.includeProbabilities && node.probability !== undefined) {
          nodeLabel += `\\nProb: ${node.probability.toFixed(2)}`;
        }
      }
      
      dotContent += `  "${node.id}" [label="${nodeLabel}", shape=${nodeShape}, fillcolor="${nodeColor}"];\n`;
    }
    
    dotContent += '\n';
    
    // Add edges
    for (const edge of tree.edges) {
      let edgeLabel = '';
      
      // Include condition in label
      if (options.includeConditions && edge.condition) {
        edgeLabel = this._formatConditionForDot(edge.condition);
      }
      
      // Include probability in label
      if (options.includeProbabilities && edge.probability !== undefined) {
        if (edgeLabel) {
          edgeLabel += '\\n';
        }
        edgeLabel += `P=${edge.probability.toFixed(2)}`;
      }
      
      if (edgeLabel) {
        dotContent += `  "${edge.source}" -> "${edge.target}" [label="${edgeLabel}"];\n`;
      } else {
        dotContent += `  "${edge.source}" -> "${edge.target}";\n`;
      }
    }
    
    dotContent += '}\n';
    
    return {
      format: 'dot',
      content: dotContent
    };
  }
  
  /**
   * Formats a condition for DOT visualization
   * @private
   * @param {Object} condition The condition to format
   * @returns {string} The formatted condition
   */
  _formatConditionForDot(condition) {
    if (!condition) {
      return '';
    }
    
    // Simple condition
    if (condition.variable && condition.operator && condition.value !== undefined) {
      return `${condition.variable} ${condition.operator} ${condition.value}`;
    }
    
    // Compound condition (AND)
    if (condition.and && Array.isArray(condition.and)) {
      return condition.and.map(c => this._formatConditionForDot(c)).join(' AND ');
    }
    
    // Compound condition (OR)
    if (condition.or && Array.isArray(condition.or)) {
      return condition.or.map(c => this._formatConditionForDot(c)).join(' OR ');
    }
    
    // Compound condition (NOT)
    if (condition.not) {
      return `NOT (${this._formatConditionForDot(condition.not)})`;
    }
    
    // Function condition
    if (condition.function && typeof condition.function === 'string') {
      return `f(${condition.function.substring(0, 20)}${condition.function.length > 20 ? '...' : ''})`;
    }
    
    return '';
  }
  
  /**
   * Generates a Mermaid visualization of a decision tree
   * @private
   * @param {Object} tree The tree to visualize
   * @param {Object} options Visualization options
   * @returns {Object} The visualization data
   */
  _generateMermaidVisualization(tree, options) {
    // Generate Mermaid flowchart
    let mermaidContent = 'graph TD;\n';
    
    // Add nodes
    for (const node of tree.nodes) {
      let nodeLabel = node.name || node.id;
      let nodeStyle = '';
      
      // Customize based on node type
      if (node.type === 'decision') {
        nodeStyle = '{{';
        nodeLabel = `Decision: ${nodeLabel}`;
      } else if (node.type === 'chance') {
        nodeStyle = '(';
        nodeLabel = `Chance: ${nodeLabel}`;
      } else if (node.type === 'outcome') {
        nodeStyle = '[';
        nodeLabel = `Outcome: ${nodeLabel}`;
        
        // Include value in label
        if (node.value !== undefined) {
          nodeLabel += `<br>Value: ${node.value}`;
        }
        
        // Include probability in label
        if (options.includeProbabilities && node.probability !== undefined) {
          nodeLabel += `<br>Prob: ${node.probability.toFixed(2)}`;
        }
      }
      
      // Close node style
      if (nodeStyle === '{{') {
        nodeStyle += '}}';
      } else if (nodeStyle === '(') {
        nodeStyle += ')';
      } else if (nodeStyle === '[') {
        nodeStyle += ']';
      }
      
      mermaidContent += `  ${node.id}${nodeStyle}["${nodeLabel}"];\n`;
    }
    
    // Add edges
    for (const edge of tree.edges) {
      let edgeLabel = '';
      
      // Include condition in label
      if (options.includeConditions && edge.condition) {
        edgeLabel = this._formatConditionForMermaid(edge.condition);
      }
      
      // Include probability in label
      if (options.includeProbabilities && edge.probability !== undefined) {
        if (edgeLabel) {
          edgeLabel += '<br>';
        }
        edgeLabel += `P=${edge.probability.toFixed(2)}`;
      }
      
      if (edgeLabel) {
        mermaidContent += `  ${edge.source} -->|"${edgeLabel}"| ${edge.target};\n`;
      } else {
        mermaidContent += `  ${edge.source} --> ${edge.target};\n`;
      }
    }
    
    return {
      format: 'mermaid',
      content: mermaidContent
    };
  }
  
  /**
   * Formats a condition for Mermaid visualization
   * @private
   * @param {Object} condition The condition to format
   * @returns {string} The formatted condition
   */
  _formatConditionForMermaid(condition) {
    if (!condition) {
      return '';
    }
    
    // Simple condition
    if (condition.variable && condition.operator && condition.value !== undefined) {
      return `${condition.variable} ${condition.operator} ${condition.value}`;
    }
    
    // Compound condition (AND)
    if (condition.and && Array.isArray(condition.and)) {
      return condition.and.map(c => this._formatConditionForMermaid(c)).join(' AND ');
    }
    
    // Compound condition (OR)
    if (condition.or && Array.isArray(condition.or)) {
      return condition.or.map(c => this._formatConditionForMermaid(c)).join(' OR ');
    }
    
    // Compound condition (NOT)
    if (condition.not) {
      return `NOT (${this._formatConditionForMermaid(condition.not)})`;
    }
    
    // Function condition
    if (condition.function && typeof condition.function === 'string') {
      return `f(${condition.function.substring(0, 20)}${condition.function.length > 20 ? '...' : ''})`;
    }
    
    return '';
  }
  
  /**
   * Validates a tree definition
   * @private
   * @param {Object} treeDefinition The tree definition to validate
   * @throws {Error} If validation fails
   */
  _validateTreeDefinition(treeDefinition) {
    // Check name
    if (!treeDefinition.name) {
      throw new Error('Tree name is required');
    }
    
    // Check nodes
    if (!treeDefinition.nodes || !Array.isArray(treeDefinition.nodes)) {
      throw new Error('Tree nodes must be an array');
    }
    
    // Check edges
    if (!treeDefinition.edges || !Array.isArray(treeDefinition.edges)) {
      throw new Error('Tree edges must be an array');
    }
    
    // Check node count limit
    if (treeDefinition.nodes.length > this.config.maxNodesPerTree) {
      throw new Error(`Tree exceeds maximum node count (${treeDefinition.nodes.length} > ${this.config.maxNodesPerTree})`);
    }
    
    // Check for duplicate node IDs
    const nodeIds = new Set();
    for (const node of treeDefinition.nodes) {
      if (!node.id) {
        throw new Error('All nodes must have an ID');
      }
      
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node ID: ${node.id}`);
      }
      
      nodeIds.add(node.id);
      
      // Check node type
      if (!node.type || !['decision', 'chance', 'outcome'].includes(node.type)) {
        throw new Error(`Invalid node type: ${node.type}`);
      }
    }
    
    // Check edges
    for (const edge of treeDefinition.edges) {
      if (!edge.source) {
        throw new Error('All edges must have a source');
      }
      
      if (!edge.target) {
        throw new Error('All edges must have a target');
      }
      
      // Check that source and target nodes exist
      if (!nodeIds.has(edge.source)) {
        throw new Error(`Edge source node not found: ${edge.source}`);
      }
      
      if (!nodeIds.has(edge.target)) {
        throw new Error(`Edge target node not found: ${edge.target}`);
      }
    }
    
    // Check for cycles
    if (this._hasCycle(treeDefinition.nodes, treeDefinition.edges)) {
      throw new Error('Tree contains cycles');
    }
    
    // Check tree depth
    const treeDepth = this._calculateTreeDepth(treeDefinition.nodes, treeDefinition.edges);
    if (treeDepth > this.config.maxTreeDepth) {
      throw new Error(`Tree exceeds maximum depth (${treeDepth} > ${this.config.maxTreeDepth})`);
    }
    
    // Check that tree has at least one root node
    const rootNode = this._findRootNode(treeDefinition.nodes, treeDefinition.edges);
    if (!rootNode) {
      throw new Error('Tree must have exactly one root node');
    }
    
    // Check that tree has at least one outcome node
    const outcomeNodes = treeDefinition.nodes.filter(node => node.type === 'outcome');
    if (outcomeNodes.length === 0) {
      throw new Error('Tree must have at least one outcome node');
    }
  }
  
  /**
   * Finds the root node of a tree
   * @private
   * @param {Array} nodes The tree nodes
   * @param {Array} edges The tree edges
   * @returns {Object|null} The root node or null if not found
   */
  _findRootNode(nodes, edges) {
    // Find nodes that are not targets of any edge
    const targetNodeIds = new Set(edges.map(edge => edge.target));
    const rootNodes = nodes.filter(node => !targetNodeIds.has(node.id));
    
    // There should be exactly one root node
    if (rootNodes.length === 0) {
      return null;
    }
    
    if (rootNodes.length > 1) {
      this.logger.warn(`Tree has multiple root nodes: ${rootNodes.map(node => node.id).join(', ')}`);
    }
    
    return rootNodes[0];
  }
  
  /**
   * Checks if a tree contains cycles
   * @private
   * @param {Array} nodes The tree nodes
   * @param {Array} edges The tree edges
   * @returns {boolean} Whether the tree contains cycles
   */
  _hasCycle(nodes, edges) {
    // Build adjacency list
    const adjacencyList = {};
    for (const node of nodes) {
      adjacencyList[node.id] = [];
    }
    
    for (const edge of edges) {
      adjacencyList[edge.source].push(edge.target);
    }
    
    // DFS to detect cycles
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycleUtil = (nodeId) => {
      // Mark current node as visited and add to recursion stack
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      // Visit all adjacent nodes
      for (const adjacentNodeId of adjacencyList[nodeId]) {
        // If not visited, check if cycle exists in subtree
        if (!visited.has(adjacentNodeId)) {
          if (hasCycleUtil(adjacentNodeId)) {
            return true;
          }
        } 
        // If already in recursion stack, cycle exists
        else if (recursionStack.has(adjacentNodeId)) {
          return true;
        }
      }
      
      // Remove from recursion stack
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Check all nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleUtil(node.id)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Calculates the maximum depth of a tree
   * @private
   * @param {Array} nodes The tree nodes
   * @param {Array} edges The tree edges
   * @returns {number} The maximum depth of the tree
   */
  _calculateTreeDepth(nodes, edges) {
    // Find root node
    const rootNode = this._findRootNode(nodes, edges);
    
    if (!rootNode) {
      return 0;
    }
    
    // Build adjacency list
    const adjacencyList = {};
    for (const node of nodes) {
      adjacencyList[node.id] = [];
    }
    
    for (const edge of edges) {
      adjacencyList[edge.source].push(edge.target);
    }
    
    // BFS to find maximum depth
    const queue = [{ nodeId: rootNode.id, depth: 0 }];
    const visited = new Set([rootNode.id]);
    let maxDepth = 0;
    
    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();
      
      // Update max depth
      maxDepth = Math.max(maxDepth, depth);
      
      // Visit all adjacent nodes
      for (const adjacentNodeId of adjacencyList[nodeId]) {
        if (!visited.has(adjacentNodeId)) {
          visited.add(adjacentNodeId);
          queue.push({ nodeId: adjacentNodeId, depth: depth + 1 });
        }
      }
    }
    
    return maxDepth;
  }
  
  /**
   * Registers API endpoints for the Decision Tree Manager
   * @param {Object} api The API service
   * @param {string} namespace The API namespace
   */
  registerApiEndpoints(api, namespace = 'decision') {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register tree management endpoints
    api.register(`${namespace}/trees`, {
      get: async (req, res) => {
        try {
          const filters = req.query || {};
          const trees = await this.listTrees(filters);
          
          return res.json(trees);
        } catch (error) {
          this.logger.error('API error in list trees endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      },
      post: async (req, res) => {
        try {
          const { treeDefinition } = req.body;
          
          if (!treeDefinition) {
            return res.status(400).json({
              error: 'Tree definition is required'
            });
          }
          
          const context = {
            userId: req.userId || 'system'
          };
          
          const tree = await this.createTree(treeDefinition, context);
          
          return res.status(201).json(tree);
        } catch (error) {
          this.logger.error('API error in create tree endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register tree-specific endpoints
    api.register(`${namespace}/trees/:id`, {
      get: async (req, res) => {
        try {
          const { id } = req.params;
          
          if (!id) {
            return res.status(400).json({
              error: 'Tree ID is required'
            });
          }
          
          const tree = await this.getTree(id);
          
          return res.json(tree);
        } catch (error) {
          this.logger.error('API error in get tree endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      },
      put: async (req, res) => {
        try {
          const { id } = req.params;
          const { updates } = req.body;
          
          if (!id) {
            return res.status(400).json({
              error: 'Tree ID is required'
            });
          }
          
          if (!updates) {
            return res.status(400).json({
              error: 'Updates are required'
            });
          }
          
          const context = {
            userId: req.userId || 'system'
          };
          
          const tree = await this.updateTree(id, updates, context);
          
          return res.json(tree);
        } catch (error) {
          this.logger.error('API error in update tree endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      },
      delete: async (req, res) => {
        try {
          const { id } = req.params;
          
          if (!id) {
            return res.status(400).json({
              error: 'Tree ID is required'
            });
          }
          
          const context = {
            userId: req.userId || 'system'
          };
          
          const result = await this.deleteTree(id, context);
          
          return res.json({ success: result });
        } catch (error) {
          this.logger.error('API error in delete tree endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register tree evaluation endpoint
    api.register(`${namespace}/trees/:id/evaluate`, {
      post: async (req, res) => {
        try {
          const { id } = req.params;
          const { inputs, options } = req.body;
          
          if (!id) {
            return res.status(400).json({
              error: 'Tree ID is required'
            });
          }
          
          const result = await this.evaluateTree(id, inputs || {}, options || {});
          
          return res.json(result);
        } catch (error) {
          this.logger.error('API error in evaluate tree endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    // Register tree visualization endpoint
    api.register(`${namespace}/trees/:id/visualize`, {
      get: async (req, res) => {
        try {
          const { id } = req.params;
          const options = req.query || {};
          
          if (!id) {
            return res.status(400).json({
              error: 'Tree ID is required'
            });
          }
          
          const visualization = await this.visualizeTree(id, options);
          
          return res.json(visualization);
        } catch (error) {
          this.logger.error('API error in visualize tree endpoint', error);
          
          return res.status(500).json({
            error: error.message
          });
        }
      }
    });
    
    this.logger.info('API endpoints registered successfully');
  }
}

module.exports = { DecisionTreeManager };
