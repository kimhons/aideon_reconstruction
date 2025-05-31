/**
 * @fileoverview Intent model for the Learning from Demonstration system.
 * Represents a user intent inferred from a sequence of actions.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const { ValidationError } = require('../utils/ErrorHandler');

/**
 * Represents an inferred user intent.
 */
class Intent {
  /**
   * Intent types
   * @enum {string}
   */
  static TYPES = {
    NAVIGATION: 'navigation',
    DATA_ENTRY: 'data_entry',
    DATA_RETRIEVAL: 'data_retrieval',
    FILE_OPERATION: 'file_operation',
    COMMUNICATION: 'communication',
    CONFIGURATION: 'configuration',
    SEARCH: 'search',
    SELECTION: 'selection',
    CREATION: 'creation',
    DELETION: 'deletion',
    MODIFICATION: 'modification',
    AUTOMATION: 'automation',
    CUSTOM: 'custom'
  };

  /**
   * Creates a new Intent instance.
   * @param {Object} options - Intent options
   * @param {string} options.id - Unique identifier for the intent
   * @param {string} options.type - Type of intent (from Intent.TYPES)
   * @param {string} options.name - Human-readable name for the intent
   * @param {string} [options.description=''] - Optional description
   * @param {number} [options.confidence=1.0] - Confidence score (0.0-1.0)
   * @param {Object} [options.parameters={}] - Intent parameters
   * @param {Object} [options.context={}] - Additional context data
   * @param {Array} [options.relatedActionIds=[]] - IDs of related actions
   */
  constructor(options) {
    if (!options || typeof options !== 'object') {
      throw new ValidationError('Intent options must be an object');
    }
    
    if (!options.id || typeof options.id !== 'string') {
      throw new ValidationError('Intent ID is required and must be a string');
    }
    
    if (!options.type || typeof options.type !== 'string') {
      throw new ValidationError('Intent type is required and must be a string');
    }
    
    if (!options.name || typeof options.name !== 'string') {
      throw new ValidationError('Intent name is required and must be a string');
    }
    
    this.id = options.id;
    this.type = options.type;
    this.name = options.name;
    this.description = options.description || '';
    this.confidence = options.confidence !== undefined ? options.confidence : 1.0;
    this.parameters = { ...options.parameters } || {};
    this.context = { ...options.context } || {};
    this.relatedActionIds = [...(options.relatedActionIds || [])];
    this.createdAt = new Date();
    
    // Validate confidence score
    if (typeof this.confidence !== 'number' || this.confidence < 0 || this.confidence > 1) {
      throw new ValidationError('Confidence score must be a number between 0 and 1');
    }
  }

  /**
   * Updates the intent parameters.
   * @param {Object} parameters - Parameters to update
   * @returns {Intent} This instance for chaining
   */
  updateParameters(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new ValidationError('Parameters must be an object');
    }
    
    this.parameters = { ...this.parameters, ...parameters };
    return this;
  }

  /**
   * Updates the intent context.
   * @param {Object} context - Context to update
   * @returns {Intent} This instance for chaining
   */
  updateContext(context) {
    if (!context || typeof context !== 'object') {
      throw new ValidationError('Context must be an object');
    }
    
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Sets the confidence score.
   * @param {number} confidence - Confidence score (0.0-1.0)
   * @returns {Intent} This instance for chaining
   */
  setConfidence(confidence) {
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new ValidationError('Confidence score must be a number between 0 and 1');
    }
    
    this.confidence = confidence;
    return this;
  }

  /**
   * Adds related action IDs.
   * @param {string|Array} actionIds - Action ID or array of action IDs
   * @returns {Intent} This instance for chaining
   */
  addRelatedActionIds(actionIds) {
    if (Array.isArray(actionIds)) {
      for (const id of actionIds) {
        if (typeof id !== 'string') {
          throw new ValidationError('Each action ID must be a string');
        }
        if (!this.relatedActionIds.includes(id)) {
          this.relatedActionIds.push(id);
        }
      }
    } else if (typeof actionIds === 'string') {
      if (!this.relatedActionIds.includes(actionIds)) {
        this.relatedActionIds.push(actionIds);
      }
    } else {
      throw new ValidationError('Action IDs must be a string or array of strings');
    }
    
    return this;
  }

  /**
   * Converts the intent to a plain object.
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      confidence: this.confidence,
      parameters: { ...this.parameters },
      context: { ...this.context },
      relatedActionIds: [...this.relatedActionIds],
      createdAt: this.createdAt
    };
  }

  /**
   * Creates an intent from a plain object.
   * @param {Object} obj - Plain object representation
   * @returns {Intent} New intent instance
   */
  static fromObject(obj) {
    const intent = new Intent({
      id: obj.id,
      type: obj.type,
      name: obj.name,
      description: obj.description,
      confidence: obj.confidence,
      parameters: obj.parameters,
      context: obj.context,
      relatedActionIds: obj.relatedActionIds
    });
    
    intent.createdAt = new Date(obj.createdAt);
    
    return intent;
  }
}

module.exports = Intent;
