/**
 * @fileoverview Tests for Reasoning Context Schemas.
 * 
 * This file contains tests for validating the reasoning context schemas
 * and their integration with the MCP system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const sinon = require('sinon');
const { requireModule } = require('./utils/TestModuleResolver');

// Use requireModule to get the correct module paths
const { reasoningContextSchemas, validateReasoningContext } = requireModule('tentacles/multimodal/context/schemas/ReasoningContextSchemas');

describe('Reasoning Context Schemas', () => {
  describe('Schema Structure', () => {
    it('should export all required schemas', () => {
      assert.ok(reasoningContextSchemas, 'reasoningContextSchemas should be exported');
      assert.ok(validateReasoningContext, 'validateReasoningContext should be exported');
      
      // Check for all expected schema types
      const expectedSchemaTypes = [
        'reasoning.strategy.selection',
        'reasoning.strategy.execution',
        'reasoning.strategy.failure',
        'reasoning.model.selection',
        'reasoning.deductive.rule',
        'reasoning.deductive.inference',
        'reasoning.deductive.contradiction',
        'reasoning.deductive.proof',
        'reasoning.inductive.pattern',
        'reasoning.inductive.hypothesis',
        'reasoning.inductive.test',
        'reasoning.inductive.generalization',
        'reasoning.task.execution',
        'reasoning.result.generation',
        'reasoning.explanation.trace',
        'reasoning.uncertainty.assessment'
      ];
      
      expectedSchemaTypes.forEach(schemaType => {
        assert.ok(reasoningContextSchemas[schemaType], `Schema for ${schemaType} should exist`);
      });
    });
  });
  
  describe('Strategy Selection Schema', () => {
    it('should validate valid strategy selection context', () => {
      const validContext = {
        taskId: 'task-123',
        strategyId: 'strategy-456',
        strategyType: 'deductive',
        selectionReason: 'Best match for task requirements',
        alternativeStrategies: [
          { strategyId: 'strategy-789', strategyType: 'inductive', score: 0.75 }
        ],
        parameters: { maxDepth: 5, timeLimit: 10000 },
        confidence: 0.9,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.strategy.selection', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
    
    it('should reject invalid strategy selection context', () => {
      const invalidContext = {
        // Missing required taskId
        strategyId: 'strategy-456',
        strategyType: 'deductive',
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.strategy.selection', invalidContext);
      assert.strictEqual(result.isValid, false, 'Invalid context should fail validation');
      assert.ok(result.errors.length > 0, 'Invalid context should have errors');
      assert.ok(result.errors.some(error => error.includes('taskId')), 'Should report missing taskId');
    });
  });
  
  describe('Strategy Execution Schema', () => {
    it('should validate valid strategy execution context', () => {
      const validContext = {
        taskId: 'task-123',
        strategyId: 'strategy-456',
        executionId: 'exec-789',
        duration: 1500,
        resourceUsage: {
          cpu: 45.2,
          memory: 1024000,
          network: 5120
        },
        resultSummary: {
          status: 'success',
          itemsProcessed: 150
        },
        confidence: 0.95,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.strategy.execution', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
    
    it('should reject invalid strategy execution context', () => {
      const invalidContext = {
        taskId: 'task-123',
        strategyId: 'strategy-456',
        // Missing required executionId
        duration: 1500,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.strategy.execution', invalidContext);
      assert.strictEqual(result.isValid, false, 'Invalid context should fail validation');
      assert.ok(result.errors.length > 0, 'Invalid context should have errors');
      assert.ok(result.errors.some(error => error.includes('executionId')), 'Should report missing executionId');
    });
  });
  
  describe('Deductive Reasoning Schemas', () => {
    it('should validate valid deductive rule context', () => {
      const validContext = {
        taskId: 'task-123',
        ruleId: 'rule-456',
        ruleName: 'modus_ponens',
        premises: [
          { id: 'premise-1', statement: 'If A then B' },
          { id: 'premise-2', statement: 'A' }
        ],
        conclusion: {
          id: 'conclusion-1',
          statement: 'B'
        },
        justification: 'Direct application of modus ponens',
        confidence: 1.0,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.deductive.rule', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
    
    it('should validate valid deductive inference context', () => {
      const validContext = {
        taskId: 'task-123',
        inferenceId: 'inference-456',
        statement: 'All observed swans are white',
        derivedFrom: ['observation-1', 'observation-2', 'observation-3'],
        rulesApplied: ['induction-rule-1'],
        confidence: 0.85,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.deductive.inference', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
  });
  
  describe('Inductive Reasoning Schemas', () => {
    it('should validate valid inductive pattern context', () => {
      const validContext = {
        taskId: 'task-123',
        patternId: 'pattern-456',
        patternType: 'sequence',
        dataPoints: [
          { value: 2, position: 0 },
          { value: 4, position: 1 },
          { value: 6, position: 2 },
          { value: 8, position: 3 }
        ],
        description: 'Arithmetic sequence with common difference of 2',
        confidence: 0.95,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.inductive.pattern', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
    
    it('should validate valid inductive hypothesis context', () => {
      const validContext = {
        taskId: 'task-123',
        hypothesisId: 'hypothesis-456',
        statement: 'The sequence follows the pattern 2n where n is the position',
        basedOnPatterns: ['pattern-456'],
        alternativeHypotheses: [
          { 
            id: 'hypothesis-789', 
            statement: 'The sequence is the even numbers', 
            score: 0.9 
          }
        ],
        confidence: 0.85,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.inductive.hypothesis', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
  });
  
  describe('Task Execution Schema', () => {
    it('should validate valid task execution context', () => {
      const validContext = {
        taskId: 'task-123',
        executionId: 'exec-456',
        status: 'completed',
        progress: 100,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        steps: [
          { stepId: 'step-1', description: 'Initialize', status: 'completed' },
          { stepId: 'step-2', description: 'Process data', status: 'completed' },
          { stepId: 'step-3', description: 'Generate results', status: 'completed' }
        ],
        result: {
          success: true,
          outputCount: 3
        },
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.task.execution', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
    
    it('should reject invalid task execution context with invalid status', () => {
      const invalidContext = {
        taskId: 'task-123',
        executionId: 'exec-456',
        status: 'unknown_status', // Invalid status value
        progress: 100,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.task.execution', invalidContext);
      assert.strictEqual(result.isValid, false, 'Invalid context should fail validation');
      assert.ok(result.errors.length > 0, 'Invalid context should have errors');
    });
  });
  
  describe('Explanation Trace Schema', () => {
    it('should validate valid explanation trace context', () => {
      const validContext = {
        taskId: 'task-123',
        traceId: 'trace-456',
        targetId: 'result-789',
        targetType: 'prediction',
        steps: [
          { 
            stepId: 'step-1', 
            type: 'data_processing',
            description: 'Data normalization', 
            inputs: ['raw-data-1'],
            outputs: ['processed-data-1']
          },
          { 
            stepId: 'step-2', 
            type: 'model_inference',
            description: 'Model prediction', 
            inputs: ['processed-data-1'],
            outputs: ['prediction-1']
          }
        ],
        format: 'sequential',
        audience: 'technical',
        complexity: 'detailed',
        confidence: 0.9,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.explanation.trace', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
  });
  
  describe('Uncertainty Assessment Schema', () => {
    it('should validate valid uncertainty assessment context', () => {
      const validContext = {
        taskId: 'task-123',
        assessmentId: 'assessment-456',
        targetId: 'prediction-789',
        targetType: 'classification',
        uncertaintyType: 'epistemic',
        confidenceScore: 0.75,
        confidenceInterval: {
          lower: 0.65,
          upper: 0.85
        },
        factors: [
          { factor: 'limited_training_data', impact: 0.6 },
          { factor: 'noisy_input', impact: 0.3 }
        ],
        mitigationStrategies: [
          { strategy: 'collect_more_data', potentialImpact: 0.7 },
          { strategy: 'improve_preprocessing', potentialImpact: 0.4 }
        ],
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.uncertainty.assessment', validContext);
      assert.strictEqual(result.isValid, true, 'Valid context should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Valid context should have no errors');
    });
    
    it('should reject invalid uncertainty assessment context with invalid uncertainty type', () => {
      const invalidContext = {
        taskId: 'task-123',
        assessmentId: 'assessment-456',
        targetId: 'prediction-789',
        targetType: 'classification',
        uncertaintyType: 'unknown_type', // Invalid uncertainty type
        confidenceScore: 0.75,
        timestamp: Date.now()
      };
      
      const result = validateReasoningContext('reasoning.uncertainty.assessment', invalidContext);
      assert.strictEqual(result.isValid, false, 'Invalid context should fail validation');
      assert.ok(result.errors.length > 0, 'Invalid context should have errors');
    });
  });
  
  describe('Provider Integration', () => {
    let MCPReasoningEngineContextProvider;
    let MCPReasoningStrategyManagerProvider;
    let MCPDeductiveReasonerProvider;
    let MCPInductiveReasonerProvider;
    let mockLogger;
    let mockContextManager;
    
    beforeEach(() => {
      // Import the provider classes
      MCPReasoningEngineContextProvider = requireModule('tentacles/multimodal/context/providers/MCPReasoningEngineContextProvider').MCPReasoningEngineContextProvider;
      MCPReasoningStrategyManagerProvider = requireModule('tentacles/multimodal/context/providers/MCPReasoningStrategyManagerProvider').MCPReasoningStrategyManagerProvider;
      MCPDeductiveReasonerProvider = requireModule('tentacles/multimodal/context/providers/MCPDeductiveReasonerProvider').MCPDeductiveReasonerProvider;
      MCPInductiveReasonerProvider = requireModule('tentacles/multimodal/context/providers/MCPInductiveReasonerProvider').MCPInductiveReasonerProvider;
      
      // Create mocks
      mockLogger = {
        debug: sinon.spy(),
        info: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy()
      };
      
      mockContextManager = {
        isInitialized: true,
        registerContextProvider: sinon.stub().resolves(true),
        addContext: sinon.stub().resolves('context-123'),
        queryContexts: sinon.stub().resolves([]),
        updateContext: sinon.stub().resolves(true),
        removeContext: sinon.stub().resolves(true)
      };
    });
    
    it('should initialize MCPReasoningEngineContextProvider with supported context types', async () => {
      const provider = new MCPReasoningEngineContextProvider({
        logger: mockLogger,
        contextManager: mockContextManager
      });
      
      // Mock the acquire method to directly execute the callback function
      provider.lock.acquire = async (lockNameOrFn, asyncFnOrTimeout) => {
        // Handle both old and new signatures
        if (typeof lockNameOrFn === 'string') {
          return await asyncFnOrTimeout();
        } else {
          return await lockNameOrFn();
        }
      };
      
      await provider.initialize();
      
      assert.ok(mockContextManager.registerContextProvider.calledOnce, 'Provider should register with context manager');
      
      const supportedTypes = provider.getSupportedContextTypes();
      assert.ok(Array.isArray(supportedTypes), 'Supported types should be an array');
      assert.ok(supportedTypes.length > 0, 'Provider should support at least one context type');
      
      // Check that all supported types have corresponding schemas
      supportedTypes.forEach(type => {
        assert.ok(reasoningContextSchemas[type], `Schema should exist for supported type ${type}`);
      });
    });
    
    it('should initialize MCPReasoningStrategyManagerProvider with strategy-specific context types', async () => {
      const mockStrategyManager = {
        on: sinon.spy()
      };
      
      const provider = new MCPReasoningStrategyManagerProvider({
        logger: mockLogger,
        contextManager: mockContextManager,
        reasoningStrategyManager: mockStrategyManager
      });
      
      // Mock the acquire method to directly execute the callback function
      provider.lock.acquire = async (lockNameOrFn, asyncFnOrTimeout) => {
        // Handle both old and new signatures
        if (typeof lockNameOrFn === 'string') {
          return await asyncFnOrTimeout();
        } else {
          return await lockNameOrFn();
        }
      };
      
      await provider.initialize();
      
      assert.ok(mockContextManager.registerContextProvider.calledOnce, 'Provider should register with context manager');
      assert.ok(mockStrategyManager.on.called, 'Provider should set up event listeners');
      
      const supportedTypes = provider.getSupportedContextTypes();
      supportedTypes.forEach(type => {
        assert.ok(reasoningContextSchemas[type], `Schema should exist for supported type ${type}`);
      });
    });
    
    it('should initialize MCPDeductiveReasonerProvider with deductive-specific context types', async () => {
      const mockDeductiveReasoner = {
        on: sinon.spy()
      };
      
      const provider = new MCPDeductiveReasonerProvider({
        logger: mockLogger,
        contextManager: mockContextManager,
        deductiveReasoner: mockDeductiveReasoner
      });
      
      // Mock the acquire method to directly execute the callback function
      provider.lock.acquire = async (lockNameOrFn, asyncFnOrTimeout) => {
        // Handle both old and new signatures
        if (typeof lockNameOrFn === 'string') {
          return await asyncFnOrTimeout();
        } else {
          return await lockNameOrFn();
        }
      };
      
      await provider.initialize();
      
      assert.ok(mockContextManager.registerContextProvider.calledOnce, 'Provider should register with context manager');
      assert.ok(mockDeductiveReasoner.on.called, 'Provider should set up event listeners');
      
      const supportedTypes = provider.getSupportedContextTypes();
      supportedTypes.forEach(type => {
        assert.ok(reasoningContextSchemas[type], `Schema should exist for supported type ${type}`);
      });
    });
    
    it('should initialize MCPInductiveReasonerProvider with inductive-specific context types', async () => {
      const mockInductiveReasoner = {
        on: sinon.spy()
      };
      
      const provider = new MCPInductiveReasonerProvider({
        logger: mockLogger,
        contextManager: mockContextManager,
        inductiveReasoner: mockInductiveReasoner
      });
      
      // Mock the acquire method to directly execute the callback function
      provider.lock.acquire = async (lockNameOrFn, asyncFnOrTimeout) => {
        // Handle both old and new signatures
        if (typeof lockNameOrFn === 'string') {
          return await asyncFnOrTimeout();
        } else {
          return await lockNameOrFn();
        }
      };
      
      await provider.initialize();
      
      assert.ok(mockContextManager.registerContextProvider.calledOnce, 'Provider should register with context manager');
      assert.ok(mockInductiveReasoner.on.called, 'Provider should set up event listeners');
      
      const supportedTypes = provider.getSupportedContextTypes();
      supportedTypes.forEach(type => {
        assert.ok(reasoningContextSchemas[type], `Schema should exist for supported type ${type}`);
      });
    });
  });
});
