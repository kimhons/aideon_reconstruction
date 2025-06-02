/**
 * @fileoverview OpenAIConnector provides integration with OpenAI's API-based models
 * for text generation, embeddings, and other AI capabilities.
 * 
 * @module core/ml/external/OpenAIConnector
 * @requires core/utils/Logger
 */

const axios = require('axios');
const ExternalModelConnector = require('./ExternalModelConnector');
const logger = require('../../utils/Logger').getLogger('OpenAIConnector');

/**
 * @class OpenAIConnector
 * @extends ExternalModelConnector
 * @description Connector for OpenAI API-based models
 */
class OpenAIConnector extends ExternalModelConnector {
  /**
   * Creates an instance of OpenAIConnector
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - OpenAI API key
   * @param {string} options.organization - OpenAI organization ID (optional)
   * @param {string} options.baseUrl - Base URL for API requests (defaults to OpenAI API URL)
   * @param {Object} options.defaultHeaders - Default headers for API requests
   * @param {number} options.timeout - Timeout for API requests in milliseconds
   * @param {boolean} options.debug - Whether to enable debug logging
   */
  constructor(options = {}) {
    super({
      provider: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      ...options
    });
    
    this.organization = options.organization || null;
    
    // OpenAI-specific model metadata
    this.modelCapabilities = {
      'gpt-4o': {
        type: 'chat',
        maxTokens: 128000,
        inputCostPer1KTokens: 0.01,
        outputCostPer1KTokens: 0.03,
        accuracy: 97.5,
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation']
      },
      'gpt-4': {
        type: 'chat',
        maxTokens: 8192,
        inputCostPer1KTokens: 0.03,
        outputCostPer1KTokens: 0.06,
        accuracy: 96.8,
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation']
      },
      'gpt-4-turbo': {
        type: 'chat',
        maxTokens: 128000,
        inputCostPer1KTokens: 0.01,
        outputCostPer1KTokens: 0.03,
        accuracy: 97.2,
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation']
      },
      'gpt-3.5-turbo': {
        type: 'chat',
        maxTokens: 16385,
        inputCostPer1KTokens: 0.0015,
        outputCostPer1KTokens: 0.002,
        accuracy: 94.5,
        capabilities: ['text-generation', 'reasoning', 'code-generation', 'conversation']
      },
      'text-embedding-3-large': {
        type: 'embedding',
        dimensions: 3072,
        costPer1KTokens: 0.00013,
        capabilities: ['embedding']
      },
      'text-embedding-3-small': {
        type: 'embedding',
        dimensions: 1536,
        costPer1KTokens: 0.00002,
        capabilities: ['embedding']
      },
      'text-moderation-latest': {
        type: 'moderation',
        capabilities: ['moderation']
      }
    };
  }
  
  /**
   * Fetches available models from OpenAI
   * @async
   * @protected
   * @returns {Promise<Array<Object>>} Available models
   */
  async fetchAvailableModels() {
    try {
      logger.debug('Fetching available models from OpenAI');
      
      const response = await this.makeRequest('/models');
      
      if (!response || !response.data || !Array.isArray(response.data.data)) {
        throw new Error('Invalid response from OpenAI API');
      }
      
      // Process models
      const models = response.data.data.map(model => {
        const id = model.id;
        const capabilities = this.modelCapabilities[id] || {
          type: 'unknown',
          capabilities: []
        };
        
        return {
          id,
          provider: this.options.provider,
          name: model.id,
          description: `OpenAI ${model.id} model`,
          type: capabilities.type || 'unknown',
          capabilities: capabilities.capabilities || [],
          maxTokens: capabilities.maxTokens,
          accuracy: capabilities.accuracy,
          inputCostPer1KTokens: capabilities.inputCostPer1KTokens,
          outputCostPer1KTokens: capabilities.outputCostPer1KTokens,
          dimensions: capabilities.dimensions,
          costPer1KTokens: capabilities.costPer1KTokens,
          created: model.created,
          owned_by: model.owned_by,
          offlineCapable: false
        };
      });
      
      // Filter out models we don't want to expose
      const filteredModels = models.filter(model => {
        // Include only models we have metadata for or that match certain patterns
        return this.modelCapabilities[model.id] || 
               model.id.startsWith('gpt-') || 
               model.id.startsWith('text-embedding-') ||
               model.id.startsWith('text-moderation-');
      });
      
      // Store models in map
      this.models.clear();
      for (const model of filteredModels) {
        this.models.set(model.id, model);
      }
      
      logger.debug(`Fetched ${filteredModels.length} models from OpenAI`);
      
      return filteredModels;
    } catch (error) {
      logger.error(`Failed to fetch models from OpenAI: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates text using the specified OpenAI model
   * @async
   * @param {string} modelId - Model ID
   * @param {string|Array<Object>} prompt - Input prompt or array of messages
   * @param {Object} options - Generation options
   * @param {number} options.maxTokens - Maximum number of tokens to generate
   * @param {number} options.temperature - Temperature for sampling (0-2)
   * @param {number} options.topP - Top-p sampling parameter (0-1)
   * @param {number} options.presencePenalty - Presence penalty (-2 to 2)
   * @param {number} options.frequencyPenalty - Frequency penalty (-2 to 2)
   * @param {Array<string>} options.stop - Stop sequences
   * @returns {Promise<Object>} Generation result
   */
  async generateText(modelId, prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('OpenAI connector not initialized');
    }
    
    try {
      logger.debug(`Generating text with model ${modelId}`);
      
      // Get model
      const model = await this.getModel(modelId);
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      // Check if model supports text generation
      if (!model.capabilities.includes('text-generation') && 
          !model.capabilities.includes('conversation') &&
          !model.capabilities.includes('chat')) {
        throw new Error(`Model ${modelId} does not support text generation`);
      }
      
      // Prepare request data
      let requestData = {};
      
      // Handle different model types
      if (model.type === 'chat') {
        // Handle chat models (GPT-3.5, GPT-4, etc.)
        let messages;
        
        if (typeof prompt === 'string') {
          // Convert string prompt to messages format
          messages = [
            {
              role: 'user',
              content: prompt
            }
          ];
        } else if (Array.isArray(prompt)) {
          // Use provided messages
          messages = prompt;
        } else {
          throw new Error('Invalid prompt format for chat model');
        }
        
        requestData = {
          model: modelId,
          messages,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          top_p: options.topP !== undefined ? options.topP : 1,
          presence_penalty: options.presencePenalty !== undefined ? options.presencePenalty : 0,
          frequency_penalty: options.frequencyPenalty !== undefined ? options.frequencyPenalty : 0,
          stop: options.stop || null,
          stream: false
        };
        
        // Make API request
        const response = await this.makeRequest('/chat/completions', 'POST', requestData);
        
        if (!response || !response.data || !response.data.choices || response.data.choices.length === 0) {
          throw new Error('Invalid response from OpenAI API');
        }
        
        // Extract result
        const result = {
          text: response.data.choices[0].message.content,
          finishReason: response.data.choices[0].finish_reason,
          usage: response.data.usage,
          model: modelId,
          provider: this.options.provider
        };
        
        return result;
      } else {
        throw new Error(`Unsupported model type: ${model.type}`);
      }
    } catch (error) {
      logger.error(`Failed to generate text with model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates embeddings using the specified OpenAI model
   * @async
   * @param {string} modelId - Model ID
   * @param {string|Array<string>} input - Input text or array of texts
   * @param {Object} options - Embedding options
   * @returns {Promise<Object>} Embedding result
   */
  async generateEmbedding(modelId, input, options = {}) {
    if (!this.isInitialized) {
      throw new Error('OpenAI connector not initialized');
    }
    
    try {
      logger.debug(`Generating embedding with model ${modelId}`);
      
      // Get model
      const model = await this.getModel(modelId);
      
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      // Check if model supports embeddings
      if (!model.capabilities.includes('embedding')) {
        throw new Error(`Model ${modelId} does not support embeddings`);
      }
      
      // Prepare input
      let inputArray;
      
      if (typeof input === 'string') {
        inputArray = [input];
      } else if (Array.isArray(input)) {
        inputArray = input;
      } else {
        throw new Error('Invalid input format for embedding');
      }
      
      // Prepare request data
      const requestData = {
        model: modelId,
        input: inputArray,
        encoding_format: options.encodingFormat || 'float'
      };
      
      // Make API request
      const response = await this.makeRequest('/embeddings', 'POST', requestData);
      
      if (!response || !response.data || !response.data.data || response.data.data.length === 0) {
        throw new Error('Invalid response from OpenAI API');
      }
      
      // Extract result
      const result = {
        embeddings: response.data.data.map(item => item.embedding),
        usage: response.data.usage,
        model: modelId,
        provider: this.options.provider,
        dimensions: model.dimensions || response.data.data[0].embedding.length
      };
      
      return result;
    } catch (error) {
      logger.error(`Failed to generate embedding with model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Makes an API request to OpenAI
   * @async
   * @protected
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
    try {
      // Prepare URL
      const url = `${this.options.baseUrl}${endpoint}`;
      
      // Prepare headers
      const requestHeaders = {
        'Authorization': `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
        ...this.options.defaultHeaders,
        ...headers
      };
      
      // Add organization header if provided
      if (this.organization) {
        requestHeaders['OpenAI-Organization'] = this.organization;
      }
      
      // Prepare request options
      const requestOptions = {
        method,
        url,
        headers: requestHeaders,
        timeout: this.options.timeout
      };
      
      // Add data if provided
      if (data) {
        requestOptions.data = data;
      }
      
      // Log request if debug is enabled
      if (this.options.debug) {
        logger.debug(`Making ${method} request to ${url}`, {
          headers: requestHeaders,
          data: data ? JSON.stringify(data) : null
        });
      }
      
      // Make request
      const response = await axios(requestOptions);
      
      // Log response if debug is enabled
      if (this.options.debug) {
        logger.debug(`Response from ${url}`, {
          status: response.status,
          data: response.data ? JSON.stringify(response.data) : null
        });
      }
      
      return response;
    } catch (error) {
      // Handle Axios errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error(`API error: ${error.response.status} ${error.response.statusText}`, {
          data: error.response.data
        });
        
        throw new Error(`OpenAI API error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('API request error: No response received', {
          request: error.request
        });
        
        throw new Error('OpenAI API request error: No response received');
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error(`API request setup error: ${error.message}`, error);
        
        throw error;
      }
    }
  }
}

module.exports = OpenAIConnector;
