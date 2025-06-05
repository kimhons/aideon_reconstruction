/**
 * ErrorRecoverySystemIntegrationTest.js
 * 
 * End-to-end integration tests for the complete Autonomous Error Recovery System.
 * Tests the integration between CausalAnalyzer, RecoveryStrategyGenerator, 
 * ResolutionExecutor, and RecoveryLearningSystem components.
 * 
 * @module tests/integration/error_recovery/ErrorRecoverySystemIntegrationTest
 */

'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const EventBus = require('../../../src/core/error_recovery/foundation/EventBus');
const DependencyContainer = require('../../../src/core/error_recovery/foundation/DependencyContainer');
const CausalAnalyzer = require('../../../src/core/error_recovery/CausalAnalyzer');
const RecoveryStrategyGenerator = require('../../../src/core/error_recovery/RecoveryStrategyGenerator');
const ResolutionExecutor = require('../../../src/core/error_recovery/ResolutionExecutor');
const RecoveryLearningSystem = require('../../../src/core/error_recovery/RecoveryLearningSystem');
const AutonomousRecoveryOrchestrator = require('../../../src/core/error_recovery/AutonomousRecoveryOrchestrator');
const MockScalmFramework = require('../../mocks/MockScalmFramework');
const MockKnowledgeFramework = require('../../mocks/MockKnowledgeFramework');
const MockHtnPlanner = require('../../mocks/MockHtnPlanner');
const MockSecurityMonitor = require('../../mocks/MockSecurityMonitor');
const MockMlLayer = require('../../mocks/MockMlLayer');
const MockDistributedManager = require('../../mocks/MockDistributedManager');

describe('Autonomous Error Recovery System - End-to-End Integration Tests', function() {
  // Increase timeout for integration tests
  this.timeout(10000);
  
  let eventBus;
  let dependencyContainer;
  let causalAnalyzer;
  let strategyGenerator;
  let resolutionExecutor;
  let learningSystem;
  let recoveryOrchestrator;
  let mockScalmFramework;
  let mockKnowledgeFramework;
  let mockHtnPlanner;
  let mockSecurityMonitor;
  let mockMlLayer;
  let mockDistributedManager;
  
  beforeEach(async function() {
    // Create event bus
    eventBus = new EventBus();
    
    // Create mock dependencies
    mockScalmFramework = new MockScalmFramework();
    mockKnowledgeFramework = new MockKnowledgeFramework();
    mockHtnPlanner = new MockHtnPlanner();
    mockSecurityMonitor = new MockSecurityMonitor();
    mockMlLayer = new MockMlLayer();
    mockDistributedManager = new MockDistributedManager();
    
    // Create dependency container
    dependencyContainer = new DependencyContainer();
    
    // Register instances using registerInstance instead of register for pre-created objects
    dependencyContainer.registerInstance('eventBus', eventBus);
    dependencyContainer.registerInstance('scalmFramework', mockScalmFramework);
    dependencyContainer.registerInstance('knowledgeFramework', mockKnowledgeFramework);
    dependencyContainer.registerInstance('htnPlanner', mockHtnPlanner);
    dependencyContainer.registerInstance('securityMonitor', mockSecurityMonitor);
    dependencyContainer.registerInstance('mlLayer', mockMlLayer);
    dependencyContainer.registerInstance('distributedManager', mockDistributedManager);
    
    // Create individual components
    causalAnalyzer = new CausalAnalyzer({
      eventBus,
      knowledgeFramework: mockKnowledgeFramework,
      mlLayer: mockMlLayer
    });
    
    strategyGenerator = new RecoveryStrategyGenerator({
      eventBus,
      causalAnalyzer,
      knowledgeFramework: mockKnowledgeFramework,
      scalmFramework: mockScalmFramework,
      htnPlanner: mockHtnPlanner,
      mlLayer: mockMlLayer,
      securityMonitor: mockSecurityMonitor,
      distributedManager: mockDistributedManager
    });
    
    resolutionExecutor = new ResolutionExecutor({
      eventBus,
      scalmFramework: mockScalmFramework,
      knowledgeFramework: mockKnowledgeFramework,
      htnPlanner: mockHtnPlanner,
      securityMonitor: mockSecurityMonitor,
      mlLayer: mockMlLayer,
      distributedManager: mockDistributedManager
    });
    
    learningSystem = new RecoveryLearningSystem({
      eventBus,
      knowledgeFramework: mockKnowledgeFramework,
      mlLayer: mockMlLayer
    });
    
    // Register component factories for any components that need to be created on demand
    dependencyContainer.registerInstance('causalAnalyzer', causalAnalyzer);
    dependencyContainer.registerInstance('strategyGenerator', strategyGenerator);
    dependencyContainer.registerInstance('resolutionExecutor', resolutionExecutor);
    dependencyContainer.registerInstance('learningSystem', learningSystem);
    
    // Create orchestrator with modified constructor to avoid self-registration
    // This prevents the error where AutonomousRecoveryOrchestrator tries to register itself
    const orchestratorOptions = {
      eventBus,
      causalAnalyzer,
      strategyGenerator,
      resolutionExecutor,
      learningSystem,
      dependencyContainer
    };
    
    recoveryOrchestrator = new AutonomousRecoveryOrchestrator(orchestratorOptions);
    
    // Register the orchestrator instance after creation
    dependencyContainer.registerInstance('recoveryOrchestrator', recoveryOrchestrator);
    
    // Initialize components
    await Promise.all([
      causalAnalyzer._initialize ? causalAnalyzer._initialize() : Promise.resolve(),
      strategyGenerator._initialize ? strategyGenerator._initialize() : Promise.resolve(),
      resolutionExecutor._initialize ? resolutionExecutor._initialize() : Promise.resolve(),
      learningSystem._initialize ? learningSystem._initialize() : Promise.resolve(),
      recoveryOrchestrator.initialize ? recoveryOrchestrator.initialize() : Promise.resolve()
    ]);
    
    // Set up spies
    sinon.spy(causalAnalyzer, 'analyzeError');
    sinon.spy(strategyGenerator, 'generateStrategies');
    sinon.spy(resolutionExecutor, 'executeStrategy');
    sinon.spy(learningSystem, 'recordSuccess');
    sinon.spy(learningSystem, 'recordFailure');
  });
  
  afterEach(function() {
    // Restore spies
    sinon.restore();
    
    // Clean up event listeners
    eventBus.removeAllListeners();
  });
  
  describe('End-to-End Recovery Pipeline', function() {
    it('should successfully recover from a network error', async function() {
      // Create a test error
      const networkError = {
        type: 'NetworkError',
        message: 'Connection refused',
        code: 'ECONNREFUSED',
        timestamp: Date.now(),
        context: {
          url: 'https://api.example.com/data',
          method: 'GET',
          retries: 0,
          component: 'DataFetchingService'
        }
      };
      
      // Set up mock knowledge framework to return known patterns for this error
      mockKnowledgeFramework.getErrorPatterns = sinon.stub().returns([
        {
          id: 'pattern1',
          errorType: 'NetworkError',
          confidence: 0.9,
          frequency: 120,
          patterns: [
            { key: 'code', value: 'ECONNREFUSED', weight: 0.8 }
          ]
        }
      ]);
      
      // Set up mock knowledge framework to return strategies for this error pattern
      mockKnowledgeFramework.getStrategiesForPattern = sinon.stub().returns([
        {
          id: 'strategy1',
          patternId: 'pattern1',
          type: 'retry',
          confidence: 0.85,
          successRate: 0.9,
          actions: [
            {
              type: 'retry',
              target: 'DataFetchingService',
              params: {
                delay: 1000,
                maxRetries: 3
              }
            }
          ]
        }
      ]);
      
      // Set up mock ML layer to rank strategies
      mockMlLayer.rank = sinon.stub().resolves({
        success: true,
        ranking: {
          rankedStrategies: [
            {
              id: 'strategy1',
              score: 0.9,
              confidence: 0.85
            }
          ]
        }
      });
      
      // Set up mock for execution
      resolutionExecutor.executeStrategy = sinon.stub().resolves({
        success: true,
        executionId: 'exec1',
        result: {
          retrySuccessful: true,
          retriesNeeded: 2
        },
        executionTimeMs: 2500
      });
      
      // Create a promise that resolves when the learning system records success
      const learningPromise = new Promise((resolve) => {
        eventBus.once('learning:completed', (data) => {
          resolve(data);
        });
      });
      
      // Trigger the recovery process
      await recoveryOrchestrator.recoverFromError(networkError);
      
      // Wait for learning to complete
      const learningResult = await learningPromise;
      
      // Verify the complete pipeline was executed
      expect(causalAnalyzer.analyzeError.calledOnce).to.be.true;
      expect(strategyGenerator.generateStrategies.calledOnce).to.be.true;
      expect(resolutionExecutor.executeStrategy.calledOnce).to.be.true;
      expect(learningSystem.recordSuccess.calledOnce).to.be.true;
      expect(learningSystem.recordFailure.called).to.be.false;
      
      // Verify the error was passed to the causal analyzer
      expect(causalAnalyzer.analyzeError.firstCall.args[0]).to.deep.include({
        type: 'NetworkError',
        message: 'Connection refused'
      });
      
      // Verify the strategy generator received the analysis
      const generatorArgs = strategyGenerator.generateStrategies.firstCall.args[0];
      expect(generatorArgs).to.have.property('patterns');
      expect(generatorArgs.patterns[0]).to.have.property('id', 'pattern1');
      
      // Verify the executor received the strategy
      const executorArgs = resolutionExecutor.executeStrategy.firstCall.args[0];
      expect(executorArgs).to.have.property('id', 'strategy1');
      expect(executorArgs.actions[0]).to.have.property('type', 'retry');
      
      // Verify the learning system recorded the success
      const learningArgs = learningSystem.recordSuccess.firstCall.args;
      expect(learningArgs[0]).to.have.property('id', 'strategy1');
      expect(learningArgs[1]).to.have.property('executionTimeMs');
      
      // Verify the learning completed event
      expect(learningResult).to.have.property('success', true);
      expect(learningResult).to.have.property('strategyId', 'strategy1');
    });
    
    it('should handle recovery failure and try alternative strategies', async function() {
      // Create a test error
      const databaseError = {
        type: 'DatabaseError',
        message: 'Connection timeout',
        code: 'TIMEOUT',
        timestamp: Date.now(),
        context: {
          database: 'users',
          operation: 'query',
          query: 'SELECT * FROM users',
          component: 'DatabaseService'
        }
      };
      
      // Set up mock knowledge framework to return known patterns for this error
      mockKnowledgeFramework.getErrorPatterns = sinon.stub().returns([
        {
          id: 'pattern2',
          errorType: 'DatabaseError',
          confidence: 0.85,
          frequency: 50,
          patterns: [
            { key: 'code', value: 'TIMEOUT', weight: 0.7 }
          ]
        }
      ]);
      
      // Set up mock knowledge framework to return multiple strategies for this error pattern
      mockKnowledgeFramework.getStrategiesForPattern = sinon.stub().returns([
        {
          id: 'strategy2',
          patternId: 'pattern2',
          type: 'retry',
          confidence: 0.7,
          successRate: 0.6,
          actions: [
            {
              type: 'retry',
              target: 'DatabaseService',
              params: {
                delay: 2000,
                maxRetries: 2
              }
            }
          ]
        },
        {
          id: 'strategy3',
          patternId: 'pattern2',
          type: 'fallback',
          confidence: 0.6,
          successRate: 0.8,
          actions: [
            {
              type: 'fallback',
              target: 'DatabaseService',
              params: {
                fallbackMethod: 'cache',
                ttl: 60000
              }
            }
          ]
        }
      ]);
      
      // Set up mock ML layer to rank strategies
      mockMlLayer.rank = sinon.stub().resolves({
        success: true,
        ranking: {
          rankedStrategies: [
            {
              id: 'strategy2',
              score: 0.8,
              confidence: 0.7
            },
            {
              id: 'strategy3',
              score: 0.7,
              confidence: 0.6
            }
          ]
        }
      });
      
      // Set up mock for execution - first strategy fails, second succeeds
      const executeStrategyStub = sinon.stub();
      
      // First call fails
      executeStrategyStub.onFirstCall().resolves({
        success: false,
        executionId: 'exec2',
        error: 'Retry limit exceeded',
        executionTimeMs: 5000
      });
      
      // Second call succeeds
      executeStrategyStub.onSecondCall().resolves({
        success: true,
        executionId: 'exec3',
        result: {
          fallbackSuccessful: true,
          source: 'cache'
        },
        executionTimeMs: 1500
      });
      
      resolutionExecutor.executeStrategy = executeStrategyStub;
      
      // Create a promise that resolves when the learning system records success
      const learningPromise = new Promise((resolve) => {
        eventBus.once('learning:completed', (data) => {
          if (data.success) {
            resolve(data);
          }
        });
      });
      
      // Trigger the recovery process
      await recoveryOrchestrator.recoverFromError(databaseError);
      
      // Wait for learning to complete
      const learningResult = await learningPromise;
      
      // Verify the complete pipeline was executed
      expect(causalAnalyzer.analyzeError.calledOnce).to.be.true;
      expect(strategyGenerator.generateStrategies.calledOnce).to.be.true;
      expect(resolutionExecutor.executeStrategy.calledTwice).to.be.true;
      expect(learningSystem.recordFailure.calledOnce).to.be.true;
      expect(learningSystem.recordSuccess.calledOnce).to.be.true;
      
      // Verify the first strategy failed
      const firstExecutorArgs = resolutionExecutor.executeStrategy.firstCall.args[0];
      expect(firstExecutorArgs).to.have.property('id', 'strategy2');
      expect(firstExecutorArgs.actions[0]).to.have.property('type', 'retry');
      
      // Verify the second strategy succeeded
      const secondExecutorArgs = resolutionExecutor.executeStrategy.secondCall.args[0];
      expect(secondExecutorArgs).to.have.property('id', 'strategy3');
      expect(secondExecutorArgs.actions[0]).to.have.property('type', 'fallback');
      
      // Verify the learning system recorded both failure and success
      const failureArgs = learningSystem.recordFailure.firstCall.args;
      expect(failureArgs[0]).to.have.property('id', 'strategy2');
      expect(failureArgs[1]).to.have.property('error', 'Retry limit exceeded');
      
      const successArgs = learningSystem.recordSuccess.firstCall.args;
      expect(successArgs[0]).to.have.property('id', 'strategy3');
      expect(successArgs[1]).to.have.property('executionTimeMs');
      
      // Verify the learning completed event
      expect(learningResult).to.have.property('success', true);
      expect(learningResult).to.have.property('strategyId', 'strategy3');
    });
    
    it('should handle complex errors requiring multi-step recovery strategies', async function() {
      // Create a complex test error
      const complexError = {
        type: 'SystemError',
        message: 'Resource allocation failed',
        code: 'RESOURCE_EXHAUSTED',
        timestamp: Date.now(),
        context: {
          resource: 'memory',
          requested: '2GB',
          available: '500MB',
          component: 'ResourceManager',
          affectedComponents: ['ImageProcessor', 'DataCache']
        }
      };
      
      // Set up mock knowledge framework to return known patterns for this error
      mockKnowledgeFramework.getErrorPatterns = sinon.stub().returns([
        {
          id: 'pattern3',
          errorType: 'SystemError',
          confidence: 0.95,
          frequency: 30,
          patterns: [
            { key: 'code', value: 'RESOURCE_EXHAUSTED', weight: 0.9 },
            { key: 'context.resource', value: 'memory', weight: 0.8 }
          ]
        }
      ]);
      
      // Set up mock knowledge framework to return a complex strategy for this error pattern
      mockKnowledgeFramework.getStrategiesForPattern = sinon.stub().returns([
        {
          id: 'strategy4',
          patternId: 'pattern3',
          type: 'complex',
          confidence: 0.9,
          successRate: 0.85,
          actions: [
            {
              type: 'deallocate',
              target: 'DataCache',
              params: {
                priority: 'low',
                minSizeToKeep: '100MB'
              },
              phase: 0
            },
            {
              type: 'reconfigure',
              target: 'ImageProcessor',
              params: {
                quality: 'medium',
                batchSize: 5
              },
              phase: 0
            },
            {
              type: 'restart',
              target: 'ResourceManager',
              params: {
                graceful: true,
                timeout: 5000
              },
              phase: 1
            },
            {
              type: 'allocate',
              target: 'ResourceManager',
              params: {
                resource: 'memory',
                size: '2GB',
                priority: 'high'
              },
              phase: 2
            }
          ]
        }
      ]);
      
      // Set up mock ML layer to rank strategies
      mockMlLayer.rank = sinon.stub().resolves({
        success: true,
        ranking: {
          rankedStrategies: [
            {
              id: 'strategy4',
              score: 0.95,
              confidence: 0.9
            }
          ]
        }
      });
      
      // Set up mock for execution - complex strategy succeeds
      resolutionExecutor.executeStrategy = sinon.stub().resolves({
        success: true,
        executionId: 'exec4',
        result: {
          phaseResults: [
            {
              phase: 0,
              success: true,
              actions: [
                { type: 'deallocate', success: true, freedMemory: '300MB' },
                { type: 'reconfigure', success: true, reducedMemoryUsage: '200MB' }
              ]
            },
            {
              phase: 1,
              success: true,
              actions: [
                { type: 'restart', success: true, duration: 3200 }
              ]
            },
            {
              phase: 2,
              success: true,
              actions: [
                { type: 'allocate', success: true, allocatedMemory: '2GB' }
              ]
            }
          ],
          overallSuccess: true
        },
        executionTimeMs: 8500
      });
      
      // Create a promise that resolves when the learning system records success
      const learningPromise = new Promise((resolve) => {
        eventBus.once('learning:completed', (data) => {
          resolve(data);
        });
      });
      
      // Trigger the recovery process
      await recoveryOrchestrator.recoverFromError(complexError);
      
      // Wait for learning to complete
      const learningResult = await learningPromise;
      
      // Verify the complete pipeline was executed
      expect(causalAnalyzer.analyzeError.calledOnce).to.be.true;
      expect(strategyGenerator.generateStrategies.calledOnce).to.be.true;
      expect(resolutionExecutor.executeStrategy.calledOnce).to.be.true;
      expect(learningSystem.recordSuccess.calledOnce).to.be.true;
      
      // Verify the strategy generator received the analysis
      const generatorArgs = strategyGenerator.generateStrategies.firstCall.args[0];
      expect(generatorArgs).to.have.property('patterns');
      expect(generatorArgs.patterns[0]).to.have.property('id', 'pattern3');
      
      // Verify the executor received the complex strategy
      const executorArgs = resolutionExecutor.executeStrategy.firstCall.args[0];
      expect(executorArgs).to.have.property('id', 'strategy4');
      expect(executorArgs.actions).to.have.length(4);
      
      // Verify the learning system recorded the success
      const learningArgs = learningSystem.recordSuccess.firstCall.args;
      expect(learningArgs[0]).to.have.property('id', 'strategy4');
      expect(learningArgs[1]).to.have.property('executionTimeMs');
      
      // Verify the learning completed event
      expect(learningResult).to.have.property('success', true);
      expect(learningResult).to.have.property('strategyId', 'strategy4');
    });
  });
});
