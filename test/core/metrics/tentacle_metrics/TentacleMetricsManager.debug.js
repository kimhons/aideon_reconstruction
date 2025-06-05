/**
 * @fileoverview Debug version of tests for TentacleMetricsManager.
 * This module contains comprehensive tests for the TentacleMetricsManager class
 * with enhanced debug logging.
 * 
 * @module test/core/metrics/tentacle_metrics/TentacleMetricsManager.debug
 */

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');

// Update path to point to the correct location
const TentacleMetricsManager = require('../../../../src/core/metrics/tentacle_metrics/TentacleMetricsManager');
const MetricsCollector = require('../../../../src/core/metrics/MetricsCollector');

// Debug logging helper
function debugLog(message, obj) {
  console.log(`[DEBUG] ${message}`);
  if (obj !== undefined) {
    console.log(JSON.stringify(obj, null, 2));
  }
}

describe('TentacleMetricsManager Debug Tests', () => {
  let metricsCollector;
  let tentacleMetrics;
  let clock;
  
  beforeEach(() => {
    debugLog('Setting up test environment');
    
    // Use fake timers
    clock = sinon.useFakeTimers();
    debugLog('Fake timers initialized');
    
    // Create a mock metrics collector
    metricsCollector = {
      defineMetric: sinon.stub().returns(true),
      defineDimension: sinon.stub().returns(true),
      recordMetric: sinon.stub().returns(true),
      queryMetrics: sinon.stub().resolves([]),
      calculateStatistics: sinon.stub().returns({}),
      subscribeToMetrics: sinon.stub().returns(() => {})
    };
    debugLog('Mock metrics collector created');
    
    // Create tentacle metrics manager with mock collector
    tentacleMetrics = new TentacleMetricsManager({
      metricsCollector,
      autoRegisterTentacles: false, // Disable auto-registration for tests
      enableRealTimeAlerts: true
    });
    debugLog('TentacleMetricsManager instance created');
  });
  
  afterEach(() => {
    debugLog('Cleaning up test environment');
    
    // Restore timers
    clock.restore();
    debugLog('Fake timers restored');
    
    // Clean up
    if (tentacleMetrics) {
      tentacleMetrics.stop();
      debugLog('TentacleMetricsManager stopped');
    }
  });
  
  describe('recordTentacleMetric', () => {
    it('should update tentacle metrics registry with proper timestamp', () => {
      debugLog('Starting test: should update tentacle metrics registry');
      
      // Register tentacle
      tentacleMetrics.registerTentacle('test-tentacle', 'test');
      debugLog('Tentacle registered', tentacleMetrics.tentacleRegistry['test-tentacle']);
      
      // Record metric
      tentacleMetrics.recordTentacleMetric('test-tentacle', 'operation.count', 1);
      debugLog('Metric recorded');
      
      // Check registry state
      const registry = tentacleMetrics.tentacleRegistry;
      debugLog('Current registry state', registry);
      
      // Check metric info
      const metricInfo = registry['test-tentacle'].metrics['tentacle.operation.count'];
      debugLog('Metric info', metricInfo);
      
      // Assertions with detailed logging
      assert.strictEqual(metricInfo.count, 1, 'Metric count should be 1');
      assert.strictEqual(metricInfo.lastValue, 1, 'Last value should be 1');
      
      debugLog('Checking lastRecorded timestamp', {
        lastRecorded: metricInfo.lastRecorded,
        currentTime: Date.now(),
        isDefined: metricInfo.lastRecorded !== undefined,
        isTruthy: !!metricInfo.lastRecorded
      });
      
      assert.ok(metricInfo.lastRecorded, 'lastRecorded timestamp should be set');
    });
  });
  
  describe('startOperation and endOperation', () => {
    it('should track operation duration with detailed context logging', () => {
      debugLog('Starting test: should track operation duration');
      
      // Start operation
      const context = tentacleMetrics.startOperation('test-tentacle', 'test-op');
      debugLog('Operation started with context', context);
      
      // Advance time
      clock.tick(100);
      debugLog('Time advanced by 100ms, current time:', Date.now());
      
      // Log context before ending operation
      debugLog('Context before ending operation', {
        context,
        contextType: typeof context,
        hasProperties: {
          tentacleId: !!context.tentacleId,
          operationId: !!context.operationId,
          operationType: !!context.operationType,
          startTime: !!context.startTime,
          priority: !!context.priority
        }
      });
      
      // End operation
      try {
        const result = tentacleMetrics.endOperation(context);
        debugLog('Operation ended successfully with result', result);
        
        // Assertions
        assert.strictEqual(result.duration, 100, 'Duration should be 100ms');
        assert.strictEqual(result.status, 'success', 'Status should be success');
        assert.strictEqual(result.tentacleId, 'test-tentacle', 'Tentacle ID should match');
        assert.strictEqual(result.operationType, 'test-op', 'Operation type should match');
      } catch (error) {
        debugLog('Error ending operation', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
      
      // Check that metrics were recorded
      debugLog('Checking recordMetric calls', {
        callCount: metricsCollector.recordMetric.callCount,
        calls: metricsCollector.recordMetric.args.map(args => ({
          metricName: args[0],
          value: args[1],
          dimensions: args[2]
        }))
      });
      
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.count',
        1,
        sinon.match({ tentacle_id: 'test-tentacle', operation_type: 'test-op' })
      ), 'Should record operation count');
      
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.duration',
        100,
        sinon.match({ tentacle_id: 'test-tentacle', operation_type: 'test-op', status: 'success' })
      ), 'Should record operation duration');
    });
    
    it('should record errors for failed operations with detailed logging', () => {
      debugLog('Starting test: should record errors for failed operations');
      
      // Start operation
      const context = tentacleMetrics.startOperation('test-tentacle', 'test-op');
      debugLog('Operation started with context', context);
      
      // Log context before ending operation
      debugLog('Context before ending operation with failure', {
        context,
        contextType: typeof context,
        hasProperties: {
          tentacleId: !!context.tentacleId,
          operationId: !!context.operationId,
          operationType: !!context.operationType,
          startTime: !!context.startTime,
          priority: !!context.priority
        }
      });
      
      // End operation with failure
      try {
        const result = tentacleMetrics.endOperation(context, 'failure', { errorType: 'test-error' });
        debugLog('Operation ended with failure status', result);
      } catch (error) {
        debugLog('Error ending operation with failure', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
      
      // Check that error metric was recorded
      debugLog('Checking recordMetric calls for error', {
        callCount: metricsCollector.recordMetric.callCount,
        calls: metricsCollector.recordMetric.args.map(args => ({
          metricName: args[0],
          value: args[1],
          dimensions: args[2]
        }))
      });
      
      assert.ok(metricsCollector.recordMetric.calledWith(
        'tentacle.operation.error_count',
        1,
        sinon.match({
          tentacle_id: 'test-tentacle',
          operation_type: 'test-op',
          error_type: 'test-error'
        })
      ), 'Should record error count');
    });
    
    it('should update quality metrics with detailed logging', () => {
      debugLog('Starting test: should update quality metrics');
      
      // Start operation
      const context = tentacleMetrics.startOperation('test-tentacle', 'test-op');
      debugLog('Operation started with context', context);
      
      // Log context before ending operation
      debugLog('Context before ending operation for quality metrics', {
        context,
        contextType: typeof context,
        hasProperties: {
          tentacleId: !!context.tentacleId,
          operationId: !!context.operationId,
          operationType: !!context.operationType,
          startTime: !!context.startTime,
          priority: !!context.priority
        }
      });
      
      // End operation
      try {
        const result = tentacleMetrics.endOperation(context);
        debugLog('Operation ended successfully for quality metrics', result);
      } catch (error) {
        debugLog('Error ending operation for quality metrics', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
      
      // Check that updateQualityMetrics was called
      debugLog('Checking queryMetrics calls', {
        callCount: metricsCollector.queryMetrics.callCount,
        calls: metricsCollector.queryMetrics.args
      });
      
      assert.ok(metricsCollector.queryMetrics.called, 'Should call queryMetrics for quality metrics');
    });
  });
});
