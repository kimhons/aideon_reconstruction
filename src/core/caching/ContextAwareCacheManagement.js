/**
 * @fileoverview Context-Aware Cache Management for the Advanced Caching Strategies system
 * Adjusts caching behavior based on context (network, device, user activity, etc.)
 */

const EventEmitter = require('events');

/**
 * Class representing a context-aware cache management system
 * @extends EventEmitter
 */
class ContextAwareCacheManagement extends EventEmitter {
  /**
   * Create a new ContextAwareCacheManagement instance
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enabled=true] - Whether context-aware management is enabled
   * @param {Object} [options.contextProvider] - Context provider instance
   * @param {Object} [options.policies] - Cache policies for different content types
   * @param {Object} [options.contextRules] - Rules for adjusting cache behavior based on context
   * @param {boolean} [options.trackStats=true] - Whether to track statistics
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      enabled: options.enabled !== false,
      trackStats: options.trackStats !== false
    };
    
    this.contextProvider = options.contextProvider;
    
    if (!this.contextProvider && this.options.enabled) {
      throw new Error('Context provider is required for context-aware cache management');
    }
    
    // Default policies for different content types
    this.policies = options.policies || {
      default: {
        ttl: 3600000, // 1 hour
        priority: 1,
        shouldCache: true
      },
      'api:data': {
        ttl: 300000, // 5 minutes
        priority: 2,
        shouldCache: true
      },
      'image': {
        ttl: 86400000, // 24 hours
        priority: 1,
        shouldCache: true
      },
      'non-essential': {
        ttl: 1800000, // 30 minutes
        priority: 0,
        shouldCache: ctx => ctx.networkType !== 'cellular' || ctx.userActivity !== 'idle'
      }
    };
    
    // Default context rules for adjusting cache behavior
    this.contextRules = options.contextRules || {
      networkType: {
        wifi: { ttlMultiplier: 1.0, shouldCache: true },
        ethernet: { ttlMultiplier: 1.2, shouldCache: true },
        cellular: { ttlMultiplier: 0.5, shouldCache: true },
        '2g': { ttlMultiplier: 0.3, shouldCache: false },
        '3g': { ttlMultiplier: 0.4, shouldCache: true },
        '4g': { ttlMultiplier: 0.6, shouldCache: true },
        '5g': { ttlMultiplier: 0.8, shouldCache: true },
        offline: { ttlMultiplier: 2.0, shouldCache: true }
      },
      batteryLevel: {
        low: { ttlMultiplier: 1.5, shouldCache: false },
        medium: { ttlMultiplier: 1.0, shouldCache: true },
        high: { ttlMultiplier: 0.8, shouldCache: true },
        charging: { ttlMultiplier: 0.7, shouldCache: true }
      },
      timeOfDay: {
        morning: { ttlMultiplier: 1.0, shouldCache: true },
        afternoon: { ttlMultiplier: 0.9, shouldCache: true },
        evening: { ttlMultiplier: 1.1, shouldCache: true },
        night: { ttlMultiplier: 1.3, shouldCache: true }
      },
      userActivity: {
        active: { ttlMultiplier: 0.8, shouldCache: true },
        idle: { ttlMultiplier: 1.2, shouldCache: false },
        away: { ttlMultiplier: 1.5, shouldCache: false }
      },
      deviceType: {
        mobile: { ttlMultiplier: 0.8, shouldCache: true },
        tablet: { ttlMultiplier: 0.9, shouldCache: true },
        desktop: { ttlMultiplier: 1.0, shouldCache: true },
        tv: { ttlMultiplier: 1.2, shouldCache: true }
      }
    };
    
    this.currentContext = {};
    this.contextChangeListener = null;
    
    this.stats = {
      ttlAdjustments: 0,
      cacheDecisions: 0,
      contextChanges: 0
    };
  }

  /**
   * Initialize the context-aware cache management system
   * @param {Object} cacheManager - Cache manager instance
   * @returns {void}
   */
  initialize(cacheManager) {
    this.cacheManager = cacheManager;
    
    if (!this.options.enabled || !this.contextProvider) {
      return;
    }
    
    // Get initial context
    this.currentContext = this.contextProvider.getContext();
    
    // Set up context change listener
    this.contextChangeListener = this.contextProvider.onContextChange(context => {
      this._handleContextChange(context);
    });
  }

  /**
   * Handle context change
   * @param {Object} newContext - New context
   * @private
   */
  _handleContextChange(newContext) {
    const oldContext = this.currentContext;
    this.currentContext = newContext;
    
    if (this.options.trackStats) {
      this.stats.contextChanges++;
    }
    
    // Emit context change event
    this.emit('contextChange', newContext, oldContext);
  }

  /**
   * Get the current context
   * @returns {Object} Current context
   */
  getContext() {
    return { ...this.currentContext };
  }

  /**
   * Get cache policy for a specific content type
   * @param {string} contentType - Content type
   * @returns {Object} Cache policy
   */
  getCachePolicy(contentType) {
    // Get base policy
    const basePolicy = this.policies[contentType] || this.policies.default;
    
    // Apply context rules
    const adjustedPolicy = { ...basePolicy };
    
    // Adjust TTL based on context rules
    if (adjustedPolicy.ttl) {
      adjustedPolicy.ttl = this.adjustTTL(adjustedPolicy.ttl, contentType);
    }
    
    return adjustedPolicy;
  }

  /**
   * Adjust TTL based on current context
   * @param {number} baseTTL - Base TTL in milliseconds
   * @param {string} [contentType] - Content type
   * @returns {number} Adjusted TTL in milliseconds
   */
  adjustTTL(baseTTL, contentType) {
    if (!this.options.enabled || !this.currentContext) {
      return baseTTL;
    }
    
    let ttlMultiplier = 1.0;
    
    // Apply context rules
    for (const [contextKey, contextValue] of Object.entries(this.currentContext)) {
      if (this.contextRules[contextKey] && this.contextRules[contextKey][contextValue]) {
        const rule = this.contextRules[contextKey][contextValue];
        if (rule.ttlMultiplier) {
          ttlMultiplier *= rule.ttlMultiplier;
        }
      }
    }
    
    // Apply content type specific adjustments
    if (contentType && this.policies[contentType] && this.policies[contentType].ttlMultiplier) {
      ttlMultiplier *= this.policies[contentType].ttlMultiplier;
    }
    
    if (this.options.trackStats) {
      this.stats.ttlAdjustments++;
    }
    
    return Math.round(baseTTL * ttlMultiplier);
  }

  /**
   * Determine whether to cache an item based on current context
   * @param {string} [contentType] - Content type
   * @returns {boolean} Whether to cache the item
   */
  shouldCache(contentType) {
    if (!this.options.enabled || !this.currentContext) {
      return true;
    }
    
    // Get base policy
    const policy = this.policies[contentType] || this.policies.default;
    
    // If policy has a shouldCache function, use it
    if (typeof policy.shouldCache === 'function') {
      const result = policy.shouldCache(this.currentContext);
      
      if (this.options.trackStats) {
        this.stats.cacheDecisions++;
      }
      
      return result;
    }
    
    // If policy has a boolean shouldCache, use it
    if (typeof policy.shouldCache === 'boolean') {
      if (this.options.trackStats) {
        this.stats.cacheDecisions++;
      }
      
      return policy.shouldCache;
    }
    
    // Apply context rules
    for (const [contextKey, contextValue] of Object.entries(this.currentContext)) {
      if (this.contextRules[contextKey] && 
          this.contextRules[contextKey][contextValue] && 
          this.contextRules[contextKey][contextValue].shouldCache === false) {
        
        if (this.options.trackStats) {
          this.stats.cacheDecisions++;
        }
        
        return false;
      }
    }
    
    if (this.options.trackStats) {
      this.stats.cacheDecisions++;
    }
    
    return true;
  }

  /**
   * Add or update a cache policy
   * @param {string} contentType - Content type
   * @param {Object} policy - Cache policy
   * @returns {void}
   */
  setPolicy(contentType, policy) {
    this.policies[contentType] = { ...policy };
    
    // Emit policy change event
    this.emit('policyChange', contentType, policy);
  }

  /**
   * Add or update a context rule
   * @param {string} contextKey - Context key
   * @param {string} contextValue - Context value
   * @param {Object} rule - Context rule
   * @returns {void}
   */
  setContextRule(contextKey, contextValue, rule) {
    if (!this.contextRules[contextKey]) {
      this.contextRules[contextKey] = {};
    }
    
    this.contextRules[contextKey][contextValue] = { ...rule };
    
    // Emit rule change event
    this.emit('ruleChange', contextKey, contextValue, rule);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    if (!this.options.trackStats) {
      return null;
    }
    
    return { ...this.stats };
  }

  /**
   * Reset statistics
   * @returns {void}
   */
  resetStats() {
    this.stats = {
      ttlAdjustments: 0,
      cacheDecisions: 0,
      contextChanges: 0
    };
  }

  /**
   * Dispose of resources
   * @returns {void}
   */
  dispose() {
    if (this.contextChangeListener) {
      this.contextChangeListener();
      this.contextChangeListener = null;
    }
    
    this.removeAllListeners();
  }
}

module.exports = ContextAwareCacheManagement;
