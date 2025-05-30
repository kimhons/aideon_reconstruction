/**
 * @fileoverview Enhanced Screen Recording Manager with robust async handling.
 * 
 * This implementation addresses the critical issues identified in the architectural review:
 * - Robust locking mechanism with automatic release
 * - Timeout protection for all asynchronous operations
 * - Atomic state transitions with proper validation
 * - Enhanced error handling with resource cleanup
 * 
 * @author Aideon AI Team
 * @version 1.1.0
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Import constants
const { ScreenRecordingState, ScreenRecordingEvent } = require('./constants');

// Import enhanced utilities
const { 
  EnhancedAsyncLock, 
  EnhancedCancellationToken, 
  EnhancedAsyncOperation 
} = require('./utils');

/**
 * Enhanced Screen Recording Manager with robust async handling.
 * @extends EventEmitter
 */
class EnhancedScreenRecordingManager extends EventEmitter {
  /**
   * Creates a new EnhancedScreenRecordingManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configManager - Configuration manager
   * @param {Object} options.analysisEngine - Analysis engine instance
   */
  constructor(options = {}) {
    super();
    
    // Store dependencies
    this.logger = options.logger || console;
    this.configManager = options.configManager;
    this.analysisEngine = options.analysisEngine;
    
    // Initialize state
    this.state = ScreenRecordingState.IDLE;
    this.initialized = false;
    this.activeRecording = null;
    
    // Create enhanced async lock
    this.operationLock = new EnhancedAsyncLock({
      logger: this.logger,
      name: 'ScreenRecordingManager-Lock',
      defaultTimeout: 30000 // 30 seconds default
    });
    
    // Default configuration
    this.config = {
      outputDir: path.join(os.tmpdir(), 'aideon-recordings'),
      frameRate: 30,
      resolution: '1080p',
      compressionLevel: 'medium',
      captureAudio: false,
      debugMode: false
    };
    
    // Platform-specific capture service
    this.captureService = null;
    
    // Bind methods to preserve context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.updateConfiguration = this.updateConfiguration.bind(this);
    this.setState = this.setState.bind(this);
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.pauseRecording = this.pauseRecording.bind(this);
    this.resumeRecording = this.resumeRecording.bind(this);
    this.captureSingleFrame = this.captureSingleFrame.bind(this);
    this.analyzeRecording = this.analyzeRecording.bind(this);
    this.getRecordingInfo = this.getRecordingInfo.bind(this);
    this.getAnalysisResults = this.getAnalysisResults.bind(this);
  }
  
  /**
   * Initializes the screen recording manager.
   * @returns {Promise<void>}
   */
  async initialize() {
    // Use enhanced async operation with timeout and retry
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (this.initialized) {
          this.logger.warn('Screen recording manager already initialized');
          return;
        }
        
        this.logger.info('Initializing screen recording manager');
        
        // Set state to initializing
        this.setState(ScreenRecordingState.INITIALIZING);
        
        try {
          // Load configuration
          if (this.configManager) {
            const config = await this.configManager.getConfig('screenRecording');
            if (config) {
              this.config = { ...this.config, ...config };
            }
          }
          
          // Create output directory if it doesn't exist
          await fs.mkdir(this.config.outputDir, { recursive: true });
          
          // Initialize platform-specific capture service
          await this.initializeCaptureService();
          
          // Initialize analysis engine if provided
          if (this.analysisEngine && !this.analysisEngine.initialized) {
            await this.analysisEngine.initialize();
          }
          
          // Set state to ready
          this.setState(ScreenRecordingState.READY);
          this.initialized = true;
          
          this.logger.info('Screen recording manager initialized successfully');
          this.emit(ScreenRecordingEvent.INITIALIZED);
        } catch (error) {
          this.logger.error(`Failed to initialize screen recording manager: ${error.message}`);
          this.setState(ScreenRecordingState.ERROR);
          throw error;
        }
      }, {
        owner: 'initialize'
      });
    }, {
      operationName: 'ScreenRecordingManager.initialize',
      logger: this.logger,
      timeout: 60000, // 60 seconds
      retries: 2
    });
  }
  
  /**
   * Initializes the platform-specific capture service.
   * @returns {Promise<void>}
   * @private
   */
  async initializeCaptureService() {
    const platform = process.platform;
    let CaptureServiceClass;
    
    // Determine platform-specific capture service
    if (platform === 'win32') {
      CaptureServiceClass = require('./platform/WindowsCaptureService');
    } else if (platform === 'darwin') {
      CaptureServiceClass = require('./platform/MacOSCaptureService');
    } else {
      CaptureServiceClass = require('./platform/LinuxCaptureService');
    }
    
    // Create and initialize capture service
    this.captureService = new CaptureServiceClass({
      logger: this.logger,
      config: this.config
    });
    
    await this.captureService.initialize();
  }
  
  /**
   * Shuts down the screen recording manager.
   * @returns {Promise<void>}
   */
  async shutdown() {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          this.logger.warn('Screen recording manager not initialized');
          return;
        }
        
        this.logger.info('Shutting down screen recording manager');
        
        try {
          // Stop active recording if any
          if (this.activeRecording) {
            try {
              await this.stopRecording();
            } catch (error) {
              this.logger.warn(`Failed to stop active recording during shutdown: ${error.message}`);
            }
          }
          
          // Shutdown capture service
          if (this.captureService) {
            await this.captureService.shutdown();
          }
          
          // Set state to idle
          this.setState(ScreenRecordingState.IDLE);
          this.initialized = false;
          
          this.logger.info('Screen recording manager shut down successfully');
        } catch (error) {
          this.logger.error(`Failed to shut down screen recording manager: ${error.message}`);
          throw error;
        }
      }, {
        owner: 'shutdown'
      });
    }, {
      operationName: 'ScreenRecordingManager.shutdown',
      logger: this.logger,
      timeout: 30000 // 30 seconds
    });
  }
  
  /**
   * Updates the configuration.
   * @param {Object} config - New configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(config = {}) {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          throw new Error('Screen recording manager not initialized');
        }
        
        this.logger.info('Updating configuration');
        
        try {
          // Update local configuration
          this.config = { ...this.config, ...config };
          
          // Update capture service configuration
          if (this.captureService) {
            await this.captureService.updateConfiguration(this.config);
          }
          
          // Update analysis engine configuration if provided
          if (this.analysisEngine && config.analysisConfig) {
            await this.analysisEngine.updateConfiguration(config.analysisConfig);
          }
          
          // Save configuration if config manager is available
          if (this.configManager) {
            await this.configManager.setConfig('screenRecording', this.config);
          }
          
          this.logger.info('Configuration updated successfully');
          
          return { ...this.config };
        } catch (error) {
          this.logger.error(`Failed to update configuration: ${error.message}`);
          throw error;
        }
      }, {
        owner: 'updateConfiguration'
      });
    }, {
      operationName: 'ScreenRecordingManager.updateConfiguration',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Sets the state and emits state change event.
   * @param {string} newState - New state
   * @private
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    this.logger.debug(`State changed: ${oldState} -> ${newState}`);
    
    this.emit(ScreenRecordingEvent.STATE_CHANGED, {
      oldState,
      newState
    });
  }
  
  /**
   * Starts a new recording.
   * @param {Object} options - Recording options
   * @returns {Promise<Object>} Recording info
   */
  async startRecording(options = {}) {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          throw new Error('Screen recording manager not initialized');
        }
        
        if (this.state !== ScreenRecordingState.READY) {
          throw new Error(`Cannot start recording in state: ${this.state}`);
        }
        
        if (this.activeRecording) {
          throw new Error('Recording already in progress');
        }
        
        this.logger.info('Starting recording');
        
        try {
          // Set state to recording
          this.setState(ScreenRecordingState.RECORDING);
          
          // Prepare recording options
          const recordingOptions = {
            type: options.type || 'fullScreen',
            frameRate: options.frameRate || this.config.frameRate,
            resolution: options.resolution || this.config.resolution,
            compressionLevel: options.compressionLevel || this.config.compressionLevel,
            captureAudio: options.captureAudio !== undefined ? options.captureAudio : this.config.captureAudio,
            outputDir: options.outputDir || this.config.outputDir,
            analyzeInRealTime: options.analyzeInRealTime !== undefined ? options.analyzeInRealTime : false
          };
          
          // Create recording info
          const recordingId = `recording-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const recordingInfo = {
            id: recordingId,
            startTime: Date.now(),
            options: recordingOptions,
            frames: [],
            totalFrames: 0,
            totalPauseDuration: 0,
            pauseStartTime: null,
            isActive: true,
            captureSessionId: null,
            outputPath: path.join(recordingOptions.outputDir, recordingId)
          };
          
          // Create output directory
          await fs.mkdir(recordingInfo.outputPath, { recursive: true });
          
          // Start capture service
          recordingInfo.captureSessionId = await this.captureService.startCapture({
            type: recordingOptions.type,
            frameRate: recordingOptions.frameRate,
            resolution: recordingOptions.resolution,
            compressionLevel: recordingOptions.compressionLevel,
            captureAudio: recordingOptions.captureAudio,
            outputPath: recordingInfo.outputPath
          });
          
          // Store active recording
          this.activeRecording = recordingInfo;
          
          this.logger.info(`Recording started: ${recordingId}`);
          
          // Emit event
          this.emit(ScreenRecordingEvent.RECORDING_STARTED, { ...recordingInfo });
          
          return { ...recordingInfo };
        } catch (error) {
          // Restore state on error
          this.setState(ScreenRecordingState.READY);
          
          this.logger.error(`Failed to start recording: ${error.message}`);
          
          // Emit error event
          this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
            error,
            context: 'startRecording'
          });
          
          throw error;
        }
      }, {
        owner: 'startRecording'
      });
    }, {
      operationName: 'ScreenRecordingManager.startRecording',
      logger: this.logger,
      timeout: 30000 // 30 seconds
    });
  }
  
  /**
   * Stops the current recording.
   * @returns {Promise<Object>} Recording info
   */
  async stopRecording() {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          throw new Error('Screen recording manager not initialized');
        }
        
        if (this.state !== ScreenRecordingState.RECORDING && this.state !== ScreenRecordingState.PAUSED) {
          throw new Error(`Cannot stop recording in state: ${this.state}`);
        }
        
        if (!this.activeRecording) {
          throw new Error('No active recording to stop');
        }
        
        this.logger.info(`Stopping recording: ${this.activeRecording.id}`);
        
        try {
          // If paused, calculate final pause duration
          if (this.state === ScreenRecordingState.PAUSED && this.activeRecording.pauseStartTime) {
            const pauseDuration = Date.now() - this.activeRecording.pauseStartTime;
            this.activeRecording.totalPauseDuration += pauseDuration;
            this.activeRecording.pauseStartTime = null;
          }
          
          // Store a reference to the completed recording
          const completedRecording = { ...this.activeRecording };
          completedRecording.isActive = false;
          completedRecording.endTime = Date.now();
          completedRecording.duration = completedRecording.endTime - completedRecording.startTime - completedRecording.totalPauseDuration;
          
          // Stop capture service
          const captureInfo = await this.captureService.stopCapture(completedRecording.captureSessionId);
          
          // Update recording info with capture info
          completedRecording.totalFrames = captureInfo.frameCount;
          completedRecording.actualDuration = captureInfo.duration;
          
          // Clear active recording BEFORE state change to prevent race conditions
          this.activeRecording = null;
          
          // Set state to ready
          this.setState(ScreenRecordingState.READY);
          
          this.logger.info(`Recording stopped: ${completedRecording.id}`);
          
          // Save recording metadata
          await this.saveRecordingMetadata(completedRecording);
          
          // Emit event
          this.emit(ScreenRecordingEvent.RECORDING_STOPPED, { ...completedRecording });
          
          // Process for learning if configured (fire and forget)
          if (this.config.processForLearning) {
            this.processRecordingForLearning(completedRecording.id).catch(error => {
              this.logger.error(`Failed to process recording for learning: ${error.message}`);
            });
          }
          
          return { ...completedRecording };
        } catch (error) {
          this.logger.error(`Failed to stop recording: ${error.message}`);
          
          // Emit error event
          this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
            error,
            context: 'stopRecording'
          });
          
          throw error;
        }
      }, {
        owner: 'stopRecording'
      });
    }, {
      operationName: 'ScreenRecordingManager.stopRecording',
      logger: this.logger,
      timeout: 30000 // 30 seconds
    });
  }
  
  /**
   * Pauses the current recording.
   * @returns {Promise<Object>} Recording info
   */
  async pauseRecording() {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          throw new Error('Screen recording manager not initialized');
        }
        
        if (this.state !== ScreenRecordingState.RECORDING) {
          throw new Error(`Cannot pause recording in state: ${this.state}`);
        }
        
        if (!this.activeRecording) {
          throw new Error('No active recording to pause');
        }
        
        this.logger.info(`Pausing recording: ${this.activeRecording.id}`);
        
        try {
          // Pause capture service
          await this.captureService.pauseCapture(this.activeRecording.captureSessionId);
          
          // Update recording info
          this.activeRecording.pauseStartTime = Date.now();
          
          // Set state to paused
          this.setState(ScreenRecordingState.PAUSED);
          
          this.logger.info(`Recording paused: ${this.activeRecording.id}`);
          
          // Emit event
          this.emit(ScreenRecordingEvent.RECORDING_PAUSED, { ...this.activeRecording });
          
          return { ...this.activeRecording };
        } catch (error) {
          this.logger.error(`Failed to pause recording: ${error.message}`);
          
          // Emit error event
          this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
            error,
            context: 'pauseRecording'
          });
          
          throw error;
        }
      }, {
        owner: 'pauseRecording'
      });
    }, {
      operationName: 'ScreenRecordingManager.pauseRecording',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Resumes the current recording.
   * @returns {Promise<Object>} Recording info
   */
  async resumeRecording() {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          throw new Error('Screen recording manager not initialized');
        }
        
        if (this.state !== ScreenRecordingState.PAUSED) {
          throw new Error(`Cannot resume recording in state: ${this.state}`);
        }
        
        if (!this.activeRecording) {
          throw new Error('No active recording to resume');
        }
        
        this.logger.info(`Resuming recording: ${this.activeRecording.id}`);
        
        try {
          // Resume capture service
          await this.captureService.resumeCapture(this.activeRecording.captureSessionId);
          
          // Calculate pause duration and update total
          if (this.activeRecording.pauseStartTime) {
            const pauseDuration = Date.now() - this.activeRecording.pauseStartTime;
            this.activeRecording.totalPauseDuration += pauseDuration;
            this.activeRecording.pauseStartTime = null;
          }
          
          // Set state to recording
          this.setState(ScreenRecordingState.RECORDING);
          
          this.logger.info(`Recording resumed: ${this.activeRecording.id}`);
          
          // Emit event
          this.emit(ScreenRecordingEvent.RECORDING_RESUMED, { ...this.activeRecording });
          
          return { ...this.activeRecording };
        } catch (error) {
          this.logger.error(`Failed to resume recording: ${error.message}`);
          
          // Emit error event
          this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
            error,
            context: 'resumeRecording'
          });
          
          throw error;
        }
      }, {
        owner: 'resumeRecording'
      });
    }, {
      operationName: 'ScreenRecordingManager.resumeRecording',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Captures a single frame.
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} Frame info
   */
  async captureSingleFrame(options = {}) {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Validate state
      if (!this.initialized) {
        throw new Error('Screen recording manager not initialized');
      }
      
      this.logger.debug('Capturing single frame');
      
      try {
        // Capture frame
        const frame = await this.captureService.captureSingleFrame({
          type: options.type || 'fullScreen',
          format: options.format || 'png'
        });
        
        // Analyze frame if requested
        if (options.analyze && this.analysisEngine) {
          this.logger.debug('Analyzing captured frame');
          frame.analysis = await this.analysisEngine.analyzeFrame(frame);
        }
        
        this.logger.debug(`Frame captured: ${frame.id}`);
        
        // Emit event
        this.emit(ScreenRecordingEvent.FRAME_CAPTURED, { frame });
        
        return frame;
      } catch (error) {
        this.logger.error(`Failed to capture frame: ${error.message}`);
        
        // Emit error event
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'captureSingleFrame'
        });
        
        throw error;
      }
    }, {
      operationName: 'ScreenRecordingManager.captureSingleFrame',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Analyzes a recording.
   * @param {string} recordingId - Recording ID
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeRecording(recordingId) {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Use enhanced async lock with automatic release
      return this.operationLock.withLock(async () => {
        // Validate state
        if (!this.initialized) {
          throw new Error('Screen recording manager not initialized');
        }
        
        if (this.state === ScreenRecordingState.RECORDING || this.state === ScreenRecordingState.PAUSED) {
          throw new Error(`Cannot analyze recording in state: ${this.state}`);
        }
        
        if (!this.analysisEngine) {
          throw new Error('Analysis engine not available');
        }
        
        this.logger.info(`Analyzing recording: ${recordingId}`);
        
        try {
          // Set state to analyzing
          this.setState(ScreenRecordingState.ANALYZING);
          
          // Get recording info
          const recordingInfo = await this.getRecordingInfo(recordingId);
          
          // Emit event
          this.emit(ScreenRecordingEvent.ANALYSIS_STARTED, { recordingId });
          
          // Analyze recording
          const analysisResults = await this.analysisEngine.analyzeSequence({
            recordingId,
            recordingPath: recordingInfo.outputPath,
            options: recordingInfo.options
          });
          
          // Save analysis results
          await this.saveAnalysisResults(recordingId, analysisResults);
          
          // Update recording metadata with analysis ID
          await this.updateRecordingMetadata(recordingId, {
            analysisId: analysisResults.id
          });
          
          // Set state to ready
          this.setState(ScreenRecordingState.READY);
          
          this.logger.info(`Recording analyzed: ${recordingId}`);
          
          // Emit event
          this.emit(ScreenRecordingEvent.ANALYSIS_COMPLETED, {
            recordingId,
            analysisId: analysisResults.id
          });
          
          return analysisResults;
        } catch (error) {
          // Restore state on error
          this.setState(ScreenRecordingState.READY);
          
          this.logger.error(`Failed to analyze recording: ${error.message}`);
          
          // Emit error event
          this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
            error,
            context: 'analyzeRecording'
          });
          
          throw error;
        }
      }, {
        owner: 'analyzeRecording'
      });
    }, {
      operationName: 'ScreenRecordingManager.analyzeRecording',
      logger: this.logger,
      timeout: 300000 // 5 minutes
    });
  }
  
  /**
   * Gets recording information.
   * @param {string} recordingId - Recording ID
   * @returns {Promise<Object>} Recording info
   */
  async getRecordingInfo(recordingId) {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Validate state
      if (!this.initialized) {
        throw new Error('Screen recording manager not initialized');
      }
      
      this.logger.debug(`Getting recording info: ${recordingId}`);
      
      try {
        // Check if it's the active recording
        if (this.activeRecording && this.activeRecording.id === recordingId) {
          return { ...this.activeRecording };
        }
        
        // Load recording metadata
        const recordingInfo = await this.loadRecordingMetadata(recordingId);
        
        return recordingInfo;
      } catch (error) {
        this.logger.error(`Failed to get recording info: ${error.message}`);
        throw error;
      }
    }, {
      operationName: 'ScreenRecordingManager.getRecordingInfo',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Gets analysis results.
   * @param {string} recordingId - Recording ID
   * @returns {Promise<Object>} Analysis results
   */
  async getAnalysisResults(recordingId) {
    // Use enhanced async operation with timeout
    return EnhancedAsyncOperation.execute(async (token) => {
      // Validate state
      if (!this.initialized) {
        throw new Error('Screen recording manager not initialized');
      }
      
      this.logger.debug(`Getting analysis results for recording: ${recordingId}`);
      
      try {
        // Get recording info
        const recordingInfo = await this.getRecordingInfo(recordingId);
        
        if (!recordingInfo.analysisId) {
          throw new Error(`Recording ${recordingId} has not been analyzed`);
        }
        
        // Load analysis results
        const analysisResults = await this.loadAnalysisResults(recordingId);
        
        return analysisResults;
      } catch (error) {
        this.logger.error(`Failed to get analysis results: ${error.message}`);
        throw error;
      }
    }, {
      operationName: 'ScreenRecordingManager.getAnalysisResults',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Saves recording metadata.
   * @param {Object} recordingInfo - Recording info
   * @returns {Promise<void>}
   * @private
   */
  async saveRecordingMetadata(recordingInfo) {
    const metadataPath = path.join(recordingInfo.outputPath, 'metadata.json');
    
    // Create a clean copy without circular references
    const metadata = { ...recordingInfo };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }
  
  /**
   * Loads recording metadata.
   * @param {string} recordingId - Recording ID
   * @returns {Promise<Object>} Recording info
   * @private
   */
  async loadRecordingMetadata(recordingId) {
    const recordingPath = path.join(this.config.outputDir, recordingId);
    const metadataPath = path.join(recordingPath, 'metadata.json');
    
    const metadataJson = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(metadataJson);
  }
  
  /**
   * Updates recording metadata.
   * @param {string} recordingId - Recording ID
   * @param {Object} updates - Metadata updates
   * @returns {Promise<Object>} Updated recording info
   * @private
   */
  async updateRecordingMetadata(recordingId, updates) {
    const recordingInfo = await this.loadRecordingMetadata(recordingId);
    const updatedInfo = { ...recordingInfo, ...updates };
    
    await this.saveRecordingMetadata(updatedInfo);
    
    return updatedInfo;
  }
  
  /**
   * Saves analysis results.
   * @param {string} recordingId - Recording ID
   * @param {Object} analysisResults - Analysis results
   * @returns {Promise<void>}
   * @private
   */
  async saveAnalysisResults(recordingId, analysisResults) {
    const recordingPath = path.join(this.config.outputDir, recordingId);
    const analysisPath = path.join(recordingPath, 'analysis.json');
    
    await fs.writeFile(analysisPath, JSON.stringify(analysisResults, null, 2));
  }
  
  /**
   * Loads analysis results.
   * @param {string} recordingId - Recording ID
   * @returns {Promise<Object>} Analysis results
   * @private
   */
  async loadAnalysisResults(recordingId) {
    const recordingPath = path.join(this.config.outputDir, recordingId);
    const analysisPath = path.join(recordingPath, 'analysis.json');
    
    const analysisJson = await fs.readFile(analysisPath, 'utf8');
    return JSON.parse(analysisJson);
  }
  
  /**
   * Processes a recording for learning.
   * @param {string} recordingId - Recording ID
   * @returns {Promise<void>}
   * @private
   */
  async processRecordingForLearning(recordingId) {
    try {
      // Get recording info
      const recordingInfo = await this.getRecordingInfo(recordingId);
      
      // Analyze if not already analyzed
      let analysisResults;
      if (!recordingInfo.analysisId) {
        analysisResults = await this.analyzeRecording(recordingId);
      } else {
        analysisResults = await this.getAnalysisResults(recordingId);
      }
      
      // Integrate with Learning from Demonstration module if available
      if (global.aideon && global.aideon.lfd) {
        await global.aideon.lfd.processRecording({
          recordingId,
          recordingInfo,
          analysisResults
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process recording for learning: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EnhancedScreenRecordingManager;
