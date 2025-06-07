/**
 * @fileoverview Text Handler for the Multi-Modal Integration Tentacle.
 * Provides capabilities for processing and generating text.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Text Handler
 * Handles text processing and generation.
 */
class TextHandler {
  /**
   * Creates a new TextHandler instance.
   * @param {Object} options - Handler options
   * @param {Object} options.tentacle - Parent tentacle
   * @param {Object} options.config - Configuration system
   * @param {Object} options.logging - Logging system
   * @param {Object} options.events - Event system
   * @param {Object} options.metrics - Metrics system
   * @param {Object} options.modelRegistry - Model registry
   */
  constructor(options = {}) {
    this.tentacle = options.tentacle;
    this.config = options.config;
    this.logging = options.logging;
    this.events = options.events;
    this.metrics = options.metrics;
    this.modelRegistry = options.modelRegistry;
    
    // Create logger
    this.logger = this.logging ? this.logging.createLogger('multi-modal-integration:text') : console;
    
    // Initialize models
    this.models = {
      understanding: null,
      generation: null,
      transformation: null,
      analysis: null,
      embedding: null
    };
    
    // Initialize cache
    this.cache = new Map();
    
    // Bind methods
    this.processInput = this.processInput.bind(this);
    this.generateOutput = this.generateOutput.bind(this);
    this.extractFeatures = this.extractFeatures.bind(this);
    this.alignFeatures = this.alignFeatures.bind(this);
    this.transformText = this.transformText.bind(this);
    this.analyzeText = this.analyzeText.bind(this);
    this.embedText = this.embedText.bind(this);
  }
  
  /**
   * Initializes the text handler.
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing Text Handler');
      
      // Load models
      await this.loadModels();
      
      // Initialize cache
      this.initializeCache();
      
      this.logger.info('Text Handler initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Text Handler:', error);
      throw error;
    }
  }
  
  /**
   * Shuts down the text handler.
   * @returns {Promise<boolean>} - Whether shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Text Handler');
      
      // Clear cache
      this.cache.clear();
      
      // Unload models
      await this.unloadModels();
      
      this.logger.info('Text Handler shut down successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to shut down Text Handler:', error);
      throw error;
    }
  }
  
  /**
   * Loads models for text processing.
   * @private
   * @returns {Promise<void>}
   */
  async loadModels() {
    if (!this.modelRegistry) {
      this.logger.warn('Model registry not available, skipping model loading');
      return;
    }
    
    try {
      // Load text understanding model
      this.models.understanding = await this.modelRegistry.getModel('text:understanding');
      
      // Load text generation model
      this.models.generation = await this.modelRegistry.getModel('text:generation');
      
      // Load text transformation model
      this.models.transformation = await this.modelRegistry.getModel('text:transformation');
      
      // Load text analysis model
      this.models.analysis = await this.modelRegistry.getModel('text:analysis');
      
      // Load text embedding model
      this.models.embedding = await this.modelRegistry.getModel('text:embedding');
      
      this.logger.info('Text models loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load text models:', error);
      throw error;
    }
  }
  
  /**
   * Unloads models.
   * @private
   * @returns {Promise<void>}
   */
  async unloadModels() {
    // No specific unloading needed as the model registry handles this
    this.models = {
      understanding: null,
      generation: null,
      transformation: null,
      analysis: null,
      embedding: null
    };
  }
  
  /**
   * Initializes the cache.
   * @private
   */
  initializeCache() {
    // Get cache configuration
    const cacheEnabled = this.config ? this.config.get('multi-modal.text.cache.enabled', true) : true;
    const cacheSize = this.config ? this.config.get('multi-modal.text.cache.size', 100) : 100;
    
    if (!cacheEnabled) {
      this.logger.info('Text cache disabled');
      return;
    }
    
    // Initialize LRU cache
    this.cache = new Map();
    this.cacheSize = cacheSize;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    this.logger.info(`Text cache initialized with size ${cacheSize}`);
  }
  
  /**
   * Processes text input.
   * @param {Object} input - Text input
   * @param {string} input.text - Text content
   * @param {Object} [input.metadata] - Text metadata
   * @param {Object} [options] - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async processInput(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate input
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid input: expected an object');
      }
      
      if (!input.text || typeof input.text !== 'string') {
        throw new Error('Invalid input: text is required and must be a string');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('process', input, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached text processing result');
        return cachedResult;
      }
      
      // Preprocess text
      const preprocessed = this.preprocessText(input.text, options);
      
      // Extract features
      const features = await this.extractFeatures({
        text: preprocessed,
        metadata: input.metadata
      }, options);
      
      // Analyze text
      const analysis = await this.analyzeText({
        text: preprocessed,
        features,
        metadata: input.metadata
      }, options);
      
      // Prepare result
      const result = {
        text: preprocessed,
        features,
        analysis,
        metadata: {
          ...input.metadata,
          processed: true,
          processingTime: Date.now() - startTime
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.process.count', 1);
        this.metrics.recordTiming('multi-modal.text.process.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to process text input:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.process.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Generates text output.
   * @param {Object} spec - Output specification
   * @param {Object} spec.text - Text specification
   * @param {string} [spec.text.prompt] - Generation prompt
   * @param {Object} [spec.text.parameters] - Generation parameters
   * @param {Object} [context] - Generation context
   * @param {Object} [options] - Generation options
   * @returns {Promise<Object>} - Generated output
   */
  async generateOutput(spec, context = {}, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate spec
      if (!spec || typeof spec !== 'object') {
        throw new Error('Invalid spec: expected an object');
      }
      
      if (!spec.text || typeof spec.text !== 'object') {
        throw new Error('Invalid spec: text specification is required and must be an object');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('generate', spec, context, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached text generation result');
        return cachedResult;
      }
      
      // Prepare generation input
      const generationInput = this.prepareGenerationInput(spec.text, context, options);
      
      // Generate text
      let generatedText;
      
      if (this.models.generation) {
        // Use model for generation
        const modelResult = await this.models.generation.run(generationInput, options);
        generatedText = modelResult.text;
      } else {
        // Fallback generation
        generatedText = this.fallbackGeneration(generationInput, options);
      }
      
      // Postprocess text
      const postprocessed = this.postprocessText(generatedText, options);
      
      // Prepare result
      const result = {
        text: postprocessed,
        metadata: {
          generated: true,
          generationTime: Date.now() - startTime,
          model: this.models.generation ? this.models.generation.getMetadata() : { type: 'fallback' }
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.generate.count', 1);
        this.metrics.recordTiming('multi-modal.text.generate.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to generate text output:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.generate.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Extracts features from text.
   * @param {Object} input - Input data
   * @param {string} input.text - Text content
   * @param {Object} [input.metadata] - Text metadata
   * @param {Object} [options] - Extraction options
   * @returns {Promise<Object>} - Extracted features
   */
  async extractFeatures(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate input
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid input: expected an object');
      }
      
      if (!input.text || typeof input.text !== 'string') {
        throw new Error('Invalid input: text is required and must be a string');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('extract', input, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached feature extraction result');
        return cachedResult;
      }
      
      // Extract features
      let features;
      
      if (this.models.understanding) {
        // Use model for feature extraction
        const modelResult = await this.models.understanding.run({
          text: input.text,
          task: 'extract_features',
          options
        });
        
        features = modelResult.features;
      } else {
        // Fallback feature extraction
        features = this.fallbackFeatureExtraction(input.text, options);
      }
      
      // Prepare result
      const result = {
        semantic: features.semantic || {},
        syntactic: features.syntactic || {},
        statistical: features.statistical || {},
        metadata: {
          ...input.metadata,
          extractionTime: Date.now() - startTime
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.extract.count', 1);
        this.metrics.recordTiming('multi-modal.text.extract.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to extract text features:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.extract.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Aligns text features with other modalities.
   * @param {Object} features - Features from this modality
   * @param {Array<Object>} otherFeatures - Features from other modalities
   * @param {Object} [options] - Alignment options
   * @returns {Promise<Object>} - Aligned features
   */
  async alignFeatures(features, otherFeatures, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate features
      if (!features || typeof features !== 'object') {
        throw new Error('Invalid features: expected an object');
      }
      
      if (!Array.isArray(otherFeatures)) {
        throw new Error('Invalid otherFeatures: expected an array');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('align', features, otherFeatures, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached feature alignment result');
        return cachedResult;
      }
      
      // Prepare alignment input
      const alignmentInput = {
        textFeatures: features,
        otherFeatures,
        options
      };
      
      // Align features
      let alignedFeatures;
      
      if (this.models.embedding) {
        // Use model for feature alignment
        const modelResult = await this.models.embedding.run({
          task: 'align_features',
          input: alignmentInput
        });
        
        alignedFeatures = modelResult.alignedFeatures;
      } else {
        // Fallback feature alignment
        alignedFeatures = this.fallbackFeatureAlignment(features, otherFeatures, options);
      }
      
      // Prepare result
      const result = {
        ...alignedFeatures,
        metadata: {
          aligned: true,
          alignmentTime: Date.now() - startTime
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.align.count', 1);
        this.metrics.recordTiming('multi-modal.text.align.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to align text features:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.align.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Transforms text.
   * @param {Object} input - Input data
   * @param {string} input.text - Text to transform
   * @param {string} input.transformation - Transformation type (e.g., 'translate', 'summarize', 'paraphrase')
   * @param {Object} [input.parameters] - Transformation parameters
   * @param {Object} [options] - Transformation options
   * @returns {Promise<Object>} - Transformation result
   */
  async transformText(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate input
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid input: expected an object');
      }
      
      if (!input.text || typeof input.text !== 'string') {
        throw new Error('Invalid input: text is required and must be a string');
      }
      
      if (!input.transformation || typeof input.transformation !== 'string') {
        throw new Error('Invalid input: transformation is required and must be a string');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('transform', input, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached text transformation result');
        return cachedResult;
      }
      
      // Transform text
      let transformedText;
      
      if (this.models.transformation) {
        // Use model for transformation
        const modelResult = await this.models.transformation.run({
          text: input.text,
          transformation: input.transformation,
          parameters: input.parameters || {},
          options
        });
        
        transformedText = modelResult.text;
      } else {
        // Fallback transformation
        transformedText = this.fallbackTransformation(input, options);
      }
      
      // Prepare result
      const result = {
        text: transformedText,
        metadata: {
          transformation: input.transformation,
          parameters: input.parameters || {},
          transformationTime: Date.now() - startTime
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.transform.count', 1);
        this.metrics.record(`multi-modal.text.transform.${input.transformation}.count`, 1);
        this.metrics.recordTiming('multi-modal.text.transform.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to transform text:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.transform.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Analyzes text.
   * @param {Object} input - Input data
   * @param {string} input.text - Text to analyze
   * @param {Object} [input.features] - Pre-extracted features
   * @param {Object} [input.metadata] - Text metadata
   * @param {Object} [options] - Analysis options
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeText(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate input
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid input: expected an object');
      }
      
      if (!input.text || typeof input.text !== 'string') {
        throw new Error('Invalid input: text is required and must be a string');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('analyze', input, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached text analysis result');
        return cachedResult;
      }
      
      // Extract features if not provided
      const features = input.features || await this.extractFeatures({
        text: input.text,
        metadata: input.metadata
      }, options);
      
      // Analyze text
      let analysis;
      
      if (this.models.analysis) {
        // Use model for analysis
        const modelResult = await this.models.analysis.run({
          text: input.text,
          features,
          options
        });
        
        analysis = modelResult.analysis;
      } else {
        // Fallback analysis
        analysis = this.fallbackAnalysis(input.text, features, options);
      }
      
      // Prepare result
      const result = {
        sentiment: analysis.sentiment || {},
        entities: analysis.entities || [],
        topics: analysis.topics || [],
        summary: analysis.summary || '',
        metadata: {
          ...input.metadata,
          analysisTime: Date.now() - startTime
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.analyze.count', 1);
        this.metrics.recordTiming('multi-modal.text.analyze.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to analyze text:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.analyze.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Embeds text into vector representation.
   * @param {Object} input - Input data
   * @param {string} input.text - Text to embed
   * @param {Object} [input.metadata] - Text metadata
   * @param {Object} [options] - Embedding options
   * @returns {Promise<Object>} - Embedding result
   */
  async embedText(input, options = {}) {
    try {
      // Start timing
      const startTime = Date.now();
      
      // Validate input
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid input: expected an object');
      }
      
      if (!input.text || typeof input.text !== 'string') {
        throw new Error('Invalid input: text is required and must be a string');
      }
      
      // Check cache
      const cacheKey = this.getCacheKey('embed', input, options);
      const cachedResult = this.getFromCache(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Using cached text embedding result');
        return cachedResult;
      }
      
      // Embed text
      let embedding;
      
      if (this.models.embedding) {
        // Use model for embedding
        const modelResult = await this.models.embedding.run({
          text: input.text,
          options
        });
        
        embedding = modelResult.embedding;
      } else {
        // Fallback embedding
        embedding = this.fallbackEmbedding(input.text, options);
      }
      
      // Prepare result
      const result = {
        embedding,
        metadata: {
          ...input.metadata,
          dimensions: embedding.length,
          embeddingTime: Date.now() - startTime
        }
      };
      
      // Cache result
      this.addToCache(cacheKey, result);
      
      // Record metrics
      if (this.metrics) {
        this.metrics.record('multi-modal.text.embed.count', 1);
        this.metrics.recordTiming('multi-modal.text.embed.time', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to embed text:', error);
      
      // Record error metric
      if (this.metrics) {
        this.metrics.record('multi-modal.text.embed.error', 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Preprocesses text.
   * @param {string} text - Text to preprocess
   * @param {Object} [options] - Preprocessing options
   * @returns {string} - Preprocessed text
   * @private
   */
  preprocessText(text, options = {}) {
    // Get preprocessing options
    const normalize = options.normalize !== false;
    const trim = options.trim !== false;
    const lowercase = options.lowercase === true;
    
    let result = text;
    
    // Trim whitespace
    if (trim) {
      result = result.trim();
    }
    
    // Convert to lowercase
    if (lowercase) {
      result = result.toLowerCase();
    }
    
    // Normalize whitespace
    if (normalize) {
      result = result.replace(/\s+/g, ' ');
    }
    
    return result;
  }
  
  /**
   * Postprocesses text.
   * @param {string} text - Text to postprocess
   * @param {Object} [options] - Postprocessing options
   * @returns {string} - Postprocessed text
   * @private
   */
  postprocessText(text, options = {}) {
    // Get postprocessing options
    const trim = options.trim !== false;
    const fixPunctuation = options.fixPunctuation !== false;
    
    let result = text;
    
    // Trim whitespace
    if (trim) {
      result = result.trim();
    }
    
    // Fix punctuation
    if (fixPunctuation) {
      // Fix spaces before punctuation
      result = result.replace(/\s+([.,;:!?)])/g, '$1');
      
      // Fix spaces after opening parentheses
      result = result.replace(/\((\s+)/g, '(');
      
      // Ensure single space after punctuation
      result = result.replace(/([.,;:!?])\s*/g, '$1 ');
      
      // Fix final punctuation
      if (!/[.,;:!?]$/.test(result)) {
        result = result + '.';
      }
    }
    
    return result;
  }
  
  /**
   * Prepares input for text generation.
   * @param {Object} spec - Text specification
   * @param {Object} context - Generation context
   * @param {Object} options - Generation options
   * @returns {Object} - Generation input
   * @private
   */
  prepareGenerationInput(spec, context, options) {
    // Get generation parameters
    const prompt = spec.prompt || '';
    const parameters = spec.parameters || {};
    
    // Prepare context
    const preparedContext = {};
    
    if (context.conversation) {
      preparedContext.conversation = context.conversation;
    }
    
    if (context.documents) {
      preparedContext.documents = context.documents;
    }
    
    if (context.user) {
      preparedContext.user = context.user;
    }
    
    // Prepare generation input
    return {
      prompt,
      parameters,
      context: preparedContext,
      options
    };
  }
  
  /**
   * Fallback text generation when no model is available.
   * @param {Object} input - Generation input
   * @param {Object} options - Generation options
   * @returns {string} - Generated text
   * @private
   */
  fallbackGeneration(input, options) {
    this.logger.warn('Using fallback text generation');
    
    // Simple fallback generation
    return `Generated text based on prompt: "${input.prompt}"`;
  }
  
  /**
   * Fallback feature extraction when no model is available.
   * @param {string} text - Text to extract features from
   * @param {Object} options - Extraction options
   * @returns {Object} - Extracted features
   * @private
   */
  fallbackFeatureExtraction(text, options) {
    this.logger.warn('Using fallback text feature extraction');
    
    // Simple fallback feature extraction
    return {
      semantic: {
        keywords: text.split(/\s+/).filter(word => word.length > 4).slice(0, 5)
      },
      syntactic: {
        length: text.length,
        wordCount: text.split(/\s+/).length
      },
      statistical: {
        averageWordLength: text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / text.split(/\s+/).length
      }
    };
  }
  
  /**
   * Fallback feature alignment when no model is available.
   * @param {Object} features - Text features
   * @param {Array<Object>} otherFeatures - Features from other modalities
   * @param {Object} options - Alignment options
   * @returns {Object} - Aligned features
   * @private
   */
  fallbackFeatureAlignment(features, otherFeatures, options) {
    this.logger.warn('Using fallback text feature alignment');
    
    // Simple fallback feature alignment
    return {
      ...features,
      alignments: otherFeatures.map(other => ({
        modality: other.modality,
        score: 0.5
      }))
    };
  }
  
  /**
   * Fallback text transformation when no model is available.
   * @param {Object} input - Transformation input
   * @param {Object} options - Transformation options
   * @returns {string} - Transformed text
   * @private
   */
  fallbackTransformation(input, options) {
    this.logger.warn(`Using fallback text transformation for ${input.transformation}`);
    
    // Simple fallback transformations
    switch (input.transformation) {
      case 'translate':
        return `[Translated to ${input.parameters.targetLanguage || 'target language'}]: ${input.text}`;
      
      case 'summarize':
        return `[Summary]: ${input.text.substring(0, 100)}...`;
      
      case 'paraphrase':
        return `[Paraphrased]: ${input.text}`;
      
      default:
        return `[Transformed (${input.transformation})]: ${input.text}`;
    }
  }
  
  /**
   * Fallback text analysis when no model is available.
   * @param {string} text - Text to analyze
   * @param {Object} features - Text features
   * @param {Object} options - Analysis options
   * @returns {Object} - Analysis result
   * @private
   */
  fallbackAnalysis(text, features, options) {
    this.logger.warn('Using fallback text analysis');
    
    // Simple fallback analysis
    return {
      sentiment: {
        positive: 0.33,
        neutral: 0.34,
        negative: 0.33
      },
      entities: [],
      topics: [],
      summary: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    };
  }
  
  /**
   * Fallback text embedding when no model is available.
   * @param {string} text - Text to embed
   * @param {Object} options - Embedding options
   * @returns {Array<number>} - Embedding vector
   * @private
   */
  fallbackEmbedding(text, options) {
    this.logger.warn('Using fallback text embedding');
    
    // Simple fallback embedding (random vector)
    const dimensions = options.dimensions || 128;
    return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  }
  
  /**
   * Gets a cache key for the given operation and inputs.
   * @param {string} operation - Operation name
   * @param {...any} inputs - Operation inputs
   * @returns {string} - Cache key
   * @private
   */
  getCacheKey(operation, ...inputs) {
    try {
      // Create a simplified representation of the inputs
      const simplifiedInputs = inputs.map(input => {
        if (typeof input === 'string') {
          return input;
        }
        
        if (typeof input === 'object' && input !== null) {
          const simplified = {};
          
          // Include only primitive values and arrays of primitives
          for (const [key, value] of Object.entries(input)) {
            if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean' ||
              (Array.isArray(value) && value.every(item => typeof item !== 'object' || item === null))
            ) {
              simplified[key] = value;
            }
          }
          
          return simplified;
        }
        
        return input;
      });
      
      // Create a hash of the operation and simplified inputs
      return `${operation}:${JSON.stringify(simplifiedInputs)}`;
    } catch (error) {
      this.logger.error('Failed to create cache key:', error);
      return `${operation}:${Date.now()}:${Math.random()}`;
    }
  }
  
  /**
   * Gets a value from the cache.
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found
   * @private
   */
  getFromCache(key) {
    if (!this.cache || !this.cache.has(key)) {
      if (this.cacheMisses !== undefined) {
        this.cacheMisses++;
      }
      return null;
    }
    
    const entry = this.cache.get(key);
    
    // Move entry to the end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    if (this.cacheHits !== undefined) {
      this.cacheHits++;
    }
    
    return entry;
  }
  
  /**
   * Adds a value to the cache.
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @private
   */
  addToCache(key, value) {
    if (!this.cache) {
      return;
    }
    
    // If cache is full, remove oldest entry (first in map)
    if (this.cacheSize && this.cache.size >= this.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    // Add new entry
    this.cache.set(key, value);
  }
}

module.exports = TextHandler;
