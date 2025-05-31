/**
 * @fileoverview EmpatheticResponseGenerator creates appropriate emotional responses
 * based on detected emotions and context.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
// Corrected import path for utility modules
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Generator for empathetic responses
 */
class EmpatheticResponseGenerator {
  /**
   * Creates a new EmpatheticResponseGenerator instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {Object} [options.responseStrategies] - Response strategy configurations
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.responseStrategies = options.responseStrategies || {
      mirroring: { weight: 0.3 },
      complementary: { weight: 0.4 },
      balanced: { weight: 0.3 }
    };
    
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('EmpatheticResponseGenerator');
    this.events = new EventEmitter();
    
    this.logger.info('EmpatheticResponseGenerator initialized');
  }
  
  /**
   * Generates an empathetic response based on emotional context
   * 
   * @param {Object} emotionalContext - Emotional context from context analyzer
   * @param {Array<Object>} [recentHistory=[]] - Recent emotional history
   * @param {Object} [options] - Generation options
   * @returns {Promise<Object>} Generated response
   */
  async generateResponse(emotionalContext, recentHistory = [], options = {}) {
    const lockKey = `response_generate_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Generating empathetic response');
      
      // Step 1: Select response strategy
      const strategy = this._selectResponseStrategy(emotionalContext, recentHistory);
      
      // Step 2: Generate visual response (facial expressions, gestures)
      const visualResponse = this._generateVisualResponse(emotionalContext, strategy);
      
      // Step 3: Generate vocal response (tone, pitch, rate)
      const vocalResponse = this._generateVocalResponse(emotionalContext, strategy);
      
      // Step 4: Generate verbal response (content, phrasing)
      const verbalResponse = this._generateVerbalResponse(emotionalContext, strategy);
      
      const response = {
        strategy,
        visual: visualResponse,
        vocal: vocalResponse,
        verbal: verbalResponse,
        timestamp: Date.now()
      };
      
      this.events.emit('response_generated', response);
      return response;
    } catch (error) {
      this.logger.error('Error generating empathetic response', { error });
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
   * Selects an appropriate response strategy based on emotional context
   * 
   * @private
   * @param {Object} emotionalContext - Emotional context
   * @param {Array<Object>} recentHistory - Recent emotional history
   * @returns {string} Selected strategy
   */
  _selectResponseStrategy(emotionalContext, recentHistory) {
    const { valence, arousal, dominance, primaryEmotion } = emotionalContext;
    
    // Calculate strategy scores
    let mirroringScore = this.responseStrategies.mirroring.weight;
    let complementaryScore = this.responseStrategies.complementary.weight;
    let balancedScore = this.responseStrategies.balanced.weight;
    
    // Adjust based on primary emotion
    if (primaryEmotion) {
      switch (primaryEmotion) {
        case 'joy':
        case 'excitement':
        case 'amusement':
        case 'pride':
          // For positive emotions, mirroring often works well
          mirroringScore *= 1.5;
          break;
          
        case 'sadness':
        case 'fear':
        case 'anxiety':
        case 'disappointment':
          // For negative emotions, complementary often works better
          complementaryScore *= 1.5;
          break;
          
        case 'anger':
        case 'frustration':
          // For anger, balanced approach is often best
          balancedScore *= 1.5;
          break;
          
        case 'surprise':
          // For surprise, mirroring can work well
          mirroringScore *= 1.3;
          break;
          
        default:
          // For other emotions, keep default weights
          break;
      }
    }
    
    // Adjust based on valence
    if (valence < -0.5) {
      // For very negative emotions, complementary is often better
      complementaryScore *= 1.3;
      mirroringScore *= 0.7;
    } else if (valence > 0.5) {
      // For very positive emotions, mirroring is often better
      mirroringScore *= 1.3;
    }
    
    // Adjust based on arousal
    if (arousal > 0.7) {
      // For high arousal, balanced approach can help calm
      balancedScore *= 1.2;
    }
    
    // Adjust based on dominance
    if (dominance > 0.7) {
      // For high dominance, mirroring can be effective
      mirroringScore *= 1.2;
    } else if (dominance < -0.7) {
      // For low dominance, complementary can be supportive
      complementaryScore *= 1.2;
    }
    
    // Adjust based on recent history
    if (recentHistory.length > 0) {
      // If we've been using the same strategy repeatedly, slightly reduce its score
      const recentStrategies = recentHistory
        .filter(item => item.response && item.response.strategy)
        .map(item => item.response.strategy);
      
      if (recentStrategies.length > 0) {
        const mostRecentStrategy = recentStrategies[0];
        const strategyCount = recentStrategies.filter(s => s === mostRecentStrategy).length;
        
        if (strategyCount > 2) {
          // If we've used the same strategy 3+ times, reduce its score
          switch (mostRecentStrategy) {
            case 'mirroring':
              mirroringScore *= 0.8;
              break;
            case 'complementary':
              complementaryScore *= 0.8;
              break;
            case 'balanced':
              balancedScore *= 0.8;
              break;
          }
        }
      }
    }
    
    // Select the strategy with the highest score
    const scores = {
      mirroring: mirroringScore,
      complementary: complementaryScore,
      balanced: balancedScore
    };
    
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])[0][0];
  }
  
  /**
   * Generates visual response based on emotional context and strategy
   * 
   * @private
   * @param {Object} emotionalContext - Emotional context
   * @param {string} strategy - Response strategy
   * @returns {Object} Visual response
   */
  _generateVisualResponse(emotionalContext, strategy) {
    const { valence, arousal, dominance, primaryEmotion } = emotionalContext;
    
    // Default visual response
    let facialExpression = 'neutral';
    let gestureIntensity = 0.5;
    let posture = 'neutral';
    
    switch (strategy) {
      case 'mirroring':
        // Mirror the detected emotion
        facialExpression = this._mapEmotionToFacialExpression(primaryEmotion);
        gestureIntensity = Math.min(1, Math.max(0, (Math.abs(arousal) + 0.3) * 0.7));
        posture = dominance > 0.3 ? 'confident' : (dominance < -0.3 ? 'receptive' : 'neutral');
        break;
        
      case 'complementary':
        // Provide a complementary response
        if (valence < 0) {
          // For negative emotions, show supportive expressions
          facialExpression = 'concerned';
          gestureIntensity = 0.4;
          posture = 'attentive';
        } else {
          // For positive emotions, show appreciative expressions
          facialExpression = 'smile';
          gestureIntensity = 0.6;
          posture = 'engaged';
        }
        break;
        
      case 'balanced':
        // Provide a balanced, neutral response
        facialExpression = 'attentive';
        gestureIntensity = 0.3;
        posture = 'neutral';
        break;
    }
    
    return {
      facialExpression,
      gestureIntensity,
      posture
    };
  }
  
  /**
   * Generates vocal response based on emotional context and strategy
   * 
   * @private
   * @param {Object} emotionalContext - Emotional context
   * @param {string} strategy - Response strategy
   * @returns {Object} Vocal response
   */
  _generateVocalResponse(emotionalContext, strategy) {
    const { valence, arousal, dominance } = emotionalContext;
    
    // Default vocal parameters (0-1 scale)
    let pitch = 0.5;      // Base pitch
    let pitchVariation = 0.5;  // How much pitch varies
    let rate = 0.5;       // Speaking rate
    let volume = 0.5;     // Volume
    let timbre = 0.5;     // Voice quality (0=rough, 1=smooth)
    
    switch (strategy) {
      case 'mirroring':
        // Mirror the emotional tone
        pitch = 0.5 + valence * 0.2;
        pitchVariation = 0.3 + Math.abs(arousal) * 0.4;
        rate = 0.5 + arousal * 0.3;
        volume = 0.4 + Math.abs(arousal) * 0.3;
        timbre = 0.4 + valence * 0.3;
        break;
        
      case 'complementary':
        // Provide a complementary vocal tone
        if (valence < 0) {
          // For negative emotions, use a calming, supportive tone
          pitch = 0.45;
          pitchVariation = 0.3;
          rate = 0.4;
          volume = 0.4;
          timbre = 0.7;
        } else {
          // For positive emotions, use an engaged, enthusiastic tone
          pitch = 0.55;
          pitchVariation = 0.6;
          rate = 0.6;
          volume = 0.6;
          timbre = 0.6;
        }
        break;
        
      case 'balanced':
        // Provide a balanced, neutral tone
        pitch = 0.5;
        pitchVariation = 0.4;
        rate = 0.5;
        volume = 0.5;
        timbre = 0.5;
        break;
    }
    
    // Ensure all values are within 0-1 range
    pitch = Math.min(1, Math.max(0, pitch));
    pitchVariation = Math.min(1, Math.max(0, pitchVariation));
    rate = Math.min(1, Math.max(0, rate));
    volume = Math.min(1, Math.max(0, volume));
    timbre = Math.min(1, Math.max(0, timbre));
    
    return {
      pitch,
      pitchVariation,
      rate,
      volume,
      timbre
    };
  }
  
  /**
   * Generates verbal response based on emotional context and strategy
   * 
   * @private
   * @param {Object} emotionalContext - Emotional context
   * @param {string} strategy - Response strategy
   * @returns {Object} Verbal response
   */
  _generateVerbalResponse(emotionalContext, strategy) {
    const { primaryEmotion, valence, arousal } = emotionalContext;
    
    // Response templates for different emotions and strategies
    const responseTemplates = {
      mirroring: {
        joy: ["That's wonderful to hear!", "I'm happy for you!", "That sounds amazing!"],
        sadness: ["I understand that's difficult.", "That must be hard for you.", "I'm sorry to hear that."],
        anger: ["I can see why that would be frustrating.", "That sounds really annoying.", "I'd be upset too."],
        fear: ["That does sound concerning.", "I understand why you're worried.", "That would make me nervous too."],
        anxiety: ["It's natural to feel anxious about that.", "I understand your concern.", "That uncertainty is difficult."],
        surprise: ["Wow, that's unexpected!", "That's quite a surprise!", "I wouldn't have expected that either!"],
        disappointment: ["That's disappointing.", "I understand why you feel let down.", "That didn't go as hoped."],
        excitement: ["That's so exciting!", "I can feel your enthusiasm!", "What an amazing opportunity!"],
        default: ["I see how you feel.", "I understand.", "I'm following your emotions."]
      },
      complementary: {
        joy: ["Tell me more about what made you happy!", "What was the best part?", "I'd love to hear more details!"],
        sadness: ["Is there anything I can do to help?", "Would you like to talk more about it?", "I'm here for you."],
        anger: ["Let's take a moment to think about this.", "What would help you feel better?", "I'm here to listen."],
        fear: ["You're not alone in this.", "We can work through this together.", "What would help you feel safer?"],
        anxiety: ["Let's break this down into smaller steps.", "You've handled difficult situations before.", "What's the first small step we can take?"],
        surprise: ["Let's process this new information.", "Take your time to adjust to this news.", "How do you feel about this surprise?"],
        disappointment: ["What can we learn from this?", "There will be other opportunities.", "What would you like to try next?"],
        excitement: ["I'm excited for you!", "What are you looking forward to most?", "This is a great opportunity!"],
        default: ["I'm here to support you.", "Let's work through this together.", "How can I help?"]
      },
      balanced: {
        joy: ["That's good to hear.", "I'm glad things are going well.", "That sounds positive."],
        sadness: ["I understand.", "Let's talk about it if you'd like.", "I'm listening."],
        anger: ["I see.", "Let's discuss this calmly.", "I understand your perspective."],
        fear: ["Let's think about this rationally.", "We can assess the situation together.", "Let's consider the facts."],
        anxiety: ["Let's look at this objectively.", "We can analyze this situation.", "Let's consider all aspects."],
        surprise: ["That's interesting.", "Let's process this information.", "That's noteworthy."],
        disappointment: ["I understand.", "Let's consider alternatives.", "There are other approaches we could try."],
        excitement: ["That sounds promising.", "Let's think about next steps.", "That's a good development."],
        default: ["I understand.", "Let's discuss this further.", "I'm following what you're saying."]
      }
    };
    
    // Select appropriate templates based on strategy and emotion
    const strategyTemplates = responseTemplates[strategy] || responseTemplates.balanced;
    const emotionTemplates = strategyTemplates[primaryEmotion] || strategyTemplates.default;
    
    // Randomly select a phrase from the appropriate templates
    const randomIndex = Math.floor(Math.random() * emotionTemplates.length);
    const selectedPhrase = emotionTemplates[randomIndex];
    
    // Generate additional phrases based on context
    const additionalPhrases = [];
    
    if (Math.abs(valence) > 0.7) {
      // For strong emotions (positive or negative)
      if (strategy === 'complementary') {
        additionalPhrases.push("I can see this is important to you.");
      }
    }
    
    if (arousal > 0.7) {
      // For high arousal emotions
      if (strategy === 'balanced') {
        additionalPhrases.push("Let's take a moment to reflect on this.");
      }
    }
    
    // Combine selected phrase with any additional phrases
    const phrases = [selectedPhrase, ...additionalPhrases];
    
    return {
      phrases,
      emotionalTone: primaryEmotion,
      formality: strategy === 'balanced' ? 'moderate' : 'casual'
    };
  }
  
  /**
   * Maps emotion to facial expression
   * 
   * @private
   * @param {string} emotion - Emotion name
   * @returns {string} Facial expression
   */
  _mapEmotionToFacialExpression(emotion) {
    const expressionMap = {
      joy: 'smile',
      sadness: 'sad',
      anger: 'frown',
      fear: 'concerned',
      anxiety: 'concerned',
      surprise: 'surprised',
      disgust: 'disgusted',
      trust: 'relaxed',
      anticipation: 'interested',
      contentment: 'relaxed',
      boredom: 'neutral',
      frustration: 'frown',
      excitement: 'excited',
      disappointment: 'sad',
      amusement: 'smile',
      pride: 'confident'
    };
    
    return expressionMap[emotion] || 'neutral';
  }
}

module.exports = { EmpatheticResponseGenerator };
