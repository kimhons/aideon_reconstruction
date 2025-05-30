/**
 * @fileoverview NaturalLanguageProcessor extracts intent, entities, and context from text
 * for the Aideon AI Desktop Agent. It provides advanced understanding capabilities
 * for voice commands and queries.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { LogManager } = require('../../../core/logging/LogManager');
const { ConfigManager } = require('../../../core/config/ConfigManager');
const { PerformanceTracker } = require('../../../core/performance/PerformanceTracker');

/**
 * Intent confidence levels
 * @enum {string}
 */
const IntentConfidenceLevel = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none'
};

/**
 * Entity types
 * @enum {string}
 */
const EntityType = {
  PERSON: 'person',
  LOCATION: 'location',
  ORGANIZATION: 'organization',
  DATE: 'date',
  TIME: 'time',
  DURATION: 'duration',
  NUMBER: 'number',
  PERCENTAGE: 'percentage',
  MONEY: 'money',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  FILE_PATH: 'file_path',
  APPLICATION: 'application',
  COMMAND: 'command',
  PARAMETER: 'parameter',
  CUSTOM: 'custom'
};

/**
 * NaturalLanguageProcessor class
 * Extracts intent, entities, and context from text
 */
class NaturalLanguageProcessor extends EventEmitter {
  /**
   * Create a new NaturalLanguageProcessor
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Optional custom logger
   * @param {Object} [options.configManager] - Optional custom config manager
   * @param {Object} [options.performanceTracker] - Optional custom performance tracker
   * @param {Object} [options.knowledgeGraph] - Optional knowledge graph for entity resolution
   * @param {Object} [options.languageModelIntegration] - Optional language model integration
   */
  constructor(options = {}) {
    super();
    
    // Initialize system services
    this.logger = options.logger || LogManager.getLogger('NaturalLanguageProcessor');
    this.configManager = options.configManager || ConfigManager.getInstance();
    this.performanceTracker = options.performanceTracker || new PerformanceTracker('NaturalLanguageProcessor');
    
    // Initialize optional services
    this.knowledgeGraph = options.knowledgeGraph || null;
    this.languageModelIntegration = options.languageModelIntegration || null;
    
    // Initialize state
    this.config = {};
    this.initialized = false;
    this.intentClassifier = null;
    this.entityExtractor = null;
    this.contextTracker = null;
    this.conversationHistory = [];
    this.customEntities = new Map();
    this.customIntents = new Map();
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.process = this.process.bind(this);
    this.updateConfiguration = this.updateConfiguration.bind(this);
    this.registerCustomEntity = this.registerCustomEntity.bind(this);
    this.registerCustomIntent = this.registerCustomIntent.bind(this);
    this.clearConversationHistory = this.clearConversationHistory.bind(this);
    this._loadConfiguration = this._loadConfiguration.bind(this);
    this._initializeComponents = this._initializeComponents.bind(this);
    this._classifyIntent = this._classifyIntent.bind(this);
    this._extractEntities = this._extractEntities.bind(this);
    this._trackContext = this._trackContext.bind(this);
    this._enhanceWithKnowledgeGraph = this._enhanceWithKnowledgeGraph.bind(this);
    this._enhanceWithLanguageModel = this._enhanceWithLanguageModel.bind(this);
    
    this.logger.info('NaturalLanguageProcessor created');
  }
  
  /**
   * Initialize the natural language processor
   * @param {Object} [options] - Initialization options
   * @returns {Promise<boolean>} - True if initialization successful
   * @throws {Error} If initialization fails
   */
  async initialize(options = {}) {
    try {
      this.logger.info('Initializing natural language processor');
      this.performanceTracker.startTracking('initialize');
      
      // Load configuration
      await this._loadConfiguration(options);
      
      // Initialize components
      await this._initializeComponents();
      
      // Mark as initialized
      this.initialized = true;
      
      this.performanceTracker.stopTracking('initialize');
      this.logger.info('Natural language processor initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceTracker.stopTracking('initialize');
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Process text to extract intent, entities, and context
   * @param {string} text - Text to process
   * @param {Object} [options] - Processing options
   * @param {string} [options.language] - Language of the text
   * @param {Object} [options.context] - Additional context
   * @param {boolean} [options.useLLM] - Whether to use language model enhancement
   * @returns {Promise<Object>} - Processing result
   * @throws {Error} If processing fails
   */
  async process(text, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('NaturalLanguageProcessor not initialized');
      }
      
      this.logger.debug('Processing text');
      this.performanceTracker.startTracking('process');
      
      // Create processing ID
      const processingId = uuidv4();
      
      // Normalize text
      const normalizedText = this._normalizeText(text);
      
      // Classify intent
      const intentResult = await this._classifyIntent(normalizedText, options);
      
      // Extract entities
      const entitiesResult = await this._extractEntities(normalizedText, intentResult.intent, options);
      
      // Track context
      const contextResult = await this._trackContext(normalizedText, intentResult, entitiesResult, options);
      
      // Enhance with knowledge graph if available
      let enhancedResult = {
        id: processingId,
        rawText: text,
        normalizedText,
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        intentConfidenceLevel: this._getConfidenceLevel(intentResult.confidence),
        entities: entitiesResult.entities,
        context: contextResult.context,
        timestamp: Date.now()
      };
      
      if (this.knowledgeGraph) {
        enhancedResult = await this._enhanceWithKnowledgeGraph(enhancedResult);
      }
      
      // Enhance with language model if available and requested
      if (this.languageModelIntegration && (options.useLLM || this.config.alwaysUseLLM)) {
        enhancedResult = await this._enhanceWithLanguageModel(enhancedResult);
      }
      
      // Add to conversation history
      this._addToConversationHistory(enhancedResult);
      
      // Emit processing result event
      this.emit('processingResult', enhancedResult);
      
      this.performanceTracker.stopTracking('process');
      
      return enhancedResult;
    } catch (error) {
      this.performanceTracker.stopTracking('process');
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   * @returns {Promise<Object>} - Updated configuration
   */
  async updateConfiguration(newConfig) {
    try {
      this.logger.info('Updating natural language processor configuration');
      
      // Merge new config with existing
      Object.assign(this.config, newConfig);
      
      // Save to config manager
      await this.configManager.setConfig('naturalLanguageProcessor', this.config);
      
      // Reinitialize components if needed
      if (this.initialized && 
          (newConfig.intentClassifierModel || 
           newConfig.entityExtractorModel || 
           newConfig.contextTrackerModel)) {
        await this._initializeComponents();
      }
      
      this.logger.info('Natural language processor configuration updated');
      return this.config;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Register custom entity
   * @param {string} entityName - Entity name
   * @param {Object} entityConfig - Entity configuration
   * @param {string} entityConfig.type - Entity type
   * @param {Array<string>} entityConfig.examples - Example values
   * @param {Function} [entityConfig.validator] - Validation function
   * @returns {Promise<boolean>} - True if registration successful
   */
  async registerCustomEntity(entityName, entityConfig) {
    try {
      if (!entityName || !entityConfig) {
        throw new Error('Entity name and configuration are required');
      }
      
      if (!entityConfig.type) {
        entityConfig.type = EntityType.CUSTOM;
      }
      
      if (!entityConfig.examples || !Array.isArray(entityConfig.examples)) {
        entityConfig.examples = [];
      }
      
      this.logger.debug(`Registering custom entity: ${entityName}`);
      
      // Add to custom entities map
      this.customEntities.set(entityName, {
        name: entityName,
        type: entityConfig.type,
        examples: entityConfig.examples,
        validator: entityConfig.validator || null
      });
      
      // Update entity extractor if initialized
      if (this.initialized && this.entityExtractor) {
        await this.entityExtractor.addCustomEntity(entityName, entityConfig);
      }
      
      this.logger.debug(`Custom entity registered: ${entityName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register custom entity: ${entityName}`, error);
      return false;
    }
  }
  
  /**
   * Register custom intent
   * @param {string} intentName - Intent name
   * @param {Object} intentConfig - Intent configuration
   * @param {Array<string>} intentConfig.examples - Example phrases
   * @param {Array<string>} [intentConfig.entities] - Required entities
   * @param {Function} [intentConfig.matcher] - Custom matching function
   * @returns {Promise<boolean>} - True if registration successful
   */
  async registerCustomIntent(intentName, intentConfig) {
    try {
      if (!intentName || !intentConfig) {
        throw new Error('Intent name and configuration are required');
      }
      
      if (!intentConfig.examples || !Array.isArray(intentConfig.examples)) {
        intentConfig.examples = [];
      }
      
      this.logger.debug(`Registering custom intent: ${intentName}`);
      
      // Add to custom intents map
      this.customIntents.set(intentName, {
        name: intentName,
        examples: intentConfig.examples,
        entities: intentConfig.entities || [],
        matcher: intentConfig.matcher || null
      });
      
      // Update intent classifier if initialized
      if (this.initialized && this.intentClassifier) {
        await this.intentClassifier.addCustomIntent(intentName, intentConfig);
      }
      
      this.logger.debug(`Custom intent registered: ${intentName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to register custom intent: ${intentName}`, error);
      return false;
    }
  }
  
  /**
   * Clear conversation history
   * @returns {Promise<boolean>} - True if clearing successful
   */
  async clearConversationHistory() {
    try {
      this.logger.debug('Clearing conversation history');
      
      // Clear history
      this.conversationHistory = [];
      
      // Reset context tracker
      if (this.contextTracker) {
        await this.contextTracker.reset();
      }
      
      this.logger.debug('Conversation history cleared');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear conversation history', error);
      return false;
    }
  }
  
  /**
   * Get conversation history
   * @param {number} [limit] - Maximum number of history items to return
   * @returns {Array} - Conversation history
   */
  getConversationHistory(limit) {
    if (limit && limit > 0) {
      return this.conversationHistory.slice(0, limit);
    }
    return [...this.conversationHistory];
  }
  
  /**
   * Get configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Load configuration from config manager
   * @param {Object} options - Override options
   * @private
   * @returns {Promise<void>}
   */
  async _loadConfiguration(options = {}) {
    // Get configuration from config manager
    const savedConfig = await this.configManager.getConfig('naturalLanguageProcessor') || {};
    
    // Default configuration
    const defaultConfig = {
      // Intent classification settings
      intentClassifierModel: 'default',
      intentConfidenceThreshold: 0.6,
      
      // Entity extraction settings
      entityExtractorModel: 'default',
      entityConfidenceThreshold: 0.7,
      
      // Context tracking settings
      contextTrackerModel: 'default',
      contextHistorySize: 10,
      contextExpirationTime: 300000, // 5 minutes
      
      // Language model settings
      alwaysUseLLM: false,
      llmConfidenceThreshold: 0.7,
      
      // Language settings
      defaultLanguage: 'en-US',
      
      // Advanced settings
      enableFuzzyMatching: true,
      fuzzyMatchingThreshold: 0.8,
      enableSpellCorrection: true,
      enableSentimentAnalysis: false
    };
    
    // Merge default with saved config and override options
    this.config = { ...defaultConfig, ...savedConfig, ...options };
    
    this.logger.debug('Configuration loaded', this.config);
  }
  
  /**
   * Initialize components
   * @private
   * @returns {Promise<void>}
   */
  async _initializeComponents() {
    try {
      this.logger.debug('Initializing components');
      
      // Initialize intent classifier
      this.intentClassifier = new IntentClassifier({
        model: this.config.intentClassifierModel,
        confidenceThreshold: this.config.intentConfidenceThreshold,
        enableFuzzyMatching: this.config.enableFuzzyMatching,
        fuzzyMatchingThreshold: this.config.fuzzyMatchingThreshold,
        logger: this.logger.child({ component: 'intentClassifier' })
      });
      
      await this.intentClassifier.initialize();
      
      // Add custom intents
      for (const [intentName, intentConfig] of this.customIntents.entries()) {
        await this.intentClassifier.addCustomIntent(intentName, intentConfig);
      }
      
      // Initialize entity extractor
      this.entityExtractor = new EntityExtractor({
        model: this.config.entityExtractorModel,
        confidenceThreshold: this.config.entityConfidenceThreshold,
        enableSpellCorrection: this.config.enableSpellCorrection,
        logger: this.logger.child({ component: 'entityExtractor' })
      });
      
      await this.entityExtractor.initialize();
      
      // Add custom entities
      for (const [entityName, entityConfig] of this.customEntities.entries()) {
        await this.entityExtractor.addCustomEntity(entityName, entityConfig);
      }
      
      // Initialize context tracker
      this.contextTracker = new ContextTracker({
        model: this.config.contextTrackerModel,
        historySize: this.config.contextHistorySize,
        expirationTime: this.config.contextExpirationTime,
        logger: this.logger.child({ component: 'contextTracker' })
      });
      
      await this.contextTracker.initialize();
      
      this.logger.debug('Components initialized');
    } catch (error) {
      this.logger.error('Failed to initialize components', error);
      throw error;
    }
  }
  
  /**
   * Normalize text
   * @param {string} text - Text to normalize
   * @private
   * @returns {string} - Normalized text
   */
  _normalizeText(text) {
    if (!text) {
      return '';
    }
    
    // Convert to string if not already
    let normalizedText = String(text);
    
    // Trim whitespace
    normalizedText = normalizedText.trim();
    
    // Convert to lowercase
    normalizedText = normalizedText.toLowerCase();
    
    // Remove extra whitespace
    normalizedText = normalizedText.replace(/\s+/g, ' ');
    
    return normalizedText;
  }
  
  /**
   * Classify intent
   * @param {string} text - Text to classify
   * @param {Object} options - Classification options
   * @private
   * @returns {Promise<Object>} - Intent classification result
   */
  async _classifyIntent(text, options = {}) {
    try {
      this.logger.debug('Classifying intent');
      this.performanceTracker.startTracking('classifyIntent');
      
      // Get language
      const language = options.language || this.config.defaultLanguage;
      
      // Classify intent
      const result = await this.intentClassifier.classify(text, {
        language,
        context: options.context
      });
      
      this.performanceTracker.stopTracking('classifyIntent');
      
      return result;
    } catch (error) {
      this.performanceTracker.stopTracking('classifyIntent');
      this.logger.error('Intent classification failed', error);
      
      // Return default result on error
      return {
        intent: null,
        confidence: 0,
        alternativeIntents: []
      };
    }
  }
  
  /**
   * Extract entities
   * @param {string} text - Text to extract entities from
   * @param {string} intent - Classified intent
   * @param {Object} options - Extraction options
   * @private
   * @returns {Promise<Object>} - Entity extraction result
   */
  async _extractEntities(text, intent, options = {}) {
    try {
      this.logger.debug('Extracting entities');
      this.performanceTracker.startTracking('extractEntities');
      
      // Get language
      const language = options.language || this.config.defaultLanguage;
      
      // Extract entities
      const result = await this.entityExtractor.extract(text, {
        language,
        intent,
        context: options.context
      });
      
      this.performanceTracker.stopTracking('extractEntities');
      
      return result;
    } catch (error) {
      this.performanceTracker.stopTracking('extractEntities');
      this.logger.error('Entity extraction failed', error);
      
      // Return default result on error
      return {
        entities: []
      };
    }
  }
  
  /**
   * Track context
   * @param {string} text - Processed text
   * @param {Object} intentResult - Intent classification result
   * @param {Object} entitiesResult - Entity extraction result
   * @param {Object} options - Tracking options
   * @private
   * @returns {Promise<Object>} - Context tracking result
   */
  async _trackContext(text, intentResult, entitiesResult, options = {}) {
    try {
      this.logger.debug('Tracking context');
      this.performanceTracker.startTracking('trackContext');
      
      // Update context
      const result = await this.contextTracker.update({
        text,
        intent: intentResult.intent,
        entities: entitiesResult.entities,
        timestamp: Date.now(),
        additionalContext: options.context
      });
      
      this.performanceTracker.stopTracking('trackContext');
      
      return result;
    } catch (error) {
      this.performanceTracker.stopTracking('trackContext');
      this.logger.error('Context tracking failed', error);
      
      // Return default result on error
      return {
        context: options.context || {}
      };
    }
  }
  
  /**
   * Enhance result with knowledge graph
   * @param {Object} result - Processing result
   * @private
   * @returns {Promise<Object>} - Enhanced result
   */
  async _enhanceWithKnowledgeGraph(result) {
    try {
      this.logger.debug('Enhancing with knowledge graph');
      this.performanceTracker.startTracking('enhanceWithKnowledgeGraph');
      
      // Clone result to avoid modifying original
      const enhancedResult = { ...result };
      
      // Enhance entities with knowledge graph
      if (enhancedResult.entities && enhancedResult.entities.length > 0) {
        const enhancedEntities = [];
        
        for (const entity of enhancedResult.entities) {
          try {
            // Query knowledge graph for entity
            const entityInfo = await this.knowledgeGraph.queryEntity(entity.value, {
              type: entity.type,
              confidence: entity.confidence
            });
            
            if (entityInfo) {
              // Enhance entity with knowledge graph information
              enhancedEntities.push({
                ...entity,
                knowledgeGraph: entityInfo
              });
            } else {
              enhancedEntities.push(entity);
            }
          } catch (error) {
            this.logger.warn(`Failed to enhance entity with knowledge graph: ${entity.value}`, error);
            enhancedEntities.push(entity);
          }
        }
        
        enhancedResult.entities = enhancedEntities;
      }
      
      this.performanceTracker.stopTracking('enhanceWithKnowledgeGraph');
      
      return enhancedResult;
    } catch (error) {
      this.performanceTracker.stopTracking('enhanceWithKnowledgeGraph');
      this.logger.error('Knowledge graph enhancement failed', error);
      
      // Return original result on error
      return result;
    }
  }
  
  /**
   * Enhance result with language model
   * @param {Object} result - Processing result
   * @private
   * @returns {Promise<Object>} - Enhanced result
   */
  async _enhanceWithLanguageModel(result) {
    try {
      this.logger.debug('Enhancing with language model');
      this.performanceTracker.startTracking('enhanceWithLanguageModel');
      
      // Check if language model integration is available
      if (!this.languageModelIntegration) {
        return result;
      }
      
      // Check if enhancement is needed
      if (result.intent && result.intentConfidence > this.config.llmConfidenceThreshold) {
        return result;
      }
      
      // Clone result to avoid modifying original
      const enhancedResult = { ...result };
      
      // Prepare context for language model
      const context = {
        conversationHistory: this.conversationHistory.slice(0, 5),
        currentResult: result
      };
      
      // Enhance with language model
      const llmResult = await this.languageModelIntegration.enhanceUnderstanding(
        result.rawText,
        context
      );
      
      // Merge results
      if (llmResult) {
        // If LLM detected intent with higher confidence, use it
        if (llmResult.intent && 
            (!enhancedResult.intent || 
             llmResult.intentConfidence > enhancedResult.intentConfidence)) {
          enhancedResult.intent = llmResult.intent;
          enhancedResult.intentConfidence = llmResult.intentConfidence;
          enhancedResult.intentConfidenceLevel = this._getConfidenceLevel(llmResult.intentConfidence);
        }
        
        // Merge entities, preferring LLM entities for duplicates
        if (llmResult.entities && llmResult.entities.length > 0) {
          const existingEntities = new Map();
          
          // Index existing entities by value and type
          for (const entity of enhancedResult.entities) {
            const key = `${entity.value}:${entity.type}`;
            existingEntities.set(key, entity);
          }
          
          // Add or replace with LLM entities
          for (const llmEntity of llmResult.entities) {
            const key = `${llmEntity.value}:${llmEntity.type}`;
            existingEntities.set(key, llmEntity);
          }
          
          // Convert back to array
          enhancedResult.entities = Array.from(existingEntities.values());
        }
        
        // Merge context
        if (llmResult.context) {
          enhancedResult.context = {
            ...enhancedResult.context,
            ...llmResult.context
          };
        }
        
        // Add LLM metadata
        enhancedResult.llmEnhanced = true;
      }
      
      this.performanceTracker.stopTracking('enhanceWithLanguageModel');
      
      return enhancedResult;
    } catch (error) {
      this.performanceTracker.stopTracking('enhanceWithLanguageModel');
      this.logger.error('Language model enhancement failed', error);
      
      // Return original result on error
      return result;
    }
  }
  
  /**
   * Add result to conversation history
   * @param {Object} result - Processing result
   * @private
   */
  _addToConversationHistory(result) {
    // Add to history
    this.conversationHistory.unshift(result);
    
    // Limit history size
    if (this.conversationHistory.length > this.config.contextHistorySize) {
      this.conversationHistory = this.conversationHistory.slice(
        0, this.config.contextHistorySize
      );
    }
  }
  
  /**
   * Get confidence level from confidence score
   * @param {number} confidence - Confidence score
   * @private
   * @returns {string} - Confidence level
   */
  _getConfidenceLevel(confidence) {
    if (confidence >= 0.8) {
      return IntentConfidenceLevel.HIGH;
    } else if (confidence >= 0.6) {
      return IntentConfidenceLevel.MEDIUM;
    } else if (confidence >= 0.4) {
      return IntentConfidenceLevel.LOW;
    } else {
      return IntentConfidenceLevel.NONE;
    }
  }
}

/**
 * Intent Classifier
 */
class IntentClassifier {
  /**
   * Create a new IntentClassifier
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.model = options.model || 'default';
    this.confidenceThreshold = options.confidenceThreshold || 0.6;
    this.enableFuzzyMatching = options.enableFuzzyMatching !== false;
    this.fuzzyMatchingThreshold = options.fuzzyMatchingThreshold || 0.8;
    this.logger = options.logger || LogManager.getLogger('IntentClassifier');
    this.initialized = false;
    this.intents = new Map();
    this.classifier = null;
  }
  
  /**
   * Initialize the intent classifier
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Intent Classifier');
      
      // In a real implementation, this would load a machine learning model
      // For this example, we'll use a simple rule-based classifier
      
      // Initialize built-in intents
      this._initializeBuiltInIntents();
      
      // Create classifier
      this.classifier = {
        classify: (text, options) => this._classifyText(text, options)
      };
      
      this.initialized = true;
      this.logger.debug('Intent Classifier initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Intent Classifier', error);
      throw error;
    }
  }
  
  /**
   * Classify text
   * @param {string} text - Text to classify
   * @param {Object} options - Classification options
   * @returns {Promise<Object>} - Classification result
   */
  async classify(text, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Intent Classifier not initialized');
      }
      
      this.logger.debug('Classifying text');
      
      // Classify text
      const result = await this.classifier.classify(text, options);
      
      this.logger.debug(`Classified intent: ${result.intent} (confidence: ${result.confidence})`);
      
      return result;
    } catch (error) {
      this.logger.error('Text classification failed', error);
      throw error;
    }
  }
  
  /**
   * Add custom intent
   * @param {string} intentName - Intent name
   * @param {Object} intentConfig - Intent configuration
   * @returns {Promise<boolean>} - True if addition successful
   */
  async addCustomIntent(intentName, intentConfig) {
    try {
      this.logger.debug(`Adding custom intent: ${intentName}`);
      
      // Add to intents map
      this.intents.set(intentName, {
        name: intentName,
        examples: intentConfig.examples || [],
        entities: intentConfig.entities || [],
        matcher: intentConfig.matcher || null
      });
      
      this.logger.debug(`Custom intent added: ${intentName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add custom intent: ${intentName}`, error);
      return false;
    }
  }
  
  /**
   * Initialize built-in intents
   * @private
   */
  _initializeBuiltInIntents() {
    // Add common built-in intents
    const builtInIntents = [
      {
        name: 'greeting',
        examples: [
          'hello',
          'hi',
          'hey',
          'good morning',
          'good afternoon',
          'good evening',
          'howdy',
          'greetings'
        ]
      },
      {
        name: 'farewell',
        examples: [
          'goodbye',
          'bye',
          'see you',
          'see you later',
          'talk to you later',
          'have a good day',
          'until next time'
        ]
      },
      {
        name: 'help',
        examples: [
          'help',
          'help me',
          'i need help',
          'can you help me',
          'what can you do',
          'show me what you can do',
          'how does this work',
          'how do i use this'
        ]
      },
      {
        name: 'cancel',
        examples: [
          'cancel',
          'stop',
          'nevermind',
          'forget it',
          'abort',
          'exit',
          'quit'
        ]
      },
      {
        name: 'confirm',
        examples: [
          'yes',
          'yeah',
          'yep',
          'sure',
          'correct',
          'right',
          'ok',
          'okay',
          'confirm',
          'i confirm',
          'that\'s right'
        ]
      },
      {
        name: 'deny',
        examples: [
          'no',
          'nope',
          'nah',
          'negative',
          'incorrect',
          'wrong',
          'that\'s wrong',
          'i don\'t think so',
          'not really'
        ]
      },
      {
        name: 'search',
        examples: [
          'search for',
          'find',
          'look up',
          'search',
          'google',
          'search the web for',
          'find information about',
          'look for'
        ]
      },
      {
        name: 'open',
        examples: [
          'open',
          'launch',
          'start',
          'run',
          'execute',
          'load'
        ]
      },
      {
        name: 'close',
        examples: [
          'close',
          'exit',
          'quit',
          'terminate',
          'end',
          'shut down'
        ]
      }
    ];
    
    // Add to intents map
    for (const intent of builtInIntents) {
      this.intents.set(intent.name, intent);
    }
  }
  
  /**
   * Classify text using rule-based approach
   * @param {string} text - Text to classify
   * @param {Object} options - Classification options
   * @private
   * @returns {Object} - Classification result
   */
  _classifyText(text, options = {}) {
    // Initialize results
    let bestIntent = null;
    let bestScore = 0;
    const alternativeIntents = [];
    
    // Check each intent
    for (const [intentName, intent] of this.intents.entries()) {
      // If intent has a custom matcher, use it
      if (intent.matcher && typeof intent.matcher === 'function') {
        try {
          const matchResult = intent.matcher(text, options);
          
          if (matchResult && matchResult.matched) {
            const score = matchResult.confidence || 1.0;
            
            if (score > bestScore) {
              // Add current best to alternatives
              if (bestIntent) {
                alternativeIntents.push({
                  intent: bestIntent,
                  confidence: bestScore
                });
              }
              
              // Update best
              bestIntent = intentName;
              bestScore = score;
            } else if (score > this.confidenceThreshold) {
              // Add as alternative
              alternativeIntents.push({
                intent: intentName,
                confidence: score
              });
            }
          }
        } catch (error) {
          this.logger.warn(`Custom matcher error for intent ${intentName}`, error);
        }
        
        // Continue to next intent
        continue;
      }
      
      // Check examples
      if (intent.examples && intent.examples.length > 0) {
        for (const example of intent.examples) {
          let score = 0;
          
          if (this.enableFuzzyMatching) {
            // Use fuzzy matching
            score = this._calculateFuzzyMatchScore(text, example);
          } else {
            // Use exact matching
            if (text.includes(example)) {
              // Calculate score based on coverage
              score = example.length / text.length;
            }
          }
          
          // Update best score for this intent
          if (score > bestScore) {
            // Add current best to alternatives
            if (bestIntent) {
              alternativeIntents.push({
                intent: bestIntent,
                confidence: bestScore
              });
            }
            
            // Update best
            bestIntent = intentName;
            bestScore = score;
          } else if (score > this.confidenceThreshold) {
            // Add as alternative
            alternativeIntents.push({
              intent: intentName,
              confidence: score
            });
          }
        }
      }
    }
    
    // Sort alternatives by confidence
    alternativeIntents.sort((a, b) => b.confidence - a.confidence);
    
    // Check if best score meets threshold
    if (bestScore < this.confidenceThreshold) {
      bestIntent = null;
      bestScore = 0;
    }
    
    return {
      intent: bestIntent,
      confidence: bestScore,
      alternativeIntents: alternativeIntents.slice(0, 3) // Return top 3 alternatives
    };
  }
  
  /**
   * Calculate fuzzy match score between text and pattern
   * @param {string} text - Text to match
   * @param {string} pattern - Pattern to match against
   * @private
   * @returns {number} - Match score between 0 and 1
   */
  _calculateFuzzyMatchScore(text, pattern) {
    // Simple Levenshtein distance implementation
    const calculateLevenshteinDistance = (a, b) => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      
      const matrix = [];
      
      // Initialize matrix
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      
      // Fill matrix
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = a[j - 1] === b[i - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost // substitution
          );
        }
      }
      
      return matrix[b.length][a.length];
    };
    
    // Calculate distance
    const distance = calculateLevenshteinDistance(text, pattern);
    
    // Calculate similarity score
    const maxLength = Math.max(text.length, pattern.length);
    const similarityScore = 1 - (distance / maxLength);
    
    return similarityScore;
  }
}

/**
 * Entity Extractor
 */
class EntityExtractor {
  /**
   * Create a new EntityExtractor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.model = options.model || 'default';
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.enableSpellCorrection = options.enableSpellCorrection !== false;
    this.logger = options.logger || LogManager.getLogger('EntityExtractor');
    this.initialized = false;
    this.entities = new Map();
    this.extractor = null;
    this.patterns = new Map();
  }
  
  /**
   * Initialize the entity extractor
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Entity Extractor');
      
      // In a real implementation, this would load a machine learning model
      // For this example, we'll use a simple rule-based extractor
      
      // Initialize built-in entities
      this._initializeBuiltInEntities();
      
      // Compile patterns
      this._compilePatterns();
      
      // Create extractor
      this.extractor = {
        extract: (text, options) => this._extractEntities(text, options)
      };
      
      this.initialized = true;
      this.logger.debug('Entity Extractor initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Entity Extractor', error);
      throw error;
    }
  }
  
  /**
   * Extract entities from text
   * @param {string} text - Text to extract entities from
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} - Extraction result
   */
  async extract(text, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Entity Extractor not initialized');
      }
      
      this.logger.debug('Extracting entities');
      
      // Extract entities
      const result = await this.extractor.extract(text, options);
      
      this.logger.debug(`Extracted ${result.entities.length} entities`);
      
      return result;
    } catch (error) {
      this.logger.error('Entity extraction failed', error);
      throw error;
    }
  }
  
  /**
   * Add custom entity
   * @param {string} entityName - Entity name
   * @param {Object} entityConfig - Entity configuration
   * @returns {Promise<boolean>} - True if addition successful
   */
  async addCustomEntity(entityName, entityConfig) {
    try {
      this.logger.debug(`Adding custom entity: ${entityName}`);
      
      // Add to entities map
      this.entities.set(entityName, {
        name: entityName,
        type: entityConfig.type || EntityType.CUSTOM,
        examples: entityConfig.examples || [],
        validator: entityConfig.validator || null
      });
      
      // Recompile patterns
      this._compilePatterns();
      
      this.logger.debug(`Custom entity added: ${entityName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add custom entity: ${entityName}`, error);
      return false;
    }
  }
  
  /**
   * Initialize built-in entities
   * @private
   */
  _initializeBuiltInEntities() {
    // Add common built-in entities
    const builtInEntities = [
      {
        name: 'person',
        type: EntityType.PERSON,
        examples: []
      },
      {
        name: 'location',
        type: EntityType.LOCATION,
        examples: []
      },
      {
        name: 'organization',
        type: EntityType.ORGANIZATION,
        examples: []
      },
      {
        name: 'date',
        type: EntityType.DATE,
        examples: []
      },
      {
        name: 'time',
        type: EntityType.TIME,
        examples: []
      },
      {
        name: 'duration',
        type: EntityType.DURATION,
        examples: []
      },
      {
        name: 'number',
        type: EntityType.NUMBER,
        examples: []
      },
      {
        name: 'percentage',
        type: EntityType.PERCENTAGE,
        examples: []
      },
      {
        name: 'money',
        type: EntityType.MONEY,
        examples: []
      },
      {
        name: 'email',
        type: EntityType.EMAIL,
        examples: []
      },
      {
        name: 'phone',
        type: EntityType.PHONE,
        examples: []
      },
      {
        name: 'url',
        type: EntityType.URL,
        examples: []
      },
      {
        name: 'file_path',
        type: EntityType.FILE_PATH,
        examples: []
      },
      {
        name: 'application',
        type: EntityType.APPLICATION,
        examples: [
          'chrome',
          'firefox',
          'safari',
          'edge',
          'word',
          'excel',
          'powerpoint',
          'outlook',
          'notepad',
          'calculator',
          'terminal',
          'cmd',
          'command prompt',
          'file explorer',
          'finder',
          'settings',
          'control panel',
          'task manager',
          'activity monitor'
        ]
      }
    ];
    
    // Add to entities map
    for (const entity of builtInEntities) {
      this.entities.set(entity.name, entity);
    }
  }
  
  /**
   * Compile patterns for entity extraction
   * @private
   */
  _compilePatterns() {
    // Clear patterns
    this.patterns.clear();
    
    // Compile patterns for each entity type
    this.patterns.set(EntityType.EMAIL, {
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      confidence: 0.9
    });
    
    this.patterns.set(EntityType.URL, {
      regex: /\b(https?:\/\/)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=]*)?/g,
      confidence: 0.9
    });
    
    this.patterns.set(EntityType.PHONE, {
      regex: /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      confidence: 0.9
    });
    
    this.patterns.set(EntityType.NUMBER, {
      regex: /\b\d+(\.\d+)?\b/g,
      confidence: 0.9
    });
    
    this.patterns.set(EntityType.PERCENTAGE, {
      regex: /\b\d+(\.\d+)?%\b/g,
      confidence: 0.9
    });
    
    this.patterns.set(EntityType.MONEY, {
      regex: /\b(\$|€|£|¥)?\d+(\.\d+)?( ?(\$|€|£|¥|USD|EUR|GBP|JPY))?\b/g,
      confidence: 0.9
    });
    
    this.patterns.set(EntityType.DATE, {
      regex: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](\d{4}|\d{2})\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( [0-9]{1,2}(st|nd|rd|th)?,?)?( \d{4})?\b|\b(yesterday|today|tomorrow)\b/gi,
      confidence: 0.8
    });
    
    this.patterns.set(EntityType.TIME, {
      regex: /\b([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?( ?[AP]M)?\b|\b(noon|midnight)\b/gi,
      confidence: 0.8
    });
    
    this.patterns.set(EntityType.DURATION, {
      regex: /\b\d+( ?(second|minute|hour|day|week|month|year)s?)\b/gi,
      confidence: 0.8
    });
    
    this.patterns.set(EntityType.FILE_PATH, {
      regex: /\b([A-Za-z]:)?[\\\/](?:[A-Za-z0-9_-]+[\\\/])*[A-Za-z0-9_-]+\.[A-Za-z0-9]+\b/g,
      confidence: 0.9
    });
    
    // Add application patterns based on examples
    const applicationEntity = this.entities.get('application');
    if (applicationEntity && applicationEntity.examples.length > 0) {
      const appNames = applicationEntity.examples.map(app => app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      this.patterns.set(EntityType.APPLICATION, {
        regex: new RegExp(`\\b(${appNames})\\b`, 'gi'),
        confidence: 0.8
      });
    }
    
    // Add custom entity patterns based on examples
    for (const [entityName, entity] of this.entities.entries()) {
      if (entity.type === EntityType.CUSTOM && entity.examples.length > 0) {
        const examples = entity.examples.map(ex => ex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        this.patterns.set(entityName, {
          regex: new RegExp(`\\b(${examples})\\b`, 'gi'),
          confidence: 0.8,
          type: EntityType.CUSTOM,
          name: entityName
        });
      }
    }
  }
  
  /**
   * Extract entities from text using rule-based approach
   * @param {string} text - Text to extract entities from
   * @param {Object} options - Extraction options
   * @private
   * @returns {Object} - Extraction result
   */
  _extractEntities(text, options = {}) {
    const entities = [];
    
    // Extract entities using patterns
    for (const [type, pattern] of this.patterns.entries()) {
      const regex = pattern.regex;
      regex.lastIndex = 0; // Reset regex state
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const value = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + value.length;
        
        // Create entity
        const entity = {
          type: pattern.type || type,
          value,
          startIndex,
          endIndex,
          confidence: pattern.confidence,
          metadata: {
            raw: value
          }
        };
        
        // Add custom entity name if applicable
        if (pattern.name) {
          entity.name = pattern.name;
        }
        
        // Validate entity if validator exists
        if (this.entities.has(type) && this.entities.get(type).validator) {
          try {
            const validationResult = this.entities.get(type).validator(value, options);
            
            if (!validationResult) {
              continue; // Skip invalid entity
            }
            
            // Update entity with validation result if it's an object
            if (typeof validationResult === 'object') {
              Object.assign(entity, validationResult);
            }
          } catch (error) {
            this.logger.warn(`Entity validation error for type ${type}`, error);
            continue; // Skip on validation error
          }
        }
        
        // Add entity if confidence meets threshold
        if (entity.confidence >= this.confidenceThreshold) {
          entities.push(entity);
        }
      }
    }
    
    // Sort entities by start index
    entities.sort((a, b) => a.startIndex - b.startIndex);
    
    return {
      entities
    };
  }
}

/**
 * Context Tracker
 */
class ContextTracker {
  /**
   * Create a new ContextTracker
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.model = options.model || 'default';
    this.historySize = options.historySize || 10;
    this.expirationTime = options.expirationTime || 300000; // 5 minutes
    this.logger = options.logger || LogManager.getLogger('ContextTracker');
    this.initialized = false;
    this.context = {};
    this.history = [];
    this.lastUpdateTime = 0;
  }
  
  /**
   * Initialize the context tracker
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize() {
    try {
      this.logger.debug('Initializing Context Tracker');
      
      // Initialize context
      this.context = {
        session: {
          id: uuidv4(),
          startTime: Date.now()
        },
        entities: {},
        intents: {},
        conversation: {
          turnCount: 0,
          lastIntent: null,
          lastEntities: []
        },
        environment: {},
        user: {}
      };
      
      this.lastUpdateTime = Date.now();
      this.initialized = true;
      this.logger.debug('Context Tracker initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Context Tracker', error);
      throw error;
    }
  }
  
  /**
   * Update context
   * @param {Object} update - Context update
   * @returns {Promise<Object>} - Updated context
   */
  async update(update) {
    try {
      if (!this.initialized) {
        throw new Error('Context Tracker not initialized');
      }
      
      this.logger.debug('Updating context');
      
      // Check if context has expired
      const currentTime = Date.now();
      if (currentTime - this.lastUpdateTime > this.expirationTime) {
        this.logger.debug('Context expired, resetting');
        await this.reset();
      }
      
      // Update last update time
      this.lastUpdateTime = currentTime;
      
      // Add to history
      this.history.unshift({
        timestamp: currentTime,
        text: update.text,
        intent: update.intent,
        entities: update.entities
      });
      
      // Limit history size
      if (this.history.length > this.historySize) {
        this.history = this.history.slice(0, this.historySize);
      }
      
      // Update conversation context
      this.context.conversation.turnCount++;
      this.context.conversation.lastIntent = update.intent;
      this.context.conversation.lastEntities = update.entities;
      
      // Update entities context
      if (update.entities && update.entities.length > 0) {
        for (const entity of update.entities) {
          const type = entity.type;
          
          if (!this.context.entities[type]) {
            this.context.entities[type] = [];
          }
          
          // Add entity to context
          this.context.entities[type].push({
            value: entity.value,
            timestamp: currentTime
          });
          
          // Limit entities per type
          if (this.context.entities[type].length > 5) {
            this.context.entities[type] = this.context.entities[type].slice(0, 5);
          }
        }
      }
      
      // Update intents context
      if (update.intent) {
        if (!this.context.intents[update.intent]) {
          this.context.intents[update.intent] = {
            count: 0,
            lastTimestamp: 0
          };
        }
        
        this.context.intents[update.intent].count++;
        this.context.intents[update.intent].lastTimestamp = currentTime;
      }
      
      // Merge additional context if provided
      if (update.additionalContext) {
        this._mergeContext(update.additionalContext);
      }
      
      this.logger.debug('Context updated');
      
      return {
        context: this._getPublicContext()
      };
    } catch (error) {
      this.logger.error('Context update failed', error);
      throw error;
    }
  }
  
  /**
   * Reset context
   * @returns {Promise<boolean>} - True if reset successful
   */
  async reset() {
    try {
      this.logger.debug('Resetting context');
      
      // Preserve some context values
      const sessionId = this.context.session ? this.context.session.id : uuidv4();
      const user = this.context.user || {};
      
      // Reset context
      this.context = {
        session: {
          id: sessionId,
          startTime: Date.now()
        },
        entities: {},
        intents: {},
        conversation: {
          turnCount: 0,
          lastIntent: null,
          lastEntities: []
        },
        environment: {},
        user
      };
      
      // Clear history
      this.history = [];
      
      // Update last update time
      this.lastUpdateTime = Date.now();
      
      this.logger.debug('Context reset');
      return true;
    } catch (error) {
      this.logger.error('Context reset failed', error);
      return false;
    }
  }
  
  /**
   * Get context
   * @returns {Object} - Current context
   */
  getContext() {
    return this._getPublicContext();
  }
  
  /**
   * Get history
   * @returns {Array} - Context history
   */
  getHistory() {
    return [...this.history];
  }
  
  /**
   * Merge additional context
   * @param {Object} additionalContext - Additional context to merge
   * @private
   */
  _mergeContext(additionalContext) {
    // Helper function to deep merge objects
    const deepMerge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    // Merge context
    deepMerge(this.context, additionalContext);
  }
  
  /**
   * Get public context (filtered for external use)
   * @private
   * @returns {Object} - Public context
   */
  _getPublicContext() {
    // Create a copy of the context with only public fields
    return {
      session: {
        id: this.context.session.id,
        turnCount: this.context.conversation.turnCount
      },
      entities: { ...this.context.entities },
      conversation: {
        lastIntent: this.context.conversation.lastIntent,
        lastEntities: this.context.conversation.lastEntities
      },
      user: { ...this.context.user }
    };
  }
}

// Export constants and classes
module.exports = {
  NaturalLanguageProcessor,
  IntentConfidenceLevel,
  EntityType,
  IntentClassifier,
  EntityExtractor,
  ContextTracker
};
