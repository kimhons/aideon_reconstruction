/**
 * @fileoverview Updated isolated lifecycle tests for Screen Recording and Analysis module.
 * 
 * This file provides isolated tests for the recording lifecycle,
 * using absolute paths to prevent module resolution issues.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');

// Import test module resolver
const TestModuleResolver = require('./utils/TestModuleResolver');

// Set up mocks before importing modules

// Mock file system
const mockFs = {
  promises: {
    mkdir: sinon.stub().resolves(),
    writeFile: sinon.stub().resolves(),
    readFile: sinon.stub().callsFake((path) => {
      if (path.endsWith('metadata.json')) {
        return Promise.resolve(JSON.stringify({
          id: 'mock-recording-id',
          startTime: Date.now() - 10000,
          endTime: Date.now(),
          duration: 10000,
          totalFrames: 100,
          outputPath: '/path/to/recording'
        }));
      }
      if (path.endsWith('analysis.json')) {
        return Promise.resolve(JSON.stringify({
          id: 'mock-analysis-id',
          elements: [],
          activities: [],
          patterns: []
        }));
      }
      return Promise.reject(new Error(`File not found: ${path}`));
    })
  }
};

// Apply fs mock before requiring any modules that use fs
const fs = require('fs');
const originalFs = fs.promises;
sinon.stub(fs, 'promises').value(mockFs.promises);
console.log('Mock fs.promises.writeFile installed:', typeof mockFs.promises.writeFile);

// Now import modules after mocks are in place
const managerPath = path.join(__dirname, '..', '..', '..', '..', '..', 'src', 'tentacles', 'multimodal', 'input', 'screen', 'EnhancedScreenRecordingManager.js');
console.log(`Loading ScreenRecordingManager from: ${managerPath}`);
const ScreenRecordingManager = require(managerPath);

// Import constants directly with absolute path
const constantsPath = path.join(__dirname, '..', '..', '..', '..', '..', 'src', 'tentacles', 'multimodal', 'input', 'screen', 'constants.js');
console.log(`Loading constants from: ${constantsPath}`);
const { ScreenRecordingState, ScreenRecordingEvent } = require(constantsPath);

// Mock dependencies
class MockLogger {
  constructor() {
    this.debug = sinon.stub();
    this.info = sinon.stub();
    this.warn = sinon.stub();
    this.error = sinon.stub();
  }
}

class MockConfigManager {
  constructor(config = {}) {
    this.config = config;
    this.getConfig = sinon.stub().resolves(this.config);
    this.setConfig = sinon.stub().resolves(true);
  }
}

class MockCaptureService {
  constructor() {
    this.initialize = sinon.stub().resolves();
    this.shutdown = sinon.stub().resolves();
    this.updateConfiguration = sinon.stub().resolves();
    this.startCapture = sinon.stub().resolves('mock-session-id');
    this.stopCapture = sinon.stub().resolves({ frameCount: 100, duration: 10000 });
    this.pauseCapture = sinon.stub().resolves();
    this.resumeCapture = sinon.stub().resolves();
    this.captureSingleFrame = sinon.stub().resolves({
      id: 'mock-frame-id',
      timestamp: Date.now(),
      path: '/path/to/frame.png'
    });
  }
}

class MockAnalysisEngine {
  constructor() {
    this.initialized = false;
    this.initialize = sinon.stub().callsFake(() => {
      this.initialized = true;
      return Promise.resolve();
    });
    this.shutdown = sinon.stub().callsFake(() => {
      this.initialized = false;
      return Promise.resolve();
    });
    this.updateConfiguration = sinon.stub().resolves();
    this.analyzeFrame = sinon.stub().resolves({
      elements: [],
      text: '',
      activities: []
    });
    this.analyzeSequence = sinon.stub().resolves({
      id: 'mock-analysis-id',
      elements: [],
      activities: [],
      patterns: []
    });
  }
}

// Setup test environment
describe('Enhanced Screen Recording Manager - Isolated Lifecycle Tests', function() {
  let manager;
  let logger;
  let configManager;
  let captureService;
  let analysisEngine;
  let fsStub;
  
  // Setup before each test for isolation
  beforeEach(async function() {
    // Create mocks
    logger = new MockLogger();
    configManager = new MockConfigManager({
      outputDir: '/tmp/aideon-recordings',
      frameRate: 30,
      resolution: '1080p',
      compressionLevel: 'medium',
      captureAudio: false,
      debugMode: true
    });
    captureService = new MockCaptureService();
    analysisEngine = new MockAnalysisEngine();
    
    // Log for debugging
    console.log('Mock fs.promises.writeFile installed:', typeof mockFs.promises.writeFile);
    
    // Stub platform-specific capture service
    const platformStub = sinon.stub(ScreenRecordingManager.prototype, 'initializeCaptureService')
      .callsFake(function() {
        this.captureService = captureService;
        return Promise.resolve();
      });
    
    // Create manager instance
    manager = new ScreenRecordingManager({
      logger,
      configManager,
      analysisEngine
    });
    
    // Initialize manager
    await manager.initialize();
  });
  
  // Cleanup after each test
  afterEach(async function() {
    // Restore stubs
    sinon.restore();
    
    // Shutdown manager if initialized
    if (manager && manager.initialized) {
      await manager.shutdown();
    }
    
    // Clear manager
    manager = null;
  });
  
  // Test initialization and shutdown
  it('should initialize and shutdown cleanly', async function() {
    // Verify initialization
    expect(manager.initialized).to.be.true;
    expect(manager.state).to.equal(ScreenRecordingState.READY);
    expect(logger.info.calledWith('Screen recording manager initialized successfully')).to.be.true;
    
    // Verify shutdown
    await manager.shutdown();
    expect(manager.initialized).to.be.false;
    expect(manager.state).to.equal(ScreenRecordingState.IDLE);
    expect(logger.info.calledWith('Screen recording manager shut down successfully')).to.be.true;
    expect(captureService.shutdown.calledOnce).to.be.true;
  });
  
  // Test configuration update
  it('should update configuration correctly', async function() {
    const newConfig = {
      frameRate: 60,
      resolution: '4K',
      compressionLevel: 'high'
    };
    
    const updatedConfig = await manager.updateConfiguration(newConfig);
    
    expect(updatedConfig.frameRate).to.equal(60);
    expect(updatedConfig.resolution).to.equal('4K');
    expect(updatedConfig.compressionLevel).to.equal('high');
    expect(captureService.updateConfiguration.calledOnce).to.be.true;
    expect(configManager.setConfig.calledOnce).to.be.true;
  });
  
  // Test single frame capture
  it('should capture a single frame', async function() {
    const frame = await manager.captureSingleFrame();
    
    expect(frame).to.have.property('id');
    expect(frame).to.have.property('timestamp');
    expect(frame).to.have.property('path');
    expect(captureService.captureSingleFrame.calledOnce).to.be.true;
  });
  
  // Test start and stop recording
  it('should start and stop recording correctly', async function() {
    try {
      console.log('Starting recording test...');
      
      // Spy on saveRecordingMetadata method
      const saveMetadataSpy = sinon.spy(ScreenRecordingManager.prototype, 'saveRecordingMetadata');
      
      // Start recording
      const recordingInfo = await manager.startRecording();
      
      console.log('Recording started successfully:', JSON.stringify(recordingInfo));
      console.log('Current manager state:', manager.state);
      console.log('Active recording:', manager.activeRecording ? 'exists' : 'null');
      
      expect(recordingInfo).to.have.property('id');
      expect(recordingInfo).to.have.property('startTime');
      expect(recordingInfo.isActive).to.be.true;
      expect(manager.state).to.equal(ScreenRecordingState.RECORDING);
      expect(captureService.startCapture.calledOnce).to.be.true;
      
      console.log('Before stopping recording...');
      console.log('Manager state:', manager.state);
      console.log('Active recording:', manager.activeRecording ? manager.activeRecording.id : 'null');
      
      // Stop recording
      const stoppedInfo = await manager.stopRecording();
      
      console.log('Recording stopped successfully:', JSON.stringify(stoppedInfo));
      console.log('Final manager state:', manager.state);
      console.log('saveRecordingMetadata called:', saveMetadataSpy.called);
      
      expect(stoppedInfo).to.have.property('id');
      expect(stoppedInfo).to.have.property('endTime');
      expect(stoppedInfo).to.have.property('duration');
      expect(stoppedInfo.isActive).to.be.false;
      expect(manager.state).to.equal(ScreenRecordingState.READY);
      expect(captureService.stopCapture.calledOnce).to.be.true;
      
      // Check if saveRecordingMetadata was called instead of checking writeFile directly
      expect(saveMetadataSpy.calledOnce).to.be.true;
      
      // Restore the spy
      saveMetadataSpy.restore();
    } catch (error) {
      console.error('TEST ERROR:', error.message);
      console.error('STACK TRACE:', error.stack);
      throw error; // Re-throw to fail the test
    }
  });
  
  // Test pause and resume recording
  it('should pause and resume recording correctly', async function() {
    // Start recording
    await manager.startRecording();
    
    // Pause recording
    const pausedInfo = await manager.pauseRecording();
    
    expect(pausedInfo).to.have.property('pauseStartTime');
    expect(manager.state).to.equal(ScreenRecordingState.PAUSED);
    expect(captureService.pauseCapture.calledOnce).to.be.true;
    
    // Wait a bit to accumulate pause time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Resume recording
    const resumedInfo = await manager.resumeRecording();
    
    expect(resumedInfo.pauseStartTime).to.be.null;
    expect(resumedInfo.totalPauseDuration).to.be.greaterThan(0);
    expect(manager.state).to.equal(ScreenRecordingState.RECORDING);
    expect(captureService.resumeCapture.calledOnce).to.be.true;
    
    // Stop recording
    await manager.stopRecording();
  });
  
  // Test complete recording lifecycle
  it('should complete the full recording lifecycle', async function() {
    // Start recording
    const startInfo = await manager.startRecording();
    expect(manager.state).to.equal(ScreenRecordingState.RECORDING);
    
    // Pause recording
    await manager.pauseRecording();
    expect(manager.state).to.equal(ScreenRecordingState.PAUSED);
    
    // Wait a bit to accumulate pause time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Resume recording
    const resumeInfo = await manager.resumeRecording();
    expect(manager.state).to.equal(ScreenRecordingState.RECORDING);
    expect(resumeInfo.totalPauseDuration).to.be.greaterThan(0);
    
    // Stop recording
    const stopInfo = await manager.stopRecording();
    expect(manager.state).to.equal(ScreenRecordingState.READY);
    expect(stopInfo.totalPauseDuration).to.be.greaterThan(0);
    
    // Analyze recording
    analysisEngine.analyzeSequence.resolves({
      id: 'test-analysis-id',
      elements: [{ type: 'button', text: 'Test' }],
      activities: [{ type: 'click', timestamp: Date.now() }],
      patterns: [{ name: 'test-pattern', confidence: 0.9 }]
    });
    
    const analysisResults = await manager.analyzeRecording(stopInfo.id);
    expect(analysisResults).to.have.property('id');
    expect(analysisResults.elements).to.be.an('array');
    expect(analysisResults.activities).to.be.an('array');
    expect(analysisResults.patterns).to.be.an('array');
  });
  
  // Test error handling
  it('should handle errors gracefully', async function() {
    // Force an error in startCapture
    captureService.startCapture.rejects(new Error('Simulated error'));
    
    try {
      await manager.startRecording();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.equal('Simulated error');
      expect(manager.state).to.equal(ScreenRecordingState.READY);
      expect(logger.error.called).to.be.true;
    }
    
    // Reset stub
    captureService.startCapture.reset();
    captureService.startCapture.resolves('mock-session-id');
    
    // Start recording successfully
    await manager.startRecording();
    
    // Force an error in stopCapture
    captureService.stopCapture.rejects(new Error('Simulated stop error'));
    
    try {
      await manager.stopRecording();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.equal('Simulated stop error');
      expect(logger.error.called).to.be.true;
    }
  });
  
  // Test concurrent operations
  it('should handle concurrent operations correctly', async function() {
    // Start recording
    const startPromise = manager.startRecording();
    
    // Try to start another recording before the first one completes
    try {
      await manager.startRecording();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.include('lock');
    }
    
    // Wait for the first start to complete
    await startPromise;
    
    // Try to start another recording when one is already active
    try {
      await manager.startRecording();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.include('already in progress');
    }
    
    // Stop recording
    await manager.stopRecording();
  });
  
  // Test timeout handling
  it('should handle timeouts correctly', async function() {
    // Make startCapture hang
    captureService.startCapture.callsFake(() => new Promise(resolve => {
      // This promise never resolves
    }));
    
    // Set a short timeout for the test
    const originalExecute = manager.operationLock.withLock;
    sinon.stub(manager.operationLock, 'withLock').callsFake(function(fn, options) {
      options = options || {};
      options.timeout = 100; // Short timeout for test
      return originalExecute.call(this, fn, options);
    });
    
    try {
      await manager.startRecording();
      expect.fail('Should have thrown a timeout error');
    } catch (error) {
      expect(error.message).to.include('timeout');
      expect(manager.state).to.equal(ScreenRecordingState.READY);
    }
  });
  
  // Test cancellation
  it('should support operation cancellation', async function() {
    // Make startCapture cancellable
    captureService.startCapture.callsFake(async (options) => {
      // Simulate a long operation
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 5000);
        
        // Check for cancellation
        if (options.token && options.token.isCancellationRequested) {
          clearTimeout(timeout);
          reject(new Error('Operation cancelled'));
        }
      });
      
      return 'mock-session-id';
    });
    
    // Create a cancellation token
    const { EnhancedCancellationToken } = TestModuleResolver.safeRequire(
      TestModuleResolver.resolveScreenModulePath('utils')
    );
    
    const token = new EnhancedCancellationToken();
    
    // Start recording with the token
    const startPromise = manager.startRecording({ token });
    
    // Cancel the operation
    setTimeout(() => token.cancel('Test cancellation'), 50);
    
    try {
      await startPromise;
      expect.fail('Should have been cancelled');
    } catch (error) {
      expect(error.message).to.include('cancel');
      expect(manager.state).to.equal(ScreenRecordingState.READY);
    }
  });
});
