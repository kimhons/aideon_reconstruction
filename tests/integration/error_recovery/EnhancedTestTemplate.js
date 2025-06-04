/**
 * @fileoverview Enhanced test setup for RecoveryLearningSystem integration tests
 * with improved lifecycle management and event handling.
 * 
 * This file provides a template for robust integration testing with proper
 * component wiring, event listener registration, and test isolation.
 */

const sinon = require('sinon');
const { expect } = require('chai');
const EventBus = require('../../src/core/error_recovery/foundation/EventBus');
const DependencyContainer = require('../../src/core/error_recovery/foundation/DependencyContainer');
const RecoveryLearningSystem = require('../../src/core/error_recovery/RecoveryLearningSystem');
const MetricsCollector = require('../../src/core/error_recovery/integration/MetricsCollector');

describe('RecoveryLearningSystem Integration Test Template', () => {
  // Shared test components
  let container;
  let eventBus;
  let metricsCollector;
  let neuralHub;
  let learningSystem;
  let eventSpies;

  beforeEach(async () => {
    // Create fresh instances for each test
    container = new DependencyContainer();
    eventBus = new EventBus({ debug: true });
    
    console.log(`Test EventBus ID: ${eventBus.instanceId}`);
    
    // Create mock dependencies
    metricsCollector = new MetricsCollector();
    
    neuralHub = {
      recordRecoverySuccess: sinon.stub().resolves(),
      recordRecoveryFailure: sinon.stub().resolves()
    };
    
    // Register dependencies as singletons
    container.registerSingleton('eventBus', () => eventBus);
    container.registerSingleton('metricsCollector', () => metricsCollector);
    container.registerSingleton('neuralHub', () => neuralHub);
    
    // Create event spies BEFORE resolving components
    eventSpies = {
      learningStarted: sinon.spy(),
      learningCompleted: sinon.spy(),
      learningFailed: sinon.spy()
    };
    
    // Register event listeners
    eventBus.on('learning:started', eventSpies.learningStarted);
    eventBus.on('learning:completed', eventSpies.learningCompleted);
    eventBus.on('learning:failed', eventSpies.learningFailed);
    
    // Verify listeners are registered
    console.log('EventBus listeners after registration:');
    console.log(`- learning:started listeners: ${eventBus.listenerCount('learning:started')}`);
    console.log(`- learning:completed listeners: ${eventBus.listenerCount('learning:completed')}`);
    console.log(`- learning:failed listeners: ${eventBus.listenerCount('learning:failed')}`);
    
    // Now create the system under test
    learningSystem = new RecoveryLearningSystem({
      eventBus,
      metrics: metricsCollector,
      neuralHub
    });
    
    // Verify component wiring
    console.log(`Learning System EventBus ID: ${learningSystem.eventBus?.instanceId}`);
    expect(learningSystem.eventBus).to.equal(eventBus);
  });

  afterEach(() => {
    // Clean up
    if (eventBus) {
      eventBus.removeAllListeners();
    }
    
    // Restore all stubs and spies
    sinon.restore();
  });

  describe('Event Emission Tests', () => {
    it('should emit events for successful learning', async () => {
      // Create a promise that resolves when the event is emitted
      const completedPromise = new Promise((resolve) => {
        eventBus.once('learning:completed', (data) => {
          console.log('learning:completed event received:', data);
          resolve(data);
        });
      });
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-success',
        steps: [
          { name: 'analyze', result: { rootCauses: [{ type: 'TEST_CAUSE' }] } },
          { name: 'generate', result: { id: 'test-strategy', actions: [] } },
          { name: 'execute', successful: true }
        ]
      };
      
      // Execute the operation
      console.log('Calling learnFromRecovery with successful flow');
      const result = await learningSystem.learnFromRecovery(mockFlow, {});
      console.log('learnFromRecovery result:', result);
      
      // Wait for completion with timeout
      const completedData = await Promise.race([
        completedPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout waiting for learning:completed')), 1000)
        )
      ]);
      
      // Verify events were emitted
      expect(eventSpies.learningStarted.calledOnce).to.be.true;
      expect(eventSpies.learningCompleted.calledOnce).to.be.true;
      expect(completedData.flowId).to.equal('test-flow-success');
    });

    it('should emit events for failed learning', async () => {
      // Create a promise that resolves when the event is emitted
      const failedPromise = new Promise((resolve) => {
        eventBus.once('learning:failed', (data) => {
          console.log('learning:failed event received:', data);
          resolve(data);
        });
      });
      
      // Create mock recovery flow that will cause an error
      const mockFlow = {
        id: 'test-flow-error',
        steps: null // This will cause an error in extractLearningData
      };
      
      // Execute the operation
      console.log('Calling learnFromRecovery with flow that should cause error');
      const result = await learningSystem.learnFromRecovery(mockFlow, {});
      console.log('learnFromRecovery result:', result);
      
      // Wait for failure event with timeout
      const failedData = await Promise.race([
        failedPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout waiting for learning:failed')), 1000)
        )
      ]);
      
      // Verify events were emitted
      expect(eventSpies.learningStarted.calledOnce).to.be.true;
      expect(eventSpies.learningFailed.calledOnce).to.be.true;
      expect(failedData.flowId).to.equal('test-flow-error');
      expect(failedData.error).to.include('Invalid recovery flow structure');
    });
  });

  describe('Neural Hub Integration Tests', () => {
    it('should call neural hub methods for successful recovery', async () => {
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-neural-success',
        steps: [
          { name: 'analyze', result: { rootCauses: [{ type: 'TEST_CAUSE' }] } },
          { name: 'generate', result: { id: 'test-strategy', actions: [] } },
          { name: 'execute', successful: true }
        ]
      };
      
      // Execute the operation
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify neural hub methods were called
      expect(neuralHub.recordRecoverySuccess.calledOnce).to.be.true;
      expect(neuralHub.recordRecoveryFailure.called).to.be.false;
      
      // Verify call arguments
      const callArgs = neuralHub.recordRecoverySuccess.firstCall.args[0];
      expect(callArgs.rootCauses).to.deep.equal([{ type: 'TEST_CAUSE' }]);
      expect(callArgs.strategy.id).to.equal('test-strategy');
    });

    it('should call neural hub methods for failed recovery', async () => {
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-neural-failure',
        steps: [
          { name: 'analyze', result: { rootCauses: [{ type: 'TEST_CAUSE' }] } },
          { name: 'generate', result: { id: 'test-strategy', actions: [] } },
          { name: 'execute', successful: false }
        ]
      };
      
      // Execute the operation
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify neural hub methods were called
      expect(neuralHub.recordRecoverySuccess.called).to.be.false;
      expect(neuralHub.recordRecoveryFailure.calledOnce).to.be.true;
      
      // Verify call arguments
      const callArgs = neuralHub.recordRecoveryFailure.firstCall.args[0];
      expect(callArgs.rootCauses).to.deep.equal([{ type: 'TEST_CAUSE' }]);
      expect(callArgs.strategy.id).to.equal('test-strategy');
    });
  });

  describe('Metrics Integration Tests', () => {
    it('should record metrics for successful recovery', async () => {
      // Spy on metrics collector methods
      const incrementSpy = sinon.spy(metricsCollector, 'incrementCounter');
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-metrics-success',
        steps: [
          { name: 'analyze', result: { rootCauses: [{ type: 'TEST_CAUSE' }] } },
          { name: 'generate', result: { id: 'test-strategy', actions: [] } },
          { name: 'execute', successful: true }
        ]
      };
      
      // Execute the operation
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify metrics were recorded
      expect(incrementSpy.calledWith('recovery_learning_data_stored')).to.be.true;
      expect(incrementSpy.calledWith('recovery_learning_success')).to.be.true;
      expect(incrementSpy.calledWith('recovery_learning_failure')).to.be.false;
    });

    it('should record metrics for failed recovery', async () => {
      // Spy on metrics collector methods
      const incrementSpy = sinon.spy(metricsCollector, 'incrementCounter');
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-metrics-failure',
        steps: [
          { name: 'analyze', result: { rootCauses: [{ type: 'TEST_CAUSE' }] } },
          { name: 'generate', result: { id: 'test-strategy', actions: [] } },
          { name: 'execute', successful: false }
        ]
      };
      
      // Execute the operation
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify metrics were recorded
      expect(incrementSpy.calledWith('recovery_learning_data_stored')).to.be.true;
      expect(incrementSpy.calledWith('recovery_learning_success')).to.be.false;
      expect(incrementSpy.calledWith('recovery_learning_failure')).to.be.true;
    });
  });
});
