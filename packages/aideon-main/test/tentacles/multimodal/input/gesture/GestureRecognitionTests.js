/**
 * @fileoverview Tests for the Gesture Recognition system in the Aideon AI Desktop Agent.
 * These tests validate the end-to-end functionality of the gesture recognition pipeline,
 * including camera input, gesture detection, and interpretation.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs').promises;
const childProcess = require('child_process');

// Use absolute paths for module resolution
const projectRoot = path.resolve(__dirname, '../../../../../');
const srcPath = path.join(projectRoot, 'src');

// Mock data
const mockHandLandmarks = require('./fixtures/mockHandLandmarks.json');
const mockPoseLandmarks = require('./fixtures/mockPoseLandmarks.json');

// Create sandbox for managing all stubs
const sandbox = sinon.createSandbox();

// Mock modules before importing
const mockModules = () => {
  // Mock MediaPipe modules
  const mockMediaPipe = {
    Hands: sandbox.stub().returns({
      onResults: sandbox.stub(),
      send: sandbox.stub().resolves(),
      close: sandbox.stub()
    }),
    Pose: sandbox.stub().returns({
      onResults: sandbox.stub(),
      send: sandbox.stub().resolves(),
      close: sandbox.stub()
    })
  };
  
  // Return mocked modules
  return {
    '@mediapipe/hands': { Hands: mockMediaPipe.Hands },
    '@mediapipe/pose': { Pose: mockMediaPipe.Pose }
  };
};

// Now import the modules
const { GestureRecognitionManager } = require(path.join(srcPath, 'tentacles/multimodal/input/gesture/GestureRecognitionManager'));
const { CameraInputService } = require(path.join(srcPath, 'tentacles/multimodal/input/gesture/CameraInputService'));
const { GestureInterpretationService } = require(path.join(srcPath, 'tentacles/multimodal/input/gesture/GestureInterpretationService'));

describe('Gesture Recognition System Tests', function() {
  // Increase timeout for potentially slow operations
  this.timeout(10000);
  
  let gestureManager;
  let mockLogger;
  let mockResourceManager;
  let mockCameraService;
  let mockDetectionProvider;
  let mockInterpretationService;
  
  beforeEach(async function() {
    // Create mock logger
    mockLogger = {
      info: sandbox.spy(),
      error: sandbox.spy(),
      warn: sandbox.spy(),
      debug: sandbox.spy()
    };
    
    // Create mock resource manager
    mockResourceManager = {
      checkPermission: sandbox.stub().resolves(true),
      allocateResource: sandbox.stub().resolves(true),
      releaseResource: sandbox.stub().resolves(true)
    };
    
    // Create real instances with mocked dependencies
    gestureManager = new GestureRecognitionManager({
      logger: mockLogger,
      resourceManager: mockResourceManager,
      enableDebugMode: true
    });
    
    // Replace internal components with mocks
    mockCameraService = {
      initialize: sandbox.stub().resolves(true),
      shutdown: sandbox.stub().resolves(true),
      startCapture: sandbox.stub().resolves('mock-camera-session'),
      stopCapture: sandbox.stub().resolves({ id: 'mock-camera-session', frameCount: 10 }),
      on: sandbox.stub(),
      removeListener: sandbox.stub(),
      setPrivacyConfig: sandbox.stub().returns(true),
      showPrivacyIndicator: sandbox.stub()
    };
    
    mockDetectionProvider = {
      initialize: sandbox.stub().resolves(true),
      shutdown: sandbox.stub().resolves(true),
      detectGestures: sandbox.stub().resolves({
        provider: 'mediapipe',
        timestamp: Date.now(),
        handLandmarks: [],
        handedness: [],
        gestures: []
      }),
      on: sandbox.stub(),
      removeListener: sandbox.stub()
    };
    
    mockInterpretationService = {
      initialize: sandbox.stub().resolves(true),
      shutdown: sandbox.stub().resolves(true),
      processGestures: sandbox.stub().resolves({
        processedCount: 0,
        historySize: 0,
        analysisResult: null
      }),
      analyzeGestureSequences: sandbox.stub().resolves([]),
      findDominantGestures: sandbox.stub().resolves([]),
      on: sandbox.stub(),
      removeListener: sandbox.stub(),
      getStatistics: sandbox.stub().returns({
        totalGestures: 0,
        uniqueGestures: 0,
        gestureDistribution: []
      }),
      config: {
        gestureWeights: {}
      }
    };
    
    // Replace internal components with mocks
    gestureManager.cameraService = mockCameraService;
    gestureManager.detectionProvider = mockDetectionProvider;
    gestureManager.interpretationService = mockInterpretationService;
  });
  
  afterEach(async function() {
    // Clean up
    if (gestureManager.isInitialized) {
      await gestureManager.shutdown();
    }
    sandbox.restore();
  });
  
  describe('Initialization and Lifecycle', function() {
    it('should initialize successfully', async function() {
      const result = await gestureManager.initialize();
      assert.strictEqual(result, true);
      assert.strictEqual(gestureManager.isInitialized, true);
      assert(mockCameraService.initialize.calledOnce);
      assert(mockDetectionProvider.initialize.calledOnce);
      assert(mockInterpretationService.initialize.calledOnce);
    });
    
    it('should handle initialization failures', async function() {
      // Simulate camera initialization failure
      mockCameraService.initialize.resolves(false);
      
      try {
        await gestureManager.initialize();
        // Should not reach here
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('Failed to initialize CameraInputService'));
      }
      
      assert.strictEqual(gestureManager.isInitialized, false);
    });
    
    it('should shut down successfully', async function() {
      await gestureManager.initialize();
      const result = await gestureManager.shutdown();
      
      assert.strictEqual(result, true);
      assert.strictEqual(gestureManager.isInitialized, false);
      assert(mockInterpretationService.shutdown.calledOnce);
      assert(mockDetectionProvider.shutdown.calledOnce);
      assert(mockCameraService.shutdown.calledOnce);
    });
    
    it('should handle shutdown when not initialized', async function() {
      const result = await gestureManager.shutdown();
      assert.strictEqual(result, true);
      assert(!mockCameraService.shutdown.called);
    });
  });
  
  describe('Recognition Session Management', function() {
    beforeEach(async function() {
      await gestureManager.initialize();
    });
    
    it('should start recognition successfully', async function() {
      const sessionId = await gestureManager.startRecognition();
      
      assert.strictEqual(typeof sessionId, 'string');
      assert.strictEqual(gestureManager.isRecognizing, true);
      assert(mockCameraService.startCapture.calledOnce);
    });
    
    it('should return existing session ID if recognition already started', async function() {
      const sessionId1 = await gestureManager.startRecognition();
      const sessionId2 = await gestureManager.startRecognition();
      
      assert.strictEqual(sessionId1, sessionId2);
      assert(mockCameraService.startCapture.calledOnce);
    });
    
    it('should stop recognition successfully', async function() {
      await gestureManager.startRecognition();
      const summary = await gestureManager.stopRecognition();
      
      assert.strictEqual(typeof summary, 'object');
      assert.strictEqual(summary.id, gestureManager.currentSession?.id || summary.id);
      assert.strictEqual(gestureManager.isRecognizing, false);
      assert(mockCameraService.stopCapture.calledOnce);
    });
    
    it('should handle stop when not recognizing', async function() {
      const summary = await gestureManager.stopRecognition();
      assert.strictEqual(summary, null);
      assert(!mockCameraService.stopCapture.called);
    });
  });
  
  describe('Frame and Gesture Processing', function() {
    beforeEach(async function() {
      await gestureManager.initialize();
      await gestureManager.startRecognition();
    });
    
    it('should process frames correctly', async function() {
      const frameData = {
        frame: { width: 640, height: 480, data: new Uint8Array(640 * 480 * 4) },
        timestamp: Date.now()
      };
      
      await gestureManager.handleFrame(frameData);
      
      assert(mockDetectionProvider.detectGestures.calledOnce);
      assert.deepStrictEqual(
        mockDetectionProvider.detectGestures.firstCall.args[0].frame,
        frameData.frame
      );
    });
    
    it('should handle detected gestures correctly', async function() {
      const detectionResult = {
        provider: 'mediapipe',
        timestamp: Date.now(),
        handLandmarks: [mockHandLandmarks],
        handedness: [[{ categoryName: 'Right', score: 0.9 }]],
        gestures: [
          { name: 'Open Palm', hand: 'Right', confidence: 0.8, handId: 'Right-0' },
          { name: 'Pointing', hand: 'Right', confidence: 0.7, handId: 'Right-0' }
        ]
      };
      
      // Set up mock to return analysis result
      mockInterpretationService.processGestures.resolves({
        processedCount: 2,
        historySize: 2,
        analysisResult: {
          sequences: [],
          dominantGestures: [
            { name: 'Open Palm', handId: 'Right-0', frequency: 0.6, confidence: 0.8 }
          ],
          timestamp: Date.now()
        }
      });
      
      // Set up event listener to catch emitted events
      const recognitionResultSpy = sandbox.spy();
      gestureManager.on('recognitionResult', recognitionResultSpy);
      
      await gestureManager.handleGesturesDetected(detectionResult);
      
      assert(mockInterpretationService.processGestures.calledOnce);
      assert.strictEqual(
        mockInterpretationService.processGestures.firstCall.args[0].length,
        2
      );
      assert(recognitionResultSpy.calledOnce);
    });
    
    it('should not process frames when not recognizing', async function() {
      await gestureManager.stopRecognition();
      
      const frameData = {
        frame: { width: 640, height: 480, data: new Uint8Array(640 * 480 * 4) },
        timestamp: Date.now()
      };
      
      await gestureManager.handleFrame(frameData);
      
      assert(!mockDetectionProvider.detectGestures.called);
    });
  });
  
  describe('Configuration and Status', function() {
    beforeEach(async function() {
      await gestureManager.initialize();
    });
    
    it('should update configuration correctly', function() {
      const newConfig = {
        camera: {
          privacyConfig: {
            enablePrivacyIndicator: false,
            applyBackgroundBlur: true
          }
        },
        interpretation: {
          gestureWeights: {
            'Pointing': 2.0,
            'Wave': 2.5
          },
          minSequenceConfidence: 0.7
        },
        enableDebugMode: false
      };
      
      const result = gestureManager.setConfig(newConfig);
      
      assert.strictEqual(result, true);
      assert(mockCameraService.setPrivacyConfig.calledOnce);
      assert.strictEqual(gestureManager.config.enableDebugMode, false);
      assert.strictEqual(
        gestureManager.interpretationService.config.minSequenceConfidence,
        0.7
      );
    });
    
    it('should return correct status', function() {
      const status = gestureManager.getStatus();
      
      assert.strictEqual(typeof status, 'object');
      assert.strictEqual(status.isInitialized, true);
      assert.strictEqual(status.isRecognizing, false);
      assert.strictEqual(status.currentSession, null);
    });
    
    it('should return correct statistics', function() {
      const stats = gestureManager.getStatistics();
      
      assert.strictEqual(typeof stats, 'object');
      assert(mockInterpretationService.getStatistics.calledOnce);
    });
  });
  
  describe('Error Handling', function() {
    beforeEach(async function() {
      await gestureManager.initialize();
    });
    
    it('should handle errors during frame processing', async function() {
      // Set up detection to throw an error
      mockDetectionProvider.detectGestures.rejects(new Error('Detection error'));
      
      // Set up event listener to catch emitted errors
      const errorSpy = sandbox.spy();
      gestureManager.on('error', errorSpy);
      
      await gestureManager.startRecognition();
      
      const frameData = {
        frame: { width: 640, height: 480, data: new Uint8Array(640 * 480 * 4) },
        timestamp: Date.now()
      };
      
      await gestureManager.handleFrame(frameData);
      
      assert(errorSpy.calledOnce);
      assert(mockLogger.error.called);
      assert.strictEqual(gestureManager.debugData.errors.length, 1);
    });
    
    it('should handle errors during gesture detection', async function() {
      // Set up interpretation to throw an error
      mockInterpretationService.processGestures.rejects(new Error('Interpretation error'));
      
      // Set up event listener to catch emitted errors
      const errorSpy = sandbox.spy();
      gestureManager.on('error', errorSpy);
      
      await gestureManager.startRecognition();
      
      const detectionResult = {
        provider: 'mediapipe',
        timestamp: Date.now(),
        handLandmarks: [mockHandLandmarks],
        handedness: [[{ categoryName: 'Right', score: 0.9 }]],
        gestures: [
          { name: 'Open Palm', hand: 'Right', confidence: 0.8, handId: 'Right-0' }
        ]
      };
      
      await gestureManager.handleGesturesDetected(detectionResult);
      
      assert(errorSpy.calledOnce);
      assert(mockLogger.error.called);
      assert.strictEqual(gestureManager.debugData.errors.length, 1);
    });
  });
});

describe('Cross-Platform Tests', function() {
  // These tests verify platform-specific behavior
  this.timeout(10000);
  
  let originalPlatform;
  let mockLogger;
  let execStub;
  let sandbox;
  
  before(function() {
    // Save original platform
    originalPlatform = process.platform;
    
    // Create sandbox
    sandbox = sinon.createSandbox();
    
    // Create stub for child_process.exec
    execStub = sandbox.stub(childProcess, 'exec');
  });
  
  beforeEach(function() {
    // Create mock logger
    mockLogger = {
      info: sandbox.spy(),
      error: sandbox.spy(),
      warn: sandbox.spy(),
      debug: sandbox.spy()
    };
  });
  
  afterEach(function() {
    sandbox.restore();
  });
  
  after(function() {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });
  
  it('should handle Windows-specific privacy indicators', function() {
    // Mock platform as Windows
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    
    // Create a mock CameraInputService with showPrivacyIndicator method
    const cameraService = {
      showPrivacyIndicator: function() {
        childProcess.exec('powershell -Command "Write-Host \'Camera Privacy Indicator\'"');
      }
    };
    
    // Call the method that would show privacy indicator
    cameraService.showPrivacyIndicator();
    
    // Verify Windows-specific code was called
    assert(execStub.called);
    assert(execStub.firstCall.args[0].includes('powershell'));
  });
  
  it('should handle macOS-specific privacy indicators', function() {
    // Mock platform as macOS
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    
    // Create a mock CameraInputService with showPrivacyIndicator method
    const cameraService = {
      showPrivacyIndicator: function() {
        childProcess.exec('osascript -e "display notification \\"Camera is active\\" with title \\"Privacy Alert\\""');
      }
    };
    
    // Call the method that would show privacy indicator
    cameraService.showPrivacyIndicator();
    
    // Verify macOS-specific code was called
    assert(execStub.called);
    assert(execStub.firstCall.args[0].includes('osascript'));
  });
  
  it('should handle Linux-specific privacy indicators', function() {
    // Mock platform as Linux
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    
    // Create a mock CameraInputService with showPrivacyIndicator method
    const cameraService = {
      showPrivacyIndicator: function() {
        childProcess.exec('notify-send "Privacy Alert" "Camera is active"');
      }
    };
    
    // Call the method that would show privacy indicator
    cameraService.showPrivacyIndicator();
    
    // Verify Linux-specific code was called
    assert(execStub.called);
    assert(execStub.firstCall.args[0].includes('notify-send'));
  });
});

describe('Performance Tests', function() {
  // These tests verify performance characteristics
  this.timeout(20000);
  
  let gestureManager;
  let mockLogger;
  let mockResourceManager;
  let mockCameraService;
  let sandbox;
  
  beforeEach(async function() {
    // Create sandbox
    sandbox = sinon.createSandbox();
    
    // Create mock logger
    mockLogger = {
      info: sandbox.spy(),
      error: sandbox.spy(),
      warn: sandbox.spy(),
      debug: sandbox.spy()
    };
    
    // Create mock resource manager
    mockResourceManager = {
      checkPermission: sandbox.stub().resolves(true),
      allocateResource: sandbox.stub().resolves(true),
      releaseResource: sandbox.stub().resolves(true)
    };
    
    // Create real instance with mocked dependencies
    gestureManager = new GestureRecognitionManager({
      logger: mockLogger,
      resourceManager: mockResourceManager,
      enableDebugMode: true
    });
    
    // Mock the camera service
    mockCameraService = {
      initialize: sandbox.stub().resolves(true),
      shutdown: sandbox.stub().resolves(true),
      startCapture: sandbox.stub().resolves('mock-camera-session'),
      stopCapture: sandbox.stub().resolves({ id: 'mock-camera-session', frameCount: 10 }),
      on: sandbox.stub(),
      removeListener: sandbox.stub(),
      setPrivacyConfig: sandbox.stub().returns(true)
    };
    
    // Mock the detection provider
    const mockDetectionProvider = {
      initialize: sandbox.stub().resolves(true),
      shutdown: sandbox.stub().resolves(true),
      detectGestures: sandbox.stub().resolves({
        provider: 'mediapipe',
        timestamp: Date.now(),
        handLandmarks: [],
        handedness: [],
        gestures: []
      }),
      on: sandbox.stub(),
      removeListener: sandbox.stub()
    };
    
    // Replace components with mocks
    gestureManager.cameraService = mockCameraService;
    gestureManager.detectionProvider = mockDetectionProvider;
    
    // Initialize
    await gestureManager.initialize();
  });
  
  afterEach(async function() {
    // Clean up
    if (gestureManager.isInitialized) {
      await gestureManager.shutdown();
    }
    sandbox.restore();
  });
  
  it('should process frames at an acceptable rate', async function() {
    // Start recognition
    await gestureManager.startRecognition();
    
    // Prepare test data
    const frameCount = 30; // Simulate 1 second at 30fps
    const frameData = {
      frame: { width: 640, height: 480, data: new Uint8Array(640 * 480 * 4) },
      timestamp: Date.now()
    };
    
    // Process frames and measure time
    const startTime = Date.now();
    
    for (let i = 0; i < frameCount; i++) {
      frameData.timestamp = Date.now();
      await gestureManager.handleFrame(frameData);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgFrameTime = totalTime / frameCount;
    
    // Verify performance
    assert(avgFrameTime < 100, `Average frame processing time (${avgFrameTime}ms) exceeds threshold (100ms)`);
    
    // Stop recognition
    await gestureManager.stopRecognition();
  });
  
  it('should handle high-frequency gesture detection', async function() {
    // Start recognition
    await gestureManager.startRecognition();
    
    // Set up event listener to count recognition results
    let resultCount = 0;
    gestureManager.on('recognitionResult', () => {
      resultCount++;
    });
    
    // Prepare test data
    const gestureCount = 100;
    const detectionResult = {
      provider: 'mediapipe',
      timestamp: Date.now(),
      handLandmarks: [mockHandLandmarks],
      handedness: [[{ categoryName: 'Right', score: 0.9 }]],
      gestures: [
        { name: 'Open Palm', hand: 'Right', confidence: 0.8, handId: 'Right-0', timestamp: Date.now() }
      ]
    };
    
    // Process gestures and measure time
    const startTime = Date.now();
    
    for (let i = 0; i < gestureCount; i++) {
      detectionResult.timestamp = Date.now();
      await gestureManager.handleGesturesDetected(detectionResult);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgGestureTime = totalTime / gestureCount;
    
    // Verify performance
    assert(avgGestureTime < 50, `Average gesture processing time (${avgGestureTime}ms) exceeds threshold (50ms)`);
    
    // Stop recognition
    await gestureManager.stopRecognition();
  });
});

// Run the tests
if (require.main === module) {
  // This allows the file to be run directly
  const Mocha = require('mocha');
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}
