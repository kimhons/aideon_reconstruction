/**
 * @fileoverview Heavily instrumented test runner for Phase 3 MCP components
 * 
 * This file is designed to diagnose hanging issues in the test suite by adding:
 * - Granular logging at each step of execution
 * - Timeouts for async operations
 * - Try/catch blocks around critical sections
 * - Process monitoring to detect potential deadlocks
 * - Proper dependency injection between components
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

console.log('=== INSTRUMENTED TEST RUNNER STARTING ===');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('Node version:', process.version);
console.log('Current directory:', __dirname);
console.log('Process ID:', process.pid);

// Set global timeout to prevent indefinite hanging
const GLOBAL_TIMEOUT = 30000; // 30 seconds
setTimeout(() => {
  console.error('GLOBAL TIMEOUT REACHED - Force terminating process');
  console.error('This indicates a likely deadlock or infinite loop');
  process.exit(1);
}, GLOBAL_TIMEOUT);

// Monitor event loop for blocking operations
let lastCheck = Date.now();
const blockingCheckInterval = setInterval(() => {
  const now = Date.now();
  const blockingTime = now - lastCheck - 1000; // Accounting for the interval itself
  if (blockingTime > 500) { // If blocked for more than 500ms
    console.warn(`Event loop blocked for ${blockingTime}ms`);
  }
  lastCheck = now;
}, 1000);

// Import required modules
console.log('Importing required modules...');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const EventEmitter = require('events');

// Verify mock files exist
console.log('Verifying mock files...');
const mocksDir = path.join(__dirname, 'mocks');
const requiredMocks = [
  'MockLogger.js',
  'MockConfigService.js',
  'MockPerformanceMonitor.js',
  'MockSecurityManager.js',
  'MockMCPContextManager.js'
];

for (const mockFile of requiredMocks) {
  const mockPath = path.join(mocksDir, mockFile);
  try {
    if (fs.existsSync(mockPath)) {
      console.log(`✓ Mock file exists: ${mockFile}`);
    } else {
      console.error(`✗ Mock file missing: ${mockFile}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error checking mock file ${mockFile}:`, err);
    process.exit(1);
  }
}

// Import mocks with try/catch
console.log('Importing mock modules...');
let MockLogger, MockConfigService, MockPerformanceMonitor, MockSecurityManager, MockMCPContextManager;

try {
  console.log('Importing MockLogger...');
  MockLogger = require('./mocks/MockLogger');
  console.log('MockLogger imported successfully');
  
  console.log('Importing MockConfigService...');
  MockConfigService = require('./mocks/MockConfigService');
  console.log('MockConfigService imported successfully');
  
  console.log('Importing MockPerformanceMonitor...');
  MockPerformanceMonitor = require('./mocks/MockPerformanceMonitor');
  console.log('MockPerformanceMonitor imported successfully');
  
  console.log('Importing MockSecurityManager...');
  MockSecurityManager = require('./mocks/MockSecurityManager');
  console.log('MockSecurityManager imported successfully');
  
  console.log('Importing MockMCPContextManager...');
  MockMCPContextManager = require('./mocks/MockMCPContextManager');
  console.log('MockMCPContextManager imported successfully');
} catch (err) {
  console.error('Error importing mock modules:', err);
  process.exit(1);
}

// Calculate the correct path to the src directory
console.log('Calculating paths to component modules...');
const projectRoot = path.resolve(__dirname, '../../../..');
const srcPath = path.join(projectRoot, 'src');

// Check if component files exist
console.log('Verifying component files...');
const componentFiles = [
  'tentacles/multimodal/context/providers/ContextFusionEngine.js',
  'tentacles/multimodal/context/providers/ContextPrioritizationSystem.js',
  'tentacles/multimodal/context/providers/ContextCompressionManager.js',
  'tentacles/multimodal/context/providers/ContextSecurityManager.js',
  'tentacles/multimodal/context/providers/ContextAnalyticsEngine.js'
];

for (const componentFile of componentFiles) {
  const componentPath = path.join(srcPath, componentFile);
  try {
    if (fs.existsSync(componentPath)) {
      console.log(`✓ Component file exists: ${componentFile}`);
    } else {
      console.error(`✗ Component file missing: ${componentFile}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error checking component file ${componentFile}:`, err);
    process.exit(1);
  }
}

// Import components with try/catch
console.log('Importing component modules...');
let ContextFusionEngine, ContextPrioritizationSystem, ContextCompressionManager, 
    ContextSecurityManager, ContextAnalyticsEngine;

try {
  console.log('Importing ContextFusionEngine...');
  ContextFusionEngine = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextFusionEngine'));
  console.log('ContextFusionEngine imported successfully');
  
  console.log('Importing ContextPrioritizationSystem...');
  ContextPrioritizationSystem = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextPrioritizationSystem'));
  console.log('ContextPrioritizationSystem imported successfully');
  
  console.log('Importing ContextCompressionManager...');
  ContextCompressionManager = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextCompressionManager'));
  console.log('ContextCompressionManager imported successfully');
  
  console.log('Importing ContextSecurityManager...');
  ContextSecurityManager = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextSecurityManager'));
  console.log('ContextSecurityManager imported successfully');
  
  console.log('Importing ContextAnalyticsEngine...');
  ContextAnalyticsEngine = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextAnalyticsEngine'));
  console.log('ContextAnalyticsEngine imported successfully');
} catch (err) {
  console.error('Error importing component modules:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
}

// Create test dependencies
console.log('Creating test dependencies...');
let logger, configService, performanceMonitor, securityManagerMock, mcpContextManager;

try {
  console.log('Creating MockLogger instance...');
  logger = new MockLogger();
  console.log('MockLogger instance created');
  
  console.log('Creating MockConfigService instance...');
  configService = new MockConfigService();
  console.log('MockConfigService instance created');
  
  console.log('Creating MockPerformanceMonitor instance...');
  performanceMonitor = new MockPerformanceMonitor();
  console.log('MockPerformanceMonitor instance created');
  
  console.log('Creating MockSecurityManager instance...');
  securityManagerMock = new MockSecurityManager();
  console.log('MockSecurityManager instance created');
  
  console.log('Creating MockMCPContextManager instance...');
  mcpContextManager = new MockMCPContextManager();
  console.log('MockMCPContextManager instance created');
} catch (err) {
  console.error('Error creating test dependencies:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
}

// Run individual component test with timeouts
async function runComponentTest(name, testFn) {
  console.log(`\n=== Starting test for ${name} ===`);
  
  return new Promise((resolve, reject) => {
    // Set timeout for this specific test
    const timeout = setTimeout(() => {
      console.error(`TIMEOUT: Test for ${name} did not complete within 5 seconds`);
      reject(new Error(`Test timeout for ${name}`));
    }, 5000);
    
    // Run the test
    try {
      testFn()
        .then((result) => {
          clearTimeout(timeout);
          console.log(`✓ Test for ${name} completed successfully`);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeout);
          console.error(`✗ Test for ${name} failed:`, err);
          reject(err);
        });
    } catch (err) {
      clearTimeout(timeout);
      console.error(`✗ Test for ${name} threw synchronous error:`, err);
      reject(err);
    }
  });
}

// Create component instances with proper dependency injection
let fusionEngine, prioritizationSystem, compressionManager, securityManager, analyticsEngine;

// Test ContextFusionEngine
async function testContextFusionEngine() {
  console.log('Creating ContextFusionEngine instance...');
  fusionEngine = new ContextFusionEngine({
    logger,
    configService,
    performanceMonitor,
    securityManager: securityManagerMock,
    mcpContextManager
  });
  console.log('ContextFusionEngine instance created');
  
  console.log('Initializing ContextFusionEngine...');
  const initResult = await fusionEngine.initialize();
  console.log('ContextFusionEngine initialized:', initResult);
  
  console.log('Testing fusion functionality...');
  const fusedContext = await fusionEngine.fuseContext();
  console.log('Fusion result:', fusedContext);
  
  return fusionEngine; // Return the instance for use by other components
}

// Test ContextPrioritizationSystem
async function testContextPrioritizationSystem(fusionEngine) {
  console.log('Creating ContextPrioritizationSystem instance...');
  prioritizationSystem = new ContextPrioritizationSystem({
    logger,
    configService,
    performanceMonitor,
    securityManager: securityManagerMock,
    mcpContextManager,
    contextFusionEngine: fusionEngine // Provide the fusion engine instance with correct property name
  });
  console.log('ContextPrioritizationSystem instance created');
  
  console.log('Initializing ContextPrioritizationSystem...');
  const initResult = await prioritizationSystem.initialize();
  console.log('ContextPrioritizationSystem initialized:', initResult);
  
  console.log('Testing prioritization functionality...');
  await prioritizationSystem.updatePriorityScores('test', {
    text: 'Test context data'
  });
  
  return prioritizationSystem; // Return the instance for use by other components
}

// Test ContextCompressionManager
async function testContextCompressionManager(fusionEngine, prioritizationSystem) {
  console.log('Creating ContextCompressionManager instance...');
  compressionManager = new ContextCompressionManager({
    logger,
    configService,
    performanceMonitor,
    securityManager: securityManagerMock,
    mcpContextManager,
    contextFusionEngine: fusionEngine,
    contextPrioritizationSystem: prioritizationSystem
  });
  console.log('ContextCompressionManager instance created');
  
  console.log('Initializing ContextCompressionManager...');
  const initResult = await compressionManager.initialize();
  console.log('ContextCompressionManager initialized:', initResult);
  
  console.log('Testing compression functionality...');
  const contextData = { text: 'Test data '.repeat(10) };
  await compressionManager.compressContext('test', contextData);
  const decompressed = await compressionManager.decompressContext('test');
  console.log('Decompression result matches original:', JSON.stringify(decompressed) === JSON.stringify(contextData));
  
  return compressionManager; // Return the instance for use by other components
}

// Test ContextSecurityManager
async function testContextSecurityManager(fusionEngine, prioritizationSystem, compressionManager) {
  console.log('Creating ContextSecurityManager instance...');
  securityManager = new ContextSecurityManager({
    logger,
    configService,
    performanceMonitor,
    securityManager: securityManagerMock,
    mcpContextManager,
    contextFusionEngine: fusionEngine,
    contextPrioritizationSystem: prioritizationSystem,
    contextCompressionManager: compressionManager
  });
  console.log('ContextSecurityManager instance created');
  
  console.log('Initializing ContextSecurityManager...');
  const initResult = await securityManager.initialize();
  console.log('ContextSecurityManager initialized:', initResult);
  
  console.log('Testing security functionality...');
  const contextData = { sensitive: 'secret123' };
  await securityManager.encryptContext('test', contextData, 'testSource');
  const decrypted = await securityManager.decryptContext('test');
  console.log('Decryption result matches original:', JSON.stringify(decrypted) === JSON.stringify(contextData));
  
  return securityManager; // Return the instance for use by other components
}

// Test ContextAnalyticsEngine
async function testContextAnalyticsEngine(fusionEngine, prioritizationSystem, compressionManager, securityManager) {
  console.log('Creating ContextAnalyticsEngine instance...');
  analyticsEngine = new ContextAnalyticsEngine({
    logger,
    configService,
    performanceMonitor,
    securityManager: securityManagerMock,
    mcpContextManager,
    contextFusionEngine: fusionEngine,
    contextPrioritizationSystem: prioritizationSystem,
    contextCompressionManager: compressionManager,
    contextSecurityManager: securityManager
  });
  console.log('ContextAnalyticsEngine instance created');
  
  console.log('Initializing ContextAnalyticsEngine...');
  const initResult = await analyticsEngine.initialize();
  console.log('ContextAnalyticsEngine initialized:', initResult);
  
  console.log('Testing analytics functionality...');
  mcpContextManager.emit('contextUpdated', { contextType: 'test', source: 'testSource' });
  const stats = analyticsEngine.getUsageStats('test');
  console.log('Usage stats:', stats);
  
  return analyticsEngine;
}

// Cleanup function to dispose of all components
async function cleanupComponents() {
  console.log('\n=== Cleaning up components ===');
  
  if (analyticsEngine && analyticsEngine.dispose) {
    console.log('Disposing ContextAnalyticsEngine...');
    await analyticsEngine.dispose();
    console.log('ContextAnalyticsEngine disposed');
  }
  
  if (securityManager && securityManager.dispose) {
    console.log('Disposing ContextSecurityManager...');
    await securityManager.dispose();
    console.log('ContextSecurityManager disposed');
  }
  
  if (compressionManager && compressionManager.dispose) {
    console.log('Disposing ContextCompressionManager...');
    await compressionManager.dispose();
    console.log('ContextCompressionManager disposed');
  }
  
  if (prioritizationSystem && prioritizationSystem.dispose) {
    console.log('Disposing ContextPrioritizationSystem...');
    await prioritizationSystem.dispose();
    console.log('ContextPrioritizationSystem disposed');
  }
  
  if (fusionEngine && fusionEngine.dispose) {
    console.log('Disposing ContextFusionEngine...');
    await fusionEngine.dispose();
    console.log('ContextFusionEngine disposed');
  }
}

// Run all tests sequentially with proper dependency injection
async function runAllTests() {
  try {
    console.log('\n=== RUNNING INDIVIDUAL COMPONENT TESTS WITH DEPENDENCY INJECTION ===');
    
    // Test ContextFusionEngine first and get the instance
    const fusionEngine = await runComponentTest('ContextFusionEngine', testContextFusionEngine);
    
    // Test ContextPrioritizationSystem with the fusion engine instance
    const prioritizationSystem = await runComponentTest('ContextPrioritizationSystem', 
      () => testContextPrioritizationSystem(fusionEngine));
    
    // Test ContextCompressionManager with previous instances
    const compressionManager = await runComponentTest('ContextCompressionManager', 
      () => testContextCompressionManager(fusionEngine, prioritizationSystem));
    
    // Test ContextSecurityManager with previous instances
    const securityManager = await runComponentTest('ContextSecurityManager', 
      () => testContextSecurityManager(fusionEngine, prioritizationSystem, compressionManager));
    
    // Test ContextAnalyticsEngine with all previous instances
    await runComponentTest('ContextAnalyticsEngine', 
      () => testContextAnalyticsEngine(fusionEngine, prioritizationSystem, compressionManager, securityManager));
    
    // Clean up all components
    await cleanupComponents();
    
    console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
    clearInterval(blockingCheckInterval);
    process.exit(0);
  } catch (err) {
    console.error('\n=== TEST EXECUTION FAILED ===');
    console.error(err);
    
    // Try to clean up components even if tests fail
    try {
      await cleanupComponents();
    } catch (cleanupErr) {
      console.error('Error during component cleanup:', cleanupErr);
    }
    
    clearInterval(blockingCheckInterval);
    process.exit(1);
  }
}

// Start the tests
console.log('\n=== STARTING TEST EXECUTION ===');
runAllTests().catch(err => {
  console.error('Unhandled error in test execution:', err);
  clearInterval(blockingCheckInterval);
  process.exit(1);
});
