/**
 * @fileoverview Test runner for MCP integration tests.
 * 
 * This module runs the MCP integration tests to validate the MCP integration
 * with the screen, voice, and gesture tentacles.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Configure Mocha
const mocha = new Mocha({
  timeout: 10000,
  reporter: 'spec',
  bail: false,
  ui: 'bdd'
});

// Add test file
mocha.addFile(path.join(__dirname, 'MCPIntegrationTests.js'));

// Run tests
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
  
  if (failures) {
    console.error(`${failures} tests failed.`);
  } else {
    console.log('All tests passed!');
  }
});
