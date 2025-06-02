/**
 * AudioInputManager.js
 * 
 * Manages audio input devices and streams.
 * Provides unified interface for capturing audio from various sources.
 * 
 * @module tentacles/audio-processing/acquisition/AudioInputManager
 */

const { EventEmitter } = require('events');

/**
 * Audio Input Manager class
 * Manages audio input devices and provides unified capture interface
 */
class AudioInputManager extends EventEmitter {
  /**
   * Constructor for the Audio Input Manager
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
    this.activeStreams = new Map();
    this.defaultDeviceId = null;
    this.initialized = false;
    
    // Component ID for resource allocation
    this.componentId = `audio-input-manager-${Date.now()}`;
    
    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Initialize the Audio Input Manager
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
          { priority: 8 } // High priority for audio input
        );
        
        if (!allocation) {
          throw new Error('Failed to allocate resources for Audio Input Manager');
        }
      }
      
      // Discover available devices
      await this._discoverDevices();
      
      // Store initialization state in context if available
      if (this.context) {
        this.context.set('audioInputInitialized', true, { persist: true });
      }
      
      this.initialized = true;
      
      // Emit event
      this.emit('initialized', {
        deviceCount: this.devices.size,
        defaultDevice: this.defaultDeviceId
      });
      
      this.logger.info('Audio Input Manager initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Error initializing Audio Input Manager:', error);
      return false;
    }
  }

  /**
   * Get all available input devices
   * @returns {Array<Object>} - Array of device objects
   */
  getDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Get a specific input device by ID
   * @param {string} deviceId - Device identifier
   * @returns {Object|null} - Device object or null if not found
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Get the default input device
   * @returns {Object|null} - Default device object or null if not available
   */
  getDefaultDevice() {
    if (!this.defaultDeviceId) {
      return null;
    }
    
    return this.devices.get(this.defaultDeviceId) || null;
  }

  /**
   * Set the default input device
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
      this.context.set('defaultAudioInputDevice', deviceId, { persist: true });
    }
    
    // Emit event
    this.emit('defaultDeviceChanged', {
      deviceId,
      device: this.devices.get(deviceId)
    });
    
    return true;
  }

  /**
   * Start capturing audio from a device
   * @param {string} deviceId - Device identifier (or null for default device)
   * @param {Object} options - Capture options
   * @param {number} options.sampleRate - Sample rate in Hz
   * @param {number} options.channels - Number of channels
   * @param {string} options.format - Audio format (e.g., 'wav', 'mp3')
   * @param {boolean} options.echoCancellation - Whether to enable echo cancellation
   * @param {boolean} options.noiseSuppression - Whether to enable noise suppression
   * @param {boolean} options.autoGainControl - Whether to enable automatic gain control
   * @returns {Promise<Object>} - Stream object
   */
  async startCapture(deviceId = null, options = {}) {
    // Use default device if not specified
    const targetDeviceId = deviceId || this.defaultDeviceId;
    
    if (!targetDeviceId) {
      throw new Error('No device specified and no default device available');
    }
    
    if (!this.devices.has(targetDeviceId)) {
      throw new Error(`Device ${targetDeviceId} not found`);
    }
    
    // Check if already capturing from this device
    if (this.activeStreams.has(targetDeviceId)) {
      this.logger.warn(`Already capturing from device ${targetDeviceId}`);
      return this.activeStreams.get(targetDeviceId);
    }
    
    try {
      // Get device
      const device = this.devices.get(targetDeviceId);
      
      // Set default options
      const captureOptions = {
        sampleRate: options.sampleRate || 44100,
        channels: options.channels || 1,
        format: options.format || 'wav',
        echoCancellation: options.echoCancellation !== undefined ? options.echoCancellation : true,
        noiseSuppression: options.noiseSuppression !== undefined ? options.noiseSuppression : true,
        autoGainControl: options.autoGainControl !== undefined ? options.autoGainControl : true
      };
      
      // Create stream ID
      const streamId = `stream-${targetDeviceId}-${Date.now()}`;
      
      // Create stream object
      const stream = {
        id: streamId,
        deviceId: targetDeviceId,
        device,
        options: captureOptions,
        startTime: Date.now(),
        status: 'starting',
        data: null, // Will be populated with actual stream
        metadata: {}
      };
      
      // Start actual capture
      stream.data = await this._startDeviceCapture(device, captureOptions);
      stream.status = 'active';
      
      // Store stream
      this.activeStreams.set(targetDeviceId, stream);
      
      // Emit event
      this.emit('captureStarted', {
        streamId,
        deviceId: targetDeviceId,
        options: captureOptions
      });
      
      return stream;
    } catch (error) {
      this.logger.error(`Error starting capture from device ${targetDeviceId}:`, error);
      throw error;
    }
  }

  /**
   * Stop capturing audio from a device
   * @param {string} deviceId - Device identifier (or null for default device)
   * @returns {Promise<boolean>} - Success status
   */
  async stopCapture(deviceId = null) {
    // Use default device if not specified
    const targetDeviceId = deviceId || this.defaultDeviceId;
    
    if (!targetDeviceId) {
      throw new Error('No device specified and no default device available');
    }
    
    if (!this.activeStreams.has(targetDeviceId)) {
      this.logger.warn(`No active capture for device ${targetDeviceId}`);
      return false;
    }
    
    try {
      // Get stream
      const stream = this.activeStreams.get(targetDeviceId);
      
      // Stop actual capture
      await this._stopDeviceCapture(stream);
      
      // Update stream status
      stream.status = 'stopped';
      stream.endTime = Date.now();
      
      // Remove from active streams
      this.activeStreams.delete(targetDeviceId);
      
      // Emit event
      this.emit('captureStopped', {
        streamId: stream.id,
        deviceId: targetDeviceId,
        duration: stream.endTime - stream.startTime
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error stopping capture from device ${targetDeviceId}:`, error);
      return false;
    }
  }

  /**
   * Get all active capture streams
   * @returns {Array<Object>} - Array of stream objects
   */
  getActiveStreams() {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Check if a device is currently capturing
   * @param {string} deviceId - Device identifier
   * @returns {boolean} - Whether device is capturing
   */
  isCapturing(deviceId) {
    return this.activeStreams.has(deviceId);
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
   * Clean up resources
   */
  async cleanup() {
    try {
      // Stop all active captures
      for (const deviceId of this.activeStreams.keys()) {
        await this.stopCapture(deviceId);
      }
      
      // Release resources
      if (this.resourceManager) {
        this.resourceManager.releaseResources(this.componentId);
      }
      
      // Remove all listeners
      this.removeAllListeners();
      
      this.logger.info('Audio Input Manager cleaned up');
      
      return true;
    } catch (error) {
      this.logger.error('Error cleaning up Audio Input Manager:', error);
      return false;
    }
  }
  
  /**
   * Discover available audio input devices
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
          id: 'default-microphone',
          name: 'Default Microphone',
          kind: 'audioinput',
          isDefault: true,
          capabilities: {
            sampleRates: [8000, 16000, 22050, 44100, 48000],
            channels: [1, 2],
            formats: ['wav', 'mp3']
          }
        },
        {
          id: 'high-quality-mic',
          name: 'High Quality Microphone',
          kind: 'audioinput',
          isDefault: false,
          capabilities: {
            sampleRates: [44100, 48000, 96000],
            channels: [1, 2],
            formats: ['wav', 'mp3', 'flac']
          }
        },
        {
          id: 'system-audio',
          name: 'System Audio',
          kind: 'audioinput',
          isDefault: false,
          capabilities: {
            sampleRates: [44100, 48000],
            channels: [2],
            formats: ['wav', 'mp3']
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
          Array.from(this.devices.values()),
          [] // No output devices in this manager
        );
      }
      
      // Check if we have a stored default device in context
      if (this.context && this.context.has('defaultAudioInputDevice')) {
        const storedDefaultDevice = this.context.get('defaultAudioInputDevice');
        
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
   * Start capturing from a specific device
   * @private
   * @param {Object} device - Device object
   * @param {Object} options - Capture options
   * @returns {Promise<Object>} - Stream data object
   */
  async _startDeviceCapture(device, options) {
    // In a real implementation, this would use the Web Audio API or native modules
    // For this implementation, we'll create a mock stream
    
    return {
      device: device.id,
      format: options.format,
      sampleRate: options.sampleRate,
      channels: options.channels,
      // Mock methods that would be available on a real stream
      pause: () => {},
      resume: () => {},
      getAudioLevel: () => Math.random(), // Mock audio level between 0 and 1
      getStats: () => ({
        bytesRecorded: 0,
        timeElapsed: 0,
        dropped: 0
      })
    };
  }
  
  /**
   * Stop capturing from a specific stream
   * @private
   * @param {Object} stream - Stream object
   * @returns {Promise<boolean>} - Success status
   */
  async _stopDeviceCapture(stream) {
    // In a real implementation, this would stop the actual stream
    // For this implementation, we'll just return success
    
    return true;
  }
  
  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Handle process exit
    process.on('beforeExit', () => {
      this.cleanup();
    });
  }
}

module.exports = AudioInputManager;
