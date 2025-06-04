/**
 * @fileoverview Integration tests for the RecoveryLearningSystem component.
 * Tests the integration of the RecoveryLearningSystem with other components
 * of the Autonomous Error Recovery System.
 * 
 * @module tests/integration/error_recovery/RecoveryLearningSystemIntegrationTest
 */

const assert = require('assert');
const sinon = require('sinon');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');

// Import components
const RecoveryLearningSystem = require('../../../src/core/error_recovery/RecoveryLearningSystem');
const EventBus = require('../../../src/core/error_recovery/foundation/EventBus');
const MetricsCollector = require('../../../src/core/error_recovery/integration/MetricsCollector');
const DependencyContainer = require('../../../src/core/error_recovery/foundation/DependencyContainer');
const CausalAnalyzer = require('../../../src/core/error_recovery/CausalAnalyzer');
const RecoveryStrategyGenerator = require('../../../src/core/error_recovery/RecoveryStrategyGenerator');
const ResolutionExecutor = require('../../../src/core/error_recovery/ResolutionExecutor');

describe('RecoveryLearningSystem Integration Tests', () => {
  let container;
  let eventBus;
  let metricsCollector;
  let learningSystem;
  let causalAnalyzer;
  let strategyGenerator;
  let resolutionExecutor;
  
  before(() => {
    // Set up dependency container
    container = new DependencyContainer();
    
    // Create a single EventBus instance to be shared by all components
    eventBus = new EventBus();
    
    // Register the EventBus instance directly instead of as a factory function
    // This ensures the same instance is used throughout the test
    container.register('eventBus', () => eventBus);
    
    // Create metrics collector with the same EventBus instance
    metricsCollector = new MetricsCollector({ eventBus });
    container.register('metrics', () => metricsCollector);
    
    // Create a shared mock neural hub instance with plain functions that can be spied on later
    // Using regular functions instead of stubs to avoid sinon conflicts
    const mockNeuralHub = {
      recordRecoverySuccess: function() { return Promise.resolve(); },
      recordRecoveryFailure: function() { return Promise.resolve(); }
    };
    
    // Register the neural hub instance directly to ensure consistent reference
    container.register('neuralHub', () => mockNeuralHub);
    
    // Store the mock neural hub in a module-level variable for direct access in tests
    this.mockNeuralHub = mockNeuralHub;
    
    // Create logger
    const logger = {
      info: sinon.spy(),
      debug: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
    container.register('logger', () => logger);
    
    // Create components
    causalAnalyzer = new CausalAnalyzer({
      eventBus,
      metrics: metricsCollector,
      logger
    });
    container.register('causalAnalyzer', () => causalAnalyzer);
    
    strategyGenerator = new RecoveryStrategyGenerator({
      eventBus,
      metrics: metricsCollector,
      logger
    });
    container.register('strategyGenerator', () => strategyGenerator);
    
    resolutionExecutor = new ResolutionExecutor({
      eventBus,
      metrics: metricsCollector,
      logger
    });
    container.register('resolutionExecutor', () => resolutionExecutor);
    
    // Create learning system with direct references to ensure consistent dependency injection
    // Debug the neural hub instance before passing it to the learning system
    const neuralHubInstance = this.mockNeuralHub;
    console.log('Neural hub instance before creating learning system:', {
      isDefined: !!neuralHubInstance,
      hasRecordSuccess: !!neuralHubInstance?.recordRecoverySuccess,
      hasRecordFailure: !!neuralHubInstance?.recordRecoveryFailure
    });
    
    // Create learning system with explicit dependencies
    learningSystem = new RecoveryLearningSystem({
      eventBus: eventBus, // Use the same eventBus instance directly
      metrics: metricsCollector, // Use the same metricsCollector instance directly
      neuralHub: neuralHubInstance, // Use the shared mock neural hub directly
      logger: logger // Use the same logger instance directly
    });
    
    // Debug the learning system's dependencies after creation
    console.log('Learning system dependencies after creation:', {
      hasEventBus: !!learningSystem.eventBus,
      hasMetrics: !!learningSystem.metrics,
      hasNeuralHub: !!learningSystem.neuralHub,
      sameEventBus: learningSystem.eventBus === eventBus,
      sameMetrics: learningSystem.metrics === metricsCollector,
      sameNeuralHub: learningSystem.neuralHub === neuralHubInstance
    });
    
    // Register the learning system instance directly
    container.register('learningSystem', () => learningSystem);
  });
  
  beforeEach(() => {
    // Reset event bus history and re-enable for each test
    eventBus.clearEventHistory();
    eventBus.setHistoryTracking(true);
  });
  
  afterEach(() => {
    // Reset spies and stubs but preserve event bus state
    sinon.restore();
    
    // Remove all event listeners to prevent cross-test contamination
    eventBus.removeAllListeners();
  });
  
  describe('Integration with EventBus', () => {
    it('should emit learning events through the event bus', async () => {
      // Enable event history tracking
      eventBus.setHistoryTracking(true);
      
      // Use direct Node.js EventEmitter listeners instead of EventBus abstraction
      // This bypasses any potential issues in the EventBus wrapper
      const startedListener = sinon.spy((...args) => {
        console.log('learning:started listener called with:', JSON.stringify(args));
      });
      const completedListener = sinon.spy((...args) => {
        console.log('learning:completed listener called with:', JSON.stringify(args));
      });
      
      // Check if EventBus is properly initialized
      console.log('EventBus emitter exists:', !!eventBus.emitter);
      console.log('EventBus before registration - listeners:', 
        eventBus.listenerCount('learning:started'),
        eventBus.listenerCount('learning:completed'));
      
      // Register directly with the underlying EventEmitter
      eventBus.emitter.on('learning:started', startedListener);
      eventBus.emitter.on('learning:completed', completedListener);
      
      // Also register through the EventBus API for tracking
      const startedId = eventBus.on('learning:started', () => {});
      const completedId = eventBus.on('learning:completed', () => {});
      
      console.log('Listener registration IDs:', startedId, completedId);
      console.log('EventBus after registration - listeners:', 
        eventBus.listenerCount('learning:started'),
        eventBus.listenerCount('learning:completed'));
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-1',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'MEMORY_LEAK', confidence: 0.9 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-1',
              name: 'Memory Leak Recovery',
              actions: [{ actionId: 'restart-service', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: true
          }
        ]
      };
      
      // Debug EventBus internal state before learning
      console.log('EventBus internal state before learning:');
      console.log('- Registered events:', eventBus.emitter.eventNames());
      console.log('- learning:started listeners:', eventBus.listenerCount('learning:started'));
      console.log('- learning:completed listeners:', eventBus.listenerCount('learning:completed'));
      
      // Debug the EventEmitter directly
      console.log('EventEmitter listeners before learning:');
      console.log('- learning:started listeners:', eventBus.emitter.listeners('learning:started').length);
      console.log('- learning:completed listeners:', eventBus.emitter.listeners('learning:completed').length);
      
      // Learn from recovery
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Wait for event propagation with longer timeout
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Debug EventBus internal state after learning
      console.log('EventBus internal state after learning:');
      console.log('- Registered events:', eventBus.emitter.eventNames());
      
      // Check event history directly as an alternative verification method
      const history = eventBus.getEventHistory();
      const startedEvents = history.filter(entry => entry.event === 'learning:started');
      const completedEvents = history.filter(entry => entry.event === 'learning:completed');
      
      console.log('Event history:', JSON.stringify(history));
      console.log('Started events:', startedEvents.length);
      console.log('Completed events:', completedEvents.length);
      
      // Verify events were emitted
      assert(startedListener.calledOnce, 'learning:started event not emitted');
      assert(completedListener.calledOnce, 'learning:completed event not emitted');
    });
    
    it('should emit failure events when learning fails', async () => {
      // Register event listeners with direct debug output
      const startedListener = sinon.spy((data) => {
        console.log('learning:started event received:', data);
      });
      const failedListener = sinon.spy((data) => {
        console.log('learning:failed event received:', data);
      });
      
      // Verify EventBus instance ID for debugging
      console.log(`Test EventBus ID: ${eventBus.instanceId}`);
      console.log(`Learning System EventBus ID: ${learningSystem.eventBus?.instanceId}`);
      console.log(`EventBus listeners before registration - learning:failed: ${eventBus.emitter.listenerCount('learning:failed')}`);
      
      // Register listeners
      eventBus.on('learning:started', startedListener);
      eventBus.on('learning:failed', failedListener);
      
      console.log(`EventBus listeners after registration - learning:failed: ${eventBus.emitter.listenerCount('learning:failed')}`);
      
      // Create mock recovery flow that will cause an error
      const mockFlow = {
        id: 'test-flow-2',
        steps: null // This will cause an error in extractLearningData
      };
      
      try {
        // Learn from recovery
        console.log('Calling learnFromRecovery with flow that should cause error');
        await learningSystem.learnFromRecovery(mockFlow, {});
        console.log('learnFromRecovery completed without error');
      } catch (error) {
        console.log('learnFromRecovery threw error:', error.message);
      }
      
      // Wait for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check event history for debugging
      const history = eventBus.getEventHistory();
      console.log('Event history:', JSON.stringify(history));
      
      // Verify events were emitted
      console.log('startedListener called:', startedListener.called);
      console.log('failedListener called:', failedListener.called);
      
      assert(startedListener.calledOnce, 'learning:started event not emitted');
      assert(failedListener.calledOnce, 'learning:failed event not emitted');
    });
  });
  
  describe('Integration with Metrics Collector', () => {
    it('should record metrics when learning from successful recovery', async () => {
      // Spy on metrics collector methods
      const incrementSpy = sinon.spy(metricsCollector, 'incrementCounter');
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-3',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'DATABASE_CONNECTION', confidence: 0.85 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-2',
              name: 'Database Recovery',
              actions: [{ actionId: 'reconnect-db', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: true
          }
        ]
      };
      
      // Learn from recovery
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify metrics were recorded
      assert(incrementSpy.calledWith('recovery_learning_success'), 'recovery_learning_success metric not incremented');
    });
    
    it('should record metrics when learning from failed recovery', async () => {
      // Spy on metrics collector
      const incrementSpy = sinon.spy(metricsCollector, 'incrementCounter');
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-4',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'NETWORK_TIMEOUT', confidence: 0.75 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-3',
              name: 'Network Recovery',
              actions: [{ actionId: 'reset-connection', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: false
          }
        ]
      };
      
      // Learn from recovery
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify metrics were recorded
      assert(incrementSpy.calledWith('recovery_learning_failure'), 'recovery_learning_failure metric not incremented');
    });
  });
  
  describe('Integration with Neural Hub', () => {
    it('should integrate with neural hub for successful recoveries', async () => {
      // Use the shared mock neural hub instance directly
      // This avoids issues with container resolution and sinon spying
      const recordSuccessSpy = sinon.spy(this.mockNeuralHub, 'recordRecoverySuccess');
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-5',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'API_RATE_LIMIT', confidence: 0.95 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-4',
              name: 'API Rate Limit Recovery',
              actions: [{ actionId: 'implement-backoff', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: true
          }
        ]
      };
      
      // Add debug output before learning
      console.log('Neural hub before learning:', {
        recordSuccessIsFunction: typeof this.mockNeuralHub.recordRecoverySuccess === 'function',
        recordFailureIsFunction: typeof this.mockNeuralHub.recordRecoveryFailure === 'function'
      });
      
      // Learn from recovery with debug output
      console.log('Starting learnFromRecovery with successful flow');
      const result = await learningSystem.learnFromRecovery(mockFlow, {});
      console.log('learnFromRecovery result:', result);
      
      // Debug neural hub spy state
      console.log('Neural hub recordSuccessSpy called:', recordSuccessSpy.called);
      console.log('Neural hub recordSuccessSpy callCount:', recordSuccessSpy.callCount);
      
      // Verify neural hub was called
      assert(recordSuccessSpy.calledOnce, 'Neural hub recordRecoverySuccess not called');
      
      // Verify correct data was passed
      const callArg = recordSuccessSpy.firstCall.args[0];
      assert.strictEqual(callArg.rootCauses[0].type, 'API_RATE_LIMIT', 'Incorrect root cause passed to neural hub');
      assert.strictEqual(callArg.strategy.id, 'strategy-4', 'Incorrect strategy passed to neural hub');
    });
    
    it('should integrate with neural hub for failed recoveries', async () => {
      // Use the shared mock neural hub instance directly
      // This avoids issues with container resolution and sinon spying
      const recordFailureSpy = sinon.spy(this.mockNeuralHub, 'recordRecoveryFailure');
      
      // Create mock recovery flow
      const mockFlow = {
        id: 'test-flow-6',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'DISK_FULL', confidence: 0.99 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-5',
              name: 'Disk Full Recovery',
              actions: [{ actionId: 'clean-temp-files', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: false
          }
        ]
      };
      
      // Learn from recovery
      await learningSystem.learnFromRecovery(mockFlow, {});
      
      // Verify neural hub was called
      assert(recordFailureSpy.calledOnce, 'Neural hub recordRecoveryFailure not called');
      
      // Verify correct data was passed
      const callArg = recordFailureSpy.firstCall.args[0];
      assert.strictEqual(callArg.rootCauses[0].type, 'DISK_FULL', 'Incorrect root cause passed to neural hub');
      assert.strictEqual(callArg.strategy.id, 'strategy-5', 'Incorrect strategy passed to neural hub');
    });
  });
  
  describe('Strategy Recommendation', () => {
    it('should recommend strategies based on past successes', async () => {
      // Clear learning data
      learningSystem.clearLearningData();
      
      // Create mock recovery flows
      const mockFlow1 = {
        id: 'test-flow-7',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'SERVICE_CRASH', confidence: 0.9 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-6',
              name: 'Service Crash Recovery 1',
              actions: [{ actionId: 'restart-service', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: true
          }
        ]
      };
      
      const mockFlow2 = {
        id: 'test-flow-8',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'SERVICE_CRASH', confidence: 0.9 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-7',
              name: 'Service Crash Recovery 2',
              actions: [{ actionId: 'restart-with-flags', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: true
          }
        ]
      };
      
      // Learn from recoveries
      await learningSystem.learnFromRecovery(mockFlow1, {});
      await learningSystem.learnFromRecovery(mockFlow1, {}); // Learn twice from first strategy
      await learningSystem.learnFromRecovery(mockFlow2, {});
      
      // Get recommended strategies
      const recommendations = learningSystem.getRecommendedStrategies('SERVICE_CRASH');
      
      // Verify recommendations
      assert.strictEqual(recommendations.length, 2, 'Should have 2 recommended strategies');
      assert.strictEqual(recommendations[0].id, 'strategy-6', 'Most successful strategy should be first');
      assert.strictEqual(recommendations[0].successCount, 2, 'First strategy should have 2 successes');
      assert.strictEqual(recommendations[1].id, 'strategy-7', 'Less successful strategy should be second');
      assert.strictEqual(recommendations[1].successCount, 1, 'Second strategy should have 1 success');
    });
    
    it('should identify strategies to avoid based on past failures', async () => {
      // Clear learning data
      learningSystem.clearLearningData();
      
      // Create mock recovery flows
      const mockFlow1 = {
        id: 'test-flow-9',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'DEADLOCK', confidence: 0.95 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-8',
              name: 'Deadlock Recovery 1',
              actions: [{ actionId: 'kill-process', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: false
          }
        ]
      };
      
      const mockFlow2 = {
        id: 'test-flow-10',
        steps: [
          {
            name: 'analyze',
            result: {
              rootCauses: [{ type: 'DEADLOCK', confidence: 0.95 }]
            }
          },
          {
            name: 'generate',
            result: {
              id: 'strategy-9',
              name: 'Deadlock Recovery 2',
              actions: [{ actionId: 'timeout-and-retry', parameters: {} }]
            }
          },
          {
            name: 'execute',
            successful: false
          }
        ]
      };
      
      // Learn from recoveries
      await learningSystem.learnFromRecovery(mockFlow1, {});
      await learningSystem.learnFromRecovery(mockFlow1, {}); // Learn twice from first strategy
      await learningSystem.learnFromRecovery(mockFlow2, {});
            // Get strategies to avoid
      const strategiesToAvoid = learningSystem.getStrategiesToAvoid('DEADLOCK');
      
      // Verify strategies to avoid
      assert.strictEqual(strategiesToAvoid.length, 2, 'Should have 2 strategies to avoid');
      assert.strictEqual(strategiesToAvoid[0].id, 'strategy-8', 'Most failed strategy should be first');
      assert.strictEqual(strategiesToAvoid[0].failureCount, 2, 'First strategy should have 2 failures');
      assert.strictEqual(strategiesToAvoid[1].id, 'strategy-9', 'Less failed strategy should be second');
      assert.strictEqual(strategiesToAvoid[1].failureCount, 1, 'Second strategy should have 1 failure');
    });
  });
  
  describe('End-to-End Recovery Flow', () => {
    it('should learn from a complete recovery flow', async () => {
      // Clear learning data
      learningSystem.clearLearningData();
      
      // Create a stub for the strategy generator
      const generateStrategyStub = sinon.stub().resolves({
        id: 'strategy-10',
        name: 'Test Strategy',
        actions: [{ actionId: 'test-action', parameters: {} }]
      });
      
      // Replace the original method with the stub
      strategyGenerator.generateStrategy = generateStrategyStub;
      
      // Create mock error
      const mockError = {
        message: 'Connection refused',
        code: 'ECONNREFUSED',
        stack: 'Error: Connection refused\n    at Socket.connect (/path/to/file.js:123:45)'
      };
      
      // Analyze error
      const analysisResult = await causalAnalyzer.analyzeError(mockError, {
        context: {
          component: 'database-service',
          operation: 'query',
          timestamp: Date.now()
        }
      });
      
      // Generate strategy
      const strategy = await strategyGenerator.generateStrategy(analysisResult, {
        context: {
          component: 'database-service',
          operation: 'query'
        }
      });
      
      // Simulate execution (success)
      const executionResult = {
        executionId: 'exec-123',
        strategy,
        successful: true,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        actionResults: [
          {
            actionId: 'reconnect-database',
            successful: true,
            duration: 2000
          },
          {
            actionId: 'verify-connection',
            successful: true,
            duration: 1000
          }
        ]
      };
      
      // Create recovery flow
      const recoveryFlow = {
        id: 'flow-123',
        error: mockError,
        startTime: Date.now() - 10000,
        endTime: Date.now(),
        steps: [
          {
            name: 'analyze',
            startTime: Date.now() - 10000,
            endTime: Date.now() - 8000,
            duration: 2000,
            result: analysisResult
          },
          {
            name: 'generate',
            startTime: Date.now() - 8000,
            endTime: Date.now() - 6000,
            duration: 2000,
            result: strategy
          },
          {
            name: 'execute',
            startTime: Date.now() - 6000,
            endTime: Date.now() - 1000,
            duration: 5000,
            result: executionResult,
            successful: true
          }
        ],
        successful: true
      };
      
      // Learn from recovery flow
      const learningResult = await learningSystem.learnFromRecovery(recoveryFlow, {
        context: {
          component: 'database-service',
          operation: 'query'
        }
      });
      
      // Verify learning result
      assert.strictEqual(learningResult.successful, true, 'Learning should be successful');
      
      // Verify strategy is recommended
      const recommendations = learningSystem.getRecommendedStrategies(analysisResult.rootCauses[0].type);
      assert(recommendations.length > 0, 'Should have at least one recommendation');
      assert(recommendations.some(r => r.id === strategy.id), 'Generated strategy should be recommended');
    });
  });
});
