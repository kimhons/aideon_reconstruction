/**
 * @fileoverview Minimal end-to-end pipeline integration test for the RecoveryLearningSystem.
 * This test focuses on the core functionality with minimal dependencies to isolate integration issues.
 */

const assert = require('assert');
const sinon = require('sinon');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');

// Import core components directly
const EventBus = require('../../../src/core/error_recovery/foundation/EventBus');
const RecoveryLearningSystem = require('../../../src/core/error_recovery/RecoveryLearningSystem');

describe('RecoveryLearningSystem Minimal Pipeline Test', () => {
  // Create components directly without dependency container
  let eventBus;
  let learningSystem;
  let neuralHub;
  let eventSpy;
  
  beforeEach(() => {
    // Create fresh instances for each test to ensure isolation
    console.log('Creating fresh components for minimal pipeline test');
    
    // Create EventBus with debug ID
    eventBus = new EventBus();
    console.log(`Created EventBus with ID: ${eventBus.instanceId}`);
    
    // Enable event history for debugging
    eventBus.setHistoryTracking(true);
    
    // Create simple mock neural hub with explicit spy functions
    neuralHub = {
      recordRecoverySuccess: sinon.spy(async () => {
        console.log('Mock neuralHub.recordRecoverySuccess called');
        return Promise.resolve();
      }),
      recordRecoveryFailure: sinon.spy(async () => {
        console.log('Mock neuralHub.recordRecoveryFailure called');
        return Promise.resolve();
      })
    };
    
    // Create simple metrics collector
    const metricsCollector = {
      incrementCounter: sinon.spy((metric) => {
        console.log(`Incrementing metric: ${metric}`);
      })
    };
    
    // Create simple logger
    const logger = {
      debug: console.log,
      info: console.log,
      warn: console.warn,
      error: console.error
    };
    
    // Create learning system with direct dependencies
    learningSystem = new RecoveryLearningSystem({
      eventBus,
      neuralHub,
      metrics: metricsCollector,
      logger
    });
    
    // Register event listener with direct spy
    eventSpy = sinon.spy();
    eventBus.on('learning:completed', eventSpy);
    
    // Verify listener registration
    console.log('EventBus listeners after registration:');
    console.log('- learning:completed listeners:', eventBus.emitter.listeners('learning:completed').length);
  });
  
  afterEach(() => {
    // Clean up
    sinon.restore();
    eventBus.removeAllListeners();
    console.log('Test cleanup completed');
  });
  
  it('should process a successful recovery flow end-to-end', async () => {
    // Create a minimal successful recovery flow
    const mockFlow = {
      id: 'minimal-test-flow',
      steps: [
        {
          name: 'analyze',
          result: {
            rootCauses: [{ type: 'TEST_ERROR', confidence: 0.9 }]
          }
        },
        {
          name: 'generate',
          result: {
            id: 'test-strategy',
            name: 'Test Strategy',
            actions: [{ actionId: 'test-action', parameters: {} }]
          }
        },
        {
          name: 'execute',
          successful: true
        }
      ]
    };
    
    console.log('Starting minimal pipeline test with flow:', mockFlow.id);
    
    // Process the recovery flow
    const result = await learningSystem.learnFromRecovery(mockFlow, {});
    console.log('learnFromRecovery result:', result);
    
    // Wait for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check event history
    const history = eventBus.getEventHistory();
    console.log('Event history:', JSON.stringify(history));
    
    // Verify neural hub was called
    console.log('Neural hub recordRecoverySuccess called:', neuralHub.recordRecoverySuccess.called);
    console.log('Neural hub recordRecoverySuccess call count:', neuralHub.recordRecoverySuccess.callCount);
    
    // Verify event was emitted and listener was called
    console.log('learning:completed event spy called:', eventSpy.called);
    console.log('learning:completed event spy call count:', eventSpy.callCount);
    
    // Assertions
    assert(result.successful, 'Learning process should be successful');
    assert(neuralHub.recordRecoverySuccess.calledOnce, 'Neural hub recordRecoverySuccess should be called once');
    assert(eventSpy.calledOnce, 'learning:completed event should be emitted once');
  });
  
  it('should process a failed recovery flow end-to-end', async () => {
    // Create a minimal failed recovery flow
    const mockFlow = {
      id: 'minimal-test-flow-failed',
      steps: [
        {
          name: 'analyze',
          result: {
            rootCauses: [{ type: 'TEST_ERROR', confidence: 0.9 }]
          }
        },
        {
          name: 'generate',
          result: {
            id: 'test-strategy',
            name: 'Test Strategy',
            actions: [{ actionId: 'test-action', parameters: {} }]
          }
        },
        {
          name: 'execute',
          successful: false
        }
      ]
    };
    
    console.log('Starting minimal pipeline test with failed flow:', mockFlow.id);
    
    // Register event listener for failed events
    const failedEventSpy = sinon.spy();
    eventBus.on('learning:failed', failedEventSpy);
    
    // Process the recovery flow
    const result = await learningSystem.learnFromRecovery(mockFlow, {});
    console.log('learnFromRecovery result (failed flow):', result);
    
    // Wait for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check event history
    const history = eventBus.getEventHistory();
    console.log('Event history (failed flow):', JSON.stringify(history));
    
    // Verify neural hub was called
    console.log('Neural hub recordRecoveryFailure called:', neuralHub.recordRecoveryFailure.called);
    console.log('Neural hub recordRecoveryFailure call count:', neuralHub.recordRecoveryFailure.callCount);
    
    // Assertions
    assert(neuralHub.recordRecoveryFailure.calledOnce, 'Neural hub recordRecoveryFailure should be called once');
  });
});
