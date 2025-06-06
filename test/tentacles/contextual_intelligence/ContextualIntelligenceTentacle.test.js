/**
 * @fileoverview Tests for the Contextual Intelligence Tentacle.
 * Tests the integration and functionality of all components.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');
const testSetup = require('./setup');
chai.use(sinonChai);

// Import modules using proxyquire to handle missing dependencies
const proxyquire = require('proxyquire').noCallThru();

// Create stubs for visualization tool which may not be implemented yet
const VisualizationToolStub = class ContextVisualizationToolStub {
  constructor(options = {}) {
    this.options = options;
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return true;
  }
  
  async visualizeContext() { 
    return Promise.resolve(null); 
  }
  
  async shutdown() {
    this.initialized = false;
    return true;
  }
};

// Import with stubs
const {
  ContextualIntelligenceTentacle,
  ContextManager,
  ContextHierarchyManager,
  TemporalContextManager,
  CrossDomainContextManager,
  ContextPersistenceManager,
  ContextAnalysisEngine
} = proxyquire('../../../src/tentacles/contextual_intelligence', {
  './visualization_tool/ContextVisualizationTool': VisualizationToolStub
});

describe('Contextual Intelligence Tentacle', function() {
  let tentacle;
  
  beforeEach(function() {
    tentacle = new ContextualIntelligenceTentacle();
  });
  
  afterEach(async function() {
    if (tentacle && tentacle.initialized) {
      await tentacle.shutdown();
    }
  });
  
  describe('Initialization', function() {
    it('should initialize successfully', async function() {
      const result = await tentacle.initialize();
      expect(result).to.be.true;
      expect(tentacle.initialized).to.be.true;
    });
    
    it('should not initialize twice', async function() {
      await tentacle.initialize();
      
      // Use sinon to spy on the contextManager's initialize method
      const spy = sinon.spy(tentacle.components.contextManager, 'initialize');
      
      await tentacle.initialize();
      
      expect(spy.called).to.be.false;
      spy.restore();
    });
  });
  
  describe('Component Access', function() {
    beforeEach(async function() {
      await tentacle.initialize();
    });
    
    it('should provide access to ContextManager', function() {
      const manager = tentacle.getContextManager();
      expect(manager).to.be.an.instanceOf(ContextManager);
    });
    
    it('should provide access to ContextHierarchyManager', function() {
      const manager = tentacle.getContextHierarchyManager();
      expect(manager).to.be.an.instanceOf(ContextHierarchyManager);
    });
    
    it('should provide access to TemporalContextManager', function() {
      const manager = tentacle.getTemporalContextManager();
      expect(manager).to.be.an.instanceOf(TemporalContextManager);
    });
    
    it('should provide access to CrossDomainContextManager', function() {
      const manager = tentacle.getCrossDomainContextManager();
      expect(manager).to.be.an.instanceOf(CrossDomainContextManager);
    });
    
    it('should provide access to ContextPersistenceManager', function() {
      const manager = tentacle.getContextPersistenceManager();
      expect(manager).to.be.an.instanceOf(ContextPersistenceManager);
    });
    
    it('should provide access to ContextAnalysisEngine', function() {
      const engine = tentacle.getContextAnalysisEngine();
      expect(engine).to.be.an.instanceOf(ContextAnalysisEngine);
    });
  });
  
  describe('Shutdown', function() {
    it('should shutdown successfully', async function() {
      await tentacle.initialize();
      const spy = sinon.spy(tentacle.components.contextManager, 'shutdown');
      
      const result = await tentacle.shutdown();
      
      expect(result).to.be.true;
      expect(tentacle.initialized).to.be.false;
      expect(spy.calledOnce).to.be.true;
      spy.restore();
    });
    
    it('should do nothing if not initialized', async function() {
      const result = await tentacle.shutdown();
      expect(result).to.be.true;
    });
  });
});

describe('ContextManager Integration', function() {
  let contextManager;
  let eventEmitter;
  let hierarchyManager;
  let temporalManager;
  let crossDomainManager;
  let persistenceManager;
  let analysisEngine;
  let visualizationTool;
  
  beforeEach(function() {
    const EventEmitter = require('events');
    eventEmitter = new EventEmitter();
    
    // Create real instances of all components
    hierarchyManager = new ContextHierarchyManager({ eventEmitter });
    temporalManager = new TemporalContextManager({ eventEmitter });
    crossDomainManager = new CrossDomainContextManager({ eventEmitter });
    persistenceManager = new ContextPersistenceManager({ eventEmitter });
    analysisEngine = new ContextAnalysisEngine({ eventEmitter });
    visualizationTool = new VisualizationToolStub({ eventEmitter });
    
    // Only create spies for methods that actually exist and will be called
    // No need to spy on initialize methods as we'll call them directly
    
    // Create stubs only for methods we need to control
    sinon.stub(persistenceManager, 'loadContext').resolves(null);
    sinon.stub(persistenceManager, 'saveContext').resolves(true);
    
    contextManager = new ContextManager({
      eventEmitter,
      hierarchyManager,
      temporalManager,
      crossDomainManager,
      persistenceManager,
      analysisEngine,
      visualizationTool
    });
  });
  
  afterEach(async function() {
    if (contextManager && contextManager.initialized) {
      await contextManager.shutdown();
    }
    
    // Restore all stubs and spies
    sinon.restore();
  });
  
  describe('Context Registration and Retrieval', function() {
    beforeEach(async function() {
      await contextManager.initialize();
    });
    
    it('should register and retrieve a context', async function() {
      const path = 'test.context';
      const contextDef = {
        type: 'test',
        initialState: {
          value: 42,
          name: 'Test Context'
        }
      };
      
      const registerResult = await contextManager.registerContext(path, contextDef);
      expect(registerResult).to.be.true;
      
      const context = contextManager.getContext(path);
      expect(context).to.exist;
      expect(context.value).to.equal(42);
      expect(context.name).to.equal('Test Context');
      expect(context._type).to.equal('test');
    });
    
    it('should update a context', async function() {
      const path = 'test.context';
      await contextManager.registerContext(path, {
        type: 'test',
        initialState: { value: 42 }
      });
      
      const updateResult = await contextManager.updateContext(path, { value: 84 });
      expect(updateResult).to.be.true;
      
      const context = contextManager.getContext(path);
      expect(context.value).to.equal(84);
    });
    
    it('should delete a context', async function() {
      const path = 'test.context';
      await contextManager.registerContext(path, {
        type: 'test',
        initialState: { value: 42 }
      });
      
      const deleteResult = await contextManager.deleteContext(path);
      expect(deleteResult).to.be.true;
      
      const context = contextManager.getContext(path);
      expect(context).to.be.null;
    });
    
    it('should watch for context changes', async function() {
      const path = 'test.context';
      await contextManager.registerContext(path, {
        type: 'test',
        initialState: { value: 42 }
      });
      
      const spy = sinon.spy();
      const stopWatching = contextManager.watchContext(path, spy);
      
      await contextManager.updateContext(path, { value: 84 });
      
      expect(spy.calledOnce).to.be.true;
      const [newValue] = spy.firstCall.args;
      expect(newValue.value).to.equal(84);
      
      stopWatching();
    });
  });
});
