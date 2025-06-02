/**
 * @fileoverview ModelLoaderService is responsible for discovering, loading, and managing
 * machine learning models within Aideon Core. It provides a unified interface for
 * model discovery, validation, and loading with support for different model formats
 * and quantization levels.
 * 
 * @module core/ml/ModelLoaderService
 * @requires core/ml/ModelRegistry
 * @requires core/ml/ModelStorageManager
 * @requires core/ml/QuantizationService
 */

const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const ModelRegistry = require('./ModelRegistry');
const ModelStorageManager = require('./ModelStorageManager');
const QuantizationService = require('./QuantizationService');
const HardwareProfiler = require('./HardwareProfiler');
const logger = require('../utils/Logger').getLogger('ModelLoaderService');

/**
 * @class ModelLoaderService
 * @extends EventEmitter
 * @description Service responsible for discovering, loading, and managing ML models
 */
class ModelLoaderService extends EventEmitter {
  /**
   * Creates an instance of ModelLoaderService
   * @param {Object} options - Configuration options
   * @param {string} options.modelsBasePath - Base path for model storage
   * @param {boolean} options.enableAutoDiscovery - Whether to enable automatic model discovery
   * @param {number} options.discoveryInterval - Interval for model discovery in milliseconds
   * @param {Object} options.modelRegistry - Optional existing ModelRegistry instance
   * @param {Object} options.storageManager - Optional existing ModelStorageManager instance
   * @param {Object} options.quantizationService - Optional existing QuantizationService instance
   * @param {Object} options.hardwareProfiler - Optional existing HardwareProfiler instance
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      modelsBasePath: path.join(process.cwd(), 'models'),
      enableAutoDiscovery: true,
      discoveryInterval: 3600000, // 1 hour
      ...options
    };
    
    this.modelRegistry = options.modelRegistry || new ModelRegistry();
    this.storageManager = options.storageManager || new ModelStorageManager({
      basePath: this.options.modelsBasePath
    });
    this.quantizationService = options.quantizationService || new QuantizationService();
    this.hardwareProfiler = options.hardwareProfiler || new HardwareProfiler();
    
    this.discoveryTimer = null;
    this.isInitialized = false;
    this.isDiscovering = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.discoverModels = this.discoverModels.bind(this);
    this.loadModel = this.loadModel.bind(this);
    this.unloadModel = this.unloadModel.bind(this);
    this.validateModel = this.validateModel.bind(this);
    this.getModelMetadata = this.getModelMetadata.bind(this);
    this.getAvailableModels = this.getAvailableModels.bind(this);
    this.getLoadedModels = this.getLoadedModels.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }
  
  /**
   * Initializes the ModelLoaderService
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('ModelLoaderService already initialized');
      return true;
    }
    
    try {
      logger.info('Initializing ModelLoaderService');
      
      // Ensure models directory exists
      await this.storageManager.ensureStorageReady();
      
      // Initialize hardware profiler
      await this.hardwareProfiler.initialize();
      logger.info(`Hardware profile: ${JSON.stringify(this.hardwareProfiler.getProfile())}`);
      
      // Initialize quantization service with hardware profile
      await this.quantizationService.initialize(this.hardwareProfiler.getProfile());
      
      // Initialize model registry
      await this.modelRegistry.initialize();
      
      // Perform initial model discovery
      if (this.options.enableAutoDiscovery) {
        await this.discoverModels();
        
        // Set up periodic discovery
        this.discoveryTimer = setInterval(
          this.discoverModels,
          this.options.discoveryInterval
        );
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      logger.info('ModelLoaderService initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ModelLoaderService: ${error.message}`, error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Discovers available models in the models directory
   * @async
   * @returns {Promise<Array>} Array of discovered model metadata
   */
  async discoverModels() {
    if (this.isDiscovering) {
      logger.warn('Model discovery already in progress');
      return [];
    }
    
    this.isDiscovering = true;
    this.emit('discoveryStarted');
    
    try {
      logger.info('Starting model discovery');
      
      // Get all model directories
      const modelDirs = await this.storageManager.listModelDirectories();
      logger.debug(`Found ${modelDirs.length} potential model directories`);
      
      const discoveredModels = [];
      
      // Process each model directory
      for (const modelDir of modelDirs) {
        try {
          // Check for model metadata file
          const metadataPath = path.join(modelDir, 'metadata.json');
          if (!fs.existsSync(metadataPath)) {
            logger.debug(`Skipping directory ${modelDir} - no metadata.json found`);
            continue;
          }
          
          // Read and parse metadata
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          
          // Validate metadata
          if (!this.validateModelMetadata(metadata)) {
            logger.warn(`Invalid metadata for model in ${modelDir}`);
            continue;
          }
          
          // Check if model files exist
          const modelFiles = await this.storageManager.listModelFiles(modelDir);
          if (modelFiles.length === 0) {
            logger.warn(`No model files found for ${metadata.id} in ${modelDir}`);
            continue;
          }
          
          // Add quantization info to metadata
          metadata.availableQuantizations = modelFiles.map(file => {
            const match = file.match(/q(\d+)_(\d+)/);
            return match ? { bits: parseInt(match[1]), blockSize: parseInt(match[2]) } : null;
          }).filter(Boolean);
          
          // Register model with registry
          await this.modelRegistry.registerModel({
            ...metadata,
            path: modelDir,
            files: modelFiles,
            status: 'available',
            loadedAt: null,
            lastUsed: null
          });
          
          discoveredModels.push(metadata);
          logger.info(`Discovered model: ${metadata.id} (${metadata.name}), version ${metadata.version}`);
        } catch (error) {
          logger.error(`Error processing model directory ${modelDir}: ${error.message}`, error);
        }
      }
      
      this.isDiscovering = false;
      this.emit('discoveryCompleted', discoveredModels);
      logger.info(`Model discovery completed, found ${discoveredModels.length} valid models`);
      return discoveredModels;
    } catch (error) {
      this.isDiscovering = false;
      logger.error(`Model discovery failed: ${error.message}`, error);
      this.emit('discoveryFailed', error);
      return [];
    }
  }
  
  /**
   * Validates model metadata
   * @param {Object} metadata - Model metadata to validate
   * @returns {boolean} Validation result
   */
  validateModelMetadata(metadata) {
    // Required fields
    const requiredFields = ['id', 'name', 'version', 'type', 'accuracy', 'format'];
    for (const field of requiredFields) {
      if (!metadata[field]) {
        logger.warn(`Missing required metadata field: ${field}`);
        return false;
      }
    }
    
    // Validate accuracy threshold
    if (typeof metadata.accuracy !== 'number' || metadata.accuracy < 93.8) {
      logger.warn(`Model accuracy ${metadata.accuracy} below threshold (93.8%)`);
      return false;
    }
    
    // Validate format
    const supportedFormats = ['ggml', 'gguf', 'onnx'];
    if (!supportedFormats.includes(metadata.format.toLowerCase())) {
      logger.warn(`Unsupported model format: ${metadata.format}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Loads a model by ID with optional quantization parameters
   * @async
   * @param {string} modelId - ID of the model to load
   * @param {Object} options - Loading options
   * @param {Object} options.quantization - Quantization parameters
   * @param {number} options.quantization.bits - Bit precision (4, 5, or 8)
   * @param {number} options.quantization.blockSize - Block size for quantization
   * @param {boolean} options.forceReload - Whether to force reload if already loaded
   * @returns {Promise<Object>} Loaded model instance
   */
  async loadModel(modelId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ModelLoaderService not initialized');
    }
    
    logger.info(`Loading model: ${modelId} with options: ${JSON.stringify(options)}`);
    
    // Check if model is registered
    const modelInfo = await this.modelRegistry.getModel(modelId);
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found in registry`);
    }
    
    // Check if model is already loaded and reload not forced
    if (modelInfo.status === 'loaded' && !options.forceReload) {
      logger.info(`Model ${modelId} already loaded`);
      
      // Update last used timestamp
      await this.modelRegistry.updateModel(modelId, {
        lastUsed: Date.now()
      });
      
      return modelInfo.instance;
    }
    
    // Determine best quantization based on hardware if not specified
    let quantization = options.quantization;
    if (!quantization) {
      const hwProfile = this.hardwareProfiler.getProfile();
      quantization = this.quantizationService.recommendQuantization(
        modelInfo.type,
        modelInfo.size,
        hwProfile
      );
      logger.info(`Selected quantization for ${modelId}: ${JSON.stringify(quantization)}`);
    }
    
    try {
      // Update model status to loading
      await this.modelRegistry.updateModel(modelId, {
        status: 'loading',
        loadStartTime: Date.now()
      });
      
      this.emit('modelLoading', modelId);
      
      // Load the model with appropriate format handler
      const modelInstance = await this.loadModelByFormat(modelInfo, quantization);
      
      // Validate the loaded model
      if (!this.validateModel(modelInstance, modelInfo)) {
        throw new Error(`Model ${modelId} failed validation after loading`);
      }
      
      // Update registry with loaded model info
      await this.modelRegistry.updateModel(modelId, {
        status: 'loaded',
        loadedAt: Date.now(),
        lastUsed: Date.now(),
        instance: modelInstance,
        activeQuantization: quantization
      });
      
      this.emit('modelLoaded', modelId, modelInstance);
      logger.info(`Model ${modelId} loaded successfully`);
      
      return modelInstance;
    } catch (error) {
      // Update registry with error status
      await this.modelRegistry.updateModel(modelId, {
        status: 'error',
        error: error.message
      });
      
      this.emit('modelLoadError', modelId, error);
      logger.error(`Failed to load model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Loads a model using the appropriate format handler
   * @async
   * @private
   * @param {Object} modelInfo - Model information from registry
   * @param {Object} quantization - Quantization parameters
   * @returns {Promise<Object>} Loaded model instance
   */
  async loadModelByFormat(modelInfo, quantization) {
    const format = modelInfo.format.toLowerCase();
    
    switch (format) {
      case 'ggml':
      case 'gguf':
        return this.loadGGMLModel(modelInfo, quantization);
      
      case 'onnx':
        return this.loadONNXModel(modelInfo, quantization);
      
      default:
        throw new Error(`Unsupported model format: ${format}`);
    }
  }
  
  /**
   * Loads a GGML/GGUF format model
   * @async
   * @private
   * @param {Object} modelInfo - Model information from registry
   * @param {Object} quantization - Quantization parameters
   * @returns {Promise<Object>} Loaded model instance
   */
  async loadGGMLModel(modelInfo, quantization) {
    logger.debug(`Loading GGML/GGUF model: ${modelInfo.id}`);
    
    // Find the appropriate model file based on quantization
    const quantString = `q${quantization.bits}_${quantization.blockSize}`;
    const modelFile = modelInfo.files.find(file => file.includes(quantString));
    
    if (!modelFile) {
      throw new Error(`No model file found for ${modelInfo.id} with quantization ${quantString}`);
    }
    
    const modelPath = path.join(modelInfo.path, modelFile);
    
    // TODO: Implement actual GGML/GGUF loading logic
    // This is a placeholder for the actual implementation
    // In a real implementation, this would use a library like llama-node or similar
    
    logger.debug(`Loading model from ${modelPath}`);
    
    // Simulate model loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return a placeholder model instance
    return {
      id: modelInfo.id,
      type: modelInfo.type,
      format: modelInfo.format,
      quantization: quantization,
      path: modelPath,
      // Mock methods that would be provided by the actual model implementation
      generate: async (prompt, options) => {
        logger.debug(`Model ${modelInfo.id} generating with prompt: ${prompt.substring(0, 50)}...`);
        return { text: `Generated text from ${modelInfo.id}` };
      },
      tokenize: (text) => {
        return { tokens: text.split(' ').length, tokenIds: [] };
      },
      getMemoryUsage: () => {
        return { allocated: 1024 * 1024 * 1024, used: 768 * 1024 * 1024 };
      }
    };
  }
  
  /**
   * Loads an ONNX format model
   * @async
   * @private
   * @param {Object} modelInfo - Model information from registry
   * @param {Object} quantization - Quantization parameters
   * @returns {Promise<Object>} Loaded model instance
   */
  async loadONNXModel(modelInfo, quantization) {
    logger.debug(`Loading ONNX model: ${modelInfo.id}`);
    
    // Find the appropriate model file
    const precisionString = quantization.bits === 16 ? 'fp16' : 'int8';
    const modelFile = modelInfo.files.find(file => file.includes(precisionString));
    
    if (!modelFile) {
      throw new Error(`No model file found for ${modelInfo.id} with precision ${precisionString}`);
    }
    
    const modelPath = path.join(modelInfo.path, modelFile);
    
    // TODO: Implement actual ONNX loading logic
    // This is a placeholder for the actual implementation
    // In a real implementation, this would use the ONNX Runtime
    
    logger.debug(`Loading model from ${modelPath}`);
    
    // Simulate model loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return a placeholder model instance
    return {
      id: modelInfo.id,
      type: modelInfo.type,
      format: modelInfo.format,
      precision: precisionString,
      path: modelPath,
      // Mock methods that would be provided by the actual model implementation
      run: async (inputs) => {
        logger.debug(`Model ${modelInfo.id} running with inputs`);
        return { output: [1, 2, 3, 4] };
      },
      getMetadata: () => {
        return { inputs: ['input'], outputs: ['output'] };
      },
      getMemoryUsage: () => {
        return { allocated: 512 * 1024 * 1024, used: 384 * 1024 * 1024 };
      }
    };
  }
  
  /**
   * Unloads a model by ID
   * @async
   * @param {string} modelId - ID of the model to unload
   * @returns {Promise<boolean>} Unload success status
   */
  async unloadModel(modelId) {
    if (!this.isInitialized) {
      throw new Error('ModelLoaderService not initialized');
    }
    
    logger.info(`Unloading model: ${modelId}`);
    
    // Check if model is registered
    const modelInfo = await this.modelRegistry.getModel(modelId);
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found in registry`);
    }
    
    // Check if model is loaded
    if (modelInfo.status !== 'loaded') {
      logger.warn(`Model ${modelId} is not loaded (status: ${modelInfo.status})`);
      return false;
    }
    
    try {
      // Update model status to unloading
      await this.modelRegistry.updateModel(modelId, {
        status: 'unloading'
      });
      
      this.emit('modelUnloading', modelId);
      
      // Perform model-specific cleanup if needed
      if (modelInfo.instance && typeof modelInfo.instance.dispose === 'function') {
        await modelInfo.instance.dispose();
      }
      
      // Update registry
      await this.modelRegistry.updateModel(modelId, {
        status: 'available',
        loadedAt: null,
        instance: null,
        activeQuantization: null
      });
      
      this.emit('modelUnloaded', modelId);
      logger.info(`Model ${modelId} unloaded successfully`);
      
      return true;
    } catch (error) {
      // Update registry with error status
      await this.modelRegistry.updateModel(modelId, {
        status: 'error',
        error: error.message
      });
      
      this.emit('modelUnloadError', modelId, error);
      logger.error(`Failed to unload model ${modelId}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Validates a loaded model
   * @param {Object} modelInstance - Loaded model instance
   * @param {Object} modelInfo - Model information from registry
   * @returns {boolean} Validation result
   */
  validateModel(modelInstance, modelInfo) {
    // Basic validation - check that the model instance exists
    if (!modelInstance) {
      logger.error(`Model instance for ${modelInfo.id} is null or undefined`);
      return false;
    }
    
    // Check for required methods based on model type
    const requiredMethods = [];
    
    switch (modelInfo.type) {
      case 'text-generation':
        requiredMethods.push('generate', 'tokenize');
        break;
      
      case 'embedding':
        requiredMethods.push('embed');
        break;
      
      case 'classification':
        requiredMethods.push('classify');
        break;
      
      case 'token-classification':
        requiredMethods.push('tokenClassify');
        break;
      
      default:
        // For unknown types, just check that it's an object
        return typeof modelInstance === 'object';
    }
    
    // Check that all required methods exist
    for (const method of requiredMethods) {
      if (typeof modelInstance[method] !== 'function') {
        logger.error(`Model ${modelInfo.id} missing required method: ${method}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Gets metadata for a model by ID
   * @async
   * @param {string} modelId - ID of the model
   * @returns {Promise<Object>} Model metadata
   */
  async getModelMetadata(modelId) {
    if (!this.isInitialized) {
      throw new Error('ModelLoaderService not initialized');
    }
    
    const modelInfo = await this.modelRegistry.getModel(modelId);
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found in registry`);
    }
    
    // Return a copy of the metadata without the model instance
    const { instance, ...metadata } = modelInfo;
    return metadata;
  }
  
  /**
   * Gets a list of all available models
   * @async
   * @returns {Promise<Array>} Array of model metadata
   */
  async getAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('ModelLoaderService not initialized');
    }
    
    const models = await this.modelRegistry.getAllModels();
    
    // Return copies without the model instances
    return models.map(({ instance, ...metadata }) => metadata);
  }
  
  /**
   * Gets a list of currently loaded models
   * @async
   * @returns {Promise<Array>} Array of loaded model metadata
   */
  async getLoadedModels() {
    if (!this.isInitialized) {
      throw new Error('ModelLoaderService not initialized');
    }
    
    const models = await this.modelRegistry.getModelsByStatus('loaded');
    
    // Return copies without the model instances
    return models.map(({ instance, ...metadata }) => metadata);
  }
  
  /**
   * Shuts down the ModelLoaderService
   * @async
   * @returns {Promise<boolean>} Shutdown success status
   */
  async shutdown() {
    if (!this.isInitialized) {
      logger.warn('ModelLoaderService not initialized, nothing to shut down');
      return true;
    }
    
    logger.info('Shutting down ModelLoaderService');
    
    try {
      // Clear discovery timer
      if (this.discoveryTimer) {
        clearInterval(this.discoveryTimer);
        this.discoveryTimer = null;
      }
      
      // Unload all loaded models
      const loadedModels = await this.modelRegistry.getModelsByStatus('loaded');
      for (const model of loadedModels) {
        try {
          await this.unloadModel(model.id);
        } catch (error) {
          logger.error(`Error unloading model ${model.id} during shutdown: ${error.message}`);
        }
      }
      
      // Shut down components
      await this.modelRegistry.shutdown();
      await this.storageManager.shutdown();
      await this.quantizationService.shutdown();
      await this.hardwareProfiler.shutdown();
      
      this.isInitialized = false;
      this.emit('shutdown');
      logger.info('ModelLoaderService shut down successfully');
      return true;
    } catch (error) {
      logger.error(`Error during ModelLoaderService shutdown: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = ModelLoaderService;
