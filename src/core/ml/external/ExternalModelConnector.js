/**
 * @fileoverview ExternalModelConnector provides a base class for connecting to external
 * API-based models from providers like OpenAI, Anthropic, Google, etc.
 * 
 * @module core/ml/external/ExternalModelConnector
 * @requires core/utils/Logger
 */

const { EventEmitter } = require('events');
const logger = require('../../utils/Logger').getLogger('ExternalModelConnector');

/**
 * @class ExternalModelConnector
 * @extends EventEmitter
 * @description Base class for external model API connectors
 */
class ExternalModelConnector extends EventEmitter {
  /**
   * Creates an instance of ExternalModelConnector
   * @param {Object} options - Configuration options
   * @param {string} options.provider - Provider name
   * @param {string} options.apiKey - API key for authentication
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Object} options.defaultHeaders - Default headers for API requests
   * @param {number} options.timeout - Timeout for API requests in milliseconds
   * @param {boolean} options.debug - Whether to enable debug logging
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      provider: 'unknown',
      apiKey: null,
      baseUrl: null,
      defaultHeaders: {},
      timeout: 30000, // 30 seconds
      debug: false,
      ...options
    };
    
    this.isInitialized = false;
    this.models = new Map();
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.listModels = this.listModels.bind(this);
    this.getModel = this.getModel.bind(this);
    this.generateText = this.generateText.bind(this);
    this.generateEmbedding = this.generateEmbedding.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the connector
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`${this.options.provider} connector already initialized`);
      return true;
    }
    
    try {
      logger.info(`Initializing ${this.options.provider} connector`);
      
      // Validate required options
      if (!this.options.apiKey) {
        throw new Error('API key is required');
      }
      
      // Fetch available models
      await this.fetchAvailableModels();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info(`${this.options.provider} connector initialized successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ${this.options.provider} connector: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Fetches available models from the provider
   * @async
   * @protected
   * @returns {Promise<Array<Object>>} Available models
   */
  async fetchAvailableModels() {
    // This method should be implemented by subclasses
    throw new Error('fetchAvailableModels must be implemented by subclass');
  }
  
  /**
   * Lists available models
   * @async
   * @returns {Promise<Array<Object>>} Available models
   */
  async listModels() {
    if (!this.isInitialized) {
      throw new Error(`${this.options.provider} connector not initialized`);
    }
    
    try {
      return Array.from(this.models.values());
    } catch (error) {
      logger.error(`Failed to list models: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets a specific model by ID
   * @async
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} Model information
   */
  async getModel(modelId) {
    if (!this.isInitialized) {
      throw new Error(`${this.options.provider} connector not initialized`);
    }
    
    try {
      const model = this.models.get(modelId);
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      return model;
    } catch (error) {
      logger.error(`Failed to get model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates text using the specified model
   * @async
   * @param {string} modelId - Model ID
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateText(modelId, prompt, options = {}) {
    // This method should be implemented by subclasses
    throw new Error('generateText must be implemented by subclass');
  }
  
  /**
   * Generates embeddings using the specified model
   * @async
   * @param {string} modelId - Model ID
   * @param {string|Array<string>} input - Input text or array of texts
   * @param {Object} options - Embedding options
   * @returns {Promise<Object>} Embedding result
   */
  async generateEmbedding(modelId, input, options = {}) {
    // This method should be implemented by subclasses
    throw new Error('generateEmbedding must be implemented by subclass');
  }
  
  /**
   * Makes an API request
   * @async
   * @protected
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
    // This method should be implemented by subclasses
    throw new Error('makeRequest must be implemented by subclass');
  }
  
  /**
   * Shuts down the connector
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn(`${this.options.provider} connector not initialized, nothing to shut down`);
      return true;
    }
    
    try {
      logger.info(`Shutting down ${this.options.provider} connector`);
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info(`${this.options.provider} connector shut down successfully`);
      return true;
    } catch (error) {
      logger.error(`Error during ${this.options.provider} connector shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ExternalModelConnector;
