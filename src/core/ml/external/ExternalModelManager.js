/**
 * @fileoverview ExternalModelManager orchestrates the integration of external API-based models
 * with Aideon Core, managing connections to providers like OpenAI, Anthropic, and Google.
 * 
 * @module core/ml/external/ExternalModelManager
 * @requires core/utils/Logger
 */

const { EventEmitter } = require('events');
const logger = require('../../utils/Logger').getLogger('ExternalModelManager');
const DashboardClient = require('./DashboardClient');
const APIConfigManager = require('./APIConfigManager');
const OpenAIConnector = require('./OpenAIConnector');

/**
 * @class ExternalModelManager
 * @extends EventEmitter
 * @description Manages external API-based model integrations
 */
class ExternalModelManager extends EventEmitter {
  /**
   * Creates an instance of ExternalModelManager
   * @param {Object} options - Configuration options
   * @param {Object} options.dashboardOptions - Options for DashboardClient
   * @param {Object} options.defaultConfig - Default API configurations
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      dashboardOptions: {},
      defaultConfig: {},
      ...options
    };
    
    this.isInitialized = false;
    this.dashboardClient = null;
    this.apiConfigManager = null;
    this.connectors = new Map();
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.getConnector = this.getConnector.bind(this);
    this.generateText = this.generateText.bind(this);
    this.generateEmbedding = this.generateEmbedding.bind(this);
    this.listAvailableModels = this.listAvailableModels.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ExternalModelManager
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ExternalModelManager already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ExternalModelManager');
      
      // Initialize dashboard client
      this.dashboardClient = new DashboardClient(this.options.dashboardOptions);
      await this.dashboardClient.initialize();
      
      // Initialize API config manager
      this.apiConfigManager = new APIConfigManager({
        dashboardClient: this.dashboardClient,
        defaultConfig: this.options.defaultConfig
      });
      await this.apiConfigManager.initialize();
      
      // Initialize connectors
      await this.initializeConnectors();
      
      // Set up event listeners
      this.apiConfigManager.on('configUpdated', this.handleConfigUpdate.bind(this));
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ExternalModelManager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ExternalModelManager: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Initializes connectors for external model providers
   * @async
   * @private
   * @returns {Promise<boolean>} Initialization success status
   */
  async initializeConnectors() {
    try {
      logger.debug('Initializing external model connectors');
      
      // Initialize OpenAI connector
      const openaiConfig = this.apiConfigManager.getAPIConfig('openai');
      if (openaiConfig && openaiConfig.enabled) {
        const openaiConnector = new OpenAIConnector(openaiConfig);
        await openaiConnector.initialize();
        this.connectors.set('openai', openaiConnector);
        logger.debug('OpenAI connector initialized successfully');
      }
      
      // Initialize other connectors as needed
      // TODO: Add connectors for Anthropic, Google, etc.
      
      logger.debug('External model connectors initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize external model connectors: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Handles API configuration updates
   * @private
   * @param {Object} event - Update event
   */
  async handleConfigUpdate(event) {
    try {
      logger.debug(`API configuration updated for ${event.provider}`);
      
      // Reinitialize connector for the updated provider
      const provider = event.provider;
      
      // Get updated config
      const config = this.apiConfigManager.getAPIConfig(provider);
      
      if (!config || !config.enabled) {
        // If config is disabled or not available, shut down connector
        if (this.connectors.has(provider)) {
          const connector = this.connectors.get(provider);
          await connector.shutdown();
          this.connectors.delete(provider);
          logger.debug(`Connector for ${provider} shut down due to disabled config`);
        }
        return;
      }
      
      // Reinitialize connector
      if (this.connectors.has(provider)) {
        // Shut down existing connector
        const connector = this.connectors.get(provider);
        await connector.shutdown();
        this.connectors.delete(provider);
      }
      
      // Initialize new connector based on provider
      switch (provider) {
        case 'openai':
          const openaiConnector = new OpenAIConnector(config);
          await openaiConnector.initialize();
          this.connectors.set('openai', openaiConnector);
          logger.debug('OpenAI connector reinitialized successfully');
          break;
        // Add cases for other providers as needed
        default:
          logger.warn(`No connector implementation available for provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to handle config update: ${error.message}`, error);
    }
  }
  
  /**
   * Gets a connector for a specific provider
   * @param {string} provider - Provider name
   * @returns {Object|null} Connector instance or null if not available
   */
  getConnector(provider) {
    if (!this.isInitialized) {
      throw new Error('ExternalModelManager not initialized');
    }
    
    const normalizedProvider = provider.toLowerCase();
    
    if (!this.connectors.has(normalizedProvider)) {
      logger.warn(`No connector available for provider: ${provider}`);
      return null;
    }
    
    return this.connectors.get(normalizedProvider);
  }
  
  /**
   * Generates text using an external model
   * @async
   * @param {string} provider - Provider name
   * @param {string} modelId - Model ID
   * @param {string|Array<Object>} prompt - Input prompt or array of messages
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateText(provider, modelId, prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ExternalModelManager not initialized');
    }
    
    try {
      const connector = this.getConnector(provider);
      
      if (!connector) {
        throw new Error(`No connector available for provider: ${provider}`);
      }
      
      return await connector.generateText(modelId, prompt, options);
    } catch (error) {
      logger.error(`Failed to generate text with ${provider}/${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates embeddings using an external model
   * @async
   * @param {string} provider - Provider name
   * @param {string} modelId - Model ID
   * @param {string|Array<string>} input - Input text or array of texts
   * @param {Object} options - Embedding options
   * @returns {Promise<Object>} Embedding result
   */
  async generateEmbedding(provider, modelId, input, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ExternalModelManager not initialized');
    }
    
    try {
      const connector = this.getConnector(provider);
      
      if (!connector) {
        throw new Error(`No connector available for provider: ${provider}`);
      }
      
      return await connector.generateEmbedding(modelId, input, options);
    } catch (error) {
      logger.error(`Failed to generate embedding with ${provider}/${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Lists all available external models
   * @async
   * @returns {Promise<Array<Object>>} Available models
   */
  async listAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('ExternalModelManager not initialized');
    }
    
    try {
      const allModels = [];
      
      // Collect models from all connectors
      for (const [provider, connector] of this.connectors.entries()) {
        try {
          const models = await connector.listModels();
          allModels.push(...models);
        } catch (error) {
          logger.error(`Failed to list models from ${provider}: ${error.message}`, error);
        }
      }
      
      return allModels;
    } catch (error) {
      logger.error(`Failed to list available models: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Shuts down the ExternalModelManager
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ExternalModelManager not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ExternalModelManager');
      
      // Shut down all connectors
      for (const [provider, connector] of this.connectors.entries()) {
        try {
          await connector.shutdown();
          logger.debug(`Connector for ${provider} shut down successfully`);
        } catch (error) {
          logger.error(`Failed to shut down connector for ${provider}: ${error.message}`, error);
        }
      }
      
      // Clear connectors
      this.connectors.clear();
      
      // Shut down API config manager
      if (this.apiConfigManager) {
        await this.apiConfigManager.shutdown();
      }
      
      // Shut down dashboard client
      if (this.dashboardClient) {
        await this.dashboardClient.shutdown();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ExternalModelManager shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ExternalModelManager shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ExternalModelManager;
