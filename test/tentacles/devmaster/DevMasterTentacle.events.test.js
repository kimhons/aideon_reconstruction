/**
 * @fileoverview Event handling tests for DevMaster Tentacle
 * 
 * This file contains tests specifically focused on event handling and propagation
 * for the DevMaster Tentacle implementation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { EventEmitter } = require('../../../src/core/events/EventEmitter');
const { Logger } = require('../../../src/core/logging/Logger');

describe('DevMasterTentacle Event Handling', () => {
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
    
    // Stub logger to prevent console output during tests
    sinon.stub(Logger.prototype, 'info');
    sinon.stub(Logger.prototype, 'warn');
    sinon.stub(Logger.prototype, 'error');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('Initialization Events', () => {
    it('should emit initialized event after successful initialization', async () => {
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
      
      await tentacle.initialize();
      
      expect(tentacle.events.emit).to.have.been.calledWith('initialized', sinon.match({
        tentacleId: 'devmaster',
        timestamp: sinon.match.number
      }));
    });
    
    it('should not emit initialized event if initialization fails', async () => {
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
      
      // Make initialization fail
      const error = new Error('Initialization failed');
      AccessControlServiceStub.initialize.rejects(error);
      
      try {
        await tentacle.initialize();
      } catch (err) {
        // Expected error
      }
      
      expect(tentacle.events.emit).not.to.have.been.calledWith('initialized');
    });
  });
  
  describe('Task Execution Events', () => {
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
    
    it('should emit task:start event when task execution begins', async () => {
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      await tentacle.executeTask(task, context);
      
      expect(tentacle.events.emit).to.have.been.calledWith('task:start', sinon.match({
        taskId: 'task1',
        taskType: 'code',
        userId: 'user123',
        timestamp: sinon.match.number
      }));
    });
    
    it('should emit task:complete event when task execution succeeds', async () => {
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      await tentacle.executeTask(task, context);
      
      expect(tentacle.events.emit).to.have.been.calledWith('task:complete', sinon.match({
        taskId: 'task1',
        taskType: 'code',
        userId: 'user123',
        executionTime: sinon.match.number,
        success: true,
        timestamp: sinon.match.number
      }));
    });
    
    it('should emit task:error event when task execution fails', async () => {
      const error = new Error('Task execution failed');
      CodeBrainManagerStub.executeTask.rejects(error);
      
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      try {
        await tentacle.executeTask(task, context);
      } catch (err) {
        // Expected error
      }
      
      expect(tentacle.events.emit).to.have.been.calledWith('task:error', sinon.match({
        taskId: 'task1',
        taskType: 'code',
        userId: 'user123',
        error: 'Task execution failed',
        timestamp: sinon.match.number
      }));
    });
    
    it('should emit task events in the correct sequence', async () => {
      const task = { id: 'task1', type: 'code', data: {} };
      const context = { userId: 'user123' };
      
      await tentacle.executeTask(task, context);
      
      expect(tentacle.events.emit.firstCall).to.have.been.calledWith('task:start');
      expect(tentacle.events.emit.secondCall).to.have.been.calledWith('task:complete');
    });
  });
  
  describe('Invite Events', () => {
    beforeEach(async () => {
      tentacle.initialized = true;
      tentacle.accessControl = AccessControlServiceStub;
      
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
      
      // Expose private methods for testing
      tentacle._onInviteGenerated = tentacle._onInviteGenerated.bind(tentacle);
      tentacle._onInviteRedeemed = tentacle._onInviteRedeemed.bind(tentacle);
    });
    
    it('should handle invite:generated event', async () => {
      const eventData = {
        inviteCode: 'TEST-CODE',
        generatedBy: 'admin123',
        expiresAt: Date.now() + 86400000,
        maxUses: 1
      };
      
      // Manually trigger the event handler
      tentacle._onInviteGenerated(eventData);
      
      // Verify metrics were tracked
      expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:invite:generated', sinon.match({
        inviteCode: 'TEST-CODE',
        generatedBy: 'admin123'
      }));
    });
    
    it('should handle invite:redeemed event', async () => {
      const eventData = {
        inviteCode: 'TEST-CODE',
        redeemedBy: 'user123',
        redeemedAt: Date.now()
      };
      
      // Manually trigger the event handler
      tentacle._onInviteRedeemed(eventData);
      
      // Verify metrics were tracked
      expect(mockMetrics.trackEvent).to.have.been.calledWith('devmaster:invite:redeemed', sinon.match({
        inviteCode: 'TEST-CODE',
        redeemedBy: 'user123'
      }));
    });
  });
  
  describe('Shutdown Events', () => {
    beforeEach(async () => {
      tentacle.initialized = true;
      tentacle.codeBrain = CodeBrainManagerStub;
      tentacle.visualMind = VisualMindManagerStub;
      tentacle.deployHand = DeployHandManagerStub;
      tentacle.collabInterface = CollabInterfaceManagerStub;
      tentacle.lifecycleManager = LifecycleManagerStub;
      
      // Spy on events
      sinon.spy(tentacle.events, 'emit');
    });
    
    it('should emit shutdown event after successful shutdown', async () => {
      await tentacle.shutdown();
      
      expect(tentacle.events.emit).to.have.been.calledWith('shutdown', sinon.match({
        tentacleId: 'devmaster',
        timestamp: sinon.match.number
      }));
    });
    
    it('should not emit shutdown event if shutdown fails', async () => {
      // Make shutdown fail
      const error = new Error('Shutdown failed');
      CodeBrainManagerStub.shutdown.rejects(error);
      
      try {
        await tentacle.shutdown();
      } catch (err) {
        // Expected error
      }
      
      expect(tentacle.events.emit).not.to.have.been.calledWith('shutdown');
    });
    
    it('should handle system:shutdown event', async () => {
      // Spy on shutdown method
      sinon.spy(tentacle, 'shutdown');
      
      // Manually trigger the system:shutdown event
      tentacle.events.emit('system:shutdown');
      
      // Verify shutdown was called
      expect(tentacle.shutdown).to.have.been.called;
    });
  });
  
  describe('Event Propagation', () => {
    beforeEach(async () => {
      // Initialize the tentacle
      await tentacle.initialize();
      
      // Create real event emitters for components
      const realEventEmitter = new EventEmitter();
      
      // Replace stubs with objects that have real event emitters
      tentacle.codeBrain.events = realEventEmitter;
      tentacle.visualMind.events = realEventEmitter;
      tentacle.deployHand.events = realEventEmitter;
      tentacle.collabInterface.events = realEventEmitter;
      tentacle.lifecycleManager.events = realEventEmitter;
      
      // Spy on tentacle events
      sinon.spy(tentacle.events, 'emit');
    });
    
    it('should propagate component events to tentacle events', async () => {
      // Emit an event from a component
      tentacle.codeBrain.events.emit('code:generated', {
        language: 'javascript',
        linesOfCode: 100,
        timestamp: Date.now()
      });
      
      // Verify the event was propagated to the tentacle
      expect(tentacle.events.emit).to.have.been.calledWith('code:generated', sinon.match({
        language: 'javascript',
        linesOfCode: 100,
        timestamp: sinon.match.number
      }));
    });
    
    it('should propagate tentacle events to component events', async () => {
      // Spy on component events
      sinon.spy(tentacle.codeBrain.events, 'emit');
      
      // Emit an event from the tentacle
      tentacle.events.emit('system:config:changed', {
        namespace: 'tentacles.devmaster.codeBrain',
        changes: { supportedLanguages: ['javascript', 'typescript'] },
        timestamp: Date.now()
      });
      
      // Verify the event was propagated to the component
      expect(tentacle.codeBrain.events.emit).to.have.been.calledWith('system:config:changed', sinon.match({
        namespace: 'tentacles.devmaster.codeBrain',
        changes: { supportedLanguages: ['javascript', 'typescript'] },
        timestamp: sinon.match.number
      }));
    });
  });
});
