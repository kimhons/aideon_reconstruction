/**
 * @fileoverview Model Registry for the Multi-Modal Integration Tentacle.
 * Manages models used for multi-modal processing.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Model Registry
 * Manages models used for multi-modal processing.
 */
class ModelRegistry {
  /**
   * Creates a new ModelRegistry instance.
   * @param {Object} options - Registry options
   * @param {Object} options.tentacle - Parent tentacle
   * @param {Object} options.config - Configuration system
   * @param {Object} options.logging - Logging system
   * @param {Object} options.events - Event system
   * @param {Object} options.metrics - Metrics system
   */
  constructor(options = {}) {
    this.tentacle = options.tentacle;
    this.config = options.config;
    this.logging = options.logging;
    this.events = options.events;
    this.metrics = options.metrics;
    
    // Create logger
    this.logger = this.logging ? this.logging.createLogger('multi-modal-integration:model-registry') : console;
    
    // Initialize model collections
    this.models = new Map();
    this.modelsByModality = {
      text: new Map(),
      image: new Map(),
      audio: new Map(),
      video: new Map(),
      crossModal: new Map()
    };
    
    // Bind methods
    this.registerModel = this.registerModel.bind(this);
    this.unregisterModel = this.unregisterModel.bind(this);
    this.getModel = this.getModel.bind(this);
    this.listModels = this.listModels.bind(this);
    this.selectModel = this.selectModel.bind(this);
  }
  
  /**
   * Initializes the registry.
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing Model Registry');
      
      // Load configuration
      this.enableModelCaching = this.config ? this.config.get('multi-modal.models.enableCaching', true) : true;
      this.modelCacheSize = this.config ? this.config.get('multi-modal.models.cacheSize', 10) : 10;
      this.defaultModels = this.config ? this.config.get('multi-modal.models.defaults', {}) : {};
      
      // Register built-in models
      await this.registerBuiltInModels();
      
      this.logger.info('Model Registry initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Model Registry:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the registry.
   * @returns {Promise<boolean>} - Whether shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Model Registry');
      
      // Unload all models
      for (const [modelId, model] of this.models.entries()) {
        try {
          if (model.unload) {
            await model.unload();
          }
        } catch (error) {
          this.logger.warn(`Failed to unload model ${modelId}:`, error);
        }
      }
      
      // Clear collections
      this.models.clear();
      for (const modalityMap of Object.values(this.modelsByModality)) {
        modalityMap.clear();
      }
      
      this.logger.info('Model Registry shut down successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Model Registry:', error);
      throw error;
    }
  }
  
  /**
   * Registers built-in models.
   * @returns {Promise<void>}
   * @private
   */
  async registerBuiltInModels() {
    try {
      this.logger.info('Registering built-in models');
      
      // Register text models
      await this.registerModel({
        id: 'text-processor-basic',
        name: 'Basic Text Processor',
        description: 'Basic text processing capabilities',
        modality: 'text',
        type: 'local',
        capabilities: ['understanding', 'generation'],
        version: '1.0.0',
        implementation: new (require('../modality_handlers/models/BasicTextProcessor'))()
      });
      
      // Register image models
      await this.registerModel({
        id: 'image-processor-basic',
        name: 'Basic Image Processor',
        description: 'Basic image processing capabilities',
        modality: 'image',
        type: 'local',
        capabilities: ['understanding', 'generation'],
        version: '1.0.0',
        implementation: new (require('../modality_handlers/models/BasicImageProcessor'))()
      });
      
      // Register audio models
      await this.registerModel({
        id: 'audio-processor-basic',
        name: 'Basic Audio Processor',
        description: 'Basic audio processing capabilities',
        modality: 'audio',
        type: 'local',
        capabilities: ['understanding', 'generation'],
        version: '1.0.0',
        implementation: new (require('../modality_handlers/models/BasicAudioProcessor'))()
      });
      
      // Register video models
      await this.registerModel({
        id: 'video-processor-basic',
        name: 'Basic Video Processor',
        description: 'Basic video processing capabilities',
        modality: 'video',
        type: 'local',
        capabilities: ['understanding', 'generation'],
        version: '1.0.0',
        implementation: new (require('../modality_handlers/models/BasicVideoProcessor'))()
      });
      
      // Register cross-modal models
      await this.registerModel({
        id: 'cross-modal-reasoner-basic',
        name: 'Basic Cross-Modal Reasoner',
        description: 'Basic cross-modal reasoning capabilities',
        modality: 'crossModal',
        type: 'local',
        capabilities: ['reasoning'],
        version: '1.0.0',
        implementation: new (require('../cross_modal_reasoning/models/BasicCrossModalReasoner'))()
      });
      
      this.logger.info('Built-in models registered successfully');
    } catch (error) {
      this.logger.error('Failed to register built-in models:', error);
      throw error;
    }
  }
  
  /**
   * Registers a model.
   * @param {Object} model - Model to register
   * @param {string} model.id - Unique model identifier
   * @param {string} model.name - Human-readable model name
   * @param {string} model.description - Model description
   * @param {string} model.modality - Model modality ('text', 'image', 'audio', 'video', 'crossModal')
   * @param {string} model.type - Model type ('local', 'api', 'hybrid')
   * @param {Array<string>} model.capabilities - Model capabilities
   * @param {string} model.version - Model version
   * @param {Object} model.implementation - Model implementation
   * @param {Object} [options] - Registration options
   * @returns {Promise<Object>} - Registered model
   */
  async registerModel(model, options = {}) {
    try {
      // Validate model
      this.validateModel(model);
      
      // Check if model already exists
      if (this.models.has(model.id)) {
        if (options.overwrite) {
          // Unregister existing model
          await this.unregisterModel(model.id);
        } else {
          throw new Error(`Model with ID ${model.id} already exists`);
        }
      }
      
      // Initialize model if needed
      if (model.implementation && model.implementation.initialize && !model.initialized) {
        await model.implementation.initialize();
        model.initialized = true;
      }
      
      // Add model to collections
      this.models.set(model.id, model);
      
      if (this.modelsByModality[model.modality]) {
        this.modelsByModality[model.modality].set(model.id, model);
      } else {
        this.logger.warn(`Unknown modality: ${model.modality}`);
      }
      
      // Record metric
      if (this.metrics) {
        this.metrics.record('multi-modal.models.register', 1);
        this.metrics.record(`multi-modal.models.${model.modality}.register`, 1);
      }
      
      // Emit event
      if (this.events) {
        this.events.emit('model:registered', { model });
      }
      
      this.logger.info(`Model registered: ${model.id}`);
      return model;
    } catch (error) {
      this.logger.error(`Failed to register model ${model.id}:`, error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.models.register.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Unregisters a model.
   * @param {string} modelId - Model ID
   * @param {Object} [options] - Unregistration options
   * @returns {Promise<boolean>} - Whether unregistration was successful
   */
  async unregisterModel(modelId, options = {}) {
    try {
      // Check if model exists
      const model = this.models.get(modelId);
      
      if (!model) {
        throw new Error(`Model with ID ${modelId} not found`);
      }
      
      // Unload model if needed
      if (model.implementation && model.implementation.unload) {
        await model.implementation.unload();
      }
      
      // Remove model from collections
      this.models.delete(modelId);
      
      if (this.modelsByModality[model.modality]) {
        this.modelsByModality[model.modality].delete(modelId);
      }
      
      // Record metric
      if (this.metrics) {
        this.metrics.record('multi-modal.models.unregister', 1);
        this.metrics.record(`multi-modal.models.${model.modality}.unregister`, 1);
      }
      
      // Emit event
      if (this.events) {
        this.events.emit('model:unregistered', { modelId });
      }
      
      this.logger.info(`Model unregistered: ${modelId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister model ${modelId}:`, error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.models.unregister.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Gets a model by ID.
   * @param {string} modelId - Model ID
   * @returns {Object|null} - Model or null if not found
   */
  getModel(modelId) {
    return this.models.get(modelId) || null;
  }
  
  /**
   * Lists all registered models.
   * @param {Object} [options] - Listing options
   * @param {string} [options.modality] - Filter by modality
   * @param {string} [options.type] - Filter by type
   * @param {string} [options.capability] - Filter by capability
   * @returns {Array<Object>} - List of models
   */
  listModels(options = {}) {
    let models = Array.from(this.models.values());
    
    // Filter by modality
    if (options.modality) {
      models = models.filter(model => model.modality === options.modality);
    }
    
    // Filter by type
    if (options.type) {
      models = models.filter(model => model.type === options.type);
    }
    
    // Filter by capability
    if (options.capability) {
      models = models.filter(model => 
        model.capabilities && model.capabilities.includes(options.capability)
      );
    }
    
    return models;
  }
  
  /**
   * Selects a model for a specific task.
   * @param {Object} task - Task description
   * @param {string} task.modality - Task modality
   * @param {string} task.operation - Task operation
   * @param {Object} [task.input] - Task input
   * @param {Object} [options] - Selection options
   * @param {string} [options.preferredModel] - Preferred model ID
   * @param {string} [options.preferredType] - Preferred model type
   * @param {boolean} [options.offlineOnly] - Whether to select only offline models
   * @returns {Promise<Object>} - Selected model
   */
  async selectModel(task, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Check if preferred model is specified and available
      if (options.preferredModel) {
        const preferredModel = this.getModel(options.preferredModel);
        
        if (preferredModel && this.modelCanHandleTask(preferredModel, task)) {
          return preferredModel;
        }
      }
      
      // Get models for the specified modality
      let candidates = this.modelsByModality[task.modality]
        ? Array.from(this.modelsByModality[task.modality].values())
        : [];
      
      // Filter by operation capability
      candidates = candidates.filter(model => 
        this.modelCanHandleTask(model, task)
      );
      
      // Filter by type if specified
      if (options.preferredType) {
        const typeFiltered = candidates.filter(model => model.type === options.preferredType);
        
        if (typeFiltered.length > 0) {
          candidates = typeFiltered;
        }
      }
      
      // Filter by offline requirement
      if (options.offlineOnly) {
        candidates = candidates.filter(model => model.type === 'local');
      }
      
      // If no candidates, try default model
      if (candidates.length === 0) {
        const defaultModelId = this.defaultModels[task.modality];
        
        if (defaultModelId) {
          const defaultModel = this.getModel(defaultModelId);
          
          if (defaultModel && (!options.offlineOnly || defaultModel.type === 'local')) {
            return defaultModel;
          }
        }
        
        throw new Error(`No suitable model found for ${task.modality} ${task.operation}`);
      }
      
      // Sort candidates by performance score (if available)
      candidates.sort((a, b) => {
        const scoreA = a.performanceScore || 0;
        const scoreB = b.performanceScore || 0;
        return scoreB - scoreA; // Higher score first
      });
      
      // Select the best candidate
      const selectedModel = candidates[0];
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.models.select', 1);
        this.metrics.record(`multi-modal.models.${task.modality}.select`, 1);
        this.metrics.recordTiming('multi-modal.models.select.time', Date.now() - startTime);
      }
      
      return selectedModel;
    } catch (error) {
      this.logger.error('Failed to select model:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.models.select.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Checks if a model can handle a specific task.
   * @param {Object} model - Model to check
   * @param {Object} task - Task description
   * @returns {boolean} - Whether the model can handle the task
   * @private
   */
  modelCanHandleTask(model, task) {
    // Check modality
    if (model.modality !== task.modality) {
      return false;
    }
    
    // Check capabilities
    if (!model.capabilities) {
      return false;
    }
    
    // Map operation to capability
    const requiredCapability = this.mapOperationToCapability(task.operation);
    
    if (!model.capabilities.includes(requiredCapability)) {
      return false;
    }
    
    // Check if model implementation can handle the task
    if (model.implementation && model.implementation.canHandle) {
      return model.implementation.canHandle(task);
    }
    
    return true;
  }
  
  /**
   * Maps an operation to a capability.
   * @param {string} operation - Operation name
   * @returns {string} - Capability name
   * @private
   */
  mapOperationToCapability(operation) {
    const mapping = {
      'process': 'understanding',
      'generate': 'generation',
      'reason': 'reasoning',
      'analyze': 'understanding',
      'transform': 'generation',
      'translate': 'generation',
      'summarize': 'understanding',
      'classify': 'understanding',
      'detect': 'understanding',
      'recognize': 'understanding',
      'segment': 'understanding',
      'enhance': 'generation',
      'synthesize': 'generation',
      'transcribe': 'understanding'
    };
    
    return mapping[operation] || operation;
  }
  
  /**
   * Validates a model.
   * @param {Object} model - Model to validate
   * @throws {Error} If model is invalid
   * @private
   */
  validateModel(model) {
    // Check required fields
    if (!model.id) {
      throw new Error('Model ID is required');
    }
    
    if (!model.name) {
      throw new Error('Model name is required');
    }
    
    if (!model.modality) {
      throw new Error('Model modality is required');
    }
    
    if (!model.type) {
      throw new Error('Model type is required');
    }
    
    if (!model.capabilities || !Array.isArray(model.capabilities) || model.capabilities.length === 0) {
      throw new Error('Model capabilities are required');
    }
    
    if (!model.implementation) {
      throw new Error('Model implementation is required');
    }
    
    // Check modality
    const validModalities = ['text', 'image', 'audio', 'video', 'crossModal'];
    
    if (!validModalities.includes(model.modality)) {
      throw new Error(`Invalid modality: ${model.modality}`);
    }
    
    // Check type
    const validTypes = ['local', 'api', 'hybrid'];
    
    if (!validTypes.includes(model.type)) {
      throw new Error(`Invalid type: ${model.type}`);
    }
    
    // Check implementation
    const requiredMethods = ['run'];
    
    for (const method of requiredMethods) {
      if (typeof model.implementation[method] !== 'function') {
        throw new Error(`Model implementation must have a ${method} method`);
      }
    }
  }
}

module.exports = ModelRegistry;
