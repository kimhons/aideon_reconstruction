/**
 * @fileoverview IntentInferenceSystem for the Learning from Demonstration system.
 * Analyzes user actions to infer the underlying intent and goals.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const EventBus = require('../common/events/EventBus');
const Logger = require('../common/utils/Logger');
const Configuration = require('../common/utils/Configuration');
const { LearningError, ValidationError, OperationError } = require('../common/utils/ErrorHandler');
const Intent = require('../common/models/Intent');
const { v4: uuidv4 } = require('uuid');

/**
 * System for inferring user intent from demonstrated actions.
 */
class IntentInferenceSystem {
  /**
   * Intent confidence levels
   * @enum {string}
   */
  static CONFIDENCE_LEVELS = {
    HIGH: 'high',     // 0.8 - 1.0
    MEDIUM: 'medium', // 0.5 - 0.8
    LOW: 'low',       // 0.3 - 0.5
    UNCERTAIN: 'uncertain' // < 0.3
  };

  /**
   * Intent categories
   * @enum {string}
   */
  static INTENT_CATEGORIES = {
    DATA_MANIPULATION: 'data_manipulation',
    NAVIGATION: 'navigation',
    COMMUNICATION: 'communication',
    CONTENT_CREATION: 'content_creation',
    SYSTEM_OPERATION: 'system_operation',
    INFORMATION_RETRIEVAL: 'information_retrieval',
    AUTOMATION: 'automation',
    CUSTOM: 'custom'
  };

  /**
   * Creates a new IntentInferenceSystem instance.
   * @param {Object} options - System options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger('IntentInferenceSystem');
    this.config = options.config || new Configuration(IntentInferenceSystem.defaultConfig());
    
    this.inferenceModels = new Map();
    this.contextProviders = new Map();
    this.intentHistory = new Map();
    this.intentTemplates = new Map();
    
    this._setupEventListeners();
    this._registerDefaultModels();
    this._registerDefaultContextProviders();
    this._loadIntentTemplates();
    
    this.logger.info('IntentInferenceSystem initialized');
  }

  /**
   * Default configuration for the IntentInferenceSystem.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      inference: {
        defaultModel: 'heuristic',
        confidenceThreshold: 0.5,
        maxHistorySize: 100,
        enableLearning: true,
        contextWeight: 0.3,
        historyWeight: 0.2,
        actionWeight: 0.5,
        models: {
          heuristic: {
            enabled: true,
            weight: 1.0
          },
          statistical: {
            enabled: true,
            weight: 0.8,
            minSamples: 5
          },
          ml: {
            enabled: false,
            weight: 0.6,
            modelPath: './models/intent_model.json'
          }
        },
        templates: {
          path: './templates/intents',
          autoReload: true,
          reloadInterval: 3600000 // 1 hour in milliseconds
        }
      }
    };
  }

  /**
   * Infers intent from a demonstration.
   * @param {Object} demonstration - Demonstration object
   * @param {Object} [options={}] - Inference options
   * @param {Object} [options.context={}] - Additional context information
   * @param {boolean} [options.useHistory=true] - Whether to use intent history
   * @param {string[]} [options.models] - Specific models to use
   * @returns {Promise<Intent>} Promise resolving to the inferred intent
   */
  async inferIntent(demonstration, options = {}) {
    if (!demonstration || !demonstration.actions || !Array.isArray(demonstration.actions)) {
      throw new ValidationError('Invalid demonstration object');
    }
    
    try {
      this.logger.debug('Inferring intent from demonstration', {
        demonstrationId: demonstration.id,
        actionCount: demonstration.actions.length
      });
      
      const context = options.context || {};
      const useHistory = options.useHistory !== false;
      const modelNames = options.models || this._getEnabledModelNames();
      
      // Collect inference results from all specified models
      const modelResults = [];
      
      for (const modelName of modelNames) {
        const model = this.inferenceModels.get(modelName);
        
        if (model) {
          try {
            const modelWeight = this.config.get(`inference.models.${modelName}.weight`, 1.0);
            const result = await model.inferIntent(demonstration, { context, useHistory });
            
            if (result) {
              modelResults.push({
                ...result,
                weight: modelWeight,
                model: modelName
              });
            }
          } catch (error) {
            this.logger.error(`Error in inference model ${modelName}`, error);
          }
        }
      }
      
      // If no models produced results, return a default intent
      if (modelResults.length === 0) {
        return this._createDefaultIntent(demonstration);
      }
      
      // Combine results from all models
      const combinedIntent = this._combineIntentResults(modelResults, demonstration);
      
      // Enrich with context information
      await this._enrichIntentWithContext(combinedIntent, context);
      
      // Update intent history
      this._updateIntentHistory(combinedIntent);
      
      this.logger.info(`Inferred intent: ${combinedIntent.name} (${combinedIntent.id}) with confidence ${combinedIntent.confidence}`);
      this.eventBus.emit('intent:inferred', { intentId: combinedIntent.id, intent: combinedIntent });
      
      return combinedIntent;
    } catch (error) {
      this.logger.error('Failed to infer intent', error);
      this.eventBus.emit('intent:error', { error });
      throw new LearningError('Failed to infer intent', error);
    }
  }

  /**
   * Registers an inference model.
   * @param {string} modelName - Unique name for the model
   * @param {Object} model - Model implementation
   * @returns {IntentInferenceSystem} This instance for chaining
   */
  registerInferenceModel(modelName, model) {
    if (!modelName || typeof modelName !== 'string') {
      throw new ValidationError('Model name is required and must be a string');
    }
    
    if (!model || typeof model.inferIntent !== 'function') {
      throw new ValidationError('Model must implement inferIntent method');
    }
    
    this.inferenceModels.set(modelName, model);
    this.logger.info(`Registered inference model: ${modelName}`);
    
    return this;
  }

  /**
   * Unregisters an inference model.
   * @param {string} modelName - Name of the model to unregister
   * @returns {boolean} True if model was unregistered, false if not found
   */
  unregisterInferenceModel(modelName) {
    const result = this.inferenceModels.delete(modelName);
    
    if (result) {
      this.logger.info(`Unregistered inference model: ${modelName}`);
    }
    
    return result;
  }

  /**
   * Registers a context provider.
   * @param {string} providerName - Unique name for the provider
   * @param {Object} provider - Provider implementation
   * @returns {IntentInferenceSystem} This instance for chaining
   */
  registerContextProvider(providerName, provider) {
    if (!providerName || typeof providerName !== 'string') {
      throw new ValidationError('Provider name is required and must be a string');
    }
    
    if (!provider || typeof provider.getContext !== 'function') {
      throw new ValidationError('Provider must implement getContext method');
    }
    
    this.contextProviders.set(providerName, provider);
    this.logger.info(`Registered context provider: ${providerName}`);
    
    return this;
  }

  /**
   * Unregisters a context provider.
   * @param {string} providerName - Name of the provider to unregister
   * @returns {boolean} True if provider was unregistered, false if not found
   */
  unregisterContextProvider(providerName) {
    const result = this.contextProviders.delete(providerName);
    
    if (result) {
      this.logger.info(`Unregistered context provider: ${providerName}`);
    }
    
    return result;
  }

  /**
   * Registers an intent template.
   * @param {string} templateId - Unique identifier for the template
   * @param {Object} template - Intent template
   * @returns {IntentInferenceSystem} This instance for chaining
   */
  registerIntentTemplate(templateId, template) {
    if (!templateId || typeof templateId !== 'string') {
      throw new ValidationError('Template ID is required and must be a string');
    }
    
    if (!template || !template.name) {
      throw new ValidationError('Template must include at least a name');
    }
    
    this.intentTemplates.set(templateId, template);
    this.logger.info(`Registered intent template: ${templateId} (${template.name})`);
    
    return this;
  }

  /**
   * Gets an intent template by ID.
   * @param {string} templateId - Template ID
   * @returns {Object|null} Intent template or null if not found
   */
  getIntentTemplate(templateId) {
    return this.intentTemplates.get(templateId) || null;
  }

  /**
   * Gets all registered intent templates.
   * @returns {Array<Object>} Array of intent templates
   */
  getAllIntentTemplates() {
    return Array.from(this.intentTemplates.values());
  }

  /**
   * Gets intent history for a specific category.
   * @param {string} category - Intent category
   * @returns {Array<Intent>} Array of historical intents
   */
  getIntentHistory(category) {
    if (!category) {
      return Array.from(this.intentHistory.values()).flat();
    }
    
    return this.intentHistory.get(category) || [];
  }

  /**
   * Clears intent history.
   * @param {string} [category] - Optional category to clear
   * @returns {IntentInferenceSystem} This instance for chaining
   */
  clearIntentHistory(category) {
    if (category) {
      this.intentHistory.delete(category);
      this.logger.debug(`Cleared intent history for category: ${category}`);
    } else {
      this.intentHistory.clear();
      this.logger.debug('Cleared all intent history');
    }
    
    return this;
  }

  /**
   * Gets the confidence level for a given confidence score.
   * @param {number} confidence - Confidence score (0-1)
   * @returns {string} Confidence level
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) {
      return IntentInferenceSystem.CONFIDENCE_LEVELS.HIGH;
    } else if (confidence >= 0.5) {
      return IntentInferenceSystem.CONFIDENCE_LEVELS.MEDIUM;
    } else if (confidence >= 0.3) {
      return IntentInferenceSystem.CONFIDENCE_LEVELS.LOW;
    } else {
      return IntentInferenceSystem.CONFIDENCE_LEVELS.UNCERTAIN;
    }
  }

  /**
   * Registers default inference models.
   * @private
   */
  _registerDefaultModels() {
    // Heuristic model (rule-based)
    this.registerInferenceModel('heuristic', {
      inferIntent: async (demonstration, options) => {
        const actions = demonstration.actions || [];
        
        if (actions.length === 0) {
          return null;
        }
        
        // Analyze action types
        const actionTypes = actions.map(action => action.type);
        const actionTypeCounts = this._countOccurrences(actionTypes);
        
        // Determine primary action type
        const primaryActionType = Object.entries(actionTypeCounts)
          .sort((a, b) => b[1] - a[1])[0][0];
        
        // Map action types to intent categories
        const categoryMapping = {
          'MOUSE_CLICK': IntentInferenceSystem.INTENT_CATEGORIES.NAVIGATION,
          'MOUSE_MOVE': IntentInferenceSystem.INTENT_CATEGORIES.NAVIGATION,
          'MOUSE_DRAG': IntentInferenceSystem.INTENT_CATEGORIES.DATA_MANIPULATION,
          'KEY_PRESS': IntentInferenceSystem.INTENT_CATEGORIES.CONTENT_CREATION,
          'TEXT_INPUT': IntentInferenceSystem.INTENT_CATEGORIES.CONTENT_CREATION,
          'UI_INTERACTION': IntentInferenceSystem.INTENT_CATEGORIES.SYSTEM_OPERATION,
          'API_CALL': IntentInferenceSystem.INTENT_CATEGORIES.AUTOMATION,
          'SYSTEM_EVENT': IntentInferenceSystem.INTENT_CATEGORIES.SYSTEM_OPERATION
        };
        
        // Determine intent category
        const category = categoryMapping[primaryActionType] || IntentInferenceSystem.INTENT_CATEGORIES.CUSTOM;
        
        // Generate intent name based on action patterns
        let name = '';
        let description = '';
        
        if (category === IntentInferenceSystem.INTENT_CATEGORIES.NAVIGATION) {
          name = 'Navigate Interface';
          description = 'Navigate through the user interface';
        } else if (category === IntentInferenceSystem.INTENT_CATEGORIES.DATA_MANIPULATION) {
          name = 'Manipulate Data';
          description = 'Perform operations on data';
        } else if (category === IntentInferenceSystem.INTENT_CATEGORIES.CONTENT_CREATION) {
          name = 'Create Content';
          description = 'Create or edit content';
        } else if (category === IntentInferenceSystem.INTENT_CATEGORIES.SYSTEM_OPERATION) {
          name = 'System Operation';
          description = 'Perform system operations';
        } else if (category === IntentInferenceSystem.INTENT_CATEGORIES.AUTOMATION) {
          name = 'Automate Task';
          description = 'Automate a repetitive task';
        } else {
          name = 'Custom Task';
          description = 'Perform a custom task';
        }
        
        // Check for text input to refine intent
        const textInputs = actions.filter(action => action.type === 'TEXT_INPUT');
        if (textInputs.length > 0) {
          const combinedText = textInputs
            .map(action => action.data.text)
            .filter(text => text)
            .join(' ');
          
          if (combinedText.length > 0) {
            // Use text content to refine intent name and description
            const keywords = this._extractKeywords(combinedText);
            if (keywords.length > 0) {
              name = this._capitalizeFirstLetter(keywords[0]);
              description = `${name} operation based on text input`;
            }
          }
        }
        
        // Check for UI interactions to refine intent
        const uiInteractions = actions.filter(action => action.type === 'UI_INTERACTION');
        if (uiInteractions.length > 0) {
          const elementTypes = uiInteractions
            .map(action => action.data.elementType)
            .filter(type => type);
          
          const uniqueElementTypes = [...new Set(elementTypes)];
          if (uniqueElementTypes.length > 0) {
            const primaryElementType = uniqueElementTypes[0];
            name = `Interact with ${this._capitalizeFirstLetter(primaryElementType)}`;
            description = `Perform operations on ${primaryElementType} elements`;
          }
        }
        
        // Calculate confidence based on consistency of actions
        const uniqueActionTypes = new Set(actionTypes).size;
        const actionConsistency = 1 - (uniqueActionTypes / actionTypes.length);
        const confidence = Math.min(0.9, 0.5 + actionConsistency * 0.4);
        
        return {
          id: uuidv4(),
          name,
          description,
          category,
          confidence,
          parameters: {},
          metadata: {
            primaryActionType,
            actionTypeCounts,
            demonstrationId: demonstration.id
          }
        };
      }
    });
    
    // Statistical model
    this.registerInferenceModel('statistical', {
      inferIntent: async (demonstration, options) => {
        const actions = demonstration.actions || [];
        
        if (actions.length === 0) {
          return null;
        }
        
        // Use history if available
        const useHistory = options.useHistory !== false;
        let historicalIntents = [];
        
        if (useHistory) {
          historicalIntents = Array.from(this.intentHistory.values()).flat();
        }
        
        // If we don't have enough historical data, return null
        const minSamples = this.config.get('inference.models.statistical.minSamples', 5);
        if (historicalIntents.length < minSamples) {
          return null;
        }
        
        // Extract features from current demonstration
        const currentFeatures = this._extractDemonstrationFeatures(demonstration);
        
        // Find similar demonstrations in history
        const similarIntents = historicalIntents
          .map(intent => {
            const similarity = this._calculateFeatureSimilarity(
              currentFeatures,
              intent.metadata.features || {}
            );
            return { intent, similarity };
          })
          .filter(item => item.similarity > 0.7) // Only consider reasonably similar intents
          .sort((a, b) => b.similarity - a.similarity);
        
        // If no similar intents found, return null
        if (similarIntents.length === 0) {
          return null;
        }
        
        // Use the most similar intent as a base
        const mostSimilar = similarIntents[0];
        const baseIntent = mostSimilar.intent;
        
        // Create a new intent based on the most similar one
        return {
          id: uuidv4(),
          name: baseIntent.name,
          description: baseIntent.description,
          category: baseIntent.category,
          confidence: mostSimilar.similarity * 0.9, // Slightly reduce confidence
          parameters: { ...baseIntent.parameters },
          metadata: {
            basedOn: baseIntent.id,
            similarity: mostSimilar.similarity,
            features: currentFeatures,
            demonstrationId: demonstration.id
          }
        };
      }
    });
    
    // ML model placeholder (not enabled by default)
    this.registerInferenceModel('ml', {
      inferIntent: async (demonstration, options) => {
        // This is a placeholder for a machine learning model
        // In a real implementation, this would use a trained model
        this.logger.warn('ML inference model is a placeholder and not implemented');
        return null;
      }
    });
  }

  /**
   * Registers default context providers.
   * @private
   */
  _registerDefaultContextProviders() {
    // Application context provider
    this.registerContextProvider('application', {
      getContext: async () => {
        // In a real implementation, this would get information about the current application
        return {
          type: 'application',
          data: {
            // Placeholder data
            currentApplication: 'unknown',
            currentWindow: 'unknown',
            availableActions: []
          }
        };
      }
    });
    
    // User context provider
    this.registerContextProvider('user', {
      getContext: async () => {
        // In a real implementation, this would get information about the user
        return {
          type: 'user',
          data: {
            // Placeholder data
            preferences: {},
            recentActivities: []
          }
        };
      }
    });
    
    // System context provider
    this.registerContextProvider('system', {
      getContext: async () => {
        // In a real implementation, this would get information about the system
        return {
          type: 'system',
          data: {
            // Placeholder data
            platform: process.platform,
            availableResources: {}
          }
        };
      }
    });
  }

  /**
   * Loads intent templates.
   * @private
   */
  _loadIntentTemplates() {
    // In a real implementation, this would load templates from files
    // For now, register some default templates
    
    this.registerIntentTemplate('navigation', {
      name: 'Navigation',
      description: 'Navigate through the user interface',
      category: IntentInferenceSystem.INTENT_CATEGORIES.NAVIGATION,
      parameters: {
        target: {
          type: 'string',
          description: 'Target location or element'
        }
      }
    });
    
    this.registerIntentTemplate('data_entry', {
      name: 'Data Entry',
      description: 'Enter data into a form or field',
      category: IntentInferenceSystem.INTENT_CATEGORIES.CONTENT_CREATION,
      parameters: {
        fieldType: {
          type: 'string',
          description: 'Type of field being filled'
        },
        content: {
          type: 'string',
          description: 'Content being entered'
        }
      }
    });
    
    this.registerIntentTemplate('file_operation', {
      name: 'File Operation',
      description: 'Perform operations on files',
      category: IntentInferenceSystem.INTENT_CATEGORIES.DATA_MANIPULATION,
      parameters: {
        operation: {
          type: 'string',
          description: 'Type of operation (create, open, save, delete)'
        },
        fileType: {
          type: 'string',
          description: 'Type of file being operated on'
        }
      }
    });
    
    this.registerIntentTemplate('search', {
      name: 'Search',
      description: 'Search for information',
      category: IntentInferenceSystem.INTENT_CATEGORIES.INFORMATION_RETRIEVAL,
      parameters: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        source: {
          type: 'string',
          description: 'Search source'
        }
      }
    });
    
    this.registerIntentTemplate('automation', {
      name: 'Task Automation',
      description: 'Automate a repetitive task',
      category: IntentInferenceSystem.INTENT_CATEGORIES.AUTOMATION,
      parameters: {
        frequency: {
          type: 'string',
          description: 'How often the task should be performed'
        },
        trigger: {
          type: 'string',
          description: 'What triggers the task'
        }
      }
    });
  }

  /**
   * Gets the names of all enabled inference models.
   * @returns {Array<string>} Array of enabled model names
   * @private
   */
  _getEnabledModelNames() {
    const modelNames = [];
    
    for (const [name, model] of this.inferenceModels.entries()) {
      const enabled = this.config.get(`inference.models.${name}.enabled`, false);
      if (enabled) {
        modelNames.push(name);
      }
    }
    
    // If no models are enabled, use the default model
    if (modelNames.length === 0) {
      const defaultModel = this.config.get('inference.defaultModel', 'heuristic');
      if (this.inferenceModels.has(defaultModel)) {
        modelNames.push(defaultModel);
      }
    }
    
    return modelNames;
  }

  /**
   * Creates a default intent when inference fails.
   * @param {Object} demonstration - Demonstration object
   * @returns {Intent} Default intent
   * @private
   */
  _createDefaultIntent(demonstration) {
    const name = demonstration.name || 'Unknown Task';
    const description = demonstration.description || 'Task inferred from demonstration';
    
    return new Intent({
      id: uuidv4(),
      name,
      description,
      category: IntentInferenceSystem.INTENT_CATEGORIES.CUSTOM,
      confidence: 0.3,
      parameters: {},
      metadata: {
        isDefault: true,
        demonstrationId: demonstration.id
      }
    });
  }

  /**
   * Combines intent results from multiple models.
   * @param {Array<Object>} modelResults - Results from inference models
   * @param {Object} demonstration - Original demonstration
   * @returns {Intent} Combined intent
   * @private
   */
  _combineIntentResults(modelResults, demonstration) {
    if (modelResults.length === 0) {
      return this._createDefaultIntent(demonstration);
    }
    
    if (modelResults.length === 1) {
      return new Intent(modelResults[0]);
    }
    
    // Calculate total weight
    const totalWeight = modelResults.reduce((sum, result) => sum + result.weight, 0);
    
    // Group results by category
    const categoryCounts = {};
    for (const result of modelResults) {
      const category = result.category || IntentInferenceSystem.INTENT_CATEGORIES.CUSTOM;
      categoryCounts[category] = (categoryCounts[category] || 0) + result.weight;
    }
    
    // Find the most likely category
    const primaryCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Filter results to the primary category
    const primaryResults = modelResults.filter(result => 
      result.category === primaryCategory
    );
    
    // If no results match the primary category, use all results
    const resultsToUse = primaryResults.length > 0 ? primaryResults : modelResults;
    
    // Calculate weighted confidence
    const weightedConfidence = resultsToUse.reduce((sum, result) => 
      sum + (result.confidence * result.weight), 0) / totalWeight;
    
    // Find the result with the highest confidence * weight
    const bestResult = resultsToUse.reduce((best, current) => 
      (current.confidence * current.weight > best.confidence * best.weight) ? current : best, 
      resultsToUse[0]
    );
    
    // Combine parameters from all results
    const combinedParameters = {};
    for (const result of resultsToUse) {
      if (result.parameters) {
        Object.assign(combinedParameters, result.parameters);
      }
    }
    
    // Create combined intent
    return new Intent({
      id: uuidv4(),
      name: bestResult.name,
      description: bestResult.description,
      category: primaryCategory,
      confidence: weightedConfidence,
      parameters: combinedParameters,
      metadata: {
        combined: true,
        modelResults: modelResults.map(result => ({
          model: result.model,
          confidence: result.confidence,
          weight: result.weight
        })),
        demonstrationId: demonstration.id
      }
    });
  }

  /**
   * Enriches an intent with context information.
   * @param {Intent} intent - Intent to enrich
   * @param {Object} context - Context information
   * @returns {Promise<Intent>} Promise resolving to the enriched intent
   * @private
   */
  async _enrichIntentWithContext(intent, context) {
    try {
      // Collect context from all providers
      const contextData = {};
      
      for (const [name, provider] of this.contextProviders.entries()) {
        try {
          const providerContext = await provider.getContext();
          if (providerContext) {
            contextData[name] = providerContext;
          }
        } catch (error) {
          this.logger.error(`Error getting context from provider ${name}`, error);
        }
      }
      
      // Merge with provided context
      const mergedContext = { ...contextData, ...context };
      
      // Store context in intent metadata
      intent.metadata.context = mergedContext;
      
      // Use context to refine intent parameters
      this._refineIntentParameters(intent, mergedContext);
      
      return intent;
    } catch (error) {
      this.logger.error('Error enriching intent with context', error);
      return intent; // Return original intent on error
    }
  }

  /**
   * Refines intent parameters based on context.
   * @param {Intent} intent - Intent to refine
   * @param {Object} context - Context information
   * @private
   */
  _refineIntentParameters(intent, context) {
    // Find a matching template
    const templates = Array.from(this.intentTemplates.values());
    const matchingTemplate = templates.find(template => 
      template.category === intent.category && 
      this._calculateStringSimilarity(template.name, intent.name) > 0.7
    );
    
    if (matchingTemplate) {
      // Use template parameters as a base
      const templateParams = matchingTemplate.parameters || {};
      
      // Merge with existing parameters
      for (const [key, value] of Object.entries(templateParams)) {
        if (!intent.parameters[key]) {
          intent.parameters[key] = {
            type: value.type,
            description: value.description,
            value: null
          };
        }
      }
      
      // Store template info in metadata
      intent.metadata.template = matchingTemplate.id || matchingTemplate.name;
    }
    
    // Try to fill parameter values from context
    if (context.application && context.application.data) {
      const appData = context.application.data;
      
      // Example: Fill target parameter for navigation intents
      if (intent.category === IntentInferenceSystem.INTENT_CATEGORIES.NAVIGATION && 
          intent.parameters.target && 
          appData.currentWindow) {
        intent.parameters.target.value = appData.currentWindow;
      }
    }
  }

  /**
   * Updates the intent history.
   * @param {Intent} intent - Intent to add to history
   * @private
   */
  _updateIntentHistory(intent) {
    const category = intent.category || IntentInferenceSystem.INTENT_CATEGORIES.CUSTOM;
    
    // Get or create history array for this category
    let categoryHistory = this.intentHistory.get(category);
    if (!categoryHistory) {
      categoryHistory = [];
      this.intentHistory.set(category, categoryHistory);
    }
    
    // Add intent to history
    categoryHistory.unshift(intent);
    
    // Limit history size
    const maxSize = this.config.get('inference.maxHistorySize', 100);
    if (categoryHistory.length > maxSize) {
      categoryHistory.pop();
    }
  }

  /**
   * Extracts features from a demonstration.
   * @param {Object} demonstration - Demonstration object
   * @returns {Object} Extracted features
   * @private
   */
  _extractDemonstrationFeatures(demonstration) {
    const actions = demonstration.actions || [];
    
    // Count action types
    const actionTypes = actions.map(action => action.type);
    const actionTypeCounts = this._countOccurrences(actionTypes);
    
    // Calculate timing features
    let averageTimeBetweenActions = 0;
    let timingVariance = 0;
    
    if (actions.length > 1) {
      let totalTime = 0;
      const timeDiffs = [];
      
      for (let i = 1; i < actions.length; i++) {
        const prevTime = new Date(actions[i - 1].timestamp).getTime();
        const currTime = new Date(actions[i].timestamp).getTime();
        const diff = currTime - prevTime;
        
        totalTime += diff;
        timeDiffs.push(diff);
      }
      
      averageTimeBetweenActions = totalTime / (actions.length - 1);
      
      // Calculate variance
      let sumSquaredDiffs = 0;
      for (const diff of timeDiffs) {
        sumSquaredDiffs += Math.pow(diff - averageTimeBetweenActions, 2);
      }
      
      timingVariance = sumSquaredDiffs / timeDiffs.length;
    }
    
    // Extract text features
    const textInputs = actions
      .filter(action => action.type === 'TEXT_INPUT')
      .map(action => action.data.text)
      .filter(text => text);
    
    const combinedText = textInputs.join(' ');
    const keywords = this._extractKeywords(combinedText);
    
    // Extract UI features
    const uiElements = actions
      .filter(action => action.type === 'UI_INTERACTION')
      .map(action => action.data.elementType)
      .filter(type => type);
    
    const uniqueUiElements = [...new Set(uiElements)];
    
    return {
      actionTypeCounts,
      actionCount: actions.length,
      uniqueActionTypes: Object.keys(actionTypeCounts).length,
      averageTimeBetweenActions,
      timingVariance,
      keywords,
      uniqueUiElements
    };
  }

  /**
   * Calculates similarity between feature sets.
   * @param {Object} features1 - First feature set
   * @param {Object} features2 - Second feature set
   * @returns {number} Similarity score (0-1)
   * @private
   */
  _calculateFeatureSimilarity(features1, features2) {
    if (!features1 || !features2) {
      return 0;
    }
    
    // Compare action type distributions
    let actionTypeSimilarity = 0;
    if (features1.actionTypeCounts && features2.actionTypeCounts) {
      const allTypes = new Set([
        ...Object.keys(features1.actionTypeCounts),
        ...Object.keys(features2.actionTypeCounts)
      ]);
      
      let dotProduct = 0;
      let magnitude1 = 0;
      let magnitude2 = 0;
      
      for (const type of allTypes) {
        const count1 = features1.actionTypeCounts[type] || 0;
        const count2 = features2.actionTypeCounts[type] || 0;
        
        dotProduct += count1 * count2;
        magnitude1 += count1 * count1;
        magnitude2 += count2 * count2;
      }
      
      magnitude1 = Math.sqrt(magnitude1);
      magnitude2 = Math.sqrt(magnitude2);
      
      if (magnitude1 > 0 && magnitude2 > 0) {
        actionTypeSimilarity = dotProduct / (magnitude1 * magnitude2);
      }
    }
    
    // Compare keywords
    let keywordSimilarity = 0;
    if (features1.keywords && features2.keywords && 
        features1.keywords.length > 0 && features2.keywords.length > 0) {
      const commonKeywords = features1.keywords.filter(kw => 
        features2.keywords.includes(kw)
      );
      
      keywordSimilarity = (2 * commonKeywords.length) / 
        (features1.keywords.length + features2.keywords.length);
    }
    
    // Compare UI elements
    let uiElementSimilarity = 0;
    if (features1.uniqueUiElements && features2.uniqueUiElements && 
        features1.uniqueUiElements.length > 0 && features2.uniqueUiElements.length > 0) {
      const commonElements = features1.uniqueUiElements.filter(el => 
        features2.uniqueUiElements.includes(el)
      );
      
      uiElementSimilarity = (2 * commonElements.length) / 
        (features1.uniqueUiElements.length + features2.uniqueUiElements.length);
    }
    
    // Compare action counts
    const countDiff = Math.abs(features1.actionCount - features2.actionCount);
    const countSimilarity = 1 - Math.min(1, countDiff / Math.max(features1.actionCount, features2.actionCount));
    
    // Weighted combination
    return (
      actionTypeSimilarity * 0.5 +
      keywordSimilarity * 0.2 +
      uiElementSimilarity * 0.2 +
      countSimilarity * 0.1
    );
  }

  /**
   * Counts occurrences of items in an array.
   * @param {Array} array - Array of items
   * @returns {Object} Object with counts
   * @private
   */
  _countOccurrences(array) {
    return array.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {});
  }

  /**
   * Extracts keywords from text.
   * @param {string} text - Text to extract keywords from
   * @returns {Array<string>} Array of keywords
   * @private
   */
  _extractKeywords(text) {
    if (!text) {
      return [];
    }
    
    // Simple keyword extraction (in a real implementation, this would be more sophisticated)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Filter out common stop words
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'for', 'with', 'without', 'this', 'that',
      'these', 'those', 'from', 'into', 'during', 'after', 'before', 'above',
      'below', 'between', 'under', 'over', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
      'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
      'same', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now'
    ]);
    
    const filteredWords = words.filter(word => !stopWords.has(word));
    
    // Count occurrences
    const wordCounts = this._countOccurrences(filteredWords);
    
    // Sort by frequency
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 5); // Take top 5 keywords
  }

  /**
   * Calculates similarity between two strings.
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   * @private
   */
  _calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) {
      return 0;
    }
    
    // Convert to lowercase
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Calculate Levenshtein distance
    const m = s1.length;
    const n = s2.length;
    
    // Handle edge cases
    if (m === 0) return n === 0 ? 1 : 0;
    if (n === 0) return 0;
    
    // Initialize matrix
    const matrix = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    // Fill first row and column
    for (let i = 0; i <= m; i++) matrix[i][0] = i;
    for (let j = 0; j <= n; j++) matrix[0][j] = j;
    
    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Calculate similarity
    const distance = matrix[m][n];
    const maxLength = Math.max(m, n);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Capitalizes the first letter of a string.
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   * @private
   */
  _capitalizeFirstLetter(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Sets up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Listen for configuration changes
    this.config.addChangeListener((key, newValue, oldValue) => {
      this.logger.debug(`Configuration changed: ${key}`, { newValue, oldValue });
    });
    
    // Listen for demonstration capture events
    this.eventBus.on('capture:completed', async ({ demonstrationId, demonstration }) => {
      if (this.config.get('inference.enableLearning')) {
        try {
          this.logger.debug('Auto-inferring intent for completed demonstration');
          await this.inferIntent(demonstration);
        } catch (error) {
          this.logger.error('Failed to auto-infer intent', error);
        }
      }
    });
  }
}

module.exports = IntentInferenceSystem;
