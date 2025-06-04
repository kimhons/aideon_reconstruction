/**
 * @fileoverview Tests for the Multi-Context Understanding Mechanism.
 * This test suite validates the functionality of the MultiContextUnderstandingMechanism class,
 * ensuring it correctly identifies, activates, and processes multiple contexts.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { MultiContextUnderstandingMechanism, ContextType } = require('../../../../src/tentacles/cognitive/core/MultiContextUnderstandingMechanism');

describe('MultiContextUnderstandingMechanism', () => {
  let mechanism;
  let mockLogger;
  let mockPerformanceMonitor;
  let mockConfigService;
  let mockSecurityManager;
  let mockHierarchicalReasoningFramework;
  let mockAbstractionLayerManager;
  let mockNlpService;
  let mockVectorService;
  
  beforeEach(() => {
    // Create mocks
    mockLogger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
    
    mockPerformanceMonitor = {
      startTimer: sinon.stub().returns('timer-id'),
      endTimer: sinon.stub()
    };
    
    mockConfigService = {
      getConfig: sinon.stub().returns({
        enabledContextTypes: Object.values(ContextType),
        maxActiveContexts: 5,
        contextBlendingEnabled: true,
        contextSwitchingThreshold: 0.6,
        conflictResolutionStrategy: 'weighted',
        contextMemoryEnabled: true,
        contextMemoryTTL: 3600000,
        contextIdentificationConfidenceThreshold: 0.5,
        useAdvancedIdentification: true,
        contextCacheEnabled: true,
        contextCacheTTL: 600000,
        parallelProcessingEnabled: true
      })
    };
    
    mockSecurityManager = {
      encryptData: sinon.stub().callsFake(data => data),
      decryptData: sinon.stub().callsFake(data => data),
      validateAccess: sinon.stub().returns(true),
      sanitizeData: sinon.stub().callsFake(data => data)
    };
    
    mockHierarchicalReasoningFramework = {
      reason: sinon.stub().resolves({
        reasoningId: 'test-reasoning-id',
        conclusion: 'Test conclusion',
        confidence: 0.85,
        explanation: 'Test explanation'
      })
    };
    
    mockAbstractionLayerManager = {
      processData: sinon.stub().resolves('processed data'),
      getLayer: sinon.stub().returns({
        name: 'semantic',
        processData: sinon.stub().resolves('layer processed data')
      })
    };

    mockNlpService = {
      analyzeText: sinon.stub().resolves({
        entities: [{ type: 'LOCATION', text: 'New York', confidence: 0.9 }],
        sentiment: { score: 0.7, label: 'positive' },
        language: 'en'
      }),
      extractKeywords: sinon.stub().resolves(['technology', 'AI', 'software'])
    };

    mockVectorService = {
      getEmbedding: sinon.stub().resolves(new Float32Array(768).fill(0.1)),
      getSimilarity: sinon.stub().returns(0.8)
    };
    
    // Create mechanism instance
    mechanism = new MultiContextUnderstandingMechanism({
      logger: mockLogger,
      performanceMonitor: mockPerformanceMonitor,
      configService: mockConfigService,
      securityManager: mockSecurityManager,
      hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
      abstractionLayerManager: mockAbstractionLayerManager,
      nlpService: mockNlpService,
      vectorService: mockVectorService
    });
  });
  
  afterEach(() => {
    // Clean up
    sinon.restore();
    if (mechanism) {
      mechanism.dispose();
      mechanism = null;
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(mechanism).to.be.an.instanceOf(MultiContextUnderstandingMechanism);
      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(mechanism.contextMemory.size).to.equal(0);
      expect(mechanism.contextBlendingEnabled).to.be.true;
      expect(mechanism.contextMemoryEnabled).to.be.true;
      expect(mechanism.contextCacheEnabled).to.be.true;
    });
    
    it('should throw error when missing required dependencies', () => {
      expect(() => {
        new MultiContextUnderstandingMechanism({
          // Missing logger
          performanceMonitor: mockPerformanceMonitor,
          configService: mockConfigService,
          securityManager: mockSecurityManager,
          hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
          abstractionLayerManager: mockAbstractionLayerManager
        });
      }).to.throw('Missing required dependencies');
    });
    
    it('should validate configuration during initialization', () => {
      // Test with invalid maxActiveContexts
      mockConfigService.getConfig.returns({
        enabledContextTypes: Object.values(ContextType),
        maxActiveContexts: 0, // Invalid
        contextBlendingEnabled: true,
        contextSwitchingThreshold: 0.6,
        conflictResolutionStrategy: 'weighted',
        contextMemoryEnabled: true,
        contextMemoryTTL: 3600000
      });
      
      expect(() => {
        new MultiContextUnderstandingMechanism({
          logger: mockLogger,
          performanceMonitor: mockPerformanceMonitor,
          configService: mockConfigService,
          securityManager: mockSecurityManager,
          hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
          abstractionLayerManager: mockAbstractionLayerManager
        });
      }).to.throw('maxActiveContexts must be a positive number');
    });
    
    it('should validate contextSwitchingThreshold during initialization', () => {
      // Test with invalid contextSwitchingThreshold
      mockConfigService.getConfig.returns({
        enabledContextTypes: Object.values(ContextType),
        maxActiveContexts: 5,
        contextBlendingEnabled: true,
        contextSwitchingThreshold: 1.5, // Invalid
        conflictResolutionStrategy: 'weighted',
        contextMemoryEnabled: true,
        contextMemoryTTL: 3600000
      });
      
      expect(() => {
        new MultiContextUnderstandingMechanism({
          logger: mockLogger,
          performanceMonitor: mockPerformanceMonitor,
          configService: mockConfigService,
          securityManager: mockSecurityManager,
          hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
          abstractionLayerManager: mockAbstractionLayerManager
        });
      }).to.throw('contextSwitchingThreshold must be between 0 and 1');
    });
    
    it('should validate conflictResolutionStrategy during initialization', () => {
      // Test with invalid conflictResolutionStrategy
      mockConfigService.getConfig.returns({
        enabledContextTypes: Object.values(ContextType),
        maxActiveContexts: 5,
        contextBlendingEnabled: true,
        contextSwitchingThreshold: 0.6,
        conflictResolutionStrategy: 'invalid', // Invalid
        contextMemoryEnabled: true,
        contextMemoryTTL: 3600000
      });
      
      expect(() => {
        new MultiContextUnderstandingMechanism({
          logger: mockLogger,
          performanceMonitor: mockPerformanceMonitor,
          configService: mockConfigService,
          securityManager: mockSecurityManager,
          hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
          abstractionLayerManager: mockAbstractionLayerManager
        });
      }).to.throw('conflictResolutionStrategy must be one of: weighted, priority, recency, hybrid');
    });

    it('should validate contextMemoryTTL during initialization', () => {
      mockConfigService.getConfig.returns({
        enabledContextTypes: Object.values(ContextType),
        maxActiveContexts: 5,
        contextBlendingEnabled: true,
        contextSwitchingThreshold: 0.6,
        conflictResolutionStrategy: 'weighted',
        contextMemoryEnabled: true,
        contextMemoryTTL: -1 // Invalid
      });
      
      expect(() => {
        new MultiContextUnderstandingMechanism({
          logger: mockLogger,
          performanceMonitor: mockPerformanceMonitor,
          configService: mockConfigService,
          securityManager: mockSecurityManager,
          hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
          abstractionLayerManager: mockAbstractionLayerManager
        });
      }).to.throw('contextMemoryTTL must be a non-negative number');
    });

    it('should validate contextIdentificationConfidenceThreshold during initialization', () => {
      mockConfigService.getConfig.returns({
        enabledContextTypes: Object.values(ContextType),
        maxActiveContexts: 5,
        contextBlendingEnabled: true,
        contextSwitchingThreshold: 0.6,
        conflictResolutionStrategy: 'weighted',
        contextMemoryEnabled: true,
        contextMemoryTTL: 3600000,
        contextIdentificationConfidenceThreshold: 1.5 // Invalid
      });
      
      expect(() => {
        new MultiContextUnderstandingMechanism({
          logger: mockLogger,
          performanceMonitor: mockPerformanceMonitor,
          configService: mockConfigService,
          securityManager: mockSecurityManager,
          hierarchicalReasoningFramework: mockHierarchicalReasoningFramework,
          abstractionLayerManager: mockAbstractionLayerManager
        });
      }).to.throw('contextIdentificationConfidenceThreshold must be between 0 and 1');
    });
  });
  
  describe('Context Type Management', () => {
    it('should return available context types', () => {
      const types = mechanism.getAvailableContextTypes();
      expect(types).to.be.an('array');
      expect(types).to.include(ContextType.TEMPORAL);
      expect(types).to.include(ContextType.SPATIAL);
      expect(types).to.include(ContextType.CULTURAL);
      expect(types).to.include(ContextType.DOMAIN);
      expect(types).to.include(ContextType.PERSONAL);
      expect(types).to.include(ContextType.SOCIAL);
      expect(types).to.include(ContextType.EMOTIONAL);
      expect(types).to.include(ContextType.LINGUISTIC);
    });
    
    it('should check if a context type is available', () => {
      expect(mechanism.hasContextType(ContextType.TEMPORAL)).to.be.true;
      expect(mechanism.hasContextType(ContextType.SPATIAL)).to.be.true;
      expect(mechanism.hasContextType('invalid-type')).to.be.false;
    });
  });
  
  describe('Context Identification', () => {
    it('should identify contexts in input data', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content about technology in New York',
        metadata: { domain: 'technology' },
        timestamp: Date.now()
      };
      
      const contexts = await mechanism.identifyContexts(input);
      
      expect(contexts).to.be.an('array');
      expect(contexts.length).to.be.at.least(1);
      expect(contexts[0]).to.have.property('id');
      expect(contexts[0]).to.have.property('type');
      expect(contexts[0]).to.have.property('name');
      expect(contexts[0]).to.have.property('confidence');
      expect(contexts[0]).to.have.property('attributes');
      expect(mockPerformanceMonitor.startTimer.calledOnce).to.be.true;
      expect(mockPerformanceMonitor.endTimer.calledOnce).to.be.true;
    });
    
    it('should filter contexts by confidence threshold', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      // Set a high threshold that should filter out most contexts
      const contexts = await mechanism.identifyContexts(input, { confidenceThreshold: 0.95 });
      
      // Expect fewer contexts due to high threshold
      expect(contexts.length).to.be.at.most(1);
    });
    
    it('should identify contexts of specific types', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      // Only identify domain contexts
      const contexts = await mechanism.identifyContexts(input, { contextTypes: [ContextType.DOMAIN] });
      
      expect(contexts).to.be.an('array');
      if (contexts.length > 0) {
        expect(contexts[0].type).to.equal(ContextType.DOMAIN);
      }
    });
    
    it('should throw error for invalid context type', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content'
      };
      
      try {
        await mechanism.identifyContexts(input, { contextTypes: ['invalid-type'] });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('invalid');
      }
    });
    
    it('should throw error for invalid confidence threshold', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content'
      };
      
      try {
        await mechanism.identifyContexts(input, { confidenceThreshold: 1.5 });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('confidenceThreshold');
      }
    });

    it('should throw error for invalid input', async () => {
      try {
        await mechanism.identifyContexts(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid input');
      }

      try {
        await mechanism.identifyContexts({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid input');
      }
    });

    it('should use cache when available', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      // First call should not use cache
      await mechanism.identifyContexts(input);
      
      // Second call should use cache
      await mechanism.identifyContexts(input);
      
      // Verify cache was used (implementation specific)
      expect(mockLogger.debug.calledWith(sinon.match(/Cache hit/))).to.be.true;
    });
  });
  
  describe('Context Activation', () => {
    it('should activate identified contexts', async () => {
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts = await mechanism.identifyContexts(input);
      const activatedContexts = mechanism.activateContexts(contexts);
      
      expect(activatedContexts).to.be.an('array');
      expect(activatedContexts.length).to.equal(contexts.length);
      expect(mechanism.activeContexts.size).to.equal(contexts.length);
      expect(mockPerformanceMonitor.startTimer.called).to.be.true;
      expect(mockPerformanceMonitor.endTimer.called).to.be.true;
    });
    
    it('should replace existing contexts when requested', async () => {
      // Activate initial contexts
      const input1 = {
        id: 'test-input-1',
        content: 'Test content 1 about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts1 = await mechanism.identifyContexts(input1);
      mechanism.activateContexts(contexts1);
      
      // Activate new contexts with replace option
      const input2 = {
        id: 'test-input-2',
        content: 'Test content 2 about New York',
        metadata: { location: 'New York' }
      };
      
      const contexts2 = await mechanism.identifyContexts(input2);
      const activatedContexts = mechanism.activateContexts(contexts2, { replaceExisting: true });
      
      expect(activatedContexts).to.be.an('array');
      expect(activatedContexts.length).to.equal(contexts2.length);
      expect(mechanism.activeContexts.size).to.equal(contexts2.length);
    });
    
    it('should limit active contexts to maxActiveContexts', () => {
      // Create more contexts than maxActiveContexts
      const contexts = [];
      for (let i = 0; i < 10; i++) {
        contexts.push({
          id: `context-${i}`,
          type: ContextType.DOMAIN,
          name: `Context ${i}`,
          confidence: 0.9 - (i * 0.05),
          attributes: {},
          timestamp: Date.now()
        });
      }
      
      const activatedContexts = mechanism.activateContexts(contexts);
      
      expect(activatedContexts).to.be.an('array');
      expect(activatedContexts.length).to.be.at.most(5); // maxActiveContexts is 5
      expect(mechanism.activeContexts.size).to.be.at.most(5);
    });
    
    it('should merge with existing contexts when requested', async () => {
      // Activate initial contexts
      const input1 = {
        id: 'test-input-1',
        content: 'Test content 1 about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts1 = await mechanism.identifyContexts(input1);
      mechanism.activateContexts(contexts1);
      const initialCount = mechanism.activeContexts.size;
      
      // Activate new contexts with merge option
      const input2 = {
        id: 'test-input-2',
        content: 'Test content 2 about New York',
        metadata: { location: 'New York' }
      };
      
      const contexts2 = await mechanism.identifyContexts(input2);
      const activatedContexts = mechanism.activateContexts(contexts2, { mergeWithExisting: true });
      
      expect(activatedContexts).to.be.an('array');
      expect(mechanism.activeContexts.size).to.be.at.most(5); // maxActiveContexts is 5
      expect(mechanism.activeContexts.size).to.be.at.least(Math.min(initialCount, 5));
    });

    it('should handle duplicate contexts by keeping higher confidence ones', () => {
      // Create contexts with same IDs but different confidences
      const contexts = [
        {
          id: 'duplicate-context',
          type: ContextType.DOMAIN,
          name: 'Duplicate Context',
          confidence: 0.7,
          attributes: {},
          timestamp: Date.now()
        },
        {
          id: 'duplicate-context',
          type: ContextType.DOMAIN,
          name: 'Duplicate Context',
          confidence: 0.9, // Higher confidence
          attributes: {},
          timestamp: Date.now() + 1000
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Should keep the higher confidence one
      expect(mechanism.activeContexts.size).to.equal(1);
      expect(mechanism.getContext('duplicate-context').confidence).to.equal(0.9);
    });

    it('should throw error for invalid contexts array', () => {
      expect(() => {
        mechanism.activateContexts('not-an-array');
      }).to.throw('Invalid contexts array');
    });

    it('should check security access before activation', () => {
      mockSecurityManager.validateAccess.returns(false);
      
      const contexts = [{
        id: 'test-context',
        type: ContextType.DOMAIN,
        name: 'Test Context',
        confidence: 0.8,
        attributes: {},
        timestamp: Date.now()
      }];
      
      const result = mechanism.activateContexts(contexts);
      
      // Should return current active contexts without changing state
      expect(result).to.be.an('array');
      expect(result.length).to.equal(0);
      expect(mockLogger.warn.calledWith(sinon.match(/Unauthorized/))).to.be.true;
    });
  });
  
  describe('Context Deactivation', () => {
    it('should deactivate contexts', async () => {
      // Activate contexts
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts = await mechanism.identifyContexts(input);
      mechanism.activateContexts(contexts);
      
      // Get context IDs
      const contextIds = contexts.map(context => context.id);
      
      // Deactivate contexts
      mechanism.deactivateContexts(contextIds);
      
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(mockPerformanceMonitor.startTimer.called).to.be.true;
      expect(mockPerformanceMonitor.endTimer.called).to.be.true;
    });
    
    it('should store deactivated contexts in memory when requested', async () => {
      // Activate contexts
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts = await mechanism.identifyContexts(input);
      mechanism.activateContexts(contexts);
      
      // Get context IDs
      const contextIds = contexts.map(context => context.id);
      
      // Deactivate contexts with memory storage
      mechanism.deactivateContexts(contextIds, { storeInMemory: true });
      
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(mechanism.contextMemory.size).to.be.at.least(1);
    });
    
    it('should not store deactivated contexts in memory when not requested', async () => {
      // Activate contexts
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts = await mechanism.identifyContexts(input);
      mechanism.activateContexts(contexts);
      
      // Get context IDs
      const contextIds = contexts.map(context => context.id);
      
      // Deactivate contexts without memory storage
      mechanism.deactivateContexts(contextIds, { storeInMemory: false });
      
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(mechanism.contextMemory.size).to.equal(0);
    });

    it('should throw error for invalid contextIds array', () => {
      expect(() => {
        mechanism.deactivateContexts('not-an-array');
      }).to.throw('Invalid contextIds array');
    });

    it('should check security access before deactivation', () => {
      // First activate some contexts
      const contexts = [{
        id: 'test-context',
        type: ContextType.DOMAIN,
        name: 'Test Context',
        confidence: 0.8,
        attributes: {},
        timestamp: Date.now()
      }];
      
      mechanism.activateContexts(contexts);
      
      // Then try to deactivate with security check failing
      mockSecurityManager.validateAccess.returns(false);
      
      mechanism.deactivateContexts(['test-context']);
      
      // Should not deactivate
      expect(mechanism.activeContexts.size).to.equal(1);
      expect(mockLogger.warn.calledWith(sinon.match(/Unauthorized/))).to.be.true;
    });
  });
  
  describe('Context Memory Management', () => {
    it('should enable or disable context memory', () => {
      // Enable context memory
      mechanism.setContextMemoryEnabled(true);
      expect(mechanism.contextMemoryEnabled).to.be.true;
      
      // Disable context memory
      mechanism.setContextMemoryEnabled(false);
      expect(mechanism.contextMemoryEnabled).to.be.false;
    });
    
    it('should clear context memory', async () => {
      // Activate and deactivate contexts to populate memory
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts = await mechanism.identifyContexts(input);
      mechanism.activateContexts(contexts);
      
      // Get context IDs
      const contextIds = contexts.map(context => context.id);
      
      // Deactivate contexts with memory storage
      mechanism.deactivateContexts(contextIds, { storeInMemory: true });
      
      // Verify memory is populated
      expect(mechanism.contextMemory.size).to.be.at.least(1);
      
      // Clear memory
      mechanism.clearContextMemory();
      
      // Verify memory is cleared
      expect(mechanism.contextMemory.size).to.equal(0);
    });

    it('should retrieve context from memory', async () => {
      // Activate and deactivate contexts to populate memory
      const input = {
        id: 'test-input',
        content: 'Test content about technology',
        metadata: { domain: 'technology' }
      };
      
      const contexts = await mechanism.identifyContexts(input);
      mechanism.activateContexts(contexts);
      
      // Get context IDs
      const contextIds = contexts.map(context => context.id);
      
      // Deactivate contexts with memory storage
      mechanism.deactivateContexts(contextIds, { storeInMemory: true });
      
      // Retrieve context from memory (using private method)
      const retrievedContext = mechanism._getContextFromMemory(contextIds[0]);
      
      // Verify context was retrieved
      expect(retrievedContext).to.not.be.null;
      expect(retrievedContext.id).to.equal(contextIds[0]);
    });

    it('should clean up expired contexts from memory', async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      const mockNow = sinon.stub(Date, 'now');
      
      try {
        // Set current time
        const currentTime = 1000000;
        mockNow.returns(currentTime);
        
        // Activate and deactivate contexts to populate memory
        const input = {
          id: 'test-input',
          content: 'Test content about technology',
          metadata: { domain: 'technology' }
        };
        
        const contexts = await mechanism.identifyContexts(input);
        mechanism.activateContexts(contexts);
        
        // Get context IDs
        const contextIds = contexts.map(context => context.id);
        
        // Deactivate contexts with memory storage
        mechanism.deactivateContexts(contextIds, { storeInMemory: true });
        
        // Verify memory is populated
        expect(mechanism.contextMemory.size).to.be.at.least(1);
        
        // Advance time beyond TTL
        mockNow.returns(currentTime + mechanism.config.contextMemoryTTL + 1000);
        
        // Clean up expired contexts
        mechanism._cleanupContextMemory();
        
        // Verify expired contexts were removed
        expect(mechanism.contextMemory.size).to.equal(0);
      } finally {
        // Restore original Date.now
        mockNow.restore();
        Date.now = originalNow;
      }
    });
  });

  describe('Cache Management', () => {
    it('should store and retrieve data from cache', () => {
      const key = 'test-cache-key';
      const data = { test: 'data' };
      
      // Store data in cache
      mechanism._storeInCache(key, data);
      
      // Retrieve data from cache
      const cachedData = mechanism._getFromCache(key);
      
      // Verify data was retrieved
      expect(cachedData).to.deep.equal(data);
    });

    it('should not retrieve expired data from cache', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      const mockNow = sinon.stub(Date, 'now');
      
      try {
        // Set current time
        const currentTime = 1000000;
        mockNow.returns(currentTime);
        
        const key = 'test-cache-key';
        const data = { test: 'data' };
        
        // Store data in cache
        mechanism._storeInCache(key, data);
        
        // Advance time beyond TTL
        mockNow.returns(currentTime + mechanism.config.contextCacheTTL + 1000);
        
        // Try to retrieve expired data
        const cachedData = mechanism._getFromCache(key);
        
        // Verify data was not retrieved
        expect(cachedData).to.be.null;
      } finally {
        // Restore original Date.now
        mockNow.restore();
        Date.now = originalNow;
      }
    });

    it('should clean up expired entries from cache', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      const mockNow = sinon.stub(Date, 'now');
      
      try {
        // Set current time
        const currentTime = 1000000;
        mockNow.returns(currentTime);
        
        // Store data in cache
        mechanism._storeInCache('key1', 'data1');
        mechanism._storeInCache('key2', 'data2');
        
        // Verify cache is populated
        expect(mechanism.contextCache.size).to.equal(2);
        
        // Advance time beyond TTL
        mockNow.returns(currentTime + mechanism.config.contextCacheTTL + 1000);
        
        // Clean up expired entries
        mechanism._cleanupCache();
        
        // Verify expired entries were removed
        expect(mechanism.contextCache.size).to.equal(0);
      } finally {
        // Restore original Date.now
        mockNow.restore();
        Date.now = originalNow;
      }
    });
  });
  
  describe('Input Processing', () => {
    it('should process input through active contexts', async () => {
      // Activate contexts
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Process input
      const input = {
        id: 'test-input',
        content: 'Test content about technology'
      };
      
      const result = await mechanism.processInput(input);
      
      expect(result).to.be.an('object');
      expect(result.processedInput).to.be.an('object');
      expect(result.contexts).to.be.an('array');
      expect(result.contexts.length).to.equal(1);
      expect(result.blended).to.be.a('boolean');
      expect(mockPerformanceMonitor.startTimer.called).to.be.true;
      expect(mockPerformanceMonitor.endTimer.called).to.be.true;
    });
    
    it('should identify and activate new contexts during processing when enabled', async () => {
      // Process input with context identification and activation
      const input = {
        id: 'test-input',
        content: 'Test content about technology in New York',
        metadata: { domain: 'technology' }
      };
      
      const result = await mechanism.processInput(input, { identifyContexts: true, activateNewContexts: true });
      
      expect(result.contexts.length).to.be.at.least(1);
      expect(mechanism.activeContexts.size).to.be.at.least(1);
    });
    
    it('should not identify or activate new contexts when disabled', async () => {
      // Process input without context identification
      const input = {
        id: 'test-input',
        content: 'Test content about technology'
      };
      
      const result = await mechanism.processInput(input, { identifyContexts: false });
      
      // No contexts should be active
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(result.contexts.length).to.equal(0);
    });
    
    it('should blend results from multiple contexts when enabled', async () => {
      // Activate multiple contexts
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        },
        {
          id: 'context-2',
          type: ContextType.SPATIAL,
          name: 'New York Context',
          confidence: 0.7,
          attributes: { location: 'New York' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Process input with blending
      const input = {
        id: 'test-input',
        content: 'Test content about technology in New York'
      };
      
      const result = await mechanism.processInput(input, { useBlending: true });
      
      expect(result.blended).to.be.true;
      expect(result.contexts.length).to.equal(2);
    });
    
    it('should not blend results when disabled', async () => {
      // Activate multiple contexts
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        },
        {
          id: 'context-2',
          type: ContextType.SPATIAL,
          name: 'New York Context',
          confidence: 0.7,
          attributes: { location: 'New York' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Process input without blending
      const input = {
        id: 'test-input',
        content: 'Test content about technology in New York'
      };
      
      const result = await mechanism.processInput(input, { useBlending: false });
      
      expect(result.blended).to.be.false;
      expect(result.contexts.length).to.equal(2);
      expect(result.primaryContext).to.not.be.null;
    });

    it('should throw error for invalid input', async () => {
      try {
        await mechanism.processInput(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid input');
      }

      try {
        await mechanism.processInput({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid input');
      }
    });

    it('should check security access before processing', async () => {
      mockSecurityManager.validateAccess.returns(false);
      
      const input = {
        id: 'test-input',
        content: 'Test content'
      };
      
      const result = await mechanism.processInput(input);
      
      // Should return safe default result
      expect(result).to.be.an('object');
      expect(result.contexts).to.be.an('array');
      expect(result.contexts.length).to.equal(0);
      expect(mockLogger.warn.calledWith(sinon.match(/Unauthorized/))).to.be.true;
    });
  });
  
  describe('Cross-Context Reasoning', () => {
    it('should perform reasoning across active contexts', async () => {
      // Activate multiple contexts
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        },
        {
          id: 'context-2',
          type: ContextType.SPATIAL,
          name: 'New York Context',
          confidence: 0.7,
          attributes: { location: 'New York' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Perform cross-context reasoning
      const input = {
        id: 'test-input',
        content: 'Test content about technology in New York'
      };
      
      const result = await mechanism.performCrossContextReasoning(input);
      
      expect(result).to.be.an('object');
      expect(result.reasoningId).to.be.a('string');
      expect(result.conclusion).to.be.a('string');
      expect(result.confidence).to.be.a('number');
      expect(result.contexts).to.be.an('array');
      expect(result.contexts.length).to.equal(2);
      expect(result.crossContextInsights).to.be.an('array');
      expect(result.timestamp).to.be.a('number');
    });
    
    it('should use hierarchical reasoning when no active contexts', async () => {
      // Perform cross-context reasoning with no active contexts
      const input = {
        id: 'test-input',
        content: 'Test content'
      };
      
      const result = await mechanism.performCrossContextReasoning(input);
      
      expect(result).to.be.an('object');
      expect(result.reasoningId).to.be.a('string');
      expect(result.conclusion).to.be.a('string');
      expect(result.confidence).to.be.a('number');
      expect(result.contexts).to.be.an('array');
      expect(result.contexts.length).to.equal(0);
      expect(result.crossContextInsights).to.be.an('array');
      expect(result.crossContextInsights.length).to.equal(0);
    });
    
    it('should use hierarchical reasoning when only one active context', async () => {
      // Activate a single context
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Perform cross-context reasoning
      const input = {
        id: 'test-input',
        content: 'Test content about technology'
      };
      
      const result = await mechanism.performCrossContextReasoning(input);
      
      expect(result).to.be.an('object');
      expect(result.reasoningId).to.be.a('string');
      expect(result.conclusion).to.be.a('string');
      expect(result.confidence).to.be.a('number');
      expect(result.contexts).to.be.an('array');
      expect(result.contexts.length).to.equal(1);
      expect(result.crossContextInsights).to.be.an('array');
      expect(result.crossContextInsights.length).to.equal(0);
    });
    
    it('should generate cross-context insights when multiple contexts are active', async () => {
      // Mock hierarchical reasoning to return different conclusions for different contexts
      mockHierarchicalReasoningFramework.reason.callsFake((input, options) => {
        if (options.contextInfo?.id === 'context-1') {
          return Promise.resolve({
            reasoningId: 'reasoning-1',
            conclusion: 'Technology conclusion',
            confidence: 0.8,
            explanation: 'Technology explanation'
          });
        } else if (options.contextInfo?.id === 'context-2') {
          return Promise.resolve({
            reasoningId: 'reasoning-2',
            conclusion: 'New York conclusion',
            confidence: 0.7,
            explanation: 'New York explanation'
          });
        } else {
          return Promise.resolve({
            reasoningId: 'reasoning-default',
            conclusion: 'Default conclusion',
            confidence: 0.6,
            explanation: 'Default explanation'
          });
        }
      });
      
      // Activate multiple contexts
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        },
        {
          id: 'context-2',
          type: ContextType.SPATIAL,
          name: 'New York Context',
          confidence: 0.7,
          attributes: { location: 'New York' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      
      // Perform cross-context reasoning
      const input = {
        id: 'test-input',
        content: 'Test content about technology in New York'
      };
      
      const result = await mechanism.performCrossContextReasoning(input);
      
      expect(result.crossContextInsights).to.be.an('array');
      expect(result.crossContextInsights.length).to.be.at.least(1);
    });

    it('should throw error for invalid input', async () => {
      try {
        await mechanism.performCrossContextReasoning(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid input');
      }

      try {
        await mechanism.performCrossContextReasoning({});
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid input');
      }
    });

    it('should check security access before reasoning', async () => {
      mockSecurityManager.validateAccess.returns(false);
      
      const input = {
        id: 'test-input',
        content: 'Test content'
      };
      
      try {
        await mechanism.performCrossContextReasoning(input);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Access denied');
        expect(mockLogger.warn.calledWith(sinon.match(/Unauthorized/))).to.be.true;
      }
    });
  });

  describe('Disposal', () => {
    it('should clean up resources when disposed', () => {
      // Activate contexts and populate memory
      const contexts = [
        {
          id: 'context-1',
          type: ContextType.DOMAIN,
          name: 'Technology Context',
          confidence: 0.8,
          attributes: { domain: 'technology' },
          timestamp: Date.now()
        }
      ];
      
      mechanism.activateContexts(contexts);
      mechanism.deactivateContexts(['context-1'], { storeInMemory: true });
      
      // Verify resources are populated
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(mechanism.contextMemory.size).to.equal(1);
      
      // Dispose
      mechanism.dispose();
      
      // Verify resources are cleaned up
      expect(mechanism.activeContexts.size).to.equal(0);
      expect(mechanism.contextMemory.size).to.equal(0);
      expect(mechanism.contextCache.size).to.equal(0);
      expect(mockLogger.info.calledWith(sinon.match(/Disposing/))).to.be.true;
    });
  });
});
