/**
 * @fileoverview AnthropicConnector provides integration with Anthropic's Claude models
 * through both user-provided API keys and admin-managed default keys.
 * 
 * @module core/ml/external/AnthropicConnector
 * @requires core/ml/external/ExternalModelConnector
 * @requires core/ml/external/APIConfigManager
 * @requires core/utils/Logger
 */

const ExternalModelConnector = require('./ExternalModelConnector');
const APIConfigManager = require('./APIConfigManager');
const logger = require('../../utils/Logger').getLogger('AnthropicConnector');

/**
 * @class AnthropicConnector
 * @extends ExternalModelConnector
 * @description Connector for Anthropic's Claude models
 */
class AnthropicConnector extends ExternalModelConnector {
  /**
   * Creates an instance of AnthropicConnector
   * @param {Object} options - Configuration options
   * @param {APIConfigManager} options.apiConfigManager - API configuration manager
   * @param {Object} options.dashboardClient - Dashboard client for admin-managed APIs
   */
  constructor(options = {}) {
    super({
      providerName: 'anthropic',
      providerDisplayName: 'Anthropic',
      ...options
    });
    
    this.apiConfigManager = options.apiConfigManager || new APIConfigManager();
    this.dashboardClient = options.dashboardClient;
    
    // Available models
    this.availableModels = {
      'claude-3-opus': {
        displayName: 'Claude 3 Opus',
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation'],
        accuracy: 96.2,
        contextWindow: 200000,
        apiOnly: true
      },
      'claude-3-sonnet': {
        displayName: 'Claude 3 Sonnet',
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation'],
        accuracy: 95.3,
        contextWindow: 180000,
        apiOnly: true
      },
      'claude-3-haiku': {
        displayName: 'Claude 3 Haiku',
        capabilities: ['text-generation', 'conversation', 'summarization'],
        accuracy: 94.1,
        contextWindow: 150000,
        apiOnly: true
      }
    };
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.getAvailableModels = this.getAvailableModels.bind(this);
    this.generateText = this.generateText.bind(this);
    this.generateChat = this.generateChat.bind(this);
    this.getModelInfo = this.getModelInfo.bind(this);
    this.isModelAvailable = this.isModelAvailable.bind(this);
  }
  
  /**
   * Initializes the AnthropicConnector
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('AnthropicConnector already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing AnthropicConnector');
      
      // Load API configuration
      await this.loadApiConfig();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('AnthropicConnector initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize AnthropicConnector: ${error.message}`, error);
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
      const userConfig = await this.apiConfigManager.getUserApiConfig('anthropic');
      
      if (userConfig && userConfig.apiKey) {
        logger.debug('Using user-provided Anthropic API key');
        this.apiKey = userConfig.apiKey;
        this.useUserKey = true;
        return;
      }
      
      // Fall back to admin-managed default API key
      if (this.dashboardClient) {
        logger.debug('Fetching admin-managed Anthropic API key');
        const defaultConfig = await this.dashboardClient.getProviderConfig('anthropic');
        
        if (defaultConfig && defaultConfig.apiKey) {
          logger.debug('Using admin-managed Anthropic API key');
          this.apiKey = defaultConfig.apiKey;
          this.useUserKey = false;
          return;
        }
      }
      
      logger.warn('No Anthropic API key available');
    } catch (error) {
      logger.error(`Error loading Anthropic API configuration: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets available models from Anthropic
   * @async
   * @returns {Promise<Array<Object>>} Available models
   */
  async getAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('AnthropicConnector not initialized');
    }
    
    if (!this.apiKey) {
      logger.warn('No Anthropic API key available, returning static model list');
      return Object.entries(this.availableModels).map(([id, info]) => ({
        id,
        ...info,
        available: false
      }));
    }
    
    try {
      // In a real implementation, we would call Anthropic's API to get available models
      // For now, we'll return our static list with availability based on API key presence
      return Object.entries(this.availableModels).map(([id, info]) => ({
        id,
        ...info,
        available: true
      }));
    } catch (error) {
      logger.error(`Error getting available models from Anthropic: ${error.message}`, error);
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
      provider: 'anthropic',
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
   * Generates text using an Anthropic model
   * @async
   * @param {string} modelId - Model ID
   * @param {string} prompt - Text prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated text and metadata
   */
  async generateText(modelId, prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AnthropicConnector not initialized');
    }
    
    if (!this.apiKey) {
      throw new Error('No Anthropic API key available');
    }
    
    if (!modelId || !prompt) {
      throw new Error('Model ID and prompt are required');
    }
    
    if (!this.isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available`);
    }
    
    try {
      logger.debug(`Generating text with Anthropic model ${modelId}`);
      
      // Record the start time for latency tracking
      const startTime = Date.now();
      
      // In a real implementation, we would call Anthropic's API here
      // For now, we'll simulate a response
      
      // Simulate API call latency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Simulate a response
      const response = {
        text: `This is a simulated response from Anthropic's ${modelId} model based on the prompt: "${prompt.substring(0, 50)}..."`,
        usage: {
          promptTokens: prompt.length / 4, // Rough estimate
          completionTokens: 150, // Simulated value
          totalTokens: (prompt.length / 4) + 150
        },
        metadata: {
          model: modelId,
          provider: 'anthropic',
          latency,
          finishReason: 'stop'
        }
      };
      
      logger.debug(`Text generation with ${modelId} completed in ${latency}ms`);
      
      return response;
    } catch (error) {
      logger.error(`Error generating text with Anthropic model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates chat completion using an Anthropic model
   * @async
   * @param {string} modelId - Model ID
   * @param {Array<Object>} messages - Chat messages
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated chat completion and metadata
   */
  async generateChat(modelId, messages, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AnthropicConnector not initialized');
    }
    
    if (!this.apiKey) {
      throw new Error('No Anthropic API key available');
    }
    
    if (!modelId || !messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Model ID and messages array are required');
    }
    
    if (!this.isModelAvailable(modelId)) {
      throw new Error(`Model ${modelId} is not available`);
    }
    
    try {
      logger.debug(`Generating chat completion with Anthropic model ${modelId}`);
      
      // Record the start time for latency tracking
      const startTime = Date.now();
      
      // In a real implementation, we would call Anthropic's API here
      // For now, we'll simulate a response
      
      // Simulate API call latency
      await new Promise(resolve => setTimeout(resolve, 700));
      
      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Get the last user message for the simulated response
      const lastUserMessage = messages.filter(m => m.role === 'user').pop() || { content: '' };
      
      // Simulate a response
      const response = {
        message: {
          role: 'assistant',
          content: `This is a simulated chat response from Anthropic's ${modelId} model based on the conversation. Responding to: "${lastUserMessage.content.substring(0, 50)}..."`
        },
        usage: {
          promptTokens: messages.reduce((acc, m) => acc + (m.content.length / 4), 0), // Rough estimate
          completionTokens: 180, // Simulated value
          totalTokens: messages.reduce((acc, m) => acc + (m.content.length / 4), 0) + 180
        },
        metadata: {
          model: modelId,
          provider: 'anthropic',
          latency,
          finishReason: 'stop'
        }
      };
      
      logger.debug(`Chat generation with ${modelId} completed in ${latency}ms`);
      
      return response;
    } catch (error) {
      logger.error(`Error generating chat with Anthropic model ${modelId}: ${error.message}`, error);
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
      logger.debug('Refreshing Anthropic API configuration');
      await this.loadApiConfig();
      return true;
    } catch (error) {
      logger.error(`Error refreshing Anthropic API configuration: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = AnthropicConnector;
