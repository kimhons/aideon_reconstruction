/**
 * @fileoverview Test runner for Learning Context Schema tests.
 * 
 * This module runs the tests for Learning Context Schemas to ensure
 * proper validation and interoperability across the MCP system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const { TestRunner } = require('../../../test-utils/TestRunner');

// Create test runner
const runner = new TestRunner({
  testFile: path.resolve(__dirname, 'LearningContextSchemaTests.js'),
  testName: 'Learning Context Schema Tests',
  timeout: 10000
});

// Run tests
runner.run()
  .then(results => {
    console.log(`Tests completed with ${results.passed} passed and ${results.failed} failed.`);
    process.exit(results.failed ? 1 : 0);
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
