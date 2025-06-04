/**
 * @fileoverview Comprehensive test suite for the Predictive Intelligence Engine components.
 * 
 * @module core/predictive/PredictiveTests
 */

const assert = require("assert");
const EventEmitter = require("events");

// --- Import Components Under Test ---
const {
    PatternRecognizer,
    TemporalPatternRecognizer,
    TemporalPattern,
    SequentialPattern,
    DefaultPatternStorage,
    DefaultPatternMatcher,
    PatternType
} = require("./PatternRecognizer");

const {
    BayesianPredictor,
    DiscreteBayesianPredictor,
    PredictionType
} = require("./BayesianPredictor");

const {
    ResourcePreallocator,
    ResourceType,
    AllocationStatus,
    MockResourceMonitor,
    MemoryAllocationStrategy,
    CPUAllocationStrategy
} = require("./ResourcePreallocator");

const {
    PredictiveTaskExecutor,
    TaskStatus,
    TaskPriority,
    TaskTrigger,
    MockHTNPlanner,
    MockMCP
} = require("./PredictiveTaskExecutor");

// --- Mock Dependencies ---

class MockLogger {
    info(...args) { /* console.log("[INFO]", ...args); */ }
    debug(...args) { /* console.log("[DEBUG]", ...args); */ }
    warn(...args) { console.warn("[WARN]", ...args); }
    error(...args) { console.error("[ERROR]", ...args); }
}

class MockMetricsCollector {
    recordMetric(name, data) { /* console.log(`Metric: ${name}`, data); */ }
}

class MockPredictor extends EventEmitter {
    id = "mock-predictor-123";
    constructor() {
        super();
    }
    on(eventName, listener) { super.on(eventName, listener); }
    off(eventName, listener) { super.off(eventName, listener); }
    // Mock methods needed by consumers
    async updateModel(feedback) { return true; }
}

// --- Test Suite ---

describe("Predictive Intelligence Engine", () => {
    let logger;
    let metrics;
    let eventEmitter;

    beforeEach(() => {
        logger = new MockLogger();
        metrics = new MockMetricsCollector();
        eventEmitter = new EventEmitter();
    });

    // --- PatternRecognizer Tests ---
    describe("PatternRecognizer", () => {
        let storage;
        let matcher;
        let recognizer;

        beforeEach(() => {
            storage = new DefaultPatternStorage(logger);
            matcher = new DefaultPatternMatcher({}, logger);
            recognizer = new TemporalPatternRecognizer({
                patternType: PatternType.TEMPORAL,
                storage,
                matcher,
                eventEmitter,
                metrics,
                logger
            });
        });

        it("should initialize correctly", () => {
            assert.strictEqual(recognizer.patternType, PatternType.TEMPORAL);
            assert.ok(recognizer.id);
            assert.ok(recognizer.eventEmitter);
        });

        it("should add and retrieve a pattern", async () => {
            const pattern = new TemporalPattern({ confidence: 0.8, periodicity: 1000 });
            const patternId = recognizer.addPattern(pattern);
            assert.strictEqual(patternId, pattern.id);
            const retrievedPattern = recognizer.getPattern(patternId);
            assert.strictEqual(retrievedPattern, pattern);
            assert.strictEqual(recognizer.getAllPatterns().length, 1);
            
            // Check storage
            const loadedPattern = await storage.loadPattern(patternId);
            assert.strictEqual(loadedPattern.id, patternId);
            assert.strictEqual(loadedPattern.confidence, 0.8);
        });

        it("should remove a pattern", () => {
            const pattern = new TemporalPattern({});
            const patternId = recognizer.addPattern(pattern);
            assert.strictEqual(recognizer.getAllPatterns().length, 1);
            const removed = recognizer.removePattern(patternId);
            assert.strictEqual(removed, true);
            assert.strictEqual(recognizer.getAllPatterns().length, 0);
            assert.throws(() => recognizer.getPattern(patternId), /not found/);
        });

        it("should update a pattern", () => {
            const pattern = new TemporalPattern({ confidence: 0.6 });
            const patternId = recognizer.addPattern(pattern);
            const updateData = { confidence: 0.9 }; // Example update data
            const updated = recognizer.updatePattern(patternId, updateData);
            assert.strictEqual(updated, true);
            const retrievedPattern = recognizer.getPattern(patternId);
            // Note: The mock update method doesn't change confidence directly
            // It updates metadata. We check if metadata was updated.
            assert.ok(retrievedPattern.metadata.updatedAt > pattern.metadata.updatedAt);
        });

        it("should detect patterns based on matcher", async () => {
            const pattern1 = new TemporalPattern({ confidence: 0.9, featureThresholds: { value: [0, 10] } });
            const pattern2 = new TemporalPattern({ confidence: 0.7, featureThresholds: { value: [11, 20] } });
            recognizer.addPattern(pattern1);
            recognizer.addPattern(pattern2);

            const data1 = { value: 5 };
            const matches1 = await recognizer.detectPatterns(data1);
            assert.strictEqual(matches1.length, 1);
            assert.strictEqual(matches1[0].patternId, pattern1.id);
            assert.strictEqual(matches1[0].confidence, 0.9);

            const data2 = { value: 15 };
            const matches2 = await recognizer.detectPatterns(data2);
            assert.strictEqual(matches2.length, 1);
            assert.strictEqual(matches2[0].patternId, pattern2.id);
            assert.strictEqual(matches2[0].confidence, 0.7);

            const data3 = { value: 25 };
            const matches3 = await recognizer.detectPatterns(data3);
            assert.strictEqual(matches3.length, 0);
        });

        it("should handle training (mocked)", async () => {
            const trainingData = { samples: [{ value: 1 }, { value: 2 }] };
            const result = await recognizer.train(trainingData);
            assert.strictEqual(result.success, true);
            // Mock training doesn't add patterns in this setup
            assert.strictEqual(result.patternsDetected, 0);
        });

        it("should emit events", (done) => {
            const pattern = new TemporalPattern({});
            let added = false;
            let detected = false;

            recognizer.on("pattern:added", (payload) => {
                assert.strictEqual(payload.patternId, pattern.id);
                added = true;
            });
            recognizer.on("pattern:detected", (match) => {
                assert.strictEqual(match.patternId, pattern.id);
                detected = true;
                if (added && detected) done();
            });

            recognizer.addPattern(pattern);
            recognizer.detectPatterns({ value: 5 }); // Assuming pattern matches this
        });
    });

    // --- BayesianPredictor Tests ---
    describe("BayesianPredictor", () => {
        let predictor;

        beforeEach(() => {
            predictor = new DiscreteBayesianPredictor({
                predictionType: PredictionType.USER_ACTION,
                eventEmitter,
                metrics,
                logger
            });
        });

        it("should initialize correctly", () => {
            assert.strictEqual(predictor.predictionType, PredictionType.USER_ACTION);
            assert.ok(predictor.id);
            assert.ok(predictor.bayesianNetwork);
        });

        it("should handle training (mocked)", async () => {
            const trainingData = { samples: [{ input: "a", output: "b" }] };
            const result = await predictor.train(trainingData);
            assert.strictEqual(result.success, true);
            assert.ok(result.modelId);
            assert.ok(result.modelVersion);
        });

        it("should generate predictions (mocked inference)", async () => {
            const input = {
                context: { userActivity: "typing", systemLoad: "low" },
                targetVariables: ["nextAction", "resourceNeed"]
            };
            const predictions = await predictor.predict(input);
            
            assert.strictEqual(predictions.length, 2);
            
            const nextActionPred = predictions.find(p => p.targetVariable === "nextAction");
            assert.ok(nextActionPred);
            assert.strictEqual(nextActionPred.type, PredictionType.USER_ACTION);
            assert.ok(nextActionPred.id);
            assert.ok(nextActionPred.confidence >= 0 && nextActionPred.confidence <= 1);
            assert.ok(nextActionPred.probabilityDistribution);
            assert.ok(nextActionPred.explanation);

            const resourceNeedPred = predictions.find(p => p.targetVariable === "resourceNeed");
            assert.ok(resourceNeedPred);
        });

        it("should handle model updates (mocked)", async () => {
            const feedback = {
                predictionId: "pred-1",
                actualOutcome: "click_button",
                timestamp: Date.now()
            };
            const success = await predictor.updateModel(feedback);
            assert.strictEqual(success, true);
        });

        it("should emit prediction:generated event", (done) => {
            predictor.on("prediction:generated", (prediction) => {
                assert.ok(prediction.id);
                assert.strictEqual(prediction.targetVariable, "nextAction");
                done();
            });

            const input = {
                context: { userActivity: "idle" },
                targetVariables: ["nextAction"]
            };
            predictor.predict(input);
        });
        
        // Test Availability Predictor specific logic (user_36)
        it("should select factors and generate recommendations for Availability prediction", async () => {
            const availabilityPredictor = new DiscreteBayesianPredictor({
                predictionType: PredictionType.AVAILABILITY,
                eventEmitter,
                metrics,
                logger
            });
            
            const input = {
                context: { system: { cpuLoad: 0.8, memoryUsage: 0.9 }, network: { latency: 50 } },
                targetVariables: ["systemAvailability"]
            };
            
            // Mock predict to return a 'low' availability prediction
            availabilityPredictor.predict = async (inp) => [{
                id: uuidv4(),
                type: PredictionType.AVAILABILITY,
                targetVariable: "systemAvailability",
                predictedValue: "low",
                confidence: 0.85,
                timestamp: Date.now(),
                metadata: { modelId: "test", modelVersion: "1.0", contextSnapshot: inp.context, createdAt: Date.now(), customProperties: {} },
                contributingFactors: availabilityPredictor.selectFactorsForAvailability(inp.context),
                recommendations: [], // Will be populated below
                explanation: ""
            }];
            
            const predictions = await availabilityPredictor.predict(input);
            assert.strictEqual(predictions.length, 1);
            const prediction = predictions[0];
            
            // Populate recommendations based on factors
            prediction.recommendations = availabilityPredictor.generateRecommendationsForAvailability(prediction);
            
            assert.strictEqual(prediction.predictedValue, "low");
            assert.ok(prediction.contributingFactors.length > 0, "Should have contributing factors");
            assert.ok(prediction.contributingFactors.some(f => f.factorId === "cpuLoad"));
            assert.ok(prediction.contributingFactors.some(f => f.factorId === "memoryUsage"));
            
            assert.ok(prediction.recommendations.length > 0, "Should have recommendations");
            assert.ok(prediction.recommendations.some(r => r.description.includes("constrained soon")));
            assert.ok(prediction.recommendations.some(r => r.description.includes("High memory usage")));
        });
    });

    // --- ResourcePreallocator Tests ---
    describe("ResourcePreallocator", () => {
        let preallocator;
        let mockPredictor;
        let memoryMonitor;
        let cpuMonitor;

        beforeEach(() => {
            mockPredictor = new MockPredictor();
            memoryMonitor = new MockResourceMonitor(ResourceType.MEMORY, 8192, logger);
            cpuMonitor = new MockResourceMonitor(ResourceType.CPU, 100, logger);
            
            preallocator = new ResourcePreallocator({
                predictor: mockPredictor,
                resourceMonitors: new Map([[ResourceType.MEMORY, memoryMonitor], [ResourceType.CPU, cpuMonitor]]),
                allocationStrategies: new Map([[ResourceType.MEMORY, new MemoryAllocationStrategy(logger)], [ResourceType.CPU, new CPUAllocationStrategy(logger)]]),
                eventEmitter,
                metrics,
                logger,
                immediateProcessing: true // Process immediately for tests
            });
        });
        
        afterEach(() => {
            preallocator.cleanup(); // Stop intervals
        });

        it("should initialize correctly and subscribe to predictor", () => {
            assert.ok(preallocator.id);
            assert.strictEqual(mockPredictor.listenerCount("prediction:generated"), 1);
        });

        it("should handle prediction and request preallocation", (done) => {
            const prediction = {
                id: "pred-app-launch",
                type: "USER_ACTION",
                predictedValue: "open_application",
                confidence: 0.9,
                metadata: { customProperties: { applicationName: "browser" } }
            };

            let allocationCount = 0;
            preallocator.on("resource:allocated", (allocation) => {
                assert.ok(allocation.allocationId);
                assert.strictEqual(allocation.status, AllocationStatus.ACTIVE);
                if (allocation.resourceType === ResourceType.MEMORY) {
                    assert.strictEqual(allocation.allocatedAmount, 2048); // From estimateApplicationMemoryNeed
                } else if (allocation.resourceType === ResourceType.CPU) {
                    assert.strictEqual(allocation.allocatedAmount, 30); // From estimateApplicationCpuNeed
                }
                allocationCount++;
                if (allocationCount === 2) { // Expecting Memory and CPU
                    done();
                }
            });

            // Simulate predictor emitting the prediction
            mockPredictor.emit("prediction:generated", prediction);
        });

        it("should fail allocation if resources are insufficient", async () => {
            // Make memory unavailable
            memoryMonitor.getResourceAvailability = async () => ({ 
                resourceType: ResourceType.MEMORY, total: 8192, available: 100, used: 8092, timestamp: Date.now() 
            });

            const request = {
                requestId: uuidv4(),
                resourceType: ResourceType.MEMORY,
                predictedNeed: 512,
                confidence: 0.8,
                priority: 1,
                metadata: { createdAt: Date.now(), sourcePredictorId: "test", customProperties: {} }
            };

            const allocation = await preallocator.requestPreallocation(request);
            assert.strictEqual(allocation.status, AllocationStatus.FAILED);
            assert.strictEqual(allocation.allocatedAmount, 0);
        });

        it("should release an allocation", async () => {
            const request = {
                requestId: uuidv4(),
                resourceType: ResourceType.MEMORY,
                predictedNeed: 512,
                confidence: 0.8,
                priority: 1,
                metadata: { createdAt: Date.now(), sourcePredictorId: "test", customProperties: {} }
            };
            const allocation = await preallocator.requestPreallocation(request);
            assert.strictEqual(allocation.status, AllocationStatus.ACTIVE);

            let released = false;
            preallocator.on("resource:released", (releasedAllocation) => {
                assert.strictEqual(releasedAllocation.allocationId, allocation.allocationId);
                assert.strictEqual(releasedAllocation.status, AllocationStatus.RELEASED);
                released = true;
            });

            const success = await preallocator.releaseAllocation(allocation.allocationId, { usedSuccessfully: true });
            assert.strictEqual(success, true);
            assert.strictEqual(released, true);
            assert.strictEqual(preallocator.activeAllocations.size, 0);
        });
        
        it("should handle expired allocations", (done) => {
             // Shorten expiration check interval for test
            preallocator.cleanup(); // Stop existing intervals
            preallocator = new ResourcePreallocator({
                predictor: mockPredictor,
                resourceMonitors: new Map([[ResourceType.MEMORY, memoryMonitor]]),
                allocationStrategies: new Map([[ResourceType.MEMORY, new MemoryAllocationStrategy(logger)]]),
                eventEmitter,
                metrics,
                logger,
                expirationCheckInterval: 50 // Check every 50ms
            });
            
            const request = {
                requestId: uuidv4(),
                resourceType: ResourceType.MEMORY,
                predictedNeed: 128,
                confidence: 0.9,
                priority: 1,
                duration: 100, // Expire after 100ms
                metadata: { createdAt: Date.now(), sourcePredictorId: "test", customProperties: {} }
            };
            
            preallocator.requestPreallocation(request).then(allocation => {
                assert.strictEqual(allocation.status, AllocationStatus.ACTIVE);
                assert.ok(allocation.expiresAt);
                
                preallocator.on("resource:released", (releasedAllocation) => {
                    if (releasedAllocation.allocationId === allocation.allocationId) {
                        assert.strictEqual(releasedAllocation.feedback?.reasonForRelease, "Expired");
                        done();
                    }
                });
            });
        }).timeout(500); // Increase timeout for expiration test
    });

    // --- PredictiveTaskExecutor Tests ---
    describe("PredictiveTaskExecutor", () => {
        let executor;
        let mockPredictor;
        let mockPlanner;
        let mockMcp;

        beforeEach(() => {
            mockPredictor = new MockPredictor();
            mockPlanner = new MockHTNPlanner(logger);
            mockMcp = new MockMCP(logger);
            
            executor = new PredictiveTaskExecutor({
                htnPlanner: mockPlanner,
                mcp: mockMcp,
                eventEmitter,
                metrics,
                logger,
                taskQueueProcessingInterval: 50 // Process quickly for tests
            });
            
            // Manually subscribe executor to predictor for testing handlePrediction
            mockPredictor.on("prediction:generated", executor.handlePrediction.bind(executor));
        });
        
        afterEach(() => {
            executor.cleanup(); // Stop intervals
        });

        it("should initialize correctly", () => {
            assert.ok(executor.id);
            assert.ok(executor.htnPlanner);
            assert.ok(executor.mcp);
        });

        it("should schedule and execute a task", (done) => {
            const task = {
                name: "Test Task",
                goal: { type: "test_goal" },
                priority: TaskPriority.MEDIUM,
                trigger: TaskTrigger.USER_REQUEST,
                context: {}
            };

            executor.on("task:completed", (result) => {
                assert.strictEqual(result.taskId, scheduledTaskId);
                assert.strictEqual(result.success, true);
                executor.getTaskStatus(scheduledTaskId).then(status => {
                    assert.strictEqual(status.status, TaskStatus.COMPLETED);
                    done();
                });
            });

            let scheduledTaskId;
            executor.scheduleTask(task).then(taskId => {
                scheduledTaskId = taskId;
                assert.ok(taskId);
                return executor.getTaskStatus(taskId);
            }).then(status => {
                assert.strictEqual(status.status, TaskStatus.PENDING);
            });
        }).timeout(2000); // Increase timeout for task execution simulation

        it("should handle prediction and schedule a task", (done) => {
            const prediction = {
                id: "pred-prep-launch",
                type: "USER_ACTION",
                predictedValue: "open_application",
                confidence: 0.95,
                metadata: { customProperties: { applicationName: "testApp" } }
            };

            executor.on("task:scheduled", (scheduledTask) => {
                assert.ok(scheduledTask.taskId);
                assert.strictEqual(scheduledTask.priority, TaskPriority.HIGH);
                executor.getTaskStatus(scheduledTask.taskId).then(status => {
                    assert.strictEqual(status.status, TaskStatus.PENDING);
                    // Check if task details match prediction
                    const queuedTask = executor.taskQueue.find(t => t.id === scheduledTask.taskId);
                    assert.ok(queuedTask);
                    assert.strictEqual(queuedTask.name, "Prepare testApp launch");
                    assert.strictEqual(queuedTask.trigger, TaskTrigger.PREDICTION);
                    done();
                });
            });

            // Simulate predictor emitting the prediction
            mockPredictor.emit("prediction:generated", prediction);
        });

        it("should cancel a queued task", async () => {
            const task = {
                name: "Cancel Me",
                goal: { type: "cancel_goal" },
                priority: TaskPriority.LOW,
                trigger: TaskTrigger.USER_REQUEST,
                context: {}
            };
            const taskId = await executor.scheduleTask(task);
            assert.strictEqual(executor.taskQueue.length, 1);

            const canceled = await executor.cancelTask(taskId);
            assert.strictEqual(canceled, true);
            assert.strictEqual(executor.taskQueue.length, 0);
            const status = await executor.getTaskStatus(taskId);
            assert.strictEqual(status.status, TaskStatus.CANCELED);
        });

        it("should cancel an active task", (done) => {
            const task = {
                name: "Cancel Me Active",
                goal: { type: "cancel_active_goal" },
                priority: TaskPriority.HIGH, // Ensure it starts quickly
                trigger: TaskTrigger.USER_REQUEST,
                context: {}
            };

            let taskId;
            executor.scheduleTask(task).then(id => {
                taskId = id;
                // Wait a moment for the task to potentially start
                setTimeout(async () => {
                    try {
                        const canceled = await executor.cancelTask(taskId);
                        assert.strictEqual(canceled, true, "Cancel task should return true");
                        
                        // Check status via MCP mock (since it handles active tasks)
                        const mcpStatus = await mockMcp.getTaskStatus(taskId);
                        assert.strictEqual(mcpStatus.status, TaskStatus.CANCELED, "MCP status should be CANCELED");
                        
                        // Check executor's cached status
                        const executorStatus = await executor.getTaskStatus(taskId);
                        assert.strictEqual(executorStatus.status, TaskStatus.CANCELED, "Executor status should be CANCELED");
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 100); // Wait 100ms
            });
        }).timeout(1000);
    });

    // --- Integration Tests (Example) ---
    describe("Predictive Engine Integration", () => {
        it("should handle prediction -> preallocation -> task execution flow", (done) => {
            // Setup integrated components
            const mockPredictor = new MockPredictor();
            const memoryMonitor = new MockResourceMonitor(ResourceType.MEMORY, 8192, logger);
            const preallocator = new ResourcePreallocator({
                predictor: mockPredictor,
                resourceMonitors: new Map([[ResourceType.MEMORY, memoryMonitor]]),
                allocationStrategies: new Map([[ResourceType.MEMORY, new MemoryAllocationStrategy(logger)]]),
                eventEmitter: new EventEmitter(), // Use separate emitter
                metrics,
                logger,
                immediateProcessing: true
            });
            const mockPlanner = new MockHTNPlanner(logger);
            const mockMcp = new MockMCP(logger);
            const executor = new PredictiveTaskExecutor({
                htnPlanner: mockPlanner,
                mcp: mockMcp,
                resourcePreallocator: preallocator, // Inject preallocator
                eventEmitter: new EventEmitter(), // Use separate emitter
                metrics,
                logger,
                taskQueueProcessingInterval: 50
            });
            
            // Subscribe executor to predictor
            mockPredictor.on("prediction:generated", executor.handlePrediction.bind(executor));

            const prediction = {
                id: "pred-integrated-launch",
                type: "USER_ACTION",
                predictedValue: "open_application",
                confidence: 0.98,
                metadata: { customProperties: { applicationName: "integratedApp" } }
            };

            let resourceAllocated = false;
            let taskCompleted = false;

            preallocator.on("resource:allocated", (allocation) => {
                if (allocation.resourceType === ResourceType.MEMORY) {
                     assert.strictEqual(allocation.allocatedAmount, 512); // Default estimate
                     resourceAllocated = true;
                }
            });

            executor.on("task:completed", (result) => {
                assert.ok(result.taskId);
                assert.strictEqual(result.success, true);
                taskCompleted = true;
                if (resourceAllocated && taskCompleted) {
                    preallocator.cleanup();
                    executor.cleanup();
                    done();
                }
            });

            // Trigger the flow
            mockPredictor.emit("prediction:generated", prediction);

        }).timeout(3000); // Increase timeout for integrated flow
    });
});
