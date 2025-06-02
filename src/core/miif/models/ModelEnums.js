/**
 * @fileoverview Model Enums for the Model Integration and Intelligence Framework (MIIF)
 * Provides enumerations for model tiers, quantization levels, and task types
 * 
 * @module src/core/miif/models/ModelEnums
 */

/**
 * Model Tier Enumeration
 * Defines the business tiers for model deployment
 * @enum {string}
 */
const ModelTier = {
  STANDARD: 'STANDARD',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
};

/**
 * Quantization Level Enumeration
 * Defines the quantization levels for model optimization
 * @enum {string}
 */
const QuantizationLevel = {
  INT4: 'INT4',
  INT5: 'INT5',
  INT8: 'INT8',
  FP16: 'FP16',
  FP32: 'FP32'
};

/**
 * Model Task Type Enumeration
 * Defines the task types that models can support
 * @enum {string}
 */
const ModelTaskType = {
  // Text tasks
  TEXT_GENERATION: 'text-generation',
  SUMMARIZATION: 'summarization',
  QUESTION_ANSWERING: 'question-answering',
  TRANSLATION: 'translation',
  CODE_GENERATION: 'code-generation',
  REASONING: 'reasoning',
  
  // Image tasks
  IMAGE_CLASSIFICATION: 'image-classification',
  OBJECT_DETECTION: 'object-detection',
  IMAGE_SEGMENTATION: 'image-segmentation',
  IMAGE_GENERATION: 'image-generation',
  IMAGE_EDITING: 'image-editing',
  
  // Video tasks
  VIDEO_CLASSIFICATION: 'video-classification',
  ACTION_RECOGNITION: 'action-recognition',
  VIDEO_GENERATION: 'video-generation',
  VIDEO_EDITING: 'video-editing',
  
  // Multimodal tasks
  TEXT_TO_IMAGE: 'text-to-image',
  IMAGE_TO_TEXT: 'image-to-text',
  TEXT_TO_VIDEO: 'text-to-video',
  VIDEO_TO_TEXT: 'video-to-text'
};

/**
 * Model Modality Enumeration
 * Defines the modalities that models can support
 * @enum {string}
 */
const ModelModality = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  MULTIMODAL: 'MULTIMODAL'
};

module.exports = {
  ModelTier,
  QuantizationLevel,
  ModelTaskType,
  ModelModality
};
