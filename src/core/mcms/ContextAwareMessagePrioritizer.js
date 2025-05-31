/**
 * ContextAwareMessagePrioritizer.js
 * 
 * Implements a context-aware message prioritization system based on
 * Google's Project Astra announced at I/O 2025.
 * 
 * This component enables intelligent message prioritization based on
 * world model context, personal preferences, and environmental factors.
 * 
 * @author Aideon Team
 * @version 1.0.0
 */

const { PRIORITY } = require('./Constants');

/**
 * Class for context-aware message prioritization
 */
class ContextAwareMessagePrioritizer {
  /**
   * Create a new ContextAwareMessagePrioritizer
   * @param {Object} [worldModel] - Reference to the world model
   * @param {Object} [options] - Configuration options
   */
  constructor(worldModel = null, options = {}) {
    /**
     * Reference to the world model
     * @type {Object|null}
     */
    this.worldModel = worldModel;
    
    /**
     * Configuration options
     * @type {Object}
     */
    this.options = {
      enableCaching: options.enableCaching !== undefined ? options.enableCaching : true,
      maxCacheSize: options.maxCacheSize || 1000,
      defaultPriority: options.defaultPriority || PRIORITY.NORMAL,
      userPreferencesWeight: options.userPreferencesWeight || 0.4,
      worldModelWeight: options.worldModelWeight || 0.3,
      messageContentWeight: options.messageContentWeight || 0.2,
      environmentalFactorsWeight: options.environmentalFactorsWeight || 0.1
    };
    
    /**
     * Cache for prioritization results
     * @type {Map<string, Object>}
     * @private
     */
    this._prioritizationCache = new Map();
  }
  
  /**
   * Prioritize a message based on context
   * @param {Object} message - The message to prioritize
   * @param {Object} [context] - Additional context for prioritization
   * @returns {number} - The calculated priority
   */
  prioritizeMessage(message, context = {}) {
    // If message already has a priority and no context is provided, use that
    if (message.metadata.priority !== undefined && Object.keys(context).length === 0) {
      return message.metadata.priority;
    }
    
    // Generate cache key if caching is enabled
    let cacheKey = null;
    if (this.options.enableCaching) {
      cacheKey = this._generateCacheKey(message, context);
      const cachedPriority = this._getFromCache(cacheKey);
      if (cachedPriority !== null) {
        return cachedPriority;
      }
    }
    
    // Calculate priority based on various factors
    let priority = this._calculateBasePriority(message);
    
    // Adjust based on user preferences if available
    if (context.userPreferences) {
      priority = this._adjustForUserPreferences(priority, message, context.userPreferences);
    }
    
    // Adjust based on world model if available
    if (this.worldModel && context.worldModelContext) {
      priority = this._adjustForWorldModel(priority, message, context.worldModelContext);
    }
    
    // Adjust based on environmental factors if available
    if (context.environmentalFactors) {
      priority = this._adjustForEnvironmentalFactors(priority, message, context.environmentalFactors);
    }
    
    // Ensure priority is within valid range
    priority = Math.max(PRIORITY.LOWEST, Math.min(PRIORITY.EMERGENCY, priority));
    
    // Cache the result if caching is enabled
    if (this.options.enableCaching && cacheKey) {
      this._addToCache(cacheKey, priority);
    }
    
    return priority;
  }
  
  /**
   * Calculate the base priority for a message
   * @param {Object} message - The message to prioritize
   * @returns {number} - The base priority
   * @private
   */
  _calculateBasePriority(message) {
    // Start with default priority
    let priority = this.options.defaultPriority;
    
    // Check if message has an explicit priority
    if (message.metadata.priority !== undefined) {
      priority = message.metadata.priority;
    }
    
    // Adjust based on message type
    if (message.metadata.type) {
      switch (message.metadata.type) {
        case 'emergency':
          priority = PRIORITY.EMERGENCY;
          break;
        case 'alert':
          priority = PRIORITY.HIGHEST;
          break;
        case 'command':
          priority = Math.max(priority, PRIORITY.HIGH);
          break;
        case 'response':
          // Responses inherit priority from the request
          if (message.metadata.requestPriority !== undefined) {
            priority = message.metadata.requestPriority;
          }
          break;
      }
    }
    
    // Adjust based on QoS
    if (message.metadata.qos === 2) { // EXACTLY_ONCE
      priority = Math.max(priority, PRIORITY.HIGH);
    }
    
    // Adjust based on expiration
    if (message.metadata.expiresAt) {
      const timeToExpiration = message.metadata.expiresAt - Date.now();
      if (timeToExpiration < 1000) { // Less than 1 second
        priority = Math.max(priority, PRIORITY.HIGHEST);
      } else if (timeToExpiration < 5000) { // Less than 5 seconds
        priority = Math.max(priority, PRIORITY.HIGH);
      }
    }
    
    return priority;
  }
  
  /**
   * Adjust priority based on user preferences
   * @param {number} basePriority - The base priority
   * @param {Object} message - The message to prioritize
   * @param {Object} userPreferences - User preferences
   * @returns {number} - The adjusted priority
   * @private
   */
  _adjustForUserPreferences(basePriority, message, userPreferences) {
    let priority = basePriority;
    const weight = this.options.userPreferencesWeight;
    
    // Check if the message channel is in user's priority channels
    if (userPreferences.priorityChannels && 
        userPreferences.priorityChannels.includes(message.channel)) {
      priority += 1 * weight;
    }
    
    // Check if the message channel is in user's muted channels
    if (userPreferences.mutedChannels && 
        userPreferences.mutedChannels.includes(message.channel)) {
      priority -= 1 * weight;
    }
    
    // Check if the message contains keywords of interest
    if (userPreferences.interestKeywords && message.data && 
        typeof message.data === 'object' && message.data.text) {
      for (const keyword of userPreferences.interestKeywords) {
        if (message.data.text.includes(keyword)) {
          priority += 0.5 * weight;
          break;
        }
      }
    }
    
    return priority;
  }
  
  /**
   * Adjust priority based on world model context
   * @param {number} basePriority - The base priority
   * @param {Object} message - The message to prioritize
   * @param {Object} worldModelContext - World model context
   * @returns {number} - The adjusted priority
   * @private
   */
  _adjustForWorldModel(basePriority, message, worldModelContext) {
    let priority = basePriority;
    const weight = this.options.worldModelWeight;
    
    // If we have a world model, use it to evaluate message relevance
    if (this.worldModel) {
      try {
        const relevance = this.worldModel.evaluateMessageRelevance(message, worldModelContext);
        if (relevance !== null) {
          // Relevance is expected to be between 0 and 1
          priority += (relevance - 0.5) * 2 * weight;
        }
      } catch (error) {
        // If world model evaluation fails, fall back to simple heuristics
        console.error('World model evaluation failed:', error);
      }
    }
    
    // Use simple heuristics based on provided world model context
    if (worldModelContext.currentTask && message.metadata.relatedTask === worldModelContext.currentTask) {
      priority += 1 * weight;
    }
    
    if (worldModelContext.currentFocus && message.channel.includes(worldModelContext.currentFocus)) {
      priority += 0.5 * weight;
    }
    
    return priority;
  }
  
  /**
   * Adjust priority based on environmental factors
   * @param {number} basePriority - The base priority
   * @param {Object} message - The message to prioritize
   * @param {Object} environmentalFactors - Environmental factors
   * @returns {number} - The adjusted priority
   * @private
   */
  _adjustForEnvironmentalFactors(basePriority, message, environmentalFactors) {
    let priority = basePriority;
    const weight = this.options.environmentalFactorsWeight;
    
    // Adjust based on system load
    if (environmentalFactors.systemLoad !== undefined) {
      // If system is heavily loaded, reduce priority of non-critical messages
      if (environmentalFactors.systemLoad > 0.8 && priority < PRIORITY.HIGH) {
        priority -= 0.5 * weight;
      }
    }
    
    // Adjust based on network conditions
    if (environmentalFactors.networkQuality !== undefined) {
      // If network quality is poor, prioritize smaller messages
      if (environmentalFactors.networkQuality < 0.3) {
        const messageSize = this._estimateMessageSize(message);
        if (messageSize > 10000) { // Large message
          priority -= 0.5 * weight;
        } else if (messageSize < 1000) { // Small message
          priority += 0.3 * weight;
        }
      }
    }
    
    // Adjust based on battery level
    if (environmentalFactors.batteryLevel !== undefined) {
      // If battery is low, reduce priority of non-critical messages
      if (environmentalFactors.batteryLevel < 0.2 && priority < PRIORITY.HIGH) {
        priority -= 0.5 * weight;
      }
    }
    
    // Adjust based on user activity
    if (environmentalFactors.userActivity) {
      switch (environmentalFactors.userActivity) {
        case 'idle':
          // User is idle, can process more messages
          priority += 0.2 * weight;
          break;
        case 'busy':
          // User is busy, reduce non-critical messages
          if (priority < PRIORITY.HIGH) {
            priority -= 0.3 * weight;
          }
          break;
        case 'doNotDisturb':
          // User doesn't want to be disturbed, significantly reduce non-emergency messages
          if (priority < PRIORITY.EMERGENCY) {
            priority -= 1 * weight;
          }
          break;
      }
    }
    
    return priority;
  }
  
  /**
   * Estimate the size of a message in bytes
   * @param {Object} message - The message to estimate
   * @returns {number} - Estimated size in bytes
   * @private
   */
  _estimateMessageSize(message) {
    try {
      return JSON.stringify(message).length;
    } catch (error) {
      return 1000; // Default size if estimation fails
    }
  }
  
  /**
   * Generate a cache key for a message and context
   * @param {Object} message - The message
   * @param {Object} context - The context
   * @returns {string} - Cache key
   * @private
   */
  _generateCacheKey(message, context) {
    // Create a simplified representation of the message for the cache key
    const messageKey = {
      channel: message.channel,
      type: message.metadata.type,
      priority: message.metadata.priority,
      qos: message.metadata.qos
    };
    
    // Create a simplified representation of the context for the cache key
    const contextKey = {};
    
    if (context.userPreferences) {
      contextKey.userPreferences = {
        priorityChannels: context.userPreferences.priorityChannels,
        mutedChannels: context.userPreferences.mutedChannels
      };
    }
    
    if (context.worldModelContext) {
      contextKey.worldModelContext = {
        currentTask: context.worldModelContext.currentTask,
        currentFocus: context.worldModelContext.currentFocus
      };
    }
    
    if (context.environmentalFactors) {
      contextKey.environmentalFactors = {
        systemLoad: context.environmentalFactors.systemLoad,
        networkQuality: context.environmentalFactors.networkQuality,
        batteryLevel: context.environmentalFactors.batteryLevel,
        userActivity: context.environmentalFactors.userActivity
      };
    }
    
    // Generate a string key
    return JSON.stringify({ message: messageKey, context: contextKey });
  }
  
  /**
   * Get a priority from the cache
   * @param {string} cacheKey - Cache key
   * @returns {number|null} - Cached priority or null if not found
   * @private
   */
  _getFromCache(cacheKey) {
    const cached = this._prioritizationCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    
    // Check if the cached value has expired (5 minutes)
    if (Date.now() - cached.timestamp > 300000) {
      this._prioritizationCache.delete(cacheKey);
      return null;
    }
    
    return cached.priority;
  }
  
  /**
   * Add a priority to the cache
   * @param {string} cacheKey - Cache key
   * @param {number} priority - Priority value
   * @private
   */
  _addToCache(cacheKey, priority) {
    // If the cache is full, remove the oldest entry
    if (this._prioritizationCache.size >= this.options.maxCacheSize) {
      const oldestKey = this._prioritizationCache.keys().next().value;
      this._prioritizationCache.delete(oldestKey);
    }
    
    this._prioritizationCache.set(cacheKey, {
      priority,
      timestamp: Date.now()
    });
  }
  
  /**
   * Clear the prioritization cache
   */
  clearCache() {
    this._prioritizationCache.clear();
  }
  
  /**
   * Set the world model
   * @param {Object} worldModel - The world model
   */
  setWorldModel(worldModel) {
    this.worldModel = worldModel;
    this.clearCache(); // Clear cache when world model changes
  }
}

module.exports = { ContextAwareMessagePrioritizer };
