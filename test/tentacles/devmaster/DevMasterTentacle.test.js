/**
 * @fileoverview Tests for DevMaster Tentacle
 * 
 * This file contains comprehensive tests for the DevMaster Tentacle implementation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { EventEmitter } = require('../../../src/core/events/EventEmitter');
const { Logger } = require('../../../src/core/logging/Logger');

// Create component stubs
const CodeBrainManagerStub = {
  initialize: sinon.stub().resolves(),
  registerApiEndpoints: sinon.stub(),
  shutdown: sinon.stub().resolves(),
  getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' })
};

const VisualMindManagerStub = {
  initialize: sinon.stub().resolves(),
  registerApiEndpoints: sinon.stub(),
  shutdown: sinon.stub().resolves(),
  getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' })
};

const DeployHandManagerStub = {
  initialize: sinon.stub().resolves(),
  registerApiEndpoints: sinon.stub(),
  shutdown: sinon.stub().resolves(),
  getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' })
};

const CollabInterfaceManagerStub = {
  initialize: sinon.stub().resolves(),
  registerApiEndpoints: sinon.stub(),
  shutdown: sinon.stub().resolves(),
  getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' })
};

const LifecycleManagerStub = {
  initialize: sinon.stub().resolves(),
  registerApiEndpoints: sinon.stub(),
  shutdown: sinon.stub().resolves(),
  getStatus: sinon.stub().returns({ initialized: true, version: '1.0.0' })
};

// Create component constructor stubs
const CodeBrainManagerConstructorStub = sinon.stub().returns(CodeBrainManagerStub);
const VisualMindManagerConstructorStub = sinon.stub().returns(VisualMindManagerStub);
const DeployHandManagerConstructorStub = sinon.stub().returns(DeployHandManagerStub);
const CollabInterfaceManagerConstructorStub = sinon.stub().returns(CollabInterfaceManagerStub);
const LifecycleManagerConstructorStub = sinon.stub().returns(LifecycleManagerStub);

// Create AccessControlService stub
const AccessControlServiceStub = {
  initialize: sinon.stub().resolves(),
  hasAccess: sinon.stub().resolves(true),
  generateInviteCode: sinon.stub().resolves({ code: 'TEST-CODE', expiresAt: Date.now() + 86400000, maxUses: 1 }),
  redeemInviteCode: sinon.stub().resolves(true),
  getActiveInviteCount: sinon.stub().returns(5)
};

const AccessControlServiceConstructorStub = sinon.stub().returns(AccessControlServiceStub);

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

describe('DevMasterTentacle', () => {
  let tentacle;
  let mockAideon;
  let mockConfig;
  let mockAuth;
  let mockApi;
  let mockMetrics;
  let mockCodeBrainConfig;
  let mockVisualMindConfig;
  let mockDeployHandConfig;
  let mockCollabInterfaceConfig;
  let mockLifecycleManagerConfig;
  
  beforeEach(() => {
    // Reset stubs
    sinon.reset();
    
    // Create mock configs for each component
    mockCodeBrainConfig = {
      get: sinon.stub().callsFake((key, defaultValue) => {
        if (key === 'supportedLanguages') {
          return ['javascript', 'typescript', 'python'];
        }
        if (key === 'analyzerTypes') {
          return ['static', 'security'];
        }
        if (key === 'designerTypes') {
          return ['microservice', 'serverless'];
        }
        if (key === 'strategistTypes') {
          return ['unit', 'integration'];
        }
        return defaultValue || {};
      }),
      set: sinon.stub().resolves(),
      getNamespace: sinon.stub().returns({
        get: sinon.stub().returns({}),
        set: sinon.stub().resolves()
      })
    };
    
    mockVisualMindConfig = {
      get: sinon.stub().returns({}),
      set: sinon.stub().resolves(),
      getNamespace: sinon.stub().returns({
        get: sinon.stub().returns({}),
        set: sinon.stub().resolves()
      })
    };
    
    mockDeployHandConfig = {
      get: sinon.stub().returns({}),
      set: sinon.stub().resolves(),
      getNamespace: sinon.stub().returns({
        get: sinon.stub().returns({}),
        set: sinon.stub().resolves()
      })
    };
    
    mockCollabInterfaceConfig = {
      get: sinon.stub().returns({}),
      set: sinon.stub().resolves(),
      getNamespace: sinon.stub().returns({
        get: sinon.stub().returns({}),
        set: sinon.stub().resolves()
      })
    };
    
    mockLifecycleManagerConfig = {
      get: sinon.stub().returns({}),
      set: sinon.stub().resolves(),
      getNamespace: sinon.stub().returns({
        get: sinon.stub().returns({}),
        set: sinon.stub().resolves()
      })
    };
    
    // Create main config mock
    mockConfig = {
      getNamespace: sinon.stub().callsFake((namespace) => {
        if (namespace === 'tentacles.devmaster') {
          return {
            get: sinon.stub().returns({}),
            set: sinon.stub().resolves(),
            getNamespace: sinon.stub().callsFake((subNamespace) => {
              if (subNamespace === 'codeBrain') return mockCodeBrainConfig;
              if (subNamespace === 'visualMind') return mockVisualMindConfig;
              if (subNamespace === 'deployHand') return mockDeployHandConfig;
              if (subNamespace === 'collabInterface') return mockCollabInterfaceConfig;
              if (subNamespace === 'lifecycleManager') return mockLifecycleManagerConfig;
              if (subNamespace === 'accessControl') {
                return {
                  get: sinon.stub().returns({}),
                  set: sinon.stub().resolves()
                };
              }
              return {
                get: sinon.stub().returns({}),
                set: sinon.stub().resolves()
              };
            })
          };
        }
        return {
          get: sinon.stub().returns({}),
          set: sinon.stub().resolves(),
          getNamespace: sinon.stub().returns({
            get: sinon.stub().returns({}),
            set: sinon.stub().resolves()
          })
        };
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
    
    // Create tentacle instance
    tentacle = new DevMasterTentacle();
    tentacle.aideon = mockAideon;
    
    // Set the api property directly to fix the null reference error
    tentacle.api = mockApi;
    
    // Stub logger to prevent console output during tests
    sinon.stub(Logger.prototype, 'info');
    sinon.stub(Logger.prototype, 'warn');
    sinon.stub(Logger.prototype, 'error');
  });
  
  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });
  
  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(tentacle.id).to.equal('devmaster');
      expect(tentacle.name).to.equal('DevMaster');
      expect(tentacle.description).to.equal('Autonomous Software Development Specialist');
      expect(tentacle.version).to.equal('1.0.0');
      expect(tentacle.initialized).to.be.false;
      expect(tentacle.events).to.be.instanceOf(EventEmitter);
      expect(tentacle.logger).to.be.instanceOf(Logger);
      expect(tentacle.accessControl).to.be.null;
      expect(tentacle.codeBrain).to.be.null;
      expect(tentacle.visualMind).to.be.null;
      expect(tentacle.deployHand).to.be.null;
      expect(tentacle.collabInterface).to.be.null;
      expect(tentacle.lifecycleManager).to.be.null;
    });
    
    it('should override default values with provided options', () => {
      const customTentacle = new DevMasterTentacle({
        id: 'custom-devmaster',
        name: 'Custom DevMaster',
        description: 'Custom Description',
        version: '2.0.0'
      });
      
      expect(customTentacle.id).to.equal('custom-devmaster');
      expect(customTentacle.name).to.equal('Custom DevMaster');
      expect(customTentacle.description).to.equal('Custom Description');
      expect(customTentacle.version).to.equal('2.0.0');
    });
  });
  
  describe('Initialize', () => {
    it('should initialize all components and set initialized flag', async () => {
      await tentacle.initialize();
      
      expect(tentacle.initialized).to.be.true;
      expect(mockConfig.getNamespace).to.have.been.calledWith('tentacles.devmaster');
      expect(AccessControlServiceConstructorStub).to.have.been.called;
      expect(AccessControlServiceStub.initialize).to.have.been.called;
      expect(CodeBrainManagerConstructorStub).to.have.been.called;
      expect(VisualMindManagerConstructorStub).to.have.been.called;
      expect(DeployHandManagerConstructorStub).to.have.been.called;
      expect(CollabInterfaceManagerConstructorStub).to.have.been.called;
      expect(LifecycleManagerConstructorStub).to.have.been.called;
      expect(mockApi.register).to.have.been.called;
      expect(mockMetrics.registerTentacle).to.have.been.called;
    });
    
    it('should not re-initialize if already initialized', async () => {
      // First initialize
      await tentacle.initialize();
      
      // Reset stubs to check they're not called again
      AccessControlServiceStub.initialize.reset();
      CodeBrainManagerStub.initialize.reset();
      
      // Try to initialize again
      await tentacle.initialize();
      
      expect(AccessControlServiceStub.initialize).not.to.have.been.called;
      expect(CodeBrainManagerStub.initialize).not.to.have.been.called;
    });
    
    it('should handle initialization errors', async () => {
      const error = new Error('Initialization error');
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
  });
  
  describe('Access Control', () => {
    beforeEach(async () => {
      // Set up access control
      tentacle.accessControl = AccessControlServiceStub;
      tentacle.initialized = true;
    });
    
    it('should delegate hasAccess to AccessControlService', async () => {
      const result = await tentacle.hasAccess('user123');
      
      expect(result).to.be.true;
      expect(tentacle.accessControl.hasAccess).to.have.been.calledWith('user123');
    });
    
    it('should delegate generateInviteCode to AccessControlService', async () => {
      const options = { maxUses: 5, expiresIn: 172800000 };
      const result = await tentacle.generateInviteCode('admin123', options);
      
      expect(result).to.have.property('code');
      expect(result).to.have.property('expiresAt');
      expect(result).to.have.property('maxUses');
      expect(tentacle.accessControl.generateInviteCode).to.have.been.calledWith('admin123', options);
    });
    
    it('should delegate redeemInviteCode to AccessControlService', async () => {
      const result = await tentacle.redeemInviteCode('user123', 'TEST-CODE');
      
      expect(result).to.be.true;
      expect(tentacle.accessControl.redeemInviteCode).to.have.been.calledWith('user123', 'TEST-CODE');
    });
    
    it('should throw error if not initialized', async () => {
      tentacle.initialized = false;
      
      try {
        await tentacle.hasAccess('user123');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('DevMaster Tentacle is not initialized');
      }
    });
  });
  
  describe('Task Execution', () => {
    beforeEach(async () => {
      tentacle.initialized = true;
      tentacle.accessControl = {
        hasAccess: sinon.stub().resolves(true)
      };
      
      // Mock component methods
      tentacle.codeBrain = {
        executeTask: sinon.stub().resolves({ result: 'code task result' })
      };
      
      tentacle.visualMind = {
        designUI: sinon.stub().resolves({ result: 'ui task result' })
      };
      
      tentacle.deployHand = {
        deployApplication: sinon.stub().resolves({ result: 'deploy task result' })
      };
      
      tentacle.collabInterface = {
        createCollaborationSession: sinon.stub().resolves({ result: 'collab task result' })
      };
      
      tentacle.lifecycleManager = {
        manageLifecycle: sinon.stub().resolves({ result: 'lifecycle task result' })
      };
      
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
    });
    
    it('should route code tasks to codeBrain', async () => {
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      const result = await tentacle.executeTask(task, context);
      
      expect(result.success).to.be.true;
      expect(result.result).to.deep.equal({ result: 'code task result' });
      expect(tentacle.codeBrain.executeTask).to.have.been.called;
      expect(tentacle.events.emit).to.have.been.calledWith('task:start');
      expect(tentacle.events.emit).to.have.been.calledWith('task:complete');
      expect(mockMetrics.trackEvent).to.have.been.called;
    });
    
    it('should route ui tasks to visualMind', async () => {
      const task = { id: 'task2', type: 'ui', data: {} };
      const context = { userId: 'user123' };
      
      const result = await tentacle.executeTask(task, context);
      
      expect(result.success).to.be.true;
      expect(result.result).to.deep.equal({ result: 'ui task result' });
      expect(tentacle.visualMind.designUI).to.have.been.called;
    });
    
    it('should route deploy tasks to deployHand', async () => {
      const task = { id: 'task3', type: 'deploy', data: {} };
      const context = { userId: 'user123' };
      
      const result = await tentacle.executeTask(task, context);
      
      expect(result.success).to.be.true;
      expect(result.result).to.deep.equal({ result: 'deploy task result' });
      expect(tentacle.deployHand.deployApplication).to.have.been.called;
    });
    
    it('should route collab tasks to collabInterface', async () => {
      const task = { id: 'task4', type: 'collab', data: {} };
      const context = { userId: 'user123' };
      
      const result = await tentacle.executeTask(task, context);
      
      expect(result.success).to.be.true;
      expect(result.result).to.deep.equal({ result: 'collab task result' });
      expect(tentacle.collabInterface.createCollaborationSession).to.have.been.called;
    });
    
    it('should route lifecycle tasks to lifecycleManager', async () => {
      const task = { id: 'task5', type: 'lifecycle', data: {} };
      const context = { userId: 'user123' };
      
      const result = await tentacle.executeTask(task, context);
      
      expect(result.success).to.be.true;
      expect(result.result).to.deep.equal({ result: 'lifecycle task result' });
      expect(tentacle.lifecycleManager.manageLifecycle).to.have.been.called;
    });
    
    it('should throw error for unknown task types', async () => {
      const task = { id: 'task6', type: 'unknown', data: {} };
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
    
    it('should deny access to unauthorized users', async () => {
      tentacle.accessControl.hasAccess.resolves(false);
      
      const task = { id: 'task7', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Access denied to DevMaster Tentacle');
        expect(tentacle.codeBrain.executeTask).not.to.have.been.called;
      }
    });
  });
  
  describe('Status', () => {
    beforeEach(() => {
      tentacle.initialized = true;
      
      // Mock component getStatus methods
      const mockComponentStatus = { initialized: true, version: '1.0.0' };
      
      tentacle.accessControl = {
        adminOnly: true,
        inviteEnabled: true,
        getActiveInviteCount: sinon.stub().returns(5)
      };
      
      tentacle.codeBrain = {
        getStatus: sinon.stub().returns(mockComponentStatus)
      };
      
      tentacle.visualMind = {
        getStatus: sinon.stub().returns(mockComponentStatus)
      };
      
      tentacle.deployHand = {
        getStatus: sinon.stub().returns(mockComponentStatus)
      };
      
      tentacle.collabInterface = {
        getStatus: sinon.stub().returns(mockComponentStatus)
      };
      
      tentacle.lifecycleManager = {
        getStatus: sinon.stub().returns(mockComponentStatus)
      };
    });
    
    it('should return comprehensive status when initialized', () => {
      const status = tentacle.getStatus();
      
      expect(status.id).to.equal('devmaster');
      expect(status.name).to.equal('DevMaster');
      expect(status.version).to.equal('1.0.0');
      expect(status.initialized).to.be.true;
      expect(status.adminOnly).to.be.true;
      expect(status.inviteEnabled).to.be.true;
      expect(status.activeInvites).to.equal(5);
      expect(status.components).to.have.property('codeBrain');
      expect(status.components).to.have.property('visualMind');
      expect(status.components).to.have.property('deployHand');
      expect(status.components).to.have.property('collabInterface');
      expect(status.components).to.have.property('lifecycleManager');
    });
    
    it('should return limited status when not initialized', () => {
      tentacle.initialized = false;
      
      const status = tentacle.getStatus();
      
      expect(status.id).to.equal('devmaster');
      expect(status.name).to.equal('DevMaster');
      expect(status.version).to.equal('1.0.0');
      expect(status.initialized).to.be.false;
      expect(status.components).to.be.an('object').that.is.empty;
    });
  });
  
  describe('Shutdown', () => {
    beforeEach(() => {
      tentacle.initialized = true;
      
      // Mock component shutdown methods
      const mockShutdown = sinon.stub().resolves();
      
      tentacle.codeBrain = { shutdown: mockShutdown };
      tentacle.visualMind = { shutdown: mockShutdown };
      tentacle.deployHand = { shutdown: mockShutdown };
      tentacle.collabInterface = { shutdown: mockShutdown };
      tentacle.lifecycleManager = { shutdown: mockShutdown };
      
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
    });
    
    it('should shutdown all components and set initialized to false', async () => {
      await tentacle.shutdown();
      
      expect(tentacle.initialized).to.be.false;
      expect(tentacle.codeBrain.shutdown).to.have.been.called;
      expect(tentacle.visualMind.shutdown).to.have.been.called;
      expect(tentacle.deployHand.shutdown).to.have.been.called;
      expect(tentacle.collabInterface.shutdown).to.have.been.called;
      expect(tentacle.lifecycleManager.shutdown).to.have.been.called;
      expect(tentacle.events.emit).to.have.been.calledWith('shutdown');
    });
    
    it('should do nothing if not initialized', async () => {
      tentacle.initialized = false;
      
      await tentacle.shutdown();
      
      expect(tentacle.codeBrain.shutdown).not.to.have.been.called;
      expect(tentacle.events.emit).not.to.have.been.calledWith('shutdown');
    });
    
    it('should handle shutdown errors', async () => {
      const error = new Error('Shutdown error');
      tentacle.codeBrain.shutdown.rejects(error);
      
      try {
        await tentacle.shutdown();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
        expect(Logger.prototype.error).to.have.been.called;
      }
    });
  });
  
  describe('API Handlers', () => {
    beforeEach(() => {
      tentacle.initialized = true;
      
      // Mock methods
      tentacle.hasAccess = sinon.stub().resolves(true);
      tentacle.generateInviteCode = sinon.stub().resolves({ code: 'TEST-CODE' });
      tentacle.redeemInviteCode = sinon.stub().resolves(true);
      tentacle.executeTask = sinon.stub().resolves({ result: 'task result' });
      tentacle.getStatus = sinon.stub().returns({ id: 'devmaster', name: 'DevMaster' });
    });
    
    it('should handle status requests', async () => {
      const request = { userId: 'user123' };
      const response = await tentacle._handleStatusRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('id');
      expect(response.data).to.have.property('name');
      expect(tentacle.hasAccess).to.have.been.calledWith('user123');
      expect(tentacle.getStatus).to.have.been.called;
    });
    
    it('should handle generate invite requests', async () => {
      const request = { userId: 'admin123', options: { maxUses: 5 } };
      const response = await tentacle._handleGenerateInviteRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('code');
      expect(tentacle.generateInviteCode).to.have.been.calledWith('admin123', { maxUses: 5 });
    });
    
    it('should handle redeem invite requests', async () => {
      const request = { userId: 'user123', code: 'TEST-CODE' };
      const response = await tentacle._handleRedeemInviteRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.message).to.equal('Invite code redeemed successfully');
      expect(tentacle.redeemInviteCode).to.have.been.calledWith('user123', 'TEST-CODE');
    });
    
    it('should handle execute task requests', async () => {
      const request = { userId: 'user123', task: { type: 'code' } };
      const response = await tentacle._handleExecuteTaskRequest(request);
      
      expect(response.status).to.equal('success');
      expect(response.data).to.have.property('result');
      expect(tentacle.executeTask).to.have.been.calledWith({ type: 'code' }, { userId: 'user123' });
    });
    
    it('should handle errors in API requests', async () => {
      const error = new Error('Test error');
      tentacle.hasAccess.rejects(error);
      
      const request = { userId: 'user123' };
      const response = await tentacle._handleStatusRequest(request);
      
      expect(response.status).to.equal('error');
      expect(response.message).to.equal('Test error');
      expect(Logger.prototype.error).to.have.been.called;
    });
  });
  
  describe('Event Handlers', () => {
    beforeEach(() => {
      // Create fresh stubs for metrics tracking to avoid double-stubbing
      mockMetrics = {
        trackMetric: sinon.stub(),
        trackEvent: sinon.stub()
      };
      
      tentacle.aideon = {
        ...mockAideon,
        metrics: mockMetrics
      };
    });
    
    it('should track metrics on task start', () => {
      const event = { userId: 'user123', taskType: 'code', taskId: 'task1' };
      tentacle._onTaskStart(event);
      
      expect(mockMetrics.trackMetric).to.have.been.calledWith(
        'devmaster:active_users',
        1,
        sinon.match({ userId: 'user123', taskType: 'code' })
      );
    });
    
    it('should track metrics on task complete', () => {
      const event = { userId: 'user123', taskType: 'code', taskId: 'task1', executionTime: 1000 };
      tentacle._onTaskComplete(event);
      
      expect(mockMetrics.trackMetric).to.have.been.calledWith(
        'devmaster:task_execution_time',
        1000,
        sinon.match({ taskType: 'code', userId: 'user123' })
      );
      
      expect(mockMetrics.trackMetric).to.have.been.calledWith(
        'devmaster:task_success_rate',
        100,
        sinon.match({ taskType: 'code', userId: 'user123' })
      );
    });
    
    it('should track metrics on task error', () => {
      const event = { userId: 'user123', taskType: 'code', taskId: 'task1', error: 'Test error' };
      tentacle._onTaskError(event);
      
      expect(mockMetrics.trackMetric).to.have.been.calledWith(
        'devmaster:task_success_rate',
        0,
        sinon.match({ taskType: 'code', userId: 'user123', error: 'Test error' })
      );
    });
    
    it('should track metrics on invite generated', () => {
      const event = { adminId: 'admin123', expiresAt: Date.now() + 86400000, maxUses: 5 };
      tentacle._onInviteGenerated(event);
      
      expect(mockMetrics.trackEvent).to.have.been.calledWith(
        'devmaster:invite:generated',
        sinon.match({ adminId: 'admin123', maxUses: 5 })
      );
    });
    
    it('should track metrics on invite redeemed', () => {
      const event = { userId: 'user123' };
      tentacle._onInviteRedeemed(event);
      
      expect(mockMetrics.trackEvent).to.have.been.calledWith(
        'devmaster:invite:redeemed',
        sinon.match({ userId: 'user123' })
      );
    });
  });
});
