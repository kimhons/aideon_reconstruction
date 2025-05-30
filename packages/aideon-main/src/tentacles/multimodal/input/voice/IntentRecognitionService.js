/**
 * @fileoverview IntentRecognitionService extracts intents and entities from
 * transcribed speech for the Aideon AI Desktop Agent. It provides natural language
 * understanding capabilities to convert user utterances into actionable intents.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../utils/EnhancedAsyncLock');

/**
 * IntentRecognitionService extracts intents and entities from transcribed speech.
 */
class IntentRecognitionService extends EventEmitter {
  /**
   * Creates a new IntentRecognitionService instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.config - Intent recognition configuration
   */
  constructor(options) {
    super();
    
    this.logger = options.logger || console;
    this.config = options.config || {};
    
    // Initialize state
    this.isInitialized = false;
    this.models = new Map();
    this.customIntents = new Map();
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.extractIntent = this.extractIntent.bind(this);
    this.registerCustomIntent = this.registerCustomIntent.bind(this);
    this.unregisterCustomIntent = this.unregisterCustomIntent.bind(this);
  }
  
  /**
   * Initializes the IntentRecognitionService.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('IntentRecognitionService already initialized');
          return true;
        }
        
        this.logger.info('Initializing IntentRecognitionService');
        
        // Initialize intent recognition models
        await this.initializeModels();
        
        // Load custom intents if configured
        if (this.config.customIntentsPath) {
          await this.loadCustomIntents(this.config.customIntentsPath);
        }
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('IntentRecognitionService initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize IntentRecognitionService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Initializes intent recognition models.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initializeModels() {
    try {
      // Initialize local model
      const { LocalIntentModel } = await import('./models/LocalIntentModel');
      const localModel = new LocalIntentModel({
        logger: this.logger
      });
      await localModel.initialize();
      this.models.set('local', localModel);
      this.logger.info('Initialized local intent model');
      
      // Initialize cloud model if configured
      if (this.config.useCloudModel) {
        const { CloudIntentModel } = await import('./models/CloudIntentModel');
        const cloudModel = new CloudIntentModel({
          apiKey: this.config.cloudApiKey,
          endpoint: this.config.cloudEndpoint,
          logger: this.logger
        });
        await cloudModel.initialize();
        this.models.set('cloud', cloudModel);
        this.logger.info('Initialized cloud intent model');
      }
    } catch (error) {
      this.logger.error('Failed to initialize intent models', error);
      throw error;
    }
  }
  
  /**
   * Loads custom intents from a file.
   * 
   * @private
   * @param {string} path - Path to custom intents file
   * @returns {Promise<void>}
   */
  async loadCustomIntents(path) {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(path, 'utf8');
      const customIntents = JSON.parse(data);
      
      for (const intent of customIntents) {
        this.customIntents.set(intent.name, intent);
      }
      
      this.logger.info(`Loaded ${this.customIntents.size} custom intents`);
    } catch (error) {
      this.logger.error('Failed to load custom intents', error);
      // Non-critical, continue without custom intents
    }
  }
  
  /**
   * Shuts down the IntentRecognitionService and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('IntentRecognitionService not initialized');
          return true;
        }
        
        this.logger.info('Shutting down IntentRecognitionService');
        
        // Shutdown models
        for (const [name, model] of this.models.entries()) {
          try {
            await model.shutdown();
            this.logger.info(`Shut down ${name} intent model`);
          } catch (error) {
            this.logger.error(`Error shutting down ${name} intent model`, error);
          }
        }
        this.models.clear();
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('IntentRecognitionService shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down IntentRecognitionService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Extracts intent from recognized text.
   * 
   * @param {string} text - Recognized text
   * @param {string} language - Language code
   * @returns {Promise<Object>} - Intent extraction result
   */
  async extractIntent(text, language) {
    try {
      if (!this.isInitialized) {
        throw new Error('IntentRecognitionService not initialized');
      }
      
      this.logger.info('Extracting intent from text');
      
      // Check for custom intents first
      const customIntent = this.matchCustomIntent(text);
      if (customIntent) {
        this.logger.info(`Matched custom intent: ${customIntent.name}`);
        return customIntent;
      }
      
      // Try cloud model first if available
      if (this.models.has('cloud')) {
        try {
          const cloudResult = await this.models.get('cloud').extractIntent(text, language);
          if (cloudResult && cloudResult.confidence >= 0.7) {
            this.logger.info(`Extracted intent using cloud model: ${cloudResult.name}`);
            return cloudResult;
          }
        } catch (error) {
          this.logger.error('Error extracting intent with cloud model', error);
          // Fall back to local model
        }
      }
      
      // Use local model
      if (this.models.has('local')) {
        const localResult = await this.models.get('local').extractIntent(text, language);
        this.logger.info(`Extracted intent using local model: ${localResult.name}`);
        return localResult;
      }
      
      throw new Error('No intent recognition models available');
    } catch (error) {
      this.logger.error('Failed to extract intent', error);
      this.emit('error', error);
      
      // Return a fallback intent
      return {
        name: 'fallback',
        confidence: 0.1,
        entities: [],
        text
      };
    }
  }
  
  /**
   * Matches text against custom intents.
   * 
   * @private
   * @param {string} text - Text to match
   * @returns {Object|null} - Matched intent or null
   */
  matchCustomIntent(text) {
    const normalizedText = text.toLowerCase().trim();
    
    for (const [name, intent] of this.customIntents.entries()) {
      for (const pattern of intent.patterns) {
        if (this.matchPattern(normalizedText, pattern)) {
          return {
            name: intent.name,
            confidence: 1.0,
            entities: this.extractEntities(normalizedText, intent.entities),
            text
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Matches text against a pattern.
   * 
   * @private
   * @param {string} text - Text to match
   * @param {string} pattern - Pattern to match against
   * @returns {boolean} - Whether the text matches the pattern
   */
  matchPattern(text, pattern) {
    // Simple pattern matching for now
    // Could be extended with regex or more sophisticated matching
    return text.includes(pattern.toLowerCase());
  }
  
  /**
   * Extracts entities from text based on entity definitions.
   * 
   * @private
   * @param {string} text - Text to extract entities from
   * @param {Array} entityDefs - Entity definitions
   * @returns {Array} - Extracted entities
   */
  extractEntities(text, entityDefs) {
    const entities = [];
    
    if (!entityDefs || entityDefs.length === 0) {
      return entities;
    }
    
    for (const def of entityDefs) {
      for (const value of def.values) {
        if (text.includes(value.toLowerCase())) {
          entities.push({
            name: def.name,
            value,
            start: text.indexOf(value.toLowerCase()),
            end: text.indexOf(value.toLowerCase()) + value.length
          });
        }
      }
    }
    
    return entities;
  }
  
  /**
   * Registers a custom intent.
   * 
   * @param {Object} intent - Custom intent definition
   * @param {string} intent.name - Intent name
   * @param {Array<string>} intent.patterns - Patterns to match
   * @param {Array<Object>} intent.entities - Entity definitions
   * @returns {boolean} - Whether the intent was registered successfully
   */
  registerCustomIntent(intent) {
    try {
      if (!intent.name || !intent.patterns || !Array.isArray(intent.patterns)) {
        throw new Error('Invalid intent definition');
      }
      
      this.customIntents.set(intent.name, intent);
      this.logger.info(`Registered custom intent: ${intent.name}`);
      this.emit('intentRegistered', { name: intent.name });
      return true;
    } catch (error) {
      this.logger.error('Failed to register custom intent', error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Unregisters a custom intent.
   * 
   * @param {string} name - Intent name
   * @returns {boolean} - Whether the intent was unregistered successfully
   */
  unregisterCustomIntent(name) {
    try {
      if (!this.customIntents.has(name)) {
        this.logger.warn(`Custom intent not found: ${name}`);
        return false;
      }
      
      this.customIntents.delete(name);
      this.logger.info(`Unregistered custom intent: ${name}`);
      this.emit('intentUnregistered', { name });
      return true;
    } catch (error) {
      this.logger.error('Failed to unregister custom intent', error);
      this.emit('error', error);
      return false;
    }
  }
}

module.exports = { IntentRecognitionService };

// Add module.exports at the end of the file
module.exports = { IntentRecognitionService };
