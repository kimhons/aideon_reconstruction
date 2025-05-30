/**
 * @fileoverview Test runner for Reasoning Context Schema tests.
 * 
 * This file runs the tests for the Reasoning Context Schemas.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');

// Create a new Mocha instance
const mocha = new Mocha({
  timeout: 10000
});

// Add the test file
mocha.addFile(path.join(__dirname, 'ReasoningContextSchemaTests.js'));

// Run the tests
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});
