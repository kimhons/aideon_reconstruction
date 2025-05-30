/**
 * @fileoverview Heavily instrumented test runner for MCP UI Context Providers.
 * 
 * This module provides a simplified test runner with extensive logging
 * to isolate execution hang issues in the integration tests.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

console.log('[STARTUP] ===== INSTRUMENTED TEST RUNNER STARTING =====');

// Add early exit timeout as safety measure
const safetyTimeout = setTimeout(() => {
  console.log('[SAFETY] Forced exit after 10 seconds to prevent hang');
  process.exit(1);
}, 10000);

try {
  console.log('[STARTUP] Loading core modules');
  const path = require('path');
  console.log('[STARTUP] path module loaded');
  const assert = require('assert');
  console.log('[STARTUP] assert module loaded');
  const { EventEmitter } = require('events');
  console.log('[STARTUP] EventEmitter loaded');

  // Create simplified mock for EnhancedAsyncLockAdapter with extensive logging
  console.log('[STARTUP] Creating instrumented EnhancedAsyncLockAdapter mock');
  class MockEnhancedAsyncLockAdapter {
    constructor() {
      console.log('[MOCK_LOCK] Constructor called');
      this.activeLocks = new Set();
    }
    
    async withLock(nameOrFn, fnOrOptions) {
      console.log('[MOCK_LOCK] withLock called with:', typeof nameOrFn, typeof fnOrOptions);
      let name, fn;
      
      if (typeof nameOrFn === 'string') {
        console.log('[MOCK_LOCK] Using string-first signature');
        name = nameOrFn;
        fn = fnOrOptions;
      } else {
        console.log('[MOCK_LOCK] Using function-first signature');
        name = 'default';
        fn = nameOrFn;
      }
      
      console.log(`[MOCK_LOCK] Acquiring lock: ${name}`);
      this.activeLocks.add(name);
      
      try {
        console.log('[MOCK_LOCK] About to execute function');
        // Execute function with timeout to prevent hang
        const result = await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Function execution timed out')), 2000))
        ]);
        console.log('[MOCK_LOCK] Function executed successfully');
        return result;
      } catch (error) {
        console.error('[MOCK_LOCK] Error executing function:', error.message);
        throw error;
      } finally {
        console.log(`[MOCK_LOCK] Releasing lock: ${name}`);
        this.activeLocks.delete(name);
      }
    }
    
    isLocked(name) {
      console.log(`[MOCK_LOCK] isLocked called for: ${name}`);
      return this.activeLocks.has(name);
    }
  }

  // Override require for EnhancedAsyncLockAdapter
  console.log('[STARTUP] Setting up module override');
  const originalRequire = module.require;
  module.require = function(id) {
    console.log(`[MODULE_OVERRIDE] Require called for: ${id}`);
    if (id.includes('EnhancedAsyncLockAdapter')) {
      console.log('[MODULE_OVERRIDE] Returning mock for:', id);
      return { EnhancedAsyncLockAdapter: MockEnhancedAsyncLockAdapter };
    }
    console.log(`[MODULE_OVERRIDE] Using original require for: ${id}`);
    return originalRequire.apply(this, arguments);
  };

  // Create mock dependencies with extensive logging
  console.log('[STARTUP] Creating mock dependencies');
  class MockLogger {
    info(message) { console.log(`[MOCK_LOGGER] INFO: ${message}`); }
    debug(message) { console.log(`[MOCK_LOGGER] DEBUG: ${message}`); }
    warn(message) { console.log(`[MOCK_LOGGER] WARN: ${message}`); }
    error(message, error) { 
      console.error(`[MOCK_LOGGER] ERROR: ${message}`);
      if (error) console.error(`[MOCK_LOGGER] ERROR DETAILS:`, error);
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
    startTimer() { 
      console.log('[MOCK_PERF] Starting timer');
      return Date.now(); 
    }
    endTimer() { 
      console.log('[MOCK_PERF] Ending timer');
      return 0; 
    }
    recordMetric() {
      console.log('[MOCK_PERF] Recording metric');
    }
  }

  class MockSecurityManager {
    checkAccess() { 
      console.log('[MOCK_SECURITY] Checking access');
      return true; 
    }
    hasPermission() { 
      console.log('[MOCK_SECURITY] Checking permission');
      return true; 
    }
  }

  class MockMCPContextManager extends EventEmitter {
    constructor() {
      console.log('[MOCK_MCP_CONTEXT_MANAGER] Constructor called');
      super();
      this.registeredProviders = new Map();
      this.persistedContext = new Map();
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

  // Create simplified test harness with extensive logging
  console.log('[STARTUP] Creating simplified test harness');
  function runTest(name, fn) {
    console.log(`\n[TEST] Running test: ${name}`);
    try {
      fn();
      console.log(`[TEST] ✅ Passed: ${name}`);
      return true;
    } catch (error) {
      console.error(`[TEST] ❌ Failed: ${name}`);
      console.error(`[TEST] Error: ${error.message}`);
      if (error.stack) {
        console.error(`[TEST] Stack: ${error.stack}`);
      }
      return false;
    }
  }

  // Run tests synchronously with extensive logging
  console.log('[STARTUP] Starting tests');

  // Test 1: Verify MCPUIContextProvider can be imported
  console.log('[TEST] About to import MCPUIContextProvider');
  let MCPUIContextProvider;
  try {
    MCPUIContextProvider = require(path.join(__dirname, '..', '..', '..', '..', 'src', 'tentacles', 'multimodal', 'context', 'providers', 'MCPUIContextProvider.js'));
    console.log('[TEST] MCPUIContextProvider imported successfully');
    console.log('[TEST] MCPUIContextProvider type:', typeof MCPUIContextProvider);
    console.log('[TEST] MCPUIContextProvider constructor?', typeof MCPUIContextProvider === 'function');
    console.log('[TEST] MCPUIContextProvider prototype:', Object.getPrototypeOf(MCPUIContextProvider));
    console.log('[TEST] MCPUIContextProvider keys:', Object.keys(MCPUIContextProvider));
  } catch (error) {
    console.error('[TEST] Failed to import MCPUIContextProvider:', error.message);
    console.error('[TEST] Stack:', error.stack);
    throw error;
  }

  // Test 2: Create dependencies for provider instantiation
  console.log('[TEST] Creating dependencies for provider instantiation');
  const logger = new MockLogger();
  const configService = new MockConfigService();
  const performanceMonitor = new MockPerformanceMonitor();
  const securityManager = new MockSecurityManager();
  const mcpContextManager = new MockMCPContextManager();
  
  const dependencies = {
    logger,
    configService,
    performanceMonitor,
    securityManager,
    mcpContextManager
  };
  console.log('[TEST] Dependencies created successfully');

  // Test 3: Instantiate MCPUIContextProvider
  console.log('[TEST] About to instantiate MCPUIContextProvider');
  let provider;
  try {
    provider = new MCPUIContextProvider(dependencies);
    console.log('[TEST] MCPUIContextProvider instantiated successfully');
    console.log('[TEST] Provider type:', typeof provider);
    console.log('[TEST] Provider initialize method type:', typeof provider.initialize);
    console.log('[TEST] Provider initialized state:', provider.initialized);
  } catch (error) {
    console.error('[TEST] Failed to instantiate MCPUIContextProvider:', error.message);
    console.error('[TEST] Stack:', error.stack);
    throw error;
  }

  // Clear safety timeout if we reach this point
  clearTimeout(safetyTimeout);
  console.log('[SAFETY] Cleared safety timeout - tests completed successfully');
  
  console.log('\n[RESULTS] Instrumented tests completed successfully');
} catch (error) {
  console.error('[FATAL] Unhandled error in test runner:', error);
  console.error('[FATAL] Stack:', error.stack);
} finally {
  console.log('[SHUTDOWN] ===== INSTRUMENTED TEST RUNNER FINISHED =====');
}
