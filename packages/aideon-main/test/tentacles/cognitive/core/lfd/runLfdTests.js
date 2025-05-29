/**
 * @fileoverview Test runner for Learning from Demonstration integration tests.
 * Executes all LfD tests as a functional component group.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Create mock logger for test output
const createMockLogger = () => ({
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  trace: (...args) => console.trace(...args)
});

const logger = createMockLogger();

// Configure Mocha
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 10000
});

// Get test directory
const testDir = path.join(__dirname, '.');

// Add LfD integration tests
mocha.addFile(path.join(testDir, 'LearningFromDemonstrationTests.js'));

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, '../../test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Run the tests
logger.info('Starting Learning from Demonstration integration tests...');

mocha.run(failures => {
  // Write test results to file
  const resultSummary = {
    timestamp: new Date().toISOString(),
    module: 'Learning from Demonstration',
    totalTests: mocha.suite.total(),
    failures: failures,
    success: failures === 0
  };
  
  fs.writeFileSync(
    path.join(resultsDir, 'lfd-integration-test-results.json'),
    JSON.stringify(resultSummary, null, 2)
  );
  
  logger.info(`Learning from Demonstration integration tests completed with ${failures} failures.`);
  
  // Exit with appropriate code
  process.exit(failures ? 1 : 0);
});
