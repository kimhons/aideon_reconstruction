/**
 * @fileoverview Tests for the DataAnalyzer component
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');

const { DataAnalyzer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/DataAnalyzer');
const { DataSourceManager } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/DataSourceManager');
const { StatisticalAnalyzer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/StatisticalAnalyzer');
const { PatternRecognizer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/PatternRecognizer');
const { UncertaintyEstimator } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/UncertaintyEstimator');

describe('DataAnalyzer', () => {
  let dataAnalyzer;
  let mockAideon;
  let mockConfig;
  let mockDataSourceManager;
  let mockStatisticalAnalyzer;
  let mockPatternRecognizer;
  let mockUncertaintyEstimator;
  
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
    
    // Create mock sub-components
    mockDataSourceManager = {
      initialize: sinon.stub().resolves(),
      shutdown: sinon.stub().resolves(),
      fetchData: sinon.stub().resolves({ type: 'test', items: [] }),
      getStatus: sinon.stub().returns({ initialized: true })
    };
    
    mockStatisticalAnalyzer = {
      initialize: sinon.stub().resolves(),
      shutdown: sinon.stub().resolves(),
      analyze: sinon.stub().resolves({ summary: {} }),
      getStatus: sinon.stub().returns({ initialized: true })
    };
    
    mockPatternRecognizer = {
      initialize: sinon.stub().resolves(),
      shutdown: sinon.stub().resolves(),
      analyze: sinon.stub().resolves({ patterns: [] }),
      getStatus: sinon.stub().returns({ initialized: true })
    };
    
    mockUncertaintyEstimator = {
      initialize: sinon.stub().resolves(),
      shutdown: sinon.stub().resolves(),
      analyze: sinon.stub().resolves({ uncertainties: [] }),
      getStatus: sinon.stub().returns({ initialized: true })
    };
    
    // Create DataAnalyzer instance
    dataAnalyzer = new DataAnalyzer(mockAideon);
    
    // Replace sub-components with mocks
    dataAnalyzer.dataSourceManager = mockDataSourceManager;
    dataAnalyzer.statisticalAnalyzer = mockStatisticalAnalyzer;
    dataAnalyzer.patternRecognizer = mockPatternRecognizer;
    dataAnalyzer.uncertaintyEstimator = mockUncertaintyEstimator;
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should create a new instance with default properties', () => {
      const analyzer = new DataAnalyzer();
      
      expect(analyzer).to.be.an.instanceOf(DataAnalyzer);
      expect(analyzer.initialized).to.be.false;
      expect(analyzer.config).to.be.an('object');
      expect(analyzer.events).to.exist;
      expect(analyzer.logger).to.exist;
    });
    
    it('should store the Aideon reference if provided', () => {
      const analyzer = new DataAnalyzer(mockAideon);
      
      expect(analyzer.aideon).to.equal(mockAideon);
    });
  });
  
  describe('initialize', () => {
    it('should initialize all sub-components', async () => {
      // Setup constructor to create real sub-components
      sinon.stub(DataSourceManager.prototype, 'initialize').resolves();
      sinon.stub(StatisticalAnalyzer.prototype, 'initialize').resolves();
      sinon.stub(PatternRecognizer.prototype, 'initialize').resolves();
      sinon.stub(UncertaintyEstimator.prototype, 'initialize').resolves();
      
      // Create a fresh instance
      const analyzer = new DataAnalyzer(mockAideon);
      
      // Initialize
      await analyzer.initialize();
      
      // Verify
      expect(analyzer.initialized).to.be.true;
      expect(analyzer.dataSourceManager).to.be.an.instanceOf(DataSourceManager);
      expect(analyzer.statisticalAnalyzer).to.be.an.instanceOf(StatisticalAnalyzer);
      expect(analyzer.patternRecognizer).to.be.an.instanceOf(PatternRecognizer);
      expect(analyzer.uncertaintyEstimator).to.be.an.instanceOf(UncertaintyEstimator);
      
      expect(DataSourceManager.prototype.initialize.calledOnce).to.be.true;
      expect(StatisticalAnalyzer.prototype.initialize.calledOnce).to.be.true;
      expect(PatternRecognizer.prototype.initialize.calledOnce).to.be.true;
      expect(UncertaintyEstimator.prototype.initialize.calledOnce).to.be.true;
    });
    
    it('should load configuration if available', async () => {
      // Setup mock config
      const configGet = sinon.stub();
      configGet.withArgs('maxDataSize').returns(200000);
      configGet.withArgs('defaultConfidenceLevel').returns(0.99);
      
      const configNamespace = {
        get: configGet
      };
      
      mockAideon.config.getNamespace().getNamespace.returns(configNamespace);
      
      // Initialize with mocked sub-components
      await dataAnalyzer.initialize();
      
      // Verify config was loaded
      expect(mockAideon.config.getNamespace.calledWith('tentacles')).to.be.true;
      expect(mockAideon.config.getNamespace().getNamespace.calledWith('decisionIntelligence')).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      // Initialize once
      await dataAnalyzer.initialize();
      
      // Reset mocks
      mockDataSourceManager.initialize.resetHistory();
      mockStatisticalAnalyzer.initialize.resetHistory();
      mockPatternRecognizer.initialize.resetHistory();
      mockUncertaintyEstimator.initialize.resetHistory();
      
      // Initialize again
      await dataAnalyzer.initialize();
      
      // Verify no sub-components were reinitialized
      expect(mockDataSourceManager.initialize.called).to.be.false;
      expect(mockStatisticalAnalyzer.initialize.called).to.be.false;
      expect(mockPatternRecognizer.initialize.called).to.be.false;
      expect(mockUncertaintyEstimator.initialize.called).to.be.false;
    });
    
    it('should emit initialized event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataAnalyzer.events, 'emit');
      
      // Initialize
      await dataAnalyzer.initialize();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('initialized')).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      // Setup error in sub-component
      mockDataSourceManager.initialize.rejects(new Error('Test error'));
      
      // Attempt to initialize
      try {
        await dataAnalyzer.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
        expect(dataAnalyzer.initialized).to.be.false;
      }
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      // Initialize before testing shutdown
      await dataAnalyzer.initialize();
    });
    
    it('should shut down all sub-components', async () => {
      // Shutdown
      await dataAnalyzer.shutdown();
      
      // Verify
      expect(dataAnalyzer.initialized).to.be.false;
      expect(mockDataSourceManager.shutdown.calledOnce).to.be.true;
      expect(mockStatisticalAnalyzer.shutdown.calledOnce).to.be.true;
      expect(mockPatternRecognizer.shutdown.calledOnce).to.be.true;
      expect(mockUncertaintyEstimator.shutdown.calledOnce).to.be.true;
    });
    
    it('should do nothing if not initialized', async () => {
      // Shutdown once
      await dataAnalyzer.shutdown();
      
      // Reset mocks
      mockDataSourceManager.shutdown.resetHistory();
      mockStatisticalAnalyzer.shutdown.resetHistory();
      mockPatternRecognizer.shutdown.resetHistory();
      mockUncertaintyEstimator.shutdown.resetHistory();
      
      // Shutdown again
      await dataAnalyzer.shutdown();
      
      // Verify no sub-components were shut down
      expect(mockDataSourceManager.shutdown.called).to.be.false;
      expect(mockStatisticalAnalyzer.shutdown.called).to.be.false;
      expect(mockPatternRecognizer.shutdown.called).to.be.false;
      expect(mockUncertaintyEstimator.shutdown.called).to.be.false;
    });
    
    it('should emit shutdown event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataAnalyzer.events, 'emit');
      
      // Shutdown
      await dataAnalyzer.shutdown();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('shutdown')).to.be.true;
    });
    
    it('should handle shutdown errors', async () => {
      // Setup error in sub-component
      mockDataSourceManager.shutdown.rejects(new Error('Test error'));
      
      // Attempt to shutdown
      try {
        await dataAnalyzer.shutdown();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
      }
    });
  });
  
  describe('getStatus', () => {
    it('should return the current status', async () => {
      // Initialize
      await dataAnalyzer.initialize();
      
      // Get status
      const status = dataAnalyzer.getStatus();
      
      // Verify
      expect(status).to.be.an('object');
      expect(status.initialized).to.be.true;
      expect(status.config).to.be.an('object');
      expect(status.subComponents).to.be.an('object');
      expect(status.subComponents.dataSourceManager).to.be.an('object');
      expect(status.subComponents.statisticalAnalyzer).to.be.an('object');
      expect(status.subComponents.patternRecognizer).to.be.an('object');
      expect(status.subComponents.uncertaintyEstimator).to.be.an('object');
    });
    
    it('should include sub-component statuses', async () => {
      // Initialize
      await dataAnalyzer.initialize();
      
      // Setup mock statuses
      mockDataSourceManager.getStatus.returns({ initialized: true, custom: 'value1' });
      mockStatisticalAnalyzer.getStatus.returns({ initialized: true, custom: 'value2' });
      
      // Get status
      const status = dataAnalyzer.getStatus();
      
      // Verify
      expect(status.subComponents.dataSourceManager.custom).to.equal('value1');
      expect(status.subComponents.statisticalAnalyzer.custom).to.equal('value2');
    });
  });
  
  describe('registerApiEndpoints', () => {
    it('should register API endpoints', () => {
      // Setup mock API
      const mockApi = {
        register: sinon.stub()
      };
      
      // Register endpoints
      dataAnalyzer.registerApiEndpoints(mockApi, 'decision');
      
      // Verify
      expect(mockApi.register.calledWith('decision/data/analyze')).to.be.true;
      expect(mockApi.register.calledWith('decision/data/insights')).to.be.true;
    });
    
    it('should handle missing API service', () => {
      // This should not throw an error
      dataAnalyzer.registerApiEndpoints(null, 'decision');
    });
  });
  
  describe('analyzeData', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataAnalyzer.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      // Shutdown to make not initialized
      await dataAnalyzer.shutdown();
      
      // Attempt to analyze
      try {
        await dataAnalyzer.analyzeData({ test: 'data' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not initialized');
      }
    });
    
    it('should throw an error if data is missing', async () => {
      // Attempt to analyze without data
      try {
        await dataAnalyzer.analyzeData();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Data is required');
      }
    });
    
    it('should validate data size', async () => {
      // Setup spy for _validateDataSize
      const validateSpy = sinon.spy(dataAnalyzer, '_validateDataSize');
      
      // Analyze data
      await dataAnalyzer.analyzeData({ test: 'data' });
      
      // Verify
      expect(validateSpy.calledOnce).to.be.true;
    });
    
    it('should prepare data before analysis', async () => {
      // Setup spy for _prepareData
      const prepareSpy = sinon.spy(dataAnalyzer, '_prepareData');
      
      // Analyze data
      await dataAnalyzer.analyzeData({ test: 'data' });
      
      // Verify
      expect(prepareSpy.calledOnce).to.be.true;
    });
    
    it('should use all sub-components for analysis', async () => {
      // Setup mock return values
      const preparedData = { type: 'test', items: [] };
      const statisticalResults = { summary: { mean: 10 } };
      const patternResults = { patterns: [{ type: 'trend' }] };
      const uncertaintyResults = { uncertainties: [{ type: 'statistical' }] };
      
      sinon.stub(dataAnalyzer, '_prepareData').resolves(preparedData);
      mockStatisticalAnalyzer.analyze.resolves(statisticalResults);
      mockPatternRecognizer.analyze.resolves(patternResults);
      mockUncertaintyEstimator.analyze.resolves(uncertaintyResults);
      
      // Analyze data
      const result = await dataAnalyzer.analyzeData({ test: 'data' });
      
      // Verify
      expect(mockStatisticalAnalyzer.analyze.calledWith(preparedData)).to.be.true;
      expect(mockPatternRecognizer.analyze.calledWith(preparedData)).to.be.true;
      expect(mockUncertaintyEstimator.analyze.calledWith(preparedData)).to.be.true;
      
      expect(result).to.be.an('object');
      expect(result.statistics).to.equal(statisticalResults);
      expect(result.patterns).to.equal(patternResults);
      expect(result.uncertainty).to.equal(uncertaintyResults);
      expect(result.insights).to.be.an('array');
    });
    
    it('should emit events for analysis start and completion', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataAnalyzer.events, 'emit');
      
      // Analyze data
      await dataAnalyzer.analyzeData({ test: 'data' }, { decisionType: 'binary' });
      
      // Verify events
      expect(eventSpy.calledWith('data:analysis:start')).to.be.true;
      expect(eventSpy.calledWith('data:analysis:complete')).to.be.true;
    });
    
    it('should handle analysis errors', async () => {
      // Setup error in sub-component
      mockStatisticalAnalyzer.analyze.rejects(new Error('Analysis error'));
      
      // Setup event spy
      const eventSpy = sinon.spy(dataAnalyzer.events, 'emit');
      
      // Attempt to analyze
      try {
        await dataAnalyzer.analyzeData({ test: 'data' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Analysis error');
        expect(eventSpy.calledWith('data:analysis:error')).to.be.true;
      }
    });
  });
  
  describe('_prepareData', () => {
    it('should handle data with source property', async () => {
      // Setup
      const sourceData = { source: { type: 'json', filePath: 'test.json' } };
      
      // Prepare data
      await dataAnalyzer._prepareData(sourceData);
      
      // Verify
      expect(mockDataSourceManager.fetchData.calledWith(sourceData.source)).to.be.true;
    });
    
    it('should handle data with options property', async () => {
      // Setup
      const optionsData = {
        options: {
          option1: { value: 10 },
          option2: { value: 20 }
        }
      };
      
      // Setup spy for _prepareOptionsData
      const prepareOptionsSpy = sinon.spy(dataAnalyzer, '_prepareOptionsData');
      
      // Prepare data
      await dataAnalyzer._prepareData(optionsData);
      
      // Verify
      expect(prepareOptionsSpy.calledWith(optionsData.options)).to.be.true;
    });
    
    it('should handle array data', async () => {
      // Setup
      const arrayData = [1, 2, 3, 4, 5];
      
      // Setup spy for _prepareArrayData
      const prepareArraySpy = sinon.spy(dataAnalyzer, '_prepareArrayData');
      
      // Prepare data
      await dataAnalyzer._prepareData(arrayData);
      
      // Verify
      expect(prepareArraySpy.calledWith(arrayData)).to.be.true;
    });
    
    it('should handle object data', async () => {
      // Setup
      const objectData = { prop1: 'value1', prop2: 'value2' };
      
      // Setup spy for _prepareObjectData
      const prepareObjectSpy = sinon.spy(dataAnalyzer, '_prepareObjectData');
      
      // Prepare data
      await dataAnalyzer._prepareData(objectData);
      
      // Verify
      expect(prepareObjectSpy.calledWith(objectData)).to.be.true;
    });
  });
  
  describe('_prepareOptionsData', () => {
    it('should handle array of options', () => {
      // Setup
      const options = [
        { id: 'opt1', value: 10, name: 'Option 1' },
        { id: 'opt2', value: 20, name: 'Option 2' }
      ];
      
      // Prepare options data
      const result = dataAnalyzer._prepareOptionsData(options);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('options');
      expect(result.items).to.be.an('array');
      expect(result.items).to.have.lengthOf(2);
      expect(result.items[0].id).to.equal('opt1');
      expect(result.items[1].id).to.equal('opt2');
    });
    
    it('should handle object with named options', () => {
      // Setup
      const options = {
        opt1: { value: 10, name: 'Option 1' },
        opt2: { value: 20, name: 'Option 2' }
      };
      
      // Prepare options data
      const result = dataAnalyzer._prepareOptionsData(options);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('options');
      expect(result.items).to.be.an('array');
      expect(result.items).to.have.lengthOf(2);
      expect(result.items[0].id).to.equal('opt1');
      expect(result.items[1].id).to.equal('opt2');
    });
    
    it('should generate IDs for options without IDs', () => {
      // Setup
      const options = [
        { value: 10, name: 'Option 1' },
        { value: 20, name: 'Option 2' }
      ];
      
      // Prepare options data
      const result = dataAnalyzer._prepareOptionsData(options);
      
      // Verify
      expect(result.items[0].id).to.equal('option-0');
      expect(result.items[1].id).to.equal('option-1');
    });
  });
  
  describe('_prepareArrayData', () => {
    it('should convert array to structured format', () => {
      // Setup
      const array = [10, 20, 30, 40, 50];
      
      // Prepare array data
      const result = dataAnalyzer._prepareArrayData(array);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('array');
      expect(result.items).to.be.an('array');
      expect(result.items).to.have.lengthOf(5);
      expect(result.items[0].id).to.equal('item-0');
      expect(result.items[0].value).to.equal(10);
      expect(result.items[4].value).to.equal(50);
    });
  });
  
  describe('_prepareObjectData', () => {
    it('should convert object to structured format', () => {
      // Setup
      const object = { prop1: 'value1', prop2: 10, prop3: true };
      
      // Prepare object data
      const result = dataAnalyzer._prepareObjectData(object);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.type).to.equal('object');
      expect(result.attributes).to.be.an('object');
      expect(result.attributes.prop1).to.equal('value1');
      expect(result.attributes.prop2).to.equal(10);
      expect(result.attributes.prop3).to.equal(true);
    });
  });
  
  describe('_extractAttributes', () => {
    it('should extract primitive values', () => {
      // Setup
      const object = {
        string: 'test',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined
      };
      
      // Extract attributes
      const result = dataAnalyzer._extractAttributes(object);
      
      // Verify
      expect(result.string).to.equal('test');
      expect(result.number).to.equal(42);
      expect(result.boolean).to.equal(true);
      expect(result.null).to.be.null;
      expect(result.undefined).to.be.null;
    });
    
    it('should handle arrays', () => {
      // Setup
      const object = {
        array: [1, 2, 3]
      };
      
      // Extract attributes
      const result = dataAnalyzer._extractAttributes(object);
      
      // Verify
      expect(result.array).to.deep.equal([1, 2, 3]);
    });
    
    it('should handle nested objects', () => {
      // Setup
      const object = {
        nested: {
          prop1: 'value1',
          prop2: 42
        }
      };
      
      // Extract attributes
      const result = dataAnalyzer._extractAttributes(object);
      
      // Verify
      expect(result.nested).to.be.an('object');
      expect(result.nested.prop1).to.equal('value1');
      expect(result.nested.prop2).to.equal(42);
    });
  });
  
  describe('_estimateDataSize', () => {
    it('should estimate size of primitive values', () => {
      expect(dataAnalyzer._estimateDataSize(true)).to.equal(4);
      expect(dataAnalyzer._estimateDataSize(42)).to.equal(8);
      expect(dataAnalyzer._estimateDataSize('test')).to.equal(8); // 4 chars * 2 bytes
    });
    
    it('should estimate size of arrays', () => {
      expect(dataAnalyzer._estimateDataSize([1, 2, 3])).to.equal(24); // 3 numbers * 8 bytes
    });
    
    it('should estimate size of objects', () => {
      const object = {
        prop1: 'test', // key: 10 bytes (5 chars * 2), value: 8 bytes
        prop2: 42      // key: 10 bytes (5 chars * 2), value: 8 bytes
      };
      
      expect(dataAnalyzer._estimateDataSize(object)).to.equal(36);
    });
    
    it('should handle null and undefined', () => {
      expect(dataAnalyzer._estimateDataSize(null)).to.equal(0);
      expect(dataAnalyzer._estimateDataSize(undefined)).to.equal(0);
    });
  });
  
  describe('_validateDataSize', () => {
    it('should not throw for data within size limit', () => {
      // Setup
      dataAnalyzer.config.maxDataSize = 1000;
      
      // This should not throw
      dataAnalyzer._validateDataSize('small data');
    });
    
    it('should throw for data exceeding size limit', () => {
      // Setup
      dataAnalyzer.config.maxDataSize = 10;
      
      // This should throw
      expect(() => dataAnalyzer._validateDataSize('this is a long string that exceeds the limit'))
        .to.throw(/Data size .* exceeds the maximum allowed size/);
    });
  });
  
  describe('_generateInsights', () => {
    it('should generate insights from statistical results', () => {
      // Setup
      const statisticalResults = {
        summary: {
          mean: 10,
          standardDeviation: 2
        }
      };
      
      // Generate insights
      const insights = dataAnalyzer._generateInsights(statisticalResults, {}, {});
      
      // Verify
      expect(insights).to.be.an('array');
      expect(insights.length).to.be.at.least(2);
      expect(insights[0].type).to.equal('statistical');
    });
    
    it('should generate insights from pattern results', () => {
      // Setup
      const patternResults = {
        patterns: [
          {
            type: 'trend',
            description: 'Upward trend',
            confidence: 0.8
          }
        ]
      };
      
      // Generate insights
      const insights = dataAnalyzer._generateInsights({}, patternResults, {});
      
      // Verify
      expect(insights).to.be.an('array');
      expect(insights.length).to.equal(1);
      expect(insights[0].type).to.equal('pattern');
      expect(insights[0].description).to.equal('Upward trend');
    });
    
    it('should generate insights from uncertainty results', () => {
      // Setup
      const uncertaintyResults = {
        uncertainties: [
          {
            type: 'statistical',
            description: 'High variance',
            level: 0.3
          }
        ]
      };
      
      // Generate insights
      const insights = dataAnalyzer._generateInsights({}, {}, uncertaintyResults);
      
      // Verify
      expect(insights).to.be.an('array');
      expect(insights.length).to.equal(1);
      expect(insights[0].type).to.equal('uncertainty');
      expect(insights[0].description).to.equal('High variance');
    });
  });
});
