/**
 * @fileoverview Debug version of test runner for MCP UI Integration Tests.
 * 
 * This module runs the integration tests for UI Context Providers with enhanced
 * debugging capabilities to diagnose hanging issues.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

console.log('[STARTUP] Debug test runner starting...');

try {
  console.log('[STARTUP] Loading path module');
  const path = require('path');
  console.log('[STARTUP] Loading assert module');
  const assert = require('assert');
  console.log('[STARTUP] Loading events module');
  const { EventEmitter } = require('events');
  console.log('[STARTUP] Core modules loaded successfully');
} catch (error) {
  console.error('[STARTUP] Failed to load core modules:', error);
  process.exit(1);
}

// Log current directory and file structure
console.log('[STARTUP] Current directory:', __dirname);
try {
  console.log('[STARTUP] Loading fs module');
  const fs = require('fs');
  console.log('[STARTUP] Checking mocks directory');
  const mocksExists = fs.existsSync(path.join(__dirname, 'mocks'));
  console.log('[STARTUP] Mocks directory exists:', mocksExists);
  if (mocksExists) {
    const mockFiles = fs.readdirSync(path.join(__dirname, 'mocks'));
    console.log('[STARTUP] Mock files:', mockFiles);
  }
} catch (error) {
  console.error('[STARTUP] Error checking file structure:', error);
}

// Try to load the mock directly
console.log('[STARTUP] Attempting to load MCPUIContextProvider mock directly');
let MCPUIContextProvider;
try {
  MCPUIContextProvider = require(path.join(__dirname, 'mocks', 'MCPUIContextProvider.js'));
  console.log('[STARTUP] MCPUIContextProvider loaded successfully');
  console.log('[STARTUP] MCPUIContextProvider type:', typeof MCPUIContextProvider);
  console.log('[STARTUP] Is constructor:', typeof MCPUIContextProvider === 'function');
} catch (error) {
  console.error('[STARTUP] Failed to load MCPUIContextProvider:', error);
  process.exit(1);
}

// Configure module resolver with debug logging
console.log('[STARTUP] Setting up module resolver');
global.requireModule = (modulePath) => {
  console.log(`[DEBUG] Attempting to resolve module: ${modulePath}`);
  try {
    if (modulePath.includes('EnhancedAsyncLockAdapter')) {
      console.log('[DEBUG] Using mock EnhancedAsyncLockAdapter');
      return require(path.join(__dirname, 'mocks', 'EnhancedAsyncLockAdapter.js'));
    } else if (modulePath.includes('UIContextSchemas')) {
      console.log('[DEBUG] Using mock UIContextSchemas');
      return require(path.join(__dirname, 'schemas', 'UIContextSchemas.js'));
    } else if (modulePath.includes('MCPUIContextProvider')) {
      console.log('[DEBUG] Using mock MCPUIContextProvider directly');
      return MCPUIContextProvider;
    } else if (modulePath.includes('MCPUIStateManagerProvider') ||
               modulePath.includes('MCPInteractionTrackerProvider') ||
               modulePath.includes('MCPPreferenceManagerProvider') ||
               modulePath.includes('MCPAccessibilityEngineProvider') ||
               modulePath.includes('MCPThemeManagerProvider')) {
      console.log(`[DEBUG] Using mock MCPUIContextProvider for ${modulePath}`);
      return MCPUIContextProvider;
    }
    
    console.log(`[DEBUG] Attempting standard resolution for ${modulePath}`);
    return require(path.resolve(__dirname, '../../../../', modulePath));
  } catch (error) {
    console.error(`[DEBUG] Failed to resolve module: ${modulePath}`, error);
    throw error;
  }
};

// Mock dependencies with debug logging
console.log('[STARTUP] Creating mock dependencies');
class MockLogger {
  info(message) { console.log(`[MOCK_LOGGER] INFO: ${message}`); }
  debug(message) { console.log(`[MOCK_LOGGER] DEBUG: ${message}`); }
  warn(message) { console.log(`[MOCK_LOGGER] WARN: ${message}`); }
  error(message, error) { 
    console.error(`[MOCK_LOGGER] ERROR: ${message}`);
    if (error) console.error(error);
  }
}

class MockConfigService {
  get(key) { 
    console.log(`[MOCK_CONFIG] Getting config for: ${key}`);
    return {}; 
  }
  set(key, value) { 
    console.log(`[MOCK_CONFIG] Setting config for: ${key}`);
    return true; 
  }
}

class MockPerformanceMonitor {
  startTimer(name) { 
    console.log(`[MOCK_PERF] Starting timer: ${name}`);
    return Date.now(); 
  }
  endTimer(name, startTime) { 
    console.log(`[MOCK_PERF] Ending timer: ${name}`);
    return Date.now() - startTime; 
  }
  recordMetric(name, value) {
    console.log(`[MOCK_PERF] Recording metric: ${name} = ${value}`);
  }
}

class MockSecurityManager {
  checkAccess(resource, action) { 
    console.log(`[MOCK_SECURITY] Checking access: ${resource} - ${action}`);
    return true; 
  }
  hasPermission(permission) { 
    console.log(`[MOCK_SECURITY] Checking permission: ${permission}`);
    return true; 
  }
}

class MockMCPContextManager extends EventEmitter {
  constructor() {
    super();
    this.registeredProviders = new Map();
    this.persistedContext = new Map();
    console.log('[MOCK_MCP_CONTEXT_MANAGER] Created');
  }
  
  async registerContextProvider(contextType, provider) {
    console.log(`[MOCK_MCP_CONTEXT_MANAGER] Registering provider for: ${contextType}`);
    this.registeredProviders.set(contextType, provider);
    return true;
  }
  
  async persistContext(data) {
    console.log(`[MOCK_MCP_CONTEXT_MANAGER] Persisting context: ${data.contextType}`);
    this.persistedContext.set(data.contextType, data);
    return true;
  }
  
  async loadPersistedContext(contextType) {
    console.log(`[MOCK_MCP_CONTEXT_MANAGER] Loading persisted context: ${contextType}`);
    return this.persistedContext.get(contextType);
  }
  
  async respondToContextRequest(requestId, response) {
    console.log(`[MOCK_MCP_CONTEXT_MANAGER] Responding to request: ${requestId}`);
    this.emit('contextResponse', { requestId, response });
    return true;
  }
}

// Simple test harness with timeouts and debug logging
console.log('[STARTUP] Creating test harness');
class TestHarness {
  constructor() {
    console.log('[TEST_HARNESS] Initializing');
    this.tests = [];
    this.currentSuite = null;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.testTimeout = 2000; // 2 seconds per test
    console.log('[TEST_HARNESS] Initialized');
  }

  describe(name, fn) {
    console.log(`[TEST_HARNESS] Registering test suite: ${name}`);
    const previousSuite = this.currentSuite;
    this.currentSuite = name;
    fn();
    this.currentSuite = previousSuite;
    console.log(`[TEST_HARNESS] Registered test suite: ${name}`);
  }

  it(name, fn) {
    console.log(`[TEST_HARNESS] Registering test: ${this.currentSuite} - ${name}`);
    this.tests.push({
      suite: this.currentSuite,
      name,
      fn
    });
    console.log(`[TEST_HARNESS] Registered test: ${this.currentSuite} - ${name}`);
  }

  async runTests() {
    console.log('[TEST_HARNESS] Starting test execution');
    
    for (const test of this.tests) {
      console.log(`[TEST_HARNESS] Running test: [${test.suite}] ${test.name}`);
      
      try {
        console.log(`[TEST_HARNESS] Setting up test promise: [${test.suite}] ${test.name}`);
        // Create a promise with timeout
        const testPromise = new Promise(async (resolve, reject) => {
          try {
            console.log(`[TEST_HARNESS] Executing test function: [${test.suite}] ${test.name}`);
            await test.fn();
            console.log(`[TEST_HARNESS] Test function completed: [${test.suite}] ${test.name}`);
            resolve();
          } catch (error) {
            console.error(`[TEST_HARNESS] Test function error: [${test.suite}] ${test.name}`, error);
            reject(error);
          }
        });
        
        console.log(`[TEST_HARNESS] Setting up timeout: [${test.suite}] ${test.name}`);
        // Add timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            console.error(`[TEST_HARNESS] Test timed out: [${test.suite}] ${test.name}`);
            reject(new Error(`Test timed out after ${this.testTimeout}ms`));
          }, this.testTimeout);
        });
        
        console.log(`[TEST_HARNESS] Racing promises: [${test.suite}] ${test.name}`);
        // Race the test against the timeout
        await Promise.race([testPromise, timeoutPromise]);
        
        console.log(`[TEST_HARNESS] Test passed: [${test.suite}] ${test.name}`);
        this.passed++;
      } catch (error) {
        console.error(`[TEST_HARNESS] Test failed: [${test.suite}] ${test.name}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        this.failed++;
        this.errors.push({
          suite: test.suite,
          name: test.name,
          error
        });
      }
    }
    
    console.log(`[TEST_HARNESS] All tests completed: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      console.error('[TEST_HARNESS] Failed tests summary:');
      for (const error of this.errors) {
        console.error(`   [${error.suite}] ${error.name}`);
        console.error(`   Error: ${error.error.message}`);
        console.error('   Stack:', error.error.stack);
        console.error('');
      }
      return false;
    }
    
    return true;
  }
}

// Create test harness and expose methods
console.log('[STARTUP] Exposing test harness methods globally');
const testHarness = new TestHarness();
global.describe = testHarness.describe.bind(testHarness);
global.it = testHarness.it.bind(testHarness);

// Simplified beforeEach implementation
console.log('[STARTUP] Setting up beforeEach hook');
let beforeEachFn = () => {
  console.log('[BEFORE_EACH] Default empty hook executed');
  return Promise.resolve();
};
global.beforeEach = (fn) => {
  console.log('[STARTUP] Registering beforeEach hook');
  const originalFn = beforeEachFn;
  beforeEachFn = async () => {
    console.log('[BEFORE_EACH] Running original hook');
    await originalFn();
    console.log('[BEFORE_EACH] Running new hook');
    await fn();
    console.log('[BEFORE_EACH] Hooks completed');
  };
  console.log('[STARTUP] beforeEach hook registered');
};

// Create simplified test suite for debugging
console.log('[STARTUP] Defining test suite');
describe('MCP UI Integration Debug Tests', () => {
  console.log('[TEST_SUITE] Defining test variables');
  // Common test variables
  let logger;
  let configService;
  let performanceMonitor;
  let securityManager;
  let mcpContextManager;
  
  // Provider instances
  let uiContextProvider;
  
  // Setup before each test
  console.log('[TEST_SUITE] Registering beforeEach hook');
  beforeEach(async () => {
    console.log('[TEST_SETUP] Setting up test dependencies');
    
    // Create mock dependencies
    console.log('[TEST_SETUP] Creating logger');
    logger = new MockLogger();
    console.log('[TEST_SETUP] Creating configService');
    configService = new MockConfigService();
    console.log('[TEST_SETUP] Creating performanceMonitor');
    performanceMonitor = new MockPerformanceMonitor();
    console.log('[TEST_SETUP] Creating securityManager');
    securityManager = new MockSecurityManager();
    console.log('[TEST_SETUP] Creating mcpContextManager');
    mcpContextManager = new MockMCPContextManager();
    
    // Create base provider instance for testing
    console.log('[TEST_SETUP] Creating MCPUIContextProvider instance');
    try {
      console.log('[TEST_SETUP] MCPUIContextProvider type:', typeof MCPUIContextProvider);
      uiContextProvider = new MCPUIContextProvider({
        logger,
        configService,
        performanceMonitor,
        securityManager,
        mcpContextManager
      });
      console.log('[TEST_SETUP] MCPUIContextProvider instance created successfully');
    } catch (error) {
      console.error('[TEST_SETUP] Failed to create MCPUIContextProvider instance:', error);
      throw error;
    }
    
    console.log('[TEST_SETUP] Test dependencies created');
  });
  
  console.log('[TEST_SUITE] Registering initialization test');
  it('should initialize the UI context provider', async () => {
    console.log('[TEST_CASE] Running initialization test');
    console.log('[TEST_CASE] uiContextProvider type:', typeof uiContextProvider);
    if (uiContextProvider) {
      console.log('[TEST_CASE] uiContextProvider methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(uiContextProvider)));
      
      console.log('[TEST_CASE] Calling initialize method');
      const result = await uiContextProvider.initialize();
      console.log(`[TEST_CASE] Initialization result: ${result}`);
      assert.strictEqual(result, true, 'Provider should initialize successfully');
      assert.strictEqual(uiContextProvider.initialized, true, 'Provider should be marked as initialized');
      console.log('[TEST_CASE] Initialization test passed');
    } else {
      console.error('[TEST_CASE] uiContextProvider is undefined');
      throw new Error('uiContextProvider is undefined');
    }
  });
  
  console.log('[TEST_SUITE] Registering context update test');
  it('should process context updates', async () => {
    console.log('[TEST_CASE] Running context update test');
    if (!uiContextProvider) {
      console.error('[TEST_CASE] uiContextProvider is undefined');
      throw new Error('uiContextProvider is undefined');
    }
    
    console.log('[TEST_CASE] Calling initialize method');
    await uiContextProvider.initialize();
    
    const contextType = 'ui.test.context';
    const contextData = {
      version: '1.0.0',
      timestamp: Date.now(),
      testData: 'test value'
    };
    
    console.log('[TEST_CASE] Calling _processContextUpdate method');
    await uiContextProvider._processContextUpdate(contextType, contextData, 'test');
    
    console.log('[TEST_CASE] Checking stored context data');
    const storedContext = uiContextProvider.contextData.get(contextType);
    assert.ok(storedContext, 'Context data should be stored');
    assert.strictEqual(storedContext.data.testData, 'test value', 'Context data should match');
    console.log('[TEST_CASE] Context update test passed');
  });
  
  console.log('[TEST_SUITE] Test suite definition completed');
});

// Run tests with overall timeout
console.log('[STARTUP] Setting up test execution');
(async () => {
  try {
    console.log('[EXECUTION] Starting test execution with timeout');
    // Add timeout to prevent hanging
    const testTimeout = setTimeout(() => {
      console.error('[EXECUTION] Test execution timed out after 10 seconds');
      process.exit(1);
    }, 10000);
    
    console.log('[EXECUTION] Running MCP UI Integration Debug Tests');
    const success = await testHarness.runTests();
    
    // Clear timeout if tests complete successfully
    console.log('[EXECUTION] Clearing timeout');
    clearTimeout(testTimeout);
    
    if (success) {
      console.log('[EXECUTION] MCP UI Integration Debug Tests Completed Successfully');
    } else {
      console.error('[EXECUTION] MCP UI Integration Debug Tests Failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('[EXECUTION] Error running MCP UI Integration Debug tests:', error);
    process.exit(1);
  }
})();

console.log('[STARTUP] Debug test runner setup completed');
