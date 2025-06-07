/**
 * @fileoverview Error handling tests for DevMaster Tentacle
 * 
 * This file contains tests specifically focused on error handling scenarios
 * for the DevMaster Tentacle implementation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { EventEmitter } = require('../../../src/core/events/EventEmitter');
const { Logger } = require('../../../src/core/logging/Logger');

describe('DevMasterTentacle Error Handling', () => {
  let tentacle;
  let mockAideon;
  let mockConfig;
  let mockAuth;
  let mockApi;
  let mockMetrics;
  
  // Component stubs with error behaviors
  let AccessControlServiceStub;
  let CodeBrainManagerStub;
  let VisualMindManagerStub;
  let DeployHandManagerStub;
  let CollabInterfaceManagerStub;
  let LifecycleManagerStub;
  
  // Constructor stubs
  let AccessControlServiceConstructorStub;
  let CodeBrainManagerConstructorStub;
  let VisualMindManagerConstructorStub;
  let DeployHandManagerConstructorStub;
  let CollabInterfaceManagerConstructorStub;
  let LifecycleManagerConstructorStub;
  
  beforeEach(() => {
    // Reset stubs
    sinon.restore();
    
    // Create component stubs with default behavior
    AccessControlServiceStub = {
      initialize: sinon.stub().resolves(),
      hasAccess: sinon.stub().resolves(true),
      generateInviteCode: sinon.stub().resolves({ code: 'TEST-CODE', expiresAt: Date.now() + 86400000, maxUses: 1 }),
      redeemInviteCode: sinon.stub().resolves(true),
      getActiveInviteCount: sinon.stub().returns(5)
    };
    
    CodeBrainManagerStub = {
      initialize: sinon.stub().resolves(),
      registerApiEndpoints: sinon.stub(),
      shutdown: sinon.stub().resolves(),
      getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' }),
      executeTask: sinon.stub().resolves({ result: 'code task result' })
    };
    
    VisualMindManagerStub = {
      initialize: sinon.stub().resolves(),
      registerApiEndpoints: sinon.stub(),
      shutdown: sinon.stub().resolves(),
      getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' }),
      designUI: sinon.stub().resolves({ result: 'ui task result' })
    };
    
    DeployHandManagerStub = {
      initialize: sinon.stub().resolves(),
      registerApiEndpoints: sinon.stub(),
      shutdown: sinon.stub().resolves(),
      getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' }),
      deployApplication: sinon.stub().resolves({ result: 'deploy task result' })
    };
    
    CollabInterfaceManagerStub = {
      initialize: sinon.stub().resolves(),
      registerApiEndpoints: sinon.stub(),
      shutdown: sinon.stub().resolves(),
      getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' }),
      createCollaborationSession: sinon.stub().resolves({ result: 'collab task result' })
    };
    
    LifecycleManagerStub = {
      initialize: sinon.stub().resolves(),
      registerApiEndpoints: sinon.stub(),
      shutdown: sinon.stub().resolves(),
      getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' }),
      manageLifecycle: sinon.stub().resolves({ result: 'lifecycle task result' })
    };
    
    // Create constructor stubs
    AccessControlServiceConstructorStub = sinon.stub().returns(AccessControlServiceStub);
    CodeBrainManagerConstructorStub = sinon.stub().returns(CodeBrainManagerStub);
    VisualMindManagerConstructorStub = sinon.stub().returns(VisualMindManagerStub);
    DeployHandManagerConstructorStub = sinon.stub().returns(DeployHandManagerStub);
    CollabInterfaceManagerConstructorStub = sinon.stub().returns(CollabInterfaceManagerStub);
    LifecycleManagerConstructorStub = sinon.stub().returns(LifecycleManagerStub);
    
    // Create mock config
    mockConfig = {
      getNamespace: sinon.stub().returns({
        get: sinon.stub().returns({}),
        set: sinon.stub().resolves(),
        getNamespace: sinon.stub().returns({
          get: sinon.stub().returns({}),
          set: sinon.stub().resolves()
        })
      })
    };
    
    mockAuth = {
      isAdmin: sinon.stub().resolves(true),
      getUserAttribute: sinon.stub().resolves(null),
      setUserAttribute: sinon.stub().resolves()
    };
    
    mockApi = {
      register: sinon.stub()
    };
    
    mockMetrics = {
      registerTentacle: sinon.stub(),
      trackEvent: sinon.stub(),
      trackMetric: sinon.stub()
    };
    
    mockAideon = {
      config: mockConfig,
      auth: mockAuth,
      api: mockApi,
      metrics: mockMetrics
    };
    
    // Use proxyquire to mock dependencies
    const { DevMasterTentacle } = proxyquire('../../../src/tentacles/devmaster/DevMasterTentacle', {
      '../../core/security/AccessControlService': { 
        AccessControlService: AccessControlServiceConstructorStub 
      },
      './code_brain/CodeBrainManager': { 
        CodeBrainManager: CodeBrainManagerConstructorStub 
      },
      './visual_mind/VisualMindManager': { 
        VisualMindManager: VisualMindManagerConstructorStub 
      },
      './deploy_hand/DeployHandManager': { 
        DeployHandManager: DeployHandManagerConstructorStub 
      },
      './collab_interface/CollabInterfaceManager': { 
        CollabInterfaceManager: CollabInterfaceManagerConstructorStub 
      },
      './lifecycle_manager/LifecycleManager': { 
        LifecycleManager: LifecycleManagerConstructorStub 
      }
    });
    
    // Create tentacle instance
    tentacle = new DevMasterTentacle();
    tentacle.aideon = mockAideon;
    tentacle.api = mockApi;
    
    // Stub logger to prevent console output during tests
    sinon.stub(Logger.prototype, 'info');
    sinon.stub(Logger.prototype, 'warn');
    sinon.stub(Logger.prototype, 'error');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('Initialization Error Handling', () => {
    it('should handle AccessControlService initialization failure', async () => {
      const error = new Error('Access control initialization failed');
      AccessControlServiceStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should handle CodeBrainManager initialization failure', async () => {
      const error = new Error('Code brain initialization failed');
      CodeBrainManagerStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should handle VisualMindManager initialization failure', async () => {
      const error = new Error('Visual mind initialization failed');
      VisualMindManagerStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should handle DeployHandManager initialization failure', async () => {
      const error = new Error('Deploy hand initialization failed');
      DeployHandManagerStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should handle CollabInterfaceManager initialization failure', async () => {
      const error = new Error('Collab interface initialization failed');
      CollabInterfaceManagerStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should handle LifecycleManager initialization failure', async () => {
      const error = new Error('Lifecycle manager initialization failed');
      LifecycleManagerStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.initialized).to.be.false;
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
  });
  
  describe('Task Execution Error Handling', () => {
    beforeEach(async () => {
      tentacle.initialized = true;
      tentacle.accessControl = AccessControlServiceStub;
      tentacle.codeBrain = CodeBrainManagerStub;
      tentacle.visualMind = VisualMindManagerStub;
      tentacle.deployHand = DeployHandManagerStub;
      tentacle.collabInterface = CollabInterfaceManagerStub;
      tentacle.lifecycleManager = LifecycleManagerStub;
      
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
    });
    
    it('should handle access denied errors', async () => {
      AccessControlServiceStub.hasAccess.resolves(false);
      
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Access denied to DevMaster Tentacle');
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
    
    it('should handle unknown task type errors', async () => {
      const task = { id: 'task1', type: 'unknown', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Unknown task type: unknown');
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
    
    it('should handle code task execution errors', async () => {
      const error = new Error('Code generation failed');
      CodeBrainManagerStub.executeTask.rejects(error);
      
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
    
    it('should handle UI task execution errors', async () => {
      const error = new Error('UI design failed');
      VisualMindManagerStub.designUI.rejects(error);
      
      const task = { id: 'task1', type: 'ui', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
    
    it('should handle deploy task execution errors', async () => {
      const error = new Error('Deployment failed');
      DeployHandManagerStub.deployApplication.rejects(error);
      
      const task = { id: 'task1', type: 'deploy', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
    
    it('should handle collab task execution errors', async () => {
      const error = new Error('Collaboration session creation failed');
      CollabInterfaceManagerStub.createCollaborationSession.rejects(error);
      
      const task = { id: 'task1', type: 'collab', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
    
    it('should handle lifecycle task execution errors', async () => {
      const error = new Error('Lifecycle management failed');
      LifecycleManagerStub.manageLifecycle.rejects(error);
      
      const task = { id: 'task1', type: 'lifecycle', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(tentacle.events.emit).to.have.been.calledWith('task:error');
        expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:task:error');
      }
    });
  });
  
  describe('API Handler Error Handling', () => {
    beforeEach(async () => {
      tentacle.initialized = true;
      tentacle.accessControl = AccessControlServiceStub;
      
      // Expose private methods for testing
      tentacle._handleStatusRequest = tentacle._handleStatusRequest.bind(tentacle);
      tentacle._handleGenerateInviteRequest = tentacle._handleGenerateInviteRequest.bind(tentacle);
      tentacle._handleRedeemInviteRequest = tentacle._handleRedeemInviteRequest.bind(tentacle);
      tentacle._handleExecuteTaskRequest = tentacle._handleExecuteTaskRequest.bind(tentacle);
    });
    
    it('should handle errors in status request handler', async () => {
      const error = new Error('Status retrieval failed');
      tentacle.getStatus = sinon.stub().throws(error);
      
      const request = { userId: 'user123' };
      const response = await tentacle._handleStatusRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
      expect(Logger.prototype.error).to.have.been.called;
    });
    
    it('should handle errors in generate invite request handler', async () => {
      const error = new Error('Invite generation failed');
      AccessControlServiceStub.generateInviteCode.rejects(error);
      
      const request = { userId: 'admin123', maxUses: 5 };
      const response = await tentacle._handleGenerateInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
      expect(Logger.prototype.error).to.have.been.called;
    });
    
    it('should handle errors in redeem invite request handler', async () => {
      const error = new Error('Invite redemption failed');
      AccessControlServiceStub.redeemInviteCode.rejects(error);
      
      const request = { userId: 'user123', code: 'INVALID-CODE' };
      const response = await tentacle._handleRedeemInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
      expect(Logger.prototype.error).to.have.been.called;
    });
    
    it('should handle errors in execute task request handler', async () => {
      const error = new Error('Task execution failed');
      tentacle.executeTask = sinon.stub().rejects(error);
      
      const request = { userId: 'user123', task: { id: 'task1', type: 'code' } };
      const response = await tentacle._handleExecuteTaskRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
      expect(Logger.prototype.error).to.have.been.called;
    });
  });
  
  describe('Shutdown Error Handling', () => {
    beforeEach(async () => {
      tentacle.initialized = true;
      tentacle.codeBrain = CodeBrainManagerStub;
      tentacle.visualMind = VisualMindManagerStub;
      tentacle.deployHand = DeployHandManagerStub;
      tentacle.collabInterface = CollabInterfaceManagerStub;
      tentacle.lifecycleManager = LifecycleManagerStub;
    });
    
    it('should handle errors during component shutdown', async () => {
      const error = new Error('Shutdown failed');
      CodeBrainManagerStub.shutdown.rejects(error);
      
      try {
        await tentacle.shutdown();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should handle multiple component shutdown errors', async () => {
      const error1 = new Error('CodeBrain shutdown failed');
      const error2 = new Error('VisualMind shutdown failed');
      
      CodeBrainManagerStub.shutdown.rejects(error1);
      VisualMindManagerStub.shutdown.rejects(error2);
      
      try {
        await tentacle.shutdown();
        expect.fail('Should have thrown an error');
      } catch (err) {
        // Should throw the first error encountered
        expect(err).to.equal(error1);
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
    
    it('should not throw error when shutting down non-initialized tentacle', async () => {
      tentacle.initialized = false;
      
      await tentacle.shutdown();
      
      expect(Logger.prototype.warn).to.have.been.called;
      expect(CodeBrainManagerStub.shutdown).not.to.have.been.called;
    });
  });
  
  describe('Not Initialized Error Handling', () => {
    beforeEach(() => {
      tentacle.initialized = false;
    });
    
    it('should throw error when calling hasAccess on non-initialized tentacle', async () => {
      try {
        await tentacle.hasAccess('user123');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('DevMaster Tentacle is not initialized');
      }
    });
    
    it('should throw error when calling generateInviteCode on non-initialized tentacle', async () => {
      try {
        await tentacle.generateInviteCode('admin123');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('DevMaster Tentacle is not initialized');
      }
    });
    
    it('should throw error when calling redeemInviteCode on non-initialized tentacle', async () => {
      try {
        await tentacle.redeemInviteCode('user123', 'TEST-CODE');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('DevMaster Tentacle is not initialized');
      }
    });
    
    it('should throw error when calling executeTask on non-initialized tentacle', async () => {
      try {
        await tentacle.executeTask({ id: 'task1', type: 'code' }, { userId: 'user123' });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('DevMaster Tentacle is not initialized');
      }
    });
  });
});
