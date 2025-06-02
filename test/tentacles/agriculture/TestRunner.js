/**
 * @fileoverview Test runner for Agriculture Tentacle integration tests.
 * Executes all integration tests for the Agriculture Tentacle components.
 * 
 * @module test/tentacles/agriculture/TestRunner
 */

const assert = require('assert');
const path = require('path');

// Import the test file directly with correct path
const AgricultureTentacleIntegrationTest = require('./AgricultureTentacleIntegrationTest');

console.log('=== Agriculture Tentacle Integration Test Suite ===');
console.log('Starting tests...');

// Mock Logger for testing
global.Logger = class Logger {
  constructor(name) {
    this.name = name;
  }
  info(message) {
    console.log(`[INFO] ${this.name}: ${message}`);
  }
  debug(message) {
    console.log(`[DEBUG] ${this.name}: ${message}`);
  }
  warn(message) {
    console.log(`[WARN] ${this.name}: ${message}`);
  }
  error(message) {
    console.log(`[ERROR] ${this.name}: ${message}`);
  }
};

// Run the tests
async function runTests() {
  try {
    // Create a simple test runner
    const testSuite = new AgricultureTentacleIntegrationTest();
    
    // Get all test methods from the test suite
    const testMethods = Object.getOwnPropertyNames(AgricultureTentacleIntegrationTest.prototype)
      .filter(method => method.startsWith('test'));
    
    console.log(`Found ${testMethods.length} tests to run.`);
    
    let passed = 0;
    let failed = 0;
    const failures = [];
    
    // Run each test method
    for (const method of testMethods) {
      try {
        console.log(`Running test: ${method}`);
        await testSuite[method]();
        console.log(`✓ Test passed: ${method}`);
        passed++;
      } catch (error) {
        console.error(`✗ Test failed: ${method}`);
        console.error(`  Error: ${error.message}`);
        failed++;
        failures.push({ method, error });
      }
    }
    
    // Print test summary
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${testMethods.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failures.length > 0) {
      console.log('\n=== Failed Tests ===');
      failures.forEach(({ method, error }, index) => {
        console.log(`${index + 1}. ${method}`);
        console.log(`   Error: ${error.message}`);
      });
    }
    
    // Return test results
    return {
      total: testMethods.length,
      passed,
      failed,
      failures
    };
  } catch (error) {
    console.error('Error running tests:', error);
    return {
      total: 0,
      passed: 0,
      failed: 1,
      failures: [{ method: 'runTests', error }]
    };
  }
}

// Execute tests
runTests().then(results => {
  console.log('\n=== Agriculture Tentacle Integration Tests Complete ===');
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
