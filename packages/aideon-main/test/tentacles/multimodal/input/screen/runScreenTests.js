/**
 * @fileoverview Test runner for Screen Recording and Analysis module tests.
 * Uses Mocha test framework to run integration tests.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Import Mocha
const Mocha = require('mocha');
const mocha = new Mocha({
  timeout: 10000, // Increase timeout for integration tests
  reporter: 'spec'
});

console.log('Running Screen Recording and Analysis module tests...');
console.log('==================================================\n');

// Add test files
mocha.addFile('./packages/aideon-main/test/tentacles/multimodal/input/screen/ScreenRecordingTests.js');

// Run the tests
mocha.run(function(failures) {
  process.exitCode = failures ? 1 : 0;
});
