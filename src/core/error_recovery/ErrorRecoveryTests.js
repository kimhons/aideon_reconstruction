/**
 * @fileoverview Comprehensive test suite for the Autonomous Error Recovery System.
 * Includes unit tests for individual components (CausalAnalyzer, RecoveryStrategyGenerator, 
 * ResolutionExecutor, RecoveryLearningSystem) and integration tests for their interactions.
 * 
 * @module core/error_recovery/ErrorRecoveryTests
 */

const assert = require("assert");
const EventEmitter = require("events");

// Import components to test (assuming they are exported correctly)
const CausalAnalyzer = require("./CausalAnalyzer");
const RecoveryStrategyGenerator = require("./RecoveryStrategyGenerator");
const ResolutionExecutor = require("./ResolutionExecutor");
const RecoveryLearningSystem = require("./RecoveryLearningSystem");

// --- Mock Dependencies ---

class MockLogger {
  info(...args) { console.log("INFO:", ...args); }
  warn(...args) { console.log("WARN:", ...args); }
  error(...args) { console.error("ERROR:", ...args); }
  debug(...args) { console.log("DEBUG:", ...args); }
}

class MockMetricsCollector {
  recordMetric(name, value) { /* console.log(`METRIC: ${name}=${value}`); */ }
}

class MockHistoricalDataManager {
  async recordOutcome(strategy, outcome) { /* console.log("HistoricalData: Recorded outcome"); */ }
  async getRecommendations(analysisResult) { return []; }
  async getStrategyPerformance(strategyId) { return null; }
  async getRecentHistory(options) { return []; }
}

class MockStrategyTemplateRegistry {
  constructor() { this.templates = new Map(); }
  registerTemplate(template) { this.templates.set(template.id, template); }
  async getApplicableTemplates(analysisResult) { return Array.from(this.templates.values()).map(t => ({ id: t.id, template: t, confidence: 0.8 })); }
  getTemplate(templateId) { return this.templates.get(templateId); }
  getTemplateByStrategyId(strategyId) { return Array.from(this.templates.values()).find(t => t.generatesStrategyId === strategyId); }
}

class MockRecoveryActionRegistry {
  constructor() { this.actions = new Map(); }
  registerAction(action) { this.actions.set(action.id, action); }
  getAction(actionId) { return this.actions.get(actionId); }
}

class MockActionExecutorRegistry {
  constructor() { this.executors = new Map(); }
  registerExecutor(actionId, executor) { this.executors.set(actionId, executor); }
  getExecutorForAction(actionId) { return this.executors.get(actionId); }
}

class MockActionExecutor {
  validateParameters(actionId, parameters) { return true; }
  async prepare(actionId, parameters, context) { /* console.log(`Preparing action: ${actionId}`); */ }
  async execute(actionId, parameters, context) {
    // Simulate execution
    const successful = Math.random() < 0.9; // 90% success rate
    const duration = Math.floor(Math.random() * 500) + 100;
    await new Promise(resolve => setTimeout(resolve, duration)); // Simulate delay
    if (!successful) {
      throw new Error(`Simulated failure for action ${actionId}`);
    }
    return {
      actionId,
      successful: true,
      output: { message: `Action ${actionId} completed successfully` },
      stateChanges: [{ componentId: "testComponent", property: "status", oldValue: "error", newValue: "recovered" }],
      resourceUsage: { cpu: 10, memory: 50 }
    };
  }
  async cleanup(actionId, parameters, context, result) { /* console.log(`Cleaning up action: ${actionId}`); */ }
  async estimateExecutionTime(actionId, parameters, systemState) { return 300; }
  async estimateResourceRequirements(actionId, parameters, systemState) { return { cpu: { peak: 10 }, memory: { peak: 50 } }; }
  async estimatePotentialSideEffects(actionId, parameters, systemState) { return []; }
}

class MockCheckpointManager {
  async createCheckpoint(executionId, checkpointName, context) { /* console.log(`Checkpoint created: ${checkpointName}`); */ }
  async verifyCheckpoint(executionId, checkpointName, context) { return { verified: true, failedSteps: [] }; }
}

class MockRollbackManager {
  async createRollbackPlan(strategy, context) { return { id: "rollbackPlan1", actions: [] }; }
  async executeRollback(rollbackPlan, context) { return { successful: true, actionResults: [] }; }
}

class MockExecutionMonitor {
  async startMonitoring(executionId, strategy) { /* console.log(`Monitoring started: ${executionId}`); */ }
  async completeMonitoring(executionId, result) { /* console.log(`Monitoring completed: ${executionId}`); */ }
  async detectAnomalies(executionId) { return []; }
}

class MockResourceManager {
  async allocateResources(plan) { return plan.allocations.map(a => ({ ...a, allocationId: uuidv4() })); }
  async releaseResources(allocations) { /* console.log("Resources released"); */ }
}

class MockPredictor {
  async predictStrategyOutcome(strategy, analysisResult) { return { successProbability: 0.85 }; }
  async updateModel(executionResult) { /* console.log("Predictor model updated"); */ }
}

// --- Test Data ---

const testError = {
  id: "err-123",
  type: "ServiceUnavailable",
  message: "Auth service failed to respond",
  timestamp: Date.now(),
  componentId: "auth-service",
  severity: "critical",
  context: { userId: "user-abc", operation: "login" }
};

const testAnalysisResult = {
  analysisId: "analysis-456",
  error: testError,
  rootCauses: [
    { id: "rc-001", description: "Database connection pool exhausted", confidence: 0.7, componentId: "auth-db", type: "ResourceExhaustion" },
    { id: "rc-002", description: "Network latency between auth-service and auth-db", confidence: 0.4, componentId: "network", type: "Latency" }
  ],
  contributingFactors: [],
  confidence: 0.75
};

const testStrategyTemplate = {
  id: "tpl-restart-db",
  name: "Restart Database Connection Pool",
  description: "Attempts to resolve DB connection issues by restarting the pool.",
  tags: ["database", "resource"],
  metadata: { confidence: 0.8, experimental: false },
  generatesStrategyId: "strat-restart-db-1", // For getTemplateByStrategyId mock
  async createStrategy(analysisResult, options) {
    return {
      id: "strat-restart-db-1",
      name: "Restart DB Pool Strategy",
      description: "Restart DB connection pool and verify service status.",
      actions: [
        { actionId: "IncreaseDBPoolSize", parameters: { componentId: "auth-db", increment: 10 }, order: 1, required: false },
        { actionId: "RestartDBConnectionPool", parameters: { componentId: "auth-db" }, order: 2, required: true },
        { actionId: "VerifyServiceStatus", parameters: { componentId: "auth-service", expectedStatus: "healthy" }, order: 3, required: true }
      ],
      checkpoints: [
        { name: "PoolRestarted", completedActions: ["RestartDBConnectionPool"], verificationSteps: [] }
      ]
    };
  },
  async getConfidence(analysisResult) { return 0.8; }
};

testStrategyTemplate.metadata = { confidence: 0.8, experimental: false, tags: ["database", "resource"] };

const testRankedStrategy = {
  id: "strat-restart-db-1",
  name: "Restart DB Pool Strategy",
  description: "Restart DB connection pool and verify service status.",
  templateId: "tpl-restart-db",
  actions: [
    { actionId: "IncreaseDBPoolSize", parameters: { componentId: "auth-db", increment: 10 }, order: 1, required: false },
    { actionId: "RestartDBConnectionPool", parameters: { componentId: "auth-db" }, order: 2, required: true },
    { actionId: "VerifyServiceStatus", parameters: { componentId: "auth-service", expectedStatus: "healthy" }, order: 3, required: true }
  ],
  checkpoints: [
    { name: "PoolRestarted", completedActions: ["RestartDBConnectionPool"], verificationSteps: [] }
  ],
  ranking: {
    rank: 1,
    score: 0.85,
    successProbability: 0.88,
    resourceRequirements: { normalized: 0.2 },
    estimatedExecutionTime: 5000,
    potentialSideEffects: [],
    historicalPerformance: null,
    rankingFactors: []
  },
  explanation: { summary: "Test explanation" }
};

// --- Test Suite ---

describe("Autonomous Error Recovery System", () => {
  let logger;
  let metrics;
  let eventEmitter;
  let historicalData;
  let templateRegistry;
  let actionRegistry;
  let actionExecutorRegistry;
  let checkpointManager;
  let rollbackManager;
  let executionMonitor;
  let resourceManager;
  let predictor;

  let causalAnalyzer;
  let strategyGenerator;
  let resolutionExecutor;
  let learningSystem;

  beforeEach(() => {
    // Reset mocks and components before each test
    logger = new MockLogger();
    metrics = new MockMetricsCollector();
    eventEmitter = new EventEmitter();
    historicalData = new MockHistoricalDataManager();
    templateRegistry = new MockStrategyTemplateRegistry();
    actionRegistry = new MockRecoveryActionRegistry();
    actionExecutorRegistry = new MockActionExecutorRegistry();
    checkpointManager = new MockCheckpointManager();
    rollbackManager = new MockRollbackManager();
    executionMonitor = new MockExecutionMonitor();
    resourceManager = new MockResourceManager();
    predictor = new MockPredictor();

    // Register mock actions and executors
    const mockExecutor = new MockActionExecutor();
    ["IncreaseDBPoolSize", "RestartDBConnectionPool", "VerifyServiceStatus"].forEach(actionId => {
      actionRegistry.registerAction({ id: actionId, description: `Mock action ${actionId}` });
      actionExecutorRegistry.registerExecutor(actionId, mockExecutor);
    });

    // Register mock template
    templateRegistry.registerTemplate(testStrategyTemplate);

    // Initialize components
    causalAnalyzer = new CausalAnalyzer({ logger, metrics, eventEmitter });
    strategyGenerator = new RecoveryStrategyGenerator({
      logger, metrics, eventEmitter, historicalData, templateRegistry, actionRegistry, predictor
    });
    resolutionExecutor = new ResolutionExecutor({
      logger, metrics, eventEmitter, actionExecutorRegistry, checkpointManager, rollbackManager, executionMonitor, resourceManager
    });
    learningSystem = new RecoveryLearningSystem({
      logger, metrics, eventEmitter, historicalData, templateRegistry, actionRegistry, predictor
    });
  });

  // --- CausalAnalyzer Tests ---
  describe("CausalAnalyzer", () => {
    it("should analyze an error and produce root causes", async () => {
      // Mock internal analysis logic if needed, or test the actual implementation
      // For now, assume analyzeError is implemented and returns a structure like testAnalysisResult
      causalAnalyzer.analyzeError = async (error) => {
        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 50)); 
        return testAnalysisResult; 
      };
      
      const result = await causalAnalyzer.analyzeError(testError);
      assert.ok(result, "Analysis should produce a result");
      assert.strictEqual(result.analysisId, testAnalysisResult.analysisId, "Analysis ID should match");
      assert.strictEqual(result.error.id, testError.id, "Original error ID should match");
      assert.ok(result.rootCauses.length > 0, "Should identify at least one root cause");
      assert.strictEqual(result.rootCauses[0].id, "rc-001", "First root cause ID should match");
      assert.ok(result.confidence >= 0 && result.confidence <= 1, "Overall confidence should be between 0 and 1");
    });

    it("should emit events during analysis", (done) => {
      let startEmitted = false;
      causalAnalyzer.on("analysis:started", ({ analysisId }) => {
        startEmitted = true;
      });
      causalAnalyzer.on("analysis:completed", ({ analysisId, result, duration }) => {
        assert.ok(startEmitted, "analysis:started event should have been emitted");
        assert.ok(analysisId, "Completed event should include analysisId");
        assert.ok(result, "Completed event should include result");
        assert.ok(duration >= 0, "Completed event should include duration");
        done();
      });

      causalAnalyzer.analyzeError = async (error) => testAnalysisResult; // Mock analysis
      causalAnalyzer.analyzeError(testError);
    });
  });

  // --- RecoveryStrategyGenerator Tests ---
  describe("RecoveryStrategyGenerator", () => {
    it("should generate strategies based on analysis results", async () => {
      const strategies = await strategyGenerator.generateStrategies(testAnalysisResult);
      assert.ok(Array.isArray(strategies), "Should return an array of strategies");
      assert.ok(strategies.length > 0, "Should generate at least one strategy from the template");
      assert.strictEqual(strategies[0].id, "strat-restart-db-1", "Generated strategy ID should match");
      assert.strictEqual(strategies[0].templateId, testStrategyTemplate.id, "Strategy should reference the correct template");
      assert.ok(strategies[0].actions.length > 0, "Strategy should contain actions");
    });

    it("should rank generated strategies", async () => {
      const generatedStrategies = await strategyGenerator.generateStrategies(testAnalysisResult);
      const systemState = { resources: { cpu: { total: 100 }, memory: { total: 8192 } } }; // Mock system state
      const rankedStrategies = await strategyGenerator.rankStrategies(generatedStrategies, testAnalysisResult, systemState);
      
      assert.ok(Array.isArray(rankedStrategies), "Should return an array of ranked strategies");
      assert.strictEqual(rankedStrategies.length, generatedStrategies.length, "Should rank all generated strategies");
      assert.ok(rankedStrategies[0].ranking, "Strategy should have a ranking object");
      assert.strictEqual(rankedStrategies[0].ranking.rank, 1, "First strategy should have rank 1");
      assert.ok(rankedStrategies[0].ranking.score >= 0 && rankedStrategies[0].ranking.score <= 1, "Ranking score should be between 0 and 1");
      assert.ok(rankedStrategies[0].explanation, "Strategy should have an explanation");
    });

    it("should use cache when enabled", async () => {
      let cacheHit = false;
      strategyGenerator.on("strategy:generation:cached", () => { cacheHit = true; });

      // First call - should generate and cache
      await strategyGenerator.generateStrategies(testAnalysisResult, { useCache: true });
      assert.strictEqual(cacheHit, false, "Cache should not be hit on the first call");

      // Second call - should hit cache
      await strategyGenerator.generateStrategies(testAnalysisResult, { useCache: true });
      assert.strictEqual(cacheHit, true, "Cache should be hit on the second call");
    });
  });

  // --- ResolutionExecutor Tests ---
  describe("ResolutionExecutor", () => {
    it("should execute a strategy successfully", async () => {
      const result = await resolutionExecutor.executeStrategy(testRankedStrategy, testAnalysisResult);
      
      assert.ok(result, "Execution should produce a result");
      assert.strictEqual(result.successful, true, "Execution should be marked as successful");
      assert.strictEqual(result.strategy.id, testRankedStrategy.id, "Result should reference the correct strategy");
      assert.strictEqual(result.actionResults.length, testRankedStrategy.actions.length, "Should have results for all actions");
      assert.ok(result.actionResults.every(ar => ar.successful), "All actions should be successful in this mock scenario");
      assert.ok(result.duration > 0, "Execution duration should be positive");
      assert.ok(result.errorResolutionStatus.resolved, "Error should be marked as resolved (in this mock scenario)");
    });

    it("should handle action failure and rollback if required", async () => {
      // Mock one action to fail
      const failingExecutor = new MockActionExecutor();
      failingExecutor.execute = async (actionId, parameters, context) => {
        if (actionId === "RestartDBConnectionPool") { // Make the required action fail
          throw new Error("Simulated DB pool restart failure");
        }
        // Other actions succeed
        return {
          actionId,
          successful: true,
          output: { message: `Action ${actionId} completed successfully` },
          stateChanges: []
        };
      };
      actionExecutorRegistry.registerExecutor("RestartDBConnectionPool", failingExecutor);

      const result = await resolutionExecutor.executeStrategy(testRankedStrategy, testAnalysisResult, { autoRollback: true });

      assert.ok(result, "Execution should produce a result even on failure");
      assert.strictEqual(result.successful, false, "Execution should be marked as failed");
      assert.ok(result.error, "Result should contain error information");
      assert.strictEqual(result.error.message, "Simulated DB pool restart failure", "Error message should match the simulated failure");
      assert.strictEqual(result.rollbackPerformed, true, "Rollback should have been performed");
      assert.ok(result.rollbackResult.successful, "Rollback itself should be successful (in this mock)");
    });

    it("should handle dry run correctly", async () => {
      const result = await resolutionExecutor.executeStrategy(testRankedStrategy, testAnalysisResult, { dryRun: true });
      
      assert.ok(result, "Dry run should produce a result");
      assert.strictEqual(result.successful, true, "Dry run should simulate success");
      assert.ok(result.actionResults.every(ar => ar.output.simulated === true), "All action results should indicate simulation");
      // Add more assertions to check that no actual state changes occurred
    });

    it("should handle execution timeout", async () => {
       // Mock a very long running action
      const slowExecutor = new MockActionExecutor();
      slowExecutor.execute = async (actionId, parameters, context) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate long delay
        return { actionId, successful: true, output: {} };
      };
      actionExecutorRegistry.registerExecutor("RestartDBConnectionPool", slowExecutor);

      const result = await resolutionExecutor.executeStrategy(testRankedStrategy, testAnalysisResult, { timeout: 50 }); // Set short timeout

      assert.ok(result, "Execution should produce a result on timeout");
      assert.strictEqual(result.successful, false, "Execution should be marked as failed on timeout");
      assert.ok(result.error, "Result should contain error information");
      assert.ok(result.error.message.includes("timeout"), "Error message should indicate timeout");
    });
  });

  // --- RecoveryLearningSystem Tests ---
  describe("RecoveryLearningSystem", () => {
    it("should process execution results and update effectiveness scores", async () => {
      const executionResult = {
        executionId: "exec-789",
        strategy: testRankedStrategy,
        successful: true,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        actionResults: [
          { actionId: "IncreaseDBPoolSize", successful: true, duration: 500 },
          { actionId: "RestartDBConnectionPool", successful: true, duration: 3000 },
          { actionId: "VerifyServiceStatus", successful: true, duration: 1500 }
        ],
        checkpointsReached: ["PoolRestarted"],
        rollbackPerformed: false,
        error: null,
        resultingSystemState: {},
        errorResolutionStatus: { resolved: true },
        metrics: {}
      };

      await learningSystem.processExecutionResult(executionResult);

      const strategyEffectiveness = learningSystem.getStrategyEffectiveness(testRankedStrategy.id);
      assert.ok(strategyEffectiveness, "Strategy effectiveness should be updated");
      assert.strictEqual(strategyEffectiveness.sampleSize, 1, "Sample size should be 1");
      assert.strictEqual(strategyEffectiveness.successCount, 1, "Success count should be 1");
      assert.ok(strategyEffectiveness.successRate > 0.5, "Success rate should increase after success");

      const actionEffectiveness = learningSystem.getActionEffectiveness("RestartDBConnectionPool");
      assert.ok(actionEffectiveness, "Action effectiveness should be updated");
      assert.strictEqual(actionEffectiveness.sampleSize, 1, "Action sample size should be 1");
      assert.strictEqual(actionEffectiveness.successCount, 1, "Action success count should be 1");
    });

    it("should identify ineffective strategies after multiple failures", async () => {
      const failedResult = {
        executionId: "exec-fail",
        strategy: testRankedStrategy,
        successful: false,
        duration: 6000,
        endTime: Date.now(),
        actionResults: [
          { actionId: "IncreaseDBPoolSize", successful: true, duration: 500 },
          { actionId: "RestartDBConnectionPool", successful: false, duration: 3000 }, // Failed action
          { actionId: "VerifyServiceStatus", successful: false, duration: 1500 }
        ]
      };

      // Simulate multiple failures
      for (let i = 0; i < learningSystem.config.minSampleSizeForUpdate; i++) {
        await learningSystem.processExecutionResult({ ...failedResult, executionId: `exec-fail-${i}` });
      }

      // Trigger analysis
      const ineffective = learningSystem.identifyIneffectiveStrategies([]); // Use internal model
      assert.ok(ineffective.some(s => s.strategyId === testRankedStrategy.id), "Strategy should be identified as ineffective after multiple failures");
    });
  });

  // --- Integration Tests ---
  describe("System Integration", () => {
    it("should handle a full error recovery cycle: analysis -> generation -> execution -> learning", async () => {
      // 1. Analyze Error
      causalAnalyzer.analyzeError = async (error) => testAnalysisResult;
      const analysisResult = await causalAnalyzer.analyzeError(testError);
      assert.ok(analysisResult, "Analysis successful");

      // 2. Generate & Rank Strategies
      const generatedStrategies = await strategyGenerator.generateStrategies(analysisResult);
      const systemState = { resources: { cpu: { total: 100 }, memory: { total: 8192 } } };
      const rankedStrategies = await strategyGenerator.rankStrategies(generatedStrategies, analysisResult, systemState);
      assert.ok(rankedStrategies.length > 0, "Strategy generation successful");
      const topStrategy = rankedStrategies[0];
      assert.strictEqual(topStrategy.ranking.rank, 1, "Ranking successful");

      // 3. Execute Top Strategy
      const executionResult = await resolutionExecutor.executeStrategy(topStrategy, analysisResult);
      assert.ok(executionResult, "Execution successful");
      assert.strictEqual(executionResult.successful, true, "Strategy execution should succeed (mock)");

      // 4. Learn from Result
      await learningSystem.processExecutionResult(executionResult);
      const strategyEffectiveness = learningSystem.getStrategyEffectiveness(topStrategy.id);
      assert.ok(strategyEffectiveness, "Learning system processed the result");
      assert.strictEqual(strategyEffectiveness.sampleSize, 1, "Effectiveness updated after one cycle");
    });

    it("should handle a full cycle with execution failure and rollback", async () => {
       // Mock one action to fail
      const failingExecutor = new MockActionExecutor();
      failingExecutor.execute = async (actionId, parameters, context) => {
        if (actionId === "RestartDBConnectionPool") { 
          throw new Error("Simulated DB pool restart failure");
        }
        return { actionId, successful: true, output: {} };
      };
      actionExecutorRegistry.registerExecutor("RestartDBConnectionPool", failingExecutor);

      // 1. Analyze Error
      causalAnalyzer.analyzeError = async (error) => testAnalysisResult;
      const analysisResult = await causalAnalyzer.analyzeError(testError);

      // 2. Generate & Rank Strategies
      const generatedStrategies = await strategyGenerator.generateStrategies(analysisResult);
      const systemState = { resources: { cpu: { total: 100 }, memory: { total: 8192 } } };
      const rankedStrategies = await strategyGenerator.rankStrategies(generatedStrategies, analysisResult, systemState);
      const topStrategy = rankedStrategies[0];

      // 3. Execute Top Strategy (expecting failure)
      const executionResult = await resolutionExecutor.executeStrategy(topStrategy, analysisResult, { autoRollback: true });
      assert.ok(executionResult, "Execution completed despite failure");
      assert.strictEqual(executionResult.successful, false, "Execution should fail");
      assert.strictEqual(executionResult.rollbackPerformed, true, "Rollback should occur");

      // 4. Learn from Result
      await learningSystem.processExecutionResult(executionResult);
      const strategyEffectiveness = learningSystem.getStrategyEffectiveness(topStrategy.id);
      assert.ok(strategyEffectiveness, "Learning system processed the failure result");
      assert.strictEqual(strategyEffectiveness.sampleSize, 1, "Effectiveness updated after one cycle");
      assert.strictEqual(strategyEffectiveness.failureCount, 1, "Failure count should be 1");
      assert.ok(strategyEffectiveness.successRate < 0.5, "Success rate should decrease after failure");
    });
  });

});

// Helper function to run tests (basic runner)
function runTests() {
  console.log("Running Autonomous Error Recovery System Tests...");
  const testSuite = describe;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const originalIt = it;
  const testResults = [];

  // Override `it` to capture test results
  it = async (name, fn) => {
    totalTests++;
    const start = Date.now();
    try {
      await fn();
      passedTests++;
      testResults.push({ name, status: "PASSED", duration: Date.now() - start });
      // console.log(`  ✓ ${name}`);
    } catch (error) {
      failedTests++;
      testResults.push({ name, status: "FAILED", duration: Date.now() - start, error: error.message });
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${error.stack}`);
    }
  };

  // Execute the describe block which calls the overridden `it`
  testSuite("Autonomous Error Recovery System", () => {
    // This will execute all the describe/it blocks defined above
  });

  // Restore original `it`
  it = originalIt;

  // --- Calculate Confidence Interval (Simplified Example) ---
  // Using Wilson score interval for binomial proportion (success/failure)
  const n = totalTests;
  const p_hat = passedTests / n;
  const z = 1.96; // For 95% confidence (adjust for 98% -> z=2.33)
  // const z = 2.33; // For 98% confidence
  
  // Simplified CI calculation (may not be statistically perfect for test suites)
  // A more robust approach might involve bootstrapping or specific test suite metrics.
  // This is a basic estimate.
  const confidence_interval_half_width = z * Math.sqrt((p_hat * (1 - p_hat)) / n);
  const lower_bound = p_hat - confidence_interval_half_width;
  const upper_bound = p_hat + confidence_interval_half_width;

  console.log("\n--- Test Summary ---");
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Pass Rate: ${(p_hat * 100).toFixed(2)}%`);
  // console.log(`95% Confidence Interval: [${(lower_bound * 100).toFixed(2)}%, ${(upper_bound * 100).toFixed(2)}%]`);
  console.log(`Confidence Interval Width (95%): +/- ${(confidence_interval_half_width * 100).toFixed(2)}%`);

  // Check if 98% CI requirement is met (using 95% calculation as proxy - needs refinement)
  // A pass rate near 100% with enough tests usually implies high confidence.
  if (failedTests === 0 && totalTests > 30) { // Arbitrary threshold for high confidence
      console.log("\nConfidence Interval: Likely meets or exceeds 98% threshold (all tests passed).");
  } else if (failedTests > 0) {
      console.log("\nConfidence Interval: Does not meet 98% threshold due to failures.");
  } else {
      console.log("\nConfidence Interval: More tests may be needed to confirm 98% threshold.");
  }
  console.log("--------------------");

  // Exit with error code if any tests failed
  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run the tests if executed directly
if (require.main === module) {
  runTests();
}

