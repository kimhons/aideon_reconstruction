/**
 * @fileoverview Unit tests for the Reasoning Engine.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { ReasoningEngine } = require('../../../../../src/tentacles/cognitive/core/reasoning/ReasoningEngine');
const { ReasoningStrategyManager } = require('../../../../../src/tentacles/cognitive/core/reasoning/ReasoningStrategyManager');
const { IntegrationHub } = require('../../../../../src/tentacles/cognitive/core/reasoning/IntegrationHub');
const { ReasoningTaskStatus } = require('../../../../../src/tentacles/cognitive/core/reasoning/ReasoningTaskStatus');

describe('ReasoningEngine', () => {
  let reasoningEngine;
  let mockLogger;
  let mockConfigService;
  let mockPerformanceMonitor;
  let mockKnowledgeGraphManager;
  let mockReasoningStrategyManager;
  let mockIntegrationHub;
  let mockSecurityManager;
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
    
    mockReasoningStrategyManager = {
      initialize: sinon.stub().resolves(),
      selectStrategy: sinon.stub().resolves({
        strategyName: 'deductive',
        confidence: 0.8,
        reason: 'Test reason'
      }),
      executeStrategy: sinon.stub().resolves({
        result: { conclusion: 'Test conclusion' },
        confidence: 0.8,
        metadata: { strategyName: 'deductive' }
      })
    };
    
    mockIntegrationHub = {
      initialize: sinon.stub().resolves()
    };
    
    mockSecurityManager = {
      applyTaskSecurityPolicies: sinon.stub().resolves(),
      applyTaskAccessPolicies: sinon.stub().resolves(),
      applyTaskCancelPolicies: sinon.stub().resolves()
    };
    
    // Create ReasoningEngine instance
    reasoningEngine = new ReasoningEngine({
      logger: mockLogger,
      configService: mockConfigService,
      performanceMonitor: mockPerformanceMonitor,
      knowledgeGraphManager: mockKnowledgeGraphManager,
      reasoningStrategyManager: mockReasoningStrategyManager,
      integrationHub: mockIntegrationHub,
      securityManager: mockSecurityManager
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should throw an error if knowledgeGraphManager is not provided', () => {
      expect(() => new ReasoningEngine({
        logger: mockLogger,
        configService: mockConfigService,
        performanceMonitor: mockPerformanceMonitor
      })).to.throw('ReasoningEngine requires a knowledgeGraphManager instance');
    });
    
    it('should initialize with default components if not provided', () => {
      const engine = new ReasoningEngine({
        logger: mockLogger,
        configService: mockConfigService,
        performanceMonitor: mockPerformanceMonitor,
        knowledgeGraphManager: mockKnowledgeGraphManager
      });
      
      expect(engine.reasoningStrategyManager).to.be.an.instanceOf(ReasoningStrategyManager);
      expect(engine.integrationHub).to.be.an.instanceOf(IntegrationHub);
      expect(engine.initialized).to.be.false;
    });
  });
  
  describe('initialize', () => {
    it('should initialize all components', async () => {
      await reasoningEngine.initialize();
      
      expect(mockReasoningStrategyManager.initialize.calledOnce).to.be.true;
      expect(mockIntegrationHub.initialize.calledOnce).to.be.true;
      expect(mockLogger.info.calledWith('ReasoningEngine initialized successfully')).to.be.true;
      expect(reasoningEngine.initialized).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      reasoningEngine.initialized = true;
      await reasoningEngine.initialize();
      
      expect(mockReasoningStrategyManager.initialize.called).to.be.false;
      expect(mockIntegrationHub.initialize.called).to.be.false;
    });
    
    it('should handle initialization errors', async () => {
      mockReasoningStrategyManager.initialize.rejects(new Error('Test error'));
      
      try {
        await reasoningEngine.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('ReasoningEngine initialization failed');
        expect(mockLogger.error.calledOnce).to.be.true;
        expect(reasoningEngine.initialized).to.be.false;
      }
    });
  });
  
  describe('submitTask', () => {
    beforeEach(async () => {
      await reasoningEngine.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningEngine.initialized = false;
      
      try {
        await reasoningEngine.submitTask({ query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningEngine is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if query is not provided', async () => {
      try {
        await reasoningEngine.submitTask({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Task query is required');
      }
    });
    
    it('should create a task and add it to the queue', async () => {
      const taskId = await reasoningEngine.submitTask({
        query: 'Test query',
        context: { test: 'context' },
        preferredStrategies: ['deductive'],
        constraints: { test: 'constraint' },
        metadata: { test: 'metadata' },
        priority: 8,
        tentacleId: 'test-tentacle'
      });
      
      expect(taskId).to.be.a('string');
      expect(reasoningEngine.tasks.has(taskId)).to.be.true;
      
      const task = reasoningEngine.tasks.get(taskId);
      expect(task.query).to.equal('Test query');
      expect(task.context).to.deep.equal({ test: 'context' });
      expect(task.preferredStrategies).to.deep.equal(['deductive']);
      expect(task.constraints).to.deep.equal({ test: 'constraint' });
      expect(task.metadata.test).to.equal('metadata');
      expect(task.metadata.priority).to.equal(8);
      expect(task.metadata.tentacleId).to.equal('test-tentacle');
      expect(task.status).to.equal(ReasoningTaskStatus.PENDING);
      
      expect(reasoningEngine.taskQueue).to.include(taskId);
      expect(mockLogger.debug.calledWith(sinon.match(`Submitted reasoning task: ${taskId}`))).to.be.true;
    });
    
    it('should apply security policies if available', async () => {
      const taskId = await reasoningEngine.submitTask({
        query: 'Test query'
      });
      
      expect(mockSecurityManager.applyTaskSecurityPolicies.calledOnce).to.be.true;
      const task = reasoningEngine.tasks.get(taskId);
      expect(mockSecurityManager.applyTaskSecurityPolicies.firstCall.args[0]).to.deep.equal(task);
    });
  });
  
  describe('getTaskStatus', () => {
    let taskId;
    
    beforeEach(async () => {
      await reasoningEngine.initialize();
      taskId = await reasoningEngine.submitTask({ query: 'Test query' });
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningEngine.initialized = false;
      
      try {
        await reasoningEngine.getTaskStatus(taskId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningEngine is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if task is not found', async () => {
      try {
        await reasoningEngine.getTaskStatus('non-existent-task');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Task not found: non-existent-task');
      }
    });
    
    it('should return task status and result', async () => {
      const status = await reasoningEngine.getTaskStatus(taskId);
      
      expect(status.id).to.equal(taskId);
      expect(status.status).to.equal(ReasoningTaskStatus.PENDING);
      expect(status.result).to.be.null;
      expect(status.explanation).to.be.null;
      expect(status.confidence).to.be.null;
      expect(status.error).to.be.null;
      expect(status.metadata).to.be.an('object');
      
      expect(mockLogger.debug.calledWith(sinon.match(`Retrieved task status: ${taskId}`))).to.be.true;
    });
    
    it('should apply security policies if available', async () => {
      await reasoningEngine.getTaskStatus(taskId);
      
      expect(mockSecurityManager.applyTaskAccessPolicies.calledOnce).to.be.true;
      const task = reasoningEngine.tasks.get(taskId);
      expect(mockSecurityManager.applyTaskAccessPolicies.firstCall.args[0]).to.deep.equal(task);
    });
  });
  
  describe('cancelTask', () => {
    let taskId;
    
    beforeEach(async () => {
      await reasoningEngine.initialize();
      taskId = await reasoningEngine.submitTask({ query: 'Test query' });
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningEngine.initialized = false;
      
      try {
        await reasoningEngine.cancelTask(taskId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningEngine is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if task is not found', async () => {
      try {
        await reasoningEngine.cancelTask('non-existent-task');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Task not found: non-existent-task');
      }
    });
    
    it('should cancel a pending task', async () => {
      const result = await reasoningEngine.cancelTask(taskId);
      
      expect(result).to.be.true;
      
      const task = reasoningEngine.tasks.get(taskId);
      expect(task.status).to.equal(ReasoningTaskStatus.CANCELED);
      expect(task.metadata.canceledAt).to.be.a('number');
      
      expect(reasoningEngine.taskQueue).to.not.include(taskId);
      expect(mockLogger.debug.calledWith(sinon.match(`Canceled reasoning task: ${taskId}`))).to.be.true;
    });
    
    it('should return false if task is already completed', async () => {
      const task = reasoningEngine.tasks.get(taskId);
      task.status = ReasoningTaskStatus.COMPLETED;
      
      const result = await reasoningEngine.cancelTask(taskId);
      
      expect(result).to.be.false;
    });
    
    it('should apply security policies if available', async () => {
      await reasoningEngine.cancelTask(taskId);
      
      expect(mockSecurityManager.applyTaskCancelPolicies.calledOnce).to.be.true;
      const task = reasoningEngine.tasks.get(taskId);
      expect(mockSecurityManager.applyTaskCancelPolicies.firstCall.args[0]).to.deep.equal(task);
    });
  });
  
  describe('_processNextTask', () => {
    let taskId;
    
    beforeEach(async () => {
      await reasoningEngine.initialize();
      taskId = await reasoningEngine.submitTask({ query: 'Test query' });
      
      // Clear the queue since submitTask triggers _processNextTask
      reasoningEngine.taskQueue = [taskId];
    });
    
    it('should process the next task in the queue', async () => {
      await reasoningEngine._processNextTask();
      
      expect(reasoningEngine.taskQueue).to.be.empty;
      
      const task = reasoningEngine.tasks.get(taskId);
      expect(task.status).to.equal(ReasoningTaskStatus.COMPLETED);
      expect(task.result).to.deep.equal({ conclusion: 'Test conclusion' });
      expect(task.confidence).to.equal(0.8);
      expect(task.metadata.completedAt).to.be.a('number');
      
      expect(mockReasoningStrategyManager.selectStrategy.calledOnce).to.be.true;
      expect(mockReasoningStrategyManager.executeStrategy.calledOnce).to.be.true;
      expect(mockReasoningStrategyManager.executeStrategy.firstCall.args[0]).to.equal('deductive');
    });
    
    it('should handle task processing errors', async () => {
      mockReasoningStrategyManager.executeStrategy.rejects(new Error('Test error'));
      
      await reasoningEngine._processNextTask();
      
      const task = reasoningEngine.tasks.get(taskId);
      expect(task.status).to.equal(ReasoningTaskStatus.FAILED);
      expect(task.error.message).to.equal('Test error');
      expect(task.metadata.failedAt).to.be.a('number');
      
      expect(mockLogger.error.calledWith(sinon.match('Failed to process reasoning task: Test error'))).to.be.true;
    });
  });
  
  describe('cleanupTasks', () => {
    beforeEach(async () => {
      await reasoningEngine.initialize();
      
      // Create some completed tasks
      const taskId1 = await reasoningEngine.submitTask({ query: 'Test query 1' });
      const taskId2 = await reasoningEngine.submitTask({ query: 'Test query 2' });
      const taskId3 = await reasoningEngine.submitTask({ query: 'Test query 3' });
      
      const task1 = reasoningEngine.tasks.get(taskId1);
      task1.status = ReasoningTaskStatus.COMPLETED;
      task1.metadata.completedAt = Date.now() - 2000; // 2 seconds ago
      
      const task2 = reasoningEngine.tasks.get(taskId2);
      task2.status = ReasoningTaskStatus.FAILED;
      task2.metadata.failedAt = Date.now() - 3000; // 3 seconds ago
      
      const task3 = reasoningEngine.tasks.get(taskId3);
      task3.status = ReasoningTaskStatus.CANCELED;
      task3.metadata.canceledAt = Date.now() - 4000; // 4 seconds ago
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningEngine.initialized = false;
      
      try {
        await reasoningEngine.cleanupTasks(1000);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningEngine is not initialized. Call initialize() first.');
      }
    });
    
    it('should clean up tasks older than the specified age', async () => {
      const count = await reasoningEngine.cleanupTasks(2500); // 2.5 seconds
      
      expect(count).to.equal(2); // Should clean up 2 tasks (the 3s and 4s old ones)
      expect(reasoningEngine.tasks.size).to.equal(1); // Should have 1 task left
      
      expect(mockLogger.debug.calledWith(sinon.match('Cleaned up 2 old reasoning tasks'))).to.be.true;
    });
    
    it('should not clean up tasks that are not completed, failed, or canceled', async () => {
      // Set all tasks to pending
      for (const task of reasoningEngine.tasks.values()) {
        task.status = ReasoningTaskStatus.PENDING;
      }
      
      const count = await reasoningEngine.cleanupTasks(10000);
      
      expect(count).to.equal(0);
      expect(reasoningEngine.tasks.size).to.equal(3);
    });
  });
  
  describe('getStatistics', () => {
    beforeEach(async () => {
      await reasoningEngine.initialize();
      
      // Create some tasks with different statuses
      const taskId1 = await reasoningEngine.submitTask({ query: 'Test query 1' });
      const taskId2 = await reasoningEngine.submitTask({ query: 'Test query 2' });
      const taskId3 = await reasoningEngine.submitTask({ query: 'Test query 3' });
      
      const task1 = reasoningEngine.tasks.get(taskId1);
      task1.status = ReasoningTaskStatus.COMPLETED;
      
      const task2 = reasoningEngine.tasks.get(taskId2);
      task2.status = ReasoningTaskStatus.FAILED;
      
      const task3 = reasoningEngine.tasks.get(taskId3);
      task3.status = ReasoningTaskStatus.PROCESSING;
      
      // Mock strategy statistics
      mockReasoningStrategyManager.getStatistics = sinon.stub().resolves({
        deductive: { executionCount: 10, successCount: 8 },
        inductive: { executionCount: 5, successCount: 4 }
      });
    });
    
    it('should throw an error if not initialized', async () => {
      reasoningEngine.initialized = false;
      
      try {
        await reasoningEngine.getStatistics();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('ReasoningEngine is not initialized. Call initialize() first.');
      }
    });
    
    it('should return engine statistics', async () => {
      const stats = await reasoningEngine.getStatistics();
      
      expect(stats.totalTasks).to.equal(3);
      expect(stats.queuedTasks).to.equal(0);
      expect(stats.tasksByStatus).to.deep.equal({
        completed: 1,
        failed: 1,
        processing: 1
      });
      expect(stats.strategies).to.deep.equal({
        deductive: { executionCount: 10, successCount: 8 },
        inductive: { executionCount: 5, successCount: 4 }
      });
    });
  });
});
