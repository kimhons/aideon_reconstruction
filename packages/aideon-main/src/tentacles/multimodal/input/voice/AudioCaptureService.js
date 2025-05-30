/**
 * @fileoverview AudioCaptureService handles microphone input capture for the
 * Aideon AI Desktop Agent's voice recognition system. It provides a unified
 * interface for capturing audio across different platforms and configurations.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../utils/EnhancedAsyncLock');
const { EnhancedCancellationToken } = require('../utils/EnhancedCancellationToken');

/**
 * AudioCaptureService handles microphone input capture.
 */
class AudioCaptureService extends EventEmitter {
  /**
   * Creates a new AudioCaptureService instance.
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.sampleRate - Sample rate in Hz
   * @param {number} options.channels - Number of audio channels
   * @param {number} options.bitDepth - Bit depth
   * @param {boolean} options.enhanceAudio - Whether to apply audio enhancement
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.resourceManager - Resource manager for allocation
   */
  constructor(options) {
    super();
    
    this.sampleRate = options.sampleRate || 16000;
    this.channels = options.channels || 1;
    this.bitDepth = options.bitDepth || 16;
    this.enhanceAudio = options.enhanceAudio || false;
    this.logger = options.logger || console;
    this.resourceManager = options.resourceManager;
    
    // Initialize state
    this.isInitialized = false;
    this.isCapturing = false;
    this.currentSession = null;
    this.audioInput = null;
    this.audioProcessor = null;
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    this.captureLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.startCapture = this.startCapture.bind(this);
    this.stopCapture = this.stopCapture.bind(this);
    this.handleAudioData = this.handleAudioData.bind(this);
    this.handleError = this.handleError.bind(this);
  }
  
  /**
   * Initializes the AudioCaptureService.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('AudioCaptureService already initialized');
          return true;
        }
        
        this.logger.info('Initializing AudioCaptureService');
        
        // Check if resources are available
        if (this.resourceManager) {
          const hasResources = await this.resourceManager.checkResources('microphone');
          if (!hasResources) {
            throw new Error('Microphone resources not available');
          }
        }
        
        // Initialize audio input based on platform
        await this.initializeAudioInput();
        
        // Initialize audio processor if enhancement is enabled
        if (this.enhanceAudio) {
          await this.initializeAudioProcessor();
        }
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('AudioCaptureService initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize AudioCaptureService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Initializes the audio input based on platform.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeAudioInput() {
    try {
      // Determine platform
      const platform = process.platform;
      
      // Initialize appropriate audio input
      if (platform === 'win32') {
        const { WindowsAudioInput } = await import('./platform/WindowsAudioInput');
        this.audioInput = new WindowsAudioInput({
          sampleRate: this.sampleRate,
          channels: this.channels,
          bitDepth: this.bitDepth,
          logger: this.logger
        });
      } else if (platform === 'darwin') {
        const { MacOSAudioInput } = await import('./platform/MacOSAudioInput');
        this.audioInput = new MacOSAudioInput({
          sampleRate: this.sampleRate,
          channels: this.channels,
          bitDepth: this.bitDepth,
          logger: this.logger
        });
      } else if (platform === 'linux') {
        const { LinuxAudioInput } = await import('./platform/LinuxAudioInput');
        this.audioInput = new LinuxAudioInput({
          sampleRate: this.sampleRate,
          channels: this.channels,
          bitDepth: this.bitDepth,
          logger: this.logger
        });
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      // Set up event handlers
      this.audioInput.on('data', this.handleAudioData);
      this.audioInput.on('error', this.handleError);
      
      await this.audioInput.initialize();
      this.logger.info(`Initialized audio input for platform: ${platform}`);
    } catch (error) {
      this.logger.error('Failed to initialize audio input', error);
      throw error;
    }
  }
  
  /**
   * Initializes the audio processor for enhancement.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeAudioProcessor() {
    try {
      const { AudioProcessor } = await import('./AudioProcessor');
      this.audioProcessor = new AudioProcessor({
        sampleRate: this.sampleRate,
        channels: this.channels,
        logger: this.logger
      });
      
      await this.audioProcessor.initialize();
      this.logger.info('Initialized audio processor for enhancement');
    } catch (error) {
      this.logger.error('Failed to initialize audio processor', error);
      // Non-critical, continue without enhancement
      this.enhanceAudio = false;
    }
  }
  
  /**
   * Shuts down the AudioCaptureService and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('AudioCaptureService not initialized');
          return true;
        }
        
        this.logger.info('Shutting down AudioCaptureService');
        
        // Stop any active capture
        if (this.isCapturing) {
          await this.stopCapture();
        }
        
        // Shutdown audio input
        if (this.audioInput) {
          await this.audioInput.shutdown();
          this.audioInput.removeAllListeners();
          this.audioInput = null;
        }
        
        // Shutdown audio processor
        if (this.audioProcessor) {
          await this.audioProcessor.shutdown();
          this.audioProcessor = null;
        }
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('AudioCaptureService shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down AudioCaptureService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Starts capturing audio from the microphone.
   * 
   * @param {Object} options - Capture options
   * @param {string} options.sessionId - Session ID for the capture
   * @returns {Promise<boolean>} - True if capture started successfully
   */
  async startCapture(options = {}) {
    return await this.captureLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('AudioCaptureService not initialized');
        }
        
        if (this.isCapturing) {
          this.logger.info('Audio capture already in progress');
          return true;
        }
        
        this.logger.info('Starting audio capture');
        
        // Create a new session
        this.currentSession = {
          id: options.sessionId || `audio-session-${Date.now()}`,
          startTime: Date.now(),
          cancellationToken: new EnhancedCancellationToken()
        };
        
        // Start audio input
        await this.audioInput.startCapture({
          sessionId: this.currentSession.id
        });
        
        this.isCapturing = true;
        this.emit('captureStarted', { sessionId: this.currentSession.id });
        this.logger.info(`Audio capture started with session ID: ${this.currentSession.id}`);
        
        return true;
      } catch (error) {
        this.logger.error('Failed to start audio capture', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Stops capturing audio.
   * 
   * @returns {Promise<boolean>} - True if capture stopped successfully
   */
  async stopCapture() {
    return await this.captureLock.acquire(async () => {
      try {
        if (!this.isCapturing || !this.currentSession) {
          this.logger.info('No active audio capture to stop');
          return true;
        }
        
        this.logger.info(`Stopping audio capture for session: ${this.currentSession.id}`);
        
        // Stop audio input
        await this.audioInput.stopCapture();
        
        const sessionId = this.currentSession.id;
        const duration = Date.now() - this.currentSession.startTime;
        
        this.isCapturing = false;
        this.currentSession = null;
        
        this.emit('captureStopped', { sessionId, duration });
        this.logger.info(`Audio capture stopped for session: ${sessionId}`);
        
        return true;
      } catch (error) {
        this.logger.error('Failed to stop audio capture', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Handles audio data from the input device.
   * 
   * @private
   * @param {Object} data - Audio data
   */
  async handleAudioData(data) {
    if (!this.isCapturing || !this.currentSession) {
      return;
    }
    
    try {
      let audioChunk = data.chunk;
      
      // Apply audio enhancement if enabled
      if (this.enhanceAudio && this.audioProcessor) {
        audioChunk = await this.audioProcessor.processChunk(audioChunk);
      }
      
      // Emit data event
      this.emit('data', {
        sessionId: this.currentSession.id,
        chunk: audioChunk,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error('Error processing audio data', error);
    }
  }
  
  /**
   * Handles errors from components.
   * 
   * @private
   * @param {Error} error - Error object
   */
  handleError(error) {
    this.logger.error('AudioCaptureService error', error);
    this.emit('error', error);
  }
}

module.exports = { AudioCaptureService };

// Add module.exports at the end of the file
module.exports = { AudioCaptureService };
