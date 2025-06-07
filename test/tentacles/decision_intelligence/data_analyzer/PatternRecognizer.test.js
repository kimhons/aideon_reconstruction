/**
 * @fileoverview Tests for the PatternRecognizer component
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');

const { PatternRecognizer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/PatternRecognizer');

describe('PatternRecognizer', () => {
  let patternRecognizer;
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
    
    // Create PatternRecognizer instance with default config
    patternRecognizer = new PatternRecognizer(mockAideon, {
      minConfidenceThreshold: 0.7,
      maxPatterns: 10,
      patternTypes: ['trend', 'cluster', 'outlier', 'cycle', 'correlation']
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should create a new instance with default properties', () => {
      const recognizer = new PatternRecognizer();
      
      expect(recognizer).to.be.an.instanceOf(PatternRecognizer);
      expect(recognizer.initialized).to.be.false;
      expect(recognizer.config).to.be.an('object');
      expect(recognizer.events).to.exist;
      expect(recognizer.logger).to.exist;
    });
    
    it('should store the Aideon reference if provided', () => {
      const recognizer = new PatternRecognizer(mockAideon);
      
      expect(recognizer.aideon).to.equal(mockAideon);
    });
    
    it('should use provided configuration', () => {
      const config = {
        minConfidenceThreshold: 0.8,
        maxPatterns: 5,
        patternTypes: ['trend', 'outlier']
      };
      
      const recognizer = new PatternRecognizer(mockAideon, config);
      
      expect(recognizer.config.minConfidenceThreshold).to.equal(0.8);
      expect(recognizer.config.maxPatterns).to.equal(5);
      expect(recognizer.config.patternTypes).to.deep.equal(['trend', 'outlier']);
    });
  });
  
  describe('initialize', () => {
    it('should load configuration and mark as initialized', async () => {
      // Setup spy for _loadConfiguration
      const loadConfigSpy = sinon.spy(patternRecognizer, '_loadConfiguration');
      
      // Initialize
      await patternRecognizer.initialize();
      
      // Verify
      expect(patternRecognizer.initialized).to.be.true;
      expect(loadConfigSpy.calledOnce).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      // Initialize once
      await patternRecognizer.initialize();
      
      // Reset spy
      const loadConfigSpy = sinon.spy(patternRecognizer, '_loadConfiguration');
      
      // Initialize again
      await patternRecognizer.initialize();
      
      // Verify
      expect(loadConfigSpy.called).to.be.false;
    });
    
    it('should emit initialized event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(patternRecognizer.events, 'emit');
      
      // Initialize
      await patternRecognizer.initialize();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('initialized')).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      // Setup error in initialization
      sinon.stub(patternRecognizer, '_loadConfiguration').throws(new Error('Test error'));
      
      // Attempt to initialize
      try {
        await patternRecognizer.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
        expect(patternRecognizer.initialized).to.be.false;
      }
    });
  });
  
  describe('_loadConfiguration', () => {
    it('should load configuration from Aideon config if available', async () => {
      // Setup mock config
      const configGet = sinon.stub();
      configGet.withArgs('minConfidenceThreshold').returns(0.8);
      configGet.withArgs('maxPatterns').returns(5);
      configGet.withArgs('patternTypes').returns(['trend', 'outlier']);
      
      const configNamespace = {
        get: configGet
      };
      
      mockAideon.config.getNamespace().getNamespace.returns(configNamespace);
      
      // Load configuration
      await patternRecognizer._loadConfiguration();
      
      // Verify
      expect(mockAideon.config.getNamespace.calledWith('tentacles')).to.be.true;
      expect(mockAideon.config.getNamespace().getNamespace.calledWith('decisionIntelligence')).to.be.true;
      expect(patternRecognizer.config.minConfidenceThreshold).to.equal(0.8);
      expect(patternRecognizer.config.maxPatterns).to.equal(5);
      expect(patternRecognizer.config.patternTypes).to.deep.equal(['trend', 'outlier']);
    });
    
    it('should handle missing Aideon config', async () => {
      // Setup
      patternRecognizer.aideon = null;
      
      // Load configuration
      await patternRecognizer._loadConfiguration();
      
      // Verify default values are maintained
      expect(patternRecognizer.config.minConfidenceThreshold).to.equal(0.7);
      expect(patternRecognizer.config.maxPatterns).to.equal(10);
      expect(patternRecognizer.config.patternTypes).to.deep.equal(['trend', 'cluster', 'outlier', 'cycle', 'correlation']);
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      // Initialize before testing shutdown
      await patternRecognizer.initialize();
    });
    
    it('should mark as not initialized', async () => {
      // Shutdown
      await patternRecognizer.shutdown();
      
      // Verify
      expect(patternRecognizer.initialized).to.be.false;
    });
    
    it('should do nothing if not initialized', async () => {
      // Shutdown once
      await patternRecognizer.shutdown();
      
      // Setup event spy
      const eventSpy = sinon.spy(patternRecognizer.events, 'emit');
      
      // Shutdown again
      await patternRecognizer.shutdown();
      
      // Verify no events were emitted
      expect(eventSpy.called).to.be.false;
    });
    
    it('should emit shutdown event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(patternRecognizer.events, 'emit');
      
      // Shutdown
      await patternRecognizer.shutdown();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('shutdown')).to.be.true;
    });
  });
  
  describe('getStatus', () => {
    it('should return the current status', async () => {
      // Initialize
      await patternRecognizer.initialize();
      
      // Get status
      const status = patternRecognizer.getStatus();
      
      // Verify
      expect(status).to.be.an('object');
      expect(status.initialized).to.be.true;
      expect(status.config).to.be.an('object');
      expect(status.config.minConfidenceThreshold).to.equal(0.7);
      expect(status.config.maxPatterns).to.equal(10);
      expect(status.config.patternTypes).to.deep.equal(['trend', 'cluster', 'outlier', 'cycle', 'correlation']);
    });
  });
  
  describe('analyze', () => {
    beforeEach(async () => {
      // Initialize before testing
      await patternRecognizer.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      // Shutdown to make not initialized
      await patternRecognizer.shutdown();
      
      // Attempt to analyze
      try {
        await patternRecognizer.analyze({ type: 'options', items: [] });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not initialized');
      }
    });
    
    it('should throw an error if data is missing', async () => {
      // Attempt to analyze without data
      try {
        await patternRecognizer.analyze();
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
      
      // Setup spy for _analyzeOptionsPatterns
      const analyzeOptionsSpy = sinon.spy(patternRecognizer, '_analyzeOptionsPatterns');
      
      // Mock pattern finding methods to return some patterns
      sinon.stub(patternRecognizer, '_findCorrelationPatterns').returns([
        { type: 'correlation', confidence: 0.9 }
      ]);
      sinon.stub(patternRecognizer, '_findClusterPatterns').returns([
        { type: 'cluster', confidence: 0.8 }
      ]);
      sinon.stub(patternRecognizer, '_findOutlierPatterns').returns([
        { type: 'outlier', confidence: 0.7 }
      ]);
      
      // Analyze
      const result = await patternRecognizer.analyze(data);
      
      // Verify
      expect(analyzeOptionsSpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.patterns).to.be.an('array');
      expect(result.patterns.length).to.be.at.least(1);
      expect(result.summary).to.be.an('object');
      expect(result.summary.totalPatterns).to.be.at.least(1);
    });
    
    it('should analyze array data', async () => {
      // Setup
      const data = {
        type: 'array',
        items: [
          { id: 'item1', value: 10 },
          { id: 'item2', value: 20 },
          { id: 'item3', value: 15 },
          { id: 'item4', value: 25 },
          { id: 'item5', value: 30 }
        ]
      };
      
      // Setup spy for _analyzeArrayPatterns
      const analyzeArraySpy = sinon.spy(patternRecognizer, '_analyzeArrayPatterns');
      
      // Mock pattern finding methods to return some patterns
      sinon.stub(patternRecognizer, '_findTrendPatterns').returns([
        { type: 'trend', confidence: 0.9 }
      ]);
      sinon.stub(patternRecognizer, '_findCyclePatterns').returns([]);
      sinon.stub(patternRecognizer, '_findArrayOutlierPatterns').returns([]);
      
      // Analyze
      const result = await patternRecognizer.analyze(data);
      
      // Verify
      expect(analyzeArraySpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.patterns).to.be.an('array');
      expect(result.patterns.length).to.be.at.least(1);
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
      
      // Setup spy for _analyzeObjectPatterns
      const analyzeObjectSpy = sinon.spy(patternRecognizer, '_analyzeObjectPatterns');
      
      // Analyze
      const result = await patternRecognizer.analyze(data);
      
      // Verify
      expect(analyzeObjectSpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.patterns).to.be.an('array');
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
        await patternRecognizer.analyze(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unsupported data type');
      }
    });
    
    it('should filter patterns by confidence threshold', async () => {
      // Setup
      const data = {
        type: 'options',
        items: []
      };
      
      // Set high confidence threshold
      patternRecognizer.config.minConfidenceThreshold = 0.8;
      
      // Mock _analyzeOptionsPatterns to return patterns with different confidence levels
      sinon.stub(patternRecognizer, '_analyzeOptionsPatterns').resolves([
        { type: 'correlation', confidence: 0.9, description: 'High confidence' },
        { type: 'cluster', confidence: 0.7, description: 'Low confidence' }
      ]);
      
      // Analyze
      const result = await patternRecognizer.analyze(data);
      
      // Verify
      expect(result.patterns).to.have.lengthOf(1);
      expect(result.patterns[0].confidence).to.be.at.least(0.8);
      expect(result.summary.totalPatterns).to.equal(2);
      expect(result.summary.filteredPatterns).to.equal(1);
    });
    
    it('should limit number of patterns', async () => {
      // Setup
      const data = {
        type: 'options',
        items: []
      };
      
      // Set low max patterns
      patternRecognizer.config.maxPatterns = 2;
      
      // Mock _analyzeOptionsPatterns to return many patterns
      sinon.stub(patternRecognizer, '_analyzeOptionsPatterns').resolves([
        { type: 'correlation', confidence: 0.9, description: 'Pattern 1' },
        { type: 'cluster', confidence: 0.85, description: 'Pattern 2' },
        { type: 'outlier', confidence: 0.8, description: 'Pattern 3' }
      ]);
      
      // Analyze
      const result = await patternRecognizer.analyze(data);
      
      // Verify
      expect(result.patterns).to.have.lengthOf(2);
      expect(result.summary.totalPatterns).to.equal(3);
      expect(result.summary.returnedPatterns).to.equal(2);
    });
    
    it('should handle analysis errors', async () => {
      // Setup
      const data = {
        type: 'options',
        items: []
      };
      
      // Setup error in analysis
      sinon.stub(patternRecognizer, '_analyzeOptionsPatterns').throws(new Error('Analysis error'));
      
      // Attempt to analyze
      try {
        await patternRecognizer.analyze(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Analysis error');
      }
    });
  });
  
  describe('_analyzeOptionsPatterns', () => {
    it('should analyze correlations, clusters, and outliers', async () => {
      // Setup
      const data = {
        items: [
          { id: 'opt1', attributes: { value: 10, score: 5 } },
          { id: 'opt2', attributes: { value: 20, score: 8 } },
          { id: 'opt3', attributes: { value: 15, score: 6 } }
        ]
      };
      
      const options = {
        patternTypes: ['correlation', 'cluster', 'outlier']
      };
      
      // Setup spies
      const extractSpy = sinon.spy(patternRecognizer, '_extractAttributes');
      const correlationSpy = sinon.stub(patternRecognizer, '_findCorrelationPatterns').returns([
        { type: 'correlation', confidence: 0.9 }
      ]);
      const clusterSpy = sinon.stub(patternRecognizer, '_findClusterPatterns').returns([
        { type: 'cluster', confidence: 0.8 }
      ]);
      const outlierSpy = sinon.stub(patternRecognizer, '_findOutlierPatterns').returns([
        { type: 'outlier', confidence: 0.7 }
      ]);
      
      // Analyze
      const result = await patternRecognizer._analyzeOptionsPatterns(data, options);
      
      // Verify
      expect(extractSpy.calledOnce).to.be.true;
      expect(correlationSpy.calledOnce).to.be.true;
      expect(clusterSpy.calledOnce).to.be.true;
      expect(outlierSpy.calledOnce).to.be.true;
      
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3);
    });
    
    it('should only analyze requested pattern types', async () => {
      // Setup
      const data = {
        items: []
      };
      
      const options = {
        patternTypes: ['correlation'] // Only correlation
      };
      
      // Setup spies
      const correlationSpy = sinon.stub(patternRecognizer, '_findCorrelationPatterns').returns([]);
      const clusterSpy = sinon.stub(patternRecognizer, '_findClusterPatterns');
      const outlierSpy = sinon.stub(patternRecognizer, '_findOutlierPatterns');
      
      // Analyze
      await patternRecognizer._analyzeOptionsPatterns(data, options);
      
      // Verify
      expect(correlationSpy.calledOnce).to.be.true;
      expect(clusterSpy.called).to.be.false;
      expect(outlierSpy.called).to.be.false;
    });
    
    it('should use default pattern types if not specified', async () => {
      // Setup
      const data = {
        items: []
      };
      
      // Set default pattern types
      patternRecognizer.config.patternTypes = ['cluster', 'outlier'];
      
      // Setup spies
      const correlationSpy = sinon.stub(patternRecognizer, '_findCorrelationPatterns');
      const clusterSpy = sinon.stub(patternRecognizer, '_findClusterPatterns').returns([]);
      const outlierSpy = sinon.stub(patternRecognizer, '_findOutlierPatterns').returns([]);
      
      // Analyze
      await patternRecognizer._analyzeOptionsPatterns(data, {});
      
      // Verify
      expect(correlationSpy.called).to.be.false;
      expect(clusterSpy.calledOnce).to.be.true;
      expect(outlierSpy.calledOnce).to.be.true;
    });
  });
  
  describe('_analyzeArrayPatterns', () => {
    it('should analyze trends, cycles, and outliers', async () => {
      // Setup
      const data = {
        items: [
          { id: 'item1', value: 10 },
          { id: 'item2', value: 20 },
          { id: 'item3', value: 15 },
          { id: 'item4', value: 25 },
          { id: 'item5', value: 30 }
        ]
      };
      
      const options = {
        patternTypes: ['trend', 'cycle', 'outlier']
      };
      
      // Setup spies
      const trendSpy = sinon.stub(patternRecognizer, '_findTrendPatterns').returns([
        { type: 'trend', confidence: 0.9 }
      ]);
      const cycleSpy = sinon.stub(patternRecognizer, '_findCyclePatterns').returns([
        { type: 'cycle', confidence: 0.8 }
      ]);
      const outlierSpy = sinon.stub(patternRecognizer, '_findArrayOutlierPatterns').returns([
        { type: 'outlier', confidence: 0.7 }
      ]);
      
      // Analyze
      const result = await patternRecognizer._analyzeArrayPatterns(data, options);
      
      // Verify
      expect(trendSpy.calledOnce).to.be.true;
      expect(cycleSpy.calledOnce).to.be.true;
      expect(outlierSpy.calledOnce).to.be.true;
      
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3);
    });
    
    it('should only analyze requested pattern types', async () => {
      // Setup
      const data = {
        items: []
      };
      
      const options = {
        patternTypes: ['trend'] // Only trend
      };
      
      // Setup spies
      const trendSpy = sinon.stub(patternRecognizer, '_findTrendPatterns').returns([]);
      const cycleSpy = sinon.stub(patternRecognizer, '_findCyclePatterns');
      const outlierSpy = sinon.stub(patternRecognizer, '_findArrayOutlierPatterns');
      
      // Analyze
      await patternRecognizer._analyzeArrayPatterns(data, options);
      
      // Verify
      expect(trendSpy.calledOnce).to.be.true;
      expect(cycleSpy.called).to.be.false;
      expect(outlierSpy.called).to.be.false;
    });
    
    it('should filter non-numeric values', async () => {
      // Setup
      const data = {
        items: [
          { id: 'item1', value: 10 },
          { id: 'item2', value: 'not a number' },
          { id: 'item3', value: 15 }
        ]
      };
      
      // Setup spy
      const trendSpy = sinon.stub(patternRecognizer, '_findTrendPatterns').returns([]);
      
      // Analyze
      await patternRecognizer._analyzeArrayPatterns(data, { patternTypes: ['trend'] });
      
      // Verify that only numeric values were passed
      expect(trendSpy.args[0][0]).to.deep.equal([10, 15]);
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
      const result = patternRecognizer._extractAttributes(items);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.deep.equal([10, 20, 15]);
      expect(result.score).to.deep.equal([5, 8, 6]);
      expect(result.name).to.deep.equal(['test1', 'test2', 'test3']);
    });
  });
  
  describe('_findCorrelationPatterns', () => {
    it('should find correlations between numeric attributes', () => {
      // Setup
      const attributes = {
        value: [10, 20, 30, 40, 50],
        score: [5, 8, 11, 14, 17], // Perfectly correlated with value
        rating: [5, 4, 3, 2, 1]    // Perfectly anti-correlated with value
      };
      
      // Mock correlation calculation
      sinon.stub(patternRecognizer, '_calculatePearsonCorrelation')
        .withArgs(attributes.value, attributes.score).returns(1.0)
        .withArgs(attributes.value, attributes.rating).returns(-1.0)
        .withArgs(attributes.score, attributes.rating).returns(-1.0);
      
      // Find correlations
      const result = patternRecognizer._findCorrelationPatterns(attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(3); // Three pairs of correlations
      
      // Check positive correlation
      const posCorrelation = result.find(p => p.attributes[0] === 'value' && p.attributes[1] === 'score');
      expect(posCorrelation).to.exist;
      expect(posCorrelation.correlation).to.equal(1.0);
      expect(posCorrelation.description).to.include('positively correlated');
      
      // Check negative correlation
      const negCorrelation = result.find(p => p.attributes[0] === 'value' && p.attributes[1] === 'rating');
      expect(negCorrelation).to.exist;
      expect(negCorrelation.correlation).to.equal(-1.0);
      expect(negCorrelation.description).to.include('negatively correlated');
    });
    
    it('should only report significant correlations', () => {
      // Setup
      const attributes = {
        value: [10, 20, 30, 40, 50],
        score: [5, 8, 11, 14, 17], // Strong correlation
        random: [42, 17, 29, 5, 33] // No correlation
      };
      
      // Mock correlation calculation
      sinon.stub(patternRecognizer, '_calculatePearsonCorrelation')
        .withArgs(attributes.value, attributes.score).returns(0.9)
        .withArgs(attributes.value, attributes.random).returns(0.2)
        .withArgs(attributes.score, attributes.random).returns(0.1);
      
      // Find correlations
      const result = patternRecognizer._findCorrelationPatterns(attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1); // Only one significant correlation
      expect(result[0].attributes).to.deep.equal(['value', 'score']);
    });
    
    it('should handle non-numeric attributes', () => {
      // Setup
      const attributes = {
        value: [10, 20, 30],
        name: ['test1', 'test2', 'test3']
      };
      
      // Find correlations
      const result = patternRecognizer._findCorrelationPatterns(attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0); // No correlations between numeric and non-numeric
    });
  });
  
  describe('_findClusterPatterns', () => {
    it('should find clusters in numeric attributes', () => {
      // Setup
      const items = [
        { id: 'opt1', attributes: { value: 10 } },
        { id: 'opt2', attributes: { value: 12 } },
        { id: 'opt3', attributes: { value: 50 } },
        { id: 'opt4', attributes: { value: 52 } }
      ];
      
      const attributes = {
        value: [10, 12, 50, 52]
      };
      
      // Mock histogram calculation and peak finding
      sinon.stub(patternRecognizer, '_calculateHistogram').returns([2, 0, 0, 0, 2]);
      sinon.stub(patternRecognizer, '_findHistogramPeaks').returns([0, 4]);
      
      // Find clusters
      const result = patternRecognizer._findClusterPatterns(items, attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('cluster');
      expect(result[0].attribute).to.equal('value');
      expect(result[0].clusterCount).to.equal(2);
      expect(result[0].description).to.include('2 distinct clusters');
    });
    
    it('should not report clusters if only one peak is found', () => {
      // Setup
      const items = [
        { id: 'opt1', attributes: { value: 10 } },
        { id: 'opt2', attributes: { value: 12 } },
        { id: 'opt3', attributes: { value: 15 } }
      ];
      
      const attributes = {
        value: [10, 12, 15]
      };
      
      // Mock histogram calculation and peak finding
      sinon.stub(patternRecognizer, '_calculateHistogram').returns([3, 0, 0, 0, 0]);
      sinon.stub(patternRecognizer, '_findHistogramPeaks').returns([0]);
      
      // Find clusters
      const result = patternRecognizer._findClusterPatterns(items, attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_findOutlierPatterns', () => {
    it('should find outliers in numeric attributes', () => {
      // Setup
      const items = [
        { id: 'opt1', attributes: { value: 10 } },
        { id: 'opt2', attributes: { value: 12 } },
        { id: 'opt3', attributes: { value: 11 } },
        { id: 'opt4', attributes: { value: 50 } } // Outlier
      ];
      
      const attributes = {
        value: [10, 12, 11, 50]
      };
      
      // Find outliers
      const result = patternRecognizer._findOutlierPatterns(items, attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('outlier');
      expect(result[0].attribute).to.equal('value');
      expect(result[0].outlierCount).to.be.at.least(1);
      expect(result[0].description).to.include('outlier');
    });
    
    it('should not report outliers if none are found', () => {
      // Setup
      const items = [
        { id: 'opt1', attributes: { value: 10 } },
        { id: 'opt2', attributes: { value: 12 } },
        { id: 'opt3', attributes: { value: 11 } }
      ];
      
      const attributes = {
        value: [10, 12, 11]
      };
      
      // Find outliers
      const result = patternRecognizer._findOutlierPatterns(items, attributes);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_findTrendPatterns', () => {
    it('should find increasing trends', () => {
      // Setup
      const values = [10, 20, 30, 40, 50];
      
      // Find trends
      const result = patternRecognizer._findTrendPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('trend');
      expect(result[0].direction).to.equal('increasing');
      expect(result[0].slope).to.be.greaterThan(0);
      expect(result[0].description).to.include('rising trend');
    });
    
    it('should find decreasing trends', () => {
      // Setup
      const values = [50, 40, 30, 20, 10];
      
      // Find trends
      const result = patternRecognizer._findTrendPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('trend');
      expect(result[0].direction).to.equal('decreasing');
      expect(result[0].slope).to.be.lessThan(0);
      expect(result[0].description).to.include('falling trend');
    });
    
    it('should not report weak trends', () => {
      // Setup
      const values = [10, 11, 9, 12, 10];
      
      // Find trends
      const result = patternRecognizer._findTrendPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    
    it('should handle arrays that are too short', () => {
      // Setup
      const values = [10, 20];
      
      // Find trends
      const result = patternRecognizer._findTrendPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_findCyclePatterns', () => {
    it('should find cyclical patterns', () => {
      // Setup
      const values = [10, 20, 10, 20, 10, 20];
      
      // Mock autocorrelation calculation
      sinon.stub(patternRecognizer, '_calculateAutocorrelation').returns(0.9);
      
      // Find cycles
      const result = patternRecognizer._findCyclePatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('cycle');
      expect(result[0].period).to.be.at.least(2);
      expect(result[0].description).to.include('cyclical pattern');
    });
    
    it('should not report weak cycles', () => {
      // Setup
      const values = [10, 12, 9, 11, 10, 13];
      
      // Mock autocorrelation calculation
      sinon.stub(patternRecognizer, '_calculateAutocorrelation').returns(0.3);
      
      // Find cycles
      const result = patternRecognizer._findCyclePatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    
    it('should handle arrays that are too short', () => {
      // Setup
      const values = [10, 20, 10, 20, 10];
      
      // Find cycles
      const result = patternRecognizer._findCyclePatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
  
  describe('_findArrayOutlierPatterns', () => {
    it('should find outliers in array values', () => {
      // Setup
      const values = [10, 12, 11, 50]; // 50 is an outlier
      
      // Find outliers
      const result = patternRecognizer._findArrayOutlierPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0].type).to.equal('outlier');
      expect(result[0].outlierCount).to.be.at.least(1);
      expect(result[0].description).to.include('outlier');
    });
    
    it('should not report outliers if none are found', () => {
      // Setup
      const values = [10, 12, 11];
      
      // Find outliers
      const result = patternRecognizer._findArrayOutlierPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    
    it('should handle arrays that are too short', () => {
      // Setup
      const values = [10, 20];
      
      // Find outliers
      const result = patternRecognizer._findArrayOutlierPatterns(values);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });
});
