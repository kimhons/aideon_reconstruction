/**
 * @fileoverview Data Analyzer component for the Decision Intelligence Tentacle
 * 
 * This component is responsible for collecting, processing, and analyzing data
 * relevant to decision-making. It supports various data sources and formats,
 * and provides insights that inform the decision-making process.
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const { DataSourceManager } = require('./DataSourceManager');
const { StatisticalAnalyzer } = require('./StatisticalAnalyzer');
const { PatternRecognizer } = require('./PatternRecognizer');
const { UncertaintyEstimator } = require('./UncertaintyEstimator');

/**
 * Data Analyzer component for the Decision Intelligence Tentacle
 */
class DataAnalyzer {
  /**
   * Creates a new instance of the Data Analyzer
   * @param {Object} aideon Reference to the Aideon core system
   */
  constructor(aideon) {
    this.aideon = aideon;
    this.logger = new Logger('DataAnalyzer');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Sub-components
    this.dataSourceManager = null;
    this.statisticalAnalyzer = null;
    this.patternRecognizer = null;
    this.uncertaintyEstimator = null;
    
    // Configuration
    this.config = {
      maxDataSize: 100000,
      defaultConfidenceLevel: 0.95,
      supportedDataSources: ['csv', 'json', 'database', 'api']
    };
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.analyzeData = this.analyzeData.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.registerApiEndpoints = this.registerApiEndpoints.bind(this);
  }
  
  /**
   * Initializes the Data Analyzer and its sub-components
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Data Analyzer');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Initialize sub-components
      this.dataSourceManager = new DataSourceManager(this.aideon, this.config);
      this.statisticalAnalyzer = new StatisticalAnalyzer(this.aideon, this.config);
      this.patternRecognizer = new PatternRecognizer(this.aideon, this.config);
      this.uncertaintyEstimator = new UncertaintyEstimator(this.aideon, this.config);
      
      // Initialize sub-components in parallel
      await Promise.all([
        this.dataSourceManager.initialize(),
        this.statisticalAnalyzer.initialize(),
        this.patternRecognizer.initialize(),
        this.uncertaintyEstimator.initialize()
      ]);
      
      this.initialized = true;
      this.logger.info('Data Analyzer initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'dataAnalyzer' });
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
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('dataAnalyzer');
      
      if (config) {
        this.config.maxDataSize = config.get('maxDataSize') || this.config.maxDataSize;
        this.config.defaultConfidenceLevel = config.get('defaultConfidenceLevel') || this.config.defaultConfidenceLevel;
        this.config.supportedDataSources = config.get('supportedDataSources') || this.config.supportedDataSources;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Shuts down the Data Analyzer and its sub-components
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Data Analyzer');
    
    try {
      // Shut down sub-components in parallel
      await Promise.all([
        this.dataSourceManager.shutdown(),
        this.statisticalAnalyzer.shutdown(),
        this.patternRecognizer.shutdown(),
        this.uncertaintyEstimator.shutdown()
      ]);
      
      this.initialized = false;
      this.logger.info('Data Analyzer shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'dataAnalyzer' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Data Analyzer
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      subComponents: {
        dataSourceManager: this.dataSourceManager ? this.dataSourceManager.getStatus() : { initialized: false },
        statisticalAnalyzer: this.statisticalAnalyzer ? this.statisticalAnalyzer.getStatus() : { initialized: false },
        patternRecognizer: this.patternRecognizer ? this.patternRecognizer.getStatus() : { initialized: false },
        uncertaintyEstimator: this.uncertaintyEstimator ? this.uncertaintyEstimator.getStatus() : { initialized: false }
      }
    };
  }
  
  /**
   * Registers API endpoints for the Data Analyzer
   * @param {Object} api The API service
   * @param {string} tentacleName The name of the parent tentacle
   */
  registerApiEndpoints(api, tentacleName) {
    if (!api) {
      this.logger.warn('API service not available, skipping endpoint registration');
      return;
    }
    
    this.logger.info('Registering API endpoints');
    
    // Register endpoints
    api.register(`${tentacleName}/data/analyze`, this.analyzeData);
    api.register(`${tentacleName}/data/sources`, this.dataSourceManager.manageSources);
    api.register(`${tentacleName}/data/insights`, this.getInsights);
    
    this.logger.info('API endpoints registered successfully');
  }
  
  /**
   * Analyzes data for decision-making
   * @param {Object} data The data to analyze
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} A promise that resolves with the analysis result
   */
  async analyzeData(data, options = {}) {
    if (!this.initialized) {
      throw new Error('Data Analyzer not initialized');
    }
    
    if (!data) {
      throw new Error('Data is required');
    }
    
    this.logger.info('Analyzing data', { 
      dataSize: this._estimateDataSize(data),
      decisionType: options.decisionType || 'unknown',
      framework: options.framework || 'unknown'
    });
    
    // Track analysis start
    this.events.emit('data:analysis:start', { 
      decisionType: options.decisionType,
      framework: options.framework
    });
    
    try {
      // Validate data size
      this._validateDataSize(data);
      
      // Prepare data
      const preparedData = await this._prepareData(data, options);
      
      // Perform statistical analysis
      const statisticalResults = await this.statisticalAnalyzer.analyze(preparedData, options);
      
      // Recognize patterns
      const patternResults = await this.patternRecognizer.analyze(preparedData, options);
      
      // Estimate uncertainty
      const uncertaintyResults = await this.uncertaintyEstimator.analyze(preparedData, {
        ...options,
        statisticalResults,
        patternResults
      });
      
      // Combine results
      const analysisResult = {
        statistics: statisticalResults,
        patterns: patternResults,
        uncertainty: uncertaintyResults,
        insights: this._generateInsights(statisticalResults, patternResults, uncertaintyResults),
        metadata: {
          timestamp: Date.now(),
          decisionType: options.decisionType,
          framework: options.framework
        }
      };
      
      // Track analysis completion
      this.events.emit('data:analysis:complete', { 
        decisionType: options.decisionType,
        framework: options.framework,
        success: true
      });
      
      this.logger.info('Data analysis complete');
      
      return analysisResult;
    } catch (error) {
      // Track analysis error
      this.events.emit('data:analysis:error', { 
        decisionType: options.decisionType,
        framework: options.framework,
        error: error.message
      });
      
      this.logger.error('Data analysis failed', error);
      throw error;
    }
  }
  
  /**
   * Gets insights from previously analyzed data
   * @param {Object} params Parameters for retrieving insights
   * @returns {Promise<Object>} A promise that resolves with the insights
   */
  async getInsights(params) {
    if (!this.initialized) {
      throw new Error('Data Analyzer not initialized');
    }
    
    this.logger.info('Getting insights', params);
    
    try {
      // Retrieve insights based on parameters
      const insights = await this._retrieveInsights(params);
      
      return {
        success: true,
        insights
      };
    } catch (error) {
      this.logger.error('Failed to get insights', error);
      throw error;
    }
  }
  
  /**
   * Prepares data for analysis
   * @private
   * @param {Object} data The data to prepare
   * @param {Object} options Preparation options
   * @returns {Promise<Object>} A promise that resolves with the prepared data
   */
  async _prepareData(data, options) {
    this.logger.info('Preparing data for analysis');
    
    // Handle different data formats
    if (data.source) {
      // Data from external source
      return this.dataSourceManager.fetchData(data.source, options);
    } else if (data.options) {
      // Decision options data
      return this._prepareOptionsData(data.options, options);
    } else if (Array.isArray(data)) {
      // Array data
      return this._prepareArrayData(data, options);
    } else {
      // Object data
      return this._prepareObjectData(data, options);
    }
  }
  
  /**
   * Prepares options data for analysis
   * @private
   * @param {Object} options The options data
   * @param {Object} analysisOptions Analysis options
   * @returns {Object} The prepared options data
   */
  _prepareOptionsData(options, analysisOptions) {
    // Convert options to a format suitable for analysis
    const preparedData = {
      type: 'options',
      items: []
    };
    
    // Handle different option formats
    if (Array.isArray(options)) {
      // Array of options
      preparedData.items = options.map((option, index) => ({
        id: option.id || `option-${index}`,
        attributes: this._extractAttributes(option)
      }));
    } else {
      // Object with named options
      preparedData.items = Object.entries(options).map(([key, value]) => ({
        id: key,
        attributes: this._extractAttributes(value)
      }));
    }
    
    return preparedData;
  }
  
  /**
   * Prepares array data for analysis
   * @private
   * @param {Array} array The array data
   * @param {Object} options Analysis options
   * @returns {Object} The prepared array data
   */
  _prepareArrayData(array, options) {
    return {
      type: 'array',
      items: array.map((item, index) => ({
        id: `item-${index}`,
        value: item
      }))
    };
  }
  
  /**
   * Prepares object data for analysis
   * @private
   * @param {Object} object The object data
   * @param {Object} options Analysis options
   * @returns {Object} The prepared object data
   */
  _prepareObjectData(object, options) {
    return {
      type: 'object',
      attributes: this._extractAttributes(object)
    };
  }
  
  /**
   * Extracts attributes from an object
   * @private
   * @param {Object} object The object to extract attributes from
   * @returns {Object} The extracted attributes
   */
  _extractAttributes(object) {
    const attributes = {};
    
    // Extract primitive values and arrays
    for (const [key, value] of Object.entries(object)) {
      if (value === null || value === undefined) {
        attributes[key] = null;
      } else if (typeof value !== 'object' || Array.isArray(value)) {
        attributes[key] = value;
      } else if (typeof value === 'object') {
        // For nested objects, extract as a separate attribute set
        attributes[key] = this._extractAttributes(value);
      }
    }
    
    return attributes;
  }
  
  /**
   * Estimates the size of data in memory
   * @private
   * @param {*} data The data to estimate size for
   * @returns {number} The estimated size in bytes
   */
  _estimateDataSize(data) {
    if (data === null || data === undefined) {
      return 0;
    }
    
    const type = typeof data;
    
    if (type === 'boolean') {
      return 4;
    }
    
    if (type === 'number') {
      return 8;
    }
    
    if (type === 'string') {
      return data.length * 2;
    }
    
    if (Array.isArray(data)) {
      return data.reduce((size, item) => size + this._estimateDataSize(item), 0);
    }
    
    if (type === 'object') {
      return Object.entries(data).reduce((size, [key, value]) => {
        return size + key.length * 2 + this._estimateDataSize(value);
      }, 0);
    }
    
    return 0;
  }
  
  /**
   * Validates that the data size is within limits
   * @private
   * @param {*} data The data to validate
   * @throws {Error} If the data size exceeds the limit
   */
  _validateDataSize(data) {
    const size = this._estimateDataSize(data);
    
    if (size > this.config.maxDataSize) {
      throw new Error(`Data size (${size} bytes) exceeds the maximum allowed size (${this.config.maxDataSize} bytes)`);
    }
  }
  
  /**
   * Generates insights from analysis results
   * @private
   * @param {Object} statisticalResults Statistical analysis results
   * @param {Object} patternResults Pattern recognition results
   * @param {Object} uncertaintyResults Uncertainty estimation results
   * @returns {Array} Generated insights
   */
  _generateInsights(statisticalResults, patternResults, uncertaintyResults) {
    const insights = [];
    
    // Generate insights from statistical results
    if (statisticalResults && statisticalResults.summary) {
      // Add insights about central tendencies
      if (statisticalResults.summary.mean !== undefined) {
        insights.push({
          type: 'statistical',
          category: 'central_tendency',
          description: `The average value is ${statisticalResults.summary.mean.toFixed(2)}`,
          confidence: this.config.defaultConfidenceLevel,
          source: 'statistical_analysis'
        });
      }
      
      // Add insights about variability
      if (statisticalResults.summary.standardDeviation !== undefined) {
        insights.push({
          type: 'statistical',
          category: 'variability',
          description: `The standard deviation is ${statisticalResults.summary.standardDeviation.toFixed(2)}`,
          confidence: this.config.defaultConfidenceLevel,
          source: 'statistical_analysis'
        });
      }
    }
    
    // Generate insights from pattern results
    if (patternResults && patternResults.patterns) {
      patternResults.patterns.forEach(pattern => {
        insights.push({
          type: 'pattern',
          category: pattern.type,
          description: pattern.description,
          confidence: pattern.confidence,
          source: 'pattern_recognition'
        });
      });
    }
    
    // Generate insights from uncertainty results
    if (uncertaintyResults && uncertaintyResults.uncertainties) {
      uncertaintyResults.uncertainties.forEach(uncertainty => {
        insights.push({
          type: 'uncertainty',
          category: uncertainty.type,
          description: uncertainty.description,
          confidence: 1 - uncertainty.level,
          source: 'uncertainty_estimation'
        });
      });
    }
    
    return insights;
  }
  
  /**
   * Retrieves insights based on parameters
   * @private
   * @param {Object} params Parameters for retrieving insights
   * @returns {Promise<Array>} A promise that resolves with the retrieved insights
   */
  async _retrieveInsights(params) {
    // Implementation depends on how insights are stored and retrieved
    // This is a placeholder implementation
    return [];
  }
}

module.exports = { DataAnalyzer };
