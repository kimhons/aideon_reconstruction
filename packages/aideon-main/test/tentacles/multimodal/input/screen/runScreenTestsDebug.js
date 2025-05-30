/**
 * @fileoverview Test runner for Screen Recording and Analysis module tests.
 * Uses Mocha test framework to run only the Screen Recording module tests,
 * bypassing other potentially problematic test files.
 * 
 * This version includes additional debug logging and longer timeouts.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import required modules
const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Create a new Mocha instance with custom configuration
const mocha = new Mocha({
  timeout: 30000, // Increased timeout for integration tests
  reporter: 'spec',
  ui: 'bdd',      // Explicitly set BDD interface for describe/it
  bail: false     // Continue running tests even if some fail
});

// Path to our test file
const testFile = path.join(__dirname, 'ScreenRecordingTests.js');

// Add only our specific test file
mocha.addFile(testFile);

console.log('Running Screen Recording and Analysis module tests with extended timeout...');
console.log('==================================================================\n');
console.log('Debug mode: ON - Will show detailed execution flow\n');

// Set environment variable for debug mode
process.env.AIDEON_TEST_DEBUG = 'true';

// Run the tests
mocha.run(function(failures) {
  process.exitCode = failures ? 1 : 0;
  console.log(`\nTest run completed with ${failures} failures.`);
});
