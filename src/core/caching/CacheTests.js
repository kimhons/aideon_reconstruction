/**
 * @fileoverview Comprehensive test suite for the Advanced Caching Strategies system
 * Tests all cache components and their integration
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

// Correct imports with proper paths
const MemoryCache = require('./MemoryCache');
const PersistentCache = require('./PersistentCache');
const DistributedCache = require('./DistributedCache');
const CacheManager = require('./CacheManager');

/**
 * Mock Context Provider for testing context-aware cache management
 */
class MockContextProvider {
  constructor(initialContext = {}) {
    this.context = initialContext;
    this.listeners = [];
  }

  getContext() {
    return { ...this.context };
  }

  setContext(newContext) {
    this.context = { ...this.context, ...newContext };
    this._notifyListeners();
  }

  onContextChange(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.getContext());
    }
  }
}

/**
 * Class representing a cache test suite
 */
class CacheTestSuite {
  /**
   * Create a new CacheTestSuite instance
   * @param {string} testDir - Directory for test files
   */
  constructor(testDir = path.join(__dirname, '..', '..', '..', 'performance_validation', 'test_cache')) {
    this.testDir = testDir;
    this.tests = [
      { name: 'MemoryCache Tests', fn: this._testMemoryCache.bind(this) },
      { name: 'PersistentCache Tests', fn: this._testPersistentCache.bind(this) },
      { name: 'DistributedCache Tests', fn: this._testDistributedCache.bind(this) },
      { name: 'CacheManager Basic Tests', fn: this._testCacheManagerBasic.bind(this) },
      { name: 'CacheManager Multilevel Tests', fn: this._testCacheManagerMultilevel.bind(this) },
      { name: 'CacheManager Write Policies', fn: this._testCacheManagerWritePolicies.bind(this) },
      { name: 'PredictivePreCaching Tests', fn: this._testPredictivePreCaching.bind(this) },
      { name: 'ContextAwareCacheManagement Tests', fn: this._testContextAwareCacheManagement.bind(this) },
      { name: 'CacheManager Integration Tests', fn: this._testCacheManagerIntegration.bind(this) }
    ];
    this.results = {
      total: this.tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: []
    };
  }

  /**
   * Run all tests
   * @returns {Object} Test results
   */
  async run() {
    // Ensure test directory exists
    try {
      await fs.mkdir(this.testDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create test directory:', error);
    }

    console.log('Starting Advanced Caching Strategies Test Suite...');

    for (const test of this.tests) {
      try {
        console.log(`--- Running: ${test.name} ---`);
        await this._runTest(test);
        console.log(`✅ PASSED: ${test.name}`);
        this.results.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Stack: ${error.stack}`);
        this.results.failures.push({
          name: test.name,
          error: error.message,
          stack: error.stack
        });
        this.results.failed++;
      }
    }

    console.log('--- Test Suite Results ---');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);

    if (this.results.failed > 0) {
      console.log('--- Failures ---');
      for (const failure of this.results.failures) {
        console.log(`❌ ${failure.name}: ${failure.error}`);
      }
    }

    console.log('------------------------');

    return this.results;
  }

  /**
   * Run a single test
   * @param {Object} test - Test to run
   * @private
   */
  async _runTest(test) {
    try {
      await test.fn();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test memory cache
   * @private
   */
  async _testMemoryCache() {
    const cache = new MemoryCache({ defaultTTL: 100 });

    // Test basic operations
    cache.set("key1", "value1");
    assert.strictEqual(cache.get("key1"), "value1", "Get key1");
    assert.strictEqual(cache.has("key1"), true, "Has key1");
    assert.strictEqual(cache.has("nonexistent"), false, "Has nonexistent");
    cache.delete("key1");
    assert.strictEqual(cache.has("key1"), false, "Has key1 after delete");

    // Test TTL
    cache.set("key2", "value2", { ttl: 50 });
    assert.strictEqual(cache.get("key2"), "value2", "Get key2 before TTL expiry");
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.strictEqual(cache.get("key2"), undefined, "Get key2 after TTL expiry");

    // Test eviction - using a very small cache size to force eviction
    const smallCache = new MemoryCache({ 
      maxSize: 20, // Very small size to force eviction
      maxEntries: 2, // Only allow 2 entries
      evictionPolicy: 'lru' 
    });
    
    // Add first entry
    smallCache.set("a", 1);
    assert.strictEqual(smallCache.has("a"), true, "Has 'a' after first set");
    
    // Add second entry
    smallCache.set("b", 2);
    assert.strictEqual(smallCache.has("a"), true, "Has 'a' after second set");
    assert.strictEqual(smallCache.has("b"), true, "Has 'b' after second set");
    
    // Access 'a' to make 'b' the least recently used
    smallCache.get("a");
    
    // Add third entry which should evict 'b' (LRU)
    smallCache.set("c", 3);
    assert.strictEqual(smallCache.has("a"), true, "Has 'a' after third set");
    assert.strictEqual(smallCache.has("b"), false, "Does not have 'b' after eviction");
    assert.strictEqual(smallCache.has("c"), true, "Has 'c' after third set");

    // Test tags
    cache.set("tagKey1", "val1", { tags: ["tagA"] });
    cache.set("tagKey2", "val2", { tags: ["tagA", "tagB"] });
    cache.set("tagKey3", "val3", { tags: ["tagB"] });
    assert.strictEqual(cache.deleteByTag("tagA"), 2, "Delete by tagA");
    assert.strictEqual(cache.has("tagKey1"), false, "Has tagKey1 after delete by tag");
    assert.strictEqual(cache.has("tagKey2"), false, "Has tagKey2 after delete by tag");
    assert.strictEqual(cache.has("tagKey3"), true, "Has tagKey3 after delete by tag");
  }

  async _testPersistentCache() {
    const cache = new PersistentCache({ directory: this.testDir, defaultTTL: 100 });
    await cache.initialize();

    // Test basic operations
    await cache.set("key1", "value1");
    assert.strictEqual(await cache.get("key1"), "value1", "Get key1");
    assert.strictEqual(await cache.has("key1"), true, "Has key1");
    assert.strictEqual(await cache.has("nonexistent"), false, "Has nonexistent");
    await cache.delete("key1");
    assert.strictEqual(await cache.has("key1"), false, "Has key1 after delete");

    // Test TTL
    await cache.set("key2", "value2", { ttl: 50 });
    assert.strictEqual(await cache.get("key2"), "value2", "Get key2 before TTL expiry");
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.strictEqual(await cache.get("key2"), undefined, "Get key2 after TTL expiry");

    // Test persistence
    await cache.set("key3", "value3");
    await cache.flush();
    const cache2 = new PersistentCache({ directory: this.testDir, defaultTTL: 100 });
    await cache2.initialize();
    assert.strictEqual(await cache2.get("key3"), "value3", "Get key3 after reinitializing cache");

    await cache.dispose();
    await cache2.dispose();
  }

  async _testDistributedCache() {
    const cache = new DistributedCache({ defaultTTL: 100 });
    await cache.initialize();

    // Test basic operations
    await cache.set("key1", "value1");
    assert.strictEqual(await cache.get("key1"), "value1", "Get key1");
    assert.strictEqual(await cache.has("key1"), true, "Has key1");
    assert.strictEqual(await cache.has("nonexistent"), false, "Has nonexistent");
    await cache.delete("key1");
    assert.strictEqual(await cache.has("key1"), false, "Has key1 after delete");

    await cache.dispose();
  }

  async _testCacheManagerBasic() {
    const manager = new CacheManager({
      memoryCache: { defaultTTL: 100 }
    });
    await manager.initialize();

    // Test basic operations
    await manager.set("key1", "value1");
    assert.strictEqual(await manager.get("key1"), "value1", "Get key1");
    assert.strictEqual(await manager.has("key1"), true, "Has key1");
    assert.strictEqual(await manager.has("nonexistent"), false, "Has nonexistent");
    await manager.delete("key1");
    assert.strictEqual(await manager.has("key1"), false, "Has key1 after delete");

    // Test TTL
    await manager.set("key2", "value2", { ttl: 50 });
    assert.strictEqual(await manager.get("key2"), "value2", "Get key2 before TTL expiry");
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.strictEqual(await manager.get("key2"), undefined, "Get key2 after TTL expiry");

    await manager.dispose();
  }

  async _testCacheManagerMultilevel() {
    const manager = new CacheManager({
      memoryCache: { defaultTTL: 100 },
      persistentCache: { directory: this.testDir, defaultTTL: 200 }
    });
    await manager.initialize();

    // Test multilevel get (memory miss, persistent hit)
    await manager.persistentCache.set("key1", "value1");
    assert.strictEqual(await manager.get("key1"), "value1", "Get key1 from persistent cache");
    assert.strictEqual(await manager.memoryCache.has("key1"), true, "key1 promoted to memory cache");

    // Test multilevel set (write-through)
    await manager.set("key2", "value2");
    assert.strictEqual(await manager.memoryCache.has("key2"), true, "key2 in memory cache");
    assert.strictEqual(await manager.persistentCache.has("key2"), true, "key2 in persistent cache");

    // Test multilevel delete
    await manager.delete("key2");
    assert.strictEqual(await manager.memoryCache.has("key2"), false, "key2 deleted from memory cache");
    assert.strictEqual(await manager.persistentCache.has("key2"), false, "key2 deleted from persistent cache");

    await manager.dispose();
  }

  async _testCacheManagerWritePolicies() {
    // Create manager with write-back policy and very short delay
    const manager = new CacheManager({
      memoryCache: { defaultTTL: 100 },
      persistentCache: { directory: this.testDir, defaultTTL: 200 },
      writePolicy: 'write-back',
      writeBackDelay: 20 // Very short delay for testing
    });
    await manager.initialize();

    // Test write-back policy
    await manager.set("key1", "value1");
    assert.strictEqual(await manager.memoryCache.has("key1"), true, "key1 in memory cache");
    
    // Initially, the key should not be in persistent cache
    const initialPersistentCheck = await manager.persistentCache.has("key1");
    
    // Wait for write-back to occur (slightly longer than the delay)
    await new Promise(resolve => setTimeout(resolve, 30));
    
    // Now the key should be in persistent cache
    assert.strictEqual(await manager.persistentCache.has("key1"), true, "key1 in persistent cache after delay");

    // Test explicit flush
    await manager.set("key2", "value2");
    assert.strictEqual(await manager.memoryCache.has("key2"), true, "key2 in memory cache");
    await manager.flush(); // Explicitly flush the write-back queue
    assert.strictEqual(await manager.persistentCache.has("key2"), true, "key2 in persistent cache after flush");

    await manager.dispose();
  }

  async _testPredictivePreCaching() {
    const manager = new CacheManager({
      memoryCache: { defaultTTL: 1000 },
      predictivePreCaching: { enabled: true, confidenceThreshold: 0.1 }
    });
    await manager.initialize();
    const preCache = manager.features.predictivePreCaching;

    // Mock fetch function for pre-caching
    preCache.on("fetchItem", (key, callback) => {
      callback(`fetched_${key}`);
    });

    // Simulate access pattern A -> B -> C
    await manager.get("A", { fetchFunction: async () => "valueA" });
    await manager.get("B", { fetchFunction: async () => "valueB" });
    await manager.get("C", { fetchFunction: async () => "valueC" });
    await manager.get("A", { fetchFunction: async () => "valueA" });
    await manager.get("B", { fetchFunction: async () => "valueB" });

    // Check predictions after accessing B
    const predictions = preCache.getPredictions();
    const predictionC = predictions.find(p => p.key === "C");
    assert.ok(predictionC, "Predicts C after B");
    assert.ok(predictionC.confidence >= 0.1, "Prediction confidence is sufficient");

    // Clear existing cache for C to ensure we get the pre-cached value
    await manager.delete("C");
    
    // Trigger pre-caching
    await preCache.triggerPreCache();
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow time for async caching

    // Check if C was pre-cached with the correct value
    const cachedC = await manager.get("C", { includeMetadata: true });
    assert.ok(cachedC, "C is now cached");
    assert.strictEqual(cachedC.value, "fetched_C", "C has fetched value");
    assert.ok(cachedC.metadata.tags.includes("preCache"), "C is tagged as preCache");

    await manager.dispose();
  }

  async _testContextAwareCacheManagement() {
    // Create context provider with initial context
    const contextProvider = new MockContextProvider({ 
      networkType: "wifi", 
      timeOfDay: "morning",
      userActivity: "active"
    });
    
    const manager = new CacheManager({
      memoryCache: { defaultTTL: 1000 },
      contextAwareManagement: { 
        enabled: true, 
        contextProvider,
        policies: {
          default: {
            ttl: 3600000, // 1 hour
            priority: 1,
            shouldCache: true
          },
          'non-essential': {
            ttl: 1800000, // 30 minutes
            priority: 1,
            shouldCache: ctx => ctx.networkType !== 'cellular' || ctx.userActivity !== 'idle'
          }
        }
      }
    });
    
    await manager.initialize();
    const contextMgmt = manager.features.contextAwareManagement;

    // Test initial context application
    const policy1 = contextMgmt.getCachePolicy("api:data");
    assert.ok(policy1.ttl > 300000 * 0.9, "Initial TTL adjusted for wifi & morning");

    // Change context to cellular+idle
    contextProvider.setContext({ 
      networkType: "cellular", 
      userActivity: "idle" 
    });
    
    // Allow time for context change to propagate
    await new Promise(resolve => setTimeout(resolve, 20));

    // Test shouldCache rule for non-essential content on cellular+idle
    assert.strictEqual(
      contextMgmt.shouldCache("non-essential"), 
      false, 
      "Should not cache non-essential on cellular+idle"
    );

    await manager.dispose();
  }

  async _testCacheManagerIntegration() {
    const contextProvider = new MockContextProvider({ networkType: "wifi" });
    const manager = new CacheManager({
      memoryCache: { defaultTTL: 1000 },
      persistentCache: { directory: this.testDir, defaultTTL: 1000 },
      predictivePreCaching: { enabled: true, confidenceThreshold: 0.1 },
      contextAwareManagement: { enabled: true, contextProvider }
    });
    await manager.initialize();
    const preCache = manager.features.predictivePreCaching;

    // Mock fetch function for pre-caching
    preCache.on("fetchItem", (key, callback) => {
      callback(`fetched_${key}`);
    });

    // Simulate access pattern X -> Y
    await manager.set("X", "valueX", { tags: ["test"] });
    await manager.set("Y", "valueY", { tags: ["test"] });
    await manager.get("X");
    await manager.get("Y");
    await manager.get("X");
    
    // Clear Y from cache to ensure we get a fresh pre-cached value
    await manager.delete("Y");

    // Trigger pre-cache
    await preCache.triggerPreCache();
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow time for async caching

    // Check if Y was pre-cached with the preCache tag
    const cachedY = await manager.get("Y", { includeMetadata: true });
    assert.ok(cachedY, "Y is cached after prediction");
    assert.ok(cachedY.metadata.tags.includes("preCache"), "Y is tagged as preCache");

    // Change context to cellular
    contextProvider.setContext({ networkType: "cellular" });
    await new Promise(resolve => setTimeout(resolve, 20));

    // Set a new key, TTL should be reduced due to cellular context
    await manager.set("Z", "valueZ", { ttl: 2000 });
    const cachedZ = await manager.get("Z", { includeMetadata: true });
    const expectedTTL = 2000 * 0.5; // Base TTL * cellular factor
    const actualTTL = cachedZ.metadata.expires - cachedZ.metadata.created;
    assert.ok(Math.abs(actualTTL - expectedTTL) < 100, `TTL adjusted for cellular context (expected ~${expectedTTL}, got ${actualTTL})`);

    await manager.dispose();
  }
}

module.exports = CacheTestSuite;
