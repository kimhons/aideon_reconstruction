/**
 * @fileoverview Statistical Analyzer for the Data Analyzer component
 * 
 * This component is responsible for performing statistical analysis on data
 * to extract insights that inform the decision-making process.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');

/**
 * Statistical Analyzer for the Data Analyzer component
 */
class StatisticalAnalyzer {
  /**
   * Creates a new instance of the Statistical Analyzer
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.aideon = aideon;
    this.logger = new Logger('StatisticalAnalyzer');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      defaultConfidenceLevel: config.defaultConfidenceLevel || 0.95,
      maxSampleSize: config.maxSampleSize || 10000
    };
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.analyze = this.analyze.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Statistical Analyzer
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Statistical Analyzer');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      this.initialized = true;
      this.logger.info('Statistical Analyzer initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'statisticalAnalyzer' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('statisticalAnalyzer');
      
      if (config) {
        this.config.defaultConfidenceLevel = config.get('defaultConfidenceLevel') || this.config.defaultConfidenceLevel;
        this.config.maxSampleSize = config.get('maxSampleSize') || this.config.maxSampleSize;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Shuts down the Statistical Analyzer
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Statistical Analyzer');
    
    try {
      this.initialized = false;
      this.logger.info('Statistical Analyzer shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'statisticalAnalyzer' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Statistical Analyzer
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config
    };
  }
  
  /**
   * Analyzes data statistically
   * @param {Object} data The data to analyze
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} A promise that resolves with the analysis result
   */
  async analyze(data, options = {}) {
    if (!this.initialized) {
      throw new Error('Statistical Analyzer not initialized');
    }
    
    if (!data) {
      throw new Error('Data is required');
    }
    
    this.logger.info('Analyzing data statistically', {
      dataType: data.type,
      itemCount: data.items?.length || 0
    });
    
    try {
      // Determine analysis strategy based on data type
      let result;
      switch (data.type) {
        case 'options':
          result = await this._analyzeOptions(data, options);
          break;
        case 'array':
          result = await this._analyzeArray(data, options);
          break;
        case 'object':
          result = await this._analyzeObject(data, options);
          break;
        default:
          throw new Error(`Unsupported data type: ${data.type}`);
      }
      
      this.logger.info('Statistical analysis complete');
      
      return result;
    } catch (error) {
      this.logger.error('Statistical analysis failed', error);
      throw error;
    }
  }
  
  /**
   * Analyzes options data
   * @private
   * @param {Object} data The options data
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} A promise that resolves with the analysis result
   */
  async _analyzeOptions(data, options) {
    this.logger.info('Analyzing options data');
    
    // Extract numeric attributes from options
    const numericAttributes = this._extractNumericAttributes(data.items);
    
    // Calculate statistics for each numeric attribute
    const attributeStats = {};
    for (const [attribute, values] of Object.entries(numericAttributes)) {
      attributeStats[attribute] = this._calculateStatistics(values);
    }
    
    // Calculate correlations between attributes
    const correlations = this._calculateCorrelations(numericAttributes);
    
    // Calculate rankings for each attribute
    const rankings = this._calculateRankings(data.items, numericAttributes);
    
    return {
      summary: {
        optionCount: data.items.length,
        attributeCount: Object.keys(numericAttributes).length
      },
      attributeStats,
      correlations,
      rankings
    };
  }
  
  /**
   * Analyzes array data
   * @private
   * @param {Object} data The array data
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} A promise that resolves with the analysis result
   */
  async _analyzeArray(data, options) {
    this.logger.info('Analyzing array data');
    
    // Extract numeric values
    const numericValues = data.items
      .map(item => item.value)
      .filter(value => typeof value === 'number' && !isNaN(value));
    
    // Calculate statistics
    const statistics = this._calculateStatistics(numericValues);
    
    // Calculate distribution
    const distribution = this._calculateDistribution(numericValues);
    
    return {
      summary: {
        itemCount: data.items.length,
        numericCount: numericValues.length,
        ...statistics
      },
      distribution
    };
  }
  
  /**
   * Analyzes object data
   * @private
   * @param {Object} data The object data
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} A promise that resolves with the analysis result
   */
  async _analyzeObject(data, options) {
    this.logger.info('Analyzing object data');
    
    // Extract numeric attributes
    const numericAttributes = {};
    for (const [key, value] of Object.entries(data.attributes)) {
      if (typeof value === 'number' && !isNaN(value)) {
        numericAttributes[key] = value;
      }
    }
    
    return {
      summary: {
        attributeCount: Object.keys(data.attributes).length,
        numericCount: Object.keys(numericAttributes).length
      },
      numericAttributes
    };
  }
  
  /**
   * Extracts numeric attributes from options
   * @private
   * @param {Array} items The options items
   * @returns {Object} The extracted numeric attributes
   */
  _extractNumericAttributes(items) {
    const attributes = {};
    
    // Iterate through items
    for (const item of items) {
      // Iterate through attributes
      for (const [key, value] of Object.entries(item.attributes)) {
        // Check if attribute is numeric
        if (typeof value === 'number' && !isNaN(value)) {
          // Initialize array if not exists
          if (!attributes[key]) {
            attributes[key] = [];
          }
          
          // Add value to array
          attributes[key].push(value);
        }
      }
    }
    
    return attributes;
  }
  
  /**
   * Calculates basic statistics for an array of values
   * @private
   * @param {Array} values The values to calculate statistics for
   * @returns {Object} The calculated statistics
   */
  _calculateStatistics(values) {
    if (!values || values.length === 0) {
      return {
        count: 0,
        mean: null,
        median: null,
        min: null,
        max: null,
        range: null,
        standardDeviation: null,
        variance: null
      };
    }
    
    // Sort values for percentile calculations
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate mean
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    
    // Calculate median
    const median = this._calculateMedian(sortedValues);
    
    // Calculate min and max
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    
    // Calculate variance and standard deviation
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      count: values.length,
      mean,
      median,
      min,
      max,
      range: max - min,
      standardDeviation,
      variance
    };
  }
  
  /**
   * Calculates the median of an array of values
   * @private
   * @param {Array} sortedValues The sorted values
   * @returns {number} The median
   */
  _calculateMedian(sortedValues) {
    const mid = Math.floor(sortedValues.length / 2);
    
    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
      return sortedValues[mid];
    }
  }
  
  /**
   * Calculates the distribution of values
   * @private
   * @param {Array} values The values
   * @returns {Object} The distribution
   */
  _calculateDistribution(values) {
    if (!values || values.length === 0) {
      return {
        bins: [],
        binSize: 0
      };
    }
    
    // Determine bin count (Sturges' formula)
    const binCount = Math.ceil(Math.log2(values.length)) + 1;
    
    // Calculate min and max
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate bin size
    const binSize = (max - min) / binCount;
    
    // Initialize bins
    const bins = Array(binCount).fill(0).map((_, i) => ({
      start: min + i * binSize,
      end: min + (i + 1) * binSize,
      count: 0
    }));
    
    // Count values in each bin
    for (const value of values) {
      const binIndex = Math.min(
        Math.floor((value - min) / binSize),
        binCount - 1
      );
      bins[binIndex].count++;
    }
    
    return {
      bins,
      binSize
    };
  }
  
  /**
   * Calculates correlations between attributes
   * @private
   * @param {Object} attributes The attributes
   * @returns {Object} The correlations
   */
  _calculateCorrelations(attributes) {
    const correlations = {};
    const attributeNames = Object.keys(attributes);
    
    // Calculate correlations for each pair of attributes
    for (let i = 0; i < attributeNames.length; i++) {
      const attr1 = attributeNames[i];
      correlations[attr1] = {};
      
      for (let j = 0; j < attributeNames.length; j++) {
        const attr2 = attributeNames[j];
        
        if (i === j) {
          // Correlation with self is always 1
          correlations[attr1][attr2] = 1;
        } else if (j > i) {
          // Calculate correlation
          correlations[attr1][attr2] = this._calculatePearsonCorrelation(
            attributes[attr1],
            attributes[attr2]
          );
        } else {
          // Use previously calculated correlation
          correlations[attr1][attr2] = correlations[attr2][attr1];
        }
      }
    }
    
    return correlations;
  }
  
  /**
   * Calculates the Pearson correlation coefficient between two arrays
   * @private
   * @param {Array} x The first array
   * @param {Array} y The second array
   * @returns {number} The correlation coefficient
   */
  _calculatePearsonCorrelation(x, y) {
    // Ensure arrays are of the same length
    const n = Math.min(x.length, y.length);
    
    if (n === 0) {
      return 0;
    }
    
    // Calculate means
    const xMean = x.slice(0, n).reduce((acc, val) => acc + val, 0) / n;
    const yMean = y.slice(0, n).reduce((acc, val) => acc + val, 0) / n;
    
    // Calculate correlation
    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(xDenominator * yDenominator);
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  /**
   * Calculates rankings for each attribute
   * @private
   * @param {Array} items The items
   * @param {Object} numericAttributes The numeric attributes
   * @returns {Object} The rankings
   */
  _calculateRankings(items, numericAttributes) {
    const rankings = {};
    
    // Calculate rankings for each attribute
    for (const [attribute, values] of Object.entries(numericAttributes)) {
      // Create array of items with their values
      const itemValues = items.map((item, index) => ({
        id: item.id,
        value: item.attributes[attribute]
      })).filter(item => typeof item.value === 'number' && !isNaN(item.value));
      
      // Sort by value (descending)
      itemValues.sort((a, b) => b.value - a.value);
      
      // Assign ranks
      rankings[attribute] = itemValues.map((item, index) => ({
        id: item.id,
        value: item.value,
        rank: index + 1
      }));
    }
    
    return rankings;
  }
}

module.exports = { StatisticalAnalyzer };
