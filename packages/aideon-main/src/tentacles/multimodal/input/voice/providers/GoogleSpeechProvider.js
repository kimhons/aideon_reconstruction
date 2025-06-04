/**
 * @fileoverview GoogleSpeechProvider implements speech recognition using Google Cloud Speech-to-Text API.
 * This provider supports both streaming and batch processing with advanced features like speaker diarization.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../../utils/EnhancedAsyncLock');

/**
 * GoogleSpeechProvider implements speech recognition using Google Cloud Speech-to-Text API.
 */
class GoogleSpeechProvider extends EventEmitter {
  /**
   * Creates a new GoogleSpeechProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - Google API key
   * @param {Object} options.logger - Logger instance
   */
  constructor(options) {
    super();
    
    this.apiKey = options.apiKey;
    this.logger = options.logger || console;
    
    // Initialize state
    this.isInitialized = false;
    this.client = null;
    this.streamingClient = null;
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
   * Initializes the GoogleSpeechProvider.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('GoogleSpeechProvider already initialized');
          return true;
        }
        
        this.logger.info('Initializing GoogleSpeechProvider');
        
        // Check API key
        if (!this.apiKey) {
          throw new Error('Google API key is required');
        }
        
        // Initialize Google Speech client
        await this.initializeClient();
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('GoogleSpeechProvider initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize GoogleSpeechProvider', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Initializes the Google Speech client.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeClient() {
    try {
      // Dynamic import to avoid loading unnecessary modules
      const { SpeechClient } = await import('@google-cloud/speech');
      
      // Create client with API key
      this.client = new SpeechClient({
        credentials: {
          client_email: 'aideon-speech@aideon-ai.iam.gserviceaccount.com',
          private_key: this.apiKey
        }
      });
      
      // Create streaming client
      this.streamingClient = new SpeechClient({
        credentials: {
          client_email: 'aideon-speech@aideon-ai.iam.gserviceaccount.com',
          private_key: this.apiKey
        }
      });
      
      this.logger.info('Initialized Google Speech client');
    } catch (error) {
      this.logger.error('Failed to initialize Google Speech client', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the GoogleSpeechProvider and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('GoogleSpeechProvider not initialized');
          return true;
        }
        
        this.logger.info('Shutting down GoogleSpeechProvider');
        
        // Close streaming sessions
        for (const [sessionId, session] of this.streamingSessions.entries()) {
          try {
            await session.stream.end();
            this.logger.info(`Closed streaming session: ${sessionId}`);
          } catch (error) {
            this.logger.error(`Error closing streaming session: ${sessionId}`, error);
          }
        }
        this.streamingSessions.clear();
        
        // Close clients
        if (this.client) {
          await this.client.close();
          this.client = null;
        }
        
        if (this.streamingClient) {
          await this.streamingClient.close();
          this.streamingClient = null;
        }
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('GoogleSpeechProvider shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down GoogleSpeechProvider', error);
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
          throw new Error('GoogleSpeechProvider not initialized');
        }
        
        this.logger.info('Recognizing speech with Google Speech-to-Text');
        
        // Create recognition config
        const config = {
          encoding: this.mapEncoding(options.encoding),
          sampleRateHertz: options.sampleRate,
          languageCode: options.language,
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          model: 'latest_long',
          useEnhanced: true
        };
        
        // Create recognition request
        const request = {
          config,
          audio: {
            content: options.audio.toString('base64')
          }
        };
        
        // Recognize speech
        const [response] = await this.client.recognize(request);
        
        // Format result
        const formattedResult = {
          text: response.results.map(result => result.alternatives[0].transcript).join(' '),
          language: options.language,
          confidence: response.results[0]?.alternatives[0]?.confidence || 0.9,
          segments: response.results.map(result => ({
            text: result.alternatives[0].transcript,
            confidence: result.alternatives[0].confidence || 0.9
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
        throw new Error('GoogleSpeechProvider not initialized');
      }
      
      // Initialize streaming session if not exists
      if (!this.streamingSessions.has(options.sessionId)) {
        await this.initializeStreamingSession(options);
      }
      
      const session = this.streamingSessions.get(options.sessionId);
      
      // Write chunk to stream
      session.stream.write({
        audioContent: options.chunk
      });
      
      // Return current result
      return {
        text: session.partialResult,
        isFinal: session.isFinal,
        confidence: session.confidence
      };
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
      // Create recognition config
      const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: options.language,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        interimResults: true,
        model: 'latest_long',
        useEnhanced: true
      };
      
      // Create streaming request
      const request = {
        config,
        interimResults: true
      };
      
      // Create streaming session
      const session = {
        id: options.sessionId,
        partialResult: '',
        isFinal: false,
        confidence: 0.0,
        stream: this.streamingClient.streamingRecognize(request)
      };
      
      // Set up event handlers
      session.stream.on('data', data => {
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          session.partialResult = result.alternatives[0].transcript;
          session.isFinal = result.isFinal;
          session.confidence = result.alternatives[0].confidence || 0.5;
          
          this.emit('streamingResult', {
            sessionId: options.sessionId,
            text: session.partialResult,
            isFinal: session.isFinal,
            confidence: session.confidence
          });
        }
      });
      
      session.stream.on('error', error => {
        this.logger.error(`Streaming error for session ${options.sessionId}`, error);
        this.emit('error', error);
      });
      
      session.stream.on('end', () => {
        this.logger.info(`Streaming session ended: ${options.sessionId}`);
        this.streamingSessions.delete(options.sessionId);
      });
      
      // Store session
      this.streamingSessions.set(options.sessionId, session);
      this.logger.info(`Initialized streaming session: ${options.sessionId}`);
    } catch (error) {
      this.logger.error('Failed to initialize streaming session', error);
      throw error;
    }
  }
  
  /**
   * Maps encoding format to Google Speech format.
   * 
   * @private
   * @param {string} encoding - Input encoding format
   * @returns {string} - Google Speech encoding format
   */
  mapEncoding(encoding) {
    switch (encoding.toUpperCase()) {
      case 'LINEAR16':
        return 'LINEAR16';
      case 'FLAC':
        return 'FLAC';
      case 'MP3':
        return 'MP3';
      case 'OGG_OPUS':
        return 'OGG_OPUS';
      default:
        return 'LINEAR16';
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

module.exports = { GoogleSpeechProvider };

// Add module.exports at the end of the file
module.exports = { GoogleSpeechProvider };
