/**
 * @fileoverview Model Registry for Aideon Core
 * Provides centralized registration and management of all available models
 * 
 * @module src/core/miif/models/ModelRegistry
 */

const { ModelType, ModelTier } = require('./ModelEnums');
const path = require('path');
const fs = require('fs');

/**
 * Model Registry
 * Manages registration and discovery of all available models in the system
 */
class ModelRegistry {
  /**
   * Create a new Model Registry
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   */
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Initialize model registries
    this.textModels = new Map();
    this.imageModels = new Map();
    this.videoModels = new Map();
    this.multimodalModels = new Map();
    
    // Track loaded models
    this.loadedModels = new Map();
    
    this.logger.info(`[ModelRegistry] Initialized`);
  }
  
  /**
   * Register a model adapter
   * @param {string} modelId - Unique identifier for the model
   * @param {Object} modelAdapter - Model adapter instance
   * @returns {boolean} Success status
   */
  registerModel(modelId, modelAdapter) {
    try {
      if (!modelId || !modelAdapter) {
        throw new Error('Model ID and adapter are required');
      }
      
      if (this.getModel(modelId)) {
        throw new Error(`Model with ID ${modelId} is already registered`);
      }
      
      // Register model in appropriate registry based on type
      switch (modelAdapter.modelType) {
        case ModelType.TEXT:
          this.textModels.set(modelId, modelAdapter);
          break;
        case ModelType.IMAGE:
          this.imageModels.set(modelId, modelAdapter);
          break;
        case ModelType.VIDEO:
          this.videoModels.set(modelId, modelAdapter);
          break;
        case ModelType.MULTIMODAL:
          this.multimodalModels.set(modelId, modelAdapter);
          break;
        default:
          throw new Error(`Unknown model type: ${modelAdapter.modelType}`);
      }
      
      this.logger.info(`[ModelRegistry] Registered model: ${modelId} (${modelAdapter.modelName})`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Failed to register model ${modelId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Unregister a model adapter
   * @param {string} modelId - Unique identifier for the model
   * @returns {boolean} Success status
   */
  unregisterModel(modelId) {
    try {
      if (!modelId) {
        throw new Error('Model ID is required');
      }
      
      // Check if model is loaded
      if (this.loadedModels.has(modelId)) {
        throw new Error(`Cannot unregister model ${modelId} while it is loaded`);
      }
      
      // Find and remove model from appropriate registry
      let removed = false;
      
      if (this.textModels.has(modelId)) {
        this.textModels.delete(modelId);
        removed = true;
      } else if (this.imageModels.has(modelId)) {
        this.imageModels.delete(modelId);
        removed = true;
      } else if (this.videoModels.has(modelId)) {
        this.videoModels.delete(modelId);
        removed = true;
      } else if (this.multimodalModels.has(modelId)) {
        this.multimodalModels.delete(modelId);
        removed = true;
      }
      
      if (!removed) {
        throw new Error(`Model with ID ${modelId} is not registered`);
      }
      
      this.logger.info(`[ModelRegistry] Unregistered model: ${modelId}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Failed to unregister model ${modelId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get a registered model adapter
   * @param {string} modelId - Unique identifier for the model
   * @returns {Object|null} Model adapter or null if not found
   */
  getModel(modelId) {
    if (!modelId) {
      return null;
    }
    
    // Check all registries
    if (this.textModels.has(modelId)) {
      return this.textModels.get(modelId);
    } else if (this.imageModels.has(modelId)) {
      return this.imageModels.get(modelId);
    } else if (this.videoModels.has(modelId)) {
      return this.videoModels.get(modelId);
    } else if (this.multimodalModels.has(modelId)) {
      return this.multimodalModels.get(modelId);
    }
    
    return null;
  }
  
  /**
   * Get all registered models
   * @returns {Array<Object>} Array of all registered model adapters
   */
  getAllModels() {
    const allModels = [];
    
    // Collect models from all registries
    this.textModels.forEach(model => allModels.push(model));
    this.imageModels.forEach(model => allModels.push(model));
    this.videoModels.forEach(model => allModels.push(model));
    this.multimodalModels.forEach(model => allModels.push(model));
    
    return allModels;
  }
  
  /**
   * Get models by type
   * @param {string} modelType - Model type (from ModelType enum)
   * @returns {Array<Object>} Array of model adapters of the specified type
   */
  getModelsByType(modelType) {
    if (!modelType) {
      return [];
    }
    
    // Get models from appropriate registry
    switch (modelType) {
      case ModelType.TEXT:
        return Array.from(this.textModels.values());
      case ModelType.IMAGE:
        return Array.from(this.imageModels.values());
      case ModelType.VIDEO:
        return Array.from(this.videoModels.values());
      case ModelType.MULTIMODAL:
        return Array.from(this.multimodalModels.values());
      default:
        return [];
    }
  }
  
  /**
   * Get models by tier
   * @param {string} tier - Model tier (from ModelTier enum)
   * @returns {Array<Object>} Array of model adapters of the specified tier
   */
  getModelsByTier(tier) {
    if (!tier) {
      return [];
    }
    
    // Collect models from all registries that match the tier
    const models = [];
    
    this.getAllModels().forEach(model => {
      if (model.modelTier === tier) {
        models.push(model);
      }
    });
    
    return models;
  }
  
  /**
   * Get models by type and tier
   * @param {string} modelType - Model type (from ModelType enum)
   * @param {string} tier - Model tier (from ModelTier enum)
   * @returns {Array<Object>} Array of model adapters of the specified type and tier
   */
  getModelsByTypeAndTier(modelType, tier) {
    if (!modelType || !tier) {
      return [];
    }
    
    // Get models by type first
    const modelsByType = this.getModelsByType(modelType);
    
    // Filter by tier
    return modelsByType.filter(model => model.modelTier === tier);
  }
  
  /**
   * Get models by accuracy threshold
   * @param {number} threshold - Minimum accuracy threshold
   * @returns {Array<Object>} Array of model adapters meeting the accuracy threshold
   */
  getModelsByAccuracy(threshold) {
    if (typeof threshold !== 'number') {
      return [];
    }
    
    // Collect models from all registries that meet the accuracy threshold
    const models = [];
    
    this.getAllModels().forEach(model => {
      if (model.accuracy >= threshold) {
        models.push(model);
      }
    });
    
    return models;
  }
  
  /**
   * Get best model for task
   * @param {Object} params - Task parameters
   * @param {string} params.modelType - Model type (from ModelType enum)
   * @param {string} [params.tier] - Model tier (from ModelTier enum)
   * @param {number} [params.minAccuracy] - Minimum accuracy threshold
   * @param {boolean} [params.offlineOnly] - Whether to only consider models that work offline
   * @param {boolean} [params.preferApi] - Whether to prefer API-based models when online
   * @returns {Object|null} Best model adapter for the task or null if none found
   */
  getBestModelForTask(params) {
    const { modelType, tier, minAccuracy, offlineOnly, preferApi } = params;
    
    if (!modelType) {
      return null;
    }
    
    try {
      // Get models by type
      let candidates = this.getModelsByType(modelType);
      
      // Filter by tier if specified
      if (tier) {
        candidates = candidates.filter(model => model.modelTier === tier);
      }
      
      // Filter by minimum accuracy if specified
      if (typeof minAccuracy === 'number') {
        candidates = candidates.filter(model => model.accuracy >= minAccuracy);
      }
      
      // Filter by offline capability if required
      if (offlineOnly) {
        candidates = candidates.filter(model => !model.onlineOnly);
      }
      
      // If no candidates found, return null
      if (candidates.length === 0) {
        return null;
      }
      
      // Sort candidates by preference
      candidates.sort((a, b) => {
        // If preferApi is true and we're online, prefer API-based models
        if (preferApi && this._isOnline()) {
          if (a.hybridCapable && !b.hybridCapable) return -1;
          if (!a.hybridCapable && b.hybridCapable) return 1;
        }
        
        // Otherwise, sort by accuracy
        return b.accuracy - a.accuracy;
      });
      
      // Return the best candidate
      return candidates[0];
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Failed to get best model for task: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Track model load status
   * @param {string} modelId - Unique identifier for the model
   * @param {boolean} isLoaded - Whether the model is loaded
   * @returns {boolean} Success status
   */
  trackModelLoadStatus(modelId, isLoaded) {
    try {
      if (!modelId) {
        throw new Error('Model ID is required');
      }
      
      const model = this.getModel(modelId);
      if (!model) {
        throw new Error(`Model with ID ${modelId} is not registered`);
      }
      
      if (isLoaded) {
        this.loadedModels.set(modelId, true);
      } else {
        this.loadedModels.delete(modelId);
      }
      
      this.logger.debug(`[ModelRegistry] Model ${modelId} load status: ${isLoaded ? 'loaded' : 'unloaded'}`);
      return true;
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Failed to track model load status: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get loaded models
   * @returns {Array<Object>} Array of loaded model adapters
   */
  getLoadedModels() {
    const loadedModels = [];
    
    this.loadedModels.forEach((_, modelId) => {
      const model = this.getModel(modelId);
      if (model) {
        loadedModels.push(model);
      }
    });
    
    return loadedModels;
  }
  
  /**
   * Check if a model is loaded
   * @param {string} modelId - Unique identifier for the model
   * @returns {boolean} Whether the model is loaded
   */
  isModelLoaded(modelId) {
    return this.loadedModels.has(modelId);
  }
  
  /**
   * Discover and register models from directory
   * @param {string} modelsDir - Directory containing model adapters
   * @returns {Promise<number>} Number of models registered
   */
  async discoverAndRegisterModels(modelsDir) {
    try {
      if (!modelsDir) {
        throw new Error('Models directory is required');
      }
      
      if (!fs.existsSync(modelsDir)) {
        throw new Error(`Models directory does not exist: ${modelsDir}`);
      }
      
      this.logger.info(`[ModelRegistry] Discovering models in ${modelsDir}`);
      
      // Discover model types
      const modelTypes = ['text', 'image', 'video', 'multimodal'];
      let registeredCount = 0;
      
      for (const type of modelTypes) {
        const typeDir = path.join(modelsDir, type);
        
        if (!fs.existsSync(typeDir)) {
          this.logger.debug(`[ModelRegistry] ${type} models directory does not exist, skipping`);
          continue;
        }
        
        // Get subdirectories (one per model)
        const modelDirs = fs.readdirSync(typeDir).filter(dir => {
          return fs.statSync(path.join(typeDir, dir)).isDirectory();
        });
        
        for (const modelDir of modelDirs) {
          try {
            // Look for adapter file
            const adapterFile = fs.readdirSync(path.join(typeDir, modelDir)).find(file => {
              return file.endsWith('Adapter.js') || file.endsWith('ModelAdapter.js');
            });
            
            if (!adapterFile) {
              this.logger.debug(`[ModelRegistry] No adapter file found for ${type}/${modelDir}, skipping`);
              continue;
            }
            
            // Load adapter class
            const adapterPath = path.join(typeDir, modelDir, adapterFile);
            const AdapterClass = require(adapterPath);
            
            // Create adapter instance
            const adapter = new AdapterClass(this.options, this.dependencies);
            
            // Register model
            const modelId = `${type}.${modelDir}`;
            if (this.registerModel(modelId, adapter)) {
              registeredCount++;
            }
            
          } catch (error) {
            this.logger.error(`[ModelRegistry] Failed to register model ${type}/${modelDir}: ${error.message}`);
          }
        }
      }
      
      this.logger.info(`[ModelRegistry] Discovered and registered ${registeredCount} models`);
      return registeredCount;
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Failed to discover models: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Register built-in models
   * @returns {Promise<number>} Number of models registered
   */
  async registerBuiltInModels() {
    try {
      this.logger.info(`[ModelRegistry] Registering built-in models`);
      
      // Import model adapters
      const Qwen2ModelAdapter = require('./text/qwen2/Qwen2ModelAdapter');
      const Llama370BModelAdapter = require('./text/llama3_70b/Llama370BModelAdapter');
      const Mixtral8x22BModelAdapter = require('./text/mixtral_8x22b/Mixtral8x22BModelAdapter');
      const MistralLargeModelAdapter = require('./text/mistral_large/MistralLargeModelAdapter');
      const RobertaXLModelAdapter = require('./text/roberta_xl/RobertaXLModelAdapter');
      const Llama318BModelAdapter = require('./text/llama3_1_8b/Llama318BModelAdapter');
      const OpenHermes3ModelAdapter = require('./text/openhermes3/OpenHermes3ModelAdapter');
      const Gemma2527BModelAdapter = require('./text/gemma2_5_27b/Gemma2527BModelAdapter');
      
      const StableDiffusionXLAdapter = require('./image/StableDiffusionXLAdapter');
      const CLIPModelAdapter = require('./image/CLIPModelAdapter');
      const MobileViTAdapter = require('./image/MobileViTAdapter');
      const GoogleVisionModelAdapter = require('./image/GoogleVisionModelAdapter');
      
      const VideoLLaMAAdapter = require('./video/VideoLLaMAAdapter');
      const VideoMambaAdapter = require('./video/VideoMambaAdapter');
      const EfficientVideoNetAdapter = require('./video/EfficientVideoNetAdapter');
      const GoogleVideoIntelligenceModelAdapter = require('./video/GoogleVideoIntelligenceModelAdapter');
      
      // Create instances
      const models = [
        { id: 'text.qwen2', adapter: new Qwen2ModelAdapter(this.options, this.dependencies) },
        { id: 'text.llama3_70b', adapter: new Llama370BModelAdapter(this.options, this.dependencies) },
        { id: 'text.mixtral_8x22b', adapter: new Mixtral8x22BModelAdapter(this.options, this.dependencies) },
        { id: 'text.mistral_large', adapter: new MistralLargeModelAdapter(this.options, this.dependencies) },
        { id: 'text.roberta_xl', adapter: new RobertaXLModelAdapter(this.options, this.dependencies) },
        { id: 'text.llama3_1_8b', adapter: new Llama318BModelAdapter(this.options, this.dependencies) },
        { id: 'text.openhermes3', adapter: new OpenHermes3ModelAdapter(this.options, this.dependencies) },
        { id: 'text.gemma2_5_27b', adapter: new Gemma2527BModelAdapter(this.options, this.dependencies) },
        
        { id: 'image.stable_diffusion_xl', adapter: new StableDiffusionXLAdapter(this.options, this.dependencies) },
        { id: 'image.clip', adapter: new CLIPModelAdapter(this.options, this.dependencies) },
        { id: 'image.mobilevit', adapter: new MobileViTAdapter(this.options, this.dependencies) },
        { id: 'image.google_vision', adapter: new GoogleVisionModelAdapter(this.options, this.dependencies) },
        
        { id: 'video.videollama', adapter: new VideoLLaMAAdapter(this.options, this.dependencies) },
        { id: 'video.videomamba', adapter: new VideoMambaAdapter(this.options, this.dependencies) },
        { id: 'video.efficientvideo', adapter: new EfficientVideoNetAdapter(this.options, this.dependencies) },
        { id: 'video.google_video_intelligence', adapter: new GoogleVideoIntelligenceModelAdapter(this.options, this.dependencies) }
      ];
      
      // Register models
      let registeredCount = 0;
      for (const { id, adapter } of models) {
        if (this.registerModel(id, adapter)) {
          registeredCount++;
        }
      }
      
      this.logger.info(`[ModelRegistry] Registered ${registeredCount} built-in models`);
      return registeredCount;
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Failed to register built-in models: ${error.message}`);
      return 0;
    }
  }
  
  // ====================================================================
  // PRIVATE METHODS
  // ====================================================================
  
  /**
   * Check if system is online
   * @returns {boolean} Whether the system is online
   * @private
   */
  _isOnline() {
    // This is a placeholder for the actual implementation
    
    try {
      // In a real implementation, this would check internet connectivity
      
      // For simulation, check if the network dependency is available
      if (!this.dependencies.network) {
        return false;
      }
      
      return this.dependencies.network.isOnline();
      
    } catch (error) {
      this.logger.error(`[ModelRegistry] Online status check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = ModelRegistry;
