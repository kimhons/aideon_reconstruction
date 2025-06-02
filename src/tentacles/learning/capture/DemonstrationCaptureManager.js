/**
 * @fileoverview DemonstrationCaptureManager for the Learning from Demonstration system.
 * Manages the capture and recording of user demonstrations across various input modalities.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const EventBus = require('../common/events/EventBus');
const Logger = require('../common/utils/Logger');
const Configuration = require('../common/utils/Configuration');
const { LearningError, ValidationError, OperationError } = require('../common/utils/ErrorHandler');
const Demonstration = require('../common/models/Demonstration');
const Action = require('../common/models/Action');
const { v4: uuidv4 } = require('uuid');

/**
 * Manages the capture and recording of user demonstrations.
 */
class DemonstrationCaptureManager {
  /**
   * Capture states
   * @enum {string}
   */
  static STATES = {
    IDLE: 'idle',
    PREPARING: 'preparing',
    CAPTURING: 'capturing',
    PAUSED: 'paused',
    FINALIZING: 'finalizing',
    ERROR: 'error'
  };

  /**
   * Creates a new DemonstrationCaptureManager instance.
   * @param {Object} options - Manager options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger('DemonstrationCaptureManager');
    this.config = options.config || new Configuration(DemonstrationCaptureManager.defaultConfig());
    
    this.captureModules = new Map();
    this.activeCapture = null;
    this.state = DemonstrationCaptureManager.STATES.IDLE;
    this.demonstrations = new Map();
    
    this._setupEventListeners();
    this.logger.info('DemonstrationCaptureManager initialized');
  }

  /**
   * Default configuration for the DemonstrationCaptureManager.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      capture: {
        autoStart: false,
        defaultName: 'Untitled Demonstration',
        maxDuration: 3600000, // 1 hour in milliseconds
        autoFinalize: true,
        includeScreenshots: true,
        captureInterval: 100, // milliseconds between capture events
        noiseReduction: true,
        compressionLevel: 'medium', // 'none', 'low', 'medium', 'high'
        modules: {
          mouse: {
            enabled: true,
            captureMove: true,
            moveThreshold: 5, // minimum pixels moved to record
            captureClick: true,
            captureDrag: true,
            captureScroll: true
          },
          keyboard: {
            enabled: true,
            captureKeyPress: true,
            captureTextInput: true,
            maskSensitiveInput: true,
            sensitiveFieldTypes: ['password', 'credit-card']
          },
          screen: {
            enabled: true,
            captureInterval: 1000, // milliseconds between screenshots
            resolution: 'medium', // 'low', 'medium', 'high'
            captureActiveWindowOnly: false,
            detectSignificantChanges: true,
            changeThreshold: 0.1 // 10% change required to capture
          },
          voice: {
            enabled: false,
            captureCommands: true,
            captureTranscription: false,
            language: 'en-US'
          }
        }
      }
    };
  }

  /**
   * Registers a capture module.
   * @param {string} moduleId - Unique identifier for the module
   * @param {Object} module - Capture module instance
   * @returns {DemonstrationCaptureManager} This instance for chaining
   */
  registerCaptureModule(moduleId, module) {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new ValidationError('Module ID is required and must be a string');
    }
    
    if (!module || typeof module !== 'object') {
      throw new ValidationError('Module must be an object');
    }
    
    if (typeof module.initialize !== 'function' || 
        typeof module.startCapture !== 'function' || 
        typeof module.stopCapture !== 'function') {
      throw new ValidationError('Module must implement initialize, startCapture, and stopCapture methods');
    }
    
    this.captureModules.set(moduleId, module);
    this.logger.info(`Registered capture module: ${moduleId}`);
    
    return this;
  }

  /**
   * Unregisters a capture module.
   * @param {string} moduleId - Unique identifier for the module
   * @returns {boolean} True if module was unregistered, false if not found
   */
  unregisterCaptureModule(moduleId) {
    const result = this.captureModules.delete(moduleId);
    
    if (result) {
      this.logger.info(`Unregistered capture module: ${moduleId}`);
    }
    
    return result;
  }

  /**
   * Starts capturing a demonstration.
   * @param {Object} [options={}] - Capture options
   * @param {string} [options.name] - Name for the demonstration
   * @param {string} [options.description] - Description for the demonstration
   * @param {Object} [options.metadata={}] - Additional metadata
   * @param {Object} [options.context={}] - Capture context
   * @param {string[]} [options.modules] - Specific modules to enable (defaults to all registered)
   * @returns {Promise<string>} Promise resolving to the demonstration ID
   */
  async startCapture(options = {}) {
    if (this.state !== DemonstrationCaptureManager.STATES.IDLE) {
      throw new OperationError(`Cannot start capture in state: ${this.state}`);
    }
    
    try {
      this.state = DemonstrationCaptureManager.STATES.PREPARING;
      this.logger.info('Preparing to start capture', options);
      
      // Create a new demonstration
      const demonstrationId = uuidv4();
      const name = options.name || this.config.get('capture.defaultName');
      const demonstration = new Demonstration({
        id: demonstrationId,
        name,
        description: options.description || '',
        metadata: options.metadata || {},
        context: options.context || {}
      });
      
      this.demonstrations.set(demonstrationId, demonstration);
      
      // Determine which modules to use
      const moduleIds = options.modules || Array.from(this.captureModules.keys());
      const activeModules = new Map();
      
      // Initialize and start each module
      for (const moduleId of moduleIds) {
        const module = this.captureModules.get(moduleId);
        
        if (!module) {
          this.logger.warn(`Module not found: ${moduleId}`);
          continue;
        }
        
        const moduleConfig = this.config.scope(`capture.modules.${moduleId}`);
        
        if (!moduleConfig.get('enabled', true)) {
          this.logger.debug(`Module disabled: ${moduleId}`);
          continue;
        }
        
        try {
          await module.initialize(moduleConfig);
          await module.startCapture({
            demonstrationId,
            onAction: (action) => this._handleCapturedAction(demonstrationId, action)
          });
          
          activeModules.set(moduleId, module);
          this.logger.debug(`Started capture module: ${moduleId}`);
        } catch (error) {
          this.logger.error(`Failed to start module: ${moduleId}`, error);
        }
      }
      
      if (activeModules.size === 0) {
        throw new OperationError('No capture modules could be started');
      }
      
      // Set up active capture
      this.activeCapture = {
        demonstrationId,
        startTime: new Date(),
        modules: activeModules,
        options
      };
      
      this.state = DemonstrationCaptureManager.STATES.CAPTURING;
      
      // Set up auto-finalize if configured
      const maxDuration = this.config.get('capture.maxDuration');
      if (maxDuration > 0) {
        this.activeCapture.finalizeTimeout = setTimeout(() => {
          this.logger.info(`Auto-finalizing capture after ${maxDuration}ms`);
          this.stopCapture();
        }, maxDuration);
      }
      
      this.logger.info(`Started capture: ${demonstrationId}`);
      this.eventBus.emit('capture:started', { demonstrationId, name });
      
      return demonstrationId;
    } catch (error) {
      this.state = DemonstrationCaptureManager.STATES.ERROR;
      this.logger.error('Failed to start capture', error);
      this.eventBus.emit('capture:error', { error });
      throw error;
    }
  }

  /**
   * Pauses the current capture.
   * @returns {Promise<void>} Promise resolving when capture is paused
   */
  async pauseCapture() {
    if (this.state !== DemonstrationCaptureManager.STATES.CAPTURING) {
      throw new OperationError(`Cannot pause capture in state: ${this.state}`);
    }
    
    try {
      this.logger.info('Pausing capture');
      
      // Pause each active module
      for (const [moduleId, module] of this.activeCapture.modules) {
        try {
          if (typeof module.pauseCapture === 'function') {
            await module.pauseCapture();
            this.logger.debug(`Paused module: ${moduleId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to pause module: ${moduleId}`, error);
        }
      }
      
      this.state = DemonstrationCaptureManager.STATES.PAUSED;
      this.eventBus.emit('capture:paused', { demonstrationId: this.activeCapture.demonstrationId });
    } catch (error) {
      this.logger.error('Failed to pause capture', error);
      this.eventBus.emit('capture:error', { error });
      throw error;
    }
  }

  /**
   * Resumes a paused capture.
   * @returns {Promise<void>} Promise resolving when capture is resumed
   */
  async resumeCapture() {
    if (this.state !== DemonstrationCaptureManager.STATES.PAUSED) {
      throw new OperationError(`Cannot resume capture in state: ${this.state}`);
    }
    
    try {
      this.logger.info('Resuming capture');
      
      // Resume each active module
      for (const [moduleId, module] of this.activeCapture.modules) {
        try {
          if (typeof module.resumeCapture === 'function') {
            await module.resumeCapture();
            this.logger.debug(`Resumed module: ${moduleId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to resume module: ${moduleId}`, error);
        }
      }
      
      this.state = DemonstrationCaptureManager.STATES.CAPTURING;
      this.eventBus.emit('capture:resumed', { demonstrationId: this.activeCapture.demonstrationId });
    } catch (error) {
      this.logger.error('Failed to resume capture', error);
      this.eventBus.emit('capture:error', { error });
      throw error;
    }
  }

  /**
   * Stops and finalizes the current capture.
   * @returns {Promise<Demonstration>} Promise resolving to the finalized demonstration
   */
  async stopCapture() {
    if (this.state !== DemonstrationCaptureManager.STATES.CAPTURING && 
        this.state !== DemonstrationCaptureManager.STATES.PAUSED) {
      throw new OperationError(`Cannot stop capture in state: ${this.state}`);
    }
    
    try {
      this.state = DemonstrationCaptureManager.STATES.FINALIZING;
      this.logger.info('Finalizing capture');
      
      // Clear auto-finalize timeout if set
      if (this.activeCapture.finalizeTimeout) {
        clearTimeout(this.activeCapture.finalizeTimeout);
      }
      
      // Stop each active module
      for (const [moduleId, module] of this.activeCapture.modules) {
        try {
          await module.stopCapture();
          this.logger.debug(`Stopped module: ${moduleId}`);
        } catch (error) {
          this.logger.error(`Failed to stop module: ${moduleId}`, error);
        }
      }
      
      const demonstrationId = this.activeCapture.demonstrationId;
      const demonstration = this.demonstrations.get(demonstrationId);
      
      if (!demonstration) {
        throw new OperationError(`Demonstration not found: ${demonstrationId}`);
      }
      
      // Sort actions by timestamp
      demonstration.sortActions();
      
      // Update metadata
      demonstration.updateMetadata({
        captureEndTime: new Date(),
        captureStartTime: this.activeCapture.startTime,
        moduleIds: Array.from(this.activeCapture.modules.keys())
      });
      
      this.activeCapture = null;
      this.state = DemonstrationCaptureManager.STATES.IDLE;
      
      this.logger.info(`Finalized capture: ${demonstrationId}`);
      this.eventBus.emit('capture:stopped', { demonstrationId, demonstration });
      
      return demonstration;
    } catch (error) {
      this.state = DemonstrationCaptureManager.STATES.ERROR;
      this.logger.error('Failed to stop capture', error);
      this.eventBus.emit('capture:error', { error });
      throw error;
    }
  }

  /**
   * Gets a demonstration by ID.
   * @param {string} demonstrationId - Demonstration ID
   * @returns {Demonstration|null} Demonstration or null if not found
   */
  getDemonstration(demonstrationId) {
    return this.demonstrations.get(demonstrationId) || null;
  }

  /**
   * Gets all demonstrations.
   * @returns {Array<Demonstration>} Array of demonstrations
   */
  getAllDemonstrations() {
    return Array.from(this.demonstrations.values());
  }

  /**
   * Deletes a demonstration.
   * @param {string} demonstrationId - Demonstration ID
   * @returns {boolean} True if demonstration was deleted, false if not found
   */
  deleteDemonstration(demonstrationId) {
    const result = this.demonstrations.delete(demonstrationId);
    
    if (result) {
      this.logger.info(`Deleted demonstration: ${demonstrationId}`);
      this.eventBus.emit('demonstration:deleted', { demonstrationId });
    }
    
    return result;
  }

  /**
   * Gets the current capture state.
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Gets the active capture information.
   * @returns {Object|null} Active capture info or null if not capturing
   */
  getActiveCapture() {
    if (!this.activeCapture) {
      return null;
    }
    
    return {
      demonstrationId: this.activeCapture.demonstrationId,
      startTime: this.activeCapture.startTime,
      moduleIds: Array.from(this.activeCapture.modules.keys()),
      state: this.state
    };
  }

  /**
   * Handles a captured action from a module.
   * @param {string} demonstrationId - Demonstration ID
   * @param {Object} actionData - Action data
   * @private
   */
  _handleCapturedAction(demonstrationId, actionData) {
    try {
      const demonstration = this.demonstrations.get(demonstrationId);
      
      if (!demonstration) {
        this.logger.warn(`Received action for unknown demonstration: ${demonstrationId}`);
        return;
      }
      
      // Create action ID if not provided
      if (!actionData.id) {
        actionData.id = uuidv4();
      }
      
      // Create timestamp if not provided
      if (!actionData.timestamp) {
        actionData.timestamp = new Date();
      } else if (!(actionData.timestamp instanceof Date)) {
        actionData.timestamp = new Date(actionData.timestamp);
      }
      
      // Create action and add to demonstration
      const action = new Action(actionData);
      demonstration.addAction(action);
      
      this.logger.debug(`Captured action: ${action.type}`, { 
        demonstrationId, 
        actionId: action.id 
      });
      
      this.eventBus.emit('action:captured', { 
        demonstrationId, 
        action 
      });
    } catch (error) {
      this.logger.error('Failed to handle captured action', error);
    }
  }

  /**
   * Sets up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Example: Listen for configuration changes
    this.config.addChangeListener((key, newValue, oldValue) => {
      this.logger.debug(`Configuration changed: ${key}`, { newValue, oldValue });
    });
  }
}

module.exports = DemonstrationCaptureManager;
