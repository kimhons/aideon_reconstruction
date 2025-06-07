/**
 * @fileoverview Integration tests for the DataAnalyzer component group
 * 
 * These tests verify that all DataAnalyzer subcomponents work together correctly
 * as a functional group, including:
 * - DataAnalyzer (main component)
 * - DataSourceManager
 * - StatisticalAnalyzer
 * - PatternRecognizer
 * - UncertaintyEstimator
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');

const { DataAnalyzer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/DataAnalyzer');
const { DataSourceManager } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/DataSourceManager');
const { StatisticalAnalyzer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/StatisticalAnalyzer');
const { PatternRecognizer } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/PatternRecognizer');
const { UncertaintyEstimator } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/UncertaintyEstimator');

describe('DataAnalyzer Integration', () => {
  let dataAnalyzer;
  let mockAideon;
  let testDataDir;
  
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
    
    // Create test data directory path
    testDataDir = path.join(__dirname, 'test_data');
    
    // Create DataAnalyzer instance with real subcomponents
    dataAnalyzer = new DataAnalyzer(mockAideon);
    
    // Initialize the component
    await dataAnalyzer.initialize();
  });
  
  afterEach(async () => {
    // Shutdown the component
    if (dataAnalyzer.initialized) {
      await dataAnalyzer.shutdown();
    }
    
    // Clean up
    sinon.restore();
  });
  
  describe('End-to-end data analysis pipeline', () => {
    it('should analyze options data through the complete pipeline', async () => {
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
      
      // Analyze data
      const result = await dataAnalyzer.analyzeData(optionsData);
      
      // Verify complete pipeline results
      expect(result).to.be.an('object');
      
      // Verify statistics component results
      expect(result.statistics).to.be.an('object');
      expect(result.statistics.attributeStats).to.be.an('object');
      expect(result.statistics.attributeStats.value).to.be.an('object');
      expect(result.statistics.attributeStats.value.mean).to.be.a('number');
      expect(result.statistics.attributeStats.score).to.be.an('object');
      expect(result.statistics.attributeStats.risk).to.be.an('object');
      
      // Verify patterns component results
      expect(result.patterns).to.be.an('object');
      expect(result.patterns.patterns).to.be.an('array');
      
      // Verify uncertainty component results
      expect(result.uncertainty).to.be.an('object');
      expect(result.uncertainty.uncertainties).to.be.an('array');
      
      // Verify insights were generated
      expect(result.insights).to.be.an('array');
      expect(result.insights.length).to.be.at.least(1);
    });
    
    it('should analyze array data through the complete pipeline', async () => {
      // Setup test data
      const arrayData = [10, 15, 20, 25, 30, 35, 40, 45, 50];
      
      // Analyze data
      const result = await dataAnalyzer.analyzeData(arrayData);
      
      // Verify complete pipeline results
      expect(result).to.be.an('object');
      
      // Verify statistics component results
      expect(result.statistics).to.be.an('object');
      expect(result.statistics.summary).to.be.an('object');
      expect(result.statistics.summary.mean).to.be.a('number');
      expect(result.statistics.summary.standardDeviation).to.be.a('number');
      expect(result.statistics.distribution).to.be.an('object');
      expect(result.statistics.distribution.bins).to.be.an('array');
      
      // Verify patterns component results
      expect(result.patterns).to.be.an('object');
      expect(result.patterns.patterns).to.be.an('array');
      
      // Verify uncertainty component results
      expect(result.uncertainty).to.be.an('object');
      expect(result.uncertainty.uncertainties).to.be.an('array');
      
      // Verify insights were generated
      expect(result.insights).to.be.an('array');
    });
    
    it('should analyze object data through the complete pipeline', async () => {
      // Setup test data
      const objectData = {
        value: 25,
        score: 8,
        risk: 4,
        name: 'Test Option',
        active: true
      };
      
      // Analyze data
      const result = await dataAnalyzer.analyzeData(objectData);
      
      // Verify complete pipeline results
      expect(result).to.be.an('object');
      
      // Verify statistics component results
      expect(result.statistics).to.be.an('object');
      expect(result.statistics.summary).to.be.an('object');
      expect(result.statistics.numericAttributes).to.be.an('object');
      
      // Verify patterns component results
      expect(result.patterns).to.be.an('object');
      expect(result.patterns.patterns).to.be.an('array');
      
      // Verify uncertainty component results
      expect(result.uncertainty).to.be.an('object');
      expect(result.uncertainty.uncertainties).to.be.an('array');
      
      // Verify insights were generated
      expect(result.insights).to.be.an('array');
    });
  });
  
  describe('Data source integration', () => {
    it('should fetch and analyze data from JSON source', async () => {
      // Setup test data source
      const jsonSource = {
        source: {
          type: 'json',
          content: JSON.stringify({
            items: [
              { id: 1, value: 10, score: 5 },
              { id: 2, value: 20, score: 8 },
              { id: 3, value: 15, score: 6 }
            ]
          })
        }
      };
      
      // Analyze data from source
      const result = await dataAnalyzer.analyzeData(jsonSource);
      
      // Verify data was fetched and analyzed
      expect(result).to.be.an('object');
      expect(result.statistics).to.be.an('object');
      expect(result.patterns).to.be.an('object');
      expect(result.uncertainty).to.be.an('object');
    });
    
    it('should fetch and analyze data from API source', async () => {
      // Setup test data source
      const apiSource = {
        source: {
          type: 'api',
          url: 'https://api.example.com/data'
        }
      };
      
      // Mock HTTP response
      mockAideon.http.request.resolves({
        data: {
          items: [
            { id: 1, value: 10, score: 5 },
            { id: 2, value: 20, score: 8 },
            { id: 3, value: 15, score: 6 }
          ]
        }
      });
      
      // Analyze data from source
      const result = await dataAnalyzer.analyzeData(apiSource);
      
      // Verify data was fetched and analyzed
      expect(result).to.be.an('object');
      expect(result.statistics).to.be.an('object');
      expect(result.patterns).to.be.an('object');
      expect(result.uncertainty).to.be.an('object');
      
      // Verify HTTP request was made
      expect(mockAideon.http.request.calledOnce).to.be.true;
      expect(mockAideon.http.request.args[0][0].url).to.equal('https://api.example.com/data');
    });
    
    it('should fetch and analyze data from database source', async () => {
      // Setup test data source
      const dbSource = {
        source: {
          type: 'database',
          query: 'SELECT * FROM options'
        }
      };
      
      // Mock database response
      mockAideon.database.query.resolves([
        { id: 1, value: 10, score: 5 },
        { id: 2, value: 20, score: 8 },
        { id: 3, value: 15, score: 6 }
      ]);
      
      // Analyze data from source
      const result = await dataAnalyzer.analyzeData(dbSource);
      
      // Verify data was fetched and analyzed
      expect(result).to.be.an('object');
      expect(result.statistics).to.be.an('object');
      expect(result.patterns).to.be.an('object');
      expect(result.uncertainty).to.be.an('object');
      
      // Verify database query was made
      expect(mockAideon.database.query.calledOnce).to.be.true;
      expect(mockAideon.database.query.args[0][0]).to.equal('SELECT * FROM options');
    });
  });
  
  describe('Component interaction', () => {
    it('should pass statistical results to pattern recognizer', async () => {
      // Setup spies
      const statAnalyzeSpy = sinon.spy(dataAnalyzer.statisticalAnalyzer, 'analyze');
      const patternAnalyzeSpy = sinon.spy(dataAnalyzer.patternRecognizer, 'analyze');
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Analyze data
      await dataAnalyzer.analyzeData(data);
      
      // Verify component interaction
      expect(statAnalyzeSpy.calledOnce).to.be.true;
      expect(patternAnalyzeSpy.calledOnce).to.be.true;
      
      // Verify statistical results were passed to pattern recognizer
      const patternOptions = patternAnalyzeSpy.args[0][1];
      expect(patternOptions).to.be.an('object');
      expect(patternOptions.statisticalResults).to.exist;
    });
    
    it('should pass statistical and pattern results to uncertainty estimator', async () => {
      // Setup spies
      const statAnalyzeSpy = sinon.spy(dataAnalyzer.statisticalAnalyzer, 'analyze');
      const patternAnalyzeSpy = sinon.spy(dataAnalyzer.patternRecognizer, 'analyze');
      const uncertaintyAnalyzeSpy = sinon.spy(dataAnalyzer.uncertaintyEstimator, 'analyze');
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Analyze data
      await dataAnalyzer.analyzeData(data);
      
      // Verify component interaction
      expect(statAnalyzeSpy.calledOnce).to.be.true;
      expect(patternAnalyzeSpy.calledOnce).to.be.true;
      expect(uncertaintyAnalyzeSpy.calledOnce).to.be.true;
      
      // Verify results were passed to uncertainty estimator
      const uncertaintyOptions = uncertaintyAnalyzeSpy.args[0][1];
      expect(uncertaintyOptions).to.be.an('object');
      expect(uncertaintyOptions.statisticalResults).to.exist;
      expect(uncertaintyOptions.patternResults).to.exist;
    });
  });
  
  describe('Error handling', () => {
    it('should handle errors in statistical analyzer', async () => {
      // Setup error in statistical analyzer
      sinon.stub(dataAnalyzer.statisticalAnalyzer, 'analyze').rejects(new Error('Statistical analysis error'));
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Attempt to analyze data
      try {
        await dataAnalyzer.analyzeData(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Statistical analysis error');
      }
    });
    
    it('should handle errors in pattern recognizer', async () => {
      // Setup error in pattern recognizer
      sinon.stub(dataAnalyzer.patternRecognizer, 'analyze').rejects(new Error('Pattern recognition error'));
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Attempt to analyze data
      try {
        await dataAnalyzer.analyzeData(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Pattern recognition error');
      }
    });
    
    it('should handle errors in uncertainty estimator', async () => {
      // Setup error in uncertainty estimator
      sinon.stub(dataAnalyzer.uncertaintyEstimator, 'analyze').rejects(new Error('Uncertainty estimation error'));
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Attempt to analyze data
      try {
        await dataAnalyzer.analyzeData(data);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Uncertainty estimation error');
      }
    });
    
    it('should handle errors in data source manager', async () => {
      // Setup test data source
      const jsonSource = {
        source: {
          type: 'json',
          filePath: '/nonexistent/file.json'
        }
      };
      
      // Setup error in data source manager
      sinon.stub(dataAnalyzer.dataSourceManager, 'fetchData').rejects(new Error('Data source error'));
      
      // Attempt to analyze data from source
      try {
        await dataAnalyzer.analyzeData(jsonSource);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Data source error');
      }
    });
  });
  
  describe('Event emission', () => {
    it('should emit events for analysis lifecycle', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataAnalyzer.events, 'emit');
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Analyze data
      await dataAnalyzer.analyzeData(data);
      
      // Verify events were emitted
      expect(eventSpy.calledWith('data:analysis:start')).to.be.true;
      expect(eventSpy.calledWith('data:analysis:complete')).to.be.true;
    });
    
    it('should emit error event when analysis fails', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataAnalyzer.events, 'emit');
      
      // Setup error in statistical analyzer
      sinon.stub(dataAnalyzer.statisticalAnalyzer, 'analyze').rejects(new Error('Analysis error'));
      
      // Setup test data
      const data = [10, 15, 20, 25, 30];
      
      // Attempt to analyze data
      try {
        await dataAnalyzer.analyzeData(data);
      } catch (error) {
        // Expected error
      }
      
      // Verify error event was emitted
      expect(eventSpy.calledWith('data:analysis:error')).to.be.true;
    });
  });
  
  describe('Performance', () => {
    it('should handle large datasets efficiently', async function() {
      // Increase timeout for this test
      this.timeout(5000);
      
      // Generate large dataset
      const largeData = Array(1000).fill(0).map((_, i) => i);
      
      // Measure execution time
      const startTime = Date.now();
      
      // Analyze data
      const result = await dataAnalyzer.analyzeData(largeData);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Verify results
      expect(result).to.be.an('object');
      expect(result.statistics).to.be.an('object');
      expect(result.patterns).to.be.an('object');
      expect(result.uncertainty).to.be.an('object');
      
      // Verify execution time is reasonable (adjust threshold as needed)
      expect(executionTime).to.be.below(3000);
    });
  });
  
  describe('API integration', () => {
    it('should register API endpoints', () => {
      // Setup mock API
      const mockApi = {
        register: sinon.stub()
      };
      
      // Register endpoints
      dataAnalyzer.registerApiEndpoints(mockApi, 'decision');
      
      // Verify endpoints were registered
      expect(mockApi.register.calledWith('decision/data/analyze')).to.be.true;
      expect(mockApi.register.calledWith('decision/data/insights')).to.be.true;
    });
  });
});
