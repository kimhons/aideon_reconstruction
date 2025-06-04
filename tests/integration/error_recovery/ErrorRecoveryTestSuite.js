/**
 * ErrorRecoveryTestSuite.js - Full Version with Corrected Imports
 * 
 * Comprehensive test suite for the Autonomous Error Recovery System.
 * Includes unit tests, integration tests, and end-to-end tests.
 */

const assert = require('assert');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');
const path = require('path');

// Use absolute paths for imports
const foundationPath = path.resolve(__dirname, '../../../src/core/error_recovery/foundation');
const integrationPath = path.resolve(__dirname, '../../../src/core/error_recovery/integration');
const corePath = path.resolve(__dirname, '../../../src/core/error_recovery');

// Import foundation components
const DependencyContainer = require(path.join(foundationPath, 'DependencyContainer'));
const EventBus = require(path.join(foundationPath, 'EventBus'));
const ContextManager = require(path.join(foundationPath, 'ContextManager'));
const EnhancedNeuralCoordinationHub = require(path.join(foundationPath, 'EnhancedNeuralCoordinationHub'));

// Import integration components
const MetricsCollector = require(path.join(integrationPath, 'MetricsCollector'));
const { AutonomousRecoveryOrchestrator, CircuitBreaker } = require(path.join(integrationPath, 'AutonomousRecoveryOrchestrator'));
const EnhancedIntegrationValidationRunner = require(path.join(integrationPath, 'EnhancedIntegrationValidationRunner'));

// Import original components (mock these for testing)
const CausalAnalyzer = { analyzeError: sinon.stub().resolves({}) };
const RecoveryStrategyGenerator = { generateStrategy: sinon.stub().resolves({}) };
const ResolutionExecutor = { executeStrategy: sinon.stub().resolves({}) };
const RecoveryLearningSystem = { 
  recordSuccess: sinon.stub().resolves(),
  recordFailure: sinon.stub().resolves()
};

// Test utilities
const TestUtils = {
  createMockError() {
    return new Error('Test error');
  },
  
  createMockContext() {
    return {
      error: this.createMockError(),
      source: 'test',
      timestamp: Date.now(),
      recoveryAttempts: 0
    };
  },
  
  createMockCause() {
    return {
      id: 'cause-123',
      errorType: 'TestError',
      rootCause: 'Test root cause',
      confidence: 0.95,
      affectedComponents: ['componentA', 'componentB'],
      metadata: {
        source: 'test',
        timestamp: Date.now()
      }
    };
  },
  
  createMockStrategy() {
    return {
      id: 'strategy-123',
      name: 'Test Strategy',
      description: 'A test strategy',
      confidence: 0.9,
      actions: [
        {
          id: 'action-1',
          type: 'restart',
          target: 'componentA',
          parameters: {}
        },
        {
          id: 'action-2',
          type: 'reconfigure',
          target: 'componentB',
          parameters: {
            setting: 'value'
          }
        }
      ],
      metadata: {
        source: 'test',
        timestamp: Date.now()
      }
    };
  },
  
  createMockExecutionResult(successful = true) {
    return {
      successful,
      actions: [
        {
          id: 'action-1',
          successful: true,
          message: 'Action 1 executed successfully'
        },
        {
          id: 'action-2',
          successful: successful,
          message: successful ? 'Action 2 executed successfully' : 'Action 2 failed'
        }
      ],
      metadata: {
        duration: 100,
        timestamp: Date.now()
      }
    };
  },
  
  createTestContainer() {
    const container = new DependencyContainer();
    const eventBus = new EventBus();
    const contextManager = new ContextManager({ eventBus });
    const metrics = new MetricsCollector({ eventBus });
    
    // Mock dependencies
    const mockAnalyzer = {
      analyzeError: sinon.stub().resolves(this.createMockCause())
    };
    
    const mockStrategyGenerator = {
      generateStrategy: sinon.stub().resolves(this.createMockStrategy())
    };
    
    const mockValidationRunner = {
      validateStrategy: sinon.stub().resolves(true)
    };
    
    const mockResolutionExecutor = {
      executeStrategy: sinon.stub().resolves(this.createMockExecutionResult())
    };
    
    const mockLearningSystem = {
      recordSuccess: sinon.stub().resolves(),
      recordFailure: sinon.stub().resolves()
    };
    
    const mockNeuralHub = {
      propagateContext: sinon.stub().resolves(),
      registerComponent: sinon.stub().resolves(),
      on: sinon.stub(),
      emit: sinon.stub()
    };
    
    // Register components
    container.register('eventBus', () => eventBus);
    container.register('contextManager', () => contextManager);
    container.register('metrics', () => metrics);
    container.register('causalAnalyzer', () => mockAnalyzer);
    container.register('recoveryStrategyGenerator', () => mockStrategyGenerator);
    container.register('integrationValidationRunner', () => mockValidationRunner);
    container.register('resolutionExecutor', () => mockResolutionExecutor);
    container.register('recoveryLearningSystem', () => mockLearningSystem);
    container.register('neuralCoordinationHub', () => mockNeuralHub);
    
    return {
      container,
      eventBus,
      contextManager,
      metrics,
      mockAnalyzer,
      mockStrategyGenerator,
      mockValidationRunner,
      mockResolutionExecutor,
      mockLearningSystem,
      mockNeuralHub
    };
  },
  
  async createTestOrchestrator() {
    const {
      container,
      eventBus,
      contextManager,
      metrics,
      mockAnalyzer,
      mockStrategyGenerator,
      mockValidationRunner,
      mockResolutionExecutor,
      mockLearningSystem,
      mockNeuralHub
    } = this.createTestContainer();
    
    const orchestrator = new AutonomousRecoveryOrchestrator({
      container,
      eventBus,
      contextManager,
      metrics,
      logger: console
    });
    
    await orchestrator.initialize();
    
    return {
      orchestrator,
      container,
      eventBus,
      contextManager,
      metrics,
      mockAnalyzer,
      mockStrategyGenerator,
      mockValidationRunner,
      mockResolutionExecutor,
      mockLearningSystem,
      mockNeuralHub
    };
  }
};

// Unit Tests
describe('Autonomous Error Recovery System - Unit Tests', () => {
  describe('DependencyContainer', () => {
    it('should register and resolve dependencies', async () => {
      console.log('Starting DependencyContainer test');
      const container = new DependencyContainer();
      
      container.register('testDep', () => ({ value: 'test' }));
      
      const dep = await container.resolve('testDep');
      
      assert.deepStrictEqual(dep, { value: 'test' });
      console.log('DependencyContainer test completed successfully');
    });
    
    it('should handle singleton dependencies', async () => {
      const container = new DependencyContainer();
      
      container.register('testDep', () => ({ value: Math.random() }), { singleton: true });
      
      const dep1 = await container.resolve('testDep');
      const dep2 = await container.resolve('testDep');
      
      assert.strictEqual(dep1, dep2);
    });
    
    it('should detect circular dependencies', async () => {
      const container = new DependencyContainer();
      
      container.register('depA', async (c) => {
        return { depB: await c.resolve('depB') };
      });
      
      container.register('depB', async (c) => {
        return { depA: await c.resolve('depA') };
      });
      
      try {
        await container.resolve('depA');
        assert.fail('Should have thrown circular dependency error');
      } catch (error) {
        assert(error.message.includes('Circular dependency'));
      }
    });
  });
  
  describe('EventBus', () => {
    it('should emit and receive events', () => {
      console.log('Starting EventBus test');
      const eventBus = new EventBus();
      const handler = sinon.spy();
      
      eventBus.on('test', handler);
      eventBus.emit('test', { value: 'test' });
      
      assert(handler.calledOnce);
      assert(handler.calledWith({ value: 'test' }));
      console.log('EventBus test completed successfully');
    });
    
    it('should handle once events', () => {
      const eventBus = new EventBus();
      const handler = sinon.spy();
      
      eventBus.once('test', handler);
      eventBus.emit('test', { value: 'test1' });
      eventBus.emit('test', { value: 'test2' });
      
      assert(handler.calledOnce);
      assert(handler.calledWith({ value: 'test1' }));
    });
    
    it('should remove event listeners', () => {
      const eventBus = new EventBus();
      const handler = sinon.spy();
      
      eventBus.on('test', handler);
      eventBus.off('test', handler);
      eventBus.emit('test', { value: 'test' });
      
      assert(handler.notCalled);
    });
  });
  
  describe('ContextManager', () => {
    it('should create and retrieve contexts', () => {
      const eventBus = new EventBus();
      // Initialize with includeMetadata: false for test compatibility
      const contextManager = new ContextManager({ eventBus, includeMetadata: false });
      
      const contextData = { value: 'test' };
      const contextId = contextManager.createContext(contextData, 'test');
      
      const context = contextManager.getContext(contextId);
      
      assert.deepStrictEqual(context, contextData);
    });
    
    it('should update contexts', () => {
      const eventBus = new EventBus();
      // Initialize with includeMetadata: false for test compatibility
      const contextManager = new ContextManager({ eventBus, includeMetadata: false });
      
      const contextData = { value: 'test' };
      const contextId = contextManager.createContext(contextData, 'test');
      
      contextManager.updateContext(contextId, { newValue: 'updated' }, 'test');
      
      const context = contextManager.getContext(contextId);
      
      assert.deepStrictEqual(context, { value: 'test', newValue: 'updated' });
    });
    
    it('should track context history', () => {
      const eventBus = new EventBus();
      const contextManager = new ContextManager({ eventBus });
      
      const contextData = { value: 'test' };
      const contextId = contextManager.createContext(contextData, 'test');
      
      contextManager.updateContext(contextId, { value: 'updated' }, 'test');
      
      const history = contextManager.getContextHistory(contextId);
      
      assert.strictEqual(history.length, 2);
      assert.deepStrictEqual(history[0].data, { value: 'test' });
      assert.deepStrictEqual(history[1].data, { value: 'updated' });
    });
  });
  
  describe('CircuitBreaker', () => {
    it('should execute functions when closed', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 100
      });
      
      const fn = sinon.stub().resolves('result');
      
      const result = await circuitBreaker.execute(fn);
      
      assert.strictEqual(result, 'result');
      assert(fn.calledOnce);
    });
    
    it('should open after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100
      });
      
      const fn = sinon.stub().rejects(new Error('Test error'));
      
      try {
        await circuitBreaker.execute(fn);
        assert.fail('Should have thrown');
      } catch (error) {
        // Expected
      }
      
      try {
        await circuitBreaker.execute(fn);
        assert.fail('Should have thrown');
      } catch (error) {
        // Expected
      }
      
      try {
        await circuitBreaker.execute(() => Promise.resolve('result'));
        assert.fail('Should have thrown circuit open error');
      } catch (error) {
        assert(error.message.includes('Circuit breaker is open'));
      }
      
      assert.strictEqual(fn.callCount, 2);
    });
    
    it('should reset after success', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100
      });
      
      const fnFail = sinon.stub().rejects(new Error('Test error'));
      const fnSuccess = sinon.stub().resolves('result');
      
      try {
        await circuitBreaker.execute(fnFail);
        assert.fail('Should have thrown');
      } catch (error) {
        // Expected
      }
      
      const result = await circuitBreaker.execute(fnSuccess);
      
      assert.strictEqual(result, 'result');
      assert(fnFail.calledOnce);
      assert(fnSuccess.calledOnce);
    });
  });
  
  describe('MetricsCollector', () => {
    it('should increment counters', () => {
      const metrics = new MetricsCollector();
      
      metrics.incrementCounter('test');
      metrics.incrementCounter('test');
      
      const value = metrics.getMetric('test');
      
      assert.strictEqual(value.value, 2);
    });
    
    it('should set and get gauges', () => {
      const metrics = new MetricsCollector();
      
      metrics.setGauge('test', 42);
      
      const value = metrics.getMetric('test');
      
      assert.strictEqual(value.value, 42);
    });
    
    it('should record timings', () => {
      const metrics = new MetricsCollector();
      
      metrics.recordTiming('test', 100);
      metrics.recordTiming('test', 200);
      
      const value = metrics.getMetric('test');
      
      assert.strictEqual(value.count, 2);
      assert.strictEqual(value.sum, 300);
      assert.strictEqual(value.min, 100);
      assert.strictEqual(value.max, 200);
      assert.strictEqual(value.avg, 150);
    });
    
    it('should record success rates', () => {
      const metrics = new MetricsCollector();
      
      metrics.recordSuccess('test', true);
      metrics.recordSuccess('test', false);
      metrics.recordSuccess('test', true);
      
      const value = metrics.getMetric('test');
      
      assert.strictEqual(value.total, 3);
      assert.strictEqual(value.successes, 2);
      assert.strictEqual(value.failures, 1);
      assert.strictEqual(value.rate, 2/3);
    });
  });
});

// Integration Tests
describe('Autonomous Error Recovery System - Integration Tests', () => {
  describe('Recovery Flow Integration', () => {
    let testEnv;
    
    beforeEach(async () => {
      testEnv = await TestUtils.createTestOrchestrator();
    });
    
    afterEach(() => {
      sinon.restore();
    });
    
    it('should execute a complete recovery flow successfully', async () => {
      const { 
        orchestrator, 
        eventBus,
        mockAnalyzer,
        mockStrategyGenerator,
        mockValidationRunner,
        mockResolutionExecutor,
        mockLearningSystem
      } = testEnv;
      
      const error = TestUtils.createMockError();
      
      // Set up event spy
      const eventSpy = sinon.spy();
      eventBus.on('recovery:completed', eventSpy);
      
      // Execute recovery flow
      const result = await orchestrator.startRecoveryFlow(error);
      
      // Verify result
      assert.strictEqual(result.successful, true);
      
      // Verify component calls
      assert(mockAnalyzer.analyzeError.calledOnce);
      assert(mockStrategyGenerator.generateStrategy.calledOnce);
      assert(mockValidationRunner.validateStrategy.calledOnce);
      assert(mockResolutionExecutor.executeStrategy.calledOnce);
      assert(mockLearningSystem.recordSuccess.calledOnce);
      
      // Verify events
      assert(eventSpy.calledOnce);
      assert(eventSpy.firstCall.args[0].successful);
    });
  });
});
