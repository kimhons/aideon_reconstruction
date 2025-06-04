/**
 * @fileoverview VoskProvider implements speech recognition using the Vosk toolkit.
 * This provider is optimized for lightweight, offline speech recognition with minimal resources.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../../utils/EnhancedAsyncLock');

/**
 * VoskProvider implements speech recognition using the Vosk toolkit.
 */
class VoskProvider extends EventEmitter {
  /**
   * Creates a new VoskProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.modelPath - Path to Vosk model
   * @param {Object} options.logger - Logger instance
   */
  constructor(options) {
    super();
    
    this.modelPath = options.modelPath;
    this.logger = options.logger || console;
    
    // Initialize state
    this.isInitialized = false;
    this.model = null;
    this.recognizer = null;
    this.streamingSessions = new Map();
    
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
   * Initializes the VoskProvider.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('VoskProvider already initialized');
          return true;
        }
        
        this.logger.info('Initializing VoskProvider');
        
        // Load Vosk model
        await this.loadModel();
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('VoskProvider initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize VoskProvider', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Loads the Vosk model.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async loadModel() {
    try {
      // Dynamic import to avoid loading unnecessary modules
      const { Vosk } = await import('@aideon/vosk-node');
      
      // Determine model path
      const modelPath = this.modelPath || path.join(process.cwd(), 'models', 'vosk', 'vosk-model-small');
      
      // Check if model exists, download if not
      try {
        await fs.access(modelPath);
        this.logger.info(`Using existing Vosk model at: ${modelPath}`);
      } catch (error) {
        this.logger.info('Downloading Vosk model...');
        await Vosk.downloadModel('small', modelPath);
        this.logger.info(`Downloaded Vosk model to: ${modelPath}`);
      }
      
      // Load model
      this.model = new Vosk.Model(modelPath);
      
      // Create recognizer
      this.recognizer = new Vosk.Recognizer({
        model: this.model,
        sampleRate: 16000
      });
      
      this.logger.info('Loaded Vosk model');
    } catch (error) {
      this.logger.error('Failed to load Vosk model', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the VoskProvider and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('VoskProvider not initialized');
          return true;
        }
        
        this.logger.info('Shutting down VoskProvider');
        
        // Close streaming sessions
        for (const [sessionId, session] of this.streamingSessions.entries()) {
          try {
            session.recognizer.free();
            this.logger.info(`Closed streaming session: ${sessionId}`);
          } catch (error) {
            this.logger.error(`Error closing streaming session: ${sessionId}`, error);
          }
        }
        this.streamingSessions.clear();
        
        // Release model resources
        if (this.recognizer) {
          this.recognizer.free();
          this.recognizer = null;
        }
        
        if (this.model) {
          this.model.free();
          this.model = null;
        }
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('VoskProvider shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down VoskProvider', error);
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
          throw new Error('VoskProvider not initialized');
        }
        
        this.logger.info('Recognizing speech with Vosk');
        
        // Create a new recognizer for this request
        const { Vosk } = await import('@aideon/vosk-node');
        const recognizer = new Vosk.Recognizer({
          model: this.model,
          sampleRate: options.sampleRate
        });
        
        // Process audio
        recognizer.acceptWaveform(options.audio);
        const result = recognizer.finalResult();
        
        // Free recognizer
        recognizer.free();
        
        // Format result
        const formattedResult = {
          text: result.text,
          language: options.language,
          confidence: 0.8, // Vosk doesn't provide confidence scores
          segments: result.result ? result.result.map(segment => ({
            text: segment.word,
            start: segment.start,
            end: segment.end,
            confidence: 0.8
          })) : []
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
        throw new Error('VoskProvider not initialized');
      }
      
      // Initialize streaming session if not exists
      if (!this.streamingSessions.has(options.sessionId)) {
        await this.initializeStreamingSession(options);
      }
      
      const session = this.streamingSessions.get(options.sessionId);
      
      // Process chunk
      const hasResult = session.recognizer.acceptWaveform(options.chunk);
      
      let result;
      if (hasResult) {
        // Get final result for this chunk
        result = session.recognizer.result();
        session.partialResult = result.text;
        
        return {
          text: result.text,
          isFinal: true,
          confidence: 0.8
        };
      } else {
        // Get partial result
        result = session.recognizer.partialResult();
        session.partialResult = result.partial;
        
        return {
          text: result.partial,
          isFinal: false,
          confidence: 0.5
        };
      }
    } catch (error) {
      this.logger.error('Failed to process streaming chunk', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Initializes a streaming recognition session.
   * 
   * @private
   * @param {Object} options - Session options
   * @returns {Promise<void>}
   */
  async initializeStreamingSession(options) {
    try {
      // Create a new recognizer for this session
      const { Vosk } = await import('@aideon/vosk-node');
      const recognizer = new Vosk.Recognizer({
        model: this.model,
        sampleRate: 16000
      });
      
      // Create session
      const session = {
        id: options.sessionId,
        recognizer,
        partialResult: ''
      };
      
      // Store session
      this.streamingSessions.set(options.sessionId, session);
      this.logger.info(`Initialized streaming session: ${options.sessionId}`);
    } catch (error) {
      this.logger.error('Failed to initialize streaming session', error);
      throw error;
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

module.exports = { VoskProvider };

// Add module.exports at the end of the file
module.exports = { VoskProvider };
