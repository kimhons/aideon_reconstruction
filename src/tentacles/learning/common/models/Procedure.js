/**
 * @fileoverview Procedure model for the Learning from Demonstration system.
 * Represents a generated procedure from recognized actions and inferred intent.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const { ValidationError } = require('../utils/ErrorHandler');

/**
 * Represents a generated procedure.
 */
class Procedure {
  /**
   * Procedure states
   * @enum {string}
   */
  static STATES = {
    DRAFT: 'draft',
    VALIDATED: 'validated',
    OPTIMIZED: 'optimized',
    PUBLISHED: 'published',
    DEPRECATED: 'deprecated',
    ARCHIVED: 'archived'
  };

  /**
   * Creates a new Procedure instance.
   * @param {Object} options - Procedure options
   * @param {string} options.id - Unique identifier for the procedure
   * @param {string} options.name - Human-readable name for the procedure
   * @param {string} [options.description=''] - Optional description
   * @param {string} [options.state=Procedure.STATES.DRAFT] - Current state
   * @param {string} [options.version='1.0.0'] - Version string
   * @param {Object} [options.metadata={}] - Additional metadata
   * @param {Array} [options.steps=[]] - Procedure steps
   * @param {Object} [options.parameters={}] - Procedure parameters
   * @param {string} [options.sourceId] - ID of source demonstration
   * @param {string} [options.intentId] - ID of inferred intent
   */
  constructor(options) {
    if (!options || typeof options !== 'object') {
      throw new ValidationError('Procedure options must be an object');
    }
    
    if (!options.id || typeof options.id !== 'string') {
      throw new ValidationError('Procedure ID is required and must be a string');
    }
    
    if (!options.name || typeof options.name !== 'string') {
      throw new ValidationError('Procedure name is required and must be a string');
    }
    
    this.id = options.id;
    this.name = options.name;
    this.description = options.description || '';
    this.state = options.state || Procedure.STATES.DRAFT;
    this.version = options.version || '1.0.0';
    this.metadata = { ...options.metadata } || {};
    this.steps = [...(options.steps || [])];
    this.parameters = { ...options.parameters } || {};
    this.sourceId = options.sourceId;
    this.intentId = options.intentId;
    this.createdAt = new Date();
    this.modifiedAt = this.createdAt;
    this.executionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.averageExecutionTime = 0;
  }

  /**
   * Adds a step to the procedure.
   * @param {Object} step - Step to add
   * @returns {Procedure} This instance for chaining
   */
  addStep(step) {
    if (!step || typeof step !== 'object') {
      throw new ValidationError('Step must be an object');
    }
    
    if (!step.id || typeof step.id !== 'string') {
      throw new ValidationError('Step ID is required and must be a string');
    }
    
    if (!step.type || typeof step.type !== 'string') {
      throw new ValidationError('Step type is required and must be a string');
    }
    
    this.steps.push(step);
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Adds multiple steps to the procedure.
   * @param {Array} steps - Steps to add
   * @returns {Procedure} This instance for chaining
   */
  addSteps(steps) {
    if (!Array.isArray(steps)) {
      throw new ValidationError('Steps must be an array');
    }
    
    for (const step of steps) {
      if (!step || typeof step !== 'object') {
        throw new ValidationError('Each step must be an object');
      }
      
      if (!step.id || typeof step.id !== 'string') {
        throw new ValidationError('Each step ID is required and must be a string');
      }
      
      if (!step.type || typeof step.type !== 'string') {
        throw new ValidationError('Each step type is required and must be a string');
      }
      
      this.steps.push(step);
    }
    
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Updates the procedure metadata.
   * @param {Object} metadata - Metadata to update
   * @returns {Procedure} This instance for chaining
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
   * Updates the procedure parameters.
   * @param {Object} parameters - Parameters to update
   * @returns {Procedure} This instance for chaining
   */
  updateParameters(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new ValidationError('Parameters must be an object');
    }
    
    this.parameters = { ...this.parameters, ...parameters };
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Sets the procedure state.
   * @param {string} state - New state (from Procedure.STATES)
   * @returns {Procedure} This instance for chaining
   */
  setState(state) {
    if (!Object.values(Procedure.STATES).includes(state)) {
      throw new ValidationError(`Invalid state: ${state}`);
    }
    
    this.state = state;
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Sets the procedure version.
   * @param {string} version - New version string
   * @returns {Procedure} This instance for chaining
   */
  setVersion(version) {
    if (typeof version !== 'string') {
      throw new ValidationError('Version must be a string');
    }
    
    this.version = version;
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Records an execution of the procedure.
   * @param {boolean} success - Whether the execution was successful
   * @param {number} executionTime - Execution time in milliseconds
   * @returns {Procedure} This instance for chaining
   */
  recordExecution(success, executionTime) {
    this.executionCount++;
    
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    
    // Update average execution time
    if (typeof executionTime === 'number' && executionTime >= 0) {
      const totalTime = this.averageExecutionTime * (this.executionCount - 1) + executionTime;
      this.averageExecutionTime = totalTime / this.executionCount;
    }
    
    this.modifiedAt = new Date();
    
    return this;
  }

  /**
   * Creates a new version of the procedure.
   * @param {string} newVersion - New version string
   * @returns {Procedure} New procedure instance
   */
  createNewVersion(newVersion) {
    const newProcedure = new Procedure({
      id: `${this.id}-${newVersion}`,
      name: this.name,
      description: this.description,
      state: Procedure.STATES.DRAFT,
      version: newVersion,
      metadata: { ...this.metadata, previousVersion: this.version },
      steps: [...this.steps],
      parameters: { ...this.parameters },
      sourceId: this.sourceId,
      intentId: this.intentId
    });
    
    return newProcedure;
  }

  /**
   * Converts the procedure to a plain object.
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      state: this.state,
      version: this.version,
      metadata: { ...this.metadata },
      steps: [...this.steps],
      parameters: { ...this.parameters },
      sourceId: this.sourceId,
      intentId: this.intentId,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      executionCount: this.executionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      averageExecutionTime: this.averageExecutionTime
    };
  }

  /**
   * Creates a procedure from a plain object.
   * @param {Object} obj - Plain object representation
   * @returns {Procedure} New procedure instance
   */
  static fromObject(obj) {
    const procedure = new Procedure({
      id: obj.id,
      name: obj.name,
      description: obj.description,
      state: obj.state,
      version: obj.version,
      metadata: obj.metadata,
      steps: obj.steps,
      parameters: obj.parameters,
      sourceId: obj.sourceId,
      intentId: obj.intentId
    });
    
    procedure.createdAt = new Date(obj.createdAt);
    procedure.modifiedAt = new Date(obj.modifiedAt);
    procedure.executionCount = obj.executionCount || 0;
    procedure.successCount = obj.successCount || 0;
    procedure.failureCount = obj.failureCount || 0;
    procedure.averageExecutionTime = obj.averageExecutionTime || 0;
    
    return procedure;
  }
}

module.exports = Procedure;
