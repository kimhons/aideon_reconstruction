/**
 * @fileoverview EmotionalMemorySystem stores and retrieves emotional history
 * to provide context for future interactions and enable pattern recognition.
 * 
 * @author Aideon AI Team
 * @copyright Aideon AI Inc.
 */

const EventEmitter = require('events');
// Corrected import path for utility modules
const { LockAdapter } = require('../../common/utils/LockAdapter');
const { Logger } = require('../../common/utils/Logger');

/**
 * System for storing and retrieving emotional history
 */
class EmotionalMemorySystem {
  /**
   * Creates a new EmotionalMemorySystem instance
   * 
   * @param {Object} [options] - Configuration options
   * @param {number} [options.maxHistoryLength=100] - Maximum number of events to store
   * @param {LockAdapter} [options.lockAdapter=null] - Lock adapter for thread safety
   */
  constructor(options = {}) {
    this.maxHistoryLength = options.maxHistoryLength || 100;
    this.lockAdapter = options.lockAdapter || new LockAdapter();
    this.logger = new Logger('EmotionalMemorySystem');
    this.events = new EventEmitter();
    
    this.emotionalEvents = [];
    this.emotionalPatterns = new Map();
    
    this.logger.info('EmotionalMemorySystem initialized');
  }
  
  /**
   * Stores an emotional event in memory
   * 
   * @param {Object} eventData - Emotional event data
   * @param {Object} [options] - Storage options
   * @returns {Promise<Object>} Stored event with ID
   */
  async storeEmotionalEvent(eventData, options = {}) {
    const lockKey = `store_event_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Storing emotional event');
      
      // Generate event ID
      const eventId = `event_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Create event object
      const event = {
        id: eventId,
        ...eventData,
        timestamp: eventData.timestamp || Date.now()
      };
      
      // Add to history
      this.emotionalEvents.unshift(event);
      
      // Trim history if it exceeds the maximum length
      if (this.emotionalEvents.length > this.maxHistoryLength) {
        this.emotionalEvents = this.emotionalEvents.slice(0, this.maxHistoryLength);
      }
      
      // Analyze for patterns
      this._analyzePatterns();
      
      // Emit event for subscribers
      this.events.emit('event_stored', event);
      
      return event;
    } catch (error) {
      this.logger.error('Error storing emotional event', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets recent emotional history
   * 
   * @param {number} [limit=10] - Maximum number of events to return
   * @param {Object} [options] - Retrieval options
   * @param {Object} [options.filter] - Filter criteria
   * @returns {Promise<Array<Object>>} Recent emotional events
   */
  async getRecentHistory(limit = 10, options = {}) {
    const lockKey = `get_history_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Getting recent history', { limit });
      
      let events = [...this.emotionalEvents];
      
      // Apply filters if provided
      if (options.filter) {
        events = this._applyFilters(events, options.filter);
      }
      
      // Limit the number of events
      events = events.slice(0, limit);
      
      return events;
    } catch (error) {
      this.logger.error('Error getting recent history', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Gets emotional patterns
   * 
   * @param {Object} [options] - Retrieval options
   * @param {string} [options.patternType] - Type of pattern to retrieve
   * @returns {Promise<Array<Object>>} Emotional patterns
   */
  async getEmotionalPatterns(options = {}) {
    const lockKey = `get_patterns_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Getting emotional patterns');
      
      let patterns = [];
      
      if (options.patternType) {
        // Get specific pattern type
        const pattern = this.emotionalPatterns.get(options.patternType);
        if (pattern) {
          patterns = [pattern];
        }
      } else {
        // Get all patterns
        patterns = Array.from(this.emotionalPatterns.values());
      }
      
      return patterns;
    } catch (error) {
      this.logger.error('Error getting emotional patterns', { error });
      throw error;
    } finally {
      await this.lockAdapter.releaseLock(lockKey);
    }
  }
  
  /**
   * Searches for emotional events matching criteria
   * 
   * @param {Object} criteria - Search criteria
   * @param {Object} [options] - Search options
   * @param {number} [options.limit=10] - Maximum number of events to return
   * @returns {Promise<Array<Object>>} Matching emotional events
   */
  async searchEmotionalEvents(criteria, options = {}) {
    const lockKey = `search_events_${Date.now()}`;
    
    try {
      await this.lockAdapter.acquireLock(lockKey);
      this.logger.debug('Searching emotional events', { criteria });
      
      const limit = options.limit || 10;
      const events = this._applyFilters(this.emotionalEvents, criteria);
      
      return events.slice(0, limit);
    } catch (error) {
      this.logger.error('Error searching emotional events', { error });
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
   * Applies filters to emotional events
   * 
   * @private
   * @param {Array<Object>} events - Emotional events
   * @param {Object} filter - Filter criteria
   * @returns {Array<Object>} Filtered events
   */
  _applyFilters(events, filter) {
    return events.filter(event => {
      // Check each filter criterion
      for (const [key, value] of Object.entries(filter)) {
        if (key === 'timeRange') {
          // Time range filter
          const { start, end } = value;
          if (start && event.timestamp < start) return false;
          if (end && event.timestamp > end) return false;
        } else if (key === 'primaryEmotion') {
          // Primary emotion filter
          if (event.contextualEmotions && 
              event.contextualEmotions.primaryEmotion !== value) {
            return false;
          }
        } else if (key === 'valenceRange') {
          // Valence range filter
          const { min, max } = value;
          if (event.contextualEmotions) {
            const valence = event.contextualEmotions.valence;
            if (min !== undefined && valence < min) return false;
            if (max !== undefined && valence > max) return false;
          }
        } else if (key === 'arousalRange') {
          // Arousal range filter
          const { min, max } = value;
          if (event.contextualEmotions) {
            const arousal = event.contextualEmotions.arousal;
            if (min !== undefined && arousal < min) return false;
            if (max !== undefined && arousal > max) return false;
          }
        } else if (key === 'inputType') {
          // Input type filter
          if (!event.input || !event.input[value]) return false;
        } else {
          // Generic property filter
          if (!this._deepMatch(event, key, value)) return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Performs deep property matching for filtering
   * 
   * @private
   * @param {Object} obj - Object to check
   * @param {string} path - Property path (dot notation)
   * @param {*} value - Value to match
   * @returns {boolean} Whether the property matches
   */
  _deepMatch(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      if (current === null || current === undefined) {
        return false;
      }
      
      current = current[parts[i]];
    }
    
    if (Array.isArray(value)) {
      return value.includes(current);
    } else if (value instanceof RegExp) {
      return value.test(String(current));
    } else {
      return current === value;
    }
  }
  
  /**
   * Analyzes emotional events for patterns
   * 
   * @private
   */
  _analyzePatterns() {
    if (this.emotionalEvents.length < 5) {
      return; // Not enough data for pattern analysis
    }
    
    // Analyze emotional trends
    this._analyzeEmotionalTrends();
    
    // Analyze situational patterns
    this._analyzeSituationalPatterns();
    
    // Analyze response effectiveness
    this._analyzeResponseEffectiveness();
  }
  
  /**
   * Analyzes emotional trends over time
   * 
   * @private
   */
  _analyzeEmotionalTrends() {
    // Get recent events with contextual emotions
    const recentEvents = this.emotionalEvents
      .filter(event => event.contextualEmotions)
      .slice(0, 20);
    
    if (recentEvents.length < 5) {
      return; // Not enough data
    }
    
    // Calculate average valence, arousal, and dominance
    let totalValence = 0;
    let totalArousal = 0;
    let totalDominance = 0;
    
    recentEvents.forEach(event => {
      totalValence += event.contextualEmotions.valence || 0;
      totalArousal += event.contextualEmotions.arousal || 0;
      totalDominance += event.contextualEmotions.dominance || 0;
    });
    
    const avgValence = totalValence / recentEvents.length;
    const avgArousal = totalArousal / recentEvents.length;
    const avgDominance = totalDominance / recentEvents.length;
    
    // Calculate trend (slope) for each dimension
    const valenceTrend = this._calculateTrend(recentEvents, 'contextualEmotions.valence');
    const arousalTrend = this._calculateTrend(recentEvents, 'contextualEmotions.arousal');
    const dominanceTrend = this._calculateTrend(recentEvents, 'contextualEmotions.dominance');
    
    // Store the pattern
    this.emotionalPatterns.set('emotionalTrends', {
      type: 'emotionalTrends',
      averages: {
        valence: avgValence,
        arousal: avgArousal,
        dominance: avgDominance
      },
      trends: {
        valence: valenceTrend,
        arousal: arousalTrend,
        dominance: dominanceTrend
      },
      timestamp: Date.now()
    });
  }
  
  /**
   * Analyzes patterns related to specific situations
   * 
   * @private
   */
  _analyzeSituationalPatterns() {
    // Get events with situational context
    const eventsWithSituation = this.emotionalEvents
      .filter(event => 
        event.contextualEmotions && 
        event.input && 
        event.input.situation
      );
    
    if (eventsWithSituation.length < 3) {
      return; // Not enough data
    }
    
    // Group events by situation type
    const situationGroups = new Map();
    
    eventsWithSituation.forEach(event => {
      const situationType = event.input.situation.type;
      if (!situationType) return;
      
      if (!situationGroups.has(situationType)) {
        situationGroups.set(situationType, []);
      }
      
      situationGroups.get(situationType).push(event);
    });
    
    // Analyze each situation type with enough data
    const situationalPatterns = [];
    
    situationGroups.forEach((events, situationType) => {
      if (events.length < 3) return; // Not enough data for this situation
      
      // Calculate average emotional response for this situation
      let totalValence = 0;
      let totalArousal = 0;
      let totalDominance = 0;
      
      events.forEach(event => {
        totalValence += event.contextualEmotions.valence || 0;
        totalArousal += event.contextualEmotions.arousal || 0;
        totalDominance += event.contextualEmotions.dominance || 0;
      });
      
      const avgValence = totalValence / events.length;
      const avgArousal = totalArousal / events.length;
      const avgDominance = totalDominance / events.length;
      
      // Determine most common primary emotion
      const emotionCounts = new Map();
      events.forEach(event => {
        const emotion = event.contextualEmotions.primaryEmotion;
        if (!emotion) return;
        
        emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
      });
      
      let mostCommonEmotion = null;
      let highestCount = 0;
      
      emotionCounts.forEach((count, emotion) => {
        if (count > highestCount) {
          mostCommonEmotion = emotion;
          highestCount = count;
        }
      });
      
      situationalPatterns.push({
        situationType,
        averageResponse: {
          valence: avgValence,
          arousal: avgArousal,
          dominance: avgDominance
        },
        mostCommonEmotion,
        confidence: events.length / 10, // Higher with more data points
        sampleSize: events.length
      });
    });
    
    // Store the pattern
    this.emotionalPatterns.set('situationalPatterns', {
      type: 'situationalPatterns',
      patterns: situationalPatterns,
      timestamp: Date.now()
    });
  }
  
  /**
   * Analyzes the effectiveness of different response strategies
   * 
   * @private
   */
  _analyzeResponseEffectiveness() {
    // Get events with responses and subsequent events
    const eventsWithResponses = this.emotionalEvents
      .filter((event, index) => 
        index < this.emotionalEvents.length - 1 && // Not the last event
        event.response && 
        event.response.strategy && 
        this.emotionalEvents[index + 1].contextualEmotions // Next event has emotions
      );
    
    if (eventsWithResponses.length < 3) {
      return; // Not enough data
    }
    
    // Group by response strategy
    const strategyGroups = new Map();
    
    eventsWithResponses.forEach((event, index) => {
      const strategy = event.response.strategy;
      const nextEvent = this.emotionalEvents[index + 1];
      
      if (!strategyGroups.has(strategy)) {
        strategyGroups.set(strategy, []);
      }
      
      strategyGroups.get(strategy).push({
        event,
        nextEvent
      });
    });
    
    // Analyze effectiveness of each strategy
    const strategyEffectiveness = [];
    
    strategyGroups.forEach((pairs, strategy) => {
      if (pairs.length < 2) return; // Not enough data for this strategy
      
      // Calculate average valence change
      let totalValenceChange = 0;
      let totalPositiveChanges = 0;
      
      pairs.forEach(({ event, nextEvent }) => {
        const initialValence = event.contextualEmotions.valence || 0;
        const nextValence = nextEvent.contextualEmotions.valence || 0;
        const valenceChange = nextValence - initialValence;
        
        totalValenceChange += valenceChange;
        if (valenceChange > 0) {
          totalPositiveChanges++;
        }
      });
      
      const avgValenceChange = totalValenceChange / pairs.length;
      const positiveChangeRate = totalPositiveChanges / pairs.length;
      
      strategyEffectiveness.push({
        strategy,
        avgValenceChange,
        positiveChangeRate,
        sampleSize: pairs.length,
        confidence: pairs.length / 10 // Higher with more data points
      });
    });
    
    // Store the pattern
    this.emotionalPatterns.set('responseEffectiveness', {
      type: 'responseEffectiveness',
      strategies: strategyEffectiveness,
      timestamp: Date.now()
    });
  }
  
  /**
   * Calculates trend (slope) for a specific property across events
   * 
   * @private
   * @param {Array<Object>} events - Events to analyze
   * @param {string} property - Property to analyze (dot notation)
   * @returns {number} Trend value (positive = upward, negative = downward)
   */
  _calculateTrend(events, property) {
    // Extract property values and timestamps
    const points = events.map(event => {
      const value = this._getPropertyValue(event, property);
      return {
        value: value !== undefined ? value : null,
        timestamp: event.timestamp
      };
    }).filter(point => point.value !== null);
    
    if (points.length < 3) {
      return 0; // Not enough data points
    }
    
    // Sort by timestamp (oldest first)
    points.sort((a, b) => a.timestamp - b.timestamp);
    
    // Normalize timestamps to be relative to the first point
    const firstTimestamp = points[0].timestamp;
    const normalizedPoints = points.map(point => ({
      value: point.value,
      time: (point.timestamp - firstTimestamp) / (1000 * 60) // Convert to minutes
    }));
    
    // Calculate linear regression slope
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    normalizedPoints.forEach(point => {
      sumX += point.time;
      sumY += point.value;
      sumXY += point.time * point.value;
      sumXX += point.time * point.time;
    });
    
    const n = normalizedPoints.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }
  
  /**
   * Gets a property value using dot notation
   * 
   * @private
   * @param {Object} obj - Object to get property from
   * @param {string} path - Property path (dot notation)
   * @returns {*} Property value
   */
  _getPropertyValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[parts[i]];
    }
    
    return current;
  }
}

module.exports = { EmotionalMemorySystem };
