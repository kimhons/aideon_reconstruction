/**
 * @fileoverview Unit tests for the CausalAnalyzer component.
 * 
 * These tests verify the functionality of the CausalAnalyzer component,
 * including error analysis, strategy selection, result consolidation,
 * caching, and error handling.
 */

const assert = require('assert');
const { describe, it, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');
const EventEmitter = require('events');

// Import the component to test
const CausalAnalyzer = require('../../../src/core/error_recovery/CausalAnalyzer');

describe('CausalAnalyzer', () => {
  let analyzer;
  let mockEventEmitter;
  let mockMetrics;
  let mockLogger;
  let clock;
  
  beforeEach(() => {
    // Set up a fake timer for predictable timestamps
    clock = sinon.useFakeTimers({
      now: new Date('2025-06-04T12:00:00Z'),
      shouldAdvanceTime: true
    });
    
    // Create mocks
    mockEventEmitter = new EventEmitter();
    mockMetrics = {
      recordMetric: sinon.stub(),
      incrementCounter: sinon.stub()
    };
    mockLogger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
    
    // Create the analyzer with mocks
    analyzer = new CausalAnalyzer({
      eventEmitter: mockEventEmitter,
      metrics: mockMetrics,
      logger: mockLogger
    });
  });
  
  afterEach(() => {
    // Restore the clock
    clock.restore();
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should initialize with default values when no options provided', () => {
      const defaultAnalyzer = new CausalAnalyzer();
      assert.ok(defaultAnalyzer.eventEmitter instanceof EventEmitter);
      assert.strictEqual(defaultAnalyzer.cacheMaxSize, 1000);
      assert.strictEqual(defaultAnalyzer.cacheExpirationMs, 3600000);
      assert.ok(defaultAnalyzer.analysisStrategies.size > 0);
    });
    
    it('should use provided options', () => {
      const customAnalyzer = new CausalAnalyzer({
        cacheMaxSize: 500,
        cacheExpirationMs: 1800000,
        logger: mockLogger
      });
      assert.strictEqual(customAnalyzer.cacheMaxSize, 500);
      assert.strictEqual(customAnalyzer.cacheExpirationMs, 1800000);
      assert.strictEqual(customAnalyzer.logger, mockLogger);
    });
    
    it('should register default strategies', () => {
      assert.ok(analyzer.analysisStrategies.has('event-correlation'));
      assert.ok(analyzer.analysisStrategies.has('dependency-analysis'));
      assert.ok(analyzer.analysisStrategies.has('state-analysis'));
      assert.ok(analyzer.analysisStrategies.has('pattern-matching'));
    });
  });
  
  describe('generateAnalysisId', () => {
    it('should generate a consistent ID for the same error and context', () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      const id1 = analyzer.generateAnalysisId(error, context);
      const id2 = analyzer.generateAnalysisId(error, context);
      
      assert.strictEqual(id1, id2);
    });
    
    it('should generate different IDs for different errors', () => {
      const error1 = new Error('Test error 1');
      const error2 = new Error('Test error 2');
      const context = { source: 'test' };
      
      const id1 = analyzer.generateAnalysisId(error1, context);
      const id2 = analyzer.generateAnalysisId(error2, context);
      
      assert.notStrictEqual(id1, id2);
    });
    
    it('should generate different IDs for different contexts', () => {
      const error = new Error('Test error');
      const context1 = { source: 'test1' };
      const context2 = { source: 'test2' };
      
      const id1 = analyzer.generateAnalysisId(error, context1);
      const id2 = analyzer.generateAnalysisId(error, context2);
      
      assert.notStrictEqual(id1, id2);
    });
  });
  
  describe('caching', () => {
    it('should cache analysis results', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Mock the analysis methods to avoid full execution
      sinon.stub(analyzer, 'prepareAnalysisContext').resolves({});
      sinon.stub(analyzer, 'selectAnalysisStrategies').returns([]);
      sinon.stub(analyzer, 'executeAnalysisStrategies').resolves([]);
      sinon.stub(analyzer, 'consolidateResults').returns({
        rootCauses: [{ type: 'TEST', description: 'Test cause', confidence: 0.8 }],
        confidence: 0.8
      });
      sinon.stub(analyzer, 'enrichWithSemanticKnowledge').callsFake(result => Promise.resolve(result));
      sinon.stub(analyzer, 'validateAnalysisResult').callsFake(result => result);
      
      // First call should execute analysis
      await analyzer.analyzeError(error, context);
      
      // Reset stubs to verify they're not called again
      analyzer.prepareAnalysisContext.reset();
      analyzer.executeAnalysisStrategies.reset();
      
      // Second call should use cache
      await analyzer.analyzeError(error, context);
      
      assert.strictEqual(analyzer.prepareAnalysisContext.called, false);
      assert.strictEqual(analyzer.executeAnalysisStrategies.called, false);
      assert(mockMetrics.incrementCounter.calledWith('causal_analysis_cache_hit'));
    });
    
    it('should not use expired cache entries', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Mock the analysis methods
      sinon.stub(analyzer, 'prepareAnalysisContext').resolves({});
      sinon.stub(analyzer, 'selectAnalysisStrategies').returns([]);
      sinon.stub(analyzer, 'executeAnalysisStrategies').resolves([]);
      sinon.stub(analyzer, 'consolidateResults').returns({
        rootCauses: [{ type: 'TEST', description: 'Test cause', confidence: 0.8 }],
        confidence: 0.8
      });
      sinon.stub(analyzer, 'enrichWithSemanticKnowledge').callsFake(result => Promise.resolve(result));
      sinon.stub(analyzer, 'validateAnalysisResult').callsFake(result => result);
      
      // First call should execute analysis
      await analyzer.analyzeError(error, context);
      
      // Advance time beyond cache expiration
      clock.tick(analyzer.cacheExpirationMs + 1000);
      
      // Reset stubs to verify they're called again
      analyzer.prepareAnalysisContext.reset();
      analyzer.executeAnalysisStrategies.reset();
      
      // Second call should not use cache
      await analyzer.analyzeError(error, context);
      
      assert.strictEqual(analyzer.prepareAnalysisContext.called, true);
      assert.strictEqual(analyzer.executeAnalysisStrategies.called, true);
      assert(mockMetrics.incrementCounter.calledWith('causal_analysis_cache_miss'));
    });
    
    it('should respect the useCache option', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Mock the analysis methods
      sinon.stub(analyzer, 'prepareAnalysisContext').resolves({});
      sinon.stub(analyzer, 'selectAnalysisStrategies').returns([]);
      sinon.stub(analyzer, 'executeAnalysisStrategies').resolves([]);
      sinon.stub(analyzer, 'consolidateResults').returns({
        rootCauses: [{ type: 'TEST', description: 'Test cause', confidence: 0.8 }],
        confidence: 0.8
      });
      sinon.stub(analyzer, 'enrichWithSemanticKnowledge').callsFake(result => Promise.resolve(result));
      sinon.stub(analyzer, 'validateAnalysisResult').callsFake(result => result);
      
      // First call should execute analysis and cache the result
      await analyzer.analyzeError(error, context);
      
      // Reset stubs to verify they're called again
      analyzer.prepareAnalysisContext.reset();
      analyzer.executeAnalysisStrategies.reset();
      
      // Second call with useCache=false should not use cache
      await analyzer.analyzeError(error, context, { useCache: false });
      
      assert.strictEqual(analyzer.prepareAnalysisContext.called, true);
      assert.strictEqual(analyzer.executeAnalysisStrategies.called, true);
    });
    
    it('should evict old entries when cache is full', async () => {
      // Create analyzer with small cache size
      const smallCacheAnalyzer = new CausalAnalyzer({
        cacheMaxSize: 2,
        logger: mockLogger
      });
      
      // Mock methods to avoid full execution
      sinon.stub(smallCacheAnalyzer, 'prepareAnalysisContext').resolves({});
      sinon.stub(smallCacheAnalyzer, 'selectAnalysisStrategies').returns([]);
      sinon.stub(smallCacheAnalyzer, 'executeAnalysisStrategies').resolves([]);
      sinon.stub(smallCacheAnalyzer, 'consolidateResults').returns({
        rootCauses: [{ type: 'TEST', description: 'Test cause', confidence: 0.8 }],
        confidence: 0.8
      });
      sinon.stub(smallCacheAnalyzer, 'enrichWithSemanticKnowledge').callsFake(result => Promise.resolve(result));
      sinon.stub(smallCacheAnalyzer, 'validateAnalysisResult').callsFake(result => result);
      
      // Fill the cache
      await smallCacheAnalyzer.analyzeError(new Error('Error 1'), { source: 'test1' });
      await smallCacheAnalyzer.analyzeError(new Error('Error 2'), { source: 'test2' });
      
      // This should evict the first entry
      await smallCacheAnalyzer.analyzeError(new Error('Error 3'), { source: 'test3' });
      
      // Check if the first entry was evicted
      const error1 = new Error('Error 1');
      const context1 = { source: 'test1' };
      
      // Reset stubs to verify they're called again for the evicted entry
      smallCacheAnalyzer.prepareAnalysisContext.reset();
      
      // Should execute analysis again for the first error
      await smallCacheAnalyzer.analyzeError(error1, context1);
      
      assert.strictEqual(smallCacheAnalyzer.prepareAnalysisContext.called, true);
    });
  });
  
  describe('classifyError', () => {
    it('should classify TypeError correctly', () => {
      const error = new TypeError('Invalid type');
      const classification = analyzer.classifyError(error, {});
      
      assert.strictEqual(classification.type, 'programming');
      assert.strictEqual(classification.severity, 'high');
    });
    
    it('should classify connection errors correctly', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const classification = analyzer.classifyError(error, {});
      
      assert.strictEqual(classification.type, 'connection');
      assert.strictEqual(classification.severity, 'high');
    });
    
    it('should classify timeout errors correctly', () => {
      const error = new Error('Operation timed out');
      error.code = 'ETIMEDOUT';
      const classification = analyzer.classifyError(error, {});
      
      assert.strictEqual(classification.type, 'timeout');
      assert.strictEqual(classification.severity, 'high');
    });
    
    it('should classify database errors correctly', () => {
      const error = new Error('Database connection failed');
      const classification = analyzer.classifyError(error, {});
      
      assert.strictEqual(classification.type, 'database');
      assert.strictEqual(classification.severity, 'high');
    });
    
    it('should classify validation errors correctly', () => {
      const error = new Error('Validation failed: Invalid input');
      const classification = analyzer.classifyError(error, {});
      
      assert.strictEqual(classification.type, 'validation');
      assert.strictEqual(classification.severity, 'medium');
    });
    
    it('should use source for domain classification', () => {
      const error = new Error('Test error');
      const context = { source: 'frontend' };
      const classification = analyzer.classifyError(error, context);
      
      assert.strictEqual(classification.domain, 'frontend');
    });
    
    it('should handle critical errors correctly', () => {
      const error = new Error('Critical system failure');
      error.critical = true;
      const classification = analyzer.classifyError(error, {});
      
      assert.strictEqual(classification.severity, 'critical');
    });
  });
  
  describe('selectAnalysisStrategies', () => {
    it('should select strategies based on error type', () => {
      const error = new Error('Connection failed');
      const context = { errorClassification: { type: 'connection' } };
      
      const strategies = analyzer.selectAnalysisStrategies(error, context, {});
      
      // Should include event-correlation, dependency-analysis, and pattern-matching
      assert.strictEqual(strategies.length, 3);
      assert.ok(strategies.some(s => s.id === 'event-correlation'));
      assert.ok(strategies.some(s => s.id === 'dependency-analysis'));
      assert.ok(strategies.some(s => s.id === 'pattern-matching'));
    });
    
    it('should select state analysis for state errors', () => {
      const error = new Error('Invalid state');
      const context = { errorClassification: { type: 'state' } };
      
      const strategies = analyzer.selectAnalysisStrategies(error, context, {});
      
      assert.ok(strategies.some(s => s.id === 'state-analysis'));
    });
    
    it('should use specified strategies if provided', () => {
      const error = new Error('Test error');
      const context = {};
      const options = { strategies: ['pattern-matching'] };
      
      const strategies = analyzer.selectAnalysisStrategies(error, context, options);
      
      assert.strictEqual(strategies.length, 1);
      assert.strictEqual(strategies[0].id, 'pattern-matching');
    });
    
    it('should warn about unknown strategies', () => {
      const error = new Error('Test error');
      const context = {};
      const options = { strategies: ['unknown-strategy'] };
      
      analyzer.selectAnalysisStrategies(error, context, options);
      
      assert(mockLogger.warn.calledWith('Strategy not found: unknown-strategy'));
    });
  });
  
  describe('analyzeError', () => {
    it('should complete the full analysis pipeline', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Create a real strategy for testing
      const mockStrategy = {
        id: 'test-strategy',
        analyze: sinon.stub().resolves({
          strategyId: 'test-strategy',
          rootCauses: [{ type: 'TEST', description: 'Test cause', confidence: 0.8 }],
          confidence: 0.8
        })
      };
      
      analyzer.analysisStrategies.set('test-strategy', mockStrategy);
      
      // Spy on internal methods
      const prepareContextSpy = sinon.spy(analyzer, 'prepareAnalysisContext');
      const selectStrategiesSpy = sinon.spy(analyzer, 'selectAnalysisStrategies');
      const executeStrategiesSpy = sinon.spy(analyzer, 'executeAnalysisStrategies');
      const consolidateResultsSpy = sinon.spy(analyzer, 'consolidateResults');
      const enrichSpy = sinon.spy(analyzer, 'enrichWithSemanticKnowledge');
      const validateSpy = sinon.spy(analyzer, 'validateAnalysisResult');
      
      // Force selection of our test strategy
      sinon.stub(analyzer, 'selectAnalysisStrategies').returns([mockStrategy]);
      
      // Execute analysis
      const result = await analyzer.analyzeError(error, context);
      
      // Verify the pipeline was executed
      assert(prepareContextSpy.calledOnce);
      assert(selectStrategiesSpy.calledOnce);
      assert(executeStrategiesSpy.calledOnce);
      assert(consolidateResultsSpy.calledOnce);
      assert(enrichSpy.calledOnce);
      assert(validateSpy.calledOnce);
      
      // Verify the result
      assert.ok(result.analysisId);
      assert.ok(result.timestamp);
      assert.ok(result.rootCauses);
      assert.strictEqual(result.rootCauses.length, 1);
      assert.strictEqual(result.rootCauses[0].type, 'TEST');
      assert.strictEqual(result.confidence, 0.8);
      
      // Verify events were emitted
      assert(mockMetrics.recordMetric.calledWith('causal_analysis_duration_ms'));
      assert(mockMetrics.incrementCounter.calledWith('causal_analysis_completed_total'));
    });
    
    it('should handle analysis errors and return fallback result', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Force an error during analysis
      sinon.stub(analyzer, 'prepareAnalysisContext').throws(new Error('Analysis failed'));
      
      // Execute analysis
      const result = await analyzer.analyzeError(error, context);
      
      // Verify fallback result
      assert.ok(result.analysisId);
      assert.ok(result.timestamp);
      assert.strictEqual(result.rootCauses.length, 1);
      assert.strictEqual(result.rootCauses[0].type, 'ANALYSIS_FAILURE');
      assert.strictEqual(result.confidence, 0);
      
      // Verify error was logged
      assert(mockLogger.error.called);
      assert(mockMetrics.incrementCounter.calledWith('causal_analysis_error_total'));
    });
    
    it('should handle analysis timeout', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Create a strategy that never resolves
      const hangingStrategy = {
        id: 'hanging-strategy',
        analyze: () => new Promise(() => {}) // Never resolves
      };
      
      analyzer.analysisStrategies.set('hanging-strategy', hangingStrategy);
      sinon.stub(analyzer, 'selectAnalysisStrategies').returns([hangingStrategy]);
      
      // Execute analysis with short timeout
      const result = await analyzer.analyzeError(error, context, { timeout: 100 });
      
      // Advance clock to trigger timeout
      clock.tick(200);
      
      // Verify fallback result
      assert.strictEqual(result.rootCauses[0].type, 'ANALYSIS_FAILURE');
      assert.strictEqual(result.confidence, 0);
    });
    
    it('should emit appropriate events during analysis', async () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      
      // Track emitted events
      const emittedEvents = [];
      mockEventEmitter.on('analysis:started', (data) => emittedEvents.push({ event: 'started', data }));
      mockEventEmitter.on('analysis:completed', (data) => emittedEvents.push({ event: 'completed', data }));
      
      // Mock internal methods to simplify test
      sinon.stub(analyzer, 'prepareAnalysisContext').resolves({});
      sinon.stub(analyzer, 'selectAnalysisStrategies').returns([]);
      sinon.stub(analyzer, 'executeAnalysisStrategies').resolves([]);
      sinon.stub(analyzer, 'consolidateResults').returns({
        rootCauses: [{ type: 'TEST', description: 'Test cause', confidence: 0.8 }],
        confidence: 0.8
      });
      sinon.stub(analyzer, 'enrichWithSemanticKnowledge').callsFake(result => Promise.resolve(result));
      sinon.stub(analyzer, 'validateAnalysisResult').callsFake(result => result);
      
      // Execute analysis
      await analyzer.analyzeError(error, context);
      
      // Verify events
      assert.strictEqual(emittedEvents.length, 2);
      assert.strictEqual(emittedEvents[0].event, 'started');
      assert.strictEqual(emittedEvents[1].event, 'completed');
      assert.ok(emittedEvents[0].data.analysisId);
      assert.ok(emittedEvents[1].data.result);
    });
  });
  
  describe('mergeRootCauses', () => {
    it('should merge duplicate root causes', () => {
      const rootCauses = [
        { type: 'ERROR_A', description: 'Description A', confidence: 0.7, details: { source: 'strategy1' } },
        { type: 'ERROR_A', description: 'Description A', confidence: 0.8, details: { extra: 'info' } },
        { type: 'ERROR_B', description: 'Description B', confidence: 0.6 }
      ];
      
      const merged = analyzer.mergeRootCauses(rootCauses);
      
      assert.strictEqual(merged.length, 2);
      
      // Find the merged ERROR_A
      const mergedA = merged.find(c => c.type === 'ERROR_A');
      assert.ok(mergedA);
      assert.strictEqual(mergedA.confidence, 0.8); // Should take the higher confidence
      assert.ok(mergedA.details.source); // Should merge details
      assert.ok(mergedA.details.extra);
    });
    
    it('should handle empty input', () => {
      const merged = analyzer.mergeRootCauses([]);
      assert.strictEqual(merged.length, 0);
    });
  });
  
  describe('calculateOverallConfidence', () => {
    it('should return max confidence from root causes', () => {
      const rootCauses = [
        { type: 'ERROR_A', confidence: 0.7 },
        { type: 'ERROR_B', confidence: 0.9 },
        { type: 'ERROR_C', confidence: 0.5 }
      ];
      
      const confidence = analyzer.calculateOverallConfidence([], rootCauses);
      
      assert.strictEqual(confidence, 0.9);
    });
    
    it('should return 0 for empty root causes', () => {
      const confidence = analyzer.calculateOverallConfidence([], []);
      assert.strictEqual(confidence, 0);
    });
  });
  
  describe('generateFallbackResult', () => {
    it('should create a valid fallback result', () => {
      const error = new Error('Original error');
      const context = { source: 'test' };
      const analysisError = new Error('Analysis failed');
      
      const fallback = analyzer.generateFallbackResult(error, context, analysisError);
      
      assert.ok(fallback.analysisId);
      assert.ok(fallback.timestamp);
      assert.strictEqual(fallback.error.message, 'Original error');
      assert.strictEqual(fallback.rootCauses.length, 1);
      assert.strictEqual(fallback.rootCauses[0].type, 'ANALYSIS_FAILURE');
      assert.strictEqual(fallback.confidence, 0);
    });
  });
  
  describe('generateRecoveryHints', () => {
    it('should generate appropriate hints for network timeout', () => {
      const rootCauses = [
        { type: 'NETWORK_TIMEOUT', description: 'Network timeout', confidence: 0.8 }
      ];
      const error = new Error('Timeout');
      const context = { source: 'service-a' };
      
      const hints = analyzer.generateRecoveryHints(rootCauses, error, context);
      
      assert.ok(hints.length > 0);
      assert.ok(hints.some(h => h.type === 'INCREASE_TIMEOUT'));
      assert.ok(hints.some(h => h.type === 'CHECK_NETWORK'));
    });
    
    it('should generate appropriate hints for database errors', () => {
      const rootCauses = [
        { type: 'DB_CONNECTION_ERROR', description: 'Database connection failed', confidence: 0.8 }
      ];
      const error = new Error('DB error');
      const context = {};
      
      const hints = analyzer.generateRecoveryHints(rootCauses, error, context);
      
      assert.ok(hints.length > 0);
      assert.ok(hints.some(h => h.type === 'RESTART_DB_POOL'));
      assert.ok(hints.some(h => h.type === 'CHECK_DB_STATUS'));
    });
    
    it('should suggest manual investigation for low confidence', () => {
      const rootCauses = [
        { type: 'UNKNOWN', description: 'Unknown error', confidence: 0.2 }
      ];
      const error = new Error('Strange error');
      const context = {};
      
      const hints = analyzer.generateRecoveryHints(rootCauses, error, context);
      
      assert.ok(hints.some(h => h.type === 'MANUAL_INVESTIGATION'));
    });
  });
  
  describe('identifyAffectedComponents', () => {
    it('should identify components from context source', () => {
      const error = new Error('Test error');
      const context = { source: 'service-a' };
      const rootCauses = [];
      
      const affected = analyzer.identifyAffectedComponents(error, context, rootCauses);
      
      assert.strictEqual(affected.length, 1);
      assert.strictEqual(affected[0], 'service-a');
    });
    
    it('should identify components from root causes', () => {
      const error = new Error('Test error');
      const context = {};
      const rootCauses = [
        { 
          type: 'DEPENDENCY_FAILURE', 
          details: { 
            failedDependencies: [
              { name: 'database' },
              { name: 'cache' }
            ]
          }
        }
      ];
      
      const affected = analyzer.identifyAffectedComponents(error, context, rootCauses);
      
      assert.strictEqual(affected.length, 2);
      assert.ok(affected.includes('database'));
      assert.ok(affected.includes('cache'));
    });
    
    it('should deduplicate affected components', () => {
      const error = new Error('Test error');
      const context = { source: 'service-a' };
      const rootCauses = [
        { 
          type: 'DEPENDENCY_FAILURE', 
          details: { 
            failedDependencies: [
              { name: 'service-a' }, // Duplicate of context source
              { name: 'database' }
            ]
          }
        }
      ];
      
      const affected = analyzer.identifyAffectedComponents(error, context, rootCauses);
      
      assert.strictEqual(affected.length, 2);
      assert.ok(affected.includes('service-a'));
      assert.ok(affected.includes('database'));
    });
  });
  
  describe('integration', () => {
    it('should handle a typical error scenario end-to-end', async () => {
      // Create a realistic error scenario
      const error = new Error('Database connection failed: timeout');
      error.code = 'ETIMEDOUT';
      error.stack = 'Error: Database connection failed: timeout\n    at Connection.connect (/app/db.js:42:10)';
      
      const context = {
        source: 'database-service',
        systemState: {
          components: [
            { name: 'database-service', status: 'degraded', state: 'inconsistent' }
          ]
        },
        recentEvents: [
          { timestamp: Date.now() - 30000, type: 'CONNECTION_ATTEMPT', component: 'database-service' },
          { timestamp: Date.now() - 15000, type: 'TIMEOUT', component: 'database-service' }
        ],
        dependencies: [
          { name: 'postgres', type: 'database', status: 'unhealthy' }
        ]
      };
      
      // Use real strategies for this test
      analyzer.analysisStrategies.clear();
      analyzer.registerDefaultStrategies();
      
      // Execute analysis
      const result = await analyzer.analyzeError(error, context);
      
      // Verify the result contains meaningful information
      assert.ok(result.analysisId);
      assert.ok(result.timestamp);
      assert.ok(result.rootCauses.length > 0);
      assert.ok(result.confidence > 0);
      assert.ok(result.recoveryHints.length > 0);
      
      // Verify we detected the database issue
      const databaseCause = result.rootCauses.find(c => 
        c.type === 'DB_CONNECTION_ERROR' || 
        c.type === 'DEPENDENCY_FAILURE' ||
        c.type === 'NETWORK_TIMEOUT'
      );
      assert.ok(databaseCause, 'Should detect database connection issue');
      
      // Verify affected components
      assert.ok(result.context.affectedComponents.includes('database-service'));
      assert.ok(result.context.affectedComponents.includes('postgres'));
      
      // Verify error classification
      assert.ok(['timeout', 'connection', 'database'].includes(result.context.errorClassification.type));
      assert.strictEqual(result.context.errorClassification.severity, 'high');
      assert.strictEqual(result.context.errorClassification.domain, 'database');
    });
  });
});
