/**
 * @fileoverview Tests for Task Execution context schemas.
 * Validates schema definitions and validation logic.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { requireModule } = require('./utils/TestModuleResolver');
const { 
  taskPlanningPlanSchema,
  taskPlanningGoalSchema,
  taskResourceAllocationSchema,
  taskResourceAvailabilitySchema,
  taskExecutionProgressSchema,
  taskExecutionStatusSchema,
  taskErrorDetectionSchema,
  taskErrorRecoverySchema,
  taskOptimizationPerformanceSchema,
  taskOptimizationEfficiencySchema,
  validateTaskExecutionContext,
  validateAgainstSchema
} = requireModule('src/tentacles/multimodal/context/schemas/TaskExecutionContextSchemas');

describe('Task Execution Context Schemas', () => {
  describe('Schema Definitions', () => {
    it('should define all required schemas', () => {
      expect(taskPlanningPlanSchema).toBeDefined();
      expect(taskPlanningGoalSchema).toBeDefined();
      expect(taskResourceAllocationSchema).toBeDefined();
      expect(taskResourceAvailabilitySchema).toBeDefined();
      expect(taskExecutionProgressSchema).toBeDefined();
      expect(taskExecutionStatusSchema).toBeDefined();
      expect(taskErrorDetectionSchema).toBeDefined();
      expect(taskErrorRecoverySchema).toBeDefined();
      expect(taskOptimizationPerformanceSchema).toBeDefined();
      expect(taskOptimizationEfficiencySchema).toBeDefined();
    });
    
    it('should define schemas with required properties', () => {
      expect(taskPlanningPlanSchema.required).toContain('planId');
      expect(taskPlanningPlanSchema.required).toContain('steps');
      
      expect(taskPlanningGoalSchema.required).toContain('goalId');
      expect(taskPlanningGoalSchema.required).toContain('name');
      
      expect(taskResourceAllocationSchema.required).toContain('allocationId');
      expect(taskResourceAllocationSchema.required).toContain('resourceType');
      
      expect(taskResourceAvailabilitySchema.required).toContain('resourceType');
      expect(taskResourceAvailabilitySchema.required).toContain('availableAmount');
      
      expect(taskExecutionProgressSchema.required).toContain('taskId');
      expect(taskExecutionProgressSchema.required).toContain('progress');
      
      expect(taskExecutionStatusSchema.required).toContain('taskId');
      expect(taskExecutionStatusSchema.required).toContain('status');
      
      expect(taskErrorDetectionSchema.required).toContain('errorId');
      expect(taskErrorDetectionSchema.required).toContain('severity');
      
      expect(taskErrorRecoverySchema.required).toContain('recoveryId');
      expect(taskErrorRecoverySchema.required).toContain('strategy');
      
      expect(taskOptimizationPerformanceSchema.required).toContain('taskId');
      expect(taskOptimizationPerformanceSchema.required).toContain('metrics');
      
      expect(taskOptimizationEfficiencySchema.required).toContain('taskId');
      expect(taskOptimizationEfficiencySchema.required).toContain('metrics');
    });
  });
  
  describe('Validation Functions', () => {
    it('should validate task.planning.plan context', () => {
      const validPlan = {
        planId: 'plan-123',
        name: 'Test Plan',
        steps: [
          {
            stepId: 'step-1',
            action: 'test-action',
            status: 'pending'
          }
        ],
        createdAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.planning.plan', validPlan);
      expect(result.isValid).toBe(true);
      
      const invalidPlan = {
        name: 'Invalid Plan',
        steps: 'not-an-array'
      };
      
      const invalidResult = validateTaskExecutionContext('task.planning.plan', invalidPlan);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.planning.goal context', () => {
      const validGoal = {
        goalId: 'goal-123',
        name: 'Test Goal',
        createdAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.planning.goal', validGoal);
      expect(result.isValid).toBe(true);
      
      const invalidGoal = {
        name: 'Invalid Goal'
      };
      
      const invalidResult = validateTaskExecutionContext('task.planning.goal', invalidGoal);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.resource.allocation context', () => {
      const validAllocation = {
        allocationId: 'alloc-123',
        resourceType: 'cpu',
        amount: 2,
        taskId: 'task-123',
        createdAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.resource.allocation', validAllocation);
      expect(result.isValid).toBe(true);
      
      const invalidAllocation = {
        resourceType: 'cpu',
        amount: 'not-a-number',
        taskId: 'task-123'
      };
      
      const invalidResult = validateTaskExecutionContext('task.resource.allocation', invalidAllocation);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.resource.availability context', () => {
      const validAvailability = {
        resourceType: 'memory',
        totalAmount: 16384,
        availableAmount: 8192,
        updatedAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.resource.availability', validAvailability);
      expect(result.isValid).toBe(true);
      
      const invalidAvailability = {
        resourceType: 'memory',
        totalAmount: 16384
      };
      
      const invalidResult = validateTaskExecutionContext('task.resource.availability', invalidAvailability);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.execution.progress context', () => {
      const validProgress = {
        taskId: 'task-123',
        status: 'in_progress',
        progress: 50,
        updatedAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.execution.progress', validProgress);
      expect(result.isValid).toBe(true);
      
      const invalidProgress = {
        taskId: 'task-123',
        status: 'invalid-status',
        progress: 150
      };
      
      const invalidResult = validateTaskExecutionContext('task.execution.progress', invalidProgress);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.execution.status context', () => {
      const validStatus = {
        taskId: 'task-123',
        status: 'completed',
        updatedAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.execution.status', validStatus);
      expect(result.isValid).toBe(true);
      
      const invalidStatus = {
        status: 'invalid-status'
      };
      
      const invalidResult = validateTaskExecutionContext('task.execution.status', invalidStatus);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.error.detection context', () => {
      const validError = {
        errorId: 'err-123',
        taskId: 'task-123',
        errorType: 'runtime_error',
        severity: 'high',
        detectedAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.error.detection', validError);
      expect(result.isValid).toBe(true);
      
      const invalidError = {
        errorId: 'err-123',
        taskId: 'task-123',
        errorType: 'runtime_error',
        severity: 'invalid-severity'
      };
      
      const invalidResult = validateTaskExecutionContext('task.error.detection', invalidError);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.error.recovery context', () => {
      const validRecovery = {
        recoveryId: 'rec-123',
        errorId: 'err-123',
        taskId: 'task-123',
        strategy: 'retry',
        status: 'pending',
        createdAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.error.recovery', validRecovery);
      expect(result.isValid).toBe(true);
      
      const invalidRecovery = {
        recoveryId: 'rec-123',
        errorId: 'err-123',
        taskId: 'task-123',
        strategy: 'invalid-strategy',
        status: 'pending'
      };
      
      const invalidResult = validateTaskExecutionContext('task.error.recovery', invalidRecovery);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.optimization.performance context', () => {
      const validOptimization = {
        taskId: 'task-123',
        metrics: {
          executionTime: 5000,
          resourceUsage: {
            cpu: 80,
            memory: 1024
          }
        },
        optimizations: [],
        updatedAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.optimization.performance', validOptimization);
      expect(result.isValid).toBe(true);
      
      const invalidOptimization = {
        taskId: 'task-123',
        metrics: 'not-an-object',
        optimizations: []
      };
      
      const invalidResult = validateTaskExecutionContext('task.optimization.performance', invalidOptimization);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should validate task.optimization.efficiency context', () => {
      const validOptimization = {
        taskId: 'task-123',
        metrics: {
          resourceUtilization: 0.8,
          costEfficiency: 0.7
        },
        optimizations: [],
        updatedAt: Date.now()
      };
      
      const result = validateTaskExecutionContext('task.optimization.efficiency', validOptimization);
      expect(result.isValid).toBe(true);
      
      const invalidOptimization = {
        taskId: 'task-123',
        metrics: {
          resourceUtilization: 'not-a-number',
          costEfficiency: 0.7
        },
        optimizations: []
      };
      
      const invalidResult = validateTaskExecutionContext('task.optimization.efficiency', invalidOptimization);
      expect(invalidResult.isValid).toBe(false);
    });
    
    it('should reject unknown context types', () => {
      const data = { foo: 'bar' };
      const result = validateTaskExecutionContext('task.unknown.type', data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Unknown context type');
    });
  });
  
  describe('Schema Validation', () => {
    it('should validate required properties', () => {
      const schema = {
        type: 'object',
        required: ['foo', 'bar'],
        properties: {
          foo: { type: 'string' },
          bar: { type: 'number' }
        }
      };
      
      const validData = { foo: 'test', bar: 123 };
      const invalidData = { foo: 'test' };
      
      expect(validateAgainstSchema(validData, schema).isValid).toBe(true);
      expect(validateAgainstSchema(invalidData, schema).isValid).toBe(false);
    });
    
    it('should validate property types', () => {
      const schema = {
        type: 'object',
        properties: {
          str: { type: 'string' },
          num: { type: 'number' },
          bool: { type: 'boolean' },
          obj: { type: 'object' },
          arr: { type: 'array' }
        }
      };
      
      const validData = {
        str: 'test',
        num: 123,
        bool: true,
        obj: { key: 'value' },
        arr: [1, 2, 3]
      };
      
      const invalidData = {
        str: 123,
        num: 'test',
        bool: 'true',
        obj: [1, 2, 3],
        arr: { key: 'value' }
      };
      
      expect(validateAgainstSchema(validData, schema).isValid).toBe(true);
      expect(validateAgainstSchema(invalidData, schema).isValid).toBe(false);
    });
    
    it('should validate enum values', () => {
      const schema = {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed']
          }
        }
      };
      
      const validData = { status: 'pending' };
      const invalidData = { status: 'invalid' };
      
      expect(validateAgainstSchema(validData, schema).isValid).toBe(true);
      expect(validateAgainstSchema(invalidData, schema).isValid).toBe(false);
    });
    
    it('should validate numeric constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          progress: { 
            type: 'number',
            minimum: 0,
            maximum: 100
          }
        }
      };
      
      const validData = { progress: 50 };
      const invalidData1 = { progress: -10 };
      const invalidData2 = { progress: 110 };
      
      expect(validateAgainstSchema(validData, schema).isValid).toBe(true);
      expect(validateAgainstSchema(invalidData1, schema).isValid).toBe(false);
      expect(validateAgainstSchema(invalidData2, schema).isValid).toBe(false);
    });
    
    it('should validate array items', () => {
      const schema = {
        type: 'object',
        properties: {
          steps: { 
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        }
      };
      
      const validData = { 
        steps: [
          { id: 'step-1', name: 'Step 1' },
          { id: 'step-2', name: 'Step 2' }
        ]
      };
      
      const invalidData = { 
        steps: [
          { id: 'step-1', name: 'Step 1' },
          { id: 'step-2' } // Missing name
        ]
      };
      
      expect(validateAgainstSchema(validData, schema).isValid).toBe(true);
      expect(validateAgainstSchema(invalidData, schema).isValid).toBe(false);
    });
    
    it('should validate nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          metrics: { 
            type: 'object',
            required: ['cpu', 'memory'],
            properties: {
              cpu: { type: 'number' },
              memory: { type: 'number' }
            }
          }
        }
      };
      
      const validData = { 
        metrics: {
          cpu: 80,
          memory: 1024
        }
      };
      
      const invalidData = { 
        metrics: {
          cpu: 80
          // Missing memory
        }
      };
      
      expect(validateAgainstSchema(validData, schema).isValid).toBe(true);
      expect(validateAgainstSchema(invalidData, schema).isValid).toBe(false);
    });
  });
});
