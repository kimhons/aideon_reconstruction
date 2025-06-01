/**
 * @fileoverview Simple test runner for Medical/Health Tentacle tests that provides Mocha-like globals
 * 
 * @module test/tentacles/medical_health/SimpleTestRunner
 */

const fs = require('fs');
const path = require('path');

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, '../../../test/results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Log file path
const logFile = path.join(resultsDir, 'medical_health_tentacle_test_results.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

// Mock Mocha globals
global.describe = (description, fn) => {
  console.log(`\n${description}`);
  logStream.write(`\n${description}\n`);
  fn();
};

global.beforeEach = (fn) => {
  global._beforeEachFn = fn;
};

global.it = (description, fn) => {
  console.log(`  - ${description}`);
  logStream.write(`  - ${description}`);
  
  try {
    // Run beforeEach if defined
    if (global._beforeEachFn) {
      if (global._beforeEachFn.constructor.name === 'AsyncFunction') {
        // Handle async beforeEach
        (async () => {
          await global._beforeEachFn();
          runTest();
        })();
      } else {
        global._beforeEachFn();
        runTest();
      }
    } else {
      runTest();
    }
    
    function runTest() {
      if (fn.constructor.name === 'AsyncFunction') {
        // Handle async test
        (async () => {
          try {
            await fn();
            console.log(`    ✓ PASS`);
            logStream.write(` - PASS\n`);
          } catch (error) {
            console.log(`    ✗ FAIL: ${error.message}`);
            logStream.write(` - FAIL: ${error.message}\n`);
            throw error;
          }
        })();
      } else {
        // Handle sync test
        try {
          fn();
          console.log(`    ✓ PASS`);
          logStream.write(` - PASS\n`);
        } catch (error) {
          console.log(`    ✗ FAIL: ${error.message}`);
          logStream.write(` - FAIL: ${error.message}\n`);
          throw error;
        }
      }
    }
  } catch (error) {
    console.log(`    ✗ FAIL: ${error.message}`);
    logStream.write(` - FAIL: ${error.message}\n`);
    throw error;
  }
};

// Run the specified test file
function runTest(testFile) {
  console.log(`Running test: ${path.basename(testFile)}`);
  logStream.write(`Running test: ${path.basename(testFile)}\n`);
  
  try {
    require(testFile);
    console.log(`\n✓ ${path.basename(testFile)} passed`);
    logStream.write(`\n✓ ${path.basename(testFile)} passed\n`);
    return true;
  } catch (error) {
    console.error(`\n✗ ${path.basename(testFile)} failed: ${error.message}`);
    logStream.write(`\n✗ ${path.basename(testFile)} failed: ${error.message}\n`);
    logStream.write(`${error.stack}\n`);
    return false;
  }
}

// Main function to run all tests
function runAllTests() {
  console.log('Starting Medical/Health Tentacle tests with SimpleTestRunner...');
  logStream.write(`Medical/Health Tentacle Test Results\n`);
  logStream.write(`Date: ${new Date().toISOString()}\n`);
  logStream.write(`===========================================\n\n`);
  
  // Get all test files
  const testDir = path.join(__dirname);
  const testFiles = fs.readdirSync(testDir)
    .filter(file => file.endsWith('Test.js'));
  
  if (testFiles.length === 0) {
    console.error('No test files found');
    logStream.write('No test files found\n');
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      successRate: 0
    };
  }
  
  console.log(`Found ${testFiles.length} test files`);
  
  // Run each test file
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testFile of testFiles) {
    const testPath = path.join(testDir, testFile);
    
    try {
      // Reset globals for each test file
      global._beforeEachFn = null;
      
      if (runTest(testPath)) {
        passedTests++;
      } else {
        failedTests++;
      }
    } catch (error) {
      console.error(`Error running ${testFile}: ${error.message}`);
      logStream.write(`Error running ${testFile}: ${error.message}\n`);
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
}

// Run tests if this file is executed directly
if (require.main === module) {
  const results = runAllTests();
  process.exit(results.failedTests > 0 ? 1 : 0);
}

module.exports = { runAllTests, runTest };
