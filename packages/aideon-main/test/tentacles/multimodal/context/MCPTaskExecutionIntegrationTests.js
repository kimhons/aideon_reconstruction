/**
 * @fileoverview Integration tests for MCP Task Execution providers.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { requireModule } = require('./utils/TestModuleResolver');

// Mock dependencies
const { 
  Logger, 
  ConfigurationService, 
  PerformanceMonitor, 
  EnhancedAsyncLockAdapter 
} = require('./mocks/CoreDependencies');

// Create mock dependencies object
const mockDependencies = {
  Logger,
  ConfigurationService,
  PerformanceMonitor
};

// Mock logger instance for tests
const mockLogger = new Logger('TestLogger');
const { MCPTaskPlanningEngineProvider } = requireModule('src/tentacles/multimodal/context/providers/MCPTaskPlanningEngineProvider');
const { MCPResourceAllocationManagerProvider } = requireModule('src/tentacles/multimodal/context/providers/MCPResourceAllocationManagerProvider');
const { MCPExecutionMonitorProvider } = requireModule('src/tentacles/multimodal/context/providers/MCPExecutionMonitorProvider');
const { MCPErrorRecoverySystemProvider } = requireModule('src/tentacles/multimodal/context/providers/MCPErrorRecoverySystemProvider');
const { MCPTaskOptimizationEngineProvider } = requireModule('src/tentacles/multimodal/context/providers/MCPTaskOptimizationEngineProvider');
const { validateTaskExecutionContext } = requireModule('src/tentacles/multimodal/context/schemas/TaskExecutionContextSchemas');

describe('MCP Task Execution Integration Tests', () => {
  let taskPlanningProvider;
  let resourceAllocationProvider;
  let executionMonitorProvider;
  let errorRecoveryProvider;
  let taskOptimizationProvider;
  
  beforeEach(() => {
    // Initialize providers with mock dependencies
    taskPlanningProvider = new MCPTaskPlanningEngineProvider({
      logger: mockLogger,
      providerId: 'test-task-planning',
      lockAdapter: EnhancedAsyncLockAdapter,
      dependencies: mockDependencies
    });
    
    resourceAllocationProvider = new MCPResourceAllocationManagerProvider({
      logger: mockLogger,
      providerId: 'test-resource-allocation',
      lockAdapter: EnhancedAsyncLockAdapter,
      dependencies: mockDependencies
    });
    
    executionMonitorProvider = new MCPExecutionMonitorProvider({
      logger: mockLogger,
      providerId: 'test-execution-monitor',
      lockAdapter: EnhancedAsyncLockAdapter,
      dependencies: mockDependencies
    });
    
    errorRecoveryProvider = new MCPErrorRecoverySystemProvider({
      logger: mockLogger,
      providerId: 'test-error-recovery',
      lockAdapter: EnhancedAsyncLockAdapter,
      dependencies: mockDependencies
    });
    
    taskOptimizationProvider = new MCPTaskOptimizationEngineProvider({
      logger: mockLogger,
      providerId: 'test-task-optimization',
      lockAdapter: EnhancedAsyncLockAdapter,
      dependencies: mockDependencies
    });
    
    // Mock provider methods
    taskPlanningProvider.provideContext = jest.fn();
    resourceAllocationProvider.provideContext = jest.fn();
    executionMonitorProvider.provideContext = jest.fn();
    errorRecoveryProvider.provideContext = jest.fn();
    taskOptimizationProvider.provideContext = jest.fn();
  });
  
  describe('Provider Initialization', () => {
    it('should initialize MCPTaskPlanningEngineProvider', () => {
      expect(taskPlanningProvider).toBeDefined();
      expect(taskPlanningProvider.getSupportedContextTypes()).toContain('task.planning.plan');
      expect(taskPlanningProvider.getSupportedContextTypes()).toContain('task.planning.goal');
    });
    
    it('should initialize MCPResourceAllocationManagerProvider', () => {
      expect(resourceAllocationProvider).toBeDefined();
      expect(resourceAllocationProvider.getSupportedContextTypes()).toContain('task.resource.allocation');
      expect(resourceAllocationProvider.getSupportedContextTypes()).toContain('task.resource.availability');
    });
    
    it('should initialize MCPExecutionMonitorProvider', () => {
      expect(executionMonitorProvider).toBeDefined();
      expect(executionMonitorProvider.getSupportedContextTypes()).toContain('task.execution.progress');
      expect(executionMonitorProvider.getSupportedContextTypes()).toContain('task.execution.status');
    });
    
    it('should initialize MCPErrorRecoverySystemProvider', () => {
      expect(errorRecoveryProvider).toBeDefined();
      expect(errorRecoveryProvider.getSupportedContextTypes()).toContain('task.error.detection');
      expect(errorRecoveryProvider.getSupportedContextTypes()).toContain('task.error.recovery');
    });
    
    it('should initialize MCPTaskOptimizationEngineProvider', () => {
      expect(taskOptimizationProvider).toBeDefined();
      expect(taskOptimizationProvider.getSupportedContextTypes()).toContain('task.optimization.performance');
      expect(taskOptimizationProvider.getSupportedContextTypes()).toContain('task.optimization.efficiency');
    });
  });
  
  describe('Context Validation', () => {
    it('should validate task.planning.plan context', async () => {
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
      
      // Should not throw
      await expect(taskPlanningProvider.validateContextData('task.planning.plan', validPlan)).resolves.not.toThrow();
      
      const invalidPlan = {
        name: 'Invalid Plan',
        steps: 'not-an-array'
      };
      
      // Should throw
      await expect(taskPlanningProvider.validateContextData('task.planning.plan', invalidPlan)).rejects.toThrow();
    });
    
    it('should validate task.resource.allocation context', async () => {
      const validAllocation = {
        allocationId: 'alloc-123',
        resourceType: 'cpu',
        amount: 2,
        taskId: 'task-123',
        createdAt: Date.now()
      };
      
      // Should not throw
      await expect(resourceAllocationProvider.validateContextData('task.resource.allocation', validAllocation)).resolves.not.toThrow();
      
      const invalidAllocation = {
        resourceType: 'cpu',
        amount: 'not-a-number',
        taskId: 'task-123'
      };
      
      // Should throw
      await expect(resourceAllocationProvider.validateContextData('task.resource.allocation', invalidAllocation)).rejects.toThrow();
    });
    
    it('should validate task.execution.progress context', async () => {
      const validProgress = {
        taskId: 'task-123',
        status: 'in_progress',
        progress: 50,
        updatedAt: Date.now()
      };
      
      // Should not throw
      await expect(executionMonitorProvider.validateContextData('task.execution.progress', validProgress)).resolves.not.toThrow();
      
      const invalidProgress = {
        taskId: 'task-123',
        status: 'invalid-status',
        progress: 150
      };
      
      // Should throw
      await expect(executionMonitorProvider.validateContextData('task.execution.progress', invalidProgress)).rejects.toThrow();
    });
    
    it('should validate task.error.detection context', async () => {
      const validError = {
        errorId: 'err-123',
        taskId: 'task-123',
        errorType: 'runtime_error',
        severity: 'high',
        detectedAt: Date.now()
      };
      
      // Should not throw
      await expect(errorRecoveryProvider.validateContextData('task.error.detection', validError)).resolves.not.toThrow();
      
      const invalidError = {
        errorId: 'err-123',
        taskId: 'task-123',
        errorType: 'runtime_error',
        severity: 'invalid-severity'
      };
      
      // Should throw
      await expect(errorRecoveryProvider.validateContextData('task.error.detection', invalidError)).rejects.toThrow();
    });
    
    it('should validate task.optimization.performance context', async () => {
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
      
      // Should not throw
      await expect(taskOptimizationProvider.validateContextData('task.optimization.performance', validOptimization)).resolves.not.toThrow();
      
      const invalidOptimization = {
        taskId: 'task-123',
        metrics: 'not-an-object',
        optimizations: []
      };
      
      // Should throw
      await expect(taskOptimizationProvider.validateContextData('task.optimization.performance', invalidOptimization)).rejects.toThrow();
    });
  });
  
  describe('Privacy Controls', () => {
    it('should apply privacy controls to task.planning.plan context', () => {
      const planWithSensitiveData = {
        planId: 'plan-123',
        name: 'Test Plan',
        steps: [
          {
            stepId: 'step-1',
            action: 'test-action',
            status: 'pending',
            parameters: {
              credentials: 'secret-password',
              apiKey: 'secret-api-key',
              normalParam: 'normal-value'
            }
          }
        ],
        metadata: {
          userInfo: 'sensitive-user-info',
          normalInfo: 'normal-info'
        },
        createdAt: Date.now()
      };
      
      const sanitizedPlan = taskPlanningProvider.applyPrivacyControls('task.planning.plan', planWithSensitiveData);
      
      // Sensitive data should be redacted
      expect(sanitizedPlan.steps[0].parameters.credentials).toBe('[REDACTED]');
      expect(sanitizedPlan.steps[0].parameters.apiKey).toBe('[REDACTED]');
      expect(sanitizedPlan.metadata.userInfo).toBe('[REDACTED]');
      
      // Normal data should be preserved
      expect(sanitizedPlan.steps[0].parameters.normalParam).toBe('normal-value');
      expect(sanitizedPlan.metadata.normalInfo).toBe('normal-info');
    });
    
    it('should apply privacy controls to task.error.detection context', () => {
      const errorWithSensitiveData = {
        errorId: 'err-123',
        taskId: 'task-123',
        errorType: 'runtime_error',
        severity: 'high',
        details: {
          credentials: 'secret-password',
          authToken: 'secret-token',
          normalDetail: 'normal-value'
        },
        // Note: stackTrace is intentionally omitted to test robustness
        detectedAt: Date.now()
      };
      
      const sanitizedError = errorRecoveryProvider.applyPrivacyControls('task.error.detection', errorWithSensitiveData);
      
      // Sensitive data should be redacted
      expect(sanitizedError.details.credentials).toBe('[REDACTED]');
      expect(sanitizedError.details.authToken).toBe('[REDACTED]');
      
      // Normal data should be preserved
      expect(sanitizedError.details.normalDetail).toBe('normal-value');
    });
  });
  
  describe('Context Processing', () => {
    it('should process task.planning.plan context in resource allocation provider', async () => {
      const plan = {
        planId: 'plan-123',
        name: 'Test Plan',
        steps: [
          {
            stepId: 'step-1',
            action: 'test-action',
            status: 'pending',
            parameters: {
              resources: {
                cpu: 2,
                memory: 1024,
                network: 100,
                disk: 5000
              }
            },
            estimatedDuration: 5000
          },
          {
            stepId: 'step-2',
            action: 'another-action',
            status: 'pending',
            parameters: {
              resources: {
                cpu: 1,
                memory: 512,
                network: 50,
                disk: 1000
              }
            },
            estimatedDuration: 3000
          }
        ],
        createdAt: Date.now()
      };
      
      // Spy on estimateResourceRequirements
      const estimateSpy = jest.spyOn(resourceAllocationProvider, 'estimateResourceRequirements');
      
      await resourceAllocationProvider.processContext('task.planning.plan', plan, { providerId: 'test' });
      
      // Should have called estimateResourceRequirements
      expect(estimateSpy).toHaveBeenCalledWith(plan);
      
      // Verify the estimated requirements
      const requirements = estimateSpy.mock.results[0].value;
      expect(requirements.cpu).toBe(3); // 2 + 1
      expect(requirements.memory).toBe(1536); // 1024 + 512
      expect(requirements.duration).toBe(8000); // 5000 + 3000
    });
    
    it('should process task.execution.status context in error recovery provider', async () => {
      const failedStatus = {
        taskId: 'task-123',
        planId: 'plan-123',
        status: 'failed',
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          details: { foo: 'bar' }
        },
        updatedAt: Date.now()
      };
      
      // Spy on initiateRecovery
      const initiateSpy = jest.spyOn(errorRecoveryProvider, 'initiateRecovery').mockResolvedValue();
      
      await errorRecoveryProvider.processContext('task.execution.status', failedStatus, { providerId: 'test' });
      
      // Should have called initiateRecovery
      expect(initiateSpy).toHaveBeenCalled();
      
      // Verify the error detection context
      const errorDetection = initiateSpy.mock.calls[0][0];
      expect(errorDetection.taskId).toBe('task-123');
      expect(errorDetection.planId).toBe('plan-123');
      expect(errorDetection.errorType).toBe('TEST_ERROR');
      expect(errorDetection.message).toBe('Test error message');
    });
    
    it('should process task.execution.status context in task optimization provider', async () => {
      const statusWithPerformance = {
        taskId: 'task-123',
        planId: 'plan-123',
        status: 'in_progress',
        performance: {
          executionTime: 5000,
          cpuUsage: 80,
          memoryUsage: 1024 * 1024 * 1024, // 1 GB
          networkUsage: 1000000
        },
        updatedAt: Date.now()
      };
      
      // Spy on shouldOptimizePerformance
      const shouldOptimizeSpy = jest.spyOn(taskOptimizationProvider, 'shouldOptimizePerformance').mockReturnValue(true);
      
      // Spy on generatePerformanceRecommendations
      const generateRecommendationsSpy = jest.spyOn(taskOptimizationProvider, 'generatePerformanceRecommendations').mockReturnValue([
        {
          recommendationId: 'rec-1',
          type: 'cpu_optimization',
          description: 'Test recommendation',
          parameters: {},
          confidence: 0.8,
          estimatedImpact: {
            executionTime: -15,
            resourceUsage: -30
          }
        }
      ]);
      
      await taskOptimizationProvider.processContext('task.execution.status', statusWithPerformance, { providerId: 'test' });
      
      // Should have called shouldOptimizePerformance
      expect(shouldOptimizeSpy).toHaveBeenCalled();
      
      // Should have called generatePerformanceRecommendations
      expect(generateRecommendationsSpy).toHaveBeenCalled();
      
      // Should have called provideContext with recommendations
      expect(taskOptimizationProvider.provideContext).toHaveBeenCalledWith(
        'task.optimization.performance',
        expect.objectContaining({
          taskId: 'task-123',
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              type: 'cpu_optimization'
            })
          ])
        })
      );
    });
  });
  
  describe('Cross-Provider Integration', () => {
    it('should handle task execution lifecycle across providers', async () => {
      // 1. Create a plan in task planning provider
      const plan = {
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
      
      // Mock executionMonitorProvider.processContext to capture the plan
      const executionMonitorProcessSpy = jest.spyOn(executionMonitorProvider, 'processContext');
      
      // Process plan in task planning provider
      await taskPlanningProvider.consumeContext('task.planning.plan', plan, { providerId: 'test-task-planning' });
      
      // 2. Provide plan to execution monitor
      await executionMonitorProvider.processContext('task.planning.plan', plan, { providerId: 'test-task-planning' });
      
      // Verify execution monitor initialized progress and status
      expect(executionMonitorProvider.provideContext).toHaveBeenCalledWith(
        'task.execution.progress',
        expect.objectContaining({
          taskId: 'plan-123',
          status: 'pending',
          progress: 0
        })
      );
      
      expect(executionMonitorProvider.provideContext).toHaveBeenCalledWith(
        'task.execution.status',
        expect.objectContaining({
          taskId: 'plan-123',
          status: 'pending'
        })
      );
      
      // 3. Allocate resources
      const allocation = {
        allocationId: 'alloc-123',
        resourceType: 'cpu',
        amount: 2,
        taskId: 'plan-123',
        status: 'active',
        createdAt: Date.now()
      };
      
      // Mock executionMonitorProvider.processResourceAllocationContext
      const processResourceSpy = jest.spyOn(executionMonitorProvider, 'processResourceAllocationContext');
      
      // Process allocation in resource allocation provider
      await resourceAllocationProvider.consumeContext('task.resource.allocation', allocation, { providerId: 'test-resource-allocation' });
      
      // Provide allocation to execution monitor
      await executionMonitorProvider.processContext('task.resource.allocation', allocation, { providerId: 'test-resource-allocation' });
      
      // Verify execution monitor updated status to in_progress
      expect(executionMonitorProvider.provideContext).toHaveBeenCalledWith(
        'task.execution.status',
        expect.objectContaining({
          taskId: 'plan-123',
          status: 'in_progress'
        })
      );
      
      // 4. Update progress
      await executionMonitorProvider.updateTaskProgress('plan-123', 50, 'step-1', ['step-1']);
      
      // Verify execution monitor updated progress
      expect(executionMonitorProvider.provideContext).toHaveBeenCalledWith(
        'task.execution.progress',
        expect.objectContaining({
          taskId: 'plan-123',
          progress: 50,
          currentStepId: 'step-1',
          completedSteps: ['step-1']
        })
      );
      
      // 5. Simulate error
      const errorStatus = {
        taskId: 'plan-123',
        planId: 'plan-123',
        status: 'failed',
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message'
        },
        updatedAt: Date.now()
      };
      
      // Mock errorRecoveryProvider.initiateRecovery
      const initiateRecoverySpy = jest.spyOn(errorRecoveryProvider, 'initiateRecovery').mockResolvedValue();
      
      // Process error status in error recovery provider
      await errorRecoveryProvider.processContext('task.execution.status', errorStatus, { providerId: 'test-execution-monitor' });
      
      // Verify error recovery provider initiated recovery
      expect(initiateRecoverySpy).toHaveBeenCalled();
      
      // 6. Simulate recovery
      const recovery = {
        recoveryId: 'rec-123',
        errorId: expect.any(String),
        taskId: 'plan-123',
        planId: 'plan-123',
        strategy: 'retry',
        status: 'succeeded',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Process recovery in execution monitor
      await executionMonitorProvider.processContext('task.error.recovery', recovery, { providerId: 'test-error-recovery' });
      
      // Verify execution monitor updated status to in_progress after recovery
      expect(executionMonitorProvider.provideContext).toHaveBeenCalledWith(
        'task.execution.status',
        expect.objectContaining({
          taskId: 'plan-123',
          status: 'in_progress'
        })
      );
      
      // 7. Complete task
      await executionMonitorProvider.updateTaskProgress('plan-123', 100, 'step-1', ['step-1']);
      
      // Verify execution monitor updated status to completed
      expect(executionMonitorProvider.provideContext).toHaveBeenCalledWith(
        'task.execution.status',
        expect.objectContaining({
          taskId: 'plan-123',
          status: 'completed'
        })
      );
      
      // 8. Release resources
      const completedStatus = {
        taskId: 'plan-123',
        planId: 'plan-123',
        status: 'completed',
        updatedAt: Date.now()
      };
      
      // Mock resourceAllocationProvider.releaseResourcesForTask
      const releaseResourcesSpy = jest.spyOn(resourceAllocationProvider, 'releaseResourcesForTask').mockResolvedValue();
      
      // Process completed status in resource allocation provider
      await resourceAllocationProvider.processContext('task.execution.status', completedStatus, { providerId: 'test-execution-monitor' });
      
      // Verify resource allocation provider released resources
      expect(releaseResourcesSpy).toHaveBeenCalledWith('plan-123');
    });
  });
});
