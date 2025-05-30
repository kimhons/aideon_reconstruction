/**
 * @fileoverview MCP Voice Context Provider for the Aideon AI Desktop Agent.
 * 
 * This module integrates the Voice Recognition module with the MCP Context Manager,
 * enabling voice input events, speech recognition results, and intent detection
 * to be shared as context across the Aideon system and with other applications via MCP.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * MCP Voice Context Provider for the Aideon AI Desktop Agent.
 * 
 * This class provides integration between the Voice Recognition module
 * and the MCP Context Manager, enabling unified context sharing.
 */
class MCPVoiceContextProvider extends EventEmitter {
  /**
   * Creates a new MCP Voice Context Provider.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.contextManager] - MCP Context Manager instance
   * @param {Object} [options.voiceInputManager] - Voice Input Manager instance
   * @param {Object} [options.intentRecognitionService] - Intent Recognition Service instance
   * @param {Object} [options.config] - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger || console;
    this.contextManager = options.contextManager;
    this.voiceInputManager = options.voiceInputManager;
    this.intentRecognitionService = options.intentRecognitionService;
    
    // Default configuration
    this.config = {
      enableVoiceEvents: true,
      enableSpeechRecognition: true,
      enableIntentDetection: true,
      minConfidenceThreshold: 0.6,
      contextExpiry: {
        voiceEvents: 30 * 60 * 1000, // 30 minutes
        speechRecognition: 60 * 60 * 1000, // 1 hour
        intentDetection: 2 * 60 * 60 * 1000 // 2 hours
      },
      privacySettings: {
        includeAudioData: false,
        includeFullTranscript: true,
        includeUserIdentifiers: false
      },
      ...options.config
    };
    
    // Initialize state
    this.isInitialized = false;
    this.eventHandlers = new Map();
    
    this.logger.info('MCP Voice Context Provider created');
  }
  
  /**
   * Initializes the MCP Voice Context Provider.
   * 
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('MCP Voice Context Provider already initialized');
      return true;
    }
    
    try {
      this.logger.info('Initializing MCP Voice Context Provider');
      
      // Verify dependencies
      if (!this.contextManager) {
        throw new Error('MCP Context Manager is required');
      }
      
      if (!this.voiceInputManager) {
        throw new Error('Voice Input Manager is required');
      }
      
      // Register event handlers
      if (this.config.enableVoiceEvents) {
        this.registerVoiceEventHandlers();
      }
      
      if (this.config.enableSpeechRecognition) {
        this.registerSpeechRecognitionHandlers();
      }
      
      if (this.config.enableIntentDetection && this.intentRecognitionService) {
        this.registerIntentDetectionHandlers();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('MCP Voice Context Provider initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize MCP Voice Context Provider:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the MCP Voice Context Provider.
   * 
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    if (!this.isInitialized) {
      this.logger.warn('MCP Voice Context Provider not initialized');
      return true;
    }
    
    try {
      this.logger.info('Shutting down MCP Voice Context Provider');
      
      // Unregister all event handlers
      this.unregisterAllEventHandlers();
      
      this.isInitialized = false;
      this.emit('shutdown');
      this.logger.info('MCP Voice Context Provider shut down successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down MCP Voice Context Provider:', error);
      throw error;
    }
  }
  
  /**
   * Registers event handlers for voice events.
   * 
   * @private
   */
  registerVoiceEventHandlers() {
    this.logger.debug('Registering voice event handlers');
    
    // Handler for voice capture started event
    const voiceCaptureStartedHandler = (captureInfo) => {
      this.handleVoiceCaptureStarted(captureInfo);
    };
    this.voiceInputManager.on('captureStarted', voiceCaptureStartedHandler);
    this.eventHandlers.set('captureStarted', voiceCaptureStartedHandler);
    
    // Handler for voice capture stopped event
    const voiceCaptureStoppedHandler = (captureInfo) => {
      this.handleVoiceCaptureStopped(captureInfo);
    };
    this.voiceInputManager.on('captureStopped', voiceCaptureStoppedHandler);
    this.eventHandlers.set('captureStopped', voiceCaptureStoppedHandler);
    
    // Handler for voice capture error event
    const voiceCaptureErrorHandler = (error) => {
      this.handleVoiceCaptureError(error);
    };
    this.voiceInputManager.on('captureError', voiceCaptureErrorHandler);
    this.eventHandlers.set('captureError', voiceCaptureErrorHandler);
    
    // Handler for voice activity detected event
    const voiceActivityDetectedHandler = (activityInfo) => {
      this.handleVoiceActivityDetected(activityInfo);
    };
    this.voiceInputManager.on('voiceActivityDetected', voiceActivityDetectedHandler);
    this.eventHandlers.set('voiceActivityDetected', voiceActivityDetectedHandler);
  }
  
  /**
   * Registers event handlers for speech recognition.
   * 
   * @private
   */
  registerSpeechRecognitionHandlers() {
    this.logger.debug('Registering speech recognition handlers');
    
    // Handler for speech recognition started event
    const speechRecognitionStartedHandler = (recognitionInfo) => {
      this.handleSpeechRecognitionStarted(recognitionInfo);
    };
    this.voiceInputManager.on('recognitionStarted', speechRecognitionStartedHandler);
    this.eventHandlers.set('recognitionStarted', speechRecognitionStartedHandler);
    
    // Handler for speech recognition result event
    const speechRecognitionResultHandler = (recognitionResult) => {
      this.handleSpeechRecognitionResult(recognitionResult);
    };
    this.voiceInputManager.on('recognitionResult', speechRecognitionResultHandler);
    this.eventHandlers.set('recognitionResult', speechRecognitionResultHandler);
    
    // Handler for speech recognition completed event
    const speechRecognitionCompletedHandler = (recognitionInfo) => {
      this.handleSpeechRecognitionCompleted(recognitionInfo);
    };
    this.voiceInputManager.on('recognitionCompleted', speechRecognitionCompletedHandler);
    this.eventHandlers.set('recognitionCompleted', speechRecognitionCompletedHandler);
    
    // Handler for speech recognition error event
    const speechRecognitionErrorHandler = (error) => {
      this.handleSpeechRecognitionError(error);
    };
    this.voiceInputManager.on('recognitionError', speechRecognitionErrorHandler);
    this.eventHandlers.set('recognitionError', speechRecognitionErrorHandler);
  }
  
  /**
   * Registers event handlers for intent detection.
   * 
   * @private
   */
  registerIntentDetectionHandlers() {
    this.logger.debug('Registering intent detection handlers');
    
    // Handler for intent detected event
    const intentDetectedHandler = (intentInfo) => {
      this.handleIntentDetected(intentInfo);
    };
    this.intentRecognitionService.on('intentDetected', intentDetectedHandler);
    this.eventHandlers.set('intentDetected', intentDetectedHandler);
    
    // Handler for command detected event
    const commandDetectedHandler = (commandInfo) => {
      this.handleCommandDetected(commandInfo);
    };
    this.intentRecognitionService.on('commandDetected', commandDetectedHandler);
    this.eventHandlers.set('commandDetected', commandDetectedHandler);
    
    // Handler for entity detected event
    const entityDetectedHandler = (entityInfo) => {
      this.handleEntityDetected(entityInfo);
    };
    this.intentRecognitionService.on('entityDetected', entityDetectedHandler);
    this.eventHandlers.set('entityDetected', entityDetectedHandler);
  }
  
  /**
   * Unregisters all event handlers.
   * 
   * @private
   */
  unregisterAllEventHandlers() {
    this.logger.debug('Unregistering all event handlers');
    
    // Unregister voice event handlers
    if (this.voiceInputManager) {
      const voiceEvents = ['captureStarted', 'captureStopped', 'captureError', 'voiceActivityDetected',
                          'recognitionStarted', 'recognitionResult', 'recognitionCompleted', 'recognitionError'];
      
      for (const event of voiceEvents) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
          this.voiceInputManager.off(event, handler);
        }
      }
    }
    
    // Unregister intent detection handlers
    if (this.intentRecognitionService) {
      const intentEvents = ['intentDetected', 'commandDetected', 'entityDetected'];
      
      for (const event of intentEvents) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
          this.intentRecognitionService.off(event, handler);
        }
      }
    }
    
    // Clear event handlers
    this.eventHandlers.clear();
  }
  
  /**
   * Handles voice capture started event.
   * 
   * @private
   * @param {Object} captureInfo - Voice capture information
   */
  async handleVoiceCaptureStarted(captureInfo) {
    try {
      this.logger.debug('Handling voice capture started event');
      
      // Create context
      const context = {
        type: 'voice.capture.started',
        data: {
          captureId: captureInfo.id,
          timestamp: captureInfo.startTime,
          source: captureInfo.source,
          sampleRate: captureInfo.sampleRate,
          channels: captureInfo.channels,
          reason: captureInfo.reason || 'manual'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['voice', 'capture', 'started'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.voiceEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added voice capture started context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle voice capture started event:', error);
    }
  }
  
  /**
   * Handles voice capture stopped event.
   * 
   * @private
   * @param {Object} captureInfo - Voice capture information
   */
  async handleVoiceCaptureStopped(captureInfo) {
    try {
      this.logger.debug('Handling voice capture stopped event');
      
      // Create context
      const context = {
        type: 'voice.capture.stopped',
        data: {
          captureId: captureInfo.id,
          startTime: captureInfo.startTime,
          endTime: captureInfo.endTime,
          duration: captureInfo.duration,
          reason: captureInfo.reason || 'manual'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['voice', 'capture', 'stopped'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.voiceEvents
      };
      
      // Add audio data if enabled
      if (this.config.privacySettings.includeAudioData && captureInfo.audioData) {
        context.data.audioData = {
          format: captureInfo.audioFormat,
          size: captureInfo.audioSize,
          duration: captureInfo.duration
        };
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added voice capture stopped context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle voice capture stopped event:', error);
    }
  }
  
  /**
   * Handles voice capture error event.
   * 
   * @private
   * @param {Object} error - Error information
   */
  async handleVoiceCaptureError(error) {
    try {
      this.logger.debug('Handling voice capture error event');
      
      // Create context
      const context = {
        type: 'voice.capture.error',
        data: {
          message: error.message,
          code: error.code,
          timestamp: Date.now(),
          details: error.details || {}
        },
        priority: 8, // Higher priority for errors
        confidence: 1.0,
        tags: ['voice', 'capture', 'error'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.voiceEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added voice capture error context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle voice capture error event:', error);
    }
  }
  
  /**
   * Handles voice activity detected event.
   * 
   * @private
   * @param {Object} activityInfo - Voice activity information
   */
  async handleVoiceActivityDetected(activityInfo) {
    try {
      this.logger.debug('Handling voice activity detected event');
      
      // Create context
      const context = {
        type: 'voice.activity.detected',
        data: {
          captureId: activityInfo.captureId,
          timestamp: activityInfo.timestamp,
          duration: activityInfo.duration,
          energy: activityInfo.energy,
          isSpeech: activityInfo.isSpeech
        },
        priority: 5,
        confidence: activityInfo.confidence || 0.8,
        tags: ['voice', 'activity', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.voiceEvents
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added voice activity detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle voice activity detected event:', error);
    }
  }
  
  /**
   * Handles speech recognition started event.
   * 
   * @private
   * @param {Object} recognitionInfo - Speech recognition information
   */
  async handleSpeechRecognitionStarted(recognitionInfo) {
    try {
      this.logger.debug('Handling speech recognition started event');
      
      // Create context
      const context = {
        type: 'voice.recognition.started',
        data: {
          captureId: recognitionInfo.captureId,
          recognitionId: recognitionInfo.id,
          timestamp: recognitionInfo.startTime,
          provider: recognitionInfo.provider,
          language: recognitionInfo.language,
          mode: recognitionInfo.mode || 'default'
        },
        priority: 6,
        confidence: 1.0,
        tags: ['voice', 'recognition', 'started'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.speechRecognition
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added speech recognition started context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle speech recognition started event:', error);
    }
  }
  
  /**
   * Handles speech recognition result event.
   * 
   * @private
   * @param {Object} recognitionResult - Speech recognition result
   */
  async handleSpeechRecognitionResult(recognitionResult) {
    try {
      this.logger.debug('Handling speech recognition result event');
      
      // Skip if confidence is below threshold
      if (recognitionResult.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping speech recognition result event due to low confidence: ${recognitionResult.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'voice.recognition.result',
        data: {
          captureId: recognitionResult.captureId,
          recognitionId: recognitionResult.recognitionId,
          timestamp: recognitionResult.timestamp,
          isFinal: recognitionResult.isFinal || false,
          language: recognitionResult.language
        },
        priority: recognitionResult.isFinal ? 7 : 5,
        confidence: recognitionResult.confidence,
        tags: ['voice', 'recognition', 'result'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.speechRecognition
      };
      
      // Add transcript if enabled
      if (this.config.privacySettings.includeFullTranscript) {
        context.data.transcript = recognitionResult.transcript;
        
        // Add alternatives if available
        if (recognitionResult.alternatives && recognitionResult.alternatives.length > 0) {
          context.data.alternatives = recognitionResult.alternatives.map(alt => ({
            transcript: alt.transcript,
            confidence: alt.confidence
          }));
        }
      } else {
        // Add only length information
        context.data.transcriptLength = recognitionResult.transcript ? recognitionResult.transcript.length : 0;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added speech recognition result context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle speech recognition result event:', error);
    }
  }
  
  /**
   * Handles speech recognition completed event.
   * 
   * @private
   * @param {Object} recognitionInfo - Speech recognition information
   */
  async handleSpeechRecognitionCompleted(recognitionInfo) {
    try {
      this.logger.debug('Handling speech recognition completed event');
      
      // Create context
      const context = {
        type: 'voice.recognition.completed',
        data: {
          captureId: recognitionInfo.captureId,
          recognitionId: recognitionInfo.id,
          startTime: recognitionInfo.startTime,
          endTime: recognitionInfo.endTime,
          duration: recognitionInfo.duration,
          provider: recognitionInfo.provider,
          language: recognitionInfo.language
        },
        priority: 6,
        confidence: 1.0,
        tags: ['voice', 'recognition', 'completed'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.speechRecognition
      };
      
      // Add final transcript if enabled
      if (this.config.privacySettings.includeFullTranscript && recognitionInfo.finalTranscript) {
        context.data.finalTranscript = recognitionInfo.finalTranscript;
      } else if (recognitionInfo.finalTranscript) {
        // Add only length information
        context.data.finalTranscriptLength = recognitionInfo.finalTranscript.length;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added speech recognition completed context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle speech recognition completed event:', error);
    }
  }
  
  /**
   * Handles speech recognition error event.
   * 
   * @private
   * @param {Object} error - Error information
   */
  async handleSpeechRecognitionError(error) {
    try {
      this.logger.debug('Handling speech recognition error event');
      
      // Create context
      const context = {
        type: 'voice.recognition.error',
        data: {
          captureId: error.captureId,
          recognitionId: error.recognitionId,
          message: error.message,
          code: error.code,
          timestamp: Date.now(),
          provider: error.provider,
          details: error.details || {}
        },
        priority: 8, // Higher priority for errors
        confidence: 1.0,
        tags: ['voice', 'recognition', 'error'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.speechRecognition
      };
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added speech recognition error context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle speech recognition error event:', error);
    }
  }
  
  /**
   * Handles intent detected event.
   * 
   * @private
   * @param {Object} intentInfo - Intent information
   */
  async handleIntentDetected(intentInfo) {
    try {
      this.logger.debug('Handling intent detected event');
      
      // Skip if confidence is below threshold
      if (intentInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping intent detected event due to low confidence: ${intentInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'voice.intent.detected',
        data: {
          captureId: intentInfo.captureId,
          recognitionId: intentInfo.recognitionId,
          timestamp: intentInfo.timestamp,
          intent: intentInfo.intent,
          domain: intentInfo.domain || 'general',
          parameters: intentInfo.parameters || {}
        },
        priority: 7,
        confidence: intentInfo.confidence,
        tags: ['voice', 'intent', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.intentDetection
      };
      
      // Add transcript if enabled
      if (this.config.privacySettings.includeFullTranscript && intentInfo.transcript) {
        context.data.transcript = intentInfo.transcript;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added intent detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle intent detected event:', error);
    }
  }
  
  /**
   * Handles command detected event.
   * 
   * @private
   * @param {Object} commandInfo - Command information
   */
  async handleCommandDetected(commandInfo) {
    try {
      this.logger.debug('Handling command detected event');
      
      // Skip if confidence is below threshold
      if (commandInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping command detected event due to low confidence: ${commandInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'voice.command.detected',
        data: {
          captureId: commandInfo.captureId,
          recognitionId: commandInfo.recognitionId,
          timestamp: commandInfo.timestamp,
          command: commandInfo.command,
          action: commandInfo.action,
          target: commandInfo.target,
          parameters: commandInfo.parameters || {}
        },
        priority: 8, // Higher priority for commands
        confidence: commandInfo.confidence,
        tags: ['voice', 'command', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.intentDetection
      };
      
      // Add transcript if enabled
      if (this.config.privacySettings.includeFullTranscript && commandInfo.transcript) {
        context.data.transcript = commandInfo.transcript;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added command detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle command detected event:', error);
    }
  }
  
  /**
   * Handles entity detected event.
   * 
   * @private
   * @param {Object} entityInfo - Entity information
   */
  async handleEntityDetected(entityInfo) {
    try {
      this.logger.debug('Handling entity detected event');
      
      // Skip if confidence is below threshold
      if (entityInfo.confidence < this.config.minConfidenceThreshold) {
        this.logger.debug(`Skipping entity detected event due to low confidence: ${entityInfo.confidence}`);
        return;
      }
      
      // Create context
      const context = {
        type: 'voice.entity.detected',
        data: {
          captureId: entityInfo.captureId,
          recognitionId: entityInfo.recognitionId,
          timestamp: entityInfo.timestamp,
          entityType: entityInfo.entityType,
          entityValue: entityInfo.entityValue,
          startIndex: entityInfo.startIndex,
          endIndex: entityInfo.endIndex
        },
        priority: 6,
        confidence: entityInfo.confidence,
        tags: ['voice', 'entity', 'detected'],
        expiryTimestamp: Date.now() + this.config.contextExpiry.intentDetection
      };
      
      // Add transcript if enabled
      if (this.config.privacySettings.includeFullTranscript && entityInfo.transcript) {
        context.data.transcript = entityInfo.transcript;
      }
      
      // Add user identifiers if enabled
      if (this.config.privacySettings.includeUserIdentifiers && entityInfo.isUserIdentifier) {
        context.data.isUserIdentifier = true;
        context.data.identifierType = entityInfo.identifierType;
      }
      
      // Add context to MCP Context Manager
      await this.contextManager.addContext(context);
      
      this.logger.debug('Added entity detected context to MCP Context Manager');
    } catch (error) {
      this.logger.error('Failed to handle entity detected event:', error);
    }
  }
}

module.exports = { MCPVoiceContextProvider };
