/**
 * @fileoverview Enhanced Screen Recording Manager with automatic trigger support.
 * 
 * This implementation extends the EnhancedScreenRecordingManager to support
 * automatic activation from trigger events, with robust state management
 * and integration with the TriggerManager.
 * 
 * @author Aideon AI Team
 * @version 1.2.0
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

// Import trigger system
const { TriggerManager, TriggerManagerEvent } = require('./trigger/TriggerManager');

/**
 * Enhanced Screen Recording Manager with automatic trigger support.
 * @extends EventEmitter
 */
class EnhancedScreenRecordingManager extends EventEmitter {
  /**
   * Creates a new EnhancedScreenRecordingManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configManager - Configuration manager
   * @param {Object} options.analysisEngine - Analysis engine instance
   * @param {Object} options.errorMonitor - Error monitoring service
   * @param {Object} options.learningManager - Learning from Demonstration manager
   * @param {Object} options.voiceInputManager - Voice input manager
   * @param {Object} options.naturalLanguageProcessor - Natural language processor
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
    this.automaticRecordings = new Map(); // Map of triggerId -> recordingInfo
    
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
      debugMode: false,
      automaticRecording: {
        enabled: true,
        requireUserReview: true,
        maxDuration: 300, // 5 minutes
        showIndicator: true,
        enabledTriggers: ['learning', 'voice', 'error']
      }
    };
    
    // Platform-specific capture service
    this.captureService = null;
    
    // Initialize trigger manager if automatic recording is enabled
    if (this.config.automaticRecording.enabled) {
      this.triggerManager = new TriggerManager({
        logger: this.logger,
        screenRecordingManager: this,
        configManager: this.configManager,
        config: {
          enabledTriggers: this.config.automaticRecording.enabledTriggers,
          requireUserReview: this.config.automaticRecording.requireUserReview,
          maxAutomaticDuration: this.config.automaticRecording.maxDuration
        }
      });
    }
    
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
    this.startAutomaticRecording = this.startAutomaticRecording.bind(this);
    this.stopAutomaticRecording = this.stopAutomaticRecording.bind(this);
    this.handleTriggerEvent = this.handleTriggerEvent.bind(this);
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
          
          // Initialize trigger manager if automatic recording is enabled
          if (this.config.automaticRecording.enabled && this.triggerManager) {
            await this.triggerManager.initialize();
            
            // Register trigger event handlers
            this.triggerManager.on(TriggerManagerEvent.TRIGGER_ACTIVATED, this.handleTriggerEvent);
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
          
          // Stop all automatic recordings
          for (const [triggerId, recordingInfo] of this.automaticRecordings.entries()) {
            try {
              await this.stopAutomaticRecording(triggerId);
            } catch (error) {
              this.logger.warn(`Failed to stop automatic recording during shutdown: ${error.message}`);
            }
          }
          
          // Shutdown trigger manager if initialized
          if (this.triggerManager && this.triggerManager.initialized) {
            await this.triggerManager.shutdown();
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
          const oldConfig = { ...this.config };
          this.config = { ...this.config, ...config };
          
          // Update capture service configuration
          if (this.captureService) {
            await this.captureService.updateConfiguration(this.config);
          }
          
          // Update analysis engine configuration if provided
          if (this.analysisEngine && config.analysisConfig) {
            await this.analysisEngine.updateConfiguration(config.analysisConfig);
          }
          
          // Update trigger manager configuration if automatic recording config changed
          if (this.triggerManager && config.automaticRecording) {
            await this.triggerManager.updateConfiguration({
              enabledTriggers: this.config.automaticRecording.enabledTriggers,
              requireUserReview: this.config.automaticRecording.requireUserReview,
              maxAutomaticDuration: this.config.automaticRecording.maxDuration
            });
          }
          
          // Handle automatic recording enable/disable
          if (config.automaticRecording && 
              oldConfig.automaticRecording.enabled !== this.config.automaticRecording.enabled) {
            if (this.config.automaticRecording.enabled) {
              // Initialize trigger manager if not already initialized
              if (!this.triggerManager) {
                this.triggerManager = new TriggerManager({
                  logger: this.logger,
                  screenRecordingManager: this,
                  configManager: this.configManager,
                  config: {
                    enabledTriggers: this.config.automaticRecording.enabledTriggers,
                    requireUserReview: this.config.automaticRecording.requireUserReview,
                    maxAutomaticDuration: this.config.automaticRecording.maxDuration
                  }
                });
                
                await this.triggerManager.initialize();
                
                // Register trigger event handlers
                this.triggerManager.on(TriggerManagerEvent.TRIGGER_ACTIVATED, this.handleTriggerEvent);
              }
            } else {
              // Shutdown trigger manager if initialized
              if (this.triggerManager && this.triggerManager.initialized) {
                await this.triggerManager.shutdown();
              }
            }
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
            analyzeInRealTime: options.analyzeInRealTime !== undefined ? options.analyzeInRealTime : false,
            triggerMetadata: options.triggerMetadata || null
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
            outputPath: path.join(recordingOptions.outputDir, recordingId),
            isAutomaticRecording: !!recordingOptions.triggerMetadata,
            triggerMetadata: recordingOptions.triggerMetadata || null
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
          
          // If this is an automatic recording, store in automatic recordings map
          if (recordingInfo.isAutomaticRecording && recordingInfo.triggerMetadata) {
            this.automaticRecordings.set(recordingInfo.triggerMetadata.triggerId, recordingInfo);
          }
          
          this.logger.info(`Recording started: ${recordingId}`);
          
          // Show recording indicator if automatic and indicator enabled
          if (recordingInfo.isAutomaticRecording && this.config.automaticRecording.showIndicator) {
            this.showRecordingIndicator(recordingInfo);
          }
          
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
          
          // If this is an automatic recording, remove from automatic recordings map
          if (completedRecording.isAutomaticRecording && completedRecording.triggerMetadata) {
            this.automaticRecordings.delete(completedRecording.triggerMetadata.triggerId);
          }
          
          // Clear active recording BEFORE state change to prevent race conditions
          this.activeRecording = null;
          
          // Set state to ready
          this.setState(ScreenRecordingState.READY);
          
          this.logger.info(`Recording stopped: ${completedRecording.id}`);
          
          // Hide recording indicator if automatic and indicator was shown
          if (completedRecording.isAutomaticRecording && this.config.automaticRecording.showIndicator) {
            this.hideRecordingIndicator(completedRecording);
          }
          
          // Save recording metadata
          await this.saveRecordingMetadata(completedRecording);
          
          // Handle automatic recording review if required
          if (completedRecording.isAutomaticRecording && 
              this.config.automaticRecording.requireUserReview) {
            this.requestUserReview(completedRecording);
          }
          
          // Emit event
          this.emit(ScreenRecordingEvent.RECORDING_STOPPED, { ...completedRecording });
          
          // Process for learning if configured
          if (completedRecording.isAutomaticRecording && 
              completedRecording.triggerMetadata && 
              completedRecording.triggerMetadata.triggerType === 'learning') {
            this.processForLearning(completedRecording);
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
   * Starts an automatic recording based on a trigger event.
   * @param {Object} triggerEvent - Trigger event
   * @returns {Promise<Object>} Recording info
   */
  async startAutomaticRecording(triggerEvent) {
    if (!this.initialized) {
      throw new Error('Screen recording manager not initialized');
    }
    
    if (!this.config.automaticRecording.enabled) {
      throw new Error('Automatic recording is disabled');
    }
    
    if (!triggerEvent || !triggerEvent.triggerId) {
      throw new Error('Invalid trigger event');
    }
    
    this.logger.info(`Starting automatic recording for trigger: ${triggerEvent.triggerId}`);
    
    // Check if trigger type is enabled
    if (!this.config.automaticRecording.enabledTriggers.includes(triggerEvent.triggerType)) {
      throw new Error(`Trigger type ${triggerEvent.triggerType} is not enabled for automatic recording`);
    }
    
    // Check if already recording for this trigger
    if (this.automaticRecordings.has(triggerEvent.triggerId)) {
      throw new Error(`Already recording for trigger ${triggerEvent.triggerId}`);
    }
    
    // Prepare recording options with trigger metadata
    const recordingOptions = {
      type: 'fullScreen',
      frameRate: 30,
      resolution: '1080p',
      compressionLevel: 'medium',
      captureAudio: false,
      analyzeInRealTime: true,
      triggerMetadata: {
        triggerId: triggerEvent.triggerId,
        triggerType: triggerEvent.triggerType,
        triggerContext: triggerEvent.context,
        isAutomaticRecording: true,
        userReviewed: false,
        suggestedDuration: triggerEvent.suggestedDuration || this.config.automaticRecording.maxDuration
      }
    };
    
    // Start recording
    const recordingInfo = await this.startRecording(recordingOptions);
    
    // Set timeout for maximum duration
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
  
  /**
   * Stops an automatic recording.
   * @param {string} triggerId - Trigger ID
   * @returns {Promise<Object>} Recording info
   */
  async stopAutomaticRecording(triggerId) {
    if (!this.initialized) {
      throw new Error('Screen recording manager not initialized');
    }
    
    if (!triggerId) {
      throw new Error('Trigger ID is required');
    }
    
    this.logger.info(`Stopping automatic recording for trigger: ${triggerId}`);
    
    // Check if recording for this trigger
    if (!this.automaticRecordings.has(triggerId)) {
      throw new Error(`No active recording for trigger ${triggerId}`);
    }
    
    // Get recording info
    const recordingInfo = this.automaticRecordings.get(triggerId);
    
    // Check if this is the active recording
    if (this.activeRecording && this.activeRecording.id === recordingInfo.id) {
      // Stop the active recording
      return this.stopRecording();
    } else {
      // Recording is not active (should not happen, but handle gracefully)
      this.logger.warn(`Recording for trigger ${triggerId} is not the active recording`);
      this.automaticRecordings.delete(triggerId);
      return recordingInfo;
    }
  }
  
  /**
   * Handles trigger event from trigger manager.
   * @param {Object} event - Trigger event
   * @private
   */
  async handleTriggerEvent(event) {
    try {
      this.logger.debug(`Received trigger event: ${JSON.stringify(event)}`);
      
      // Skip if automatic recording is disabled
      if (!this.config.automaticRecording.enabled) {
        this.logger.info('Automatic recording is disabled, ignoring trigger');
        return;
      }
      
      // Check if deactivation event
      if (event.deactivate) {
        // Stop recording for this trigger
        if (this.automaticRecordings.has(event.triggerId)) {
          await this.stopAutomaticRecording(event.triggerId);
        }
        return;
      }
      
      // Start automatic recording
      await this.startAutomaticRecording(event);
    } catch (error) {
      this.logger.error(`Failed to handle trigger event: ${error.message}`);
    }
  }
  
  /**
   * Shows recording indicator for automatic recording.
   * @param {Object} recordingInfo - Recording info
   * @private
   */
  showRecordingIndicator(recordingInfo) {
    // In a real implementation, this would show a visual indicator
    // that automatic recording is in progress
    this.logger.info(`Showing recording indicator for ${recordingInfo.id}`);
    
    // Emit indicator event
    this.emit(ScreenRecordingEvent.INDICATOR_SHOWN, {
      recordingId: recordingInfo.id,
      triggerType: recordingInfo.triggerMetadata ? recordingInfo.triggerMetadata.triggerType : 'unknown'
    });
  }
  
  /**
   * Hides recording indicator for automatic recording.
   * @param {Object} recordingInfo - Recording info
   * @private
   */
  hideRecordingIndicator(recordingInfo) {
    // In a real implementation, this would hide the visual indicator
    this.logger.info(`Hiding recording indicator for ${recordingInfo.id}`);
    
    // Emit indicator event
    this.emit(ScreenRecordingEvent.INDICATOR_HIDDEN, {
      recordingId: recordingInfo.id,
      triggerType: recordingInfo.triggerMetadata ? recordingInfo.triggerMetadata.triggerType : 'unknown'
    });
  }
  
  /**
   * Requests user review for automatic recording.
   * @param {Object} recordingInfo - Recording info
   * @private
   */
  requestUserReview(recordingInfo) {
    // In a real implementation, this would prompt the user to review
    // the automatic recording before saving or discarding
    this.logger.info(`Requesting user review for ${recordingInfo.id}`);
    
    // Emit review event
    this.emit(ScreenRecordingEvent.REVIEW_REQUESTED, {
      recordingId: recordingInfo.id,
      triggerType: recordingInfo.triggerMetadata ? recordingInfo.triggerMetadata.triggerType : 'unknown',
      outputPath: recordingInfo.outputPath
    });
  }
  
  /**
   * Processes recording for learning.
   * @param {Object} recordingInfo - Recording info
   * @private
   */
  async processForLearning(recordingInfo) {
    // In a real implementation, this would process the recording
    // for learning from demonstration
    this.logger.info(`Processing recording ${recordingInfo.id} for learning`);
    
    // Emit learning event
    this.emit(ScreenRecordingEvent.LEARNING_PROCESSED, {
      recordingId: recordingInfo.id,
      outputPath: recordingInfo.outputPath,
      triggerMetadata: recordingInfo.triggerMetadata
    });
  }
  
  /**
   * Saves recording metadata to disk.
   * @param {Object} recordingInfo - Recording info
   * @returns {Promise<void>}
   * @private
   */
  async saveRecordingMetadata(recordingInfo) {
    const metadataPath = path.join(recordingInfo.outputPath, 'metadata.json');
    
    // Create metadata object
    const metadata = {
      id: recordingInfo.id,
      startTime: recordingInfo.startTime,
      endTime: recordingInfo.endTime,
      duration: recordingInfo.duration,
      actualDuration: recordingInfo.actualDuration,
      totalFrames: recordingInfo.totalFrames,
      totalPauseDuration: recordingInfo.totalPauseDuration,
      options: recordingInfo.options,
      isAutomaticRecording: recordingInfo.isAutomaticRecording,
      triggerMetadata: recordingInfo.triggerMetadata
    };
    
    // Write metadata to file
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    this.logger.debug(`Saved recording metadata to ${metadataPath}`);
  }
  
  // Existing methods (pauseRecording, resumeRecording, captureSingleFrame, etc.) remain unchanged
  // Only showing new or modified methods for automatic recording support
}

// Update constants with new events
const ExtendedScreenRecordingEvent = {
  ...ScreenRecordingEvent,
  INDICATOR_SHOWN: 'indicator-shown',
  INDICATOR_HIDDEN: 'indicator-hidden',
  REVIEW_REQUESTED: 'review-requested',
  LEARNING_PROCESSED: 'learning-processed'
};

module.exports = {
  EnhancedScreenRecordingManager,
  ScreenRecordingEvent: ExtendedScreenRecordingEvent
};
