/**
 * @fileoverview Integration test for MultiContextUnderstandingMechanism with other cognitive components
 * @author Aideon AI
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');

// Import mocks
const Logger = require('./mocks/Logger');
const SecurityManager = require('./mocks/SecurityManager');
const PerformanceMonitor = require('./mocks/PerformanceMonitor');
const ConfigurationService = require('./mocks/ConfigurationService');
const AbstractionLayerManager = require('./mocks/AbstractionLayerManager');
const HierarchicalReasoningFramework = require('./mocks/HierarchicalReasoningFramework');
const MultiContextUnderstandingMechanism = require('./mocks/MultiContextUnderstandingMechanism');

describe('MultiContextUnderstandingMechanism Integration Tests', () => {
  let multiContextMechanism;
  let hierarchicalReasoning;
  let abstractionLayerManager;
  let logger;
  let securityManager;
  let performanceMonitor;
  let configService;
  
  beforeEach(() => {
    // Initialize dependencies
    logger = new Logger({ level: 'info', module: 'IntegrationTest' });
    securityManager = new SecurityManager();
    performanceMonitor = new PerformanceMonitor();
    configService = new ConfigurationService();
    
    // Initialize core cognitive components
    abstractionLayerManager = new AbstractionLayerManager({
      logger,
      securityManager,
      performanceMonitor,
      configService
    });
    
    hierarchicalReasoning = new HierarchicalReasoningFramework({
      logger,
      securityManager,
      performanceMonitor,
      configService,
      abstractionLayerManager
    });
    
    // Initialize MultiContextUnderstandingMechanism with dependencies
    multiContextMechanism = new MultiContextUnderstandingMechanism({
      logger,
      securityManager,
      performanceMonitor,
      configService,
      hierarchicalReasoning,
      abstractionLayerManager
    });
  });
  
  afterEach(() => {
    // Clean up resources
    sinon.restore();
    if (multiContextMechanism) {
      multiContextMechanism.dispose();
    }
    if (hierarchicalReasoning) {
      hierarchicalReasoning.dispose();
    }
    if (abstractionLayerManager) {
      abstractionLayerManager.dispose();
    }
  });
  
  describe('Cross-Component Integration', () => {
    it('should integrate with HierarchicalReasoningFramework for fallback reasoning', () => {
      // Spy on hierarchicalReasoning.reason method
      const reasonSpy = sinon.spy(hierarchicalReasoning, 'reason');
      
      // Process input with no active contexts
      const input = { query: 'What is the capital of France?' };
      multiContextMechanism.processInput(input);
      
      // Verify hierarchicalReasoning.reason was called
      expect(reasonSpy.calledOnce).to.be.true;
      expect(reasonSpy.firstCall.args[0]).to.deep.equal(input);
    });
    
    it('should integrate with AbstractionLayerManager for context processing', () => {
      // Spy on abstractionLayerManager.processData method
      const processDataSpy = sinon.spy(abstractionLayerManager, 'processData');
      
      // Identify contexts in input data
      const input = { text: 'The weather in Paris is sunny today.' };
      multiContextMechanism.identifyContexts(input);
      
      // Verify abstractionLayerManager.processData was called
      expect(processDataSpy.called).to.be.true;
    });
    
    it('should handle security validation across components', () => {
      // Spy on securityManager.validateAccess method
      const validateAccessSpy = sinon.spy(securityManager, 'validateAccess');
      
      // Perform operations that require security validation
      multiContextMechanism.identifyContexts({ text: 'Test data' });
      multiContextMechanism.processInput({ query: 'Test query' });
      
      // Verify securityManager.validateAccess was called multiple times
      expect(validateAccessSpy.callCount).to.be.at.least(2);
    });
    
    it('should track performance metrics across components', () => {
      // Spy on performanceMonitor.startTimer and stopTimer methods
      const startTimerSpy = sinon.spy(performanceMonitor, 'startTimer');
      const stopTimerSpy = sinon.spy(performanceMonitor, 'stopTimer');
      
      // Perform operations that should be performance monitored
      multiContextMechanism.identifyContexts({ text: 'Test data' });
      multiContextMechanism.processInput({ query: 'Test query' });
      
      // Verify performance monitoring was used
      expect(startTimerSpy.called).to.be.true;
      expect(stopTimerSpy.called).to.be.true;
    });
  });
  
  describe('End-to-End Workflows', () => {
    it('should handle multi-context processing end-to-end', () => {
      // Activate multiple contexts
      multiContextMechanism.activateContexts([
        { id: 'ctx1', type: 'domain', data: { domain: 'finance' }, confidence: 0.9 },
        { id: 'ctx2', type: 'temporal', data: { timeframe: 'current' }, confidence: 0.8 }
      ]);
      
      // Process input through multiple contexts
      const result = multiContextMechanism.processInput({ 
        query: 'What are the current market trends?'
      });
      
      // Verify result contains blended insights from multiple contexts
      expect(result).to.have.property('processedOutput');
      expect(result).to.have.property('activeContexts');
      expect(result.activeContexts.length).to.equal(2);
    });
    
    it('should handle context switching in complex workflows', () => {
      // Initial context
      multiContextMechanism.activateContexts([
        { id: 'ctx1', type: 'domain', data: { domain: 'finance' }, confidence: 0.9 }
      ]);
      
      // First processing
      let result = multiContextMechanism.processInput({ 
        query: 'What are the current market trends?'
      });
      
      // Context switch
      multiContextMechanism.deactivateContexts(['ctx1']);
      multiContextMechanism.activateContexts([
        { id: 'ctx2', type: 'domain', data: { domain: 'technology' }, confidence: 0.9 }
      ]);
      
      // Second processing with new context
      result = multiContextMechanism.processInput({ 
        query: 'What are the latest innovations?'
      });
      
      // Verify context switch was successful
      expect(result.activeContexts[0].id).to.equal('ctx2');
      expect(result.activeContexts[0].data.domain).to.equal('technology');
    });
  });
});
