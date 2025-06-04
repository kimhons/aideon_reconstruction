/**
 * @fileoverview Multi-Context Understanding Mechanism for Aideon AI Desktop Agent.
 * This component enables the system to identify, activate, and process multiple contexts
 * simultaneously, allowing for more nuanced understanding and reasoning across different
 * contextual dimensions.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const crypto = require('crypto');

/**
 * Enum for context types supported by the mechanism.
 * @enum {string}
 */
const ContextType = {
  TEMPORAL: 'temporal',
  SPATIAL: 'spatial',
  DOMAIN: 'domain',
  EMOTIONAL: 'emotional',
  LINGUISTIC: 'linguistic',
  CULTURAL: 'cultural',
  PERSONAL: 'personal',
  SOCIAL: 'social'
};

/**
 * Multi-Context Understanding Mechanism class.
 * Enables the system to identify, activate, and process multiple contexts simultaneously.
 */
class MultiContextUnderstandingMechanism {
  /**
   * Creates an instance of MultiContextUnderstandingMechanism.
   * @param {Object} dependencies - Dependencies required by the mechanism.
   * @param {Object} dependencies.logger - Logger instance.
   * @param {Object} dependencies.performanceMonitor - Performance monitoring instance.
   * @param {Object} dependencies.configService - Configuration service instance.
   * @param {Object} dependencies.securityManager - Security manager instance.
   * @param {Object} dependencies.hierarchicalReasoningFramework - Hierarchical reasoning framework instance.
   * @param {Object} dependencies.abstractionLayerManager - Abstraction layer manager instance.
   * @param {Object} [dependencies.nlpService] - NLP service for advanced context identification.
   * @param {Object} [dependencies.vectorService] - Vector service for embeddings and similarity.
   * @throws {Error} If required dependencies are missing.
   */
  constructor(dependencies) {
    this._validateDependencies(dependencies);
    
    // Store dependencies
    this.logger = dependencies.logger;
    this.performanceMonitor = dependencies.performanceMonitor;
    this.configService = dependencies.configService;
    this.securityManager = dependencies.securityManager;
    this.hierarchicalReasoningFramework = dependencies.hierarchicalReasoningFramework;
    this.abstractionLayerManager = dependencies.abstractionLayerManager;
    this.nlpService = dependencies.nlpService;
    this.vectorService = dependencies.vectorService;
    
    // Initialize configuration
    this.config = this._initializeConfig();
    
    // Initialize data structures
    this.activeContexts = new Map(); // Map of active context objects by ID
    this.contextMemory = new Map(); // Map of deactivated contexts by ID
    this.contextCache = new Map(); // Cache for context identification results
    
    // Set configuration flags
    this.contextBlendingEnabled = this.config.contextBlendingEnabled;
    this.contextMemoryEnabled = this.config.contextMemoryEnabled;
    this.contextCacheEnabled = this.config.contextCacheEnabled;
    this.parallelProcessingEnabled = this.config.parallelProcessingEnabled;
    
    // Initialize memory cleanup interval if enabled
    if (this.contextMemoryEnabled && this.config.contextMemoryTTL > 0) {
      this.memoryCleanupInterval = setInterval(() => {
        this._cleanupContextMemory();
      }, Math.min(this.config.contextMemoryTTL / 2, 3600000)); // Half of TTL or max 1 hour
    }
    
    // Initialize cache cleanup interval if enabled
    if (this.contextCacheEnabled && this.config.contextCacheTTL > 0) {
      this.cacheCleanupInterval = setInterval(() => {
        this._cleanupCache();
      }, Math.min(this.config.contextCacheTTL / 2, 3600000)); // Half of TTL or max 1 hour
    }
    
    this.logger.info('MultiContextUnderstandingMechanism initialized');
  }
  
  /**
   * Validates that all required dependencies are provided.
   * @param {Object} dependencies - Dependencies to validate.
   * @throws {Error} If any required dependency is missing.
   * @private
   */
  _validateDependencies(dependencies) {
    const requiredDependencies = [
      'logger',
      'performanceMonitor',
      'configService',
      'securityManager',
      'hierarchicalReasoningFramework',
      'abstractionLayerManager'
    ];
    
    const missingDependencies = requiredDependencies.filter(dep => !dependencies[dep]);
    
    if (missingDependencies.length > 0) {
      throw new Error(`Missing required dependencies: ${missingDependencies.join(', ')}`);
    }
  }
  
  /**
   * Initializes configuration from the configuration service.
   * @returns {Object} Validated configuration object.
   * @throws {Error} If configuration is invalid.
   * @private
   */
  _initializeConfig() {
    const config = this.configService.getConfig() || {};
    
    // Set defaults for missing configuration
    const defaultConfig = {
      enabledContextTypes: Object.values(ContextType),
      maxActiveContexts: 5,
      contextBlendingEnabled: true,
      contextSwitchingThreshold: 0.6,
      conflictResolutionStrategy: 'weighted',
      contextMemoryEnabled: true,
      contextMemoryTTL: 3600000, // 1 hour in milliseconds
      contextIdentificationConfidenceThreshold: 0.5,
      useAdvancedIdentification: true,
      contextCacheEnabled: true,
      contextCacheTTL: 600000, // 10 minutes in milliseconds
      parallelProcessingEnabled: true
    };
    
    // Merge with defaults
    const mergedConfig = { ...defaultConfig, ...config };
    
    // Validate configuration
    this._validateConfig(mergedConfig);
    
    return mergedConfig;
  }
  
  /**
   * Validates the configuration object.
   * @param {Object} config - Configuration to validate.
   * @throws {Error} If configuration is invalid.
   * @private
   */
  _validateConfig(config) {
    // Validate maxActiveContexts
    if (typeof config.maxActiveContexts !== 'number' || config.maxActiveContexts <= 0) {
      throw new Error('maxActiveContexts must be a positive number');
    }
    
    // Validate contextSwitchingThreshold
    if (typeof config.contextSwitchingThreshold !== 'number' || 
        config.contextSwitchingThreshold < 0 || 
        config.contextSwitchingThreshold > 1) {
      throw new Error('contextSwitchingThreshold must be between 0 and 1');
    }
    
    // Validate conflictResolutionStrategy
    const validStrategies = ['weighted', 'priority', 'recency', 'hybrid'];
    if (!validStrategies.includes(config.conflictResolutionStrategy)) {
      throw new Error(`conflictResolutionStrategy must be one of: ${validStrategies.join(', ')}`);
    }
    
    // Validate contextMemoryTTL
    if (typeof config.contextMemoryTTL !== 'number' || config.contextMemoryTTL < 0) {
      throw new Error('contextMemoryTTL must be a non-negative number');
    }
    
    // Validate contextIdentificationConfidenceThreshold
    if (typeof config.contextIdentificationConfidenceThreshold !== 'number' || 
        config.contextIdentificationConfidenceThreshold < 0 || 
        config.contextIdentificationConfidenceThreshold > 1) {
      throw new Error('contextIdentificationConfidenceThreshold must be between 0 and 1');
    }
    
    // Validate contextCacheTTL
    if (typeof config.contextCacheTTL !== 'number' || config.contextCacheTTL < 0) {
      throw new Error('contextCacheTTL must be a non-negative number');
    }
  }
  
  /**
   * Returns all available context types.
   * @returns {Array<string>} Array of available context types.
   */
  getAvailableContextTypes() {
    return this.config.enabledContextTypes;
  }
  
  /**
   * Checks if a context type is available.
   * @param {string} contextType - Context type to check.
   * @returns {boolean} True if the context type is available, false otherwise.
   */
  hasContextType(contextType) {
    return this.config.enabledContextTypes.includes(contextType);
  }
  
  /**
   * Identifies contexts in the provided input data.
   * @param {Object} input - Input data to identify contexts in.
   * @param {string} input.id - Unique identifier for the input.
   * @param {string} input.content - Content to analyze.
   * @param {Object} [input.metadata] - Additional metadata.
   * @param {Object} [options] - Options for context identification.
   * @param {Array<string>} [options.contextTypes] - Specific context types to identify.
   * @param {number} [options.confidenceThreshold] - Minimum confidence threshold.
   * @returns {Promise<Array<Object>>} Promise resolving to array of identified contexts.
   * @throws {Error} If input is invalid or context identification fails.
   */
  async identifyContexts(input, options = {}) {
    const timerId = this.performanceMonitor.startTimer('identifyContexts');
    
    try {
      // Validate input
      if (!input || !input.id || !input.content) {
        throw new Error('Invalid input: must contain id and content properties');
      }
      
      // Validate options
      const contextTypes = options.contextTypes || this.config.enabledContextTypes;
      const confidenceThreshold = options.confidenceThreshold || 
                                 this.config.contextIdentificationConfidenceThreshold;
      
      // Validate context types
      for (const type of contextTypes) {
        if (!this.hasContextType(type)) {
          throw new Error(`Invalid context type: ${type}`);
        }
      }
      
      // Validate confidence threshold
      if (confidenceThreshold < 0 || confidenceThreshold > 1) {
        throw new Error('confidenceThreshold must be between 0 and 1');
      }
      
      // Check cache if enabled
      if (this.contextCacheEnabled) {
        const cacheKey = this._generateCacheKey(input, options);
        const cachedResult = this._getFromCache(cacheKey);
        
        if (cachedResult) {
          this.logger.debug(`Cache hit for input ${input.id}`);
          return cachedResult;
        }
      }
      
      // Identify contexts based on configuration
      let identifiedContexts;
      
      if (this.config.useAdvancedIdentification && this.nlpService && this.vectorService) {
        identifiedContexts = await this._identifyContextsAdvanced(input, contextTypes);
      } else {
        identifiedContexts = await this._identifyContextsBasic(input, contextTypes);
      }
      
      // Filter by confidence threshold
      const filteredContexts = identifiedContexts.filter(
        context => context.confidence >= confidenceThreshold
      );
      
      // Sort by confidence (descending)
      filteredContexts.sort((a, b) => b.confidence - a.confidence);
      
      // Store in cache if enabled
      if (this.contextCacheEnabled) {
        const cacheKey = this._generateCacheKey(input, options);
        this._storeInCache(cacheKey, filteredContexts);
      }
      
      return filteredContexts;
    } catch (error) {
      this.logger.error(`Error identifying contexts: ${error.message}`, error);
      throw error;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Identifies contexts using advanced NLP and vector embedding techniques.
   * @param {Object} input - Input data to identify contexts in.
   * @param {Array<string>} contextTypes - Context types to identify.
   * @returns {Promise<Array<Object>>} Promise resolving to array of identified contexts.
   * @private
   */
  async _identifyContextsAdvanced(input, contextTypes) {
    try {
      // Analyze text with NLP service
      const nlpAnalysis = await this.nlpService.analyzeText(input.content);
      
      // Get vector embedding for input content
      const contentEmbedding = await this.vectorService.getEmbedding(input.content);
      
      // Process through abstraction layers
      const processedData = await this.abstractionLayerManager.processData(input);
      
      // Extract entities, sentiment, keywords, etc.
      const entities = nlpAnalysis.entities || [];
      const sentiment = nlpAnalysis.sentiment || { score: 0.5, label: 'neutral' };
      const keywords = await this.nlpService.extractKeywords(input.content) || [];
      const language = nlpAnalysis.language || 'en';
      
      // Initialize results array
      const results = [];
      
      // Process each context type in parallel if enabled
      if (this.parallelProcessingEnabled) {
        const contextPromises = contextTypes.map(type => 
          this._identifyContextOfTypeAdvanced(type, input, {
            nlpAnalysis,
            contentEmbedding,
            processedData,
            entities,
            sentiment,
            keywords,
            language
          })
        );
        
        const contextResults = await Promise.all(contextPromises);
        results.push(...contextResults.filter(context => context !== null));
      } else {
        // Process sequentially
        for (const type of contextTypes) {
          const context = await this._identifyContextOfTypeAdvanced(type, input, {
            nlpAnalysis,
            contentEmbedding,
            processedData,
            entities,
            sentiment,
            keywords,
            language
          });
          
          if (context) {
            results.push(context);
          }
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Error in advanced context identification: ${error.message}`, error);
      // Fall back to basic identification
      return this._identifyContextsBasic(input, contextTypes);
    }
  }
  
  /**
   * Identifies a specific type of context using advanced techniques.
   * @param {string} contextType - Type of context to identify.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Promise<Object|null>} Promise resolving to identified context or null.
   * @private
   */
  async _identifyContextOfTypeAdvanced(contextType, input, analysisData) {
    try {
      const {
        nlpAnalysis,
        contentEmbedding,
        processedData,
        entities,
        sentiment,
        keywords,
        language
      } = analysisData;
      
      // Generate a unique ID for the context
      const contextId = `${contextType}-${input.id}-${Date.now()}`;
      
      // Initialize context object with common properties
      const context = {
        id: contextId,
        type: contextType,
        confidence: 0,
        attributes: {},
        timestamp: Date.now()
      };
      
      // Identify context based on type
      switch (contextType) {
        case ContextType.TEMPORAL:
          return this._identifyTemporalContext(context, input, analysisData);
          
        case ContextType.SPATIAL:
          return this._identifySpatialContext(context, input, analysisData);
          
        case ContextType.DOMAIN:
          return this._identifyDomainContext(context, input, analysisData);
          
        case ContextType.EMOTIONAL:
          return this._identifyEmotionalContext(context, input, analysisData);
          
        case ContextType.LINGUISTIC:
          return this._identifyLinguisticContext(context, input, analysisData);
          
        case ContextType.CULTURAL:
          return this._identifyCulturalContext(context, input, analysisData);
          
        case ContextType.PERSONAL:
          return this._identifyPersonalContext(context, input, analysisData);
          
        case ContextType.SOCIAL:
          return this._identifySocialContext(context, input, analysisData);
          
        default:
          this.logger.warn(`Unknown context type: ${contextType}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Error identifying ${contextType} context: ${error.message}`, error);
      return null;
    }
  }
  
  /**
   * Identifies temporal context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifyTemporalContext(context, input, analysisData) {
    const { entities } = analysisData;
    
    // Look for temporal entities (dates, times, durations)
    const temporalEntities = entities.filter(entity => 
      entity.type === 'DATE' || 
      entity.type === 'TIME' || 
      entity.type === 'DURATION'
    );
    
    // Check input metadata for temporal information
    const metadataTime = input.metadata?.timestamp || 
                        input.metadata?.date || 
                        input.metadata?.time;
    
    // If no temporal entities or metadata, return null
    if (temporalEntities.length === 0 && !metadataTime) {
      return null;
    }
    
    // Extract temporal information
    let temporalInfo = {};
    let confidence = 0;
    
    // Process entities
    if (temporalEntities.length > 0) {
      // Get the highest confidence entity
      const primaryEntity = temporalEntities.reduce(
        (prev, current) => (current.confidence > prev.confidence) ? current : prev,
        temporalEntities[0]
      );
      
      temporalInfo.entity = primaryEntity.text;
      temporalInfo.entityType = primaryEntity.type;
      confidence = primaryEntity.confidence;
    }
    
    // Process metadata
    if (metadataTime) {
      temporalInfo.timestamp = metadataTime;
      // If we have both entity and metadata, increase confidence
      confidence = temporalEntities.length > 0 ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Temporal Context: ${temporalInfo.entity || new Date(temporalInfo.timestamp).toISOString()}`;
    context.confidence = confidence;
    context.attributes = {
      ...temporalInfo,
      detectionMethod: temporalEntities.length > 0 ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies spatial context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifySpatialContext(context, input, analysisData) {
    const { entities } = analysisData;
    
    // Look for location entities
    const locationEntities = entities.filter(entity => 
      entity.type === 'LOCATION' || 
      entity.type === 'GPE' || 
      entity.type === 'FAC'
    );
    
    // Check input metadata for location information
    const metadataLocation = input.metadata?.location || 
                            input.metadata?.place || 
                            input.metadata?.coordinates;
    
    // If no location entities or metadata, return null
    if (locationEntities.length === 0 && !metadataLocation) {
      return null;
    }
    
    // Extract spatial information
    let spatialInfo = {};
    let confidence = 0;
    
    // Process entities
    if (locationEntities.length > 0) {
      // Get the highest confidence entity
      const primaryEntity = locationEntities.reduce(
        (prev, current) => (current.confidence > prev.confidence) ? current : prev,
        locationEntities[0]
      );
      
      spatialInfo.location = primaryEntity.text;
      spatialInfo.locationType = primaryEntity.type;
      confidence = primaryEntity.confidence;
    }
    
    // Process metadata
    if (metadataLocation) {
      spatialInfo.metadataLocation = metadataLocation;
      // If we have both entity and metadata, increase confidence
      confidence = locationEntities.length > 0 ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Spatial Context: ${spatialInfo.location || JSON.stringify(spatialInfo.metadataLocation)}`;
    context.confidence = confidence;
    context.attributes = {
      ...spatialInfo,
      detectionMethod: locationEntities.length > 0 ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies domain context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifyDomainContext(context, input, analysisData) {
    const { keywords, contentEmbedding } = analysisData;
    
    // Check input metadata for domain information
    const metadataDomain = input.metadata?.domain || 
                          input.metadata?.category || 
                          input.metadata?.topic;
    
    // Domain keywords to check against
    const domainKeywords = {
      technology: ['technology', 'software', 'hardware', 'computer', 'digital', 'ai', 'algorithm'],
      business: ['business', 'finance', 'economy', 'market', 'investment', 'stock', 'company'],
      health: ['health', 'medical', 'medicine', 'doctor', 'patient', 'disease', 'treatment'],
      science: ['science', 'research', 'experiment', 'theory', 'physics', 'chemistry', 'biology'],
      arts: ['art', 'music', 'painting', 'literature', 'film', 'theater', 'creative'],
      sports: ['sport', 'game', 'team', 'player', 'competition', 'match', 'tournament']
    };
    
    // Initialize domain scores
    const domainScores = {};
    let highestScore = 0;
    let highestDomain = null;
    
    // If we have keywords, calculate domain scores
    if (keywords && keywords.length > 0) {
      // Calculate scores for each domain
      for (const [domain, domainKeywordList] of Object.entries(domainKeywords)) {
        let score = 0;
        
        // Check each keyword against domain keywords
        for (const keyword of keywords) {
          if (domainKeywordList.includes(keyword.toLowerCase())) {
            score += 1;
          }
        }
        
        // Normalize score
        domainScores[domain] = score / Math.max(keywords.length, domainKeywordList.length);
        
        // Update highest score
        if (domainScores[domain] > highestScore) {
          highestScore = domainScores[domain];
          highestDomain = domain;
        }
      }
    }
    
    // If metadata domain is provided, use it
    if (metadataDomain) {
      highestDomain = metadataDomain;
      highestScore = 0.9; // High confidence for metadata
    }
    
    // If no domain identified, return null
    if (!highestDomain) {
      return null;
    }
    
    // Set context properties
    context.name = `Domain Context: ${highestDomain}`;
    context.confidence = highestScore;
    context.attributes = {
      domain: highestDomain,
      domainScores: domainScores,
      detectionMethod: metadataDomain ? 'metadata' : 'keywords'
    };
    
    return context;
  }
  
  /**
   * Identifies emotional context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifyEmotionalContext(context, input, analysisData) {
    const { sentiment } = analysisData;
    
    // Check input metadata for emotional information
    const metadataEmotion = input.metadata?.emotion || 
                           input.metadata?.sentiment || 
                           input.metadata?.mood;
    
    // If no sentiment analysis or metadata, return null
    if (!sentiment && !metadataEmotion) {
      return null;
    }
    
    // Extract emotional information
    let emotionalInfo = {};
    let confidence = 0;
    
    // Process sentiment analysis
    if (sentiment) {
      emotionalInfo.sentiment = sentiment.label;
      emotionalInfo.sentimentScore = sentiment.score;
      confidence = Math.abs(sentiment.score - 0.5) * 2; // Convert to 0-1 range
    }
    
    // Process metadata
    if (metadataEmotion) {
      emotionalInfo.metadataEmotion = metadataEmotion;
      // If we have both sentiment and metadata, increase confidence
      confidence = sentiment ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Emotional Context: ${emotionalInfo.sentiment || emotionalInfo.metadataEmotion}`;
    context.confidence = confidence;
    context.attributes = {
      ...emotionalInfo,
      detectionMethod: sentiment ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies linguistic context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifyLinguisticContext(context, input, analysisData) {
    const { language } = analysisData;
    
    // Check input metadata for language information
    const metadataLanguage = input.metadata?.language || 
                            input.metadata?.lang;
    
    // If no language detection or metadata, return null
    if (!language && !metadataLanguage) {
      return null;
    }
    
    // Extract linguistic information
    let linguisticInfo = {};
    let confidence = 0.8; // Default confidence for language detection
    
    // Process language detection
    if (language) {
      linguisticInfo.language = language;
    }
    
    // Process metadata
    if (metadataLanguage) {
      linguisticInfo.metadataLanguage = metadataLanguage;
      // If we have both detection and metadata, increase confidence
      confidence = language ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Linguistic Context: ${linguisticInfo.language || linguisticInfo.metadataLanguage}`;
    context.confidence = confidence;
    context.attributes = {
      ...linguisticInfo,
      detectionMethod: language ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies cultural context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifyCulturalContext(context, input, analysisData) {
    const { entities } = analysisData;
    
    // Look for cultural entities
    const culturalEntities = entities.filter(entity => 
      entity.type === 'NORP' || // Nationalities, religious or political groups
      entity.type === 'EVENT' || // Cultural events
      entity.type === 'WORK_OF_ART' // Cultural artifacts
    );
    
    // Check input metadata for cultural information
    const metadataCulture = input.metadata?.culture || 
                           input.metadata?.region || 
                           input.metadata?.country;
    
    // If no cultural entities or metadata, return null
    if (culturalEntities.length === 0 && !metadataCulture) {
      return null;
    }
    
    // Extract cultural information
    let culturalInfo = {};
    let confidence = 0;
    
    // Process entities
    if (culturalEntities.length > 0) {
      // Get the highest confidence entity
      const primaryEntity = culturalEntities.reduce(
        (prev, current) => (current.confidence > prev.confidence) ? current : prev,
        culturalEntities[0]
      );
      
      culturalInfo.entity = primaryEntity.text;
      culturalInfo.entityType = primaryEntity.type;
      confidence = primaryEntity.confidence;
    }
    
    // Process metadata
    if (metadataCulture) {
      culturalInfo.metadataCulture = metadataCulture;
      // If we have both entity and metadata, increase confidence
      confidence = culturalEntities.length > 0 ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Cultural Context: ${culturalInfo.entity || culturalInfo.metadataCulture}`;
    context.confidence = confidence;
    context.attributes = {
      ...culturalInfo,
      detectionMethod: culturalEntities.length > 0 ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies personal context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifyPersonalContext(context, input, analysisData) {
    const { entities } = analysisData;
    
    // Look for personal entities
    const personalEntities = entities.filter(entity => 
      entity.type === 'PERSON'
    );
    
    // Check input metadata for personal information
    const metadataUser = input.metadata?.user || 
                        input.metadata?.person || 
                        input.metadata?.author;
    
    // If no personal entities or metadata, return null
    if (personalEntities.length === 0 && !metadataUser) {
      return null;
    }
    
    // Extract personal information
    let personalInfo = {};
    let confidence = 0;
    
    // Process entities
    if (personalEntities.length > 0) {
      // Get the highest confidence entity
      const primaryEntity = personalEntities.reduce(
        (prev, current) => (current.confidence > prev.confidence) ? current : prev,
        personalEntities[0]
      );
      
      personalInfo.person = primaryEntity.text;
      confidence = primaryEntity.confidence;
    }
    
    // Process metadata
    if (metadataUser) {
      personalInfo.user = metadataUser;
      // If we have both entity and metadata, increase confidence
      confidence = personalEntities.length > 0 ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Personal Context: ${personalInfo.person || personalInfo.user}`;
    context.confidence = confidence;
    context.attributes = {
      ...personalInfo,
      detectionMethod: personalEntities.length > 0 ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies social context from input.
   * @param {Object} context - Base context object.
   * @param {Object} input - Input data.
   * @param {Object} analysisData - Pre-processed analysis data.
   * @returns {Object|null} Identified context or null.
   * @private
   */
  _identifySocialContext(context, input, analysisData) {
    const { entities } = analysisData;
    
    // Look for social entities
    const socialEntities = entities.filter(entity => 
      entity.type === 'ORG' || // Organizations
      entity.type === 'GPE' // Geopolitical entities
    );
    
    // Check input metadata for social information
    const metadataSocial = input.metadata?.organization || 
                          input.metadata?.group || 
                          input.metadata?.social;
    
    // If no social entities or metadata, return null
    if (socialEntities.length === 0 && !metadataSocial) {
      return null;
    }
    
    // Extract social information
    let socialInfo = {};
    let confidence = 0;
    
    // Process entities
    if (socialEntities.length > 0) {
      // Get the highest confidence entity
      const primaryEntity = socialEntities.reduce(
        (prev, current) => (current.confidence > prev.confidence) ? current : prev,
        socialEntities[0]
      );
      
      socialInfo.entity = primaryEntity.text;
      socialInfo.entityType = primaryEntity.type;
      confidence = primaryEntity.confidence;
    }
    
    // Process metadata
    if (metadataSocial) {
      socialInfo.metadataSocial = metadataSocial;
      // If we have both entity and metadata, increase confidence
      confidence = socialEntities.length > 0 ? (confidence + 0.9) / 2 : 0.9;
    }
    
    // Set context properties
    context.name = `Social Context: ${socialInfo.entity || socialInfo.metadataSocial}`;
    context.confidence = confidence;
    context.attributes = {
      ...socialInfo,
      detectionMethod: socialEntities.length > 0 ? 'nlp' : 'metadata'
    };
    
    return context;
  }
  
  /**
   * Identifies contexts using basic techniques.
   * @param {Object} input - Input data to identify contexts in.
   * @param {Array<string>} contextTypes - Context types to identify.
   * @returns {Promise<Array<Object>>} Promise resolving to array of identified contexts.
   * @private
   */
  async _identifyContextsBasic(input, contextTypes) {
    try {
      // Initialize results array
      const results = [];
      
      // Process each context type
      for (const type of contextTypes) {
        // Generate a unique ID for the context
        const contextId = `${type}-${input.id}-${Date.now()}`;
        
        // Initialize context object with common properties
        const context = {
          id: contextId,
          type: type,
          confidence: 0,
          attributes: {},
          timestamp: Date.now()
        };
        
        // Identify context based on type
        switch (type) {
          case ContextType.TEMPORAL:
            // Check for temporal information in metadata
            if (input.metadata?.timestamp || input.metadata?.date || input.metadata?.time) {
              const timestamp = input.metadata.timestamp || input.metadata.date || input.metadata.time;
              context.name = `Temporal Context: ${new Date(timestamp).toISOString()}`;
              context.confidence = 0.8;
              context.attributes = {
                timestamp: timestamp,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          case ContextType.SPATIAL:
            // Check for spatial information in metadata
            if (input.metadata?.location || input.metadata?.place || input.metadata?.coordinates) {
              const location = input.metadata.location || input.metadata.place || input.metadata.coordinates;
              context.name = `Spatial Context: ${JSON.stringify(location)}`;
              context.confidence = 0.8;
              context.attributes = {
                location: location,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          case ContextType.DOMAIN:
            // Check for domain information in metadata
            if (input.metadata?.domain || input.metadata?.category || input.metadata?.topic) {
              const domain = input.metadata.domain || input.metadata.category || input.metadata.topic;
              context.name = `Domain Context: ${domain}`;
              context.confidence = 0.8;
              context.attributes = {
                domain: domain,
                detectionMethod: 'metadata'
              };
              results.push(context);
            } else {
              // Basic keyword matching for domains
              const domainKeywords = {
                technology: ['technology', 'software', 'hardware', 'computer', 'digital', 'ai', 'algorithm'],
                business: ['business', 'finance', 'economy', 'market', 'investment', 'stock', 'company'],
                health: ['health', 'medical', 'medicine', 'doctor', 'patient', 'disease', 'treatment'],
                science: ['science', 'research', 'experiment', 'theory', 'physics', 'chemistry', 'biology'],
                arts: ['art', 'music', 'painting', 'literature', 'film', 'theater', 'creative'],
                sports: ['sport', 'game', 'team', 'player', 'competition', 'match', 'tournament']
              };
              
              const content = input.content.toLowerCase();
              let highestScore = 0;
              let highestDomain = null;
              
              for (const [domain, keywords] of Object.entries(domainKeywords)) {
                let score = 0;
                for (const keyword of keywords) {
                  if (content.includes(keyword)) {
                    score += 1;
                  }
                }
                
                // Normalize score
                const normalizedScore = score / keywords.length;
                
                if (normalizedScore > highestScore) {
                  highestScore = normalizedScore;
                  highestDomain = domain;
                }
              }
              
              if (highestDomain && highestScore > 0.1) {
                context.name = `Domain Context: ${highestDomain}`;
                context.confidence = Math.min(highestScore, 0.7); // Cap at 0.7 for basic detection
                context.attributes = {
                  domain: highestDomain,
                  score: highestScore,
                  detectionMethod: 'keyword'
                };
                results.push(context);
              }
            }
            break;
            
          case ContextType.EMOTIONAL:
            // Check for emotional information in metadata
            if (input.metadata?.emotion || input.metadata?.sentiment || input.metadata?.mood) {
              const emotion = input.metadata.emotion || input.metadata.sentiment || input.metadata.mood;
              context.name = `Emotional Context: ${emotion}`;
              context.confidence = 0.8;
              context.attributes = {
                emotion: emotion,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          case ContextType.LINGUISTIC:
            // Check for linguistic information in metadata
            if (input.metadata?.language || input.metadata?.lang) {
              const language = input.metadata.language || input.metadata.lang;
              context.name = `Linguistic Context: ${language}`;
              context.confidence = 0.8;
              context.attributes = {
                language: language,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          case ContextType.CULTURAL:
            // Check for cultural information in metadata
            if (input.metadata?.culture || input.metadata?.region || input.metadata?.country) {
              const culture = input.metadata.culture || input.metadata.region || input.metadata.country;
              context.name = `Cultural Context: ${culture}`;
              context.confidence = 0.8;
              context.attributes = {
                culture: culture,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          case ContextType.PERSONAL:
            // Check for personal information in metadata
            if (input.metadata?.user || input.metadata?.person || input.metadata?.author) {
              const person = input.metadata.user || input.metadata.person || input.metadata.author;
              context.name = `Personal Context: ${person}`;
              context.confidence = 0.8;
              context.attributes = {
                person: person,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          case ContextType.SOCIAL:
            // Check for social information in metadata
            if (input.metadata?.organization || input.metadata?.group || input.metadata?.social) {
              const social = input.metadata.organization || input.metadata.group || input.metadata.social;
              context.name = `Social Context: ${social}`;
              context.confidence = 0.8;
              context.attributes = {
                social: social,
                detectionMethod: 'metadata'
              };
              results.push(context);
            }
            break;
            
          default:
            this.logger.warn(`Unknown context type: ${type}`);
            break;
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Error in basic context identification: ${error.message}`, error);
      return [];
    }
  }
  
  /**
   * Activates the provided contexts.
   * @param {Array<Object>} contexts - Contexts to activate.
   * @param {Object} [options] - Options for context activation.
   * @param {boolean} [options.replaceExisting=false] - Whether to replace existing contexts.
   * @param {boolean} [options.mergeWithExisting=false] - Whether to merge with existing contexts.
   * @returns {Array<Object>} Array of activated contexts.
   * @throws {Error} If contexts array is invalid.
   */
  activateContexts(contexts, options = {}) {
    const timerId = this.performanceMonitor.startTimer('activateContexts');
    
    try {
      // Validate contexts array
      if (!Array.isArray(contexts)) {
        throw new Error('Invalid contexts array');
      }
      
      // Check security access
      if (!this.securityManager.validateAccess('context:activate')) {
        this.logger.warn('Unauthorized attempt to activate contexts');
        return Array.from(this.activeContexts.values());
      }
      
      // Get options
      const replaceExisting = options.replaceExisting || false;
      const mergeWithExisting = options.mergeWithExisting || false;
      
      // If replacing existing contexts, clear active contexts
      if (replaceExisting) {
        this.activeContexts.clear();
      }
      
      // If not merging or replacing, and no contexts to activate, return current active contexts
      if (!mergeWithExisting && !replaceExisting && contexts.length === 0) {
        return Array.from(this.activeContexts.values());
      }
      
      // Process contexts to activate
      for (const context of contexts) {
        // Validate context
        if (!context.id || !context.type || !this.hasContextType(context.type)) {
          this.logger.warn(`Invalid context: ${JSON.stringify(context)}`);
          continue;
        }
        
        // Check if context already exists
        const existingContext = this.activeContexts.get(context.id);
        
        if (existingContext) {
          // If existing context has higher confidence, keep it
          if (existingContext.confidence >= context.confidence) {
            continue;
          }
        }
        
        // Add context to active contexts
        this.activeContexts.set(context.id, {
          ...context,
          activationTime: Date.now()
        });
      }
      
      // Limit active contexts to maxActiveContexts
      if (this.activeContexts.size > this.config.maxActiveContexts) {
        // Sort contexts by confidence (descending)
        const sortedContexts = Array.from(this.activeContexts.values())
          .sort((a, b) => b.confidence - a.confidence);
        
        // Keep only the top maxActiveContexts
        this.activeContexts = new Map(
          sortedContexts
            .slice(0, this.config.maxActiveContexts)
            .map(context => [context.id, context])
        );
      }
      
      return Array.from(this.activeContexts.values());
    } catch (error) {
      this.logger.error(`Error activating contexts: ${error.message}`, error);
      throw error;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Deactivates the specified contexts.
   * @param {Array<string>} contextIds - IDs of contexts to deactivate.
   * @param {Object} [options] - Options for context deactivation.
   * @param {boolean} [options.storeInMemory=false] - Whether to store deactivated contexts in memory.
   * @returns {Array<Object>} Array of remaining active contexts.
   * @throws {Error} If contextIds array is invalid.
   */
  deactivateContexts(contextIds, options = {}) {
    const timerId = this.performanceMonitor.startTimer('deactivateContexts');
    
    try {
      // Validate contextIds array
      if (!Array.isArray(contextIds)) {
        throw new Error('Invalid contextIds array');
      }
      
      // Check security access
      if (!this.securityManager.validateAccess('context:deactivate')) {
        this.logger.warn('Unauthorized attempt to deactivate contexts');
        return Array.from(this.activeContexts.values());
      }
      
      // Get options
      const storeInMemory = options.storeInMemory || false;
      
      // Process context IDs to deactivate
      for (const contextId of contextIds) {
        // Get context
        const context = this.activeContexts.get(contextId);
        
        if (!context) {
          continue;
        }
        
        // Store in memory if requested and enabled
        if (storeInMemory && this.contextMemoryEnabled) {
          this.contextMemory.set(contextId, {
            ...context,
            deactivationTime: Date.now()
          });
        }
        
        // Remove from active contexts
        this.activeContexts.delete(contextId);
      }
      
      return Array.from(this.activeContexts.values());
    } catch (error) {
      this.logger.error(`Error deactivating contexts: ${error.message}`, error);
      throw error;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Enables or disables context memory.
   * @param {boolean} enabled - Whether to enable context memory.
   */
  setContextMemoryEnabled(enabled) {
    this.contextMemoryEnabled = enabled;
    this.logger.info(`Context memory ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Clears context memory.
   */
  clearContextMemory() {
    this.contextMemory.clear();
    this.logger.info('Context memory cleared');
  }
  
  /**
   * Retrieves a context from memory.
   * @param {string} contextId - ID of the context to retrieve.
   * @returns {Object|null} Retrieved context or null if not found.
   * @private
   */
  _getContextFromMemory(contextId) {
    // Check if context exists in memory
    if (!this.contextMemory.has(contextId)) {
      return null;
    }
    
    // Get context
    const context = this.contextMemory.get(contextId);
    
    // Check if context has expired
    if (this.config.contextMemoryTTL > 0) {
      const age = Date.now() - context.deactivationTime;
      
      if (age > this.config.contextMemoryTTL) {
        // Remove expired context
        this.contextMemory.delete(contextId);
        return null;
      }
    }
    
    return context;
  }
  
  /**
   * Cleans up expired contexts from memory.
   * @private
   */
  _cleanupContextMemory() {
    if (!this.contextMemoryEnabled || this.config.contextMemoryTTL <= 0) {
      return;
    }
    
    const now = Date.now();
    let expiredCount = 0;
    
    // Check each context in memory
    for (const [contextId, context] of this.contextMemory.entries()) {
      const age = now - context.deactivationTime;
      
      if (age > this.config.contextMemoryTTL) {
        // Remove expired context
        this.contextMemory.delete(contextId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired contexts from memory`);
    }
  }
  
  /**
   * Generates a cache key for the given input and options.
   * @param {Object} input - Input data.
   * @param {Object} options - Options for context identification.
   * @returns {string} Cache key.
   * @private
   */
  _generateCacheKey(input, options) {
    // Create a string representation of input and options
    const inputStr = JSON.stringify({
      id: input.id,
      content: input.content,
      metadata: input.metadata
    });
    
    const optionsStr = JSON.stringify({
      contextTypes: options.contextTypes,
      confidenceThreshold: options.confidenceThreshold
    });
    
    // Generate hash
    return crypto.createHash('md5').update(`${inputStr}|${optionsStr}`).digest('hex');
  }
  
  /**
   * Stores data in the context cache.
   * @param {string} key - Cache key.
   * @param {*} data - Data to store.
   * @private
   */
  _storeInCache(key, data) {
    if (!this.contextCacheEnabled) {
      return;
    }
    
    this.contextCache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Retrieves data from the context cache.
   * @param {string} key - Cache key.
   * @returns {*|null} Retrieved data or null if not found or expired.
   * @private
   */
  _getFromCache(key) {
    if (!this.contextCacheEnabled || !this.contextCache.has(key)) {
      return null;
    }
    
    const cacheEntry = this.contextCache.get(key);
    
    // Check if entry has expired
    if (this.config.contextCacheTTL > 0) {
      const age = Date.now() - cacheEntry.timestamp;
      
      if (age > this.config.contextCacheTTL) {
        // Remove expired entry
        this.contextCache.delete(key);
        return null;
      }
    }
    
    return cacheEntry.data;
  }
  
  /**
   * Cleans up expired entries from the context cache.
   * @private
   */
  _cleanupCache() {
    if (!this.contextCacheEnabled || this.config.contextCacheTTL <= 0) {
      return;
    }
    
    const now = Date.now();
    let expiredCount = 0;
    
    // Check each entry in cache
    for (const [key, entry] of this.contextCache.entries()) {
      const age = now - entry.timestamp;
      
      if (age > this.config.contextCacheTTL) {
        // Remove expired entry
        this.contextCache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired entries from cache`);
    }
  }
  
  /**
   * Processes input through active contexts.
   * @param {Object} input - Input data to process.
   * @param {string} input.id - Unique identifier for the input.
   * @param {string} input.content - Content to process.
   * @param {Object} [input.metadata] - Additional metadata.
   * @param {Object} [options] - Options for input processing.
   * @param {boolean} [options.identifyContexts=false] - Whether to identify new contexts.
   * @param {boolean} [options.activateNewContexts=false] - Whether to activate newly identified contexts.
   * @param {boolean} [options.useBlending=true] - Whether to blend results from multiple contexts.
   * @returns {Promise<Object>} Promise resolving to processing result.
   * @throws {Error} If input is invalid or processing fails.
   */
  async processInput(input, options = {}) {
    const timerId = this.performanceMonitor.startTimer('processInput');
    
    try {
      // Validate input
      if (!input || !input.id || !input.content) {
        throw new Error('Invalid input: must contain id and content properties');
      }
      
      // Check security access
      if (!this.securityManager.validateAccess('input:process')) {
        this.logger.warn('Unauthorized attempt to process input');
        return {
          processedInput: this.securityManager.sanitizeData(input),
          contexts: [],
          blended: false
        };
      }
      
      // Get options
      const identifyContexts = options.identifyContexts || false;
      const activateNewContexts = options.activateNewContexts || false;
      const useBlending = options.useBlending !== undefined ? options.useBlending : this.contextBlendingEnabled;
      
      // Identify contexts if requested
      let newContexts = [];
      if (identifyContexts) {
        newContexts = await this.identifyContexts(input);
        
        // Activate new contexts if requested
        if (activateNewContexts && newContexts.length > 0) {
          this.activateContexts(newContexts, { mergeWithExisting: true });
        }
      }
      
      // Get active contexts
      const activeContexts = Array.from(this.activeContexts.values());
      
      // If no active contexts, return input as is
      if (activeContexts.length === 0) {
        return {
          processedInput: input,
          contexts: [],
          blended: false
        };
      }
      
      // Process input through each active context
      const contextResults = await this._processInputThroughContexts(input, activeContexts);
      
      // Blend results if requested and multiple contexts are active
      let result;
      if (useBlending && activeContexts.length > 1) {
        result = await this._blendContextResults(input, contextResults);
      } else {
        // Use the highest confidence context as primary
        const primaryContext = activeContexts.reduce(
          (prev, current) => (current.confidence > prev.confidence) ? current : prev,
          activeContexts[0]
        );
        
        result = {
          processedInput: contextResults.get(primaryContext.id)?.processedInput || input,
          contexts: activeContexts,
          blended: false,
          primaryContext: primaryContext
        };
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error processing input: ${error.message}`, error);
      throw error;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Processes input through each active context.
   * @param {Object} input - Input data to process.
   * @param {Array<Object>} contexts - Contexts to process input through.
   * @returns {Promise<Map<string, Object>>} Promise resolving to map of context results.
   * @private
   */
  async _processInputThroughContexts(input, contexts) {
    const results = new Map();
    
    // Process in parallel if enabled
    if (this.parallelProcessingEnabled) {
      const processingPromises = contexts.map(async context => {
        try {
          const processedInput = await this._processInputThroughContext(input, context);
          return { contextId: context.id, processedInput };
        } catch (error) {
          this.logger.error(`Error processing input through context ${context.id}: ${error.message}`, error);
          return { contextId: context.id, error };
        }
      });
      
      const processedResults = await Promise.all(processingPromises);
      
      for (const result of processedResults) {
        if (!result.error) {
          results.set(result.contextId, { processedInput: result.processedInput });
        }
      }
    } else {
      // Process sequentially
      for (const context of contexts) {
        try {
          const processedInput = await this._processInputThroughContext(input, context);
          results.set(context.id, { processedInput });
        } catch (error) {
          this.logger.error(`Error processing input through context ${context.id}: ${error.message}`, error);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Processes input through a specific context.
   * @param {Object} input - Input data to process.
   * @param {Object} context - Context to process input through.
   * @returns {Promise<Object>} Promise resolving to processed input.
   * @private
   */
  async _processInputThroughContext(input, context) {
    try {
      // Process input through abstraction layer manager with context info
      const processedData = await this.abstractionLayerManager.processData(input, {
        contextInfo: {
          id: context.id,
          type: context.type,
          name: context.name,
          attributes: context.attributes
        }
      });
      
      // Return processed input
      return {
        ...input,
        processedContent: processedData,
        contextId: context.id
      };
    } catch (error) {
      this.logger.error(`Error processing input through context ${context.id}: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Blends results from multiple contexts.
   * @param {Object} input - Original input data.
   * @param {Map<string, Object>} contextResults - Results from each context.
   * @returns {Promise<Object>} Promise resolving to blended result.
   * @private
   */
  async _blendContextResults(input, contextResults) {
    try {
      // Get active contexts
      const activeContexts = Array.from(this.activeContexts.values());
      
      // Create blended input
      const blendedInput = { ...input };
      
      // Apply conflict resolution strategy
      switch (this.config.conflictResolutionStrategy) {
        case 'weighted':
          // Blend based on context confidence
          blendedInput.processedContent = this._applyWeightedBlending(contextResults, activeContexts);
          break;
          
        case 'priority':
          // Use context type priority
          blendedInput.processedContent = this._applyPriorityBlending(contextResults, activeContexts);
          break;
          
        case 'recency':
          // Use context activation time
          blendedInput.processedContent = this._applyRecencyBlending(contextResults, activeContexts);
          break;
          
        case 'hybrid':
          // Combine multiple strategies
          blendedInput.processedContent = this._applyHybridBlending(contextResults, activeContexts);
          break;
          
        default:
          // Default to weighted blending
          blendedInput.processedContent = this._applyWeightedBlending(contextResults, activeContexts);
          break;
      }
      
      return {
        processedInput: blendedInput,
        contexts: activeContexts,
        blended: true
      };
    } catch (error) {
      this.logger.error(`Error blending context results: ${error.message}`, error);
      
      // Fall back to using the highest confidence context
      const primaryContext = Array.from(this.activeContexts.values()).reduce(
        (prev, current) => (current.confidence > prev.confidence) ? current : prev,
        Array.from(this.activeContexts.values())[0]
      );
      
      return {
        processedInput: contextResults.get(primaryContext.id)?.processedInput || input,
        contexts: Array.from(this.activeContexts.values()),
        blended: false,
        primaryContext: primaryContext
      };
    }
  }
  
  /**
   * Applies weighted blending strategy.
   * @param {Map<string, Object>} contextResults - Results from each context.
   * @param {Array<Object>} contexts - Active contexts.
   * @returns {*} Blended result.
   * @private
   */
  _applyWeightedBlending(contextResults, contexts) {
    // Calculate total confidence
    const totalConfidence = contexts.reduce((sum, context) => sum + context.confidence, 0);
    
    // If total confidence is 0, return null
    if (totalConfidence === 0) {
      return null;
    }
    
    // Create blended result
    let blendedResult = {};
    
    // Blend results based on context confidence
    for (const context of contexts) {
      const result = contextResults.get(context.id);
      
      if (!result) {
        continue;
      }
      
      const weight = context.confidence / totalConfidence;
      
      // Blend attributes
      if (result.processedInput && result.processedInput.processedContent) {
        const content = result.processedInput.processedContent;
        
        // Merge content based on type
        if (typeof content === 'object') {
          blendedResult = this._mergeObjects(blendedResult, content, weight);
        } else if (typeof content === 'string') {
          blendedResult.text = (blendedResult.text || '') + (weight * content.length > 0 ? content : '');
        } else if (typeof content === 'number') {
          blendedResult.value = (blendedResult.value || 0) + (weight * content);
        }
      }
    }
    
    return blendedResult;
  }
  
  /**
   * Applies priority blending strategy.
   * @param {Map<string, Object>} contextResults - Results from each context.
   * @param {Array<Object>} contexts - Active contexts.
   * @returns {*} Blended result.
   * @private
   */
  _applyPriorityBlending(contextResults, contexts) {
    // Context type priorities (higher number = higher priority)
    const typePriorities = {
      [ContextType.DOMAIN]: 5,
      [ContextType.TEMPORAL]: 4,
      [ContextType.SPATIAL]: 3,
      [ContextType.PERSONAL]: 2,
      [ContextType.EMOTIONAL]: 1,
      [ContextType.LINGUISTIC]: 0,
      [ContextType.CULTURAL]: 0,
      [ContextType.SOCIAL]: 0
    };
    
    // Sort contexts by priority
    const sortedContexts = [...contexts].sort((a, b) => {
      const priorityA = typePriorities[a.type] || 0;
      const priorityB = typePriorities[b.type] || 0;
      
      // If priorities are equal, use confidence
      if (priorityA === priorityB) {
        return b.confidence - a.confidence;
      }
      
      return priorityB - priorityA;
    });
    
    // Use the highest priority context
    const primaryContext = sortedContexts[0];
    const result = contextResults.get(primaryContext.id);
    
    if (!result || !result.processedInput || !result.processedInput.processedContent) {
      return null;
    }
    
    return result.processedInput.processedContent;
  }
  
  /**
   * Applies recency blending strategy.
   * @param {Map<string, Object>} contextResults - Results from each context.
   * @param {Array<Object>} contexts - Active contexts.
   * @returns {*} Blended result.
   * @private
   */
  _applyRecencyBlending(contextResults, contexts) {
    // Sort contexts by activation time (descending)
    const sortedContexts = [...contexts].sort((a, b) => b.activationTime - a.activationTime);
    
    // Use the most recent context
    const primaryContext = sortedContexts[0];
    const result = contextResults.get(primaryContext.id);
    
    if (!result || !result.processedInput || !result.processedInput.processedContent) {
      return null;
    }
    
    return result.processedInput.processedContent;
  }
  
  /**
   * Applies hybrid blending strategy.
   * @param {Map<string, Object>} contextResults - Results from each context.
   * @param {Array<Object>} contexts - Active contexts.
   * @returns {*} Blended result.
   * @private
   */
  _applyHybridBlending(contextResults, contexts) {
    // Context type priorities (higher number = higher priority)
    const typePriorities = {
      [ContextType.DOMAIN]: 5,
      [ContextType.TEMPORAL]: 4,
      [ContextType.SPATIAL]: 3,
      [ContextType.PERSONAL]: 2,
      [ContextType.EMOTIONAL]: 1,
      [ContextType.LINGUISTIC]: 0,
      [ContextType.CULTURAL]: 0,
      [ContextType.SOCIAL]: 0
    };
    
    // Calculate hybrid scores
    const hybridScores = contexts.map(context => {
      const typePriority = typePriorities[context.type] || 0;
      const recencyScore = (Date.now() - context.activationTime) / 3600000; // Hours since activation
      const recencyFactor = Math.max(0, 1 - (recencyScore / 24)); // Decay over 24 hours
      
      // Combine factors
      const hybridScore = (context.confidence * 0.5) + (typePriority / 10 * 0.3) + (recencyFactor * 0.2);
      
      return { context, hybridScore };
    });
    
    // Sort by hybrid score (descending)
    hybridScores.sort((a, b) => b.hybridScore - a.hybridScore);
    
    // Create blended result
    let blendedResult = {};
    
    // Blend top 3 contexts or all if fewer
    const topContexts = hybridScores.slice(0, Math.min(3, hybridScores.length));
    const totalScore = topContexts.reduce((sum, item) => sum + item.hybridScore, 0);
    
    // If total score is 0, return null
    if (totalScore === 0) {
      return null;
    }
    
    // Blend results based on hybrid scores
    for (const { context, hybridScore } of topContexts) {
      const result = contextResults.get(context.id);
      
      if (!result) {
        continue;
      }
      
      const weight = hybridScore / totalScore;
      
      // Blend attributes
      if (result.processedInput && result.processedInput.processedContent) {
        const content = result.processedInput.processedContent;
        
        // Merge content based on type
        if (typeof content === 'object') {
          blendedResult = this._mergeObjects(blendedResult, content, weight);
        } else if (typeof content === 'string') {
          blendedResult.text = (blendedResult.text || '') + (weight * content.length > 0 ? content : '');
        } else if (typeof content === 'number') {
          blendedResult.value = (blendedResult.value || 0) + (weight * content);
        }
      }
    }
    
    return blendedResult;
  }
  
  /**
   * Merges objects with weighted values.
   * @param {Object} target - Target object.
   * @param {Object} source - Source object.
   * @param {number} weight - Weight to apply to source values.
   * @returns {Object} Merged object.
   * @private
   */
  _mergeObjects(target, source, weight) {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively merge nested objects
        result[key] = this._mergeObjects(result[key] || {}, value, weight);
      } else if (typeof value === 'number') {
        // Weighted average for numbers
        result[key] = (result[key] || 0) + (value * weight);
      } else if (typeof value === 'string') {
        // Concatenate strings with weight-based selection
        if (!result[key]) {
          result[key] = value;
        } else if (weight > 0.5) {
          // If weight is high, prefer this value
          result[key] = value;
        }
      } else if (Array.isArray(value)) {
        // Merge arrays
        if (!result[key]) {
          result[key] = [...value];
        } else {
          // Add unique items
          for (const item of value) {
            if (!result[key].includes(item)) {
              result[key].push(item);
            }
          }
        }
      } else {
        // For other types, use source value if weight is high enough
        if (weight > 0.5 || !result[key]) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Performs reasoning across active contexts.
   * @param {Object} input - Input data to reason about.
   * @param {string} input.id - Unique identifier for the input.
   * @param {string} input.content - Content to reason about.
   * @param {Object} [input.metadata] - Additional metadata.
   * @returns {Promise<Object>} Promise resolving to reasoning result.
   * @throws {Error} If input is invalid or reasoning fails.
   */
  async performCrossContextReasoning(input, options = {}) {
    const timerId = this.performanceMonitor.startTimer('performCrossContextReasoning');
    
    try {
      // Validate input
      if (!input || !input.id || !input.content) {
        throw new Error('Invalid input: must contain id and content properties');
      }
      
      // Check security access
      if (!this.securityManager.validateAccess('reasoning:perform')) {
        this.logger.warn('Unauthorized attempt to perform cross-context reasoning');
        throw new Error('Access denied: Unauthorized attempt to perform cross-context reasoning');
      }
      
      // Get active contexts
      const activeContexts = Array.from(this.activeContexts.values());
      
      // If no active contexts, use hierarchical reasoning directly
      if (activeContexts.length === 0) {
        const result = await this.hierarchicalReasoningFramework.reason(input);
        
        return {
          reasoningId: result.reasoningId,
          conclusion: result.conclusion,
          confidence: result.confidence,
          explanation: result.explanation,
          contexts: [],
          crossContextInsights: [],
          timestamp: Date.now()
        };
      }
      
      // If only one active context, use hierarchical reasoning with context
      if (activeContexts.length === 1) {
        const context = activeContexts[0];
        
        const result = await this.hierarchicalReasoningFramework.reason(input, {
          contextInfo: {
            id: context.id,
            type: context.type,
            name: context.name,
            attributes: context.attributes
          }
        });
        
        return {
          reasoningId: result.reasoningId,
          conclusion: result.conclusion,
          confidence: result.confidence,
          explanation: result.explanation,
          contexts: activeContexts,
          crossContextInsights: [],
          timestamp: Date.now()
        };
      }
      
      // For multiple contexts, perform reasoning in each context
      const contextReasoningResults = await this._performReasoningInContexts(input, activeContexts);
      
      // Generate cross-context insights
      const crossContextInsights = this._generateCrossContextInsights(contextReasoningResults);
      
      // Blend conclusions based on context confidence and reasoning confidence
      const blendedConclusion = this._blendReasoningConclusions(contextReasoningResults, activeContexts);
      
      return {
        reasoningId: `cross-${input.id}-${Date.now()}`,
        conclusion: blendedConclusion.conclusion,
        confidence: blendedConclusion.confidence,
        explanation: blendedConclusion.explanation,
        contexts: activeContexts,
        crossContextInsights: crossContextInsights,
        contextResults: Array.from(contextReasoningResults.values()),
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(`Error performing cross-context reasoning: ${error.message}`, error);
      throw error;
    } finally {
      this.performanceMonitor.endTimer(timerId);
    }
  }
  
  /**
   * Performs reasoning in each active context.
   * @param {Object} input - Input data to reason about.
   * @param {Array<Object>} contexts - Contexts to reason in.
   * @returns {Promise<Map<string, Object>>} Promise resolving to map of reasoning results.
   * @private
   */
  async _performReasoningInContexts(input, contexts) {
    const results = new Map();
    
    // Process in parallel if enabled
    if (this.parallelProcessingEnabled) {
      const reasoningPromises = contexts.map(async context => {
        try {
          const result = await this.hierarchicalReasoningFramework.reason(input, {
            contextInfo: {
              id: context.id,
              type: context.type,
              name: context.name,
              attributes: context.attributes
            }
          });
          
          return { contextId: context.id, result };
        } catch (error) {
          this.logger.error(`Error reasoning in context ${context.id}: ${error.message}`, error);
          return { contextId: context.id, error };
        }
      });
      
      const reasoningResults = await Promise.all(reasoningPromises);
      
      for (const { contextId, result, error } of reasoningResults) {
        if (!error) {
          results.set(contextId, result);
        }
      }
    } else {
      // Process sequentially
      for (const context of contexts) {
        try {
          const result = await this.hierarchicalReasoningFramework.reason(input, {
            contextInfo: {
              id: context.id,
              type: context.type,
              name: context.name,
              attributes: context.attributes
            }
          });
          
          results.set(context.id, result);
        } catch (error) {
          this.logger.error(`Error reasoning in context ${context.id}: ${error.message}`, error);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Generates insights by comparing reasoning results across contexts.
   * @param {Map<string, Object>} contextReasoningResults - Reasoning results from each context.
   * @returns {Array<Object>} Array of cross-context insights.
   * @private
   */
  _generateCrossContextInsights(contextReasoningResults) {
    const insights = [];
    
    // Get contexts with results
    const contextIds = Array.from(contextReasoningResults.keys());
    
    // If fewer than 2 contexts have results, no cross-context insights
    if (contextIds.length < 2) {
      return insights;
    }
    
    // Compare each pair of contexts
    for (let i = 0; i < contextIds.length; i++) {
      for (let j = i + 1; j < contextIds.length; j++) {
        const contextIdA = contextIds[i];
        const contextIdB = contextIds[j];
        
        const resultA = contextReasoningResults.get(contextIdA);
        const resultB = contextReasoningResults.get(contextIdB);
        
        const contextA = this.activeContexts.get(contextIdA);
        const contextB = this.activeContexts.get(contextIdB);
        
        if (!resultA || !resultB || !contextA || !contextB) {
          continue;
        }
        
        // Compare conclusions
        const comparisonResult = this._compareConclusions(resultA, resultB, contextA, contextB);
        
        if (comparisonResult) {
          insights.push(comparisonResult);
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Compares conclusions from two contexts.
   * @param {Object} resultA - Reasoning result from context A.
   * @param {Object} resultB - Reasoning result from context B.
   * @param {Object} contextA - Context A.
   * @param {Object} contextB - Context B.
   * @returns {Object|null} Comparison result or null if no insight.
   * @private
   */
  _compareConclusions(resultA, resultB, contextA, contextB) {
    // If either result is missing conclusion, return null
    if (!resultA.conclusion || !resultB.conclusion) {
      return null;
    }
    
    // Calculate similarity between conclusions
    let similarity = 0;
    
    if (this.vectorService) {
      // Use vector similarity if available
      try {
        similarity = this.vectorService.getSimilarity(
          resultA.conclusion,
          resultB.conclusion
        );
      } catch (error) {
        this.logger.error(`Error calculating conclusion similarity: ${error.message}`, error);
        // Fall back to string comparison
        similarity = this._calculateStringSimilarity(resultA.conclusion, resultB.conclusion);
      }
    } else {
      // Use string similarity
      similarity = this._calculateStringSimilarity(resultA.conclusion, resultB.conclusion);
    }
    
    // Determine relationship type
    let relationshipType;
    let confidence;
    
    if (similarity > 0.8) {
      relationshipType = 'agreement';
      confidence = similarity;
    } else if (similarity < 0.2) {
      relationshipType = 'conflict';
      confidence = 1 - similarity;
    } else {
      relationshipType = 'complementary';
      confidence = 0.5;
    }
    
    // Generate insight
    return {
      id: `insight-${contextA.id}-${contextB.id}-${Date.now()}`,
      type: relationshipType,
      confidence: confidence,
      contextA: {
        id: contextA.id,
        type: contextA.type,
        name: contextA.name
      },
      contextB: {
        id: contextB.id,
        type: contextB.type,
        name: contextB.name
      },
      conclusionA: resultA.conclusion,
      conclusionB: resultB.conclusion,
      similarity: similarity,
      description: this._generateInsightDescription(
        relationshipType,
        contextA,
        contextB,
        resultA,
        resultB
      )
    };
  }
  
  /**
   * Calculates string similarity using Levenshtein distance.
   * @param {string} strA - First string.
   * @param {string} strB - Second string.
   * @returns {number} Similarity score between 0 and 1.
   * @private
   */
  _calculateStringSimilarity(strA, strB) {
    if (strA === strB) {
      return 1;
    }
    
    if (!strA || !strB) {
      return 0;
    }
    
    const lenA = strA.length;
    const lenB = strB.length;
    
    // If either string is empty, similarity is 0
    if (lenA === 0 || lenB === 0) {
      return 0;
    }
    
    // Initialize matrix
    const matrix = Array(lenB + 1).fill().map(() => Array(lenA + 1).fill(0));
    
    // Fill first row and column
    for (let i = 0; i <= lenA; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= lenB; j++) {
      matrix[j][0] = j;
    }
    
    // Fill rest of matrix
    for (let j = 1; j <= lenB; j++) {
      for (let i = 1; i <= lenA; i++) {
        const cost = strA[i - 1] === strB[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    // Calculate similarity
    const distance = matrix[lenB][lenA];
    const maxLen = Math.max(lenA, lenB);
    
    return 1 - (distance / maxLen);
  }
  
  /**
   * Generates a description for a cross-context insight.
   * @param {string} relationshipType - Type of relationship between contexts.
   * @param {Object} contextA - First context.
   * @param {Object} contextB - Second context.
   * @param {Object} resultA - Reasoning result from first context.
   * @param {Object} resultB - Reasoning result from second context.
   * @returns {string} Insight description.
   * @private
   */
  _generateInsightDescription(relationshipType, contextA, contextB, resultA, resultB) {
    switch (relationshipType) {
      case 'agreement':
        return `The ${contextA.type} context (${contextA.name}) and ${contextB.type} context (${contextB.name}) agree in their conclusions, suggesting a consistent understanding across different perspectives.`;
        
      case 'conflict':
        return `The ${contextA.type} context (${contextA.name}) and ${contextB.type} context (${contextB.name}) have conflicting conclusions, indicating a potential tension or contradiction between different perspectives.`;
        
      case 'complementary':
        return `The ${contextA.type} context (${contextA.name}) and ${contextB.type} context (${contextB.name}) provide complementary perspectives, each contributing unique aspects to the overall understanding.`;
        
      default:
        return `Comparison between ${contextA.type} context (${contextA.name}) and ${contextB.type} context (${contextB.name}).`;
    }
  }
  
  /**
   * Blends reasoning conclusions from multiple contexts.
   * @param {Map<string, Object>} contextReasoningResults - Reasoning results from each context.
   * @param {Array<Object>} contexts - Active contexts.
   * @returns {Object} Blended conclusion.
   * @private
   */
  _blendReasoningConclusions(contextReasoningResults, contexts) {
    // Calculate combined weights for each context
    const weightedResults = [];
    
    for (const context of contexts) {
      const result = contextReasoningResults.get(context.id);
      
      if (!result) {
        continue;
      }
      
      // Combine context confidence and reasoning confidence
      const combinedWeight = (context.confidence + result.confidence) / 2;
      
      weightedResults.push({
        context,
        result,
        weight: combinedWeight
      });
    }
    
    // If no weighted results, return default
    if (weightedResults.length === 0) {
      return {
        conclusion: 'No conclusion available due to lack of context reasoning results.',
        confidence: 0,
        explanation: 'No context reasoning results available.'
      };
    }
    
    // Sort by weight (descending)
    weightedResults.sort((a, b) => b.weight - a.weight);
    
    // Use the highest weighted result as the base
    const primaryResult = weightedResults[0];
    
    // If only one result, return it
    if (weightedResults.length === 1) {
      return {
        conclusion: primaryResult.result.conclusion,
        confidence: primaryResult.weight,
        explanation: primaryResult.result.explanation
      };
    }
    
    // For multiple results, blend conclusions
    let blendedConclusion = primaryResult.result.conclusion;
    let totalWeight = primaryResult.weight;
    let explanations = [`From ${primaryResult.context.name}: ${primaryResult.result.explanation}`];
    
    // Add insights from other contexts
    for (let i = 1; i < weightedResults.length; i++) {
      const { context, result, weight } = weightedResults[i];
      
      // Add to explanation
      explanations.push(`From ${context.name}: ${result.explanation}`);
      
      // Update total weight
      totalWeight += weight;
    }
    
    // Calculate confidence as average of weights
    const confidence = totalWeight / weightedResults.length;
    
    // Combine explanations
    const explanation = explanations.join('\n\n');
    
    return {
      conclusion: blendedConclusion,
      confidence: confidence,
      explanation: explanation
    };
  }
  
  /**
   * Gets a context by ID.
   * @param {string} contextId - ID of the context to get.
   * @returns {Object|null} Context object or null if not found.
   */
  getContext(contextId) {
    return this.activeContexts.get(contextId) || null;
  }
  
  /**
   * Gets all active contexts.
   * @returns {Array<Object>} Array of active contexts.
   */
  getActiveContexts() {
    return Array.from(this.activeContexts.values());
  }
  
  /**
   * Disposes of the mechanism and cleans up resources.
   */
  dispose() {
    // Clear intervals
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    
    // Clear data structures
    this.activeContexts.clear();
    this.contextMemory.clear();
    this.contextCache.clear();
    
    this.logger.info('Disposing MultiContextUnderstandingMechanism');
  }
}

module.exports = {
  MultiContextUnderstandingMechanism,
  ContextType
};
