/**
 * @fileoverview Tests for the Aideon Tentacle Marketplace Core
 * 
 * This module provides comprehensive tests for the MarketplaceCore and its components.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { MarketplaceCore } = require('../../../src/marketplace/MarketplaceCore');
const { RegistryService } = require('../../../src/marketplace/core/registry/RegistryService');
const { LocalRepositoryManager } = require('../../../src/marketplace/integration/repository/LocalRepositoryManager');
const { TentacleRegistryConnector } = require('../../../src/marketplace/integration/connector/TentacleRegistryConnector');
const { MarketplaceBrowser } = require('../../../src/marketplace/ui/browser/MarketplaceBrowser');
const { InstallationManager } = require('../../../src/marketplace/ui/installation/InstallationManager');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

describe('MarketplaceCore', function() {
  let marketplaceCore;
  let tentacleRegistryStub;
  let tempDir;
  
  before(async function() {
    // Create temporary directory for tests
    tempDir = path.join(os.tmpdir(), `marketplace-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  after(async function() {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  beforeEach(function() {
    // Create stub for TentacleRegistry
    tentacleRegistryStub = {
      registerTentacle: sinon.stub().resolves(true),
      unregisterTentacle: sinon.stub().resolves(true),
      getTentacle: sinon.stub().returns(null)
    };
    
    // Create MarketplaceCore instance
    marketplaceCore = new MarketplaceCore({
      tentacleRegistry: tentacleRegistryStub,
      storagePath: tempDir
    });
  });
  
  afterEach(async function() {
    // Shutdown marketplace core
    if (marketplaceCore && marketplaceCore.initialized) {
      await marketplaceCore.shutdown();
    }
  });
  
  describe('Initialization', function() {
    it('should initialize successfully', async function() {
      const result = await marketplaceCore.initialize();
      expect(result).to.be.true;
      expect(marketplaceCore.initialized).to.be.true;
    });
    
    it('should not initialize twice', async function() {
      await marketplaceCore.initialize();
      const loggerSpy = sinon.spy(marketplaceCore.logger, 'warn');
      
      const result = await marketplaceCore.initialize();
      
      expect(result).to.be.true;
      expect(loggerSpy.calledWith('MarketplaceCore already initialized')).to.be.true;
    });
    
    it('should throw error if TentacleRegistry is not provided', async function() {
      marketplaceCore = new MarketplaceCore({
        storagePath: tempDir
      });
      
      try {
        await marketplaceCore.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('TentacleRegistry reference is required');
      }
    });
    
    it('should initialize all components', async function() {
      await marketplaceCore.initialize();
      
      expect(marketplaceCore.components.registryService).to.be.instanceOf(RegistryService);
      expect(marketplaceCore.components.localRepositoryManager).to.be.instanceOf(LocalRepositoryManager);
      expect(marketplaceCore.components.tentacleRegistryConnector).to.be.instanceOf(TentacleRegistryConnector);
      expect(marketplaceCore.components.marketplaceBrowser).to.be.instanceOf(MarketplaceBrowser);
      expect(marketplaceCore.components.installationManager).to.be.instanceOf(InstallationManager);
      
      expect(marketplaceCore.components.registryService.initialized).to.be.true;
      expect(marketplaceCore.components.localRepositoryManager.initialized).to.be.true;
      expect(marketplaceCore.components.tentacleRegistryConnector.initialized).to.be.true;
      expect(marketplaceCore.components.marketplaceBrowser.initialized).to.be.true;
      expect(marketplaceCore.components.installationManager.initialized).to.be.true;
    });
  });
  
  describe('Component Access', function() {
    beforeEach(async function() {
      await marketplaceCore.initialize();
    });
    
    it('should provide access to RegistryService', function() {
      const registryService = marketplaceCore.getRegistryService();
      expect(registryService).to.be.instanceOf(RegistryService);
    });
    
    it('should provide access to LocalRepositoryManager', function() {
      const localRepositoryManager = marketplaceCore.getLocalRepositoryManager();
      expect(localRepositoryManager).to.be.instanceOf(LocalRepositoryManager);
    });
    
    it('should provide access to TentacleRegistryConnector', function() {
      const tentacleRegistryConnector = marketplaceCore.getTentacleRegistryConnector();
      expect(tentacleRegistryConnector).to.be.instanceOf(TentacleRegistryConnector);
    });
    
    it('should provide access to MarketplaceBrowser', function() {
      const marketplaceBrowser = marketplaceCore.getMarketplaceBrowser();
      expect(marketplaceBrowser).to.be.instanceOf(MarketplaceBrowser);
    });
    
    it('should provide access to InstallationManager', function() {
      const installationManager = marketplaceCore.getInstallationManager();
      expect(installationManager).to.be.instanceOf(InstallationManager);
    });
    
    it('should throw error if accessing components before initialization', async function() {
      await marketplaceCore.shutdown();
      
      expect(() => marketplaceCore.getRegistryService()).to.throw('MarketplaceCore not initialized');
      expect(() => marketplaceCore.getLocalRepositoryManager()).to.throw('MarketplaceCore not initialized');
      expect(() => marketplaceCore.getTentacleRegistryConnector()).to.throw('MarketplaceCore not initialized');
      expect(() => marketplaceCore.getMarketplaceBrowser()).to.throw('MarketplaceCore not initialized');
      expect(() => marketplaceCore.getInstallationManager()).to.throw('MarketplaceCore not initialized');
    });
  });
  
  describe('API', function() {
    beforeEach(async function() {
      await marketplaceCore.initialize();
    });
    
    it('should provide browse API', function() {
      const browseApi = marketplaceCore.browse();
      
      expect(browseApi).to.have.property('getFeatured').that.is.a('function');
      expect(browseApi).to.have.property('getTrending').that.is.a('function');
      expect(browseApi).to.have.property('getNewest').that.is.a('function');
      expect(browseApi).to.have.property('getByCategory').that.is.a('function');
      expect(browseApi).to.have.property('search').that.is.a('function');
      expect(browseApi).to.have.property('getTentacleDetails').that.is.a('function');
      expect(browseApi).to.have.property('getCategories').that.is.a('function');
    });
    
    it('should provide manage API', function() {
      const manageApi = marketplaceCore.manage();
      
      expect(manageApi).to.have.property('install').that.is.a('function');
      expect(manageApi).to.have.property('uninstall').that.is.a('function');
      expect(manageApi).to.have.property('update').that.is.a('function');
      expect(manageApi).to.have.property('isInstalled').that.is.a('function');
      expect(manageApi).to.have.property('getStatus').that.is.a('function');
    });
    
    it('should throw error if accessing API before initialization', async function() {
      await marketplaceCore.shutdown();
      
      expect(() => marketplaceCore.browse()).to.throw('MarketplaceCore not initialized');
      expect(() => marketplaceCore.manage()).to.throw('MarketplaceCore not initialized');
    });
  });
  
  describe('Event Forwarding', function() {
    beforeEach(async function() {
      await marketplaceCore.initialize();
    });
    
    it('should forward registry events', function() {
      const spy = sinon.spy();
      marketplaceCore.events.on('registry:tentacle:registered', spy);
      
      const event = { tentacle: { id: 'test-tentacle' } };
      marketplaceCore.components.registryService.events.emit('tentacle:registered', event);
      
      expect(spy.calledWith(event)).to.be.true;
    });
    
    it('should forward repository events', function() {
      const spy = sinon.spy();
      marketplaceCore.events.on('repository:tentacle:installed', spy);
      
      const event = { tentacle: { id: 'test-tentacle' } };
      marketplaceCore.components.localRepositoryManager.events.emit('tentacle:installed', event);
      
      expect(spy.calledWith(event)).to.be.true;
    });
    
    it('should forward connector events', function() {
      const spy = sinon.spy();
      marketplaceCore.events.on('connector:tentacle:registered', spy);
      
      const event = { tentacle: { id: 'test-tentacle' } };
      marketplaceCore.components.tentacleRegistryConnector.events.emit('tentacle:registered', event);
      
      expect(spy.calledWith(event)).to.be.true;
    });
    
    it('should forward installation events', function() {
      const spy = sinon.spy();
      marketplaceCore.events.on('installation:tentacle:installed', spy);
      
      const event = { tentacle: { id: 'test-tentacle' } };
      marketplaceCore.components.installationManager.events.emit('tentacle:installed', event);
      
      expect(spy.calledWith(event)).to.be.true;
    });
  });
  
  describe('Status', function() {
    it('should return status when not initialized', async function() {
      const status = await marketplaceCore.getStatus();
      
      expect(status).to.have.property('initialized', false);
      expect(status).to.have.property('components').that.is.an('object');
      expect(Object.keys(status.components)).to.have.lengthOf(0);
    });
    
    it('should return status when initialized', async function() {
      await marketplaceCore.initialize();
      
      const status = await marketplaceCore.getStatus();
      
      expect(status).to.have.property('initialized', true);
      expect(status).to.have.property('components').that.is.an('object');
      expect(status.components).to.have.property('registryService');
      expect(status.components).to.have.property('localRepositoryManager');
      expect(status.components).to.have.property('tentacleRegistryConnector');
      expect(status.components).to.have.property('marketplaceBrowser');
      expect(status.components).to.have.property('installationManager');
    });
  });
  
  describe('Shutdown', function() {
    it('should shutdown successfully', async function() {
      await marketplaceCore.initialize();
      
      const result = await marketplaceCore.shutdown();
      
      expect(result).to.be.true;
      expect(marketplaceCore.initialized).to.be.false;
    });
    
    it('should not shutdown if not initialized', async function() {
      const loggerSpy = sinon.spy(marketplaceCore.logger, 'warn');
      
      const result = await marketplaceCore.shutdown();
      
      expect(result).to.be.true;
      expect(loggerSpy.calledWith('MarketplaceCore not initialized')).to.be.true;
    });
    
    it('should shutdown all components', async function() {
      await marketplaceCore.initialize();
      
      // Create spies for component shutdown methods
      const registryServiceSpy = sinon.spy(marketplaceCore.components.registryService, 'shutdown');
      const localRepositoryManagerSpy = sinon.spy(marketplaceCore.components.localRepositoryManager, 'shutdown');
      const tentacleRegistryConnectorSpy = sinon.spy(marketplaceCore.components.tentacleRegistryConnector, 'shutdown');
      const marketplaceBrowserSpy = sinon.spy(marketplaceCore.components.marketplaceBrowser, 'shutdown');
      const installationManagerSpy = sinon.spy(marketplaceCore.components.installationManager, 'shutdown');
      
      await marketplaceCore.shutdown();
      
      expect(registryServiceSpy.calledOnce).to.be.true;
      expect(localRepositoryManagerSpy.calledOnce).to.be.true;
      expect(tentacleRegistryConnectorSpy.calledOnce).to.be.true;
      expect(marketplaceBrowserSpy.calledOnce).to.be.true;
      expect(installationManagerSpy.calledOnce).to.be.true;
    });
  });
});
