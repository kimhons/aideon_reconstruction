/**
 * @fileoverview Test runner for Medical/Health Tentacle tests
 * 
 * @module test/tentacles/medical_health/RunTests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configure test environment
process.env.NODE_ENV = 'test';

// Define test directories
const testDir = path.join(__dirname);
const srcDir = path.join(__dirname, '../../../src/tentacles/medical_health');

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, '../../../test/results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Log file path
const logFile = path.join(resultsDir, 'medical_health_tentacle_test_results.log');

// Function to run tests
function runTests() {
  console.log('Starting Medical/Health Tentacle tests...');
  
  try {
    // Get all test files
    const testFiles = fs.readdirSync(testDir)
      .filter(file => file.endsWith('Test.js'));
    
    if (testFiles.length === 0) {
      throw new Error('No test files found');
    }
    
    console.log(`Found ${testFiles.length} test files`);
    
    // Create log file stream
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });
    logStream.write(`Medical/Health Tentacle Test Results\n`);
    logStream.write(`Date: ${new Date().toISOString()}\n`);
    logStream.write(`===========================================\n\n`);
    
    // Run each test file
    let passedTests = 0;
    let failedTests = 0;
    
    for (const testFile of testFiles) {
      const testPath = path.join(testDir, testFile);
      console.log(`Running test: ${testFile}`);
      logStream.write(`Running test: ${testFile}\n`);
      
      try {
        // Execute test using Node.js assert module
        const testModule = require(testPath);
        
        // If the test file exports a run function, call it
        if (typeof testModule.run === 'function') {
          testModule.run();
        }
        
        console.log(`✓ ${testFile} passed`);
        logStream.write(`✓ ${testFile} passed\n`);
        passedTests++;
      } catch (error) {
        console.error(`✗ ${testFile} failed: ${error.message}`);
        logStream.write(`✗ ${testFile} failed: ${error.message}\n`);
        logStream.write(`${error.stack}\n`);
        failedTests++;
      }
      
      logStream.write('\n');
    }
    
    // Write summary
    const summary = `
Test Summary:
===========================================
Total Tests: ${testFiles.length}
Passed: ${passedTests}
Failed: ${failedTests}
Success Rate: ${Math.round((passedTests / testFiles.length) * 100)}%
===========================================
`;
    
    console.log(summary);
    logStream.write(summary);
    logStream.end();
    
    // Return test results
    return {
      totalTests: testFiles.length,
      passedTests,
      failedTests,
      successRate: Math.round((passedTests / testFiles.length) * 100)
    };
  } catch (error) {
    console.error(`Error running tests: ${error.message}`);
    fs.writeFileSync(logFile, `Error running tests: ${error.message}\n${error.stack}`);
    
    // Return error results
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      successRate: 0,
      error: error.message
    };
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const results = runTests();
  process.exit(results.failedTests > 0 ? 1 : 0);
}

module.exports = { runTests };
