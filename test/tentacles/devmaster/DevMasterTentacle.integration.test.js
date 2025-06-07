/**
 * @fileoverview Integration and concurrency tests for DevMaster Tentacle
 * 
 * This file contains tests specifically focused on integration between components
 * and concurrency scenarios for the DevMaster Tentacle implementation.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { EventEmitter } = require('../../../src/core/events/EventEmitter');
const { Logger } = require('../../../src/core/logging/Logger');

describe('DevMasterTentacle Integration and Concurrency', () => {
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
  
  describe('Component Integration', () => {
    beforeEach(async () => {
      // Initialize the tentacle
      await tentacle.initialize();
    });
    
    it('should integrate CodeBrain with VisualMind for full-stack development tasks', async () => {
      // Set up CodeBrain to generate code
      CodeBrainManagerStub.executeTask.resolves({
        result: {
          code: 'function add(a, b) { return a + b; }',
          language: 'javascript',
          metadata: { complexity: 'low' }
        }
      });
      
      // Set up VisualMind to design UI
      VisualMindManagerStub.designUI.resolves({
        result: {
          ui: '<div>Calculator</div>',
          framework: 'react',
          metadata: { complexity: 'medium' }
        }
      });
      
      // Create a full-stack task that requires both code and UI
      const task = {
        id: 'fullstack-task',
        type: 'fullstack',
        data: {
          requirements: 'Create a calculator app',
          codeRequirements: 'Implement basic arithmetic operations',
          uiRequirements: 'Create a simple calculator interface'
        }
      };
      
      // Execute the task
      const result = await tentacle.executeTask(task, { userId: 'user123' });
      
      // Verify both components were called
      expect(CodeBrainManagerStub.executeTask).to.have.been.called;
      expect(VisualMindManagerStub.designUI).to.have.been.called;
      
      // Verify the result contains both code and UI
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('result');
      expect(result.result).to.have.property('code');
      expect(result.result).to.have.property('ui');
    });
    
    it('should integrate CodeBrain with DeployHand for deployment tasks', async () => {
      // Set up CodeBrain to generate code
      CodeBrainManagerStub.executeTask.resolves({
        result: {
          code: 'function add(a, b) { return a + b; }',
          language: 'javascript',
          metadata: { complexity: 'low' }
        }
      });
      
      // Set up DeployHand to deploy application
      DeployHandManagerStub.deployApplication.resolves({
        result: {
          deploymentId: 'deploy-123',
          url: 'https://example.com/app',
          status: 'success'
        }
      });
      
      // Create a deployment task that requires both code and deployment
      const task = {
        id: 'deploy-task',
        type: 'deploy',
        data: {
          requirements: 'Deploy a calculator app',
          codeRequirements: 'Implement basic arithmetic operations',
          deploymentTarget: 'aws'
        }
      };
      
      // Execute the task
      const result = await tentacle.executeTask(task, { userId: 'user123' });
      
      // Verify both components were called
      expect(CodeBrainManagerStub.executeTask).to.have.been.called;
      expect(DeployHandManagerStub.deployApplication).to.have.been.called;
      
      // Verify the result contains deployment information
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('result');
      expect(result.result).to.have.property('deploymentId', 'deploy-123');
      expect(result.result).to.have.property('url', 'https://example.com/app');
    });
    
    it('should integrate CollabInterface with other components for collaborative tasks', async () => {
      // Set up CollabInterface to create a collaboration session
      CollabInterfaceManagerStub.createCollaborationSession.resolves({
        result: {
          sessionId: 'collab-123',
          participants: ['user123', 'user456'],
          status: 'active'
        }
      });
      
      // Create a collaboration task
      const task = {
        id: 'collab-task',
        type: 'collab',
        data: {
          participants: ['user123', 'user456'],
          taskType: 'code',
          requirements: 'Collaborative code editing'
        }
      };
      
      // Execute the task
      const result = await tentacle.executeTask(task, { userId: 'user123' });
      
      // Verify CollabInterface was called
      expect(CollabInterfaceManagerStub.createCollaborationSession).to.have.been.called;
      
      // Verify the result contains collaboration session information
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('result');
      expect(result.result).to.have.property('sessionId', 'collab-123');
      expect(result.result).to.have.property('participants').that.includes('user123');
      expect(result.result).to.have.property('participants').that.includes('user456');
    });
    
    it('should integrate LifecycleManager with other components for project lifecycle tasks', async () => {
      // Set up LifecycleManager to manage project lifecycle
      LifecycleManagerStub.manageLifecycle.resolves({
        result: {
          projectId: 'project-123',
          stage: 'development',
          status: 'in-progress'
        }
      });
      
      // Create a lifecycle task
      const task = {
        id: 'lifecycle-task',
        type: 'lifecycle',
        data: {
          projectId: 'project-123',
          action: 'advance',
          targetStage: 'testing'
        }
      };
      
      // Execute the task
      const result = await tentacle.executeTask(task, { userId: 'user123' });
      
      // Verify LifecycleManager was called
      expect(LifecycleManagerStub.manageLifecycle).to.have.been.called;
      
      // Verify the result contains lifecycle information
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('result');
      expect(result.result).to.have.property('projectId', 'project-123');
      expect(result.result).to.have.property('stage', 'development');
      expect(result.result).to.have.property('status', 'in-progress');
    });
  });
  
  describe('Concurrency Handling', () => {
    beforeEach(async () => {
      // Initialize the tentacle
      await tentacle.initialize();
    });
    
    it('should handle multiple concurrent task executions', async () => {
      // Create multiple tasks
      const tasks = [
        { id: 'task1', type: 'code', data: { requirements: 'Task 1' } },
        { id: 'task2', type: 'ui', data: { requirements: 'Task 2' } },
        { id: 'task3', type: 'deploy', data: { requirements: 'Task 3' } },
        { id: 'task4', type: 'collab', data: { requirements: 'Task 4' } },
        { id: 'task5', type: 'lifecycle', data: { requirements: 'Task 5' } }
      ];
      
      // Execute all tasks concurrently
      const results = await Promise.all(
        tasks.map(task => tentacle.executeTask(task, { userId: 'user123' }))
      );
      
      // Verify all tasks were executed
      expect(results).to.have.length(5);
      results.forEach(result => {
        expect(result).to.have.property('success', true);
      });
      
      // Verify component methods were called
      expect(CodeBrainManagerStub.executeTask).to.have.been.called;
      expect(VisualMindManagerStub.designUI).to.have.been.called;
      expect(DeployHandManagerStub.deployApplication).to.have.been.called;
      expect(CollabInterfaceManagerStub.createCollaborationSession).to.have.been.called;
      expect(LifecycleManagerStub.manageLifecycle).to.have.been.called;
    });
    
    it('should handle concurrent access to shared resources', async () => {
      // Create a shared resource (e.g., a counter)
      let counter = 0;
      
      // Mock CodeBrainManager to increment the counter
      CodeBrainManagerStub.executeTask = async () => {
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
        counter++;
        return { result: `Counter: ${counter}` };
      };
      
      // Create multiple tasks
      const tasks = Array(10).fill().map((_, i) => ({
        id: `task${i}`,
        type: 'code',
        data: { requirements: `Task ${i}` }
      }));
      
      // Execute all tasks concurrently
      const results = await Promise.all(
        tasks.map(task => tentacle.executeTask(task, { userId: 'user123' }))
      );
      
      // Verify all tasks were executed
      expect(results).to.have.length(10);
      
      // Verify the counter was incremented correctly
      expect(counter).to.equal(10);
    });
    
    it('should handle race conditions in event handling', async () => {
      // Create a real event emitter
      tentacle.events = new EventEmitter();
      
      // Create a shared resource
      let eventCount = 0;
      
      // Set up event handlers
      tentacle.events.on('test:event', () => {
        // Simulate some async work
        setTimeout(() => {
          eventCount++;
        }, Math.random() * 10);
      });
      
      // Emit multiple events concurrently
      for (let i = 0; i < 10; i++) {
        tentacle.events.emit('test:event', { id: i });
      }
      
      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify all events were handled
      expect(eventCount).to.equal(10);
    });
    
    it('should handle concurrent initialization attempts', async () => {
      // Reset initialized flag
      tentacle.initialized = false;
      
      // Attempt to initialize multiple times concurrently
      const initPromises = Array(5).fill().map(() => tentacle.initialize());
      
      // Wait for all initialization attempts to complete
      await Promise.all(initPromises);
      
      // Verify initialization was only performed once
      expect(AccessControlServiceStub.initialize).to.have.been.calledOnce;
      expect(CodeBrainManagerStub.initialize).to.have.been.calledOnce;
      expect(VisualMindManagerStub.initialize).to.have.been.calledOnce;
      expect(DeployHandManagerStub.initialize).to.have.been.calledOnce;
      expect(CollabInterfaceManagerStub.initialize).to.have.been.calledOnce;
      expect(LifecycleManagerStub.initialize).to.have.been.calledOnce;
    });
    
    it('should handle concurrent shutdown attempts', async () => {
      // Attempt to shutdown multiple times concurrently
      const shutdownPromises = Array(5).fill().map(() => tentacle.shutdown());
      
      // Wait for all shutdown attempts to complete
      await Promise.all(shutdownPromises);
      
      // Verify shutdown was only performed once
      expect(CodeBrainManagerStub.shutdown).to.have.been.calledOnce;
      expect(VisualMindManagerStub.shutdown).to.have.been.calledOnce;
      expect(DeployHandManagerStub.shutdown).to.have.been.calledOnce;
      expect(CollabInterfaceManagerStub.shutdown).to.have.been.calledOnce;
      expect(LifecycleManagerStub.shutdown).to.have.been.calledOnce;
    });
  });
  
  describe('Edge Cases', () => {
    beforeEach(async () => {
      // Initialize the tentacle
      await tentacle.initialize();
    });
    
    it('should handle tasks with empty data', async () => {
      const task = { id: 'empty-task', type: 'code', data: {} };
      
      const result = await tentacle.executeTask(task, { userId: 'user123' });
      
      expect(result).to.have.property('success', true);
      expect(CodeBrainManagerStub.executeTask).to.have.been.called;
    });
    
    it('should handle tasks with missing data property', async () => {
      const task = { id: 'missing-data-task', type: 'code' };
      
      const result = await tentacle.executeTask(task, { userId: 'user123' });
      
      expect(result).to.have.property('success', true);
      expect(CodeBrainManagerStub.executeTask).to.have.been.called;
    });
    
    it('should handle tasks with null context', async () => {
      const task = { id: 'null-context-task', type: 'code', data: {} };
      
      try {
        await tentacle.executeTask(task, null);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.include('Invalid context');
      }
    });
    
    it('should handle tasks with missing userId in context', async () => {
      const task = { id: 'missing-userid-task', type: 'code', data: {} };
      
      try {
        await tentacle.executeTask(task, {});
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.include('Missing userId');
      }
    });
    
    it('should handle component initialization timeout', async () => {
      // Reset initialized flag
      tentacle.initialized = false;
      
      // Make initialization hang
      CodeBrainManagerStub.initialize = () => new Promise(resolve => setTimeout(resolve, 10000));
      
      // Set a timeout for initialization
      const initPromise = Promise.race([
        tentacle.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), 100))
      ]);
      
      try {
        await initPromise;
        expect.fail('Should have thrown a timeout error');
      } catch (err) {
        expect(err.message).to.equal('Initialization timeout');
      }
    });
    
    it('should handle component shutdown timeout', async () => {
      // Make shutdown hang
      CodeBrainManagerStub.shutdown = () => new Promise(resolve => setTimeout(resolve, 10000));
      
      // Set a timeout for shutdown
      const shutdownPromise = Promise.race([
        tentacle.shutdown(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), 100))
      ]);
      
      try {
        await shutdownPromise;
        expect.fail('Should have thrown a timeout error');
      } catch (err) {
        expect(err.message).to.equal('Shutdown timeout');
      }
    });
  });
});
