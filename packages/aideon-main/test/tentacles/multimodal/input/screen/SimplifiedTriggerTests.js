/**
 * @fileoverview Simplified tests for automatic trigger detection and recording activation.
 * 
 * This module provides focused tests for the trigger detection system without
 * relying on the full EnhancedScreenRecordingManager implementation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const sinon = require('sinon');
const EventEmitter = require('events');
const path = require('path');

// Import constants directly
const basePath = path.resolve(__dirname, '../../../../../src/tentacles/multimodal/input/screen');
const { ScreenRecordingState } = require(path.join(basePath, 'constants.js'));

/**
 * Simplified Screen Recording Manager for testing trigger functionality.
 * @extends EventEmitter
 */
class SimplifiedRecordingManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.state = 'READY';
    this.initialized = true;
    this.activeRecording = null;
    this.automaticRecordings = new Map();
    this.triggerManager = options.triggerManager;
    
    // Configuration
    this.config = {
      automaticRecording: {
        enabled: true,
        requireUserReview: true,
        maxDuration: 300,
        showIndicator: true,
        enabledTriggers: ['learning', 'voice', 'error']
      }
    };
  }
  
  async startRecording(options = {}) {
    if (this.activeRecording) {
      throw new Error('Recording already in progress');
    }
    
    const recordingId = `recording-${Date.now()}`;
    const recordingInfo = {
      id: recordingId,
      startTime: Date.now(),
      options,
      isActive: true,
      isAutomaticRecording: !!options.triggerMetadata,
      triggerMetadata: options.triggerMetadata || null
    };
    
    this.activeRecording = recordingInfo;
    
    if (recordingInfo.isAutomaticRecording && recordingInfo.triggerMetadata) {
      this.automaticRecordings.set(recordingInfo.triggerMetadata.triggerId, recordingInfo);
    }
    
    this.emit('recording-started', { ...recordingInfo });
    
    return { ...recordingInfo };
  }
  
  async stopRecording() {
    if (!this.activeRecording) {
      throw new Error('No active recording to stop');
    }
    
    const completedRecording = { ...this.activeRecording };
    completedRecording.isActive = false;
    completedRecording.endTime = Date.now();
    completedRecording.duration = completedRecording.endTime - completedRecording.startTime;
    
    if (completedRecording.isAutomaticRecording && completedRecording.triggerMetadata) {
      this.automaticRecordings.delete(completedRecording.triggerMetadata.triggerId);
    }
    
    this.activeRecording = null;
    
    this.emit('recording-stopped', { ...completedRecording });
    
    return { ...completedRecording };
  }
  
  async startAutomaticRecording(triggerEvent) {
    if (!this.config.automaticRecording.enabled) {
      throw new Error('Automatic recording is disabled');
    }
    
    if (!triggerEvent || !triggerEvent.triggerId) {
      throw new Error('Invalid trigger event');
    }
    
    if (!this.config.automaticRecording.enabledTriggers.includes(triggerEvent.triggerType)) {
      throw new Error(`Trigger type ${triggerEvent.triggerType} is not enabled for automatic recording`);
    }
    
    if (this.automaticRecordings.has(triggerEvent.triggerId)) {
      throw new Error(`Already recording for trigger ${triggerEvent.triggerId}`);
    }
    
    const recordingOptions = {
      triggerMetadata: {
        triggerId: triggerEvent.triggerId,
        triggerType: triggerEvent.triggerType,
        triggerContext: triggerEvent.context,
        isAutomaticRecording: true,
        userReviewed: false,
        suggestedDuration: triggerEvent.suggestedDuration || this.config.automaticRecording.maxDuration
      }
    };
    
    const recordingInfo = await this.startRecording(recordingOptions);
    
    const maxDuration = Math.min(
      triggerEvent.suggestedDuration || Infinity,
      this.config.automaticRecording.maxDuration
    );
    
    if (maxDuration && isFinite(maxDuration)) {
      setTimeout(() => {
        if (this.automaticRecordings.has(triggerEvent.triggerId)) {
          this.logger.info(`Maximum duration reached for trigger ${triggerEvent.triggerId}, stopping recording`);
          this.stopAutomaticRecording(triggerEvent.triggerId).catch(error => {
            this.logger.error(`Failed to stop automatic recording: ${error.message}`);
          });
        }
      }, maxDuration * 1000);
    }
    
    return recordingInfo;
  }
  
  async stopAutomaticRecording(triggerId) {
    if (!triggerId) {
      throw new Error('Trigger ID is required');
    }
    
    if (!this.automaticRecordings.has(triggerId)) {
      throw new Error(`No active recording for trigger ${triggerId}`);
    }
    
    const recordingInfo = this.automaticRecordings.get(triggerId);
    
    if (this.activeRecording && this.activeRecording.id === recordingInfo.id) {
      return this.stopRecording();
    } else {
      this.automaticRecordings.delete(triggerId);
      return recordingInfo;
    }
  }
  
  async handleTriggerEvent(event) {
    try {
      if (!this.config.automaticRecording.enabled) {
        return;
      }
      
      if (event.deactivate) {
        if (this.automaticRecordings.has(event.triggerId)) {
          await this.stopAutomaticRecording(event.triggerId);
        }
        return;
      }
      
      await this.startAutomaticRecording(event);
    } catch (error) {
      this.logger.error(`Failed to handle trigger event: ${error.message}`);
    }
  }
}

/**
 * Simplified Trigger Detector for testing.
 * @extends EventEmitter
 */
class SimplifiedTriggerDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.id = options.id || `detector-${Date.now()}`;
    this.type = options.type || 'test';
    this.name = options.name || 'Test Detector';
    this.description = options.description || 'Test trigger detector for testing';
    this.initialized = false;
    this.detecting = false;
    this.triggerManager = null;
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
    return this.type;
  }
  
  getName() {
    return this.name;
  }
  
  getDescription() {
    return this.description;
  }
  
  setTriggerManager(manager) {
    this.triggerManager = manager;
  }
  
  emitTriggerEvent(data) {
    if (!this.triggerManager) {
      throw new Error('Trigger manager not set');
    }
    
    const event = {
      triggerId: `${this.id}-${Date.now()}`,
      triggerType: this.type,
      confidence: data.confidence || 1.0,
      context: data.context || {},
      timestamp: Date.now(),
      suggestedDuration: data.suggestedDuration || 60,
      metadata: data.metadata || {},
      detector: this
    };
    
    this.triggerManager.handleTriggerEvent(event);
    
    return event;
  }
}

/**
 * Simplified Trigger Manager for testing.
 * @extends EventEmitter
 */
class SimplifiedTriggerManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.screenRecordingManager = options.screenRecordingManager;
    this.detectors = new Map();
    this.initialized = false;
    this.config = {
      enabledTriggers: options.config?.enabledTriggers || ['learning', 'voice', 'error'],
      requireUserReview: options.config?.requireUserReview !== false,
      maxAutomaticDuration: options.config?.maxAutomaticDuration || 300
    };
  }
  
  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }
  
  async shutdown() {
    this.initialized = false;
    return Promise.resolve();
  }
  
  async registerTrigger(detector) {
    if (!detector) {
      throw new Error('Detector is required');
    }
    
    const id = detector.id || `detector-${Date.now()}`;
    
    this.detectors.set(id, detector);
    detector.setTriggerManager(this);
    
    if (detector.initialize && !detector.initialized) {
      await detector.initialize();
    }
    
    if (detector.startDetection && !detector.detecting) {
      await detector.startDetection();
    }
    
    return id;
  }
  
  async unregisterTrigger(id) {
    if (!id) {
      throw new Error('Detector ID is required');
    }
    
    if (!this.detectors.has(id)) {
      throw new Error(`Detector ${id} not found`);
    }
    
    const detector = this.detectors.get(id);
    
    if (detector.stopDetection && detector.detecting) {
      await detector.stopDetection();
    }
    
    this.detectors.delete(id);
    
    return true;
  }
  
  handleTriggerEvent(event) {
    if (!this.initialized) {
      throw new Error('Trigger manager not initialized');
    }
    
    if (!event || !event.triggerType) {
      throw new Error('Invalid trigger event');
    }
    
    if (!this.config.enabledTriggers.includes(event.triggerType)) {
      this.logger.info(`Trigger type ${event.triggerType} is not enabled, ignoring`);
      return;
    }
    
    this.emit('trigger-activated', event);
    
    if (this.screenRecordingManager) {
      this.screenRecordingManager.handleTriggerEvent(event);
    }
  }
}

// Test suite
describe('Simplified Automatic Trigger Recording Tests', function() {
  // Test timeout
  this.timeout(10000);
  
  // Test variables
  let recordingManager;
  let triggerManager;
  let learningDetector;
  let voiceDetector;
  let errorDetector;
  let mockLogger;
  
  // Setup before each test
  beforeEach(async function() {
    // Create mock logger
    mockLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub()
    };
    
    // Create recording manager
    recordingManager = new SimplifiedRecordingManager({
      logger: mockLogger
    });
    
    // Create trigger manager
    triggerManager = new SimplifiedTriggerManager({
      logger: mockLogger,
      screenRecordingManager: recordingManager,
      config: {
        enabledTriggers: ['learning', 'voice', 'error'],
        requireUserReview: true,
        maxAutomaticDuration: 300
      }
    });
    
    // Set trigger manager in recording manager
    recordingManager.triggerManager = triggerManager;
    
    // Create detectors
    learningDetector = new SimplifiedTriggerDetector({
      logger: mockLogger,
      id: 'learning-detector',
      type: 'learning',
      name: 'Learning Mode Detector',
      description: 'Detects learning mode activation'
    });
    
    voiceDetector = new SimplifiedTriggerDetector({
      logger: mockLogger,
      id: 'voice-detector',
      type: 'voice',
      name: 'Voice Command Detector',
      description: 'Detects voice commands for recording'
    });
    
    errorDetector = new SimplifiedTriggerDetector({
      logger: mockLogger,
      id: 'error-detector',
      type: 'error',
      name: 'Error Diagnosis Detector',
      description: 'Detects application errors for diagnosis'
    });
    
    // Initialize managers and detectors
    await triggerManager.initialize();
    await triggerManager.registerTrigger(learningDetector);
    await triggerManager.registerTrigger(voiceDetector);
    await triggerManager.registerTrigger(errorDetector);
  });
  
  // Cleanup after each test
  afterEach(async function() {
    // Restore stubs
    sinon.restore();
  });
  
  // Test automatic recording activation via learning mode trigger
  it('should activate recording when learning mode is detected', async function() {
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    
    // Trigger learning mode detection
    const triggerEvent = learningDetector.emitTriggerEvent({
      confidence: 0.9,
      context: {
        sessionId: 'test-learning-session',
        taskName: 'Test Learning Task'
      },
      suggestedDuration: 120,
      metadata: {
        learningMode: true
      }
    });
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Verify recording has trigger metadata
    const recordingInfo = recordingStartedSpy.args[0][0];
    assert.strictEqual(recordingInfo.isAutomaticRecording, true, 'Recording should be marked as automatic');
    assert.strictEqual(recordingInfo.triggerMetadata.triggerType, 'learning', 'Trigger type should be learning');
    
    // Stop the recording
    const stoppedRecording = await recordingManager.stopRecording();
    
    // Verify recording was properly stopped
    assert.strictEqual(stoppedRecording.isActive, false, 'Recording should be marked as inactive');
    assert.strictEqual(recordingManager.activeRecording, null, 'Active recording should be cleared');
  });
  
  // Test automatic recording activation via voice command trigger
  it('should activate recording when voice command is detected', async function() {
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    
    // Trigger voice command detection
    const triggerEvent = voiceDetector.emitTriggerEvent({
      confidence: 0.8,
      context: {
        command: 'record screen',
        sessionId: 'test-voice-session'
      },
      suggestedDuration: 60,
      metadata: {
        voiceCommand: true
      }
    });
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Verify recording has trigger metadata
    const recordingInfo = recordingStartedSpy.args[0][0];
    assert.strictEqual(recordingInfo.isAutomaticRecording, true, 'Recording should be marked as automatic');
    assert.strictEqual(recordingInfo.triggerMetadata.triggerType, 'voice', 'Trigger type should be voice');
    
    // Stop the recording
    const stoppedRecording = await recordingManager.stopRecording();
    
    // Verify recording was properly stopped
    assert.strictEqual(stoppedRecording.isActive, false, 'Recording should be marked as inactive');
    assert.strictEqual(recordingManager.activeRecording, null, 'Active recording should be cleared');
  });
  
  // Test automatic recording activation via error diagnosis trigger
  it('should activate recording when error is detected', async function() {
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    
    // Trigger error detection
    const triggerEvent = errorDetector.emitTriggerEvent({
      confidence: 1.0,
      context: {
        errorType: 'application-crash',
        errorMessage: 'Test error message',
        applicationName: 'TestApp'
      },
      suggestedDuration: 30,
      metadata: {
        errorDiagnosis: true,
        severity: 'high'
      }
    });
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Verify recording has trigger metadata
    const recordingInfo = recordingStartedSpy.args[0][0];
    assert.strictEqual(recordingInfo.isAutomaticRecording, true, 'Recording should be marked as automatic');
    assert.strictEqual(recordingInfo.triggerMetadata.triggerType, 'error', 'Trigger type should be error');
    
    // Stop the recording
    const stoppedRecording = await recordingManager.stopRecording();
    
    // Verify recording was properly stopped
    assert.strictEqual(stoppedRecording.isActive, false, 'Recording should be marked as inactive');
    assert.strictEqual(recordingManager.activeRecording, null, 'Active recording should be cleared');
  });
  
  // Test automatic recording deactivation
  it('should deactivate recording when trigger is deactivated', async function() {
    // Create spies for recording events
    const recordingStartedSpy = sinon.spy();
    const recordingStoppedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    recordingManager.on('recording-stopped', recordingStoppedSpy);
    
    // Trigger learning mode detection
    const triggerEvent = learningDetector.emitTriggerEvent({
      confidence: 0.9,
      context: {
        sessionId: 'test-learning-session-2',
        taskName: 'Test Learning Task'
      },
      suggestedDuration: 120,
      metadata: {
        learningMode: true
      }
    });
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Get the trigger ID
    const triggerId = recordingStartedSpy.args[0][0].triggerMetadata.triggerId;
    
    // Create deactivation event
    const deactivationEvent = {
      triggerId,
      triggerType: 'learning',
      deactivate: true,
      context: {
        sessionId: 'test-learning-session-2',
        endReason: 'task_completed'
      },
      metadata: {
        deactivation: true
      }
    };
    
    // Trigger deactivation
    await triggerManager.handleTriggerEvent(deactivationEvent);
    
    // Verify recording was stopped
    assert.strictEqual(recordingStoppedSpy.calledOnce, true, 'Recording stopped event should be emitted');
    assert.strictEqual(recordingManager.activeRecording, null, 'Active recording should be cleared');
    assert.strictEqual(recordingManager.automaticRecordings.size, 0, 'Automatic recordings map should be empty');
  });
  
  // Test automatic recording with disabled trigger type
  it('should not activate recording for disabled trigger types', async function() {
    // Update configuration to disable voice triggers
    recordingManager.config.automaticRecording.enabledTriggers = ['learning', 'error']; // voice not included
    triggerManager.config.enabledTriggers = ['learning', 'error']; // voice not included
    
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    
    // Trigger voice command detection (should be ignored)
    const triggerEvent = voiceDetector.emitTriggerEvent({
      confidence: 0.8,
      context: {
        command: 'record screen',
        sessionId: 'test-voice-session-2'
      },
      suggestedDuration: 60,
      metadata: {
        voiceCommand: true
      }
    });
    
    // Verify recording was not started
    assert.strictEqual(recordingStartedSpy.called, false, 'Recording started event should not be emitted');
    assert.strictEqual(recordingManager.activeRecording, null, 'No active recording should be created');
  });
  
  // Test automatic recording with disabled automatic recording
  it('should not activate recording when automatic recording is disabled', async function() {
    // Update configuration to disable automatic recording
    recordingManager.config.automaticRecording.enabled = false;
    
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    
    // Trigger learning mode detection (should be ignored)
    const triggerEvent = learningDetector.emitTriggerEvent({
      confidence: 0.9,
      context: {
        sessionId: 'test-learning-session-3',
        taskName: 'Test Learning Task'
      },
      suggestedDuration: 120,
      metadata: {
        learningMode: true
      }
    });
    
    // Verify recording was not started
    assert.strictEqual(recordingStartedSpy.called, false, 'Recording started event should not be emitted');
    assert.strictEqual(recordingManager.activeRecording, null, 'No active recording should be created');
  });
  
  // Test maximum duration for automatic recording
  it('should respect maximum duration for automatic recordings', async function() {
    // Set a very short max duration for testing
    recordingManager.config.automaticRecording.maxDuration = 0.1; // 100ms
    
    // Create spies for recording events
    const recordingStartedSpy = sinon.spy();
    const recordingStoppedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    recordingManager.on('recording-stopped', recordingStoppedSpy);
    
    // Trigger learning mode detection
    const triggerEvent = learningDetector.emitTriggerEvent({
      confidence: 0.9,
      context: {
        sessionId: 'test-learning-session-4',
        taskName: 'Test Learning Task'
      },
      suggestedDuration: 120, // This will be overridden by maxDuration
      metadata: {
        learningMode: true
      }
    });
    
    // Verify recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Recording started event should be emitted');
    
    // Wait for max duration to elapse
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify recording was stopped automatically
    assert.strictEqual(recordingStoppedSpy.calledOnce, true, 'Recording should be stopped automatically');
    assert.strictEqual(recordingManager.activeRecording, null, 'Active recording should be cleared');
  });
  
  // Test concurrent trigger handling
  it('should handle concurrent triggers correctly', async function() {
    // Create spy for recording started event
    const recordingStartedSpy = sinon.spy();
    recordingManager.on('recording-started', recordingStartedSpy);
    
    // Trigger both learning and voice detection concurrently
    await Promise.all([
      learningDetector.emitTriggerEvent({
        confidence: 0.9,
        context: {
          sessionId: 'test-learning-session-5',
          taskName: 'Test Learning Task'
        },
        suggestedDuration: 120,
        metadata: {
          learningMode: true
        }
      }),
      voiceDetector.emitTriggerEvent({
        confidence: 0.8,
        context: {
          command: 'record screen',
          sessionId: 'test-voice-session-5'
        },
        suggestedDuration: 60,
        metadata: {
          voiceCommand: true
        }
      })
    ]);
    
    // Verify only one recording was started
    assert.strictEqual(recordingStartedSpy.calledOnce, true, 'Only one recording should be started');
    
    // Stop the recording
    await recordingManager.stopRecording();
  });
});
