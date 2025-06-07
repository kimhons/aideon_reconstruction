/**
 * @fileoverview Tests for the StatisticalAnalyzer component
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');

const { StatisticalAnalyzer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/StatisticalAnalyzer');

describe('StatisticalAnalyzer', () => {
  let statisticalAnalyzer;
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
    
    // Create StatisticalAnalyzer instance with default config
    statisticalAnalyzer = new StatisticalAnalyzer(mockAideon, {
      defaultConfidenceLevel: 0.95,
      maxSampleSize: 10000
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should create a new instance with default properties', () => {
      const analyzer = new StatisticalAnalyzer();
      
      expect(analyzer).to.be.an.instanceOf(StatisticalAnalyzer);
      expect(analyzer.initialized).to.be.false;
      expect(analyzer.config).to.be.an('object');
      expect(analyzer.events).to.exist;
      expect(analyzer.logger).to.exist;
    });
    
    it('should store the Aideon reference if provided', () => {
      const analyzer = new StatisticalAnalyzer(mockAideon);
      
      expect(analyzer.aideon).to.equal(mockAideon);
    });
    
    it('should use provided configuration', () => {
      const config = {
        defaultConfidenceLevel: 0.99,
        maxSampleSize: 5000
      };
      
      const analyzer = new StatisticalAnalyzer(mockAideon, config);
      
      expect(analyzer.config.defaultConfidenceLevel).to.equal(0.99);
      expect(analyzer.config.maxSampleSize).to.equal(5000);
    });
  });
  
  describe('initialize', () => {
    it('should load configuration and mark as initialized', async () => {
      // Setup spy for _loadConfiguration
      const loadConfigSpy = sinon.spy(statisticalAnalyzer, '_loadConfiguration');
      
      // Initialize
      await statisticalAnalyzer.initialize();
      
      // Verify
      expect(statisticalAnalyzer.initialized).to.be.true;
      expect(loadConfigSpy.calledOnce).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      // Initialize once
      await statisticalAnalyzer.initialize();
      
      // Reset spy
      const loadConfigSpy = sinon.spy(statisticalAnalyzer, '_loadConfiguration');
      
      // Initialize again
      await statisticalAnalyzer.initialize();
      
      // Verify
      expect(loadConfigSpy.called).to.be.false;
    });
    
    it('should emit initialized event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(statisticalAnalyzer.events, 'emit');
      
      // Initialize
      await statisticalAnalyzer.initialize();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('initialized')).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      // Setup error in initialization
      sinon.stub(statisticalAnalyzer, '_loadConfiguration').throws(new Error('Test error'));
      
      // Attempt to initialize
      try {
        await statisticalAnalyzer.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
        expect(statisticalAnalyzer.initialized).to.be.false;
      }
    });
  });
  
  describe('_loadConfiguration', () => {
    it('should load configuration from Aideon config if available', async () => {
      // Setup mock config
      const configGet = sinon.stub();
      configGet.withArgs('defaultConfidenceLevel').returns(0.99);
      configGet.withArgs('maxSampleSize').returns(5000);
      
      const configNamespace = {
        get: configGet
      };
      
      mockAideon.config.getNamespace().getNamespace.returns(configNamespace);
      
      // Load configuration
      await statisticalAnalyzer._loadConfiguration();
      
      // Verify
      expect(mockAideon.config.getNamespace.calledWith('tentacles')).to.be.true;
      expect(mockAideon.config.getNamespace().getNamespace.calledWith('decisionIntelligence')).to.be.true;
      expect(statisticalAnalyzer.config.defaultConfidenceLevel).to.equal(0.99);
      expect(statisticalAnalyzer.config.maxSampleSize).to.equal(5000);
    });
    
    it('should handle missing Aideon config', async () => {
      // Setup
      statisticalAnalyzer.aideon = null;
      
      // Load configuration
      await statisticalAnalyzer._loadConfiguration();
      
      // Verify default values are maintained
      expect(statisticalAnalyzer.config.defaultConfidenceLevel).to.equal(0.95);
      expect(statisticalAnalyzer.config.maxSampleSize).to.equal(10000);
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      // Initialize before testing shutdown
      await statisticalAnalyzer.initialize();
    });
    
    it('should mark as not initialized', async () => {
      // Shutdown
      await statisticalAnalyzer.shutdown();
      
      // Verify
      expect(statisticalAnalyzer.initialized).to.be.false;
    });
    
    it('should do nothing if not initialized', async () => {
      // Shutdown once
      await statisticalAnalyzer.shutdown();
      
      // Setup event spy
      const eventSpy = sinon.spy(statisticalAnalyzer.events, 'emit');
      
      // Shutdown again
      await statisticalAnalyzer.shutdown();
      
      // Verify no events were emitted
      expect(eventSpy.called).to.be.false;
    });
    
    it('should emit shutdown event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(statisticalAnalyzer.events, 'emit');
      
      // Shutdown
      await statisticalAnalyzer.shutdown();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('shutdown')).to.be.true;
    });
  });
  
  describe('getStatus', () => {
    it('should return the current status', async () => {
      // Initialize
      await statisticalAnalyzer.initialize();
      
      // Get status
      const status = statisticalAnalyzer.getStatus();
      
      // Verify
      expect(status).to.be.an('object');
      expect(status.initialized).to.be.true;
      expect(status.config).to.be.an('object');
      expect(status.config.defaultConfidenceLevel).to.equal(0.95);
      expect(status.config.maxSampleSize).to.equal(10000);
    });
  });
  
  describe('analyze', () => {
    beforeEach(async () => {
      // Initialize before testing
      await statisticalAnalyzer.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      // Shutdown to make not initialized
      await statisticalAnalyzer.shutdown();
      
      // Attempt to analyze
      try {
        await statisticalAnalyzer.analyze({ type: 'options', items: [] });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not initialized');
      }
    });
    
    it('should throw an error if data is missing', async () => {
      // Attempt to analyze without data
      try {
        await statisticalAnalyzer.analyze();
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
      
      // Setup spy for _analyzeOptions
      const analyzeOptionsSpy = sinon.spy(statisticalAnalyzer, '_analyzeOptions');
      
      // Analyze
      const result = await statisticalAnalyzer.analyze(data);
      
      // Verify
      expect(analyzeOptionsSpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.summary).to.be.an('object');
      expect(result.attributeStats).to.be.an('object');
      expect(result.correlations).to.be.an('object');
      expect(result.rankings).to.be.an('object');
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
      
      // Setup spy for _analyzeArray
      const analyzeArraySpy = sinon.spy(statisticalAnalyzer, '_analyzeArray');
      
      // Analyze
      const result = await statisticalAnalyzer.analyze(data);
      
      // Verify
      expect(analyzeArraySpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.summary).to.be.an('object');
      expect(result.distribution).to.be.an('object');
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
      
      // Setup spy for _analyzeObject
      const analyzeObjectSpy = sinon.spy(statisticalAnalyzer, '_analyzeObject');
      
      // Analyze
      const result = await statisticalAnalyzer.analyze(data);
      
      // Verify
      expect(analyzeObjectSpy.calledWith(data)).to.be.true;
      expect(result).to.be.an('object');
      expect(result.summary).to.be.an('object');
      expect(result.numericAttributes).to.be.an('object');
    });
    
    it('should throw an error for unsupported data type', async () => {
      // Setup
      const data = {
        type: 'unsupported',
        items: []
      };
      
      // Attempt to analyze
      try {
        await statisticalAnalyzer.analyze(data);
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
      sinon.stub(statisticalAnalyzer, '_analyzeOptions').throws(new Error('Analysis error'));
      
      // Attempt to analyze
      try {
        await statisticalAnalyzer.analyze(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Analysis error');
      }
    });
  });
  
  describe('_analyzeOptions', () => {
    it('should extract numeric attributes and calculate statistics', async () => {
      // Setup
      const data = {
        items: [
          { id: 'opt1', attributes: { value: 10, score: 5 } },
          { id: 'opt2', attributes: { value: 20, score: 8 } },
          { id: 'opt3', attributes: { value: 15, score: 6 } }
        ]
      };
      
      // Setup spies
      const extractSpy = sinon.spy(statisticalAnalyzer, '_extractNumericAttributes');
      const calcStatsSpy = sinon.spy(statisticalAnalyzer, '_calculateStatistics');
      const calcCorrSpy = sinon.spy(statisticalAnalyzer, '_calculateCorrelations');
      const calcRankSpy = sinon.spy(statisticalAnalyzer, '_calculateRankings');
      
      // Analyze
      const result = await statisticalAnalyzer._analyzeOptions(data);
      
      // Verify
      expect(extractSpy.calledOnce).to.be.true;
      expect(calcStatsSpy.called).to.be.true;
      expect(calcCorrSpy.calledOnce).to.be.true;
      expect(calcRankSpy.calledOnce).to.be.true;
      
      expect(result).to.be.an('object');
      expect(result.summary.optionCount).to.equal(3);
      expect(result.attributeStats).to.be.an('object');
      expect(result.attributeStats.value).to.be.an('object');
      expect(result.attributeStats.score).to.be.an('object');
      expect(result.correlations).to.be.an('object');
      expect(result.rankings).to.be.an('object');
    });
  });
  
  describe('_analyzeArray', () => {
    it('should calculate statistics and distribution for numeric values', async () => {
      // Setup
      const data = {
        items: [
          { id: 'item1', value: 10 },
          { id: 'item2', value: 20 },
          { id: 'item3', value: 15 },
          { id: 'item4', value: 'not a number' }
        ]
      };
      
      // Setup spies
      const calcStatsSpy = sinon.spy(statisticalAnalyzer, '_calculateStatistics');
      const calcDistSpy = sinon.spy(statisticalAnalyzer, '_calculateDistribution');
      
      // Analyze
      const result = await statisticalAnalyzer._analyzeArray(data);
      
      // Verify
      expect(calcStatsSpy.calledOnce).to.be.true;
      expect(calcDistSpy.calledOnce).to.be.true;
      
      expect(result).to.be.an('object');
      expect(result.summary.itemCount).to.equal(4);
      expect(result.summary.numericCount).to.equal(3);
      expect(result.distribution).to.be.an('object');
    });
  });
  
  describe('_analyzeObject', () => {
    it('should extract numeric attributes from object', async () => {
      // Setup
      const data = {
        attributes: {
          value: 10,
          score: 5,
          name: 'test',
          active: true
        }
      };
      
      // Analyze
      const result = await statisticalAnalyzer._analyzeObject(data);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.summary.attributeCount).to.equal(4);
      expect(result.summary.numericCount).to.equal(2);
      expect(result.numericAttributes).to.be.an('object');
      expect(result.numericAttributes.value).to.equal(10);
      expect(result.numericAttributes.score).to.equal(5);
      expect(result.numericAttributes.name).to.be.undefined;
    });
  });
  
  describe('_extractNumericAttributes', () => {
    it('should extract numeric attributes from items', () => {
      // Setup
      const items = [
        { attributes: { value: 10, score: 5, name: 'test1' } },
        { attributes: { value: 20, score: 8, name: 'test2' } },
        { attributes: { value: 15, score: 6, name: 'test3' } }
      ];
      
      // Extract
      const result = statisticalAnalyzer._extractNumericAttributes(items);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.deep.equal([10, 20, 15]);
      expect(result.score).to.deep.equal([5, 8, 6]);
      expect(result.name).to.be.undefined;
    });
    
    it('should handle non-numeric attributes', () => {
      // Setup
      const items = [
        { attributes: { value: 'not a number', score: true } },
        { attributes: { value: null, score: undefined } }
      ];
      
      // Extract
      const result = statisticalAnalyzer._extractNumericAttributes(items);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.be.undefined;
      expect(result.score).to.be.undefined;
    });
  });
  
  describe('_calculateStatistics', () => {
    it('should calculate basic statistics for an array of values', () => {
      // Setup
      const values = [10, 20, 15, 25, 30];
      
      // Calculate
      const result = statisticalAnalyzer._calculateStatistics(values);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.count).to.equal(5);
      expect(result.mean).to.equal(20);
      expect(result.median).to.equal(20);
      expect(result.min).to.equal(10);
      expect(result.max).to.equal(30);
      expect(result.range).to.equal(20);
      expect(result.standardDeviation).to.be.closeTo(7.07, 0.01);
      expect(result.variance).to.be.closeTo(50, 0.01);
    });
    
    it('should handle empty arrays', () => {
      // Setup
      const values = [];
      
      // Calculate
      const result = statisticalAnalyzer._calculateStatistics(values);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.count).to.equal(0);
      expect(result.mean).to.be.null;
      expect(result.median).to.be.null;
      expect(result.min).to.be.null;
      expect(result.max).to.be.null;
      expect(result.range).to.be.null;
      expect(result.standardDeviation).to.be.null;
      expect(result.variance).to.be.null;
    });
    
    it('should handle arrays with one value', () => {
      // Setup
      const values = [42];
      
      // Calculate
      const result = statisticalAnalyzer._calculateStatistics(values);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.count).to.equal(1);
      expect(result.mean).to.equal(42);
      expect(result.median).to.equal(42);
      expect(result.min).to.equal(42);
      expect(result.max).to.equal(42);
      expect(result.range).to.equal(0);
      expect(result.standardDeviation).to.equal(0);
      expect(result.variance).to.equal(0);
    });
  });
  
  describe('_calculateMedian', () => {
    it('should calculate median for odd number of values', () => {
      // Setup
      const values = [10, 15, 20, 25, 30];
      
      // Calculate
      const result = statisticalAnalyzer._calculateMedian(values);
      
      // Verify
      expect(result).to.equal(20);
    });
    
    it('should calculate median for even number of values', () => {
      // Setup
      const values = [10, 15, 20, 25];
      
      // Calculate
      const result = statisticalAnalyzer._calculateMedian(values);
      
      // Verify
      expect(result).to.equal(17.5);
    });
  });
  
  describe('_calculateDistribution', () => {
    it('should calculate distribution with appropriate bins', () => {
      // Setup
      const values = [10, 20, 15, 25, 30, 35, 40, 45, 50];
      
      // Calculate
      const result = statisticalAnalyzer._calculateDistribution(values);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.bins).to.be.an('array');
      expect(result.binSize).to.be.greaterThan(0);
      
      // Check that all values are accounted for
      const totalCount = result.bins.reduce((sum, bin) => sum + bin.count, 0);
      expect(totalCount).to.equal(values.length);
    });
    
    it('should handle empty arrays', () => {
      // Setup
      const values = [];
      
      // Calculate
      const result = statisticalAnalyzer._calculateDistribution(values);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.bins).to.be.an('array');
      expect(result.bins).to.have.lengthOf(0);
      expect(result.binSize).to.equal(0);
    });
  });
  
  describe('_calculateCorrelations', () => {
    it('should calculate correlations between attributes', () => {
      // Setup
      const attributes = {
        value: [10, 20, 30, 40, 50],
        score: [5, 8, 11, 14, 17]
      };
      
      // Calculate
      const result = statisticalAnalyzer._calculateCorrelations(attributes);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.be.an('object');
      expect(result.score).to.be.an('object');
      expect(result.value.value).to.equal(1); // Self-correlation is 1
      expect(result.score.score).to.equal(1); // Self-correlation is 1
      expect(result.value.score).to.be.closeTo(1, 0.01); // Perfect correlation
      expect(result.score.value).to.be.closeTo(1, 0.01); // Perfect correlation
    });
    
    it('should handle negative correlations', () => {
      // Setup
      const attributes = {
        value: [10, 20, 30, 40, 50],
        score: [17, 14, 11, 8, 5]
      };
      
      // Calculate
      const result = statisticalAnalyzer._calculateCorrelations(attributes);
      
      // Verify
      expect(result.value.score).to.be.closeTo(-1, 0.01); // Perfect negative correlation
      expect(result.score.value).to.be.closeTo(-1, 0.01); // Perfect negative correlation
    });
  });
  
  describe('_calculatePearsonCorrelation', () => {
    it('should calculate positive correlation correctly', () => {
      // Setup
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      
      // Calculate
      const result = statisticalAnalyzer._calculatePearsonCorrelation(x, y);
      
      // Verify
      expect(result).to.be.closeTo(1, 0.01); // Perfect positive correlation
    });
    
    it('should calculate negative correlation correctly', () => {
      // Setup
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      
      // Calculate
      const result = statisticalAnalyzer._calculatePearsonCorrelation(x, y);
      
      // Verify
      expect(result).to.be.closeTo(-1, 0.01); // Perfect negative correlation
    });
    
    it('should handle no correlation', () => {
      // Setup
      const x = [1, 2, 3, 4, 5];
      const y = [5, 2, 4, 1, 3];
      
      // Calculate
      const result = statisticalAnalyzer._calculatePearsonCorrelation(x, y);
      
      // Verify
      expect(result).to.be.closeTo(0, 0.3); // No significant correlation
    });
    
    it('should handle arrays of different lengths', () => {
      // Setup
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6];
      
      // Calculate
      const result = statisticalAnalyzer._calculatePearsonCorrelation(x, y);
      
      // Verify
      expect(result).to.be.closeTo(1, 0.01); // Perfect correlation for the common length
    });
    
    it('should handle empty arrays', () => {
      // Setup
      const x = [];
      const y = [];
      
      // Calculate
      const result = statisticalAnalyzer._calculatePearsonCorrelation(x, y);
      
      // Verify
      expect(result).to.equal(0);
    });
    
    it('should handle zero variance', () => {
      // Setup
      const x = [5, 5, 5, 5, 5];
      const y = [1, 2, 3, 4, 5];
      
      // Calculate
      const result = statisticalAnalyzer._calculatePearsonCorrelation(x, y);
      
      // Verify
      expect(result).to.equal(0); // No correlation when one variable has zero variance
    });
  });
  
  describe('_calculateRankings', () => {
    it('should calculate rankings for each attribute', () => {
      // Setup
      const items = [
        { id: 'opt1', attributes: { value: 10, score: 5 } },
        { id: 'opt2', attributes: { value: 30, score: 8 } },
        { id: 'opt3', attributes: { value: 20, score: 3 } }
      ];
      
      const numericAttributes = {
        value: [10, 30, 20],
        score: [5, 8, 3]
      };
      
      // Calculate
      const result = statisticalAnalyzer._calculateRankings(items, numericAttributes);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.value).to.be.an('array');
      expect(result.score).to.be.an('array');
      
      // Check value rankings (descending order)
      expect(result.value[0].id).to.equal('opt2'); // 30 is highest
      expect(result.value[0].rank).to.equal(1);
      expect(result.value[1].id).to.equal('opt3'); // 20 is second
      expect(result.value[1].rank).to.equal(2);
      expect(result.value[2].id).to.equal('opt1'); // 10 is lowest
      expect(result.value[2].rank).to.equal(3);
      
      // Check score rankings (descending order)
      expect(result.score[0].id).to.equal('opt2'); // 8 is highest
      expect(result.score[0].rank).to.equal(1);
      expect(result.score[1].id).to.equal('opt1'); // 5 is second
      expect(result.score[1].rank).to.equal(2);
      expect(result.score[2].id).to.equal('opt3'); // 3 is lowest
      expect(result.score[2].rank).to.equal(3);
    });
    
    it('should handle non-numeric attributes', () => {
      // Setup
      const items = [
        { id: 'opt1', attributes: { value: 'not a number', score: true } },
        { id: 'opt2', attributes: { value: 30, score: 8 } },
        { id: 'opt3', attributes: { value: 20, score: 3 } }
      ];
      
      const numericAttributes = {
        value: [30, 20],
        score: [8, 3]
      };
      
      // Calculate
      const result = statisticalAnalyzer._calculateRankings(items, numericAttributes);
      
      // Verify
      expect(result.value).to.have.lengthOf(2); // Only 2 numeric values
      expect(result.score).to.have.lengthOf(2); // Only 2 numeric values
    });
  });
});
