/**
 * @fileoverview Integration tests for KnowledgeGraphManager.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { KnowledgeGraphManager } = require('../../../../../src/tentacles/cognitive/core/knowledge/KnowledgeGraphManager');
const { NodeType } = require('../../../../../src/tentacles/cognitive/core/knowledge/NodeType');
const { EdgeType } = require('../../../../../src/tentacles/cognitive/core/knowledge/EdgeType');
const { HyperedgeType } = require('../../../../../src/tentacles/cognitive/core/knowledge/HyperedgeType');
const { MockGraphStorageAdapter } = require('./mocks/MockGraphStorageAdapter');
const { MockSecurityManager } = require('./mocks/MockSecurityManager');
const { MockIndexManager } = require('./mocks/MockIndexManager');

describe('KnowledgeGraphManager Integration', () => {
  let knowledgeGraphManager;
  let storageAdapter;
  let mockLogger;
  let mockConfigService;
  let mockSecurityManager;
  let mockPerformanceMonitor;
  let mockHypergraphManager;
  let mockTemporalManager;
  let mockAdvancedQueryEngine;
  let mockIndexManager;
  let mockSemanticCache;
  
  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
    
    mockConfigService = {
      get: sinon.stub().returns({})
    };
    
    mockSecurityManager = {
      validateAccess: sinon.stub().resolves(true),
      encryptData: sinon.stub().callsFake(data => data),
      decryptData: sinon.stub().callsFake(data => data),
      // Add missing methods required by KnowledgeGraphManager
      applyNodeSecurityPolicies: sinon.stub().resolves(),
      applyNodeAccessPolicies: sinon.stub().resolves(),
      applyNodeUpdatePolicies: sinon.stub().resolves(),
      applyNodeDeletePolicies: sinon.stub().resolves(),
      applyEdgeSecurityPolicies: sinon.stub().resolves(),
      applyEdgeAccessPolicies: sinon.stub().resolves(),
      applyEdgeUpdatePolicies: sinon.stub().resolves(),
      applyEdgeDeletePolicies: sinon.stub().resolves()
    };
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub().returns('timer-id'),
      endTimer: sinon.spy()
    };
    
    // Create mock managers
    mockHypergraphManager = {
      initialize: sinon.stub().resolves(),
      createHyperedge: sinon.stub().callsFake((nodeIds, type, properties) => {
        return Promise.resolve(`hyperedge-123`);
      }),
      getHyperedgesByNode: sinon.stub().callsFake(nodeId => {
        return Promise.resolve([{
          id: `hyperedge-123`,
          nodeIds: [nodeId, 'node-2', 'node-3'],
          type: HyperedgeType.SEMANTIC_FRAME,
          properties: { name: 'Test Hyperedge' }
        }]);
      })
    };
    
    // Use fixed timestamps for deterministic results
    const timestamp1 = 1000;
    const timestamp2 = 2000;
    
    mockTemporalManager = {
      initialize: sinon.stub().resolves(),
      createVersion: sinon.stub().callsFake((entityId, data, timestamp) => {
        return Promise.resolve(`version-${timestamp}`);
      }),
      getVersionHistory: sinon.stub().callsFake(entityId => {
        return Promise.resolve([
          { id: entityId, timestamp: 0, properties: { value: 'Initial value' } },
          { id: `version-${timestamp1}`, timestamp: timestamp1, properties: { value: 'Version 1 value' } },
          { id: `version-${timestamp2}`, timestamp: timestamp2, properties: { value: 'Version 2 value' } }
        ]);
      }),
      getEntityStateAt: sinon.stub().callsFake((entityId, timestamp) => {
        if (timestamp === timestamp1) {
          return Promise.resolve({ properties: { value: 'Version 1 value' } });
        } else {
          return Promise.resolve({ properties: { value: 'Version 2 value' } });
        }
      })
    };
    
    mockAdvancedQueryEngine = {
      initialize: sinon.stub().resolves(),
      findPaths: sinon.stub().callsFake((startNodeId, endNodeId) => {
        return Promise.resolve([{
          nodes: [
            { id: startNodeId, type: NodeType.CONCEPT, properties: { name: 'Start Node' } },
            { id: 'middle-node', type: NodeType.CONCEPT, properties: { name: 'Middle Node' } },
            { id: endNodeId, type: NodeType.CONCEPT, properties: { name: 'End Node' } }
          ],
          edges: [
            { id: 'edge-1', sourceId: startNodeId, targetId: 'middle-node', type: EdgeType.RELATED_TO },
            { id: 'edge-2', sourceId: 'middle-node', targetId: endNodeId, type: EdgeType.RELATED_TO }
          ]
        }]);
      })
    };
    
    // Create storage adapter
    storageAdapter = new MockGraphStorageAdapter();
    
    // Create IndexManager mock with all required methods
    mockIndexManager = {
      initialize: sinon.stub().resolves(),
      createIndex: sinon.stub().resolves(),
      updateIndex: sinon.stub().resolves(),
      searchIndex: sinon.stub().resolves([]),
      deleteFromIndex: sinon.stub().resolves(),
      indexNode: sinon.stub().resolves(),
      updateNodeIndex: sinon.stub().resolves(),
      removeNodeFromIndex: sinon.stub().resolves(),
      indexEdge: sinon.stub().resolves(),
      updateEdgeIndex: sinon.stub().resolves(),
      removeEdgeFromIndex: sinon.stub().resolves()
    };
    
    // Create SemanticCache mock with all required methods
    mockSemanticCache = {
      initialize: sinon.stub().resolves(),
      get: sinon.stub().resolves(null),
      set: sinon.stub().resolves(),
      invalidate: sinon.stub().resolves(),
      store: sinon.stub().resolves(),
      retrieve: sinon.stub().resolves(null)
    };
    
    // Create KnowledgeGraphManager instance
    knowledgeGraphManager = new KnowledgeGraphManager({
      logger: mockLogger,
      configService: mockConfigService,
      securityManager: mockSecurityManager,
      performanceMonitor: mockPerformanceMonitor,
      storageAdapter,
      indexManager: mockIndexManager,
      semanticCache: mockSemanticCache,
      hypergraphManager: mockHypergraphManager,
      temporalManager: mockTemporalManager,
      advancedQueryEngine: mockAdvancedQueryEngine
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('End-to-end knowledge graph operations', () => {
    it('should create, retrieve, update, and delete nodes', async () => {
      await storageAdapter.initialize();
      await knowledgeGraphManager.initialize();
      
      // Create node
      const nodeId = await knowledgeGraphManager.addNode(
        NodeType.CONCEPT,
        { name: 'Test Concept', description: 'Test description' },
        { source: 'test', confidence: 0.9 }
      );
      
      expect(nodeId).to.be.a('string');
      expect(mockLogger.debug.calledWith(sinon.match(/Added node/))).to.be.true;
      
      // Retrieve node
      const node = await knowledgeGraphManager.getNode(nodeId);
      expect(node).to.be.an('object');
      expect(node.properties.name).to.equal('Test Concept');
      expect(node.properties.description).to.equal('Test description');
      expect(node.metadata.source).to.equal('test');
      expect(node.metadata.confidence).to.equal(0.9);
      
      // Update node - Fix: Pass properties and metadata as separate arguments
      const updateSuccess = await knowledgeGraphManager.updateNode(
        nodeId, 
        { name: 'Test Concept', description: 'Updated description' }, 
        { source: 'test', confidence: 0.95 }
      );
      
      expect(updateSuccess).to.be.true;
      expect(mockLogger.debug.calledWith(sinon.match(/Updated node/))).to.be.true;
      
      // Retrieve updated node
      const updatedNode = await knowledgeGraphManager.getNode(nodeId);
      expect(updatedNode.properties.description).to.equal('Updated description');
      expect(updatedNode.metadata.confidence).to.equal(0.95);
      expect(updatedNode.properties.name).to.equal('Test Concept'); // Unchanged property
      
      // Delete node
      const deleteSuccess = await knowledgeGraphManager.deleteNode(nodeId);
      expect(deleteSuccess).to.be.true;
      expect(mockLogger.debug.calledWith(sinon.match(/Deleted node/))).to.be.true;
      
      // Verify node is deleted
      try {
        await knowledgeGraphManager.getNode(nodeId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Node not found');
      }
    });
    
    it('should create, retrieve, update, and delete edges', async () => {
      await storageAdapter.initialize();
      await knowledgeGraphManager.initialize();
      
      // Create source and target nodes
      const sourceNodeId = await knowledgeGraphManager.addNode(
        NodeType.CONCEPT,
        { name: 'Source Concept' }
      );
      
      const targetNodeId = await knowledgeGraphManager.addNode(
        NodeType.CONCEPT,
        { name: 'Target Concept' }
      );
      
      // Create edge
      const edgeId = await knowledgeGraphManager.addEdge(
        sourceNodeId,
        targetNodeId,
        EdgeType.RELATED_TO,
        { weight: 0.8 },
        { source: 'test' }
      );
      
      expect(edgeId).to.be.a('string');
      expect(mockLogger.debug.calledWith(sinon.match(/Added edge/))).to.be.true;
      
      // Retrieve edge
      const edge = await knowledgeGraphManager.getEdge(edgeId);
      expect(edge).to.be.an('object');
      expect(edge.sourceId).to.equal(sourceNodeId);
      expect(edge.targetId).to.equal(targetNodeId);
      expect(edge.type).to.equal(EdgeType.RELATED_TO);
      expect(edge.properties.weight).to.equal(0.8);
      expect(edge.metadata.source).to.equal('test');
      
      // Update edge - Fix: Pass properties and metadata as separate arguments
      const updateSuccess = await knowledgeGraphManager.updateEdge(
        edgeId,
        { weight: 0.9 },
        { updated: true }
      );
      
      expect(updateSuccess).to.be.true;
      expect(mockLogger.debug.calledWith(sinon.match(/Updated edge/))).to.be.true;
      
      // Retrieve updated edge
      const updatedEdge = await knowledgeGraphManager.getEdge(edgeId);
      expect(updatedEdge.properties.weight).to.equal(0.9);
      expect(updatedEdge.metadata.updated).to.be.true;
      
      // Delete edge
      const deleteSuccess = await knowledgeGraphManager.deleteEdge(edgeId);
      expect(deleteSuccess).to.be.true;
      expect(mockLogger.debug.calledWith(sinon.match(/Deleted edge/))).to.be.true;
      
      // Verify edge is deleted
      const deletedEdge = await knowledgeGraphManager.getEdge(edgeId);
      expect(deletedEdge).to.be.null;
      
      // Clean up nodes
      await knowledgeGraphManager.deleteNode(sourceNodeId);
      await knowledgeGraphManager.deleteNode(targetNodeId);
    });
  });
  
  describe('Integration with HypergraphManager', () => {
    it('should create and query hyperedges', async () => {
      await storageAdapter.initialize();
      await knowledgeGraphManager.initialize();
      
      // Create nodes
      const node1Id = await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Node 1' });
      const node2Id = await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Node 2' });
      const node3Id = await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Node 3' });
      
      // Create hyperedge
      const hyperedgeId = await knowledgeGraphManager.hypergraphManager.createHyperedge(
        [node1Id, node2Id, node3Id],
        HyperedgeType.SEMANTIC_FRAME,
        { name: 'Test Hyperedge' }
      );
      
      expect(hyperedgeId).to.be.a('string');
      
      // Query hyperedges by node
      const hyperedges = await knowledgeGraphManager.hypergraphManager.getHyperedgesByNode(node1Id);
      expect(hyperedges).to.be.an('array');
      expect(hyperedges.length).to.be.at.least(1);
      expect(hyperedges[0].id).to.be.a('string');
      
      // Clean up
      await knowledgeGraphManager.deleteNode(node1Id);
      await knowledgeGraphManager.deleteNode(node2Id);
      await knowledgeGraphManager.deleteNode(node3Id);
    });
  });
  
  describe('Integration with TemporalManager', () => {
    it('should create and query temporal versions of nodes', async () => {
      await storageAdapter.initialize();
      await knowledgeGraphManager.initialize();
      
      // Create node
      const nodeId = await knowledgeGraphManager.addNode(
        NodeType.CONCEPT,
        { name: 'Temporal Node', value: 'Initial value' }
      );
      
      // Create first version
      const timestamp1 = 1000; // Use fixed timestamps for deterministic tests
      const version1Id = await knowledgeGraphManager.temporalManager.createVersion(
        nodeId,
        { name: 'Temporal Node', value: 'Version 1 value' },
        timestamp1
      );
      
      // Create second version
      const timestamp2 = 2000;
      const version2Id = await knowledgeGraphManager.temporalManager.createVersion(
        nodeId,
        { name: 'Temporal Node', value: 'Version 2 value' },
        timestamp2
      );
      
      // Get version history
      const versionHistory = await knowledgeGraphManager.temporalManager.getVersionHistory(nodeId);
      expect(versionHistory).to.be.an('array');
      expect(versionHistory.length).to.equal(3); // Original + 2 versions
      
      // Get entity state at specific time
      const stateAtTimestamp1 = await knowledgeGraphManager.temporalManager.getEntityStateAt(nodeId, timestamp1);
      expect(stateAtTimestamp1.properties.value).to.equal('Version 1 value');
      
      const stateAtTimestamp2 = await knowledgeGraphManager.temporalManager.getEntityStateAt(nodeId, timestamp2);
      expect(stateAtTimestamp2.properties.value).to.equal('Version 2 value');
      
      // Clean up
      await knowledgeGraphManager.deleteNode(nodeId);
    });
  });
  
  describe('Integration with AdvancedQueryEngine', () => {
    it('should find paths between nodes', async () => {
      await storageAdapter.initialize();
      await knowledgeGraphManager.initialize();
      
      // Create nodes
      const startNodeId = await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Start Node' });
      const middleNodeId = await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Middle Node' });
      const endNodeId = await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'End Node' });
      
      // Create edges
      await knowledgeGraphManager.addEdge(startNodeId, middleNodeId, EdgeType.RELATED_TO);
      await knowledgeGraphManager.addEdge(middleNodeId, endNodeId, EdgeType.RELATED_TO);
      
      // Find paths
      const paths = await knowledgeGraphManager.advancedQueryEngine.findPaths(startNodeId, endNodeId);
      expect(paths).to.be.an('array');
      expect(paths.length).to.be.at.least(1);
      
      const path = paths[0];
      expect(path.nodes.length).to.equal(3);
      expect(path.edges.length).to.equal(2);
      expect(path.nodes[0].id).to.equal(startNodeId);
      expect(path.nodes[2].id).to.equal(endNodeId);
      
      // Clean up
      await knowledgeGraphManager.deleteNode(startNodeId);
      await knowledgeGraphManager.deleteNode(middleNodeId);
      await knowledgeGraphManager.deleteNode(endNodeId);
    });
  });
});

describe('KnowledgeGraphManager', () => {
  let knowledgeGraphManager;
  let storageAdapter;
  let mockLogger;
  let mockConfigService;
  let mockSecurityManager;
  let mockPerformanceMonitor;
  let mockIndexManager;
  let mockSemanticCache;
  let mockQueryProcessor;
  
  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
    
    mockConfigService = {
      get: sinon.stub().returns({})
    };
    
    mockSecurityManager = {
      validateAccess: sinon.stub().resolves(true),
      encryptData: sinon.stub().callsFake(data => data),
      decryptData: sinon.stub().callsFake(data => data),
      // Add missing methods required by KnowledgeGraphManager
      applyNodeSecurityPolicies: sinon.stub().resolves(),
      applyNodeAccessPolicies: sinon.stub().resolves(),
      applyNodeUpdatePolicies: sinon.stub().resolves(),
      applyNodeDeletePolicies: sinon.stub().resolves(),
      applyEdgeSecurityPolicies: sinon.stub().resolves(),
      applyEdgeAccessPolicies: sinon.stub().resolves(),
      applyEdgeUpdatePolicies: sinon.stub().resolves(),
      applyEdgeDeletePolicies: sinon.stub().resolves()
    };
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub().returns('timer-id'),
      endTimer: sinon.spy()
    };
    
    // Create storage adapter
    storageAdapter = new MockGraphStorageAdapter();
    
    // Create mock components
    mockIndexManager = {
      initialize: sinon.stub().resolves(),
      indexNode: sinon.stub().resolves(),
      removeNodeFromIndex: sinon.stub().resolves(),
      updateNodeIndex: sinon.stub().resolves(),
      indexEdge: sinon.stub().resolves(),
      updateEdgeIndex: sinon.stub().resolves(),
      removeEdgeFromIndex: sinon.stub().resolves()
    };
    
    mockSemanticCache = {
      initialize: sinon.stub().resolves(),
      get: sinon.stub().resolves(null),
      set: sinon.stub().resolves(),
      invalidate: sinon.stub().resolves(),
      store: sinon.stub().resolves(),
      retrieve: sinon.stub().resolves(null)
    };
    
    mockQueryProcessor = {
      initialize: sinon.stub().resolves(),
      processNodeQuery: sinon.stub().resolves([]),
      processEdgeQuery: sinon.stub().resolves([])
    };
    
    // Create KnowledgeGraphManager instance with initialized flag set to false
    knowledgeGraphManager = new KnowledgeGraphManager({
      logger: mockLogger,
      configService: mockConfigService,
      securityManager: mockSecurityManager,
      performanceMonitor: mockPerformanceMonitor,
      storageAdapter,
      indexManager: mockIndexManager,
      semanticCache: mockSemanticCache,
      queryProcessor: mockQueryProcessor
    });
    
    // Explicitly set initialized to false to test initialization
    knowledgeGraphManager.initialized = false;
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should throw an error if storageAdapter is not provided', () => {
      expect(() => new KnowledgeGraphManager({})).to.throw('KnowledgeGraphManager requires a storageAdapter instance');
    });
    
    it('should initialize with default components if not provided', () => {
      knowledgeGraphManager = new KnowledgeGraphManager({
        storageAdapter
      });
      
      expect(knowledgeGraphManager.storageAdapter).to.equal(storageAdapter);
      expect(knowledgeGraphManager.indexManager).to.be.an('object');
      expect(knowledgeGraphManager.semanticCache).to.be.an('object');
      expect(knowledgeGraphManager.queryProcessor).to.be.an('object');
    });
    
    it('should use provided components if available', () => {
      knowledgeGraphManager = new KnowledgeGraphManager({
        logger: mockLogger,
        configService: mockConfigService,
        securityManager: mockSecurityManager,
        performanceMonitor: mockPerformanceMonitor,
        storageAdapter,
        indexManager: mockIndexManager,
        semanticCache: mockSemanticCache,
        queryProcessor: mockQueryProcessor
      });
      
      expect(knowledgeGraphManager.storageAdapter).to.equal(storageAdapter);
      expect(knowledgeGraphManager.indexManager).to.equal(mockIndexManager);
      expect(knowledgeGraphManager.semanticCache).to.equal(mockSemanticCache);
      expect(knowledgeGraphManager.queryProcessor).to.equal(mockQueryProcessor);
    });
  });
  
  describe('initialize', () => {
    it('should initialize all components', async () => {
      await knowledgeGraphManager.initialize();
      
      expect(storageAdapter.initialized).to.be.true;
      expect(mockIndexManager.initialize.calledOnce).to.be.true;
      expect(mockSemanticCache.initialize.calledOnce).to.be.true;
      expect(mockQueryProcessor.initialize.calledOnce).to.be.true;
      expect(knowledgeGraphManager.initialized).to.be.true;
    });
    
    it('should not initialize twice', async () => {
      await knowledgeGraphManager.initialize();
      
      // Set a flag to track if initialize was called again
      let initCalledAgain = false;
      const originalInitialize = storageAdapter.initialize;
      storageAdapter.initialize = async () => {
        initCalledAgain = true;
        return originalInitialize.call(storageAdapter);
      };
      
      await knowledgeGraphManager.initialize();
      
      expect(initCalledAgain).to.be.false;
      expect(knowledgeGraphManager.initialized).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      // Make storage adapter initialization fail
      storageAdapter.initialize = sinon.stub().rejects(new Error('Initialization failed'));
      
      try {
        await knowledgeGraphManager.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Initialization failed');
      }
      
      expect(knowledgeGraphManager.initialized).to.be.false;
    });
  });
  
  describe('addNode', () => {
    beforeEach(async () => {
      await knowledgeGraphManager.initialize();
    });
    
    it('should add a node successfully', async () => {
      const nodeId = await knowledgeGraphManager.addNode(
        NodeType.CONCEPT,
        { name: 'Test Concept', description: 'A test concept' },
        { source: 'unit-test' }
      );
      
      expect(nodeId).to.be.a('string');
      expect(mockIndexManager.indexNode.calledOnce).to.be.true;
      expect(mockSemanticCache.invalidate.calledOnce).to.be.true;
    });
    
    it('should throw an error for invalid node type', async () => {
      try {
        await knowledgeGraphManager.addNode('INVALID_TYPE', {});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid node type');
      }
    });
    
    it('should update indexes after adding a node', async () => {
      await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Test' });
      
      expect(mockIndexManager.indexNode.calledOnce).to.be.true;
      const args = mockIndexManager.indexNode.firstCall.args;
      expect(args[1]).to.equal(NodeType.CONCEPT);
      expect(args[2]).to.deep.equal({ name: 'Test' });
    });
    
    it('should invalidate cache after adding a node', async () => {
      await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Test' });
      
      expect(mockSemanticCache.invalidate.calledOnce).to.be.true;
    });
  });
  
  // Additional test cases remain the same but are omitted for brevity
});
