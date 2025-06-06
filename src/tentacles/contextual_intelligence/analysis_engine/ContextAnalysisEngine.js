/**
 * @fileoverview Context Analysis Engine for the Contextual Intelligence Tentacle.
 * Analyzes context to extract insights, patterns, and predictions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { deepClone } = require('../../utils/object_utils');

/**
 * Analyzes context to extract insights, patterns, and predictions.
 */
class ContextAnalysisEngine {
  /**
   * Creates a new ContextAnalysisEngine instance.
   * @param {Object} options - Configuration options
   * @param {Map} [options.analysisModels] - Initial analysis models
   * @param {Map} [options.insightGenerators] - Initial insight generators
   * @param {Map} [options.patternDetectors] - Initial pattern detectors
   * @param {EventEmitter} [options.eventEmitter] - Event emitter for analysis events
   */
  constructor(options = {}) {
    this.analysisModels = options.analysisModels || new Map();
    this.insightGenerators = options.insightGenerators || new Map();
    this.patternDetectors = options.patternDetectors || new Map();
    this.eventEmitter = options.eventEmitter || new EventEmitter();
    this.analysisCache = new Map();
    this.maxCacheSize = options.maxCacheSize || 100;
    this.initialized = false;
    this.defaultAnalysisTypes = ['basic', 'patterns', 'insights', 'predictions'];
  }

  /**
   * Initializes the Context Analysis Engine.
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Register default analysis models
      this._registerDefaultModels();

      // Set up event listeners
      this._setupEventListeners();

      this.initialized = true;
      this.eventEmitter.emit('analysis:initialized');
      return true;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'initialize',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Registers default analysis models.
   * @private
   */
  _registerDefaultModels() {
    // Register basic analysis model
    this.registerAnalysisModel('basic', {
      analyze: (context) => {
        const result = {
          type: 'basic',
          summary: {},
          metadata: {}
        };

        // Extract basic metadata
        result.metadata.keys = Object.keys(context);
        result.metadata.depth = this._calculateObjectDepth(context);
        result.metadata.size = JSON.stringify(context).length;

        // Generate summary based on context type
        if (context._type) {
          result.summary.type = context._type;
        }

        if (context._createdAt) {
          result.summary.age = Date.now() - context._createdAt;
        }

        if (context._updatedAt) {
          result.summary.lastUpdate = Date.now() - context._updatedAt;
        }

        return result;
      }
    });

    // Register pattern detector
    this.registerPatternDetector('basic', {
      detect: (context, history) => {
        const patterns = [];

        // Detect patterns if history is available
        if (history && Array.isArray(history) && history.length > 1) {
          // Look for frequently changing properties
          const changeFrequency = this._calculateChangeFrequency(history);
          
          for (const [key, frequency] of Object.entries(changeFrequency)) {
            if (frequency > 0.5) { // Changed in more than 50% of updates
              patterns.push({
                type: 'frequent_change',
                property: key,
                frequency: frequency
              });
            }
          }

          // Look for cyclic patterns
          const cyclicPatterns = this._detectCyclicPatterns(history);
          patterns.push(...cyclicPatterns);
        }

        return patterns;
      }
    });

    // Register insight generator
    this.registerInsightGenerator('basic', {
      generate: (context, analysisResults) => {
        const insights = [];

        // Generate basic insights
        if (context._type === 'task') {
          insights.push({
            type: 'task_status',
            message: `Task context with ${Object.keys(context).length} properties`
          });
        }

        // Generate insights based on patterns
        if (analysisResults && analysisResults.patterns) {
          for (const pattern of analysisResults.patterns) {
            if (pattern.type === 'frequent_change') {
              insights.push({
                type: 'volatility',
                message: `Property "${pattern.property}" changes frequently (${Math.round(pattern.frequency * 100)}% of updates)`,
                importance: pattern.frequency
              });
            }
          }
        }

        return insights;
      }
    });

    // Register prediction model
    this.registerAnalysisModel('predictions', {
      analyze: (context, history) => {
        const predictions = [];

        // Make predictions if history is available
        if (history && Array.isArray(history) && history.length > 1) {
          // Predict future values based on trends
          const trends = this._calculateTrends(history);
          
          for (const [key, trend] of Object.entries(trends)) {
            if (trend.confidence > 0.7) { // Only include high-confidence predictions
              predictions.push({
                type: 'value_prediction',
                property: key,
                currentValue: this._getNestedProperty(context, key),
                predictedValue: trend.nextValue,
                confidence: trend.confidence
              });
            }
          }
        }

        return {
          type: 'predictions',
          predictions
        };
      }
    });
  }

  /**
   * Sets up event listeners for context events.
   * @private
   */
  _setupEventListeners() {
    // Listen for context updates to invalidate cache
    this.eventEmitter.on('context:updated', (event) => {
      const { path } = event;
      this._invalidateCache(path);
    });

    // Listen for context deletions to clean up cache
    this.eventEmitter.on('context:deleted', (event) => {
      const { path } = event;
      this._invalidateCache(path);
    });
  }

  /**
   * Invalidates cache entries for a path.
   * @param {string} path - The context path
   * @private
   */
  _invalidateCache(path) {
    // Remove all cache entries for this path
    for (const key of this.analysisCache.keys()) {
      if (key.startsWith(`${path}:`)) {
        this.analysisCache.delete(key);
      }
    }
  }

  /**
   * Calculates the depth of an object.
   * @param {Object} obj - The object to analyze
   * @param {number} [currentDepth=0] - The current depth
   * @returns {number} - The maximum depth
   * @private
   */
  _calculateObjectDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const depth = this._calculateObjectDepth(obj[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  /**
   * Calculates how frequently properties change across history.
   * @param {Array<Object>} history - Context history
   * @returns {Object} - Map of property paths to change frequencies
   * @private
   */
  _calculateChangeFrequency(history) {
    const changeCount = {};
    const totalUpdates = history.length - 1;

    if (totalUpdates <= 0) {
      return {};
    }

    // Compare each snapshot with the next one
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i].context;
      const next = history[i + 1].context;
      
      // Find all changed properties
      const changes = this._findChangedProperties(current, next);
      
      // Update change counts
      for (const property of changes) {
        changeCount[property] = (changeCount[property] || 0) + 1;
      }
    }

    // Convert counts to frequencies
    const frequencies = {};
    for (const [property, count] of Object.entries(changeCount)) {
      frequencies[property] = count / totalUpdates;
    }

    return frequencies;
  }

  /**
   * Finds properties that changed between two objects.
   * @param {Object} obj1 - First object
   * @param {Object} obj2 - Second object
   * @param {string} [prefix=''] - Property path prefix
   * @returns {Array<string>} - Array of changed property paths
   * @private
   */
  _findChangedProperties(obj1, obj2, prefix = '') {
    const changes = [];

    // Check all properties in obj1
    for (const key in obj1) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      // Skip metadata properties
      if (key.startsWith('_')) {
        continue;
      }
      
      if (!(key in obj2)) {
        // Property removed
        changes.push(path);
      } else if (typeof obj1[key] === 'object' && obj1[key] !== null && 
                 typeof obj2[key] === 'object' && obj2[key] !== null) {
        // Recursively check nested objects
        changes.push(...this._findChangedProperties(obj1[key], obj2[key], path));
      } else if (obj1[key] !== obj2[key]) {
        // Value changed
        changes.push(path);
      }
    }

    // Check for new properties in obj2
    for (const key in obj2) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      // Skip metadata properties
      if (key.startsWith('_')) {
        continue;
      }
      
      if (!(key in obj1)) {
        // Property added
        changes.push(path);
      }
    }

    return changes;
  }

  /**
   * Detects cyclic patterns in context history.
   * @param {Array<Object>} history - Context history
   * @returns {Array<Object>} - Array of detected patterns
   * @private
   */
  _detectCyclicPatterns(history) {
    const patterns = [];
    
    // Need at least 3 snapshots to detect cycles
    if (history.length < 3) {
      return patterns;
    }
    
    // This is a simplified implementation that looks for basic repeating values
    // A more sophisticated implementation would use time series analysis
    
    // Check numeric properties for cycles
    const propertyValues = {};
    
    // Extract values for each property across history
    for (const snapshot of history) {
      this._extractPropertyValues(snapshot.context, propertyValues);
    }
    
    // Analyze each property for cycles
    for (const [property, values] of Object.entries(propertyValues)) {
      if (values.length < 3 || !this._isNumericArray(values)) {
        continue;
      }
      
      // Check for simple oscillation patterns
      const oscillation = this._detectOscillation(values);
      if (oscillation) {
        patterns.push({
          type: 'oscillation',
          property,
          period: oscillation.period,
          amplitude: oscillation.amplitude,
          confidence: oscillation.confidence
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Extracts property values from a context object.
   * @param {Object} context - The context object
   * @param {Object} result - The result object to populate
   * @param {string} [prefix=''] - Property path prefix
   * @private
   */
  _extractPropertyValues(context, result, prefix = '') {
    for (const key in context) {
      // Skip metadata properties
      if (key.startsWith('_')) {
        continue;
      }
      
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (typeof context[key] === 'object' && context[key] !== null) {
        // Recursively extract from nested objects
        this._extractPropertyValues(context[key], result, path);
      } else {
        // Store value
        if (!result[path]) {
          result[path] = [];
        }
        result[path].push(context[key]);
      }
    }
  }
  
  /**
   * Checks if an array contains only numeric values.
   * @param {Array} arr - The array to check
   * @returns {boolean} - True if array contains only numbers
   * @private
   */
  _isNumericArray(arr) {
    return arr.every(value => typeof value === 'number' && !isNaN(value));
  }
  
  /**
   * Detects oscillation patterns in a numeric array.
   * @param {Array<number>} values - Array of numeric values
   * @returns {Object|null} - Oscillation pattern or null
   * @private
   */
  _detectOscillation(values) {
    // This is a simplified implementation
    // A more sophisticated implementation would use FFT or autocorrelation
    
    // Check for alternating increases and decreases
    let increases = 0;
    let decreases = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) {
        increases++;
      } else if (values[i] < values[i-1]) {
        decreases++;
      }
    }
    
    // If we have a good mix of increases and decreases, it might be oscillating
    if (increases > 0 && decreases > 0 && 
        Math.abs(increases - decreases) <= Math.max(1, Math.floor((increases + decreases) * 0.2))) {
      
      // Calculate amplitude
      const min = Math.min(...values);
      const max = Math.max(...values);
      const amplitude = max - min;
      
      // Estimate period (very simplified)
      let period = 2; // Default assumption
      
      // Calculate confidence based on regularity
      const confidence = Math.min(0.5 + (Math.min(increases, decreases) / Math.max(increases, decreases)) * 0.5, 0.9);
      
      return {
        period,
        amplitude,
        confidence
      };
    }
    
    return null;
  }
  
  /**
   * Calculates trends for properties in context history.
   * @param {Array<Object>} history - Context history
   * @returns {Object} - Map of property paths to trend information
   * @private
   */
  _calculateTrends(history) {
    const trends = {};
    
    // Need at least 2 snapshots to calculate trends
    if (history.length < 2) {
      return trends;
    }
    
    // Extract numeric property values
    const propertyValues = {};
    
    // Extract values for each property across history
    for (const snapshot of history) {
      this._extractPropertyValues(snapshot.context, propertyValues);
    }
    
    // Calculate trend for each numeric property
    for (const [property, values] of Object.entries(propertyValues)) {
      if (!this._isNumericArray(values)) {
        continue;
      }
      
      // Calculate linear regression
      const regression = this._calculateLinearRegression(values);
      
      if (regression) {
        // Predict next value
        const nextIndex = values.length;
        const nextValue = regression.slope * nextIndex + regression.intercept;
        
        trends[property] = {
          slope: regression.slope,
          intercept: regression.intercept,
          r2: regression.r2,
          nextValue,
          confidence: Math.min(regression.r2, 0.95) // Cap confidence at 95%
        };
      }
    }
    
    return trends;
  }
  
  /**
   * Calculates linear regression for an array of values.
   * @param {Array<number>} values - Array of numeric values
   * @returns {Object|null} - Regression parameters or null
   * @private
   */
  _calculateLinearRegression(values) {
    // Need at least 2 points for regression
    if (values.length < 2) {
      return null;
    }
    
    // Calculate means
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    
    for (let i = 0; i < values.length; i++) {
      const x = i;
      const y = values[i];
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }
    
    const n = values.length;
    
    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const meanY = sumY / n;
    let totalVariation = 0;
    let explainedVariation = 0;
    
    for (let i = 0; i < values.length; i++) {
      const x = i;
      const y = values[i];
      const predicted = slope * x + intercept;
      
      totalVariation += Math.pow(y - meanY, 2);
      explainedVariation += Math.pow(predicted - meanY, 2);
    }
    
    const r2 = explainedVariation / totalVariation;
    
    return {
      slope,
      intercept,
      r2
    };
  }
  
  /**
   * Gets a nested property from an object by path.
   * @param {Object} obj - The object
   * @param {string} path - The property path
   * @returns {*} - The property value or undefined
   * @private
   */
  _getNestedProperty(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Registers an analysis model.
   * @param {string} type - The type of analysis
   * @param {Object} model - The analysis model
   * @param {Function} model.analyze - Function that performs the analysis
   * @returns {boolean} - True if registration was successful
   */
  registerAnalysisModel(type, model) {
    try {
      if (!type || typeof type !== 'string') {
        throw new Error('Analysis type must be a non-empty string');
      }

      if (!model || typeof model !== 'object') {
        throw new Error('Analysis model must be an object');
      }

      if (typeof model.analyze !== 'function') {
        throw new Error('Analysis model must have an analyze function');
      }

      this.analysisModels.set(type, model);

      this.eventEmitter.emit('analysis:model:registered', {
        type
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'registerAnalysisModel',
        type,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Registers a pattern detector.
   * @param {string} type - The type of pattern detector
   * @param {Object} detector - The pattern detector
   * @param {Function} detector.detect - Function that detects patterns
   * @returns {boolean} - True if registration was successful
   */
  registerPatternDetector(type, detector) {
    try {
      if (!type || typeof type !== 'string') {
        throw new Error('Detector type must be a non-empty string');
      }

      if (!detector || typeof detector !== 'object') {
        throw new Error('Pattern detector must be an object');
      }

      if (typeof detector.detect !== 'function') {
        throw new Error('Pattern detector must have a detect function');
      }

      this.patternDetectors.set(type, detector);

      this.eventEmitter.emit('analysis:detector:registered', {
        type
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'registerPatternDetector',
        type,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Registers an insight generator.
   * @param {string} type - The type of insight generator
   * @param {Object} generator - The insight generator
   * @param {Function} generator.generate - Function that generates insights
   * @returns {boolean} - True if registration was successful
   */
  registerInsightGenerator(type, generator) {
    try {
      if (!type || typeof type !== 'string') {
        throw new Error('Generator type must be a non-empty string');
      }

      if (!generator || typeof generator !== 'object') {
        throw new Error('Insight generator must be an object');
      }

      if (typeof generator.generate !== 'function') {
        throw new Error('Insight generator must have a generate function');
      }

      this.insightGenerators.set(type, generator);

      this.eventEmitter.emit('analysis:generator:registered', {
        type
      });

      return true;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'registerInsightGenerator',
        type,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Analyzes a context.
   * @param {Object} context - The context to analyze
   * @param {Array<string>} [analysisTypes] - Types of analysis to perform
   * @param {Object} [options] - Analysis options
   * @param {boolean} [options.useCache=true] - Whether to use cached results
   * @param {boolean} [options.includeHistory=true] - Whether to include historical analysis
   * @param {number} [options.historyLimit=10] - Maximum number of historical snapshots to analyze
   * @returns {Promise<Object>} - Promise resolving to analysis results
   */
  async analyzeContext(context, analysisTypes, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!context || typeof context !== 'object') {
        throw new Error('Context must be an object');
      }

      // Use default analysis types if not specified
      const types = analysisTypes || this.defaultAnalysisTypes;
      
      // Set default options
      const useCache = options.useCache !== undefined ? options.useCache : true;
      const includeHistory = options.includeHistory !== undefined ? options.includeHistory : true;
      const historyLimit = options.historyLimit || 10;

      // Generate cache key
      const contextId = context._id || JSON.stringify(context);
      const cacheKey = `${contextId}:${types.join(',')}:${includeHistory}:${historyLimit}`;

      // Check cache
      if (useCache && this.analysisCache.has(cacheKey)) {
        return deepClone(this.analysisCache.get(cacheKey));
      }

      // Get context history if needed
      let history = null;
      if (includeHistory && context._path) {
        history = await this._getContextHistory(context._path, historyLimit);
      }

      // Initialize results
      const results = {
        timestamp: Date.now(),
        analysisTypes: types,
        results: {}
      };

      // Perform each type of analysis
      for (const type of types) {
        if (type === 'patterns') {
          results.results.patterns = await this.detectPatterns(context, history);
        } else if (type === 'insights') {
          // Insights depend on other analysis results
          const analysisForInsights = { ...results.results };
          results.results.insights = await this.generateInsights(context, analysisForInsights, history);
        } else {
          // Use registered analysis model
          if (this.analysisModels.has(type)) {
            const model = this.analysisModels.get(type);
            results.results[type] = await model.analyze(context, history);
          }
        }
      }

      // Cache results
      if (useCache) {
        this._updateCache(cacheKey, results);
      }

      // Emit analysis event
      this.eventEmitter.emit('analysis:completed', {
        contextId,
        analysisTypes: types,
        timestamp: results.timestamp
      });

      return deepClone(results);
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'analyzeContext',
        error: error.message
      });
      return {
        timestamp: Date.now(),
        error: error.message,
        results: {}
      };
    }
  }

  /**
   * Gets context history.
   * @param {string} path - The context path
   * @param {number} limit - Maximum number of snapshots
   * @returns {Promise<Array<Object>|null>} - Promise resolving to history or null
   * @private
   */
  async _getContextHistory(path, limit) {
    try {
      // Emit event to request history
      this.eventEmitter.emit('analysis:history:request', { path, limit });

      // Wait for response or timeout
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.eventEmitter.removeListener('analysis:history:response', handleResponse);
          resolve(null);
        }, 1000);

        const handleResponse = (response) => {
          if (response.path === path) {
            clearTimeout(timeout);
            this.eventEmitter.removeListener('analysis:history:response', handleResponse);
            resolve(response.history);
          }
        };

        this.eventEmitter.on('analysis:history:response', handleResponse);
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Updates the analysis cache.
   * @param {string} key - The cache key
   * @param {Object} results - The analysis results
   * @private
   */
  _updateCache(key, results) {
    // Add to cache
    this.analysisCache.set(key, deepClone(results));

    // Trim cache if it exceeds max size
    if (this.analysisCache.size > this.maxCacheSize) {
      // Remove oldest entries
      const entriesToRemove = this.analysisCache.size - this.maxCacheSize;
      const entries = Array.from(this.analysisCache.entries());
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest entries
      for (let i = 0; i < entriesToRemove; i++) {
        this.analysisCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Detects patterns in a context.
   * @param {Object} context - The context to analyze
   * @param {Array<Object>} [history] - Context history
   * @returns {Promise<Array<Object>>} - Promise resolving to detected patterns
   */
  async detectPatterns(context, history) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!context || typeof context !== 'object') {
        throw new Error('Context must be an object');
      }

      const patterns = [];

      // Apply each registered pattern detector
      for (const [type, detector] of this.patternDetectors.entries()) {
        try {
          const detectedPatterns = await detector.detect(context, history);
          
          if (detectedPatterns && Array.isArray(detectedPatterns)) {
            patterns.push(...detectedPatterns);
          }
        } catch (error) {
          this.eventEmitter.emit('analysis:warning', {
            operation: 'detectPatterns',
            detector: type,
            error: error.message
          });
        }
      }

      return patterns;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'detectPatterns',
        error: error.message
      });
      return [];
    }
  }

  /**
   * Generates insights from a context and analysis results.
   * @param {Object} context - The context to analyze
   * @param {Object} analysisResults - Previous analysis results
   * @param {Array<Object>} [history] - Context history
   * @returns {Promise<Array<Object>>} - Promise resolving to generated insights
   */
  async generateInsights(context, analysisResults, history) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!context || typeof context !== 'object') {
        throw new Error('Context must be an object');
      }

      const insights = [];

      // Apply each registered insight generator
      for (const [type, generator] of this.insightGenerators.entries()) {
        try {
          const generatedInsights = await generator.generate(context, analysisResults, history);
          
          if (generatedInsights && Array.isArray(generatedInsights)) {
            insights.push(...generatedInsights);
          }
        } catch (error) {
          this.eventEmitter.emit('analysis:warning', {
            operation: 'generateInsights',
            generator: type,
            error: error.message
          });
        }
      }

      // Sort insights by importance (if available)
      insights.sort((a, b) => {
        const importanceA = a.importance !== undefined ? a.importance : 0;
        const importanceB = b.importance !== undefined ? b.importance : 0;
        return importanceB - importanceA;
      });

      return insights;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'generateInsights',
        error: error.message
      });
      return [];
    }
  }

  /**
   * Gets available analysis types.
   * @returns {Promise<Array<string>>} - Promise resolving to array of analysis types
   */
  async getAvailableAnalysisTypes() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const types = new Set([...this.analysisModels.keys()]);
      
      // Add special types
      types.add('patterns');
      types.add('insights');

      return Array.from(types);
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'getAvailableAnalysisTypes',
        error: error.message
      });
      return [];
    }
  }

  /**
   * Clears the analysis cache.
   * @returns {Promise<boolean>} - Promise resolving to true if cache was cleared
   */
  async clearCache() {
    try {
      this.analysisCache.clear();
      
      this.eventEmitter.emit('analysis:cache:cleared');
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'clearCache',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Shuts down the Context Analysis Engine.
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    try {
      if (!this.initialized) {
        return true;
      }

      // Clear cache
      this.analysisCache.clear();

      this.initialized = false;
      this.eventEmitter.emit('analysis:shutdown');
      
      return true;
    } catch (error) {
      this.eventEmitter.emit('analysis:error', {
        operation: 'shutdown',
        error: error.message
      });
      return false;
    }
  }
}

module.exports = ContextAnalysisEngine;
