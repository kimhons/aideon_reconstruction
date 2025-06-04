/**
 * @fileoverview Base Model Adapter for the Model Integration and Intelligence Framework (MIIF)
 * Provides a common interface for all model adapters
 * 
 * @module src/core/miif/models/BaseModelAdapter
 */

const EventEmitter = require('events');

/**
 * Base Model Adapter
 * Provides a common interface for all model adapters
 * @extends EventEmitter
 */
class BaseModelAdapter extends EventEmitter {
  /**
   * Create a new Base Model Adapter
   * @param {string} modelId - Unique identifier for the model
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(modelId, options = {}, dependencies = {}) {
    super();
    
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    this.modelId = modelId;
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.initialized = false;
    
    this.logger.debug(`[BaseModelAdapter] Created adapter for model: ${modelId}`);
  }
  
  /**
   * Initialize the model
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    throw new Error('Method not implemented: initialize()');
  }
  
  /**
   * Unload model from memory
   * @returns {Promise<boolean>} Success status
   */
  async unload() {
    throw new Error('Method not implemented: unload()');
  }
  
  /**
   * Get model information
   * @returns {Object} Model information
   */
  getModelInfo() {
    throw new Error('Method not implemented: getModelInfo()');
  }
  
  /**
   * Check if model supports a specific task
   * @param {string} task - Task to check
   * @returns {boolean} Whether the model supports the task
   */
  supportsTask(task) {
    throw new Error('Method not implemented: supportsTask()');
  }
  
  /**
   * Get memory requirements for the model
   * @returns {Object} Memory requirements
   */
  getMemoryRequirements() {
    throw new Error('Method not implemented: getMemoryRequirements()');
  }
  
  /**
   * Get model status
   * @returns {Object} Model status
   */
  getStatus() {
    return {
      modelId: this.modelId,
      initialized: this.initialized,
      ...this.getModelInfo()
    };
  }
}

module.exports = BaseModelAdapter;
