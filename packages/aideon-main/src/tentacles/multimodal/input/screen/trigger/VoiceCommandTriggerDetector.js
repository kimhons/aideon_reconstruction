/**
 * @fileoverview Voice Command Trigger Detector for automatic screen recording.
 * 
 * This module detects voice commands related to screen recording
 * and triggers automatic recording when appropriate.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const TriggerDetector = require('./TriggerDetector');

/**
 * Voice Command Trigger Detector.
 * @extends TriggerDetector
 */
class VoiceCommandTriggerDetector extends TriggerDetector {
  /**
   * Creates a new VoiceCommandTriggerDetector instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Detector configuration
   * @param {Object} options.voiceInputManager - Voice input manager
   * @param {Object} options.naturalLanguageProcessor - Natural language processor
   */
  constructor(options = {}) {
    super(options);
    
    this.voiceInputManager = options.voiceInputManager;
    this.naturalLanguageProcessor = options.naturalLanguageProcessor;
    this.boundHandleVoiceCommand = this.handleVoiceCommand.bind(this);
    
    // Default configuration
    this.config = {
      suggestedDuration: 300, // 5 minutes
      confidenceThreshold: 0.7,
      recordingCommands: [
        'record screen',
        'start recording',
        'capture screen',
        'watch this',
        'learn from this',
        'remember this',
        'observe this'
      ],
      stopCommands: [
        'stop recording',
        'end recording',
        'finish recording',
        'stop watching',
        'stop observing'
      ],
      ...this.config
    };
    
    // Active recording session
    this.activeSession = null;
  }
  
  /**
   * Initializes the trigger detector.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('Voice command trigger detector already initialized');
      return;
    }
    
    this.logger.info('Initializing voice command trigger detector');
    
    if (!this.voiceInputManager) {
      throw new Error('Voice input manager is required');
    }
    
    this.initialized = true;
    this.logger.info('Voice command trigger detector initialized successfully');
  }
  
  /**
   * Starts detection.
   * @returns {Promise<void>}
   */
  async startDetection() {
    if (!this.initialized) {
      throw new Error('Voice command trigger detector not initialized');
    }
    
    if (this.detecting) {
      this.logger.warn('Voice command trigger detector already detecting');
      return;
    }
    
    this.logger.info('Starting voice command detection');
    
    // Register command handlers
    if (this.voiceInputManager.on) {
      this.voiceInputManager.on('command', this.boundHandleVoiceCommand);
    } else if (this.voiceInputManager.registerCommandHandler) {
      this.voiceInputManager.registerCommandHandler(this.boundHandleVoiceCommand);
    } else {
      throw new Error('Voice input manager does not support command handling');
    }
    
    // Register specific commands if supported
    if (this.voiceInputManager.registerCommands) {
      const allCommands = [
        ...this.config.recordingCommands,
        ...this.config.stopCommands
      ];
      
      await this.voiceInputManager.registerCommands(allCommands, {
        category: 'screen_recording',
        handler: this.boundHandleVoiceCommand
      });
    }
    
    this.detecting = true;
    this.logger.info('Voice command detection started');
  }
  
  /**
   * Stops detection.
   * @returns {Promise<void>}
   */
  async stopDetection() {
    if (!this.detecting) {
      this.logger.warn('Voice command trigger detector not detecting');
      return;
    }
    
    this.logger.info('Stopping voice command detection');
    
    // Remove command handlers
    if (this.voiceInputManager.off) {
      this.voiceInputManager.off('command', this.boundHandleVoiceCommand);
    } else if (this.voiceInputManager.unregisterCommandHandler) {
      this.voiceInputManager.unregisterCommandHandler(this.boundHandleVoiceCommand);
    }
    
    // Unregister specific commands if supported
    if (this.voiceInputManager.unregisterCommands) {
      const allCommands = [
        ...this.config.recordingCommands,
        ...this.config.stopCommands
      ];
      
      await this.voiceInputManager.unregisterCommands(allCommands, {
        category: 'screen_recording'
      });
    }
    
    this.detecting = false;
    this.logger.info('Voice command detection stopped');
  }
  
  /**
   * Gets detector type.
   * @returns {string} Detector type
   */
  getType() {
    return 'voice';
  }
  
  /**
   * Gets detector name.
   * @returns {string} Detector name
   */
  getName() {
    return 'Voice Command Trigger Detector';
  }
  
  /**
   * Gets detector description.
   * @returns {string} Detector description
   */
  getDescription() {
    return 'Detects voice commands related to screen recording and triggers automatic recording';
  }
  
  /**
   * Handles voice command.
   * @param {Object} command - Voice command
   * @private
   */
  async handleVoiceCommand(command) {
    try {
      this.logger.debug(`Received voice command: ${JSON.stringify(command)}`);
      
      // Extract command text
      const commandText = command.text || command.command || '';
      
      if (!commandText) {
        return;
      }
      
      // Check confidence
      const confidence = command.confidence || 1.0;
      if (confidence < this.config.confidenceThreshold) {
        this.logger.debug(`Command confidence too low: ${confidence}`);
        return;
      }
      
      // Process command intent
      let intent = '';
      let intentConfidence = 0;
      
      if (this.naturalLanguageProcessor && this.naturalLanguageProcessor.classifyIntent) {
        // Use NLP to classify intent
        const intentResult = await this.naturalLanguageProcessor.classifyIntent(commandText, {
          categories: ['start_recording', 'stop_recording', 'other']
        });
        
        intent = intentResult.intent;
        intentConfidence = intentResult.confidence;
      } else {
        // Simple keyword matching
        intent = this.classifyCommandIntent(commandText);
        intentConfidence = 0.9; // Assume high confidence for keyword matching
      }
      
      // Handle intent
      if (intent === 'start_recording' && !this.activeSession) {
        this.startRecordingFromVoiceCommand(command, intentConfidence);
      } else if (intent === 'stop_recording' && this.activeSession) {
        this.stopRecordingFromVoiceCommand(command);
      }
    } catch (error) {
      this.logger.error(`Failed to handle voice command: ${error.message}`);
    }
  }
  
  /**
   * Classifies command intent using simple keyword matching.
   * @param {string} commandText - Command text
   * @returns {string} Intent
   * @private
   */
  classifyCommandIntent(commandText) {
    const normalizedCommand = commandText.toLowerCase().trim();
    
    // Check for start recording commands
    for (const cmd of this.config.recordingCommands) {
      if (normalizedCommand.includes(cmd.toLowerCase())) {
        return 'start_recording';
      }
    }
    
    // Check for stop recording commands
    for (const cmd of this.config.stopCommands) {
      if (normalizedCommand.includes(cmd.toLowerCase())) {
        return 'stop_recording';
      }
    }
    
    return 'other';
  }
  
  /**
   * Starts recording from voice command.
   * @param {Object} command - Voice command
   * @param {number} intentConfidence - Intent confidence
   * @private
   */
  startRecordingFromVoiceCommand(command, intentConfidence) {
    this.logger.info('Starting recording from voice command');
    
    // Store active session
    this.activeSession = {
      id: `voice-${Date.now()}`,
      startTime: Date.now(),
      command: command.text || ''
    };
    
    // Calculate combined confidence
    const commandConfidence = command.confidence || 1.0;
    const combinedConfidence = (commandConfidence + intentConfidence) / 2;
    
    // Emit trigger event
    this.emitTriggerEvent({
      confidence: combinedConfidence,
      context: {
        command: command.text || '',
        sessionId: this.activeSession.id,
        source: 'voice_command'
      },
      suggestedDuration: this.config.suggestedDuration,
      metadata: {
        voiceCommand: true,
        originalCommand: command,
        sessionId: this.activeSession.id
      }
    });
  }
  
  /**
   * Stops recording from voice command.
   * @param {Object} command - Voice command
   * @private
   */
  stopRecordingFromVoiceCommand(command) {
    if (!this.activeSession) {
      return;
    }
    
    this.logger.info('Stopping recording from voice command');
    
    // Emit deactivation event if callback supports it
    if (this.callback && typeof this.callback === 'function') {
      const deactivationEvent = this.createTriggerEvent({
        confidence: command.confidence || 1.0,
        context: {
          command: command.text || '',
          sessionId: this.activeSession.id,
          endReason: 'voice_command'
        },
        metadata: {
          deactivation: true,
          originalCommand: command
        }
      });
      
      deactivationEvent.deactivate = true;
      this.callback(deactivationEvent);
    }
    
    // Clear active session
    this.activeSession = null;
  }
}

module.exports = VoiceCommandTriggerDetector;
