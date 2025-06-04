/**
 * @fileoverview Performance Validation Test Runner Script
 * Executes the performance validation process and generates comprehensive reports
 */

const path = require('path');
const fs = require('fs').promises;
const PerformanceValidationRunner = require('../core/performance/PerformanceValidationRunner');

/**
 * Main function to run performance validation
 */
async function runPerformanceValidation() {
  console.log('Starting Aideon Performance Validation Process...');
  
  // Create output directory
  const outputDir = path.join(__dirname, '../../performance_validation');
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('Error creating output directory:', error);
      process.exit(1);
    }
  }
  
  // Create validation runner
  const validationRunner = new PerformanceValidationRunner({
    outputDirectory: outputDir,
    compareWithBaseline: true,
    baselinePath: path.join(outputDir, 'baseline.json'),
    saveAsBaseline: true,
    generateReport: true,
    reportFormat: 'md'
  });
  
  try {
    // Initialize validation runner
    console.log('Initializing validation runner...');
    await validationRunner.initialize();
    
    // Run validation
    console.log('Running performance validation...');
    const results = await validationRunner.runValidation();
    
    // Print summary
    console.log('\n=== Performance Validation Summary ===');
    console.log(`Validation completed at: ${results.timestamp}`);
    console.log(`Duration: ${(results.duration / 1000).toFixed(2)} seconds`);
    console.log('\nPerformance Improvements:');
    console.log(`- Response Time: ${results.improvements.overall.responseTime.toFixed(2)}%`);
    console.log(`- Throughput: ${results.improvements.overall.throughput.toFixed(2)}%`);
    console.log(`- Resource Usage: ${results.improvements.overall.resourceUsage.toFixed(2)}%`);
    
    console.log('\nCategory Improvements:');
    Object.entries(results.improvements.categories).forEach(([category, improvements]) => {
      console.log(`- ${category}:`);
      console.log(`  - Response Time: ${improvements.responseTime.toFixed(2)}%`);
      console.log(`  - Throughput: ${improvements.throughput.toFixed(2)}%`);
      console.log(`  - Resource Usage: ${improvements.resourceUsage.toFixed(2)}%`);
    });
    
    console.log('\nValidation successful!');
    return results;
  } catch (error) {
    console.error('Error during performance validation:', error);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  runPerformanceValidation()
    .then(results => {
      console.log('Performance validation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Performance validation failed:', error);
      process.exit(1);
    });
} else {
  // Export for use as a module
  module.exports = { runPerformanceValidation };
}
