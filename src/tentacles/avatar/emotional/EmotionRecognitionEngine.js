/**
 * @fileoverview EmotionRecognitionEngine detects emotions from multimodal inputs
 * including facial expressions, voice tone, and text content.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
// Corrected import path for utility modules
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * Engine for detecting emotions from multimodal inputs
 */
class EmotionRecognitionEngine {
  /**
   * Creates a new EmotionRecognitionEngine instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {Object} [options.modelConfig] - Model configuration
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.modelConfig = options.modelConfig || {
      facial: { confidence: 0.8, priority: 0.4 },
      voice: { confidence: 0.7, priority: 0.3 },
      text: { confidence: 0.6, priority: 0.3 }
    };
    
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('EmotionRecognitionEngine');
    this.events = new EventEmitter();
    
    this.logger.info('EmotionRecognitionEngine initialized');
  }
  
  /**
   * Detects emotions from multimodal input
   * 
   * @param {Object} input - Multimodal input data
   * @param {Object} [input.facial] - Facial expression data
   * @param {Object} [input.voice] - Voice tone data
   * @param {Object} [input.text] - Text content data
   * @param {Object} [options] - Detection options
   * @returns {Promise<Object>} Detected emotions with confidence scores
   */
  async detectEmotions(input, options = {}) {
    const lockKey = `emotion_detect_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Detecting emotions from input', { inputTypes: Object.keys(input) });
      
      // Process each modality
      const modalityResults = {};
      let totalConfidence = 0;
      let totalWeight = 0;
      
      // Process facial expressions if available
      if (input.facial) {
        modalityResults.facial = this._processFacialExpressions(input.facial);
        totalConfidence += modalityResults.facial.confidence * this.modelConfig.facial.priority;
        totalWeight += this.modelConfig.facial.priority;
      }
      
      // Process voice tone if available
      if (input.voice) {
        modalityResults.voice = this._processVoiceTone(input.voice);
        totalConfidence += modalityResults.voice.confidence * this.modelConfig.voice.priority;
        totalWeight += this.modelConfig.voice.priority;
      }
      
      // Process text content if available
      if (input.text) {
        modalityResults.text = this._processTextContent(input.text);
        totalConfidence += modalityResults.text.confidence * this.modelConfig.text.priority;
        totalWeight += this.modelConfig.text.priority;
      }
      
      // Fuse results from all modalities
      const fusedResults = this._fuseModalityResults(modalityResults);
      
      // Calculate overall confidence
      const overallConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;
      
      const result = {
        primaryEmotion: fusedResults.primaryEmotion,
        secondaryEmotion: fusedResults.secondaryEmotion,
        valence: fusedResults.valence,
        arousal: fusedResults.arousal,
        dominance: fusedResults.dominance,
        confidence: overallConfidence,
        modalityResults,
        timestamp: Date.now()
      };
      
      this.events.emit('emotions_detected', result);
      return result;
    } catch (error) {
      this.logger.error('Error detecting emotions', { error });
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
   * Processes facial expressions to detect emotions
   * 
   * @private
   * @param {Object} facialData - Facial expression data
   * @returns {Object} Detected emotions from facial expressions
   */
  _processFacialExpressions(facialData) {
    // In a real implementation, this would use computer vision models
    // For this implementation, we'll use a simplified mapping
    
    const expressions = facialData.expressions || {};
    
    // Map expressions to emotions
    let joy = (expressions.smile || 0) * 0.8 + (expressions.eyebrows_raised || 0) * 0.2;
    let sadness = (expressions.frown || 0) * 0.7 + (expressions.eyebrows_lowered || 0) * 0.3;
    let anger = (expressions.eyebrows_lowered || 0) * 0.6 + (expressions.jaw_clenched || 0) * 0.4;
    let fear = (expressions.eyes_widened || 0) * 0.7 + (expressions.mouth_open || 0) * 0.3;
    let surprise = (expressions.eyes_widened || 0) * 0.5 + (expressions.mouth_open || 0) * 0.5;
    
    // Normalize to ensure values are between 0 and 1
    const emotions = { joy, sadness, anger, fear, surprise };
    const maxEmotion = Math.max(...Object.values(emotions));
    
    if (maxEmotion > 0) {
      Object.keys(emotions).forEach(key => {
        emotions[key] = emotions[key] / maxEmotion;
      });
    }
    
    // Determine primary and secondary emotions
    const sortedEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1]);
    
    const primaryEmotion = sortedEmotions[0][0];
    const secondaryEmotion = sortedEmotions[1][0];
    
    // Map to valence-arousal-dominance space
    const valence = emotions.joy * 0.8 - emotions.sadness * 0.7 - emotions.anger * 0.9 - emotions.fear * 0.5 + emotions.surprise * 0.1;
    const arousal = emotions.joy * 0.5 - emotions.sadness * 0.3 + emotions.anger * 0.8 + emotions.fear * 0.7 + emotions.surprise * 0.9;
    const dominance = emotions.joy * 0.4 - emotions.sadness * 0.5 + emotions.anger * 0.7 - emotions.fear * 0.8 + emotions.surprise * 0.1;
    
    // Calculate confidence based on expression intensity
    const confidence = Math.min(1, maxEmotion * this.modelConfig.facial.confidence);
    
    return {
      primaryEmotion,
      secondaryEmotion,
      emotions,
      valence: Math.max(-1, Math.min(1, valence)),
      arousal: Math.max(-1, Math.min(1, arousal)),
      dominance: Math.max(-1, Math.min(1, dominance)),
      confidence
    };
  }
  
  /**
   * Processes voice tone to detect emotions
   * 
   * @private
   * @param {Object} voiceData - Voice tone data
   * @returns {Object} Detected emotions from voice tone
   */
  _processVoiceTone(voiceData) {
    // In a real implementation, this would use audio processing models
    // For this implementation, we'll use a simplified mapping
    
    const features = voiceData.features || {};
    
    // Map acoustic features to emotions
    let joy = (features.pitch_variation || 0) * 0.5 + (features.speech_rate || 0) * 0.5;
    let sadness = (1 - (features.pitch || 0)) * 0.6 + (1 - (features.speech_rate || 0)) * 0.4;
    let anger = (features.volume || 0) * 0.7 + (features.speech_rate || 0) * 0.3;
    let fear = (features.pitch || 0) * 0.6 + (features.jitter || 0) * 0.4;
    let surprise = (features.pitch_variation || 0) * 0.8 + (features.volume || 0) * 0.2;
    
    // Normalize to ensure values are between 0 and 1
    const emotions = { joy, sadness, anger, fear, surprise };
    const maxEmotion = Math.max(...Object.values(emotions));
    
    if (maxEmotion > 0) {
      Object.keys(emotions).forEach(key => {
        emotions[key] = emotions[key] / maxEmotion;
      });
    }
    
    // Determine primary and secondary emotions
    const sortedEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1]);
    
    const primaryEmotion = sortedEmotions[0][0];
    const secondaryEmotion = sortedEmotions[1][0];
    
    // Map to valence-arousal-dominance space
    const valence = emotions.joy * 0.8 - emotions.sadness * 0.8 - emotions.anger * 0.7 - emotions.fear * 0.6 + emotions.surprise * 0.2;
    const arousal = emotions.joy * 0.6 - emotions.sadness * 0.4 + emotions.anger * 0.9 + emotions.fear * 0.8 + emotions.surprise * 0.8;
    const dominance = emotions.joy * 0.5 - emotions.sadness * 0.6 + emotions.anger * 0.8 - emotions.fear * 0.7 + emotions.surprise * 0.2;
    
    // Calculate confidence based on feature quality
    const confidence = Math.min(1, maxEmotion * this.modelConfig.voice.confidence);
    
    return {
      primaryEmotion,
      secondaryEmotion,
      emotions,
      valence: Math.max(-1, Math.min(1, valence)),
      arousal: Math.max(-1, Math.min(1, arousal)),
      dominance: Math.max(-1, Math.min(1, dominance)),
      confidence
    };
  }
  
  /**
   * Processes text content to detect emotions
   * 
   * @private
   * @param {Object} textData - Text content data
   * @returns {Object} Detected emotions from text content
   */
  _processTextContent(textData) {
    // In a real implementation, this would use NLP models
    // For this implementation, we'll use a simplified keyword-based approach
    
    const content = textData.content || '';
    const lowerContent = content.toLowerCase();
    
    // Simple keyword-based emotion detection
    const joyKeywords = ['happy', 'excited', 'joy', 'great', 'wonderful', 'amazing', 'love', 'delighted'];
    const sadnessKeywords = ['sad', 'unhappy', 'disappointed', 'sorry', 'regret', 'miss', 'depressed'];
    const angerKeywords = ['angry', 'mad', 'furious', 'annoyed', 'irritated', 'frustrated'];
    const fearKeywords = ['afraid', 'scared', 'worried', 'anxious', 'nervous', 'terrified'];
    const surpriseKeywords = ['surprised', 'shocked', 'amazed', 'unexpected', 'wow'];
    
    // Count keyword occurrences
    const countKeywords = (keywords) => {
      return keywords.reduce((count, keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerContent.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
    };
    
    const joyCount = countKeywords(joyKeywords);
    const sadnessCount = countKeywords(sadnessKeywords);
    const angerCount = countKeywords(angerKeywords);
    const fearCount = countKeywords(fearKeywords);
    const surpriseCount = countKeywords(surpriseKeywords);
    
    const totalCount = joyCount + sadnessCount + angerCount + fearCount + surpriseCount;
    
    // Calculate emotion intensities
    const emotions = {
      joy: totalCount > 0 ? joyCount / totalCount : 0,
      sadness: totalCount > 0 ? sadnessCount / totalCount : 0,
      anger: totalCount > 0 ? angerCount / totalCount : 0,
      fear: totalCount > 0 ? fearCount / totalCount : 0,
      surprise: totalCount > 0 ? surpriseCount / totalCount : 0
    };
    
    // If no emotions detected, use sentiment analysis
    if (totalCount === 0) {
      // Simple sentiment analysis
      const positiveWords = ['good', 'nice', 'excellent', 'positive', 'fortunate', 'correct', 'superior'];
      const negativeWords = ['bad', 'awful', 'terrible', 'negative', 'unfortunate', 'wrong', 'inferior'];
      
      const positiveCount = countKeywords(positiveWords);
      const negativeCount = countKeywords(negativeWords);
      
      if (positiveCount > negativeCount) {
        emotions.joy = 0.6;
      } else if (negativeCount > positiveCount) {
        emotions.sadness = 0.6;
      } else {
        // Neutral
        emotions.joy = 0.2;
      }
    }
    
    // Determine primary and secondary emotions
    const sortedEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1]);
    
    const primaryEmotion = sortedEmotions[0][0];
    const secondaryEmotion = sortedEmotions[1][0];
    
    // Map to valence-arousal-dominance space
    const valence = emotions.joy * 0.9 - emotions.sadness * 0.9 - emotions.anger * 0.8 - emotions.fear * 0.7 + emotions.surprise * 0.3;
    const arousal = emotions.joy * 0.7 - emotions.sadness * 0.5 + emotions.anger * 0.9 + emotions.fear * 0.8 + emotions.surprise * 0.9;
    const dominance = emotions.joy * 0.6 - emotions.sadness * 0.7 + emotions.anger * 0.9 - emotions.fear * 0.9 + emotions.surprise * 0.3;
    
    // Calculate confidence based on keyword matches and content length
    const contentConfidence = Math.min(1, content.length / 100); // Longer text = higher confidence
    const keywordConfidence = Math.min(1, totalCount / 3); // More keywords = higher confidence
    const confidence = Math.min(1, (contentConfidence * 0.7 + keywordConfidence * 0.3) * this.modelConfig.text.confidence);
    
    return {
      primaryEmotion,
      secondaryEmotion,
      emotions,
      valence: Math.max(-1, Math.min(1, valence)),
      arousal: Math.max(-1, Math.min(1, arousal)),
      dominance: Math.max(-1, Math.min(1, dominance)),
      confidence
    };
  }
  
  /**
   * Fuses results from multiple modalities
   * 
   * @private
   * @param {Object} modalityResults - Results from each modality
   * @returns {Object} Fused emotional results
   */
  _fuseModalityResults(modalityResults) {
    // If only one modality is available, return its results
    const modalities = Object.keys(modalityResults);
    if (modalities.length === 0) {
      return {
        primaryEmotion: null,
        secondaryEmotion: null,
        valence: 0,
        arousal: 0,
        dominance: 0
      };
    }
    
    if (modalities.length === 1) {
      const result = modalityResults[modalities[0]];
      return {
        primaryEmotion: result.primaryEmotion,
        secondaryEmotion: result.secondaryEmotion,
        valence: result.valence,
        arousal: result.arousal,
        dominance: result.dominance
      };
    }
    
    // Weighted fusion based on confidence and priority
    let totalWeight = 0;
    let weightedValence = 0;
    let weightedArousal = 0;
    let weightedDominance = 0;
    
    // Collect all emotions across modalities
    const allEmotions = {};
    
    modalities.forEach(modality => {
      const result = modalityResults[modality];
      const weight = result.confidence * this.modelConfig[modality].priority;
      
      totalWeight += weight;
      weightedValence += result.valence * weight;
      weightedArousal += result.arousal * weight;
      weightedDominance += result.dominance * weight;
      
      // Aggregate emotions across modalities
      if (result.emotions) {
        Object.entries(result.emotions).forEach(([emotion, intensity]) => {
          if (!allEmotions[emotion]) {
            allEmotions[emotion] = 0;
          }
          allEmotions[emotion] += intensity * weight;
        });
      }
    });
    
    // Normalize emotions
    if (totalWeight > 0) {
      Object.keys(allEmotions).forEach(emotion => {
        allEmotions[emotion] /= totalWeight;
      });
    }
    
    // Determine primary and secondary emotions
    const sortedEmotions = Object.entries(allEmotions)
      .sort((a, b) => b[1] - a[1]);
    
    const primaryEmotion = sortedEmotions.length > 0 ? sortedEmotions[0][0] : null;
    const secondaryEmotion = sortedEmotions.length > 1 ? sortedEmotions[1][0] : null;
    
    // Calculate final valence, arousal, and dominance
    const valence = totalWeight > 0 ? weightedValence / totalWeight : 0;
    const arousal = totalWeight > 0 ? weightedArousal / totalWeight : 0;
    const dominance = totalWeight > 0 ? weightedDominance / totalWeight : 0;
    
    return {
      primaryEmotion,
      secondaryEmotion,
      valence,
      arousal,
      dominance
    };
  }
}

module.exports = { EmotionRecognitionEngine };
