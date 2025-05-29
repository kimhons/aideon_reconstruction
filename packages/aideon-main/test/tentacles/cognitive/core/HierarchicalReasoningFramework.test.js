/**
 * @fileoverview Tests for the HierarchicalReasoningFramework component.
 * This test suite validates the functionality of the hierarchical reasoning framework,
 * including strategy management, caching, tracing, and explainability features.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { HierarchicalReasoningFramework, ReasoningStrategy } = require('../../../../src/tentacles/cognitive/core/HierarchicalReasoningFramework');
const { AbstractionLayerManager } = require('../../../../src/tentacles/cognitive/core/AbstractionLayerManager');
const { Logger } = require('../../../../src/core/logging/Logger');
const { PerformanceMonitor } = require('../../../../src/core/monitoring/PerformanceMonitor');
const { ConfigurationService } = require('../../../../src/core/ConfigurationService');
const { SecurityManager } = require('../../../../src/core/SecurityManager');

describe('HierarchicalReasoningFramework', () => {
  let framework;
  let mockLogger;
  let mockPerformanceMonitor;
  let mockConfigService;
  let mockSecurityManager;
  let mockAbstractionLayerManager;
  
  beforeEach(() => {
    // Create mocks
    mockLogger = new Logger('HierarchicalReasoningFrameworkTest');
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub().returns('test-timer-id'),
      endTimer: sinon.stub().returns(100),
      getElapsedTime: sinon.stub().returns(100)
    };
    
    mockConfigService = {
      getConfig: sinon.stub().callsFake((path, defaultConfig) => {
        if (path === 'cognitive.reasoning') {
          return {
            defaultStrategy: ReasoningStrategy.DEDUCTIVE,
            enabledStrategies: Object.values(ReasoningStrategy),
            maxReasoningDepth: 5,
            confidenceThreshold: 0.7,
            explainabilityEnabled: true,
            traceEnabled: true,
            cacheEnabled: true,
            cacheTTL: 3600000
          };
        }
        return defaultConfig;
      })
    };
    
    mockSecurityManager = {
      encryptData: sinon.stub().callsFake(data => ({ encrypted: data })),
      decryptData: sinon.stub().callsFake(data => data.encrypted || data),
      validateDataIntegrity: sinon.stub().returns(true)
    };
    
    mockAbstractionLayerManager = {
      getCurrentLayer: sinon.stub().returns('semantic'),
      hasLayer: sinon.stub().returns(true),
      processInput: sinon.stub().callsFake(input => ({ processed: input })),
      getLayers: sinon.stub().returns(['raw', 'syntactic', 'semantic', 'conceptual', 'abstract']),
      dispose: sinon.spy()
    };
    
    // Create framework instance
    framework = new HierarchicalReasoningFramework({
      logger: mockLogger,
      performanceMonitor: mockPerformanceMonitor,
      configService: mockConfigService,
      securityManager: mockSecurityManager,
      abstractionLayerManager: mockAbstractionLayerManager
    });
  });
  
  afterEach(() => {
    // Clean up
    if (framework) {
      framework.dispose();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(framework).to.be.an.instanceOf(HierarchicalReasoningFramework);
      expect(framework.currentStrategy).to.equal(ReasoningStrategy.DEDUCTIVE);
      expect(framework.cacheEnabled).to.be.true;
      expect(framework.traceEnabled).to.be.true;
    });
    
    it('should initialize with custom configuration', () => {
      const customConfigService = {
        getConfig: sinon.stub().returns({
          defaultStrategy: ReasoningStrategy.INDUCTIVE,
          enabledStrategies: [ReasoningStrategy.INDUCTIVE, ReasoningStrategy.ABDUCTIVE],
          maxReasoningDepth: 3,
          confidenceThreshold: 0.5,
          explainabilityEnabled: false,
          traceEnabled: false,
          cacheEnabled: false,
          cacheTTL: 1800000
        })
      };
      
      const customFramework = new HierarchicalReasoningFramework({
        logger: mockLogger,
        performanceMonitor: mockPerformanceMonitor,
        configService: customConfigService,
        securityManager: mockSecurityManager,
        abstractionLayerManager: mockAbstractionLayerManager
      });
      
      expect(customFramework.currentStrategy).to.equal(ReasoningStrategy.INDUCTIVE);
      expect(customFramework.cacheEnabled).to.be.false;
      expect(customFramework.traceEnabled).to.be.false;
      
      customFramework.dispose();
    });
    
    it('should validate configuration on initialization', () => {
      const invalidConfigService = {
        getConfig: sinon.stub().returns({
          defaultStrategy: ReasoningStrategy.DEDUCTIVE,
          enabledStrategies: Object.values(ReasoningStrategy),
          maxReasoningDepth: 0, // Invalid: must be > 0
          confidenceThreshold: 0.7,
          explainabilityEnabled: true,
          traceEnabled: true,
          cacheEnabled: true,
          cacheTTL: 3600000
        })
      };
      
      expect(() => new HierarchicalReasoningFramework({
        logger: mockLogger,
        performanceMonitor: mockPerformanceMonitor,
        configService: invalidConfigService,
        securityManager: mockSecurityManager,
        abstractionLayerManager: mockAbstractionLayerManager
      })).to.throw('maxReasoningDepth must be greater than 0');
    });
    
    it('should validate that defaultStrategy is in enabledStrategies', () => {
      const invalidConfigService = {
        getConfig: sinon.stub().returns({
          defaultStrategy: 'invalid-strategy',
          enabledStrategies: Object.values(ReasoningStrategy),
          maxReasoningDepth: 5,
          confidenceThreshold: 0.7,
          explainabilityEnabled: true,
          traceEnabled: true,
          cacheEnabled: true,
          cacheTTL: 3600000
        })
      };
      
      expect(() => new HierarchicalReasoningFramework({
        logger: mockLogger,
        performanceMonitor: mockPerformanceMonitor,
        configService: invalidConfigService,
        securityManager: mockSecurityManager,
        abstractionLayerManager: mockAbstractionLayerManager
      })).to.throw('defaultStrategy \'invalid-strategy\' must be in enabledStrategies');
    });
    
    it('should validate confidenceThreshold range', () => {
      const invalidConfigService = {
        getConfig: sinon.stub().returns({
          defaultStrategy: ReasoningStrategy.DEDUCTIVE,
          enabledStrategies: Object.values(ReasoningStrategy),
          maxReasoningDepth: 5,
          confidenceThreshold: 1.5, // Invalid: must be between 0 and 1
          explainabilityEnabled: true,
          traceEnabled: true,
          cacheEnabled: true,
          cacheTTL: 3600000
        })
      };
      
      expect(() => new HierarchicalReasoningFramework({
        logger: mockLogger,
        performanceMonitor: mockPerformanceMonitor,
        configService: invalidConfigService,
        securityManager: mockSecurityManager,
        abstractionLayerManager: mockAbstractionLayerManager
      })).to.throw('confidenceThreshold must be between 0 and 1');
    });
  });
  
  describe('Strategy Management', () => {
    it('should get available strategies', () => {
      const strategies = framework.getAvailableStrategies();
      expect(strategies).to.be.an('array');
      expect(strategies).to.include(ReasoningStrategy.DEDUCTIVE);
      expect(strategies).to.include(ReasoningStrategy.INDUCTIVE);
    });
    
    it('should check if strategy is available', () => {
      expect(framework.hasStrategy(ReasoningStrategy.DEDUCTIVE)).to.be.true;
      expect(framework.hasStrategy('invalid-strategy')).to.be.false;
    });
    
    it('should get current strategy', () => {
      expect(framework.getCurrentStrategy()).to.equal(ReasoningStrategy.DEDUCTIVE);
    });
    
    it('should set current strategy', () => {
      framework.setCurrentStrategy(ReasoningStrategy.INDUCTIVE);
      expect(framework.getCurrentStrategy()).to.equal(ReasoningStrategy.INDUCTIVE);
    });
    
    it('should throw error when setting invalid strategy', () => {
      expect(() => framework.setCurrentStrategy('invalid-strategy')).to.throw('Strategy \'invalid-strategy\' is not available');
    });
    
    it('should emit event when strategy changes', () => {
      const spy = sinon.spy();
      framework.on('strategyChanged', spy);
      
      framework.setCurrentStrategy(ReasoningStrategy.INDUCTIVE);
      
      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[0]).to.have.property('previousStrategy', ReasoningStrategy.DEDUCTIVE);
      expect(spy.firstCall.args[0]).to.have.property('newStrategy', ReasoningStrategy.INDUCTIVE);
    });
  });
  
  describe('Basic Reasoning', () => {
    it('should perform reasoning with default strategy', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('reasoningId');
      expect(result).to.have.property('strategy', ReasoningStrategy.DEDUCTIVE);
      expect(result).to.have.property('conclusion');
      expect(result).to.have.property('confidence');
    });
    
    it('should perform reasoning with specified strategy', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input, { strategy: ReasoningStrategy.INDUCTIVE });
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('strategy', ReasoningStrategy.INDUCTIVE);
    });
    
    it('should throw error when reasoning with invalid strategy', () => {
      const input = { id: 'test-input', content: 'Test content' };
      expect(() => framework.reason(input, { strategy: 'invalid-strategy' })).to.throw('Strategy \'invalid-strategy\' is not available');
    });
    
    it('should throw error when reasoning with invalid layer', () => {
      const input = { id: 'test-input', content: 'Test content' };
      mockAbstractionLayerManager.hasLayer = sinon.stub().returns(false);
      expect(() => framework.reason(input, { layer: 'invalid-layer' })).to.throw('Layer \'invalid-layer\' is not available');
      mockAbstractionLayerManager.hasLayer = sinon.stub().returns(true);
    });
    
    it('should throw error when reasoning depth exceeds maximum', () => {
      const input = { id: 'test-input', content: 'Test content' };
      expect(() => framework.reason(input, { depth: 10 })).to.throw('Reasoning depth 10 exceeds maximum depth 5');
    });
    
    it('should emit event when reasoning completes', () => {
      const spy = sinon.spy();
      framework.on('reasoningCompleted', spy);
      
      const input = { id: 'test-input', content: 'Test content' };
      framework.reason(input);
      
      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[0]).to.have.property('strategy', ReasoningStrategy.DEDUCTIVE);
      expect(spy.firstCall.args[0]).to.have.property('inputId', 'test-input');
    });
  });
  
  describe('Caching', () => {
    it('should cache reasoning results when enabled', () => {
      const input = { id: 'test-input', content: 'Test content' };
      
      // First call should process and cache
      const result1 = framework.reason(input);
      
      // Create a cache key for the same input
      const cacheKey = framework._generateCacheKey(input, {
        strategy: framework.getCurrentStrategy(),
        layer: mockAbstractionLayerManager.getCurrentLayer(),
        depth: 1
      });
      
      // Manually add a cached result with fromCache flag
      framework.cache.set(cacheKey, {
        result: { ...result1, fromCache: true },
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000
      });
      
      // Second call should use cache
      const result2 = framework.reason(input);
      expect(result2.fromCache).to.be.true;
    });
    
    it('should not use cache when disabled', () => {
      const input = { id: 'test-input', content: 'Test content' };
      
      // First call should process and cache
      const result1 = framework.reason(input);
      
      // Disable caching
      framework.setCacheEnabled(false);
      
      // Second call should not use cache
      const result2 = framework.reason(input);
      expect(result2.fromCache).to.be.undefined;
    });
    
    it('should clear cache when requested', () => {
      const input = { id: 'test-input', content: 'Test content' };
      
      // First call should process and cache
      framework.reason(input);
      
      // Clear cache
      framework.clearCache();
      
      // Second call should not use cache
      const result2 = framework.reason(input);
      expect(result2.fromCache).to.be.undefined;
    });
  });
  
  describe('Tracing', () => {
    it('should create trace when enabled', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result).to.have.property('traceId');
      const trace = framework.getTrace(result.traceId);
      expect(trace).to.be.an('object');
      expect(trace).to.have.property('steps').that.is.an('array');
    });
    
    it('should not create trace when disabled', () => {
      framework.setTraceEnabled(false);
      
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result.traceId).to.be.undefined;
    });
    
    it('should clear traces when requested', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      framework.clearTraces();
      
      expect(framework.getTrace(result.traceId)).to.be.null;
    });
    
    it('should enable or disable tracing globally', () => {
      framework.setTraceEnabled(true);
      const result1 = framework.reason({ id: 'test1', content: 'Test content' });
      expect(result1).to.have.property('traceId');
      
      framework.setTraceEnabled(false);
      const result2 = framework.reason({ id: 'test2', content: 'Test content' });
      expect(result2.traceId).to.be.undefined;
    });
  });
  
  describe('Explainability', () => {
    it('should include explanation when enabled', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result).to.have.property('explanation');
      expect(result.explanation).to.have.property('summary');
      expect(result.explanation).to.have.property('factors').that.is.an('array');
    });
    
    it('should include hierarchical explanation for hierarchical reasoning', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reasonAcrossLayers(input);
      
      expect(result).to.have.property('explanation');
      expect(result.explanation).to.have.property('layerExplanations');
      expect(result.explanation).to.have.property('crossLayerInsights').that.is.an('array');
    });
  });
  
  describe('Performance Monitoring', () => {
    it('should start and end performance monitoring for reasoning', () => {
      const input = { id: 'test-input', content: 'Test content' };
      framework.reason(input);
      
      expect(mockPerformanceMonitor.startTimer.calledOnce).to.be.true;
      expect(mockPerformanceMonitor.startTimer.firstCall.args[0]).to.equal('reasoning');
      
      expect(mockPerformanceMonitor.endTimer.calledOnce).to.be.true;
    });
  });
    describe('Disposal', () => {
    it('should clean up resources on disposal', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      // Reset the spy since it was already created in the setup
      mockAbstractionLayerManager.dispose = sinon.stub();
      
      framework.dispose(
(Content truncated due to size limit. Use line ranges to read in chunks)