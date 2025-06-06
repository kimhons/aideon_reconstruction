/**
 * @fileoverview Feature Flag Manager for Aideon
 * 
 * The FeatureFlagManager provides controlled feature rollout capabilities
 * for the Enhanced Configuration System, supporting targeting strategies,
 * gradual rollouts, and analytics integration.
 * 
 * This component is part of the Enhanced Configuration System designed
 * to improve Aideon's GAIA Score by enhancing reliability and adaptability.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Feature Flag Manager class
 * 
 * Provides controlled feature rollout capabilities with targeting
 * strategies and analytics integration.
 */
class FeatureFlagManager {
  /**
   * Creates a new FeatureFlagManager instance
   * 
   * @param {Object} options - Feature flag manager options
   * @param {Object} options.configManager - Configuration manager instance
   * @param {Object} options.initialFlags - Initial feature flags
   * @param {Function} options.analyticsCallback - Analytics callback function
   */
  constructor(options = {}) {
    this.configManager = options.configManager;
    this.flags = new Map();
    this.eventEmitter = new EventEmitter();
    this.analyticsCallback = options.analyticsCallback || null;
    this.evaluationCache = new Map();
    this.cacheEnabled = options.cacheEnabled !== undefined ? options.cacheEnabled : true;
    this.cacheTTL = options.cacheTTL || 60000; // 1 minute default
    
    // Initialize with any provided flags
    if (options.initialFlags) {
      for (const [key, flag] of Object.entries(options.initialFlags)) {
        this.addFlag(key, flag);
      }
    }
  }

  /**
   * Adds a new feature flag
   * 
   * @param {string} key - Feature flag key
   * @param {Object} options - Feature flag options
   * @param {boolean} options.enabled - Whether the flag is enabled
   * @param {number} options.rolloutPercentage - Rollout percentage (0-100)
   * @param {string[]} options.targetSegments - Target segments
   * @param {Object} options.rules - Additional targeting rules
   * @param {Date} options.startDate - Flag activation start date
   * @param {Date} options.endDate - Flag activation end date
   * @param {string} options.description - Flag description
   * @param {string} options.owner - Flag owner
   * @returns {boolean} Success status
   */
  addFlag(key, options = {}) {
    if (!key) {
      throw new Error('Feature flag key is required');
    }
    
    if (this.flags.has(key)) {
      throw new Error(`Feature flag already exists: ${key}`);
    }
    
    const flag = {
      key,
      enabled: options.enabled !== undefined ? options.enabled : false,
      rolloutPercentage: options.rolloutPercentage !== undefined ? options.rolloutPercentage : 0,
      targetSegments: options.targetSegments || [],
      rules: options.rules || {},
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      description: options.description || '',
      owner: options.owner || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      evaluations: {
        total: 0,
        enabled: 0,
        disabled: 0
      }
    };
    
    this.flags.set(key, flag);
    
    // Clear cache for this flag
    this.clearFlagCache(key);
    
    // Emit flag added event
    this.eventEmitter.emit('flagAdded', {
      key,
      flag,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Updates an existing feature flag
   * 
   * @param {string} key - Feature flag key
   * @param {Object} options - Feature flag options
   * @returns {boolean} Success status
   */
  updateFlag(key, options = {}) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const flag = this.flags.get(key);
    const oldFlag = { ...flag };
    
    // Update flag properties
    if (options.enabled !== undefined) flag.enabled = options.enabled;
    if (options.rolloutPercentage !== undefined) flag.rolloutPercentage = options.rolloutPercentage;
    if (options.targetSegments !== undefined) flag.targetSegments = options.targetSegments;
    if (options.rules !== undefined) flag.rules = options.rules;
    if (options.startDate !== undefined) flag.startDate = options.startDate;
    if (options.endDate !== undefined) flag.endDate = options.endDate;
    if (options.description !== undefined) flag.description = options.description;
    if (options.owner !== undefined) flag.owner = options.owner;
    
    flag.updatedAt = new Date();
    
    // Clear cache for this flag
    this.clearFlagCache(key);
    
    // Emit flag updated event
    this.eventEmitter.emit('flagUpdated', {
      key,
      oldFlag,
      newFlag: flag,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Removes a feature flag
   * 
   * @param {string} key - Feature flag key
   * @returns {boolean} Success status
   */
  removeFlag(key) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const flag = this.flags.get(key);
    this.flags.delete(key);
    
    // Clear cache for this flag
    this.clearFlagCache(key);
    
    // Emit flag removed event
    this.eventEmitter.emit('flagRemoved', {
      key,
      flag,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Gets a feature flag
   * 
   * @param {string} key - Feature flag key
   * @returns {Object|null} Feature flag or null if not found
   */
  getFlag(key) {
    if (!key) {
      return null;
    }
    
    return this.flags.has(key) ? { ...this.flags.get(key) } : null;
  }

  /**
   * Gets all feature flags
   * 
   * @returns {Object} All feature flags
   */
  getAllFlags() {
    const result = {};
    for (const [key, flag] of this.flags.entries()) {
      result[key] = { ...flag };
    }
    return result;
  }

  /**
   * Checks if a feature is enabled
   * 
   * @param {string} key - Feature flag key
   * @param {Object} context - Evaluation context
   * @param {string} context.userId - User ID
   * @param {string[]} context.segments - User segments
   * @param {Object} context.attributes - User attributes
   * @returns {boolean} Whether the feature is enabled
   */
  isEnabled(key, context = {}) {
    if (!key) {
      return false;
    }
    
    // Check cache if enabled
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(key, context);
      const cachedResult = this.evaluationCache.get(cacheKey);
      if (cachedResult && cachedResult.expiry > Date.now()) {
        return cachedResult.result;
      }
    }
    
    // Get flag
    const flag = this.flags.get(key);
    if (!flag) {
      return false;
    }
    
    // Track evaluation
    flag.evaluations.total++;
    
    // If flag is not enabled, return false
    if (!flag.enabled) {
      flag.evaluations.disabled++;
      this.trackAnalytics(key, false, context);
      
      // Cache result if enabled
      if (this.cacheEnabled) {
        this.cacheResult(key, context, false);
      }
      
      return false;
    }
    
    // Check date constraints
    const now = new Date();
    if (flag.startDate && now < flag.startDate) {
      flag.evaluations.disabled++;
      this.trackAnalytics(key, false, context);
      
      // Cache result if enabled
      if (this.cacheEnabled) {
        this.cacheResult(key, context, false);
      }
      
      return false;
    }
    
    if (flag.endDate && now > flag.endDate) {
      flag.evaluations.disabled++;
      this.trackAnalytics(key, false, context);
      
      // Cache result if enabled
      if (this.cacheEnabled) {
        this.cacheResult(key, context, false);
      }
      
      return false;
    }
    
    // Check target segments
    if (flag.targetSegments && flag.targetSegments.length > 0) {
      if (context.segments) {
        const segments = Array.isArray(context.segments) ? context.segments : [context.segments];
        for (const segment of segments) {
          if (flag.targetSegments.includes(segment)) {
            flag.evaluations.enabled++;
            this.trackAnalytics(key, true, context);
            
            // Cache result if enabled
            if (this.cacheEnabled) {
              this.cacheResult(key, context, true);
            }
            
            return true;
          }
        }
      }
    }
    
    // Check custom rules
    if (flag.rules && Object.keys(flag.rules).length > 0) {
      if (this.evaluateRules(flag.rules, context)) {
        flag.evaluations.enabled++;
        this.trackAnalytics(key, true, context);
        
        // Cache result if enabled
        if (this.cacheEnabled) {
          this.cacheResult(key, context, true);
        }
        
        return true;
      }
    }
    
    // Check rollout percentage
    if (flag.rolloutPercentage > 0) {
      const userId = context.userId || 'anonymous';
      const hash = this.hashString(userId + key);
      const percentage = hash % 100;
      
      if (percentage < flag.rolloutPercentage) {
        flag.evaluations.enabled++;
        this.trackAnalytics(key, true, context);
        
        // Cache result if enabled
        if (this.cacheEnabled) {
          this.cacheResult(key, context, true);
        }
        
        return true;
      }
    }
    
    // Default to disabled
    flag.evaluations.disabled++;
    this.trackAnalytics(key, false, context);
    
    // Cache result if enabled
    if (this.cacheEnabled) {
      this.cacheResult(key, context, false);
    }
    
    return false;
  }

  /**
   * Evaluates custom rules
   * 
   * @param {Object} rules - Custom rules
   * @param {Object} context - Evaluation context
   * @returns {boolean} Whether the rules pass
   * @private
   */
  evaluateRules(rules, context) {
    // No rules means pass
    if (!rules || Object.keys(rules).length === 0) {
      return true;
    }
    
    // No context means fail
    if (!context || Object.keys(context).length === 0) {
      return false;
    }
    
    // Check each rule type
    if (rules.attributes && context.attributes) {
      for (const [attr, value] of Object.entries(rules.attributes)) {
        if (context.attributes[attr] !== value) {
          return false;
        }
      }
    }
    
    if (rules.version && context.version) {
      if (!this.compareVersions(context.version, rules.version.operator, rules.version.value)) {
        return false;
      }
    }
    
    if (rules.date) {
      const now = new Date();
      if (rules.date.after && now < new Date(rules.date.after)) {
        return false;
      }
      if (rules.date.before && now > new Date(rules.date.before)) {
        return false;
      }
    }
    
    if (rules.custom && typeof rules.custom === 'function') {
      try {
        if (!rules.custom(context)) {
          return false;
        }
      } catch (err) {
        console.error('Error evaluating custom rule:', err);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Compares versions
   * 
   * @param {string} version1 - First version
   * @param {string} operator - Comparison operator
   * @param {string} version2 - Second version
   * @returns {boolean} Comparison result
   * @private
   */
  compareVersions(version1, operator, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    // Pad arrays to equal length
    while (v1Parts.length < v2Parts.length) v1Parts.push(0);
    while (v2Parts.length < v1Parts.length) v2Parts.push(0);
    
    // Compare each part
    for (let i = 0; i < v1Parts.length; i++) {
      if (v1Parts[i] > v2Parts[i]) {
        return operator === '>' || operator === '>=' || operator === '!=';
      } else if (v1Parts[i] < v2Parts[i]) {
        return operator === '<' || operator === '<=' || operator === '!=';
      }
    }
    
    // If we get here, versions are equal
    return operator === '=' || operator === '>=' || operator === '<=';
  }

  /**
   * Gets the rollout percentage for a feature
   * 
   * @param {string} key - Feature flag key
   * @returns {number} Rollout percentage
   */
  getRolloutPercentage(key) {
    if (!key || !this.flags.has(key)) {
      return 0;
    }
    
    return this.flags.get(key).rolloutPercentage || 0;
  }

  /**
   * Sets the rollout percentage for a feature
   * 
   * @param {string} key - Feature flag key
   * @param {number} percentage - Rollout percentage (0-100)
   * @returns {boolean} Success status
   */
  setRolloutPercentage(key, percentage) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    
    return this.updateFlag(key, { rolloutPercentage: percentage });
  }

  /**
   * Enables a feature flag
   * 
   * @param {string} key - Feature flag key
   * @returns {boolean} Success status
   */
  enableFlag(key) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    return this.updateFlag(key, { enabled: true });
  }

  /**
   * Disables a feature flag
   * 
   * @param {string} key - Feature flag key
   * @returns {boolean} Success status
   */
  disableFlag(key) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    return this.updateFlag(key, { enabled: false });
  }

  /**
   * Gets feature flag evaluation statistics
   * 
   * @param {string} key - Feature flag key
   * @returns {Object} Evaluation statistics
   */
  getEvaluationStats(key) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    return { ...this.flags.get(key).evaluations };
  }

  /**
   * Resets feature flag evaluation statistics
   * 
   * @param {string} key - Feature flag key
   * @returns {boolean} Success status
   */
  resetEvaluationStats(key) {
    if (!key || !this.flags.has(key)) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const flag = this.flags.get(key);
    flag.evaluations = {
      total: 0,
      enabled: 0,
      disabled: 0
    };
    
    return true;
  }

  /**
   * Sets the analytics callback
   * 
   * @param {Function} callback - Analytics callback function
   * @returns {boolean} Success status
   */
  setAnalyticsCallback(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Analytics callback must be a function');
    }
    
    this.analyticsCallback = callback;
    return true;
  }

  /**
   * Tracks analytics for feature flag evaluation
   * 
   * @param {string} key - Feature flag key
   * @param {boolean} enabled - Whether the feature was enabled
   * @param {Object} context - Evaluation context
   * @private
   */
  trackAnalytics(key, enabled, context) {
    if (!this.analyticsCallback) {
      return;
    }
    
    try {
      this.analyticsCallback({
        key,
        enabled,
        context,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Error in analytics callback:', err);
    }
  }

  /**
   * Adds a feature flag event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {FeatureFlagManager} This feature flag manager for chaining
   */
  on(event, listener) {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Removes a feature flag event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   * @returns {FeatureFlagManager} This feature flag manager for chaining
   */
  off(event, listener) {
    this.eventEmitter.off(event, listener);
    return this;
  }

  /**
   * Enables caching of feature flag evaluations
   * 
   * @param {boolean} enabled - Whether caching is enabled
   * @param {number} ttl - Cache TTL in milliseconds
   * @returns {boolean} Success status
   */
  setCaching(enabled, ttl = 60000) {
    this.cacheEnabled = enabled;
    this.cacheTTL = ttl;
    
    if (!enabled) {
      this.evaluationCache.clear();
    }
    
    return true;
  }

  /**
   * Caches a feature flag evaluation result
   * 
   * @param {string} key - Feature flag key
   * @param {Object} context - Evaluation context
   * @param {boolean} result - Evaluation result
   * @private
   */
  cacheResult(key, context, result) {
    if (!this.cacheEnabled) {
      return;
    }
    
    const cacheKey = this.getCacheKey(key, context);
    this.evaluationCache.set(cacheKey, {
      result,
      expiry: Date.now() + this.cacheTTL
    });
  }

  /**
   * Clears the cache for a feature flag
   * 
   * @param {string} key - Feature flag key
   * @private
   */
  clearFlagCache(key) {
    if (!this.cacheEnabled) {
      return;
    }
    
    // Remove all cache entries for this flag
    for (const cacheKey of this.evaluationCache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.evaluationCache.delete(cacheKey);
      }
    }
  }

  /**
   * Gets a cache key for a feature flag evaluation
   * 
   * @param {string} key - Feature flag key
   * @param {Object} context - Evaluation context
   * @returns {string} Cache key
   * @private
   */
  getCacheKey(key, context) {
    const userId = context.userId || 'anonymous';
    const segments = context.segments ? (Array.isArray(context.segments) ? context.segments.join(',') : context.segments) : '';
    return `${key}:${userId}:${segments}`;
  }

  /**
   * Simple string hash function
   * 
   * @param {string} str - String to hash
   * @returns {number} Hash value
   * @private
   */
  hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex')
      .split('')
      .reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0) >>> 0;
  }

  /**
   * Serializes the feature flag manager to JSON
   * 
   * @returns {Object} Serialized feature flag manager
   */
  toJSON() {
    const flagsObj = {};
    for (const [key, flag] of this.flags.entries()) {
      flagsObj[key] = { ...flag };
    }
    
    return {
      flags: flagsObj,
      cacheEnabled: this.cacheEnabled,
      cacheTTL: this.cacheTTL
    };
  }

  /**
   * Creates a feature flag manager from JSON
   * 
   * @param {Object|string} json - JSON object or string
   * @param {Object} configManager - Configuration manager instance
   * @param {Function} analyticsCallback - Analytics callback function
   * @returns {FeatureFlagManager} Created feature flag manager
   * @static
   */
  static fromJSON(json, configManager, analyticsCallback) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    
    const manager = new FeatureFlagManager({
      configManager,
      analyticsCallback,
      cacheEnabled: parsed.cacheEnabled,
      cacheTTL: parsed.cacheTTL
    });
    
    // Add flags
    if (parsed.flags) {
      for (const [key, flag] of Object.entries(parsed.flags)) {
        manager.addFlag(key, flag);
      }
    }
    
    return manager;
  }
}

module.exports = FeatureFlagManager;
