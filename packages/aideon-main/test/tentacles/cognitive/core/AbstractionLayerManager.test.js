/**
 * @fileoverview Tests for AbstractionLayerManager component.
 * Validates the functionality, error handling, and integration capabilities.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { AbstractionLayerManager } = require('../../../../src/tentacles/cognitive/core/AbstractionLayerManager');
const { Logger } = require('../../../../src/core/logging/Logger');
const { PerformanceMonitor } = require('../../../../src/core/monitoring/PerformanceMonitor');
const { ConfigurationService } = require('../../../../src/core/ConfigurationService');
const { SecurityManager } = require('../../../../src/core/SecurityManager');

describe('AbstractionLayerManager', function() {
  let abstractionLayerManager;
  let configService;
  let logger;
  let performanceMonitor;
  let securityManager;
  
  beforeEach(function() {
    // Create mocks/stubs for dependencies
    configService = new ConfigurationService({
      defaultConfig: {
        cognitive: {
          abstraction: {
            maxLayers: 5,
            defaultLayer: 'semantic',
            enabledLayers: ['raw', 'syntactic', 'semantic', 'conceptual', 'abstract'],
            cacheEnabled: true,
            cacheTTL: 3600000
          }
        }
      }
    });
    
    logger = new Logger('AbstractionLayerManagerTest');
    performanceMonitor = new PerformanceMonitor({ configService, logger });
    securityManager = new SecurityManager({ configService, logger });
    
    // Create instance of AbstractionLayerManager
    abstractionLayerManager = new AbstractionLayerManager({
      configService,
      logger,
      performanceMonitor,
      securityManager
    });
  });
  
  afterEach(function() {
    // Clean up
    sinon.restore();
    if (abstractionLayerManager) {
      abstractionLayerManager.dispose();
    }
    if (performanceMonitor) {
      performanceMonitor.dispose();
    }
    if (securityManager) {
      securityManager.dispose();
    }
  });
  
  describe('Initialization', function() {
    it('should initialize with default configuration', function() {
      expect(abstractionLayerManager).to.be.an.instanceOf(AbstractionLayerManager);
      expect(abstractionLayerManager.layers).to.be.an('array').with.length(5);
      expect(abstractionLayerManager.currentLayer).to.equal('semantic');
    });
    
    it('should initialize with custom configuration', function() {
      const customConfig = new ConfigurationService({
        defaultConfig: {
          cognitive: {
            abstraction: {
              maxLayers: 3,
              defaultLayer: 'syntactic',
              enabledLayers: ['raw', 'syntactic', 'semantic'],
              cacheEnabled: false
            }
          }
        }
      });
      
      const customManager = new AbstractionLayerManager({
        configService: customConfig,
        logger,
        performanceMonitor,
        securityManager
      });
      
      expect(customManager.layers).to.be.an('array').with.length(3);
      expect(customManager.currentLayer).to.equal('syntactic');
      expect(customManager.cacheEnabled).to.be.false;
      
      customManager.dispose();
    });
    
    it('should throw error with invalid configuration', function() {
      const invalidConfig = new ConfigurationService({
        defaultConfig: {
          cognitive: {
            abstraction: {
              maxLayers: -1,
              defaultLayer: 'invalid',
              enabledLayers: []
            }
          }
        }
      });
      
      expect(() => new AbstractionLayerManager({
        configService: invalidConfig,
        logger,
        performanceMonitor,
        securityManager
      })).to.throw(Error);
    });
  });
  
  describe('Layer Management', function() {
    it('should get available layers', function() {
      const layers = abstractionLayerManager.getAvailableLayers();
      expect(layers).to.be.an('array').with.length(5);
      expect(layers).to.include('raw');
      expect(layers).to.include('syntactic');
      expect(layers).to.include('semantic');
      expect(layers).to.include('conceptual');
      expect(layers).to.include('abstract');
    });
    
    it('should set current layer', function() {
      expect(abstractionLayerManager.getCurrentLayer()).to.equal('semantic');
      
      abstractionLayerManager.setCurrentLayer('conceptual');
      expect(abstractionLayerManager.getCurrentLayer()).to.equal('conceptual');
      
      // Should throw error for invalid layer
      expect(() => abstractionLayerManager.setCurrentLayer('invalid')).to.throw(Error);
    });
    
    it('should validate layer existence', function() {
      expect(abstractionLayerManager.hasLayer('semantic')).to.be.true;
      expect(abstractionLayerManager.hasLayer('invalid')).to.be.false;
    });
  });
  
  describe('Data Processing', function() {
    it('should process data at current layer', function() {
      const data = { text: 'Hello world' };
      const result = abstractionLayerManager.processData(data);
      
      expect(result).to.be.an('object');
      expect(result.layer).to.equal('semantic');
      expect(result.processed).to.be.true;
      expect(result.data).to.include({ text: 'Hello world' });
    });
    
    it('should process data at specified layer', function() {
      const data = { text: 'Hello world' };
      const result = abstractionLayerManager.processDataAtLayer(data, 'raw');
      
      expect(result).to.be.an('object');
      expect(result.layer).to.equal('raw');
      expect(result.processed).to.be.true;
      expect(result.data).to.include({ text: 'Hello world' });
    });
    
    it('should throw error for invalid layer in processDataAtLayer', function() {
      const data = { text: 'Hello world' };
      expect(() => abstractionLayerManager.processDataAtLayer(data, 'invalid')).to.throw(Error);
    });
    
    it('should process data through multiple layers', function() {
      const data = { text: 'Hello world' };
      const result = abstractionLayerManager.processDataThroughLayers(data, ['raw', 'syntactic', 'semantic']);
      
      expect(result).to.be.an('array').with.length(3);
      expect(result[0].layer).to.equal('raw');
      expect(result[1].layer).to.equal('syntactic');
      expect(result[2].layer).to.equal('semantic');
      expect(result[2].processed).to.be.true;
    });
    
    it('should throw error for invalid layers in processDataThroughLayers', function() {
      const data = { text: 'Hello world' };
      expect(() => abstractionLayerManager.processDataThroughLayers(data, ['raw', 'invalid'])).to.throw(Error);
    });
  });
  
  describe('Caching', function() {
    it('should cache processed data when enabled', function() {
      // Enable caching
      abstractionLayerManager.setCacheEnabled(true);
      
      const data = { text: 'Hello world', id: 'test1' };
      
      // First call should process and cache
      const result1 = abstractionLayerManager.processData(data);
      expect(result1.processed).to.be.true;
      expect(result1.fromCache).to.be.undefined;
      
      // Second call with same data should return from cache
      const result2 = abstractionLayerManager.processData(data);
      expect(result2.processed).to.be.true;
      expect(result2.fromCache).to.be.true;
    });
    
    it('should not cache processed data when disabled', function() {
      // Disable caching
      abstractionLayerManager.setCacheEnabled(false);
      
      const data = { text: 'Hello world', id: 'test2' };
      
      // First call should process but not cache
      const result1 = abstractionLayerManager.processData(data);
      expect(result1.processed).to.be.true;
      expect(result1.fromCache).to.be.undefined;
      
      // Second call with same data should process again
      const result2 = abstractionLayerManager.processData(data);
      expect(result2.processed).to.be.true;
      expect(result2.fromCache).to.be.undefined;
    });
    
    it('should clear cache', function() {
      // Enable caching
      abstractionLayerManager.setCacheEnabled(true);
      
      const data = { text: 'Hello world', id: 'test3' };
      
      // First call should process and cache
      const result1 = abstractionLayerManager.processData(data);
      expect(result1.processed).to.be.true;
      expect(result1.fromCache).to.be.undefined;
      
      // Clear cache
      abstractionLayerManager.clearCache();
      
      // Second call with same data should process again
      const result2 = abstractionLayerManager.processData(data);
      expect(result2.processed).to.be.true;
      expect(result2.fromCache).to.be.undefined;
    });
  });
  
  describe('Error Handling', function() {
    it('should handle errors in processData', function() {
      // Create a stub that throws an error
      sinon.stub(abstractionLayerManager, '_processAtLayer').throws(new Error('Test error'));
      
      const data = { text: 'Hello world' };
      
      expect(() => abstractionLayerManager.processData(data)).to.throw(Error, 'Test error');
    });
    
    it('should handle invalid input data', function() {
      expect(() => abstractionLayerManager.processData(null)).to.throw(Error);
      expect(() => abstractionLayerManager.processData(undefined)).to.throw(Error);
      expect(() => abstractionLayerManager.processData('string')).to.throw(Error);
    });
  });
  
  describe('Performance Monitoring', function() {
    it('should track performance metrics', function() {
      // Spy on performance monitor
      const startTimerSpy = sinon.spy(performanceMonitor, 'startTimer');
      const endTimerSpy = sinon.spy(performanceMonitor, 'endTimer');
      
      const data = { text: 'Hello world' };
      abstractionLayerManager.processData(data);
      
      expect(startTimerSpy.calledOnce).to.be.true;
      expect(endTimerSpy.calledOnce).to.be.true;
    });
  });
  
  describe('Security', function() {
    it('should encrypt sensitive data when configured', function() {
      // Configure to encrypt
      abstractionLayerManager.setSecurityEnabled(true);
      
      // Spy on security manager
      const encryptSpy = sinon.spy(securityManager, 'encrypt');
      
      const data = { text: 'Hello world', sensitive: true };
      abstractionLayerManager.processData(data);
      
      expect(encryptSpy.calledOnce).to.be.true;
    });
    
    it('should not encrypt data when security disabled', function() {
      // Configure to not encrypt
      abstractionLayerManager.setSecurityEnabled(false);
      
      // Spy on security manager
      const encryptSpy = sinon.spy(securityManager, 'encrypt');
      
      const data = { text: 'Hello world', sensitive: true };
      abstractionLayerManager.processData(data);
      
      expect(encryptSpy.called).to.be.false;
    });
  });
  
  describe('Events', function() {
    it('should emit events for layer changes', function() {
      const layerChangeSpy = sinon.spy();
      abstractionLayerManager.on('layerChanged', layerChangeSpy);
      
      abstractionLayerManager.setCurrentLayer('conceptual');
      
      expect(layerChangeSpy.calledOnce).to.be.true;
      expect(layerChangeSpy.firstCall.args[0]).to.deep.include({
        previousLayer: 'semantic',
        newLayer: 'conceptual'
      });
    });
    
    it('should emit events for data processing', function() {
      const processingSpy = sinon.spy();
      abstractionLayerManager.on('dataProcessed', processingSpy);
      
      const data = { text: 'Hello world' };
      abstractionLayerManager.processData(data);
      
      expect(processingSpy.calledOnce).to.be.true;
      expect(processingSpy.firstCall.args[0]).to.deep.include({
        layer: 'semantic',
        processed: true
      });
    });
  });
  
  describe('Disposal', function() {
    it('should clean up resources on disposal', function() {
      const removeAllListenersSpy = sinon.spy(abstractionLayerManager, 'removeAllListeners');
      
      abstractionLayerManager.dispose();
      
      expect(removeAllListenersSpy.calledOnce).to.be.true;
      expect(abstractionLayerManager.layers).to.be.null;
    });
  });
});
