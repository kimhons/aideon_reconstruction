/**
 * @fileoverview VoiceInputManager is the central coordinator for voice processing
 * in the Aideon AI Desktop Agent. It manages audio capture, speech recognition,
 * and intent extraction using a multi-model approach with both local and cloud providers.
 * 
 * The manager implements a tiered strategy based on user subscription level:
 * - Core (Low-Cost): Primarily uses OpenAI Whisper Small and Vosk
 * - Pro (Premium): Uses OpenAI Whisper Medium/Large and NVIDIA NeMo
 * - Enterprise (Business): Uses full suite with automatic model selection
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../utils/EnhancedAsyncLock');
const { EnhancedCancellationToken } = require('../utils/EnhancedCancellationToken');
const { EnhancedAsyncOperation } = require('../utils/EnhancedAsyncOperation');

/**
 * @typedef {Object} VoiceInputConfig
 * @property {string} tier - User subscription tier ('core', 'pro', 'enterprise')
 * @property {Object} providers - Configuration for different providers
 * @property {Object} providers.whisper - Whisper model configuration
 * @property {string} providers.whisper.modelSize - Model size ('tiny', 'small', 'medium', 'large')
 * @property {boolean} providers.whisper.enabled - Whether Whisper is enabled
 * @property {Object} providers.google - Google Speech-to-Text configuration
 * @property {boolean} providers.google.enabled - Whether Google Speech-to-Text is enabled
 * @property {string} providers.google.apiKey - Google API key
 * @property {Object} providers.nemo - NVIDIA NeMo configuration
 * @property {boolean} providers.nemo.enabled - Whether NeMo is enabled
 * @property {string} providers.nemo.modelPath - Path to NeMo model
 * @property {Object} providers.vosk - Vosk configuration
 * @property {boolean} providers.vosk.enabled - Whether Vosk is enabled
 * @property {string} providers.vosk.modelPath - Path to Vosk model
 * @property {Object} audioCapture - Audio capture configuration
 * @property {number} audioCapture.sampleRate - Sample rate in Hz
 * @property {number} audioCapture.channels - Number of audio channels
 * @property {number} audioCapture.bitDepth - Bit depth
 * @property {boolean} audioCapture.enhanceAudio - Whether to apply audio enhancement
 * @property {Object} processing - Processing configuration
 * @property {boolean} processing.useStreaming - Whether to use streaming recognition
 * @property {boolean} processing.automaticLanguageDetection - Whether to automatically detect language
 * @property {string} processing.defaultLanguage - Default language code
 * @property {boolean} processing.saveRecordings - Whether to save recordings
 * @property {string} processing.recordingsPath - Path to save recordings
 */

/**
 * VoiceInputManager is the central coordinator for voice processing.
 */
class VoiceInputManager extends EventEmitter {
  /**
   * Creates a new VoiceInputManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {VoiceInputConfig} options.config - Voice input configuration
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.securityManager - Security manager for permissions
   * @param {Object} options.resourceManager - Resource manager for allocation
   */
  constructor(options) {
    super();
    
    this.config = options.config || {};
    this.logger = options.logger || console;
    this.securityManager = options.securityManager;
    this.resourceManager = options.resourceManager;
    
    // Initialize state
    this.isInitialized = false;
    this.isCapturing = false;
    this.isProcessing = false;
    this.currentSession = null;
    this.providers = new Map();
    this.audioCapture = null;
    this.intentRecognition = null;
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    this.captureLock = new EnhancedAsyncLock();
    this.processingLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.startCapture = this.startCapture.bind(this);
    this.stopCapture = this.stopCapture.bind(this);
    this.processAudio = this.processAudio.bind(this);
    this.recognizeSpeech = this.recognizeSpeech.bind(this);
    this.extractIntent = this.extractIntent.bind(this);
    this.getProviderForTier = this.getProviderForTier.bind(this);
    this.handleCaptureData = this.handleCaptureData.bind(this);
    this.handleRecognitionResult = this.handleRecognitionResult.bind(this);
    this.handleError = this.handleError.bind(this);
  }
  
  /**
   * Initializes the VoiceInputManager and its components.
   * 
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(options = {}) {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('VoiceInputManager already initialized');
          return true;
        }
        
        this.logger.info('Initializing VoiceInputManager');
        
        // Check permissions
        if (this.securityManager) {
          const hasPermission = await this.securityManager.checkPermission('microphone');
          if (!hasPermission) {
            throw new Error('Microphone permission denied');
          }
        }
        
        // Initialize providers based on configuration
        await this.initializeProviders();
        
        // Initialize audio capture
        await this.initializeAudioCapture();
        
        // Initialize intent recognition
        await this.initializeIntentRecognition();
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('VoiceInputManager initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize VoiceInputManager', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Initializes speech recognition providers based on configuration.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeProviders() {
    this.logger.info('Initializing speech recognition providers');
    
    // Initialize OpenAI Whisper if enabled
    if (this.config.providers?.whisper?.enabled) {
      try {
        // Dynamic import to avoid loading unnecessary modules
        const { WhisperProvider } = await import('./providers/WhisperProvider');
        const whisperProvider = new WhisperProvider({
          modelSize: this.config.providers.whisper.modelSize || 'small',
          logger: this.logger,
          resourceManager: this.resourceManager
        });
        await whisperProvider.initialize();
        this.providers.set('whisper', whisperProvider);
        this.logger.info(`Initialized Whisper provider with model size: ${this.config.providers.whisper.modelSize}`);
      } catch (error) {
        this.logger.error('Failed to initialize Whisper provider', error);
      }
    }
    
    // Initialize Google Speech-to-Text if enabled
    if (this.config.providers?.google?.enabled) {
      try {
        const { GoogleSpeechProvider } = await import('./providers/GoogleSpeechProvider');
        const googleProvider = new GoogleSpeechProvider({
          apiKey: this.config.providers.google.apiKey,
          logger: this.logger
        });
        await googleProvider.initialize();
        this.providers.set('google', googleProvider);
        this.logger.info('Initialized Google Speech-to-Text provider');
      } catch (error) {
        this.logger.error('Failed to initialize Google Speech-to-Text provider', error);
      }
    }
    
    // Initialize NVIDIA NeMo if enabled
    if (this.config.providers?.nemo?.enabled) {
      try {
        const { NemoProvider } = await import('./providers/NemoProvider');
        const nemoProvider = new NemoProvider({
          modelPath: this.config.providers.nemo.modelPath,
          logger: this.logger,
          resourceManager: this.resourceManager
        });
        await nemoProvider.initialize();
        this.providers.set('nemo', nemoProvider);
        this.logger.info('Initialized NVIDIA NeMo provider');
      } catch (error) {
        this.logger.error('Failed to initialize NVIDIA NeMo provider', error);
      }
    }
    
    // Initialize Vosk if enabled
    if (this.config.providers?.vosk?.enabled) {
      try {
        const { VoskProvider } = await import('./providers/VoskProvider');
        const voskProvider = new VoskProvider({
          modelPath: this.config.providers.vosk.modelPath,
          logger: this.logger
        });
        await voskProvider.initialize();
        this.providers.set('vosk', voskProvider);
        this.logger.info('Initialized Vosk provider');
      } catch (error) {
        this.logger.error('Failed to initialize Vosk provider', error);
      }
    }
    
    // Verify at least one provider is available
    if (this.providers.size === 0) {
      throw new Error('No speech recognition providers available');
    }
  }
  
  /**
   * Initializes audio capture component.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeAudioCapture() {
    this.logger.info('Initializing audio capture');
    
    try {
      const { AudioCaptureService } = await import('./AudioCaptureService');
      this.audioCapture = new AudioCaptureService({
        sampleRate: this.config.audioCapture?.sampleRate || 16000,
        channels: this.config.audioCapture?.channels || 1,
        bitDepth: this.config.audioCapture?.bitDepth || 16,
        enhanceAudio: this.config.audioCapture?.enhanceAudio || false,
        logger: this.logger,
        resourceManager: this.resourceManager
      });
      
      // Set up event handlers
      this.audioCapture.on('data', this.handleCaptureData);
      this.audioCapture.on('error', this.handleError);
      
      await this.audioCapture.initialize();
      this.logger.info('Audio capture initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize audio capture', error);
      throw error;
    }
  }
  
  /**
   * Initializes intent recognition component.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeIntentRecognition() {
    this.logger.info('Initializing intent recognition');
    
    try {
      const { IntentRecognitionService } = await import('./IntentRecognitionService');
      this.intentRecognition = new IntentRecognitionService({
        logger: this.logger
      });
      
      await this.intentRecognition.initialize();
      this.logger.info('Intent recognition initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize intent recognition', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the VoiceInputManager and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('VoiceInputManager not initialized');
          return true;
        }
        
        this.logger.info('Shutting down VoiceInputManager');
        
        // Stop any active capture
        if (this.isCapturing) {
          await this.stopCapture();
        }
        
        // Shutdown providers
        for (const [name, provider] of this.providers.entries()) {
          try {
            await provider.shutdown();
            this.logger.info(`Shut down ${name} provider`);
          } catch (error) {
            this.logger.error(`Error shutting down ${name} provider`, error);
          }
        }
        this.providers.clear();
        
        // Shutdown audio capture
        if (this.audioCapture) {
          await this.audioCapture.shutdown();
          this.audioCapture.removeAllListeners();
          this.audioCapture = null;
        }
        
        // Shutdown intent recognition
        if (this.intentRecognition) {
          await this.intentRecognition.shutdown();
          this.intentRecognition = null;
        }
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('VoiceInputManager shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down VoiceInputManager', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Starts capturing audio from the microphone.
   * 
   * @param {Object} options - Capture options
   * @param {string} options.sessionId - Optional session ID
   * @param {string} options.language - Optional language code
   * @returns {Promise<string>} - Session ID for the capture
   */
  async startCapture(options = {}) {
    return await this.captureLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('VoiceInputManager not initialized');
        }
        
        if (this.isCapturing) {
          this.logger.info('Audio capture already in progress');
          return this.currentSession.id;
        }
        
        this.logger.info('Starting audio capture');
        
        // Create a new session
        this.currentSession = {
          id: options.sessionId || `voice-session-${Date.now()}`,
          startTime: Date.now(),
          language: options.language || this.config.processing?.defaultLanguage || 'en-US',
          audioChunks: [],
          transcription: '',
          intent: null,
          cancellationToken: new EnhancedCancellationToken()
        };
        
        // Start audio capture
        await this.audioCapture.startCapture({
          sessionId: this.currentSession.id
        });
        
        this.isCapturing = true;
        this.emit('captureStarted', { sessionId: this.currentSession.id });
        this.logger.info(`Audio capture started with session ID: ${this.currentSession.id}`);
        
        return this.currentSession.id;
      } catch (error) {
        this.logger.error('Failed to start audio capture', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Stops capturing audio and processes the captured data.
   * 
   * @param {Object} options - Stop options
   * @param {boolean} options.process - Whether to process the captured audio
   * @returns {Promise<Object>} - Processing result if process is true
   */
  async stopCapture(options = { process: true }) {
    return await this.captureLock.acquire(async () => {
      try {
        if (!this.isCapturing || !this.currentSession) {
          this.logger.info('No active audio capture to stop');
          return null;
        }
        
        this.logger.info(`Stopping audio capture for session: ${this.currentSession.id}`);
        
        // Stop audio capture
        await this.audioCapture.stopCapture();
        
        const sessionData = {
          id: this.currentSession.id,
          duration: Date.now() - this.currentSession.startTime,
          audioChunks: [...this.currentSession.audioChunks],
          language: this.currentSession.language
        };
        
        this.isCapturing = false;
        this.emit('captureStopped', { sessionId: sessionData.id, duration: sessionData.duration });
        this.logger.info(`Audio capture stopped for session: ${sessionData.id}`);
        
        // Save recording if configured
        if (this.config.processing?.saveRecordings) {
          await this.saveRecording(sessionData);
        }
        
        // Process the captured audio if requested
        let result = null;
        if (options.process) {
          result = await this.processAudio(sessionData);
        }
        
        // Clear current session
        this.currentSession = null;
        
        return result;
      } catch (error) {
        this.logger.error('Failed to stop audio capture', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Processes captured audio data.
   * 
   * @param {Object} sessionData - Session data with audio chunks
   * @returns {Promise<Object>} - Processing result with transcription and intent
   */
  async processAudio(sessionData) {
    return await this.processingLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('VoiceInputManager not initialized');
        }
        
        this.logger.info(`Processing audio for session: ${sessionData.id}`);
        this.isProcessing = true;
        this.emit('processingStarted', { sessionId: sessionData.id });
        
        // Recognize speech
        const transcription = await this.recognizeSpeech(sessionData);
        
        // Extract intent if transcription is available
        let intent = null;
        if (transcription && transcription.text) {
          intent = await this.extractIntent(transcription.text, sessionData.language);
        }
        
        const result = {
          sessionId: sessionData.id,
          transcription,
          intent
        };
        
        this.isProcessing = false;
        this.emit('processingComplete', result);
        this.logger.info(`Audio processing completed for session: ${sessionData.id}`);
        
        return result;
      } catch (error) {
        this.isProcessing = false;
        this.logger.error('Failed to process audio', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Recognizes speech from audio data using the appropriate provider.
   * 
   * @param {Object} sessionData - Session data with audio chunks
   * @returns {Promise<Object>} - Transcription result
   */
  async recognizeSpeech(sessionData) {
    try {
      this.logger.info(`Recognizing speech for session: ${sessionData.id}`);
      
      // Get appropriate provider based on tier
      const provider = this.getProviderForTier();
      if (!provider) {
        throw new Error('No suitable speech recognition provider available');
      }
      
      // Combine audio chunks into a single buffer
      const audioBuffer = Buffer.concat(sessionData.audioChunks);
      
      // Recognize speech
      const result = await provider.recognize({
        audio: audioBuffer,
        language: sessionData.language,
        sampleRate: this.config.audioCapture?.sampleRate || 16000,
        encoding: 'LINEAR16'
      });
      
      this.logger.info(`Speech recognition completed for session: ${sessionData.id}`);
      this.emit('recognitionComplete', {
        sessionId: sessionData.id,
        result
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to recognize speech', error);
      this.emit('recognitionError', {
        sessionId: sessionData.id,
        error
      });
      throw error;
    }
  }
  
  /**
   * Extracts intent from recognized text.
   * 
   * @param {string} text - Recognized text
   * @param {string} language - Language code
   * @returns {Promise<Object>} - Intent extraction result
   */
  async extractIntent(text, language) {
    try {
      if (!this.intentRecognition) {
        throw new Error('Intent recognition not initialized');
      }
      
      this.logger.info('Extracting intent from recognized text');
      
      const intent = await this.intentRecognition.extractIntent(text, language);
      
      this.logger.info(`Intent extracted: ${intent.name}`);
      this.emit('intentExtracted', intent);
      
      return intent;
    } catch (error) {
      this.logger.error('Failed to extract intent', error);
      this.emit('intentError', error);
      return null;
    }
  }
  
  /**
   * Gets the appropriate speech recognition provider based on user tier.
   * 
   * @returns {Object} - Provider instance
   */
  getProviderForTier() {
    const tier = this.config.tier || 'core';
    
    switch (tier) {
      case 'enterprise':
        // Enterprise tier: Try NeMo, then Whisper Large, then Google, then Vosk
        return this.providers.get('nemo') || 
               this.providers.get('whisper') || 
               this.providers.get('google') || 
               this.providers.get('vosk');
      
      case 'pro':
        // Pro tier: Try Whisper Medium/Large, then Google, then Vosk
        return this.providers.get('whisper') || 
               this.providers.get('google') || 
               this.providers.get('vosk');
      
      case 'core':
      default:
        // Core tier: Try Whisper Small, then Vosk, then Google with limits
        return this.providers.get('whisper') || 
               this.providers.get('vosk') || 
               this.providers.get('google');
    }
  }
  
  /**
   * Handles audio data from the capture service.
   * 
   * @param {Object} data - Audio data
   */
  handleCaptureData(data) {
    if (!this.isCapturing || !this.currentSession) {
      return;
    }
    
    // Add audio chunk to session
    this.currentSession.audioChunks.push(data.chunk);
    
    // Emit data event
    this.emit('audioData', {
      sessionId: this.currentSession.id,
      chunk: data.chunk,
      timestamp: Date.now()
    });
    
    // If streaming is enabled, process the chunk
    if (this.config.processing?.useStreaming) {
      this.processStreamingChunk(data.chunk);
    }
  }
  
  /**
   * Processes a streaming audio chunk.
   * 
   * @private
   * @param {Buffer} chunk - Audio chunk
   */
  async processStreamingChunk(chunk) {
    try {
      // Get appropriate provider
      const provider = this.getProviderForTier();
      if (!provider || !provider.supportsStreaming) {
        return;
      }
      
      // Process streaming chunk
      const result = await provider.processStreamingChunk({
        chunk,
        sessionId: this.currentSession.id,
        language: this.currentSession.language
      });
      
      if (result && result.text) {
        this.currentSession.transcription = result.text;
        this.emit('streamingResult', {
          sessionId: this.currentSession.id,
          text: result.text,
          isFinal: result.isFinal
        });
        
        // If result is final, extract intent
        if (result.isFinal) {
          const intent = await this.extractIntent(result.text, this.currentSession.language);
          if (intent) {
            this.currentSession.intent = intent;
            this.emit('streamingIntent', {
              sessionId: this.currentSession.id,
              intent
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing streaming chunk', error);
    }
  }
  
  /**
   * Saves the recording to disk.
   * 
   * @private
   * @param {Object} sessionData - Session data
   * @returns {Promise<string>} - Path to saved recording
   */
  async saveRecording(sessionData) {
    try {
      const recordingsPath = this.config.processing?.recordingsPath || path.join(process.cwd(), 'recordings');
      
      // Ensure directory exists
      await fs.mkdir(recordingsPath, { recursive: true });
      
      // Create filename
      const filename = `recording_${sessionData.id}_${Date.now()}.wav`;
      const filePath = path.join(recordingsPath, filename);
      
      // Combine audio chunks
      const audioBuffer = Buffer.concat(sessionData.audioChunks);
      
      // Create WAV header
      const wavHeader = this.createWavHeader(
        audioBuffer.length,
        this.config.audioCapture?.sampleRate || 16000,
        this.config.audioCapture?.channels || 1,
        this.config.audioCapture?.bitDepth || 16
      );
      
      // Write file
      await fs.writeFile(filePath, Buffer.concat([wavHeader, audioBuffer]));
      
      this.logger.info(`Recording saved to: ${filePath}`);
      this.emit('recordingSaved', { sessionId: sessionData.id, path: filePath });
      
      return filePath;
    } catch (error) {
      this.logger.error('Failed to save recording', error);
      return null;
    }
  }
  
  /**
   * Creates a WAV header for the audio data.
   * 
   * @private
   * @param {number} dataLength - Length of audio data in bytes
   * @param {number} sampleRate - Sample rate in Hz
   * @param {number} channels - Number of channels
   * @param {number} bitDepth - Bit depth
   * @returns {Buffer} - WAV header buffer
   */
  createWavHeader(dataLength, sampleRate, channels, bitDepth) {
    const buffer = Buffer.alloc(44);
    
    // RIFF identifier
    buffer.write('RIFF', 0);
    
    // File length
    buffer.writeUInt32LE(dataLength + 36, 4);
    
    // WAVE identifier
    buffer.write('WAVE', 8);
    
    // Format chunk identifier
    buffer.write('fmt ', 12);
    
    // Format chunk length
    buffer.writeUInt32LE(16, 16);
    
    // Sample format (1 is PCM)
    buffer.writeUInt16LE(1, 20);
    
    // Channel count
    buffer.writeUInt16LE(channels, 22);
    
    // Sample rate
    buffer.writeUInt32LE(sampleRate, 24);
    
    // Byte rate (sample rate * block align)
    buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
    
    // Block align (channel count * bytes per sample)
    buffer.writeUInt16LE(channels * (bitDepth / 8), 32);
    
    // Bits per sample
    buffer.writeUInt16LE(bitDepth, 34);
    
    // Data chunk identifier
    buffer.write('data', 36);
    
    // Data chunk length
    buffer.writeUInt32LE(dataLength, 40);
    
    return buffer;
  }
  
  /**
   * Handles errors from components.
   * 
   * @private
   * @param {Error} error - Error object
   */
  handleError(error) {
    this.logger.error('VoiceInputManager error', error);
    this.emit('error', error);
  }
}

module.exports = { VoiceInputManager };

// Add module.exports at the end of the file
module.exports = { VoiceInputManager };
