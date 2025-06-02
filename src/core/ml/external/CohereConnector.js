/**
 * @fileoverview CohereConnector provides integration with Cohere models
 * through both user-provided API keys and admin-managed default keys.
 * 
 * @module core/ml/external/CohereConnector
 * @requires core/ml/external/ExternalModelConnector
 * @requires core/ml/external/APIConfigManager
 * @requires core/utils/Logger
 */

const ExternalModelConnector = require('./ExternalModelConnector');
const APIConfigManager = require('./APIConfigManager');
const logger = require('../../utils/Logger').getLogger('CohereConnector');

/**
 * @class CohereConnector
 * @extends ExternalModelConnector
 * @description Connector for Cohere models
 */
class CohereConnector extends ExternalModelConnector {
  /**
   * Creates an instance of CohereConnector
   * @param {Object} options - Configuration options
   * @param {APIConfigManager} options.apiConfigManager - API configuration manager
   * @param {Object} options.dashboardClient - Dashboard client for admin-managed APIs
   */
  constructor(options = {}) {
    super({
      providerName: 'cohere',
      providerDisplayName: 'Cohere',
      ...options
    });
    
    this.apiConfigManager = options.apiConfigManager || new APIConfigManager();
    this.dashboardClient = options.dashboardClient;
    
    // Available models
    this.availableModels = {
      'command-r': {
        displayName: 'Command R',
        capabilities: ['text-generation', 'reasoning', 'conversation'],
        accuracy: 94.5,
        contextWindow: 128000,
        apiOnly: true
      },
      'command-r-plus': {
        displayName: 'Command R+',
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation'],
        accuracy: 95.6,
        contextWindow: 128000,
        apiOnly: true
      },
      'command-light': {
        displayName: 'Command Light',
        capabilities: ['text-generation', 'conversation', 'summarization'],
        accuracy: 93.9,
        contextWindow: 64000,
        apiOnly: true
      },
      'embed-english': {
        displayName: 'Embed English',
        capabilities: ['embeddings'],
        accuracy: 94.2,
        apiOnly: true
      },
      'embed-multilingual': {
        displayName: 'Embed Multilingual',
        capabilities: ['embeddings'],
        accuracy: 93.8,
        apiOnly: true
      }
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.getAvailableModels = this.getAvailableModels.bind(this);
    this.generateText = this.generateText.bind(this);
    this.generateChat = this.generateChat.bind(this);
    this.generateEmbeddings = this.generateEmbeddings.bind(this);
    this.getModelInfo = this.getModelInfo.bind(this);
    this.isModelAvailable = this.isModelAvailable.bind(this);
  }
  
  /**
   * Initializes the CohereConnector
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('CohereConnector already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing CohereConnector');
      
      // Load API configuration
      await this.loadApiConfig();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('CohereConnector initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize CohereConnector: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Loads API configuration from API config manager or dashboard
   * @async
   * @private
   */
  async loadApiConfig() {
    try {
      // Check for user-provided API key
      const userConfig = await this.apiConfigManager.getUserApiConfig('cohere');
      
      if (userConfig && userConfig.apiKey) {
        logger.debug('Using user-provided Cohere API key');
        this.apiKey = userConfig.apiKey;
        this.useUserKey = true;
        return;
      }
      
      // Fall back to admin-managed default API key
      if (this.dashboardClient) {
        logger.debug('Fetching admin-managed Cohere API key');
        const defaultConfig = await this.dashboardClient.getProviderConfig('cohere');
        
        if (defaultConfig && defaultConfig.apiKey) {
          logger.debug('Using admin-managed Cohere API key');
          this.apiKey = defaultConfig.apiKey;
          this.useUserKey = false;
          return;
        }
      }
      
      logger.warn('No Cohere API key available');
    } catch (error) {
      logger.error(`Error loading Cohere API configuration: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets available models from Cohere
   * @async
   * @returns {Promise<Array<Object>>} Available models
   */
  async getAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('CohereConnector not initialized');
    }
    
    if (!this.apiKey) {
      logger.warn('No Cohere API key available, returning static model list');
      return Object.entries(this.availableModels).map(([id, info]) => ({
        id,
        ...info,
        available: false
      }));
    }
    
    try {
      // In a real implementation, we would call Cohere's API to get available models
      // For now, we'll return our static list with availability based on API key presence
      return Object.entries(this.availableModels).map(([id, info]) => ({
        id,
        ...info,
        available: true
      }));
    } catch (error) {
      logger.error(`Error getting available models from Cohere: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets information about a specific model
   * @param {string} modelId - Model ID
   * @returns {Object} Model information
   */
  getModelInfo(modelId) {
    if (!modelId) {
      throw new Error('Model ID is required');
    }
    
    const modelInfo = this.availableModels[modelId];
    
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    
    return {
      id: modelId,
      ...modelInfo,
      provider: 'cohere',
      available: !!this.apiKey
    };
  }
  
  /**
   * Checks if a model is available
   * @param {string} modelId - Model ID
   * @returns {boolean} Whether the model is available
   */
  isModelAvailable(modelId) {
    if (!this.isInitialized || !this.apiKey) {
      return false;
    }
    
    return !!this.availableModels[modelId];
  }
  
  /**
   * Generates text using a Cohere model
   * @async
   * @param {string} modelId - Model ID
   * @param {string} prompt - Text prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated text and metadata
   */
  async generateText(modelId, prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('CohereConnector not initialized');
    }
    
    if (!this.apiKey) {
      throw new Error('No Cohere API key available');
    }
    
    if (!modelId || !prompt) {
      throw new Error('Model ID and prompt are required');
    }
    
    if (!this.isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available`);
    }
    
    // Check if model supports text generation
    const modelInfo = this.availableModels[modelId];
    if (!modelInfo.capabilities.includes('text-generation')) {
      throw new Error(`Model ${modelId} does not support text generation`);
    }
    
    try {
      logger.debug(`Generating text with Cohere model ${modelId}`);
      
      // Record the start time for latency tracking
      const startTime = Date.now();
      
      // In a real implementation, we would call Cohere's API here
      // For now, we'll simulate a response
      
      // Simulate API call latency
      await new Promise(resolve => setTimeout(resolve, 550));
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Simulate a response
      const response = {
        text: `This is a simulated response from Cohere's ${modelId} model based on the prompt: "${prompt.substring(0, 50)}..."`,
        usage: {
          promptTokens: prompt.length / 4, // Rough estimate
          completionTokens: 180, // Simulated value
          totalTokens: (prompt.length / 4) + 180
        },
        metadata: {
          model: modelId,
          provider: 'cohere',
          latency,
          finishReason: 'stop'
        }
      };
      
      logger.debug(`Text generation with ${modelId} completed in ${latency}ms`);
      
      return response;
    } catch (error) {
      logger.error(`Error generating text with Cohere model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates chat completion using a Cohere model
   * @async
   * @param {string} modelId - Model ID
   * @param {Array<Object>} messages - Chat messages
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated chat completion and metadata
   */
  async generateChat(modelId, messages, options = {}) {
    if (!this.isInitialized) {
      throw new Error('CohereConnector not initialized');
    }
    
    if (!this.apiKey) {
      throw new Error('No Cohere API key available');
    }
    
    if (!modelId || !messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Model ID and messages array are required');
    }
    
    if (!this.isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available`);
    }
    
    // Check if model supports conversation
    const modelInfo = this.availableModels[modelId];
    if (!modelInfo.capabilities.includes('conversation')) {
      throw new Error(`Model ${modelId} does not support conversation`);
    }
    
    try {
      logger.debug(`Generating chat completion with Cohere model ${modelId}`);
      
      // Record the start time for latency tracking
      const startTime = Date.now();
      
      // In a real implementation, we would call Cohere's API here
      // For now, we'll simulate a response
      
      // Simulate API call latency
      await new Promise(resolve => setTimeout(resolve, 650));
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Get the last user message for the simulated response
      const lastUserMessage = messages.filter(m => m.role === 'user').pop() || { content: '' };
      
      // Simulate a response
      const response = {
        message: {
          role: 'assistant',
          content: `This is a simulated chat response from Cohere's ${modelId} model based on the conversation. Responding to: "${lastUserMessage.content.substring(0, 50)}..."`
        },
        usage: {
          promptTokens: messages.reduce((acc, m) => acc + (m.content.length / 4), 0), // Rough estimate
          completionTokens: 210, // Simulated value
          totalTokens: messages.reduce((acc, m) => acc + (m.content.length / 4), 0) + 210
        },
        metadata: {
          model: modelId,
          provider: 'cohere',
          latency,
          finishReason: 'stop'
        }
      };
      
      logger.debug(`Chat generation with ${modelId} completed in ${latency}ms`);
      
      return response;
    } catch (error) {
      logger.error(`Error generating chat with Cohere model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates embeddings using a Cohere model
   * @async
   * @param {string} modelId - Model ID
   * @param {Array<string>} texts - Texts to embed
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated embeddings and metadata
   */
  async generateEmbeddings(modelId, texts, options = {}) {
    if (!this.isInitialized) {
      throw new Error('CohereConnector not initialized');
    }
    
    if (!this.apiKey) {
      throw new Error('No Cohere API key available');
    }
    
    if (!modelId || !texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('Model ID and texts array are required');
    }
    
    if (!this.isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available`);
    }
    
    // Check if model supports embeddings
    const modelInfo = this.availableModels[modelId];
    if (!modelInfo.capabilities.includes('embeddings')) {
      throw new Error(`Model ${modelId} does not support embeddings`);
    }
    
    try {
      logger.debug(`Generating embeddings with Cohere model ${modelId} for ${texts.length} texts`);
      
      // Record the start time for latency tracking
      const startTime = Date.now();
      
      // In a real implementation, we would call Cohere's API here
      // For now, we'll simulate a response
      
      // Simulate API call latency
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Simulate embeddings (1536-dimensional vectors)
      const embeddings = texts.map(() => {
        const embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
        // Normalize the embedding
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / norm);
      });
      
      // Simulate a response
      const response = {
        embeddings,
        usage: {
          totalTokens: texts.reduce((acc, text) => acc + (text.length / 4), 0), // Rough estimate
        },
        metadata: {
          model: modelId,
          provider: 'cohere',
          latency,
          dimensions: 1536
        }
      };
      
      logger.debug(`Embeddings generation with ${modelId} completed in ${latency}ms`);
      
      return response;
    } catch (error) {
      logger.error(`Error generating embeddings with Cohere model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Refreshes the API configuration
   * @async
   * @returns {Promise<boolean>} Refresh success status
   */
  async refreshApiConfig() {
    try {
      logger.debug('Refreshing Cohere API configuration');
      await this.loadApiConfig();
      return true;
    } catch (error) {
      logger.error(`Error refreshing Cohere API configuration: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = CohereConnector;
