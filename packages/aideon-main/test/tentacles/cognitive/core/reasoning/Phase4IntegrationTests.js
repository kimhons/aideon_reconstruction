/**
 * @fileoverview Integration tests for Phase 4 components of the Reasoning Engine.
 * 
 * These tests validate the integration between ModelStrategyManager, 
 * TentacleIntegrationFramework, and SecurityIntegrationLayer, ensuring they
 * work together seamlessly as a cohesive system.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI
 * @license Proprietary
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { v4: uuidv4 } = require('uuid');

// Core components
const ReasoningEngine = require('../../../../src/tentacles/cognitive/core/reasoning/ReasoningEngine');
const ModelStrategyManager = require('../../../../src/tentacles/cognitive/core/reasoning/ModelStrategyManager');
const TentacleIntegrationFramework = require('../../../../src/tentacles/cognitive/core/reasoning/TentacleIntegrationFramework');
const SecurityIntegrationLayer = require('../../../../src/tentacles/cognitive/core/reasoning/SecurityIntegrationLayer');

// Common services
const Logger = require('../../../../src/common/logging/Logger');
const ConfigurationService = require('../../../../src/common/config/ConfigurationService');
const PerformanceMonitor = require('../../../../src/common/performance/PerformanceMonitor');
const SecurityManager = require('../../../../src/common/security/SecurityManager');
const UserManager = require('../../../../src/common/user/UserManager');
const SubscriptionManager = require('../../../../src/common/subscription/SubscriptionManager');
const AuditLogger = require('../../../../src/common/logging/AuditLogger');
const GlobalContextManager = require('../../../../src/common/context/GlobalContextManager');

// Test utilities
const TestUtils = require('../../../utils/TestUtils');
const MockModelProvider = require('../../../mocks/MockModelProvider');
const MockTentacle = require('../../../mocks/MockTentacle');
const MockUser = require('../../../mocks/MockUser');
const MockSubscription = require('../../../mocks/MockSubscription');

describe('Reasoning Engine Phase 4 Integration Tests', function() {
  // Test timeout
  this.timeout(10000);
  
  // Test components
  let reasoningEngine;
  let modelStrategyManager;
  let tentacleIntegrationFramework;
  let securityIntegrationLayer;
  
  // Common services
  let logger;
  let configService;
  let performanceMonitor;
  let securityManager;
  let userManager;
  let subscriptionManager;
  let auditLogger;
  let contextManager;
  
  // Test data
  let testUser;
  let testTentacle;
  let testSubscription;
  
  // Sandbox for stubs and spies
  let sandbox;
  
  beforeEach(async function() {
    // Create sandbox
    sandbox = sinon.createSandbox();
    
    // Initialize common services
    logger = new Logger({ level: 'error' });
    configService = new ConfigurationService();
    performanceMonitor = new PerformanceMonitor();
    securityManager = new SecurityManager();
    userManager = new UserManager();
    subscriptionManager = new SubscriptionManager();
    auditLogger = new AuditLogger();
    contextManager = new GlobalContextManager();
    
    // Create test data
    testUser = new MockUser({
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      roles: ['user'],
      createdAt: new Date()
    });
    
    testTentacle = new MockTentacle({
      id: 'test-tentacle-1',
      name: 'Test Tentacle',
      requestTypes: ['deductive', 'inductive', 'abductive', 'analogical'],
      version: '1.0.0',
      apiVersion: '1.0.0',
      priority: 5
    });
    
    testSubscription = new MockSubscription({
      id: 'test-subscription-1',
      userId: testUser.id,
      tier: 'pro',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
    
    // Stub common services
    sandbox.stub(userManager, 'getUser').resolves(testUser);
    sandbox.stub(subscriptionManager, 'getUserSubscription').resolves(testSubscription);
    sandbox.stub(subscriptionManager, 'hasFeatureAccess').resolves(true);
    sandbox.stub(subscriptionManager, 'hasModelAccess').resolves(true);
    sandbox.stub(subscriptionManager, 'getModelUsageLimit').resolves(1000);
    sandbox.stub(subscriptionManager, 'getCurrentModelUsage').resolves(0);
    sandbox.stub(subscriptionManager, 'recordModelUsage').resolves();
    sandbox.stub(auditLogger, 'logEvent').resolves();
    sandbox.stub(auditLogger, 'queryLogs').resolves([]);
    sandbox.stub(contextManager, 'registerContext').resolves();
    sandbox.stub(contextManager, 'updateContext').resolves();
    
    // Initialize test components
    modelStrategyManager = new ModelStrategyManager({
      logger,
      configService,
      performanceMonitor,
      securityManager
    });
    
    securityIntegrationLayer = new SecurityIntegrationLayer({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      userManager,
      subscriptionManager,
      auditLogger
    });
    
    reasoningEngine = new ReasoningEngine({
      logger,
      configService,
      performanceMonitor,
      securityManager
    });
    
    tentacleIntegrationFramework = new TentacleIntegrationFramework({
      logger,
      configService,
      performanceMonitor,
      securityManager,
      contextManager,
      reasoningEngine
    });
    
    // Initialize components
    await modelStrategyManager.initialize();
    await securityIntegrationLayer.initialize();
    await tentacleIntegrationFramework.initialize();
    
    // Register test tentacle
    await tentacleIntegrationFramework.registerTentacle(testTentacle.id, testTentacle);
  });
  
  afterEach(function() {
    // Restore sandbox
    sandbox.restore();
  });
  
  describe('End-to-End Workflow Tests', function() {
    it('should process a reasoning request through all components successfully', async function() {
      // Create security context
      const securityContext = await securityIntegrationLayer.createSecurityContext({
        userId: testUser.id,
        tentacleId: testTentacle.id,
        requestId: uuidv4()
      });
      
      // Create reasoning request
      const request = {
        type: 'deductive',
        data: {
          premises: [
            'All humans are mortal',
            'Socrates is human'
          ],
          query: 'Is Socrates mortal?'
        },
        context: {
          domain: 'philosophy',
          confidence: 'high'
        },
        priority: 7
      };
      
      // Apply security policies to request
      const sanitizedRequest = await securityIntegrationLayer.enforceRequestPolicies(
        securityContext,
        request
      );
      
      // Validate model usage
      const modelId = 'llama-multilingual';
      const hasModelAccess = await securityIntegrationLayer.validateModelUsage(
        testUser.id,
        modelId
      );
      
      expect(hasModelAccess).to.be.true;
      
      // Select model strategy
      const modelStrategy = await modelStrategyManager.selectModelStrategy(
        sanitizedRequest.type,
        sanitizedRequest.context
      );
      
      expect(modelStrategy).to.be.an('object');
      expect(modelStrategy.modelId).to.be.a('string');
      
      // Submit request to tentacle integration framework
      const requestId = await tentacleIntegrationFramework.submitRequest(
        testTentacle.id,
        sanitizedRequest
      );
      
      expect(requestId).to.be.a('string');
      
      // Wait for processing (in a real scenario, this would be asynchronous)
      // For testing, we'll simulate completion
      const requestInfo = tentacleIntegrationFramework.requestMap.get(requestId);
      requestInfo.status = 'completed';
      requestInfo.progress = 100;
      requestInfo.completedAt = new Date();
      requestInfo.result = {
        conclusion: 'Socrates is mortal',
        confidence: 0.98,
        explanation: 'Since all humans are mortal and Socrates is human, Socrates must be mortal.',
        metadata: {
          confidence: 0.98,
          reasoningTrace: ['Applied deductive reasoning', 'Applied syllogistic logic'],
          strategy: 'deductive',
          processingTime: 150
        }
      };
      tentacleIntegrationFramework.requestMap.set(requestId, requestInfo);
      
      // Get request status
      const status = await tentacleIntegrationFramework.getRequestStatus(requestId);
      
      expect(status).to.be.an('object');
      expect(status.status).to.equal('completed');
      
      // Get request result
      const result = await tentacleIntegrationFramework.getRequestResult(requestId);
      
      expect(result).to.be.an('object');
      expect(result.conclusion).to.equal('Socrates is mortal');
      
      // Apply security policies to response
      const sanitizedResult = await securityIntegrationLayer.enforceResponsePolicies(
        securityContext,
        result
      );
      
      expect(sanitizedResult).to.be.an('object');
      
      // Record model usage
      await securityIntegrationLayer.recordModelUsage(testUser.id, modelId, 10);
      
      // Verify audit logging
      expect(auditLogger.logEvent.called).to.be.true;
    });
    
    it('should handle errors and propagate them appropriately', async function() {
      // Create security context
      const securityContext = await securityIntegrationLayer.createSecurityContext({
        userId: testUser.id,
        tentacleId: testTentacle.id,
        requestId: uuidv4()
      });
      
      // Create invalid reasoning request (missing required field)
      const request = {
        type: 'deductive',
        // Missing data field
        context: {
          domain: 'philosophy',
          confidence: 'high'
        },
        priority: 7
      };
      
      // Attempt to apply security policies to invalid request
      try {
        await securityIntegrationLayer.enforceRequestPolicies(
          securityContext,
          request
        );
        // Should not reach here
        expect.fail('Should have thrown an error for invalid request');
      } catch (error) {
        expect(error).to.be.an('error');
      }
      
      // Verify audit logging of error
      expect(auditLogger.logEvent.called).to.be.true;
    });
  });
  
  describe('Security Policy Enforcement Tests', function() {
    it('should enforce tier-based access control for features', async function() {
      // Set up subscription tier test cases
      const tierTests = [
        { tier: 'core', hasAccess: false },
        { tier: 'pro', hasAccess: true },
        { tier: 'enterprise', hasAccess: true }
      ];
      
      for (const test of tierTests) {
        // Update test subscription tier
        testSubscription.tier = test.tier;
        
        // Set up feature access based on tier
        subscriptionManager.hasFeatureAccess.resolves(test.hasAccess);
        
        // Validate feature access
        const hasAccess = await securityIntegrationLayer.validateAccess(
          testUser.id,
          'advanced_reasoning'
        );
        
        expect(hasAccess).to.equal(test.hasAccess, `Tier ${test.tier} should ${test.hasAccess ? 'have' : 'not have'} access`);
      }
    });
    
    it('should enforce model usage limits', async function() {
      // Set up usage limit test cases
      const usageTests = [
        { limit: 100, current: 50, hasAccess: true },
        { limit: 100, current: 100, hasAccess: false },
        { limit: -1, current: 1000, hasAccess: true } // Unlimited
      ];
      
      for (const test of usageTests) {
        // Set up usage limits
        subscriptionManager.getModelUsageLimit.resolves(test.limit);
        subscriptionManager.getCurrentModelUsage.resolves(test.current);
        
        // Validate model usage
        const hasAccess = await securityIntegrationLayer.validateModelUsage(
          testUser.id,
          'llama-multilingual'
        );
        
        expect(hasAccess).to.equal(test.hasAccess, `Usage ${test.current}/${test.limit} should ${test.hasAccess ? 'have' : 'not have'} access`);
      }
    });
    
    it('should sanitize sensitive data in requests and responses', async function() {
      // Register a security policy for data sanitization
      await securityIntegrationLayer.registerPolicy({
        id: 'data-sanitization',
        name: 'Data Sanitization Policy',
        description: 'Sanitizes sensitive data in requests and responses',
        scope: 'global',
        rules: {
          request: {
            sanitize: {
              removeFields: ['sensitiveData']
            }
          },
          response: {
            redactFields: ['privateInfo']
          }
        },
        createdAt: new Date()
      });
      
      // Create security context
      const securityContext = await securityIntegrationLayer.createSecurityContext({
        userId: testUser.id,
        tentacleId: testTentacle.id,
        requestId: uuidv4()
      });
      
      // Create request with sensitive data
      const request = {
        type: 'deductive',
        data: {
          premises: ['Premise 1', 'Premise 2'],
          query: 'Query'
        },
        sensitiveData: 'This should be removed',
        context: {
          domain: 'test'
        }
      };
      
      // Apply security policies to request
      const sanitizedRequest = await securityIntegrationLayer.enforceRequestPolicies(
        securityContext,
        request
      );
      
      // Verify sensitive data is removed
      expect(sanitizedRequest).to.not.have.property('sensitiveData');
      
      // Create response with private info
      const response = {
        conclusion: 'Conclusion',
        confidence: 0.9,
        privateInfo: 'This should be redacted',
        metadata: {
          processingTime: 100
        }
      };
      
      // Apply security policies to response
      const sanitizedResponse = await securityIntegrationLayer.enforceResponsePolicies(
        securityContext,
        response
      );
      
      // Verify private info is redacted
      expect(sanitizedResponse).to.have.property('privateInfo');
      expect(sanitizedResponse.privateInfo).to.equal('[REDACTED]');
    });
  });
  
  describe('Model Strategy Selection Tests', function() {
    it('should select appropriate models based on reasoning type and context', async function() {
      // Test cases for different reasoning types and contexts
      const strategyTests = [
        { 
          type: 'deductive', 
          context: { domain: 'logic', complexity: 'high' },
          expectedModel: 'llama-multilingual'
        },
        { 
          type: 'inductive', 
          context: { domain: 'science', dataPoints: 100 },
          expectedModel: 'llama-multilingual'
        },
        { 
          type: 'abductive', 
          context: { domain: 'medicine', uncertainty: 'high' },
          expectedModel: 'llama-multilingual'
        },
        { 
          type: 'analogical', 
          context: { domain: 'literature', creativity: 'high' },
          expectedModel: 'llama-multilingual'
        }
      ];
      
      for (const test of strategyTests) {
        // Select model strategy
        const strategy = await modelStrategyManager.selectModelStrategy(
          test.type,
          test.context
        );
        
        expect(strategy).to.be.an('object');
        expect(strategy.modelId).to.equal(test.expectedModel);
      }
    });
    
    it('should handle fallback strategies when primary model is unavailable', async function() {
      // Stub model availability check to simulate unavailable primary model
      sandbox.stub(modelStrategyManager, 'isModelAvailable')
        .withArgs('llama-multilingual').resolves(false)
        .withArgs('mistral-large').resolves(true);
      
      // Select model strategy
      const strategy = await modelStrategyManager.selectModelStrategy(
        'deductive',
        { domain: 'logic' }
      );
      
      expect(strategy).to.be.an('object');
      expect(strategy.modelId).to.not.equal('llama-multilingual');
      expect(strategy.isFallback).to.be.true;
    });
    
    it('should cache model strategies for similar requests', async function() {
      // Create spy on internal cache method
      const cacheSpy = sandbox.spy(modelStrategyManager, 'getCachedStrategy');
      
      // First request (should miss cache)
      await modelStrategyManager.selectModelStrategy(
        'deductive',
        { domain: 'logic' }
      );
      
      // Second identical request (should hit cache)
      await modelStrategyManager.selectModelStrategy(
        'deductive',
        { domain: 'logic' }
      );
      
      expect(cacheSpy.calledTwice).to.be.true;
      expect(cacheSpy.secondCall.returnValue).to.not.be.null;
    });
  });
  
  describe('Tentacle Integration Framework Tests', function() {
    it('should handle concurrent requests with proper prioritization', async function() {
      // Create multiple requests with different priorities
      const requests = [
        { id: 'req1', priority: 3, urgent: false },
        { id: 'req2', priority: 7, urgent: false },
        { id: 'req3', priority: 5, urgent: true },
        { id: 'req4', priority: 2, urgent: true },
        { id: 'req5', priority: 9, urgent: false }
      ];
      
      // Submit all requests
      for (const req of requests) {
        const request = {
          type: 'deductive',
          data: { query: `Query for ${req.id}` },
          priority: req.priority,
          urgent: req.urgent
        };
        
        await tentacleIntegrationFramework.submitRequest(
          testTentacle.id,
          request
        );
      }
      
      // Expected processing order based on priority and urgency
      // Urgent requests come first (sorted by priority), then non-urgent (sorted by priority)
      const expectedOrder = ['req3', 'req4', 'req5', 'req2', 'req1'];
      
      // Verify queue order
      for (let i = 0; i < expectedOrder.length; i++) {
        const queuedRequestId = tentacleIntegrationFramework.requestQueue[i];
        const queuedRequest = tentacleIntegrationFramework.requestMap.get(queuedRequestId);
        
        // Extract the original request ID from the query
        const originalId = queuedRequest.request.data.query.split(' ').pop();
        
        expect(originalId).to.equal(expectedOrder[i]);
      }
    });
    
    it('should share context between related requests', async function() {
      // Submit first request
      const firstRequestId = await tentacleIntegrationFramework.submitRequest(
        testTentacle.id,
        {
          type: 'deductive',
          data: { query: 'First query' },
          context: { key: 'value' }
        }
      );
      
      // Submit second request
      const secondRequestId = await tentacleIntegrationFramework.submitRequest(
        testTentacle.id,
        {
          type: 'inductive',
          data: { query: 'Second query' },
          context: { another: 'context' }
        }
      );
      
      // Share context between requests
      const contextId = await tentacleIntegrationFramework.shareContext(
        [firstRequestId, secondRequestId],
        { shared: 'data' }
      );
      
      expect(contextId).to.be.a('string');
      
      // Get shared context
      const context = await tentacleIntegrationFramework.getSharedContext(contextId);
      
      expect(context).to.be.an('object');
      expect(context.data).to.have.property('shared', 'data');
      expect(context.sourceRequestIds).to.include(firstRequestId);
      expect(context.sourceRequestIds).to.include(secondRequestId);
    });
  });
  
  describe('Performance and Resource Management Tests', function() {
    it('should limit concurrent request processing based on configuration', async function() {
      // Set max concurrent requests to 2
      tentacleIntegrationFramework.maxConcurrentRequests = 2;
      
      // Submit 5 requests
      const requestIds = [];
      for (let i = 0; i < 5; i++) {
        const requestId = await tentacleIntegrationFramework.submitRequest(
          testTentacle.id,
          {
            type: 'deductive',
            data: { query: `Query ${i}` }
          }
        );
        requestIds.push(requestId);
      }
      
      // Manually trigger processing
      await tentacleIntegrationFramework.processNextRequests();
      
      // Verify only 2 requests are being processed
      expect(tentacleIntegrationFramework.activeRequests.size).to.equal(2);
      
      // Complete one request
      const firstRequestId = Array.from(tentacleIntegrationFramework.activeRequests)[0];
      const firstRequest = tentacleIntegrationFramework.requestMap.get(firstRequestId);
      firstRequest.status = 'completed';
      firstRequest.completedAt = new Date();
      tentacleIntegrationFramework.activeRequests.delete(firstRequestId);
      
      // Trigger processing again
      await tentacleIntegrationFramework.processNextRequests();
      
      // Verify one more request is being processed (total still 2)
      expect(tentacleIntegrationFramework.activeRequests.size).to.equal(2);
    });
    
    it('should handle cleanup of expired contexts and completed requests', async function() {
      // Create an expired context
      const expiredContext = {
        id: 'expired-context',
        data: { test: 'data' },
        sourceRequestIds: ['req1', 'req2'],
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000)  // 24 hours ago
      };
      
      tentacleIntegrationFramework.sharedContexts.set(expiredContext.id, expiredContext);
      
      // Create an old completed request
      const oldRequestId = 'old-request';
      const oldRequest = {
        id: oldRequestId,
        status: 'completed',
        progress: 100,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        tentacleId: testTentacle.id,
        request: { type: 'deductive', data: {} }
      };
      
      tentacleIntegrationFramework.requestMap.set(oldRequestId, oldRequest);
      
      // Create a recent completed request
      const recentRequestId = 'recent-request';
      const recentRequest = {
        id: recentRequestId,
        status: 'completed',
        progress: 100,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        tentacleId: testTentacle.id,
        request: { type: 'deductive', data: {} }
      };
      
      tentacleIntegrationFramework.requestMap.set(recentRequestId, recentRequest);
      
      // Run cleanup
      await tentacleIntegrationFramework.cleanup();
      
      // Verify expired context is removed
      expect(tentacleIntegrationFramework.sharedContexts.has(expiredContext.id)).to.be.false;
      
      // Verify old request is removed
      expect(tentacleIntegrationFramework.requestMap.has(oldRequestId)).to.be.false;
      
      // Verify recent request is kept
      expect(tentacleIntegrationFramework.requestMap.has(recentRequestId)).to.be.true;
    });
  });
  
  describe('Error Handling and Recovery Tests', function() {
    it('should handle and recover from model selection errors', async function() {
      // Stub model selection to throw an error
      sandbox.stub(modelStrategyManager, 'selectModelForTask').throws(new Error('Model selection failed'));
      
      // Create a fallback handler
      const originalSelectStrategy = modelStrategyManager.selectModelStrategy;
      modelStrategyManager.selectModelStrategy = async function(type, context) {
        try {
          return await originalSelectStrategy.call(this, type, context);
        } catch (error) {
          // Return a fallback strategy
          return {
            modelId: 'fallback-model',
            parameters: { temperature: 0.7 },
            isFallback: true
          };
        }
      };
      
      // Select model strategy
      const strategy = await modelStrategyManager.selectModelStrategy(
        'deductive',
        { domain: 'logic' }
      );
      
      // Verify fallback strategy is returned
      expect(strategy).to.be.an('object');
      expect(strategy.modelId).to.equal('fallback-model');
      expect(strategy.isFallback).to.be.true;
    });
    
    it('should handle and recover from security policy enforcement errors', async function() {
      // Create security context
      const securityContext = await securityIntegrationLayer.createSecurityContext({
        userId: testUser.id,
        tentacleId: testTentacle.id,
        requestId: uuidv4()
      });
      
      // Stub policy enforcement to throw an error
      sandbox.stub(securityIntegrationLayer, 'applyPolicyRules').throws(new Error('Policy enforcement failed'));
      
      // Create request
      const request = {
        type: 'deductive',
        data: { query: 'Test query' }
      };
      
      // Attempt to enforce policies
      try {
        await securityIntegrationLayer.enforceRequestPolicies(securityContext, request);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Verify error is logged
        expect(auditLogger.logEvent.called).to.be.true;
        
        // Verify audit event has correct properties
        const auditCall = auditLogger.logEvent.getCall(0);
        const auditEvent = auditCall.args[0];
        
        expect(auditEvent.type).to.equal('policy_enforcement_failed');
        expect(auditEvent.outcome).to.equal('failure');
      }
    });
    
    it('should handle tentacle request failures gracefully', async function() {
      // Submit request
      const requestId = await tentacleIntegrationFramework.submitRequest(
        testTentacle.id,
        {
          type: 'deductive',
          data: { query: 'Test query' }
        }
      );
      
      // Stub reasoning engine to throw an error
      sandbox.stub(tentacleIntegrationFramework.reasoningEngine, 'processRequest').throws(new Error('Processing failed'));
      
      // Manually process the request
      await tentacleIntegrationFramework.processRequest(requestId);
      
      // Get request status
      const status = await tentacleIntegrationFramework.getRequestStatus(requestId);
      
      // Verify request is marked as failed
      expect(status.status).to.equal('failed');
      expect(status.error).to.be.a('string');
    });
  });
  
  describe('Multi-Tenant Isolation Tests', function() {
    it('should maintain isolation between different users and tentacles', async function() {
      // Create second user and tentacle
      const secondUser = new MockUser({
        id: 'test-user-2',
        name: 'Second User',
        email: 'second@example.com',
        roles: ['user'],
        createdAt: new Date()
      });
      
      const secondTentacle = new MockTentacle({
        id: 'test-tentacle-2',
        name: 'Second Tentacle',
        requestTypes: ['deductive', 'inductive'],
        version: '1.0.0',
        apiVersion: '1.0.0',
        priority: 5
      });
      
      const secondSubscription = new MockSubscription({
        id: 'test-subscription-2',
        userId: secondUser.id,
        tier: 'core',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      
      // Update stubs for second user
      userManager.getUser.withArgs(secondUser.id).resolves(secondUser);
      subscriptionManager.getUserSubscription.withArgs(secondUser.id).resolves(secondSubscription);
      
      // Register second tentacle
      await tentacleIntegrationFramework.registerTentacle(secondTentacle.id, secondTentacle);
      
      // Create security contexts for both users
      const firstContext = await securityIntegrationLayer.createSecurityContext({
        userId: testUser.id,
        tentacleId: testTentacle.id,
        requestId: uuidv4()
      });
      
      const secondContext = await securityIntegrationLayer.createSecurityContext({
        userId: secondUser.id,
        tentacleId: secondTentacle.id,
        requestId: uuidv4()
      });
      
      // Submit requests for both users
      const firstRequest = {
        type: 'deductive',
        data: { query: 'First user query' }
      };
      
      const secondRequest = {
        type: 'deductive',
        data: { query: 'Second user query' }
      };
      
      // Set different feature access for different tiers
      subscriptionManager.hasFeatureAccess
        .withArgs(testSubscription.id, 'advanced_reasoning').resolves(true)
        .withArgs(secondSubscription.id, 'advanced_reasoning').resolves(false);
      
      // Validate feature access for both users
      const firstHasAccess = await securityIntegrationLayer.validateAccess(
        testUser.id,
        'advanced_reasoning'
      );
      
      const secondHasAccess = await securityIntegrationLayer.validateAccess(
        secondUser.id,
        'advanced_reasoning'
      );
      
      // Verify proper isolation
      expect(firstHasAccess).to.be.true;
      expect(secondHasAccess).to.be.false;
      
      // Verify contexts are properly isolated
      expect(firstContext.tier).to.equal('pro');
      expect(secondContext.tier).to.equal('core');
    });
  });
});
