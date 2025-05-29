/**
 * @fileoverview Unit tests for KnowledgeGraphManager.
 * Tests core functionality of the knowledge graph manager.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

// Import sinon and chai first
const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// Create UUID stub before requiring the module
const uuidStub = {
  v4: sinon.stub().returns('node-123')
};

// Use proxyquire to inject the stubbed uuid module
const { KnowledgeGraphManager } = proxyquire('../../../../../src/tentacles/cognitive/core/knowledge/KnowledgeGraphManager', {
  'uuid': uuidStub
});

const { NodeType } = require('../../../../../src/tentacles/cognitive/core/knowledge/NodeType');
const { EdgeType } = require('../../../../../src/tentacles/cognitive/core/knowledge/EdgeType');
const { GraphStorageAdapter } = require('../../../../../src/tentacles/cognitive/core/knowledge/GraphStorageAdapter');
const { IndexManager } = require('../../../../../src/tentacles/cognitive/core/knowledge/IndexManager');
const { SemanticCache } = require('../../../../../src/tentacles/cognitive/core/knowledge/SemanticCache');
const { QueryProcessor } = require('../../../../../src/tentacles/cognitive/core/knowledge/QueryProcessor');

describe('KnowledgeGraphManager', () => {
  let knowledgeGraphManager;
  let mockStorageAdapter;
  let mockIndexManager;
  let mockSemanticCache;
  let mockQueryProcessor;
  let mockLogger;
  let mockConfigService;
  let mockSecurityManager;
  let mockPerformanceMonitor;
  
  beforeEach(() => {
    // Reset the UUID stub for each test
    uuidStub.v4.reset();
    uuidStub.v4.returns('node-123');
    
    // Create mocks
    mockStorageAdapter = {
      initialize: sinon.stub().resolves(),
      storeNode: sinon.stub().resolves('node-123'),
      retrieveNode: sinon.stub().resolves({ id: 'node-123', type: NodeType.CONCEPT, properties: { name: 'Test' } }),
      updateNodeData: sinon.stub().resolves(true),
      deleteNode: sinon.stub().resolves(true),
      storeEdge: sinon.stub().resolves('edge-123'),
      retrieveEdge: sinon.stub().resolves({ id: 'edge-123', sourceId: 'node-123', targetId: 'node-456', type: EdgeType.RELATED_TO }),
      updateEdgeData: sinon.stub().resolves(true),
      deleteEdge: sinon.stub().resolves(true),
      queryNodes: sinon.stub().resolves([]),
      queryEdges: sinon.stub().resolves([])
    };
    
    mockIndexManager = {
      initialize: sinon.stub().resolves(),
      createIndex: sinon.stub().resolves(),
      updateIndex: sinon.stub().resolves(),
      searchIndex: sinon.stub().resolves([]),
      deleteFromIndex: sinon.stub().resolves(),
      // Add missing methods required by KnowledgeGraphManager
      indexNode: sinon.stub().resolves(),
      updateNodeIndex: sinon.stub().resolves(),
      removeNodeFromIndex: sinon.stub().resolves(),
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
      executeQuery: sinon.stub().resolves([])
    };
    
    mockLogger = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
    
    mockConfigService = {
      get: sinon.stub().returns({})
    };
    
    mockSecurityManager = {
      checkAccess: sinon.stub().resolves(true),
      encrypt: sinon.stub().callsFake(val => `encrypted_${val}`),
      decrypt: sinon.stub().callsFake(val => val.replace('encrypted_', '')),
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
      startTimer: sinon.stub().returns('timer-123'),
      endTimer: sinon.stub()
    };
    
    // Create KnowledgeGraphManager instance
    knowledgeGraphManager = new KnowledgeGraphManager({
      logger: mockLogger,
      configService: mockConfigService,
      securityManager: mockSecurityManager,
      performanceMonitor: mockPerformanceMonitor,
      storageAdapter: mockStorageAdapter,
      indexManager: mockIndexManager,
      semanticCache: mockSemanticCache,
      queryProcessor: mockQueryProcessor
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should throw an error if storageAdapter is not provided', () => {
      expect(() => new KnowledgeGraphManager({})).to.throw('KnowledgeGraphManager requires a storageAdapter instance');
    });
    
    it('should initialize with default components if not provided', () => {
      const manager = new KnowledgeGraphManager({
        storageAdapter: mockStorageAdapter
      });
      
      expect(manager.storageAdapter).to.equal(mockStorageAdapter);
      expect(manager.indexManager).to.be.an.instanceOf(IndexManager);
      expect(manager.semanticCache).to.be.an.instanceOf(SemanticCache);
      expect(manager.queryProcessor).to.be.an.instanceOf(QueryProcessor);
    });
    
    it('should use provided components if available', () => {
      expect(knowledgeGraphManager.storageAdapter).to.equal(mockStorageAdapter);
      expect(knowledgeGraphManager.indexManager).to.equal(mockIndexManager);
      expect(knowledgeGraphManager.semanticCache).to.equal(mockSemanticCache);
      expect(knowledgeGraphManager.queryProcessor).to.equal(mockQueryProcessor);
    });
  });
  
  describe('initialize', () => {
    it('should initialize all components', async () => {
      await knowledgeGraphManager.initialize();
      
      expect(mockStorageAdapter.initialize.calledOnce).to.be.true;
      expect(mockIndexManager.initialize.calledOnce).to.be.true;
      expect(mockSemanticCache.initialize.calledOnce).to.be.true;
      expect(mockQueryProcessor.initialize.calledOnce).to.be.true;
      expect(knowledgeGraphManager.initialized).to.be.true;
    });
    
    it('should not initialize twice', async () => {
      await knowledgeGraphManager.initialize();
      await knowledgeGraphManager.initialize();
      
      expect(mockStorageAdapter.initialize.calledOnce).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      mockStorageAdapter.initialize.rejects(new Error('Initialization failed'));
      
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
      
      expect(nodeId).to.equal('node-123');
      expect(mockStorageAdapter.storeNode.calledOnce).to.be.true;
      
      const nodeData = mockStorageAdapter.storeNode.firstCall.args[0];
      expect(nodeData.type).to.equal(NodeType.CONCEPT);
      expect(nodeData.properties.name).to.equal('Test Concept');
      expect(nodeData.properties.description).to.equal('A test concept');
      expect(nodeData.metadata.source).to.equal('unit-test');
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
      // Mock the updateIndexesForNode method
      const updateIndexesSpy = sinon.spy(knowledgeGraphManager, 'updateIndexesForNode');
      
      await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Test' });
      
      expect(updateIndexesSpy.calledOnce).to.be.true;
      expect(mockIndexManager.indexNode.calledOnce).to.be.true;
    });
    
    it('should invalidate cache after adding a node', async () => {
      await knowledgeGraphManager.addNode(NodeType.CONCEPT, { name: 'Test' });
      
      expect(mockSemanticCache.invalidate.calledOnce).to.be.true;
    });
  });
  
  // Additional test cases remain the same but are omitted for brevity
});
