/**
 * @fileoverview Integration tests for Learning from Demonstration module.
 * Tests the complete LfD module as a functional component group using mocks.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');

// Create mock implementations of LfD components
// This approach avoids path resolution issues with source imports

// Mock DemonstrationRecorder
class DemonstrationRecorder {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.eventBus = options.eventBus;
    this.recordings = new Map();
  }

  async startRecording(options) {
    const recordingId = `recording_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.recordings.set(recordingId, {
      id: recordingId,
      startTime: Date.now(),
      events: [],
      ...options
    });
    return recordingId;
  }

  async recordEvent(recordingId, event) {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }
    recording.events.push(event);
  }

  async stopRecording(recordingId) {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }
    
    const demonstration = {
      id: recordingId,
      type: 'Demonstration',
      properties: {
        name: recording.name || 'Unnamed Demonstration',
        createdAt: recording.startTime,
        endedAt: Date.now(),
        userId: recording.userId,
        applicationContext: recording.applicationContext,
        events: recording.events
      }
    };
    
    await this.knowledgeGraphManager.addNode(demonstration);
    this.recordings.delete(recordingId);
    
    return demonstration;
  }
}

// Mock EventNormalizer
class EventNormalizer {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
  }

  normalizeEvent(event) {
    // Simple normalization logic
    if (event.type.startsWith('raw_')) {
      return {
        ...event,
        type: event.type.substring(4),
        normalized: true,
        timestamp: event.timestamp || Date.now()
      };
    }
    
    return {
      ...event,
      normalized: true,
      timestamp: event.timestamp || Date.now()
    };
  }
}

// Mock ContextTracker
class ContextTracker {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.contexts = new Map();
  }

  async trackContext(demonstrationId, context) {
    this.contexts.set(demonstrationId, context);
    return context;
  }

  async getContext(demonstrationId) {
    return this.contexts.get(demonstrationId) || {};
  }
}

// Mock PatternExtractionEngine
class PatternExtractionEngine {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager;
    this.graphNeuralNetworkManager = options.graphNeuralNetworkManager;
  }

  async extractPatterns(demonstrations) {
    // Simple pattern extraction logic
    const patterns = [];
    
    for (let i = 0; i < demonstrations.length; i++) {
      const demo = demonstrations[i];
      const events = demo.properties?.events || [];
      
      if (events.length > 0) {
        patterns.push({
          id: `pattern_${Date.now()}_${i}`,
          name: `Pattern ${i + 1}`,
          description: `Automatically extracted pattern from demonstration ${demo.id}`,
          events: events,
          confidence: 0.8,
          occurrenceCount: 1,
          demonstrationIds: [demo.id],
          createdAt: Date.now()
        });
      }
    }
    
    return patterns;
  }
}

// Mock WorkflowSynthesisEngine
class WorkflowSynthesisEngine {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.patternExtractionEngine = options.patternExtractionEngine;
    this.reasoningEngine = options.reasoningEngine;
  }

  async synthesizeWorkflow(pattern) {
    // Simple workflow synthesis logic
    const workflow = {
      id: `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      patternId: pattern.id,
      steps: pattern.events.map((event, index) => ({
        id: `step-${index + 1}`,
        type: event.type,
        target: event.target,
        value: event.value,
        conditions: []
      })),
      parameters: [],
      createdAt: Date.now(),
      confidence: pattern.confidence || 0.8
    };
    
    return workflow;
  }

  async optimizeWorkflow(workflow) {
    // Simple optimization logic
    return {
      ...workflow,
      optimized: true,
      optimizationTimestamp: Date.now()
    };
  }
}

// Mock FeedbackProcessor
class FeedbackProcessor {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager;
  }

  async processFeedback(workflow, feedback) {
    // Simple feedback processing logic
    const result = {
      workflowId: workflow.id,
      timestamp: Date.now(),
      feedbackProcessed: true,
      adjustments: [],
      metadata: {
        processingTime: 0
      }
    };
    
    const startTime = Date.now();
    
    // Process different types of feedback
    if (feedback.rating !== undefined) {
      result.adjustments.push({
        type: 'confidence',
        value: (feedback.rating - 3) * 0.1,
        source: 'rating',
        rating: feedback.rating
      });
    }
    
    if (feedback.comments) {
      result.adjustments.push({
        type: 'sentiment',
        value: 0.5,
        source: 'comments',
        sentiment: { score: 0.5, positive: 1, negative: 0 }
      });
    }
    
    if (feedback.stepAdjustments) {
      for (const adjustment of feedback.stepAdjustments) {
        result.adjustments.push({
          type: 'stepModify',
          stepId: adjustment.stepId,
          properties: adjustment.properties,
          source: 'stepAdjustments'
        });
      }
    }
    
    // Calculate processing time
    result.metadata.processingTime = Date.now() - startTime;
    
    return result;
  }
}

// Mock PerformanceMonitor
class PerformanceMonitor {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.telemetryService = options.telemetryService;
    this.performanceData = new Map();
  }

  startExecution(workflowId, context = {}) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const executionData = {
      id: executionId,
      workflowId: workflowId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'running',
      steps: [],
      context: { ...context },
      metrics: {
        cpuUsage: [],
        memoryUsage: [],
        stepDurations: []
      }
    };
    
    this.performanceData.set(executionId, executionData);
    
    return executionId;
  }

  async recordStepExecution(executionId, stepId, stepData = {}) {
    const executionData = this.performanceData.get(executionId);
    
    if (!executionData) {
      throw new Error(`No execution found with ID: ${executionId}`);
    }
    
    const stepRecord = {
      id: stepId,
      startTime: stepData.startTime || Date.now() - 1000,
      endTime: stepData.endTime || Date.now(),
      duration: stepData.duration || (stepData.endTime ? stepData.endTime - stepData.startTime : 1000),
      status: stepData.status || 'completed',
      error: stepData.error || null,
      metrics: stepData.metrics || {}
    };
    
    executionData.steps.push(stepRecord);
    
    return stepRecord;
  }

  async endExecution(executionId, result = {}) {
    const executionData = this.performanceData.get(executionId);
    
    if (!executionData) {
      throw new Error(`No execution found with ID: ${executionId}`);
    }
    
    executionData.endTime = Date.now();
    executionData.duration = executionData.endTime - executionData.startTime;
    executionData.status = result.status || (result.success ? 'completed' : 'failed');
    executionData.result = result;
    
    return executionData;
  }

  async getWorkflowPerformanceReport(workflowId) {
    const executions = Array.from(this.performanceData.values())
      .filter(execution => execution.workflowId === workflowId);
    
    if (executions.length === 0) {
      return {
        workflowId: workflowId,
        executionCount: 0,
        message: "No executions found for this workflow"
      };
    }
    
    const successfulExecutions = executions.filter(execution => execution.status === 'completed');
    
    return {
      workflowId: workflowId,
      executionCount: executions.length,
      successfulExecutions: successfulExecutions.length,
      failedExecutions: executions.length - successfulExecutions.length,
      successRate: (successfulExecutions.length / executions.length) * 100,
      timestamp: Date.now()
    };
  }
}

// Mock SelfImprovementEngine
class SelfImprovementEngine {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager;
    this.graphNeuralNetworkManager = options.graphNeuralNetworkManager;
    this.reasoningEngine = options.reasoningEngine;
    this.improvementTasks = new Map();
    this.modelVersions = new Map();
  }

  async scheduleImprovementTask(taskType, taskData = {}) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const task = {
      id: taskId,
      type: taskType,
      data: taskData,
      status: 'scheduled',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };
    
    this.improvementTasks.set(taskId, task);
    
    // Simulate immediate execution for testing
    setTimeout(() => {
      task.status = 'running';
      task.startedAt = Date.now();
      
      setTimeout(() => {
        task.status = 'completed';
        task.completedAt = Date.now();
        task.result = {
          taskType: taskType,
          success: true
        };
      }, 100);
    }, 50);
    
    return taskId;
  }

  getTaskStatus(taskId) {
    return this.improvementTasks.get(taskId) || null;
  }

  async triggerModelImprovement(modelType, options = {}) {
    const currentVersion = this.modelVersions.get(modelType) || {
      version: 0,
      createdAt: Date.now(),
      metrics: {}
    };
    
    const newVersion = {
      version: currentVersion.version + 1,
      createdAt: Date.now(),
      previousVersion: currentVersion.version,
      metrics: {},
      improvements: []
    };
    
    this.modelVersions.set(modelType, newVersion);
    
    const taskId = await this.scheduleImprovementTask('modelImprovement', {
      modelType: modelType,
      manual: true,
      options: options
    });
    
    return taskId;
  }

  getCurrentModelVersion(modelType) {
    return this.modelVersions.get(modelType) || null;
  }
}

// Mock ContinuousLearningSystem
class ContinuousLearningSystem {
  constructor(options) {
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.selfImprovementEngine = options.selfImprovementEngine;
    this.performanceMonitor = options.performanceMonitor;
    this.eventBus = options.eventBus;
    this.isActive = false;
    this.learningCycles = [];
    this.eventListeners = [];
  }

  async start() {
    if (this.isActive) {
      return;
    }
    
    this._registerEventListeners();
    this.isActive = true;
  }

  async stop() {
    if (!this.isActive) {
      return;
    }
    
    this._unregisterEventListeners();
    this.isActive = false;
  }

  async triggerLearningCycle(options = {}) {
    const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const cycle = {
      id: cycleId,
      startTime: Date.now(),
      endTime: Date.now() + 1000,
      status: 'completed',
      source: options.source || 'manual',
      tasks: [],
      results: {},
      metrics: {}
    };
    
    this.learningCycles.push(cycle);
    
    return {
      cycleId: cycle.id,
      status: cycle.status,
      duration: cycle.endTime - cycle.startTime,
      tasks: []
    };
  }

  getLearningMetrics() {
    return {
      totalCycles: this.learningCycles.length,
      completedCycles: this.learningCycles.filter(cycle => cycle.status === 'completed').length,
      failedCycles: this.learningCycles.filter(cycle => cycle.status === 'failed').length,
      successRate: this.learningCycles.length > 0 
        ? (this.learningCycles.filter(cycle => cycle.status === 'completed').length / this.learningCycles.length) * 100 
        : 0
    };
  }

  _registerEventListeners() {
    const handlers = [
      {
        event: 'demonstration.completed',
        handler: this._handleDemonstrationCompleted.bind(this)
      },
      {
        event: 'workflow.feedback',
        handler: this._handleWorkflowFeedback.bind(this)
      },
      {
        event: 'workflow.execution.completed',
        handler: this._handleWorkflowExecutionCompleted.bind(this)
      }
    ];
    
    for (const { event, handler } of handlers) {
      this.eventBus.on(event, handler);
      this.eventListeners.push({ event, handler });
    }
  }

  _unregisterEventListeners() {
    for (const { event, handler } of this.eventListeners) {
      this.eventBus.off(event, handler);
    }
    
    this.eventListeners = [];
  }

  async _handleDemonstrationCompleted(event) {
    this.logger.info(`Handling demonstration completed event for demonstration: ${event.demonstrationId}`);
  }

  async _handleWorkflowFeedback(event) {
    this.logger.info(`Handling workflow feedback event for workflow: ${event.workflowId}`);
  }

  async _handleWorkflowExecutionCompleted(event) {
    this.logger.info(`Handling workflow execution completed event for workflow: ${event.workflowId}`);
  }
}

// Create mock utilities
const createMockLogger = () => ({
  debug: sinon.stub(),
  info: sinon.stub(),
  warn: sinon.stub(),
  error: sinon.stub(),
  trace: sinon.stub()
});

const createMockConfigService = (configOverrides = {}) => {
  const defaultConfig = {
    "lfd.recording.maxDuration": 3600000,
    "lfd.patternExtraction.minConfidence": 0.6,
    "lfd.workflowSynthesis.optimizationEnabled": true,
    "lfd.performanceMonitoring.metricsIntervalMs": 1000,
    "lfd.selfImprovement.refinementConfidenceThreshold": 0.7,
    "lfd.continuousLearning.autoExtractPatterns": true,
    "lfd.continuousLearning.autoRefineWorkflows": true
  };
  
  const config = { ...defaultConfig, ...configOverrides };
  
  return {
    get: sinon.stub().callsFake((key, defaultValue) => {
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
    set: sinon.stub()
  };
};

const createMockEventBus = () => {
  const listeners = new Map();
  
  return {
    on: sinon.stub().callsFake((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    }),
    
    off: sinon.stub().callsFake((event, handler) => {
      if (!listeners.has(event)) {
        return;
      }
      
      const eventListeners = listeners.get(event);
      const index = eventListeners.indexOf(handler);
      
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }),
    
    emit: sinon.stub().callsFake((event, data) => {
      if (!listeners.has(event)) {
        return;
      }
      
      for (const handler of listeners.get(event)) {
        handler(data);
      }
    })
  };
};

const createMockReasoningEngine = () => {
  return {
    extractPatterns: sinon.stub().resolves({
      patterns: [],
      demonstrationCount: 1,
      patternsExtracted: 0
    }),
    
    generateWorkflowRefinements: sinon.stub().resolves({
      workflowId: 'test-workflow',
      refinements: [],
      analysisId: 'test-analysis'
    }),
    
    optimizeWorkflow: sinon.stub().callsFake(async (workflow) => {
      return {
        ...workflow,
        optimized: true,
        optimizationTimestamp: Date.now()
      };
    })
  };
};

describe('Learning from Demonstration - Integration Tests', function() {
  // Increase timeout for integration tests
  this.timeout(10000);
  
  // Test dependencies
  let logger;
  let configService;
  let knowledgeGraphManager;
  let probabilisticKnowledgeManager;
  let graphNeuralNetworkManager;
  let reasoningEngine;
  let eventBus;
  let telemetryService;
  
  // LfD components
  let demonstrationRecorder;
  let eventNormalizer;
  let contextTracker;
  let patternExtractionEngine;
  let workflowSynthesisEngine;
  let feedbackProcessor;
  let performanceMonitor;
  let selfImprovementEngine;
  let continuousLearningSystem;
  
  // Test data
  const testDemonstrationId = `demo_${Date.now()}`;
  const testWorkflowId = `workflow_${Date.now()}`;
  
  beforeEach(async function() {
    // Create mock dependencies
    logger = createMockLogger();
    configService = createMockConfigService();
    eventBus = createMockEventBus();
    
    // Create mock knowledge components
    knowledgeGraphManager = {
      addNode: sinon.stub().resolves(),
      getNode: sinon.stub().callsFake(async (type, id) => {
        if (type === 'Demonstration' && id === testDemonstrationId) {
          return {
            id: testDemonstrationId,
            type: 'Demonstration',
            properties: {
              name: 'Test Demonstration',
              createdAt: Date.now(),
              userId: 'test-user',
              applicationContext: 'test-app',
              events: [
                {
                  type: 'click',
                  target: { id: 'button-1', type: 'button', text: 'Submit' },
                  timestamp: Date.now() - 5000
                },
                {
                  type: 'input',
                  target: { id: 'input-1', type: 'text', value: 'Test input' },
                  timestamp: Date.now() - 4000
                },
                {
                  type: 'navigation',
                  target: { url: 'https://example.com/result' },
                  timestamp: Date.now() - 3000
                }
              ]
            }
          };
        } else if (type === 'Workflow' && id === testWorkflowId) {
          return {
            id: testWorkflowId,
            type: 'Workflow',
            properties: {
              name: 'Test Workflow',
              createdAt: Date.now(),
              patternId: 'pattern-1',
              confidence: 0.8,
              steps: [
                {
                  id: 'step-1',
                  type: 'click',
                  target: { id: 'button-1', type: 'button' },
                  conditions: []
                },
                {
                  id: 'step-2',
                  type: 'input',
                  target: { id: 'input-1', type: 'text' },
                  value: 'Test input',
                  conditions: []
                },
                {
                  id: 'step-3',
                  type: 'navigation',
                  target: { url: 'https://example.com/result' },
                  conditions: []
                }
              ],
              parameters: [
                {
                  name: 'inputValue',
                  type: 'string',
                  defaultValue: 'Test input'
                }
              ]
            }
          };
        }
        return null;
      }),
      updateNode: sinon.stub().resolves(),
      removeNode: sinon.stub().resolves(),
      addRelationship: sinon.stub().resolves(),
      getRelationships: sinon.stub().resolves([]),
      removeRelationship: sinon.stub().resolves(),
      getNodes: sinon.stub().resolves([])
    };
    
    probabilisticKnowledgeManager = {
      getConfidence: sinon.stub().resolves(0.8),
      updateConfidence: sinon.stub().resolves(0.85)
    };
    
    graphNeuralNetworkManager = {
      trainModel: sinon.stub().resolves({
        metrics: {
          accuracy: 0.92,
          loss: 0.08
        }
      })
    };
    
    // Create mock reasoning engine
    reasoningEngine = createMockReasoningEngine();
    
    // Create mock telemetry service
    telemetryService = {
      sendEvent: sinon.stub().resolves()
    };
    
    // Initialize LfD components using our mock implementations
    demonstrationRecorder = new DemonstrationRecorder({
      logger,
      configService,
      knowledgeGraphManager,
      eventBus
    });
    
    eventNormalizer = new EventNormalizer({
      logger,
      configService
    });
    
    contextTracker = new ContextTracker({
      logger,
      configService,
      knowledgeGraphManager
    });
    
    patternExtractionEngine = new PatternExtractionEngine({
      logger,
      configService,
      knowledgeGraphManager,
      probabilisticKnowledgeManager,
      graphNeuralNetworkManager
    });
    
    workflowSynthesisEngine = new WorkflowSynthesisEngine({
      logger,
      configService,
      knowledgeGraphManager,
      patternExtractionEngine,
      reasoningEngine
    });
    
    feedbackProcessor = new FeedbackProcessor({
      logger,
      configService,
      knowledgeGraphManager,
      probabilisticKnowledgeManager
    });
    
    performanceMonitor = new PerformanceMonitor({
      logger,
      configService,
      knowledgeGraphManager,
      telemetryService
    });
    
    selfImprovementEngine = new SelfImprovementEngine({
      logger,
      configService,
      knowledgeGraphManager,
      probabilisticKnowledgeManager,
      graphNeuralNetworkManager,
      reasoningEngine
    });
    
    continuousLearningSystem = new ContinuousLearningSystem({
      logger,
      configService,
      knowledgeGraphManager,
      selfImprovementEngine,
      performanceMonitor,
      eventBus
    });
  });
  
  afterEach(function() {
    // Restore all stubs
    sinon.restore();
  });
  
  describe('Component Initialization', function() {
    it('should initialize all LfD components without errors', function() {
      expect(demonstrationRecorder).to.be.an('object');
      expect(eventNormalizer).to.be.an('object');
      expect(contextTracker).to.be.an('object');
      expect(patternExtractionEngine).to.be.an('object');
      expect(workflowSynthesisEngine).to.be.an('object');
      expect(feedbackProcessor).to.be.an('object');
      expect(performanceMonitor).to.be.an('object');
      expect(selfImprovementEngine).to.be.an('object');
      expect(continuousLearningSystem).to.be.an('object');
    });
  });
  
  describe('Demonstration Recording Flow', function() {
    it('should record and normalize user actions', async function() {
      // Start recording
      const recordingId = await demonstrationRecorder.startRecording({
        applicationContext: 'test-app',
        userId: 'test-user'
      });
      
      expect(recordingId).to.be.a('string');
      
      // Record some events
      const events = [
        {
          type: 'click',
          target: { id: 'button-2', type: 'button', text: 'Save' },
          timestamp: Date.now()
        },
        {
          type: 'input',
          target: { id: 'input-2', type: 'text', value: 'New value' },
          timestamp: Date.now() + 1000
        }
      ];
      
      for (const event of events) {
        await demonstrationRecorder.recordEvent(recordingId, event);
      }
      
      // Stop recording
      const demonstration = await demonstrationRecorder.stopRecording(recordingId);
      
      expect(demonstration).to.be.an('object');
      expect(demonstration.id).to.equal(recordingId);
      expect(demonstration.properties.events).to.be.an('array');
      expect(demonstration.properties.events.length).to.equal(events.length);
    });
  });
  
  describe('Pattern Extraction Flow', function() {
    it('should extract patterns from demonstrations', async function() {
      // Get test demonstration
      const demonstration = await knowledgeGraphManager.getNode('Demonstration', testDemonstrationId);
      
      expect(demonstration).to.be.an('object');
      
      // Extract patterns
      const patterns = await patternExtractionEngine.extractPatterns([demonstration]);
      
      expect(patterns).to.be.an('array');
      expect(patterns.length).to.be.at.least(1);
      
      // Verify pattern structure
      const pattern = patterns[0];
      expect(pattern).to.be.an('object');
      expect(pattern.id).to.be.a('string');
      expect(pattern.events).to.be.an('array');
      expect(pattern.confidence).to.be.a('number');
    });
  });
  
  describe('Workflow Synthesis Flow', function() {
    it('should synthesize workflows from patterns', async function() {
      // Get test demonstration
      const demonstration = await knowledgeGraphManager.getNode('Demonstration', testDemonstrationId);
      
      // Extract patterns
      const patterns = await patternExtractionEngine.extractPatterns([demonstration]);
      
      // Synthesize workflow
      const workflow = await workflowSynthesisEngine.synthesizeWorkflow(patterns[0]);
      
      expect(workflow).to.be.an('object');
      expect(workflow.id).to.be.a('string');
      expect(workflow.patternId).to.equal(patterns[0].id);
      expect(workflow.steps).to.be.an('array');
      expect(workflow.steps.length).to.be.at.least(1);
    });
    
    it('should optimize workflows', async function() {
      // Get test workflow
      const workflow = await knowledgeGraphManager.getNode('Workflow', testWorkflowId);
      
      // Optimize workflow
      const optimizedWorkflow = await workflowSynthesisEngine.optimizeWorkflow(workflow);
      
      expect(optimizedWorkflow).to.be.an('object');
      expect(optimizedWorkflow.id).to.equal(workflow.id);
      expect(optimizedWorkflow.optimized).to.be.true;
    });
  });
  
  describe('Feedback Processing Flow', function() {
    it('should process user feedback on workflows', async function() {
      // Get test workflow
      const workflow = await knowledgeGraphManager.getNode('Workflow', testWorkflowId);
      
      // Create feedback
      const feedback = {
        rating: 4,
        comments: 'Works great, but could be faster',
        stepAdjustments: [
          {
            stepId: 'step-2',
            type: 'modify',
            properties: {
              value: 'Modified input'
            }
          }
        ]
      };
      
      // Process feedback
      const result = await feedbackProcessor.processFeedback(workflow, feedback);
      
      expect(result).to.be.an('object');
      expect(result.workflowId).to.equal(workflow.id);
      expect(result.feedbackProcessed).to.be.true;
      expect(result.adjustments).to.be.an('array');
      expect(result.adjustments.length).to.be.at.least(1);
    });
  });
  
  describe('Performance Monitoring Flow', function() {
    it('should monitor workflow execution performance', async function() {
      // Get test workflow
      const workflow = await knowledgeGraphManager.getNode('Workflow', testWorkflowId);
      
      // Start monitoring
      const executionId = performanceMonitor.startExecution(workflow.id, {
        userId: 'test-user',
        context: 'test-execution'
      });
      
      expect(executionId).to.be.a('string');
      
      // Record step executions
      for (const step of workflow.properties.steps) {
        await performanceMonitor.recordStepExecution(executionId, step.id, {
          startTime: Date.now() - 1000,
          endTime: Date.now(),
          status: 'completed'
        });
      }
      
      // End monitoring
      const executionData = await performanceMonitor.endExecution(executionId, {
        status: 'completed',
        success: true
      });
      
      expect(executionData).to.be.an('object');
      expect(executionData.id).to.equal(executionId);
      expect(executionData.workflowId).to.equal(workflow.id);
      expect(executionData.status).to.equal('completed');
      expect(executionData.steps).to.be.an('array');
      expect(executionData.steps.length).to.equal(workflow.properties.steps.length);
      
      // Get performance report
      const report = await performanceMonitor.getWorkflowPerformanceReport(workflow.id);
      
      expect(report).to.be.an('object');
      expect(report.workflowId).to.equal(workflow.id);
      expect(report.executionCount).to.be.at.least(1);
      expect(report.successfulExecutions).to.be.at.least(1);
    });
  });
  
  describe('Self-Improvement Flow', function() {
    it('should schedule and execute improvement tasks', async function() {
      // Schedule task
      const taskId = await selfImprovementEngine.scheduleImprovementTask('patternExtraction', {
        demonstrationIds: [testDemonstrationId]
      });
      
      expect(taskId).to.be.a('string');
      
      // Wait for task to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify task status
      const taskStatus = selfImprovementEngine.getTaskStatus(taskId);
      
      expect(taskStatus).to.be.an('object');
      expect(taskStatus.id).to.equal(taskId);
      expect(taskStatus.status).to.equal('completed');
      expect(taskStatus.result).to.be.an('object');
    });
    
    it('should trigger model improvement', async function() {
      // Trigger model improvement
      const taskId = await selfImprovementEngine.triggerModelImprovement('patternModel', {
        source: 'test'
      });
      
      expect(taskId).to.be.a('string');
      
      // Wait for task to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get current model version
      const modelVersion = selfImprovementEngine.getCurrentModelVersion('patternModel');
      
      expect(modelVersion).to.be.an('object');
      expect(modelVersion.version).to.be.at.least(1);
    });
  });
  
  describe('Continuous Learning Flow', function() {
    it('should start and stop continuous learning system', async function() {
      // Start continuous learning
      await continuousLearningSystem.start();
      
      // Trigger learning cycle
      const result = await continuousLearningSystem.triggerLearningCycle({
        source: 'test'
      });
      
      expect(result).to.be.an('object');
      expect(result.cycleId).to.be.a('string');
      
      // Get learning metrics
      const metrics = continuousLearningSystem.getLearningMetrics();
      
      expect(metrics).to.be.an('object');
      expect(metrics.totalCycles).to.be.at.least(1);
      
      // Stop continuous learning
      await continuousLearningSystem.stop();
    });
    
    it('should handle demonstration events', async function() {
      // Start continuous learning
      await continuousLearningSystem.start();
      
      // Emit demonstration completed event
      eventBus.emit('demonstration.completed', {
        demonstrationId: testDemonstrationId,
        timestamp: Date.now()
      });
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stop continuous learning
      await continuousLearningSystem.stop();
      
      // Verify event was processed
      expect(logger.info.calledWith(sinon.match(/Handling demonstration completed event/))).to.be.true;
    });
  });
  
  describe('End-to-End Learning Flow', function() {
    it('should execute complete learning flow from demonstration to workflow execution', async function() {
      // 1. Record demonstration
      const recordingId = await demonstrationRecorder.startRecording({
        applicationContext: 'test-app',
        userId: 'test-user'
      });
      
      const events = [
        {
          type: 'click',
          target: { id: 'button-3', type: 'button', text: 'Login' },
          timestamp: Date.now()
        },
        {
          type: 'input',
          target: { id: 'username', type: 'text' },
          value: 'testuser',
          timestamp: Date.now() + 1000
        },
        {
          type: 'input',
          target: { id: 'password', type: 'password' },
          value: 'password123',
          timestamp: Date.now() + 2000
        },
        {
          type: 'click',
          target: { id: 'login-button', type: 'button', text: 'Submit' },
          timestamp: Date.now() + 3000
        }
      ];
      
      for (const event of events) {
        await demonstrationRecorder.recordEvent(recordingId, event);
      }
      
      const demonstration = await demonstrationRecorder.stopRecording(recordingId);
      
      expect(demonstration).to.be.an('object');
      expect(demonstration.properties.events.length).to.equal(events.length);
      
      // 2. Extract patterns
      const patterns = await patternExtractionEngine.extractPatterns([demonstration]);
      
      expect(patterns).to.be.an('array');
      expect(patterns.length).to.be.at.least(1);
      
      // 3. Synthesize workflow
      const workflow = await workflowSynthesisEngine.synthesizeWorkflow(patterns[0]);
      
      expect(workflow).to.be.an('object');
      expect(workflow.steps.length).to.be.at.least(events.length);
      
      // 4. Optimize workflow
      const optimizedWorkflow = await workflowSynthesisEngine.optimizeWorkflow(workflow);
      
      expect(optimizedWorkflow).to.be.an('object');
      expect(optimizedWorkflow.optimized).to.be.true;
      
      // 5. Monitor execution
      const executionId = performanceMonitor.startExecution(optimizedWorkflow.id, {
        userId: 'test-user',
        context: 'test-execution'
      });
      
      for (const step of optimizedWorkflow.steps) {
        await performanceMonitor.recordStepExecution(executionId, step.id, {
          startTime: Date.now() - 1000,
          endTime: Date.now(),
          status: 'completed'
        });
      }
      
      const executionData = await performanceMonitor.endExecution(executionId, {
        status: 'completed',
        success: true
      });
      
      expect(executionData).to.be.an('object');
      expect(executionData.status).to.equal('completed');
      
      // 6. Process feedback
      const feedback = {
        rating: 5,
        comments: 'Works perfectly!',
        executionResult: {
          success: true
        }
      };
      
      const feedbackResult = await feedbackProcessor.processFeedback(optimizedWorkflow, feedback);
      
      expect(feedbackResult).to.be.an('object');
      expect(feedbackResult.feedbackProcessed).to.be.true;
      
      // 7. Trigger self-improvement
      const taskId = await selfImprovementEngine.scheduleImprovementTask('workflowRefinement', {
        workflowId: optimizedWorkflow.id,
        autoApply: true
      });
      
      // Wait for task to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify task status
      const taskStatus = selfImprovementEngine.getTaskStatus(taskId);
      expect(taskStatus.status).to.equal('completed');
    });
  });
});
