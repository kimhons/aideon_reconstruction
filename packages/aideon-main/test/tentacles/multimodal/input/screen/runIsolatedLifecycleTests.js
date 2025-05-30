/**
 * @fileoverview Updated runner for isolated lifecycle tests.
 * 
 * This file provides a robust test runner for isolated lifecycle tests,
 * using absolute paths to prevent module resolution issues.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');

// Import test module resolver
const TestModuleResolver = require('./utils/TestModuleResolver');

// Configure Mocha programmatically
const mocha = new Mocha({
  timeout: 60000, // 60 seconds (increased from 30 seconds)
  reporter: 'spec',
  bail: false,
  ui: 'bdd'
});

// Add test files using absolute paths
const testFilePath = path.join(__dirname, 'IsolatedLifecycleTests.js');
console.log(`Adding test file: ${testFilePath}`);
mocha.addFile(testFilePath);

// Run the tests with verbose logging
console.log('Running isolated lifecycle tests with verbose logging...');

// Add more detailed reporter
mocha.reporter('spec');

// Use Mocha's reporter option for detailed output instead of event listeners
// The programmatic API doesn't support direct event listeners like .on()
console.log('Using spec reporter for detailed test output...');

// Run with detailed error handling and full stack traces
try {
  // Enable full stack traces
  Error.stackTraceLimit = Infinity;
  
  // Configure Mocha to show full stack traces
  mocha.fullTrace();
  
  mocha.run(failures => {
    console.log(`Tests completed with ${failures} failures.`);
    process.exitCode = failures ? 1 : 0;
  });
} catch (error) {
  console.error('Error running tests:', error);
  console.error('Stack trace:', error.stack);
  process.exitCode = 1;
}
