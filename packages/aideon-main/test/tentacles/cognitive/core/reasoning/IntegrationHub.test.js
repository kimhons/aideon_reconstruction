/**
 * @fileoverview Unit tests for the Integration Hub.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { IntegrationHub } = require('../../../../../src/tentacles/cognitive/core/reasoning/IntegrationHub');

describe('IntegrationHub', () => {
  let integrationHub;
  let mockLogger;
  let mockConfigService;
  let mockPerformanceMonitor;
  let mockReasoningEngine;
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
      get: sinon.stub()
    };
    
    // Configure mockConfigService to return specific values
    mockConfigService.get.withArgs('reasoning.integrationHub.maxConcurrentRequests', 100).returns(50);
    mockConfigService.get.withArgs('reasoning.integrationHub.defaultRequestTimeout', 30000).returns(15000);
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub().returns(timerId),
      endTimer: sinon.spy()
    };
    
    mockReasoningEngine = {
      submitTask: sinon.stub().resolves('test-task-id'),
      getTaskStatus: sinon.stub().resolves({
        id: 'test-task-id',
        status: 'processing',
        result: null
      }),
      cancelTask: sinon.stub().resolves(true)
    };
    
    mockSecurityManager = {
      applyTentacleRegistrationPolicies: sinon.stub().resolves(),
      applyTentacleUnregistrationPolicies: sinon.stub().resolves(),
      applyContextUpdatePolicies: sinon.stub().resolves(),
      applyContextAccessPolicies: sinon.stub().resolves(),
      applyTaskSubmissionPolicies: sinon.stub().resolves(),
      applyTaskAccessPolicies: sinon.stub().resolves(),
      applyTaskCancelPolicies: sinon.stub().resolves()
    };
    
    // Create IntegrationHub instance
    integrationHub = new IntegrationHub({
      logger: mockLogger,
      configService: mockConfigService,
      performanceMonitor: mockPerformanceMonitor,
      reasoningEngine: mockReasoningEngine,
      securityManager: mockSecurityManager
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should throw an error if reasoningEngine is not provided', () => {
      expect(() => new IntegrationHub({
        logger: mockLogger,
        configService: mockConfigService,
        performanceMonitor: mockPerformanceMonitor
      })).to.throw('IntegrationHub requires a reasoningEngine instance');
    });
    
    it('should initialize with the provided dependencies', () => {
      expect(integrationHub.logger).to.equal(mockLogger);
      expect(integrationHub.configService).to.equal(mockConfigService);
      expect(integrationHub.performanceMonitor).to.equal(mockPerformanceMonitor);
      expect(integrationHub.reasoningEngine).to.equal(mockReasoningEngine);
      expect(integrationHub.securityManager).to.equal(mockSecurityManager);
      expect(integrationHub.initialized).to.be.false;
    });
  });
  
  describe('initialize', () => {
    it('should initialize with configuration values', async () => {
      await integrationHub.initialize();
      
      expect(mockConfigService.get.calledWith('reasoning.integrationHub.maxConcurrentRequests', 100)).to.be.true;
      expect(mockConfigService.get.calledWith('reasoning.integrationHub.defaultRequestTimeout', 30000)).to.be.true;
      expect(integrationHub.maxConcurrentRequests).to.equal(50);
      expect(integrationHub.defaultRequestTimeout).to.equal(15000);
      expect(integrationHub.initialized).to.be.true;
      expect(mockLogger.info.calledWith('IntegrationHub initialized successfully')).to.be.true;
    });
    
    it('should not reinitialize if already initialized', async () => {
      integrationHub.initialized = true;
      await integrationHub.initialize();
      
      expect(mockConfigService.get.called).to.be.false;
    });
    
    it('should handle initialization errors', async () => {
      mockConfigService.get.throws(new Error('Test error'));
      
      try {
        await integrationHub.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('IntegrationHub initialization failed');
        expect(mockLogger.error.calledOnce).to.be.true;
        expect(integrationHub.initialized).to.be.false;
      }
    });
  });
  
  describe('registerTentacle', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.registerTentacle('test-tentacle', { name: 'Test Tentacle' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacleId is not provided', async () => {
      try {
        await integrationHub.registerTentacle(null, { name: 'Test Tentacle' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle ID is required');
      }
    });
    
    it('should throw an error if tentacle name is not provided', async () => {
      try {
        await integrationHub.registerTentacle('test-tentacle', {});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle name is required');
      }
    });
    
    it('should register a tentacle successfully', async () => {
      const tentacleInfo = {
        name: 'Test Tentacle',
        version: '1.0.0',
        capabilities: ['test-capability']
      };
      
      const result = await integrationHub.registerTentacle('test-tentacle', tentacleInfo);
      
      expect(result).to.be.true;
      expect(integrationHub.registeredTentacles.has('test-tentacle')).to.be.true;
      
      const storedInfo = integrationHub.registeredTentacles.get('test-tentacle');
      expect(storedInfo.name).to.equal('Test Tentacle');
      expect(storedInfo.version).to.equal('1.0.0');
      expect(storedInfo.capabilities).to.deep.equal(['test-capability']);
      expect(storedInfo.registeredAt).to.be.a('number');
      expect(storedInfo.lastActiveAt).to.be.a('number');
      
      expect(integrationHub.tentacleRequests.has('test-tentacle')).to.be.true;
      expect(mockLogger.debug.calledWith(sinon.match('Registered tentacle: test-tentacle'))).to.be.true;
    });
    
    it('should apply security policies if available', async () => {
      const tentacleInfo = {
        name: 'Test Tentacle',
        version: '1.0.0',
        capabilities: ['test-capability']
      };
      
      await integrationHub.registerTentacle('test-tentacle', tentacleInfo);
      
      expect(mockSecurityManager.applyTentacleRegistrationPolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyTentacleRegistrationPolicies.firstCall.args[0]).to.equal('test-tentacle');
      expect(mockSecurityManager.applyTentacleRegistrationPolicies.firstCall.args[1]).to.deep.equal(tentacleInfo);
    });
  });
  
  describe('unregisterTentacle', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      await integrationHub.registerTentacle('test-tentacle', {
        name: 'Test Tentacle',
        version: '1.0.0',
        capabilities: ['test-capability']
      });
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.unregisterTentacle('test-tentacle');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      try {
        await integrationHub.unregisterTentacle('non-existent-tentacle');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle not registered: non-existent-tentacle');
      }
    });
    
    it('should unregister a tentacle successfully', async () => {
      const result = await integrationHub.unregisterTentacle('test-tentacle');
      
      expect(result).to.be.true;
      expect(integrationHub.registeredTentacles.has('test-tentacle')).to.be.false;
      expect(integrationHub.tentacleContexts.has('test-tentacle')).to.be.false;
      expect(integrationHub.tentacleRequests.has('test-tentacle')).to.be.false;
      
      expect(mockLogger.debug.calledWith(sinon.match('Unregistered tentacle: test-tentacle'))).to.be.true;
    });
    
    it('should apply security policies if available', async () => {
      await integrationHub.unregisterTentacle('test-tentacle');
      
      expect(mockSecurityManager.applyTentacleUnregistrationPolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyTentacleUnregistrationPolicies.firstCall.args[0]).to.equal('test-tentacle');
    });
  });
  
  describe('updateTentacleContext', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      await integrationHub.registerTentacle('test-tentacle', {
        name: 'Test Tentacle',
        version: '1.0.0',
        capabilities: ['test-capability']
      });
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.updateTentacleContext('test-tentacle', { test: 'context' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      try {
        await integrationHub.updateTentacleContext('non-existent-tentacle', { test: 'context' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle not registered: non-existent-tentacle');
      }
    });
    
    it('should update context data with merge by default', async () => {
      // Set initial context
      await integrationHub.updateTentacleContext('test-tentacle', { key1: 'value1' });
      
      // Update with new context
      const result = await integrationHub.updateTentacleContext('test-tentacle', { key2: 'value2' });
      
      expect(result).to.be.true;
      
      const context = integrationHub.tentacleContexts.get('test-tentacle');
      expect(context.key1).to.equal('value1');
      expect(context.key2).to.equal('value2');
      expect(context.updatedAt).to.be.a('number');
      
      // Check that lastActiveAt was updated
      const tentacleInfo = integrationHub.registeredTentacles.get('test-tentacle');
      expect(tentacleInfo.lastActiveAt).to.be.a('number');
      
      expect(mockLogger.debug.calledWith(sinon.match('Updated context for tentacle: test-tentacle'))).to.be.true;
    });
    
    it('should replace context data when merge is false', async () => {
      // Set initial context
      await integrationHub.updateTentacleContext('test-tentacle', { key1: 'value1' });
      
      // Replace with new context
      const result = await integrationHub.updateTentacleContext('test-tentacle', { key2: 'value2' }, false);
      
      expect(result).to.be.true;
      
      const context = integrationHub.tentacleContexts.get('test-tentacle');
      expect(context.key1).to.be.undefined;
      expect(context.key2).to.equal('value2');
    });
    
    it('should apply security policies if available', async () => {
      const contextData = { key1: 'value1' };
      await integrationHub.updateTentacleContext('test-tentacle', contextData);
      
      expect(mockSecurityManager.applyContextUpdatePolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyContextUpdatePolicies.firstCall.args[0]).to.equal('test-tentacle');
      expect(mockSecurityManager.applyContextUpdatePolicies.firstCall.args[1]).to.deep.equal(contextData);
    });
  });
  
  describe('getTentacleContext', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      await integrationHub.registerTentacle('test-tentacle', {
        name: 'Test Tentacle',
        version: '1.0.0',
        capabilities: ['test-capability']
      });
      await integrationHub.updateTentacleContext('test-tentacle', { key1: 'value1' });
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.getTentacleContext('test-tentacle');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      try {
        await integrationHub.getTentacleContext('non-existent-tentacle');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle not registered: non-existent-tentacle');
      }
    });
    
    it('should return context data', async () => {
      const context = await integrationHub.getTentacleContext('test-tentacle');
      
      expect(context.key1).to.equal('value1');
      expect(context.updatedAt).to.be.a('number');
    });
    
    it('should return empty object if no context exists', async () => {
      // Register a new tentacle without setting context
      await integrationHub.registerTentacle('new-tentacle', {
        name: 'New Tentacle',
        version: '1.0.0'
      });
      
      const context = await integrationHub.getTentacleContext('new-tentacle');
      
      expect(context).to.deep.equal({});
    });
    
    it('should apply security policies if available', async () => {
      await integrationHub.getTentacleContext('test-tentacle');
      
      expect(mockSecurityManager.applyContextAccessPolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyContextAccessPolicies.firstCall.args[0]).to.equal('test-tentacle');
    });
  });
  
  describe('submitTask', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      await integrationHub.registerTentacle('test-tentacle', {
        name: 'Test Tentacle',
        version: '1.0.0',
        capabilities: ['test-capability']
      });
      await integrationHub.updateTentacleContext('test-tentacle', { contextKey: 'contextValue' });
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.submitTask('test-tentacle', { query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      try {
        await integrationHub.submitTask('non-existent-tentacle', { query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle not registered: non-existent-tentacle');
      }
    });
    
    it('should throw an error if maximum concurrent requests is exceeded', async () => {
      // Set maxConcurrentRequests to 0 to force error
      integrationHub.maxConcurrentRequests = 0;
      
      try {
        await integrationHub.submitTask('test-tentacle', { query: 'Test query' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Maximum concurrent requests exceeded for tentacle: test-tentacle');
      }
    });
    
    it('should submit task to reasoning engine with enhanced context', async () => {
      const taskData = {
        query: 'Test query',
        context: { taskKey: 'taskValue' },
        preferredStrategies: ['deductive'],
        constraints: { timeLimit: 1000 },
        metadata: { source: 'test' },
        priority: 8
      };
      
      const taskId = await integrationHub.submitTask('test-tentacle', taskData);
      
      expect(taskId).to.equal('test-task-id');
      expect(mockReasoningEngine.submitTask.calledOnce).to.be.true;
      
      const submittedTaskData = mockReasoningEngine.submitTask.firstCall.args[0];
      expect(submittedTaskData.query).to.equal('Test query');
      expect(submittedTaskData.context.taskKey).to.equal('taskValue');
      expect(submittedTaskData.context.contextKey).to.equal('contextValue');
      expect(submittedTaskData.context._tentacleContext).to.be.true;
      expect(submittedTaskData.preferredStrategies).to.deep.equal(['deductive']);
      expect(submittedTaskData.constraints).to.deep.equal({ timeLimit: 1000 });
      expect(submittedTaskData.metadata.source).to.equal('test');
      expect(submittedTaskData.metadata.tentacleId).to.equal('test-tentacle');
      expect(submittedTaskData.metadata.tentacleName).to.equal('Test Tentacle');
      expect(submittedTaskData.tentacleId).to.equal('test-tentacle');
      
      // Check that task is tracked
      const tentacleRequests = integrationHub.tentacleRequests.get('test-tentacle');
      expect(tentacleRequests.has('test-task-id')).to.be.true;
      
      // Check that lastActiveAt was updated
      const tentacleInfo = integrationHub.registeredTentacles.get('test-tentacle');
      expect(tentacleInfo.lastActiveAt).to.be.a('number');
      
      expect(mockLogger.debug.calledWith(sinon.match('Submitted task from tentacle: test-tentacle'))).to.be.true;
    });
    
    it('should apply security policies if available', async () => {
      const taskData = { query: 'Test query' };
      await integrationHub.submitTask('test-tentacle', taskData);
      
      expect(mockSecurityManager.applyTaskSubmissionPolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyTaskSubmissionPolicies.firstCall.args[0]).to.equal('test-tentacle');
      expect(mockSecurityManager.applyTaskSubmissionPolicies.firstCall.args[1]).to.deep.equal(taskData);
    });
  });
  
  describe('getTaskStatus', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      await integrationHub.registerTentacle('test-tentacle', {
        name: 'Test Tentacle',
        version: '1.0.0'
      });
      
      // Add a task to the tentacle's requests
      const tentacleRequests = integrationHub.tentacleRequests.get('test-tentacle');
      tentacleRequests.add('test-task-id');
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.getTaskStatus('test-tentacle', 'test-task-id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      try {
        await integrationHub.getTaskStatus('non-existent-tentacle', 'test-task-id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle not registered: non-existent-tentacle');
      }
    });
    
    it('should throw an error if task is not found for tentacle', async () => {
      try {
        await integrationHub.getTaskStatus('test-tentacle', 'non-existent-task');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Task not found for tentacle: non-existent-task');
      }
    });
    
    it('should get task status from reasoning engine', async () => {
      const status = await integrationHub.getTaskStatus('test-tentacle', 'test-task-id');
      
      expect(status.id).to.equal('test-task-id');
      expect(status.status).to.equal('processing');
      expect(mockReasoningEngine.getTaskStatus.calledOnce).to.be.true;
      expect(mockReasoningEngine.getTaskStatus.firstCall.args[0]).to.equal('test-task-id');
      
      // Check that lastActiveAt was updated
      const tentacleInfo = integrationHub.registeredTentacles.get('test-tentacle');
      expect(tentacleInfo.lastActiveAt).to.be.a('number');
    });
    
    it('should clean up completed tasks', async () => {
      // Mock a completed task
      mockReasoningEngine.getTaskStatus.resolves({
        id: 'test-task-id',
        status: 'completed',
        result: { conclusion: 'Test conclusion' }
      });
      
      await integrationHub.getTaskStatus('test-tentacle', 'test-task-id');
      
      // Check that task was removed from tracking
      const tentacleRequests = integrationHub.tentacleRequests.get('test-tentacle');
      expect(tentacleRequests.has('test-task-id')).to.be.false;
    });
    
    it('should apply security policies if available', async () => {
      await integrationHub.getTaskStatus('test-tentacle', 'test-task-id');
      
      expect(mockSecurityManager.applyTaskAccessPolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyTaskAccessPolicies.firstCall.args[0]).to.equal('test-tentacle');
      expect(mockSecurityManager.applyTaskAccessPolicies.firstCall.args[1]).to.equal('test-task-id');
    });
  });
  
  describe('cancelTask', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      await integrationHub.registerTentacle('test-tentacle', {
        name: 'Test Tentacle',
        version: '1.0.0'
      });
      
      // Add a task to the tentacle's requests
      const tentacleRequests = integrationHub.tentacleRequests.get('test-tentacle');
      tentacleRequests.add('test-task-id');
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.cancelTask('test-tentacle', 'test-task-id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      try {
        await integrationHub.cancelTask('non-existent-tentacle', 'test-task-id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Tentacle not registered: non-existent-tentacle');
      }
    });
    
    it('should throw an error if task is not found for tentacle', async () => {
      try {
        await integrationHub.cancelTask('test-tentacle', 'non-existent-task');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Task not found for tentacle: non-existent-task');
      }
    });
    
    it('should cancel task in reasoning engine', async () => {
      const result = await integrationHub.cancelTask('test-tentacle', 'test-task-id');
      
      expect(result).to.be.true;
      expect(mockReasoningEngine.cancelTask.calledOnce).to.be.true;
      expect(mockReasoningEngine.cancelTask.firstCall.args[0]).to.equal('test-task-id');
      
      // Check that task was removed from tracking
      const tentacleRequests = integrationHub.tentacleRequests.get('test-tentacle');
      expect(tentacleRequests.has('test-task-id')).to.be.false;
      
      // Check that lastActiveAt was updated
      const tentacleInfo = integrationHub.registeredTentacles.get('test-tentacle');
      expect(tentacleInfo.lastActiveAt).to.be.a('number');
      
      expect(mockLogger.debug.calledWith(sinon.match('Canceled task for tentacle: test-tentacle'))).to.be.true;
    });
    
    it('should not remove task from tracking if cancellation fails', async () => {
      mockReasoningEngine.cancelTask.resolves(false);
      
      const result = await integrationHub.cancelTask('test-tentacle', 'test-task-id');
      
      expect(result).to.be.false;
      
      // Check that task is still tracked
      const tentacleRequests = integrationHub.tentacleRequests.get('test-tentacle');
      expect(tentacleRequests.has('test-task-id')).to.be.true;
    });
    
    it('should apply security policies if available', async () => {
      await integrationHub.cancelTask('test-tentacle', 'test-task-id');
      
      expect(mockSecurityManager.applyTaskCancelPolicies.calledOnce).to.be.true;
      expect(mockSecurityManager.applyTaskCancelPolicies.firstCall.args[0]).to.equal('test-tentacle');
      expect(mockSecurityManager.applyTaskCancelPolicies.firstCall.args[1]).to.equal('test-task-id');
    });
  });
  
  describe('getStatistics', () => {
    beforeEach(async () => {
      await integrationHub.initialize();
      
      // Register some tentacles
      await integrationHub.registerTentacle('tentacle1', {
        name: 'Tentacle 1',
        version: '1.0.0'
      });
      
      await integrationHub.registerTentacle('tentacle2', {
        name: 'Tentacle 2',
        version: '1.0.0'
      });
      
      // Add some tasks
      const tentacle1Requests = integrationHub.tentacleRequests.get('tentacle1');
      tentacle1Requests.add('task1');
      tentacle1Requests.add('task2');
      
      const tentacle2Requests = integrationHub.tentacleRequests.get('tentacle2');
      tentacle2Requests.add('task3');
      
      // Set one tentacle to be inactive (last active more than an hour ago)
      const tentacle2Info = integrationHub.registeredTentacles.get('tentacle2');
      tentacle2Info.lastActiveAt = Date.now() - (61 * 60 * 1000); // 61 minutes ago
    });
    
    it('should throw an error if not initialized', async () => {
      integrationHub.initialized = false;
      
      try {
        await integrationHub.getStatistics();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('IntegrationHub is not initialized. Call initialize() first.');
      }
    });
    
    it('should return hub statistics', async () => {
      const stats = await integrationHub.getStatistics();
      
      expect(stats.registeredTentacles).to.equal(2);
      expect(stats.activeTentacles).to.equal(1); // Only tentacle1 is active
      expect(stats.activeRequests).to.equal(3); // 2 from tentacle1, 1 from tentacle2
      expect(stats.maxConcurrentRequests).to.equal(50);
      expect(stats.defaultRequestTimeout).to.equal(15000);
    });
  });
});
