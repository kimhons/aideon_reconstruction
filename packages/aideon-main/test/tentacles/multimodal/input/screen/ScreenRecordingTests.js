/**
 * @fileoverview Test for Screen Recording and Analysis module.
 * Includes integration tests for all components.
 * 
 * @author Aideon AI Team
 * @version 1.0.2
 */

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Import components - Fix relative paths to correctly locate source files
// Use absolute paths for imports
const path = require('path');
const managerPath = path.join(__dirname, '..', '..', '..', '..', '..', 'src', 'tentacles', 'multimodal', 'input', 'screen', 'EnhancedScreenRecordingManager.js');
console.log(`Loading ScreenRecordingManager from: ${managerPath}`);
const ScreenRecordingManager = require(managerPath);
const AnalysisEngine = require('../../../../../src/tentacles/multimodal/input/screen/analysis/AnalysisEngine');

// Import test utilities
const { createMockLogger, createMockConfigManager } = require('../../../../utils/testUtils');

// Test constants
const TEST_RECORDING_DIR = path.join(os.tmpdir(), 'aideon-test-recordings');
const TEST_TIMEOUT = 10000; // 10 seconds

describe('Screen Recording and Analysis Integration Tests', function() {
  // Increase timeout for all tests
  this.timeout(TEST_TIMEOUT);
  
  let manager;
  let analysisEngine;
  let mockLogger;
  let mockConfigManager;
  let clock;
  
  // Setup before all tests
  before(async function() {
    // Create test recording directory
    await fs.mkdir(TEST_RECORDING_DIR, { recursive: true });
  });
  
  // Cleanup after all tests
  after(async function() {
    // Remove test recording directory
    try {
      await fs.rm(TEST_RECORDING_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove test directory: ${error.message}`);
    }
  });
  
  // Setup before each test
  beforeEach(async function() {
    // Create mock dependencies
    mockLogger = createMockLogger();
    mockConfigManager = createMockConfigManager();
    
    // Create fake timer
    clock = sinon.useFakeTimers({
      now: Date.now(),
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
    });
    
    // Create analysis engine
    analysisEngine = new AnalysisEngine({
      logger: mockLogger,
      configManager: mockConfigManager
    });
    
    // Create screen recording manager
    manager = new ScreenRecordingManager({
      logger: mockLogger,
      configManager: mockConfigManager,
      analysisEngine
    });
    
    // Initialize components
    await analysisEngine.initialize();
    await manager.initialize();
  });
  
  // Cleanup after each test
  afterEach(async function() {
    // Restore fake timer
    clock.restore();
    
    // Shutdown manager if initialized
    if (manager && manager.initialized) {
      try {
        await manager.shutdown();
      } catch (error) {
        console.warn(`Failed to shut down manager: ${error.message}`);
      }
    }
    
    // Shutdown analysis engine if initialized
    if (analysisEngine && analysisEngine.initialized) {
      try {
        await analysisEngine.shutdown();
      } catch (error) {
        console.warn(`Failed to shut down analysis engine: ${error.message}`);
      }
    }
    
    // Reset mocks
    sinon.restore();
  });
  
  // Initialization tests
  describe('Initialization', function() {
    it('should initialize all components successfully', function() {
      assert.strictEqual(manager.initialized, true, 'Manager should be initialized');
      assert.strictEqual(analysisEngine.initialized, true, 'Analysis engine should be initialized');
    });
    
    it('should detect the correct platform', function() {
      const platform = process.platform;
      let expectedServiceType;
      
      if (platform === 'win32') {
        expectedServiceType = 'WindowsCaptureService';
      } else if (platform === 'darwin') {
        expectedServiceType = 'MacOSCaptureService';
      } else {
        expectedServiceType = 'LinuxCaptureService';
      }
      
      assert.ok(manager.captureService.constructor.name === expectedServiceType, 
        `Capture service should be ${expectedServiceType}, got ${manager.captureService.constructor.name}`);
    });
  });
  
  // Configuration tests
  describe('Configuration', function() {
    it('should update configuration successfully', async function() {
      const newConfig = {
        frameRate: 60,
        resolution: '720p',
        compressionLevel: 'high'
      };
      
      const updatedConfig = await manager.updateConfiguration(newConfig);
      
      assert.strictEqual(updatedConfig.frameRate, 60, 'Frame rate should be updated');
      assert.strictEqual(updatedConfig.resolution, '720p', 'Resolution should be updated');
      assert.strictEqual(updatedConfig.compressionLevel, 'high', 'Compression level should be updated');
    });
    
    it('should update analysis engine configuration successfully', async function() {
      const newConfig = {
        analysisConfig: {
          detectElements: true,
          extractContent: true,
          recognizeText: true
        }
      };
      
      // Spy on analysis engine updateConfiguration
      const updateConfigSpy = sinon.spy(analysisEngine, 'updateConfiguration');
      
      await manager.updateConfiguration(newConfig);
      
      assert.strictEqual(updateConfigSpy.calledOnce, true, 'Analysis engine updateConfiguration should be called');
      assert.deepStrictEqual(updateConfigSpy.firstCall.args[0], newConfig.analysisConfig, 
        'Analysis engine should receive correct config');
    });
  });
  
  // Screen recording tests
  describe('Screen Recording', function() {
    it('should capture a single frame successfully', async function() {
      // Stub captureService.captureSingleFrame to return a mock frame
      const mockFrame = {
        id: 'frame-123',
        timestamp: Date.now(),
        data: Buffer.from('mock-frame-data'),
        width: 1920,
        height: 1080,
        format: 'png'
      };
      
      sinon.stub(manager.captureService, 'captureSingleFrame').resolves(mockFrame);
      
      const frame = await manager.captureSingleFrame();
      
      assert.deepStrictEqual(frame, mockFrame, 'Captured frame should match mock frame');
    });
    
    it('should start and stop recording successfully', async function() {
      this.timeout(30000); // Increase timeout for this specific test
      
      // Stub captureService methods
      const captureSessionId = 'session-123';
      const mockCaptureInfo = {
        frameCount: 10,
        duration: 5000
      };
      
      // Create more robust stubs with explicit behavior
      const startCaptureStub = sinon.stub(manager.captureService, 'startCapture');
      startCaptureStub.resolves(captureSessionId);
      
      const stopCaptureStub = sinon.stub(manager.captureService, 'stopCapture');
      stopCaptureStub.resolves(mockCaptureInfo);
      
      // Add explicit logging for debugging
      console.log('Starting recording test...');
      
      try {
        // Start recording with explicit error handling
        const recordingInfo = await manager.startRecording({
          type: 'fullScreen',
          frameRate: 30,
          outputDir: TEST_RECORDING_DIR
        });
        
        console.log('Recording started:', recordingInfo.id);
        
        // Verify recording started correctly
        assert.ok(recordingInfo.id, 'Recording ID should be defined');
        assert.strictEqual(manager.state, 'recording', 'Manager state should be recording');
        assert.ok(manager.activeRecording, 'Active recording should be defined');
        assert.strictEqual(manager.activeRecording.isActive, true, 'Recording should be active');
        
        // Add a longer delay to ensure state is stable
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('Before stopping, active recording:', 
          manager.activeRecording ? manager.activeRecording.id : 'none',
          'isActive:', manager.activeRecording ? manager.activeRecording.isActive : false);
        
        // Stop recording with explicit error handling
        let stoppedInfo;
        try {
          stoppedInfo = await manager.stopRecording();
          console.log('Recording stopped successfully:', stoppedInfo.id);
        } catch (stopError) {
          console.error('Error stopping recording:', stopError.message);
          throw stopError;
        }
        
        // Verify recording stopped correctly
        assert.ok(stoppedInfo, 'Stopped info should be defined');
        assert.strictEqual(stoppedInfo.id, recordingInfo.id, 'Stopped recording ID should match started recording ID');
        assert.strictEqual(manager.state, 'ready', 'Manager state should be ready');
        assert.strictEqual(manager.activeRecording, null, 'Active recording should be null');
      } catch (error) {
        console.error('Test error:', error.message);
        throw error;
      }
    });
  });
  
  // Analysis tests
  describe('Analysis', function() {
    let recordingId;
    
    // Setup recording for analysis tests
     // Setup before each test for Analysis
  beforeEach(async function() {
    this.timeout(30000); // Increase timeout for this setup
    
    try {
      // Stub captureService methods with explicit behavior
      const captureSessionId = 'session-123';
      const mockCaptureInfo = {
        frameCount: 10,
        duration: 5000
      };
      
      const startCaptureStub = sinon.stub(manager.captureService, 'startCapture');
      startCaptureStub.resolves(captureSessionId);
      
      const stopCaptureStub = sinon.stub(manager.captureService, 'stopCapture');
      stopCaptureStub.resolves(mockCaptureInfo);
      
      console.log('Analysis setup: Starting recording...');
      
      // Start recording with explicit error handling
      let recordingInfo;
      try {
        recordingInfo = await manager.startRecording({
          type: 'fullScreen',
          frameRate: 30,
          outputDir: TEST_RECORDING_DIR,
          analyzeInRealTime: false
        });
        console.log('Analysis setup: Recording started:', recordingInfo.id);
      } catch (startError) {
        console.error('Analysis setup: Error starting recording:', startError.message);
        throw startError;
      }
      
      recordingId = recordingInfo.id;
      
      // Add a longer delay to ensure state is stable
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Analysis setup: Before stopping, active recording:', 
        manager.activeRecording ? manager.activeRecording.id : 'none',
        'isActive:', manager.activeRecording ? manager.activeRecording.isActive : false);
      
      // Stop recording with explicit error handling
      try {
        const stoppedInfo = await manager.stopRecording();
        console.log('Analysis setup: Recording stopped successfully:', stoppedInfo.id);
      } catch (stopError) {
        console.error('Analysis setup: Error stopping recording:', stopError.message);
        throw stopError;
      }
    } catch (error) {
      console.error('Analysis setup: Failed to record frames for analysis:', error.message);
      // Don't swallow the error - propagate it to fail the test properly
      throw error;
    }
  });
    
    it('should analyze a single frame successfully', async function() {
      // Skip if recording setup failed
      if (!recordingId) {
        this.skip();
      }
      
      // Stub analysisEngine.analyzeFrame to return mock results
      const mockAnalysisResult = {
        elements: [
          { type: 'button', bounds: { x: 10, y: 10, width: 100, height: 30 } },
          { type: 'text', bounds: { x: 120, y: 10, width: 200, height: 30 } }
        ],
        content: 'Sample text content',
        confidence: 0.95
      };
      
      sinon.stub(analysisEngine, 'analyzeFrame').resolves(mockAnalysisResult);
      
      // Stub captureService.captureSingleFrame to return a mock frame
      const mockFrame = {
        id: 'frame-123',
        timestamp: Date.now(),
        data: Buffer.from('mock-frame-data'),
        width: 1920,
        height: 1080,
        format: 'png'
      };
      
      sinon.stub(manager.captureService, 'captureSingleFrame').resolves(mockFrame);
      
      // Analyze single frame
      const result = await manager.captureSingleFrame({ analyze: true });
      
      // Verify analysis results
      assert.ok(result.analysis, 'Analysis results should be defined');
      assert.deepStrictEqual(result.analysis, mockAnalysisResult, 'Analysis results should match mock results');
    });
  });
  
  // End-to-end workflow test
  describe('End-to-End Workflow', function() {
    it('should perform a complete recording and analysis workflow', async function() {
      // Stub captureService methods
      const captureSessionId = 'session-123';
      const mockCaptureInfo = {
        frameCount: 10,
        duration: 5000
      };
      
      sinon.stub(manager.captureService, 'startCapture').resolves(captureSessionId);
      sinon.stub(manager.captureService, 'stopCapture').resolves(mockCaptureInfo);
      
      // Stub analysisEngine methods
      const mockAnalysisResult = {
        id: 'analysis-123',
        elements: [
          { type: 'button', bounds: { x: 10, y: 10, width: 100, height: 30 } },
          { type: 'text', bounds: { x: 120, y: 10, width: 200, height: 30 } }
        ],
        content: 'Sample text content',
        confidence: 0.95
      };
      
      sinon.stub(analysisEngine, 'analyzeSequence').resolves(mockAnalysisResult);
      
      // Add explicit logging for debugging
      console.log('Starting end-to-end workflow test...');
      
      // Start recording
      const recordingInfo = await manager.startRecording({
        type: 'fullScreen',
        frameRate: 30,
        outputDir: TEST_RECORDING_DIR,
        analyzeInRealTime: false
      });
      
      console.log('Recording started:', recordingInfo.id);
      
      // Verify recording started correctly
      assert.ok(recordingInfo.id, 'Recording ID should be defined');
      assert.strictEqual(manager.state, 'recording', 'Manager state should be recording');
      
      // Add a small delay to ensure state is stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Before stopping, active recording:', 
        manager.activeRecording ? manager.activeRecording.id : 'none',
        'isActive:', manager.activeRecording ? manager.activeRecording.isActive : false);
      
      // Stop recording
      const stoppedInfo = await manager.stopRecording();
      
      console.log('Recording stopped:', stoppedInfo.id);
      
      // Verify recording stopped correctly
      assert.strictEqual(stoppedInfo.id, recordingInfo.id, 'Stopped recording ID should match started recording ID');
      
      // Analyze recording
      const analysisResult = await manager.analyzeRecording(recordingInfo.id);
      
      // Verify analysis results
      assert.strictEqual(analysisResult.id, mockAnalysisResult.id, 'Analysis ID should match mock result');
      assert.deepStrictEqual(analysisResult.elements, mockAnalysisResult.elements, 'Elements should match mock result');
      
      // Get recording info
      const retrievedInfo = await manager.getRecordingInfo(recordingInfo.id);
      
      // Verify retrieved info
      assert.strictEqual(retrievedInfo.id, recordingInfo.id, 'Retrieved ID should match original ID');
      assert.strictEqual(retrievedInfo.analysisId, analysisResult.id, 'Analysis ID should be set in recording info');
      
      // Get analysis results
      const retrievedAnalysis = await manager.getAnalysisResults(recordingInfo.id);
      
      // Verify retrieved analysis
      assert.deepStrictEqual(retrievedAnalysis, analysisResult, 'Retrieved analysis should match original analysis');
    });
  });
  
  // Error handling tests
  describe('Error Handling', function() {
    it('should handle invalid configuration gracefully', async function() {
      const invalidConfig = {
        frameRate: -10 // Invalid value
      };
      
      try {
        await manager.updateConfiguration(invalidConfig);
        assert.fail('Should have thrown an error for invalid configuration');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.ok(error.message.includes('frameRate'), 'Error message should mention the invalid field');
      }
    });
    
    it('should handle recording errors gracefully', async function() {
      // Stub captureService.startCapture to throw an error
      sinon.stub(manager.captureService, 'startCapture').rejects(new Error('Mock capture error'));
      
      try {
        await manager.startRecording();
        assert.fail('Should have thrown an error for recording failure');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Mock capture error', 'Error message should match mock error');
        assert.strictEqual(manager.state, 'error', 'Manager state should be error');
      }
    });
    
    it('should handle analysis errors gracefully', async function() {
      // Stub analysisEngine.analyzeFrame to throw an error
      sinon.stub(analysisEngine, 'analyzeFrame').rejects(new Error('Mock analysis error'));
      
      // Stub captureService.captureSingleFrame to return a mock frame
      const mockFrame = {
        id: 'frame-123',
        timestamp: Date.now(),
        data: Buffer.from('mock-frame-data'),
        width: 1920,
        height: 1080,
        format: 'png'
      };
      
      sinon.stub(manager.captureService, 'captureSingleFrame').resolves(mockFrame);
      
      try {
        await manager.captureSingleFrame({ analyze: true });
        assert.fail('Should have thrown an error for analysis failure');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Mock analysis error', 'Error message should match mock error');
      }
    });
  });
});
