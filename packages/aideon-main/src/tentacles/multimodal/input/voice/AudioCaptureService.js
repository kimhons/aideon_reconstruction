/**
 * @fileoverview AudioCaptureService handles microphone access and audio stream management
 * for the Aideon AI Desktop Agent. It provides a unified interface for capturing audio
 * across different platforms and devices.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { LogManager } = require('../../../core/logging/LogManager');
const { ConfigManager } = require('../../../core/config/ConfigManager');
const { PlatformManager } = require('../../../core/platform/PlatformManager');
const { PerformanceTracker } = require('../../../core/performance/PerformanceTracker');

/**
 * Audio capture states
 * @enum {string}
 */
const AudioCaptureState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  READY: 'ready',
  CAPTURING: 'capturing',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Audio encoding formats
 * @enum {string}
 */
const AudioEncoding = {
  LINEAR16: 'LINEAR16',
  FLAC: 'FLAC',
  MP3: 'MP3',
  OGG_OPUS: 'OGG_OPUS',
  MULAW: 'MULAW',
  ALAW: 'ALAW'
};

/**
 * AudioCaptureService class
 * Handles microphone access and audio stream management
 */
class AudioCaptureService extends EventEmitter {
  /**
   * Create a new AudioCaptureService
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Optional custom logger
   * @param {Object} [options.configManager] - Optional custom config manager
   * @param {Object} [options.platformManager] - Optional custom platform manager
   * @param {Object} [options.performanceTracker] - Optional custom performance tracker
   */
  constructor(options = {}) {
    super();
    
    // Initialize system services
    this.logger = options.logger || LogManager.getLogger('AudioCaptureService');
    this.configManager = options.configManager || ConfigManager.getInstance();
    this.platformManager = options.platformManager || PlatformManager.getInstance();
    this.performanceTracker = options.performanceTracker || new PerformanceTracker('AudioCaptureService');
    
    // Initialize state
    this.state = AudioCaptureState.IDLE;
    this.sessionId = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.audioProcessor = null;
    this.audioChunks = [];
    this.devices = [];
    this.selectedDevice = null;
    this.config = {};
    this.initialized = false;
    this.captureTimeout = null;
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.startCapture = this.startCapture.bind(this);
    this.stopCapture = this.stopCapture.bind(this);
    this.pauseCapture = this.pauseCapture.bind(this);
    this.resumeCapture = this.resumeCapture.bind(this);
    this.getDevices = this.getDevices.bind(this);
    this.selectDevice = this.selectDevice.bind(this);
    this.getAudioLevel = this.getAudioLevel.bind(this);
    this.updateConfiguration = this.updateConfiguration.bind(this);
    this._setState = this._setState.bind(this);
    this._setupAudioContext = this._setupAudioContext.bind(this);
    this._setupMediaRecorder = this._setupMediaRecorder.bind(this);
    this._processAudioChunk = this._processAudioChunk.bind(this);
    this._loadConfiguration = this._loadConfiguration.bind(this);
    this._cleanupResources = this._cleanupResources.bind(this);
    
    this.logger.info('AudioCaptureService created');
  }
  
  /**
   * Initialize the audio capture service
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - True if initialization successful
   * @throws {Error} If initialization fails
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing audio capture service');
      this._setState(AudioCaptureState.INITIALIZING);
      this.performanceTracker.startTracking('initialize');
      
      // Load configuration
      await this._loadConfiguration(options);
      
      // Check platform compatibility
      const platformInfo = this.platformManager.getPlatformInfo();
      this.logger.debug('Platform info', platformInfo);
      
      if (!platformInfo.capabilities.audioCapture) {
        throw new Error('Audio capture not supported on this platform');
      }
      
      // Get available audio devices
      await this.getDevices();
      
      if (this.devices.length === 0) {
        throw new Error('No audio input devices found');
      }
      
      // Select default device if not already selected
      if (!this.selectedDevice) {
        const defaultDevice = this.devices.find(device => device.isDefault) || this.devices[0];
        await this.selectDevice(defaultDevice.id);
      }
      
      // Setup audio context
      await this._setupAudioContext();
      
      // Mark as initialized
      this.initialized = true;
      this._setState(AudioCaptureState.READY);
      
      this.performanceTracker.stopTracking('initialize');
      this.logger.info('Audio capture service initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceTracker.stopTracking('initialize');
      this._setState(AudioCaptureState.ERROR);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Start audio capture
   * @param {Object} [options] - Capture options
   * @param {string} [options.sessionId] - Session ID for the capture
   * @param {number} [options.maxDuration] - Maximum capture duration in milliseconds
   * @param {boolean} [options.continuous] - Whether to capture continuously
   * @returns {Promise<string>} - Session ID for the capture
   * @throws {Error} If capture cannot be started
   */
  async startCapture(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('AudioCaptureService not initialized');
      }
      
      if (this.state === AudioCaptureState.CAPTURING) {
        this.logger.warn('Already capturing audio');
        return this.sessionId;
      }
      
      this.logger.info('Starting audio capture');
      this.performanceTracker.startTracking('capture');
      
      // Generate new session ID if not provided
      this.sessionId = options.sessionId || uuidv4();
      
      // Reset audio chunks
      this.audioChunks = [];
      
      // Setup media recorder
      await this._setupMediaRecorder();
      
      // Start recording
      this.mediaRecorder.start(this.config.chunkDuration);
      
      this._setState(AudioCaptureState.CAPTURING);
      
      // Set timeout if maxDuration is specified
      const maxDuration = options.maxDuration || this.config.maxDuration;
      if (maxDuration && maxDuration > 0 && !options.continuous) {
        this.captureTimeout = setTimeout(() => {
          this.stopCapture().catch(error => {
            this.logger.error('Error stopping capture after timeout', error);
          });
        }, maxDuration);
      }
      
      this.logger.info(`Audio capture started with session ID: ${this.sessionId}`);
      return this.sessionId;
    } catch (error) {
      this.performanceTracker.stopTracking('capture');
      this._setState(AudioCaptureState.ERROR);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Stop audio capture
   * @returns {Promise<Object>} - Capture result
   * @throws {Error} If capture cannot be stopped
   */
  async stopCapture() {
    try {
      if (this.state !== AudioCaptureState.CAPTURING && 
          this.state !== AudioCaptureState.PAUSED) {
        this.logger.warn('Not currently capturing audio');
        return null;
      }
      
      this.logger.info('Stopping audio capture');
      
      // Clear timeout if set
      if (this.captureTimeout) {
        clearTimeout(this.captureTimeout);
        this.captureTimeout = null;
      }
      
      // Stop media recorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        // Request final data
        this.mediaRecorder.requestData();
        
        // Stop recording
        this.mediaRecorder.stop();
      }
      
      // Process any remaining audio chunks
      const finalAudio = this._getFinalAudio();
      
      // Clean up resources
      await this._cleanupResources();
      
      this._setState(AudioCaptureState.READY);
      this.performanceTracker.stopTracking('capture');
      
      this.logger.info('Audio capture stopped');
      
      // Emit final audio data
      if (finalAudio) {
        this.emit('captureComplete', {
          sessionId: this.sessionId,
          audio: finalAudio,
          duration: finalAudio.duration,
          format: this.config.encoding,
          channels: this.config.channels,
          sampleRate: this.config.sampleRate
        });
      }
      
      return {
        sessionId: this.sessionId,
        duration: finalAudio ? finalAudio.duration : 0,
        format: this.config.encoding,
        channels: this.config.channels,
        sampleRate: this.config.sampleRate
      };
    } catch (error) {
      this._setState(AudioCaptureState.ERROR);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Pause audio capture
   * @returns {Promise<void>}
   * @throws {Error} If capture cannot be paused
   */
  async pauseCapture() {
    try {
      if (this.state !== AudioCaptureState.CAPTURING) {
        this.logger.warn('Not currently capturing audio');
        return;
      }
      
      this.logger.info('Pausing audio capture');
      
      // Pause media recorder if supported
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording' && 
          typeof this.mediaRecorder.pause === 'function') {
        this.mediaRecorder.pause();
      }
      
      this._setState(AudioCaptureState.PAUSED);
      
      this.logger.info('Audio capture paused');
    } catch (error) {
      this._setState(AudioCaptureState.ERROR);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Resume audio capture
   * @returns {Promise<void>}
   * @throws {Error} If capture cannot be resumed
   */
  async resumeCapture() {
    try {
      if (this.state !== AudioCaptureState.PAUSED) {
        this.logger.warn('Not currently paused');
        return;
      }
      
      this.logger.info('Resuming audio capture');
      
      // Resume media recorder if supported
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused' && 
          typeof this.mediaRecorder.resume === 'function') {
        this.mediaRecorder.resume();
      }
      
      this._setState(AudioCaptureState.CAPTURING);
      
      this.logger.info('Audio capture resumed');
    } catch (error) {
      this._setState(AudioCaptureState.ERROR);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Get available audio input devices
   * @returns {Promise<Array>} - List of available devices
   * @throws {Error} If devices cannot be retrieved
   */
  async getDevices() {
    try {
      this.logger.info('Getting available audio input devices');
      
      // Use platform-specific method to get devices
      const deviceList = await this.platformManager.getAudioInputDevices();
      
      // Filter and format device list
      this.devices = deviceList.map(device => ({
        id: device.id,
        name: device.name || device.label || `Device ${device.id}`,
        isDefault: device.isDefault || false
      }));
      
      this.logger.info(`Found ${this.devices.length} audio input devices`);
      return this.devices;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Select audio input device
   * @param {string} deviceId - Device ID to select
   * @returns {Promise<Object>} - Selected device
   * @throws {Error} If device cannot be selected
   */
  async selectDevice(deviceId) {
    try {
      this.logger.info(`Selecting audio device: ${deviceId}`);
      
      // Find device in list
      const device = this.devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }
      
      // Store selected device
      this.selectedDevice = device;
      
      // If currently capturing, restart with new device
      const wasCapturing = this.state === AudioCaptureState.CAPTURING;
      if (wasCapturing) {
        await this.stopCapture();
      }
      
      // Reinitialize audio context with new device
      if (this.initialized) {
        await this._setupAudioContext();
      }
      
      // Restart capture if needed
      if (wasCapturing) {
        await this.startCapture({ sessionId: this.sessionId });
      }
      
      this.logger.info(`Audio device selected: ${device.name}`);
      return device;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Get current audio level
   * @returns {number} - Audio level between 0 and 1
   */
  getAudioLevel() {
    if (!this.audioProcessor || !this.audioProcessor.audioLevel) {
      return 0;
    }
    
    return this.audioProcessor.audioLevel;
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   * @returns {Promise<Object>} - Updated configuration
   */
  async updateConfiguration(newConfig) {
    try {
      this.logger.info('Updating audio capture configuration');
      
      // Merge new config with existing
      Object.assign(this.config, newConfig);
      
      // Save to config manager
      await this.configManager.setConfig('audioCapture', this.config);
      
      // If currently capturing, restart with new config
      const wasCapturing = this.state === AudioCaptureState.CAPTURING;
      if (wasCapturing) {
        await this.stopCapture();
      }
      
      // Reinitialize audio context with new config
      if (this.initialized) {
        await this._setupAudioContext();
      }
      
      // Restart capture if needed
      if (wasCapturing) {
        await this.startCapture({ sessionId: this.sessionId });
      }
      
      this.logger.info('Audio capture configuration updated');
      return this.config;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Get current state
   * @returns {string} - Current state
   */
  getState() {
    return this.state;
  }
  
  /**
   * Get current session ID
   * @returns {string|null} - Current session ID
   */
  getSessionId() {
    return this.sessionId;
  }
  
  /**
   * Get configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Set state and emit state change event
   * @param {string} newState - New state
   * @private
   */
  _setState(newState) {
    if (this.state === newState) {
      return;
    }
    
    const oldState = this.state;
    this.state = newState;
    
    this.logger.debug(`State changed: ${oldState} -> ${newState}`);
    
    // Emit state change event
    this.emit('stateChanged', {
      sessionId: this.sessionId,
      oldState,
      newState
    });
  }
  
  /**
   * Setup audio context and input stream
   * @private
   * @returns {Promise<void>}
   */
  async _setupAudioContext() {
    try {
      // Clean up existing resources
      await this._cleanupResources();
      
      this.logger.debug('Setting up audio context');
      
      // Create audio context
      const AudioContext = this.platformManager.getAudioContext();
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive'
      });
      
      // Get user media
      const constraints = {
        audio: {
          deviceId: this.selectedDevice ? { exact: this.selectedDevice.id } : undefined,
          channelCount: this.config.channels,
          sampleRate: this.config.sampleRate,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl
        }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio processor for level monitoring
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create analyzer for audio level
      const analyzer = this.audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      
      // Setup audio processor
      this.audioProcessor = {
        source,
        analyzer,
        audioLevel: 0,
        dataArray: new Uint8Array(analyzer.frequencyBinCount)
      };
      
      // Start audio level monitoring
      this._startAudioLevelMonitoring();
      
      this.logger.debug('Audio context setup complete');
    } catch (error) {
      this.logger.error('Error setting up audio context', error);
      throw error;
    }
  }
  
  /**
   * Setup media recorder
   * @private
   * @returns {Promise<void>}
   */
  async _setupMediaRecorder() {
    try {
      if (!this.stream) {
        throw new Error('Audio stream not available');
      }
      
      this.logger.debug('Setting up media recorder');
      
      // Determine MIME type based on encoding
      const mimeType = this._getMimeType();
      
      // Create media recorder
      const options = {
        mimeType,
        audioBitsPerSecond: this.config.bitRate
      };
      
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // Setup event listeners
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
          this._processAudioChunk(event.data);
        }
      };
      
      this.mediaRecorder.onerror = (error) => {
        this.logger.error('Media recorder error', error);
        this.emit('error', error);
      };
      
      this.mediaRecorder.onstart = () => {
        this.logger.debug('Media recorder started');
      };
      
      this.mediaRecorder.onstop = () => {
        this.logger.debug('Media recorder stopped');
      };
      
      this.mediaRecorder.onpause = () => {
        this.logger.debug('Media recorder paused');
      };
      
      this.mediaRecorder.onresume = () => {
        this.logger.debug('Media recorder resumed');
      };
      
      this.logger.debug('Media recorder setup complete');
    } catch (error) {
      this.logger.error('Error setting up media recorder', error);
      throw error;
    }
  }
  
  /**
   * Process audio chunk
   * @param {Blob} chunk - Audio chunk
   * @private
   */
  async _processAudioChunk(chunk) {
    try {
      // Convert blob to array buffer
      const arrayBuffer = await chunk.arrayBuffer();
      
      // Create audio data object
      const audioData = {
        buffer: arrayBuffer,
        format: this.config.encoding,
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        timestamp: Date.now(),
        duration: this.config.chunkDuration,
        sessionId: this.sessionId
      };
      
      // Emit data available event
      this.emit('dataAvailable', audioData);
    } catch (error) {
      this.logger.error('Error processing audio chunk', error);
    }
  }
  
  /**
   * Get final audio from chunks
   * @private
   * @returns {Object|null} - Final audio data
   */
  _getFinalAudio() {
    if (this.audioChunks.length === 0) {
      return null;
    }
    
    // Create blob from chunks
    const blob = new Blob(this.audioChunks, { type: this._getMimeType() });
    
    // Calculate duration
    const duration = this.audioChunks.length * this.config.chunkDuration;
    
    return {
      blob,
      format: this.config.encoding,
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      duration,
      sessionId: this.sessionId
    };
  }
  
  /**
   * Get MIME type based on encoding
   * @private
   * @returns {string} - MIME type
   */
  _getMimeType() {
    switch (this.config.encoding) {
      case AudioEncoding.LINEAR16:
        return 'audio/wav';
      case AudioEncoding.FLAC:
        return 'audio/flac';
      case AudioEncoding.MP3:
        return 'audio/mp3';
      case AudioEncoding.OGG_OPUS:
        return 'audio/ogg; codecs=opus';
      case AudioEncoding.MULAW:
      case AudioEncoding.ALAW:
        return 'audio/wav';
      default:
        return 'audio/wav';
    }
  }
  
  /**
   * Start audio level monitoring
   * @private
   */
  _startAudioLevelMonitoring() {
    if (!this.audioProcessor || !this.audioProcessor.analyzer) {
      return;
    }
    
    const updateAudioLevel = () => {
      if (!this.audioProcessor || !this.audioProcessor.analyzer) {
        return;
      }
      
      // Get frequency data
      this.audioProcessor.analyzer.getByteFrequencyData(this.audioProcessor.dataArray);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < this.audioProcessor.dataArray.length; i++) {
        sum += this.audioProcessor.dataArray[i];
      }
      
      // Normalize to 0-1 range
      const average = sum / this.audioProcessor.dataArray.length / 255;
      this.audioProcessor.audioLevel = average;
      
      // Emit audio level event if capturing
      if (this.state === AudioCaptureState.CAPTURING) {
        this.emit('audioLevel', {
          sessionId: this.sessionId,
          level: average,
          timestamp: Date.now()
        });
      }
      
      // Schedule next update
      requestAnimationFrame(updateAudioLevel);
    };
    
    // Start monitoring
    updateAudioLevel();
  }
  
  /**
   * Load configuration from config manager
   * @param {Object} options - Override options
   * @private
   * @returns {Promise<void>}
   */
  async _loadConfiguration(options = {}) {
    // Get configuration from config manager
    const savedConfig = await this.configManager.getConfig('audioCapture') || {};
    
    // Default configuration
    const defaultConfig = {
      // Audio settings
      sampleRate: 16000,
      channels: 1,
      encoding: AudioEncoding.LINEAR16,
      bitRate: 128000,
      
      // Chunk settings
      chunkDuration: 1000, // 1 second
      maxDuration: 60000, // 60 seconds
      
      // Processing settings
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      
      // Device settings
      preferredDevice: null
    };
    
    // Merge default with saved config and override options
    this.config = { ...defaultConfig, ...savedConfig, ...options };
    
    this.logger.debug('Configuration loaded', this.config);
  }
  
  /**
   * Clean up resources
   * @private
   * @returns {Promise<void>}
   */
  async _cleanupResources() {
    // Clear timeout if set
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = null;
    }
    
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        this.logger.warn('Error stopping media recorder', error);
      }
      this.mediaRecorder = null;
    }
    
    // Stop audio tracks
    if (this.stream) {
      try {
        const tracks = this.stream.getTracks();
        tracks.forEach(track => track.stop());
      } catch (error) {
        this.logger.warn('Error stopping audio tracks', error);
      }
      this.stream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (error) {
        this.logger.warn('Error closing audio context', error);
      }
      this.audioContext = null;
    }
    
    // Clear audio processor
    this.audioProcessor = null;
  }
}

// Export constants and class
module.exports = {
  AudioCaptureService,
  AudioCaptureState,
  AudioEncoding
};
