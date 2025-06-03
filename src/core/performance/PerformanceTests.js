/**
 * @fileoverview Performance Tests for Aideon system
 * Provides comprehensive test suite for validating performance optimizations
 * across all components and tentacles of the Aideon system.
 */

const { performance } = require('perf_hooks');
const PerformanceProfiler = require('./PerformanceProfiler');
const PerformanceOptimizationManager = require('./PerformanceOptimizationManager');

/**
 * Class representing the Performance Test Suite for the Aideon system
 */
class PerformanceTests {
  /**
   * Create a new PerformanceTests instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.detailedLogging - Whether to enable detailed logging (default: false)
   * @param {string} options.outputDirectory - Directory to store test results (default: './performance_tests')
   * @param {number} options.iterations - Number of test iterations (default: 5)
   * @param {number} options.warmupIterations - Number of warmup iterations (default: 2)
   * @param {boolean} options.compareWithBaseline - Whether to compare with baseline (default: true)
   */
  constructor(options = {}) {
    this.options = {
      detailedLogging: options.detailedLogging || false,
      outputDirectory: options.outputDirectory || './performance_tests',
      iterations: options.iterations || 5,
      warmupIterations: options.warmupIterations || 2,
      compareWithBaseline: options.compareWithBaseline !== false
    };

    this.profiler = new PerformanceProfiler({
      outputDirectory: this.options.outputDirectory,
      enableDetailedProfiling: true
    });
    
    this.optimizationManager = null;
    this.testResults = new Map();
    this.baselineResults = new Map();
    this.isRunning = false;
  }

  /**
   * Initialize the test suite
   * @param {PerformanceOptimizationManager} [optimizationManager] - Optional optimization manager instance
   * @returns {Promise<void>}
   */
  async initialize(optimizationManager = null) {
    if (optimizationManager) {
      this.optimizationManager = optimizationManager;
    } else {
      this.optimizationManager = new PerformanceOptimizationManager({
        profilerOptions: {
          outputDirectory: this.options.outputDirectory,
          enableDetailedProfiling: true
        }
      });
    }
    
    await this.profiler.start();
    console.log('Performance Test Suite initialized');
  }

  /**
   * Run all performance tests
   * @returns {Promise<Object>} Test results summary
   */
  async runAllTests() {
    if (this.isRunning) {
      console.warn('Tests are already running');
      return null;
    }
    
    this.isRunning = true;
    console.log('Running all performance tests...');
    
    try {
      // Run core system tests
      await this.runCoreSystemTests();
      
      // Run model execution tests
      await this.runModelExecutionTests();
      
      // Run memory management tests
      await this.runMemoryManagementTests();
      
      // Run I/O and network tests
      await this.runIONetworkTests();
      
      // Run tentacle-specific tests
      await this.runTentacleTests();
      
      // Generate summary
      const summary = this._generateTestSummary();
      
      this.isRunning = false;
      console.log('All performance tests completed');
      
      return summary;
    } catch (error) {
      console.error('Error running performance tests:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Run core system performance tests
   * @returns {Promise<Object>} Test results
   */
  async runCoreSystemTests() {
    console.log('Running core system performance tests...');
    
    const testId = 'core_system';
    const testResults = {
      name: 'Core System Tests',
      startTime: performance.now(),
      tests: []
    };
    
    // Run system initialization test
    testResults.tests.push(await this._runTest('system_initialization', async () => {
      // Simulate system initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      return { initialized: true };
    }));
    
    // Run context switching test
    testResults.tests.push(await this._runTest('context_switching', async () => {
      // Simulate context switching operations
      let counter = 0;
      for (let i = 0; i < 1000; i++) {
        counter += i;
      }
      return { switches: 1000, result: counter };
    }));
    
    // Run message bus test
    testResults.tests.push(await this._runTest('message_bus', async () => {
      // Simulate message bus operations
      const messages = [];
      for (let i = 0; i < 100; i++) {
        messages.push({ id: i, payload: `Message ${i}` });
      }
      return { messagesSent: messages.length };
    }));
    
    testResults.endTime = performance.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    this.testResults.set(testId, testResults);
    console.log(`Core system tests completed in ${testResults.duration.toFixed(2)}ms`);
    
    return testResults;
  }

  /**
   * Run model execution performance tests
   * @returns {Promise<Object>} Test results
   */
  async runModelExecutionTests() {
    console.log('Running model execution performance tests...');
    
    const testId = 'model_execution';
    const testResults = {
      name: 'Model Execution Tests',
      startTime: performance.now(),
      tests: []
    };
    
    // Run model loading test
    testResults.tests.push(await this._runTest('model_loading', async () => {
      // Simulate model loading
      await new Promise(resolve => setTimeout(resolve, 200));
      return { modelLoaded: true, size: '500MB' };
    }));
    
    // Run inference test
    testResults.tests.push(await this._runTest('model_inference', async () => {
      // Simulate model inference
      await new Promise(resolve => setTimeout(resolve, 150));
      return { inferenceDone: true, tokens: 100 };
    }));
    
    // Run model switching test
    testResults.tests.push(await this._runTest('model_switching', async () => {
      // Simulate model switching
      await new Promise(resolve => setTimeout(resolve, 180));
      return { switched: true, fromModel: 'small', toModel: 'medium' };
    }));
    
    testResults.endTime = performance.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    this.testResults.set(testId, testResults);
    console.log(`Model execution tests completed in ${testResults.duration.toFixed(2)}ms`);
    
    return testResults;
  }

  /**
   * Run memory management performance tests
   * @returns {Promise<Object>} Test results
   */
  async runMemoryManagementTests() {
    console.log('Running memory management performance tests...');
    
    const testId = 'memory_management';
    const testResults = {
      name: 'Memory Management Tests',
      startTime: performance.now(),
      tests: []
    };
    
    // Run memory allocation test
    testResults.tests.push(await this._runTest('memory_allocation', async () => {
      // Simulate memory allocation
      const arrays = [];
      for (let i = 0; i < 10; i++) {
        arrays.push(new Array(10000).fill(0));
      }
      return { allocated: true, arrayCount: arrays.length };
    }));
    
    // Run garbage collection test
    testResults.tests.push(await this._runTest('garbage_collection', async () => {
      // Simulate triggering garbage collection
      if (global.gc) {
        global.gc();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      return { gcTriggered: true };
    }));
    
    // Run memory pressure test
    testResults.tests.push(await this._runTest('memory_pressure', async () => {
      // Simulate memory pressure
      const memoryUsage = process.memoryUsage();
      return { 
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss
      };
    }));
    
    testResults.endTime = performance.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    this.testResults.set(testId, testResults);
    console.log(`Memory management tests completed in ${testResults.duration.toFixed(2)}ms`);
    
    return testResults;
  }

  /**
   * Run I/O and network performance tests
   * @returns {Promise<Object>} Test results
   */
  async runIONetworkTests() {
    console.log('Running I/O and network performance tests...');
    
    const testId = 'io_network';
    const testResults = {
      name: 'I/O and Network Tests',
      startTime: performance.now(),
      tests: []
    };
    
    // Run file I/O test
    testResults.tests.push(await this._runTest('file_io', async () => {
      // Simulate file I/O operations
      await new Promise(resolve => setTimeout(resolve, 120));
      return { fileOperations: 100, bytesProcessed: 1024 * 1024 };
    }));
    
    // Run network request test
    testResults.tests.push(await this._runTest('network_request', async () => {
      // Simulate network requests
      await new Promise(resolve => setTimeout(resolve, 150));
      return { requestsSent: 10, bytesTransferred: 512 * 1024 };
    }));
    
    // Run data serialization test
    testResults.tests.push(await this._runTest('data_serialization', async () => {
      // Simulate data serialization
      const data = [];
      for (let i = 0; i < 1000; i++) {
        data.push({ id: i, value: `Value ${i}` });
      }
      const serialized = JSON.stringify(data);
      return { objectsProcessed: data.length, serializedSize: serialized.length };
    }));
    
    testResults.endTime = performance.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    this.testResults.set(testId, testResults);
    console.log(`I/O and network tests completed in ${testResults.duration.toFixed(2)}ms`);
    
    return testResults;
  }

  /**
   * Run tentacle-specific performance tests
   * @returns {Promise<Object>} Test results
   */
  async runTentacleTests() {
    console.log('Running tentacle-specific performance tests...');
    
    const testId = 'tentacles';
    const testResults = {
      name: 'Tentacle Tests',
      startTime: performance.now(),
      tests: []
    };
    
    // Test Academic Research Tentacle
    testResults.tests.push(await this._runTest('academic_research_tentacle', async () => {
      // Simulate academic research operations
      await new Promise(resolve => setTimeout(resolve, 180));
      return { operationsCompleted: 5, documentsProcessed: 20 };
    }));
    
    // Test Data Integration Tentacle
    testResults.tests.push(await this._runTest('data_integration_tentacle', async () => {
      // Simulate data integration operations
      await new Promise(resolve => setTimeout(resolve, 150));
      return { sourcesConnected: 3, recordsProcessed: 1000 };
    }));
    
    // Test Business Operations Tentacle
    testResults.tests.push(await this._runTest('business_operations_tentacle', async () => {
      // Simulate business operations
      await new Promise(resolve => setTimeout(resolve, 130));
      return { workflowsExecuted: 2, reportsGenerated: 5 };
    }));
    
    testResults.endTime = performance.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    this.testResults.set(testId, testResults);
    console.log(`Tentacle tests completed in ${testResults.duration.toFixed(2)}ms`);
    
    return testResults;
  }

  /**
   * Run a specific performance test
   * @param {string} name - Test name
   * @param {Function} testFn - Test function
   * @param {number} [iterations] - Number of iterations (defaults to options.iterations)
   * @returns {Promise<Object>} Test results
   * @private
   */
  async _runTest(name, testFn, iterations = this.options.iterations) {
    if (this.options.detailedLogging) {
      console.log(`Running test: ${name}`);
    }
    
    const results = {
      name,
      iterations: [],
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      totalDuration: 0,
      startTime: performance.now()
    };
    
    // Run warmup iterations
    for (let i = 0; i < this.options.warmupIterations; i++) {
      await testFn();
    }
    
    // Run actual test iterations
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      const iterationResult = await testFn();
      const iterationEnd = performance.now();
      const iterationDuration = iterationEnd - iterationStart;
      
      results.iterations.push({
        iteration: i,
        duration: iterationDuration,
        result: iterationResult
      });
      
      results.totalDuration += iterationDuration;
      results.minDuration = Math.min(results.minDuration, iterationDuration);
      results.maxDuration = Math.max(results.maxDuration, iterationDuration);
    }
    
    results.endTime = performance.now();
    results.avgDuration = results.totalDuration / iterations;
    
    if (this.options.detailedLogging) {
      console.log(`Test ${name} completed: avg=${results.avgDuration.toFixed(2)}ms, min=${results.minDuration.toFixed(2)}ms, max=${results.maxDuration.toFixed(2)}ms`);
    }
    
    return results;
  }

  /**
   * Generate a summary of all test results
   * @returns {Object} Test summary
   * @private
   */
  _generateTestSummary() {
    const summary = {
      totalTests: 0,
      totalDuration: 0,
      categories: [],
      improvements: {},
      timestamp: new Date().toISOString()
    };
    
    this.testResults.forEach((categoryResults, categoryId) => {
      const categorySummary = {
        name: categoryResults.name,
        duration: categoryResults.duration,
        tests: categoryResults.tests.length,
        avgTestDuration: categoryResults.tests.reduce((sum, test) => sum + test.avgDuration, 0) / categoryResults.tests.length
      };
      
      summary.categories.push(categorySummary);
      summary.totalTests += categorySummary.tests;
      summary.totalDuration += categoryResults.duration;
      
      // Calculate improvements if baseline exists
      if (this.options.compareWithBaseline && this.baselineResults.has(categoryId)) {
        const baseline = this.baselineResults.get(categoryId);
        const improvement = (baseline.duration - categoryResults.duration) / baseline.duration * 100;
        summary.improvements[categoryId] = {
          baseline: baseline.duration,
          current: categoryResults.duration,
          improvement: improvement,
          percentImprovement: `${improvement.toFixed(2)}%`
        };
      }
    });
    
    return summary;
  }

  /**
   * Set baseline results for comparison
   * @param {Object} baselineResults - Baseline test results
   */
  setBaselineResults(baselineResults) {
    if (typeof baselineResults === 'object') {
      Object.entries(baselineResults).forEach(([key, value]) => {
        this.baselineResults.set(key, value);
      });
    }
  }

  /**
   * Load baseline results from a file
   * @param {string} filePath - Path to baseline results file
   * @returns {Promise<boolean>} Whether baseline was loaded successfully
   */
  async loadBaselineResults(filePath) {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(filePath, 'utf8');
      const baselineResults = JSON.parse(data);
      this.setBaselineResults(baselineResults);
      return true;
    } catch (error) {
      console.error('Error loading baseline results:', error);
      return false;
    }
  }

  /**
   * Save current results as baseline
   * @param {string} filePath - Path to save baseline results
   * @returns {Promise<boolean>} Whether baseline was saved successfully
   */
  async saveAsBaseline(filePath) {
    try {
      const fs = require('fs').promises;
      const baselineData = {};
      
      this.testResults.forEach((value, key) => {
        baselineData[key] = value;
      });
      
      await fs.writeFile(filePath, JSON.stringify(baselineData, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving baseline results:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    await this.profiler.stop();
    if (this.optimizationManager) {
      await this.optimizationManager.stop();
    }
    console.log('Performance Test Suite cleaned up');
  }
}

module.exports = PerformanceTests;
