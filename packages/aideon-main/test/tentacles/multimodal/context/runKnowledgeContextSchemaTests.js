/**
 * @fileoverview Test runner for Knowledge Context Schema tests.
 * 
 * This module runs the tests for Knowledge Context Schemas and validation
 * to ensure proper integration across all knowledge graph context providers.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');

// Create test directory if it doesn't exist
const testDir = path.join(__dirname);
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Set NODE_ENV to test to enable test-specific behavior
process.env.NODE_ENV = 'test';

// Instantiate a Mocha instance
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 5000
});

// Add the test file
mocha.addFile(path.join(__dirname, 'KnowledgeContextSchemaTests.js'));

// Run the tests
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
  
  // Log test results
  if (failures) {
    console.error(`${failures} tests failed.`);
  } else {
    console.log('All tests passed!');
  }
  
  // Write test results to file for CI/CD integration
  const resultData = {
    timestamp: new Date().toISOString(),
    passed: failures === 0,
    failureCount: failures || 0,
    testSuite: 'KnowledgeContextSchemaTests'
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', '..', '..', 'test_results_knowledge_context.json'),
    JSON.stringify(resultData, null, 2)
  );
});
