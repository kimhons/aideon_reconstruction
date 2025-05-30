/**
 * @fileoverview Test runner for Voice Recognition and Processing module tests.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');

// Create test runner
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 30000 // Longer timeout for model loading
});

// Add test files
mocha.addFile(path.join(__dirname, 'VoiceRecognitionTests.js'));

// Run tests
console.log('Running Voice Recognition and Processing module tests...');
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});
