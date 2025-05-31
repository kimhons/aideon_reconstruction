/**
 * @fileoverview EmotionalIntelligenceManager is the central coordinator for Aideon's
 * emotional intelligence capabilities. It orchestrates emotion recognition, context analysis,
 * empathetic response generation, emotional memory, and learning.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require("events");
// Corrected imports to use the src/tentacles/common/utils directory
const { LockAdapter } = require("../../common/utils/LockAdapter");
const { Logger } = require("../../common/utils/Logger");

/**
 * Central coordinator for Aideon's emotional intelligence capabilities
 */
class EmotionalIntelligenceManager {
  /**
   * Creates a new EmotionalIntelligenceManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {EmotionRecognitionEngine} options.emotionRecognitionEngine - Engine for detecting emotions
   * @param {EmotionalContextAnalyzer} options.emotionalContextAnalyzer - Analyzer for contextual emotion interpretation
   * @param {EmpatheticResponseGenerator} options.empatheticResponseGenerator - Generator for empathetic responses
   * @param {EmotionalMemorySystem} options.emotionalMemorySystem - System for storing emotional history
   * @param {EmotionalLearningModule} options.emotionalLearningModule - Module for learning from emotional interactions
   * @param {Object} [options.mcpContextManager=null] - MCP context manager instance
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options) {
    this.emotionRecognitionEngine = options.emotionRecognitionEngine;
    this.emotionalContextAnalyzer = options.emotionalContextAnalyzer;
    this.empatheticResponseGenerator = options.empatheticResponseGenerator;
    this.emotionalMemorySystem = options.emotionalMemorySystem;
    this.emotionalLearningModule = options.emotionalLearningModule;
    
    // Dependency injection for MCPContextManager
    if (!options.mcpContextManager) {
      throw new Error("MCPContextManager must be provided");
    }
    this.mcpContextManager = options.mcpContextManager;
    
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger("EmotionalIntelligenceManager");
    
    this.events = new EventEmitter();
    this.currentEmotionalState = {
      valence: 0,      // -1 (negative) to 1 (positive)
      arousal: 0,      // -1 (calm) to 1 (excited)
      dominance: 0,    // -1 (submissive) to 1 (dominant)
      confidence: 0,   // 0 (uncertain) to 1 (certain)
      primaryEmotion: null,
      secondaryEmotion: null,
      lastUpdated: Date.now()
    };
    
    this._registerWithMCP();
    this._setupEventListeners();
    
    this.logger.info("EmotionalIntelligenceManager initialized");
  }
  
  /**
   * Processes multimodal input to detect and respond to emotions
   * 
   * @param {Object} input - Multimodal input data
   * @param {Object} [input.facial] - Facial expression data
   * @param {Object} [input.voice] - Voice tone data
   * @param {Object} [input.text] - Text content data
   * @param {Object} [options] - Processing options
   * @param {boolean} [options.generateResponse=true] - Whether to generate a response
   * @param {boolean} [options.updateMemory=true] - Whether to update emotional memory
   * @param {boolean} [options.enableLearning=true] - Whether to enable learning from this interaction
   * @returns {Promise<Object>} Processed emotional data with response if requested
   */
  async processEmotionalInput(input, options = {}) {
    const lockKey = `emotional_process_${Date.now()}`;
    const defaults = { generateResponse: true, updateMemory: true, enableLearning: true };
    const opts = { ...defaults, ...options };
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug("Processing emotional input", { inputTypes: Object.keys(input) });
      
      // Step 1: Detect emotions from multimodal input
      const detectedEmotions = await this.emotionRecognitionEngine.detectEmotions(input);
      
      // Step 2: Analyze emotional context
      const contextualEmotions = await this.emotionalContextAnalyzer.analyzeContext(
        detectedEmotions,
        this.currentEmotionalState
      );
      
      // Step 3: Update current emotional state
      this._updateEmotionalState(contextualEmotions);
      
      // Step 4: Update emotional memory if enabled
      if (opts.updateMemory) {
        await this.emotionalMemorySystem.storeEmotionalEvent({
          input,
          detectedEmotions,
          contextualEmotions,
          timestamp: Date.now()
        });
      }
      
      // Step 5: Generate empathetic response if requested
      let response = null;
      if (opts.generateResponse) {
        response = await this.empatheticResponseGenerator.generateResponse(
          contextualEmotions,
          await this.emotionalMemorySystem.getRecentHistory(5)
        );
      }
      
      // Step 6: Enable learning if requested
      if (opts.enableLearning) {
        this.emotionalLearningModule.learnFromInteraction({
          input,
          detectedEmotions,
          contextualEmotions,
          response,
          timestamp: Date.now()
        });
      }
      
      // Step 7: Publish to MCP context system
      this._publishToMCP();
      
      // Step 8: Emit events
      this.events.emit("emotional_state_updated", this.currentEmotionalState);
      
      return {
        emotionalState: { ...this.currentEmotionalState },
        detectedEmotions,
        contextualEmotions,
        response
      };
    } catch (error) {
      this.logger.error("Error processing emotional input", { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets the current emotional state
   * 
   * @returns {Object} Current emotional state
   */
  getCurrentEmotionalState() {
    return { ...this.currentEmotionalState };
  }
  
  /**
   * Registers an event listener for emotional intelligence events
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  on(event, listener) {
    this.events.on(event, listener);
  }
  
  /**
   * Removes an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   */
  off(event, listener) {
    this.events.off(event, listener);
  }
  
  /**
   * Updates the current emotional state based on new data
   * 
   * @private
   * @param {Object} emotionalData - New emotional data
   */
  _updateEmotionalState(emotionalData) {
    // Apply smoothing to avoid jarring transitions
    const smoothingFactor = 0.7; // 0 = no smoothing, 1 = no change
    
    this.currentEmotionalState = {
      valence: this._smoothValue(this.currentEmotionalState.valence, emotionalData.valence, smoothingFactor),
      arousal: this._smoothValue(this.currentEmotionalState.arousal, emotionalData.arousal, smoothingFactor),
      dominance: this._smoothValue(this.currentEmotionalState.dominance, emotionalData.dominance, smoothingFactor),
      confidence: emotionalData.confidence,
      primaryEmotion: emotionalData.primaryEmotion,
      secondaryEmotion: emotionalData.secondaryEmotion,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Applies smoothing to a value transition
   * 
   * @private
   * @param {number} currentValue - Current value
   * @param {number} newValue - New value
   * @param {number} smoothingFactor - Smoothing factor (0-1)
   * @returns {number} Smoothed value
   */
  _smoothValue(currentValue, newValue, smoothingFactor) {
    return currentValue * smoothingFactor + newValue * (1 - smoothingFactor);
  }
  
  /**
   * Registers with the MCP context system
   * 
   * @private
   */
  _registerWithMCP() {
    try {
      this.mcpContextManager.registerContextProvider("emotional", this);
      this.logger.debug("Registered with MCP context system");
    } catch (error) {
      this.logger.error("Failed to register with MCP context system", { error });
    }
  }
  
  /**
   * Publishes current emotional state to the MCP context system
   * 
   * @private
   */
  _publishToMCP() {
    try {
      this.mcpContextManager.publishContext("emotional", {
        emotionalState: this.currentEmotionalState,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error("Failed to publish to MCP context system", { error });
    }
  }
  
  /**
   * Sets up event listeners for related components
   * 
   * @private
   */
  _setupEventListeners() {
    // Listen for context updates that might affect emotional state
    this.mcpContextManager.on("context_updated", (contextType, contextData) => {
      if (contextType === "conversation" || contextType === "user") {
        this.emotionalContextAnalyzer.updateExternalContext(contextType, contextData);
      }
    });
  }
}

module.exports = { EmotionalIntelligenceManager };
