/**
 * @fileoverview VoiceInputManager is the central orchestrator for the voice processing pipeline
 * in the Aideon AI Desktop Agent. It manages the initialization, configuration, and coordination
 * of all voice processing components.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { LogManager } = require('../../../core/logging/LogManager');
const { ConfigManager } = require('../../../core/config/ConfigManager');
const { SecurityManager } = require('../../../core/security/SecurityManager');
const { PerformanceTracker } = require('../../../core/performance/PerformanceTracker');

/**
 * Voice processing states
 * @enum {string}
 */
const VoiceProcessingState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error',
  PAUSED: 'paused'
};

/**
 * Voice processing events
 * @enum {string}
 */
const VoiceProcessingEvent = {
  STATE_CHANGED: 'stateChanged',
  AUDIO_CAPTURED: 'audioCaptured',
  SPEECH_RECOGNIZED: 'speechRecognized',
  INTENT_DETECTED: 'intentDetected',
  COMMAND_EXECUTED: 'commandExecuted',
  ERROR_OCCURRED: 'errorOccurred',
  PROCESSING_COMPLETE: 'processingComplete'
};

/**
 * Error types for voice processing
 * @enum {string}
 */
const VoiceProcessingErrorType = {
  INITIALIZATION_FAILED: 'initializationFailed',
  AUDIO_CAPTURE_FAILED: 'audioCaptureFailed',
  SPEECH_RECOGNITION_FAILED: 'speechRecognitionFailed',
  INTENT_DETECTION_FAILED: 'intentDetectionFailed',
  COMMAND_EXECUTION_FAILED: 'commandExecutionFailed',
  PERMISSION_DENIED: 'permissionDenied',
  NETWORK_ERROR: 'networkError',
  UNKNOWN_ERROR: 'unknownError'
};

/**
 * VoiceInputManager class
 * Central orchestrator for voice processing pipeline
 */
class VoiceInputManager extends EventEmitter {
  /**
   * Create a new VoiceInputManager
   * @param {Object} options - Configuration options
   * @param {Object} options.audioCaptureService - Audio capture service instance
   * @param {Object} options.speechRecognitionEngine - Speech recognition engine instance
   * @param {Object} options.naturalLanguageProcessor - Natural language processor instance
   * @param {Object} options.voiceCommandRegistry - Voice command registry instance
   * @param {Object} [options.noiseFilteringService] - Optional noise filtering service
   * @param {Object} [options.continuousListeningManager] - Optional continuous listening manager
   * @param {Object} [options.languageModelIntegration] - Optional language model integration
   * @param {Object} [options.logger] - Optional custom logger
   * @param {Object} [options.configManager] - Optional custom config manager
   * @param {Object} [options.securityManager] - Optional custom security manager
   * @param {Object} [options.performanceTracker] - Optional custom performance tracker
   */
  constructor(options) {
    super();
    
    // Validate required options
    if (!options.audioCaptureService) {
      throw new Error('AudioCaptureService is required');
    }
    if (!options.speechRecognitionEngine) {
      throw new Error('SpeechRecognitionEngine is required');
    }
    if (!options.naturalLanguageProcessor) {
      throw new Error('NaturalLanguageProcessor is required');
    }
    if (!options.voiceCommandRegistry) {
      throw new Error('VoiceCommandRegistry is required');
    }
    
    // Initialize core services
    this.audioCaptureService = options.audioCaptureService;
    this.speechRecognitionEngine = options.speechRecognitionEngine;
    this.naturalLanguageProcessor = options.naturalLanguageProcessor;
    this.voiceCommandRegistry = options.voiceCommandRegistry;
    
    // Initialize optional services
    this.noiseFilteringService = options.noiseFilteringService || null;
    this.continuousListeningManager = options.continuousListeningManager || null;
    this.languageModelIntegration = options.languageModelIntegration || null;
    
    // Initialize system services
    this.logger = options.logger || LogManager.getLogger('VoiceInputManager');
    this.configManager = options.configManager || ConfigManager.getInstance();
    this.securityManager = options.securityManager || SecurityManager.getInstance();
    this.performanceTracker = options.performanceTracker || new PerformanceTracker('VoiceInputManager');
    
    // Initialize state
    this.state = VoiceProcessingState.IDLE;
    this.sessionId = null;
    this.processingQueue = [];
    this.activeProcessingTask = null;
    this.initialized = false;
    this.config = {};
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.startListening = this.startListening.bind(this);
    this.stopListening = this.stopListening.bind(this);
    this.pauseProcessing = this.pauseProcessing.bind(this);
    this.resumeProcessing = this.resumeProcessing.bind(this);
    this.processAudioData = this.processAudioData.bind(this);
    this.processRecognizedSpeech = this.processRecognizedSpeech.bind(this);
    this.executeVoiceCommand = this.executeVoiceCommand.bind(this);
    this.handleError = this.handleError.bind(this);
    this._setState = this._setState.bind(this);
    this._setupEventListeners = this._setupEventListeners.bind(this);
    this._loadConfiguration = this._loadConfiguration.bind(this);
    this._checkPermissions = this._checkPermissions.bind(this);
    this._processQueue = this._processQueue.bind(this);
    
    this.logger.info('VoiceInputManager created');
  }
  
  /**
   * Initialize the voice processing pipeline
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - True if initialization successful
   * @throws {Error} If initialization fails
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing voice processing pipeline');
      this._setState(VoiceProcessingState.INITIALIZING);
      this.performanceTracker.startTracking('initialize');
      
      // Load configuration
      await this._loadConfiguration();
      
      // Check permissions
      const permissionsGranted = await this._checkPermissions();
      if (!permissionsGranted) {
        throw new Error('Microphone permissions not granted');
      }
      
      // Initialize audio capture service
      await this.audioCaptureService.initialize({
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        encoding: this.config.encoding,
        useNoiseFiltering: !!this.noiseFilteringService
      });
      
      // Initialize speech recognition engine
      await this.speechRecognitionEngine.initialize({
        language: this.config.language,
        model: this.config.recognitionModel,
        useOfflineMode: this.config.useOfflineRecognition
      });
      
      // Initialize natural language processor
      await this.naturalLanguageProcessor.initialize({
        language: this.config.language,
        useLLM: !!this.languageModelIntegration
      });
      
      // Initialize optional services
      if (this.noiseFilteringService) {
        await this.noiseFilteringService.initialize({
          level: this.config.noiseFilteringLevel
        });
      }
      
      if (this.continuousListeningManager) {
        await this.continuousListeningManager.initialize({
          wakeWord: this.config.wakeWord,
          sensitivity: this.config.wakeWordSensitivity
        });
      }
      
      if (this.languageModelIntegration) {
        await this.languageModelIntegration.initialize({
          model: this.config.languageModel,
          contextSize: this.config.contextSize
        });
      }
      
      // Setup event listeners
      this._setupEventListeners();
      
      // Mark as initialized
      this.initialized = true;
      this._setState(VoiceProcessingState.IDLE);
      
      this.performanceTracker.stopTracking('initialize');
      this.logger.info('Voice processing pipeline initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceTracker.stopTracking('initialize');
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.INITIALIZATION_FAILED, error);
      throw error;
    }
  }
  
  /**
   * Start listening for voice input
   * @param {Object} [options] - Listening options
   * @param {number} [options.maxDuration] - Maximum listening duration in milliseconds
   * @param {boolean} [options.continuous] - Whether to listen continuously
   * @returns {Promise<string>} - Session ID for the listening session
   * @throws {Error} If listening cannot be started
   */
  async startListening(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('VoiceInputManager not initialized');
      }
      
      this.logger.info('Starting voice listening');
      this.performanceTracker.startTracking('listening');
      
      // Generate new session ID
      this.sessionId = uuidv4();
      
      // Configure listening options
      const maxDuration = options.maxDuration || this.config.defaultListeningDuration;
      const continuous = options.continuous || this.config.continuousListening;
      
      // Start audio capture
      await this.audioCaptureService.startCapture({
        sessionId: this.sessionId,
        maxDuration: maxDuration,
        continuous: continuous
      });
      
      this._setState(VoiceProcessingState.LISTENING);
      
      this.logger.info(`Voice listening started with session ID: ${this.sessionId}`);
      return this.sessionId;
    } catch (error) {
      this.performanceTracker.stopTracking('listening');
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.AUDIO_CAPTURE_FAILED, error);
      throw error;
    }
  }
  
  /**
   * Stop listening for voice input
   * @returns {Promise<void>}
   */
  async stopListening() {
    try {
      if (this.state !== VoiceProcessingState.LISTENING) {
        this.logger.warn('Cannot stop listening: not currently listening');
        return;
      }
      
      this.logger.info('Stopping voice listening');
      
      // Stop audio capture
      await this.audioCaptureService.stopCapture();
      
      this._setState(VoiceProcessingState.IDLE);
      this.performanceTracker.stopTracking('listening');
      
      this.logger.info('Voice listening stopped');
    } catch (error) {
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.UNKNOWN_ERROR, error);
      throw error;
    }
  }
  
  /**
   * Pause voice processing
   * @returns {Promise<void>}
   */
  async pauseProcessing() {
    try {
      if (this.state !== VoiceProcessingState.LISTENING && 
          this.state !== VoiceProcessingState.PROCESSING) {
        this.logger.warn('Cannot pause: not currently listening or processing');
        return;
      }
      
      this.logger.info('Pausing voice processing');
      
      // Pause audio capture if listening
      if (this.state === VoiceProcessingState.LISTENING) {
        await this.audioCaptureService.pauseCapture();
      }
      
      this._setState(VoiceProcessingState.PAUSED);
      
      this.logger.info('Voice processing paused');
    } catch (error) {
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.UNKNOWN_ERROR, error);
      throw error;
    }
  }
  
  /**
   * Resume voice processing
   * @returns {Promise<void>}
   */
  async resumeProcessing() {
    try {
      if (this.state !== VoiceProcessingState.PAUSED) {
        this.logger.warn('Cannot resume: not currently paused');
        return;
      }
      
      this.logger.info('Resuming voice processing');
      
      // Resume audio capture
      await this.audioCaptureService.resumeCapture();
      
      this._setState(VoiceProcessingState.LISTENING);
      
      this.logger.info('Voice processing resumed');
    } catch (error) {
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.UNKNOWN_ERROR, error);
      throw error;
    }
  }
  
  /**
   * Process audio data
   * @param {Object} audioData - Audio data to process
   * @returns {Promise<Object>} - Processing result
   */
  async processAudioData(audioData) {
    try {
      this.logger.debug('Processing audio data');
      this.performanceTracker.startTracking('processAudio');
      this._setState(VoiceProcessingState.PROCESSING);
      
      // Apply noise filtering if available
      let processedAudio = audioData;
      if (this.noiseFilteringService) {
        processedAudio = await this.noiseFilteringService.filterAudio(audioData);
      }
      
      // Recognize speech
      const recognitionResult = await this.speechRecognitionEngine.recognize(processedAudio);
      
      this.performanceTracker.stopTracking('processAudio');
      
      // Emit event with recognized speech
      this.emit(VoiceProcessingEvent.SPEECH_RECOGNIZED, {
        sessionId: this.sessionId,
        text: recognitionResult.text,
        confidence: recognitionResult.confidence,
        metadata: recognitionResult.metadata
      });
      
      // Process recognized speech
      return this.processRecognizedSpeech(recognitionResult);
    } catch (error) {
      this.performanceTracker.stopTracking('processAudio');
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.SPEECH_RECOGNITION_FAILED, error);
      throw error;
    }
  }
  
  /**
   * Process recognized speech
   * @param {Object} recognitionResult - Speech recognition result
   * @returns {Promise<Object>} - Processing result
   */
  async processRecognizedSpeech(recognitionResult) {
    try {
      this.logger.debug('Processing recognized speech');
      this.performanceTracker.startTracking('processText');
      
      // Skip processing if confidence is too low
      if (recognitionResult.confidence < this.config.minimumConfidence) {
        this.logger.info(`Recognition confidence too low: ${recognitionResult.confidence}`);
        this._setState(VoiceProcessingState.IDLE);
        return {
          success: false,
          reason: 'Low confidence',
          confidence: recognitionResult.confidence
        };
      }
      
      // Process with NLP
      const nlpResult = await this.naturalLanguageProcessor.process(recognitionResult.text);
      
      // Enhance with LLM if available
      if (this.languageModelIntegration && 
          nlpResult.confidence < this.config.llmThreshold) {
        const enhancedResult = await this.languageModelIntegration.enhanceUnderstanding(
          recognitionResult.text,
          nlpResult
        );
        Object.assign(nlpResult, enhancedResult);
      }
      
      // Emit intent detected event
      this.emit(VoiceProcessingEvent.INTENT_DETECTED, {
        sessionId: this.sessionId,
        intent: nlpResult.intent,
        entities: nlpResult.entities,
        confidence: nlpResult.confidence
      });
      
      // Execute command if intent is recognized
      let commandResult = null;
      if (nlpResult.intent) {
        commandResult = await this.executeVoiceCommand(nlpResult);
      }
      
      this.performanceTracker.stopTracking('processText');
      this._setState(VoiceProcessingState.IDLE);
      
      // Emit processing complete event
      this.emit(VoiceProcessingEvent.PROCESSING_COMPLETE, {
        sessionId: this.sessionId,
        recognitionResult,
        nlpResult,
        commandResult
      });
      
      return {
        success: true,
        recognitionResult,
        nlpResult,
        commandResult
      };
    } catch (error) {
      this.performanceTracker.stopTracking('processText');
      this._setState(VoiceProcessingState.ERROR);
      this.handleError(VoiceProcessingErrorType.INTENT_DETECTION_FAILED, error);
      throw error;
    }
  }
  
  /**
   * Execute voice command
   * @param {Object} nlpResult - Natural language processing result
   * @returns {Promise<Object>} - Command execution result
   */
  async executeVoiceCommand(nlpResult) {
    try {
      this.logger.debug(`Executing voice command for intent: ${nlpResult.intent}`);
      this.performanceTracker.startTracking('executeCommand');
      
      // Check if command exists
      if (!this.voiceCommandRegistry.hasCommand(nlpResult.intent)) {
        this.logger.info(`No command registered for intent: ${nlpResult.intent}`);
        return {
          success: false,
          reason: 'Command not found'
        };
      }
      
      // Execute command
      const commandResult = await this.voiceCommandRegistry.executeCommand(
        nlpResult.intent,
        {
          entities: nlpResult.entities,
          context: nlpResult.context,
          sessionId: this.sessionId,
          rawText: nlpResult.rawText
        }
      );
      
      // Emit command executed event
      this.emit(VoiceProcessingEvent.COMMAND_EXECUTED, {
        sessionId: this.sessionId,
        intent: nlpResult.intent,
        result: commandResult
      });
      
      this.performanceTracker.stopTracking('executeCommand');
      
      return commandResult;
    } catch (error) {
      this.performanceTracker.stopTracking('executeCommand');
      this.handleError(VoiceProcessingErrorType.COMMAND_EXECUTION_FAILED, error);
      throw error;
    }
  }
  
  /**
   * Handle errors in voice processing
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   */
  handleError(errorType, error) {
    this.logger.error(`Voice processing error (${errorType}): ${error.message}`, error);
    
    // Emit error event
    this.emit(VoiceProcessingEvent.ERROR_OCCURRED, {
      sessionId: this.sessionId,
      errorType,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    
    // Reset state if needed
    if (this.state !== VoiceProcessingState.ERROR) {
      this._setState(VoiceProcessingState.ERROR);
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
   * Update configuration
   * @param {Object} newConfig - New configuration values
   * @returns {Promise<Object>} - Updated configuration
   */
  async updateConfiguration(newConfig) {
    try {
      this.logger.info('Updating voice processing configuration');
      
      // Merge new config with existing
      Object.assign(this.config, newConfig);
      
      // Save to config manager
      await this.configManager.setConfig('voiceInput', this.config);
      
      // Update components with new config
      if (this.initialized) {
        // Update audio capture service
        if (newConfig.sampleRate || newConfig.channels || newConfig.encoding) {
          await this.audioCaptureService.updateConfiguration({
            sampleRate: this.config.sampleRate,
            channels: this.config.channels,
            encoding: this.config.encoding
          });
        }
        
        // Update speech recognition engine
        if (newConfig.language || newConfig.recognitionModel || 
            newConfig.useOfflineRecognition !== undefined) {
          await this.speechRecognitionEngine.updateConfiguration({
            language: this.config.language,
            model: this.config.recognitionModel,
            useOfflineMode: this.config.useOfflineRecognition
          });
        }
        
        // Update other components as needed
        // ...
      }
      
      this.logger.info('Voice processing configuration updated');
      return this.config;
    } catch (error) {
      this.handleError(VoiceProcessingErrorType.UNKNOWN_ERROR, error);
      throw error;
    }
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
    this.emit(VoiceProcessingEvent.STATE_CHANGED, {
      sessionId: this.sessionId,
      oldState,
      newState
    });
  }
  
  /**
   * Setup event listeners for components
   * @private
   */
  _setupEventListeners() {
    // Audio capture service events
    this.audioCaptureService.on('dataAvailable', async (data) => {
      this.emit(VoiceProcessingEvent.AUDIO_CAPTURED, {
        sessionId: this.sessionId,
        timestamp: Date.now(),
        duration: data.duration
      });
      
      // Add to processing queue
      this.processingQueue.push(data);
      this._processQueue();
    });
    
    this.audioCaptureService.on('error', (error) => {
      this.handleError(VoiceProcessingErrorType.AUDIO_CAPTURE_FAILED, error);
    });
    
    // Speech recognition engine events
    this.speechRecognitionEngine.on('error', (error) => {
      this.handleError(VoiceProcessingErrorType.SPEECH_RECOGNITION_FAILED, error);
    });
    
    // Natural language processor events
    this.naturalLanguageProcessor.on('error', (error) => {
      this.handleError(VoiceProcessingErrorType.INTENT_DETECTION_FAILED, error);
    });
    
    // Voice command registry events
    this.voiceCommandRegistry.on('error', (error) => {
      this.handleError(VoiceProcessingErrorType.COMMAND_EXECUTION_FAILED, error);
    });
    
    // Continuous listening manager events (if available)
    if (this.continuousListeningManager) {
      this.continuousListeningManager.on('wakeWordDetected', async () => {
        if (this.state === VoiceProcessingState.IDLE) {
          try {
            await this.startListening();
          } catch (error) {
            this.logger.error('Failed to start listening after wake word detection', error);
          }
        }
      });
      
      this.continuousListeningManager.on('error', (error) => {
        this.logger.warn('Continuous listening error', error);
        // Non-critical error, don't change state
      });
    }
  }
  
  /**
   * Load configuration from config manager
   * @private
   * @returns {Promise<void>}
   */
  async _loadConfiguration() {
    // Get configuration from config manager
    const savedConfig = await this.configManager.getConfig('voiceInput') || {};
    
    // Default configuration
    const defaultConfig = {
      // Audio settings
      sampleRate: 16000,
      channels: 1,
      encoding: 'LINEAR16',
      
      // Recognition settings
      language: 'en-US',
      recognitionModel: 'default',
      useOfflineRecognition: true,
      minimumConfidence: 0.6,
      
      // Listening settings
      defaultListeningDuration: 10000, // 10 seconds
      continuousListening: false,
      
      // Wake word settings
      wakeWord: 'hey aideon',
      wakeWordSensitivity: 0.7,
      
      // Noise filtering settings
      noiseFilteringLevel: 'medium',
      
      // LLM settings
      languageModel: 'default',
      contextSize: 5,
      llmThreshold: 0.7
    };
    
    // Merge default with saved config
    this.config = { ...defaultConfig, ...savedConfig };
    
    this.logger.debug('Configuration loaded', this.config);
  }
  
  /**
   * Check microphone permissions
   * @private
   * @returns {Promise<boolean>} - True if permissions granted
   */
  async _checkPermissions() {
    try {
      const permissionResult = await this.securityManager.checkPermission('microphone');
      
      if (!permissionResult.granted) {
        this.logger.warn('Microphone permission not granted', permissionResult);
        
        // Attempt to request permission if possible
        if (permissionResult.canRequest) {
          const requestResult = await this.securityManager.requestPermission('microphone');
          
          if (!requestResult.granted) {
            this.handleError(
              VoiceProcessingErrorType.PERMISSION_DENIED,
              new Error('Microphone permission denied by user')
            );
            return false;
          }
          
          return true;
        }
        
        this.handleError(
          VoiceProcessingErrorType.PERMISSION_DENIED,
          new Error('Microphone permission denied and cannot be requested')
        );
        return false;
      }
      
      return true;
    } catch (error) {
      this.handleError(VoiceProcessingErrorType.UNKNOWN_ERROR, error);
      return false;
    }
  }
  
  /**
   * Process the audio data queue
   * @private
   * @returns {Promise<void>}
   */
  async _processQueue() {
    // If already processing or queue is empty, return
    if (this.activeProcessingTask || this.processingQueue.length === 0) {
      return;
    }
    
    // Get next item from queue
    const audioData = this.processingQueue.shift();
    
    // Process audio data
    this.activeProcessingTask = this.processAudioData(audioData)
      .catch(error => {
        this.logger.error('Error processing audio data', error);
      })
      .finally(() => {
        this.activeProcessingTask = null;
        
        // Process next item if available
        if (this.processingQueue.length > 0) {
          this._processQueue();
        }
      });
  }
}

// Export constants and class
module.exports = {
  VoiceInputManager,
  VoiceProcessingState,
  VoiceProcessingEvent,
  VoiceProcessingErrorType
};
