/**
 * @fileoverview Base interface for trigger detectors.
 * 
 * This module defines the base interface that all trigger detectors must implement
 * to be compatible with the TriggerManager.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Base class for all trigger detectors.
 * @abstract
 */
class TriggerDetector {
  /**
   * Creates a new TriggerDetector instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Detector configuration
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.config = options.config || {};
    this.callback = null;
    this.initialized = false;
    this.detecting = false;
    
    // Unique identifier for this detector instance
    this.id = options.id || `${this.getType()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * Initializes the trigger detector.
   * @returns {Promise<void>}
   * @abstract
   */
  async initialize() {
    throw new Error('Method not implemented: initialize()');
  }
  
  /**
   * Starts detection.
   * @returns {Promise<void>}
   * @abstract
   */
  async startDetection() {
    throw new Error('Method not implemented: startDetection()');
  }
  
  /**
   * Stops detection.
   * @returns {Promise<void>}
   * @abstract
   */
  async stopDetection() {
    throw new Error('Method not implemented: stopDetection()');
  }
  
  /**
   * Gets detector metadata.
   * @returns {Object} Detector metadata
   */
  getMetadata() {
    return {
      id: this.id,
      type: this.getType(),
      name: this.getName(),
      description: this.getDescription(),
      version: this.getVersion()
    };
  }
  
  /**
   * Gets detector type.
   * @returns {string} Detector type
   * @abstract
   */
  getType() {
    throw new Error('Method not implemented: getType()');
  }
  
  /**
   * Gets detector name.
   * @returns {string} Detector name
   * @abstract
   */
  getName() {
    throw new Error('Method not implemented: getName()');
  }
  
  /**
   * Gets detector description.
   * @returns {string} Detector description
   * @abstract
   */
  getDescription() {
    throw new Error('Method not implemented: getDescription()');
  }
  
  /**
   * Gets detector version.
   * @returns {string} Detector version
   */
  getVersion() {
    return '1.0.0';
  }
  
  /**
   * Sets callback for trigger events.
   * @param {Function} callback - Callback function
   */
  setCallback(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.callback = callback;
  }
  
  /**
   * Creates a trigger event.
   * @param {Object} data - Event data
   * @returns {Object} Trigger event
   * @protected
   */
  createTriggerEvent(data = {}) {
    return {
      triggerId: this.id,
      triggerType: this.getType(),
      confidence: data.confidence || 1.0,
      context: data.context || {},
      timestamp: Date.now(),
      suggestedDuration: data.suggestedDuration || null,
      metadata: data.metadata || {}
    };
  }
  
  /**
   * Emits a trigger event.
   * @param {Object} data - Event data
   * @protected
   */
  emitTriggerEvent(data = {}) {
    if (!this.callback) {
      this.logger.warn(`No callback set for trigger detector ${this.id}`);
      return;
    }
    
    const event = this.createTriggerEvent(data);
    
    this.logger.debug(`Emitting trigger event: ${JSON.stringify(event)}`);
    
    // Call callback with event
    this.callback(event);
  }
}

module.exports = TriggerDetector;
