/**
 * @fileoverview Test runner for Gesture Recognition tests.
 * This script executes the comprehensive test suite for the Gesture Recognition system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Configure Mocha
const mocha = new Mocha({
  timeout: 15000,
  reporter: 'spec',
  bail: false,
  ui: 'bdd'
});

// Add the test file
mocha.addFile(path.join(__dirname, 'GestureRecognitionTests.js'));

// Run the tests
console.log('Running Gesture Recognition Tests...');
mocha.run(failures => {
  if (failures) {
    console.error(`${failures} tests failed.`);
    process.exit(1);
  } else {
    console.log('All tests passed successfully!');
    process.exit(0);
  }
});
