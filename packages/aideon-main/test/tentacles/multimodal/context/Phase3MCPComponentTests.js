/**
 * @fileoverview Test suite for Phase 3 MCP context management components.
 * 
 * This file contains comprehensive tests for all Phase 3 components:
 * - ContextFusionEngine
 * - ContextPrioritizationSystem
 * - ContextCompressionManager
 * - ContextSecurityManager
 * - ContextAnalyticsEngine
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const EventEmitter = require('events');
const path = require('path');

// Calculate the correct path to the src directory from the test file
const projectRoot = path.resolve(__dirname, '../../../..');
const srcPath = path.join(projectRoot, 'src');

// Import components to test - using project-root-based paths
const ContextFusionEngine = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextFusionEngine'));
const ContextPrioritizationSystem = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextPrioritizationSystem'));
const ContextCompressionManager = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextCompressionManager'));
const ContextSecurityManager = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextSecurityManager'));
const ContextAnalyticsEngine = require(path.join(srcPath, 'tentacles/multimodal/context/providers/ContextAnalyticsEngine'));

// Import mocks
const MockLogger = require('./mocks/MockLogger');
const MockConfigService = require('./mocks/MockConfigService');
const MockPerformanceMonitor = require('./mocks/MockPerformanceMonitor');
const MockSecurityManager = require('./mocks/MockSecurityManager');
const MockMCPContextManager = require('./mocks/MockMCPContextManager');

// Mock classes for testing
class MockPrioritizationSystem extends EventEmitter {
  constructor() {
    super();
    this.priorityScores = new Map();
  }
  
  async getPriorityScore(contextType) {
    return this.priorityScores.get(contextType) || 0.5;
  }
  
  async updateContextUsage(contextType, usage) {
    this.priorityScores.set(contextType, usage.frequency ? usage.frequency / 20 : 0.5);
    this.emit('priorityUpdated', { contextType, priorityScore: this.priorityScores.get(contextType) });
  }
}

class MockCompressionManager extends EventEmitter {
  constructor() {
    super();
    this.compressedData = new Map();
  }
  
  async compressContext(contextType, contextData) {
    this.compressedData.set(contextType, contextData);
    return true;
  }
  
  async decompressContext(contextType) {
    return this.compressedData.get(contextType);
  }
}

// Test suite
describe('Phase 3 MCP Context Management Components', function() {
  // Increase timeout for all tests
  this.timeout(10000);
  
  // Common test dependencies
  let logger;
  let configService;
  let performanceMonitor;
  let securityManagerMock;
  let mcpContextManager;
  
  // Component instances
  let fusionEngine;
  let prioritizationSystem;
  let compressionManager;
  let securityManager;
  let analyticsEngine;
  
  // Setup before all tests
  before(function() {
    console.log('Setting up test environment for Phase 3 MCP components...');
    
    // Initialize mocks
    logger = new MockLogger();
    configService = new MockConfigService();
    performanceMonitor = new MockPerformanceMonitor();
    securityManagerMock = new MockSecurityManager();
    mcpContextManager = new MockMCPContextManager();
    
    console.log('Test environment setup complete.');
  });
  
  // Teardown after all tests
  after(function() {
    console.log('Cleaning up test environment...');
    
    // Dispose of components
    if (fusionEngine && fusionEngine.dispose) {
      fusionEngine.dispose();
    }
    
    if (prioritizationSystem && prioritizationSystem.dispose) {
      prioritizationSystem.dispose();
    }
    
    if (compressionManager && compressionManager.dispose) {
      compressionManager.dispose();
    }
    
    if (securityManager && securityManager.dispose) {
      securityManager.dispose();
    }
    
    if (analyticsEngine && analyticsEngine.dispose) {
      analyticsEngine.dispose();
    }
    
    console.log('Test environment cleanup complete.');
  });
  
  // ContextFusionEngine Tests
  describe('ContextFusionEngine', function() {
    beforeEach(function() {
      // Create a new instance for each test
      fusionEngine = new ContextFusionEngine({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager
      });
    });
    
    afterEach(function() {
      // Clean up after each test
      if (fusionEngine && fusionEngine.dispose) {
        fusionEngine.dispose();
      }
      fusionEngine = null;
    });
    
    it('should initialize successfully', async function() {
      const result = await fusionEngine.initialize();
      assert.strictEqual(result, true, 'Initialization should return true');
      assert.strictEqual(fusionEngine.initialized, true, 'initialized flag should be true');
    });
    
    it('should register with MCPContextManager during initialization', async function() {
      await fusionEngine.initialize();
      assert.strictEqual(mcpContextManager.registeredProviders.has('fusion'), true, 'Should register as a context provider');
    });
    
    it('should fuse context from multiple sources', async function() {
      await fusionEngine.initialize();
      
      // Add test context data
      const textContext = { text: 'This is a test' };
      const visualContext = { image: 'test_image.jpg', objects: ['person', 'car'] };
      
      // Fuse context
      const fusedContext = await fusionEngine.fuseContext('test', [
        { type: 'text', data: textContext },
        { type: 'visual', data: visualContext }
      ]);
      
      // Verify fusion result
      assert.ok(fusedContext, 'Should return fused context');
      assert.ok(fusedContext.text !== undefined, 'Should include text context');
      assert.ok(fusedContext.image !== undefined, 'Should include visual context');
    });
  });
  
  // ContextPrioritizationSystem Tests
  describe('ContextPrioritizationSystem', function() {
    beforeEach(function() {
      // Create a new instance for each test
      fusionEngine = new ContextFusionEngine({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager
      });
      
      prioritizationSystem = new ContextPrioritizationSystem({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextFusionEngine: fusionEngine
      });
    });
    
    afterEach(function() {
      // Clean up after each test
      if (prioritizationSystem && prioritizationSystem.dispose) {
        prioritizationSystem.dispose();
      }
      prioritizationSystem = null;
      
      if (fusionEngine && fusionEngine.dispose) {
        fusionEngine.dispose();
      }
      fusionEngine = null;
    });
    
    it('should initialize successfully', async function() {
      await fusionEngine.initialize();
      const result = await prioritizationSystem.initialize();
      assert.strictEqual(result, true, 'Initialization should return true');
      assert.strictEqual(prioritizationSystem.initialized, true, 'initialized flag should be true');
    });
    
    it('should register with MCPContextManager during initialization', async function() {
      await fusionEngine.initialize();
      await prioritizationSystem.initialize();
      assert.strictEqual(mcpContextManager.registeredProviders.has('prioritization'), true, 'Should register as a context provider');
    });
    
    it('should calculate priority scores for context types', async function() {
      await fusionEngine.initialize();
      await prioritizationSystem.initialize();
      
      // Set up test data
      await mcpContextManager.updateContext('test.context', { value: 'test data' }, 'test');
      
      // Calculate priority score
      const score = await prioritizationSystem.calculatePriorityScore('test.context');
      
      // Verify result
      assert.ok(typeof score === 'number', 'Should return a numeric score');
      assert.ok(score >= 0 && score <= 1, 'Score should be between 0 and 1');
    });
  });
  
  // ContextCompressionManager Tests
  describe('ContextCompressionManager', function() {
    beforeEach(function() {
      // Create a new instance for each test
      fusionEngine = new ContextFusionEngine({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager
      });
      
      prioritizationSystem = new ContextPrioritizationSystem({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextFusionEngine: fusionEngine
      });
      
      compressionManager = new ContextCompressionManager({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextPrioritizationSystem: prioritizationSystem
      });
    });
    
    afterEach(function() {
      // Clean up after each test
      if (compressionManager && compressionManager.dispose) {
        compressionManager.dispose();
      }
      compressionManager = null;
      
      if (prioritizationSystem && prioritizationSystem.dispose) {
        prioritizationSystem.dispose();
      }
      prioritizationSystem = null;
      
      if (fusionEngine && fusionEngine.dispose) {
        fusionEngine.dispose();
      }
      fusionEngine = null;
    });
    
    it('should initialize successfully', async function() {
      await fusionEngine.initialize();
      await prioritizationSystem.initialize();
      const result = await compressionManager.initialize();
      assert.strictEqual(result, true, 'Initialization should return true');
      assert.strictEqual(compressionManager.initialized, true, 'initialized flag should be true');
    });
    
    it('should register with MCPContextManager during initialization', async function() {
      await fusionEngine.initialize();
      await prioritizationSystem.initialize();
      await compressionManager.initialize();
      assert.strictEqual(mcpContextManager.registeredProviders.has('compression.metadata'), true, 'Should register as a context provider');
    });
    
    it('should compress and decompress context data', async function() {
      await fusionEngine.initialize();
      await prioritizationSystem.initialize();
      await compressionManager.initialize();
      
      // Test data
      const contextType = 'test.compression';
      const contextData = { 
        text: 'This is a test of the compression system',
        values: [1, 2, 3, 4, 5],
        nested: { a: 1, b: 2, c: { d: 3 } }
      };
      
      // Compress context
      const compressed = await compressionManager.compressContext(contextType, contextData);
      assert.strictEqual(compressed, true, 'Compression should succeed');
      
      // Decompress context
      const decompressed = await compressionManager.decompressContext(contextType);
      
      // Verify result
      assert.deepStrictEqual(decompressed, contextData, 'Decompressed data should match original');
    });
  });
  
  // ContextSecurityManager Tests
  describe('ContextSecurityManager', function() {
    beforeEach(async function() {
      // Create fusion engine and prioritization system first
      fusionEngine = new ContextFusionEngine({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager
      });
      
      await fusionEngine.initialize();
      
      prioritizationSystem = new ContextPrioritizationSystem({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextFusionEngine: fusionEngine
      });
      
      await prioritizationSystem.initialize();
      
      // Create a new instance for each test
      securityManager = new ContextSecurityManager({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextPrioritizationSystem: prioritizationSystem
      });
    });
    
    afterEach(function() {
      // Clean up after each test
      if (securityManager && securityManager.dispose) {
        securityManager.dispose();
      }
      securityManager = null;
    });
    
    it('should initialize successfully', async function() {
      const result = await securityManager.initialize();
      assert.strictEqual(result, true, 'Initialization should return true');
      assert.strictEqual(securityManager.initialized, true, 'initialized flag should be true');
    });
    
    it('should register with MCPContextManager during initialization', async function() {
      await securityManager.initialize();
      assert.strictEqual(mcpContextManager.registeredProviders.has('security.policies'), true, 'Should register as a context provider');
    });
    
    it('should enforce access control for context data', async function() {
      await securityManager.initialize();
      
      // Set up test data
      const contextType = 'test.secure';
      const contextData = { sensitive: 'secure data' };
      
      // Set security policy
      await securityManager.setSecurityPolicy(contextType, {
        accessLevel: 'restricted',
        allowedSources: ['trusted'],
        encryptionRequired: true
      });
      
      // Test access control
      const allowed = await securityManager.checkAccess('trusted', contextType);
      const denied = await securityManager.checkAccess('untrusted', contextType);
      
      // Verify results
      assert.strictEqual(allowed, true, 'Trusted source should be allowed');
      assert.strictEqual(denied, false, 'Untrusted source should be denied');
    });
  });
  
  // ContextAnalyticsEngine Tests
  describe('ContextAnalyticsEngine', function() {
    beforeEach(async function() {
      // Create fusion engine and prioritization system first
      fusionEngine = new ContextFusionEngine({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager
      });
      
      await fusionEngine.initialize();
      
      prioritizationSystem = new ContextPrioritizationSystem({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextFusionEngine: fusionEngine
      });
      
      await prioritizationSystem.initialize();
      
      // Create compression manager
      compressionManager = new ContextCompressionManager({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextPrioritizationSystem: prioritizationSystem
      });
      
      await compressionManager.initialize();
      
      // Create security manager
      securityManager = new ContextSecurityManager({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextPrioritizationSystem: prioritizationSystem
      });
      
      await securityManager.initialize();
      
      // Create a new instance for each test
      analyticsEngine = new ContextAnalyticsEngine({
        logger,
        configService,
        performanceMonitor,
        securityManager: securityManagerMock,
        mcpContextManager,
        contextPrioritizationSystem: prioritizationSystem,
        contextCompressionManager: compressionManager,
        contextSecurityManager: securityManager
      });
    });
    
    afterEach(function() {
      // Clean up after each test
      if (analyticsEngine && analyticsEngine.dispose) {
        analyticsEngine.dispose();
      }
      analyticsEngine = null;
    });
    
    it('should initialize successfully', async function() {
      const result = await analyticsEngine.initialize();
      assert.strictEqual(result, true, 'Initialization should return true');
      assert.strictEqual(analyticsEngine.initialized, true, 'initialized flag should be true');
    });
    
    it('should register with MCPContextManager during initialization', async function() {
      await analyticsEngine.initialize();
      assert.strictEqual(mcpContextManager.registeredProviders.has('analytics'), true, 'Should register as a context provider');
    });
    
    it('should track context usage patterns', async function() {
      await analyticsEngine.initialize();
      
      // Generate test usage data
      await mcpContextManager.updateContext('test.analytics', { value: 'test data' }, 'test');
      await mcpContextManager.getContext('test.analytics');
      await mcpContextManager.getContext('test.analytics');
      
      // Get usage analytics
      const analytics = await analyticsEngine.getContextAnalytics('test.analytics');
      
      // Verify results
      assert.ok(analytics, 'Should return analytics data');
      assert.ok(analytics.accessCount >= 2, 'Should track access count');
      assert.ok(analytics.lastAccessed, 'Should track last accessed timestamp');
    });
  });
});
