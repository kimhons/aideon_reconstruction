/**
 * @fileoverview Standalone test runner for Screen Recording and Analysis module.
 * This runner executes tests in isolation to avoid conflicts with other test files.
 * 
 * @author Aideon AI Team
 * @version 1.0.2
 */

// Import required modules
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// Import test utilities
const testFilePath = path.join(__dirname, 'ScreenRecordingTests.js');

// Configure Mocha programmatically
const Mocha = require('mocha');
const mocha = new Mocha({
  timeout: 60000, // 60 seconds - increased timeout for async operations
  reporter: 'spec',
  bail: false,
  ui: 'bdd'
});

// Add the test file
mocha.addFile(testFilePath);

// Setup global test environment
global.assert = require('assert');
global.sinon = require('sinon');

console.log('Running Screen Recording and Analysis module tests with extended timeout...');
console.log('==================================================================');
console.log('Debug mode: ON - Will show detailed execution flow');

// Run the tests
mocha.run(failures => {
  console.log(`Test run completed with ${failures} failures.`);
  process.exit(failures ? 1 : 0);
});
