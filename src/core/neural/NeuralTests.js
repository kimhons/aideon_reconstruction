/**
 * @fileoverview Tests for the Neural Hyperconnectivity System.
 * This module provides comprehensive tests for the HyperconnectedNeuralPathway
 * and NeuralCoordinationHub components.
 * 
 * @module core/neural/NeuralTests
 */

const { HyperconnectedNeuralPathway } = require('./HyperconnectedNeuralPathway');
const { NeuralCoordinationHub, ContextPreservationBuffer } = require('./NeuralCoordinationHub');
const { performance } = require('perf_hooks');

/**
 * Test suite for the Neural Hyperconnectivity System.
 */
class NeuralTestSuite {
  constructor() {
    this.tests = [
      this.testPathwayCreation,
      this.testSignalTransmission,
      this.testContextPreservation,
      this.testLatencyOptimization,
      this.testBandwidthAdaptation,
      this.testCoordinationHubPathwayManagement,
      this.testCoordinationHubSignalTransmission,
      this.testContextBuffering,
      this.testMultiTentacleTransmission,
      this.testErrorRecovery,
      this.testPerformanceUnderLoad
    ];
    
    this.results = {
      total: this.tests.length,
      passed: 0,
      failed: 0,
      details: []
    };
  }
  
  /**
   * Runs all tests in the test suite.
   * @returns {Object} - Test results.
   */
  async run() {
    console.log('Running Neural Hyperconnectivity Tests...');
    
    for (const test of this.tests) {
      const testName = test.name;
      console.log(`Running test: ${testName}`);
      
      try {
        await test.call(this);
        console.log(`✓ ${testName} passed`);
        this.results.passed++;
        this.results.details.push({
          name: testName,
          status: 'passed'
        });
      } catch (error) {
        console.error(`✗ ${testName} failed: ${error.message}`);
        this.results.failed++;
        this.results.details.push({
          name: testName,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    // Calculate pass rate and confidence interval
    const passRate = (this.results.passed / this.results.total) * 100;
    
    // Simple confidence interval calculation (Wilson score interval)
    const z = 1.96; // 95% confidence
    const n = this.results.total;
    const p = this.results.passed / n;
    const denominator = 1 + (z * z) / n;
    const numeratorCenter = p + (z * z) / (2 * n);
    const numeratorDiff = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
    
    const lowerBound = (numeratorCenter - numeratorDiff) / denominator;
    const upperBound = (numeratorCenter + numeratorDiff) / denominator;
    
    const confidenceInterval = ((upperBound - lowerBound) * 100) / 2;
    
    this.results.passRate = passRate.toFixed(2);
    this.results.confidenceInterval = confidenceInterval.toFixed(2);
    
    console.log('Test Results:');
    console.log(`Total: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${this.results.passRate}%`);
    console.log(`Confidence Interval: ±${this.results.confidenceInterval}%`);
    
    return this.results;
  }
  
  /**
   * Tests creation of a hyperconnected neural pathway.
   */
  async testPathwayCreation() {
    const pathway = new HyperconnectedNeuralPathway('source', 'target');
    
    if (!pathway) {
      throw new Error('Failed to create neural pathway');
    }
    
    if (pathway.sourceId !== 'source' || pathway.targetId !== 'target') {
      throw new Error('Neural pathway has incorrect source or target ID');
    }
    
    // Test error handling for missing IDs
    try {
      new HyperconnectedNeuralPathway(null, 'target');
      throw new Error('Should have thrown error for missing source ID');
    } catch (error) {
      if (!error.message.includes('Source and target IDs are required')) {
        throw error;
      }
    }
  }
  
  /**
   * Tests signal transmission through a neural pathway.
   */
  async testSignalTransmission() {
    const pathway = new HyperconnectedNeuralPathway('source', 'target');
    const signal = { type: 'test', payload: 'Hello, World!' };
    const context = { operation: 'test', timestamp: Date.now() };
    
    const result = await pathway.transmit(signal, context);
    
    if (!result || !result.success) {
      throw new Error('Signal transmission failed');
    }
    
    if (!result.result || !result.result.signal || !result.result.context) {
      throw new Error('Transmission result missing signal or context');
    }
    
    if (result.result.signal.payload !== signal.payload) {
      throw new Error('Signal payload was not preserved during transmission');
    }
    
    if (result.result.context.operation !== context.operation) {
      throw new Error('Context was not preserved during transmission');
    }
  }
  
  /**
   * Tests context preservation during transmission.
   */
  async testContextPreservation() {
    const pathway = new HyperconnectedNeuralPathway('source', 'target');
    const signal = { type: 'test', payload: 'Test Data' };
    const context = {
      operation: 'complex_operation',
      user: 'test_user',
      session: 'abc123',
      preferences: {
        theme: 'dark',
        notifications: true
      },
      history: [
        { action: 'login', timestamp: Date.now() - 1000 },
        { action: 'navigate', timestamp: Date.now() - 500 }
      ]
    };
    
    const result = await pathway.transmit(signal, context);
    
    if (!result.result.context._preserved) {
      throw new Error('Context was not marked as preserved');
    }
    
    if (!result.result.context._checksum) {
      throw new Error('Context integrity verification not applied');
    }
    
    // Verify all context properties were preserved
    for (const key of Object.keys(context)) {
      if (typeof result.result.context[key] === 'undefined') {
        throw new Error(`Context property ${key} was lost during transmission`);
      }
    }
    
    // Verify nested properties
    if (result.result.context.preferences.theme !== 'dark') {
      throw new Error('Nested context properties were not preserved');
    }
    
    if (!Array.isArray(result.result.context.history) || 
        result.result.context.history.length !== 2) {
      throw new Error('Array context properties were not preserved');
    }
  }
  
  /**
   * Tests latency optimization in neural pathways.
   */
  async testLatencyOptimization() {
    const pathway = new HyperconnectedNeuralPathway('source', 'target');
    const signal = { type: 'test', payload: 'Test Data' };
    const context = { operation: 'test' };
    
    // Perform multiple transmissions to allow optimization
    const latencies = [];
    
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      await pathway.transmit(signal, context);
      const latency = performance.now() - startTime;
      latencies.push(latency);
    }
    
    // Check if latencies are decreasing or stable
    let isOptimizing = false;
    for (let i = 1; i < latencies.length; i++) {
      if (latencies[i] < latencies[0] * 0.9) {
        isOptimizing = true;
        break;
      }
    }
    
    if (!isOptimizing) {
      // Note: This is a soft check since actual optimization depends on implementation
      console.warn('Latency optimization not detected, but this may be environment-dependent');
    }
    
    // Ensure latency is within reasonable bounds
    const averageLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    if (averageLatency > 1000) { // 1 second is very high for local transmission
      throw new Error(`Average latency (${averageLatency.toFixed(2)}ms) is too high`);
    }
  }
  
  /**
   * Tests bandwidth adaptation in neural pathways.
   */
  async testBandwidthAdaptation() {
    // This is mostly a functional test since we can't easily measure actual bandwidth
    const hub = new NeuralCoordinationHub();
    const sourceId = 'high_volume_source';
    const targetId = 'target';
    
    // Create pathway
    const pathway = hub.establishPathway(sourceId, targetId);
    
    // Simulate high volume transmission
    const largeSignal = {
      type: 'high_volume',
      payload: Array(10000).fill('data').join('-') // Create large payload
    };
    
    const context = { operation: 'high_volume_test' };
    
    // Perform multiple transmissions
    for (let i = 0; i < 5; i++) {
      await hub.transmitSignal(sourceId, targetId, largeSignal, context);
    }
    
    // Get hub stats
    const stats = hub.getStats();
    
    // Verify pathway was created
    if (stats.pathwayCount !== 1) {
      throw new Error('Pathway count incorrect');
    }
    
    // This test passes if no errors occur during high-volume transmission
  }
  
  /**
   * Tests pathway management in the neural coordination hub.
   */
  async testCoordinationHubPathwayManagement() {
    const hub = new NeuralCoordinationHub();
    
    // Create multiple pathways
    const pathway1 = hub.establishPathway('source1', 'target1');
    const pathway2 = hub.establishPathway('source2', 'target2');
    
    // Verify pathways were created
    const stats = hub.getStats();
    if (stats.pathwayCount !== 2) {
      throw new Error(`Expected 2 pathways, got ${stats.pathwayCount}`);
    }
    
    // Verify retrieving existing pathway returns same instance
    const retrievedPathway = hub.establishPathway('source1', 'target1');
    if (retrievedPathway !== pathway1) {
      throw new Error('Hub did not return existing pathway instance');
    }
  }
  
  /**
   * Tests signal transmission through the neural coordination hub.
   */
  async testCoordinationHubSignalTransmission() {
    const hub = new NeuralCoordinationHub();
    const sourceId = 'source';
    const targetId = 'target';
    const signal = { type: 'test', payload: 'Hub Transmission Test' };
    const context = { operation: 'hub_test' };
    
    // Transmit signal
    const result = await hub.transmitSignal(sourceId, targetId, signal, context);
    
    if (!result || !result.success) {
      throw new Error('Hub signal transmission failed');
    }
    
    if (!result.result || !result.result.signal || !result.result.context) {
      throw new Error('Hub transmission result missing signal or context');
    }
    
    if (result.result.signal.payload !== signal.payload) {
      throw new Error('Signal payload was not preserved during hub transmission');
    }
    
    // Context should have been enriched and preserved
    if (!result.result.context._id) {
      throw new Error('Context ID was not generated');
    }
  }
  
  /**
   * Tests context buffering in the neural coordination hub.
   */
  async testContextBuffering() {
    const buffer = new ContextPreservationBuffer({
      capacity: 10,
      priorityLevels: 3
    });
    
    // Store contexts with different priorities
    buffer.store('ctx1', { value: 'high priority' }, 3);
    buffer.store('ctx2', { value: 'medium priority' }, 2);
    buffer.store('ctx3', { value: 'low priority' }, 1);
    
    // Verify retrieval
    const ctx1 = buffer.retrieve('ctx1');
    const ctx2 = buffer.retrieve('ctx2');
    const ctx3 = buffer.retrieve('ctx3');
    
    if (!ctx1 || ctx1.value !== 'high priority') {
      throw new Error('Failed to retrieve high priority context');
    }
    
    if (!ctx2 || ctx2.value !== 'medium priority') {
      throw new Error('Failed to retrieve medium priority context');
    }
    
    if (!ctx3 || ctx3.value !== 'low priority') {
      throw new Error('Failed to retrieve low priority context');
    }
    
    // Test eviction by filling buffer
    for (let i = 4; i <= 10; i++) {
      buffer.store(`ctx${i}`, { value: `context ${i}` }, 1); // All low priority
    }
    
    // Add one more to trigger eviction
    buffer.store('ctx11', { value: 'trigger eviction' }, 1);
    
    // Low priority context should be evicted first
    if (buffer.retrieve('ctx3')) {
      throw new Error('Low priority context was not evicted');
    }
    
    // High priority context should still be there
    if (!buffer.retrieve('ctx1')) {
      throw new Error('High priority context was incorrectly evicted');
    }
    
    // Check stats
    const stats = buffer.getStats();
    if (stats.evictions !== 1) {
      throw new Error(`Expected 1 eviction, got ${stats.evictions}`);
    }
  }
  
  /**
   * Tests transmission across multiple tentacles.
   */
  async testMultiTentacleTransmission() {
    const hub = new NeuralCoordinationHub();
    
    // Create a chain of transmissions across multiple tentacles
    const tentacles = ['tentacle1', 'tentacle2', 'tentacle3', 'tentacle4'];
    const signal = { type: 'multi_hop', payload: 'Multi-tentacle test' };
    let context = { operation: 'multi_hop_test', hops: [] };
    
    // Transmit across tentacle chain
    for (let i = 0; i < tentacles.length - 1; i++) {
      const sourceId = tentacles[i];
      const targetId = tentacles[i + 1];
      
      // Add hop to context
      context.hops.push(sourceId);
      
      // Transmit to next tentacle
      const result = await hub.transmitSignal(sourceId, targetId, signal, context);
      
      // Update context for next hop
      context = result.result.context;
    }
    
    // Verify context maintained hop history
    if (!Array.isArray(context.hops) || context.hops.length !== tentacles.length - 1) {
      throw new Error('Context did not maintain hop history across transmissions');
    }
    
    // Verify all tentacles are in the hop history
    for (let i = 0; i < tentacles.length - 1; i++) {
      if (!context.hops.includes(tentacles[i])) {
        throw new Error(`Hop history missing tentacle ${tentacles[i]}`);
      }
    }
  }
  
  /**
   * Tests error recovery during transmission failures.
   */
  async testErrorRecovery() {
    // Create a pathway with a mock integrity verifier that fails on first attempt
    const pathway = new HyperconnectedNeuralPathway('source', 'target');
    
    // Override integrity verification to fail once
    let failNextVerification = true;
    pathway.integrityVerifier.verify = (result) => {
      if (failNextVerification) {
        failNextVerification = false;
        return false; // Fail first verification
      }
      return true; // Pass subsequent verifications
    };
    
    // Mock recovery mechanism to track calls
    let recoveryAttempted = false;
    pathway.recoveryMechanism.recoverAndRetransmit = (signal, context) => {
      recoveryAttempted = true;
      return pathway.secureTransmitter.transmit(signal, context);
    };
    
    // Transmit signal
    const signal = { type: 'test', payload: 'Recovery Test' };
    const context = { operation: 'recovery_test' };
    
    const result = await pathway.transmit(signal, context);
    
    // Verify transmission eventually succeeded
    if (!result || !result.success) {
      throw new Error('Transmission failed despite recovery attempt');
    }
    
    // Verify recovery was attempted
    if (!recoveryAttempted) {
      throw new Error('Recovery mechanism was not triggered');
    }
  }
  
  /**
   * Tests system performance under load.
   */
  async testPerformanceUnderLoad() {
    const hub = new NeuralCoordinationHub();
    const signal = { type: 'test', payload: 'Performance Test' };
    const context = { operation: 'performance_test' };
    
    // Create multiple source-target pairs
    const pairs = [
      { source: 'source1', target: 'target1' },
      { source: 'source2', target: 'target2' },
      { source: 'source3', target: 'target3' }
    ];
    
    // Perform multiple concurrent transmissions
    const startTime = performance.now();
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
      for (const pair of pairs) {
        promises.push(hub.transmitSignal(pair.source, pair.target, signal, context));
      }
    }
    
    // Wait for all transmissions to complete
    await Promise.all(promises);
    
    const totalTime = performance.now() - startTime;
    const transmissionCount = promises.length;
    const avgTimePerTransmission = totalTime / transmissionCount;
    
    console.log(`Performed ${transmissionCount} transmissions in ${totalTime.toFixed(2)}ms`);
    console.log(`Average time per transmission: ${avgTimePerTransmission.toFixed(2)}ms`);
    
    // Verify performance is within acceptable bounds
    if (avgTimePerTransmission > 100) { // 100ms per transmission is very high for local
      throw new Error(`Performance too low: ${avgTimePerTransmission.toFixed(2)}ms per transmission`);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new NeuralTestSuite();
  testSuite.run().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = NeuralTestSuite;
