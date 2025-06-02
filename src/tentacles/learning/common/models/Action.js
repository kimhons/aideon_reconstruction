/**
 * @fileoverview Action model for the Learning from Demonstration system.
 * Represents a discrete user action captured during a demonstration.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const { ValidationError } = require('../utils/ErrorHandler');

/**
 * Represents a discrete user action.
 */
class Action {
  /**
   * Action types
   * @enum {string}
   */
  static TYPES = {
    MOUSE_MOVE: 'mouse_move',
    MOUSE_CLICK: 'mouse_click',
    MOUSE_DRAG: 'mouse_drag',
    MOUSE_SCROLL: 'mouse_scroll',
    KEY_PRESS: 'key_press',
    KEY_COMBINATION: 'key_combination',
    TEXT_INPUT: 'text_input',
    UI_INTERACTION: 'ui_interaction',
    VOICE_COMMAND: 'voice_command',
    SCREEN_CHANGE: 'screen_change',
    SYSTEM_EVENT: 'system_event',
    CUSTOM: 'custom'
  };

  /**
   * Creates a new Action instance.
   * @param {Object} options - Action options
   * @param {string} options.id - Unique identifier for the action
   * @param {string} options.type - Type of action (from Action.TYPES)
   * @param {Date} options.timestamp - When the action occurred
   * @param {Object} options.data - Action-specific data
   * @param {Object} [options.context={}] - Additional context data
   * @param {number} [options.confidence=1.0] - Confidence score (0.0-1.0)
   * @param {string} [options.source='user'] - Source of the action
   */
  constructor(options) {
    if (!options || typeof options !== 'object') {
      throw new ValidationError('Action options must be an object');
    }
    
    if (!options.id || typeof options.id !== 'string') {
      throw new ValidationError('Action ID is required and must be a string');
    }
    
    if (!options.type || typeof options.type !== 'string') {
      throw new ValidationError('Action type is required and must be a string');
    }
    
    if (!options.timestamp || !(options.timestamp instanceof Date)) {
      throw new ValidationError('Action timestamp is required and must be a Date object');
    }
    
    if (!options.data || typeof options.data !== 'object') {
      throw new ValidationError('Action data is required and must be an object');
    }
    
    this.id = options.id;
    this.type = options.type;
    this.timestamp = options.timestamp;
    this.data = { ...options.data };
    this.context = { ...options.context } || {};
    this.confidence = options.confidence !== undefined ? options.confidence : 1.0;
    this.source = options.source || 'user';
    
    // Validate confidence score
    if (typeof this.confidence !== 'number' || this.confidence < 0 || this.confidence > 1) {
      throw new ValidationError('Confidence score must be a number between 0 and 1');
    }
  }

  /**
   * Updates the action data.
   * @param {Object} data - Data to update
   * @returns {Action} This instance for chaining
   */
  updateData(data) {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Data must be an object');
    }
    
    this.data = { ...this.data, ...data };
    return this;
  }

  /**
   * Updates the action context.
   * @param {Object} context - Context to update
   * @returns {Action} This instance for chaining
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
   * @returns {Action} This instance for chaining
   */
  setConfidence(confidence) {
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new ValidationError('Confidence score must be a number between 0 and 1');
    }
    
    this.confidence = confidence;
    return this;
  }

  /**
   * Converts the action to a plain object.
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      data: { ...this.data },
      context: { ...this.context },
      confidence: this.confidence,
      source: this.source
    };
  }

  /**
   * Creates an action from a plain object.
   * @param {Object} obj - Plain object representation
   * @returns {Action} New action instance
   */
  static fromObject(obj) {
    return new Action({
      id: obj.id,
      type: obj.type,
      timestamp: new Date(obj.timestamp),
      data: obj.data,
      context: obj.context,
      confidence: obj.confidence,
      source: obj.source
    });
  }

  /**
   * Creates a mouse move action.
   * @param {Object} options - Action options
   * @param {string} options.id - Unique identifier
   * @param {Date} options.timestamp - When the action occurred
   * @param {number} options.x - X coordinate
   * @param {number} options.y - Y coordinate
   * @param {Object} [options.context={}] - Additional context
   * @returns {Action} New mouse move action
   */
  static createMouseMove(options) {
    return new Action({
      id: options.id,
      type: Action.TYPES.MOUSE_MOVE,
      timestamp: options.timestamp,
      data: {
        x: options.x,
        y: options.y
      },
      context: options.context,
      source: options.source
    });
  }

  /**
   * Creates a mouse click action.
   * @param {Object} options - Action options
   * @param {string} options.id - Unique identifier
   * @param {Date} options.timestamp - When the action occurred
   * @param {number} options.x - X coordinate
   * @param {number} options.y - Y coordinate
   * @param {string} options.button - Mouse button ('left', 'right', 'middle')
   * @param {boolean} [options.doubleClick=false] - Whether this was a double-click
   * @param {Object} [options.context={}] - Additional context
   * @returns {Action} New mouse click action
   */
  static createMouseClick(options) {
    return new Action({
      id: options.id,
      type: Action.TYPES.MOUSE_CLICK,
      timestamp: options.timestamp,
      data: {
        x: options.x,
        y: options.y,
        button: options.button,
        doubleClick: options.doubleClick || false
      },
      context: options.context,
      source: options.source
    });
  }

  /**
   * Creates a key press action.
   * @param {Object} options - Action options
   * @param {string} options.id - Unique identifier
   * @param {Date} options.timestamp - When the action occurred
   * @param {string} options.key - Key that was pressed
   * @param {boolean} [options.ctrl=false] - Whether Ctrl was held
   * @param {boolean} [options.alt=false] - Whether Alt was held
   * @param {boolean} [options.shift=false] - Whether Shift was held
   * @param {boolean} [options.meta=false] - Whether Meta/Command was held
   * @param {Object} [options.context={}] - Additional context
   * @returns {Action} New key press action
   */
  static createKeyPress(options) {
    return new Action({
      id: options.id,
      type: Action.TYPES.KEY_PRESS,
      timestamp: options.timestamp,
      data: {
        key: options.key,
        ctrl: options.ctrl || false,
        alt: options.alt || false,
        shift: options.shift || false,
        meta: options.meta || false
      },
      context: options.context,
      source: options.source
    });
  }

  /**
   * Creates a text input action.
   * @param {Object} options - Action options
   * @param {string} options.id - Unique identifier
   * @param {Date} options.timestamp - When the action occurred
   * @param {string} options.text - Text that was input
   * @param {Object} [options.target={}] - Target element information
   * @param {Object} [options.context={}] - Additional context
   * @returns {Action} New text input action
   */
  static createTextInput(options) {
    return new Action({
      id: options.id,
      type: Action.TYPES.TEXT_INPUT,
      timestamp: options.timestamp,
      data: {
        text: options.text,
        target: options.target || {}
      },
      context: options.context,
      source: options.source
    });
  }

  /**
   * Creates a UI interaction action.
   * @param {Object} options - Action options
   * @param {string} options.id - Unique identifier
   * @param {Date} options.timestamp - When the action occurred
   * @param {string} options.elementType - Type of UI element
   * @param {string} options.elementId - Identifier of the UI element
   * @param {string} options.action - Interaction action (e.g., 'click', 'select')
   * @param {Object} [options.elementProperties={}] - Properties of the UI element
   * @param {Object} [options.context={}] - Additional context
   * @returns {Action} New UI interaction action
   */
  static createUIInteraction(options) {
    return new Action({
      id: options.id,
      type: Action.TYPES.UI_INTERACTION,
      timestamp: options.timestamp,
      data: {
        elementType: options.elementType,
        elementId: options.elementId,
        action: options.action,
        elementProperties: options.elementProperties || {}
      },
      context: options.context,
      source: options.source
    });
  }
}

module.exports = Action;
