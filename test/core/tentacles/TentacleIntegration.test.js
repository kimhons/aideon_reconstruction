/**
 * @fileoverview Tests for the TentacleRegistry and AideonCore integration
 * 
 * This module tests the integration of tentacles into the Aideon core system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');
chai.use(sinonChai);

const { TentacleRegistry } = require('../../../src/core/tentacles/TentacleRegistry');
const { AideonCore } = require('../../../src/core/AideonCore');
const { TentacleBase } = require('../../../src/core/tentacles/TentacleBase');

// Create a mock tentacle for testing
class MockTentacle extends TentacleBase {
  constructor(options = {}) {
    super(options);
    this.initializeCalled = false;
    this.shutdownCalled = false;
  }

  async initialize() {
    this.initializeCalled = true;
    this.initialized = true;
    return true;
  }

  async shutdown() {
    this.shutdownCalled = true;
    this.initialized = false;
    return true;
  }
}

describe('Tentacle Integration', function() {
  describe('TentacleRegistry', function() {
    let registry;
    let mockAideon;
    let mockApi;
    
    beforeEach(function() {
      mockAideon = {};
      mockApi = {
        register: sinon.stub().returns(true)
      };
      
      registry = new TentacleRegistry({
        aideon: mockAideon,
        api: mockApi
      });
    });
    
    afterEach(async function() {
      if (registry && registry.initialized) {
        await registry.shutdown();
      }
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Stub the loadBuiltInTentacles method to avoid actual loading
      sinon.stub(registry, 'loadBuiltInTentacles').resolves();
      
      const result = await registry.initialize();
      
      expect(result).to.be.true;
      expect(registry.initialized).to.be.true;
      expect(registry.loadBuiltInTentacles).to.have.been.calledOnce;
    });
    
    it('should register a tentacle', async function() {
      await registry.initialize();
      
      const mockTentacle = new MockTentacle({ id: 'mock', name: 'Mock Tentacle' });
      const result = await registry.registerTentacle('mock', mockTentacle);
      
      expect(result).to.be.true;
      expect(registry.tentacles.has('mock')).to.be.true;
      expect(mockTentacle.initializeCalled).to.be.true;
    });
    
    it('should get a tentacle by ID', async function() {
      await registry.initialize();
      
      const mockTentacle = new MockTentacle({ id: 'mock', name: 'Mock Tentacle' });
      await registry.registerTentacle('mock', mockTentacle);
      
      const tentacle = registry.getTentacle('mock');
      
      expect(tentacle).to.equal(mockTentacle);
    });
    
    it('should get all tentacles', async function() {
      await registry.initialize();
      
      const mockTentacle1 = new MockTentacle({ id: 'mock1', name: 'Mock Tentacle 1' });
      const mockTentacle2 = new MockTentacle({ id: 'mock2', name: 'Mock Tentacle 2' });
      
      await registry.registerTentacle('mock1', mockTentacle1);
      await registry.registerTentacle('mock2', mockTentacle2);
      
      const tentacles = registry.getAllTentacles();
      
      expect(tentacles.size).to.equal(2);
      expect(tentacles.get('mock1')).to.equal(mockTentacle1);
      expect(tentacles.get('mock2')).to.equal(mockTentacle2);
    });
    
    it('should get status of all tentacles', async function() {
      await registry.initialize();
      
      const mockTentacle = new MockTentacle({ id: 'mock', name: 'Mock Tentacle' });
      await registry.registerTentacle('mock', mockTentacle);
      
      const status = registry.getStatus();
      
      expect(status.initialized).to.be.true;
      expect(status.tentacleCount).to.equal(1);
      expect(status.tentacles).to.have.property('mock');
    });
    
    it('should shutdown all tentacles', async function() {
      await registry.initialize();
      
      const mockTentacle1 = new MockTentacle({ id: 'mock1', name: 'Mock Tentacle 1' });
      const mockTentacle2 = new MockTentacle({ id: 'mock2', name: 'Mock Tentacle 2' });
      
      await registry.registerTentacle('mock1', mockTentacle1);
      await registry.registerTentacle('mock2', mockTentacle2);
      
      const result = await registry.shutdown();
      
      expect(result).to.be.true;
      expect(registry.initialized).to.be.false;
      expect(mockTentacle1.shutdownCalled).to.be.true;
      expect(mockTentacle2.shutdownCalled).to.be.true;
      expect(registry.tentacles.size).to.equal(0);
    });
  });
  
  describe('AideonCore', function() {
    let core;
    
    beforeEach(function() {
      core = new AideonCore();
    });
    
    afterEach(async function() {
      if (core && core.initialized) {
        await core.shutdown();
      }
      sinon.restore();
    });
    
    it('should initialize successfully', async function() {
      // Stub the tentacle registry initialize method
      sinon.stub(core.tentacles, 'initialize').resolves(true);
      sinon.stub(core.api, 'initialize').resolves(true);
      
      const result = await core.initialize();
      
      expect(result).to.be.true;
      expect(core.initialized).to.be.true;
      expect(core.tentacles.initialize).to.have.been.calledOnce;
      expect(core.api.initialize).to.have.been.calledOnce;
    });
    
    it('should get status', async function() {
      sinon.stub(core.tentacles, 'initialize').resolves(true);
      sinon.stub(core.api, 'initialize').resolves(true);
      sinon.stub(core.tentacles, 'getStatus').returns({ initialized: true, tentacleCount: 2 });
      sinon.stub(core.api, 'getStatus').returns({ initialized: true, apiCount: 5 });
      
      await core.initialize();
      
      const status = core.getStatus();
      
      expect(status.initialized).to.be.true;
      expect(status.tentacles).to.deep.equal({ initialized: true, tentacleCount: 2 });
      expect(status.api).to.deep.equal({ initialized: true, apiCount: 5 });
    });
    
    it('should shutdown successfully', async function() {
      sinon.stub(core.tentacles, 'initialize').resolves(true);
      sinon.stub(core.api, 'initialize').resolves(true);
      sinon.stub(core.tentacles, 'shutdown').resolves(true);
      sinon.stub(core.api, 'shutdown').resolves(true);
      
      await core.initialize();
      const result = await core.shutdown();
      
      expect(result).to.be.true;
      expect(core.initialized).to.be.false;
      expect(core.tentacles.shutdown).to.have.been.calledOnce;
      expect(core.api.shutdown).to.have.been.calledOnce;
    });
    
    it('should get tentacle by ID', async function() {
      const mockTentacle = new MockTentacle();
      sinon.stub(core.tentacles, 'getTentacle').returns(mockTentacle);
      
      const tentacle = core.getTentacle('mock');
      
      expect(tentacle).to.equal(mockTentacle);
      expect(core.tentacles.getTentacle).to.have.been.calledWith('mock');
    });
    
    it('should get all tentacles', function() {
      const mockTentacles = new Map();
      mockTentacles.set('mock1', new MockTentacle());
      mockTentacles.set('mock2', new MockTentacle());
      
      sinon.stub(core.tentacles, 'getAllTentacles').returns(mockTentacles);
      
      const tentacles = core.getAllTentacles();
      
      expect(tentacles).to.equal(mockTentacles);
      expect(core.tentacles.getAllTentacles).to.have.been.calledOnce;
    });
  });
  
  describe('End-to-End Integration', function() {
    let core;
    
    beforeEach(function() {
      // Create a fresh AideonCore instance for each test
      core = new AideonCore();
      
      // Stub the require calls in TentacleRegistry to return mock tentacles
      const mockDevMasterTentacle = new MockTentacle({ 
        id: 'devmaster', 
        name: 'DevMaster Tentacle',
        version: '1.0.0'
      });
      
      const mockContextualIntelligenceTentacle = new MockTentacle({
        id: 'contextual_intelligence',
        name: 'Contextual Intelligence Tentacle',
        version: '1.0.0'
      });
      
      // Use proxyquire to mock the require calls
      const proxyquire = require('proxyquire').noCallThru();
      const TentacleRegistryWithMocks = proxyquire('../../../src/core/tentacles/TentacleRegistry', {
        '../../tentacles/devmaster': { 
          DevMasterTentacle: function() { return mockDevMasterTentacle; }
        },
        '../../tentacles/contextual_intelligence': {
          ContextualIntelligenceTentacle: function() { return mockContextualIntelligenceTentacle; }
        }
      }).TentacleRegistry;
      
      // Replace the TentacleRegistry in the core with our mocked version
      core.tentacles = new TentacleRegistryWithMocks({
        aideon: core,
        api: core.api
      });
    });
    
    afterEach(async function() {
      if (core && core.initialized) {
        await core.shutdown();
      }
    });
    
    it('should load and initialize both tentacles during core initialization', async function() {
      const result = await core.initialize();
      
      expect(result).to.be.true;
      expect(core.initialized).to.be.true;
      
      // Verify both tentacles were loaded
      const devMaster = core.getTentacle('devmaster');
      const contextualIntelligence = core.getTentacle('contextual_intelligence');
      
      expect(devMaster).to.exist;
      expect(contextualIntelligence).to.exist;
      expect(devMaster.initialized).to.be.true;
      expect(contextualIntelligence.initialized).to.be.true;
    });
    
    it('should shutdown both tentacles during core shutdown', async function() {
      await core.initialize();
      
      const devMaster = core.getTentacle('devmaster');
      const contextualIntelligence = core.getTentacle('contextual_intelligence');
      
      const result = await core.shutdown();
      
      expect(result).to.be.true;
      expect(core.initialized).to.be.false;
      expect(devMaster.shutdownCalled).to.be.true;
      expect(contextualIntelligence.shutdownCalled).to.be.true;
    });
    
    it('should report status of both tentacles', async function() {
      await core.initialize();
      
      const status = core.getStatus();
      
      expect(status.initialized).to.be.true;
      expect(status.tentacles.tentacles).to.have.property('devmaster');
      expect(status.tentacles.tentacles).to.have.property('contextual_intelligence');
    });
  });
});
