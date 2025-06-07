/**
 * @fileoverview End-to-end tests for the Decision Intelligence Pipeline
 * 
 * These tests validate the complete end-to-end pipeline for the Decision Intelligence Tentacle,
 * ensuring all components work together correctly to provide comprehensive decision support.
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');

// Use relative path with correct number of parent directories
const { DecisionIntelligencePipeline } = require('../../../src/tentacles/decision_intelligence/DecisionIntelligencePipeline');
const { DataAnalyzer } = require('../../../src/tentacles/decision_intelligence/data_analyzer/DataAnalyzer');

// Mock implementations for components that aren't fully implemented yet
class MockOptionEvaluator {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }
  
  async shutdown() {
    this.initialized = false;
    return Promise.resolve();
  }
  
  getStatus() {
    return { initialized: this.initialized };
  }
  
  async evaluateOptions(data, analysisResults, context, options) {
    // Simple mock implementation
    return {
      options: Object.keys(data.options || {}).map(key => ({
        id: key,
        score: Math.random() * 100,
        confidence: 0.7 + Math.random() * 0.3,
        metrics: {
          value: data.options[key].value || 0,
          risk: data.options[key].risk || 0
        }
      })),
      evaluationMetrics: {
        totalScore: 100,
        confidenceLevel: 0.85
      }
    };
  }
}

class MockRecommendationGenerator {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }
  
  async shutdown() {
    this.initialized = false;
    return Promise.resolve();
  }
  
  getStatus() {
    return { initialized: this.initialized };
  }
  
  async generateRecommendations(evaluationResults, context, options) {
    // Simple mock implementation
    const sortedOptions = [...evaluationResults.options].sort((a, b) => b.score - a.score);
    
    return {
      recommendations: sortedOptions.map((option, index) => ({
        optionId: option.id,
        rank: index + 1,
        score: option.score,
        confidence: option.confidence,
        recommendation: index === 0 ? 'highly_recommended' : index < 3 ? 'recommended' : 'acceptable'
      })),
      metadata: {
        generationMethod: 'score_based',
        confidenceLevel: 0.9
      }
    };
  }
}

class MockExplanationEngine {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }
  
  async shutdown() {
    this.initialized = false;
    return Promise.resolve();
  }
  
  getStatus() {
    return { initialized: this.initialized };
  }
  
  async generateExplanations(recommendationResults, evaluationResults, analysisResults, context, options) {
    // Simple mock implementation
    return {
      explanations: recommendationResults.recommendations.map(rec => ({
        optionId: rec.optionId,
        explanation: `Option ${rec.optionId} was ranked #${rec.rank} based on its score of ${rec.score.toFixed(2)}.`,
        factors: [
          { name: 'score', impact: 'high', description: 'Overall score was a primary factor' },
          { name: 'confidence', impact: 'medium', description: 'Confidence level influenced ranking' }
        ]
      })),
      metadata: {
        explanationMethod: 'factor_based',
        confidenceLevel: 0.85
      }
    };
  }
}

describe('Decision Intelligence Pipeline End-to-End', () => {
  let pipeline;
  let mockAideon;
  let dataAnalyzer;
  let optionEvaluator;
  let recommendationGenerator;
  let explanationEngine;
  
  beforeEach(async () => {
    // Create mock Aideon object with required services
    mockAideon = {
      config: {
        getNamespace: () => ({
          getNamespace: () => ({
            get: (key) => null // Return null to use defaults
          })
        })
      },
      metrics: {
        trackEvent: sinon.stub()
      },
      http: {
        request: sinon.stub().resolves({ data: { test: 'data' } })
      },
      database: {
        query: sinon.stub().resolves([{ id: 1, name: 'Test' }])
      },
      logger: {
        info: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub(),
        debug: sinon.stub()
      }
    };
    
    // Create real DataAnalyzer instance
    dataAnalyzer = new DataAnalyzer(mockAideon);
    
    // Create mock instances for other components
    optionEvaluator = new MockOptionEvaluator();
    recommendationGenerator = new MockRecommendationGenerator();
    explanationEngine = new MockExplanationEngine();
    
    // Create DecisionIntelligencePipeline instance
    pipeline = new DecisionIntelligencePipeline(mockAideon);
    
    // Replace components with our instances
    pipeline.dataAnalyzer = dataAnalyzer;
    pipeline.optionEvaluator = optionEvaluator;
    pipeline.recommendationGenerator = recommendationGenerator;
    pipeline.explanationEngine = explanationEngine;
    
    // Initialize the pipeline
    await pipeline.initialize();
    
    // Ensure all components are initialized
    await dataAnalyzer.initialize();
    await optionEvaluator.initialize();
    await recommendationGenerator.initialize();
    await explanationEngine.initialize();
  });
  
  afterEach(async () => {
    // Shutdown the pipeline
    if (pipeline.initialized) {
      await pipeline.shutdown();
    }
    
    // Clean up
    sinon.restore();
  });
  
  describe('Complete end-to-end pipeline', () => {
    it('should process options data through the complete pipeline', async () => {
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5, risk: 2 },
          option2: { value: 20, score: 8, risk: 4 },
          option3: { value: 15, score: 6, risk: 3 },
          option4: { value: 30, score: 9, risk: 7 },
          option5: { value: 5, score: 3, risk: 1 }
        }
      };
      
      const context = {
        userId: 'user123',
        decisionType: 'investment',
        preferences: {
          riskTolerance: 'medium',
          timeHorizon: 'long'
        }
      };
      
      // Process through pipeline
      const result = await pipeline.processPipeline(optionsData, context);
      
      // Verify complete pipeline results
      expect(result).to.be.an('object');
      
      // Verify steps were executed
      expect(result.steps.analysis).to.be.an('object');
      expect(result.steps.evaluation).to.be.an('object');
      expect(result.steps.recommendations).to.be.an('object');
      expect(result.steps.explanations).to.be.an('object');
      
      // Verify recommendations were generated
      expect(result.recommendations).to.be.an('array');
      expect(result.recommendations.length).to.be.at.least(1);
      
      // Verify explanations were generated
      expect(result.explanations).to.be.an('array');
      expect(result.explanations.length).to.be.at.least(1);
      
      // Verify metadata
      expect(result.metadata).to.be.an('object');
      expect(result.metadata.processingTime).to.be.a('number');
      expect(result.metadata.componentsUsed).to.be.an('array');
      expect(result.metadata.componentsUsed).to.include('dataAnalyzer');
      expect(result.metadata.componentsUsed).to.include('optionEvaluator');
      expect(result.metadata.componentsUsed).to.include('recommendationGenerator');
      expect(result.metadata.componentsUsed).to.include('explanationEngine');
    });
    
    it('should process array data through the complete pipeline', async () => {
      // Setup test data
      const arrayData = [10, 15, 20, 25, 30, 35, 40, 45, 50];
      
      const context = {
        userId: 'user123',
        decisionType: 'trend_analysis'
      };
      
      // Process through pipeline
      const result = await pipeline.processPipeline(arrayData, context);
      
      // Verify complete pipeline results
      expect(result).to.be.an('object');
      
      // Verify analysis step was executed
      expect(result.steps.analysis).to.be.an('object');
      expect(result.steps.analysis.statistics).to.be.an('object');
      expect(result.steps.analysis.patterns).to.be.an('object');
      
      // Verify metadata
      expect(result.metadata).to.be.an('object');
      expect(result.metadata.processingTime).to.be.a('number');
      expect(result.metadata.componentsUsed).to.be.an('array');
      expect(result.metadata.componentsUsed).to.include('dataAnalyzer');
    });
  });
  
  describe('Pipeline caching', () => {
    it('should cache and reuse results for identical inputs', async () => {
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      const context = {
        userId: 'user123',
        decisionType: 'investment'
      };
      
      // Setup spies
      const dataAnalyzerSpy = sinon.spy(dataAnalyzer, 'analyzeData');
      
      // Process through pipeline first time
      const result1 = await pipeline.processPipeline(optionsData, context);
      
      // Process through pipeline second time
      const result2 = await pipeline.processPipeline(optionsData, context);
      
      // Verify data analyzer was only called once
      expect(dataAnalyzerSpy.calledOnce).to.be.true;
      
      // Verify results are identical
      expect(result2).to.deep.equal(result1);
    });
    
    it('should bypass cache when requested', async () => {
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      const context = {
        userId: 'user123',
        decisionType: 'investment'
      };
      
      // Setup spies
      const dataAnalyzerSpy = sinon.spy(dataAnalyzer, 'analyzeData');
      
      // Process through pipeline first time
      await pipeline.processPipeline(optionsData, context);
      
      // Process through pipeline second time with skipCache option
      await pipeline.processPipeline(optionsData, context, { skipCache: true });
      
      // Verify data analyzer was called twice
      expect(dataAnalyzerSpy.calledTwice).to.be.true;
    });
  });
  
  describe('Error handling', () => {
    it('should handle errors in data analyzer', async () => {
      // Setup error in data analyzer
      sinon.stub(dataAnalyzer, 'analyzeData').rejects(new Error('Analysis error'));
      
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      // Setup event spy
      const eventSpy = sinon.spy(pipeline.events, 'emit');
      
      // Attempt to process through pipeline
      try {
        await pipeline.processPipeline(optionsData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Analysis error');
      }
      
      // Verify error event was emitted
      expect(eventSpy.calledWith('pipeline:error')).to.be.true;
    });
    
    it('should handle timeout errors', async function() {
      // Set short timeout for this test
      this.timeout(3000);
      pipeline.config.pipelineTimeout = 100; // 100ms timeout
      
      // Setup delay in data analyzer
      sinon.stub(dataAnalyzer, 'analyzeData').callsFake(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({});
          }, 500); // 500ms delay (longer than timeout)
        });
      });
      
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      // Attempt to process through pipeline
      try {
        await pipeline.processPipeline(optionsData);
        expect.fail('Should have thrown a timeout error');
      } catch (error) {
        expect(error.message).to.include('timed out');
      }
    });
  });
  
  describe('API integration', () => {
    it('should register API endpoints', () => {
      // Setup mock API
      const mockApi = {
        register: sinon.stub()
      };
      
      // Register endpoints
      pipeline.registerApiEndpoints(mockApi, 'decision');
      
      // Verify endpoints were registered
      expect(mockApi.register.calledWith('decision/process')).to.be.true;
      expect(mockApi.register.calledWith('decision/status')).to.be.true;
    });
    
    it('should handle API requests for processing', async () => {
      // Setup mock API
      const mockApi = {
        register: sinon.stub()
      };
      
      // Register endpoints
      pipeline.registerApiEndpoints(mockApi, 'decision');
      
      // Get process endpoint handler
      const processHandler = mockApi.register.args.find(args => args[0] === 'decision/process')[1].post;
      
      // Setup mock request and response
      const req = {
        body: {
          data: {
            options: {
              option1: { value: 10 },
              option2: { value: 20 }
            }
          },
          context: {
            userId: 'user123'
          }
        }
      };
      
      const res = {
        json: sinon.stub(),
        status: sinon.stub().returnsThis()
      };
      
      // Call handler
      await processHandler(req, res);
      
      // Verify response
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.be.an('object');
      expect(res.json.args[0][0].recommendations).to.be.an('array');
    });
  });
  
  describe('Component interaction', () => {
    it('should pass analysis results to option evaluator', async () => {
      // Setup spies
      const analyzerSpy = sinon.spy(dataAnalyzer, 'analyzeData');
      const evaluatorSpy = sinon.spy(optionEvaluator, 'evaluateOptions');
      
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      // Process through pipeline
      await pipeline.processPipeline(optionsData);
      
      // Verify component interaction
      expect(analyzerSpy.calledOnce).to.be.true;
      expect(evaluatorSpy.calledOnce).to.be.true;
      
      // Verify analysis results were passed to option evaluator
      expect(evaluatorSpy.args[0][1]).to.equal(analyzerSpy.returnValues[0]);
    });
    
    it('should pass evaluation results to recommendation generator', async () => {
      // Setup spies
      const evaluatorSpy = sinon.spy(optionEvaluator, 'evaluateOptions');
      const recommendationSpy = sinon.spy(recommendationGenerator, 'generateRecommendations');
      
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      // Process through pipeline
      await pipeline.processPipeline(optionsData);
      
      // Verify component interaction
      expect(evaluatorSpy.calledOnce).to.be.true;
      expect(recommendationSpy.calledOnce).to.be.true;
      
      // Verify evaluation results were passed to recommendation generator
      expect(recommendationSpy.args[0][0]).to.equal(evaluatorSpy.returnValues[0]);
    });
    
    it('should pass all previous results to explanation engine', async () => {
      // Setup spies
      const analyzerSpy = sinon.spy(dataAnalyzer, 'analyzeData');
      const evaluatorSpy = sinon.spy(optionEvaluator, 'evaluateOptions');
      const recommendationSpy = sinon.spy(recommendationGenerator, 'generateRecommendations');
      const explanationSpy = sinon.spy(explanationEngine, 'generateExplanations');
      
      // Setup test data
      const optionsData = {
        options: {
          option1: { value: 10, score: 5 },
          option2: { value: 20, score: 8 }
        }
      };
      
      // Process through pipeline
      await pipeline.processPipeline(optionsData);
      
      // Verify component interaction
      expect(analyzerSpy.calledOnce).to.be.true;
      expect(evaluatorSpy.calledOnce).to.be.true;
      expect(recommendationSpy.calledOnce).to.be.true;
      expect(explanationSpy.calledOnce).to.be.true;
      
      // Verify all results were passed to explanation engine
      expect(explanationSpy.args[0][0]).to.equal(recommendationSpy.returnValues[0]);
      expect(explanationSpy.args[0][1]).to.equal(evaluatorSpy.returnValues[0]);
      expect(explanationSpy.args[0][2]).to.equal(analyzerSpy.returnValues[0]);
    });
  });
});
