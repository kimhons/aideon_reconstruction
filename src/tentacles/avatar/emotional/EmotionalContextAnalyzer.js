/**
 * @fileoverview EmotionalContextAnalyzer provides contextual awareness for emotion interpretation.
 * It integrates conversation context, situational context, and personality context to provide
 * a comprehensive understanding of emotional states.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
// Corrected import path for utility modules
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Analyzer for contextual emotion interpretation
 */
class EmotionalContextAnalyzer {
  /**
   * Creates a new EmotionalContextAnalyzer instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {Object} [options.contextWeights] - Weights for different context types
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.contextWeights = options.contextWeights || {
      conversation: 0.4,
      situation: 0.3,
      personality: 0.3
    };
    
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('EmotionalContextAnalyzer');
    this.events = new EventEmitter();
    
    this.externalContext = {
      conversation: {},
      situation: {},
      personality: {}
    };
    
    this.contextHistory = [];
    this.maxHistoryLength = 20;
    
    this.logger.info('EmotionalContextAnalyzer initialized');
  }
  
  /**
   * Analyzes emotional context based on detected emotions and current state
   * 
   * @param {Object} detectedEmotions - Detected emotions from recognition engine
   * @param {Object} currentState - Current emotional state
   * @param {Object} [options] - Analysis options
   * @returns {Promise<Object>} Contextually analyzed emotions
   */
  async analyzeContext(detectedEmotions, currentState, options = {}) {
    const lockKey = `context_analyze_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Analyzing emotional context');
      
      // Step 1: Apply conversation context
      const conversationContext = this._applyConversationContext(detectedEmotions);
      
      // Step 2: Apply situational context
      const situationalContext = this._applySituationalContext(conversationContext);
      
      // Step 3: Apply personality context
      const personalityContext = this._applyPersonalityContext(situationalContext);
      
      // Step 4: Apply temporal context (history)
      const temporalContext = this._applyTemporalContext(personalityContext, currentState);
      
      // Step 5: Update context history
      this._updateContextHistory({
        detectedEmotions,
        conversationContext,
        situationalContext,
        personalityContext,
        temporalContext,
        timestamp: Date.now()
      });
      
      // Emit event for subscribers
      this.events.emit('context_analyzed', temporalContext);
      
      return temporalContext;
    } catch (error) {
      this.logger.error('Error analyzing emotional context', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Updates external context information
   * 
   * @param {string} contextType - Type of context to update
   * @param {Object} contextData - Context data
   * @returns {Promise<void>}
   */
  async updateExternalContext(contextType, contextData) {
    const lockKey = `update_context_${contextType}_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      
      if (!this.externalContext[contextType]) {
        throw new Error(`Invalid context type: ${contextType}`);
      }
      
      this.externalContext[contextType] = {
        ...this.externalContext[contextType],
        ...contextData,
        lastUpdated: Date.now()
      };
      
      this.logger.debug(`Updated ${contextType} context`, { contextData });
      this.events.emit('external_context_updated', contextType, this.externalContext[contextType]);
    } catch (error) {
      this.logger.error(`Error updating ${contextType} context`, { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets the current context history
   * 
   * @param {number} [limit=10] - Maximum number of history items to return
   * @returns {Array<Object>} Context history
   */
  getContextHistory(limit = 10) {
    return this.contextHistory.slice(0, limit);
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
   * Applies conversation context to detected emotions
   * 
   * @private
   * @param {Object} detectedEmotions - Detected emotions
   * @returns {Object} Emotions with conversation context applied
   */
  _applyConversationContext(detectedEmotions) {
    const conversationContext = this.externalContext.conversation;
    
    // Clone the detected emotions to avoid modifying the original
    const result = { ...detectedEmotions };
    
    // Apply conversation topic influence
    if (conversationContext.currentTopic) {
      const topic = conversationContext.currentTopic;
      
      // Adjust valence based on topic sensitivity
      if (topic.sensitivity > 0.7) {
        // Sensitive topics tend to reduce valence
        result.valence = result.valence * 0.8;
      }
      
      // Adjust arousal based on topic importance
      if (topic.importance > 0.7) {
        // Important topics tend to increase arousal
        result.arousal = Math.min(1, result.arousal * 1.2);
      }
    }
    
    // Apply participant count influence
    if (conversationContext.participantCount > 2) {
      // Group conversations tend to reduce dominance for most people
      result.dominance = result.dominance * 0.9;
    }
    
    // Apply conversation duration influence
    if (conversationContext.durationMinutes > 30) {
      // Longer conversations tend to reduce arousal
      result.arousal = result.arousal * 0.9;
    }
    
    return result;
  }
  
  /**
   * Applies situational context to emotions
   * 
   * @private
   * @param {Object} emotions - Emotions with conversation context applied
   * @returns {Object} Emotions with situational context applied
   */
  _applySituationalContext(emotions) {
    const situationContext = this.externalContext.situation;
    
    // Clone the emotions to avoid modifying the original
    const result = { ...emotions };
    
    // Apply location influence
    if (situationContext.location) {
      if (situationContext.location.type === 'public') {
        // Public locations tend to suppress emotional expression
        result.valence = result.valence * 0.9;
        result.arousal = result.arousal * 0.8;
      } else if (situationContext.location.type === 'private') {
        // Private locations allow more emotional expression
        result.valence = result.valence * 1.1;
        result.arousal = result.arousal * 1.1;
      }
    }
    
    // Apply activity influence
    if (situationContext.activity) {
      if (situationContext.activity === 'meeting' || 
          situationContext.activity === 'presentation') {
        // Professional activities tend to increase dominance but reduce valence
        result.dominance = Math.min(1, result.dominance * 1.2);
        result.valence = result.valence * 0.9;
      } else if (situationContext.activity === 'relaxation' || 
                situationContext.activity === 'entertainment') {
        // Leisure activities tend to increase valence
        result.valence = Math.min(1, result.valence * 1.2);
      }
    }
    
    // Apply time of day influence
    if (situationContext.timeOfDay) {
      if (situationContext.timeOfDay === 'morning') {
        // Mornings tend to have higher arousal
        result.arousal = Math.min(1, result.arousal * 1.1);
      } else if (situationContext.timeOfDay === 'evening') {
        // Evenings tend to have lower arousal
        result.arousal = result.arousal * 0.9;
      }
    }
    
    return result;
  }
  
  /**
   * Applies personality context to emotions
   * 
   * @private
   * @param {Object} emotions - Emotions with situational context applied
   * @returns {Object} Emotions with personality context applied
   */
  _applyPersonalityContext(emotions) {
    const personalityContext = this.externalContext.personality;
    
    // Clone the emotions to avoid modifying the original
    const result = { ...emotions };
    
    // Apply personality trait influence
    if (personalityContext.traits) {
      const traits = personalityContext.traits;
      
      // Extraversion influence
      if (traits.extraversion !== undefined) {
        // Extraverts tend to express more positive emotions and higher arousal
        result.valence = result.valence + (traits.extraversion - 0.5) * 0.2;
        result.arousal = result.arousal + (traits.extraversion - 0.5) * 0.2;
      }
      
      // Neuroticism influence
      if (traits.neuroticism !== undefined) {
        // Neurotic individuals tend to express more negative emotions
        result.valence = result.valence - (traits.neuroticism - 0.5) * 0.2;
      }
      
      // Agreeableness influence
      if (traits.agreeableness !== undefined) {
        // Agreeable individuals tend to express more positive emotions
        result.valence = result.valence + (traits.agreeableness - 0.5) * 0.2;
      }
      
      // Conscientiousness influence
      if (traits.conscientiousness !== undefined) {
        // Conscientious individuals tend to have more controlled emotional expression
        result.arousal = result.arousal - (traits.conscientiousness - 0.5) * 0.1;
      }
      
      // Openness influence
      if (traits.openness !== undefined) {
        // Open individuals tend to express a wider range of emotions
        // This doesn't directly affect valence/arousal/dominance
      }
    }
    
    // Apply emotional tendencies influence
    if (personalityContext.emotionalTendencies) {
      const tendencies = personalityContext.emotionalTendencies;
      
      // Baseline emotional state
      if (tendencies.baselineValence !== undefined) {
        result.valence = result.valence * 0.8 + tendencies.baselineValence * 0.2;
      }
      
      if (tendencies.baselineArousal !== undefined) {
        result.arousal = result.arousal * 0.8 + tendencies.baselineArousal * 0.2;
      }
      
      if (tendencies.baselineDominance !== undefined) {
        result.dominance = result.dominance * 0.8 + tendencies.baselineDominance * 0.2;
      }
    }
    
    // Ensure values are within valid range
    result.valence = Math.max(-1, Math.min(1, result.valence));
    result.arousal = Math.max(-1, Math.min(1, result.arousal));
    result.dominance = Math.max(-1, Math.min(1, result.dominance));
    
    return result;
  }
  
  /**
   * Applies temporal context to emotions
   * 
   * @private
   * @param {Object} emotions - Emotions with personality context applied
   * @param {Object} currentState - Current emotional state
   * @returns {Object} Emotions with temporal context applied
   */
  _applyTemporalContext(emotions, currentState) {
    // Clone the emotions to avoid modifying the original
    const result = { ...emotions };
    
    // If there's no current state or history, return as is
    if (!currentState || !currentState.primaryEmotion) {
      return result;
    }
    
    // Apply emotional inertia
    // Emotions tend to persist and change gradually
    const inertiaFactor = 0.3; // How much the previous state influences the current one
    
    result.valence = result.valence * (1 - inertiaFactor) + currentState.valence * inertiaFactor;
    result.arousal = result.arousal * (1 - inertiaFactor) + currentState.arousal * inertiaFactor;
    result.dominance = result.dominance * (1 - inertiaFactor) + currentState.dominance * inertiaFactor;
    
    // Determine primary and secondary emotions based on the adjusted VAD values
    const emotionMap = this._mapVADToEmotions(result.valence, result.arousal, result.dominance);
    result.primaryEmotion = emotionMap.primaryEmotion;
    result.secondaryEmotion = emotionMap.secondaryEmotion;
    
    // Adjust confidence based on consistency with history
    if (this.contextHistory.length > 0) {
      const recentHistory = this.contextHistory.slice(0, 3);
      const consistencyFactor = this._calculateConsistencyWithHistory(result, recentHistory);
      
      // Higher consistency = higher confidence
      result.confidence = Math.min(1, result.confidence * (0.8 + consistencyFactor * 0.2));
    }
    
    return result;
  }
  
  /**
   * Maps valence, arousal, and dominance values to emotion labels
   * 
   * @private
   * @param {number} valence - Valence value (-1 to 1)
   * @param {number} arousal - Arousal value (-1 to 1)
   * @param {number} dominance - Dominance value (-1 to 1)
   * @returns {Object} Mapped primary and secondary emotions
   */
  _mapVADToEmotions(valence, arousal, dominance) {
    // Define emotion regions in VAD space
    const emotions = [
      { name: 'joy', valence: 0.8, arousal: 0.5, dominance: 0.4 },
      { name: 'sadness', valence: -0.8, arousal: -0.4, dominance: -0.5 },
      { name: 'anger', valence: -0.7, arousal: 0.8, dominance: 0.7 },
      { name: 'fear', valence: -0.7, arousal: 0.7, dominance: -0.7 },
      { name: 'surprise', valence: 0.1, arousal: 0.8, dominance: 0.0 },
      { name: 'disgust', valence: -0.8, arousal: 0.1, dominance: 0.2 },
      { name: 'trust', valence: 0.6, arousal: -0.2, dominance: 0.2 },
      { name: 'anticipation', valence: 0.3, arousal: 0.4, dominance: 0.1 },
      { name: 'anxiety', valence: -0.6, arousal: 0.6, dominance: -0.3 },
      { name: 'contentment', valence: 0.7, arousal: -0.3, dominance: 0.3 },
      { name: 'boredom', valence: -0.3, arousal: -0.6, dominance: -0.2 },
      { name: 'frustration', valence: -0.6, arousal: 0.5, dominance: -0.1 },
      { name: 'excitement', valence: 0.7, arousal: 0.8, dominance: 0.5 },
      { name: 'disappointment', valence: -0.7, arousal: -0.2, dominance: -0.4 },
      { name: 'amusement', valence: 0.8, arousal: 0.4, dominance: 0.2 },
      { name: 'pride', valence: 0.6, arousal: 0.3, dominance: 0.8 }
    ];
    
    // Calculate distance to each emotion in VAD space
    const distances = emotions.map(emotion => {
      const vDist = emotion.valence - valence;
      const aDist = emotion.arousal - arousal;
      const dDist = emotion.dominance - dominance;
      
      // Euclidean distance in 3D space
      return {
        name: emotion.name,
        distance: Math.sqrt(vDist * vDist + aDist * aDist + dDist * dDist)
      };
    });
    
    // Sort by distance (closest first)
    distances.sort((a, b) => a.distance - b.distance);
    
    return {
      primaryEmotion: distances[0].name,
      secondaryEmotion: distances[1].name
    };
  }
  
  /**
   * Calculates consistency of current emotions with recent history
   * 
   * @private
   * @param {Object} currentEmotions - Current emotions
   * @param {Array<Object>} recentHistory - Recent emotional context history
   * @returns {number} Consistency factor (0-1)
   */
  _calculateConsistencyWithHistory(currentEmotions, recentHistory) {
    if (recentHistory.length === 0) {
      return 1.0;
    }
    
    let totalConsistency = 0;
    
    recentHistory.forEach((historyItem, index) => {
      const weight = 1 / (index + 1); // More recent items have higher weight
      const temporalContext = historyItem.temporalContext;
      
      // Calculate similarity in VAD space
      const vDiff = Math.abs(temporalContext.valence - currentEmotions.valence);
      const aDiff = Math.abs(temporalContext.arousal - currentEmotions.arousal);
      const dDiff = Math.abs(temporalContext.dominance - currentEmotions.dominance);
      
      // Average difference across dimensions
      const avgDiff = (vDiff + aDiff + dDiff) / 3;
      
      // Convert to similarity (0-1)
      const similarity = 1 - avgDiff;
      
      totalConsistency += similarity * weight;
    });
    
    // Normalize by sum of weights
    const weightSum = recentHistory.reduce((sum, _, index) => sum + 1 / (index + 1), 0);
    
    return totalConsistency / weightSum;
  }
  
  /**
   * Updates the context history
   * 
   * @private
   * @param {Object} contextData - Context data to add to history
   */
  _updateContextHistory(contextData) {
    // Add to the beginning of the array (most recent first)
    this.contextHistory.unshift(contextData);
    
    // Trim history if it exceeds the maximum length
    if (this.contextHistory.length > this.maxHistoryLength) {
      this.contextHistory = this.contextHistory.slice(0, this.maxHistoryLength);
    }
  }
}

module.exports = { EmotionalContextAnalyzer };
