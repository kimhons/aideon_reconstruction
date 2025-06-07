/**
 * @fileoverview Tests for the UncertaintyEstimator component
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');

const { UncertaintyEstimator } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/UncertaintyEstimator');

describe('UncertaintyEstimator', () => {
  let uncertaintyEstimator;
  let mockAideon;
  let mockConfig;
  
  beforeEach(() => {
    // Create mock Aideon object
    mockConfig = {
      getNamespace: sinon.stub().returns({
        getNamespace: sinon.stub().returns({
          get: sinon.stub()
        })
      })
    };
    
    mockAideon = {
      config: mockConfig,
      metrics: {
        trackEvent: sinon.stub()
      }
    };
    
    // Create UncertaintyEstimator instance with default config
    uncertaintyEstimator = new UncertaintyEstimator(mockAideon, {
      defaultConfidenceLevel: 0.95,
      uncertaintyTypes: ['statistical', 'systematic', 'model', 'data']
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should create a new instance with default properties', () => {
      const estimator = new UncertaintyEstimator();
      
      expect(estimator).to.be.an.instanceOf(UncertaintyEstimator);
      expect(estimator.initialized).to.be.false;
      expect(estimator.config).to.be.an('object');
      expect(estimator.events).to.exist;
      expect(estimator.logger).to.exist;
    });
    
    it('should store the Aideon reference if provided', () => {
      const estimator = new UncertaintyEstimator(mockAideon);
      
      expect(estimator.aideon).to.equal(mockAideon);
    });
    
    it('should use provided configuration', () => {
      const config = {
        defaultConfidenceLevel: 0.99,
        uncertaintyTypes: ['statistical', 'data']
      };
      
      const estimator = new UncertaintyEstimator(mockAideon, config);
      
      expect(estimator.config.defaultConfidenceLevel).to.equal(0.99);
      expect(estimator.config.uncertaintyTypes).to.deep.equal(['statistical', 'data']);
    });
  });
  
  describe('initialize', () => {
    it('should load configuration and mark as initialized', async () => {
      // Setup spy for _loadConfiguration
      const loadConfigSpy = sinon.spy(uncertaintyEstimator, '_loadConfiguration');
      
      // Initialize
      await uncertaintyEstimator.initialize();
      
      // Verify
      expect(uncertaintyEstimator.initialized).to.be.true;
      expect(loadConfigSpy.calledOnce).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      // Initialize once
      await uncertaintyEstimator.initialize();
      
      // Reset spy
      const loadConfigSpy = sinon.spy(uncertaintyEstimator, '_loadConfiguration');
      
      // Initialize again
      await uncertaintyEstimator.initialize();
      
      // Verify
      expect(loadConfigSpy.called).to.be.false;
    });
    
    it('should emit initialized event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(uncertaintyEstimator.events, 'emit');
      
      // Initialize
      await uncertaintyEstimator.initialize();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('initialized')).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      // Setup error in initialization
      sinon.stub(uncertaintyEstimator, '_loadConfiguration').throws(new Error('Test error'));
      
      // Attempt to initialize
      try {
        await uncertaintyEstimator.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
        expect(uncertaintyEstimator.initialized).to.be.false;
      }
    });
  });
  
  describe('_loadConfiguration', () => {
    it('should load configuration from Aideon config if available', async () => {
      // Setup mock config
      const configGet = sinon.stub();
      configGet.withArgs('defaultConfidenceLevel').returns(0.99);
      configGet.withArgs('uncertaintyTypes').returns(['statistical', 'data']);
      
      const configNamespace = {
        get: configGet
      };
      
      mockAideon.config.getNamespace().getNamespace.returns(configNamespace);
      
      // Load configuration
      await uncertaintyEstimator._loadConfiguration();
      
      // Verify
      expect(mockAideon.config.getNamespace.calledWith('tentacles')).to.be.true;
      expect(mockAideon.config.getNamespace().getNamespace.calledWith('decisionIntelligence')).to.be.true;
      expect(uncertaintyEstimator.config.defaultConfidenceLevel).to.equal(0.99);
      expect(uncertaintyEstimator.config.uncertaintyTypes).to.deep.equal(['statistical', 'data']);
    });
    
    it('should handle missing Aideon config', async () => {
      // Setup
      uncertaintyEstimator.aideon = null;
      
      // Load configuration
      await uncertaintyEstimator._loadConfiguration();
      
      // Verify default values are maintained
      expect(uncertaintyEstimator.config.defaultConfidenceLevel).to.equal(0.95);
      expect(uncertaintyEstimator.config.uncertaintyTypes).to.deep.equal(['statistical', 'systematic', 'model', 'data']);
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      // Initialize before testing shutdown
      await uncertaintyEstimator.initialize();
    });
    
    it('should mark as not initialized', async () => {
      // Shutdown
      await uncertaintyEstimator.shutdown();
      
      // Verify
      expect(uncertaintyEstimator.initialized).to.be.false;
    });
    
    it('should do nothing if not initialized', async () => {
      // Shutdown once
      await uncertaintyEstimator.shutdown();
      
      // Setup event spy
      const eventSpy = sinon.spy(uncertaintyEstimator.events, 'emit');
      
      // Shutdown again
      await uncertaintyEstimator.shutdown();
      
      // Verify no events were emitted
      expect(eventSpy.called).to.be.false;
    });
    
    it('should emit shutdown event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(uncertaintyEstimator.events, 'emit');
      
      // Shutdown
      await uncertaintyEstimator.shutdown();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('shutdown')).to.be.true;
    });
  });
  
  describe('getStatus', () => {
    it('should return the current status', async () => {
      // Initialize
      await uncertaintyEstimator.initialize();
      
      // Get status
      const status = uncertaintyEstimator.getStatus();
      
      // Verify
      expect(status).to.be.an('object');
      expect(status.initialized).to.be.true;
      expect(status.config).to.be.an('object');
      expect(status.config.defaultConfidenceLevel).to.equal(0.95);
      expect(status.config.uncertaintyTypes).to.deep.equal(['statistical', 'systematic', 'model', 'data']);
    });
  });
  
  describe('analyze', () => {
    beforeEach(async () => {
      // Initialize before testing
      await uncertaintyEstimator.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      // Shutdown to make not initialized
      await uncertaintyEstimator.shutdown();
      
      // Attempt to analyze
      try {
        await uncertaintyEstimator.analyze({ type: 'options', items: [] });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not initialized');
      }
    });
    
    it('should throw an error if data is missing', async () => {
      // Attempt to analyze without data
      try {
        await uncertaintyEstimator.analyze();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Data is required');
      }
    });
    
    it('should analyze options data', async () => {
      // Setup
      const data = {
        type: 'options',
        items: [
          { id: 'opt1', attributes: { value: 10, score: 5 } },
          { id: 'opt2', attributes: { value: 20, score: 8 } },
          { id: 'opt3', attributes: { value: 15, score: 6 } }
        ]
      };
      
      const options = {
        statisticalResults: {
          attributeStats: {
            value: { mean: 15, standardDeviation: 5, count: 3 },
            score: { mean: 6.33, standardDeviation: 1.53, count: 3 }
          }
        }
      };
      
      // Setup spy for _analyzeOptionsUncertainty
      const analyzeOptionsSpy = sinon.spy(uncertaintyEstimator, '_analyzeOptionsUncertainty');
      
      // Mock uncertainty estimation methods
      sinon.stub(uncertaintyEstimator, '_estimateStatisticalUncertainty').returns([
        { type: 'statistical', attribute: 'value', level: 0.3 }
      ]);
      sinon.stub(uncertaintyEstimator, '_estimateDataUncertainty').returns([
        { type: 'data', attribute: 'sample_size', level: 0.9 }
      ]);
      
      // Analyze
      const result = await uncertaintyEstimator.analyze(data, options);
      
      // Verify
      expect(analyzeOptionsSpy.calledWith(data, options)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.uncertainties).to.be.an('array');
      expect(result.uncertainties.length).to.be.at.least(1);
      expect(result.summary).to.be.an('object');
      expect(result.summary.uncertaintyCount).to.be.at.least(1);
    });
    
    it('should analyze array data', async () => {
      // Setup
      const data = {
        type: 'array',
        items: [
          { id: 'item1', value: 10 },
          { id: 'item2', value: 20 },
          { id: 'item3', value: 15 }
        ]
      };
      
      const options = {
        statisticalResults: {
          summary: { mean: 15, standardDeviation: 5, count: 3 }
        }
      };
      
      // Setup spy for _analyzeArrayUncertainty
      const analyzeArraySpy = sinon.spy(uncertaintyEstimator, '_analyzeArrayUncertainty');
      
      // Mock uncertainty estimation methods
      sinon.stub(uncertaintyEstimator, '_estimateArrayStatisticalUncertainty').returns(
        { type: 'statistical', level: 0.3 }
      );
      sinon.stub(uncertaintyEstimator, '_estimateArrayDataUncertainty').returns(
        { type: 'data', level: 0.9 }
      );
      
      // Analyze
      const result = await uncertaintyEstimator.analyze(data, options);
      
      // Verify
      expect(analyzeArraySpy.calledWith(data, options)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.uncertainties).to.be.an('array');
      expect(result.uncertainties.length).to.be.at.least(1);
      expect(result.summary).to.be.an('object');
    });
    
    it('should analyze object data', async () => {
      // Setup
      const data = {
        type: 'object',
        attributes: {
          value: 10,
          score: 5,
          name: 'test'
        }
      };
      
      // Setup spy for _analyzeObjectUncertainty
      const analyzeObjectSpy = sinon.spy(uncertaintyEstimator, '_analyzeObjectUncertainty');
      
      // Analyze
      const result = await uncertaintyEstimator.analyze(data);
      
      // Verify
      expect(analyzeObjectSpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.uncertainties).to.be.an('array');
      expect(result.summary).to.be.an('object');
    });
    
    it('should throw an error for unsupported data type', async () => {
      // Setup
      const data = {
        type: 'unsupported',
        items: []
      };
      
      // Attempt to analyze
      try {
        await uncertaintyEstimator.analyze(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unsupported data type');
      }
    });
    
    it('should handle analysis errors', async () => {
      // Setup
      const data = {
        type: 'options',
        items: []
      };
      
      // Setup error in analysis
      sinon.stub(uncertaintyEstimator, '_analyzeOptionsUncertainty').throws(new Error('Analysis error'));
      
      // Attempt to analyze
      try {
        await uncertaintyEstimator.analyze(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Analysis error');
      }
    });
  });
  
  describe('_analyzeOptionsUncertainty', () => {
    it('should analyze statistical, data, and model uncertainties', async () => {
      // Setup
      const data = {
        items: [
          { id: 'opt1', attributes: { value: 10, score: 5 } },
          { id: 'opt2', attributes: { value: 20, score: 8 } },
          { id: 'opt3', attributes: { value: 15, score: 6 } }
        ]
      };
      
      const options = {
        uncertaintyTypes: ['statistical', 'data', 'model'],
        statisticalResults: {
          attributeStats: {
            value: { mean: 15, standardDeviation: 5, count: 3 }
          }
        },
        patternResults: {
          patterns: [
            { type: 'trend', confidence: 0.7 }
          ]
        }
      };
      
      // Setup spies
      const extractSpy = sinon.spy(uncertaintyEstimator, '_extractAttributes');
      const statUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateStatisticalUncertainty').returns([
        { type: 'statistical', attribute: 'value', level: 0.3 }
      ]);
      const dataUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateDataUncertainty').returns([
        { type: 'data', attribute: 'sample_size', level: 0.9 }
      ]);
      const modelUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateModelUncertainty').returns([
        { type: 'model', attribute: 'pattern_confidence', level: 0.3 }
      ]);
      
      // Analyze
      const result = await uncertaintyEstimator._analyzeOptionsUncertainty(data, options);
      
      // Verify
      expect(extractSpy.calledOnce).to.be.true;
      expect(statUncertaintySpy.calledOnce).to.be.true;
      expect(dataUncertaintySpy.calledOnce).to.be.true;
      expect(modelUncertaintySpy.calledOnce).to.be.true;
      
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3);
    });
    
    it('should only analyze requested uncertainty types', async () => {
      // Setup
      const data = {
        items: []
      };
      
      const options = {
        uncertaintyTypes: ['statistical'], // Only statistical
        statisticalResults: {
          attributeStats: {}
        }
      };
      
      // Setup spies
      const statUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateStatisticalUncertainty').returns([]);
      const dataUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateDataUncertainty');
      const modelUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateModelUncertainty');
      
      // Analyze
      await uncertaintyEstimator._analyzeOptionsUncertainty(data, options);
      
      // Verify
      expect(statUncertaintySpy.calledOnce).to.be.true;
      expect(dataUncertaintySpy.called).to.be.false;
      expect(modelUncertaintySpy.called).to.be.false;
    });
    
    it('should use default uncertainty types if not specified', async () => {
      // Setup
      const data = {
        items: []
      };
      
      // Set default uncertainty types
      uncertaintyEstimator.config.uncertaintyTypes = ['data'];
      
      // Setup spies
      const statUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateStatisticalUncertainty');
      const dataUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateDataUncertainty').returns([]);
      const modelUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateModelUncertainty');
      
      // Analyze
      await uncertaintyEstimator._analyzeOptionsUncertainty(data, {});
      
      // Verify
      expect(statUncertaintySpy.called).to.be.false;
      expect(dataUncertaintySpy.calledOnce).to.be.true;
      expect(modelUncertaintySpy.called).to.be.false;
    });
  });
  
  describe('_analyzeArrayUncertainty', () => {
    it('should analyze statistical and data uncertainties', async () => {
      // Setup
      const data = {
        items: [
          { id: 'item1', value: 10 },
          { id: 'item2', value: 20 },
          { id: 'item3', value: 15 }
        ]
      };
      
      const options = {
        uncertaintyTypes: ['statistical', 'data'],
        statisticalResults: {
          summary: { mean: 15, standardDeviation: 5, count: 3 }
        }
      };
      
      // Setup spies
      const statUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateArrayStatisticalUncertainty').returns(
        { type: 'statistical', level: 0.3 }
      );
      const dataUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateArrayDataUncertainty').returns(
        { type: 'data', level: 0.9 }
      );
      
      // Analyze
      const result = await uncertaintyEstimator._analyzeArrayUncertainty(data, options);
      
      // Verify
      expect(statUncertaintySpy.calledOnce).to.be.true;
      expect(dataUncertaintySpy.calledOnce).to.be.true;
      
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
    });
    
    it('should only analyze requested uncertainty types', async () => {
      // Setup
      const data = {
        items: []
      };
      
      const options = {
        uncertaintyTypes: ['data'], // Only data
        statisticalResults: {
          summary: {}
        }
      };
      
      // Setup spies
      const statUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateArrayStatisticalUncertainty');
      const dataUncertaintySpy = sinon.stub(uncertaintyEstimator, '_estimateArrayDataUncertainty').returns(null);
      
      // Analyze
      await uncertaintyEstimator._analyzeArrayUncertainty(data, options);
      
      // Verify
      expect(statUncertaintySpy.called).to.be.false;
      expect(dataUncertaintySpy.calledOnce).to.be.true;
    });
    
    it('should filter out null uncertainty results', async () => {
      // Setup
      const data = {
        items: []
      };
      
      const options = {
        uncertaintyTypes: ['statistical', 'data'],
        statisticalResults: {
          summary: {}
        }
      };
      
      // Setup spies to return null
      sinon.stub(uncertaintyEstimator, '_estimateArrayStatisticalUncertainty').returns(null);
      sinon.stub(uncertaintyEstimator, '_estimateArrayDataUncertainty').returns(null);
      
      // Analyze
      const result = await uncertaintyEstimator._analyzeArrayUncertainty(data, options);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_extractAttributes', () => {
    it('should extract attributes from items', () => {
      // Setup
      const items = [
        { attributes: { value: 10, score: 5, name: 'test1' } },
        { attributes: { value: 20, score: 8, name: 'test2' } },
        { attributes: { value: 15, score: 6, name: 'test3' } }
      ];
      
      // Extract
      const result = uncertaintyEstimator._extractAttributes(items);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.deep.equal([10, 20, 15]);
      expect(result.score).to.deep.equal([5, 8, 6]);
      expect(result.name).to.deep.equal(['test1', 'test2', 'test3']);
    });
    
    it('should handle missing values', () => {
      // Setup
      const items = [
        { attributes: { value: 10, score: 5 } },
        { attributes: { value: null, score: undefined } },
        { attributes: { value: 15 } }
      ];
      
      // Extract
      const result = uncertaintyEstimator._extractAttributes(items);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.deep.equal([10, null, 15]);
      expect(result.score).to.deep.equal([5, undefined]);
    });
  });
  
  describe('_estimateStatisticalUncertainty', () => {
    it('should estimate uncertainty for attributes with standard deviation', () => {
      // Setup
      const attributes = {
        value: [10, 20, 15],
        score: [5, 8, 6]
      };
      
      const statisticalResults = {
        attributeStats: {
          value: { mean: 15, standardDeviation: 5, count: 3 },
          score: { mean: 6.33, standardDeviation: 1.53, count: 3 }
        }
      };
      
      // Mock z-score calculation
      sinon.stub(uncertaintyEstimator, '_getZScore').returns(1.96);
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateStatisticalUncertainty(attributes, statisticalResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2); // One for each attribute
      
      const valueUncertainty = result.find(u => u.attribute === 'value');
      expect(valueUncertainty).to.exist;
      expect(valueUncertainty.type).to.equal('statistical');
      expect(valueUncertainty.level).to.be.within(0, 1);
      expect(valueUncertainty.description).to.include('Statistical uncertainty in value');
      
      const scoreUncertainty = result.find(u => u.attribute === 'score');
      expect(scoreUncertainty).to.exist;
      expect(scoreUncertainty.type).to.equal('statistical');
      expect(scoreUncertainty.level).to.be.within(0, 1);
      expect(scoreUncertainty.description).to.include('Statistical uncertainty in score');
    });
    
    it('should handle missing statistical results', () => {
      // Setup
      const attributes = {
        value: [10, 20, 15]
      };
      
      // No statistical results
      const statisticalResults = null;
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateStatisticalUncertainty(attributes, statisticalResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    
    it('should handle attributes without standard deviation', () => {
      // Setup
      const attributes = {
        value: [10, 20, 15]
      };
      
      const statisticalResults = {
        attributeStats: {
          value: { mean: 15, count: 3 } // No standard deviation
        }
      };
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateStatisticalUncertainty(attributes, statisticalResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_estimateDataUncertainty', () => {
    it('should estimate uncertainty for missing values', () => {
      // Setup
      const attributes = {
        value: [10, null, 15],
        score: [5, 8, 6]
      };
      
      const sampleSize = 3;
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateDataUncertainty(attributes, sampleSize);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2); // One for value attribute, one for sample size
      
      const valueUncertainty = result.find(u => u.attribute === 'value');
      expect(valueUncertainty).to.exist;
      expect(valueUncertainty.type).to.equal('data');
      expect(valueUncertainty.level).to.be.within(0, 1);
      expect(valueUncertainty.description).to.include('Data uncertainty in value');
      expect(valueUncertainty.details.missingCount).to.equal(1);
      
      const sampleUncertainty = result.find(u => u.attribute === 'sample_size');
      expect(sampleUncertainty).to.exist;
      expect(sampleUncertainty.type).to.equal('data');
      expect(sampleUncertainty.level).to.be.within(0, 1);
      expect(sampleUncertainty.description).to.include('Sample size uncertainty');
    });
    
    it('should not report uncertainty for complete data', () => {
      // Setup
      const attributes = {
        value: [10, 20, 15],
        score: [5, 8, 6]
      };
      
      const sampleSize = 30; // Large enough sample
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateDataUncertainty(attributes, sampleSize);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_estimateModelUncertainty', () => {
    it('should estimate uncertainty based on pattern confidence', () => {
      // Setup
      const patternResults = {
        patterns: [
          { type: 'trend', confidence: 0.6 },
          { type: 'cluster', confidence: 0.7 }
        ]
      };
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateModelUncertainty(patternResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('model');
      expect(result[0].attribute).to.equal('pattern_confidence');
      expect(result[0].level).to.be.within(0, 1);
      expect(result[0].description).to.include('Model uncertainty due to low confidence');
    });
    
    it('should not report uncertainty for high confidence patterns', () => {
      // Setup
      const patternResults = {
        patterns: [
          { type: 'trend', confidence: 0.9 },
          { type: 'cluster', confidence: 0.95 }
        ]
      };
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateModelUncertainty(patternResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    
    it('should handle missing pattern results', () => {
      // Setup
      const patternResults = null;
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateModelUncertainty(patternResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    
    it('should handle conflicting patterns', () => {
      // Setup
      const patternResults = {
        patterns: [
          { type: 'trend', confidence: 0.9, direction: 'increasing' },
          { type: 'trend', confidence: 0.8, direction: 'decreasing' }
        ]
      };
      
      // Mock conflict detection
      sinon.stub(uncertaintyEstimator, '_findConflictingPatterns').returns([
        { pattern1: patternResults.patterns[0], pattern2: patternResults.patterns[1] }
      ]);
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateModelUncertainty(patternResults);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('model');
      expect(result[0].attribute).to.equal('pattern_conflict');
      expect(result[0].description).to.include('conflicting patterns');
    });
  });
  
  describe('_estimateArrayStatisticalUncertainty', () => {
    it('should estimate uncertainty for array data with standard deviation', () => {
      // Setup
      const values = [10, 20, 15];
      
      const statisticalResults = {
        summary: { mean: 15, standardDeviation: 5, count: 3 }
      };
      
      // Mock z-score calculation
      sinon.stub(uncertaintyEstimator, '_getZScore').returns(1.96);
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateArrayStatisticalUncertainty(values, statisticalResults);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('statistical');
      expect(result.level).to.be.within(0, 1);
      expect(result.description).to.include('Statistical uncertainty in values');
    });
    
    it('should handle missing statistical results', () => {
      // Setup
      const values = [10, 20, 15];
      
      // No statistical results
      const statisticalResults = null;
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateArrayStatisticalUncertainty(values, statisticalResults);
      
      // Verify
      expect(result).to.be.null;
    });
    
    it('should handle missing standard deviation', () => {
      // Setup
      const values = [10, 20, 15];
      
      const statisticalResults = {
        summary: { mean: 15, count: 3 } // No standard deviation
      };
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateArrayStatisticalUncertainty(values, statisticalResults);
      
      // Verify
      expect(result).to.be.null;
    });
  });
  
  describe('_estimateArrayDataUncertainty', () => {
    it('should estimate uncertainty for missing values', () => {
      // Setup
      const values = [10, 20, 15];
      const totalCount = 5; // 2 missing values
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateArrayDataUncertainty(values, totalCount);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('data');
      expect(result.level).to.be.within(0, 1);
      expect(result.description).to.include('Data uncertainty');
      expect(result.details.missingCount).to.equal(2);
    });
    
    it('should estimate uncertainty for small sample size', () => {
      // Setup
      const values = [10, 20, 15];
      const totalCount = 3; // No missing values, but small sample
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateArrayDataUncertainty(values, totalCount);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('data');
      expect(result.level).to.be.within(0, 1);
      expect(result.description).to.include('Sample size uncertainty');
    });
    
    it('should not report uncertainty for complete data with sufficient sample size', () => {
      // Setup
      const values = Array(30).fill(0).map((_, i) => i + 1); // 30 values
      const totalCount = 30;
      
      // Estimate uncertainty
      const result = uncertaintyEstimator._estimateArrayDataUncertainty(values, totalCount);
      
      // Verify
      expect(result).to.be.null;
    });
  });
  
  describe('_getZScore', () => {
    it('should return correct z-score for common confidence levels', () => {
      expect(uncertaintyEstimator._getZScore(0.99)).to.equal(2.576);
      expect(uncertaintyEstimator._getZScore(0.95)).to.equal(1.96);
      expect(uncertaintyEstimator._getZScore(0.90)).to.equal(1.645);
      expect(uncertaintyEstimator._getZScore(0.80)).to.equal(1.282);
    });
    
    it('should return default z-score for uncommon confidence levels', () => {
      expect(uncertaintyEstimator._getZScore(0.75)).to.equal(1.0);
      expect(uncertaintyEstimator._getZScore(0.50)).to.equal(1.0);
    });
  });
  
  describe('_calculateAverageUncertainty', () => {
    it('should calculate average uncertainty level', () => {
      // Setup
      const uncertainties = [
        { level: 0.3 },
        { level: 0.5 },
        { level: 0.7 }
      ];
      
      // Calculate
      const result = uncertaintyEstimator._calculateAverageUncertainty(uncertainties);
      
      // Verify
      expect(result).to.equal(0.5);
    });
    
    it('should handle empty array', () => {
      // Setup
      const uncertainties = [];
      
      // Calculate
      const result = uncertaintyEstimator._calculateAverageUncertainty(uncertainties);
      
      // Verify
      expect(result).to.equal(0);
    });
  });
});
