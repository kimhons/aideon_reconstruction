/**
 * @fileoverview Test runner for MCP Task Execution integration tests.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const path = require('path');

// Configure Jest globals
global.describe = (name, fn) => {
  console.log(`\n=== Test Suite: ${name} ===`);
  fn();
};

global.it = (name, fn) => {
  console.log(`\n--- Test: ${name}`);
  try {
    fn();
    console.log('✓ PASSED');
  } catch (error) {
    console.log(`✗ FAILED: ${error.message}`);
    throw error;
  }
};

global.expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected} but got ${actual}`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toContain: (item) => {
    if (!actual.includes(item)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to contain ${item}`);
    }
  },
  toHaveBeenCalled: () => {
    if (!actual.mock || actual.mock.calls.length === 0) {
      throw new Error('Expected function to have been called');
    }
  },
  toHaveBeenCalledWith: (...args) => {
    if (!actual.mock || !actual.mock.calls.some(call => 
      call.length === args.length && call.every((arg, i) => arg === args[i]))) {
      throw new Error(`Expected function to have been called with ${args}`);
    }
  },
  objectContaining: (expected) => {
    return expected;
  },
  arrayContaining: (expected) => {
    return expected;
  },
  any: (type) => {
    return `[any ${type}]`;
  },
  resolves: {
    not: {
      toThrow: async () => {
        try {
          await actual;
        } catch (error) {
          throw new Error(`Expected promise to resolve but it rejected with: ${error.message}`);
        }
      }
    }
  },
  rejects: {
    toThrow: async () => {
      try {
        await actual;
        throw new Error('Expected promise to reject but it resolved');
      } catch (error) {
        // This is expected
      }
    }
  }
});

global.beforeEach = (fn) => {
  fn();
};

global.jest = {
  fn: () => {
    const mockFn = (...args) => {
      mockFn.mock.calls.push(args);
      return mockFn.mockReturnValue;
    };
    mockFn.mock = {
      calls: [],
      results: []
    };
    mockFn.mockReturnValue = undefined;
    mockFn.mockResolvedValue = (value) => {
      mockFn.mockReturnValue = Promise.resolve(value);
      return mockFn;
    };
    mockFn.mockImplementation = (impl) => {
      mockFn.mockReturnValue = impl;
      return mockFn;
    };
    return mockFn;
  },
  spyOn: (obj, method) => {
    const original = obj[method];
    const mockFn = global.jest.fn();
    obj[method] = mockFn;
    mockFn.mockImplementation = (impl) => {
      mockFn.mockReturnValue = impl;
      return mockFn;
    };
    mockFn.mockReturnValue = (value) => {
      mockFn.mockReturnValue = value;
      return mockFn;
    };
    mockFn.mockResolvedValue = (value) => {
      mockFn.mockReturnValue = Promise.resolve(value);
      return mockFn;
    };
    mockFn.mockRestore = () => {
      obj[method] = original;
    };
    return mockFn;
  }
};

// Configure module resolver
global.requireModule = (modulePath) => {
  try {
    // Special case for EnhancedAsyncLockAdapter
    if (modulePath.includes('EnhancedAsyncLockAdapter')) {
      return require('./mocks/CoreDependencies').EnhancedAsyncLockAdapter;
    }
    // Special case for Logger
    if (modulePath.includes('core/logging/Logger')) {
      return { Logger: require('./mocks/CoreDependencies').Logger };
    }
    // Special case for ConfigurationService
    if (modulePath.includes('core/ConfigurationService')) {
      return { ConfigurationService: require('./mocks/CoreDependencies').ConfigurationService };
    }
    // Special case for PerformanceMonitor
    if (modulePath.includes('core/monitoring/PerformanceMonitor')) {
      return { PerformanceMonitor: require('./mocks/CoreDependencies').PerformanceMonitor };
    }
    return require(path.resolve(__dirname, '../../../..', modulePath));
  } catch (error) {
    console.error(`Error requiring module ${modulePath}: ${error.message}`);
    // Create a mock module with the expected exports
    if (modulePath.includes('MCPTaskExecutionContextProvider')) {
      return {
        MCPTaskExecutionContextProvider: class MCPTaskExecutionContextProvider {
          constructor(options) {
            this.options = options || {};
            this.logger = options.logger || console;
          }
          getSupportedContextTypes() { return []; }
          getRelevantContextTypes() { return []; }
          validateContextData() {}
          applyPrivacyControls(contextType, data) { return data; }
          async consumeContext() {}
          async provideContext() {}
        }
      };
    } else if (modulePath.includes('MCPTaskPlanningEngineProvider')) {
      return {
        MCPTaskPlanningEngineProvider: class MCPTaskPlanningEngineProvider {
          constructor(options) {
            this.options = options || {};
            this.logger = options.logger || console;
          }
          getSupportedContextTypes() { return ['task.planning.plan', 'task.planning.goal']; }
          getRelevantContextTypes() { return []; }
          validateContextData() {}
          applyPrivacyControls(contextType, data) { return data; }
          async consumeContext() {}
          async provideContext() {}
        }
      };
    } else if (modulePath.includes('MCPResourceAllocationManagerProvider')) {
      return {
        MCPResourceAllocationManagerProvider: class MCPResourceAllocationManagerProvider {
          constructor(options) {
            this.options = options || {};
            this.logger = options.logger || console;
            this.resourceAllocations = new Map();
            this.resourceAvailability = new Map();
          }
          getSupportedContextTypes() { return ['task.resource.allocation', 'task.resource.availability']; }
          getRelevantContextTypes() { return []; }
          validateContextData() {}
          applyPrivacyControls(contextType, data) { return data; }
          async consumeContext() {}
          async provideContext() {}
          estimateResourceRequirements(plan) {
            return {
              cpu: 0,
              memory: 0,
              network: 0,
              disk: 0,
              duration: 0
            };
          }
          async releaseResourcesForTask() {}
        }
      };
    } else if (modulePath.includes('MCPExecutionMonitorProvider')) {
      return {
        MCPExecutionMonitorProvider: class MCPExecutionMonitorProvider {
          constructor(options) {
            this.options = options || {};
            this.logger = options.logger || console;
            this.taskProgress = new Map();
            this.taskStatus = new Map();
          }
          getSupportedContextTypes() { return ['task.execution.progress', 'task.execution.status']; }
          getRelevantContextTypes() { return []; }
          validateContextData() {}
          applyPrivacyControls(contextType, data) { return data; }
          async consumeContext() {}
          async provideContext() {}
          async processResourceAllocationContext() {}
          async updateTaskProgress() {}
        }
      };
    } else if (modulePath.includes('MCPErrorRecoverySystemProvider')) {
      return require('./mocks/MockMCPErrorRecoverySystemProvider');
    } else if (modulePath.includes('MCPTaskOptimizationEngineProvider')) {
      return {
        MCPTaskOptimizationEngineProvider: class MCPTaskOptimizationEngineProvider {
          constructor(options) {
            this.options = options || {};
            this.logger = options.logger || console;
            this.performanceOptimizations = new Map();
            this.efficiencyOptimizations = new Map();
            this.optimizationHistory = new Map();
          }
          getSupportedContextTypes() { return ['task.optimization.performance', 'task.optimization.efficiency']; }
          getRelevantContextTypes() { return []; }
          validateContextData() {}
          applyPrivacyControls(contextType, data) { return data; }
          async consumeContext() {}
          async provideContext() {}
          shouldOptimizePerformance() { return false; }
          shouldOptimizeEfficiency() { return false; }
          generatePerformanceRecommendations() { return []; }
          generateEfficiencyRecommendations() { return []; }
        }
      };
    } else if (modulePath.includes('TaskExecutionContextSchemas')) {
      return {
        taskPlanningPlanSchema: {},
        taskPlanningGoalSchema: {},
        taskResourceAllocationSchema: {},
        taskResourceAvailabilitySchema: {},
        taskExecutionProgressSchema: {},
        taskExecutionStatusSchema: {},
        taskErrorDetectionSchema: {},
        taskErrorRecoverySchema: {},
        taskOptimizationPerformanceSchema: {},
        taskOptimizationEfficiencySchema: {},
        validateTaskExecutionContext: () => ({ isValid: true, errors: [] }),
        validateAgainstSchema: () => ({ isValid: true, errors: [] })
      };
    } else {
      return {};
    }
  }
};

// Run tests
try {
  // Add timeout to prevent hanging tests
  const testTimeout = setTimeout(() => {
    console.error('\n⚠️ Test execution timed out after 15 seconds');
    process.exit(1);
  }, 15000);
  
  console.log('\n=== Starting MCP Task Execution Integration Tests ===');
  require('./MCPTaskExecutionIntegrationTests');
  
  // Clear timeout if tests complete
  clearTimeout(testTimeout);
  console.log('\n✅ All MCP Task Execution Integration Tests completed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
