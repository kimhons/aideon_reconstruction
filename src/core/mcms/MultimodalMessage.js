/**
 * MultimodalMessage.js
 * 
 * Extends the base Message class to support multimodal content including
 * visual, audio, screen, world model, and personal contexts.
 * Based on Google's Project Astra multimodal capabilities announced at I/O 2025.
 * 
 * @author Aideon Team
 * @version 1.0.0
 */

const { Message } = require('./Message');

/**
 * Class for multimodal messages with support for various context types
 * @extends Message
 */
class MultimodalMessage extends Message {
  /**
   * Create a new MultimodalMessage
   * @param {string} channel - The channel this message is published to
   * @param {any} data - The message data
   * @param {Object} [metadata={}] - Additional message metadata
   */
  constructor(channel, data, metadata = {}) {
    super(channel, data, metadata);
    
    /**
     * Visual context data (images, video frames, etc.)
     * @type {Object|null}
     */
    this.visualContext = null;
    
    /**
     * Audio context data (speech, sounds, etc.)
     * @type {Object|null}
     */
    this.audioContext = null;
    
    /**
     * Screen context data (screenshots, UI state, etc.)
     * @type {Object|null}
     */
    this.screenContext = null;
    
    /**
     * World model context data (environment state, predictions, etc.)
     * @type {Object|null}
     */
    this.worldModelContext = null;
    
    /**
     * Personal context data (user preferences, history, etc.)
     * @type {Object|null}
     */
    this.personalContext = null;
    
    // Set message type
    this.metadata.type = 'multimodal';
  }
  
  /**
   * Attach visual context to the message
   * @param {Object} visualContext - Visual context data
   */
  attachVisualContext(visualContext) {
    this.visualContext = visualContext;
    this.metadata.hasVisualContext = true;
  }
  
  /**
   * Attach audio context to the message
   * @param {Object} audioContext - Audio context data
   */
  attachAudioContext(audioContext) {
    this.audioContext = audioContext;
    this.metadata.hasAudioContext = true;
  }
  
  /**
   * Attach screen context to the message
   * @param {Object} screenContext - Screen context data
   */
  attachScreenContext(screenContext) {
    this.screenContext = screenContext;
    this.metadata.hasScreenContext = true;
  }
  
  /**
   * Attach world model context to the message
   * @param {Object} worldModelContext - World model context data
   */
  attachWorldModelContext(worldModelContext) {
    this.worldModelContext = worldModelContext;
    this.metadata.hasWorldModelContext = true;
  }
  
  /**
   * Attach personal context to the message
   * @param {Object} personalContext - Personal context data
   */
  attachPersonalContext(personalContext) {
    this.personalContext = personalContext;
    this.metadata.hasPersonalContext = true;
  }
  
  /**
   * Check if the message has visual context
   * @returns {boolean} - True if the message has visual context
   */
  hasVisualContext() {
    return !!this.visualContext;
  }
  
  /**
   * Check if the message has audio context
   * @returns {boolean} - True if the message has audio context
   */
  hasAudioContext() {
    return !!this.audioContext;
  }
  
  /**
   * Check if the message has screen context
   * @returns {boolean} - True if the message has screen context
   */
  hasScreenContext() {
    return !!this.screenContext;
  }
  
  /**
   * Check if the message has world model context
   * @returns {boolean} - True if the message has world model context
   */
  hasWorldModelContext() {
    return !!this.worldModelContext;
  }
  
  /**
   * Check if the message has personal context
   * @returns {boolean} - True if the message has personal context
   */
  hasPersonalContext() {
    return !!this.personalContext;
  }
  
  /**
   * Get the number of attached contexts
   * @returns {number} - Number of attached contexts
   */
  getContextCount() {
    let count = 0;
    if (this.hasVisualContext()) count++;
    if (this.hasAudioContext()) count++;
    if (this.hasScreenContext()) count++;
    if (this.hasWorldModelContext()) count++;
    if (this.hasPersonalContext()) count++;
    return count;
  }
  
  /**
   * Create a response message
   * @param {any} data - Response data
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {MultimodalMessage} - Response message
   * @override
   */
  createResponse(data, metadata = {}) {
    const responseChannel = `${this.channel}.response`;
    const responseMetadata = {
      ...metadata,
      correlationId: this.id,
      isResponse: true
    };
    
    const response = new MultimodalMessage(responseChannel, data, responseMetadata);
    
    // Copy contexts if not explicitly overridden
    if (this.hasVisualContext() && !('visualContext' in metadata)) {
      response.attachVisualContext(this.visualContext);
    }
    
    if (this.hasAudioContext() && !('audioContext' in metadata)) {
      response.attachAudioContext(this.audioContext);
    }
    
    if (this.hasScreenContext() && !('screenContext' in metadata)) {
      response.attachScreenContext(this.screenContext);
    }
    
    if (this.hasWorldModelContext() && !('worldModelContext' in metadata)) {
      response.attachWorldModelContext(this.worldModelContext);
    }
    
    if (this.hasPersonalContext() && !('personalContext' in metadata)) {
      response.attachPersonalContext(this.personalContext);
    }
    
    return response;
  }
  
  /**
   * Serialize the message to a string
   * @returns {string} - Serialized message
   * @override
   */
  serialize() {
    return JSON.stringify({
      id: this.id,
      channel: this.channel,
      data: this.data,
      metadata: this.metadata,
      visualContext: this.visualContext,
      audioContext: this.audioContext,
      screenContext: this.screenContext,
      worldModelContext: this.worldModelContext,
      personalContext: this.personalContext
    });
  }
  
  /**
   * Deserialize a multimodal message from a string
   * @param {string} serialized - Serialized message
   * @returns {MultimodalMessage} - Deserialized message
   * @static
   */
  static deserialize(serialized) {
    const {
      id,
      channel,
      data,
      metadata,
      visualContext,
      audioContext,
      screenContext,
      worldModelContext,
      personalContext
    } = JSON.parse(serialized);
    
    const message = new MultimodalMessage(channel, data, metadata);
    message.id = id;
    
    if (visualContext) {
      message.attachVisualContext(visualContext);
    }
    
    if (audioContext) {
      message.attachAudioContext(audioContext);
    }
    
    if (screenContext) {
      message.attachScreenContext(screenContext);
    }
    
    if (worldModelContext) {
      message.attachWorldModelContext(worldModelContext);
    }
    
    if (personalContext) {
      message.attachPersonalContext(personalContext);
    }
    
    return message;
  }
  
  /**
   * Clone this message
   * @returns {MultimodalMessage} - Cloned message
   * @override
   */
  clone() {
    const cloned = new MultimodalMessage(
      this.channel,
      JSON.parse(JSON.stringify(this.data)),
      JSON.parse(JSON.stringify(this.metadata))
    );
    
    if (this.hasVisualContext()) {
      cloned.attachVisualContext(JSON.parse(JSON.stringify(this.visualContext)));
    }
    
    if (this.hasAudioContext()) {
      cloned.attachAudioContext(JSON.parse(JSON.stringify(this.audioContext)));
    }
    
    if (this.hasScreenContext()) {
      cloned.attachScreenContext(JSON.parse(JSON.stringify(this.screenContext)));
    }
    
    if (this.hasWorldModelContext()) {
      cloned.attachWorldModelContext(JSON.parse(JSON.stringify(this.worldModelContext)));
    }
    
    if (this.hasPersonalContext()) {
      cloned.attachPersonalContext(JSON.parse(JSON.stringify(this.personalContext)));
    }
    
    return cloned;
  }
  
  /**
   * Convert message to string representation
   * @returns {string} - String representation
   * @override
   */
  toString() {
    return `MultimodalMessage(id=${this.id}, channel=${this.channel}, contexts=${this.getContextCount()})`;
  }
}

module.exports = { MultimodalMessage };
