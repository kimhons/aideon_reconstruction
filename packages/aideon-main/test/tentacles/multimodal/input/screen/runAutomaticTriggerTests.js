/**
 * @fileoverview Test runner for automatic trigger recording tests.
 * 
 * This module runs the tests for automatic trigger recording functionality.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Create Mocha instance
const mocha = new Mocha({
  reporter: process.env.MOCHA_REPORTER || 'spec',
  timeout: 30000
});

// Add test file
const testFile = path.join(__dirname, 'AutomaticTriggerTests.js');
console.log(`Adding test file: ${testFile}`);
mocha.addFile(testFile);

console.log('Running automatic trigger recording tests with verbose logging...');
console.log(`Using ${mocha.options.reporter} reporter for detailed test output...`);

// Run tests
mocha.run(failures => {
  console.log(`Tests completed with ${failures} failures.`);
  process.exit(failures ? 1 : 0);
});
