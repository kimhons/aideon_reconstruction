/**
 * ErrorRecoveryTestSuite.js
 * 
 * Comprehensive test suite for the Autonomous Error Recovery System.
 * Includes unit tests, integration tests, and end-to-end tests.
 */

const assert = require('assert');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');

// Import foundation components
const DependencyContainer = require('../../src/core/error_recovery/foundation/DependencyContainer');
const EventBus = require('../../src/core/error_recovery/foundation/EventBus');
const ContextManager = require('../../src/core/error_recovery/foundation/ContextManager');
const EnhancedNeuralCoordinationHub = require('../../src/core/error_recovery/foundation/EnhancedNeuralCoordinationHub');

// Import integration components
const MetricsCollector = require('../../src/core/error_recovery/integration/MetricsCollector');
const { AutonomousRecoveryOrchestrator, CircuitBreaker } = require('../../src/core/error_recovery/integration/AutonomousRecoveryOrchestrator');
const EnhancedIntegrationValidationRunner = require('../../src/core/error_recovery/integration/EnhancedIntegrationValidationRunner');

// Import original components
const CausalAnalyzer = require('../../src/core/error_recovery/CausalAnalyzer');
const RecoveryStrategyGenerator = require('../../src/core/error_recovery/RecoveryStrategyGenerator');
const ResolutionExecutor = require('../../src/core/error_recovery/ResolutionExecutor');
const RecoveryLearningSystem = require('../../src/core/error_recovery/RecoveryLearningSystem');

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
      const container = new DependencyContainer();
      
      container.register('testDep', () => ({ value: 'test' }));
      
      const dep = await container.resolve('testDep');
      
      assert.deepStrictEqual(dep, { value: 'test' });
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
      const eventBus = new EventBus();
      const handler = sinon.spy();
      
      eventBus.on('test', handler);
      eventBus.emit('test', { value: 'test' });
      
      assert(handler.calledOnce);
      assert(handler.calledWith({ value: 'test' }));
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
      const contextManager = new ContextManager({ eventBus });
      
      const contextData = { value: 'test' };
      const contextId = contextManager.createContext(contextData, 'test');
      
      const context = contextManager.getContext(contextId);
      
      assert.deepStrictEqual(context, contextData);
    });
    
    it('should update contexts', () => {
      const eventBus = new EventBus();
      const contextManager = new ContextManager({ eventBus });
      
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
    
    it('should handle validation failures', async () => {
      const { 
        orchestrator, 
        eventBus,
        mockAnalyzer,
        mockStrategyGenerator,
        mockValidationRunner,
        mockResolutionExecutor,
        mockLearningSystem
      } = testEnv;
      
      // Make validation fail
      mockValidationRunner.validateStrategy.resolves(false);
      
      const error = TestUtils.createMockError();
      
      // Set up event spy
      const eventSpy = sinon.spy();
      eventBus.on('recovery:completed', eventSpy);
      
      // Execute recovery flow
      const result = await orchestrator.startRecoveryFlow(error);
      
      // Verify result
      assert.strictEqual(result.successful, false);
      assert.strictEqual(result.reason, 'VALIDATION_FAILED');
      
      // Verify component calls
      assert(mockAnalyzer.analyzeError.calledOnce);
      assert(mockStrategyGenerator.generateStrategy.calledOnce);
      assert(mockValidationRunner.validateStrategy.calledOnce);
      assert(mockResolutionExecutor.executeStrategy.notCalled);
      assert(mockLearningSystem.recordSuccess.notCalled);
      
      // Verify events
      assert(eventSpy.calledOnce);
      assert.strictEqual(eventSpy.firstCall.args[0].successful, false);
    });
    
    it('should handle execution failures', async () => {
      const { 
        orchestrator, 
        eventBus,
        mockAnalyzer,
        mockStrategyGenerator,
        mockValidationRunner,
        mockResolutionExecutor,
        mockLearningSystem
      } = testEnv;
      
      // Make execution fail
      mockResolutionExecutor.executeStrategy.resolves(TestUtils.createMockExecutionResult(false));
      
      const error = TestUtils.createMockError();
      
      // Set up event spy
      const eventSpy = sinon.spy();
      eventBus.on('recovery:completed', eventSpy);
      
      // Execute recovery flow
      const result = await orchestrator.startRecoveryFlow(error);
      
      // Verify result
      assert.strictEqual(result.successful, false);
      assert.strictEqual(result.reason, 'EXECUTION_FAILED');
      
      // Verify component calls
      assert(mockAnalyzer.analyzeError.calledOnce);
      assert(mockStrategyGenerator.generateStrategy.calledOnce);
      assert(mockValidationRunner.validateStrategy.calledOnce);
      assert(mockResolutionExecutor.executeStrategy.calledOnce);
      assert(mockLearningSystem.recordSuccess.notCalled);
      
      // Verify events
      assert(eventSpy.calledOnce);
      assert.strictEqual(eventSpy.firstCall.args[0].successful, false);
    });
    
    it('should handle component errors with circuit breaking', async () => {
      const { 
        orchestrator, 
        eventBus,
        mockAnalyzer
      } = testEnv;
      
      // Make analyzer throw error
      const testError = new Error('Component failure');
      mockAnalyzer.analyzeError.rejects(testError);
      
      const error = TestUtils.createMockError();
      
      // Set up event spy
      const eventSpy = sinon.spy();
      eventBus.on('recovery:error', eventSpy);
      
      // Execute recovery flow
      const result = await orchestrator.startRecoveryFlow(error);
      
      // Verify result
      assert.strictEqual(result.successful, false);
      assert.strictEqual(result.error.message, testError.message);
      
      // Verify events
      assert(eventSpy.calledOnce);
      assert.strictEqual(eventSpy.firstCall.args[0].error.message, testError.message);
      
      // Execute again to test circuit breaker
      const result2 = await orchestrator.startRecoveryFlow(error);
      
      // Should still fail but with only one more call to analyzer
      assert.strictEqual(result2.successful, false);
      assert.strictEqual(mockAnalyzer.analyzeError.callCount, 2);
      
      // Third time should trigger circuit breaker
      mockAnalyzer.analyzeError.reset(); // Reset to verify no more calls
      
      const result3 = await orchestrator.startRecoveryFlow(error);
      
      // Should fail with circuit breaker error
      assert.strictEqual(result3.successful, false);
      assert(mockAnalyzer.analyzeError.notCalled);
    });
  });
  
  describe('Context Propagation Integration', () => {
    let testEnv;
    
    beforeEach(async () => {
      testEnv = await TestUtils.createTestOrchestrator();
    });
    
    afterEach(() => {
      sinon.restore();
    });
    
    it('should propagate context through the recovery flow', async () => {
      const { 
        orchestrator, 
        contextManager,
        mockAnalyzer,
        mockStrategyGenerator,
        mockValidationRunner,
        mockResolutionExecutor
      } = testEnv;
      
      const error = TestUtils.createMockError();
      const contextId = contextManager.createContext({ 
        error,
        source: 'test',
        timestamp: Date.now(),
        recoveryAttempts: 0
      }, 'test');
      
      // Execute recovery flow
      await orchestrator.startRecoveryFlow(error, contextId);
      
      // Get final context
      const finalContext = contextManager.getContext(contextId);
      
      // Verify context was updated at each step
      assert(finalContext.cause);
      assert(finalContext.strategy);
      assert(finalContext.validationResult);
      assert(finalContext.executionResult);
      
      // Verify context history
      const history = contextManager.getContextHistory(contextId);
      assert(history.length >= 5); // Initial + at least 4 updates
    });
  });
  
  describe('Event Propagation Integration', () => {
    let testEnv;
    
    beforeEach(async () => {
      testEnv = await TestUtils.createTestOrchestrator();
    });
    
    afterEach(() => {
      sinon.restore();
    });
    
    it('should emit events for each step of the recovery flow', async () => {
      const { 
        orchestrator, 
        eventBus
      } = testEnv;
      
      const error = TestUtils.createMockError();
      
      // Set up event spies
      const startSpy = sinon.spy();
      const analysisSpy = sinon.spy();
      const strategySpy = sinon.spy();
      const validationSpy = sinon.spy();
      const executionSpy = sinon.spy();
      const learningSpy = sinon.spy();
      const completedSpy = sinon.spy();
      
      eventBus.on('recovery:started', startSpy);
      eventBus.on('analysis:completed', analysisSpy);
      eventBus.on('strategy:generation:completed', strategySpy);
      eventBus.on('validation:completed', validationSpy);
      eventBus.on('execution:completed', executionSpy);
      eventBus.on('learning:completed', learningSpy);
      eventBus.on('recovery:completed', completedSpy);
      
      // Execute recovery flow
      await orchestrator.startRecoveryFlow(error);
      
      // Verify events
      assert(startSpy.calledOnce);
      assert(analysisSpy.calledOnce);
      assert(strategySpy.calledOnce);
      assert(validationSpy.calledOnce);
      assert(executionSpy.calledOnce);
      assert(learningSpy.calledOnce);
      assert(completedSpy.calledOnce);
      
      // Verify event order
      const flowId = startSpy.firstCall.args[0].flowId;
      
      assert.strictEqual(analysisSpy.firstCall.args[0].flowId, flowId);
      assert.strictEqual(strategySpy.firstCall.args[0].flowId, flowId);
      assert.strictEqual(validationSpy.firstCall.args[0].flowId, flowId);
      assert.strictEqual(executionSpy.firstCall.args[0].flowId, flowId);
      assert.strictEqual(learningSpy.firstCall.args[0].flowId, flowId);
      assert.strictEqual(completedSpy.firstCall.args[0].flowId, flowId);
    });
  });
  
  describe('Metrics Collection Integration', () => {
    let testEnv;
    
    beforeEach(async () => {
      testEnv = await TestUtils.createTestOrchestrator();
    });
    
    afterEach(() => {
      sinon.restore();
    });
    
    it('should collect metrics during recovery flow', async () => {
      const { 
        orchestrator, 
        metrics
      } = testEnv;
      
      const error = TestUtils.createMockError();
      
      // Execute recovery flow
      await orchestrator.startRecoveryFlow(error);
      
      // Verify metrics
      const recoveryFlowsStarted = metrics.getMetric('recovery_flows_started');
      const recoveryFlowsCompleted = metrics.getMetric('recovery_flows_completed');
      const recoveryFlowSuccess = metrics.getMetric('recovery_flow');
      const analysisDuration = metrics.getMetric('analysis_duration');
      const strategyGenerationDuration = metrics.getMetric('strategy_generation_duration');
      const validationDuration = metrics.getMetric('validation_duration');
      const executionDuration = metrics.getMetric('execution_duration');
      
      assert.strictEqual(recoveryFlowsStarted.value, 1);
      assert.strictEqual(recoveryFlowsCompleted.value, 1);
      assert.strictEqual(recoveryFlowSuccess.successes, 1);
      assert(analysisDuration.count > 0);
      assert(strategyGenerationDuration.count > 0);
      assert(validationDuration.count > 0);
      assert(executionDuration.count > 0);
    });
  });
});

// End-to-End Tests
describe('Autonomous Error Recovery System - End-to-End Tests', () => {
  describe('Complete System Integration', () => {
    let container;
    let eventBus;
    let contextManager;
    let metrics;
    let orchestrator;
    
    before(async () => {
      // Create real components
      container = new DependencyContainer();
      eventBus = new EventBus();
      contextManager = new ContextManager({ eventBus });
      metrics = new MetricsCollector({ eventBus, flushInterval: 1000 });
      
      // Register components with real implementations
      container.register('eventBus', () => eventBus);
      container.register('contextManager', () => contextManager);
      container.register('metrics', () => metrics);
      
      // Create mock implementations for core components
      const mockAnalyzer = {
        analyzeError: sinon.stub().callsFake(async (error, context) => {
          return TestUtils.createMockCause();
        })
      };
      
      const mockStrategyGenerator = {
        generateStrategy: sinon.stub().callsFake(async (cause, context) => {
          return TestUtils.createMockStrategy();
        })
      };
      
      const mockValidationRunner = {
        validateStrategy: sinon.stub().callsFake(async (strategy, context) => {
          return true;
        })
      };
      
      const mockResolutionExecutor = {
        executeStrategy: sinon.stub().callsFake(async (strategy, context) => {
          return TestUtils.createMockExecutionResult(true);
        })
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
      
      container.register('causalAnalyzer', () => mockAnalyzer);
      container.register('recoveryStrategyGenerator', () => mockStrategyGenerator);
      container.register('integrationValidationRunner', () => mockValidationRunner);
      container.register('resolutionExecutor', () => mockResolutionExecutor);
      container.register('recoveryLearningSystem', () => mockLearningSystem);
      container.register('neuralCoordinationHub', () => mockNeuralHub);
      
      // Create orchestrator
      orchestrator = new AutonomousRecoveryOrchestrator({
        container,
        eventBus,
        contextManager,
        metrics,
        logger: console
      });
      
      await orchestrator.initialize();
    });
    
    it('should handle error detection and recovery end-to-end', async () => {
      // Create test error
      const error = new Error('End-to-end test error');
      
      // Set up event tracking
      const events = [];
      const trackEvent = (event, data) => {
        events.push({ event, data });
      };
      
      eventBus.on('recovery:started', data => trackEvent('recovery:started', data));
      eventBus.on('analysis:started', data => trackEvent('analysis:started', data));
      eventBus.on('analysis:completed', data => trackEvent('analysis:completed', data));
      eventBus.on('strategy:generation:started', data => trackEvent('strategy:generation:started', data));
      eventBus.on('strategy:generation:completed', data => trackEvent('strategy:generation:completed', data));
      eventBus.on('validation:started', data => trackEvent('validation:started', data));
      eventBus.on('validation:completed', data => trackEvent('validation:completed', data));
      eventBus.on('execution:started', data => trackEvent('execution:started', data));
      eventBus.on('execution:completed', data => trackEvent('execution:completed', data));
      eventBus.on('learning:started', data => trackEvent('learning:started', data));
      eventBus.on('learning:completed', data => trackEvent('learning:completed', data));
      eventBus.on('recovery:completed', data => trackEvent('recovery:completed', data));
      
      // Trigger error detection
      eventBus.emit('error:detected', {
        error,
        source: 'e2e-test',
        timestamp: Date.now()
      });
      
      // Wait for recovery to complete
      await new Promise(resolve => {
        eventBus.once('recovery:completed', () => {
          resolve();
        });
      });
      
      // Verify event sequence
      assert(events.length >= 10);
      assert(events.some(e => e.event === 'recovery:started'));
      assert(events.some(e => e.event === 'analysis:completed'));
      assert(events.some(e => e.event === 'strategy:generation:completed'));
      assert(events.some(e => e.event === 'validation:completed'));
      assert(events.some(e => e.event === 'execution:completed'));
      assert(events.some(e => e.event === 'learning:completed'));
      assert(events.some(e => e.event === 'recovery:completed'));
      
      // Verify metrics
      const allMetrics = metrics.getAllMetrics();
      assert(allMetrics.counters['recovery_flows_started'] > 0);
      assert(allMetrics.counters['recovery_flows_completed'] > 0);
      
      // Verify recovery flow tracking
      const flows = orchestrator.getRecoveryFlows();
      assert(flows.length > 0);
      assert(flows[0].status === 'completed');
      assert(flows[0].steps.length >= 5);
    });
    
    it('should handle multiple concurrent recovery flows', async () => {
      // Create test errors
      const error1 = new Error('Concurrent test error 1');
      const error2 = new Error('Concurrent test error 2');
      const error3 = new Error('Concurrent test error 3');
      
      // Track completed flows
      const completedFlows = [];
      eventBus.on('recovery:completed', data => {
        completedFlows.push(data.flowId);
      });
      
      // Start concurrent recovery flows
      const promise1 = orchestrator.startRecoveryFlow(error1);
      const promise2 = orchestrator.startRecoveryFlow(error2);
      const promise3 = orchestrator.startRecoveryFlow(error3);
      
      // Wait for all to complete
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      
      // Verify all succeeded
      assert.strictEqual(result1.successful, true);
      assert.strictEqual(result2.successful, true);
      assert.strictEqual(result3.successful, true);
      
      // Verify all flows were tracked
      assert.strictEqual(completedFlows.length, 3);
      
      // Verify metrics
      const recoveryFlowsStarted = metrics.getMetric('recovery_flows_started');
      const recoveryFlowsCompleted = metrics.getMetric('recovery_flows_completed');
      
      assert(recoveryFlowsStarted.value >= 3);
      assert(recoveryFlowsCompleted.value >= 3);
    });
  });
  
  describe('Performance Benchmarks', () => {
    let container;
    let eventBus;
    let contextManager;
    let metrics;
    let orchestrator;
    
    before(async () => {
      // Create real components
      container = new DependencyContainer();
      eventBus = new EventBus();
      contextManager = new ContextManager({ eventBus });
      metrics = new MetricsCollector({ eventBus, flushInterval: 1000 });
      
      // Register components with real implementations
      container.register('eventBus', () => eventBus);
      container.register('contextManager', () => contextManager);
      container.register('metrics', () => metrics);
      
      // Create optimized mock implementations for benchmarking
      const mockAnalyzer = {
        analyzeError: sinon.stub().callsFake(async () => TestUtils.createMockCause())
      };
      
      const mockStrategyGenerator = {
        generateStrategy: sinon.stub().callsFake(async () => TestUtils.createMockStrategy())
      };
      
      const mockValidationRunner = {
        validateStrategy: sinon.stub().callsFake(async () => true)
      };
      
      const mockResolutionExecutor = {
        executeStrategy: sinon.stub().callsFake(async () => TestUtils.createMockExecutionResult(true))
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
      
      container.register('causalAnalyzer', () => mockAnalyzer);
      container.register('recoveryStrategyGenerator', () => mockStrategyGenerator);
      container.register('integrationValidationRunner', () => mockValidationRunner);
      container.register('resolutionExecutor', () => mockResolutionExecutor);
      container.register('recoveryLearningSystem', () => mockLearningSystem);
      container.register('neuralCoordinationHub', () => mockNeuralHub);
      
      // Create orchestrator
      orchestrator = new AutonomousRecoveryOrchestrator({
        container,
        eventBus,
        contextManager,
        metrics,
        logger: console
      });
      
      await orchestrator.initialize();
    });
    
    it('should handle high volume of recovery flows efficiently', async function() {
      this.timeout(10000); // Increase timeout for benchmark
      
      // Number of flows to test
      const numFlows = 100;
      
      // Create test errors
      const errors = Array.from({ length: numFlows }, (_, i) => 
        new Error(`Benchmark test error ${i}`)
      );
      
      // Track start time
      const startTime = Date.now();
      
      // Start all recovery flows
      const promises = errors.map(error => 
        orchestrator.startRecoveryFlow(error)
      );
      
      // Wait for all to complete
      const results = await Promise.all(promises);
      
      // Track end time
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all succeeded
      const successCount = results.filter(r => r.successful).length;
      assert.strictEqual(successCount, numFlows);
      
      // Calculate metrics
      const flowsPerSecond = (numFlows / totalTime) * 1000;
      const avgTimePerFlow = totalTime / numFlows;
      
      console.log(`Benchmark results:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Flows per second: ${flowsPerSecond.toFixed(2)}`);
      console.log(`- Average time per flow: ${avgTimePerFlow.toFixed(2)}ms`);
      
      // Verify performance is acceptable
      assert(flowsPerSecond >= 10, `Flow processing rate (${flowsPerSecond.toFixed(2)}/s) below threshold`);
      assert(avgTimePerFlow <= 100, `Average flow time (${avgTimePerFlow.toFixed(2)}ms) above threshold`);
    });
  });
});

module.exports = {
  TestUtils
};
