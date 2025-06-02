/**
 * @fileoverview Integration tests for external model API integration with admin dashboard
 * 
 * @module core/ml/external/test/ExternalModelIntegrationTest
 * @requires core/utils/Logger
 */

const assert = require('assert');
const sinon = require('sinon');
const axios = require('axios');
const DashboardClient = require('../DashboardClient');
const APIConfigManager = require('../APIConfigManager');
const ExternalModelManager = require('../ExternalModelManager');
const OpenAIConnector = require('../OpenAIConnector');
const logger = require('../../../utils/Logger').getLogger('ExternalModelIntegrationTest');

/**
 * Mock dashboard API responses
 */
const mockDashboardResponses = {
  health: {
    status: 'ok',
    timestamp: Date.now()
  },
  userConfigs: {
    openai: {
      enabled: true,
      apiKey: 'user-provided-key-openai',
      baseUrl: 'https://api.openai.com/v1',
      organization: 'user-org'
    },
    anthropic: {
      enabled: true,
      apiKey: 'user-provided-key-anthropic',
      baseUrl: 'https://api.anthropic.com'
    },
    google: {
      enabled: false,
      apiKey: null,
      baseUrl: null
    }
  },
  defaultConfigs: {
    openai: {
      enabled: true,
      apiKey: 'default-key-openai',
      baseUrl: 'https://api.openai.com/v1',
      organization: 'default-org'
    },
    anthropic: {
      enabled: true,
      apiKey: 'default-key-anthropic',
      baseUrl: 'https://api.anthropic.com'
    },
    google: {
      enabled: true,
      apiKey: 'default-key-google',
      baseUrl: 'https://generativelanguage.googleapis.com'
    },
    cohere: {
      enabled: true,
      apiKey: 'default-key-cohere',
      baseUrl: 'https://api.cohere.ai'
    },
    mistral: {
      enabled: true,
      apiKey: 'default-key-mistral',
      baseUrl: 'https://api.mistral.ai'
    }
  },
  openaiModels: {
    data: [
      { id: 'gpt-4o', created: 1683758102, owned_by: 'openai' },
      { id: 'gpt-4-turbo', created: 1683758102, owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', created: 1677610602, owned_by: 'openai' },
      { id: 'text-embedding-3-large', created: 1677649102, owned_by: 'openai' },
      { id: 'text-embedding-3-small', created: 1677649102, owned_by: 'openai' }
    ]
  },
  openaiCompletion: {
    choices: [
      {
        message: {
          content: 'This is a test response from the mock OpenAI API.'
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 15,
      total_tokens: 25
    }
  },
  openaiEmbedding: {
    data: [
      {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      }
    ],
    usage: {
      prompt_tokens: 5,
      total_tokens: 5
    }
  }
};

/**
 * Sets up mock for axios
 * @returns {Object} Axios mock
 */
function setupAxiosMock() {
  const axiosMock = sinon.stub(axios, 'request');
  
  // Mock dashboard health endpoint
  axiosMock.withArgs(sinon.match({ 
    url: 'https://admin.aideon.ai/api/health' 
  })).resolves({ 
    status: 200, 
    data: mockDashboardResponses.health 
  });
  
  // Mock user API configs endpoint
  axiosMock.withArgs(sinon.match({ 
    url: 'https://admin.aideon.ai/api/api-configs/user' 
  })).resolves({ 
    status: 200, 
    data: mockDashboardResponses.userConfigs 
  });
  
  // Mock default API configs endpoint
  axiosMock.withArgs(sinon.match({ 
    url: 'https://admin.aideon.ai/api/api-configs/default' 
  })).resolves({ 
    status: 200, 
    data: mockDashboardResponses.defaultConfigs 
  });
  
  // Mock OpenAI models endpoint
  axiosMock.withArgs(sinon.match({ 
    url: 'https://api.openai.com/v1/models' 
  })).resolves({ 
    status: 200, 
    data: mockDashboardResponses.openaiModels 
  });
  
  // Mock OpenAI chat completion endpoint
  axiosMock.withArgs(sinon.match({ 
    url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST'
  })).resolves({ 
    status: 200, 
    data: mockDashboardResponses.openaiCompletion 
  });
  
  // Mock OpenAI embedding endpoint
  axiosMock.withArgs(sinon.match({ 
    url: 'https://api.openai.com/v1/embeddings',
    method: 'POST'
  })).resolves({ 
    status: 200, 
    data: mockDashboardResponses.openaiEmbedding 
  });
  
  // Mock updates endpoint (no updates)
  axiosMock.withArgs(sinon.match({ 
    url: 'https://admin.aideon.ai/api/api-configs/updates' 
  })).resolves({ 
    status: 304
  });
  
  return axiosMock;
}

/**
 * Runs integration tests for external model API integration
 * @async
 */
async function runIntegrationTests() {
  let axiosMock;
  let dashboardClient;
  let apiConfigManager;
  let externalModelManager;
  
  try {
    logger.info('Starting external model integration tests');
    
    // Set up mocks
    axiosMock = setupAxiosMock();
    
    // Test 1: Dashboard client initialization and connection
    logger.info('Test 1: Dashboard client initialization and connection');
    dashboardClient = new DashboardClient({
      dashboardUrl: 'https://admin.aideon.ai/api',
      apiKey: 'test-api-key',
      pollInterval: 1000,
      autoConnect: false
    });
    
    await dashboardClient.initialize();
    assert(dashboardClient.isInitialized, 'Dashboard client should be initialized');
    
    await dashboardClient.connect();
    assert(dashboardClient.isConnected, 'Dashboard client should be connected');
    
    // Test 2: API config manager initialization
    logger.info('Test 2: API config manager initialization');
    apiConfigManager = new APIConfigManager({
      dashboardClient,
      defaultConfig: {}
    });
    
    await apiConfigManager.initialize();
    assert(apiConfigManager.isInitialized, 'API config manager should be initialized');
    
    // Test 3: Verify user-provided configs are loaded
    logger.info('Test 3: Verify user-provided configs are loaded');
    const openaiConfig = apiConfigManager.getAPIConfig('openai');
    assert(openaiConfig, 'OpenAI config should be available');
    assert.strictEqual(openaiConfig.apiKey, 'user-provided-key-openai', 'User-provided OpenAI API key should be used');
    assert.strictEqual(openaiConfig.isUserProvided, true, 'Config should be marked as user-provided');
    
    // Test 4: Switch to default API
    logger.info('Test 4: Switch to default API');
    apiConfigManager.useDefaultAPI('openai');
    const defaultOpenaiConfig = apiConfigManager.getAPIConfig('openai');
    assert(defaultOpenaiConfig, 'Default OpenAI config should be available');
    assert.strictEqual(defaultOpenaiConfig.apiKey, 'default-key-openai', 'Default OpenAI API key should be used');
    assert.strictEqual(defaultOpenaiConfig.isDefault, true, 'Config should be marked as default');
    
    // Test 5: Switch back to user-provided API
    logger.info('Test 5: Switch back to user-provided API');
    apiConfigManager.useUserProvidedAPI('openai');
    const userOpenaiConfig = apiConfigManager.getAPIConfig('openai');
    assert(userOpenaiConfig, 'User OpenAI config should be available');
    assert.strictEqual(userOpenaiConfig.apiKey, 'user-provided-key-openai', 'User-provided OpenAI API key should be used');
    assert.strictEqual(userOpenaiConfig.isUserProvided, true, 'Config should be marked as user-provided');
    
    // Test 6: External model manager initialization
    logger.info('Test 6: External model manager initialization');
    externalModelManager = new ExternalModelManager({
      dashboardOptions: {
        dashboardUrl: 'https://admin.aideon.ai/api',
        apiKey: 'test-api-key',
        pollInterval: 1000,
        autoConnect: false
      }
    });
    
    await externalModelManager.initialize();
    assert(externalModelManager.isInitialized, 'External model manager should be initialized');
    
    // Test 7: Verify OpenAI connector is available
    logger.info('Test 7: Verify OpenAI connector is available');
    const openaiConnector = externalModelManager.getConnector('openai');
    assert(openaiConnector, 'OpenAI connector should be available');
    assert(openaiConnector instanceof OpenAIConnector, 'Connector should be an instance of OpenAIConnector');
    
    // Test 8: Generate text with OpenAI
    logger.info('Test 8: Generate text with OpenAI');
    const textResult = await externalModelManager.generateText('openai', 'gpt-4o', 'This is a test prompt');
    assert(textResult, 'Text generation result should be available');
    assert.strictEqual(textResult.text, 'This is a test response from the mock OpenAI API.', 'Text generation should return expected response');
    
    // Test 9: Generate embedding with OpenAI
    logger.info('Test 9: Generate embedding with OpenAI');
    const embeddingResult = await externalModelManager.generateEmbedding('openai', 'text-embedding-3-large', 'This is a test input');
    assert(embeddingResult, 'Embedding result should be available');
    assert(Array.isArray(embeddingResult.embeddings), 'Embeddings should be an array');
    assert.strictEqual(embeddingResult.embeddings[0].length, 5, 'Embedding should have expected dimensions');
    
    // Test 10: List available models
    logger.info('Test 10: List available models');
    const availableModels = await externalModelManager.listAvailableModels();
    assert(Array.isArray(availableModels), 'Available models should be an array');
    assert(availableModels.length > 0, 'There should be available models');
    
    // Test 11: Simulate API key rotation
    logger.info('Test 11: Simulate API key rotation');
    
    // Mock config update event
    const configUpdateHandler = externalModelManager.handleConfigUpdate.bind(externalModelManager);
    await configUpdateHandler({
      provider: 'openai',
      isUserProvided: true,
      isActive: true
    });
    
    // Verify connector was reinitialized
    const reinitializedConnector = externalModelManager.getConnector('openai');
    assert(reinitializedConnector, 'OpenAI connector should be available after reinitialization');
    
    logger.info('All tests passed successfully');
    return true;
  } catch (error) {
    logger.error(`Test failed: ${error.message}`, error);
    return false;
  } finally {
    // Clean up
    if (externalModelManager) {
      await externalModelManager.shutdown();
    } else {
      if (apiConfigManager) {
        await apiConfigManager.shutdown();
      }
      if (dashboardClient) {
        await dashboardClient.shutdown();
      }
    }
    
    if (axiosMock) {
      axiosMock.restore();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests()
    .then(success => {
      if (success) {
        console.log('Integration tests completed successfully');
        process.exit(0);
      } else {
        console.error('Integration tests failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Error running integration tests:', error);
      process.exit(1);
    });
}

module.exports = {
  runIntegrationTests
};
