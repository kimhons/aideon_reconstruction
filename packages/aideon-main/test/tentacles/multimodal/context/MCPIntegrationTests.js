/**
 * @fileoverview Tests for MCP integration with tentacles.
 * 
 * This module contains tests for the MCP integration with the screen, voice, and gesture
 * tentacles, validating that context is properly shared across the system.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');

// Import module resolver
const resolver = require('./utils/TestModuleResolver');

// Import MCP modules
const { MCPContextManager } = resolver.requireSource('tentacles/multimodal/context/MCPContextManager');
const { WindowsNativeMCPAdapter } = resolver.requireSource('tentacles/multimodal/context/adapters/WindowsNativeMCPAdapter');
const { MacOSMCPAdapter } = resolver.requireSource('tentacles/multimodal/context/adapters/MacOSMCPAdapter');
const { LinuxMCPAdapter } = resolver.requireSource('tentacles/multimodal/context/adapters/LinuxMCPAdapter');

// Import tentacle context providers
const { MCPScreenContextProvider } = resolver.requireSource('tentacles/multimodal/input/screen/MCPScreenContextProvider');
const { MCPVoiceContextProvider } = resolver.requireSource('tentacles/multimodal/input/voice/MCPVoiceContextProvider');
const { MCPGestureContextProvider } = resolver.requireSource('tentacles/multimodal/input/gesture/MCPGestureContextProvider');

// Mock dependencies
class MockScreenRecordingManager extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
  }
  
  startRecording(options) {
    this.isRecording = true;
    this.emit('recordingStarted', {
      id: 'test-recording-1',
      startTime: Date.now(),
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      source: 'screen',
      reason: 'test'
    });
    return { id: 'test-recording-1' };
  }
  
  stopRecording(id) {
    this.isRecording = false;
    this.emit('recordingStopped', {
      id,
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      duration: 5000,
      frames: 150,
      filePath: '/tmp/recording.mp4',
      fileSize: 1024 * 1024,
      reason: 'test'
    });
    return true;
  }
}

class MockVoiceInputManager extends EventEmitter {
  constructor() {
    super();
    this.isCapturing = false;
  }
  
  startCapture(options) {
    this.isCapturing = true;
    this.emit('captureStarted', {
      id: 'test-capture-1',
      startTime: Date.now(),
      source: 'microphone',
      sampleRate: 16000,
      channels: 1,
      reason: 'test'
    });
    return { id: 'test-capture-1' };
  }
  
  stopCapture(id) {
    this.isCapturing = false;
    this.emit('captureStopped', {
      id,
      startTime: Date.now() - 3000,
      endTime: Date.now(),
      duration: 3000,
      reason: 'test'
    });
    return true;
  }
}

class MockGestureRecognitionManager extends EventEmitter {
  constructor() {
    super();
    this.isSessionActive = false;
  }
  
  startSession(options) {
    this.isSessionActive = true;
    this.emit('sessionStarted', {
      id: 'test-session-1',
      startTime: Date.now(),
      source: 'camera',
      mode: 'default',
      reason: 'test'
    });
    return { id: 'test-session-1' };
  }
  
  stopSession(id) {
    this.isSessionActive = false;
    this.emit('sessionStopped', {
      id,
      startTime: Date.now() - 10000,
      endTime: Date.now(),
      duration: 10000,
      gestureCount: 5,
      reason: 'test'
    });
    return true;
  }
  
  simulateHandGesture(gestureType, confidence = 0.9) {
    this.emit('handGestureDetected', {
      sessionId: 'test-session-1',
      timestamp: Date.now(),
      gestureType,
      handedness: 'right',
      position: { x: 0.5, y: 0.5, z: 0 },
      confidence
    });
  }
}

// Test suite
describe('MCP Integration Tests', function() {
  let contextManager;
  let screenContextProvider;
  let voiceContextProvider;
  let gestureContextProvider;
  let mockScreenManager;
  let mockVoiceManager;
  let mockGestureManager;
  let sandbox;
  
  beforeEach(function() {
    sandbox = sinon.createSandbox();
    
    // Create mock managers
    mockScreenManager = new MockScreenRecordingManager();
    mockVoiceManager = new MockVoiceInputManager();
    mockGestureManager = new MockGestureRecognitionManager();
    
    // Create context manager
    contextManager = new MCPContextManager({
      logger: console,
      config: {
        storageLocation: '/tmp/aideon-mcp-test',
        enablePersistence: false,
        enablePruning: false // Disable pruning for tests
      }
    });
    
    // Create context providers
    screenContextProvider = new MCPScreenContextProvider({
      logger: console,
      contextManager,
      screenRecordingManager: mockScreenManager,
      config: {
        minConfidenceThreshold: 0.5
      }
    });
    
    voiceContextProvider = new MCPVoiceContextProvider({
      logger: console,
      contextManager,
      voiceInputManager: mockVoiceManager,
      config: {
        minConfidenceThreshold: 0.5
      }
    });
    
    gestureContextProvider = new MCPGestureContextProvider({
      logger: console,
      contextManager,
      gestureRecognitionManager: mockGestureManager,
      config: {
        minConfidenceThreshold: 0.5
      }
    });
  });
  
  afterEach(function() {
    sandbox.restore();
  });
  
  describe('MCPContextManager', function() {
    it('should initialize successfully', async function() {
      const result = await contextManager.initialize();
      assert.strictEqual(result, true);
      assert.strictEqual(contextManager.isInitialized, true);
    });
    
    it('should add and retrieve contexts', async function() {
      await contextManager.initialize();
      
      const context = {
        source: 'test',
        type: 'test.context',
        data: { value: 'test' },
        priority: 5,
        confidence: 0.9,
        tags: ['test']
      };
      
      const id = await contextManager.addContext(context);
      assert.ok(id, 'Context ID should be returned');
      
      const retrievedContext = await contextManager.getContext(id);
      assert.strictEqual(retrievedContext.type, context.type);
      assert.deepStrictEqual(retrievedContext.data, context.data);
      assert.strictEqual(retrievedContext.priority, context.priority);
      assert.strictEqual(retrievedContext.confidence, context.confidence);
      assert.deepStrictEqual(retrievedContext.tags, context.tags);
    });
    
    it('should query contexts by type', async function() {
      await contextManager.initialize();
      
      await contextManager.addContext({
        source: 'test',
        type: 'test.type1',
        data: { value: 'test1' },
        priority: 5,
        confidence: 0.9,
        tags: ['test']
      });
      
      await contextManager.addContext({
        source: 'test',
        type: 'test.type2',
        data: { value: 'test2' },
        priority: 6,
        confidence: 0.8,
        tags: ['test']
      });
      
      const contexts = await contextManager.queryContexts({ type: 'test.type1' });
      assert.strictEqual(contexts.length, 1);
      assert.strictEqual(contexts[0].type, 'test.type1');
      assert.deepStrictEqual(contexts[0].data, { value: 'test1' });
    });
    
    it('should remove expired contexts', async function() {
      await contextManager.initialize();
      
      const id = await contextManager.addContext({
        source: 'test',
        type: 'test.expiring',
        data: { value: 'test' },
        priority: 5,
        confidence: 0.9,
        tags: ['test'],
        expiryTimestamp: Date.now() - 1000 // Already expired
      });
      
      await contextManager.pruneExpiredContexts();
      
      const context = await contextManager.getContext(id);
      assert.strictEqual(context, null, 'Expired context should be removed');
    });
  });
  
  describe('MCPScreenContextProvider', function() {
    it('should initialize successfully', async function() {
      await contextManager.initialize();
      const result = await screenContextProvider.initialize();
      assert.strictEqual(result, true);
      assert.strictEqual(screenContextProvider.isInitialized, true);
    });
    
    it('should handle recording started event', async function() {
      await contextManager.initialize();
      await screenContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockScreenManager.startRecording();
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'screen.recording.started');
      assert.strictEqual(context.data.recordingId, 'test-recording-1');
    });
    
    it('should handle recording stopped event', async function() {
      await contextManager.initialize();
      await screenContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockScreenManager.stopRecording('test-recording-1');
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'screen.recording.stopped');
      assert.strictEqual(context.data.recordingId, 'test-recording-1');
    });
    
    it('should handle analysis completed event', async function() {
      await contextManager.initialize();
      await screenContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockScreenManager.emit('analysisCompleted', {
        recordingId: 'test-recording-1',
        timestamp: Date.now(),
        duration: 5000,
        summary: 'Test analysis',
        confidence: 0.85
      });
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'screen.analysis.completed');
      assert.strictEqual(context.data.recordingId, 'test-recording-1');
      assert.strictEqual(context.data.summary, 'Test analysis');
    });
  });
  
  describe('MCPVoiceContextProvider', function() {
    it('should initialize successfully', async function() {
      await contextManager.initialize();
      const result = await voiceContextProvider.initialize();
      assert.strictEqual(result, true);
      assert.strictEqual(voiceContextProvider.isInitialized, true);
    });
    
    it('should handle capture started event', async function() {
      await contextManager.initialize();
      await voiceContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockVoiceManager.startCapture();
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'voice.capture.started');
      assert.strictEqual(context.data.captureId, 'test-capture-1');
    });
    
    it('should handle capture stopped event', async function() {
      await contextManager.initialize();
      await voiceContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockVoiceManager.stopCapture('test-capture-1');
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'voice.capture.stopped');
      assert.strictEqual(context.data.captureId, 'test-capture-1');
    });
    
    it('should handle speech recognition result event', async function() {
      await contextManager.initialize();
      await voiceContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockVoiceManager.emit('recognitionResult', {
        captureId: 'test-capture-1',
        recognitionId: 'test-recognition-1',
        timestamp: Date.now(),
        isFinal: true,
        transcript: 'Hello Aideon',
        confidence: 0.9,
        language: 'en-US'
      });
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'voice.recognition.result');
      assert.strictEqual(context.data.captureId, 'test-capture-1');
      assert.strictEqual(context.data.transcript, 'Hello Aideon');
    });
  });
  
  describe('MCPGestureContextProvider', function() {
    it('should initialize successfully', async function() {
      await contextManager.initialize();
      const result = await gestureContextProvider.initialize();
      assert.strictEqual(result, true);
      assert.strictEqual(gestureContextProvider.isInitialized, true);
    });
    
    it('should handle session started event', async function() {
      await contextManager.initialize();
      await gestureContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockGestureManager.startSession();
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'gesture.session.started');
      assert.strictEqual(context.data.sessionId, 'test-session-1');
    });
    
    it('should handle session stopped event', async function() {
      await contextManager.initialize();
      await gestureContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockGestureManager.stopSession('test-session-1');
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'gesture.session.stopped');
      assert.strictEqual(context.data.sessionId, 'test-session-1');
    });
    
    it('should handle hand gesture detected event', async function() {
      await contextManager.initialize();
      await gestureContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockGestureManager.simulateHandGesture('OPEN_PALM');
      
      assert.strictEqual(addContextSpy.calledOnce, true);
      const context = addContextSpy.firstCall.args[0];
      assert.strictEqual(context.type, 'gesture.hand.detected');
      assert.strictEqual(context.data.gestureType, 'OPEN_PALM');
    });
    
    it('should filter out low confidence gestures', async function() {
      await contextManager.initialize();
      await gestureContextProvider.initialize();
      
      const addContextSpy = sandbox.spy(contextManager, 'addContext');
      
      mockGestureManager.simulateHandGesture('POINTING', 0.4); // Below threshold
      
      assert.strictEqual(addContextSpy.called, false);
    });
  });
  
  describe('Cross-Tentacle Integration', function() {
    it('should share context between tentacles', async function() {
      await contextManager.initialize();
      await screenContextProvider.initialize();
      await voiceContextProvider.initialize();
      await gestureContextProvider.initialize();
      
      // Simulate voice command
      await contextManager.addContext({
        source: 'voice',
        type: 'voice.command.detected',
        data: {
          captureId: 'test-capture-1',
          recognitionId: 'test-recognition-1',
          command: 'START_RECORDING',
          action: 'start',
          target: 'recording'
        },
        priority: 8,
        confidence: 0.95,
        tags: ['voice', 'command']
      });
      
      // Start recording based on voice command
      mockScreenManager.startRecording();
      
      // Query contexts
      const contexts = await contextManager.queryContexts({
        tags: ['voice', 'command']
      });
      
      assert.ok(contexts.length > 0, "Should have voice command contexts");
      assert.strictEqual(contexts[0].type, 'voice.command.detected');
      assert.strictEqual(contexts[0].data.command, 'START_RECORDING');
      
      // Check if recording started context exists
      const recordingContexts = await contextManager.queryContexts({
        type: 'screen.recording.started'
      });
      
      assert.ok(recordingContexts.length > 0, "Should have recording started contexts");
      assert.strictEqual(recordingContexts[0].data.recordingId, 'test-recording-1');
    });
    
    it('should handle complex multi-modal interaction', async function() {
      await contextManager.initialize();
      await screenContextProvider.initialize();
      await voiceContextProvider.initialize();
      await gestureContextProvider.initialize();
      
      // Add voice command context
      await contextManager.addContext({
        source: 'voice',
        type: 'voice.command.detected',
        data: {
          captureId: 'test-capture-1',
          recognitionId: 'test-recognition-1',
          command: 'TAKE_SCREENSHOT',
          action: 'take',
          target: 'screenshot'
        },
        priority: 8,
        confidence: 0.95,
        tags: ['voice', 'command']
      });
      
      // Add gesture context
      await contextManager.addContext({
        source: 'gesture',
        type: 'gesture.hand.detected',
        data: {
          sessionId: 'test-session-1',
          gestureType: 'POINTING',
          position: { x: 0.5, y: 0.5, z: 0 }
        },
        priority: 7,
        confidence: 0.9,
        tags: ['gesture', 'hand']
      });
      
      // Add screen context
      await contextManager.addContext({
        source: 'screen',
        type: 'screen.element.detected',
        data: {
          recordingId: 'test-recording-1',
          elementType: 'button',
          position: { x: 0.5, y: 0.5 },
          text: 'OK'
        },
        priority: 6,
        confidence: 0.85,
        tags: ['screen', 'element']
      });
      
      // Query all contexts
      const contexts = await contextManager.queryContexts({
        minConfidence: 0.8,
        sortBy: 'priority',
        sortOrder: 'desc'
      });
      
      assert.ok(contexts.length >= 3, "Should have at least 3 contexts");
      assert.strictEqual(contexts[0].type, 'voice.command.detected');
      assert.strictEqual(contexts[1].type, 'gesture.hand.detected');
      assert.strictEqual(contexts[2].type, 'screen.element.detected');
    });
  });
  
  describe('Platform Adapter Tests', function() {
    it('should select appropriate adapter based on platform', async function() {
      await contextManager.initialize();
      
      const adapter = contextManager.getPlatformAdapter();
      assert.ok(adapter, "Platform adapter should be available");
      
      // Check adapter type based on platform
      const platform = require('os').platform();
      if (platform === 'win32') {
        assert.ok(adapter instanceof WindowsNativeMCPAdapter);
      } else if (platform === 'darwin') {
        assert.ok(adapter instanceof MacOSMCPAdapter);
      } else {
        assert.ok(adapter instanceof LinuxMCPAdapter);
      }
    });
    
    it('should handle adapter initialization failure gracefully', async function() {
      // Create context manager with mock platform detection
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      
      // Force a non-existent platform to trigger fallback
      Object.defineProperty(process, 'platform', {
        value: 'unknown-platform'
      });
      
      const testContextManager = new MCPContextManager({
        logger: console,
        config: {
          enablePersistence: false
        }
      });
      
      await testContextManager.initialize();
      
      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      } else {
        delete process.platform;
      }
      
      // Should fall back to generic adapter
      const adapter = testContextManager.getPlatformAdapter();
      assert.ok(adapter, "Fallback adapter should be available");
      assert.strictEqual(adapter.constructor.name, 'GenericMCPAdapter');
    });
  });
});
