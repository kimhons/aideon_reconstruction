/**
 * @fileoverview Tests for automatic trigger detection and recording activation.
 * 
 * This module tests the integration between the trigger detection system
 * and the EnhancedScreenRecordingManager for automatic recording activation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const os = require('os');

// Import test module resolver
const TestModuleResolver = require('./utils/TestModuleResolver');

// Set up mocks before importing modules
// Mock file system
const mockFs = {
  promises: {
    mkdir: sinon.stub().resolves(),
    writeFile: sinon.stub().resolves()
  }
};

// Stub fs module
originalFs = require('fs');
fsStub = sinon.stub(require('fs'), 'promises').value(mockFs.promises);

// Import proxyquire for dependency mocking
const proxyquire = require('proxyquire').noCallThru();

// Use existing path module
const basePath = path.resolve(__dirname, '../../../../../src/tentacles/multimodal/input/screen');

// Create mock implementations for utils
const mockEnhancedAsyncLock = function() {
  this.withLock = async function(callback, options) {
    return await callback();
  };
  this.acquire = sinon.stub().resolves();
  this.release = sinon.stub().resolves();
};

const mockEnhancedCancellationToken = function() {
  this.isCancelled = false;
  this.throwIfCancelled = () => {};
  this.cancel = () => { this.isCancelled = true; };
};

const mockEnhancedAsyncOperation = {
  execute: async function(callback, options) {
    return await callback({ isCancelled: false, throwIfCancelled: () => {} });
  }
};

// Create mock utils module
const mockUtils = {
  EnhancedAsyncLock: mockEnhancedAsyncLock,
  EnhancedCancellationToken: mockEnhancedCancellationToken,
  EnhancedAsyncOperation: mockEnhancedAsyncOperation,
  ModuleResolver: {}
};

// Create mock TriggerManager
const mockTriggerManager = {
  TriggerManager: function() {
    this.initialize = sinon.stub().resolves();
    this.shutdown = sinon.stub().resolves();
    this.updateConfiguration = sinon.stub().resolves();
    this.registerTrigger = sinon.stub().resolves('mock-trigger-id');
    this.on = sinon.stub();
    this.off = sinon.stub();
    this.initialized = false;
  },
  TriggerManagerEvent: {
    TRIGGER_ACTIVATED: 'trigger-activated',
    TRIGGER_DEACTIVATED: 'trigger-deactivated'
  }
};

// Import constants directly
const { ScreenRecordingState } = require(path.join(basePath, 'constants.js'));

// Use proxyquire to mock dependencies
const { EnhancedScreenRecordingManager, ScreenRecordingEvent } = proxyquire(
  path.join(basePath, 'EnhancedScreenRecordingManager.js'), 
  {
    './utils': mockUtils,
    './trigger/TriggerManager': mockTriggerManager
  }
);

// Create a simple mock for TriggerDetector
class MockTriggerDetector {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.id = options.id || 'mock-detector';
    this.initialized = false;
    this.detecting = false;
  }

  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }

  async startDetection() {
    this.detecting = true;
    return Promise.resolve();
  }

  async stopDetection() {
    this.detecting = false;
    return Promise.resolve();
  }

  getType() {
    return 'mock';
  }

  getName() {
    return 'Mock Trigger Detector';
  }

  getDescription() {
    return 'Mock trigger detector for testing';
  }

  emitTriggerEvent(data) {
    // This would be implemented in a real detector
  }
}

// Use our mock instead of the real TriggerDetector
const TriggerDetector = MockTriggerDetector;

describe('Automatic Trigger Recording Tests', function() {
  // Test timeout
  this.timeout(10000);
  
  // Test variables
  let manager;
  let mockCaptureService;
  let mockLearningManager;
  let mockVoiceInputManager;
  let mockErrorMonitor;
  let mockConfigManager;
  let mockAnalysisEngine;
  let mockLogger;
  
  // Setup before each test
  beforeEach(async function() {
    // Reset stubs
    mockFs.promises.mkdir.reset();
    mockFs.promises.writeFile.reset();
    
    // Create mock capture service
    mockCaptureService = {
      initialize: sinon.stub().resolves(),
      startCapture: sinon.stub().resolves('mock-session-id'),
      stopCapture: sinon.stub().resolves({ frameCount: 100, duration: 10000 }),
      shutdown: sinon.stub().resolves(),
      updateConfiguration: sinon.stub().resolves()
    };
    
    // Create mock learning manager
    mockLearningManager = {
      on: sinon.stub(),
      off: sinon.stub(),
      isLearningModeActive: sinon.stub().resolves(false),
      getCurrentSession: sinon.stub().resolves(null)
    };
    
    // Create mock voice input manager
    mockVoiceInputManager = {
      on: sinon.stub(),
      off: sinon.stub(),
      registerCommands: sinon.stub().resolves(),
      unregisterCommands: sinon.stub().resolves()
    };
    
    // Create mock error monitor
    mockErrorMonitor = {
      on: sinon.stub(),
      off: sinon.stub()
    };
    
    // Create mock config manager
    mockConfigManager = {
      getConfig: sinon.stub().resolves(null),
      setConfig: sinon.stub().resolves()
    };
    
    // Create mock analysis engine
    mockAnalysisEngine = {
      initialize: sinon.stub().resolves(),
      updateConfiguration: sinon.stub().resolves(),
      initialized: false
    };
    
    // Create mock logger
    mockLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    // Create manager instance with all required methods pre-defined
    manager = new EnhancedScreenRecordingManager({
      logger: mockLogger,
      configManager: mockConfigManager,
      analysisEngine: mockAnalysisEngine,
      errorMonitor: mockErrorMonitor,
      learningManager: mockLearningManager,
      voiceInputManager: mockVoiceInputManager,
      // Pre-define all methods that will be bound in constructor
      initialize: function() {},
      shutdown: function() {},
      updateConfiguration: function() {},
      setState: function() {},
      startRecording: function() {},
      stopRecording: function() {},
      pauseRecording: function() {},
      resumeRecording: function() {},
      captureSingleFrame: function() {},
      analyzeRecording: function() {},
      getRecordingInfo: function() {},
      getAnalysisResults: function() {},
      startAutomaticRecording: function() {},
      stopAutomaticRecording: function() {},
      handleTriggerEvent: function() {}
    });
    
    // Stub platform-specific capture service initialization
    sinon.stub(manager, 'initializeCaptureService').callsFake(async function() {
      this.captureService = mockCaptureService;
    });
    
    // Initialize manager
    await manager.initialize();
  });
  
  // Cleanup after each test
  afterEach(async function() {
    // Restore stubs
    sinon.restore();
    
    // Shutdown manager
    if (manager && manager.initialized) {
      await manager.shutdown();
    }
  });
  
  // Test automatic recording activation via trigger manager
  it('should activate recording when trigger manager emits trigger event', async function() {
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    manager.on(ScreenRecordingEvent.RECORDING_STARTED, recordingStartedSpy);
    
    // Create trigger event
    const triggerEvent = {
      triggerId: 'test-trigger-1',
      triggerType: 'learning',
      confidence: 0.9,
      context: {
        sessionId: 'test-session-1',
        taskName: 'Test Task'
      },
      timestamp: Date.now(),
      suggestedDuration: 120,
      metadata: {
        learningMode: true,
        sessionId: 'test-session-1'
      }
    };
    
    // Manually trigger the event handler
    await manager.handleTriggerEvent(triggerEvent);
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Verify recording has trigger metadata
    const recordingInfo = recordingStartedSpy.args[0][0];
    assert.strictEqual(recordingInfo.isAutomaticRecording, true, 'Recording should be marked as automatic');
    assert.strictEqual(recordingInfo.triggerMetadata.triggerId, triggerEvent.triggerId, 'Trigger ID should match');
    assert.strictEqual(recordingInfo.triggerMetadata.triggerType, triggerEvent.triggerType, 'Trigger type should match');
    
    // Verify capture service was called
    assert.strictEqual(mockCaptureService.startCapture.calledOnce, true, 'Capture service should be called');
    
    // Stop the recording
    const stoppedRecording = await manager.stopRecording();
    
    // Verify recording metadata was saved
    assert.strictEqual(mockFs.promises.writeFile.calledOnce, true, 'Recording metadata should be saved');
    
    // Verify recording was properly stopped
    assert.strictEqual(stoppedRecording.isActive, false, 'Recording should be marked as inactive');
    assert.strictEqual(manager.state, ScreenRecordingState.READY, 'Manager should return to ready state');
  });
  
  // Test automatic recording deactivation
  it('should deactivate recording when trigger manager emits deactivation event', async function() {
    // Create spies for recording events
    const recordingStartedSpy = sinon.spy();
    const recordingStoppedSpy = sinon.spy();
    manager.on(ScreenRecordingEvent.RECORDING_STARTED, recordingStartedSpy);
    manager.on(ScreenRecordingEvent.RECORDING_STOPPED, recordingStoppedSpy);
    
    // Create trigger event
    const triggerEvent = {
      triggerId: 'test-trigger-2',
      triggerType: 'voice',
      confidence: 0.9,
      context: {
        command: 'record screen',
        sessionId: 'test-session-2'
      },
      timestamp: Date.now(),
      suggestedDuration: 120,
      metadata: {
        voiceCommand: true,
        sessionId: 'test-session-2'
      }
    };
    
    // Start recording
    await manager.handleTriggerEvent(triggerEvent);
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Create deactivation event
    const deactivationEvent = {
      ...triggerEvent,
      deactivate: true,
      context: {
        command: 'stop recording',
        sessionId: 'test-session-2',
        endReason: 'voice_command'
      },
      metadata: {
        deactivation: true
      }
    };
    
    // Trigger deactivation
    await manager.handleTriggerEvent(deactivationEvent);
    
    // Verify recording was stopped
    assert.strictEqual(recordingStoppedSpy.calledOnce, true, 'Recording stopped event should be emitted');
    assert.strictEqual(manager.state, ScreenRecordingState.READY, 'Manager should return to ready state');
    assert.strictEqual(manager.activeRecording, null, 'Active recording should be cleared');
    assert.strictEqual(manager.automaticRecordings.size, 0, 'Automatic recordings map should be empty');
  });
  
  // Test automatic recording with disabled trigger type
  it('should not activate recording for disabled trigger types', async function() {
    // Update configuration to disable voice triggers
    await manager.updateConfiguration({
      automaticRecording: {
        enabledTriggers: ['learning', 'error'] // voice not included
      }
    });
    
    // Create trigger event for voice command
    const triggerEvent = {
      triggerId: 'test-trigger-3',
      triggerType: 'voice', // This type is disabled
      confidence: 0.9,
      context: {
        command: 'record screen',
        sessionId: 'test-session-3'
      },
      timestamp: Date.now(),
      suggestedDuration: 120,
      metadata: {
        voiceCommand: true,
        sessionId: 'test-session-3'
      }
    };
    
    // Try to trigger recording
    await manager.handleTriggerEvent(triggerEvent);
    
    // Verify recording was not started
    assert.strictEqual(manager.state, ScreenRecordingState.READY, 'Manager should remain in ready state');
    assert.strictEqual(manager.activeRecording, null, 'No active recording should be created');
    assert.strictEqual(mockCaptureService.startCapture.called, false, 'Capture service should not be called');
  });
  
  // Test automatic recording with disabled automatic recording
  it('should not activate recording when automatic recording is disabled', async function() {
    // Update configuration to disable automatic recording
    await manager.updateConfiguration({
      automaticRecording: {
        enabled: false
      }
    });
    
    // Create trigger event
    const triggerEvent = {
      triggerId: 'test-trigger-4',
      triggerType: 'learning',
      confidence: 0.9,
      context: {
        sessionId: 'test-session-4',
        taskName: 'Test Task'
      },
      timestamp: Date.now(),
      suggestedDuration: 120,
      metadata: {
        learningMode: true,
        sessionId: 'test-session-4'
      }
    };
    
    // Try to trigger recording
    await manager.handleTriggerEvent(triggerEvent);
    
    // Verify recording was not started
    assert.strictEqual(manager.state, ScreenRecordingState.READY, 'Manager should remain in ready state');
    assert.strictEqual(manager.activeRecording, null, 'No active recording should be created');
    assert.strictEqual(mockCaptureService.startCapture.called, false, 'Capture service should not be called');
  });
  
  // Test maximum duration for automatic recording
  it('should respect maximum duration for automatic recordings', async function() {
    // Set a very short max duration for testing
    await manager.updateConfiguration({
      automaticRecording: {
        maxDuration: 0.1 // 100ms
      }
    });
    
    // Create trigger event
    const triggerEvent = {
      triggerId: 'test-trigger-5',
      triggerType: 'learning',
      confidence: 0.9,
      context: {
        sessionId: 'test-session-5',
        taskName: 'Test Task'
      },
      timestamp: Date.now(),
      suggestedDuration: 120, // This will be overridden by maxDuration
      metadata: {
        learningMode: true,
        sessionId: 'test-session-5'
      }
    };
    
    // Create spy for recording stopped event
    const recordingStoppedSpy = sinon.spy();
    manager.on(ScreenRecordingEvent.RECORDING_STOPPED, recordingStoppedSpy);
    
    // Start recording
    await manager.handleTriggerEvent(triggerEvent);
    
    // Wait for max duration to elapse
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify recording was stopped automatically
    assert.strictEqual(recordingStoppedSpy.calledOnce, true, 'Recording should be stopped automatically');
    assert.strictEqual(manager.state, ScreenRecordingState.READY, 'Manager should return to ready state');
    assert.strictEqual(manager.activeRecording, null, 'Active recording should be cleared');
  });
  
  // Test custom trigger detector integration
  it('should integrate with custom trigger detectors', async function() {
    // Create custom trigger detector
    class CustomTriggerDetector extends TriggerDetector {
      constructor(options = {}) {
        super(options);
      }
      
      async initialize() {
        this.initialized = true;
        return Promise.resolve();
      }
      
      async startDetection() {
        this.detecting = true;
        return Promise.resolve();
      }
      
      async stopDetection() {
        this.detecting = false;
        return Promise.resolve();
      }
      
      getType() {
        return 'custom';
      }
      
      getName() {
        return 'Custom Trigger Detector';
      }
      
      getDescription() {
        return 'Custom trigger detector for testing';
      }
      
      // Method to simulate trigger activation
      simulateTrigger(data = {}) {
        this.emitTriggerEvent(data);
      }
    }
    
    // Create custom detector instance
    const customDetector = new CustomTriggerDetector({
      logger: mockLogger,
      id: 'custom-detector-1'
    });
    
    // Register with trigger manager
    const triggerId = await manager.triggerManager.registerTrigger(customDetector);
    
    // Update configuration to enable custom trigger type
    await manager.updateConfiguration({
      automaticRecording: {
        enabledTriggers: ['learning', 'voice', 'error', 'custom']
      }
    });
    
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    manager.on(ScreenRecordingEvent.RECORDING_STARTED, recordingStartedSpy);
    
    // Simulate trigger from custom detector
    customDetector.simulateTrigger({
      confidence: 1.0,
      context: {
        source: 'custom_test'
      },
      suggestedDuration: 60,
      metadata: {
        custom: true
      }
    });
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Verify recording has trigger metadata
    const recordingInfo = recordingStartedSpy.args[0][0];
    assert.strictEqual(recordingInfo.isAutomaticRecording, true, 'Recording should be marked as automatic');
    assert.strictEqual(recordingInfo.triggerMetadata.triggerType, 'custom', 'Trigger type should match');
    
    // Stop the recording
    await manager.stopRecording();
  });
  
  // Test error handling for automatic recording
  it('should handle errors gracefully during automatic recording', async function() {
    // Make capture service fail
    mockCaptureService.startCapture.rejects(new Error('Capture failed'));
    
    // Create spy for error event
    const errorSpy = sinon.spy();
    manager.on(ScreenRecordingEvent.ERROR_OCCURRED, errorSpy);
    
    // Create trigger event
    const triggerEvent = {
      triggerId: 'test-trigger-6',
      triggerType: 'learning',
      confidence: 0.9,
      context: {
        sessionId: 'test-session-6',
        taskName: 'Test Task'
      },
      timestamp: Date.now(),
      suggestedDuration: 120,
      metadata: {
        learningMode: true,
        sessionId: 'test-session-6'
      }
    };
    
    // Try to trigger recording
    await manager.handleTriggerEvent(triggerEvent);
    
    // Verify error was handled
    assert.strictEqual(errorSpy.calledOnce, true, 'Error event should be emitted');
    assert.strictEqual(manager.state, ScreenRecordingState.READY, 'Manager should return to ready state');
    assert.strictEqual(manager.activeRecording, null, 'Active recording should be cleared');
  });
  
  // Test concurrent trigger handling
  it('should handle concurrent triggers correctly', async function() {
    // Create trigger events
    const triggerEvent1 = {
      triggerId: 'test-trigger-7a',
      triggerType: 'learning',
      confidence: 0.9,
      context: {
        sessionId: 'test-session-7a',
        taskName: 'Test Task A'
      },
      timestamp: Date.now(),
      suggestedDuration: 120,
      metadata: {
        learningMode: true,
        sessionId: 'test-session-7a'
      }
    };
    
    const triggerEvent2 = {
      triggerId: 'test-trigger-7b',
      triggerType: 'voice',
      confidence: 0.9,
      context: {
        command: 'record screen',
        sessionId: 'test-session-7b'
      },
      timestamp: Date.now() + 1,
      suggestedDuration: 120,
      metadata: {
        voiceCommand: true,
        sessionId: 'test-session-7b'
      }
    };
    
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    manager.on(ScreenRecordingEvent.RECORDING_STARTED, recordingStartedSpy);
    
    // Trigger both events concurrently
    await Promise.all([
      manager.handleTriggerEvent(triggerEvent1),
      manager.handleTriggerEvent(triggerEvent2)
    ]);
    
    // Verify only one recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Only one recording should be started');
    
    // Verify the first trigger was used
    const recordingInfo = recordingStartedSpy.args[0][0];
    assert.strictEqual(recordingInfo.triggerMetadata.triggerId, triggerEvent1.triggerId, 'First trigger should be used');
    
    // Stop the recording
    await manager.stopRecording();
  });
});
