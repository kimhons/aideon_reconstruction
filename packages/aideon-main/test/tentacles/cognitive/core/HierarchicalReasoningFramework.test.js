/**
 * HierarchicalReasoningFramework.test.js
 * 
 * Unit tests for the HierarchicalReasoningFramework component.
 */

'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

const HierarchicalReasoningFramework = require('../../../../src/tentacles/cognitive/core/HierarchicalReasoningFramework');
const AbstractionLayerManager = require('../../../../src/tentacles/cognitive/core/AbstractionLayerManager');
const ReasoningStrategyRegistry = require('../../../../src/tentacles/cognitive/core/ReasoningStrategyRegistry');
const PerformanceMonitor = require('../../../../src/core/monitoring/PerformanceMonitor');
const KnowledgeGraph = require('../../../../src/tentacles/knowledge/KnowledgeGraph');

describe('HierarchicalReasoningFramework', () => {
  let framework;
  let mockAbstractionLayerManager;
  let mockReasoningStrategyRegistry;
  let mockPerformanceMonitor;
  let mockKnowledgeGraph;
  
  beforeEach(() => {
    // Create mocks
    mockAbstractionLayerManager = {
      getCurrentLayer: sinon.stub().returns({ id: 'layer1', name: 'Concrete' }),
      getLayer: sinon.stub().returns({ id: 'layer1', name: 'Concrete' }),
      getLayers: sinon.stub().returns([
        { id: 'layer1', name: 'Concrete' },
        { id: 'layer2', name: 'Abstract' },
        { id: 'layer3', name: 'Meta' }
      ]),
      moveUp: sinon.stub().returns({ id: 'layer2', name: 'Abstract' }),
      moveDown: sinon.stub().returns({ id: 'layer1', name: 'Concrete' }),
      dispose: sinon.stub()
    };
    
    mockReasoningStrategyRegistry = {
      getStrategy: sinon.stub().returns({
        id: 'strategy1',
        name: 'Default',
        process: sinon.stub().callsFake((input) => {
          return {
            id: `result-${input.id}`,
            content: `Processed: ${input.content}`,
            confidence: 0.85
          };
        })
      }),
      getStrategies: sinon.stub().returns([
        { id: 'strategy1', name: 'Default' },
        { id: 'strategy2', name: 'Creative' },
        { id: 'strategy3', name: 'Analytical' }
      ]),
      dispose: sinon.stub()
    };
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub(),
      endTimer: sinon.stub().returns({ durationMs: 100 }),
      recordMetric: sinon.stub(),
      dispose: sinon.stub()
    };
    
    mockKnowledgeGraph = {
      query: sinon.stub().returns([
        { id: 'entity1', type: 'concept', name: 'Example' }
      ]),
      dispose: sinon.stub()
    };
    
    // Create framework instance
    framework = new HierarchicalReasoningFramework({
      abstractionLayerManager: mockAbstractionLayerManager,
      reasoningStrategyRegistry: mockReasoningStrategyRegistry,
      performanceMonitor: mockPerformanceMonitor,
      knowledgeGraph: mockKnowledgeGraph
    });
  });
  
  afterEach(() => {
    sinon.restore();
    if (framework) {
      framework.dispose();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(framework).to.be.an('object');
      expect(framework.getCurrentStrategy()).to.be.an('object');
      expect(framework.getCurrentStrategy().id).to.equal('strategy1');
    });
    
    it('should throw error if required dependencies are missing', () => {
      expect(() => {
        new HierarchicalReasoningFramework({
          reasoningStrategyRegistry: mockReasoningStrategyRegistry,
          performanceMonitor: mockPerformanceMonitor
        });
      }).to.throw('Missing required dependency: abstractionLayerManager');
    });
  });
  
  describe('Basic Reasoning', () => {
    it('should process input using current strategy', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result).to.be.an('object');
      expect(result.id).to.equal('result-test-input');
      expect(result.content).to.equal('Processed: Test content');
      expect(result.confidence).to.be.a('number');
    });
    
    it('should apply transformations before and after reasoning', () => {
      // Add pre-processing transformation
      framework.addPreTransformation((input) => {
        return { ...input, content: `Pre: ${input.content}` };
      });
      
      // Add post-processing transformation
      framework.addPostTransformation((result) => {
        return { ...result, content: `Post: ${result.content}` };
      });
      
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result.content).to.equal('Post: Processed: Pre: Test content');
    });
    
    it('should handle errors gracefully', () => {
      // Make strategy throw an error
      mockReasoningStrategyRegistry.getStrategy = sinon.stub().returns({
        id: 'strategy1',
        name: 'Default',
        process: sinon.stub().throws(new Error('Processing error'))
      });
      
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result).to.have.property('error');
      expect(result.error).to.include('Processing error');
      expect(result).to.have.property('fallbackApplied').that.is.true;
    });
  });
  
  describe('Strategy Management', () => {
    it('should change reasoning strategy', () => {
      // Setup a different strategy
      mockReasoningStrategyRegistry.getStrategy = sinon.stub().callsFake((id) => {
        if (id === 'strategy2') {
          return {
            id: 'strategy2',
            name: 'Creative',
            process: sinon.stub().callsFake((input) => {
              return {
                id: `creative-${input.id}`,
                content: `Creative: ${input.content}`,
                confidence: 0.75
              };
            })
          };
        }
        return {
          id: 'strategy1',
          name: 'Default',
          process: sinon.stub().callsFake((input) => {
            return {
              id: `result-${input.id}`,
              content: `Processed: ${input.content}`,
              confidence: 0.85
            };
          })
        };
      });
      
      // Change strategy
      framework.setStrategy('strategy2');
      
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reason(input);
      
      expect(result.id).to.equal('creative-test-input');
      expect(result.content).to.equal('Creative: Test content');
    });
    
    it('should fall back to default strategy if requested strategy is not found', () => {
      // Try to set a non-existent strategy
      framework.setStrategy('non-existent-strategy');
      
      // Should fall back to default
      expect(framework.getCurrentStrategy().id).to.equal('strategy1');
    });
  });
  
  describe('Hierarchical Reasoning', () => {
    it('should reason across abstraction layers', () => {
      // Setup layer-specific strategies
      mockReasoningStrategyRegistry.getStrategy = sinon.stub().callsFake((id, layer) => {
        if (layer && layer.id === 'layer2') {
          return {
            id: 'abstract-strategy',
            name: 'Abstract',
            process: sinon.stub().callsFake((input) => {
              return {
                id: `abstract-${input.id}`,
                content: `Abstract: ${input.content}`,
                confidence: 0.8
              };
            })
          };
        }
        return {
          id: 'strategy1',
          name: 'Default',
          process: sinon.stub().callsFake((input) => {
            return {
              id: `result-${input.id}`,
              content: `Processed: ${input.content}`,
              confidence: 0.85
            };
          })
        };
      });
      
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reasonAcrossLayers(input);
      
      expect(result).to.have.property('layers').that.is.an('array');
      expect(result.layers).to.have.length.at.least(2);
      expect(result).to.have.property('integrated').that.is.an('object');
    });
    
    it('should integrate results from multiple layers', () => {
      const input = { id: 'test-input', content: 'Test content' };
      const result = framework.reasonAcrossLayers(input);
      
      expect(result.integrated).to.have.property('insights').that.is.an('array');
      expect(result.integrated).to.have.property('confidence').that.is.a('number');
    });
  });
  
  describe('Knowledge Integration', () => {
    it('should enrich reasoning with knowledge graph data', () => {
      framework.setKnowledgeEnrichmentEnabled(true);
      
      const input = { id: 'test-input', content: 'Test content with Example' };
      const result = framework.reason(input);
      
      expect(result).to.have.property('knowledgeEntities').that.is.an('array');
      expect(result.knowledgeEntities).to.have.length.at.least(1);
      expect(result.knowledgeEntities[0]).to.have.property('id', 'entity1');
    });
    
    it('should skip knowledge enrichment when disabled', () => {
      framework.setKnowledgeEnrichmentEnabled(false);
      
      const input = { id: 'test-input', content: 'Test content with Example' };
      const result = framework.reason(input);
      
      expect(result.knowledgeEntities).to.be.undefined;
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
      
      framework.dispose();
      
      expect(mockAbstractionLayerManager.dispose.calledOnce).to.be.true;
      expect(mockReasoningStrategyRegistry.dispose.calledOnce).to.be.true;
      expect(mockPerformanceMonitor.dispose.calledOnce).to.be.true;
      expect(mockKnowledgeGraph.dispose.calledOnce).to.be.true;
    });
  });
});
