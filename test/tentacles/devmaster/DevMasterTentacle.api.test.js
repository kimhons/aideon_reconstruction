/**
 * @fileoverview API handler tests for DevMaster Tentacle
 * 
 * This file contains tests specifically focused on API handlers
 * for the DevMaster Tentacle implementation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { EventEmitter } = require('../../../src/core/events/EventEmitter');
const { Logger } = require('../../../src/core/logging/Logger');

describe('DevMasterTentacle API Handlers', () => {
  let tentacle;
  let mockAideon;
  let mockConfig;
  let mockAuth;
  let mockApi;
  let mockMetrics;
  
  // Component stubs
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
    
    // Initialize tentacle
    tentacle.initialized = true;
    tentacle.accessControl = AccessControlServiceStub;
    tentacle.codeBrain = CodeBrainManagerStub;
    tentacle.visualMind = VisualMindManagerStub;
    tentacle.deployHand = DeployHandManagerStub;
    tentacle.collabInterface = CollabInterfaceManagerStub;
    tentacle.lifecycleManager = LifecycleManagerStub;
    
    // Expose private methods for testing
    tentacle._handleStatusRequest = tentacle._handleStatusRequest.bind(tentacle);
    tentacle._handleGenerateInviteRequest = tentacle._handleGenerateInviteRequest.bind(tentacle);
    tentacle._handleRedeemInviteRequest = tentacle._handleRedeemInviteRequest.bind(tentacle);
    tentacle._handleExecuteTaskRequest = tentacle._handleExecuteTaskRequest.bind(tentacle);
    
    // Stub logger to prevent console output during tests
    sinon.stub(Logger.prototype, 'info');
    sinon.stub(Logger.prototype, 'warn');
    sinon.stub(Logger.prototype, 'error');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('API Registration', () => {
    it('should register all API endpoints during initialization', async () => {
      // Reset initialized flag to test initialization
      tentacle.initialized = false;
      
      await tentacle.initialize();
      
      // Verify API endpoints were registered
      expect(mockApi.register).to.have.been.calledWith('devmaster/status');
      expect(mockApi.register).to.have.been.calledWith('devmaster/invite/generate');
      expect(mockApi.register).to.have.been.calledWith('devmaster/invite/redeem');
      expect(mockApi.register).to.have.been.calledWith('devmaster/task/execute');
      
      // Verify component API endpoints were registered
      expect(CodeBrainManagerStub.registerApiEndpoints).to.have.been.called;
      expect(VisualMindManagerStub.registerApiEndpoints).to.have.been.called;
      expect(DeployHandManagerStub.registerApiEndpoints).to.have.been.called;
      expect(CollabInterfaceManagerStub.registerApiEndpoints).to.have.been.called;
      expect(LifecycleManagerStub.registerApiEndpoints).to.have.been.called;
    });
  });
  
  describe('Status Request Handler', () => {
    it('should return full status for authorized users', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      
      const request = { userId: 'user123' };
      const response = await tentacle._handleStatusRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('id', 'devmaster');
      expect(response.data).to.have.property('name', 'DevMaster');
      expect(response.data).to.have.property('version');
      expect(response.data).to.have.property('initialized', true);
      expect(response.data).to.have.property('components');
      expect(response.data.components).to.have.property('codeBrain');
      expect(response.data.components).to.have.property('visualMind');
      expect(response.data.components).to.have.property('deployHand');
      expect(response.data.components).to.have.property('collabInterface');
      expect(response.data.components).to.have.property('lifecycleManager');
    });
    
    it('should return limited status for unauthorized users', async () => {
      AccessControlServiceStub.hasAccess.resolves(false);
      
      const request = { userId: 'user123' };
      const response = await tentacle._handleStatusRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('id', 'devmaster');
      expect(response.data).to.have.property('name', 'DevMaster');
      expect(response.data).to.have.property('version');
      expect(response.data).to.have.property('adminOnly');
      expect(response.data).to.have.property('inviteEnabled');
      expect(response.data).not.to.have.property('components');
    });
    
    it('should handle errors during status retrieval', async () => {
      const error = new Error('Status retrieval failed');
      tentacle.getStatus = sinon.stub().throws(error);
      
      const request = { userId: 'user123' };
      const response = await tentacle._handleStatusRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
    });
  });
  
  describe('Generate Invite Request Handler', () => {
    it('should generate invite code for authorized users', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      mockAuth.isAdmin.resolves(true);
      
      const request = { userId: 'admin123', maxUses: 5, expiresIn: 172800000 };
      const response = await tentacle._handleGenerateInviteRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('code', 'TEST-CODE');
      expect(response.data).to.have.property('expiresAt');
      expect(response.data).to.have.property('maxUses', 1);
      expect(AccessControlServiceStub.generateInviteCode).to.have.been.calledWith('admin123', { maxUses: 5, expiresIn: 172800000 });
    });
    
    it('should deny invite generation for non-admin users', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      mockAuth.isAdmin.resolves(false);
      
      const request = { userId: 'user123', maxUses: 5 };
      const response = await tentacle._handleGenerateInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal('Only administrators can generate invite codes');
      expect(AccessControlServiceStub.generateInviteCode).not.to.have.been.called;
    });
    
    it('should deny invite generation for unauthorized users', async () => {
      AccessControlServiceStub.hasAccess.resolves(false);
      
      const request = { userId: 'user123', maxUses: 5 };
      const response = await tentacle._handleGenerateInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal('Access denied');
      expect(AccessControlServiceStub.generateInviteCode).not.to.have.been.called;
    });
    
    it('should handle errors during invite generation', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      mockAuth.isAdmin.resolves(true);
      
      const error = new Error('Invite generation failed');
      AccessControlServiceStub.generateInviteCode.rejects(error);
      
      const request = { userId: 'admin123', maxUses: 5 };
      const response = await tentacle._handleGenerateInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
    });
  });
  
  describe('Redeem Invite Request Handler', () => {
    it('should redeem invite code successfully', async () => {
      const request = { userId: 'user123', code: 'TEST-CODE' };
      const response = await tentacle._handleRedeemInviteRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('redeemed', true);
      expect(AccessControlServiceStub.redeemInviteCode).to.have.been.calledWith('user123', 'TEST-CODE');
    });
    
    it('should handle invalid invite codes', async () => {
      AccessControlServiceStub.redeemInviteCode.resolves(false);
      
      const request = { userId: 'user123', code: 'INVALID-CODE' };
      const response = await tentacle._handleRedeemInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal('Invalid or expired invite code');
    });
    
    it('should handle errors during invite redemption', async () => {
      const error = new Error('Invite redemption failed');
      AccessControlServiceStub.redeemInviteCode.rejects(error);
      
      const request = { userId: 'user123', code: 'TEST-CODE' };
      const response = await tentacle._handleRedeemInviteRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
    });
  });
  
  describe('Execute Task Request Handler', () => {
    it('should execute task for authorized users', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      tentacle.executeTask = sinon.stub().resolves({
        success: true,
        executionTime: 100,
        result: { result: 'task result' }
      });
      
      const request = {
        userId: 'user123',
        task: { id: 'task1', type: 'code', data: {} }
      };
      
      const response = await tentacle._handleExecuteTaskRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('success', true);
      expect(response.data).to.have.property('executionTime', 100);
      expect(response.data).to.have.property('result');
      expect(response.data.result).to.have.property('result', 'task result');
      expect(tentacle.executeTask).to.have.been.calledWith(
        { id: 'task1', type: 'code', data: {} },
        { userId: 'user123' }
      );
    });
    
    it('should deny task execution for unauthorized users', async () => {
      AccessControlServiceStub.hasAccess.resolves(false);
      
      const request = {
        userId: 'user123',
        task: { id: 'task1', type: 'code', data: {} }
      };
      
      const response = await tentacle._handleExecuteTaskRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal('Access denied');
      expect(tentacle.executeTask).not.to.have.been.called;
    });
    
    it('should handle missing task parameter', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      
      const request = { userId: 'user123' };
      const response = await tentacle._handleExecuteTaskRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal('Missing task parameter');
      expect(tentacle.executeTask).not.to.have.been.called;
    });
    
    it('should handle errors during task execution', async () => {
      AccessControlServiceStub.hasAccess.resolves(true);
      
      const error = new Error('Task execution failed');
      tentacle.executeTask = sinon.stub().rejects(error);
      
      const request = {
        userId: 'user123',
        task: { id: 'task1', type: 'code', data: {} }
      };
      
      const response = await tentacle._handleExecuteTaskRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal(error.message);
    });
  });
  
  describe('Component API Integration', () => {
    it('should integrate with CodeBrain API endpoints', async () => {
      // Create a mock handler function
      const mockHandler = sinon.stub().resolves({
        status: 'success',
        data: { result: 'code generation result' }
      });
      
      // Replace the CodeBrain API handler with our mock
      CodeBrainManagerStub.registerApiEndpoints = function() {
        tentacle.api.register('devmaster/codebrain/generate', mockHandler);
      };
      
      // Initialize to register API endpoints
      tentacle.initialized = false;
      await tentacle.initialize();
      
      // Verify the endpoint was registered
      expect(mockApi.register).to.have.been.calledWith('devmaster/codebrain/generate');
      
      // Simulate an API call
      const request = {
        userId: 'user123',
        language: 'javascript',
        requirements: 'Create a function that adds two numbers'
      };
      
      // Call the handler directly (since we can't actually invoke the API)
      const response = await mockHandler(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('result', 'code generation result');
      expect(mockHandler).to.have.been.calledWith(request);
    });
  });
});
