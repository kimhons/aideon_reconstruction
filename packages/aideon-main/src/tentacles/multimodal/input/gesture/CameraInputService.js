/**
 * @fileoverview CameraInputService manages camera access, frame capture, and privacy controls
 * for the Aideon AI Desktop Agent's gesture recognition system. It provides a robust interface
 * for accessing camera feeds with appropriate user consent and privacy safeguards.
 * 
 * The service implements multiple privacy features:
 * - Clear visual indicators when camera is active
 * - Automatic blur/privacy filters for background content
 * - Local-only processing with no cloud transmission
 * - Configurable retention policies for captured frames
 * - User-controlled privacy zones and masking
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const { EnhancedAsyncLock } = require('../utils/EnhancedAsyncLock');
const { EnhancedCancellationToken } = require('../utils/EnhancedCancellationToken');
const { EnhancedAsyncOperation } = require('../utils/EnhancedAsyncOperation');

// Import platform-specific camera modules dynamically
let electronCapture;
let nodeWebcam;
let cv;

/**
 * @typedef {Object} CameraInputConfig
 * @property {number} width - Frame width in pixels
 * @property {number} height - Frame height in pixels
 * @property {number} frameRate - Target frame rate
 * @property {boolean} showPreview - Whether to show camera preview
 * @property {string} deviceId - Specific camera device ID to use
 * @property {boolean} enablePrivacyIndicator - Whether to show privacy indicator
 * @property {boolean} applyBackgroundBlur - Whether to blur background
 * @property {number} blurIntensity - Background blur intensity (1-10)
 * @property {Array<Object>} privacyZones - Regions to mask for privacy
 * @property {Object} retention - Frame retention policy
 * @property {boolean} retention.enabled - Whether to retain frames
 * @property {number} retention.duration - How long to retain frames (ms)
 * @property {string} retention.storagePath - Where to store retained frames
 */

/**
 * CameraInputService manages camera access and frame capture with privacy controls.
 */
class CameraInputService extends EventEmitter {
  /**
   * Creates a new CameraInputService instance.
   * 
   * @param {Object} options - Configuration options
   * @param {CameraInputConfig} options.config - Camera configuration
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.resourceManager - Resource manager for allocation
   */
  constructor(options = {}) {
    super();
    
    // Extract options with defaults
    this.width = options.width || 640;
    this.height = options.height || 480;
    this.frameRate = options.frameRate || 30;
    this.showPreview = options.showPreview || false;
    this.deviceId = options.deviceId || null;
    this.logger = options.logger || console;
    this.resourceManager = options.resourceManager;
    
    // Privacy settings
    this.privacyConfig = {
      enablePrivacyIndicator: options.enablePrivacyIndicator !== false, // Default to true
      applyBackgroundBlur: options.applyBackgroundBlur || false,
      blurIntensity: options.blurIntensity || 5,
      privacyZones: options.privacyZones || [],
      retention: {
        enabled: options.retention?.enabled || false,
        duration: options.retention?.duration || 0,
        storagePath: options.retention?.storagePath || path.join(process.cwd(), 'camera_frames')
      }
    };
    
    // Initialize state
    this.isInitialized = false;
    this.isCapturing = false;
    this.currentSession = null;
    this.availableDevices = [];
    this.activeDevice = null;
    this.frameBuffer = [];
    this.frameCount = 0;
    this.privacyIndicator = null;
    this.captureInterval = null;
    this.processingEnabled = true;
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    this.captureLock = new EnhancedAsyncLock();
    this.deviceLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.startCapture = this.startCapture.bind(this);
    this.stopCapture = this.stopCapture.bind(this);
    this.captureFrame = this.captureFrame.bind(this);
    this.processFrame = this.processFrame.bind(this);
    this.applyPrivacyFilters = this.applyPrivacyFilters.bind(this);
    this.showPrivacyIndicator = this.showPrivacyIndicator.bind(this);
    this.hidePrivacyIndicator = this.hidePrivacyIndicator.bind(this);
    this.getAvailableDevices = this.getAvailableDevices.bind(this);
    this.setActiveDevice = this.setActiveDevice.bind(this);
    this.handleError = this.handleError.bind(this);
  }
  
  /**
   * Initializes the CameraInputService.
   * 
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(options = {}) {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('CameraInputService already initialized');
          return true;
        }
        
        this.logger.info('Initializing CameraInputService');
        
        // Load required modules based on platform
        await this.loadPlatformModules();
        
        // Check camera permissions
        const hasPermission = await this.checkCameraPermission();
        if (!hasPermission) {
          throw new Error('Camera permission denied');
        }
        
        // Get available camera devices
        this.availableDevices = await this.getAvailableDevices();
        if (this.availableDevices.length === 0) {
          throw new Error('No camera devices found');
        }
        
        // Select active device (use specified device or first available)
        const deviceToUse = this.deviceId ? 
          this.availableDevices.find(d => d.id === this.deviceId) : 
          this.availableDevices[0];
          
        if (!deviceToUse) {
          throw new Error(`Specified camera device not found: ${this.deviceId}`);
        }
        
        await this.setActiveDevice(deviceToUse.id);
        
        // Create retention directory if enabled
        if (this.privacyConfig.retention.enabled) {
          await fs.mkdir(this.privacyConfig.retention.storagePath, { recursive: true });
        }
        
        // Initialize privacy indicator if enabled
        if (this.privacyConfig.enablePrivacyIndicator) {
          await this.initializePrivacyIndicator();
        }
        
        this.isInitialized = true;
        this.emit('initialized', { 
          deviceCount: this.availableDevices.length,
          activeDevice: this.activeDevice
        });
        
        this.logger.info('CameraInputService initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize CameraInputService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Loads platform-specific camera modules.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadPlatformModules() {
    try {
      // Determine platform and load appropriate modules
      if (process.type === 'renderer' || process.type === 'browser') {
        // Electron environment
        this.logger.info('Loading Electron camera modules');
        electronCapture = require('electron-capture');
      } else {
        // Node.js environment
        this.logger.info('Loading Node.js camera modules');
        
        try {
          // Try to load OpenCV first for better performance
          cv = require('opencv4nodejs');
          this.logger.info('Using OpenCV for camera capture');
        } catch (cvError) {
          this.logger.info('OpenCV not available, falling back to node-webcam');
          nodeWebcam = require('node-webcam');
        }
      }
    } catch (error) {
      this.logger.error('Failed to load camera modules', error);
      throw new Error('Failed to load required camera modules');
    }
  }
  
  /**
   * Checks if camera permission is granted.
   * 
   * @private
   * @returns {Promise<boolean>} - True if permission is granted
   */
  async checkCameraPermission() {
    try {
      // Check with resource manager if available
      if (this.resourceManager) {
        const hasPermission = await this.resourceManager.checkPermission('camera');
        return hasPermission;
      }
      
      // Platform-specific permission checks
      if (process.type === 'renderer' || process.type === 'browser') {
        // Electron environment
        const { systemPreferences } = require('electron');
        if (systemPreferences.getMediaAccessStatus) {
          const cameraStatus = systemPreferences.getMediaAccessStatus('camera');
          return cameraStatus === 'granted';
        }
      }
      
      // Default to assuming permission (will fail later if not available)
      return true;
    } catch (error) {
      this.logger.error('Error checking camera permission', error);
      return false;
    }
  }
  
  /**
   * Gets a list of available camera devices.
   * 
   * @returns {Promise<Array>} - List of available devices
   */
  async getAvailableDevices() {
    return await this.deviceLock.acquire(async () => {
      try {
        const devices = [];
        
        if (process.type === 'renderer' || process.type === 'browser') {
          // Electron/browser environment
          const mediaDevices = navigator.mediaDevices;
          const deviceInfos = await mediaDevices.enumerateDevices();
          
          for (const deviceInfo of deviceInfos) {
            if (deviceInfo.kind === 'videoinput') {
              devices.push({
                id: deviceInfo.deviceId,
                label: deviceInfo.label || `Camera ${devices.length + 1}`,
                groupId: deviceInfo.groupId
              });
            }
          }
        } else if (cv) {
          // OpenCV environment
          const deviceCount = cv.getCameraCount ? cv.getCameraCount() : 8; // Default to checking 8 devices
          
          for (let i = 0; i < deviceCount; i++) {
            try {
              // Try to open the camera to check if it's available
              const camera = new cv.VideoCapture(i);
              const frame = camera.read();
              if (!frame.empty) {
                devices.push({
                  id: i.toString(),
                  label: `Camera ${i + 1}`,
                  index: i
                });
              }
              camera.release();
            } catch (e) {
              // Camera not available, skip
            }
          }
        } else if (nodeWebcam) {
          // Node-webcam environment
          // This is a simplified approach as node-webcam doesn't provide a clean way to enumerate devices
          devices.push({
            id: '0',
            label: 'Default Camera',
            index: 0
          });
        }
        
        this.logger.info(`Found ${devices.length} camera devices`);
        return devices;
      } catch (error) {
        this.logger.error('Failed to get available camera devices', error);
        return [];
      }
    });
  }
  
  /**
   * Sets the active camera device.
   * 
   * @param {string} deviceId - Device ID to set as active
   * @returns {Promise<boolean>} - True if successful
   */
  async setActiveDevice(deviceId) {
    return await this.deviceLock.acquire(async () => {
      try {
        // Stop capture if running
        const wasCapturing = this.isCapturing;
        if (wasCapturing) {
          await this.stopCapture();
        }
        
        // Find the device
        const device = this.availableDevices.find(d => d.id === deviceId);
        if (!device) {
          throw new Error(`Camera device not found: ${deviceId}`);
        }
        
        // Set as active device
        this.activeDevice = device;
        this.logger.info(`Set active camera device: ${device.label} (${device.id})`);
        
        // Restart capture if it was running
        if (wasCapturing) {
          await this.startCapture();
        }
        
        this.emit('deviceChanged', { device: this.activeDevice });
        return true;
      } catch (error) {
        this.logger.error('Failed to set active camera device', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Initializes the privacy indicator.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializePrivacyIndicator() {
    try {
      if (process.type === 'renderer' || process.type === 'browser') {
        // Electron/browser environment
        this.privacyIndicator = document.createElement('div');
        this.privacyIndicator.className = 'aideon-privacy-indicator';
        this.privacyIndicator.style.display = 'none';
        this.privacyIndicator.style.position = 'fixed';
        this.privacyIndicator.style.top = '10px';
        this.privacyIndicator.style.right = '10px';
        this.privacyIndicator.style.width = '12px';
        this.privacyIndicator.style.height = '12px';
        this.privacyIndicator.style.borderRadius = '50%';
        this.privacyIndicator.style.backgroundColor = 'red';
        this.privacyIndicator.style.zIndex = '9999';
        
        // Add pulsing animation for better visibility
        this.privacyIndicator.style.animation = 'aideon-privacy-pulse 2s infinite';
        
        // Add style for animation if not already present
        if (!document.getElementById('aideon-privacy-styles')) {
          const styleEl = document.createElement('style');
          styleEl.id = 'aideon-privacy-styles';
          styleEl.textContent = `
            @keyframes aideon-privacy-pulse {
              0% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.2); }
              100% { opacity: 1; transform: scale(1); }
            }
          `;
          document.head.appendChild(styleEl);
        }
        
        // Add tooltip for clarity
        this.privacyIndicator.title = 'Aideon Camera Active - Privacy Protected';
        
        document.body.appendChild(this.privacyIndicator);
      } else {
        // Node.js environment - use system tray or notification
        if (process.platform === 'darwin') {
          // macOS - use applescript to show notification
          const { exec } = require('child_process');
          this.showPrivacyIndicator = () => {
            exec('osascript -e \'display notification "Camera is active" with title "Aideon Privacy Alert"\'');
            
            // Also create a persistent indicator using terminal-notifier if available
            exec('which terminal-notifier && terminal-notifier -title "Aideon Privacy Alert" -message "Camera is active" -appIcon camera -contentImage camera -sender com.aideon.desktop -group aideon-camera');
          };
          this.hidePrivacyIndicator = () => {
            // Remove persistent notification if terminal-notifier was used
            exec('which terminal-notifier && terminal-notifier -remove aideon-camera');
          };
        } else if (process.platform === 'win32') {
          // Windows - use powershell to show notification
          const { exec } = require('child_process');
          this.showPrivacyIndicator = () => {
            exec('powershell -command "[reflection.assembly]::loadwithpartialname(\'System.Windows.Forms\'); [reflection.assembly]::loadwithpartialname(\'System.Drawing\'); $notify = new-object system.windows.forms.notifyicon; $notify.icon = [System.Drawing.SystemIcons]::Information; $notify.visible = $true; $notify.showballoontip(10, \'Aideon Privacy Alert\', \'Camera is active\', [system.windows.forms.tooltipicon]::None)"');
            
            // Create a persistent indicator by creating a small window
            exec('powershell -command "$script = New-Object -ComObject WScript.Shell; $script.Popup(\'Camera is active - Privacy Protected\', 0, \'Aideon Privacy Alert\', 64)"');
          };
          this.hidePrivacyIndicator = () => {
            exec('powershell -command "[reflection.assembly]::loadwithpartialname(\'System.Windows.Forms\'); [reflection.assembly]::loadwithpartialname(\'System.Drawing\'); $notify = new-object system.windows.forms.notifyicon; $notify.visible = $false;"');
            
            // Close any open popup windows
            exec('taskkill /f /im wscript.exe');
          };
        } else {
          // Linux - use notify-send if available
          const { exec } = require('child_process');
          this.showPrivacyIndicator = () => {
            // Create persistent notification
            exec('which notify-send && notify-send "Aideon Privacy Alert" "Camera is active" -i camera -t 0');
            
            // Also try to create a persistent indicator using zenity if available
            exec('which zenity && (zenity --notification --text="Aideon Camera Active" --window-icon=camera &)');
          };
          this.hidePrivacyIndicator = () => {
            // Kill any zenity notifications
            exec('pkill -f "zenity --notification --text=\\"Aideon Camera Active\\""');
          };
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize privacy indicator', error);
      // Continue without privacy indicator
      this.privacyConfig.enablePrivacyIndicator = false;
    }
  }
  
  /**
   * Shows the privacy indicator.
   * 
   * @private
   */
  showPrivacyIndicator() {
    if (!this.privacyConfig.enablePrivacyIndicator) return;
    
    try {
      if (this.privacyIndicator && typeof this.privacyIndicator === 'object') {
        this.privacyIndicator.style.display = 'block';
      } else if (typeof this.showPrivacyIndicator === 'function') {
        this.showPrivacyIndicator();
      }
    } catch (error) {
      this.logger.error('Failed to show privacy indicator', error);
    }
  }
  
  /**
   * Hides the privacy indicator.
   * 
   * @private
   */
  hidePrivacyIndicator() {
    if (!this.privacyConfig.enablePrivacyIndicator) return;
    
    try {
      if (this.privacyIndicator && typeof this.privacyIndicator === 'object') {
        this.privacyIndicator.style.display = 'none';
      } else if (typeof this.hidePrivacyIndicator === 'function') {
        this.hidePrivacyIndicator();
      }
    } catch (error) {
      this.logger.error('Failed to hide privacy indicator', error);
    }
  }
  
  /**
   * Starts capturing frames from the camera.
   * 
   * @param {Object} options - Capture options
   * @param {string} options.sessionId - Optional session ID
   * @returns {Promise<string>} - Session ID for the capture
   */
  async startCapture(options = {}) {
    return await this.captureLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('CameraInputService not initialized');
        }
        
        if (this.isCapturing) {
          this.logger.info('Camera capture already in progress');
          return this.currentSession.id;
        }
        
        this.logger.info('Starting camera capture');
        
        // Create a new session
        this.currentSession = {
          id: options.sessionId || `camera-session-${Date.now()}`,
          startTime: Date.now(),
          frameCount: 0,
          cancellationToken: new EnhancedCancellationToken()
        };
        
        // Show privacy indicator
        this.showPrivacyIndicator();
        
        // Start platform-specific capture
        if (process.type === 'renderer' || process.type === 'browser') {
          await this.startBrowserCapture();
        } else if (cv) {
          await this.startOpenCVCapture();
        } else if (nodeWebcam) {
          await this.startNodeWebcamCapture();
        } else {
          throw new Error('No camera capture method available');
        }
        
        this.isCapturing = true;
        this.emit('captureStarted', { 
          sessionId: this.currentSession.id,
          device: this.activeDevice
        });
        
        this.logger.info(`Camera capture started with session ID: ${this.currentSession.id}`);
        return this.currentSession.id;
      } catch (error) {
        this.logger.error('Failed to start camera capture', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Starts browser-based camera capture.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async startBrowserCapture() {
    const constraints = {
      video: {
        deviceId: this.activeDevice.id ? { exact: this.activeDevice.id } : undefined,
        width: { ideal: this.width },
        height: { ideal: this.height },
        frameRate: { ideal: this.frameRate }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.currentSession.stream = stream;
    
    // Create video element for processing
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    
    if (this.showPreview) {
      video.style.position = 'fixed';
      video.style.bottom = '10px';
      video.style.right = '10px';
      video.style.width = '240px';
      video.style.height = '180px';
      video.style.objectFit = 'cover';
      video.style.zIndex = '9998';
      video.style.borderRadius = '4px';
      video.style.border = '1px solid #ccc';
      document.body.appendChild(video);
    } else {
      video.style.display = 'none';
      document.body.appendChild(video);
    }
    
    this.currentSession.video = video;
    
    // Wait for video to be ready
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play().then(resolve);
      };
    });
    
    // Start capture loop
    const captureLoop = async () => {
      if (!this.isCapturing || this.currentSession.cancellationToken.isCancelled) {
        return;
      }
      
      try {
        await this.captureFrame();
      } catch (error) {
        this.logger.error('Error in capture loop', error);
      }
      
      // Schedule next capture
      const targetInterval = 1000 / this.frameRate;
      setTimeout(captureLoop, targetInterval);
    };
    
    // Start the capture loop
    captureLoop();
  }
  
  /**
   * Starts OpenCV-based camera capture.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async startOpenCVCapture() {
    const deviceIndex = parseInt(this.activeDevice.id, 10) || 0;
    const camera = new cv.VideoCapture(deviceIndex);
    
    // Set camera properties
    camera.set(cv.CAP_PROP_FRAME_WIDTH, this.width);
    camera.set(cv.CAP_PROP_FRAME_HEIGHT, this.height);
    camera.set(cv.CAP_PROP_FPS, this.frameRate);
    
    this.currentSession.camera = camera;
    
    // Start capture interval
    const captureInterval = 1000 / this.frameRate;
    this.captureInterval = setInterval(async () => {
      if (!this.isCapturing || this.currentSession.cancellationToken.isCancelled) {
        clearInterval(this.captureInterval);
        return;
      }
      
      try {
        await this.captureFrame();
      } catch (error) {
        this.logger.error('Error in capture interval', error);
      }
    }, captureInterval);
  }
  
  /**
   * Starts node-webcam based camera capture.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async startNodeWebcamCapture() {
    const opts = {
      width: this.width,
      height: this.height,
      quality: 100,
      frames: this.frameRate,
      delay: 0,
      saveShots: false,
      output: 'jpeg',
      device: this.activeDevice.id || false,
      callbackReturn: 'buffer',
      verbose: false
    };
    
    const Webcam = nodeWebcam.create(opts);
    this.currentSession.webcam = Webcam;
    
    // Start capture interval
    const captureInterval = 1000 / this.frameRate;
    this.captureInterval = setInterval(async () => {
      if (!this.isCapturing || this.currentSession.cancellationToken.isCancelled) {
        clearInterval(this.captureInterval);
        return;
      }
      
      try {
        await this.captureFrame();
      } catch (error) {
        this.logger.error('Error in capture interval', error);
      }
    }, captureInterval);
  }
  
  /**
   * Stops capturing frames from the camera.
   * 
   * @returns {Promise<Object>} - Session summary
   */
  async stopCapture() {
    return await this.captureLock.acquire(async () => {
      try {
        if (!this.isCapturing || !this.currentSession) {
          this.logger.info('No active camera capture to stop');
          return null;
        }
        
        this.logger.info(`Stopping camera capture for session: ${this.currentSession.id}`);
        
        // Cancel any ongoing operations
        this.currentSession.cancellationToken.cancel();
        
        // Clear capture interval if exists
        if (this.captureInterval) {
          clearInterval(this.captureInterval);
          this.captureInterval = null;
        }
        
        // Clean up resources based on platform
        if (process.type === 'renderer' || process.type === 'browser') {
          // Electron/browser environment
          if (this.currentSession.stream) {
            this.currentSession.stream.getTracks().forEach(track => track.stop());
          }
          
          if (this.currentSession.video) {
            this.currentSession.video.pause();
            this.currentSession.video.srcObject = null;
            if (this.currentSession.video.parentNode) {
              this.currentSession.video.parentNode.removeChild(this.currentSession.video);
            }
          }
        } else if (cv && this.currentSession.camera) {
          // OpenCV environment
          this.currentSession.camera.release();
        }
        
        // Hide privacy indicator
        this.hidePrivacyIndicator();
        
        const sessionSummary = {
          id: this.currentSession.id,
          duration: Date.now() - this.currentSession.startTime,
          frameCount: this.currentSession.frameCount,
          device: this.activeDevice
        };
        
        this.isCapturing = false;
        this.emit('captureStopped', sessionSummary);
        
        this.logger.info(`Camera capture stopped for session: ${sessionSummary.id}`);
        
        // Clear current session
        this.currentSession = null;
        
        return sessionSummary;
      } catch (error) {
        this.logger.error('Failed to stop camera capture', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Captures a single frame from the active camera.
   * 
   * @private
   * @returns {Promise<Object>} - Captured frame data
   */
  async captureFrame() {
    try {
      if (!this.isCapturing || !this.currentSession) {
        throw new Error('No active capture session');
      }
      
      let frameData = null;
      
      // Capture frame based on platform
      if (process.type === 'renderer' || process.type === 'browser') {
        // Electron/browser environment
        frameData = await this.captureBrowserFrame();
      } else if (cv && this.currentSession.camera) {
        // OpenCV environment
        frameData = await this.captureOpenCVFrame();
      } else if (nodeWebcam && this.currentSession.webcam) {
        // Node-webcam environment
        frameData = await this.captureNodeWebcamFrame();
      } else {
        throw new Error('No camera capture method available');
      }
      
      if (!frameData) {
        throw new Error('Failed to capture frame');
      }
      
      // Update frame count
      this.currentSession.frameCount++;
      
      // Process the frame if enabled
      if (this.processingEnabled) {
        frameData = await this.processFrame(frameData);
      }
      
      // Handle frame retention if enabled
      if (this.privacyConfig.retention.enabled) {
        await this.handleFrameRetention(frameData);
      }
      
      // Emit frame event
      this.emit('frame', {
        sessionId: this.currentSession.id,
        frameIndex: this.currentSession.frameCount,
        timestamp: Date.now(),
        frame: frameData
      });
      
      return frameData;
    } catch (error) {
      this.logger.error('Failed to capture frame', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Captures a frame in browser environment.
   * 
   * @private
   * @returns {Promise<Object>} - Captured frame data
   */
  async captureBrowserFrame() {
    const video = this.currentSession.video;
    if (!video) {
      throw new Error('Video element not available');
    }
    
    // Create canvas for frame capture
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    return {
      width: canvas.width,
      height: canvas.height,
      data: imageData,
      format: 'imageData',
      timestamp: Date.now()
    };
  }
  
  /**
   * Captures a frame using OpenCV.
   * 
   * @private
   * @returns {Promise<Object>} - Captured frame data
   */
  async captureOpenCVFrame() {
    const camera = this.currentSession.camera;
    if (!camera) {
      throw new Error('Camera not available');
    }
    
    // Read frame
    const frame = camera.read();
    if (frame.empty) {
      throw new Error('Empty frame captured');
    }
    
    return {
      width: frame.cols,
      height: frame.rows,
      data: frame,
      format: 'mat',
      timestamp: Date.now()
    };
  }
  
  /**
   * Captures a frame using node-webcam.
   * 
   * @private
   * @returns {Promise<Object>} - Captured frame data
   */
  async captureNodeWebcamFrame() {
    const webcam = this.currentSession.webcam;
    if (!webcam) {
      throw new Error('Webcam not available');
    }
    
    // Capture image
    const buffer = await new Promise((resolve, reject) => {
      webcam.capture('', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    
    return {
      width: this.width,
      height: this.height,
      data: buffer,
      format: 'jpeg',
      timestamp: Date.now()
    };
  }
  
  /**
   * Processes a captured frame, applying privacy filters.
   * 
   * @private
   * @param {Object} frameData - Raw frame data
   * @returns {Promise<Object>} - Processed frame data
   */
  async processFrame(frameData) {
    try {
      // Apply privacy filters if configured
      if (this.privacyConfig.applyBackgroundBlur || this.privacyConfig.privacyZones.length > 0) {
        frameData = await this.applyPrivacyFilters(frameData);
      }
      
      return frameData;
    } catch (error) {
      this.logger.error('Failed to process frame', error);
      return frameData; // Return original frame on error
    }
  }
  
  /**
   * Applies privacy filters to a frame.
   * 
   * @private
   * @param {Object} frameData - Frame data to process
   * @returns {Promise<Object>} - Processed frame data
   */
  async applyPrivacyFilters(frameData) {
    try {
      if (cv && frameData.format === 'mat') {
        // OpenCV-based processing
        let mat = frameData.data;
        
        // Apply background blur if enabled
        if (this.privacyConfig.applyBackgroundBlur) {
          // For production, we implement person segmentation and selective blurring
          try {
            // Try to detect people in the frame
            const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2);
            const faces = classifier.detectMultiScale(mat);
            
            if (faces.length > 0) {
              // Create a mask for the detected people
              const mask = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC1, 0);
              
              // Draw detected faces on the mask
              for (const face of faces) {
                // Expand the face region to include more of the person
                const expandedFace = new cv.Rect(
                  Math.max(0, face.x - face.width * 0.5),
                  Math.max(0, face.y - face.height * 0.5),
                  face.width * 2,
                  face.height * 3
                );
                mask.drawRectangle(expandedFace, new cv.Vec(255), -1);
              }
              
              // Create a blurred version of the original image
              const blurSize = this.privacyConfig.blurIntensity * 2 + 1;
              const blurred = mat.gaussianBlur(new cv.Size(blurSize, blurSize), 0);
              
              // Combine original (for faces) and blurred (for background) using the mask
              const result = new cv.Mat();
              mat.copyTo(result);
              blurred.copyTo(result, mask.not());
              
              mat = result;
            } else {
              // No faces detected, apply a lighter blur to the entire image
              const blurSize = Math.max(3, this.privacyConfig.blurIntensity);
              mat = mat.gaussianBlur(new cv.Size(blurSize, blurSize), 0);
            }
          } catch (segmentationError) {
            // Fall back to simple blur if segmentation fails
            this.logger.error('Person segmentation failed, falling back to simple blur', segmentationError);
            const blurSize = this.privacyConfig.blurIntensity * 2 + 1;
            mat = mat.gaussianBlur(new cv.Size(blurSize, blurSize), 0);
          }
        }
        
        // Apply privacy zones if any
        for (const zone of this.privacyConfig.privacyZones) {
          const rect = new cv.Rect(
            Math.floor(zone.x * mat.cols),
            Math.floor(zone.y * mat.rows),
            Math.floor(zone.width * mat.cols),
            Math.floor(zone.height * mat.rows)
          );
          
          // Fill the region with black
          mat.drawRectangle(rect, new cv.Vec3(0, 0, 0), -1);
        }
        
        frameData.data = mat;
      } else if (frameData.format === 'imageData') {
        // Browser ImageData processing
        const imageData = frameData.data;
        const width = frameData.width;
        const height = frameData.height;
        
        // Create a canvas for processing
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw the original image
        ctx.putImageData(imageData, 0, 0);
        
        // Apply background blur if enabled
        if (this.privacyConfig.applyBackgroundBlur) {
          // For browser environment, we use a combination of canvas filters
          // and face detection via a lightweight library or WebGL shader
          
          // First, create a copy of the original image for later use
          const originalCanvas = document.createElement('canvas');
          originalCanvas.width = width;
          originalCanvas.height = height;
          const originalCtx = originalCanvas.getContext('2d');
          originalCtx.putImageData(imageData, 0, 0);
          
          // Apply blur to the main canvas
          const blurAmount = this.privacyConfig.blurIntensity;
          ctx.filter = `blur(${blurAmount}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';
          
          // If face detection is available, try to preserve faces
          // This would typically use a library like face-api.js
          // For this implementation, we'll use a simplified approach
          
          try {
            // Check if face detection is available (would be injected by the app)
            if (window.faceapi) {
              // Detect faces
              const detections = await window.faceapi.detectAllFaces(canvas);
              
              if (detections && detections.length > 0) {
                // For each detected face, copy the unblurred version back
                for (const detection of detections) {
                  const { x, y, width, height } = detection.box;
                  // Expand the face region slightly
                  const expandedX = Math.max(0, x - width * 0.2);
                  const expandedY = Math.max(0, y - height * 0.2);
                  const expandedWidth = width * 1.4;
                  const expandedHeight = height * 1.8;
                  
                  // Copy the original (unblurred) face back
                  ctx.drawImage(
                    originalCanvas,
                    expandedX, expandedY, expandedWidth, expandedHeight,
                    expandedX, expandedY, expandedWidth, expandedHeight
                  );
                }
              }
            }
          } catch (faceDetectionError) {
            // Face detection failed, continue with full blur
            this.logger.error('Face detection failed in browser', faceDetectionError);
          }
        }
        
        // Apply privacy zones if any
        for (const zone of this.privacyConfig.privacyZones) {
          ctx.fillStyle = 'black';
          ctx.fillRect(
            Math.floor(zone.x * width),
            Math.floor(zone.y * height),
            Math.floor(zone.width * width),
            Math.floor(zone.height * height)
          );
        }
        
        // Get the processed image data
        frameData.data = ctx.getImageData(0, 0, width, height);
      } else if (frameData.format === 'jpeg') {
        // For JPEG format, we would need to decode, process, and re-encode
        // This is a more complex operation that would typically use
        // a library like Sharp or a native module
        
        // For now, we'll just pass through the JPEG data
        // In a production environment, this would be implemented
        // based on the specific requirements and available libraries
        this.logger.warn('Privacy filtering for JPEG format not implemented');
      }
      
      return frameData;
    } catch (error) {
      this.logger.error('Failed to apply privacy filters', error);
      return frameData; // Return original frame on error
    }
  }
  
  /**
   * Handles frame retention according to policy.
   * 
   * @private
   * @param {Object} frameData - Frame data to retain
   * @returns {Promise<void>}
   */
  async handleFrameRetention(frameData) {
    if (!this.privacyConfig.retention.enabled) {
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `frame_${this.currentSession.id}_${timestamp}.jpg`;
      const filePath = path.join(this.privacyConfig.retention.storagePath, filename);
      
      // Save frame based on format
      if (frameData.format === 'mat' && cv) {
        // OpenCV Mat
        cv.imwrite(filePath, frameData.data);
      } else if (frameData.format === 'jpeg') {
        // JPEG buffer
        await fs.writeFile(filePath, frameData.data);
      } else if (frameData.format === 'imageData') {
        // Browser ImageData
        // Convert to JPEG and save
        const canvas = document.createElement('canvas');
        canvas.width = frameData.width;
        canvas.height = frameData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(frameData.data, 0, 0);
        
        // Convert to blob and save
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        const buffer = await blob.arrayBuffer();
        
        // Use Node.js fs to write file
        await fs.writeFile(filePath, Buffer.from(buffer));
      }
      
      // Add to frame buffer
      this.frameBuffer.push({
        path: filePath,
        timestamp: Date.now()
      });
      
      // Clean up old frames based on retention policy
      await this.cleanupOldFrames();
    } catch (error) {
      this.logger.error('Failed to handle frame retention', error);
    }
  }
  
  /**
   * Cleans up old frames based on retention policy.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async cleanupOldFrames() {
    if (!this.privacyConfig.retention.enabled || this.privacyConfig.retention.duration <= 0) {
      return;
    }
    
    try {
      const now = Date.now();
      const cutoff = now - this.privacyConfig.retention.duration;
      
      // Find frames to delete
      const framesToDelete = this.frameBuffer.filter(frame => frame.timestamp < cutoff);
      
      // Remove from buffer
      this.frameBuffer = this.frameBuffer.filter(frame => frame.timestamp >= cutoff);
      
      // Delete files
      for (const frame of framesToDelete) {
        try {
          await fs.unlink(frame.path);
        } catch (e) {
          // Ignore errors for individual files
        }
      }
      
      if (framesToDelete.length > 0) {
        this.logger.info(`Cleaned up ${framesToDelete.length} old frames`);
      }
    } catch (error) {
      this.logger.error('Failed to clean up old frames', error);
    }
  }
  
  /**
   * Shuts down the CameraInputService and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('CameraInputService not initialized');
          return true;
        }
        
        this.logger.info('Shutting down CameraInputService');
        
        // Stop any active capture
        if (this.isCapturing) {
          await this.stopCapture();
        }
        
        // Clean up privacy indicator
        this.hidePrivacyIndicator();
        if (this.privacyIndicator && this.privacyIndicator.parentNode) {
          this.privacyIndicator.parentNode.removeChild(this.privacyIndicator);
        }
        this.privacyIndicator = null;
        
        // Clean up frame buffer
        this.frameBuffer = [];
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('CameraInputService shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down CameraInputService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Handles errors.
   * 
   * @private
   * @param {Error} error - Error object
   */
  handleError(error) {
    this.logger.error('Error in CameraInputService', error);
    this.emit('error', error);
  }
  
  /**
   * Sets privacy configuration.
   * 
   * @param {Object} config - Privacy configuration
   * @returns {boolean} - True if successful
   */
  setPrivacyConfig(config) {
    try {
      // Update privacy configuration
      if (config.enablePrivacyIndicator !== undefined) {
        this.privacyConfig.enablePrivacyIndicator = config.enablePrivacyIndicator;
      }
      
      if (config.applyBackgroundBlur !== undefined) {
        this.privacyConfig.applyBackgroundBlur = config.applyBackgroundBlur;
      }
      
      if (config.blurIntensity !== undefined) {
        this.privacyConfig.blurIntensity = config.blurIntensity;
      }
      
      if (config.privacyZones !== undefined) {
        this.privacyConfig.privacyZones = config.privacyZones;
      }
      
      if (config.retention !== undefined) {
        if (config.retention.enabled !== undefined) {
          this.privacyConfig.retention.enabled = config.retention.enabled;
        }
        
        if (config.retention.duration !== undefined) {
          this.privacyConfig.retention.duration = config.retention.duration;
        }
        
        if (config.retention.storagePath !== undefined) {
          this.privacyConfig.retention.storagePath = config.retention.storagePath;
        }
      }
      
      this.logger.info('Updated privacy configuration');
      this.emit('privacyConfigChanged', this.privacyConfig);
      return true;
    } catch (error) {
      this.logger.error('Failed to set privacy configuration', error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Gets the current privacy configuration.
   * 
   * @returns {Object} - Privacy configuration
   */
  getPrivacyConfig() {
    return { ...this.privacyConfig };
  }
  
  /**
   * Enables or disables frame processing.
   * 
   * @param {boolean} enabled - Whether processing is enabled
   */
  setProcessingEnabled(enabled) {
    this.processingEnabled = enabled;
    this.logger.info(`Frame processing ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Add module.exports at the end of the file
module.exports = { CameraInputService };
