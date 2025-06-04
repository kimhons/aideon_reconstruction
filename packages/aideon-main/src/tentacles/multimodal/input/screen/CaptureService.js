/**
 * @fileoverview Abstract base class for platform-specific screen capture implementations.
 * Handles the actual capture of screen content.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

/**
 * Capture service events
 * @enum {string}
 */
const CaptureEvent = {
  INITIALIZED: 'initialized',
  CAPTURE_STARTED: 'captureStarted',
  CAPTURE_STOPPED: 'captureStopped',
  CAPTURE_PAUSED: 'capturePaused',
  CAPTURE_RESUMED: 'captureResumed',
  FRAME_CAPTURED: 'frameCaptured',
  ERROR_OCCURRED: 'errorOccurred'
};

/**
 * Capture service states
 * @enum {string}
 */
const CaptureState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  READY: 'ready',
  CAPTURING: 'capturing',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Abstract base class for platform-specific screen capture implementations.
 * Handles the actual capture of screen content.
 * 
 * @abstract
 */
class CaptureService extends EventEmitter {
  /**
   * Creates a new CaptureService instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configManager - Configuration manager
   * @param {Object} options.performanceTracker - Performance tracking service
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.configManager = options.configManager;
    this.performanceTracker = options.performanceTracker;
    
    this.initialized = false;
    this.state = CaptureState.IDLE;
    this.captureSession = null;
    this.config = {
      defaultFrameRate: 30,
      defaultResolution: 'native',
      defaultCompressionLevel: 'medium',
      frameFormat: 'png'
    };
    
    this.logger.debug(`${this.constructor.name} created`);
  }
  
  /**
   * Initializes the capture service.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.debug(`Initializing ${this.constructor.name}`);
      this.setState(CaptureState.INITIALIZING);
      
      // Load configuration
      if (this.configManager) {
        const savedConfig = await this.configManager.getConfig('captureService');
        if (savedConfig) {
          this.config = { ...this.config, ...savedConfig };
        }
      }
      
      // Platform-specific initialization
      await this._initializePlatformSpecific();
      
      this.initialized = true;
      this.setState(CaptureState.READY);
      
      this.emit(CaptureEvent.INITIALIZED);
      this.logger.info(`${this.constructor.name} initialized successfully`);
      return true;
    } catch (error) {
      this.setState(CaptureState.ERROR);
      this.logger.error(`Failed to initialize ${this.constructor.name}: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'initialization'
      });
      return false;
    }
  }
  
  /**
   * Starts capturing screen content.
   * @param {Object} options - Capture options
   * @param {string} options.type - Type of capture ('fullScreen', 'window', 'region')
   * @param {Object} options.target - Target for capture (display ID, window ID, or region coordinates)
   * @param {number} options.frameRate - Frame rate in frames per second
   * @param {string} options.resolution - Resolution ('native', '1080p', '720p', etc.)
   * @param {string} options.compressionLevel - Compression level ('none', 'low', 'medium', 'high')
   * @param {boolean} options.includeAudio - Whether to include audio
   * @param {boolean} options.includePointer - Whether to include pointer
   * @param {string} options.outputDir - Directory to save captured frames
   * @returns {Promise<string>} Capture session ID
   */
  async startCapture(options = {}) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    if (this.state === CaptureState.CAPTURING || this.state === CaptureState.PAUSED) {
      throw new Error('Capture already in progress');
    }
    
    try {
      // Prepare capture options
      const captureOptions = {
        type: options.type || 'fullScreen',
        target: options.target || null,
        frameRate: options.frameRate || this.config.defaultFrameRate,
        resolution: options.resolution || this.config.defaultResolution,
        compressionLevel: options.compressionLevel || this.config.defaultCompressionLevel,
        includeAudio: options.includeAudio !== undefined ? options.includeAudio : false,
        includePointer: options.includePointer !== undefined ? options.includePointer : true,
        outputDir: options.outputDir || null,
        timestamp: Date.now(),
        id: `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Create frame directory if output directory is specified
      if (captureOptions.outputDir) {
        const frameDir = path.join(captureOptions.outputDir, 'frames');
        await fs.mkdir(frameDir, { recursive: true });
        captureOptions.frameDir = frameDir;
      }
      
      // Create capture session
      this.captureSession = {
        ...captureOptions,
        startTime: Date.now(),
        endTime: null,
        frameCount: 0,
        pauseTime: null
      };
      
      // Start platform-specific capture
      await this._startCapturePlatformSpecific(captureOptions);
      
      this.setState(CaptureState.CAPTURING);
      
      this.emit(CaptureEvent.CAPTURE_STARTED, {
        sessionId: this.captureSession.id,
        options: captureOptions
      });
      
      this.logger.info(`Capture started: ${this.captureSession.id}`);
      return this.captureSession.id;
    } catch (error) {
      this.setState(CaptureState.ERROR);
      this.logger.error(`Failed to start capture: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'startCapture'
      });
      throw error;
    }
  }
  
  /**
   * Stops the current capture session.
   * @returns {Promise<Object>} Capture session information
   */
  async stopCapture() {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    if (this.state !== CaptureState.CAPTURING && this.state !== CaptureState.PAUSED) {
      throw new Error('No active capture to stop');
    }
    
    try {
      // Stop platform-specific capture
      await this._stopCapturePlatformSpecific();
      
      // Update session information
      this.captureSession.endTime = Date.now();
      this.captureSession.duration = this.captureSession.endTime - this.captureSession.startTime;
      
      // Create session info object
      const sessionInfo = {
        sessionId: this.captureSession.id,
        startTime: this.captureSession.startTime,
        endTime: this.captureSession.endTime,
        duration: this.captureSession.duration,
        frameCount: this.captureSession.frameCount,
        frameDir: this.captureSession.frameDir
      };
      
      this.emit(CaptureEvent.CAPTURE_STOPPED, sessionInfo);
      this.setState(CaptureState.READY);
      
      this.logger.info(`Capture stopped: ${this.captureSession.id}`);
      
      // Clear current session reference
      const completedSession = this.captureSession;
      this.captureSession = null;
      
      return sessionInfo;
    } catch (error) {
      this.setState(CaptureState.ERROR);
      this.logger.error(`Failed to stop capture: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'stopCapture'
      });
      throw error;
    }
  }
  
  /**
   * Pauses the current capture session.
   * @returns {Promise<boolean>} True if successful
   */
  async pauseCapture() {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    if (this.state !== CaptureState.CAPTURING) {
      throw new Error('No active capture to pause');
    }
    
    try {
      // Pause platform-specific capture
      await this._pauseCapturePlatformSpecific();
      
      this.captureSession.pauseTime = Date.now();
      this.setState(CaptureState.PAUSED);
      
      this.emit(CaptureEvent.CAPTURE_PAUSED, {
        sessionId: this.captureSession.id,
        pauseTime: this.captureSession.pauseTime
      });
      
      this.logger.info(`Capture paused: ${this.captureSession.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pause capture: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'pauseCapture'
      });
      throw error;
    }
  }
  
  /**
   * Resumes a paused capture session.
   * @returns {Promise<boolean>} True if successful
   */
  async resumeCapture() {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    if (this.state !== CaptureState.PAUSED) {
      throw new Error('No paused capture to resume');
    }
    
    try {
      // Resume platform-specific capture
      await this._resumeCapturePlatformSpecific();
      
      const resumeTime = Date.now();
      const pauseDuration = resumeTime - this.captureSession.pauseTime;
      
      // Add pause information to session
      if (!this.captureSession.pauses) {
        this.captureSession.pauses = [];
      }
      
      this.captureSession.pauses.push({
        startTime: this.captureSession.pauseTime,
        endTime: resumeTime,
        duration: pauseDuration
      });
      
      delete this.captureSession.pauseTime;
      this.setState(CaptureState.CAPTURING);
      
      this.emit(CaptureEvent.CAPTURE_RESUMED, {
        sessionId: this.captureSession.id,
        resumeTime: resumeTime,
        pauseDuration: pauseDuration
      });
      
      this.logger.info(`Capture resumed: ${this.captureSession.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to resume capture: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'resumeCapture'
      });
      throw error;
    }
  }
  
  /**
   * Captures a single frame without starting a capture session.
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} Frame data
   */
  async captureSingleFrame(options = {}) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    try {
      // Capture platform-specific frame
      const frameData = await this._captureSingleFramePlatformSpecific({
        type: options.type || 'fullScreen',
        target: options.target || null,
        resolution: options.resolution || this.config.defaultResolution,
        includePointer: options.includePointer !== undefined ? options.includePointer : true
      });
      
      return frameData;
    } catch (error) {
      this.logger.error(`Failed to capture single frame: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'captureSingleFrame'
      });
      throw error;
    }
  }
  
  /**
   * Gets a list of available displays/monitors.
   * @returns {Promise<Array>} Array of display information objects
   */
  async getAvailableDisplays() {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    try {
      // Get platform-specific displays
      return await this._getAvailableDisplaysPlatformSpecific();
    } catch (error) {
      this.logger.error(`Failed to get available displays: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'getAvailableDisplays'
      });
      throw error;
    }
  }
  
  /**
   * Gets a list of available application windows.
   * @returns {Promise<Array>} Array of window information objects
   */
  async getAvailableWindows() {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    try {
      // Get platform-specific windows
      return await this._getAvailableWindowsPlatformSpecific();
    } catch (error) {
      this.logger.error(`Failed to get available windows: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'getAvailableWindows'
      });
      throw error;
    }
  }
  
  /**
   * Gets the resolution of a display or window.
   * @param {Object} target - Target display or window
   * @returns {Promise<Object>} Resolution object with width and height
   */
  async getDisplayResolution(target) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    try {
      // Get platform-specific resolution
      return await this._getDisplayResolutionPlatformSpecific(target);
    } catch (error) {
      this.logger.error(`Failed to get display resolution: ${error.message}`);
      this.emit(CaptureEvent.ERROR_OCCURRED, {
        error,
        context: 'getDisplayResolution'
      });
      throw error;
    }
  }
  
  /**
   * Updates the capture service configuration.
   * @param {Object} config - New configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(config) {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
    
    // Merge new configuration with existing
    this.config = {
      ...this.config,
      ...config
    };
    
    // Save configuration if config manager is available
    if (this.configManager) {
      await this.configManager.setConfig('captureService', this.config);
    }
    
    // Update platform-specific configuration
    await this._updateConfigurationPlatformSpecific(this.config);
    
    this.logger.info(`${this.constructor.name} configuration updated`);
    return this.config;
  }
  
  /**
   * Cleans up resources and prepares for shutdown.
   * @returns {Promise<boolean>} True if successful
   */
  async shutdown() {
    if (!this.initialized) {
      return true;
    }
    
    try {
      this.logger.debug(`Shutting down ${this.constructor.name}`);
      
      // Stop any active capture
      if (this.state === CaptureState.CAPTURING || this.state === CaptureState.PAUSED) {
        await this.stopCapture();
      }
      
      // Platform-specific shutdown
      await this._shutdownPlatformSpecific();
      
      this.initialized = false;
      this.logger.info(`${this.constructor.name} shut down successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Error during shutdown: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Updates the service's state and emits state change event.
   * @param {string} newState - New state
   * @protected
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    this.emit('stateChanged', {
      oldState,
      newState,
      timestamp: Date.now()
    });
  }
  
  /**
   * Handles a captured frame.
   * @param {Object} frameData - Captured frame data
   * @protected
   */
  handleFrameCaptured(frameData) {
    if (this.captureSession) {
      this.captureSession.frameCount++;
      
      // Save frame if output directory is specified
      if (this.captureSession.frameDir) {
        this.saveFrame(frameData, this.captureSession.frameCount);
      }
      
      this.emit(CaptureEvent.FRAME_CAPTURED, {
        ...frameData,
        sessionId: this.captureSession.id,
        frameNumber: this.captureSession.frameCount
      });
    }
  }
  
  /**
   * Saves a frame to disk.
   * @param {Object} frameData - Frame data
   * @param {number} frameNumber - Frame number
   * @returns {Promise<string>} Path to saved frame
   * @protected
   */
  async saveFrame(frameData, frameNumber) {
    if (!this.captureSession || !this.captureSession.frameDir) {
      throw new Error('No active capture session with output directory');
    }
    
    const frameFilename = `frame-${String(frameNumber).padStart(6, '0')}.${this.config.frameFormat}`;
    const framePath = path.join(this.captureSession.frameDir, frameFilename);
    
    await fs.writeFile(framePath, frameData.buffer);
    
    return framePath;
  }
  
  // Abstract methods to be implemented by platform-specific subclasses
  
  /**
   * Platform-specific initialization.
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _initializePlatformSpecific() {
    throw new Error('Method _initializePlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific capture start.
   * @param {Object} options - Capture options
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _startCapturePlatformSpecific(options) {
    throw new Error('Method _startCapturePlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific capture stop.
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _stopCapturePlatformSpecific() {
    throw new Error('Method _stopCapturePlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific capture pause.
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _pauseCapturePlatformSpecific() {
    throw new Error('Method _pauseCapturePlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific capture resume.
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _resumeCapturePlatformSpecific() {
    throw new Error('Method _resumeCapturePlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific single frame capture.
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} Frame data
   * @abstract
   * @protected
   */
  async _captureSingleFramePlatformSpecific(options) {
    throw new Error('Method _captureSingleFramePlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific available displays retrieval.
   * @returns {Promise<Array>} Array of display information objects
   * @abstract
   * @protected
   */
  async _getAvailableDisplaysPlatformSpecific() {
    throw new Error('Method _getAvailableDisplaysPlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific available windows retrieval.
   * @returns {Promise<Array>} Array of window information objects
   * @abstract
   * @protected
   */
  async _getAvailableWindowsPlatformSpecific() {
    throw new Error('Method _getAvailableWindowsPlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific display resolution retrieval.
   * @param {Object} target - Target display or window
   * @returns {Promise<Object>} Resolution object with width and height
   * @abstract
   * @protected
   */
  async _getDisplayResolutionPlatformSpecific(target) {
    throw new Error('Method _getDisplayResolutionPlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific configuration update.
   * @param {Object} config - New configuration
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _updateConfigurationPlatformSpecific(config) {
    throw new Error('Method _updateConfigurationPlatformSpecific must be implemented by subclass');
  }
  
  /**
   * Platform-specific shutdown.
   * @returns {Promise<void>}
   * @abstract
   * @protected
   */
  async _shutdownPlatformSpecific() {
    throw new Error('Method _shutdownPlatformSpecific must be implemented by subclass');
  }
}

// Export constants
CaptureService.CaptureEvent = CaptureEvent;
CaptureService.CaptureState = CaptureState;

module.exports = CaptureService;
