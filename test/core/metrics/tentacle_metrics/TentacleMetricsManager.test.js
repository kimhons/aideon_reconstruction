/**
 * @fileoverview Tests for TentacleMetricsManager.
 * This module contains comprehensive tests for the TentacleMetricsManager class.
 * 
 * @module test/core/metrics/tentacle_metrics/TentacleMetricsManager.test
 */

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');

// Update path to point to the correct location
const TentacleMetricsManager = require('../../../../src/core/metrics/tentacle_metrics/TentacleMetricsManager');
const MetricsCollector = require('../../../../src/core/metrics/MetricsCollector');

describe('TentacleMetricsManager', () => {
  let metricsCollector;
  let tentacleMetrics;
  let clock;
  
  beforeEach(() => {
    // Use fake timers
    clock = sinon.useFakeTimers();
    
    // Create a mock metrics collector
    metricsCollector = {
      defineMetric: sinon.stub().returns(true),
      defineDimension: sinon.stub().returns(true),
      recordMetric: sinon.stub().returns(true),
      queryMetrics: sinon.stub().resolves([]),
      calculateStatistics: sinon.stub().returns({}),
      subscribeToMetrics: sinon.stub().returns(() => {})
    };
    
    // Create tentacle metrics manager with mock collector
    tentacleMetrics = new TentacleMetricsManager({
      metricsCollector,
      autoRegisterTentacles: false, // Disable auto-registration for tests
      enableRealTimeAlerts: true
    });
  });
  
  afterEach(() => {
    // Restore timers
    clock.restore();
    
    // Clean up
    if (tentacleMetrics) {
      tentacleMetrics.stop();
    }
  });
  
  describe('initialization', () => {
    it('should initialize with default options', () => {
      const tm = new TentacleMetricsManager();
      assert.ok(tm.options.metricsCollector instanceof MetricsCollector);
      assert.strictEqual(tm.options.autoRegisterTentacles, true);
      assert.strictEqual(tm.options.anomalyDetectionThreshold, 3.0);
      assert.strictEqual(tm.options.enableRealTimeAlerts, true);
    });
    
    it('should initialize with custom options', () => {
      const tm = new TentacleMetricsManager({
        metricsCollector,
        autoRegisterTentacles: false,
        anomalyDetectionThreshold: 2.5,
        enableRealTimeAlerts: false
      });
      
      assert.strictEqual(tm.options.metricsCollector, metricsCollector);
      assert.strictEqual(tm.options.autoRegisterTentacles, false);
      assert.strictEqual(tm.options.anomalyDetectionThreshold, 2.5);
      assert.strictEqual(tm.options.enableRealTimeAlerts, false);
    });
    
    it('should define standard tentacle metrics and dimensions', () => {
      // Check that dimensions were defined
      assert.ok(metricsCollector.defineDimension.calledWith('tentacle_id'));
      assert.ok(metricsCollector.defineDimension.calledWith('tentacle_type'));
      assert.ok(metricsCollector.defineDimension.calledWith('operation_type'));
      assert.ok(metricsCollector.defineDimension.calledWith('status'));
      assert.ok(metricsCollector.defineDimension.calledWith('priority'));
      
      // Check that metrics were defined
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.operation.duration'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.operation.count'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.operation.error_count'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.resource.cpu_usage'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.resource.memory_usage'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.communication.message_count'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.communication.message_size'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.quality.success_rate'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.quality.error_rate'));
      assert.ok(metricsCollector.defineMetric.calledWith('tentacle.learning.improvement_rate'));
    });
    
    it('should set up anomaly detection if enabled', () => {
      assert.ok(metricsCollector.subscribeToMetrics.calledOnce);
    });
  });
  
  describe('registerTentacle', () => {
    it('should register a new tentacle', () => {
      const result = tentacleMetrics.registerTentacle('test-tentacle', 'test');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.tentacleId, 'test-tentacle');
      assert.strictEqual(result.tentacleType, 'test');
      assert.ok(tentacleMetrics.tentacleRegistry['test-tentacle']);
      assert.strictEqual(tentacleMetrics.tentacleRegistry['test-tentacle'].type, 'test');
    });
    
    it('should not register the same tentacle twice', () => {
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      const result = tentacleMetrics.registerTentacle('test-tentacle', 'another-type');
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(tentacleMetrics.tentacleRegistry['test-tentacle'].type, 'test');
    });
    
    it('should throw an error if tentacleId is missing', () => {
      assert.throws(() => {
        tentacleMetrics.registerTentacle();
      }, /Tentacle ID is required/);
    });
  });
  
  describe('recordTentacleMetric', () => {
    it('should record a metric for a registered tentacle', () => {
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'operation.count', 1);
      
      assert.ok(metricsCollector.recordMetric.calledOnce);
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.count',
        1,
        { tentacle_id: 'test-tentacle', tentacle_type: 'test' }
      ));
    });
    
    it('should auto-register a tentacle if not registered', () => {
      tentacleMetrics.recordTentacleMetric('new-tentacle', 'operation.count', 1);
      
      assert.ok(tentacleMetrics.tentacleRegistry['new-tentacle']);
      assert.ok(metricsCollector.recordMetric.calledOnce);
    });
    
    it('should add tentacle prefix to metric name if missing', () => {
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'operation.count', 1);
      
      assert.ok(metricsCollector.recordMetric.calledWith('tentacle.operation.count'));
      
      metricsCollector.recordMetric.resetHistory();
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'tentacle.operation.count', 1);
      
      assert.ok(metricsCollector.recordMetric.calledWith('tentacle.operation.count'));
    });
    
    it('should merge additional dimensions with tentacle information', () => {
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'operation.count', 1, {
        operation_type: 'test-op',
        priority: 'high'
      });
      
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.count',
        1,
        {
          tentacle_id: 'test-tentacle',
          tentacle_type: 'test',
          operation_type: 'test-op',
          priority: 'high'
        }
      ));
    });
    
    it('should update tentacle metrics registry', () => {
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'operation.count', 1);
      
      const metricInfo = tentacleMetrics.tentacleRegistry['test-tentacle'].metrics['tentacle.operation.count'];
      assert.strictEqual(metricInfo.count, 1);
      assert.strictEqual(metricInfo.lastValue, 1);
      assert.ok(metricInfo.lastRecorded);
    });
    
    it('should throw an error if tentacleId is missing', () => {
      assert.throws(() => {
        tentacleMetrics.recordTentacleMetric();
      }, /Tentacle ID is required/);
    });
  });
  
  describe('startOperation and endOperation', () => {
    it('should track operation duration', () => {
      const context = tentacleMetrics.startOperation('test-tentacle', 'test-op');
      
      // Advance time
      clock.tick(100);
      
      const result = tentacleMetrics.endOperation(context);
      
      assert.strictEqual(result.duration, 100);
      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.tentacleId, 'test-tentacle');
      assert.strictEqual(result.operationType, 'test-op');
      
      // Check that metrics were recorded
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.count',
        1,
        sinon.match({ tentacle_id: 'test-tentacle', operation_type: 'test-op' })
      ));
      
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.duration',
        100,
        sinon.match({ tentacle_id: 'test-tentacle', operation_type: 'test-op', status: 'success' })
      ));
    });
    
    it('should record errors for failed operations', () => {
      const context = tentacleMetrics.startOperation('test-tentacle', 'test-op');
      
      tentacleMetrics.endOperation(context, 'failure', { errorType: 'test-error' });
      
      // Check that error metric was recorded
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.error_count',
        1,
        sinon.match({
          tentacle_id: 'test-tentacle',
          operation_type: 'test-op',
          error_type: 'test-error'
        })
      ));
    });
    
    it('should update quality metrics', () => {
      const context = tentacleMetrics.startOperation('test-tentacle', 'test-op');
      tentacleMetrics.endOperation(context);
      
      // Check that updateQualityMetrics was called
      assert.ok(metricsCollector.queryMetrics.called);
    });
    
    it('should throw an error if context is invalid', () => {
      assert.throws(() => {
        tentacleMetrics.endOperation();
      }, /Valid operation context is required/);
      
      assert.throws(() => {
        tentacleMetrics.endOperation({});
      }, /Valid operation context is required/);
      
      assert.throws(() => {
        tentacleMetrics.endOperation({ tentacleId: 'test' });
      }, /Valid operation context is required/);
    });
  });
  
  describe('recordResourceUsage', () => {
    it('should record CPU and memory usage', () => {
      tentacleMetrics.recordResourceUsage('test-tentacle', {
        cpuUsage: 50,
        memoryUsage: 1024 * 1024
      });
      
      // Check that CPU usage was recorded
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.resource.cpu_usage',
        50,
        sinon.match({ tentacle_id: 'test-tentacle' })
      ));
      
      // Check that memory usage was recorded
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.resource.memory_usage',
        1024 * 1024,
        sinon.match({ tentacle_id: 'test-tentacle' })
      ));
    });
    
    it('should handle partial resource metrics', () => {
      tentacleMetrics.recordResourceUsage('test-tentacle', {
        cpuUsage: 50
      });
      
      // Check that only CPU usage was recorded
      assert.ok(metricsCollector.recordMetric.calledOnce);
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.resource.cpu_usage',
        50,
        sinon.match({ tentacle_id: 'test-tentacle' })
      ));
    });
    
    it('should throw an error if tentacleId is missing', () => {
      assert.throws(() => {
        tentacleMetrics.recordResourceUsage();
      }, /Tentacle ID is required/);
    });
  });
  
  describe('recordCommunication', () => {
    it('should record message count and size for both tentacles', () => {
      tentacleMetrics.recordCommunication(
        'source-tentacle',
        'target-tentacle',
        'test-message',
        1024
      );
      
      // Check that message count was recorded for source tentacle
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.communication.message_count',
        1,
        sinon.match({
          tentacle_id: 'source-tentacle',
          target_tentacle_id: 'target-tentacle',
          message_type: 'test-message',
          direction: 'outgoing'
        })
      ));
      
      // Check that message count was recorded for target tentacle
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.communication.message_count',
        1,
        sinon.match({
          tentacle_id: 'target-tentacle',
          source_tentacle_id: 'source-tentacle',
          message_type: 'test-message',
          direction: 'incoming'
        })
      ));
      
      // Check that message size was recorded for source tentacle
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.communication.message_size',
        1024,
        sinon.match({
          tentacle_id: 'source-tentacle',
          target_tentacle_id: 'target-tentacle',
          message_type: 'test-message',
          direction: 'outgoing'
        })
      ));
      
      // Check that message size was recorded for target tentacle
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.communication.message_size',
        1024,
        sinon.match({
          tentacle_id: 'target-tentacle',
          source_tentacle_id: 'source-tentacle',
          message_type: 'test-message',
          direction: 'incoming'
        })
      ));
    });
    
    it('should throw an error if tentacle IDs are missing', () => {
      assert.throws(() => {
        tentacleMetrics.recordCommunication();
      }, /Source and target tentacle IDs are required/);
      
      assert.throws(() => {
        tentacleMetrics.recordCommunication('source-tentacle');
      }, /Source and target tentacle IDs are required/);
    });
  });
  
  describe('recordLearningProgress', () => {
    it('should record improvement rate', () => {
      tentacleMetrics.recordLearningProgress('test-tentacle', 5.5);
      
      // Check that improvement rate was recorded
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.learning.improvement_rate',
        5.5,
        sinon.match({ tentacle_id: 'test-tentacle' })
      ));
    });
    
    it('should throw an error if tentacleId is missing', () => {
      assert.throws(() => {
        tentacleMetrics.recordLearningProgress();
      }, /Tentacle ID is required/);
    });
  });
  
  describe('getTentacleMetrics', () => {
    it('should query metrics for a tentacle', async () => {
      // Register tentacle
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      
      // Record some metrics
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'operation.count', 1);
      
      // Set up mock query response
      const mockMetricValues = [
        { timestamp: 1000, value: 1, dimensions: {} },
        { timestamp: 2000, value: 2, dimensions: {} }
      ];
      
      metricsCollector.queryMetrics.resolves(mockMetricValues);
      metricsCollector.calculateStatistics.returns({
        count: 2,
        min: 1,
        max: 2,
        avg: 1.5
      });
      
      // Query metrics
      const result = await tentacleMetrics.getTentacleMetrics('test-tentacle');
      
      // Check result structure
      assert.strictEqual(result.tentacleId, 'test-tentacle');
      assert.strictEqual(result.tentacleType, 'test');
      assert.ok(result.timeRange);
      assert.ok(result.metrics['tentacle.operation.count']);
      assert.deepStrictEqual(result.metrics['tentacle.operation.count'].values, mockMetricValues);
      assert.deepStrictEqual(result.metrics['tentacle.operation.count'].statistics, {
        count: 2,
        min: 1,
        max: 2,
        avg: 1.5
      });
    });
    
    it('should throw an error if tentacle is not registered', async () => {
      await assert.rejects(async () => {
        await tentacleMetrics.getTentacleMetrics('unknown-tentacle');
      }, /not registered/);
    });
    
    it('should throw an error if tentacleId is missing', async () => {
      await assert.rejects(async () => {
        await tentacleMetrics.getTentacleMetrics();
      }, /Tentacle ID is required/);
    });
  });
  
  describe('getTentacleRegistrySummary', () => {
    it('should return a summary of all registered tentacles', () => {
      // Register tentacles
      tentacleMetrics.registerTentacle('tentacle1', 'type1');
      tentacleMetrics.registerTentacle('tentacle2', 'type1');
      tentacleMetrics.registerTentacle('tentacle3', 'type2');
      
      // Record some metrics
      tentacleMetrics.recordTentacleMetric('tentacle1', 'operation.count', 1);
      tentacleMetrics.recordTentacleMetric('tentacle2', 'operation.count', 2);
      
      // Get summary
      const summary = tentacleMetrics.getTentacleRegistrySummary();
      
      // Check summary structure
      assert.strictEqual(summary.totalTentacles, 3);
      assert.strictEqual(summary.tentaclesByType.type1, 2);
      assert.strictEqual(summary.tentaclesByType.type2, 1);
      assert.ok(summary.tentacles.tentacle1);
      assert.ok(summary.tentacles.tentacle2);
      assert.ok(summary.tentacles.tentacle3);
      assert.strictEqual(summary.tentacles.tentacle1.type, 'type1');
      assert.strictEqual(summary.tentacles.tentacle2.type, 'type1');
      assert.strictEqual(summary.tentacles.tentacle3.type, 'type2');
      assert.strictEqual(summary.tentacles.tentacle1.metricCount, 1);
      assert.strictEqual(summary.tentacles.tentacle2.metricCount, 1);
      assert.strictEqual(summary.tentacles.tentacle3.metricCount, 0);
    });
  });
  
  describe('stop', () => {
    it('should clean up resources', async () => {
      await tentacleMetrics.stop();
      
      // No assertions needed, just checking that it doesn't throw
    });
  });
});
