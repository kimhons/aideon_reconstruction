/**
 * @fileoverview Model Enums for Aideon Core
 * Defines constants and enumerations for model types, tiers, and states
 * 
 * @module src/core/miif/models/ModelEnums
 */

/**
 * Model Type enumeration
 * @enum {string}
 */
const ModelType = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  MULTIMODAL: 'multimodal'
};

/**
 * Model Tier enumeration
 * @enum {string}
 */
const ModelTier = {
  STANDARD: 'standard',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
};

/**
 * Model State enumeration
 * @enum {string}
 */
const ModelState = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  LOADING: 'loading',
  LOADED: 'loaded',
  UNLOADING: 'unloading',
  ERROR: 'error'
};

/**
 * Quantization Type enumeration
 * @enum {string}
 */
const QuantizationType = {
  INT4: 'int4',
  INT5: 'int5',
  INT8: 'int8',
  FP16: 'fp16',
  FP32: 'fp32'
};

/**
 * Collaboration Strategy enumeration
 * @enum {string}
 */
const CollaborationStrategy = {
  ENSEMBLE: 'ensemble',
  CHAIN_OF_THOUGHT: 'chain_of_thought',
  TASK_DECOMPOSITION: 'task_decomposition',
  CONSENSUS: 'consensus',
  SPECIALIZED_ROUTING: 'specialized_routing'
};

/**
 * Model Selection Strategy enumeration
 * @enum {string}
 */
const ModelSelectionStrategy = {
  HIGHEST_ACCURACY: 'highest_accuracy',
  LOWEST_LATENCY: 'lowest_latency',
  LOWEST_RESOURCE_USAGE: 'lowest_resource_usage',
  BALANCED: 'balanced',
  SPECIALIZED: 'specialized',
  COLLABORATIVE: 'collaborative'
};

module.exports = {
  ModelType,
  ModelTier,
  ModelState,
  QuantizationType,
  CollaborationStrategy,
  ModelSelectionStrategy
};
