/**
 * @fileoverview ScreenRecordingManager orchestrates screen recording and analysis.
 * Refactored version with robust async handling, cancellation, and proper locking.
 * 
 * @author Aideon AI Team
 * @version 2.0.0
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const { AsyncLock, CancellationToken, AsyncOperation } = require('./utils');
const { ScreenRecordingState, ScreenRecordingEvent } = require('./constants');

/**
 * Manager for screen recording and analysis operations.
 * Provides a robust implementation with proper async handling and cancellation support.
 */
class ScreenRecordingManager extends EventEmitter {
  /**
   * Creates a new ScreenRecordingManager instance.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    // Core components
    this.logger = options.logger || console;
    this.config = this._initializeConfig(options.config || {});
    this.captureService = null;
    this.analysisEngine = null;
    
    // Integration components
    this.knowledgeGraphIntegration = null;
    this.learningFromDemonstrationIntegration = null;
    this.voiceRecognitionIntegration = null;
    
    // State management
    this.state = ScreenRecordingState.IDLE;
    this.platform = null;
    this.initialized = false;
    this.activeRecording = null;
    
    // Robust locking mechanism
    this.operationLock = new AsyncLock({
      logger: this.logger,
      name: 'ScreenRecordingManager-OperationLock',
      defaultTimeout: 30000 // 30 seconds default timeout
    });
    
    // Active cancellation tokens
    this.activeTokens = new Map();
    
    // Bind methods to preserve context
    this._handleFrameCaptured = this._handleFrameCaptured.bind(this);
  }
  
  /**
   * Initializes the manager and its components.
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    // Use operation lock to prevent concurrent initialization
    return this.operationLock.withLock(async () => {
      if (this.initialized) {
        this.logger.warn('ScreenRecordingManager already initialized');
        return;
      }
      
      try {
        this.logger.info('Initializing ScreenRecordingManager...');
        this.setState(ScreenRecordingState.INITIALIZING);
        
        // Detect platform
        this.platform = this._detectPlatform();
        this.logger.info(`Detected platform: ${this.platform}`);
        
        // Initialize capture service
        const CaptureService = this._getPlatformCaptureService();
        this.captureService = new CaptureService({
          logger: this.logger,
          config: this.config.capture
        });
        await this.captureService.initialize();
        
        // Initialize analysis engine
        const { AnalysisEngine } = require('./analysis/AnalysisEngine');
        this.analysisEngine = new AnalysisEngine({
          logger: this.logger,
          config: this.config.analysis
        });
        await this.analysisEngine.initialize();
        
        // Initialize integrations if enabled
        if (this.config.enableKnowledgeGraphIntegration) {
          const { KnowledgeGraphIntegration } = require('./integration/KnowledgeGraphIntegration');
          this.knowledgeGraphIntegration = new KnowledgeGraphIntegration({
            logger: this.logger,
            config: this.config.knowledgeGraph
          });
          await this.knowledgeGraphIntegration.initialize();
        }
        
        if (this.config.enableLearningFromDemonstrationIntegration) {
          const { LearningFromDemonstrationIntegration } = require('./integration/LearningFromDemonstrationIntegration');
          this.learningFromDemonstrationIntegration = new LearningFromDemonstrationIntegration({
            logger: this.logger,
            config: this.config.learningFromDemonstration
          });
          await this.learningFromDemonstrationIntegration.initialize();
        }
        
        if (this.config.enableVoiceRecognitionIntegration) {
          const { VoiceRecognitionIntegration } = require('./integration/VoiceRecognitionIntegration');
          this.voiceRecognitionIntegration = new VoiceRecognitionIntegration({
            logger: this.logger,
            config: this.config.voiceRecognition
          });
          await this.voiceRecognitionIntegration.initialize();
        }
        
        // Create output directory if it doesn't exist
        await this._ensureOutputDirectory();
        
        this.initialized = true;
        this.setState(ScreenRecordingState.READY);
        this.logger.info('ScreenRecordingManager initialized successfully');
      } catch (error) {
        this.setState(ScreenRecordingState.ERROR);
        this.logger.error(`Failed to initialize ScreenRecordingManager: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'initialize'
        });
        throw error;
      }
    }, {
      owner: 'initialize',
      timeout: 60000 // 60 seconds timeout for initialization
    });
  }
  
  /**
   * Updates the configuration.
   * @param {Object} config - New configuration
   * @returns {Promise<void>}
   */
  async updateConfig(config = {}) {
    return this.operationLock.withLock(async () => {
      if (!this.initialized) {
        throw new Error('ScreenRecordingManager not initialized');
      }
      
      try {
        this.logger.info('Updating ScreenRecordingManager configuration...');
        
        // Merge new config with existing config
        this.config = this._mergeConfig(this.config, config);
        
        // Update component configurations
        if (this.captureService) {
          await this.captureService.updateConfig(this.config.capture);
        }
        
        if (this.analysisEngine) {
          await this.analysisEngine.updateConfig(this.config.analysis);
        }
        
        // Update integration configurations
        if (this.knowledgeGraphIntegration) {
          await this.knowledgeGraphIntegration.updateConfig(this.config.knowledgeGraph);
        }
        
        if (this.learningFromDemonstrationIntegration) {
          await this.learningFromDemonstrationIntegration.updateConfig(this.config.learningFromDemonstration);
        }
        
        if (this.voiceRecognitionIntegration) {
          await this.voiceRecognitionIntegration.updateConfig(this.config.voiceRecognition);
        }
        
        this.logger.info('ScreenRecordingManager configuration updated successfully');
      } catch (error) {
        this.logger.error(`Failed to update ScreenRecordingManager configuration: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'updateConfig'
        });
        throw error;
      }
    }, {
      owner: 'updateConfig'
    });
  }
  
  /**
   * Captures a single frame from the screen.
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} Captured frame
   */
  async captureFrame(options = {}) {
    if (!this.initialized) {
      throw new Error('ScreenRecordingManager not initialized');
    }
    
    try {
      this.logger.debug('Capturing single frame...');
      
      // Create cancellation token with timeout
      const token = CancellationToken.withTimeout(options.timeout || 10000, {
        name: 'CaptureFrame',
        logger: this.logger
      });
      
      // Execute with timeout and cancellation support
      const frame = await AsyncOperation.execute(
        async (token) => {
          // Capture frame
          const frameData = await this.captureService.captureFrame(options);
          
          // Analyze frame if requested
          if (options.analyze) {
            frameData.analysis = await this.analysisEngine.analyzeFrame(frameData);
          }
          
          return frameData;
        },
        {
          token,
          operationName: 'CaptureFrame',
          logger: this.logger
        }
      );
      
      this.logger.debug('Frame captured successfully');
      return frame;
    } catch (error) {
      this.logger.error(`Failed to capture frame: ${error.message}`);
      this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
        error,
        context: 'captureFrame'
      });
      throw error;
    }
  }
  
  /**
   * Starts a new recording session.
   * @param {Object} options - Recording options
   * @returns {Promise<Object>} Recording information
   */
  async startRecording(options = {}) {
    // Use operation lock to prevent concurrent recording operations
    return this.operationLock.withLock(async () => {
      if (!this.initialized) {
        throw new Error('ScreenRecordingManager not initialized');
      }
      
      // Verify manager state
      if (this.state !== ScreenRecordingState.READY) {
        throw new Error(`Cannot start recording in current state: ${this.state}`);
      }
      
      // Verify no active recording
      if (this.activeRecording) {
        throw new Error('Recording already in progress');
      }
      
      try {
        this.logger.info('Starting recording...');
        this.setState(ScreenRecordingState.RECORDING);
        
        // Create recording ID and output directory
        const recordingId = `recording-${Date.now()}-${this._generateShortId()}`;
        const outputDir = options.outputDir || path.join(this.config.outputDir, recordingId);
        
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        // Create cancellation token for the recording session
        const recordingToken = new CancellationToken({
          name: `Recording-${recordingId}`,
          logger: this.logger
        });
        
        // Store token for later cancellation if needed
        this.activeTokens.set(recordingId, recordingToken);
        
        // Start capture service with cancellation support
        const captureSessionId = await AsyncOperation.execute(
          async (token) => {
            return await this.captureService.startCapture({
              ...options,
              outputDir
            });
          },
          {
            token: recordingToken,
            operationName: `StartCapture-${recordingId}`,
            logger: this.logger,
            timeout: 30000 // 30 seconds timeout
          }
        );
        
        // Create recording object
        this.activeRecording = {
          id: recordingId,
          captureSessionId,
          startTime: Date.now(),
          outputDir,
          options,
          frames: [],
          isActive: true,
          status: 'recording',
          token: recordingToken
        };
        
        // Register frame capture handler
        this.captureService.on('frameCaptured', this._handleFrameCaptured);
        
        // Set up automatic stop if duration specified
        if (options.duration) {
          this.logger.debug(`Setting up automatic stop after ${options.duration}ms`);
          this.activeRecording.stopTimer = setTimeout(() => {
            this.logger.debug(`Automatic stop triggered after ${options.duration}ms`);
            this.stopRecording().catch(error => {
              this.logger.error(`Failed to automatically stop recording: ${error.message}`);
            });
          }, options.duration);
        }
        
        // Create recording info object for return
        const recordingInfo = {
          id: recordingId,
          startTime: this.activeRecording.startTime,
          outputDir,
          options
        };
        
        this.logger.info(`Recording started: ${recordingId}`);
        this.emit(ScreenRecordingEvent.RECORDING_STARTED, recordingInfo);
        
        return recordingInfo;
      } catch (error) {
        this.setState(ScreenRecordingState.ERROR);
        this.logger.error(`Failed to start recording: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'startRecording'
        });
        throw error;
      }
    }, {
      owner: 'startRecording',
      timeout: 30000 // 30 seconds timeout
    });
  }
  
  /**
   * Stops the current recording.
   * @returns {Promise<Object>} Recording information
   */
  async stopRecording() {
    // Use operation lock to prevent concurrent recording operations
    return this.operationLock.withLock(async () => {
      if (!this.initialized) {
        throw new Error('ScreenRecordingManager not initialized');
      }
      
      // Log the current state for debugging
      this.logger.debug(`stopRecording called. Current state: ${this.state}, activeRecording: ${this.activeRecording ? this.activeRecording.id : 'none'}`);
      
      // Create a local reference to the active recording before any state changes
      // This prevents race conditions where activeRecording might change during execution
      const recordingRef = this.activeRecording;
      
      // Early validation
      if (!recordingRef) {
        this.logger.error('stopRecording called but no active recording exists');
        throw new Error('No active recording to stop');
      }
      
      // Verify recording is still active
      if (!recordingRef.isActive) {
        this.logger.error('Recording is no longer active (may have been stopped already)');
        throw new Error('Recording is no longer active (may have been stopped already)');
      }
      
      // Verify manager state
      if (this.state !== ScreenRecordingState.RECORDING && this.state !== ScreenRecordingState.PAUSED) {
        this.logger.error(`Manager not in recording or paused state (current state: ${this.state})`);
        throw new Error(`Manager not in recording or paused state (current state: ${this.state})`);
      }
      
      try {
        this.logger.info(`Stopping recording: ${recordingRef.id}`);
        
        // Mark recording as inactive immediately to prevent concurrent stop attempts
        recordingRef.isActive = false;
        
        // Stop automatic stop timer if it exists
        if (recordingRef.stopTimer) {
          clearTimeout(recordingRef.stopTimer);
          delete recordingRef.stopTimer;
        }
        
        // Get cancellation token for this recording
        const recordingToken = this.activeTokens.get(recordingRef.id);
        
        // Stop capture service with timeout protection
        let captureSessionInfo = null;
        try {
          captureSessionInfo = await AsyncOperation.execute(
            async (token) => {
              return await this.captureService.stopCapture();
            },
            {
              token: recordingToken,
              operationName: `StopCapture-${recordingRef.id}`,
              logger: this.logger,
              timeout: 10000 // 10 seconds timeout
            }
          );
          
          this.logger.debug(`Capture service stopped successfully for recording: ${recordingRef.id}`);
        } catch (captureError) {
          this.logger.warn(`Error stopping capture service: ${captureError.message}`);
          // Continue with cleanup even if capture service fails
        }
        
        // Remove frame capture handler
        this.captureService.removeListener('frameCaptured', this._handleFrameCaptured);
        
        // Update recording information
        recordingRef.endTime = Date.now();
        recordingRef.duration = recordingRef.endTime - recordingRef.startTime;
        if (recordingRef.totalPauseDuration) {
          recordingRef.duration -= recordingRef.totalPauseDuration;
        }
        recordingRef.status = 'completed';
        
        // Update with capture session info if available
        if (captureSessionInfo) {
          recordingRef.frameCount = captureSessionInfo.frameCount;
          recordingRef.captureInfo = captureSessionInfo;
        }
        
        // Save recording metadata with timeout protection
        try {
          const metadataPath = path.join(recordingRef.outputDir, 'metadata.json');
          
          await AsyncOperation.execute(
            async (token) => {
              await fs.writeFile(metadataPath, JSON.stringify(recordingRef, null, 2));
            },
            {
              token: recordingToken,
              operationName: `SaveMetadata-${recordingRef.id}`,
              logger: this.logger,
              timeout: 5000 // 5 seconds timeout
            }
          );
          
          this.logger.debug(`Metadata saved for recording: ${recordingRef.id}`);
        } catch (fsError) {
          this.logger.warn(`Error saving recording metadata: ${fsError.message}`);
          // Continue even if metadata save fails
        }
        
        // Create recording info object for return
        const recordingInfo = {
          id: recordingRef.id,
          startTime: recordingRef.startTime,
          endTime: recordingRef.endTime,
          duration: recordingRef.duration,
          frameCount: recordingRef.frameCount || 0,
          outputDir: recordingRef.outputDir,
          options: recordingRef.options
        };
        
        // Integrate with learning from demonstration if enabled - with fire and forget pattern
        if (this.config.enableLearningFromDemonstrationIntegration && this.learningFromDemonstrationIntegration) {
          try {
            // Don't wait for this to complete - just fire and continue
            this.logger.debug(`Starting learning from demonstration integration for recording: ${recordingInfo.id}`);
            Promise.resolve().then(() => {
              this.learningFromDemonstrationIntegration.processRecording(recordingInfo).catch(error => {
                this.logger.error(`Failed to process recording for learning: ${error.message}`);
              });
            });
          } catch (integrationError) {
            this.logger.warn(`Error integrating with learning from demonstration: ${integrationError.message}`);
            // Continue even if integration fails
          }
        }
        
        // Emit event before changing state
        this.emit(ScreenRecordingEvent.RECORDING_STOPPED, recordingInfo);
        
        this.logger.info(`Recording stopped: ${recordingRef.id}`);
        
        // Set state to ready
        this.setState(ScreenRecordingState.READY);
        
        // Reset active recording reference
        this.activeRecording = null;
        
        // Remove token from active tokens
        this.activeTokens.delete(recordingRef.id);
        
        return recordingInfo;
      } catch (error) {
        this.setState(ScreenRecordingState.ERROR);
        this.logger.error(`Failed to stop recording: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'stopRecording'
        });
        throw error;
      }
    }, {
      owner: 'stopRecording',
      timeout: 30000 // 30 seconds timeout
    });
  }
  
  /**
   * Pauses the current recording.
   * @returns {Promise<boolean>} True if successful
   */
  async pauseRecording() {
    return this.operationLock.withLock(async () => {
      if (!this.initialized) {
        throw new Error('ScreenRecordingManager not initialized');
      }
      
      if (!this.activeRecording) {
        throw new Error('No active recording to pause');
      }
      
      if (this.state !== ScreenRecordingState.RECORDING) {
        throw new Error(`Cannot pause recording in current state: ${this.state}`);
      }
      
      try {
        this.logger.info(`Pausing recording: ${this.activeRecording.id}`);
        
        // Get cancellation token for this recording
        const recordingToken = this.activeTokens.get(this.activeRecording.id);
        
        // Pause capture service
        await AsyncOperation.execute(
          async (token) => {
            return await this.captureService.pauseCapture();
          },
          {
            token: recordingToken,
            operationName: `PauseCapture-${this.activeRecording.id}`,
            logger: this.logger,
            timeout: 5000 // 5 seconds timeout
          }
        );
        
        // Update recording state
        this.activeRecording.pauseStartTime = Date.now();
        this.activeRecording.status = 'paused';
        
        // Set state to paused
        this.setState(ScreenRecordingState.PAUSED);
        
        this.logger.info(`Recording paused: ${this.activeRecording.id}`);
        this.emit(ScreenRecordingEvent.RECORDING_PAUSED, {
          id: this.activeRecording.id,
          pauseStartTime: this.activeRecording.pauseStartTime
        });
        
        return true;
      } catch (error) {
        this.logger.error(`Failed to pause recording: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'pauseRecording'
        });
        throw error;
      }
    }, {
      owner: 'pauseRecording'
    });
  }
  
  /**
   * Resumes a paused recording.
   * @returns {Promise<boolean>} True if successful
   */
  async resumeRecording() {
    return this.operationLock.withLock(async () => {
      if (!this.initialized) {
        throw new Error('ScreenRecordingManager not initialized');
      }
      
      if (!this.activeRecording) {
        throw new Error('No active recording to resume');
      }
      
      if (this.state !== ScreenRecordingState.PAUSED) {
        throw new Error(`Cannot resume recording in current state: ${this.state}`);
      }
      
      try {
        this.logger.info(`Resuming recording: ${this.activeRecording.id}`);
        
        // Get cancellation token for this recording
        const recordingToken = this.activeTokens.get(this.activeRecording.id);
        
        // Resume capture service
        await AsyncOperation.execute(
          async (token) => {
            return await this.captureService.resumeCapture();
          },
          {
            token: recordingToken,
            operationName: `ResumeCapture-${this.activeRecording.id}`,
            logger: this.logger,
            timeout: 5000 // 5 seconds timeout
          }
        );
        
        // Update recording state
        const pauseDuration = Date.now() - this.activeRecording.pauseStartTime;
        this.activeRecording.totalPauseDuration = (this.activeRecording.totalPauseDuration || 0) + pauseDuration;
        delete this.activeRecording.pauseStartTime;
        this.activeRecording.status = 'recording';
        
        // Set state to recording
        this.setState(ScreenRecordingState.RECORDING);
        
        this.logger.info(`Recording resumed: ${this.activeRecording.id}`);
        this.emit(ScreenRecordingEvent.RECORDING_RESUMED, {
          id: this.activeRecording.id,
          pauseDuration
        });
        
        return true;
      } catch (error) {
        this.logger.error(`Failed to resume recording: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'resumeRecording'
        });
        throw error;
      }
    }, {
      owner: 'resumeRecording'
    });
  }
  
  /**
   * Analyzes a recording.
   * @param {string} recordingId - ID of the recording to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeRecording(recordingId, options = {}) {
    if (!this.initialized) {
      throw new Error('ScreenRecordingManager not initialized');
    }
    
    try {
      this.logger.info(`Analyzing recording: ${recordingId}`);
      this.setState(ScreenRecordingState.ANALYZING);
      
      // Create cancellation token with timeout
      const token = CancellationToken.withTimeout(options.timeout || 60000, {
        name: `AnalyzeRecording-${recordingId}`,
        logger: this.logger
      });
      
      // Store token for later cancellation if needed
      this.activeTokens.set(`analysis-${recordingId}`, token);
      
      // Execute with timeout and cancellation support
      const results = await AsyncOperation.execute(
        async (token) => {
          // Load recording metadata
          const recordingDir = options.recordingDir || path.join(this.config.outputDir, recordingId);
          const metadataPath = path.join(recordingDir, 'metadata.json');
          
          let metadata;
          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (error) {
            throw new Error(`Failed to load recording metadata: ${error.message}`);
          }
          
          // Analyze recording
          const analysisResults = await this.analysisEngine.analyzeRecording(metadata, options);
          
          // Save analysis results
          const resultsPath = path.join(recordingDir, 'analysis.json');
          await fs.writeFile(resultsPath, JSON.stringify(analysisResults, null, 2));
          
          return {
            recordingId,
            analysisId: `analysis-${Date.now()}-${this._generateShortId()}`,
            timestamp: Date.now(),
            results: analysisResults
          };
        },
        {
          token,
          operationName: `AnalyzeRecording-${recordingId}`,
          logger: this.logger
        }
      );
      
      // Remove token from active tokens
      this.activeTokens.delete(`analysis-${recordingId}`);
      
      this.setState(ScreenRecordingState.READY);
      this.logger.info(`Recording analyzed: ${recordingId}`);
      this.emit(ScreenRecordingEvent.RECORDING_ANALYZED, results);
      
      return results;
    } catch (error) {
      this.setState(ScreenRecordingState.ERROR);
      this.logger.error(`Failed to analyze recording: ${error.message}`);
      this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
        error,
        context: 'analyzeRecording'
      });
      throw error;
    }
  }
  
  /**
   * Cancels the current operation.
   * @param {string} operationId - ID of the operation to cancel
   * @returns {Promise<boolean>} True if successful
   */
  async cancelOperation(operationId) {
    try {
      this.logger.info(`Cancelling operation: ${operationId}`);
      
      // Find token for operation
      let token;
      
      if (operationId === 'current-recording' && this.activeRecording) {
        // Cancel active recording
        token = this.activeTokens.get(this.activeRecording.id);
      } else if (operationId.startsWith('analysis-')) {
        // Cancel analysis
        token = this.activeTokens.get(operationId);
      } else {
        // Try to find token by ID
        token = this.activeTokens.get(operationId);
      }
      
      if (!token) {
        this.logger.warn(`No active operation found with ID: ${operationId}`);
        return false;
      }
      
      // Cancel operation
      token.cancel(`Cancelled by user: ${operationId}`);
      
      this.logger.info(`Operation cancelled: ${operationId}`);
      this.emit(ScreenRecordingEvent.OPERATION_CANCELLED, {
        operationId
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel operation: ${error.message}`);
      this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
        error,
        context: 'cancelOperation'
      });
      return false;
    }
  }
  
  /**
   * Shuts down the manager and releases resources.
   * @returns {Promise<void>}
   */
  async shutdown() {
    return this.operationLock.withLock(async () => {
      if (!this.initialized) {
        this.logger.warn('ScreenRecordingManager not initialized, nothing to shut down');
        return;
      }
      
      try {
        this.logger.info('Shutting down ScreenRecordingManager...');
        
        // Cancel all active operations
        for (const [operationId, token] of this.activeTokens.entries()) {
          this.logger.debug(`Cancelling operation: ${operationId}`);
          token.cancel('Manager shutting down');
        }
        
        // Clear active tokens
        this.activeTokens.clear();
        
        // Stop active recording if exists
        if (this.activeRecording && this.activeRecording.isActive) {
          try {
            await this.stopRecording();
          } catch (error) {
            this.logger.warn(`Error stopping active recording during shutdown: ${error.message}`);
          }
        }
        
        // Shut down components
        if (this.captureService) {
          await this.captureService.shutdown();
        }
        
        if (this.analysisEngine) {
          await this.analysisEngine.shutdown();
        }
        
        // Shut down integrations
        if (this.knowledgeGraphIntegration) {
          await this.knowledgeGraphIntegration.shutdown();
        }
        
        if (this.learningFromDemonstrationIntegration) {
          await this.learningFromDemonstrationIntegration.shutdown();
        }
        
        if (this.voiceRecognitionIntegration) {
          await this.voiceRecognitionIntegration.shutdown();
        }
        
        // Reset state
        this.initialized = false;
        this.setState(ScreenRecordingState.IDLE);
        
        this.logger.info('ScreenRecordingManager shut down successfully');
      } catch (error) {
        this.logger.error(`Failed to shut down ScreenRecordingManager: ${error.message}`);
        this.emit(ScreenRecordingEvent.ERROR_OCCURRED, {
          error,
          context: 'shutdown'
        });
        throw error;
      }
    }, {
      owner: 'shutdown',
      timeout: 30000 // 30 seconds timeout
    });
  }
  
  /**
   * Sets the manager state and emits state change event.
   * @param {string} newState - New state
   * @private
   */
  setState(newState) {
    if (this.state === newState) {
      return;
    }
    
    const oldState = this.state;
    this.state = newState;
    
    this.logger.debug(`State changed: ${oldState} -> ${newState}`);
    this.emit(ScreenRecordingEvent.STATE_CHANGED, {
      oldState,
      newState
    });
  }
  
  /**
   * Handles frame captured event from capture service.
   * @param {Object} frame - Captured frame
   * @private
   */
  _handleFrameCaptured(frame) {
    if (!this.activeRecording) {
      return;
    }
    
    // Add frame to recording
    this.activeRecording.frames.push({
      timestamp: frame.timestamp,
      index: frame.index
    });
    
    // Emit frame captured event
    this.emit(ScreenRecordingEvent.FRAME_CAPTURED, {
      recordingId: this.activeRecording.id,
      frame
    });
    
    // Analyze frame in real-time if enabled
    if (this.activeRecording.options.analyzeInRealTime) {
      this._analyzeFrameInRealTime(frame).catch(error => {
        this.logger.error(`Failed to analyze frame in real-time: ${error.message}`);
      });
    }
  }
  
  /**
   * Analyzes a frame in real-time.
   * @param {Object} frame - Frame to analyze
   * @returns {Promise<void>}
   * @private
   */
  async _analyzeFrameInRealTime(frame) {
    try {
      // Skip if no active recording or analysis engine
      if (!this.activeRecording || !this.analysisEngine) {
        return;
      }
      
      // Analyze frame
      const analysis = await this.analysisEngine.analyzeFrame(frame);
      
      // Emit analysis event
      this.emit(ScreenRecordingEvent.FRAME_ANALYZED, {
        recordingId: this.activeRecording.id,
        frameIndex: frame.index,
        analysis
      });
      
      // Integrate with knowledge graph if enabled
      if (this.config.enableKnowledgeGraphIntegration && this.knowledgeGraphIntegration) {
        this.knowledgeGraphIntegration.processFrameAnalysis(this.activeRecording.id, frame, analysis).catch(error => {
          this.logger.error(`Failed to integrate frame analysis with knowledge graph: ${error.message}`);
        });
      }
    } catch (error) {
      this.logger.error(`Failed to analyze frame in real-time: ${error.message}`);
    }
  }
  
  /**
   * Initializes the configuration with defaults.
   * @param {Object} config - User-provided configuration
   * @returns {Object} Complete configuration with defaults
   * @private
   */
  _initializeConfig(config) {
    return {
      // Core configuration
      outputDir: config.outputDir || path.join(os.tmpdir(), 'aideon-screen-recordings'),
      debugMode: config.debugMode || false,
      
      // Capture configuration
      capture: {
        frameRate: config.frameRate || 10,
        quality: config.quality || 'medium',
        ...config.capture
      },
      
      // Analysis configuration
      analysis: {
        elementRecognition: config.elementRecognition !== false,
        contentUnderstanding: config.contentUnderstanding !== false,
        activityTracking: config.activityTracking !== false,
        ...config.analysis
      },
      
      // Integration configuration
      enableKnowledgeGraphIntegration: config.enableKnowledgeGraphIntegration || false,
      enableLearningFromDemonstrationIntegration: config.enableLearningFromDemonstrationIntegration || false,
      enableVoiceRecognitionIntegration: config.enableVoiceRecognitionIntegration || false,
      
      knowledgeGraph: config.knowledgeGraph || {},
      learningFromDemonstration: config.learningFromDemonstration || {},
      voiceRecognition: config.voiceRecognition || {}
    };
  }
  
  /**
   * Merges new configuration with existing configuration.
   * @param {Object} currentConfig - Current configuration
   * @param {Object} newConfig - New configuration
   * @returns {Object} Merged configuration
   * @private
   */
  _mergeConfig(currentConfig, newConfig) {
    // Deep merge configuration
    return {
      ...currentConfig,
      ...newConfig,
      capture: {
        ...currentConfig.capture,
        ...newConfig.capture
      },
      analysis: {
        ...currentConfig.analysis,
        ...newConfig.analysis
      },
      knowledgeGraph: {
        ...currentConfig.knowledgeGraph,
        ...newConfig.knowledgeGraph
      },
      learningFromDemonstration: {
        ...currentConfig.learningFromDemonstration,
        ...newConfig.learningFromDemonstration
      },
      voiceRecognition: {
        ...currentConfig.voiceRecognition,
        ...newConfig.voiceRecognition
      }
    };
  }
  
  /**
   * Detects the current platform.
   * @returns {string} Platform name
   * @private
   */
  _detectPlatform() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return 'windows';
    } else if (platform === 'darwin') {
      return 'macos';
    } else if (platform === 'linux') {
      return 'linux';
    } else {
      return 'unknown';
    }
  }
  
  /**
   * Gets the platform-specific capture service.
   * @returns {Class} Capture service class
   * @private
   */
  _getPlatformCaptureService() {
    const platform = this.platform || this._detectPlatform();
    
    if (platform === 'windows') {
      return require('./platform/WindowsCaptureService');
    } else if (platform === 'macos') {
      return require('./platform/MacOSCaptureService');
    } else if (platform === 'linux') {
      return require('./platform/LinuxCaptureService');
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  /**
   * Ensures the output directory exists.
   * @returns {Promise<void>}
   * @private
   */
  async _ensureOutputDirectory() {
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create output directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generates a short ID for recordings.
   * @returns {string} Short ID
   * @private
   */
  _generateShortId() {
    return Math.random().toString(36).substring(2, 12);
  }
}

module.exports = ScreenRecordingManager;
