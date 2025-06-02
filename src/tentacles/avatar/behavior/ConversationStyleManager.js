/**
 * @fileoverview ConversationStyleManager manages the avatar's conversational style,
 * adapting vocabulary, sentence structure, tone, and pacing based on context.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require("events");
const { LockAdapter } = require("../../common/utils/LockAdapter");
const { Logger } = require("../../common/utils/Logger");

/**
 * Manager for avatar conversation style
 */
class ConversationStyleManager {
  /**
   * Creates a new ConversationStyleManager instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger("ConversationStyleManager");
    this.events = new EventEmitter();
    
    // Initialize style definitions
    this.styles = new Map();
    
    // Initialize current style parameters
    this.currentStyle = {
      id: "neutral",
      name: "Neutral",
      parameters: {
        formality: 0.5, // 0 (very informal) to 1 (very formal)
        directness: 0.5, // 0 (very indirect) to 1 (very direct)
        verbosity: 0.5, // 0 (concise) to 1 (verbose)
        emotionalExpression: 0.5, // 0 (reserved) to 1 (expressive)
        politeness: 0.5, // 0 (blunt) to 1 (very polite)
        humorLevel: 0.2, // 0 (none) to 1 (very humorous)
        vocabularyComplexity: 0.5, // 0 (simple) to 1 (complex)
        sentenceLengthVariation: 0.5 // 0 (uniform) to 1 (varied)
      },
      lastUpdated: Date.now()
    };
    
    // External context influences
    this.externalContext = {
      social: null,
      emotional: null,
      personality: null
    };
    
    // Initialize configuration
    this.config = {
      defaultStyleId: "neutral",
      adaptationSensitivity: 0.7, // How quickly style adapts (0-1)
      enablePersonalityInfluence: true,
      enableEmotionalInfluence: true,
      enableSocialInfluence: true
    };
    
    this.isInitialized = false;
    
    this.logger.info("ConversationStyleManager created");
  }
  
  /**
   * Initializes the conversation style manager
   * 
   * @param {Object} [options] - Initialization options
   * @param {Object} [options.configuration] - Manager configuration
   * @param {Array<Object>} [options.initialStyles] - Initial style definitions
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const lockKey = "conv_style_init";
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (this.isInitialized) {
        this.logger.warn("ConversationStyleManager already initialized");
        return;
      }
      
      this.logger.info("Initializing ConversationStyleManager");
      
      // Apply configuration if provided
      if (options.configuration) {
        this.config = {
          ...this.config,
          ...options.configuration
        };
      }
      
      // Load default styles
      await this._loadDefaultStyles();
      
      // Register initial styles if provided
      if (options.initialStyles && Array.isArray(options.initialStyles)) {
        for (const style of options.initialStyles) {
          await this.registerStyle(style);
        }
      }
      
      // Set initial style
      const initialStyle = this.styles.get(this.config.defaultStyleId);
      if (initialStyle) {
        this.currentStyle = {
          ...initialStyle,
          lastUpdated: Date.now()
        };
      }
      
      this.isInitialized = true;
      this.events.emit("initialized");
      this.logger.info("ConversationStyleManager initialized");
    } catch (error) {
      this.logger.error("Error initializing ConversationStyleManager", { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Adapts the conversation style based on current context
   * 
   * @param {Object} [options] - Adaptation options
   * @returns {Promise<Object>} Adapted conversation style
   */
  async adaptStyle(options = {}) {
    const lockKey = `adapt_style_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error("ConversationStyleManager not initialized");
      }
      
      this.logger.debug("Adapting conversation style");
      
      // Start with the current style parameters
      const targetParameters = { ...this.currentStyle.parameters };
      
      // Apply social context influence
      if (this.config.enableSocialInfluence && this.externalContext.social) {
        this._applySocialInfluence(targetParameters, this.externalContext.social);
      }
      
      // Apply emotional context influence
      if (this.config.enableEmotionalInfluence && this.externalContext.emotional) {
        this._applyEmotionalInfluence(targetParameters, this.externalContext.emotional);
      }
      
      // Apply personality influence
      if (this.config.enablePersonalityInfluence && this.externalContext.personality) {
        this._applyPersonalityInfluence(targetParameters, this.externalContext.personality);
      }
      
      // Blend current style with target style based on sensitivity
      const adaptedParameters = {};
      for (const key in this.currentStyle.parameters) {
        adaptedParameters[key] = 
          this.currentStyle.parameters[key] * (1 - this.config.adaptationSensitivity) +
          targetParameters[key] * this.config.adaptationSensitivity;
        
        // Clamp to 0-1 range
        adaptedParameters[key] = Math.max(0, Math.min(1, adaptedParameters[key]));
      }
      
      // Find the closest matching predefined style (optional)
      const closestStyle = this._findClosestStyle(adaptedParameters);
      
      // Create the new style object
      const newStyle = {
        id: closestStyle ? closestStyle.id : "custom",
        name: closestStyle ? closestStyle.name : "Custom Adapted Style",
        parameters: adaptedParameters,
        lastUpdated: Date.now()
      };
      
      // Check for significant changes
      const hasSignificantChanges = this._hasSignificantStyleChanges(
        this.currentStyle.parameters,
        newStyle.parameters
      );
      
      // Update current style
      this.currentStyle = newStyle;
      
      // Emit event if significant changes occurred
      if (hasSignificantChanges) {
        this.events.emit("style_adapted", newStyle);
      }
      
      return newStyle;
    } catch (error) {
      this.logger.error("Error adapting conversation style", { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets the current conversation style
   *
   * @returns {Object} Current conversation style
   */
  getCurrentStyle() {
    return { ...this.currentStyle };
  }
  
  /**
   * Sets the conversation style explicitly
   *
   * @param {string} styleId - ID of the style to set
   * @returns {Promise<Object>} Set conversation style
   */
  async setStyle(styleId) {
    const lockKey = `set_style_${styleId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error("ConversationStyleManager not initialized");
      }
      
      this.logger.debug("Setting conversation style explicitly", { styleId });
      
      // Find the style definition
      const styleDefinition = this.styles.get(styleId);
      if (!styleDefinition) {
        throw new Error(`Style with ID ${styleId} not found`);
      }
      
      // Create the new style object
      const newStyle = {
        ...styleDefinition,
        lastUpdated: Date.now()
      };
      
      // Check for significant changes
      const hasSignificantChanges = this._hasSignificantStyleChanges(
        this.currentStyle.parameters,
        newStyle.parameters
      );
      
      // Update current style
      this.currentStyle = newStyle;
      
      // Emit event if significant changes occurred
      if (hasSignificantChanges) {
        this.events.emit("style_set", newStyle);
      }
      
      return newStyle;
    } catch (error) {
      this.logger.error("Error setting conversation style", { error, styleId });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Registers a new conversation style definition
   *
   * @param {Object} style - Style definition
   * @param {string} style.id - Unique style identifier
   * @param {string} style.name - Human-readable style name
   * @param {Object} style.parameters - Style parameters
   * @returns {Promise<Object>} Registered style
   */
  async registerStyle(style) {
    const lockKey = `register_style_${style.id}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error("ConversationStyleManager not initialized");
      }
      
      this.logger.debug("Registering conversation style", { styleId: style.id });
      
      // Validate style
      this._validateStyle(style);
      
      // Add timestamps
      const registeredStyle = {
        ...style,
        created: Date.now(),
        lastUpdated: Date.now()
      };
      
      // Store style
      this.styles.set(style.id, registeredStyle);
      
      // Emit event
      this.events.emit("style_registered", registeredStyle);
      
      return registeredStyle;
    } catch (error) {
      this.logger.error("Error registering conversation style", { error, styleId: style.id });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates an existing conversation style definition
   *
   * @param {string} styleId - Style identifier
   * @param {Object} updates - Style updates
   * @returns {Promise<Object>} Updated style
   */
  async updateStyleDefinition(styleId, updates) {
    const lockKey = `update_style_${styleId}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error("ConversationStyleManager not initialized");
      }
      
      this.logger.debug("Updating conversation style definition", { styleId });
      
      // Check if style exists
      if (!this.styles.has(styleId)) {
        throw new Error(`Style with ID ${styleId} not found`);
      }
      
      // Get existing style
      const existingStyle = this.styles.get(styleId);
      
      // Create updated style
      const updatedStyle = {
        ...existingStyle,
        ...updates,
        id: styleId, // Ensure ID doesn't change
        parameters: {
          ...existingStyle.parameters,
          ...(updates.parameters || {})
        },
        lastUpdated: Date.now()
      };
      
      // Validate updated style
      this._validateStyle(updatedStyle);
      
      // Update style in storage
      this.styles.set(styleId, updatedStyle);
      
      // Emit event
      this.events.emit("style_updated", updatedStyle);
      
      return updatedStyle;
    } catch (error) {
      this.logger.error("Error updating conversation style definition", { error, styleId });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates external context information
   *
   * @param {string} contextType - Type of external context
   * @param {Object} contextData - Context data
   * @returns {Promise<void>}
   */
  async updateExternalContext(contextType, contextData) {
    const lockKey = `update_external_context_${contextType}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error("ConversationStyleManager not initialized");
      }
      
      this.logger.debug("Updating external context for style", { contextType });
      
      // Validate context type
      if (!["social", "emotional", "personality"].includes(contextType)) {
        throw new Error(`Invalid external context type: ${contextType}`);
      }
      
      // Update external context
      this.externalContext[contextType] = {
        ...contextData,
        lastUpdated: Date.now()
      };
      
      // Trigger style adaptation
      await this.adaptStyle();
      
    } catch (error) {
      this.logger.error("Error updating external context for style", { error, contextType });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates manager configuration
   *
   * @param {Object} configUpdates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(configUpdates) {
    const lockKey = "update_conv_style_config";
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        throw new Error("ConversationStyleManager not initialized");
      }
      
      this.logger.debug("Updating configuration", { 
        updateKeys: Object.keys(configUpdates) 
      });
      
      // Update configuration
      this.config = {
        ...this.config,
        ...configUpdates
      };
      
      // Emit event
      this.events.emit("config_updated", this.config);
      
      return { ...this.config };
    } catch (error) {
      this.logger.error("Error updating configuration", { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets current manager configuration
   *
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Registers an event listener
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
   * Shuts down the conversation style manager
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    const lockKey = "conv_style_shutdown";
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.isInitialized) {
        this.logger.warn("ConversationStyleManager not initialized, nothing to shut down");
        return;
      }
      
      this.logger.info("Shutting down ConversationStyleManager");
      
      this.isInitialized = false;
      this.events.emit("shutdown");
      this.logger.info("ConversationStyleManager shut down");
    } catch (error) {
      this.logger.error("Error shutting down ConversationStyleManager", { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Loads default conversation styles
   *
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultStyles() {
    this.logger.debug("Loading default conversation styles");
    
    // Neutral style
    await this.registerStyle({
      id: "neutral",
      name: "Neutral",
      parameters: {
        formality: 0.5,
        directness: 0.5,
        verbosity: 0.5,
        emotionalExpression: 0.5,
        politeness: 0.5,
        humorLevel: 0.2,
        vocabularyComplexity: 0.5,
        sentenceLengthVariation: 0.5
      }
    });
    
    // Formal style
    await this.registerStyle({
      id: "formal",
      name: "Formal",
      parameters: {
        formality: 0.9,
        directness: 0.6,
        verbosity: 0.6,
        emotionalExpression: 0.2,
        politeness: 0.9,
        humorLevel: 0.1,
        vocabularyComplexity: 0.8,
        sentenceLengthVariation: 0.4
      }
    });
    
    // Casual style
    await this.registerStyle({
      id: "casual",
      name: "Casual",
      parameters: {
        formality: 0.2,
        directness: 0.7,
        verbosity: 0.4,
        emotionalExpression: 0.7,
        politeness: 0.4,
        humorLevel: 0.5,
        vocabularyComplexity: 0.3,
        sentenceLengthVariation: 0.7
      }
    });
    
    // Empathetic style
    await this.registerStyle({
      id: "empathetic",
      name: "Empathetic",
      parameters: {
        formality: 0.4,
        directness: 0.3,
        verbosity: 0.6,
        emotionalExpression: 0.9,
        politeness: 0.8,
        humorLevel: 0.1,
        vocabularyComplexity: 0.4,
        sentenceLengthVariation: 0.6
      }
    });
    
    // Direct style
    await this.registerStyle({
      id: "direct",
      name: "Direct",
      parameters: {
        formality: 0.6,
        directness: 0.9,
        verbosity: 0.3,
        emotionalExpression: 0.3,
        politeness: 0.3,
        humorLevel: 0.2,
        vocabularyComplexity: 0.6,
        sentenceLengthVariation: 0.4
      }
    });
    
    // Humorous style
    await this.registerStyle({
      id: "humorous",
      name: "Humorous",
      parameters: {
        formality: 0.3,
        directness: 0.6,
        verbosity: 0.5,
        emotionalExpression: 0.6,
        politeness: 0.5,
        humorLevel: 0.9,
        vocabularyComplexity: 0.4,
        sentenceLengthVariation: 0.8
      }
    });
  }
  
  /**
   * Applies social context influence to style parameters
   *
   * @private
   * @param {Object} parameters - Style parameters to modify
   * @param {Object} socialContext - Social context information
   */
  _applySocialInfluence(parameters, socialContext) {
    if (!socialContext) return;
    
    // Influence formality
    if (socialContext.formality !== undefined) {
      parameters.formality = this._blendValue(
        parameters.formality,
        socialContext.formality,
        0.5 // Social context has strong influence on formality
      );
      
      // Politeness often correlates with formality
      parameters.politeness = this._blendValue(
        parameters.politeness,
        socialContext.formality * 0.8 + 0.1, // Scale formality to politeness range
        0.3
      );
      
      // Humor is usually lower in formal settings
      parameters.humorLevel = this._blendValue(
        parameters.humorLevel,
        (1 - socialContext.formality) * 0.5, // Inverse relationship
        0.3
      );
      
      // Vocabulary complexity tends to increase with formality
      parameters.vocabularyComplexity = this._blendValue(
        parameters.vocabularyComplexity,
        socialContext.formality * 0.6 + 0.2,
        0.2
      );
    }
    
    // Influence directness based on cultural context
    if (socialContext.culturalContext) {
      if (socialContext.culturalContext === "western") {
        parameters.directness = this._blendValue(parameters.directness, 0.8, 0.3);
      } else if (socialContext.culturalContext === "eastern") {
        parameters.directness = this._blendValue(parameters.directness, 0.3, 0.3);
      }
    }
  }
  
  /**
   * Applies emotional context influence to style parameters
   *
   * @private
   * @param {Object} parameters - Style parameters to modify
   * @param {Object} emotionalContext - Emotional context information
   */
  _applyEmotionalInfluence(parameters, emotionalContext) {
    if (!emotionalContext || !emotionalContext.emotionalState) return;
    
    const { valence, arousal, dominance } = emotionalContext.emotionalState;
    
    // Influence emotional expression
    if (valence !== undefined && arousal !== undefined) {
      // Higher arousal and more extreme valence lead to more expression
      const expressionTarget = Math.min(1, Math.abs(valence) * 0.5 + arousal * 0.5);
      parameters.emotionalExpression = this._blendValue(
        parameters.emotionalExpression,
        expressionTarget,
        0.6 // Emotion has strong influence on expression
      );
    }
    
    // Influence verbosity
    if (arousal !== undefined) {
      // Higher arousal can lead to more verbosity
      parameters.verbosity = this._blendValue(
        parameters.verbosity,
        arousal * 0.6 + 0.2,
        0.3
      );
    }
    
    // Influence politeness
    if (valence !== undefined) {
      // Negative valence (anger, frustration) can decrease politeness
      if (valence < -0.5) {
        parameters.politeness = this._blendValue(parameters.politeness, 0.2, 0.4);
      }
      // Positive valence (happiness, joy) can increase politeness
      else if (valence > 0.5) {
        parameters.politeness = this._blendValue(parameters.politeness, 0.8, 0.2);
      }
    }
    
    // Influence humor
    if (valence !== undefined) {
      // Humor is more likely with positive valence
      parameters.humorLevel = this._blendValue(
        parameters.humorLevel,
        Math.max(0, valence * 0.5 + 0.1),
        0.3
      );
    }
  }
  
  /**
   * Applies personality influence to style parameters
   *
   * @private
   * @param {Object} parameters - Style parameters to modify
   * @param {Object} personalityContext - Personality context information
   */
  _applyPersonalityInfluence(parameters, personalityContext) {
    if (!personalityContext || !personalityContext.traits) return;
    
    const traits = personalityContext.traits;
    
    // Influence formality based on conscientiousness/agreeableness
    if (traits.conscientiousness !== undefined) {
      parameters.formality = this._blendValue(
        parameters.formality,
        traits.conscientiousness * 0.6 + 0.2,
        0.2
      );
    }
    if (traits.agreeableness !== undefined) {
      parameters.politeness = this._blendValue(
        parameters.politeness,
        traits.agreeableness * 0.7 + 0.1,
        0.3
      );
    }
    
    // Influence directness based on agreeableness (inverse)
    if (traits.agreeableness !== undefined) {
      parameters.directness = this._blendValue(
        parameters.directness,
        (1 - traits.agreeableness) * 0.7 + 0.1,
        0.2
      );
    }
    
    // Influence verbosity based on extraversion
    if (traits.extraversion !== undefined) {
      parameters.verbosity = this._blendValue(
        parameters.verbosity,
        traits.extraversion * 0.6 + 0.2,
        0.3
      );
    }
    
    // Influence emotional expression based on neuroticism/extraversion
    if (traits.neuroticism !== undefined) {
      parameters.emotionalExpression = this._blendValue(
        parameters.emotionalExpression,
        traits.neuroticism * 0.5 + 0.2,
        0.2
      );
    }
    if (traits.extraversion !== undefined) {
      parameters.emotionalExpression = this._blendValue(
        parameters.emotionalExpression,
        traits.extraversion * 0.5 + 0.2,
        0.2
      );
    }
    
    // Influence humor based on openness/extraversion
    if (traits.openness !== undefined) {
      parameters.humorLevel = this._blendValue(
        parameters.humorLevel,
        traits.openness * 0.4 + 0.1,
        0.2
      );
    }
    if (traits.extraversion !== undefined) {
      parameters.humorLevel = this._blendValue(
        parameters.humorLevel,
        traits.extraversion * 0.4 + 0.1,
        0.2
      );
    }
    
    // Influence vocabulary complexity based on openness
    if (traits.openness !== undefined) {
      parameters.vocabularyComplexity = this._blendValue(
        parameters.vocabularyComplexity,
        traits.openness * 0.6 + 0.2,
        0.2
      );
    }
  }
  
  /**
   * Blends a current value towards a target value based on weight
   *
   * @private
   * @param {number} currentValue - The current value
   * @param {number} targetValue - The target value
   * @param {number} weight - The weight of the target value (0-1)
   * @returns {number} The blended value
   */
  _blendValue(currentValue, targetValue, weight) {
    return currentValue * (1 - weight) + targetValue * weight;
  }
  
  /**
   * Finds the predefined style closest to the given parameters
   *
   * @private
   * @param {Object} parameters - Style parameters
   * @returns {Object|null} Closest style definition or null
   */
  _findClosestStyle(parameters) {
    let closestStyle = null;
    let minDistance = Infinity;
    
    for (const style of this.styles.values()) {
      let distance = 0;
      let paramCount = 0;
      
      for (const key in parameters) {
        if (style.parameters[key] !== undefined) {
          distance += Math.pow(parameters[key] - style.parameters[key], 2);
          paramCount++;
        }
      }
      
      if (paramCount > 0) {
        distance = Math.sqrt(distance / paramCount);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestStyle = style;
        }
      }
    }
    
    // Consider it a match only if the distance is reasonably small
    return minDistance < 0.2 ? closestStyle : null;
  }
  
  /**
   * Checks if there are significant changes between two sets of style parameters
   *
   * @private
   * @param {Object} oldParams - Old style parameters
   * @param {Object} newParams - New style parameters
   * @returns {boolean} Whether there are significant changes
   */
  _hasSignificantStyleChanges(oldParams, newParams) {
    for (const key in newParams) {
      if (oldParams[key] === undefined || 
          Math.abs(newParams[key] - oldParams[key]) > 0.15) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Validates a style definition
   *
   * @private
   * @param {Object} style - Style to validate
   * @throws {Error} If validation fails
   */
  _validateStyle(style) {
    // Check required fields
    if (!style.id) {
      throw new Error("Style must have an ID");
    }
    if (!style.name) {
      throw new Error("Style must have a name");
    }
    if (!style.parameters) {
      throw new Error("Style must have parameters");
    }
    
    // Validate parameters
    const expectedParams = [
      "formality", "directness", "verbosity", "emotionalExpression",
      "politeness", "humorLevel", "vocabularyComplexity", "sentenceLengthVariation"
    ];
    
    for (const param of expectedParams) {
      if (style.parameters[param] === undefined) {
        throw new Error(`Style parameter '${param}' is missing`);
      }
      
      const value = style.parameters[param];
      if (typeof value !== "number" || value < 0 || value > 1) {
        throw new Error(`Style parameter '${param}' must be a number between 0 and 1`);
      }
    }
  }
}

module.exports = { ConversationStyleManager };
