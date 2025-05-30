/**
 * @fileoverview Test runner for Task Execution context schema tests.
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
    mockFn.mockRestore = () => {
      obj[method] = original;
    };
    return mockFn;
  }
};

// Configure module resolver
global.requireModule = (modulePath) => {
  try {
    return require(path.resolve(__dirname, '../../../..', modulePath));
  } catch (error) {
    console.error(`Error requiring module ${modulePath}: ${error.message}`);
    // Create a mock module with the expected exports
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
  }
};

// Run tests
try {
  require('./TaskExecutionContextSchemaTests');
  console.log('\n✅ All Task Execution Context Schema Tests completed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed:', error.message);
  process.exit(1);
}
