/**
 * @fileoverview Tests for Knowledge Context Schemas and Provider Integration.
 * 
 * This test suite validates the schema definitions for knowledge context data
 * and tests the integration of knowledge graph context providers with the MCP system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { requireModule } = require('./utils/TestModuleResolver');

describe('Knowledge Context Schemas', () => {
  // Import schemas using the TestModuleResolver
  const { 
    knowledgeContextSchemas,
    validateKnowledgeContext,
    nodeUpdateContextSchema,
    edgeUpdateContextSchema,
    queryContextSchema,
    versionContextSchema
  } = requireModule('tentacles/multimodal/context/schemas/KnowledgeContextSchemas');
  
  describe('Schema Validation', () => {
    it('should validate a valid node update context', () => {
      const context = {
        operation: 'add',
        nodeId: 'person:123',
        nodeType: 'person',
        properties: { name: 'John Doe' },
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.graph.update.node', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should reject an invalid node update context missing required fields', () => {
      const context = {
        operation: 'add',
        // Missing nodeId
        nodeType: 'person',
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.graph.update.node', context);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.above(0);
    });
    
    it('should validate a valid edge update context', () => {
      const context = {
        operation: 'add',
        edgeId: 'knows:123',
        sourceId: 'person:123',
        targetId: 'person:456',
        edgeType: 'knows',
        properties: { since: '2023' },
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.graph.update.edge', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should reject an invalid edge update context with wrong property type', () => {
      const context = {
        operation: 'add',
        edgeId: 'knows:123',
        sourceId: 'person:123',
        targetId: 'person:456',
        edgeType: 'knows',
        properties: 'invalid-properties', // Should be an object
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.graph.update.edge', context);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.above(0);
    });
    
    it('should validate a valid query context', () => {
      const context = {
        queryId: 'query:123',
        queryType: 'path',
        parameters: { source: 'person:123', target: 'person:456' },
        resultCount: 3,
        executionTime: 42,
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.graph.query', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should validate a valid hyperedge context', () => {
      const context = {
        operation: 'add',
        hyperedgeId: 'team:123',
        nodeIds: ['person:123', 'person:456', 'person:789'],
        type: 'team',
        properties: { name: 'Project Team' },
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.hypergraph.relation', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should validate a valid version context', () => {
      const context = {
        operation: 'create',
        versionId: 'v1',
        entityId: 'graph:123',
        entityType: 'graph',
        versionTimestamp: Date.now(),
        systemTimestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.temporal.version', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should validate a valid confidence context', () => {
      const context = {
        operation: 'update',
        entityId: 'fact:123',
        entityType: 'fact',
        oldConfidence: 0.7,
        newConfidence: 0.8,
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.probabilistic.confidence', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should validate a valid embedding context', () => {
      const context = {
        operation: 'generate',
        embeddingId: 'emb:123',
        entityId: 'concept:123',
        entityType: 'concept',
        dimensions: 768,
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.gnn.embedding', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should reject an unknown context type', () => {
      const context = {
        someData: 'value',
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.unknown.type', context);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.above(0);
    });
    
    it('should validate a valid model context', () => {
      const context = {
        operation: 'train',
        modelId: 'model:123',
        modelType: 'gnn',
        parameters: { layers: 3 },
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.gnn.model', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should validate a valid prediction context', () => {
      const context = {
        operation: 'predict',
        predictionId: 'pred:123',
        modelId: 'model:123',
        entityCount: 5,
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.gnn.prediction', context);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should reject a context with invalid enum value', () => {
      const context = {
        operation: 'invalid-operation', // Not in enum
        nodeId: 'person:123',
        nodeType: 'person',
        timestamp: Date.now()
      };
      
      const result = validateKnowledgeContext('knowledge.graph.update.node', context);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.above(0);
    });
  });
  
  describe('Schema Coverage', () => {
    it('should have schemas for all knowledge context types', () => {
      const expectedTypes = [
        'knowledge.graph.update.node',
        'knowledge.graph.update.edge',
        'knowledge.graph.query',
        'knowledge.graph.inference',
        'knowledge.hypergraph.relation',
        'knowledge.hypergraph.query',
        'knowledge.temporal.version',
        'knowledge.temporal.history',
        'knowledge.probabilistic.confidence',
        'knowledge.probabilistic.uncertainty',
        'knowledge.gnn.embedding',
        'knowledge.gnn.model',
        'knowledge.gnn.prediction'
      ];
      
      for (const type of expectedTypes) {
        expect(knowledgeContextSchemas[type]).to.exist;
      }
    });
  });
});

describe('Knowledge Context Provider Integration', () => {
  // Mock dependencies with proper Promise resolution
  const mockContextManager = {
    addContext: sinon.stub().resolves('context-123'),
    queryContexts: sinon.stub().resolves([]),
    getContext: sinon.stub().resolves(null),
    updateContext: sinon.stub().resolves(true),
    removeContext: sinon.stub().resolves(true),
    registerContextProvider: sinon.stub().resolves(true),
    isInitialized: true
  };
  
  const mockLogger = {
    info: sinon.spy(),
    debug: sinon.spy(),
    warn: sinon.spy(),
    error: sinon.spy()
  };
  
  // Import providers using the TestModuleResolver
  const { MCPKnowledgeGraphContextProvider } = requireModule('tentacles/multimodal/context/providers/MCPKnowledgeGraphContextProvider');
  const { MCPKnowledgeGraphManagerProvider } = requireModule('tentacles/multimodal/context/providers/MCPKnowledgeGraphManagerProvider');
  const { MCPHypergraphManagerProvider } = requireModule('tentacles/multimodal/context/providers/MCPHypergraphManagerProvider');
  
  describe('KnowledgeGraphManagerProvider', () => {
    let provider;
    let mockKnowledgeGraphManager;
    
    beforeEach(() => {
      // Reset all stubs and spies
      mockContextManager.registerContextProvider.reset();
      mockContextManager.addContext.reset();
      mockLogger.info.resetHistory();
      
      mockKnowledgeGraphManager = {
        on: sinon.spy()
      };
      
      provider = new MCPKnowledgeGraphManagerProvider({
        logger: mockLogger,
        contextManager: mockContextManager,
        knowledgeGraphManager: mockKnowledgeGraphManager
      });
    });
    
    it('should initialize and register with context manager', async () => {
      // Explicitly ensure the stub returns a resolved promise with true
      mockContextManager.registerContextProvider = sinon.stub().resolves(true);
      
      const result = await provider.initialize();
      
      expect(result).to.be.true;
      expect(mockContextManager.registerContextProvider.called).to.be.true;
    });
    
    it('should set up event listeners during initialization', async () => {
      // Ensure registerContextProvider resolves properly
      mockContextManager.registerContextProvider = sinon.stub().resolves(true);
      
      await provider.initialize();
      
      // Verify that event listeners are set up for all expected events
      expect(mockKnowledgeGraphManager.on.calledWith('nodeAdded')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('nodeUpdated')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('nodeRemoved')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('edgeAdded')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('edgeUpdated')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('edgeRemoved')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('graphQueried')).to.be.true;
      expect(mockKnowledgeGraphManager.on.calledWith('inferencePerformed')).to.be.true;
    });
    
    it('should add node context when handleNodeAdded is called', async () => {
      // Ensure the provider is initialized
      mockContextManager.registerContextProvider = sinon.stub().resolves(true);
      await provider.initialize();
      
      // Reset the addContext stub to ensure we're only counting calls from this test
      mockContextManager.addContext.reset();
      
      const nodeEvent = {
        nodeId: 'person:123',
        nodeType: 'person',
        properties: { name: 'John Doe' },
        confidence: 0.9
      };
      
      await provider.handleNodeAdded(nodeEvent);
      
      expect(mockContextManager.addContext.calledOnce).to.be.true;
      const contextArg = mockContextManager.addContext.firstCall.args[0];
      
      // Verify context structure
      expect(contextArg.source).to.equal('MCPKnowledgeGraphManagerProvider');
      expect(contextArg.type).to.equal('knowledge.graph.update.node');
      expect(contextArg.data.operation).to.equal('add');
      expect(contextArg.data.nodeId).to.equal('person:123');
      expect(contextArg.data.nodeType).to.equal('person');
      expect(contextArg.data.properties).to.deep.equal({ name: 'John Doe' });
      expect(contextArg.confidence).to.equal(0.9);
    });
  });
  
  describe('HypergraphManagerProvider', () => {
    let provider;
    let mockHypergraphManager;
    
    beforeEach(() => {
      // Reset all stubs and spies
      mockContextManager.registerContextProvider.reset();
      mockContextManager.addContext.reset();
      mockLogger.info.resetHistory();
      
      mockHypergraphManager = {
        on: sinon.spy()
      };
      
      provider = new MCPHypergraphManagerProvider({
        logger: mockLogger,
        contextManager: mockContextManager,
        hypergraphManager: mockHypergraphManager
      });
    });
    
    it('should initialize and register with context manager', async () => {
      // Explicitly ensure the stub returns a resolved promise with true
      mockContextManager.registerContextProvider = sinon.stub().resolves(true);
      
      const result = await provider.initialize();
      
      expect(result).to.be.true;
      expect(mockContextManager.registerContextProvider.called).to.be.true;
    });
    
    it('should set up event listeners during initialization', async () => {
      // Ensure registerContextProvider resolves properly
      mockContextManager.registerContextProvider = sinon.stub().resolves(true);
      
      await provider.initialize();
      
      // Verify that event listeners are set up for all expected events
      expect(mockHypergraphManager.on.calledWith('hyperedgeAdded')).to.be.true;
      expect(mockHypergraphManager.on.calledWith('hyperedgeUpdated')).to.be.true;
      expect(mockHypergraphManager.on.calledWith('hyperedgeRemoved')).to.be.true;
      expect(mockHypergraphManager.on.calledWith('hypergraphQueried')).to.be.true;
    });
    
    it('should add hyperedge context when handleHyperedgeAdded is called', async () => {
      // Ensure the provider is initialized
      mockContextManager.registerContextProvider = sinon.stub().resolves(true);
      await provider.initialize();
      
      // Reset the addContext stub to ensure we're only counting calls from this test
      mockContextManager.addContext.reset();
      
      const hyperedgeEvent = {
        hyperedgeId: 'team:123',
        nodeIds: ['person:123', 'person:456', 'person:789'],
        type: 'team',
        properties: { name: 'Project Team' },
        confidence: 0.85
      };
      
      await provider.handleHyperedgeAdded(hyperedgeEvent);
      
      expect(mockContextManager.addContext.calledOnce).to.be.true;
      const contextArg = mockContextManager.addContext.firstCall.args[0];
      
      // Verify context structure
      expect(contextArg.source).to.equal('MCPHypergraphManagerProvider');
      expect(contextArg.type).to.equal('knowledge.hypergraph.relation');
      expect(contextArg.data.operation).to.equal('add');
      expect(contextArg.data.hyperedgeId).to.equal('team:123');
      expect(contextArg.data.nodeIds).to.deep.equal(['person:123', 'person:456', 'person:789']);
      expect(contextArg.data.type).to.equal('team');
      expect(contextArg.confidence).to.equal(0.85);
    });
  });
  
  describe('Cross-Provider Integration', () => {
    it('should ensure all providers use consistent context schemas', () => {
      // Create instances of all providers with proper mocks
      const providers = [
        new MCPKnowledgeGraphManagerProvider({
          logger: mockLogger,
          contextManager: mockContextManager,
          knowledgeGraphManager: { on: sinon.spy() }
        }),
        new MCPHypergraphManagerProvider({
          logger: mockLogger,
          contextManager: mockContextManager,
          hypergraphManager: { on: sinon.spy() }
        })
      ];
      
      // Verify that all providers have a contextTypePrefix
      for (const provider of providers) {
        expect(provider.contextTypePrefix).to.be.a('string');
      }
      
      // Verify that all providers have a getSupportedContextTypes method
      for (const provider of providers) {
        expect(provider.getSupportedContextTypes).to.be.a('function');
        expect(provider.getSupportedContextTypes()).to.be.an('array');
      }
    });
  });
});
