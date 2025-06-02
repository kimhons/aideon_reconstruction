/**
 * AudioOutputManager.js
 * 
 * Manages audio output devices and playback.
 * Provides unified interface for audio playback across various devices.
 * 
 * @module tentacles/audio-processing/output/AudioOutputManager
 */

const { EventEmitter } = require('events');

/**
 * Audio Output Manager class
 * Manages audio output devices and provides unified playback interface
 */
class AudioOutputManager extends EventEmitter {
  /**
   * Constructor for the Audio Output Manager
   * @param {Object} options - Configuration options
   * @param {Object} options.context - AudioProcessingContext instance
   * @param {Object} options.resourceManager - AudioResourceManager instance
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    super();
    
    this.context = options.context;
    this.resourceManager = options.resourceManager;
    this.logger = options.logger || console;
    
    this.devices = new Map();
    this.activePlaybacks = new Map();
    this.defaultDeviceId = null;
    this.initialized = false;
    
    // Component ID for resource allocation
    this.componentId = `audio-output-manager-${Date.now()}`;
    
    // Audio format conversion capabilities
    this.formatConverters = new Map();
    
    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Initialize the Audio Output Manager
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Allocate resources
      if (this.resourceManager) {
        const allocation = this.resourceManager.allocateResources(
          this.componentId,
          { cpu: 0.5, memory: 10 * 1024 * 1024 }, // 10MB
          { priority: 8 } // High priority for audio output
        );
        
        if (!allocation) {
          throw new Error('Failed to allocate resources for Audio Output Manager');
        }
      }
      
      // Discover available devices
      await this._discoverDevices();
      
      // Initialize format converters
      this._initializeFormatConverters();
      
      // Store initialization state in context if available
      if (this.context) {
        this.context.set('audioOutputInitialized', true, { persist: true });
      }
      
      this.initialized = true;
      
      // Emit event
      this.emit('initialized', {
        deviceCount: this.devices.size,
        defaultDevice: this.defaultDeviceId
      });
      
      this.logger.info('Audio Output Manager initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Error initializing Audio Output Manager:', error);
      return false;
    }
  }

  /**
   * Get all available output devices
   * @returns {Array<Object>} - Array of device objects
   */
  getDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Get a specific output device by ID
   * @param {string} deviceId - Device identifier
   * @returns {Object|null} - Device object or null if not found
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Get the default output device
   * @returns {Object|null} - Default device object or null if not available
   */
  getDefaultDevice() {
    if (!this.defaultDeviceId) {
      return null;
    }
    
    return this.devices.get(this.defaultDeviceId) || null;
  }

  /**
   * Set the default output device
   * @param {string} deviceId - Device identifier
   * @returns {boolean} - Success status
   */
  setDefaultDevice(deviceId) {
    if (!this.devices.has(deviceId)) {
      this.logger.warn(`Device ${deviceId} not found`);
      return false;
    }
    
    this.defaultDeviceId = deviceId;
    
    // Store in context if available
    if (this.context) {
      this.context.set('defaultAudioOutputDevice', deviceId, { persist: true });
    }
    
    // Emit event
    this.emit('defaultDeviceChanged', {
      deviceId,
      device: this.devices.get(deviceId)
    });
    
    return true;
  }

  /**
   * Play audio on a device
   * @param {string|Buffer|Object} audio - Audio data, file path, or stream
   * @param {string} deviceId - Device identifier (or null for default device)
   * @param {Object} options - Playback options
   * @param {number} options.volume - Playback volume (0-100)
   * @param {boolean} options.loop - Whether to loop playback
   * @param {number} options.startTime - Start time in seconds
   * @param {number} options.endTime - End time in seconds
   * @param {string} options.format - Audio format (e.g., 'wav', 'mp3')
   * @returns {Promise<Object>} - Playback object
   */
  async play(audio, deviceId = null, options = {}) {
    // Use default device if not specified
    const targetDeviceId = deviceId || this.defaultDeviceId;
    
    if (!targetDeviceId) {
      throw new Error('No device specified and no default device available');
    }
    
    if (!this.devices.has(targetDeviceId)) {
      throw new Error(`Device ${targetDeviceId} not found`);
    }
    
    try {
      // Get device
      const device = this.devices.get(targetDeviceId);
      
      // Set default options
      const playbackOptions = {
        volume: options.volume !== undefined ? options.volume : 100,
        loop: options.loop !== undefined ? options.loop : false,
        startTime: options.startTime || 0,
        endTime: options.endTime || null,
        format: options.format || this._detectFormat(audio)
      };
      
      // Create playback ID
      const playbackId = `playback-${targetDeviceId}-${Date.now()}`;
      
      // Create playback object
      const playback = {
        id: playbackId,
        deviceId: targetDeviceId,
        device,
        options: playbackOptions,
        startTime: Date.now(),
        status: 'starting',
        data: null, // Will be populated with actual playback
        metadata: {}
      };
      
      // Prepare audio data
      const preparedAudio = await this._prepareAudio(audio, playbackOptions);
      
      // Start actual playback
      playback.data = await this._startDevicePlayback(device, preparedAudio, playbackOptions);
      playback.status = 'playing';
      
      // Store playback
      this.activePlaybacks.set(playbackId, playback);
      
      // Emit event
      this.emit('playbackStarted', {
        playbackId,
        deviceId: targetDeviceId,
        options: playbackOptions
      });
      
      // Set up completion handler
      this._setupPlaybackCompletion(playback);
      
      return playback;
    } catch (error) {
      this.logger.error(`Error playing audio on device ${targetDeviceId}:`, error);
      throw error;
    }
  }

  /**
   * Stop audio playback
   * @param {string} playbackId - Playback identifier
   * @returns {Promise<boolean>} - Success status
   */
  async stop(playbackId) {
    if (!this.activePlaybacks.has(playbackId)) {
      this.logger.warn(`No active playback for ID ${playbackId}`);
      return false;
    }
    
    try {
      // Get playback
      const playback = this.activePlaybacks.get(playbackId);
      
      // Stop actual playback
      await this._stopDevicePlayback(playback);
      
      // Update playback status
      playback.status = 'stopped';
      playback.endTime = Date.now();
      
      // Remove from active playbacks
      this.activePlaybacks.delete(playbackId);
      
      // Emit event
      this.emit('playbackStopped', {
        playbackId,
        deviceId: playback.deviceId,
        duration: playback.endTime - playback.startTime
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error stopping playback ${playbackId}:`, error);
      return false;
    }
  }

  /**
   * Pause audio playback
   * @param {string} playbackId - Playback identifier
   * @returns {Promise<boolean>} - Success status
   */
  async pause(playbackId) {
    if (!this.activePlaybacks.has(playbackId)) {
      this.logger.warn(`No active playback for ID ${playbackId}`);
      return false;
    }
    
    try {
      // Get playback
      const playback = this.activePlaybacks.get(playbackId);
      
      // Only pause if currently playing
      if (playback.status !== 'playing') {
        this.logger.warn(`Playback ${playbackId} is not currently playing`);
        return false;
      }
      
      // Pause actual playback
      await this._pauseDevicePlayback(playback);
      
      // Update playback status
      playback.status = 'paused';
      playback.pauseTime = Date.now();
      
      // Emit event
      this.emit('playbackPaused', {
        playbackId,
        deviceId: playback.deviceId,
        elapsedTime: playback.pauseTime - playback.startTime
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error pausing playback ${playbackId}:`, error);
      return false;
    }
  }

  /**
   * Resume audio playback
   * @param {string} playbackId - Playback identifier
   * @returns {Promise<boolean>} - Success status
   */
  async resume(playbackId) {
    if (!this.activePlaybacks.has(playbackId)) {
      this.logger.warn(`No active playback for ID ${playbackId}`);
      return false;
    }
    
    try {
      // Get playback
      const playback = this.activePlaybacks.get(playbackId);
      
      // Only resume if currently paused
      if (playback.status !== 'paused') {
        this.logger.warn(`Playback ${playbackId} is not currently paused`);
        return false;
      }
      
      // Resume actual playback
      await this._resumeDevicePlayback(playback);
      
      // Update playback status
      playback.status = 'playing';
      playback.resumeTime = Date.now();
      
      // Emit event
      this.emit('playbackResumed', {
        playbackId,
        deviceId: playback.deviceId,
        pauseDuration: playback.resumeTime - playback.pauseTime
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error resuming playback ${playbackId}:`, error);
      return false;
    }
  }

  /**
   * Adjust playback volume
   * @param {string} playbackId - Playback identifier
   * @param {number} volume - New volume (0-100)
   * @returns {Promise<boolean>} - Success status
   */
  async setVolume(playbackId, volume) {
    if (!this.activePlaybacks.has(playbackId)) {
      this.logger.warn(`No active playback for ID ${playbackId}`);
      return false;
    }
    
    // Validate volume
    if (volume < 0 || volume > 100) {
      throw new Error('Volume must be between 0 and 100');
    }
    
    try {
      // Get playback
      const playback = this.activePlaybacks.get(playbackId);
      
      // Set volume on actual playback
      await this._setDevicePlaybackVolume(playback, volume);
      
      // Update playback options
      playback.options.volume = volume;
      
      // Emit event
      this.emit('playbackVolumeChanged', {
        playbackId,
        deviceId: playback.deviceId,
        volume
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting volume for playback ${playbackId}:`, error);
      return false;
    }
  }

  /**
   * Get all active playbacks
   * @returns {Array<Object>} - Array of playback objects
   */
  getActivePlaybacks() {
    return Array.from(this.activePlaybacks.values());
  }

  /**
   * Get a specific playback by ID
   * @param {string} playbackId - Playback identifier
   * @returns {Object|null} - Playback object or null if not found
   */
  getPlayback(playbackId) {
    return this.activePlaybacks.get(playbackId) || null;
  }

  /**
   * Refresh the list of available devices
   * @returns {Promise<boolean>} - Success status
   */
  async refreshDevices() {
    try {
      await this._discoverDevices();
      
      // Emit event
      this.emit('devicesRefreshed', {
        deviceCount: this.devices.size,
        defaultDevice: this.defaultDeviceId
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error refreshing devices:', error);
      return false;
    }
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>} - Array of supported formats
   */
  getSupportedFormats() {
    return Array.from(this.formatConverters.keys());
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Stop all active playbacks
      for (const playbackId of this.activePlaybacks.keys()) {
        await this.stop(playbackId);
      }
      
      // Release resources
      if (this.resourceManager) {
        this.resourceManager.releaseResources(this.componentId);
      }
      
      // Remove all listeners
      this.removeAllListeners();
      
      this.logger.info('Audio Output Manager cleaned up');
      
      return true;
    } catch (error) {
      this.logger.error('Error cleaning up Audio Output Manager:', error);
      return false;
    }
  }
  
  /**
   * Discover available audio output devices
   * @private
   * @returns {Promise<boolean>} - Success status
   */
  async _discoverDevices() {
    try {
      // Clear existing devices
      this.devices.clear();
      
      // In a real implementation, this would use the Web Audio API or native modules
      // For this implementation, we'll create mock devices
      
      // Create mock devices
      const mockDevices = [
        {
          id: 'default-speakers',
          name: 'Default Speakers',
          kind: 'audiooutput',
          isDefault: true,
          capabilities: {
            sampleRates: [44100, 48000],
            channels: [2],
            formats: ['wav', 'mp3', 'aac']
          }
        },
        {
          id: 'high-quality-speakers',
          name: 'High Quality Speakers',
          kind: 'audiooutput',
          isDefault: false,
          capabilities: {
            sampleRates: [44100, 48000, 96000],
            channels: [2, 5, 7],
            formats: ['wav', 'mp3', 'aac', 'flac']
          }
        },
        {
          id: 'bluetooth-headphones',
          name: 'Bluetooth Headphones',
          kind: 'audiooutput',
          isDefault: false,
          capabilities: {
            sampleRates: [44100, 48000],
            channels: [2],
            formats: ['wav', 'mp3', 'aac']
          }
        }
      ];
      
      // Add devices to map
      for (const device of mockDevices) {
        this.devices.set(device.id, device);
        
        // Set default device
        if (device.isDefault) {
          this.defaultDeviceId = device.id;
        }
      }
      
      // Update resource manager if available
      if (this.resourceManager) {
        this.resourceManager.updateAudioDevices(
          [], // No input devices in this manager
          Array.from(this.devices.values())
        );
      }
      
      // Check if we have a stored default device in context
      if (this.context && this.context.has('defaultAudioOutputDevice')) {
        const storedDefaultDevice = this.context.get('defaultAudioOutputDevice');
        
        // Only use if device still exists
        if (this.devices.has(storedDefaultDevice)) {
          this.defaultDeviceId = storedDefaultDevice;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error discovering devices:', error);
      return false;
    }
  }
  
  /**
   * Initialize format converters
   * @private
   */
  _initializeFormatConverters() {
    // In a real implementation, this would initialize actual format converters
    // For this implementation, we'll create mock converters
    
    this.formatConverters.set('wav', {
      name: 'WAV Converter',
      convert: async (audio, options) => audio
    });
    
    this.formatConverters.set('mp3', {
      name: 'MP3 Converter',
      convert: async (audio, options) => audio
    });
    
    this.formatConverters.set('aac', {
      name: 'AAC Converter',
      convert: async (audio, options) => audio
    });
    
    this.formatConverters.set('flac', {
      name: 'FL
(Content truncated due to size limit. Use line ranges to read in chunks)