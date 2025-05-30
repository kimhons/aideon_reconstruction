/**
 * @fileoverview Test runner for Voice Recognition and Processing module tests
 * of the Aideon AI Desktop Agent.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Create Mocha instance
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 10000
});

// Get test directory
const testDir = __dirname;

// Add test files
mocha.addFile(path.join(testDir, 'VoiceRecognitionTests.js'));

// Run tests
console.log('Running Voice Recognition and Processing module tests...');
console.log('------------------------------------------------------');

mocha.run(failures => {
  if (failures) {
    console.error(`${failures} tests failed.`);
    process.exit(1);
  } else {
    console.log('All tests passed successfully!');
    process.exit(0);
  }
});
