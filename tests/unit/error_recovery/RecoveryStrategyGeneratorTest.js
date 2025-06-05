/**
 * @fileoverview Unit tests for the RecoveryStrategyGenerator component.
 * Tests strategy generation, ranking, adaptation, and caching functionality.
 */

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const RecoveryStrategyGenerator = require('../../../src/core/error_recovery/RecoveryStrategyGenerator');

describe('RecoveryStrategyGenerator', () => {
  let generator;
  let mockContainer;
  let mockTemplateRegistry;
  let mockActionRegistry;
  let mockHistoricalData;
  let mockSemanticTranslator;
  let mockPredictor;
  let mockMetrics;
  let mockLogger;
  let mockEventEmitter;
  
  // Sample test data
  const sampleAnalysisResult = {
    analysisId: 'test-analysis-123',
    errorType: 'connection_failure',
    componentId: 'database_connector',
    rootCauses: [
      { type: 'network_error', description: 'Database connection timeout', confidence: 0.85 }
    ],
    confidence: 0.85,
    recoveryHints: ['restart_connection', 'check_network']
  };
  
  const sampleSystemState = {
    resources: {
      memory: { total: 8192, available: 4096 },
      cpu: { total: 8, available: 4 }
    },
    components: [
      { name: 'database_connector', status: 'error' },
      { name: 'api_service', status: 'running' }
    ]
  };
  
  const sampleTemplates = [
    {
      id: 'template1',
      template: {
        name: 'Basic Recovery Template',
        description: 'A basic template for general error recovery',
        metadata: {
          tags: ['general', 'basic'],
          experimental: false
        },
        createStrategy: async (analysis) => ({
          id: 'strategy-1',
          name: 'Basic Recovery Strategy',
          description: `Recovery strategy for ${analysis.errorType || 'unknown error'}`,
          actions: [
            {
              actionId: 'DiagnoseAction',
              parameters: { depth: 'medium' }
            },
            {
              actionId: 'RestartComponentAction',
              parameters: { componentId: analysis.componentId || 'unknown' }
            }
          ]
        })
      },
      confidence: 0.85
    },
    {
      id: 'template2',
      template: {
        name: 'Advanced Recovery Template',
        description: 'An advanced template for complex error recovery',
        metadata: {
          tags: ['advanced', 'complex'],
          experimental: true
        },
        createStrategy: async (analysis) => ({
          id: 'strategy-2',
          name: 'Advanced Recovery Strategy',
          description: `Advanced recovery for ${analysis.errorType || 'unknown error'}`,
          actions: [
            {
              actionId: 'DeepDiagnoseAction',
              parameters: { depth: 'deep' }
            },
            {
              actionId: 'RepairDataAction',
              parameters: { dataId: analysis.dataId || 'unknown' }
            },
            {
              actionId: 'RestartComponentAction',
              parameters: { componentId: analysis.componentId || 'unknown', mode: 'safe' }
            }
          ]
        })
      },
      confidence: 0.72
    }
  ];
  
  const sampleActions = {
    'DiagnoseAction': {
      name: 'Diagnose Action',
      description: 'Diagnoses the error in more detail',
      resourceHints: { cpu: 0.1, memory: 50, disk: 10, network: 5 },
      estimatedDuration: 2000,
      execute: async (params) => ({ success: true, details: 'Diagnosis complete' })
    },
    'RestartComponentAction': {
      name: 'Restart Component Action',
      description: 'Restarts a component',
      resourceHints: { cpu: 0.2, memory: 100, disk: 20, network: 10 },
      estimatedDuration: 3000,
      potentialSideEffects: [
        { type: 'service_disruption', severity: 'low', description: 'Brief service interruption during restart' }
      ],
      execute: async (params) => ({ success: true, details: `Restarted component ${params.componentId}` })
    },
    'RepairDataAction': {
      name: 'Repair Data Action',
      description: 'Repairs corrupted data',
      resourceHints: { cpu: 0.3, memory: 200, disk: 50, network: 5 },
      estimatedDuration: 5000,
      execute: async (params) => ({ success: true, details: `Repaired data ${params.dataId}` })
    },
    'DeepDiagnoseAction': {
      name: 'Deep Diagnose Action',
      description: 'Performs deep diagnosis of the error',
      resourceHints: { cpu: 0.4, memory: 300, disk: 30, network: 20 },
      estimatedDuration: 8000,
      execute: async (params) => ({ success: true, details: 'Deep diagnosis complete' })
    }
  };
  
  const sampleHistoricalRecommendations = [
    {
      strategyId: 'historical-strategy-1',
      confidence: 0.78,
      successRate: 0.85
    }
  ];
  
  const sampleStrategyPerformance = {
    successRate: 0.82,
    averageExecutionTime: 2500,
    totalExecutions: 45,
    successfulExecutions: 37
  };

  beforeEach(() => {
    // Create mock dependencies
    mockTemplateRegistry = {
      getApplicableTemplates: sinon.stub().resolves(sampleTemplates),
      getTemplate: sinon.stub().callsFake((id) => {
        const template = sampleTemplates.find(t => t.id === id);
        return template ? template.template : null;
      })
    };
    
    mockActionRegistry = {
      getAction: sinon.stub().callsFake((id) => sampleActions[id] || null)
    };
    
    mockHistoricalData = {
      getRecommendations: sinon.stub().resolves(sampleHistoricalRecommendations),
      getStrategyPerformance: sinon.stub().resolves(sampleStrategyPerformance)
    };
    
    mockSemanticTranslator = {
      translateStrategy: sinon.stub().callsFake(async (strategy) => strategy) // Identity translation for testing
    };
    
    mockPredictor = {
      predictStrategyOutcome: sinon.stub().resolves({ successProbability: 0.75 })
    };
    
    mockMetrics = {
      recordMetric: sinon.stub()
    };
    
    mockLogger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
    
    mockEventEmitter = new EventEmitter();
    sinon.spy(mockEventEmitter, 'emit');
    
    mockContainer = {
      resolve: sinon.stub().callsFake(async (name) => {
        switch (name) {
          case 'strategyTemplateRegistry': return mockTemplateRegistry;
          case 'recoveryActionRegistry': return mockActionRegistry;
          case 'historicalDataManager': return mockHistoricalData;
          case 'semanticTranslator': return mockSemanticTranslator;
          case 'bayesianPredictor': return mockPredictor;
          case 'metricsCollector': return mockMetrics;
          default: throw new Error(`Unknown dependency: ${name}`);
        }
      })
    };
    
    // Create generator instance with mocks
    generator = new RecoveryStrategyGenerator({
      container: mockContainer,
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
      config: {
        cacheMaxSize: 10,
        cacheExpirationMs: 60000, // 1 minute for testing
        defaultMaxStrategies: 3,
        defaultMinConfidence: 0.6,
        defaultIncludeExperimental: false,
        defaultUseCache: true,
        defaultUseFallbackStrategy: true,
        rankingWeights: {
          successProbability: 0.5,
          resourceRequirements: 0.1,
          potentialSideEffects: 0.1,
          estimatedExecutionTime: 0.05,
          historicalPerformance: 0.2
        }
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultGenerator = new RecoveryStrategyGenerator({
        container: mockContainer,
        logger: mockLogger
      });
      
      assert.strictEqual(typeof defaultGenerator.config, 'object');
      assert.strictEqual(defaultGenerator.config.cacheMaxSize, 500);
      assert.strictEqual(defaultGenerator.config.defaultMaxStrategies, 5);
    });
    
    it('should initialize dependencies when needed', async () => {
      await generator.initialize();
      
      assert.strictEqual(mockContainer.resolve.callCount, 6);
      assert.strictEqual(mockContainer.resolve.args[0][0], 'strategyTemplateRegistry');
      assert.strictEqual(mockContainer.resolve.args[1][0], 'recoveryActionRegistry');
      assert.strictEqual(mockContainer.resolve.args[2][0], 'historicalDataManager');
      assert.strictEqual(mockContainer.resolve.args[3][0], 'metricsCollector');
      assert.strictEqual(mockContainer.resolve.args[4][0], 'semanticTranslator');
      assert.strictEqual(mockContainer.resolve.args[5][0], 'bayesianPredictor');
    });
    
    it('should handle missing optional dependencies gracefully', async () => {
      mockContainer.resolve.withArgs('semanticTranslator').rejects(new Error('Not found'));
      
      await generator.initialize();
      
      assert.strictEqual(generator.semanticTranslator, undefined);
      assert.strictEqual(mockLogger.warn.callCount, 1);
      assert.ok(mockLogger.warn.args[0][0].includes('semantic features disabled'));
    });
    
    it('should throw error for missing critical dependencies', async () => {
      mockContainer.resolve.withArgs('strategyTemplateRegistry').rejects(new Error('Not found'));
      
      try {
        await generator.initialize();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to initialize'));
      }
    });
  });

  describe('generateStrategies', () => {
    beforeEach(async () => {
      await generator.initialize();
    });
    
    it('should generate strategies from templates', async () => {
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.strictEqual(result.strategies.length, 2);
      assert.strictEqual(result.strategies[0].name, 'Basic Recovery Strategy');
      assert.strictEqual(result.strategies[1].name, 'Advanced Recovery Strategy');
      assert.strictEqual(mockTemplateRegistry.getApplicableTemplates.callCount, 1);
    });
    
    it('should filter out experimental strategies by default', async () => {
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      // Only the non-experimental template should be included
      assert.strictEqual(result.strategies.length, 2);
      assert.strictEqual(result.strategies[0].name, 'Basic Recovery Strategy');
      
      // Now include experimental
      const resultWithExperimental = await generator.generateStrategies('error-123', sampleAnalysisResult, {
        includeExperimental: true
      });
      
      assert.strictEqual(resultWithExperimental.strategies.length, 2);
    });
    
    it('should limit the number of strategies based on maxStrategies option', async () => {
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult, {
        maxStrategies: 1
      });
      
      assert.strictEqual(result.strategies.length, 1);
    });
    
    it('should prioritize strategies based on tags', async () => {
      // Add tags to the strategies for testing
      mockTemplateRegistry.getApplicableTemplates.resolves([
        {
          id: 'template1',
          template: {
            ...sampleTemplates[0].template,
            metadata: { tags: ['network', 'basic'] }
          },
          confidence: 0.85
        },
        {
          id: 'template2',
          template: {
            ...sampleTemplates[1].template,
            metadata: { tags: ['advanced', 'priority'] }
          },
          confidence: 0.72
        }
      ]);
      
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult, {
        priorityTags: ['priority']
      });
      
      // The strategy with 'priority' tag should be first
      assert.strictEqual(result.strategies[0].metadata.tags.includes('priority'), true);
    });
    
    it('should use cache when available', async () => {
      // First call to generate strategies
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      // Reset the stub to verify it's not called again
      mockTemplateRegistry.getApplicableTemplates.resetHistory();
      
      // Second call with same analysis should use cache
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.strictEqual(mockTemplateRegistry.getApplicableTemplates.callCount, 0);
      assert.ok(mockEventEmitter.emit.calledWith('strategy:generation:cached'));
    });
    
    it('should bypass cache when useCache is false', async () => {
      // First call to generate strategies
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      // Reset the stub to verify it's called again
      mockTemplateRegistry.getApplicableTemplates.resetHistory();
      
      // Second call with useCache: false should not use cache
      await generator.generateStrategies('error-123', sampleAnalysisResult, { useCache: false });
      
      assert.strictEqual(mockTemplateRegistry.getApplicableTemplates.callCount, 1);
    });
    
    it('should create fallback strategy when no valid strategies are found', async () => {
      // Make template registry return empty array
      mockTemplateRegistry.getApplicableTemplates.resolves([]);
      mockHistoricalData.getRecommendations.resolves([]);
      
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.strictEqual(result.strategies.length, 1);
      assert.ok(result.strategies[0].metadata.tags.includes('fallback'));
    });
    
    it('should handle errors gracefully and return empty strategies array', async () => {
      mockTemplateRegistry.getApplicableTemplates.rejects(new Error('Test error'));
      
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.strictEqual(result.strategies.length, 0);
      assert.ok(mockEventEmitter.emit.calledWith('strategy:generation:failed'));
    });
    
    it('should emit events during strategy generation', async () => {
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.ok(mockEventEmitter.emit.calledWith('strategy:generation:started'));
      assert.ok(mockEventEmitter.emit.calledWith('strategy:generation:completed'));
    });
    
    it('should record metrics after strategy generation', async () => {
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.ok(mockMetrics.recordMetric.calledWith('strategy_generation_duration'));
      assert.ok(mockMetrics.recordMetric.calledWith('strategies_generated_count'));
    });
  });

  describe('rankStrategies', () => {
    let strategies;
    
    beforeEach(async () => {
      await generator.initialize();
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult);
      strategies = result.strategies;
    });
    
    it('should rank strategies by score', async () => {
      const rankedStrategies = await generator.rankStrategies(strategies, sampleAnalysisResult, sampleSystemState);
      
      assert.strictEqual(rankedStrategies.length, strategies.length);
      assert.ok(rankedStrategies[0].ranking);
      assert.strictEqual(typeof rankedStrategies[0].ranking.score, 'number');
      assert.strictEqual(typeof rankedStrategies[0].ranking.rank, 'number');
    });
    
    it('should include all ranking factors', async () => {
      const rankedStrategies = await generator.rankStrategies(strategies, sampleAnalysisResult, sampleSystemState);
      
      const ranking = rankedStrategies[0].ranking;
      assert.ok(ranking.successProbability);
      assert.ok(ranking.resourceRequirements);
      assert.ok(ranking.estimatedExecutionTime);
      assert.ok(Array.isArray(ranking.potentialSideEffects));
      assert.ok(ranking.rankingFactors);
    });
    
    it('should generate explanations for strategies', async () => {
      const rankedStrategies = await generator.rankStrategies(strategies, sampleAnalysisResult, sampleSystemState);
      
      assert.strictEqual(typeof rankedStrategies[0].explanation, 'string');
      assert.ok(rankedStrategies[0].explanation.includes('Database connection timeout'));
    });
    
    it('should handle errors gracefully', async () => {
      mockPredictor.predictStrategyOutcome.rejects(new Error('Test error'));
      
      try {
        await generator.rankStrategies(strategies, sampleAnalysisResult, sampleSystemState);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(mockEventEmitter.emit.calledWith('strategy:ranking:failed'));
      }
    });
    
    it('should emit events during strategy ranking', async () => {
      await generator.rankStrategies(strategies, sampleAnalysisResult, sampleSystemState);
      
      assert.ok(mockEventEmitter.emit.calledWith('strategy:ranking:started'));
      assert.ok(mockEventEmitter.emit.calledWith('strategy:ranking:completed'));
    });
  });

  describe('adaptStrategy', () => {
    let strategy;
    
    beforeEach(async () => {
      await generator.initialize();
      const result = await generator.generateStrategies('error-123', sampleAnalysisResult);
      strategy = result.strategies[0];
    });
    
    it('should adapt strategy based on system state', async () => {
      // Add an action that should be adapted
      strategy.actions.push({
        actionId: 'AllocateResourceAction',
        parameters: { amount: 5000 } // More than available
      });
      
      const adaptedStrategy = await generator.adaptStrategy(strategy, sampleSystemState);
      
      // Original strategy should not be modified
      assert.strictEqual(strategy.actions[strategy.actions.length - 1].parameters.amount, 5000);
      
      // Adapted strategy should have modified parameters
      assert.strictEqual(adaptedStrategy.actions[adaptedStrategy.actions.length - 1].parameters.amount < 5000, true);
    });
    
    it('should mark actions as skipped when dependencies are unavailable', async () => {
      // Add an action with component dependency
      strategy.actions.push({
        actionId: 'DependentAction',
        parameters: { },
        metadata: { dependsOnComponent: 'missing_component' }
      });
      
      const adaptedStrategy = await generator.adaptStrategy(strategy, sampleSystemState);
      
      // Action should be marked as skipped
      assert.strictEqual(adaptedStrategy.actions[adaptedStrategy.actions.length - 1].skipped, true);
    });
    
    it('should emit events during strategy adaptation', async () => {
      await generator.adaptStrategy(strategy, sampleSystemState);
      
      assert.ok(mockEventEmitter.emit.calledWith('strategy:adapted'));
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      await generator.initialize();
    });
    
    it('should cache strategies with proper key generation', async () => {
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      // Check that cache has an entry
      assert.strictEqual(generator.strategyCache.size, 1);
      
      // Generate with same analysis should use cache
      mockTemplateRegistry.getApplicableTemplates.resetHistory();
      await generator.generateStrategies('error-456', sampleAnalysisResult); // Different error ID, same analysis
      
      assert.strictEqual(mockTemplateRegistry.getApplicableTemplates.callCount, 0);
    });
    
    it('should evict oldest entries when cache is full', async () => {
      // Set small cache size
      generator.config.cacheMaxSize = 2;
      
      // Generate strategies with different analysis results
      await generator.generateStrategies('error-1', { ...sampleAnalysisResult, analysisId: 'analysis-1' });
      await generator.generateStrategies('error-2', { ...sampleAnalysisResult, analysisId: 'analysis-2' });
      
      // Cache should have 2 entries
      assert.strictEqual(generator.strategyCache.size, 2);
      
      // Add one more, should evict oldest
      await generator.generateStrategies('error-3', { ...sampleAnalysisResult, analysisId: 'analysis-3' });
      
      // Cache should still have 2 entries
      assert.strictEqual(generator.strategyCache.size, 2);
      
      // First entry should be evicted
      const hasFirstEntry = Array.from(generator.strategyCache.keys()).some(key => key.includes('analysis-1'));
      assert.strictEqual(hasFirstEntry, false);
    });
    
    it('should expire cache entries after configured time', async () => {
      // Set short expiration
      generator.config.cacheExpirationMs = 1; // 1ms
      
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Generate again, should not use cache
      mockTemplateRegistry.getApplicableTemplates.resetHistory();
      await generator.generateStrategies('error-123', sampleAnalysisResult);
      
      assert.strictEqual(mockTemplateRegistry.getApplicableTemplates.callCount, 1);
    });
    
    it('should handle null or undefined analysis results', async () => {
      // Should not throw error
      await generator.generateStrategies('error-123', null);
      await generator.generateStrategies('error-123', undefined);
      
      // Should log warnings
      assert.ok(mockLogger.warn.called);
    });
  });
});
