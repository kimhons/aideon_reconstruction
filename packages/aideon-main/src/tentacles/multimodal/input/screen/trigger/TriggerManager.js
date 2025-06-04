/**
 * @fileoverview Trigger Manager for automatic screen recording activation.
 * 
 * This module manages the detection and activation of automatic screen recording
 * triggers, coordinating between various trigger detectors and the screen recording manager.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { EnhancedAsyncLock, EnhancedAsyncOperation } = require('../utils');

/**
 * Events emitted by the TriggerManager
 * @enum {string}
 */
const TriggerManagerEvent = {
  TRIGGER_REGISTERED: 'trigger-registered',
  TRIGGER_UNREGISTERED: 'trigger-unregistered',
  TRIGGER_ACTIVATED: 'trigger-activated',
  TRIGGER_DEACTIVATED: 'trigger-deactivated',
  RECORDING_STARTED: 'recording-started',
  RECORDING_STOPPED: 'recording-stopped',
  ERROR_OCCURRED: 'error-occurred'
};

/**
 * Manager for automatic screen recording triggers.
 * @extends EventEmitter
 */
class TriggerManager extends EventEmitter {
  /**
   * Creates a new TriggerManager instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.screenRecordingManager - Screen recording manager instance
   * @param {Object} options.configManager - Configuration manager
   */
  constructor(options = {}) {
    super();
    
    // Store dependencies
    this.logger = options.logger || console;
    this.screenRecordingManager = options.screenRecordingManager;
    this.configManager = options.configManager;
    
    // Initialize state
    this.initialized = false;
    this.activeRecordings = new Map(); // Map of triggerId -> recordingInfo
    this.registeredTriggers = new Map(); // Map of triggerId -> triggerDetector
    
    // Create async lock
    this.operationLock = new EnhancedAsyncLock({
      logger: this.logger,
      name: 'TriggerManager-Lock',
      defaultTimeout: 30000 // 30 seconds default
    });
    
    // Default configuration
    this.config = {
      enabledTriggers: ['learning', 'voice', 'error'],
      requireUserReview: true,
      maxAutomaticDuration: 300, // 5 minutes
      cooldownPeriod: 60, // 1 minute between automatic triggers
      privacySettings: {
        disableInSensitiveApps: true,
        sensitiveApps: ['banking', 'password', 'health']
      }
    };
    
    // Bind methods to preserve context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.registerTrigger = this.registerTrigger.bind(this);
    this.unregisterTrigger = this.unregisterTrigger.bind(this);
    this.processTriggerEvent = this.processTriggerEvent.bind(this);
    this.startAutomaticRecording = this.startAutomaticRecording.bind(this);
    this.stopAutomaticRecording = this.stopAutomaticRecording.bind(this);
    this.getUserPreferences = this.getUserPreferences.bind(this);
    this.updateConfiguration = this.updateConfiguration.bind(this);
  }
  
  /**
   * Initializes the trigger manager.
   * @returns {Promise<void>}
   */
  async initialize() {
    return EnhancedAsyncOperation.execute(async (token) => {
      return this.operationLock.withLock(async () => {
        if (this.initialized) {
          this.logger.warn('Trigger manager already initialized');
          return;
        }
        
        this.logger.info('Initializing trigger manager');
        
        try {
          // Load configuration
          if (this.configManager) {
            const config = await this.configManager.getConfig('triggerManager');
            if (config) {
              this.config = { ...this.config, ...config };
            }
          }
          
          // Validate screen recording manager
          if (!this.screenRecordingManager) {
            throw new Error('Screen recording manager is required');
          }
          
          // Initialize registered triggers
          for (const [triggerId, detector] of this.registeredTriggers.entries()) {
            try {
              await detector.initialize();
              
              // Set callback for trigger events
              detector.setCallback(this.processTriggerEvent);
              
              // Start detection if trigger is enabled
              if (this.isTriggerEnabled(detector.getType())) {
                await detector.startDetection();
              }
            } catch (error) {
              this.logger.error(`Failed to initialize trigger detector ${triggerId}: ${error.message}`);
            }
          }
          
          this.initialized = true;
          this.logger.info('Trigger manager initialized successfully');
        } catch (error) {
          this.logger.error(`Failed to initialize trigger manager: ${error.message}`);
          throw error;
        }
      }, {
        owner: 'initialize'
      });
    }, {
      operationName: 'TriggerManager.initialize',
      logger: this.logger,
      timeout: 60000, // 60 seconds
      retries: 2
    });
  }
  
  /**
   * Shuts down the trigger manager.
   * @returns {Promise<void>}
   */
  async shutdown() {
    return EnhancedAsyncOperation.execute(async (token) => {
      return this.operationLock.withLock(async () => {
        if (!this.initialized) {
          this.logger.warn('Trigger manager not initialized');
          return;
        }
        
        this.logger.info('Shutting down trigger manager');
        
        try {
          // Stop all active recordings
          for (const [triggerId, recordingInfo] of this.activeRecordings.entries()) {
            try {
              await this.stopAutomaticRecording(triggerId);
            } catch (error) {
              this.logger.warn(`Failed to stop recording for trigger ${triggerId}: ${error.message}`);
            }
          }
          
          // Shutdown all trigger detectors
          for (const [triggerId, detector] of this.registeredTriggers.entries()) {
            try {
              await detector.stopDetection();
            } catch (error) {
              this.logger.warn(`Failed to stop trigger detector ${triggerId}: ${error.message}`);
            }
          }
          
          this.initialized = false;
          this.logger.info('Trigger manager shut down successfully');
        } catch (error) {
          this.logger.error(`Failed to shut down trigger manager: ${error.message}`);
          throw error;
        }
      }, {
        owner: 'shutdown'
      });
    }, {
      operationName: 'TriggerManager.shutdown',
      logger: this.logger,
      timeout: 30000 // 30 seconds
    });
  }
  
  /**
   * Registers a new trigger detector.
   * @param {Object} triggerDetector - Trigger detector instance
   * @returns {Promise<string>} Trigger ID
   */
  async registerTrigger(triggerDetector) {
    return EnhancedAsyncOperation.execute(async (token) => {
      return this.operationLock.withLock(async () => {
        if (!triggerDetector) {
          throw new Error('Trigger detector is required');
        }
        
        // Get trigger metadata
        const metadata = triggerDetector.getMetadata();
        const triggerId = metadata.id || `trigger-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        this.logger.info(`Registering trigger detector: ${triggerId}`);
        
        // Store trigger detector
        this.registeredTriggers.set(triggerId, triggerDetector);
        
        // Initialize and start if manager is already initialized
        if (this.initialized) {
          await triggerDetector.initialize();
          
          // Set callback for trigger events
          triggerDetector.setCallback(this.processTriggerEvent);
          
          // Start detection if trigger is enabled
          if (this.isTriggerEnabled(triggerDetector.getType())) {
            await triggerDetector.startDetection();
          }
        }
        
        // Emit event
        this.emit(TriggerManagerEvent.TRIGGER_REGISTERED, {
          triggerId,
          metadata
        });
        
        return triggerId;
      }, {
        owner: 'registerTrigger'
      });
    }, {
      operationName: 'TriggerManager.registerTrigger',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Unregisters a trigger detector.
   * @param {string} triggerId - Trigger ID
   * @returns {Promise<boolean>} Success
   */
  async unregisterTrigger(triggerId) {
    return EnhancedAsyncOperation.execute(async (token) => {
      return this.operationLock.withLock(async () => {
        if (!triggerId) {
          throw new Error('Trigger ID is required');
        }
        
        this.logger.info(`Unregistering trigger detector: ${triggerId}`);
        
        // Check if trigger exists
        if (!this.registeredTriggers.has(triggerId)) {
          this.logger.warn(`Trigger detector not found: ${triggerId}`);
          return false;
        }
        
        // Get trigger detector
        const triggerDetector = this.registeredTriggers.get(triggerId);
        
        // Stop detection
        if (this.initialized) {
          try {
            await triggerDetector.stopDetection();
          } catch (error) {
            this.logger.warn(`Failed to stop trigger detector ${triggerId}: ${error.message}`);
          }
        }
        
        // Stop any active recording
        if (this.activeRecordings.has(triggerId)) {
          try {
            await this.stopAutomaticRecording(triggerId);
          } catch (error) {
            this.logger.warn(`Failed to stop recording for trigger ${triggerId}: ${error.message}`);
          }
        }
        
        // Remove trigger detector
        this.registeredTriggers.delete(triggerId);
        
        // Emit event
        this.emit(TriggerManagerEvent.TRIGGER_UNREGISTERED, {
          triggerId
        });
        
        return true;
      }, {
        owner: 'unregisterTrigger'
      });
    }, {
      operationName: 'TriggerManager.unregisterTrigger',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Processes a trigger event.
   * @param {Object} event - Trigger event
   * @returns {Promise<void>}
   */
  async processTriggerEvent(event) {
    try {
      if (!event || !event.triggerId) {
        this.logger.warn('Invalid trigger event');
        return;
      }
      
      this.logger.info(`Processing trigger event: ${event.triggerId}`);
      
      // Check if trigger is enabled
      if (!this.isTriggerEnabled(event.triggerType)) {
        this.logger.info(`Trigger type ${event.triggerType} is disabled`);
        return;
      }
      
      // Check if in cooldown period
      if (this.isInCooldownPeriod()) {
        this.logger.info('In cooldown period, ignoring trigger');
        return;
      }
      
      // Check privacy settings
      if (this.shouldBlockForPrivacy(event)) {
        this.logger.info('Blocking trigger due to privacy settings');
        return;
      }
      
      // Check if trigger is already active
      if (this.activeRecordings.has(event.triggerId)) {
        this.logger.info(`Trigger ${event.triggerId} already has an active recording`);
        return;
      }
      
      // Start automatic recording
      await this.startAutomaticRecording(event);
      
      // Emit event
      this.emit(TriggerManagerEvent.TRIGGER_ACTIVATED, {
        ...event
      });
    } catch (error) {
      this.logger.error(`Failed to process trigger event: ${error.message}`);
      
      // Emit error event
      this.emit(TriggerManagerEvent.ERROR_OCCURRED, {
        error,
        context: 'processTriggerEvent',
        event
      });
    }
  }
  
  /**
   * Starts an automatic recording based on a trigger event.
   * @param {Object} event - Trigger event
   * @returns {Promise<Object>} Recording info
   * @private
   */
  async startAutomaticRecording(event) {
    if (!this.initialized) {
      throw new Error('Trigger manager not initialized');
    }
    
    if (!this.screenRecordingManager) {
      throw new Error('Screen recording manager not available');
    }
    
    this.logger.info(`Starting automatic recording for trigger: ${event.triggerId}`);
    
    // Prepare recording options
    const recordingOptions = {
      type: 'fullScreen',
      frameRate: 30,
      resolution: '1080p',
      compressionLevel: 'medium',
      captureAudio: false,
      analyzeInRealTime: true,
      triggerMetadata: {
        triggerId: event.triggerId,
        triggerType: event.triggerType,
        triggerContext: event.context,
        isAutomaticRecording: true,
        userReviewed: false,
        suggestedDuration: event.suggestedDuration || this.config.maxAutomaticDuration
      }
    };
    
    // Start recording
    const recordingInfo = await this.screenRecordingManager.startRecording(recordingOptions);
    
    // Store active recording
    this.activeRecordings.set(event.triggerId, {
      ...recordingInfo,
      triggerEvent: event,
      startTime: Date.now()
    });
    
    // Set timeout for maximum duration
    const maxDuration = Math.min(
      event.suggestedDuration || Infinity,
      this.config.maxAutomaticDuration
    );
    
    if (maxDuration && isFinite(maxDuration)) {
      setTimeout(() => {
        if (this.activeRecordings.has(event.triggerId)) {
          this.logger.info(`Maximum duration reached for trigger ${event.triggerId}, stopping recording`);
          this.stopAutomaticRecording(event.triggerId).catch(error => {
            this.logger.error(`Failed to stop automatic recording: ${error.message}`);
          });
        }
      }, maxDuration * 1000);
    }
    
    // Emit event
    this.emit(TriggerManagerEvent.RECORDING_STARTED, {
      triggerId: event.triggerId,
      recordingInfo
    });
    
    return recordingInfo;
  }
  
  /**
   * Stops an automatic recording.
   * @param {string} triggerId - Trigger ID
   * @returns {Promise<Object>} Recording info
   * @private
   */
  async stopAutomaticRecording(triggerId) {
    if (!this.initialized) {
      throw new Error('Trigger manager not initialized');
    }
    
    if (!this.screenRecordingManager) {
      throw new Error('Screen recording manager not available');
    }
    
    if (!this.activeRecordings.has(triggerId)) {
      throw new Error(`No active recording for trigger ${triggerId}`);
    }
    
    this.logger.info(`Stopping automatic recording for trigger: ${triggerId}`);
    
    // Stop recording
    const recordingInfo = await this.screenRecordingManager.stopRecording();
    
    // Get active recording info
    const activeRecording = this.activeRecordings.get(triggerId);
    
    // Remove active recording
    this.activeRecordings.delete(triggerId);
    
    // Update last trigger time for cooldown
    this.lastTriggerTime = Date.now();
    
    // Handle user review if required
    if (this.config.requireUserReview) {
      // TODO: Implement user review mechanism
      this.logger.info(`Recording requires user review: ${recordingInfo.id}`);
    }
    
    // Emit event
    this.emit(TriggerManagerEvent.RECORDING_STOPPED, {
      triggerId,
      recordingInfo,
      duration: Date.now() - activeRecording.startTime
    });
    
    return recordingInfo;
  }
  
  /**
   * Gets user preferences for triggers.
   * @returns {Object} User preferences
   */
  getUserPreferences() {
    return { ...this.config };
  }
  
  /**
   * Updates the configuration.
   * @param {Object} config - New configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(config = {}) {
    return EnhancedAsyncOperation.execute(async (token) => {
      return this.operationLock.withLock(async () => {
        this.logger.info('Updating trigger manager configuration');
        
        try {
          // Update local configuration
          const oldConfig = { ...this.config };
          this.config = { ...this.config, ...config };
          
          // Handle enabled/disabled triggers
          if (config.enabledTriggers && this.initialized) {
            for (const [triggerId, detector] of this.registeredTriggers.entries()) {
              const triggerType = detector.getType();
              const wasEnabled = oldConfig.enabledTriggers.includes(triggerType);
              const isEnabled = this.config.enabledTriggers.includes(triggerType);
              
              if (!wasEnabled && isEnabled) {
                // Trigger was enabled
                await detector.startDetection();
              } else if (wasEnabled && !isEnabled) {
                // Trigger was disabled
                await detector.stopDetection();
                
                // Stop any active recording
                if (this.activeRecordings.has(triggerId)) {
                  await this.stopAutomaticRecording(triggerId);
                }
              }
            }
          }
          
          // Save configuration if config manager is available
          if (this.configManager) {
            await this.configManager.setConfig('triggerManager', this.config);
          }
          
          this.logger.info('Trigger manager configuration updated successfully');
          
          return { ...this.config };
        } catch (error) {
          this.logger.error(`Failed to update trigger manager configuration: ${error.message}`);
          throw error;
        }
      }, {
        owner: 'updateConfiguration'
      });
    }, {
      operationName: 'TriggerManager.updateConfiguration',
      logger: this.logger,
      timeout: 10000 // 10 seconds
    });
  }
  
  /**
   * Checks if a trigger type is enabled.
   * @param {string} triggerType - Trigger type
   * @returns {boolean} Whether the trigger is enabled
   * @private
   */
  isTriggerEnabled(triggerType) {
    return this.config.enabledTriggers.includes(triggerType);
  }
  
  /**
   * Checks if in cooldown period.
   * @returns {boolean} Whether in cooldown period
   * @private
   */
  isInCooldownPeriod() {
    if (!this.lastTriggerTime) {
      return false;
    }
    
    const elapsed = (Date.now() - this.lastTriggerTime) / 1000;
    return elapsed < this.config.cooldownPeriod;
  }
  
  /**
   * Checks if a trigger should be blocked due to privacy settings.
   * @param {Object} event - Trigger event
   * @returns {boolean} Whether the trigger should be blocked
   * @private
   */
  shouldBlockForPrivacy(event) {
    if (!this.config.privacySettings.disableInSensitiveApps) {
      return false;
    }
    
    // Check if current application is in sensitive apps list
    // TODO: Implement application context detection
    return false;
  }
}

module.exports = {
  TriggerManager,
  TriggerManagerEvent
};
