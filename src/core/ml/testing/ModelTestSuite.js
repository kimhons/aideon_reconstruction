/**
 * @fileoverview ModelTestSuite provides comprehensive testing for embedded ML models
 * within Aideon Core, verifying offline functionality, performance, and integration.
 * 
 * @module core/ml/testing/ModelTestSuite
 * @requires core/utils/Logger
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const logger = require('../../utils/Logger').getLogger('ModelTestSuite');

/**
 * @class ModelTestSuite
 * @extends EventEmitter
 * @description Test suite for embedded ML models
 */
class ModelTestSuite extends EventEmitter {
  /**
   * Creates an instance of ModelTestSuite
   * @param {Object} options - Configuration options
   * @param {Object} options.modelIntegrationManager - ModelIntegrationManager instance
   * @param {string} options.testDataPath - Path to test data
   * @param {boolean} options.saveResults - Whether to save test results
   * @param {string} options.resultsPath - Path to save test results
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      testDataPath: path.join(process.cwd(), 'test', 'data'),
      saveResults: true,
      resultsPath: path.join(process.cwd(), 'test', 'results'),
      ...options
    };
    
    this.modelIntegrationManager = options.modelIntegrationManager;
    this.testResults = new Map();
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.runAllTests = this.runAllTests.bind(this);
    this.testModelLoading = this.testModelLoading.bind(this);
    this.testModelOrchestration = this.testModelOrchestration.bind(this);
    this.testTextGeneration = this.testTextGeneration.bind(this);
    this.testOfflineCapability = this.testOfflineCapability.bind(this);
    this.testResourceManagement = this.testResourceManagement.bind(this);
    this.testAPIService = this.testAPIService.bind(this);
    this.saveTestResults = this.saveTestResults.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelTestSuite
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelTestSuite already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelTestSuite');
      
      // Validate dependencies
      if (!this.modelIntegrationManager) {
        throw new Error('ModelIntegrationManager is required');
      }
      
      // Ensure test data directory exists
      if (!fs.existsSync(this.options.testDataPath)) {
        fs.mkdirSync(this.options.testDataPath, { recursive: true });
      }
      
      // Ensure results directory exists if saving results
      if (this.options.saveResults && !fs.existsSync(this.options.resultsPath)) {
        fs.mkdirSync(this.options.resultsPath, { recursive: true });
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelTestSuite initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelTestSuite: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Runs all tests
   * @async
   * @returns {Promise<Object>} Test results
   */
  async runAllTests() {
    if (!this.isInitialized) {
      throw new Error('ModelTestSuite not initialized');
    }
    
    try {
      logger.info('Running all model tests');
      
      this.emit('testingStarted');
      
      // Clear previous test results
      this.testResults.clear();
      
      // Run tests
      await this.testModelLoading();
      await this.testModelOrchestration();
      await this.testTextGeneration();
      await this.testOfflineCapability();
      await this.testResourceManagement();
      await this.testAPIService();
      
      // Save test results if enabled
      if (this.options.saveResults) {
        await this.saveTestResults();
      }
      
      // Calculate overall results
      const overallResults = this.calculateOverallResults();
      
      this.emit('testingCompleted', overallResults);
      logger.info(`All tests completed. Overall success rate: ${overallResults.successRate.toFixed(2)}%`);
      
      return overallResults;
    } catch (error) {
      logger.error(`Failed to run tests: ${error.message}`, error);
      this.emit('testingFailed', error);
      throw error;
    }
  }
  
  /**
   * Tests model loading functionality
   * @async
   * @returns {Promise<Object>} Test results
   */
  async testModelLoading() {
    try {
      logger.info('Testing model loading functionality');
      
      const testName = 'modelLoading';
      const startTime = Date.now();
      const results = {
        name: testName,
        startTime,
        endTime: null,
        duration: null,
        tests: [],
        success: 0,
        failure: 0,
        successRate: 0
      };
      
      // Get all available models
      const modelRegistry = this.modelIntegrationManager.modelRegistry;
      const models = await modelRegistry.getAllModels();
      
      logger.debug(`Found ${models.length} models to test`);
      
      // Test loading each model
      for (const model of models) {
        const modelId = model.id;
        const testResult = {
          name: `Load model: ${modelId}`,
          modelId,
          success: false,
          error: null,
          duration: null
        };
        
        const testStartTime = Date.now();
        
        try {
          logger.debug(`Testing loading of model: ${modelId}`);
          
          // Ensure model is unloaded first
          await this.modelIntegrationManager.modelLoaderService.unloadModel(modelId);
          
          // Load model
          const loadedModel = await this.modelIntegrationManager.modelLoaderService.loadModel(modelId);
          
          // Verify model is loaded
          const modelInfo = await modelRegistry.getModel(modelId);
          
          if (modelInfo && modelInfo.status === 'loaded' && loadedModel) {
            testResult.success = true;
            results.success++;
          } else {
            testResult.success = false;
            testResult.error = 'Model not properly loaded';
            results.failure++;
          }
          
          // Unload model after test
          await this.modelIntegrationManager.modelLoaderService.unloadModel(modelId);
        } catch (error) {
          testResult.success = false;
          testResult.error = error.message;
          results.failure++;
          logger.error(`Failed to load model ${modelId}: ${error.message}`, error);
        }
        
        testResult.duration = Date.now() - testStartTime;
        results.tests.push(testResult);
      }
      
      // Calculate success rate
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = (results.success / (results.success + results.failure)) * 100;
      
      // Store results
      this.testResults.set(testName, results);
      
      logger.info(`Model loading tests completed. Success rate: ${results.successRate.toFixed(2)}%`);
      
      return results;
    } catch (error) {
      logger.error(`Failed to test model loading: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Tests model orchestration functionality
   * @async
   * @returns {Promise<Object>} Test results
   */
  async testModelOrchestration() {
    try {
      logger.info('Testing model orchestration functionality');
      
      const testName = 'modelOrchestration';
      const startTime = Date.now();
      const results = {
        name: testName,
        startTime,
        endTime: null,
        duration: null,
        tests: [],
        success: 0,
        failure: 0,
        successRate: 0
      };
      
      // Test task types
      const taskTypes = [
        'text-generation',
        'reasoning',
        'code-generation',
        'conversation',
        'summarization',
        'classification'
      ];
      
      // Test model selection for each task type
      for (const taskType of taskTypes) {
        const testResult = {
          name: `Select model for task: ${taskType}`,
          taskType,
          success: false,
          selectedModel: null,
          error: null,
          duration: null
        };
        
        const testStartTime = Date.now();
        
        try {
          logger.debug(`Testing model selection for task type: ${taskType}`);
          
          // Select model for task
          const selectedModel = await this.modelIntegrationManager.modelOrchestrationService.selectModelForTask(taskType);
          
          if (selectedModel && selectedModel.modelId) {
            testResult.success = true;
            testResult.selectedModel = selectedModel.modelId;
            results.success++;
          } else {
            testResult.success = false;
            testResult.error = 'No model selected for task';
            results.failure++;
          }
        } catch (error) {
          testResult.success = false;
          testResult.error = error.message;
          results.failure++;
          logger.error(`Failed to select model for task ${taskType}: ${error.message}`, error);
        }
        
        testResult.duration = Date.now() - testStartTime;
        results.tests.push(testResult);
      }
      
      // Test model loading for tasks
      for (const taskType of taskTypes) {
        const testResult = {
          name: `Load model for task: ${taskType}`,
          taskType,
          success: false,
          loadedModel: null,
          error: null,
          duration: null
        };
        
        const testStartTime = Date.now();
        
        try {
          logger.debug(`Testing model loading for task type: ${taskType}`);
          
          // Ensure model is loaded for task
          const modelInstance = await this.modelIntegrationManager.modelOrchestrationService.ensureModelLoaded(taskType);
          
          if (modelInstance) {
            testResult.success = true;
            testResult.loadedModel = modelInstance.modelId || 'unknown';
            results.success++;
          } else {
            testResult.success = false;
            testResult.error = 'No model loaded for task';
            results.failure++;
          }
        } catch (error) {
          testResult.success = false;
          testResult.error = error.message;
          results.failure++;
          logger.error(`Failed to load model for task ${taskType}: ${error.message}`, error);
        }
        
        testResult.duration = Date.now() - testStartTime;
        results.tests.push(testResult);
      }
      
      // Test model unloading
      const testResult = {
        name: 'Unload unused models',
        success: false,
        unloadedModels: [],
        error: null,
        duration: null
      };
      
      const testStartTime = Date.now();
      
      try {
        logger.debug('Testing unloading of unused models');
        
        // Unload unused models
        const unloadedModels = await this.modelIntegrationManager.modelOrchestrationService.unloadUnusedModels(0);
        
        testResult.success = true;
        testResult.unloadedModels = unloadedModels;
        results.success++;
      } catch (error) {
        testResult.success = false;
        testResult.error = error.message;
        results.failure++;
        logger.error(`Failed to unload unused models: ${error.message}`, error);
      }
      
      testResult.duration = Date.now() - testStartTime;
      results.tests.push(testResult);
      
      // Calculate success rate
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = (results.success / (results.success + results.failure)) * 100;
      
      // Store results
      this.testResults.set(testName, results);
      
      logger.info(`Model orchestration tests completed. Success rate: ${results.successRate.toFixed(2)}%`);
      
      return results;
    } catch (error) {
      logger.error(`Failed to test model orchestration: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Tests text generation functionality
   * @async
   * @returns {Promise<Object>} Test results
   */
  async testTextGeneration() {
    try {
      logger.info('Testing text generation functionality');
      
      const testName = 'textGeneration';
      const startTime = Date.now();
      const results = {
        name: testName,
        startTime,
        endTime: null,
        duration: null,
        tests: [],
        success: 0,
        failure: 0,
        successRate: 0
      };
      
      // Test prompts
      const testPrompts = [
        {
          name: 'Simple question',
          prompt: 'What is the capital of France?',
          taskType: 'text-generation',
          options: { maxTokens: 50 }
        },
        {
          name: 'Reasoning task',
          prompt: 'If a train travels at 60 mph for 3 hours, how far does it go?',
          taskType: 'reasoning',
          options: { maxTokens: 100 }
        },
        {
          name: 'Code generation',
          prompt: 'Write a function to calculate the factorial of a number in JavaScript.',
          taskType: 'code-generation',
          options: { maxTokens: 200 }
        },
        {
          name: 'Conversation',
          prompt: 'Hello, how are you today? Can you tell me about yourself?',
          taskType: 'conversation',
          options: { maxTokens: 150 }
        }
      ];
      
      // Test generation for each prompt
      for (const testPrompt of testPrompts) {
        const testResult = {
          name: `Generate text: ${testPrompt.name}`,
          prompt: testPrompt.prompt,
          taskType: testPrompt.taskType,
          success: false,
          generatedText: null,
          error: null,
          duration: null
        };
        
        const testStartTime = Date.now();
        
        try {
          logger.debug(`Testing text generation for prompt: ${testPrompt.name}`);
          
          // Generate text
          const result = await this.modelIntegrationManager.generateText(
            testPrompt.prompt,
            {
              taskType: testPrompt.taskType,
              ...testPrompt.options
            }
          );
          
          if (result && result.text) {
            testResult.success = true;
            testResult.generatedText = result.text.substring(0, 100) + (result.text.length > 100 ? '...' : '');
            results.success++;
          } else {
            testResult.success = false;
            testResult.error = 'No text generated';
            results.failure++;
          }
        } catch (error) {
          testResult.success = false;
          testResult.error = error.message;
          results.failure++;
          logger.error(`Failed to generate text for prompt "${testPrompt.name}": ${error.message}`, error);
        }
        
        testResult.duration = Date.now() - testStartTime;
        results.tests.push(testResult);
      }
      
      // Calculate success rate
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = (results.success / (results.success + results.failure)) * 100;
      
      // Store results
      this.testResults.set(testName, results);
      
      logger.info(`Text generation tests completed. Success rate: ${results.successRate.toFixed(2)}%`);
      
      return results;
    } catch (error) {
      logger.error(`Failed to test text generation: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Tests offline capability
   * @async
   * @returns {Promise<Object>} Test results
   */
  async testOfflineCapability() {
    try {
      logger.info('Testing offline capability');
      
      const testName = 'offlineCapability';
      const startTime = Date.now();
      const results = {
        name: testName,
        startTime,
        endTime: null,
        duration: null,
        tests: [],
        success: 0,
        failure: 0,
        successRate: 0
      };
      
      // Test offline model loading
      const testResult = {
        name: 'Load models in offline mode',
        success: false,
        loadedModels: [],
        error: null,
        duration: null
      };
      
      const testStartTime = Date.now();
      
      try {
        logger.debug('Testing loading models in offline mode');
        
        // Simulate offline mode by setting a flag
        // In a real implementation, this would involve network disconnection
        this.modelIntegrationManager.modelLoaderService.isOffline = true;
        
        // Get all available models
        const modelRegistry = this.modelIntegrationManager.modelRegistry;
        const models = await modelRegistry.getAllModels();
        
        // Try to load each model
        const loadedModels = [];
        let loadFailures = 0;
        
        for (const model of models) {
          try {
            // Load model
            await this.modelIntegrationManager.modelLoaderService.loadModel(model.id);
            
            // Verify model is loaded
            const modelInfo = await modelRegistry.getModel(model.id);
            
            if (modelInfo && modelInfo.status === 'loaded') {
              loadedModels.push(model.id);
            } else {
              loadFailures++;
            }
            
            // Unload model after test
            await this.modelIntegrationManager.modelLoaderService.unloadModel(model.id);
          } catch (error) {
            loadFailures++;
            logger.error(`Failed to load model ${model.id} in offline mode: ${error.message}`, error);
          }
        }
        
        // Reset offline mode
        this.modelIntegrationManager.modelLoaderService.isOffline = false;
        
        if (loadedModels.length > 0 && loadFailures < models.length) {
          testResult.success = true;
          testResult.loadedModels = loadedModels;
          results.success++;
        } else {
          testResult.success = false;
          testResult.error = 'Failed to load any models in offline mode';
          results.failure++;
        }
      } catch (error) {
        testResult.success = false;
        testResult.error = error.message;
        results.failure++;
        logger.error(`Failed to test offline model loading: ${error.message}`, error);
        
        // Reset offline mode
        this.modelIntegrationManager.modelLoaderService.isOffline = false;
      }
      
      testResult.duration = Date.now() - testStartTime;
      results.tests.push(testResult);
      
      // Test offline text generation
      const offlineGenTest = {
        name: 'Generate text in offline mode',
        success: false,
        generatedText: null,
        error: null,
        duration: null
      };
      
      const genTestStartTime = Date.now();
      
      try {
        logger.debug('Testing text generation in offline mode');
        
        // Simulate offline mode
        this.modelIntegrationManager.modelLoaderService.isOffline = true;
        
        // Generate text
        const result = await this.modelIntegrationManager.generateText(
          'What is the capital of France?',
          {
            taskType: 'text-generation',
            maxTokens: 50,
            offlineOnly: true
          }
        );
        
        // Reset offline mode
        this.modelIntegrationManager.modelLoaderService.isOffline = false;
        
        if (result && result.text) {
          offlineGenTest.success = true;
          offlineGenTest.generatedText = result.text.substring(0, 100) + (result.text.length > 100 ? '...' : '');
          results.success++;
        } else {
          offlineGenTest.success = false;
          offlineGenTest.error = 'No text generated in offline mode';
          results.failure++;
        }
      } catch (error) {
        offlineGenTest.success = false;
        offlineGenTest.error = error.message;
        results.failure++;
        logger.error(`Failed to generate text in offline mode: ${error.message}`, error);
        
        // Reset offline mode
        this.modelIntegrationManager.modelLoaderService.isOffline = false;
      }
      
      offlineGenTest.duration = Date.now() - genTestStartTime;
      results.tests.push(offlineGenTest);
      
      // Calculate success rate
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = (results.success / (results.success + results.failure)) * 100;
      
      // Store results
      this.testResults.set(testName, results);
      
      logger.info(`Offline capability tests completed. Success rate: ${results.successRate.toFixed(2)}%`);
      
      return results;
    } catch (error) {
      logger.error(`Failed to test offline capability: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Tests resource management
   * @async
   * @returns {Promise<Object>} Test results
   */
  async testResourceManagement() {
    try {
      logger.info('Testing resource management');
      
      const testName = 'resourceManagement';
      const startTime = Date.now();
      const results = {
        name: testName,
        startTime,
        endTime: null,
        duration: null,
        tests: [],
        success: 0,
        failure: 0,
        successRate: 0
      };
      
      // Test concurrent model loading
      const concurrentTest = {
        name: 'Concurrent model loading',
        success: false,
        loadedModels: [],
        error: null,
        duration: null
      };
      
      const concurrentStartTime = Date.now();
      
      try {
        logger.debug('Testing concurrent model loading');
        
        // Get all available models
        const modelRegistry = this.modelIntegrationManager.modelRegistry;
        const models = await modelRegistry.getAllModels();
        
        // Set max concurrent models to a low value for testing
        const originalMax = this.modelIntegrationManager.modelOrchestrationService.options.maxConcurrentModels;
        this.modelIntegrationManager.modelOrchestrationService.options.maxConcurrentModels = 2;
        
        // Try to load more models than the max
        const loadPromises = models.slice(0, 4).map(model => 
          this.modelIntegrationManager.modelOrchestrationService.ensureModelLoaded('text-generation', {
            modelId: model.id
          })
        );
        
        const loadedModels = await Promise.all(loadPromises);
        
        // Check how many models are actually loaded
        const loadedModelInfos = await modelRegistry.getLoadedModels();
        
        // Reset max concurrent models
        this.modelIntegrationManager.modelOrchestrationService.options.maxConcurrentModels = originalMax;
        
        // Unload all models
        for (const model of loadedModelInfos) {
          await this.modelIntegrationManager.modelLoaderService.unloadModel(model.id);
        }
        
        if (loadedModelInfos.length <= 2) {
          concurrentTest.success = true;
          concurrentTest.loadedModels = loadedModelInfos.map(m => m.id);
          results.success++;
        } else {
          concurrentTest.success = false;
          concurrentTest.error = `Too many models loaded: ${loadedModelInfos.length} (max: 2)`;
          results.failure++;
        }
      } catch (error) {
        concurrentTest.success = false;
        concurrentTest.error = error.message;
        results.failure++;
        logger.error(`Failed to test concurrent model loading: ${error.message}`, error);
      }
      
      concurrentTest.duration = Date.now() - concurrentStartTime;
      results.tests.push(concurrentTest);
      
      // Test auto-unloading
      const autoUnloadTest = {
        name: 'Auto-unloading unused models',
        success: false,
        unloadedModels: [],
        error: null,
        duration: null
      };
      
      const autoUnloadStartTime = Date.now();
      
      try {
        logger.debug('Testing auto-unloading of unused models');
        
        // Set auto-unload timeout to a low value for testing
        const originalTimeout = this.modelIntegrationManager.modelOrchestrationService.options.autoUnloadTimeout;
        this.modelIntegrationManager.modelOrchestrationService.options.autoUnloadTimeout = 1000; // 1 second
        
        // Load a model
        const modelInstance = await this.modelIntegrationManager.modelOrchestrationService.ensureModelLoaded('text-generation');
        
        if (!modelInstance) {
          throw new Error('Failed to load model for auto-unload test');
        }
        
        const modelId = modelInstance.modelId || 'unknown';
        
        // Wait for auto-unload timeout
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 seconds
        
        // Check if model was unloaded
        const modelRegistry = this.modelIntegrationManager.modelRegistry;
        const modelInfo = await modelRegistry.getModel(modelId);
        
        // Reset auto-unload timeout
        this.modelIntegrationManager.modelOrchestrationService.options.autoUnloadTimeout = originalTimeout;
        
        if (modelInfo && modelInfo.status !== 'loaded') {
          autoUnloadTest.success = true;
          autoUnloadTest.unloadedModels = [modelId];
          results.success++;
        } else {
          autoUnloadTest.success = false;
          autoUnloadTest.error = 'Model was not auto-unloaded';
          results.failure++;
          
          // Manually unload the model
          await this.modelIntegrationManager.modelLoaderService.unloadModel(modelId);
        }
      } catch (error) {
        autoUnloadTest.success = false;
        autoUnloadTest.error = error.message;
        results.failure++;
        logger.error(`Failed to test auto-unloading: ${error.message}`, error);
      }
      
      autoUnloadTest.duration = Date.now() - autoUnloadStartTime;
      results.tests.push(autoUnloadTest);
      
      // Calculate success rate
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = (results.success / (results.success + results.failure)) * 100;
      
      // Store results
      this.testResults.set(testName, results);
      
      logger.info(`Resource management tests completed. Success rate: ${results.successRate.toFixed(2)}%`);
      
      return results;
    } catch (error) {
      logger.error(`Failed to test resource management: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Tests API service
   * @async
   * @returns {Promise<Object>} Test results
   */
  async testAPIService() {
    try {
      logger.info('Testing API service');
      
      const testName = 'apiService';
      const startTime = Date.now();
      const results = {
        name: testName,
        startTime,
        endTime: null,
        duration: null,
        tests: [],
        success: 0,
        failure: 0,
        successRate: 0
      };
      
      // Skip if API service is not enabled
      if (!this.modelIntegrationManager.modelAPIService) {
        logger.warn('API service not enabled, skipping tests');
        
        results.endTime = Date.now();
        results.duration = results.endTime - results.startTime;
        results.successRate = 100; // Not applicable
        
        // Store results
        this.testResults.set(testName, results);
        
        return results;
      }
      
      // Test API endpoints using direct calls to express app
      const apiService = this.modelIntegrationManager.modelAPIService;
      const app = apiService.app;
      
      if (!app) {
        throw new Error('API service app not initialized');
      }
      
      // Helper function to make a request to the API
      const makeRequest = (method, path, body = null) => {
        return new Promise((resolve, reject) => {
          // Create mock request and response objects
          const req = {
            method,
            path,
            body,
            params: {},
            query: {}
          };
          
          // Extract path parameters
          const pathParts = path.split('/');
          if (pathParts.length > 2 && pathParts[1] === 'models' && pathParts[2]) {
            req.params.modelId = pathParts[2];
          }
          
          const res = {
            statusCode: 200,
            headers: {},
            body: null,
            status(code) {
              this.statusCode = code;
              return this;
            },
            json(data) {
              this.body = data;
              resolve({ statusCode: this.statusCode, body: this.body });
            },
            send(data) {
              this.body = data;
              resolve({ statusCode: this.statusCode, body: this.body });
            },
            setHeader(name, value) {
              this.headers[name] = value;
              return this;
            }
          };
          
          // Find matching route handler
          let routeFound = false;
          
          // Check if path matches any registered route
          app._router.stack.forEach(layer => {
            if (layer.route) {
              const route = layer.route;
              const pathRegex = new RegExp(`^${route.path.replace(/:[^/]+/g, '([^/]+)')}$`);
              
              if (pathRegex.test(path) && route.methods[method.toLowerCase()]) {
                routeFound = true;
                
                // Call route handler
                try {
                  route.stack[0].handle(req, res, (err) => {
                    if (err) {
                      reject(err);
                    }
                  });
                } catch (error) {
                  reject(error);
                }
              }
            }
          });
          
          if (!routeFound) {
            reject(new Error(`No matching route found for ${method} ${path}`));
          }
        });
      };
      
      // Test health endpoint
      const healthTest = {
        name: 'API health endpoint',
        endpoint: '/health',
        method: 'GET',
        success: false,
        response: null,
        error: null,
        duration: null
      };
      
      const healthStartTime = Date.now();
      
      try {
        logger.debug('Testing API health endpoint');
        
        const response = await makeRequest('GET', '/health');
        
        if (response.statusCode === 200 && response.body && response.body.status === 'ok') {
          healthTest.success = true;
          healthTest.response = response.body;
          results.success++;
        } else {
          healthTest.success = false;
          healthTest.error = 'Invalid health response';
          healthTest.response = response.body;
          results.failure++;
        }
      } catch (error) {
        healthTest.success = false;
        healthTest.error = error.message;
        results.failure++;
        logger.error(`Failed to test health endpoint: ${error.message}`, error);
      }
      
      healthTest.duration = Date.now() - healthStartTime;
      results.tests.push(healthTest);
      
      // Test models list endpoint
      const modelsListTest = {
        name: 'API models list endpoint',
        endpoint: '/models',
        method: 'GET',
        success: false,
        response: null,
        error: null,
        duration: null
      };
      
      const modelsListStartTime = Date.now();
      
      try {
        logger.debug('Testing API models list endpoint');
        
        const response = await makeRequest('GET', '/models');
        
        if (response.statusCode === 200 && response.body && Array.isArray(response.body.models)) {
          modelsListTest.success = true;
          modelsListTest.response = {
            modelCount: response.body.models.length
          };
          results.success++;
        } else {
          modelsListTest.success = false;
          modelsListTest.error = 'Invalid models list response';
          modelsListTest.response = response.body;
          results.failure++;
        }
      } catch (error) {
        modelsListTest.success = false;
        modelsListTest.error = error.message;
        results.failure++;
        logger.error(`Failed to test models list endpoint: ${error.message}`, error);
      }
      
      modelsListTest.duration = Date.now() - modelsListStartTime;
      results.tests.push(modelsListTest);
      
      // Test text generation endpoint
      const generateTest = {
        name: 'API text generation endpoint',
        endpoint: '/generate',
        method: 'POST',
        success: false,
        response: null,
        error: null,
        duration: null
      };
      
      const generateStartTime = Date.now();
      
      try {
        logger.debug('Testing API text generation endpoint');
        
        // Get a model ID to use
        const modelRegistry = this.modelIntegrationManager.modelRegistry;
        const models = await modelRegistry.getAllModels();
        
        if (models.length === 0) {
          throw new Error('No models available for testing');
        }
        
        const modelId = models[0].id;
        
        const response = await makeRequest('POST', '/generate', {
          modelId,
          prompt: 'What is the capital of France?',
          options: {
            maxTokens: 50
          }
        });
        
        if (response.statusCode === 200 && response.body && response.body.result && response.body.result.text) {
          generateTest.success = true;
          generateTest.response = {
            modelId: response.body.modelId,
            textLength: response.body.result.text.length
          };
          results.success++;
        } else {
          generateTest.success = false;
          generateTest.error = 'Invalid generation response';
          generateTest.response = response.body;
          results.failure++;
        }
      } catch (error) {
        generateTest.success = false;
        generateTest.error = error.message;
        results.failure++;
        logger.error(`Failed to test generation endpoint: ${error.message}`, error);
      }
      
      generateTest.duration = Date.now() - generateStartTime;
      results.tests.push(generateTest);
      
      // Calculate success rate
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.successRate = (results.success / (results.success + results.failure)) * 100;
      
      // Store results
      this.testResults.set(testName, results);
      
      logger.info(`API service tests completed. Success rate: ${results.successRate.toFixed(2)}%`);
      
      return results;
    } catch (error) {
      logger.error(`Failed to test API service: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Calculates overall test results
   * @private
   * @returns {Object} Overall test results
   */
  calculateOverallResults() {
    const overallResults = {
      startTime: null,
      endTime: null,
      duration: null,
      testSuites: [],
      totalTests: 0,
      success: 0,
      failure: 0,
      successRate: 0
    };
    
    // Initialize start time to a high value
    overallResults.startTime = Number.MAX_SAFE_INTEGER;
    
    // Initialize end time to a low value
    overallResults.endTime = 0;
    
    // Process each test suite
    for (const [suiteName, suiteResults] of this.testResults.entries()) {
      // Update start time if earlier
      if (suiteResults.startTime < overallResults.startTime) {
        overallResults.startTime = suiteResults.startTime;
      }
      
      // Update end time if later
      if (suiteResults.endTime > overallResults.endTime) {
        overallResults.endTime = suiteResults.endTime;
      }
      
      // Add test suite summary
      overallResults.testSuites.push({
        name: suiteName,
        tests: suiteResults.tests.length,
        success: suiteResults.success,
        failure: suiteResults.failure,
        successRate: suiteResults.successRate
      });
      
      // Update totals
      overallResults.totalTests += suiteResults.tests.length;
      overallResults.success += suiteResults.success;
      overallResults.failure += suiteResults.failure;
    }
    
    // Calculate duration
    overallResults.duration = overallResults.endTime - overallResults.startTime;
    
    // Calculate overall success rate
    overallResults.successRate = (overallResults.success / (overallResults.success + overallResults.failure)) * 100;
    
    return overallResults;
  }
  
  /**
   * Saves test results to file
   * @async
   * @returns {Promise<string>} Path to results file
   */
  async saveTestResults() {
    try {
      logger.info('Saving test results');
      
      // Calculate overall results
      const overallResults = this.calculateOverallResults();
      
      // Create results object
      const results = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        overall: overallResults,
        suites: Object.fromEntries(this.testResults)
      };
      
      // Create results file path
      const resultsFile = path.join(
        this.options.resultsPath,
        `model_test_results_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );
      
      // Write results to file
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
      
      logger.info(`Test results saved to ${resultsFile}`);
      
      return resultsFile;
    } catch (error) {
      logger.error(`Failed to save test results: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Shuts down the ModelTestSuite
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelTestSuite not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ModelTestSuite');
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelTestSuite shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelTestSuite shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelTestSuite;
