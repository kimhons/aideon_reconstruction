/**
 * @fileoverview ModelAPIService provides an API interface for accessing embedded ML models
 * within Aideon Core, enabling both local inference and remote API-based deployment options.
 * 
 * @module core/ml/ModelAPIService
 * @requires core/utils/Logger
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { EventEmitter } = require('events');
const logger = require('../utils/Logger').getLogger('ModelAPIService');

/**
 * @class ModelAPIService
 * @extends EventEmitter
 * @description Service providing API access to embedded ML models
 */
class ModelAPIService extends EventEmitter {
  /**
   * Creates an instance of ModelAPIService
   * @param {Object} options - Configuration options
   * @param {number} options.port - Port to run the API server on
   * @param {string} options.host - Host to bind the API server to
   * @param {boolean} options.enableCors - Whether to enable CORS
   * @param {Object} options.modelLoaderService - ModelLoaderService instance
   * @param {Object} options.modelRegistry - ModelRegistry instance
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      port: 3000,
      host: '0.0.0.0',
      enableCors: true,
      ...options
    };
    
    this.modelLoaderService = options.modelLoaderService;
    this.modelRegistry = options.modelRegistry || (options.modelLoaderService ? options.modelLoaderService.modelRegistry : null);
    this.app = null;
    this.server = null;
    this.isInitialized = false;
    this.isRunning = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.setupRoutes = this.setupRoutes.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelAPIService
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelAPIService already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelAPIService');
      
      // Validate dependencies
      if (!this.modelLoaderService) {
        throw new Error('ModelLoaderService is required');
      }
      
      if (!this.modelRegistry) {
        throw new Error('ModelRegistry is required');
      }
      
      // Create Express app
      this.app = express();
      
      // Configure middleware
      if (this.options.enableCors) {
        this.app.use(cors());
      }
      
      this.app.use(bodyParser.json());
      
      // Set up routes
      this.setupRoutes();
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelAPIService initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelAPIService: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Sets up API routes
   * @private
   */
  setupRoutes() {
    if (!this.app) {
      throw new Error('Express app not initialized');
    }
    
    logger.debug('Setting up API routes');
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now()
      });
    });
    
    // Models list endpoint
    this.app.get('/models', async (req, res) => {
      try {
        const models = await this.modelRegistry.getAllModels();
        
        // Filter out sensitive information
        const filteredModels = models.map(({ instance, ...model }) => model);
        
        res.json({
          models: filteredModels
        });
      } catch (error) {
        logger.error(`Error getting models: ${error.message}`, error);
        res.status(500).json({
          error: 'Failed to get models',
          message: error.message
        });
      }
    });
    
    // Model details endpoint
    this.app.get('/models/:modelId', async (req, res) => {
      try {
        const { modelId } = req.params;
        const model = await this.modelRegistry.getModel(modelId);
        
        if (!model) {
          return res.status(404).json({
            error: 'Model not found',
            message: `Model ${modelId} not found`
          });
        }
        
        // Filter out sensitive information
        const { instance, ...filteredModel } = model;
        
        res.json({
          model: filteredModel
        });
      } catch (error) {
        logger.error(`Error getting model: ${error.message}`, error);
        res.status(500).json({
          error: 'Failed to get model',
          message: error.message
        });
      }
    });
    
    // Text generation endpoint
    this.app.post('/generate', async (req, res) => {
      try {
        const { modelId, prompt, options } = req.body;
        
        if (!modelId) {
          return res.status(400).json({
            error: 'Missing required parameter',
            message: 'modelId is required'
          });
        }
        
        if (!prompt) {
          return res.status(400).json({
            error: 'Missing required parameter',
            message: 'prompt is required'
          });
        }
        
        // Get model
        const model = await this.modelRegistry.getModel(modelId);
        
        if (!model) {
          return res.status(404).json({
            error: 'Model not found',
            message: `Model ${modelId} not found`
          });
        }
        
        // Check if model is loaded
        if (model.status !== 'loaded') {
          // Try to load the model
          logger.info(`Model ${modelId} not loaded, attempting to load`);
          
          try {
            await this.modelLoaderService.loadModel(modelId);
          } catch (loadError) {
            return res.status(500).json({
              error: 'Failed to load model',
              message: loadError.message
            });
          }
        }
        
        // Get updated model after loading
        const loadedModel = await this.modelRegistry.getModel(modelId);
        
        // Generate text
        const result = await loadedModel.instance.generate(prompt, options);
        
        res.json({
          modelId,
          result
        });
      } catch (error) {
        logger.error(`Error generating text: ${error.message}`, error);
        res.status(500).json({
          error: 'Failed to generate text',
          message: error.message
        });
      }
    });
    
    // Tokenization endpoint
    this.app.post('/tokenize', async (req, res) => {
      try {
        const { modelId, text } = req.body;
        
        if (!modelId) {
          return res.status(400).json({
            error: 'Missing required parameter',
            message: 'modelId is required'
          });
        }
        
        if (!text) {
          return res.status(400).json({
            error: 'Missing required parameter',
            message: 'text is required'
          });
        }
        
        // Get model
        const model = await this.modelRegistry.getModel(modelId);
        
        if (!model) {
          return res.status(404).json({
            error: 'Model not found',
            message: `Model ${modelId} not found`
          });
        }
        
        // Check if model is loaded
        if (model.status !== 'loaded') {
          // Try to load the model
          logger.info(`Model ${modelId} not loaded, attempting to load`);
          
          try {
            await this.modelLoaderService.loadModel(modelId);
          } catch (loadError) {
            return res.status(500).json({
              error: 'Failed to load model',
              message: loadError.message
            });
          }
        }
        
        // Get updated model after loading
        const loadedModel = await this.modelRegistry.getModel(modelId);
        
        // Tokenize text
        const result = await loadedModel.instance.tokenize(text);
        
        res.json({
          modelId,
          result
        });
      } catch (error) {
        logger.error(`Error tokenizing text: ${error.message}`, error);
        res.status(500).json({
          error: 'Failed to tokenize text',
          message: error.message
        });
      }
    });
    
    // Model loading endpoint
    this.app.post('/models/:modelId/load', async (req, res) => {
      try {
        const { modelId } = req.params;
        const { options } = req.body || {};
        
        // Check if model exists
        const model = await this.modelRegistry.getModel(modelId);
        
        if (!model) {
          return res.status(404).json({
            error: 'Model not found',
            message: `Model ${modelId} not found`
          });
        }
        
        // Load model
        await this.modelLoaderService.loadModel(modelId, options);
        
        // Get updated model after loading
        const loadedModel = await this.modelRegistry.getModel(modelId);
        
        // Filter out sensitive information
        const { instance, ...filteredModel } = loadedModel;
        
        res.json({
          model: filteredModel,
          message: `Model ${modelId} loaded successfully`
        });
      } catch (error) {
        logger.error(`Error loading model: ${error.message}`, error);
        res.status(500).json({
          error: 'Failed to load model',
          message: error.message
        });
      }
    });
    
    // Model unloading endpoint
    this.app.post('/models/:modelId/unload', async (req, res) => {
      try {
        const { modelId } = req.params;
        
        // Check if model exists
        const model = await this.modelRegistry.getModel(modelId);
        
        if (!model) {
          return res.status(404).json({
            error: 'Model not found',
            message: `Model ${modelId} not found`
          });
        }
        
        // Unload model
        await this.modelLoaderService.unloadModel(modelId);
        
        // Get updated model after unloading
        const unloadedModel = await this.modelRegistry.getModel(modelId);
        
        // Filter out sensitive information
        const { instance, ...filteredModel } = unloadedModel;
        
        res.json({
          model: filteredModel,
          message: `Model ${modelId} unloaded successfully`
        });
      } catch (error) {
        logger.error(`Error unloading model: ${error.message}`, error);
        res.status(500).json({
          error: 'Failed to unload model',
          message: error.message
        });
      }
    });
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      logger.error(`API error: ${err.message}`, err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });
    
    logger.debug('API routes set up successfully');
  }
  
  /**
   * Starts the API server
   * @async
   * @returns {Promise<Object>} Server information
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('ModelAPIService not initialized');
    }
    
    if (this.isRunning) {
      logger.warn('ModelAPIService already running');
      return {
        port: this.options.port,
        host: this.options.host,
        url: `http://${this.options.host === '0.0.0.0' ? 'localhost' : this.options.host}:${this.options.port}`
      };
    }
    
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Starting ModelAPIService on ${this.options.host}:${this.options.port}`);
        
        this.server = this.app.listen(this.options.port, this.options.host, () => {
          this.isRunning = true;
          
          const serverInfo = {
            port: this.options.port,
            host: this.options.host,
            url: `http://${this.options.host === '0.0.0.0' ? 'localhost' : this.options.host}:${this.options.port}`
          };
          
          this.emit('started', serverInfo);
          logger.info(`ModelAPIService started successfully on ${serverInfo.url}`);
          
          resolve(serverInfo);
        });
        
        this.server.on('error', (error) => {
          logger.error(`Server error: ${error.message}`, error);
          this.emit('error', error);
          reject(error);
        });
      } catch (error) {
        logger.error(`Failed to start ModelAPIService: ${error.message}`, error);
        this.emit('error', error);
        reject(error);
      }
    });
  }
  
  /**
   * Stops the API server
   * @async
   * @returns {Promise<boolean>} Stop success status
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      logger.warn('ModelAPIService not running');
      return true;
    }
    
    return new Promise((resolve, reject) => {
      try {
        logger.info('Stopping ModelAPIService');
        
        this.server.close((error) => {
          if (error) {
            logger.error(`Failed to stop server: ${error.message}`, error);
            reject(error);
            return;
          }
          
          this.isRunning = false;
          this.server = null;
          
          this.emit('stopped');
          logger.info('ModelAPIService stopped successfully');
          
          resolve(true);
        });
      } catch (error) {
        logger.error(`Failed to stop ModelAPIService: ${error.message}`, error);
        reject(error);
      }
    });
  }
  
  /**
   * Shuts down the ModelAPIService
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelAPIService not initialized, nothing to shut down');
      return true;
    }
    
    try {
      logger.info('Shutting down ModelAPIService');
      
      // Stop server if running
      if (this.isRunning) {
        await this.stop();
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelAPIService shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelAPIService shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelAPIService;
