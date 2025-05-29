/**
 * @fileoverview Unit tests for the Reasoning Strategy Manager.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { ReasoningStrategyManager } = require('../../../../../src/tentacles/cognitive/core/reasoning/ReasoningStrategyManager');

describe('ReasoningStrategyManager', () => {
  let reasoningStrategyManager;
  let mockLogger;
  let mockConfigService;
  let mockPerformanceMonitor;
  let mockKnowledgeGraphManager;
  let mockVectorService;
  let timerId = 'test-timer-id';
  
  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
    
    mockConfigService = {
      get: sinon.stub().returns({})
    };
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub().returns(timerId),
      endTimer: sinon.spy()
    };
    
    mockKnowledgeGraphManager = {
      getNode: sinon.stub().resolves({}),
      findNodes: sinon.stub().resolves([])
    };
    
    mockVectorService = {
      getEmbedding: sinon.stub().resolves(new Float32Array(10))
    };
    
    // Create ReasoningStrategyManager instance
    reasoningStrategyManager = new ReasoningStrategyManager({
      logger: mockLogger,
      configService: mockConfigService,
      performanceMonitor: mockPerformanceMonitor,
      knowledgeGraphManager: mockKnowledgeGraphManager,
      vectorService: mockVectorService
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should throw an error if knowledgeGraphManager is not provided', () => {
      expect(() => new ReasoningStrategyManager({
        logger: mockLogger,
        configService: mockConfigService,
        performanceMonitor: mockPerformanceMonitor
      })).to.throw('ReasoningStrategyManager requires a knowledgeGraphManager instance');
    });
    
    it('should initialize with the provided dependencies', () => {
      expect(reasoningStrategyManager.logger).to.equal(mockLogger);
      expect(reasoningStrategyManager.configService).to.equal(mockConfigService);
      expect(reasoningStrategyManager.performanceMonitor).to.equal(mockPerformanceMonitor);
      expect(reasoningStrategyManager.knowledgeGraphManager).to.equal(mockKnowledgeGraphManager);
      expect(reasoningStrategyManager.vectorService).to.equal(mockVectorService);
      expect(reasoningStrategyManager.initialized).to.be.false;
      expect(reasoningStrategyManager.strategies).to.be.an.instanceOf(Map);
      expect(reasoningStrategyManager.strategyStats).to.be.an.instanceOf(Map);
    });
  });
  
  describe('initialize', () => {
    it('should register placeholder strategies', async () => {
      await reasoningStrategyManager.initialize();
      
      expect(reasoningStrategyManager.initialized).to.be.true;
      expect(reasoningStrategyManager.strategies.size).to.be.at.least(4); // At least 4 placeholder strategies
      expect(reasoningStrategyManager.strategies.has('deductive')).to.be.true;
      expect(reasoningStrategyManager.strategies.has('inductive')).to.be.true;
      expect(reasoningStrategyManager.strategies.has('abductive')).to.be.true;
      expect(reasoningStrategyManager.strategies.has('analogical')).to.be.true;
      
      expect(mockLogger.info.calledWith('ReasoningStrategyManager initialized successfully')).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      reasoningStrategyManager.initialized = true;
      const spy = sinon.spy(reasoningStrategyManager, '_registerPlaceholderStrategies');
      
      await reasoningStrategyManager.initialize();
      
      expect(spy.called).to.be.false;
    });
    
    it('should handle initialization errors', async () => {
      sinon.stub(reasoningStrategyManager, '_registerPlaceholderStrategies').throws(new Error('Test error'));
      
      try {
        await reasoningStrategyManager.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('ReasoningStrategyManager initialization failed');
        expect(mockLogger.error.calledOnce).to.be.true;
        expect(reasoningStrategyManager.initialized).to.be.false;
      }
    });
  });
  
  describe('registerStrategy', () => {
    it('should throw an error if strategy name is not provided', () => {
      expect(() => reasoningStrategyManager.registerStrategy(null, {
        execute: () => {},
        canHandle: () => {}
      })).to.throw('Strategy name is required');
    });
    
    it('should throw an error if execute function is not provided', () => {
      expect(() => reasoningStrategyManager.registerStrategy('test-strategy', {
        canHandle: () => {}
      })).to.throw('Strategy must have an execute function');
    });
    
    it('should throw an error if canHandle function is not provided', () => {
      expect(() => reasoningStrategyManager.registerStrategy('test-strategy', {
        execute: () => {}
      })).to.throw('Strategy must have a canHandle function');
    });
    
    it('should register a strategy successfully', () => {
      const strategy = {
        name: 'Test Strategy',
        description: 'Test description',
        execute: () => {},
        canHandle: () => {}
      };
      
      const result = reasoningStrategyManager.registerStrategy('test-strategy', strategy);
      
      expect(result).to.be.true;
      expect(reasoningStrategyManager.strategies.has('test-strategy')).to.be.true;
      expect(reasoningStrategyManager.strategies.get('test-strategy')).to.equal(strategy);
      
      // Check that statistics were initialized
      expect(reasoningStrategyManager.strategyStats.has('test-strategy')).to.be.true;
      const stats = reasoningStrategyManager.strategyStats.get('test-strategy');
      expect(stats.executionCount).to.equal(0);
      expect(stats.successCount).to.equal(0);
      expect(stats.failureCount).to.equal(0);
      
      expect(mockLogger.debug.calledWith(sinon.match('Registered reasoning strategy: test-strategy'))).to.be.true;
    });
  });
  
  describe('unregisterStrategy', () => {
    beforeEach(() => {
      reasoningStrategyManager.registerStrategy('test-strategy', {
        name: 'Test Strategy',
        description: 'Test description',
        execute: () => {},
        canHandle: () => {}
      });
    });
    
    it('should throw an error if strategy is not registered', () => {
      expect(() => reasoningStrategyManager.unregisterStrategy('non-existent-strategy'))
        .to.throw('Strategy not registered: non-existent-strategy');
    });
    
    it('should unregister a strategy successfully', () => {
      const result = reasoningStrategyManager.unregisterStrategy('test-strategy');
      
      expect(result).to.be.true;
      expect(reasoningStrategyManager.strategies.has('test-strategy')).to.be.false;
      
      // Check that statistics are kept
      expect(reasoningStrategyManager.strategyStats.has('test-strategy')).to.be.true;
      
      expect(mockLogger.debug.calledWith(sinon.match('Unregistered reasoning strategy: test-strategy'))).to.be.true;
    });
  });
  
  describe('getRegisteredStrategies', () => {
    beforeEach(async () => {
      await reasoningStrategyManager.initialize();
    });
    
    it('should throw an error if not initialized', () => {
      reasoningStrategyManager.initialized = false;
      
      expect(() => reasoningStrategyManager.getRegisteredStrategies())
        .to.throw('ReasoningStrategyManager is not initialized. Call initialize() first.');
    });
    
    it('should return a list of registered strategies', () => {
      const strategies = reasoningStrategyManager.getRegisteredStrategies();
      
      expect(strategies).to.be.an('array');
      expect(strategies.length).to.be.at.least(4);
      
      const deductiveStrategy = strategies.find(s => s.name === 'deductive');
      expect(deductiveStrategy).to.exist;
      expect(deductiveStrategy.displayName).to.equal('Deductive Reasoning');
      expect(deductiveStrategy.description).to.be.a('string');
    });
  });
  
  describe('selectStrategy', () => {
    beforeEach(async () => {
      await reasoningStrategyManager.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningStrategyManager.initialized = false;
      
      try {
        await reasoningStrategyManager.selectStrategy({ id: 'test-task', query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningStrategyManager is not initialized. Call initialize() first.');
      }
    });
    
    it('should select a preferred strategy if available and capable', async () => {
      const task = {
        id: 'test-task',
        query: 'Test query',
        preferredStrategies: ['deductive', 'inductive']
      };
      
      const result = await reasoningStrategyManager.selectStrategy(task);
      
      expect(result.strategyName).to.equal('deductive');
      expect(result.confidence).to.be.a('number');
      expect(result.reason).to.include('Preferred strategy');
      
      expect(mockLogger.debug.calledWith(sinon.match('Selected preferred strategy: deductive'))).to.be.true;
    });
    
    it('should select the highest confidence strategy if no preferred strategy is capable', async () => {
      // Override the canHandle method of the deductive strategy to return false
      const deductiveStrategy = reasoningStrategyManager.strategies.get('deductive');
      const originalCanHandle = deductiveStrategy.canHandle;
      deductiveStrategy.canHandle = () => ({ canHandle: false, confidence: 0 });
      
      const task = {
        id: 'test-task',
        query: 'Test query',
        preferredStrategies: ['deductive']
      };
      
      const result = await reasoningStrategyManager.selectStrategy(task);
      
      // Should select a different strategy
      expect(result.strategyName).to.not.equal('deductive');
      expect(result.confidence).to.be.a('number');
      expect(result.reason).to.equal('Highest confidence strategy');
      
      // Restore original method
      deductiveStrategy.canHandle = originalCanHandle;
    });
    
    it('should throw an error if no suitable strategy is found', async () => {
      // Override all canHandle methods to return false
      for (const strategy of reasoningStrategyManager.strategies.values()) {
        strategy.canHandle = () => ({ canHandle: false, confidence: 0 });
      }
      
      const task = {
        id: 'test-task',
        query: 'Test query'
      };
      
      try {
        await reasoningStrategyManager.selectStrategy(task);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('No suitable reasoning strategy found for the task');
        expect(mockLogger.error.calledOnce).to.be.true;
      }
    });
  });
  
  describe('executeStrategy', () => {
    beforeEach(async () => {
      await reasoningStrategyManager.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningStrategyManager.initialized = false;
      
      try {
        await reasoningStrategyManager.executeStrategy('deductive', { id: 'test-task', query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningStrategyManager is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if strategy is not registered', async () => {
      try {
        await reasoningStrategyManager.executeStrategy('non-existent-strategy', { id: 'test-task', query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Strategy not registered: non-existent-strategy');
      }
    });
    
    it('should execute a strategy successfully', async () => {
      const task = {
        id: 'test-task',
        query: 'Test query'
      };
      
      const result = await reasoningStrategyManager.executeStrategy('deductive', task);
      
      expect(result.result).to.be.an('object');
      expect(result.result.conclusion).to.include('Placeholder deductive reasoning result');
      expect(result.confidence).to.be.a('number');
      expect(result.metadata).to.be.an('object');
      
      // Check that statistics were updated
      const stats = reasoningStrategyManager.strategyStats.get('deductive');
      expect(stats.executionCount).to.equal(1);
      expect(stats.successCount).to.equal(1);
      expect(stats.totalExecutionTime).to.be.a('number');
      expect(stats.averageConfidence).to.be.a('number');
      
      expect(mockLogger.debug.calledWith(sinon.match('Executed reasoning strategy: deductive'))).to.be.true;
    });
    
    it('should handle strategy execution errors', async () => {
      // Override the execute method to throw an error
      const deductiveStrategy = reasoningStrategyManager.strategies.get('deductive');
      const originalExecute = deductiveStrategy.execute;
      deductiveStrategy.execute = () => { throw new Error('Test error'); };
      
      const task = {
        id: 'test-task',
        query: 'Test query'
      };
      
      try {
        await reasoningStrategyManager.executeStrategy('deductive', task);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
        
        // Check that failure statistics were updated
        const stats = reasoningStrategyManager.strategyStats.get('deductive');
        expect(stats.executionCount).to.equal(0); // Not incremented on failure
        expect(stats.failureCount).to.equal(1);
        
        expect(mockLogger.error.calledWith(sinon.match('Failed to execute reasoning strategy: Test error'))).to.be.true;
      }
      
      // Restore original method
      deductiveStrategy.execute = originalExecute;
    });
  });
  
  describe('getStatistics', () => {
    beforeEach(async () => {
      await reasoningStrategyManager.initialize();
      
      // Execute some strategies to generate statistics
      const task = {
        id: 'test-task',
        query: 'Test query'
      };
      
      await reasoningStrategyManager.executeStrategy('deductive', task);
      await reasoningStrategyManager.executeStrategy('inductive', task);
      
      // Simulate a failure
      const abductiveStrategy = reasoningStrategyManager.strategies.get('abductive');
      const originalExecute = abductiveStrategy.execute;
      abductiveStrategy.execute = () => { throw new Error('Test error'); };
      
      try {
        await reasoningStrategyManager.executeStrategy('abductive', task);
      } catch (error) {
        // Ignore error
      }
      
      // Restore original method
      abductiveStrategy.execute = originalExecute;
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningStrategyManager.initialized = false;
      
      try {
        await reasoningStrategyManager.getStatistics();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningStrategyManager is not initialized. Call initialize() first.');
      }
    });
    
    it('should return strategy statistics', async () => {
      const statistics = await reasoningStrategyManager.getStatistics();
      
      expect(statistics).to.be.an('object');
      expect(statistics.deductive).to.exist;
      expect(statistics.inductive).to.exist;
      expect(statistics.abductive).to.exist;
      
      expect(statistics.deductive.executionCount).to.equal(1);
      expect(statistics.deductive.successCount).to.equal(1);
      expect(statistics.deductive.averageExecutionTime).to.be.a('number');
      expect(statistics.deductive.successRate).to.equal(1);
      
      expect(statistics.inductive.executionCount).to.equal(1);
      expect(statistics.inductive.successCount).to.equal(1);
      
      expect(statistics.abductive.executionCount).to.equal(0);
      expect(statistics.abductive.failureCount).to.equal(1);
      expect(statistics.abductive.successRate).to.equal(0);
    });
  });
});
