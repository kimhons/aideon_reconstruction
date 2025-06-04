/**
 * @fileoverview Test harness for executing system-wide integration tests for the Aideon AI Desktop Agent.
 * 
 * This script runs the comprehensive system-wide integration tests defined in SystemWideIntegrationTests.js
 * and generates a detailed report of the results.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

// Configure logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(__dirname, 'integration_test_results.log') })
  ]
});

// Configure Mocha
const mocha = new Mocha({
  reporter: 'spec',
  timeout: 30000, // 30 seconds
  slow: 10000     // 10 seconds
});

// Add the test file
const testFile = path.join(__dirname, 'SystemWideIntegrationTests.js');
mocha.addFile(testFile);

logger.info('Starting system-wide integration tests');
logger.info(`Test file: ${testFile}`);

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

// Run the tests
const startTime = Date.now();

// Custom reporter to capture test results
class ResultsCapture {
  constructor() {
    this.passes = [];
    this.failures = [];
    this.pending = [];
    this.duration = 0;
  }
}

const resultsCapture = new ResultsCapture();

mocha.run((failures) => {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  resultsCapture.duration = duration;
  
  // Generate test report
  const report = {
    timestamp: new Date().toISOString(),
    duration: duration,
    totalTests: resultsCapture.passes.length + resultsCapture.failures.length + resultsCapture.pending.length,
    passedTests: resultsCapture.passes.length,
    failedTests: resultsCapture.failures.length,
    pendingTests: resultsCapture.pending.length,
    passRate: resultsCapture.passes.length / (resultsCapture.passes.length + resultsCapture.failures.length) * 100,
    passes: resultsCapture.passes,
    failures: resultsCapture.failures.map(failure => ({
      title: failure.title,
      fullTitle: failure.fullTitle,
      error: {
        message: failure.err.message,
        stack: failure.err.stack
      }
    })),
    pending: resultsCapture.pending
  };
  
  // Write report to file
  const reportPath = path.join(resultsDir, `integration_test_report_${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Log results
  logger.info(`System-wide integration tests completed in ${duration}ms`);
  logger.info(`Total tests: ${report.totalTests}`);
  logger.info(`Passed tests: ${report.passedTests}`);
  logger.info(`Failed tests: ${report.failedTests}`);
  logger.info(`Pending tests: ${report.pendingTests}`);
  logger.info(`Pass rate: ${report.passRate.toFixed(2)}%`);
  logger.info(`Report saved to: ${reportPath}`);
  
  if (failures > 0) {
    logger.error('Some tests failed!');
    process.exit(1);
  } else {
    logger.info('All tests passed!');
    process.exit(0);
  }
});
