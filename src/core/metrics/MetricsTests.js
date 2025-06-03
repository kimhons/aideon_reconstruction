/**
 * @fileoverview Tests for the Standardized Metrics Collection system.
 * 
 * @module core/metrics/MetricsTests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const MetricsCollector = require('./MetricsCollector');

class MetricsTestSuite {
  constructor() {
    this.testDir = path.join(os.tmpdir(), 'aideon-metrics-test-' + Date.now());
    fs.mkdirSync(this.testDir, { recursive: true });
    
    this.tests = [
      this.testMetricDefinition,
      this.testDimensionDefinition,
      this.testRecordMetric,
      this.testFlushMetrics,
      this.testQueryMetrics,
      this.testStatisticsCalculation,
      this.testRealTimeSubscription,
      this.testSystemMetricsCollection,
      this.testRetentionPeriod
    ];
  }
  
  async run() {
    console.log('Running Metrics Collection Tests...');
    
    const results = {
      total: this.tests.length,
      passed: 0,
      failed: 0,
      details: []
    };
    
    for (const test of this.tests) {
      const testName = test.name;
      console.log(`Running test: ${testName}`);
      
      try {
        await test.call(this);
        results.passed++;
        results.details.push({
          name: testName,
          status: 'passed'
        });
        console.log(`✓ ${testName} passed`);
      } catch (error) {
        results.failed++;
        results.details.push({
          name: testName,
          status: 'failed',
          error: error.message
        });
        console.error(`✗ ${testName} failed: ${error.message}`);
      }
    }
    
    // Clean up test directory
    try {
      this.cleanupTestDir();
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
    
    // Calculate confidence interval
    const passRate = results.passed / results.total;
    const z = 1.96; // 95% confidence
    const interval = z * Math.sqrt((passRate * (1 - passRate)) / results.total);
    
    results.passRate = passRate * 100;
    results.confidenceInterval = interval * 100;
    
    console.log('\nTest Results:');
    console.log(`Total: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Pass Rate: ${results.passRate.toFixed(2)}%`);
    console.log(`Confidence Interval: ±${results.confidenceInterval.toFixed(2)}%`);
    
    return results;
  }
  
  cleanupTestDir() {
    const deleteRecursive = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };
    
    deleteRecursive(this.testDir);
  }
  
  async testMetricDefinition() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics1')
    });
    
    // Test valid metric definition
    assert.strictEqual(
      collector.defineMetric('test.metric', 'counter', 'Test metric', { unit: 'count' }),
      true,
      'Should return true for valid metric definition'
    );
    
    // Test metric definition with missing name
    assert.throws(
      () => collector.defineMetric(null, 'counter', 'Test metric'),
      /Metric name and type are required/,
      'Should throw error for missing metric name'
    );
    
    // Test metric definition with invalid type
    assert.throws(
      () => collector.defineMetric('test.invalid', 'invalid', 'Test metric'),
      /Invalid metric type/,
      'Should throw error for invalid metric type'
    );
    
    // Test metric definition exists in internal storage
    assert.deepStrictEqual(
      collector.metricDefinitions['test.metric'].name,
      'test.metric',
      'Metric definition should be stored internally'
    );
    
    await collector.stop();
  }
  
  async testDimensionDefinition() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics2')
    });
    
    // Test valid dimension definition
    assert.strictEqual(
      collector.defineDimension('test.dimension', 'Test dimension'),
      true,
      'Should return true for valid dimension definition'
    );
    
    // Test dimension definition with allowed values
    assert.strictEqual(
      collector.defineDimension('test.enum', 'Test enum dimension', ['value1', 'value2']),
      true,
      'Should return true for valid dimension definition with allowed values'
    );
    
    // Test dimension definition with missing name
    assert.throws(
      () => collector.defineDimension(null, 'Test dimension'),
      /Dimension name is required/,
      'Should throw error for missing dimension name'
    );
    
    // Test dimension definition exists in internal storage
    assert.deepStrictEqual(
      collector.dimensionDefinitions['test.dimension'].name,
      'test.dimension',
      'Dimension definition should be stored internally'
    );
    
    await collector.stop();
  }
  
  async testRecordMetric() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics3')
    });
    
    // Define metric and dimension
    collector.defineMetric('test.value', 'gauge', 'Test value metric', { unit: 'count' });
    collector.defineDimension('test.category', 'Test category dimension', ['category1', 'category2']);
    
    // Test recording valid metric
    assert.strictEqual(
      collector.recordMetric('test.value', 42),
      true,
      'Should return true for valid metric recording'
    );
    
    // Test recording metric with valid dimension
    assert.strictEqual(
      collector.recordMetric('test.value', 43, { 'test.category': 'category1' }),
      true,
      'Should return true for valid metric recording with dimension'
    );
    
    // Test recording undefined metric
    assert.throws(
      () => collector.recordMetric('undefined.metric', 42),
      /Metric not defined/,
      'Should throw error for undefined metric'
    );
    
    // Test recording with invalid value type
    assert.throws(
      () => collector.recordMetric('test.value', 'string value'),
      /Invalid value type/,
      'Should throw error for invalid value type'
    );
    
    // Test recording with undefined dimension
    assert.throws(
      () => collector.recordMetric('test.value', 44, { 'undefined.dimension': 'value' }),
      /Dimension not defined/,
      'Should throw error for undefined dimension'
    );
    
    // Test recording with invalid dimension value
    assert.throws(
      () => collector.recordMetric('test.value', 45, { 'test.category': 'invalid' }),
      /Invalid value for dimension/,
      'Should throw error for invalid dimension value'
    );
    
    // Verify metrics are in buffer
    assert.strictEqual(
      collector.metricsBuffer['test.value'].length,
      2,
      'Metrics buffer should contain recorded metrics'
    );
    
    await collector.stop();
  }
  
  async testFlushMetrics() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics4'),
      flushInterval: 100000 // Set high to prevent auto-flush
    });
    
    // Define and record metrics
    collector.defineMetric('test.flush', 'counter', 'Test flush metric');
    collector.recordMetric('test.flush', 1);
    collector.recordMetric('test.flush', 2);
    
    // Verify metrics are in buffer
    assert.strictEqual(
      collector.metricsBuffer['test.flush'].length,
      2,
      'Metrics buffer should contain recorded metrics before flush'
    );
    
    // Flush metrics
    const flushResult = await collector.flush();
    assert.strictEqual(
      flushResult,
      true,
      'Flush should return true on success'
    );
    
    // Verify buffer is cleared
    assert.strictEqual(
      collector.metricsBuffer['test.flush'],
      undefined,
      'Metrics buffer should be cleared after flush'
    );
    
    // Verify metrics file was created
    const files = fs.readdirSync(path.join(this.testDir, 'metrics4'));
    assert.strictEqual(
      files.length > 0,
      true,
      'Metrics file should be created after flush'
    );
    
    // Verify file contains correct metrics
    const fileContent = fs.readFileSync(
      path.join(this.testDir, 'metrics4', files[0]),
      'utf8'
    );
    const data = JSON.parse(fileContent);
    
    assert.strictEqual(
      data.metrics['test.flush'].length,
      2,
      'Metrics file should contain all recorded metrics'
    );
    
    await collector.stop();
  }
  
  async testQueryMetrics() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics5'),
      flushInterval: 100000 // Set high to prevent auto-flush
    });
    
    // Define metrics and dimensions
    collector.defineMetric('test.query', 'gauge', 'Test query metric');
    collector.defineDimension('test.region', 'Test region dimension');
    
    // Record metrics with timestamps and dimensions
    const now = Date.now();
    collector.recordMetric('test.query', 10, { 'test.region': 'east' });
    collector.recordMetric('test.query', 20, { 'test.region': 'west' });
    collector.recordMetric('test.query', 30, { 'test.region': 'east' });
    
    // Flush metrics to storage
    await collector.flush();
    
    // Query all metrics
    const allResults = await collector.queryMetrics({
      metricName: 'test.query'
    });
    
    assert.strictEqual(
      allResults.length,
      3,
      'Query should return all metrics for the given name'
    );
    
    // Query metrics with dimension filter
    const eastResults = await collector.queryMetrics({
      metricName: 'test.query',
      dimensions: { 'test.region': 'east' }
    });
    
    assert.strictEqual(
      eastResults.length,
      2,
      'Query should return metrics filtered by dimension'
    );
    
    // Query metrics with time range
    const timeResults = await collector.queryMetrics({
      metricName: 'test.query',
      startTime: now - 1000,
      endTime: now + 1000
    });
    
    assert.strictEqual(
      timeResults.length,
      3,
      'Query should return metrics filtered by time range'
    );
    
    await collector.stop();
  }
  
  async testStatisticsCalculation() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics6')
    });
    
    // Test with empty array
    const emptyStats = collector.calculateStatistics([]);
    assert.strictEqual(
      emptyStats.count,
      0,
      'Statistics for empty array should have count 0'
    );
    
    // Test with non-numeric values
    const nonNumericStats = collector.calculateStatistics([
      { value: 'string' },
      { value: true }
    ]);
    assert.strictEqual(
      nonNumericStats.count,
      2,
      'Statistics should count non-numeric values'
    );
    assert.strictEqual(
      nonNumericStats.avg,
      null,
      'Statistics should return null for numeric calculations on non-numeric values'
    );
    
    // Test with numeric values
    const numericValues = [
      { value: 10 },
      { value: 20 },
      { value: 30 },
      { value: 40 },
      { value: 50 }
    ];
    
    const numericStats = collector.calculateStatistics(numericValues);
    assert.strictEqual(
      numericStats.count,
      5,
      'Statistics should count all values'
    );
    assert.strictEqual(
      numericStats.min,
      10,
      'Statistics should calculate correct minimum'
    );
    assert.strictEqual(
      numericStats.max,
      50,
      'Statistics should calculate correct maximum'
    );
    assert.strictEqual(
      numericStats.sum,
      150,
      'Statistics should calculate correct sum'
    );
    assert.strictEqual(
      numericStats.avg,
      30,
      'Statistics should calculate correct average'
    );
    assert.strictEqual(
      numericStats.median,
      30,
      'Statistics should calculate correct median'
    );
    assert.strictEqual(
      numericStats.p95,
      50,
      'Statistics should calculate correct 95th percentile'
    );
    
    await collector.stop();
  }
  
  async testRealTimeSubscription() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics7'),
      enableRealTimeAnalysis: true
    });
    
    // Define metric
    collector.defineMetric('test.realtime', 'gauge', 'Test realtime metric');
    
    // Set up subscription
    let receivedMetric = null;
    const unsubscribe = collector.subscribeToMetrics((metric) => {
      receivedMetric = metric;
    });
    
    // Record metric
    collector.recordMetric('test.realtime', 42);
    
    // Wait for event to be processed
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify event was received
    assert.strictEqual(
      receivedMetric !== null,
      true,
      'Subscription should receive metric events'
    );
    assert.strictEqual(
      receivedMetric.name,
      'test.realtime',
      'Received event should have correct metric name'
    );
    assert.strictEqual(
      receivedMetric.value,
      42,
      'Received event should have correct metric value'
    );
    
    // Unsubscribe and verify no more events
    unsubscribe();
    receivedMetric = null;
    collector.recordMetric('test.realtime', 43);
    
    // Wait for event to be processed
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Verify no event was received after unsubscribe
    assert.strictEqual(
      receivedMetric,
      null,
      'No events should be received after unsubscribe'
    );
    
    // Test with disabled real-time analysis
    const disabledCollector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics7b'),
      enableRealTimeAnalysis: false
    });
    
    // Verify subscription throws error
    assert.throws(
      () => disabledCollector.subscribeToMetrics(() => {}),
      /Real-time analysis is disabled/,
      'Should throw error when subscribing with disabled real-time analysis'
    );
    
    await collector.stop();
    await disabledCollector.stop();
  }
  
  async testSystemMetricsCollection() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics8')
    });
    
    // Wait for system metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 5100));
    
    // Verify system metrics are in buffer
    assert.strictEqual(
      collector.metricsBuffer['system.cpu.usage'] !== undefined,
      true,
      'System CPU usage metrics should be collected'
    );
    assert.strictEqual(
      collector.metricsBuffer['system.memory.usage'] !== undefined,
      true,
      'System memory usage metrics should be collected'
    );
    
    // Verify metric values are reasonable
    const cpuMetrics = collector.metricsBuffer['system.cpu.usage'];
    for (const metric of cpuMetrics) {
      assert.strictEqual(
        metric.value >= 0 && metric.value <= 100,
        true,
        'CPU usage should be between 0 and 100 percent'
      );
    }
    
    const memoryMetrics = collector.metricsBuffer['system.memory.usage'];
    for (const metric of memoryMetrics) {
      assert.strictEqual(
        metric.value >= 0 && metric.value <= 100,
        true,
        'Memory usage should be between 0 and 100 percent'
      );
    }
    
    await collector.stop();
  }
  
  async testRetentionPeriod() {
    const collector = new MetricsCollector({
      storageDir: path.join(this.testDir, 'metrics9'),
      retentionPeriod: 1 // 1 day
    });
    
    // Create test metrics files with old timestamps
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 2); // 2 days ago
    
    const oldFilePath = path.join(
      this.testDir,
      'metrics9',
      `metrics-${oldDate.toISOString().replace(/[:.]/g, '-')}.json`
    );
    
    fs.writeFileSync(
      oldFilePath,
      JSON.stringify({
        timestamp: oldDate.getTime(),
        metrics: {
          'test.retention': [
            { timestamp: oldDate.getTime(), value: 1 }
          ]
        }
      })
    );
    
    // Set file modification time to match content
    fs.utimesSync(oldFilePath, oldDate, oldDate);
    
    // Create recent file
    const recentDate = new Date();
    const recentFilePath = path.join(
      this.testDir,
      'metrics9',
      `metrics-${recentDate.toISOString().replace(/[:.]/g, '-')}.json`
    );
    
    fs.writeFileSync(
      recentFilePath,
      JSON.stringify({
        timestamp: recentDate.getTime(),
        metrics: {
          'test.retention': [
            { timestamp: recentDate.getTime(), value: 2 }
          ]
        }
      })
    );
    
    // Trigger cleanup
    await collector.cleanupOldMetricsFiles();
    
    // Verify old file was deleted
    assert.strictEqual(
      fs.existsSync(oldFilePath),
      false,
      'Old metrics file should be deleted'
    );
    
    // Verify recent file was kept
    assert.strictEqual(
      fs.existsSync(recentFilePath),
      true,
      'Recent metrics file should be kept'
    );
    
    await collector.stop();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new MetricsTestSuite();
  testSuite.run().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = MetricsTestSuite;
