/**
 * @fileoverview ModelIntegrationManager provides a unified interface for managing
 * all embedded ML models within Aideon Core, coordinating initialization, loading,
 * and interaction between model components.
 * 
 * @module core/ml/ModelIntegrationManager
 * @requires core/utils/Logger
 */

const { EventEmitter } = require('events');
const path = require('path');
const logger = require('../utils/Logger').getLogger('ModelIntegrationManager');

// Import model services
const ModelLoaderService = require('./ModelLoaderService');
const ModelRegistry = require('./ModelRegistry');
const ModelStorageManager = require('./ModelStorageManager');
const HardwareProfiler = require('./HardwareProfiler');
const QuantizationService = require('./QuantizationService');
const ModelOrchestrationService = require('./ModelOrchestrationService');
const ModelAPIService = require('./ModelAPIService');

// Import model integrations
const DeepSeekV3Integration = require('./models/DeepSeekV3Integration');
const Llama3Integration = require('./models/Llama3Integration');

/**
 * @class ModelIntegrationManager
 * @extends EventEmitter
 * @description Manager for coordinating all ML model components
 */
class ModelIntegrationManager extends EventEmitter {
  /**
   * Creates an instance of ModelIntegrationManager
   * @param {Object} options - Configuration options
   * @param {string} options.modelsBasePath - Base path for model storage
   * @param {boolean} options.enableAPI - Whether to enable the API service
   * @param {number} options.apiPort - Port for the API service
   * @param {boolean} options.enableAutoQuantization - Whether to enable automatic quantization
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      modelsBasePath: path.join(process.cwd(), 'models'),
      enableAPI: true,
      apiPort: 3000,
      enableAutoQuantization: true,
      ...options
    };
    
    // Component instances
    this.modelRegistry = null;
    this.modelLoaderService = null;
    this.modelStorageManager = null;
    this.hardwareProfiler = null;
    this.quantizationService = null;
    this.modelOrchestrationService = null;
    this.modelAPIService = null;
    
    // Model integrations
    this.modelIntegrations = new Map();
    
    this.isInitialized = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.initializeComponents = this.initializeComponents.bind(this);
    this.initializeModelIntegrations = this.initializeModelIntegrations.bind(this);
    this.getModelForTask = this.getModelForTask.bind(this);
    this.generateText = this.generateText.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelIntegrationManager
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelIntegrationManager already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelIntegrationManager');
      
      // Initialize components
      await this.initializeComponents();
      
      // Initialize model integrations
      await this.initializeModelIntegrations();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelIntegrationManager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelIntegrationManager: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Initializes all model components
   * @async
   * @private
   * @returns {Promise<boolean>} Initialization success status
   */
  async initializeComponents() {
    try {
      logger.debug('Initializing model components');
      
      // Initialize ModelRegistry
      this.modelRegistry = new ModelRegistry();
      await this.modelRegistry.initialize();
      
      // Initialize HardwareProfiler
      this.hardwareProfiler = new HardwareProfiler();
      await this.hardwareProfiler.initialize();
      
      // Initialize ModelStorageManager
      this.modelStorageManager = new ModelStorageManager({
        basePath: this.options.modelsBasePath
      });
      await this.modelStorageManager.initialize();
      
      // Initialize QuantizationService
      this.quantizationService = new QuantizationService({
        enableAutoQuantization: this.options.enableAutoQuantization
      });
      await this.quantizationService.initialize(this.hardwareProfiler.getProfile());
      
      // Initialize ModelLoaderService
      this.modelLoaderService = new ModelLoaderService({
        modelRegistry: this.modelRegistry,
        modelStorageManager: this.modelStorageManager,
        quantizationService: this.quantizationService,
        hardwareProfiler: this.hardwareProfiler
      });
      await this.modelLoaderService.initialize();
      
      // Initialize ModelOrchestrationService
      this.modelOrchestrationService = new ModelOrchestrationService({
        modelLoaderService: this.modelLoaderService,
        modelRegistry: this.modelRegistry,
        hardwareProfiler: this.hardwareProfiler
      });
      await this.modelOrchestrationService.initialize();
      
      // Initialize ModelAPIService if enabled
      if (this.options.enableAPI) {
        this.modelAPIService = new ModelAPIService({
          port: this.options.apiPort,
          modelLoaderService: this.modelLoaderService,
          modelRegistry: this.modelRegistry
        });
        await this.modelAPIService.initialize();
        
        // Start API service
        await this.modelAPIService.start();
      }
      
      logger.debug('Model components initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize model components: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Initializes all model integrations
   * @async
   * @private
   * @returns {Promise<boolean>} Initialization success status
   */
  async initializeModelIntegrations() {
    try {
      logger.debug('Initializing model integrations');
      
      // Initialize DeepSeek-V3 integration
      const deepSeekV3 = new DeepSeekV3Integration({
        modelLoaderService: this.modelLoaderService,
        hardwareProfiler: this.hardwareProfiler,
        modelPath: path.join(this.options.modelsBasePath, 'deepseek-v3')
      });
      await deepSeekV3.initialize();
      this.modelIntegrations.set('deepseek-v3', deepSeekV3);
      
      // Initialize Llama 3 integration
      const llama3 = new Llama3Integration({
        modelLoaderService: this.modelLoaderService,
        hardwareProfiler: this.hardwareProfiler,
        modelPath: path.join(this.options.modelsBasePath, 'llama3-70b')
      });
      await llama3.initialize();
      this.modelIntegrations.set('llama3-70b', llama3);
      
      // TODO: Initialize other model integrations as they are implemented
      
      logger.debug('Model integrations initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize model integrations: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Gets a model for a specific task
   * @async
   * @param {string} taskType - Type of task
   * @param {Object} options - Selection options
   * @returns {Promise<Object>} Model instance
   */
  async getModelForTask(taskType, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ModelIntegrationManager not initialized');
    }
    
    try {
      logger.debug(`Getting model for task type: ${taskType}`);
      
      // Use orchestration service to get model
      const modelInstance = await this.modelOrchestrationService.ensureModelLoaded(taskType, options);
      
      return modelInstance;
    } catch (error) {
      logger.error(`Failed to get model for task: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates text using the appropriate model for the task
   * @async
   * @param {string} prompt - Input prompt
   * @param {Object} options - Generation options
   * @param {string} options.taskType - Type of task
   * @param {number} options.maxTokens - Maximum number of tokens to generate
   * @param {number} options.temperature - Temperature for sampling
   * @returns {Promise<Object>} Generation result
   */
  async generateText(prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ModelIntegrationManager not initialized');
    }
    
    try {
      // Default task type is text-generation
      const taskType = options.taskType || 'text-generation';
      
      logger.debug(`Generating text for task type: ${taskType}`);
      
      // Get model for task
      const modelInstance = await this.getModelForTask(taskType, options);
      
      if (!modelInstance) {
        throw new Error(`No suitable model found for task type: ${taskType}`);
      }
      
      // Generate text
      const result = await modelInstance.generate(prompt, options);
      
      return result;
    } catch (error) {
      logger.error(`Failed to generate text: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Shuts down the ModelIntegrationManager
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelIntegrationManager not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ModelIntegrationManager');
      
      // Shut down model integrations
      for (const [modelId, integration] of this.modelIntegrations.entries()) {
        try {
          await integration.shutdown();
          logger.debug(`Shut down model integration: ${modelId}`);
        } catch (error) {
          logger.error(`Error shutting down model integration ${modelId}: ${error.message}`, error);
        }
      }
      
      // Shut down API service if enabled
      if (this.modelAPIService) {
        await this.modelAPIService.shutdown();
      }
      
      // Shut down orchestration service
      if (this.modelOrchestrationService) {
        await this.modelOrchestrationService.shutdown();
      }
      
      // Shut down loader service
      if (this.modelLoaderService) {
        await this.modelLoaderService.shutdown();
      }
      
      // Shut down quantization service
      if (this.quantizationService) {
        await this.quantizationService.shutdown();
      }
      
      // Shut down storage manager
      if (this.modelStorageManager) {
        await this.modelStorageManager.shutdown();
      }
      
      // Shut down hardware profiler
      if (this.hardwareProfiler) {
        await this.hardwareProfiler.shutdown();
      }
      
      // Shut down registry
      if (this.modelRegistry) {
        await this.modelRegistry.shutdown();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelIntegrationManager shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelIntegrationManager shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelIntegrationManager;
