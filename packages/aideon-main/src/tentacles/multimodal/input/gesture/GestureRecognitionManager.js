/**
 * @fileoverview GestureRecognitionManager is the central coordinator for the gesture recognition
 * system in the Aideon AI Desktop Agent. It integrates camera input, gesture detection,
 * and interpretation to provide a complete gesture recognition pipeline.
 * 
 * This manager handles the initialization and coordination of all gesture recognition
 * components, manages their lifecycle, and provides a unified API for gesture recognition.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const path = require('path');
const { EnhancedAsyncLock } = require('../utils/EnhancedAsyncLock');
const { CameraInputService } = require('./CameraInputService');
const { MediaPipeProvider } = require('./providers/MediaPipeProvider');
const { GestureInterpretationService } = require('./GestureInterpretationService');

/**
 * @typedef {Object} GestureRecognitionConfig
 * @property {Object} camera - Camera configuration
 * @property {Object} detection - Gesture detection configuration
 * @property {Object} interpretation - Gesture interpretation configuration
 * @property {boolean} enablePoseDetection - Whether to enable pose detection
 * @property {boolean} enableDebugMode - Whether to enable debug mode
 */

/**
 * GestureRecognitionManager coordinates the gesture recognition pipeline.
 */
class GestureRecognitionManager extends EventEmitter {
  /**
   * Creates a new GestureRecognitionManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {GestureRecognitionConfig} options.config - Recognition configuration
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.resourceManager - Resource manager for allocation
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      camera: options.camera || {},
      detection: options.detection || {},
      interpretation: options.interpretation || {},
      enablePoseDetection: options.enablePoseDetection !== undefined ? options.enablePoseDetection : false,
      enableDebugMode: options.enableDebugMode !== undefined ? options.enableDebugMode : false,
      ...(options.config || {})
    };
    
    this.logger = options.logger || console;
    this.resourceManager = options.resourceManager;
    
    // Initialize state
    this.isInitialized = false;
    this.isRecognizing = false;
    this.currentSession = null;
    this.lastRecognitionResult = null;
    this.debugData = {
      frameCount: 0,
      detectionCount: 0,
      interpretationCount: 0,
      errors: []
    };
    
    // Create component instances
    this.cameraService = new CameraInputService({
      ...this.config.camera,
      logger: this.logger,
      resourceManager: this.resourceManager
    });
    
    this.detectionProvider = new MediaPipeProvider({
      ...this.config.detection,
      enablePoseDetection: this.config.enablePoseDetection,
      logger: this.logger,
      resourceManager: this.resourceManager
    });
    
    this.interpretationService = new GestureInterpretationService({
      ...this.config.interpretation,
      logger: this.logger
    });
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    this.recognitionLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.startRecognition = this.startRecognition.bind(this);
    this.stopRecognition = this.stopRecognition.bind(this);
    this.handleFrame = this.handleFrame.bind(this);
    this.handleGesturesDetected = this.handleGesturesDetected.bind(this);
    this.handleError = this.handleError.bind(this);
  }
  
  /**
   * Initializes the GestureRecognitionManager and its components.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('GestureRecognitionManager already initialized');
          return true;
        }
        
        this.logger.info('Initializing GestureRecognitionManager');
        
        // Initialize camera service
        const cameraInitialized = await this.cameraService.initialize();
        if (!cameraInitialized) {
          throw new Error('Failed to initialize CameraInputService');
        }
        
        // Initialize detection provider
        const detectionInitialized = await this.detectionProvider.initialize();
        if (!detectionInitialized) {
          throw new Error('Failed to initialize MediaPipeProvider');
        }
        
        // Initialize interpretation service
        const interpretationInitialized = await this.interpretationService.initialize();
        if (!interpretationInitialized) {
          throw new Error('Failed to initialize GestureInterpretationService');
        }
        
        // Set up event listeners
        this.cameraService.on('frame', this.handleFrame);
        this.cameraService.on('error', this.handleError);
        
        this.detectionProvider.on('gesturesDetected', this.handleGesturesDetected);
        this.detectionProvider.on('error', this.handleError);
        
        this.interpretationService.on('analysisCompleted', result => {
          this.emit('analysisCompleted', result);
        });
        this.interpretationService.on('error', this.handleError);
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('GestureRecognitionManager initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize GestureRecognitionManager', error);
        this.emit('error', error);
        
        // Attempt to clean up any partially initialized components
        await this.shutdown();
        return false;
      }
    });
  }
  
  /**
   * Shuts down the GestureRecognitionManager and its components.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('GestureRecognitionManager not initialized');
          return true;
        }
        
        this.logger.info('Shutting down GestureRecognitionManager');
        
        // Stop recognition if running
        if (this.isRecognizing) {
          await this.stopRecognition();
        }
        
        // Remove event listeners
        this.cameraService.removeListener('frame', this.handleFrame);
        this.cameraService.removeListener('error', this.handleError);
        
        this.detectionProvider.removeListener('gesturesDetected', this.handleGesturesDetected);
        this.detectionProvider.removeListener('error', this.handleError);
        
        // Shut down components in reverse order
        await this.interpretationService.shutdown();
        await this.detectionProvider.shutdown();
        await this.cameraService.shutdown();
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('GestureRecognitionManager shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down GestureRecognitionManager', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Starts gesture recognition.
   * 
   * @param {Object} options - Recognition options
   * @returns {Promise<string>} - Session ID for the recognition
   */
  async startRecognition(options = {}) {
    return await this.recognitionLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('GestureRecognitionManager not initialized');
        }
        
        if (this.isRecognizing) {
          this.logger.info('Gesture recognition already in progress');
          return this.currentSession.id;
        }
        
        this.logger.info('Starting gesture recognition');
        
        // Create a new session
        this.currentSession = {
          id: options.sessionId || `gesture-session-${Date.now()}`,
          startTime: Date.now(),
          options
        };
        
        // Reset debug data
        if (this.config.enableDebugMode) {
          this.debugData = {
            frameCount: 0,
            detectionCount: 0,
            interpretationCount: 0,
            errors: []
          };
        }
        
        // Start camera capture
        const cameraSessionId = await this.cameraService.startCapture({
          sessionId: `camera-${this.currentSession.id}`
        });
        
        this.currentSession.cameraSessionId = cameraSessionId;
        this.isRecognizing = true;
        
        this.emit('recognitionStarted', {
          sessionId: this.currentSession.id,
          timestamp: Date.now()
        });
        
        this.logger.info(`Gesture recognition started with session ID: ${this.currentSession.id}`);
        return this.currentSession.id;
      } catch (error) {
        this.logger.error('Failed to start gesture recognition', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Stops gesture recognition.
   * 
   * @returns {Promise<Object>} - Session summary
   */
  async stopRecognition() {
    return await this.recognitionLock.acquire(async () => {
      try {
        if (!this.isRecognizing || !this.currentSession) {
          this.logger.info('No active gesture recognition to stop');
          return null;
        }
        
        this.logger.info(`Stopping gesture recognition for session: ${this.currentSession.id}`);
        
        // Stop camera capture
        const cameraSummary = await this.cameraService.stopCapture();
        
        // Create session summary
        const sessionSummary = {
          id: this.currentSession.id,
          duration: Date.now() - this.currentSession.startTime,
          cameraSummary,
          lastResult: this.lastRecognitionResult,
          debugData: this.config.enableDebugMode ? this.debugData : undefined
        };
        
        this.isRecognizing = false;
        this.emit('recognitionStopped', sessionSummary);
        
        this.logger.info(`Gesture recognition stopped for session: ${sessionSummary.id}`);
        
        // Clear current session
        this.currentSession = null;
        
        return sessionSummary;
      } catch (error) {
        this.logger.error('Failed to stop gesture recognition', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Handles a new frame from the camera service.
   * 
   * @private
   * @param {Object} frameData - Frame data from camera
   */
  async handleFrame(frameData) {
    try {
      if (!this.isRecognizing) {
        return;
      }
      
      // Update debug data
      if (this.config.enableDebugMode) {
        this.debugData.frameCount++;
      }
      
      // Process frame for gesture detection
      await this.detectionProvider.detectGestures({
        frame: frameData.frame,
        timestamp: frameData.timestamp
      });
    } catch (error) {
      this.handleError(error);
    }
  }
  
  /**
   * Handles gestures detected by the detection provider.
   * 
   * @private
   * @param {Object} detectionResult - Detection result
   */
  async handleGesturesDetected(detectionResult) {
    try {
      if (!this.isRecognizing) {
        return;
      }
      
      // Update debug data
      if (this.config.enableDebugMode) {
        this.debugData.detectionCount++;
      }
      
      // Process detected gestures
      const gestures = detectionResult.gestures;
      if (gestures && gestures.length > 0) {
        // Process gestures through interpretation service
        const processResult = await this.interpretationService.processGestures(
          gestures,
          detectionResult.timestamp
        );
        
        // Update debug data
        if (this.config.enableDebugMode && processResult.analysisResult) {
          this.debugData.interpretationCount++;
        }
        
        // Store last result if analysis was performed
        if (processResult.analysisResult) {
          this.lastRecognitionResult = processResult.analysisResult;
          
          // Emit recognition result
          this.emit('recognitionResult', {
            sessionId: this.currentSession.id,
            timestamp: detectionResult.timestamp,
            ...processResult.analysisResult
          });
        }
      }
      
      // Emit raw detection result
      this.emit('gesturesDetected', {
        sessionId: this.currentSession.id,
        timestamp: detectionResult.timestamp,
        ...detectionResult
      });
    } catch (error) {
      this.handleError(error);
    }
  }
  
  /**
   * Handles errors from any component.
   * 
   * @private
   * @param {Error} error - Error object
   */
  handleError(error) {
    this.logger.error('Error in GestureRecognitionManager', error);
    
    // Update debug data
    if (this.config.enableDebugMode) {
      this.debugData.errors.push({
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack
      });
      
      // Limit error history
      if (this.debugData.errors.length > 50) {
        this.debugData.errors = this.debugData.errors.slice(-50);
      }
    }
    
    this.emit('error', error);
  }
  
  /**
   * Gets the current recognition status.
   * 
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRecognizing: this.isRecognizing,
      currentSession: this.currentSession ? {
        id: this.currentSession.id,
        startTime: this.currentSession.startTime,
        duration: Date.now() - this.currentSession.startTime
      } : null,
      lastResult: this.lastRecognitionResult,
      debugData: this.config.enableDebugMode ? this.debugData : undefined
    };
  }
  
  /**
   * Gets statistics about the gesture recognition.
   * 
   * @returns {Object} - Statistics
   */
  getStatistics() {
    if (!this.isInitialized) {
      return { error: 'GestureRecognitionManager not initialized' };
    }
    
    return {
      interpretationStats: this.interpretationService.getStatistics(),
      debugData: this.config.enableDebugMode ? this.debugData : undefined
    };
  }
  
  /**
   * Sets the configuration for the gesture recognition.
   * 
   * @param {Object} config - New configuration
   * @returns {boolean} - True if successful
   */
  setConfig(config) {
    try {
      // Update camera configuration
      if (config.camera) {
        if (config.camera.privacyConfig) {
          this.cameraService.setPrivacyConfig(config.camera.privacyConfig);
        }
      }
      
      // Update detection configuration
      // (Most detection config requires reinitialization)
      
      // Update interpretation configuration
      if (config.interpretation) {
        // Update weights if provided
        if (config.interpretation.gestureWeights) {
          this.interpretationService.config.gestureWeights = {
            ...this.interpretationService.config.gestureWeights,
            ...config.interpretation.gestureWeights
          };
        }
        
        // Update thresholds if provided
        if (config.interpretation.minSequenceConfidence !== undefined) {
          this.interpretationService.config.minSequenceConfidence = config.interpretation.minSequenceConfidence;
        }
        
        if (config.interpretation.dominantGestureThreshold !== undefined) {
          this.interpretationService.config.dominantGestureThreshold = config.interpretation.dominantGestureThreshold;
        }
      }
      
      // Update debug mode
      if (config.enableDebugMode !== undefined) {
        this.config.enableDebugMode = config.enableDebugMode;
      }
      
      this.logger.info('Updated gesture recognition configuration');
      return true;
    } catch (error) {
      this.logger.error('Failed to update configuration', error);
      this.emit('error', error);
      return false;
    }
  }
}

// Add module.exports at the end of the file
module.exports = { GestureRecognitionManager };
