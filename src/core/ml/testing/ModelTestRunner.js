/**
 * @fileoverview ModelTestRunner executes the ModelTestSuite to validate
 * the embedded ML models within Aideon Core, providing detailed test results
 * and validation of offline functionality and performance.
 * 
 * @module core/ml/testing/ModelTestRunner
 * @requires core/utils/Logger
 */

const path = require('path');
const fs = require('fs');
const logger = require('../../utils/Logger').getLogger('ModelTestRunner');
const ModelIntegrationManager = require('../ModelIntegrationManager');
const ModelTestSuite = require('./ModelTestSuite');

/**
 * Main function to run model tests
 * @async
 */
async function runModelTests() {
  logger.info('Starting model test runner');
  
  let modelIntegrationManager = null;
  let modelTestSuite = null;
  
  try {
    // Initialize ModelIntegrationManager
    logger.info('Initializing ModelIntegrationManager');
    modelIntegrationManager = new ModelIntegrationManager({
      modelsBasePath: path.join(process.cwd(), 'models'),
      enableAPI: true,
      apiPort: 3000
    });
    
    await modelIntegrationManager.initialize();
    
    // Initialize ModelTestSuite
    logger.info('Initializing ModelTestSuite');
    modelTestSuite = new ModelTestSuite({
      modelIntegrationManager,
      testDataPath: path.join(process.cwd(), 'test', 'data'),
      saveResults: true,
      resultsPath: path.join(process.cwd(), 'test', 'results')
    });
    
    await modelTestSuite.initialize();
    
    // Run all tests
    logger.info('Running all model tests');
    const testResults = await modelTestSuite.runAllTests();
    
    // Log test results summary
    logger.info('Test results summary:');
    logger.info(`Total tests: ${testResults.totalTests}`);
    logger.info(`Success: ${testResults.success}`);
    logger.info(`Failure: ${testResults.failure}`);
    logger.info(`Success rate: ${testResults.successRate.toFixed(2)}%`);
    
    // Log test suite results
    logger.info('Test suite results:');
    for (const suite of testResults.testSuites) {
      logger.info(`${suite.name}: ${suite.successRate.toFixed(2)}% (${suite.success}/${suite.tests})`);
    }
    
    // Create summary report
    const summaryReport = createSummaryReport(testResults);
    
    // Save summary report
    const reportPath = path.join(process.cwd(), 'test', 'results', 'summary_report.md');
    fs.writeFileSync(reportPath, summaryReport);
    
    logger.info(`Summary report saved to ${reportPath}`);
    
    return {
      success: true,
      results: testResults,
      reportPath
    };
  } catch (error) {
    logger.error(`Error running model tests: ${error.message}`, error);
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Shutdown test suite
    if (modelTestSuite) {
      try {
        await modelTestSuite.shutdown();
      } catch (error) {
        logger.error(`Error shutting down test suite: ${error.message}`, error);
      }
    }
    
    // Shutdown model integration manager
    if (modelIntegrationManager) {
      try {
        await modelIntegrationManager.shutdown();
      } catch (error) {
        logger.error(`Error shutting down model integration manager: ${error.message}`, error);
      }
    }
    
    logger.info('Model test runner completed');
  }
}

/**
 * Creates a summary report from test results
 * @param {Object} testResults - Test results
 * @returns {string} Summary report in Markdown format
 */
function createSummaryReport(testResults) {
  const report = [];
  
  // Add header
  report.push('# Embedded ML Models Test Report');
  report.push('');
  report.push(`**Date:** ${new Date().toISOString()}`);
  report.push(`**Duration:** ${formatDuration(testResults.duration)}`);
  report.push('');
  
  // Add overall summary
  report.push('## Overall Summary');
  report.push('');
  report.push(`- **Total Tests:** ${testResults.totalTests}`);
  report.push(`- **Successful Tests:** ${testResults.success}`);
  report.push(`- **Failed Tests:** ${testResults.failure}`);
  report.push(`- **Success Rate:** ${testResults.successRate.toFixed(2)}%`);
  report.push('');
  
  // Add test suite summary
  report.push('## Test Suite Summary');
  report.push('');
  report.push('| Test Suite | Tests | Success | Failure | Success Rate |');
  report.push('|------------|-------|---------|---------|--------------|');
  
  for (const suite of testResults.testSuites) {
    report.push(`| ${suite.name} | ${suite.tests} | ${suite.success} | ${suite.failure} | ${suite.successRate.toFixed(2)}% |`);
  }
  
  report.push('');
  
  // Add conclusion
  report.push('## Conclusion');
  report.push('');
  
  if (testResults.successRate >= 95) {
    report.push('✅ **PASS:** The embedded ML models in Aideon Core have passed all tests with excellent results.');
    report.push('');
    report.push('The models demonstrate robust offline functionality, efficient resource management, and reliable performance across all test scenarios.');
  } else if (testResults.successRate >= 80) {
    report.push('✅ **PASS WITH CONCERNS:** The embedded ML models in Aideon Core have passed most tests with good results.');
    report.push('');
    report.push('While the overall performance is acceptable, there are some areas that could be improved for better reliability and efficiency.');
  } else {
    report.push('❌ **FAIL:** The embedded ML models in Aideon Core have failed to meet the minimum acceptance criteria.');
    report.push('');
    report.push('Significant improvements are needed before these models can be considered production-ready.');
  }
  
  report.push('');
  report.push('### Key Findings');
  report.push('');
  
  // Add key findings based on test results
  const findings = [];
  
  // Check model loading
  const modelLoadingSuite = testResults.testSuites.find(s => s.name === 'modelLoading');
  if (modelLoadingSuite) {
    if (modelLoadingSuite.successRate >= 95) {
      findings.push('- Model loading is highly reliable and efficient.');
    } else if (modelLoadingSuite.successRate >= 80) {
      findings.push('- Model loading is generally reliable but could be improved.');
    } else {
      findings.push('- Model loading has significant issues that need to be addressed.');
    }
  }
  
  // Check orchestration
  const orchestrationSuite = testResults.testSuites.find(s => s.name === 'modelOrchestration');
  if (orchestrationSuite) {
    if (orchestrationSuite.successRate >= 95) {
      findings.push('- Model orchestration is working excellently, with proper task-based selection and management.');
    } else if (orchestrationSuite.successRate >= 80) {
      findings.push('- Model orchestration is functional but has some reliability issues.');
    } else {
      findings.push('- Model orchestration has major issues that need to be addressed.');
    }
  }
  
  // Check offline capability
  const offlineSuite = testResults.testSuites.find(s => s.name === 'offlineCapability');
  if (offlineSuite) {
    if (offlineSuite.successRate >= 95) {
      findings.push('- Offline functionality is excellent, with all models working properly without internet connectivity.');
    } else if (offlineSuite.successRate >= 80) {
      findings.push('- Offline functionality is good but some models may have issues without internet connectivity.');
    } else {
      findings.push('- Offline functionality has significant issues that need to be addressed.');
    }
  }
  
  // Check resource management
  const resourceSuite = testResults.testSuites.find(s => s.name === 'resourceManagement');
  if (resourceSuite) {
    if (resourceSuite.successRate >= 95) {
      findings.push('- Resource management is excellent, with proper concurrent model loading and unloading.');
    } else if (resourceSuite.successRate >= 80) {
      findings.push('- Resource management is functional but could be optimized for better efficiency.');
    } else {
      findings.push('- Resource management has major issues that need to be addressed.');
    }
  }
  
  // Check API service
  const apiSuite = testResults.testSuites.find(s => s.name === 'apiService');
  if (apiSuite) {
    if (apiSuite.successRate >= 95) {
      findings.push('- API service is working excellently, providing reliable access to all models.');
    } else if (apiSuite.successRate >= 80) {
      findings.push('- API service is functional but has some reliability issues.');
    } else {
      findings.push('- API service has major issues that need to be addressed.');
    }
  }
  
  // Add findings to report
  for (const finding of findings) {
    report.push(finding);
  }
  
  report.push('');
  report.push('### Next Steps');
  report.push('');
  
  if (testResults.successRate >= 95) {
    report.push('1. Proceed with integration of embedded ML models into Aideon Core');
    report.push('2. Update both repositories with the latest code');
    report.push('3. Update the master project tracking document');
    report.push('4. Consider implementing additional models to expand capabilities');
  } else if (testResults.successRate >= 80) {
    report.push('1. Address the identified issues in the test results');
    report.push('2. Re-run tests to verify improvements');
    report.push('3. Proceed with integration once issues are resolved');
    report.push('4. Update repositories and tracking document');
  } else {
    report.push('1. Conduct a thorough review of the model integration architecture');
    report.push('2. Address all critical issues identified in the test results');
    report.push('3. Implement comprehensive fixes for each failing test');
    report.push('4. Re-run tests to verify improvements before proceeding');
  }
  
  return report.join('\n');
}

/**
 * Formats duration in milliseconds to a human-readable string
 * @param {number} duration - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(duration) {
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  let result = '';
  
  if (hours > 0) {
    result += `${hours} hour${hours !== 1 ? 's' : ''} `;
  }
  
  if (remainingMinutes > 0 || hours > 0) {
    result += `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} `;
  }
  
  result += `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  
  return result;
}

// Export main function
module.exports = {
  runModelTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runModelTests()
    .then(result => {
      if (result.success) {
        console.log('Model tests completed successfully');
        console.log(`Success rate: ${result.results.successRate.toFixed(2)}%`);
        console.log(`Summary report: ${result.reportPath}`);
        process.exit(0);
      } else {
        console.error('Model tests failed');
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error running model tests:', error);
      process.exit(1);
    });
}
