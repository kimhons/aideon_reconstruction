/**
 * @fileoverview Demonstration model for the Learning from Demonstration system.
 * Represents a captured user demonstration with associated metadata and actions.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const { ValidationError } = require('../utils/ErrorHandler');

/**
 * Represents a captured user demonstration.
 */
class Demonstration {
  /**
   * Creates a new Demonstration instance.
   * @param {Object} options - Demonstration options
   * @param {string} options.id - Unique identifier for the demonstration
   * @param {string} options.name - Human-readable name for the demonstration
   * @param {string} [options.description=''] - Optional description
   * @param {Object} [options.metadata={}] - Additional metadata
   * @param {Date} [options.createdAt=new Date()] - Creation timestamp
   * @param {Array} [options.actions=[]] - Captured actions
   * @param {Object} [options.context={}] - Demonstration context
   */
  constructor(options) {
    if (!options || typeof options !== 'object') {
      throw new ValidationError('Demonstration options must be an object');
    }
    
    if (!options.id || typeof options.id !== 'string') {
      throw new ValidationError('Demonstration ID is required and must be a string');
    }
    
    if (!options.name || typeof options.name !== 'string') {
      throw new ValidationError('Demonstration name is required and must be a string');
    }
    
    this.id = options.id;
    this.name = options.name;
    this.description = options.description || '';
    this.metadata = { ...options.metadata } || {};
    this.createdAt = options.createdAt || new Date();
    this.actions = [...(options.actions || [])];
    this.context = { ...options.context } || {};
    this.modifiedAt = this.createdAt;
    this.duration = 0; // Will be calculated when actions are added
  }

  /**
   * Adds an action to the demonstration.
   * @param {Object} action - Action to add
   * @returns {Demonstration} This instance for chaining
   */
  addAction(action) {
    if (!action || typeof action !== 'object') {
      throw new ValidationError('Action must be an object');
    }
    
    if (!action.timestamp || !(action.timestamp instanceof Date)) {
      throw new ValidationError('Action must have a valid timestamp');
    }
    
    this.actions.push(action);
    this.modifiedAt = new Date();
    
    // Recalculate duration
    this._updateDuration();
    
    return this;
  }

  /**
   * Adds multiple actions to the demonstration.
   * @param {Array} actions - Actions to add
   * @returns {Demonstration} This instance for chaining
   */
  addActions(actions) {
    if (!Array.isArray(actions)) {
      throw new ValidationError('Actions must be an array');
    }
    
    for (const action of actions) {
      if (!action || typeof action !== 'object') {
        throw new ValidationError('Each action must be an object');
      }
      
      if (!action.timestamp || !(action.timestamp instanceof Date)) {
        throw new ValidationError('Each action must have a valid timestamp');
      }
      
      this.actions.push(action);
    }
    
    this.modifiedAt = new Date();
    
    // Recalculate duration
    this._updateDuration();
    
    return this;
  }

  /**
   * Updates the demonstration metadata.
   * @param {Object} metadata - Metadata to update
   * @returns {Demonstration} This instance for chaining
   */
  updateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new ValidationError('Metadata must be an object');
    }
    
    this.metadata = { ...this.metadata, ...metadata };
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Updates the demonstration context.
   * @param {Object} context - Context to update
   * @returns {Demonstration} This instance for chaining
   */
  updateContext(context) {
    if (!context || typeof context !== 'object') {
      throw new ValidationError('Context must be an object');
    }
    
    this.context = { ...this.context, ...context };
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Gets actions within a specific time range.
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Array} Actions within the time range
   */
  getActionsInTimeRange(startTime, endTime) {
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
      throw new ValidationError('Start and end times must be Date objects');
    }
    
    return this.actions.filter(action => 
      action.timestamp >= startTime && action.timestamp <= endTime
    );
  }

  /**
   * Gets actions of a specific type.
   * @param {string} type - Action type
   * @returns {Array} Actions of the specified type
   */
  getActionsByType(type) {
    if (typeof type !== 'string') {
      throw new ValidationError('Action type must be a string');
    }
    
    return this.actions.filter(action => action.type === type);
  }

  /**
   * Sorts actions by timestamp.
   * @returns {Demonstration} This instance for chaining
   */
  sortActions() {
    this.actions.sort((a, b) => a.timestamp - b.timestamp);
    return this;
  }

  /**
   * Converts the demonstration to a plain object.
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      duration: this.duration,
      actions: [...this.actions],
      context: { ...this.context }
    };
  }

  /**
   * Creates a demonstration from a plain object.
   * @param {Object} obj - Plain object representation
   * @returns {Demonstration} New demonstration instance
   */
  static fromObject(obj) {
    const demonstration = new Demonstration({
      id: obj.id,
      name: obj.name,
      description: obj.description,
      metadata: obj.metadata,
      createdAt: new Date(obj.createdAt),
      actions: [],
      context: obj.context
    });
    
    // Add actions with proper Date objects
    if (Array.isArray(obj.actions)) {
      for (const action of obj.actions) {
        const actionCopy = { ...action };
        if (typeof actionCopy.timestamp === 'string') {
          actionCopy.timestamp = new Date(actionCopy.timestamp);
        }
        demonstration.actions.push(actionCopy);
      }
    }
    
    demonstration.modifiedAt = new Date(obj.modifiedAt || obj.createdAt);
    demonstration._updateDuration();
    
    return demonstration;
  }

  /**
   * Updates the demonstration duration based on actions.
   * @private
   */
  _updateDuration() {
    if (this.actions.length === 0) {
      this.duration = 0;
      return;
    }
    
    // Sort actions by timestamp
    this.sortActions();
    
    // Calculate duration from first to last action
    const firstAction = this.actions[0];
    const lastAction = this.actions[this.actions.length - 1];
    
    this.duration = lastAction.timestamp - firstAction.timestamp;
  }
}

module.exports = Demonstration;
