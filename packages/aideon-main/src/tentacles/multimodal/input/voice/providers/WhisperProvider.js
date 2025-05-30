/**
 * @fileoverview WhisperProvider implements speech recognition using OpenAI's Whisper model.
 * This provider supports multiple model sizes and both streaming and batch processing.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../../utils/EnhancedAsyncLock');

/**
 * WhisperProvider implements speech recognition using OpenAI's Whisper model.
 */
class WhisperProvider extends EventEmitter {
  /**
   * Creates a new WhisperProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.modelSize - Model size ('tiny', 'small', 'medium', 'large')
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.resourceManager - Resource manager for allocation
   */
  constructor(options) {
    super();
    
    this.modelSize = options.modelSize || 'small';
    this.logger = options.logger || console;
    this.resourceManager = options.resourceManager;
    
    // Initialize state
    this.isInitialized = false;
    this.model = null;
    this.processor = null;
    this.streamingSession = null;
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    this.recognizeLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.recognize = this.recognize.bind(this);
    this.processStreamingChunk = this.processStreamingChunk.bind(this);
  }
  
  /**
   * Initializes the WhisperProvider.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('WhisperProvider already initialized');
          return true;
        }
        
        this.logger.info(`Initializing WhisperProvider with model size: ${this.modelSize}`);
        
        // Check if resources are available
        if (this.resourceManager) {
          const resourceRequirements = this.getResourceRequirements();
          const hasResources = await this.resourceManager.checkResources('whisper', resourceRequirements);
          if (!hasResources) {
            throw new Error(`Insufficient resources for Whisper ${this.modelSize} model`);
          }
        }
        
        // Load Whisper model
        await this.loadModel();
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('WhisperProvider initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize WhisperProvider', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Gets resource requirements for the selected model size.
   * 
   * @private
   * @returns {Object} - Resource requirements
   */
  getResourceRequirements() {
    // Resource requirements based on model size
    switch (this.modelSize) {
      case 'tiny':
        return { memory: 75, cpu: 1 };
      case 'small':
        return { memory: 244, cpu: 2 };
      case 'medium':
        return { memory: 769, gpu: 1 };
      case 'large':
        return { memory: 1500, gpu: 1 };
      default:
        return { memory: 244, cpu: 2 }; // Default to small requirements
    }
  }
  
  /**
   * Loads the Whisper model.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadModel() {
    try {
      // Dynamic import to avoid loading unnecessary modules
      const { whisper } = await import('@aideon/whisper-node');
      
      // Determine model path
      const modelPath = path.join(process.cwd(), 'models', 'whisper', `whisper-${this.modelSize}`);
      
      // Check if model exists, download if not
      try {
        await fs.access(modelPath);
        this.logger.info(`Using existing Whisper ${this.modelSize} model at: ${modelPath}`);
      } catch (error) {
        this.logger.info(`Downloading Whisper ${this.modelSize} model...`);
        await whisper.downloadModel(this.modelSize, modelPath);
        this.logger.info(`Downloaded Whisper ${this.modelSize} model to: ${modelPath}`);
      }
      
      // Load model
      this.model = await whisper.load(modelPath);
      
      // Initialize processor
      this.processor = new whisper.WhisperProcessor({
        model: this.model,
        enableTranslation: true,
        enableTimestamps: true
      });
      
      this.logger.info(`Loaded Whisper ${this.modelSize} model`);
    } catch (error) {
      this.logger.error('Failed to load Whisper model', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the WhisperProvider and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('WhisperProvider not initialized');
          return true;
        }
        
        this.logger.info('Shutting down WhisperProvider');
        
        // Release model resources
        if (this.model) {
          await this.model.unload();
          this.model = null;
        }
        
        this.processor = null;
        this.isInitialized = false;
        
        this.emit('shutdown');
        this.logger.info('WhisperProvider shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down WhisperProvider', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Recognizes speech from audio data.
   * 
   * @param {Object} options - Recognition options
   * @param {Buffer} options.audio - Audio data buffer
   * @param {string} options.language - Language code
   * @param {number} options.sampleRate - Sample rate in Hz
   * @param {string} options.encoding - Audio encoding format
   * @returns {Promise<Object>} - Recognition result
   */
  async recognize(options) {
    return await this.recognizeLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('WhisperProvider not initialized');
        }
        
        this.logger.info('Recognizing speech with Whisper');
        
        // Process audio
        const result = await this.processor.transcribe(options.audio, {
          language: options.language,
          task: 'transcribe',
          sampleRate: options.sampleRate,
          encoding: options.encoding
        });
        
        // Format result
        const formattedResult = {
          text: result.text,
          language: result.language,
          confidence: result.confidence || 0.9,
          segments: result.segments.map(segment => ({
            text: segment.text,
            start: segment.start,
            end: segment.end,
            confidence: segment.confidence || 0.9
          }))
        };
        
        this.logger.info('Speech recognition completed successfully');
        this.emit('recognitionComplete', formattedResult);
        
        return formattedResult;
      } catch (error) {
        this.logger.error('Failed to recognize speech', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Processes a streaming audio chunk.
   * 
   * @param {Object} options - Streaming options
   * @param {Buffer} options.chunk - Audio chunk
   * @param {string} options.sessionId - Session ID
   * @param {string} options.language - Language code
   * @returns {Promise<Object>} - Streaming result
   */
  async processStreamingChunk(options) {
    try {
      if (!this.isInitialized) {
        throw new Error('WhisperProvider not initialized');
      }
      
      // Initialize streaming session if not exists
      if (!this.streamingSession || this.streamingSession.id !== options.sessionId) {
        this.streamingSession = {
          id: options.sessionId,
          buffer: Buffer.alloc(0),
          partialResult: '',
          language: options.language
        };
      }
      
      // Append chunk to buffer
      this.streamingSession.buffer = Buffer.concat([
        this.streamingSession.buffer,
        options.chunk
      ]);
      
      // Process if buffer is large enough (500ms of audio at 16kHz)
      if (this.streamingSession.buffer.length >= 16000) {
        // Process buffer
        const result = await this.processor.transcribe(this.streamingSession.buffer, {
          language: options.language,
          task: 'transcribe',
          sampleRate: 16000,
          encoding: 'LINEAR16'
        });
        
        // Update partial result
        this.streamingSession.partialResult = result.text;
        
        // Clear buffer if result is final
        if (result.isFinal) {
          this.streamingSession.buffer = Buffer.alloc(0);
        }
        
        return {
          text: result.text,
          isFinal: result.isFinal,
          confidence: result.confidence || 0.9
        };
      }
      
      // Return current partial result
      return {
        text: this.streamingSession.partialResult,
        isFinal: false,
        confidence: 0.5
      };
    } catch (error) {
      this.logger.error('Failed to process streaming chunk', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Gets whether the provider supports streaming recognition.
   * 
   * @returns {boolean} - Whether streaming is supported
   */
  get supportsStreaming() {
    return true;
  }
}

module.exports = { WhisperProvider };

// Add module.exports at the end of the file
module.exports = { WhisperProvider };
