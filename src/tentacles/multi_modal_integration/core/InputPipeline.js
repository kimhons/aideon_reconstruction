/**
 * @fileoverview Modified InputPipeline for the Multi-Modal Integration Tentacle.
 * Responsible for receiving and preprocessing multi-modal inputs.
 * Ensures modality properties are preserved during processing.
 * 
 * @author Aideon AI Team
 * @version 1.0.1
 */

const { validateInput } = require('../../../utils/multiModalValidation');

/**
 * Input Pipeline
 * Responsible for receiving and preprocessing multi-modal inputs.
 */
class InputPipeline {
  /**
   * Creates a new InputPipeline instance.
   * @param {Object} options - Pipeline options
   * @param {Object} options.tentacle - Parent tentacle
   * @param {Object} options.config - Configuration system
   * @param {Object} options.logging - Logging system
   * @param {Object} options.events - Event system
   * @param {Object} options.metrics - Metrics system
   */
  constructor(options = {}) {
    this.tentacle = options.tentacle;
    this.config = options.config;
    this.logging = options.logging;
    this.events = options.events;
    this.metrics = options.metrics;
    
    // Create logger
    this.logger = this.logging ? this.logging.createLogger('multi-modal-integration:input-pipeline') : console;
    
    // Bind methods
    this.process = this.process.bind(this);
    this.validateInput = this.validateInput.bind(this);
    this.normalizeInput = this.normalizeInput.bind(this);
    this.extractMetadata = this.extractMetadata.bind(this);
    this.segmentInput = this.segmentInput.bind(this);
  }
  
  /**
   * Initializes the pipeline.
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing Input Pipeline');
      
      // Load configuration
      this.maxInputSize = this.config ? this.config.get('multi-modal.input.maxSize', 100 * 1024 * 1024) : 100 * 1024 * 1024;
      this.enableSegmentation = this.config ? this.config.get('multi-modal.input.enableSegmentation', true) : true;
      this.segmentSize = this.config ? this.config.get('multi-modal.input.segmentSize', 1024 * 1024) : 1024 * 1024;
      
      this.logger.info('Input Pipeline initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Input Pipeline:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the pipeline.
   * @returns {Promise<boolean>} - Whether shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Input Pipeline');
      
      this.logger.info('Input Pipeline shut down successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Input Pipeline:', error);
      throw error;
    }
  }
  
  /**
   * Processes input through the pipeline.
   * @param {Object} input - Input data
   * @param {Object} [options] - Processing options
   * @returns {Promise<Object>} - Processed input
   */
  async process(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate input
      const validatedInput = await this.validateInput(input, options);
      
      // Normalize input
      const normalizedInput = await this.normalizeInput(validatedInput, options);
      
      // Extract metadata
      const inputWithMetadata = await this.extractMetadata(normalizedInput, options);
      
      // Segment input if needed
      const segmentedInput = this.enableSegmentation && options.enableSegmentation !== false
        ? await this.segmentInput(inputWithMetadata, options)
        : inputWithMetadata;
      
      // Add processing metadata
      segmentedInput._meta = segmentedInput._meta || {};
      segmentedInput._meta.processedBy = 'input-pipeline';
      segmentedInput._meta.processingTime = Date.now() - startTime;
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.input.process.count', 1);
        this.metrics.recordTiming('multi-modal.input.process.time', Date.now() - startTime);
      }
      
      // Emit event
      if (this.events) {
        this.events.emit('multi-modal.input.processed', {
          input: segmentedInput,
          processingTime: Date.now() - startTime
        });
      }
      
      // CRITICAL: Ensure all original modality properties are preserved
      // This is necessary for cross-modal reasoning which requires at least two modalities
      const originalModalities = Object.keys(input).filter(key => 
        ['text', 'image', 'audio', 'video'].includes(key)
      );
      
      // Ensure all original modalities are present in the processed input
      for (const modality of originalModalities) {
        if (input[modality] && !segmentedInput[modality]) {
          segmentedInput[modality] = input[modality];
          this.logger.warn(`Restored missing ${modality} modality in processed input`);
        }
      }
      
      return segmentedInput;
    } catch (error) {
      this.logger.error('Failed to process input:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.input.process.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Validates input.
   * @param {Object} input - Input data
   * @param {Object} [options] - Validation options
   * @returns {Promise<Object>} - Validated input
   * @private
   */
  async validateInput(input, options = {}) {
    try {
      // Use the imported validateInput function with additional options
      const validationOptions = {
        ...options,
        maxSize: this.maxInputSize
      };
      
      return validateInput(input, validationOptions);
    } catch (error) {
      this.logger.error('Input validation failed:', error);
      throw error;
    }
  }
  
  /**
   * Normalizes input.
   * @param {Object} input - Input data
   * @param {Object} [options] - Normalization options
   * @returns {Promise<Object>} - Normalized input
   * @private
   */
  async normalizeInput(input, options = {}) {
    try {
      const normalizedInput = { ...input };
      
      // Normalize text
      if (input.text) {
        normalizedInput.text = await this.normalizeTextInput(input.text, options);
      }
      
      // Normalize image
      if (input.image) {
        normalizedInput.image = await this.normalizeImageInput(input.image, options);
      }
      
      // Normalize audio
      if (input.audio) {
        normalizedInput.audio = await this.normalizeAudioInput(input.audio, options);
      }
      
      // Normalize video
      if (input.video) {
        normalizedInput.video = await this.normalizeVideoInput(input.video, options);
      }
      
      return normalizedInput;
    } catch (error) {
      this.logger.error('Input normalization failed:', error);
      throw error;
    }
  }
  
  /**
   * Normalizes text input.
   * @param {Object} text - Text input
   * @param {Object} [options] - Normalization options
   * @returns {Promise<Object>} - Normalized text input
   * @private
   */
  async normalizeTextInput(text, options = {}) {
    const normalizedText = { ...text };
    
    // Normalize content
    if (normalizedText.content) {
      // Trim whitespace
      normalizedText.content = normalizedText.content.trim();
      
      // Normalize line endings
      normalizedText.content = normalizedText.content.replace(/\r\n/g, '\n');
    }
    
    // Set default format
    normalizedText.format = normalizedText.format || 'plain';
    
    // Set default language
    normalizedText.language = normalizedText.language || 'en';
    
    return normalizedText;
  }
  
  /**
   * Normalizes image input.
   * @param {Object} image - Image input
   * @param {Object} [options] - Normalization options
   * @returns {Promise<Object>} - Normalized image input
   * @private
   */
  async normalizeImageInput(image, options = {}) {
    const normalizedImage = { ...image };
    
    // Set default format
    normalizedImage.format = normalizedImage.format || 'jpeg';
    
    // Set default width and height
    normalizedImage.width = normalizedImage.width || 0;
    normalizedImage.height = normalizedImage.height || 0;
    
    return normalizedImage;
  }
  
  /**
   * Normalizes audio input.
   * @param {Object} audio - Audio input
   * @param {Object} [options] - Normalization options
   * @returns {Promise<Object>} - Normalized audio input
   * @private
   */
  async normalizeAudioInput(audio, options = {}) {
    const normalizedAudio = { ...audio };
    
    // Set default format
    normalizedAudio.format = normalizedAudio.format || 'mp3';
    
    // Set default duration
    normalizedAudio.duration = normalizedAudio.duration || 0;
    
    // Set default sample rate
    normalizedAudio.sampleRate = normalizedAudio.sampleRate || 44100;
    
    // Set default channels
    normalizedAudio.channels = normalizedAudio.channels || 2;
    
    return normalizedAudio;
  }
  
  /**
   * Normalizes video input.
   * @param {Object} video - Video input
   * @param {Object} [options] - Normalization options
   * @returns {Promise<Object>} - Normalized video input
   * @private
   */
  async normalizeVideoInput(video, options = {}) {
    const normalizedVideo = { ...video };
    
    // Set default format
    normalizedVideo.format = normalizedVideo.format || 'mp4';
    
    // Set default duration
    normalizedVideo.duration = normalizedVideo.duration || 0;
    
    // Set default width and height
    normalizedVideo.width = normalizedVideo.width || 0;
    normalizedVideo.height = normalizedVideo.height || 0;
    
    // Set default frame rate
    normalizedVideo.frameRate = normalizedVideo.frameRate || 30;
    
    return normalizedVideo;
  }
  
  /**
   * Extracts metadata from input.
   * @param {Object} input - Input data
   * @param {Object} [options] - Extraction options
   * @returns {Promise<Object>} - Input with metadata
   * @private
   */
  async extractMetadata(input, options = {}) {
    try {
      const inputWithMetadata = { ...input, _meta: { ...input._meta } };
      
      // Extract text metadata
      if (input.text) {
        const textMetadata = await this.extractTextMetadata(input.text, options);
        inputWithMetadata.text = {
          ...input.text,
          metadata: { ...input.text.metadata, ...textMetadata }
        };
      }
      
      // Extract image metadata
      if (input.image) {
        const imageMetadata = await this.extractImageMetadata(input.image, options);
        inputWithMetadata.image = {
          ...input.image,
          metadata: { ...input.image.metadata, ...imageMetadata }
        };
      }
      
      // Extract audio metadata
      if (input.audio) {
        const audioMetadata = await this.extractAudioMetadata(input.audio, options);
        inputWithMetadata.audio = {
          ...input.audio,
          metadata: { ...input.audio.metadata, ...audioMetadata }
        };
      }
      
      // Extract video metadata
      if (input.video) {
        const videoMetadata = await this.extractVideoMetadata(input.video, options);
        inputWithMetadata.video = {
          ...input.video,
          metadata: { ...input.video.metadata, ...videoMetadata }
        };
      }
      
      return inputWithMetadata;
    } catch (error) {
      this.logger.error('Metadata extraction failed:', error);
      throw error;
    }
  }
  
  /**
   * Extracts metadata from text input.
   * @param {Object} text - Text input
   * @param {Object} [options] - Extraction options
   * @returns {Promise<Object>} - Text metadata
   * @private
   */
  async extractTextMetadata(text, options = {}) {
    const metadata = {};
    
    // Extract character count
    if (text.content) {
      metadata.characterCount = text.content.length;
      metadata.wordCount = text.content.split(/\s+/).filter(Boolean).length;
      metadata.lineCount = text.content.split('\n').length;
    }
    
    return metadata;
  }
  
  /**
   * Extracts metadata from image input.
   * @param {Object} image - Image input
   * @param {Object} [options] - Extraction options
   * @returns {Promise<Object>} - Image metadata
   * @private
   */
  async extractImageMetadata(image, options = {}) {
    const metadata = {};
    
    // Extract size
    if (image.data) {
      metadata.size = Buffer.isBuffer(image.data) ? image.data.length : Buffer.byteLength(image.data);
    }
    
    // Extract dimensions
    if (image.width && image.height) {
      metadata.dimensions = {
        width: image.width,
        height: image.height
      };
      metadata.aspectRatio = image.width / image.height;
    }
    
    return metadata;
  }
  
  /**
   * Extracts metadata from audio input.
   * @param {Object} audio - Audio input
   * @param {Object} [options] - Extraction options
   * @returns {Promise<Object>} - Audio metadata
   * @private
   */
  async extractAudioMetadata(audio, options = {}) {
    const metadata = {};
    
    // Extract size
    if (audio.data) {
      metadata.size = Buffer.isBuffer(audio.data) ? audio.data.length : Buffer.byteLength(audio.data);
    }
    
    // Extract duration
    if (audio.duration) {
      metadata.duration = audio.duration;
    }
    
    // Extract audio properties
    if (audio.sampleRate) {
      metadata.sampleRate = audio.sampleRate;
    }
    
    if (audio.channels) {
      metadata.channels = audio.channels;
    }
    
    return metadata;
  }
  
  /**
   * Extracts metadata from video input.
   * @param {Object} video - Video input
   * @param {Object} [options] - Extraction options
   * @returns {Promise<Object>} - Video metadata
   * @private
   */
  async extractVideoMetadata(video, options = {}) {
    const metadata = {};
    
    // Extract size
    if (video.data) {
      metadata.size = Buffer.isBuffer(video.data) ? video.data.length : Buffer.byteLength(video.data);
    }
    
    // Extract duration
    if (video.duration) {
      metadata.duration = video.duration;
    }
    
    // Extract dimensions
    if (video.width && video.height) {
      metadata.dimensions = {
        width: video.width,
        height: video.height
      };
      metadata.aspectRatio = video.width / video.height;
    }
    
    // Extract frame rate
    if (video.frameRate) {
      metadata.frameRate = video.frameRate;
    }
    
    return metadata;
  }
  
  /**
   * Segments input into smaller chunks.
   * @param {Object} input - Input data
   * @param {Object} [options] - Segmentation options
   * @returns {Promise<Object>} - Segmented input
   * @private
   */
  async segmentInput(input, options = {}) {
    try {
      const segmentedInput = { ...input };
      
      // Segment text
      if (input.text && input.text.content) {
        segmentedInput.text = {
          ...input.text,
          segments: await this.segmentText(input.text, options)
        };
      }
      
      // Segment image (if needed)
      if (input.image && input.image.data && Buffer.isBuffer(input.image.data) && input.image.data.length > this.segmentSize) {
        segmentedInput.image = {
          ...input.image,
          segments: await this.segmentBinaryData(input.image.data, options)
        };
      }
      
      // Segment audio (if needed)
      if (input.audio && input.audio.data && Buffer.isBuffer(input.audio.data) && input.audio.data.length > this.segmentSize) {
        segmentedInput.audio = {
          ...input.audio,
          segments: await this.segmentBinaryData(input.audio.data, options)
        };
      }
      
      // Segment video (if needed)
      if (input.video && input.video.data && Buffer.isBuffer(input.video.data) && input.video.data.length > this.segmentSize) {
        segmentedInput.video = {
          ...input.video,
          segments: await this.segmentBinaryData(input.video.data, options)
        };
      }
      
      return segmentedInput;
    } catch (error) {
      this.logger.error('Input segmentation failed:', error);
      throw error;
    }
  }
  
  /**
   * Segments text into smaller chunks.
   * @param {Object} text - Text input
   * @param {Object} [options] - Segmentation options
   * @returns {Promise<Array<Object>>} - Text segments
   * @private
   */
  async segmentText(text, options = {}) {
    const content = text.content;
    const segmentSize = options.segmentSize || this.segmentSize;
    const segments = [];
    
    // If content is small enough, return as is
    if (content.length <= segmentSize) {
      return [{
        id: 0,
        content,
        start: 0,
        end: content.length
      }];
    }
    
    // Split by paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    let currentSegment = '';
    let currentStart = 0;
    let segmentId = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // If adding this paragraph would exceed segment size, create a new segment
      if (currentSegment.length + paragraph.length + 2 > segmentSize && currentSegment.length > 0) {
        segments.push({
          id: segmentId++,
          content: currentSegment,
          start: currentStart,
          end: currentStart + currentSegment.length
        });
        
        currentSegment = paragraph;
        currentStart += currentSegment.length + 2; // +2 for paragraph separator
      } else {
        // Add paragraph to current segment
        if (currentSegment.length > 0) {
          currentSegment += '\n\n';
        }
        
        currentSegment += paragraph;
      }
    }
    
    // Add final segment
    if (currentSegment.length > 0) {
      segments.push({
        id: segmentId,
        content: currentSegment,
        start: currentStart,
        end: currentStart + currentSegment.length
      });
    }
    
    return segments;
  }
  
  /**
   * Segments binary data into smaller chunks.
   * @param {Buffer} data - Binary data
   * @param {Object} [options] - Segmentation options
   * @returns {Promise<Array<Object>>} - Binary segments
   * @private
   */
  async segmentBinaryData(data, options = {}) {
    const segmentSize = options.segmentSize || this.segmentSize;
    const segments = [];
    
    // If data is small enough, return as is
    if (data.length <= segmentSize) {
      return [{
        id: 0,
        data,
        start: 0,
        end: data.length
      }];
    }
    
    // Split into chunks
    let segmentId = 0;
    for (let start = 0; start < data.length; start += segmentSize) {
      const end = Math.min(start + segmentSize, data.length);
      const segmentData = data.slice(start, end);
      
      segments.push({
        id: segmentId++,
        data: segmentData,
        start,
        end
      });
    }
    
    return segments;
  }
}

module.exports = InputPipeline;
