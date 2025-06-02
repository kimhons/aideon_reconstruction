/**
 * @fileoverview EmotionalLearningModule learns from emotional interactions and adapts responses
 * based on feedback and observed patterns.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
// Corrected import path for utility modules
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Module for learning from emotional interactions
 */
class EmotionalLearningModule {
  /**
   * Creates a new EmotionalLearningModule instance
   * 
   * @param {Object} options - Configuration options
   * @param {EmotionalMemorySystem} options.emotionalMemorySystem - Emotional memory system
   * @param {Object} [options.learningConfig] - Learning configuration
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options) {
    if (!options.emotionalMemorySystem) {
      throw new Error('EmotionalMemorySystem must be provided');
    }
    
    this.emotionalMemorySystem = options.emotionalMemorySystem;
    this.learningConfig = options.learningConfig || {
      adaptationRate: 0.3,
      minSamplesForAdaptation: 5,
      maxAdaptationStrength: 0.5
    };
    
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('EmotionalLearningModule');
    this.events = new EventEmitter();
    
    this.learnedAdaptations = new Map();
    this.feedbackHistory = [];
    
    this.logger.info('EmotionalLearningModule initialized');
  }
  
  /**
   * Learns from an emotional interaction
   * 
   * @param {Object} interactionData - Interaction data
   * @param {Object} [options] - Learning options
   * @param {Object} [options.feedback] - User feedback
   * @returns {Promise<Object>} Learning results
   */
  async learnFromInteraction(interactionData, options = {}) {
    const lockKey = `learn_interaction_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Learning from interaction');
      
      // Step 1: Process and store feedback if provided
      if (options.feedback) {
        await this._processFeedback(interactionData, options.feedback);
      }
      
      // Step 2: Analyze interaction patterns
      const patterns = await this._analyzeInteractionPatterns(interactionData);
      
      // Step 3: Update learned adaptations
      await this._updateLearnedAdaptations(patterns);
      
      // Step 4: Emit learning event
      const learningResults = {
        interactionId: interactionData.id || `interaction_${Date.now()}`,
        patterns,
        adaptationsUpdated: patterns.length,
        timestamp: Date.now()
      };
      
      this.events.emit('learning_completed', learningResults);
      return learningResults;
    } catch (error) {
      this.logger.error('Error learning from interaction', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Applies learned adaptations to emotional processing
   * 
   * @param {Object} context - Current context
   * @param {Object} [options] - Application options
   * @returns {Promise<Object>} Applied adaptations
   */
  async applyLearnedAdaptations(context, options = {}) {
    const lockKey = `apply_adaptations_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Applying learned adaptations');
      
      const appliedAdaptations = {};
      
      // Apply strategy adaptations
      if (context.emotionalState && context.emotionalState.primaryEmotion) {
        const emotion = context.emotionalState.primaryEmotion;
        const strategyAdaptation = this.learnedAdaptations.get(`strategy_${emotion}`);
        
        if (strategyAdaptation) {
          appliedAdaptations.responseStrategy = {
            original: null, // Will be filled by the caller
            adapted: strategyAdaptation.value,
            confidence: strategyAdaptation.confidence
          };
        }
      }
      
      // Apply content adaptations based on input type
      if (context.input) {
        const inputTypes = Object.keys(context.input);
        
        for (const inputType of inputTypes) {
          const contentAdaptation = this.learnedAdaptations.get(`content_${inputType}`);
          
          if (contentAdaptation) {
            if (!appliedAdaptations.contentModifiers) {
              appliedAdaptations.contentModifiers = {};
            }
            
            appliedAdaptations.contentModifiers[inputType] = {
              factor: contentAdaptation.value,
              confidence: contentAdaptation.confidence
            };
          }
        }
      }
      
      // Apply emotional tone adaptations
      if (context.emotionalState) {
        const valence = context.emotionalState.valence;
        let toneCategory = null;
        
        if (valence > 0.3) toneCategory = 'positive';
        else if (valence < -0.3) toneCategory = 'negative';
        else toneCategory = 'neutral';
        
        const toneAdaptation = this.learnedAdaptations.get(`tone_${toneCategory}`);
        
        if (toneAdaptation) {
          appliedAdaptations.emotionalTone = {
            category: toneCategory,
            adaptation: toneAdaptation.value,
            confidence: toneAdaptation.confidence
          };
        }
      }
      
      return appliedAdaptations;
    } catch (error) {
      this.logger.error('Error applying learned adaptations', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets learned adaptations
   * 
   * @param {Object} [options] - Retrieval options
   * @param {string} [options.category] - Adaptation category
   * @returns {Promise<Array<Object>>} Learned adaptations
   */
  async getLearnedAdaptations(options = {}) {
    const lockKey = `get_adaptations_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Getting learned adaptations');
      
      let adaptations = [];
      
      if (options.category) {
        // Get adaptations for specific category
        for (const [key, adaptation] of this.learnedAdaptations.entries()) {
          if (key.startsWith(`${options.category}_`)) {
            adaptations.push({
              key,
              ...adaptation
            });
          }
        }
      } else {
        // Get all adaptations
        adaptations = Array.from(this.learnedAdaptations.entries())
          .map(([key, adaptation]) => ({
            key,
            ...adaptation
          }));
      }
      
      return adaptations;
    } catch (error) {
      this.logger.error('Error getting learned adaptations', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
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
   * Processes feedback for an interaction
   * 
   * @private
   * @param {Object} interactionData - Interaction data
   * @param {Object} feedback - Feedback data
   * @returns {Promise<void>}
   */
  async _processFeedback(interactionData, feedback) {
    // Store feedback with interaction reference
    const feedbackEntry = {
      interactionId: interactionData.id || `interaction_${Date.now()}`,
      feedback,
      timestamp: Date.now()
    };
    
    this.feedbackHistory.push(feedbackEntry);
    
    // Limit feedback history size
    if (this.feedbackHistory.length > 100) {
      this.feedbackHistory = this.feedbackHistory.slice(-100);
    }
    
    this.events.emit('feedback_processed', feedbackEntry);
  }
  
  /**
   * Analyzes patterns in an interaction
   * 
   * @private
   * @param {Object} interactionData - Interaction data
   * @returns {Promise<Array<Object>>} Detected patterns
   */
  async _analyzeInteractionPatterns(interactionData) {
    const patterns = [];
    
    // Get recent history for context
    const recentHistory = await this.emotionalMemorySystem.getRecentHistory(10);
    
    // Pattern 1: Response strategy effectiveness
    if (interactionData.response && interactionData.response.strategy) {
      const strategy = interactionData.response.strategy;
      const emotion = interactionData.contextualEmotions.primaryEmotion;
      
      if (emotion) {
        // Check if this strategy has been effective for this emotion
        const effectiveness = this._evaluateStrategyEffectiveness(
          strategy,
          emotion,
          interactionData,
          recentHistory
        );
        
        if (effectiveness) {
          patterns.push({
            type: 'strategy',
            key: `strategy_${emotion}`,
            value: strategy,
            confidence: effectiveness.confidence,
            samples: effectiveness.samples
          });
        }
      }
    }
    
    // Pattern 2: Content adaptation based on input type
    if (interactionData.input) {
      const inputTypes = Object.keys(interactionData.input);
      
      for (const inputType of inputTypes) {
        const contentFactor = this._evaluateContentFactor(
          inputType,
          interactionData,
          recentHistory
        );
        
        if (contentFactor) {
          patterns.push({
            type: 'content',
            key: `content_${inputType}`,
            value: contentFactor.factor,
            confidence: contentFactor.confidence,
            samples: contentFactor.samples
          });
        }
      }
    }
    
    // Pattern 3: Emotional tone adaptation
    if (interactionData.contextualEmotions && 
        interactionData.contextualEmotions.valence !== undefined) {
      const valence = interactionData.contextualEmotions.valence;
      let toneCategory = null;
      
      if (valence > 0.3) toneCategory = 'positive';
      else if (valence < -0.3) toneCategory = 'negative';
      else toneCategory = 'neutral';
      
      const toneAdaptation = this._evaluateToneAdaptation(
        toneCategory,
        interactionData,
        recentHistory
      );
      
      if (toneAdaptation) {
        patterns.push({
          type: 'tone',
          key: `tone_${toneCategory}`,
          value: toneAdaptation.adaptation,
          confidence: toneAdaptation.confidence,
          samples: toneAdaptation.samples
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Updates learned adaptations based on detected patterns
   * 
   * @private
   * @param {Array<Object>} patterns - Detected patterns
   * @returns {Promise<void>}
   */
  async _updateLearnedAdaptations(patterns) {
    for (const pattern of patterns) {
      const existingAdaptation = this.learnedAdaptations.get(pattern.key);
      
      if (!existingAdaptation) {
        // New adaptation
        if (pattern.samples >= this.learningConfig.minSamplesForAdaptation) {
          this.learnedAdaptations.set(pattern.key, {
            value: pattern.value,
            confidence: pattern.confidence,
            samples: pattern.samples,
            lastUpdated: Date.now()
          });
        }
      } else {
        // Update existing adaptation
        const adaptationRate = this.learningConfig.adaptationRate;
        
        // Weighted average based on confidence
        const totalConfidence = existingAdaptation.confidence + pattern.confidence;
        const existingWeight = existingAdaptation.confidence / totalConfidence;
        const newWeight = pattern.confidence / totalConfidence;
        
        // For numeric values, use weighted average
        let updatedValue = pattern.value;
        if (typeof pattern.value === 'number' && typeof existingAdaptation.value === 'number') {
          updatedValue = existingAdaptation.value * (1 - adaptationRate) + 
                        pattern.value * adaptationRate;
        }
        
        // For categorical values (like strategy), use the one with higher confidence
        // or keep existing if confidences are similar
        if (typeof pattern.value === 'string' && typeof existingAdaptation.value === 'string') {
          if (newWeight > existingWeight * 1.2) {
            updatedValue = pattern.value;
          } else {
            updatedValue = existingAdaptation.value;
          }
        }
        
        this.learnedAdaptations.set(pattern.key, {
          value: updatedValue,
          confidence: Math.min(
            existingAdaptation.confidence * (1 - adaptationRate) + 
            pattern.confidence * adaptationRate,
            this.learningConfig.maxAdaptationStrength
          ),
          samples: existingAdaptation.samples + pattern.samples,
          lastUpdated: Date.now()
        });
      }
    }
  }
  
  /**
   * Evaluates the effectiveness of a response strategy for an emotion
   * 
   * @private
   * @param {string} strategy - Response strategy
   * @param {string} emotion - Primary emotion
   * @param {Object} currentInteraction - Current interaction data
   * @param {Array<Object>} recentHistory - Recent interaction history
   * @returns {Object|null} Effectiveness evaluation or null if insufficient data
   */
  _evaluateStrategyEffectiveness(strategy, emotion, currentInteraction, recentHistory) {
    // Find previous interactions with the same emotion and strategy
    const relevantInteractions = recentHistory.filter(event => 
      event.contextualEmotions && 
      event.contextualEmotions.primaryEmotion === emotion &&
      event.response &&
      event.response.strategy === strategy
    );
    
    if (relevantInteractions.length < 2) {
      return null; // Not enough data
    }
    
    // Check feedback if available
    const interactionsWithFeedback = relevantInteractions.filter(event => {
      const feedback = this.feedbackHistory.find(f => f.interactionId === event.id);
      return feedback && feedback.feedback.effectiveness !== undefined;
    });
    
    if (interactionsWithFeedback.length > 0) {
      // Calculate average effectiveness from explicit feedback
      let totalEffectiveness = 0;
      
      interactionsWithFeedback.forEach(event => {
        const feedback = this.feedbackHistory.find(f => f.interactionId === event.id);
        totalEffectiveness += feedback.feedback.effectiveness;
      });
      
      const avgEffectiveness = totalEffectiveness / interactionsWithFeedback.length;
      
      // Only consider strategies with positive effectiveness
      if (avgEffectiveness > 0.6) {
        return {
          confidence: Math.min(0.7, avgEffectiveness * 0.8),
          samples: interactionsWithFeedback.length
        };
      }
    } else {
      // No explicit feedback, use implicit signals
      // Check for valence improvements in subsequent interactions
      let positiveTransitions = 0;
      
      relevantInteractions.forEach(event => {
        const eventIndex = recentHistory.findIndex(e => e.id === event.id);
        if (eventIndex > 0) { // Not the most recent event
          const nextEvent = recentHistory[eventIndex - 1];
          if (nextEvent.contextualEmotions) {
            const valenceChange = nextEvent.contextualEmotions.valence - event.contextualEmotions.valence;
            if (valenceChange > 0.2) {
              positiveTransitions++;
            }
          }
        }
      });
      
      const positiveRate = positiveTransitions / relevantInteractions.length;
      
      if (positiveRate > 0.5 && relevantInteractions.length >= 3) {
        return {
          confidence: Math.min(0.5, positiveRate * 0.6),
          samples: relevantInteractions.length
        };
      }
    }
    
    return null;
  }
  
  /**
   * Evaluates content adaptation factor for an input type
   * 
   * @private
   * @param {string} inputType - Type of input
   * @param {Object} currentInteraction - Current interaction data
   * @param {Array<Object>} recentHistory - Recent interaction history
   * @returns {Object|null} Content factor or null if insufficient data
   */
  _evaluateContentFactor(inputType, currentInteraction, recentHistory) {
    // Find interactions with the same input type
    const relevantInteractions = recentHistory.filter(event => 
      event.input && event.input[inputType]
    );
    
    if (relevantInteractions.length < 3) {
      return null; // Not enough data
    }
    
    // Calculate average response effectiveness for this input type
    let totalEffectiveness = 0;
    let samplesWithFeedback = 0;
    
    relevantInteractions.forEach(event => {
      const feedback = this.feedbackHistory.find(f => f.interactionId === event.id);
      if (feedback && feedback.feedback.effectiveness !== undefined) {
        totalEffectiveness += feedback.feedback.effectiveness;
        samplesWithFeedback++;
      }
    });
    
    if (samplesWithFeedback >= 2) {
      const avgEffectiveness = totalEffectiveness / samplesWithFeedback;
      
      // Calculate adaptation factor
      // 0.5 = neutral (no adaptation)
      // > 0.5 = emphasize this input type
      // < 0.5 = de-emphasize this input type
      const adaptationFactor = 0.5 + (avgEffectiveness - 0.5) * 0.5;
      
      return {
        factor: adaptationFactor,
        confidence: Math.min(0.6, samplesWithFeedback / 10 + 0.3),
        samples: samplesWithFeedback
      };
    }
    
    return null;
  }
  
  /**
   * Evaluates tone adaptation for an emotional category
   * 
   * @private
   * @param {string} toneCategory - Emotional tone category
   * @param {Object} currentInteraction - Current interaction data
   * @param {Array<Object>} recentHistory - Recent interaction history
   * @returns {Object|null} Tone adaptation or null if insufficient data
   */
  _evaluateToneAdaptation(toneCategory, currentInteraction, recentHistory) {
    // Find interactions with the same tone category
    const relevantInteractions = recentHistory.filter(event => {
      if (!event.contextualEmotions || event.contextualEmotions.valence === undefined) {
        return false;
      }
      
      const valence = event.contextualEmotions.valence;
      const category = valence > 0.3 ? 'positive' : 
                      (valence < -0.3 ? 'negative' : 'neutral');
      
      return category === toneCategory;
    });
    
    if (relevantInteractions.length < 3) {
      return null; // Not enough data
    }
    
    // Calculate most effective response tone for this category
    const toneEffectiveness = new Map();
    let totalSamples = 0;
    
    relevantInteractions.forEach(event => {
      if (!event.response || !event.response.verbal || !event.response.verbal.emotionalTone) {
        return;
      }
      
      const responseTone = event.response.verbal.emotionalTone;
      
      // Check for feedback
      const feedback = this.feedbackHistory.find(f => f.interactionId === event.id);
      let effectiveness = 0.5; // Default neutral effectiveness
      
      if (feedback && feedback.feedback.effectiveness !== undefined) {
        effectiveness = feedback.feedback.effectiveness;
      } else {
        // Check for valence improvement in next interaction
        const eventIndex = recentHistory.findIndex(e => e.id === event.id);
        if (eventIndex > 0) { // Not the most recent event
          const nextEvent = recentHistory[eventIndex - 1];
          if (nextEvent.contextualEmotions && event.contextualEmotions) {
            const valenceChange = nextEvent.contextualEmotions.valence - event.contextualEmotions.valence;
            effectiveness = valenceChange > 0.2 ? 0.7 : 
                          (valenceChange > 0 ? 0.6 : 
                           (valenceChange < -0.2 ? 0.3 : 0.5));
          }
        }
      }
      
      if (!toneEffectiveness.has(responseTone)) {
        toneEffectiveness.set(responseTone, {
          totalEffectiveness: 0,
          samples: 0
        });
      }
      
      const toneData = toneEffectiveness.get(responseTone);
      toneData.totalEffectiveness += effectiveness;
      toneData.samples++;
      totalSamples++;
    });
    
    // Find the most effective tone
    let bestTone = null;
    let bestEffectiveness = 0;
    
    toneEffectiveness.forEach((data, tone) => {
      const avgEffectiveness = data.totalEffectiveness / data.samples;
      if (avgEffectiveness > bestEffectiveness && data.samples >= 2) {
        bestTone = tone;
        bestEffectiveness = avgEffectiveness;
      }
    });
    
    if (bestTone && bestEffectiveness > 0.6) {
      return {
        adaptation: bestTone,
        confidence: Math.min(0.7, bestEffectiveness * 0.7 + totalSamples / 20),
        samples: totalSamples
      };
    }
    
    return null;
  }
}

module.exports = { EmotionalLearningModule };
