/**
 * @fileoverview Integration tests for the Tentacle Integration Layer.
 * This module provides comprehensive tests for the TentacleIntegrationLayer
 * and its interaction with the Neural Hyperconnectivity System.
 * 
 * @module core/neural/adapters/IntegrationTests
 */

const { TentacleIntegrationLayer } = require('./TentacleIntegrationLayer');
const { NeuralCoordinationHub } = require('../NeuralCoordinationHub');
const { performance } = require('perf_hooks');

/**
 * Mock tentacle for testing integration.
 */
class MockTentacle {
  constructor(id, options = {}) {
    this.id = id;
    this.domain = options.domain;
    this.messageLog = [];
    this.receivedMessages = [];
  }
  
  send(targetId, message, options) {
    this.messageLog.push({
      direction: 'outgoing',
      targetId,
      message,
      options,
      timestamp: Date.now()
    });
    return { success: true, legacy: true };
  }
  
  receive(message) {
    this.receivedMessages.push(message);
    return { acknowledged: true };
  }
}

/**
 * Test suite for the Tentacle Integration Layer.
 */
class IntegrationTestSuite {
  constructor() {
    this.tests = [
      this.testLayerInitialization,
      this.testTentacleRegistration,
      this.testMultipleTentacleRegistration,
      this.testDomainRegistry,
      this.testMessageSending,
      this.testDomainBroadcast,
      this.testCommunicationChain,
      this.testStatisticsTracking,
      this.testTentacleUnregistration,
      this.testErrorHandling
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
    console.log('Running Tentacle Integration Layer Tests...');
    
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
   * Tests initialization of the integration layer.
   */
  async testLayerInitialization() {
    const hub = new NeuralCoordinationHub();
    
    const layer = new TentacleIntegrationLayer(hub);
    
    if (!layer) {
      throw new Error('Failed to create integration layer');
    }
    
    // Test error handling for missing hub
    try {
      new TentacleIntegrationLayer(null);
      throw new Error('Should have thrown error for missing hub');
    } catch (error) {
      if (!error.message.includes('Valid NeuralCoordinationHub instance is required')) {
        throw error;
      }
    }
    
    // Test initialization with options
    const layerWithOptions = new TentacleIntegrationLayer(hub, {
      autoRegisterTentacles: false,
      enableLegacyFallback: false
    });
    
    if (layerWithOptions.options.autoRegisterTentacles !== false) {
      throw new Error('Options not properly applied');
    }
  }
  
  /**
   * Tests tentacle registration.
   */
  async testTentacleRegistration() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    const tentacle = new MockTentacle('test-tentacle');
    
    const adapter = layer.registerTentacle(tentacle);
    
    if (!adapter) {
      throw new Error('Failed to register tentacle');
    }
    
    // Test retrieval
    const retrievedAdapter = layer.getAdapter('test-tentacle');
    
    if (!retrievedAdapter) {
      throw new Error('Failed to retrieve adapter');
    }
    
    if (retrievedAdapter !== adapter) {
      throw new Error('Retrieved adapter is not the same instance');
    }
    
    // Test error handling for missing tentacle
    try {
      layer.registerTentacle(null);
      throw new Error('Should have thrown error for missing tentacle');
    } catch (error) {
      if (!error.message.includes('Tentacle instance with valid ID is required')) {
        throw error;
      }
    }
    
    // Test re-registration returns same adapter
    const reregisteredAdapter = layer.registerTentacle(tentacle);
    
    if (reregisteredAdapter !== adapter) {
      throw new Error('Re-registration did not return same adapter');
    }
  }
  
  /**
   * Tests registration of multiple tentacles.
   */
  async testMultipleTentacleRegistration() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    const tentacles = [
      new MockTentacle('tentacle1'),
      new MockTentacle('tentacle2'),
      new MockTentacle('tentacle3')
    ];
    
    const adapters = layer.registerMultipleTentacles(tentacles);
    
    if (!Array.isArray(adapters)) {
      throw new Error('registerMultipleTentacles did not return array');
    }
    
    if (adapters.length !== 3) {
      throw new Error(`Expected 3 adapters, got ${adapters.length}`);
    }
    
    // Test error handling for non-array input
    try {
      layer.registerMultipleTentacles('not-an-array');
      throw new Error('Should have thrown error for non-array input');
    } catch (error) {
      if (!error.message.includes('Expected array of tentacles')) {
        throw error;
      }
    }
    
    // Test stats
    const stats = layer.getStats();
    
    if (stats.registeredTentacles !== 3) {
      throw new Error(`Expected 3 registered tentacles, got ${stats.registeredTentacles}`);
    }
    
    if (stats.activeAdapters !== 3) {
      throw new Error(`Expected 3 active adapters, got ${stats.activeAdapters}`);
    }
  }
  
  /**
   * Tests domain registry functionality.
   */
  async testDomainRegistry() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Register tentacles with different domains
    const financeTentacle1 = new MockTentacle('finance1', { domain: 'finance' });
    const financeTentacle2 = new MockTentacle('finance2', { domain: 'finance' });
    const healthTentacle = new MockTentacle('health1', { domain: 'healthcare' });
    
    layer.registerTentacle(financeTentacle1);
    layer.registerTentacle(financeTentacle2);
    layer.registerTentacle(healthTentacle);
    
    // Test domain retrieval
    const financeTentacles = layer.getTentaclesByDomain('finance');
    
    if (!Array.isArray(financeTentacles)) {
      throw new Error('getTentaclesByDomain did not return array');
    }
    
    if (financeTentacles.length !== 2) {
      throw new Error(`Expected 2 finance tentacles, got ${financeTentacles.length}`);
    }
    
    if (!financeTentacles.includes('finance1') || !financeTentacles.includes('finance2')) {
      throw new Error('Finance tentacles not correctly registered in domain');
    }
    
    // Test non-existent domain
    const nonExistentDomain = layer.getTentaclesByDomain('non-existent');
    
    if (!Array.isArray(nonExistentDomain) || nonExistentDomain.length !== 0) {
      throw new Error('Non-existent domain should return empty array');
    }
    
    // Test stats
    const stats = layer.getStats();
    
    if (stats.registeredDomains !== 2) {
      throw new Error(`Expected 2 registered domains, got ${stats.registeredDomains}`);
    }
  }
  
  /**
   * Tests message sending between tentacles.
   */
  async testMessageSending() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Register tentacles
    const sourceTentacle = new MockTentacle('source');
    const targetTentacle = new MockTentacle('target');
    
    layer.registerTentacle(sourceTentacle);
    layer.registerTentacle(targetTentacle);
    
    // Send message
    const message = {
      type: 'test',
      payload: { data: 'test data' }
    };
    
    const result = await layer.sendMessage('source', 'target', message);
    
    if (!result || !result.success) {
      throw new Error('Message sending failed');
    }
    
    // Test error handling for non-registered source
    try {
      await layer.sendMessage('non-existent', 'target', message);
      throw new Error('Should have thrown error for non-registered source');
    } catch (error) {
      if (!error.message.includes('Source tentacle non-existent not registered')) {
        throw error;
      }
    }
    
    // Test stats
    const stats = layer.getStats();
    
    if (stats.totalMessagesProcessed !== 1) {
      throw new Error(`Expected 1 message processed, got ${stats.totalMessagesProcessed}`);
    }
    
    if (stats.totalBytesSent <= 0) {
      throw new Error('Bytes sent not tracked');
    }
  }
  
  /**
   * Tests broadcasting to a domain.
   */
  async testDomainBroadcast() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Register tentacles with domains
    const sourceTentacle = new MockTentacle('source', { domain: 'source-domain' });
    const targetTentacle1 = new MockTentacle('target1', { domain: 'target-domain' });
    const targetTentacle2 = new MockTentacle('target2', { domain: 'target-domain' });
    
    layer.registerTentacle(sourceTentacle);
    layer.registerTentacle(targetTentacle1);
    layer.registerTentacle(targetTentacle2);
    
    // Broadcast message
    const message = {
      type: 'broadcast',
      payload: { data: 'broadcast data' }
    };
    
    const results = await layer.broadcastToDomain('source', 'target-domain', message);
    
    if (!Array.isArray(results)) {
      throw new Error('broadcastToDomain did not return array');
    }
    
    if (results.length !== 2) {
      throw new Error(`Expected 2 broadcast results, got ${results.length}`);
    }
    
    // Verify all broadcasts succeeded
    for (const result of results) {
      if (!result.success) {
        throw new Error(`Broadcast to ${result.targetId} failed`);
      }
    }
    
    // Test broadcast to non-existent domain
    const emptyResults = await layer.broadcastToDomain('source', 'non-existent', message);
    
    if (!Array.isArray(emptyResults) || emptyResults.length !== 0) {
      throw new Error('Broadcast to non-existent domain should return empty array');
    }
  }
  
  /**
   * Tests communication chain across multiple tentacles.
   */
  async testCommunicationChain() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Register tentacles
    const tentacles = [
      new MockTentacle('chain1'),
      new MockTentacle('chain2'),
      new MockTentacle('chain3'),
      new MockTentacle('chain4')
    ];
    
    layer.registerMultipleTentacles(tentacles);
    
    // Create chain
    const chain = ['chain1', 'chain2', 'chain3', 'chain4'];
    const initialMessage = {
      type: 'chain-start',
      payload: { data: 'chain data' }
    };
    
    const result = await layer.createCommunicationChain(chain, initialMessage);
    
    if (!result || !result.success) {
      throw new Error('Communication chain failed');
    }
    
    if (!result.chainCompleted) {
      throw new Error('Chain not marked as completed');
    }
    
    if (result.finalTargetId !== 'chain4') {
      throw new Error(`Expected final target to be chain4, got ${result.finalTargetId}`);
    }
    
    // Test error handling for invalid chain
    try {
      await layer.createCommunicationChain(['single'], initialMessage);
      throw new Error('Should have thrown error for invalid chain');
    } catch (error) {
      if (!error.message.includes('Tentacle chain must be an array with at least 2 tentacles')) {
        throw error;
      }
    }
  }
  
  /**
   * Tests statistics tracking.
   */
  async testStatisticsTracking() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Register tentacles
    const sourceTentacle = new MockTentacle('stats-source');
    const targetTentacle = new MockTentacle('stats-target');
    
    layer.registerTentacle(sourceTentacle);
    layer.registerTentacle(targetTentacle);
    
    // Send multiple messages
    for (let i = 0; i < 5; i++) {
      await layer.sendMessage('stats-source', 'stats-target', {
        type: 'stats-test',
        payload: { index: i, data: 'x'.repeat(100 * i) } // Increasing size
      });
    }
    
    // Check stats
    const stats = layer.getStats();
    
    if (stats.totalMessagesProcessed !== 5) {
      throw new Error(`Expected 5 messages processed, got ${stats.totalMessagesProcessed}`);
    }
    
    if (stats.totalBytesSent <= 0) {
      throw new Error('Bytes sent not tracked');
    }
    
    if (stats.averageLatency <= 0) {
      throw new Error('Average latency not tracked');
    }
    
    // Verify hub stats are included
    if (!stats.hubStats) {
      throw new Error('Hub stats not included');
    }
  }
  
  /**
   * Tests tentacle unregistration.
   */
  async testTentacleUnregistration() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Register tentacles
    const tentacle1 = new MockTentacle('unregister1', { domain: 'test-domain' });
    const tentacle2 = new MockTentacle('unregister2', { domain: 'test-domain' });
    
    layer.registerTentacle(tentacle1);
    layer.registerTentacle(tentacle2);
    
    // Verify domain registration
    const domainTentacles = layer.getTentaclesByDomain('test-domain');
    if (domainTentacles.length !== 2) {
      throw new Error(`Expected 2 tentacles in domain, got ${domainTentacles.length}`);
    }
    
    // Unregister one tentacle
    const unregistered = layer.unregisterTentacle('unregister1');
    
    if (!unregistered) {
      throw new Error('Unregistration failed');
    }
    
    // Verify adapter is removed
    const adapter = layer.getAdapter('unregister1');
    if (adapter) {
      throw new Error('Adapter still exists after unregistration');
    }
    
    // Verify domain is updated
    const updatedDomainTentacles = layer.getTentaclesByDomain('test-domain');
    if (updatedDomainTentacles.length !== 1) {
      throw new Error(`Expected 1 tentacle in domain after unregistration, got ${updatedDomainTentacles.length}`);
    }
    
    // Verify stats are updated
    const stats = layer.getStats();
    if (stats.activeAdapters !== 1) {
      throw new Error(`Expected 1 active adapter after unregistration, got ${stats.activeAdapters}`);
    }
    
    // Test unregistering non-existent tentacle
    const nonExistentUnregistered = layer.unregisterTentacle('non-existent');
    if (nonExistentUnregistered) {
      throw new Error('Unregistering non-existent tentacle should return false');
    }
    
    // Unregister last tentacle in domain
    layer.unregisterTentacle('unregister2');
    
    // Verify domain is removed
    const emptyDomainTentacles = layer.getTentaclesByDomain('test-domain');
    if (emptyDomainTentacles.length !== 0) {
      throw new Error('Domain not removed after all tentacles unregistered');
    }
  }
  
  /**
   * Tests error handling.
   */
  async testErrorHandling() {
    const hub = new NeuralCoordinationHub();
    const layer = new TentacleIntegrationLayer(hub);
    
    // Reset error count to ensure clean test state
    layer.stats.errors = 0;
    
    // Register tentacle
    const tentacle = new MockTentacle('error-test');
    layer.registerTentacle(tentacle);
    
    // Reset error count after registration to isolate our test
    layer.stats.errors = 0;
    
    // Force an error by trying to process a message for a non-existent tentacle
    try {
      layer.processIncomingMessage('non-existent', {});
    } catch (error) {
      // Expected error, continue with test
    }
    
    // Verify error is counted in stats
    const stats = layer.getStats();
    if (stats.errors !== 2) { // 1 from the check + 1 from the throw
      throw new Error(`Expected 2 errors in stats, got ${stats.errors}`);
    }
  }
}

// Export the test suite
module.exports = {
  IntegrationTestSuite
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new IntegrationTestSuite();
  testSuite.run()
    .then(results => {
      console.log('Integration tests completed');
      console.log(`Pass rate: ${results.passRate}%`);
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Error running tests:', error);
      process.exit(1);
    });
}
