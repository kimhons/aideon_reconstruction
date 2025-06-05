/**
 * @fileoverview Tests for the Tentacle Integration Layer adapters.
 * This module provides comprehensive tests for the TentacleAdapter classes
 * and their integration with the Neural Hyperconnectivity System.
 * 
 * @module core/neural/adapters/AdapterTests
 */

const { TentacleAdapter, DomainSpecificTentacleAdapter, TentacleAdapterFactory } = require('./TentacleAdapter');
const { NeuralCoordinationHub } = require('../NeuralCoordinationHub');
const { performance } = require('perf_hooks');

/**
 * Mock tentacle for testing adapters.
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
class AdapterTestSuite {
  constructor() {
    this.tests = [
      this.testAdapterCreation,
      this.testDomainSpecificAdapterCreation,
      this.testAdapterFactorySelection,
      this.testMessageSending,
      this.testMessageReceiving,
      this.testContextPreservation,
      this.testLegacyFallback,
      this.testDomainSpecificTransformations,
      this.testStatisticsTracking,
      this.testMultiTentacleIntegration
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
    console.log('Running Tentacle Adapter Tests...');
    
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
   * Tests basic adapter creation.
   */
  async testAdapterCreation() {
    const tentacle = new MockTentacle('test-tentacle');
    const hub = new NeuralCoordinationHub();
    
    const adapter = new TentacleAdapter(tentacle, hub);
    
    if (!adapter) {
      throw new Error('Failed to create adapter');
    }
    
    if (adapter.tentacleId !== 'test-tentacle') {
      throw new Error('Adapter has incorrect tentacle ID');
    }
    
    // Test error handling for missing tentacle
    try {
      new TentacleAdapter(null, hub);
      throw new Error('Should have thrown error for missing tentacle');
    } catch (error) {
      if (!error.message.includes('Tentacle instance with valid ID is required')) {
        throw error;
      }
    }
    
    // Test error handling for missing hub
    try {
      new TentacleAdapter(tentacle, null);
      throw new Error('Should have thrown error for missing hub');
    } catch (error) {
      if (!error.message.includes('Valid NeuralCoordinationHub instance is required')) {
        throw error;
      }
    }
  }
  
  /**
   * Tests domain-specific adapter creation.
   */
  async testDomainSpecificAdapterCreation() {
    const tentacle = new MockTentacle('domain-tentacle', { domain: 'finance' });
    const hub = new NeuralCoordinationHub();
    
    const adapter = new DomainSpecificTentacleAdapter(tentacle, hub, {
      domainType: 'finance',
      domainHandlers: {
        supportedProtocols: ['secure-finance']
      }
    });
    
    if (!adapter) {
      throw new Error('Failed to create domain-specific adapter');
    }
    
    if (adapter.domainType !== 'finance') {
      throw new Error('Domain-specific adapter has incorrect domain type');
    }
    
    // Test capabilities
    const capabilities = await adapter._getTentacleCapabilities();
    
    if (capabilities.domainType !== 'finance') {
      throw new Error('Domain type not included in capabilities');
    }
    
    if (!capabilities.domainSpecificProtocols.includes('secure-finance')) {
      throw new Error('Domain-specific protocols not included in capabilities');
    }
  }
  
  /**
   * Tests adapter factory selection.
   */
  async testAdapterFactorySelection() {
    const hub = new NeuralCoordinationHub();
    
    // Test standard tentacle
    const standardTentacle = new MockTentacle('standard-tentacle');
    const standardAdapter = TentacleAdapterFactory.createAdapter(standardTentacle, hub);
    
    if (!(standardAdapter instanceof TentacleAdapter)) {
      throw new Error('Factory did not create TentacleAdapter for standard tentacle');
    }
    
    // Test domain-specific tentacle
    const domainTentacle = new MockTentacle('domain-tentacle', { domain: 'healthcare' });
    const domainAdapter = TentacleAdapterFactory.createAdapter(domainTentacle, hub);
    
    if (!(domainAdapter instanceof DomainSpecificTentacleAdapter)) {
      throw new Error('Factory did not create DomainSpecificTentacleAdapter for domain tentacle');
    }
    
    if (domainAdapter.domainType !== 'healthcare') {
      throw new Error('Factory did not set correct domain type');
    }
  }
  
  /**
   * Tests message sending through adapter.
   */
  async testMessageSending() {
    const sourceTentacle = new MockTentacle('source-tentacle');
    const hub = new NeuralCoordinationHub();
    
    const adapter = new TentacleAdapter(sourceTentacle, hub);
    
    const message = {
      type: 'test',
      payload: { data: 'test data' },
      metadata: { session: 'test-session' }
    };
    
    const result = await adapter.send('target-tentacle', message, { priority: 3 });
    
    if (!result || !result.success) {
      throw new Error('Message sending failed');
    }
    
    if (!result.transmissionId) {
      throw new Error('No transmission ID returned');
    }
    
    if (!result.latency || typeof result.latency !== 'number') {
      throw new Error('No latency information returned');
    }
    
    // Check stats
    const stats = adapter.getStats();
    
    if (stats.messagesProcessed !== 1) {
      throw new Error('Message count not updated in stats');
    }
    
    if (stats.bytesSent <= 0) {
      throw new Error('Bytes sent not updated in stats');
    }
  }
  
  /**
   * Tests message receiving through adapter.
   */
  async testMessageReceiving() {
    const targetTentacle = new MockTentacle('target-tentacle');
    const hub = new NeuralCoordinationHub();
    
    const adapter = new TentacleAdapter(targetTentacle, hub);
    
    // Create mock transmission
    const transmission = {
      success: true,
      transmissionId: 'test-transmission',
      result: {
        signal: {
          type: 'test',
          payload: { data: 'received data' },
          metadata: { original: true },
          timestamp: Date.now()
        },
        context: {
          sourceTentacleId: 'source-tentacle',
          _id: 'context-123'
        }
      }
    };
    
    const message = adapter.receive(transmission);
    
    if (!message) {
      throw new Error('Message receiving failed');
    }
    
    if (message.payload.data !== 'received data') {
      throw new Error('Message payload not preserved');
    }
    
    if (!message.metadata.neuralEnhanced) {
      throw new Error('Neural enhancement flag not added');
    }
    
    if (message.metadata.contextId !== 'context-123') {
      throw new Error('Context ID not preserved');
    }
    
    // Check stats
    const stats = adapter.getStats();
    
    if (stats.messagesProcessed !== 1) {
      throw new Error('Message count not updated in stats');
    }
    
    if (stats.bytesReceived <= 0) {
      throw new Error('Bytes received not updated in stats');
    }
  }
  
  /**
   * Tests context preservation across messages.
   */
  async testContextPreservation() {
    const sourceTentacle = new MockTentacle('source-tentacle');
    const hub = new NeuralCoordinationHub();
    
    const adapter = new TentacleAdapter(sourceTentacle, hub);
    
    // Send first message
    const firstMessage = {
      type: 'first',
      payload: { step: 1 }
    };
    
    const firstResult = await adapter.send('target-tentacle', firstMessage, { operation: 'multi-step' });
    
    // Extract context ID from first transmission
    const firstTransmissionId = firstResult.transmissionId;
    
    // Create mock received message with context ID
    const mockReceivedMessage = {
      type: 'response',
      payload: { acknowledged: true },
      metadata: {
        contextId: 'context-xyz', // This would come from the actual transmission
        transmissionId: firstTransmissionId
      }
    };
    
    // Send second message with context reference
    const secondMessage = {
      type: 'second',
      payload: { step: 2 },
      metadata: {
        contextId: mockReceivedMessage.metadata.contextId // Reference previous context
      }
    };
    
    const secondResult = await adapter.send('target-tentacle', secondMessage, { operation: 'multi-step' });
    
    // Verify pathway cache is working
    const stats = adapter.getStats();
    if (stats.pathwayCacheSize !== 1) {
      throw new Error('Pathway not cached properly');
    }
    
    // This test passes if no errors occur during the context-aware transmission
  }
  
  /**
   * Tests legacy fallback mechanism.
   */
  async testLegacyFallback() {
    const tentacle = new MockTentacle('fallback-tentacle');
    const hub = new NeuralCoordinationHub();
    
    // Create adapter with intentionally broken hub to force fallback
    const brokenHub = {
      establishPathway: () => {
        throw new Error('Simulated hub failure');
      }
    };
    
    const adapter = new TentacleAdapter(tentacle, brokenHub, {
      enableLegacyFallback: true
    });
    
    // Override hub with broken one
    adapter.hub = brokenHub;
    
    const message = {
      type: 'fallback-test',
      payload: { data: 'fallback data' }
    };
    
    // This should trigger fallback
    const result = await adapter.send('target-tentacle', message);
    
    // Verify fallback was used
    if (!result.legacy) {
      throw new Error('Legacy fallback not triggered');
    }
    
    // Verify message was logged in original tentacle
    if (tentacle.messageLog.length !== 1) {
      throw new Error('Message not logged in original tentacle');
    }
    
    const loggedMessage = tentacle.messageLog[0];
    if (loggedMessage.message.payload.data !== 'fallback data') {
      throw new Error('Incorrect message logged in fallback');
    }
    
    // Test with fallback disabled
    const noFallbackAdapter = new TentacleAdapter(tentacle, brokenHub, {
      enableLegacyFallback: false
    });
    
    try {
      await noFallbackAdapter.send('target-tentacle', message);
      throw new Error('Should have thrown error with fallback disabled');
    } catch (error) {
      if (!error.message.includes('Simulated hub failure')) {
        throw error;
      }
    }
  }
  
  /**
   * Tests domain-specific transformations.
   */
  async testDomainSpecificTransformations() {
    const tentacle = new MockTentacle('domain-tentacle', { domain: 'analytics' });
    const hub = new NeuralCoordinationHub();
    
    // Create handlers that transform messages
    const domainHandlers = {
      transformOutgoing: (message) => {
        return {
          ...message,
          payload: {
            ...message.payload,
            enhanced: true,
            domain: 'analytics'
          }
        };
      },
      transformIncoming: (message) => {
        return {
          ...message,
          metadata: {
            ...message.metadata,
            processedByAnalytics: true
          }
        };
      },
      supportedProtocols: ['analytics-v1']
    };
    
    const adapter = new DomainSpecificTentacleAdapter(tentacle, hub, {
      domainType: 'analytics',
      domainHandlers
    });
    
    // Test outgoing transformation
    const message = {
      type: 'data-request',
      payload: { query: 'user-behavior' }
    };
    
    const result = await adapter.send('target-tentacle', message);
    
    // Test incoming transformation
    const transmission = {
      success: true,
      transmissionId: 'test-transmission',
      result: {
        signal: {
          type: 'response',
          payload: { results: [1, 2, 3] },
          timestamp: Date.now()
        },
        context: {
          sourceTentacleId: 'source-tentacle'
        }
      }
    };
    
    const receivedMessage = adapter.receive(transmission);
    
    if (!receivedMessage.metadata.processedByAnalytics) {
      throw new Error('Incoming transformation not applied');
    }
  }
  
  /**
   * Tests statistics tracking.
   */
  async testStatisticsTracking() {
    const tentacle = new MockTentacle('stats-tentacle');
    const hub = new NeuralCoordinationHub();
    
    const adapter = new TentacleAdapter(tentacle, hub);
    
    // Send multiple messages
    for (let i = 0; i < 5; i++) {
      await adapter.send('target-tentacle', {
        type: 'stats-test',
        payload: { index: i, data: 'x'.repeat(100 * i) } // Increasing size
      });
    }
    
    // Receive a message
    adapter.receive({
      success: true,
      transmissionId: 'test-transmission',
      result: {
        signal: {
          type: 'response',
          payload: { status: 'ok' },
          timestamp: Date.now()
        },
        context: {
          sourceTentacleId: 'source-tentacle'
        }
      }
    });
    
    // Check stats
    const stats = adapter.getStats();
    
    if (stats.messagesProcessed !== 6) { // 5 sent + 1 received
      throw new Error(`Expected 6 messages processed, got ${stats.messagesProcessed}`);
    }
    
    if (stats.bytesSent <= 0) {
      throw new Error('Bytes sent not tracked');
    }
    
    if (stats.bytesReceived <= 0) {
      throw new Error('Bytes received not tracked');
    }
    
    if (stats.averageLatency <= 0) {
      throw new Error('Average latency not tracked');
    }
    
    if (stats.pathwayCacheSize !== 1) {
      throw new Error('Pathway cache size not tracked');
    }
  }
  
  /**
   * Tests integration with multiple tentacles.
   */
  async testMultiTentacleIntegration() {
    const hub = new NeuralCoordinationHub();
    
    // Create multiple tentacles and adapters
    const tentacles = [];
    const adapters = [];
    
    for (let i = 1; i <= 3; i++) {
      const tentacle = new MockTentacle(`tentacle-${i}`);
      const adapter = new TentacleAdapter(tentacle, hub);
      
      tentacles.push(tentacle);
      adapters.push(adapter);
    }
    
    // Send messages between all tentacles
    for (let i = 0; i < adapters.length; i++) {
      for (let j = 0; j < adapters.length; j++) {
        if (i !== j) {
          await adapters[i].send(`tentacle-${j+1}`, {
            type: 'multi-test',
            payload: { from: i, to: j, data: `Message from ${i} to ${j}` }
          });
        }
      }
    }
    
    // Check pathway cache for each adapter
    for (const adapter of adapters) {
      const stats = adapter.getStats();
      
      // Each adapter should have pathways to the other two tentacles
      if (stats.pathwayCacheSize !== 2) {
        throw new Error(`Expected 2 pathways in cache, got ${stats.pathwayCacheSize}`);
      }
    }
    
    // This test passes if no errors occur during multi-tentacle communication
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new AdapterTestSuite();
  testSuite.run().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = AdapterTestSuite;
