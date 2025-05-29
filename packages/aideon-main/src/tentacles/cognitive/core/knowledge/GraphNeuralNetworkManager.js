/**
 * @fileoverview GraphNeuralNetworkManager for the Knowledge Graph Manager.
 * Provides relationship prediction and knowledge graph completion capabilities.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * Embedding model types for graph neural networks.
 * @enum {string}
 */
const EmbeddingModelType = {
  /**
   * TransE model for knowledge graph embeddings.
   */
  TRANSE: 'transe',
  
  /**
   * DistMult model for knowledge graph embeddings.
   */
  DISTMULT: 'distmult',
  
  /**
   * ComplEx model for knowledge graph embeddings.
   */
  COMPLEX: 'complex',
  
  /**
   * RotatE model for knowledge graph embeddings.
   */
  ROTATE: 'rotate',
  
  /**
   * Graph Convolutional Network model.
   */
  GCN: 'gcn',
  
  /**
   * Graph Attention Network model.
   */
  GAT: 'gat',
  
  /**
   * Graph SAGE model.
   */
  GRAPHSAGE: 'graphsage'
};

/**
 * Prediction task types for graph neural networks.
 * @enum {string}
 */
const PredictionTaskType = {
  /**
   * Link prediction (predicting relationships between entities).
   */
  LINK_PREDICTION: 'link_prediction',
  
  /**
   * Node classification (predicting node types or properties).
   */
  NODE_CLASSIFICATION: 'node_classification',
  
  /**
   * Graph classification (predicting properties of entire subgraphs).
   */
  GRAPH_CLASSIFICATION: 'graph_classification',
  
  /**
   * Knowledge graph completion (predicting missing entities or relationships).
   */
  KNOWLEDGE_GRAPH_COMPLETION: 'knowledge_graph_completion'
};

/**
 * Provides relationship prediction and knowledge graph completion capabilities.
 */
class GraphNeuralNetworkManager extends EventEmitter {
  /**
   * Creates a new GraphNeuralNetworkManager instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.securityManager] - Security manager
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} options.storageAdapter - Graph storage adapter
   */
  constructor(options = {}) {
    super();
    
    if (!options.storageAdapter) {
      throw new Error('GraphNeuralNetworkManager requires a storageAdapter instance');
    }
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    
    this.initialized = false;
    this.models = new Map();
    this.embeddingCache = new Map();
  }
  
  /**
   * Initializes the graph neural network manager.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing GraphNeuralNetworkManager');
    }
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_initialize');
    }
    
    try {
      // Load configuration if available
      if (this.configService) {
        const config = this.configService.get('cognitive.knowledge.graphNeuralNetwork', {
          defaultEmbeddingDimension: 128,
          defaultModelType: EmbeddingModelType.TRANSE,
          enableGPUAcceleration: false,
          embeddingCacheSize: 10000,
          modelCacheDirectory: path.join(os.tmpdir(), 'aideon', 'gnn_models'),
          trainingBatchSize: 64,
          trainingEpochs: 100,
          evaluationFrequency: 10,
          learningRate: 0.001,
          regularizationWeight: 0.0001
        });
        
        this.config = config;
      } else {
        this.config = {
          defaultEmbeddingDimension: 128,
          defaultModelType: EmbeddingModelType.TRANSE,
          enableGPUAcceleration: false,
          embeddingCacheSize: 10000,
          modelCacheDirectory: path.join(os.tmpdir(), 'aideon', 'gnn_models'),
          trainingBatchSize: 64,
          trainingEpochs: 100,
          evaluationFrequency: 10,
          learningRate: 0.001,
          regularizationWeight: 0.0001
        };
      }
      
      // Create model cache directory if it doesn't exist
      await this._ensureModelCacheDirectory();
      
      // Initialize default models
      await this._initializeDefaultModels();
      
      this.initialized = true;
      
      if (this.logger) {
        this.logger.info('GraphNeuralNetworkManager initialized successfully');
      }
      
      this.emit('initialized');
    } catch (error) {
      if (this.logger) {
        this.logger.error('GraphNeuralNetworkManager initialization failed', { error: error.message, stack: error.stack });
      }
      throw new Error(`GraphNeuralNetworkManager initialization failed: ${error.message}`);
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Ensures the manager is initialized before performing operations.
   * 
   * @private
   * @throws {Error} If the manager is not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('GraphNeuralNetworkManager is not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Ensures the model cache directory exists.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _ensureModelCacheDirectory() {
    try {
      await fs.mkdir(this.config.modelCacheDirectory, { recursive: true });
      
      if (this.logger) {
        this.logger.debug(`Created model cache directory: ${this.config.modelCacheDirectory}`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to create model cache directory: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }
  
  /**
   * Initializes default models.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _initializeDefaultModels() {
    try {
      // Initialize default TransE model
      await this.createModel(
        'default_transe',
        EmbeddingModelType.TRANSE,
        this.config.defaultEmbeddingDimension
      );
      
      // Initialize default GCN model
      await this.createModel(
        'default_gcn',
        EmbeddingModelType.GCN,
        this.config.defaultEmbeddingDimension
      );
      
      if (this.logger) {
        this.logger.debug('Initialized default models');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to initialize default models: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }
  
  /**
   * Creates a new graph neural network model.
   * 
   * @param {string} modelId - Unique identifier for the model
   * @param {EmbeddingModelType} modelType - Type of embedding model
   * @param {number} [embeddingDimension] - Dimension of embeddings
   * @param {Object} [modelParams={}] - Additional model parameters
   * @returns {Promise<Object>} - Created model
   */
  async createModel(modelId, modelType, embeddingDimension = this.config.defaultEmbeddingDimension, modelParams = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_createModel');
    }
    
    try {
      // Validate model type
      if (!Object.values(EmbeddingModelType).includes(modelType)) {
        throw new Error(`Invalid model type: ${modelType}`);
      }
      
      // Check if model already exists
      if (this.models.has(modelId)) {
        throw new Error(`Model with ID ${modelId} already exists`);
      }
      
      // Create model configuration
      const modelConfig = {
        id: modelId,
        type: modelType,
        embeddingDimension,
        params: {
          ...modelParams,
          learningRate: modelParams.learningRate || this.config.learningRate,
          regularizationWeight: modelParams.regularizationWeight || this.config.regularizationWeight
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trainingStatus: 'initialized',
          trainingProgress: 0,
          evaluationMetrics: {}
        }
      };
      
      // Initialize model based on type
      const model = await this._initializeModelByType(modelConfig);
      
      // Store model
      this.models.set(modelId, model);
      
      // Save model configuration to cache
      await this._saveModelConfig(modelId, modelConfig);
      
      if (this.logger) {
        this.logger.debug(`Created model ${modelId} of type ${modelType}`);
      }
      
      this.emit('modelCreated', { modelId, modelType, embeddingDimension });
      
      return model;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to create model ${modelId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Initializes a model based on its type.
   * 
   * @private
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<Object>} - Initialized model
   */
  async _initializeModelByType(modelConfig) {
    // In a real implementation, this would initialize the appropriate model architecture
    // For this implementation, we'll create a simplified model structure
    
    const model = {
      ...modelConfig,
      embeddings: {
        entities: new Map(),
        relations: new Map()
      },
      forward: async (input) => {
        // Simplified forward pass implementation
        return this._modelForward(modelConfig, input);
      },
      train: async (trainingData, options = {}) => {
        // Simplified training implementation
        return this._trainModel(modelConfig, trainingData, options);
      },
      predict: async (input) => {
        // Simplified prediction implementation
        return this._modelPredict(modelConfig, input);
      },
      getEmbedding: (entityId) => {
        // Get entity embedding
        return model.embeddings.entities.get(entityId);
      },
      getRelationEmbedding: (relationId) => {
        // Get relation embedding
        return model.embeddings.relations.get(relationId);
      }
    };
    
    return model;
  }
  
  /**
   * Simplified model forward pass implementation.
   * 
   * @private
   * @param {Object} modelConfig - Model configuration
   * @param {Object} input - Input data
   * @returns {Promise<Object>} - Model output
   */
  async _modelForward(modelConfig, input) {
    // This is a simplified implementation
    // In a real implementation, this would perform the actual model computation
    
    const { headEntityId, relationId, tailEntityId } = input;
    
    const model = this.models.get(modelConfig.id);
    if (!model) {
      throw new Error(`Model ${modelConfig.id} not found`);
    }
    
    // Get embeddings
    const headEmbedding = model.embeddings.entities.get(headEntityId);
    const relationEmbedding = model.embeddings.relations.get(relationId);
    const tailEmbedding = model.embeddings.entities.get(tailEntityId);
    
    if (!headEmbedding || !relationEmbedding || !tailEmbedding) {
      throw new Error('Missing embeddings for input entities or relation');
    }
    
    // Compute score based on model type
    let score;
    
    switch (modelConfig.type) {
      case EmbeddingModelType.TRANSE:
        // TransE: ||h + r - t||
        score = this._computeTransEScore(headEmbedding, relationEmbedding, tailEmbedding);
        break;
      case EmbeddingModelType.DISTMULT:
        // DistMult: <h, r, t>
        score = this._computeDistMultScore(headEmbedding, relationEmbedding, tailEmbedding);
        break;
      case EmbeddingModelType.COMPLEX:
        // ComplEx: Re(<h, r, conj(t)>)
        score = this._computeComplExScore(headEmbedding, relationEmbedding, tailEmbedding);
        break;
      case EmbeddingModelType.ROTATE:
        // RotatE: ||h ◦ r - t||
        score = this._computeRotatEScore(headEmbedding, relationEmbedding, tailEmbedding);
        break;
      case EmbeddingModelType.GCN:
      case EmbeddingModelType.GAT:
      case EmbeddingModelType.GRAPHSAGE:
        // For GNN models, use a simplified scoring function
        score = this._computeGNNScore(headEmbedding, relationEmbedding, tailEmbedding);
        break;
      default:
        throw new Error(`Unsupported model type: ${modelConfig.type}`);
    }
    
    return { score };
  }
  
  /**
   * Compute TransE score.
   * 
   * @private
   * @param {Array<number>} headEmbedding - Head entity embedding
   * @param {Array<number>} relationEmbedding - Relation embedding
   * @param {Array<number>} tailEmbedding - Tail entity embedding
   * @returns {number} - Score
   */
  _computeTransEScore(headEmbedding, relationEmbedding, tailEmbedding) {
    // TransE: ||h + r - t||
    let score = 0;
    
    for (let i = 0; i < headEmbedding.length; i++) {
      const diff = headEmbedding[i] + relationEmbedding[i] - tailEmbedding[i];
      score += diff * diff;
    }
    
    return -Math.sqrt(score); // Negative distance (higher is better)
  }
  
  /**
   * Compute DistMult score.
   * 
   * @private
   * @param {Array<number>} headEmbedding - Head entity embedding
   * @param {Array<number>} relationEmbedding - Relation embedding
   * @param {Array<number>} tailEmbedding - Tail entity embedding
   * @returns {number} - Score
   */
  _computeDistMultScore(headEmbedding, relationEmbedding, tailEmbedding) {
    // DistMult: <h, r, t>
    let score = 0;
    
    for (let i = 0; i < headEmbedding.length; i++) {
      score += headEmbedding[i] * relationEmbedding[i] * tailEmbedding[i];
    }
    
    return score;
  }
  
  /**
   * Compute ComplEx score.
   * 
   * @private
   * @param {Array<number>} headEmbedding - Head entity embedding
   * @param {Array<number>} relationEmbedding - Relation embedding
   * @param {Array<number>} tailEmbedding - Tail entity embedding
   * @returns {number} - Score
   */
  _computeComplExScore(headEmbedding, relationEmbedding, tailEmbedding) {
    // ComplEx: Re(<h, r, conj(t)>)
    // This is a simplified implementation
    const dim = headEmbedding.length / 2;
    let score = 0;
    
    for (let i = 0; i < dim; i++) {
      const hRe = headEmbedding[i];
      const hIm = headEmbedding[i + dim];
      const rRe = relationEmbedding[i];
      const rIm = relationEmbedding[i + dim];
      const tRe = tailEmbedding[i];
      const tIm = tailEmbedding[i + dim];
      
      score += hRe * rRe * tRe + hIm * rIm * tRe + hRe * rIm * tIm - hIm * rRe * tIm;
    }
    
    return score;
  }
  
  /**
   * Compute RotatE score.
   * 
   * @private
   * @param {Array<number>} headEmbedding - Head entity embedding
   * @param {Array<number>} relationEmbedding - Relation embedding
   * @param {Array<number>} tailEmbedding - Tail entity embedding
   * @returns {number} - Score
   */
  _computeRotatEScore(headEmbedding, relationEmbedding, tailEmbedding) {
    // RotatE: ||h ◦ r - t||
    // This is a simplified implementation
    const dim = headEmbedding.length / 2;
    let score = 0;
    
    for (let i = 0; i < dim; i++) {
      const hRe = headEmbedding[i];
      const hIm = headEmbedding[i + dim];
      const rRe = relationEmbedding[i];
      const rIm = relationEmbedding[i + dim];
      const tRe = tailEmbedding[i];
      const tIm = tailEmbedding[i + dim];
      
      // Complex multiplication: h ◦ r
      const hrRe = hRe * rRe - hIm * rIm;
      const hrIm = hRe * rIm + hIm * rRe;
      
      // Distance: ||h ◦ r - t||
      const diffRe = hrRe - tRe;
      const diffIm = hrIm - tIm;
      
      score += diffRe * diffRe + diffIm * diffIm;
    }
    
    return -Math.sqrt(score); // Negative distance (higher is better)
  }
  
  /**
   * Compute GNN score.
   * 
   * @private
   * @param {Array<number>} headEmbedding - Head entity embedding
   * @param {Array<number>} relationEmbedding - Relation embedding
   * @param {Array<number>} tailEmbedding - Tail entity embedding
   * @returns {number} - Score
   */
  _computeGNNScore(headEmbedding, relationEmbedding, tailEmbedding) {
    // Simplified GNN scoring function
    // Compute cosine similarity between transformed head and tail
    let dotProduct = 0;
    let headNorm = 0;
    let tailNorm = 0;
    
    for (let i = 0; i < headEmbedding.length; i++) {
      // Transform head with relation
      const transformedHead = headEmbedding[i] * relationEmbedding[i];
      
      dotProduct += transformedHead * tailEmbedding[i];
      headNorm += transformedHead * transformedHead;
      tailNorm += tailEmbedding[i] * tailEmbedding[i];
    }
    
    headNorm = Math.sqrt(headNorm);
    tailNorm = Math.sqrt(tailNorm);
    
    return dotProduct / (headNorm * tailNorm);
  }
  
  /**
   * Simplified model training implementation.
   * 
   * @private
   * @param {Object} modelConfig - Model configuration
   * @param {Array<Object>} trainingData - Training data
   * @param {Object} options - Training options
   * @returns {Promise<Object>} - Training results
   */
  async _trainModel(modelConfig, trainingData, options = {}) {
    // This is a simplified implementation
    // In a real implementation, this would perform actual model training
    
    const model = this.models.get(modelConfig.id);
    if (!model) {
      throw new Error(`Model ${modelConfig.id} not found`);
    }
    
    // Update model metadata
    model.metadata.trainingStatus = 'training';
    model.metadata.trainingProgress = 0;
    
    // Get training parameters
    const epochs = options.epochs || this.config.trainingEpochs;
    const batchSize = options.batchSize || this.config.trainingBatchSize;
    const evaluationFrequency = options.evaluationFrequency || this.config.evaluationFrequency;
    
    // Initialize embeddings if not already initialized
    await this._initializeEmbeddings(model, trainingData);
    
    // Simulate training process
    const totalSteps = epochs * Math.ceil(trainingData.length / batchSize);
    let currentStep = 0;
    
    const evaluationResults = [];
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle training data
      const shuffledData = [...trainingData].sort(() => Math.random() - 0.5);
      
      // Process in batches
      for (let i = 0; i < shuffledData.length; i += batchSize) {
        const batch = shuffledData.slice(i, i + batchSize);
        
        // Simulate batch processing
        await this._processBatch(model, batch);
        
        currentStep++;
        model.metadata.trainingProgress = currentStep / totalSteps;
        
        // Emit progress event
        this.emit('trainingProgress', {
          modelId: modelConfig.id,
          epoch,
          progress: model.metadata.trainingProgress,
          step: currentStep,
          totalSteps
        });
        
        // Evaluate model periodically
        if (currentStep % evaluationFrequency === 0 || currentStep === totalSteps) {
          const evaluationResult = await this._evaluateModel(model, trainingData);
          evaluationResults.push(evaluationResult);
          
          // Update model metadata
          model.metadata.evaluationMetrics = evaluationResult;
          
          // Emit evaluation event
          this.emit('modelEvaluated', {
            modelId: modelConfig.id,
            epoch,
            step: currentStep,
            metrics: evaluationResult
          });
        }
      }
    }
    
    // Update model metadata
    model.metadata.trainingStatus = 'trained';
    model.metadata.trainingProgress = 1.0;
    model.metadata.updatedAt = Date.now();
    
    // Save model
    await this._saveModel(modelConfig.id, model);
    
    // Emit training completed event
    this.emit('trainingCompleted', {
      modelId: modelConfig.id,
      epochs,
      finalMetrics: model.metadata.evaluationMetrics
    });
    
    return {
      modelId: modelConfig.id,
      epochs,
      trainingSteps: currentStep,
      evaluationResults,
      finalMetrics: model.metadata.evaluationMetrics
    };
  }
  
  /**
   * Initialize embeddings for a model.
   * 
   * @private
   * @param {Object} model - Model object
   * @param {Array<Object>} trainingData - Training data
   * @returns {Promise<void>}
   */
  async _initializeEmbeddings(model, trainingData) {
    // Extract unique entities and relations from training data
    const entities = new Set();
    const relations = new Set();
    
    for (const triple of trainingData) {
      entities.add(triple.headEntityId);
      entities.add(triple.tailEntityId);
      relations.add(triple.relationId);
    }
    
    // Initialize embeddings for entities
    for (const entityId of entities) {
      if (!model.embeddings.entities.has(entityId)) {
        model.embeddings.entities.set(entityId, this._createRandomEmbedding(model.embeddingDimension));
      }
    }
    
    // Initialize embeddings for relations
    for (const relationId of relations) {
      if (!model.embeddings.relations.has(relationId)) {
        model.embeddings.relations.set(relationId, this._createRandomEmbedding(model.embeddingDimension));
      }
    }
  }
  
  /**
   * Create a random embedding vector.
   * 
   * @private
   * @param {number} dimension - Embedding dimension
   * @returns {Array<number>} - Random embedding vector
   */
  _createRandomEmbedding(dimension) {
    const embedding = new Array(dimension);
    
    for (let i = 0; i < dimension; i++) {
      embedding[i] = (Math.random() * 2 - 1) * 0.1; // Initialize with small random values
    }
    
    return embedding;
  }
  
  /**
   * Process a batch of training data.
   * 
   * @private
   * @param {Object} model - Model object
   * @param {Array<Object>} batch - Batch of training data
   * @returns {Promise<void>}
   */
  async _processBatch(model, batch) {
    // This is a simplified implementation
    // In a real implementation, this would perform gradient updates
    
    // Simulate a small update to embeddings
    for (const triple of batch) {
      const { headEntityId, relationId, tailEntityId } = triple;
      
      const headEmbedding = model.embeddings.entities.get(headEntityId);
      const relationEmbedding = model.embeddings.relations.get(relationId);
      const tailEmbedding = model.embeddings.entities.get(tailEntityId);
      
      if (headEmbedding && relationEmbedding && tailEmbedding) {
        // Simulate a small update (in reality, this would be based on gradients)
        for (let i = 0; i < headEmbedding.length; i++) {
          headEmbedding[i] += (Math.random() * 2 - 1) * 0.001;
          relationEmbedding[i] += (Math.random() * 2 - 1) * 0.001;
          tailEmbedding[i] += (Math.random() * 2 - 1) * 0.001;
        }
      }
    }
    
    // Simulate a small delay for training
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  
  /**
   * Evaluate a model on training data.
   * 
   * @private
   * @param {Object} model - Model object
   * @param {Array<Object>} data - Evaluation data
   * @returns {Promise<Object>} - Evaluation metrics
   */
  async _evaluateModel(model, data) {
    // This is a simplified implementation
    // In a real implementation, this would compute actual evaluation metrics
    
    // Simulate evaluation by computing scores for a subset of data
    const sampleSize = Math.min(data.length, 100);
    const sample = data.slice(0, sampleSize);
    
    let totalScore = 0;
    let hitAt1 = 0;
    let hitAt3 = 0;
    let hitAt10 = 0;
    
    for (const triple of sample) {
      const { headEntityId, relationId, tailEntityId } = triple;
      
      // Compute score for correct triple
      const correctScore = (await model.forward({ headEntityId, relationId, tailEntityId })).score;
      
      // Compute scores for corrupted triples (replace tail entity)
      const corruptedScores = [];
      
      // Sample 50 random entities
      const allEntityIds = Array.from(model.embeddings.entities.keys());
      const sampleEntities = this._sampleWithout(allEntityIds, tailEntityId, 50);
      
      for (const corruptedTailId of sampleEntities) {
        const score = (await model.forward({ headEntityId, relationId, tailEntityId: corruptedTailId })).score;
        corruptedScores.push({ entityId: corruptedTailId, score });
      }
      
      // Sort corrupted scores
      corruptedScores.sort((a, b) => b.score - a.score);
      
      // Find rank of correct entity
      const rank = corruptedScores.findIndex(item => item.score < correctScore) + 1;
      
      // Update metrics
      totalScore += correctScore;
      if (rank <= 1) hitAt1++;
      if (rank <= 3) hitAt3++;
      if (rank <= 10) hitAt10++;
    }
    
    // Compute metrics
    const meanScore = totalScore / sampleSize;
    const hitRateAt1 = hitAt1 / sampleSize;
    const hitRateAt3 = hitAt3 / sampleSize;
    const hitRateAt10 = hitAt10 / sampleSize;
    
    return {
      meanScore,
      hitRateAt1,
      hitRateAt3,
      hitRateAt10,
      sampleSize,
      timestamp: Date.now()
    };
  }
  
  /**
   * Sample elements from an array, excluding a specific element.
   * 
   * @private
   * @param {Array<any>} array - Array to sample from
   * @param {any} exclude - Element to exclude
   * @param {number} count - Number of elements to sample
   * @returns {Array<any>} - Sampled elements
   */
  _sampleWithout(array, exclude, count) {
    const filtered = array.filter(item => item !== exclude);
    const result = [];
    
    // If count is greater than available elements, return all
    if (count >= filtered.length) {
      return filtered;
    }
    
    // Reservoir sampling
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * filtered.length);
      result.push(filtered[index]);
      filtered.splice(index, 1);
    }
    
    return result;
  }
  
  /**
   * Simplified model prediction implementation.
   * 
   * @private
   * @param {Object} modelConfig - Model configuration
   * @param {Object} input - Input data
   * @returns {Promise<Object>} - Prediction results
   */
  async _modelPredict(modelConfig, input) {
    // This is a simplified implementation
    // In a real implementation, this would perform actual model prediction
    
    const model = this.models.get(modelConfig.id);
    if (!model) {
      throw new Error(`Model ${modelConfig.id} not found`);
    }
    
    // Handle different prediction tasks
    switch (input.taskType) {
      case PredictionTaskType.LINK_PREDICTION:
        return this._predictLink(model, input);
      case PredictionTaskType.NODE_CLASSIFICATION:
        return this._predictNodeClass(model, input);
      case PredictionTaskType.KNOWLEDGE_GRAPH_COMPLETION:
        return this._completeKnowledgeGraph(model, input);
      default:
        throw new Error(`Unsupported prediction task type: ${input.taskType}`);
    }
  }
  
  /**
   * Predict links between entities.
   * 
   * @private
   * @param {Object} model - Model object
   * @param {Object} input - Input data
   * @returns {Promise<Object>} - Prediction results
   */
  async _predictLink(model, input) {
    const { headEntityId, relationId, topK = 10 } = input;
    
    // Get head entity embedding
    const headEmbedding = model.embeddings.entities.get(headEntityId);
    if (!headEmbedding) {
      throw new Error(`Head entity ${headEntityId} not found in model embeddings`);
    }
    
    // Get relation embedding
    const relationEmbedding = model.embeddings.relations.get(relationId);
    if (!relationEmbedding) {
      throw new Error(`Relation ${relationId} not found in model embeddings`);
    }
    
    // Compute scores for all possible tail entities
    const scores = [];
    
    for (const [tailEntityId, tailEmbedding] of model.embeddings.entities.entries()) {
      // Skip if it's the same as head entity
      if (tailEntityId === headEntityId) continue;
      
      // Compute score
      const score = (await model.forward({ headEntityId, relationId, tailEntityId })).score;
      
      scores.push({ entityId: tailEntityId, score });
    }
    
    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);
    
    // Return top K results
    return {
      headEntityId,
      relationId,
      predictions: scores.slice(0, topK)
    };
  }
  
  /**
   * Predict node class.
   * 
   * @private
   * @param {Object} model - Model object
   * @param {Object} input - Input data
   * @returns {Promise<Object>} - Prediction results
   */
  async _predictNodeClass(model, input) {
    const { entityId, possibleClasses } = input;
    
    // Get entity embedding
    const entityEmbedding = model.embeddings.entities.get(entityId);
    if (!entityEmbedding) {
      throw new Error(`Entity ${entityId} not found in model embeddings`);
    }
    
    // Compute scores for each possible class
    const scores = [];
    
    for (const classId of possibleClasses) {
      // Use a simplified approach: compute similarity with class prototype
      const classPrototype = model.embeddings.entities.get(classId);
      
      if (classPrototype) {
        // Compute cosine similarity
        let dotProduct = 0;
        let entityNorm = 0;
        let classNorm = 0;
        
        for (let i = 0; i < entityEmbedding.length; i++) {
          dotProduct += entityEmbedding[i] * classPrototype[i];
          entityNorm += entityEmbedding[i] * entityEmbedding[i];
          classNorm += classPrototype[i] * classPrototype[i];
        }
        
        entityNorm = Math.sqrt(entityNorm);
        classNorm = Math.sqrt(classNorm);
        
        const similarity = dotProduct / (entityNorm * classNorm);
        
        scores.push({ classId, score: similarity });
      }
    }
    
    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);
    
    return {
      entityId,
      predictions: scores
    };
  }
  
  /**
   * Complete knowledge graph by predicting missing entities or relations.
   * 
   * @private
   * @param {Object} model - Model object
   * @param {Object} input - Input data
   * @returns {Promise<Object>} - Prediction results
   */
  async _completeKnowledgeGraph(model, input) {
    const { subgraph, missingElements, topK = 10 } = input;
    
    const predictions = [];
    
    for (const missing of missingElements) {
      if (missing.type === 'entity') {
        // Predict missing entity
        const { headEntityId, relationId } = missing;
        
        const linkPrediction = await this._predictLink(model, {
          headEntityId,
          relationId,
          topK
        });
        
        predictions.push({
          type: 'entity',
          headEntityId,
          relationId,
          candidates: linkPrediction.predictions
        });
      } else if (missing.type === 'relation') {
        // Predict missing relation
        const { headEntityId, tailEntityId } = missing;
        
        // Compute scores for all possible relations
        const scores = [];
        
        for (const [relationId, relationEmbedding] of model.embeddings.relations.entries()) {
          // Compute score
          const score = (await model.forward({ headEntityId, relationId, tailEntityId })).score;
          
          scores.push({ relationId, score });
        }
        
        // Sort by score (descending)
        scores.sort((a, b) => b.score - a.score);
        
        predictions.push({
          type: 'relation',
          headEntityId,
          tailEntityId,
          candidates: scores.slice(0, topK)
        });
      }
    }
    
    return {
      subgraphSize: subgraph.length,
      predictions
    };
  }
  
  /**
   * Save model configuration to cache.
   * 
   * @private
   * @param {string} modelId - Model ID
   * @param {Object} modelConfig - Model configuration
   * @returns {Promise<void>}
   */
  async _saveModelConfig(modelId, modelConfig) {
    try {
      const configPath = path.join(this.config.modelCacheDirectory, `${modelId}_config.json`);
      
      await fs.writeFile(configPath, JSON.stringify(modelConfig, null, 2), 'utf8');
      
      if (this.logger) {
        this.logger.debug(`Saved model configuration for ${modelId}`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to save model configuration for ${modelId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }
  
  /**
   * Save model to cache.
   * 
   * @private
   * @param {string} modelId - Model ID
   * @param {Object} model - Model object
   * @returns {Promise<void>}
   */
  async _saveModel(modelId, model) {
    try {
      // Save model configuration
      await this._saveModelConfig(modelId, {
        id: model.id,
        type: model.type,
        embeddingDimension: model.embeddingDimension,
        params: model.params,
        metadata: model.metadata
      });
      
      // Save entity embeddings
      const entityEmbeddingsPath = path.join(this.config.modelCacheDirectory, `${modelId}_entity_embeddings.json`);
      
      const entityEmbeddings = {};
      for (const [entityId, embedding] of model.embeddings.entities.entries()) {
        entityEmbeddings[entityId] = embedding;
      }
      
      await fs.writeFile(entityEmbeddingsPath, JSON.stringify(entityEmbeddings, null, 2), 'utf8');
      
      // Save relation embeddings
      const relationEmbeddingsPath = path.join(this.config.modelCacheDirectory, `${modelId}_relation_embeddings.json`);
      
      const relationEmbeddings = {};
      for (const [relationId, embedding] of model.embeddings.relations.entries()) {
        relationEmbeddings[relationId] = embedding;
      }
      
      await fs.writeFile(relationEmbeddingsPath, JSON.stringify(relationEmbeddings, null, 2), 'utf8');
      
      if (this.logger) {
        this.logger.debug(`Saved model ${modelId}`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to save model ${modelId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    }
  }
  
  /**
   * Load model from cache.
   * 
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} - Loaded model
   */
  async loadModel(modelId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_loadModel');
    }
    
    try {
      // Check if model is already loaded
      if (this.models.has(modelId)) {
        return this.models.get(modelId);
      }
      
      // Load model configuration
      const configPath = path.join(this.config.modelCacheDirectory, `${modelId}_config.json`);
      
      let modelConfig;
      try {
        const configData = await fs.readFile(configPath, 'utf8');
        modelConfig = JSON.parse(configData);
      } catch (error) {
        throw new Error(`Failed to load model configuration for ${modelId}: ${error.message}`);
      }
      
      // Initialize model
      const model = await this._initializeModelByType(modelConfig);
      
      // Load entity embeddings
      const entityEmbeddingsPath = path.join(this.config.modelCacheDirectory, `${modelId}_entity_embeddings.json`);
      
      try {
        const entityEmbeddingsData = await fs.readFile(entityEmbeddingsPath, 'utf8');
        const entityEmbeddings = JSON.parse(entityEmbeddingsData);
        
        for (const [entityId, embedding] of Object.entries(entityEmbeddings)) {
          model.embeddings.entities.set(entityId, embedding);
        }
      } catch (error) {
        throw new Error(`Failed to load entity embeddings for ${modelId}: ${error.message}`);
      }
      
      // Load relation embeddings
      const relationEmbeddingsPath = path.join(this.config.modelCacheDirectory, `${modelId}_relation_embeddings.json`);
      
      try {
        const relationEmbeddingsData = await fs.readFile(relationEmbeddingsPath, 'utf8');
        const relationEmbeddings = JSON.parse(relationEmbeddingsData);
        
        for (const [relationId, embedding] of Object.entries(relationEmbeddings)) {
          model.embeddings.relations.set(relationId, embedding);
        }
      } catch (error) {
        throw new Error(`Failed to load relation embeddings for ${modelId}: ${error.message}`);
      }
      
      // Store model
      this.models.set(modelId, model);
      
      if (this.logger) {
        this.logger.debug(`Loaded model ${modelId}`);
      }
      
      this.emit('modelLoaded', { modelId });
      
      return model;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to load model ${modelId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Delete model from cache.
   * 
   * @param {string} modelId - Model ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteModel(modelId) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_deleteModel');
    }
    
    try {
      // Remove from memory
      this.models.delete(modelId);
      
      // Remove from disk
      const configPath = path.join(this.config.modelCacheDirectory, `${modelId}_config.json`);
      const entityEmbeddingsPath = path.join(this.config.modelCacheDirectory, `${modelId}_entity_embeddings.json`);
      const relationEmbeddingsPath = path.join(this.config.modelCacheDirectory, `${modelId}_relation_embeddings.json`);
      
      try {
        await fs.unlink(configPath);
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`Failed to delete model configuration for ${modelId}: ${error.message}`);
        }
      }
      
      try {
        await fs.unlink(entityEmbeddingsPath);
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`Failed to delete entity embeddings for ${modelId}: ${error.message}`);
        }
      }
      
      try {
        await fs.unlink(relationEmbeddingsPath);
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`Failed to delete relation embeddings for ${modelId}: ${error.message}`);
        }
      }
      
      if (this.logger) {
        this.logger.debug(`Deleted model ${modelId}`);
      }
      
      this.emit('modelDeleted', { modelId });
      
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to delete model ${modelId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Get entity embedding.
   * 
   * @param {string} entityId - Entity ID
   * @param {string} [modelId='default_transe'] - Model ID
   * @returns {Promise<Array<number>|null>} - Entity embedding or null if not found
   */
  async getEntityEmbedding(entityId, modelId = 'default_transe') {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_getEntityEmbedding');
    }
    
    try {
      // Check cache first
      const cacheKey = `${modelId}_entity_${entityId}`;
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey);
      }
      
      // Get model
      let model = this.models.get(modelId);
      if (!model) {
        // Try to load model
        try {
          model = await this.loadModel(modelId);
        } catch (error) {
          throw new Error(`Model ${modelId} not found: ${error.message}`);
        }
      }
      
      // Get embedding
      const embedding = model.embeddings.entities.get(entityId);
      
      // Cache embedding
      if (embedding) {
        this.embeddingCache.set(cacheKey, embedding);
        
        // Limit cache size
        if (this.embeddingCache.size > this.config.embeddingCacheSize) {
          // Remove oldest entry
          const oldestKey = this.embeddingCache.keys().next().value;
          this.embeddingCache.delete(oldestKey);
        }
      }
      
      return embedding || null;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get entity embedding for ${entityId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Get relation embedding.
   * 
   * @param {string} relationId - Relation ID
   * @param {string} [modelId='default_transe'] - Model ID
   * @returns {Promise<Array<number>|null>} - Relation embedding or null if not found
   */
  async getRelationEmbedding(relationId, modelId = 'default_transe') {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_getRelationEmbedding');
    }
    
    try {
      // Check cache first
      const cacheKey = `${modelId}_relation_${relationId}`;
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey);
      }
      
      // Get model
      let model = this.models.get(modelId);
      if (!model) {
        // Try to load model
        try {
          model = await this.loadModel(modelId);
        } catch (error) {
          throw new Error(`Model ${modelId} not found: ${error.message}`);
        }
      }
      
      // Get embedding
      const embedding = model.embeddings.relations.get(relationId);
      
      // Cache embedding
      if (embedding) {
        this.embeddingCache.set(cacheKey, embedding);
        
        // Limit cache size
        if (this.embeddingCache.size > this.config.embeddingCacheSize) {
          // Remove oldest entry
          const oldestKey = this.embeddingCache.keys().next().value;
          this.embeddingCache.delete(oldestKey);
        }
      }
      
      return embedding || null;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get relation embedding for ${relationId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Predict relationships between entities.
   * 
   * @param {string} headEntityId - Head entity ID
   * @param {string} [relationId] - Optional relation ID (if provided, predicts tail entities)
   * @param {string} [tailEntityId] - Optional tail entity ID (if provided with headEntityId, predicts relations)
   * @param {Object} [options={}] - Prediction options
   * @param {string} [options.modelId='default_transe'] - Model ID
   * @param {number} [options.topK=10] - Number of top predictions to return
   * @returns {Promise<Object>} - Prediction results
   */
  async predictRelationships(headEntityId, relationId, tailEntityId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_predictRelationships');
    }
    
    try {
      const modelId = options.modelId || 'default_transe';
      const topK = options.topK || 10;
      
      // Get model
      let model = this.models.get(modelId);
      if (!model) {
        // Try to load model
        try {
          model = await this.loadModel(modelId);
        } catch (error) {
          throw new Error(`Model ${modelId} not found: ${error.message}`);
        }
      }
      
      let result;
      
      if (headEntityId && relationId && !tailEntityId) {
        // Predict tail entities
        result = await this._predictLink(model, {
          headEntityId,
          relationId,
          topK
        });
      } else if (headEntityId && tailEntityId && !relationId) {
        // Predict relations
        // Compute scores for all possible relations
        const scores = [];
        
        for (const [relId, relationEmbedding] of model.embeddings.relations.entries()) {
          // Compute score
          const score = (await model.forward({ headEntityId, relationId: relId, tailEntityId })).score;
          
          scores.push({ relationId: relId, score });
        }
        
        // Sort by score (descending)
        scores.sort((a, b) => b.score - a.score);
        
        result = {
          headEntityId,
          tailEntityId,
          predictions: scores.slice(0, topK)
        };
      } else if (headEntityId && !relationId && !tailEntityId) {
        // Predict all possible relationships from head entity
        // This is a more complex query, so we'll simplify it
        
        // Get all relations
        const relationIds = Array.from(model.embeddings.relations.keys());
        
        // For each relation, predict top tail entities
        const relationPredictions = [];
        
        for (const relId of relationIds) {
          const prediction = await this._predictLink(model, {
            headEntityId,
            relationId: relId,
            topK: 3 // Limit to top 3 for each relation
          });
          
          if (prediction.predictions.length > 0) {
            relationPredictions.push({
              relationId: relId,
              tailEntities: prediction.predictions
            });
          }
        }
        
        // Sort by highest score across all relations
        relationPredictions.sort((a, b) => {
          const aMaxScore = Math.max(...a.tailEntities.map(e => e.score));
          const bMaxScore = Math.max(...b.tailEntities.map(e => e.score));
          return bMaxScore - aMaxScore;
        });
        
        result = {
          headEntityId,
          predictions: relationPredictions.slice(0, topK)
        };
      } else {
        throw new Error('Invalid combination of parameters. Provide either (headEntityId, relationId) or (headEntityId, tailEntityId) or just (headEntityId)');
      }
      
      if (this.logger) {
        this.logger.debug(`Predicted relationships for entity ${headEntityId}`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to predict relationships: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Complete a knowledge graph by predicting missing entities or relations.
   * 
   * @param {Array<Object>} subgraph - Existing subgraph triples
   * @param {Array<Object>} missingElements - Description of missing elements to predict
   * @param {Object} [options={}] - Completion options
   * @param {string} [options.modelId='default_transe'] - Model ID
   * @param {number} [options.topK=10] - Number of top predictions to return
   * @returns {Promise<Object>} - Completion results
   */
  async completeKnowledgeGraph(subgraph, missingElements, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_completeKnowledgeGraph');
    }
    
    try {
      const modelId = options.modelId || 'default_transe';
      const topK = options.topK || 10;
      
      // Get model
      let model = this.models.get(modelId);
      if (!model) {
        // Try to load model
        try {
          model = await this.loadModel(modelId);
        } catch (error) {
          throw new Error(`Model ${modelId} not found: ${error.message}`);
        }
      }
      
      // Complete knowledge graph
      const result = await this._completeKnowledgeGraph(model, {
        subgraph,
        missingElements,
        topK
      });
      
      if (this.logger) {
        this.logger.debug(`Completed knowledge graph with ${subgraph.length} triples and ${missingElements.length} missing elements`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to complete knowledge graph: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Train a model on knowledge graph data.
   * 
   * @param {string} modelId - Model ID
   * @param {Array<Object>} trainingData - Training data triples
   * @param {Object} [options={}] - Training options
   * @param {number} [options.epochs] - Number of training epochs
   * @param {number} [options.batchSize] - Batch size
   * @param {number} [options.evaluationFrequency] - Evaluation frequency
   * @returns {Promise<Object>} - Training results
   */
  async trainModel(modelId, trainingData, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_trainModel');
    }
    
    try {
      // Get model
      let model = this.models.get(modelId);
      if (!model) {
        // Try to load model
        try {
          model = await this.loadModel(modelId);
        } catch (error) {
          throw new Error(`Model ${modelId} not found: ${error.message}`);
        }
      }
      
      // Train model
      const result = await model.train(trainingData, options);
      
      if (this.logger) {
        this.logger.debug(`Trained model ${modelId} on ${trainingData.length} triples`);
      }
      
      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to train model ${modelId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Find similar entities based on embedding similarity.
   * 
   * @param {string} entityId - Entity ID
   * @param {Object} [options={}] - Similarity options
   * @param {string} [options.modelId='default_transe'] - Model ID
   * @param {number} [options.topK=10] - Number of top similar entities to return
   * @returns {Promise<Object>} - Similar entities
   */
  async findSimilarEntities(entityId, options = {}) {
    this.ensureInitialized();
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('graphNeuralNetworkManager_findSimilarEntities');
    }
    
    try {
      const modelId = options.modelId || 'default_transe';
      const topK = options.topK || 10;
      
      // Get entity embedding
      const entityEmbedding = await this.getEntityEmbedding(entityId, modelId);
      if (!entityEmbedding) {
        throw new Error(`Entity ${entityId} not found in model ${modelId}`);
      }
      
      // Get model
      let model = this.models.get(modelId);
      if (!model) {
        // Try to load model
        try {
          model = await this.loadModel(modelId);
        } catch (error) {
          throw new Error(`Model ${modelId} not found: ${error.message}`);
        }
      }
      
      // Compute similarity with all other entities
      const similarities = [];
      
      for (const [otherEntityId, otherEmbedding] of model.embeddings.entities.entries()) {
        // Skip self
        if (otherEntityId === entityId) continue;
        
        // Compute cosine similarity
        let dotProduct = 0;
        let entityNorm = 0;
        let otherNorm = 0;
        
        for (let i = 0; i < entityEmbedding.length; i++) {
          dotProduct += entityEmbedding[i] * otherEmbedding[i];
          entityNorm += entityEmbedding[i] * entityEmbedding[i];
          otherNorm += otherEmbedding[i] * otherEmbedding[i];
        }
        
        entityNorm = Math.sqrt(entityNorm);
        otherNorm = Math.sqrt(otherNorm);
        
        const similarity = dotProduct / (entityNorm * otherNorm);
        
        similarities.push({ entityId: otherEntityId, similarity });
      }
      
      // Sort by similarity (descending)
      similarities.sort((a, b) => b.similarity - a.similarity);
      
      if (this.logger) {
        this.logger.debug(`Found similar entities for ${entityId}`);
      }
      
      return {
        entityId,
        modelId,
        similarEntities: similarities.slice(0, topK)
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to find similar entities for ${entityId}: ${error.message}`, { error: error.stack });
      }
      throw error;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
}

// Export classes and enums
module.exports = {
  GraphNeuralNetworkManager,
  EmbeddingModelType,
  PredictionTaskType
};
