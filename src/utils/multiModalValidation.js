/**
 * @fileoverview Extended validation utilities for Aideon components.
 * Provides additional validation functions for multi-modal inputs.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const {
  validateDefined,
  validateType,
  validateNonEmptyString,
  validateNumberInRange,
  validateArrayMinLength,
  validateArrayMaxLength,
  validateRequiredProperties,
  validateAllowedValues,
  validateUrl,
  validateEmail,
  validateNoThrow,
  validateJson,
  validateDate,
  validateRegex,
  validateFilePath,
  validateMimeType
} = require('./validation');

/**
 * Validates multi-modal input.
 * @param {Object} input - Input data to validate
 * @param {Object} [options] - Validation options
 * @returns {Object} - Validated input
 * @throws {Error} If validation fails
 */
function validateInput(input, options = {}) {
  // Check if input is an object
  validateType(input, 'object', 'Input');
  
  // Check if any modality is present
  const hasModality = ['text', 'image', 'audio', 'video'].some(modality => input[modality]);
  
  if (!hasModality) {
    throw new Error('Invalid input: at least one modality must be present');
  }
  
  // Validate each modality
  const validatedInput = { ...input };
  
  // Validate text
  if (input.text) {
    validatedInput.text = validateTextInput(input.text, options);
  }
  
  // Validate image
  if (input.image) {
    validatedInput.image = validateImageInput(input.image, options);
  }
  
  // Validate audio
  if (input.audio) {
    validatedInput.audio = validateAudioInput(input.audio, options);
  }
  
  // Validate video
  if (input.video) {
    validatedInput.video = validateVideoInput(input.video, options);
  }
  
  return validatedInput;
}

/**
 * Validates text input.
 * @param {Object|string} text - Text input
 * @param {Object} [options] - Validation options
 * @returns {Object} - Validated text input
 * @throws {Error} If validation fails
 */
function validateTextInput(text, options = {}) {
  // If text is a string, convert to object
  const textInput = typeof text === 'string' ? { content: text } : text;
  
  // Validate as object
  validateType(textInput, 'object', 'Text input');
  
  // Check if content is present
  if (!textInput.content) {
    throw new Error('Invalid text input: content is required');
  }
  
  // Check content type
  validateType(textInput.content, 'string', 'Text content');
  
  // Check content size
  const maxSize = options.maxSize || 10 * 1024 * 1024; // Default 10MB
  if (textInput.content.length > maxSize) {
    throw new Error(`Invalid text input: content exceeds maximum size of ${maxSize} bytes`);
  }
  
  // Validate format if present
  if (textInput.format) {
    validateAllowedValues(textInput.format, ['plain', 'markdown', 'html', 'json'], 'Text format');
  }
  
  return textInput;
}

/**
 * Validates image input.
 * @param {Object|Buffer|string} image - Image input
 * @param {Object} [options] - Validation options
 * @returns {Object} - Validated image input
 * @throws {Error} If validation fails
 */
function validateImageInput(image, options = {}) {
  // If image is a Buffer or string, convert to object
  const imageInput = Buffer.isBuffer(image) || typeof image === 'string'
    ? { data: image }
    : image;
  
  // Validate as object
  validateType(imageInput, 'object', 'Image input');
  
  // Check if data or url is present
  if (!imageInput.data && !imageInput.url) {
    throw new Error('Invalid image input: data or url is required');
  }
  
  // Check data type
  if (imageInput.data) {
    if (!Buffer.isBuffer(imageInput.data) && typeof imageInput.data !== 'string') {
      throw new Error('Invalid image input: data must be a Buffer or string');
    }
  }
  
  // Check url type
  if (imageInput.url) {
    validateNonEmptyString(imageInput.url, 'Image URL');
  }
  
  // Check data size
  if (imageInput.data) {
    const dataSize = Buffer.isBuffer(imageInput.data)
      ? imageInput.data.length
      : Buffer.byteLength(imageInput.data);
    
    const maxSize = options.maxSize || 50 * 1024 * 1024; // Default 50MB
    if (dataSize > maxSize) {
      throw new Error(`Invalid image input: data exceeds maximum size of ${maxSize} bytes`);
    }
  }
  
  // Validate format if present
  if (imageInput.format) {
    validateAllowedValues(
      imageInput.format, 
      ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'], 
      'Image format'
    );
  }
  
  return imageInput;
}

/**
 * Validates audio input.
 * @param {Object|Buffer|string} audio - Audio input
 * @param {Object} [options] - Validation options
 * @returns {Object} - Validated audio input
 * @throws {Error} If validation fails
 */
function validateAudioInput(audio, options = {}) {
  // If audio is a Buffer or string, convert to object
  const audioInput = Buffer.isBuffer(audio) || typeof audio === 'string'
    ? { data: audio }
    : audio;
  
  // Validate as object
  validateType(audioInput, 'object', 'Audio input');
  
  // Check if data or url is present
  if (!audioInput.data && !audioInput.url) {
    throw new Error('Invalid audio input: data or url is required');
  }
  
  // Check data type
  if (audioInput.data) {
    if (!Buffer.isBuffer(audioInput.data) && typeof audioInput.data !== 'string') {
      throw new Error('Invalid audio input: data must be a Buffer or string');
    }
  }
  
  // Check url type
  if (audioInput.url) {
    validateNonEmptyString(audioInput.url, 'Audio URL');
  }
  
  // Check data size
  if (audioInput.data) {
    const dataSize = Buffer.isBuffer(audioInput.data)
      ? audioInput.data.length
      : Buffer.byteLength(audioInput.data);
    
    const maxSize = options.maxSize || 100 * 1024 * 1024; // Default 100MB
    if (dataSize > maxSize) {
      throw new Error(`Invalid audio input: data exceeds maximum size of ${maxSize} bytes`);
    }
  }
  
  // Validate format if present
  if (audioInput.format) {
    validateAllowedValues(
      audioInput.format, 
      ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'], 
      'Audio format'
    );
  }
  
  // Validate duration if present
  if (audioInput.duration !== undefined) {
    validateNumberInRange(audioInput.duration, 0, null, 'Audio duration');
  }
  
  // Validate sample rate if present
  if (audioInput.sampleRate !== undefined) {
    validateNumberInRange(audioInput.sampleRate, 8000, 192000, 'Audio sample rate');
  }
  
  // Validate channels if present
  if (audioInput.channels !== undefined) {
    validateNumberInRange(audioInput.channels, 1, 8, 'Audio channels');
  }
  
  return audioInput;
}

/**
 * Validates video input.
 * @param {Object|Buffer|string} video - Video input
 * @param {Object} [options] - Validation options
 * @returns {Object} - Validated video input
 * @throws {Error} If validation fails
 */
function validateVideoInput(video, options = {}) {
  // If video is a Buffer or string, convert to object
  const videoInput = Buffer.isBuffer(video) || typeof video === 'string'
    ? { data: video }
    : video;
  
  // Validate as object
  validateType(videoInput, 'object', 'Video input');
  
  // Check if data or url is present
  if (!videoInput.data && !videoInput.url) {
    throw new Error('Invalid video input: data or url is required');
  }
  
  // Check data type
  if (videoInput.data) {
    if (!Buffer.isBuffer(videoInput.data) && typeof videoInput.data !== 'string') {
      throw new Error('Invalid video input: data must be a Buffer or string');
    }
  }
  
  // Check url type
  if (videoInput.url) {
    validateNonEmptyString(videoInput.url, 'Video URL');
  }
  
  // Check data size
  if (videoInput.data) {
    const dataSize = Buffer.isBuffer(videoInput.data)
      ? videoInput.data.length
      : Buffer.byteLength(videoInput.data);
    
    const maxSize = options.maxSize || 500 * 1024 * 1024; // Default 500MB
    if (dataSize > maxSize) {
      throw new Error(`Invalid video input: data exceeds maximum size of ${maxSize} bytes`);
    }
  }
  
  // Validate format if present
  if (videoInput.format) {
    validateAllowedValues(
      videoInput.format, 
      ['mp4', 'webm', 'avi', 'mov', 'mkv'], 
      'Video format'
    );
  }
  
  // Validate duration if present
  if (videoInput.duration !== undefined) {
    validateNumberInRange(videoInput.duration, 0, null, 'Video duration');
  }
  
  // Validate width and height if present
  if (videoInput.width !== undefined) {
    validateNumberInRange(videoInput.width, 0, null, 'Video width');
  }
  
  if (videoInput.height !== undefined) {
    validateNumberInRange(videoInput.height, 0, null, 'Video height');
  }
  
  // Validate frame rate if present
  if (videoInput.frameRate !== undefined) {
    validateNumberInRange(videoInput.frameRate, 0, 240, 'Video frame rate');
  }
  
  return videoInput;
}

module.exports = {
  validateInput,
  validateTextInput,
  validateImageInput,
  validateAudioInput,
  validateVideoInput,
  // Re-export base validation utilities
  validateDefined,
  validateType,
  validateNonEmptyString,
  validateNumberInRange,
  validateArrayMinLength,
  validateArrayMaxLength,
  validateRequiredProperties,
  validateAllowedValues,
  validateUrl,
  validateEmail,
  validateNoThrow,
  validateJson,
  validateDate,
  validateRegex,
  validateFilePath,
  validateMimeType
};
